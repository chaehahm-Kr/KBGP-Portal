import "server-only";

import { verifyRetailerSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveEffectiveSku } from "@/lib/product/types";
import { formatCategoryName } from "@/lib/retailer/products";
import { getRetailerAccessibleStores } from "@/lib/retailer/weekly-check";
import { getFulfillmentSettings } from "@/lib/settings/fulfillment-settings";
import { DEFAULT_ESTIMATED_SHIPPING_DAYS } from "@/lib/settings/fulfillment-constants";
import {
  AnalysisPeriod,
  CompanyFinancialPerformanceSummary,
  CompanySkuFinancialEstimate,
  ReceiptEvent,
  StoreSkuFinancialEstimate,
} from "./performance-financial-types";
import {
  aggregateCompanySummary,
  aggregateStoreEstimatesToCompany,
  buildStoreSkuFinancialEstimate,
  PricingInput,
  SnapshotInput,
} from "./performance-financial-pure";

export * from "./performance-financial-types";
export * from "./performance-financial-pure";

/**
 * P3 Live Integration Contract / Adapter Interface
 * When P3 reorder target coverage is ready to incorporate P5 estimated financials,
 * P3 components or resolvers can consume this adapter without modifying P3 core logic.
 */
export interface P5PerformanceFinancialAdapter {
  estimatedUnitsSold: number | null;
  estimatedRetailSales: number | null;
  estimatedWholesaleCost: number | null;
  estimatedGrossProfit: number | null;
  estimatedGrossMargin: number | null;
  estimatedDailySalesRate: number | null;
  estimatedWeeklySalesRate: number | null;
  financialStatus: "available" | "insufficient_data" | "needs_review" | "not_available";
  financialStatusReason?: string;
  observedDays: number;
  intervalsCount: number;
}

/**
 * Main Authoritative DAL: Fetch Company & Store Product Performance Financial Estimates
 * Reuses batched data access patterns matching P1 and P2 without N+1 queries.
 */
export async function getRetailerFinancialEstimates(options?: {
  period?: AnalysisPeriod;
  storeId?: string | "all";
  productId?: string;
}): Promise<CompanyFinancialPerformanceSummary> {
  const period = options?.period || "30d";
  const storeIdFilter = options?.storeId || "all";
  const targetProductId = options?.productId;

  const session = await verifyRetailerSession();
  const adminClient = createAdminClient();

  // 1. Resolve store accessibility & role
  const { companyId, stores } = await getRetailerAccessibleStores();
  if (!companyId) {
    throw new Error("Retailer company not found.");
  }

  const validStoreIds = stores.map((s) => s.id);
  const activeStoreIds =
    storeIdFilter !== "all" && validStoreIds.includes(storeIdFilter)
      ? [storeIdFilter]
      : validStoreIds;

  // 2. Fetch authoritative fulfillment settings (P2 estimated shipping days)
  const fulfillmentSettings = await getFulfillmentSettings();
  const defaultShippingDays =
    fulfillmentSettings?.default_estimated_shipping_days || DEFAULT_ESTIMATED_SHIPPING_DAYS;

  // 3. Batch Fetch All Submitted Weekly Checks for Company
  let checksQuery = adminClient
    .from("retailer_weekly_checks")
    .select(`
      id,
      store_id,
      reporting_week,
      report_date,
      status,
      submitted_at,
      retailer_weekly_check_items (
        id,
        product_id,
        reported_remaining_qty,
        previous_reported_qty,
        delivered_since_previous,
        estimated_movement,
        is_counted,
        retail_price_snapshot,
        retail_price_basis
      )
    `)
    .eq("company_id", companyId)
    .eq("status", "submitted")
    .order("report_date", { ascending: true });

  if (activeStoreIds.length > 0) {
    checksQuery = checksQuery.in("store_id", activeStoreIds);
  }

  const { data: rawChecks, error: checksError } = await checksQuery;
  if (checksError) {
    console.error("Error fetching weekly checks for financial estimates:", checksError);
  }
  const submittedChecks = rawChecks || [];

  // Group check snapshots by productId -> storeId -> SnapshotInput[]
  const productStoreSnapshots = new Map<string, Map<string, SnapshotInput[]>>();
  const productAssociatedStoreIds = new Map<string, Set<string>>();

  const addProductStoreAssociation = (
    pId: string | null | undefined,
    sId: string | null | undefined
  ) => {
    if (!pId) return;
    if (!productAssociatedStoreIds.has(pId)) {
      productAssociatedStoreIds.set(pId, new Set());
    }
    if (sId) {
      productAssociatedStoreIds.get(pId)!.add(sId);
    }
  };

  submittedChecks.forEach((check) => {
    const items = (check.retailer_weekly_check_items as any[]) || [];
    items.forEach((item) => {
      if (!item.is_counted) return;
      const pId = item.product_id;
      addProductStoreAssociation(pId, check.store_id);

      if (!productStoreSnapshots.has(pId)) {
        productStoreSnapshots.set(pId, new Map());
      }
      const storeMap = productStoreSnapshots.get(pId)!;
      if (!storeMap.has(check.store_id)) {
        storeMap.set(check.store_id, []);
      }
      storeMap.get(check.store_id)!.push({
        checkId: check.id,
        storeId: check.store_id,
        reportDate: check.report_date,
        reportedRemaining: item.reported_remaining_qty ?? 0,
        retailPriceSnapshot: item.retail_price_snapshot ?? null,
        retailPriceBasis: item.retail_price_basis ?? null,
      });
    });
  });

  // 4. Batch Fetch Fulfillments & Dispatches for Estimated Receipts (P2 Canonical)
  const { data: rawFulfillments, error: ffError } = await adminClient
    .from("retailer_order_fulfillments")
    .select(`
      id,
      order_id,
      store_id,
      status,
      shipped_at,
      delivered_at,
      created_at,
      retailer_orders!inner (
        id,
        company_id,
        order_status
      ),
      retailer_order_fulfillment_items (
        id,
        product_id,
        quantity_shipped,
        quantity_delivered
      )
    `)
    .eq("retailer_orders.company_id", companyId)
    .neq("status", "cancelled");

  if (ffError) {
    console.error("Error fetching fulfillments for financial estimates:", ffError);
  }

  // Build ReceiptEvent list per productId -> storeId -> ReceiptEvent[]
  const productStoreReceipts = new Map<string, Map<string, ReceiptEvent[]>>();

  (rawFulfillments || []).forEach((ff: any) => {
    const sId = ff.store_id || "unassigned";
    const isExplicitlyDelivered = ff.status === "delivered" || !!ff.delivered_at;
    const shippedTimestamp = ff.shipped_at || ff.created_at;

    let receiptDateIso: string | null = null;
    let receiptTimestamp: number = 0;
    let isEstimated = false;

    if (isExplicitlyDelivered && ff.delivered_at) {
      receiptDateIso = new Date(ff.delivered_at).toISOString().split("T")[0];
      receiptTimestamp = new Date(ff.delivered_at).getTime();
    } else if (shippedTimestamp) {
      const estMs = new Date(shippedTimestamp).getTime() + defaultShippingDays * 86400000;
      receiptDateIso = new Date(estMs).toISOString().split("T")[0];
      receiptTimestamp = estMs;
      isEstimated = true;
    }

    if (!receiptDateIso) return;

    const ffItems = (ff.retailer_order_fulfillment_items as any[]) || [];
    ffItems.forEach((fi) => {
      const pId = fi.product_id;
      const qty = Number(fi.quantity_shipped || fi.quantity_delivered || 0);
      if (qty <= 0) return;

      addProductStoreAssociation(pId, sId !== "unassigned" ? sId : null);

      if (!productStoreReceipts.has(pId)) {
        productStoreReceipts.set(pId, new Map());
      }
      const storeMap = productStoreReceipts.get(pId)!;
      if (!storeMap.has(sId)) {
        storeMap.set(sId, []);
      }

      storeMap.get(sId)!.push({
        id: `${ff.id}_${fi.id}`,
        orderId: ff.order_id,
        storeId: sId,
        productId: pId,
        quantity: qty,
        receiptDate: receiptDateIso!,
        receiptTimestamp,
        isEstimated,
        deliveryStatus: isExplicitlyDelivered ? "delivered" : "estimated_in_transit",
      });
    });
  });

  // 5. Fetch Store Assortments & Ordered SKUs (P1 Canonical)
  const { data: storeProductRows } = await adminClient
    .from("store_products")
    .select("store_id, product_id, is_active")
    .in("store_id", validStoreIds);

  (storeProductRows || []).forEach((sp) => {
    if (activeStoreIds.includes(sp.store_id)) {
      addProductStoreAssociation(sp.product_id, sp.store_id);
    }
  });

  const { data: orderItemRows } = await adminClient
    .from("retailer_order_items")
    .select(`
      product_id,
      retailer_orders!inner (
        company_id,
        store_id,
        order_status
      )
    `)
    .eq("retailer_orders.company_id", companyId)
    .neq("retailer_orders.order_status", "cancelled");

  (orderItemRows || []).forEach((row: any) => {
    const pId = row.product_id;
    const sId = row.retailer_orders?.store_id;
    if (sId && activeStoreIds.includes(sId)) {
      addProductStoreAssociation(pId, sId);
    } else {
      addProductStoreAssociation(pId, null);
    }
  });

  // 6. Batch Fetch Products Catalog & Pricing
  let allProductIds = Array.from(productAssociatedStoreIds.keys());
  if (targetProductId) {
    allProductIds = allProductIds.filter((id) => id === targetProductId);
  }

  if (allProductIds.length === 0) {
    return {
      companyId,
      selectedPeriod: period,
      coverage: {
        totalStores: validStoreIds.length,
        reportingStores: 0,
        percent: 0,
        isPartial: validStoreIds.length > 0,
      },
      totalEstimatedUnitsSold: 0,
      totalEstimatedRetailSales: 0,
      totalEstimatedWholesaleCost: 0,
      totalEstimatedGrossProfit: 0,
      weightedGrossMargin: 0,
      skusWithEstimatesCount: 0,
      skusNeedsReviewCount: 0,
      skusInsufficientDataCount: 0,
      skusNotAvailableCount: 0,
      products: [],
    };
  }

  const { data: rawProducts, error: prodError } = await adminClient
    .from("products")
    .select(`
      id,
      name,
      name_en,
      category,
      category_code,
      brand_id,
      letusto_sku,
      manufacture_sku,
      status,
      estimated_retail_price,
      carton_pack_qty,
      price_additional_info,
      brands (
        id,
        name
      ),
      product_curations!inner (
        wholesale_price,
        suggest_retail_price,
        is_curated
      )
    `)
    .in("id", allProductIds);

  if (prodError) {
    console.error("Error fetching products for financial estimates:", prodError);
  }

  const productMap = new Map<string, any>();
  (rawProducts || []).forEach((p) => productMap.set(p.id, p));

  // 7. Calculate Financial Estimates per Product across Stores
  const productEstimates: CompanySkuFinancialEstimate[] = [];

  for (const productId of allProductIds) {
    const rawProd = productMap.get(productId);
    if (!rawProd) continue;

    const info = (rawProd.price_additional_info as any) || {};
    const overrides = info.admin_overrides || {};
    const curation = Array.isArray(rawProd.product_curations)
      ? rawProd.product_curations[0]
      : rawProd.product_curations;

    const brand = (rawProd.brands as any) || {};
    const brandName = brand.name || "K SELECT Brand";
    const categoryLabel = formatCategoryName(rawProd.category || rawProd.category_code);

    const effectiveSku =
      resolveEffectiveSku(overrides.letusto_sku, rawProd.letusto_sku) ||
      resolveEffectiveSku(overrides.manufacture_sku, rawProd.manufacture_sku) ||
      "KS-PROD";

    const wholesalePrice =
      curation?.wholesale_price && Number(curation.wholesale_price) > 0
        ? Number(curation.wholesale_price)
        : null;

    const pricing: PricingInput = {
      wholesalePrice,
      curationSrp: curation?.suggest_retail_price ? Number(curation.suggest_retail_price) : null,
      catalogErp: rawProd.estimated_retail_price ? Number(rawProd.estimated_retail_price) : null,
    };

    const cartonPackQty = Math.max(1, overrides.carton_pack_qty || rawProd.carton_pack_qty || 1);

    // Identify target stores for this product
    const associatedStores = productAssociatedStoreIds.get(productId) || new Set<string>();
    const targetStores = stores.filter(
      (s) => activeStoreIds.includes(s.id) && (associatedStores.size === 0 || associatedStores.has(s.id))
    );

    const storeEstimates: StoreSkuFinancialEstimate[] = [];

    for (const store of targetStores) {
      const snapshots = productStoreSnapshots.get(productId)?.get(store.id) || [];
      const receipts = productStoreReceipts.get(productId)?.get(store.id) || [];

      const estimate = buildStoreSkuFinancialEstimate({
        storeId: store.id,
        storeName: store.name,
        productId,
        sku: effectiveSku,
        selectedPeriod: period,
        snapshots,
        receipts,
        pricing,
      });

      storeEstimates.push(estimate);
    }

    const companySkuEstimate = aggregateStoreEstimatesToCompany({
      companyId,
      productId,
      sku: effectiveSku,
      productName: rawProd.name,
      productNameEn: rawProd.name_en,
      brandName,
      category: categoryLabel,
      cartonPackQty,
      selectedPeriod: period,
      totalCompanyStoresCount: stores.length,
      storeEstimates,
    });

    productEstimates.push(companySkuEstimate);
  }

  // 8. Build Company-Wide Rollup Summary
  return aggregateCompanySummary({
    companyId,
    selectedPeriod: period,
    totalStoresCount: stores.length,
    products: productEstimates,
  });
}

/**
 * Fetch financial estimate for a single SKU
 */
export async function getSkuFinancialEstimate(
  productId: string,
  options?: {
    period?: AnalysisPeriod;
    storeId?: string | "all";
  }
): Promise<CompanySkuFinancialEstimate | null> {
  const summary = await getRetailerFinancialEstimates({
    period: options?.period,
    storeId: options?.storeId,
    productId,
  });

  return summary.products.find((p) => p.productId === productId) || null;
}
