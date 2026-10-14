import "server-only";
import { verifyRetailerSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveEffectiveSku } from "@/lib/product/types";
import { formatCategoryName } from "@/lib/retailer/products";
import { getRetailerAccessibleStores } from "@/lib/retailer/weekly-check";
import { getFulfillmentSettings } from "@/lib/settings/fulfillment-settings";
import { DEFAULT_ESTIMATED_SHIPPING_DAYS } from "@/lib/settings/fulfillment-constants";
import { resolveAuthoritativeProductImages } from "@/lib/retailer/product-images";
import {
  buildStoreSkuFinancialEstimate,
  aggregateStoreEstimatesToCompany,
  aggregateCompanySummary,
  SnapshotInput,
  PricingInput,
} from "./performance-financial-pure";
import {
  FinancialMetrics,
  FinancialReliabilityStatus,
  ReceiptEvent,
  CompanySkuFinancialEstimate,
  StoreSkuFinancialEstimate,
  AnalysisPeriod,
} from "./performance-financial-types";

export type { FinancialMetrics, FinancialReliabilityStatus };

/**
 * @deprecated Legacy target constant kept for backward compatibility with external admin callers.
 * Product Performance P3 uses dynamic selectable coverage (30d / 60d).
 */
export const TARGET_WEEKS_OF_SUPPLY = 4;

export type ReportingPeriod = "7d" | "30d" | "90d" | "all";
export type ReorderCoverage = "30d" | "60d";
export const DEFAULT_REORDER_COVERAGE: ReorderCoverage = "30d";

export type MovementStatus = "normal" | "baseline" | "provisional" | "variance" | "no_data";
export type ReorderSignal = "reorder_needed" | "sufficient_stock" | "overstock" | "insufficient_data" | "needs_review";
export type ReorderConfidence = "insufficient_data" | "early_signal" | "recommendation_available" | "needs_review";

export interface StorePerformanceBreakdown {
  storeId: string;
  storeName: string;
  latestReportedRemaining: number | null;
  estimatedMovement: number;
  movementStatus: MovementStatus;
  avgWeeklyMovement: number;
  dailyVelocity: number;
  totalObservedDays: number;
  approxWeeksOfSupply: number | null;
  usableWeeksCount: number;
  lastReportDate: string | null;
  lastReportingWeek: string | null;

  // P2: Automatic Estimated Receipt & Inventory Flow
  orderedQty: number;
  cancelledQty: number;
  confirmedShippedQty: number;
  pendingQty: number;
  inTransitQty: number;
  estimatedReceivedQty: number;
  incomingQty: number;
  nextEstimatedReceiptDate: string | null;
  dataReliability: "verified" | "estimated";

  // P3: Time-Aware Post-Report Estimated Receipts & Safe Reorder
  postReportEstimatedReceipts: number;
  projectedAvailableStock: number | null;
  targetDemand: number;
  rawReorderNeed: number;
  suggestedReorderQty: number;

  // P5: Financials
  financialStatus?: FinancialReliabilityStatus;
  periodMetrics?: FinancialMetrics | null;
  cumulativeMetrics?: FinancialMetrics | null;
}

export interface ProductPerformanceItem {
  productId: string;
  productName: string;
  productNameEn: string | null;
  brandName: string;
  brandId: string;
  sku: string;
  thumbnailUrl: string | null;
  category: string;
  categoryLabel: string;
  cartonPackQty: number; // MOQ & Order multiple
  wholesalePrice: number;
  msrp: number;
  priceBasisLabel: string;
  
  // Movement & Stock
  totalReportedRemaining: number | null;
  estimatedMovement: number;
  movementStatus: MovementStatus;
  provisionalMovement: number;
  usableWeeksCount: number;
  totalObservedDays: number;
  averageWeeklyMovement: number;
  dailyVelocity: number;
  hasNegativeVariance: boolean;
  varianceCount: number;

  // P2: Automatic Estimated Receipt & Inventory Flow
  orderedQty: number;
  cancelledQty: number;
  confirmedShippedQty: number;
  pendingQty: number;
  inTransitQty: number;
  estimatedReceivedQty: number;
  incomingQty: number;
  nextEstimatedReceiptDate: string | null;
  dataReliability: "verified" | "estimated";

  // Financials (P5 Engine Authoritative)
  estimatedRetailSales: number | null;
  estimatedGrossProfit: number | null;
  estimatedGrossMargin: number | null;
  estimatedUnitsSold: number | null;
  financialStatus: FinancialReliabilityStatus;
  financialStatusReason?: string;
  cumulativeMetrics?: FinancialMetrics | null;
  isFinancialsHidden: boolean;

  // P3: Supply, Coverage & Reorder
  approxWeeksOfSupply: number | null;
  coverage: ReorderCoverage;
  coverageDays: number;
  targetWeeksOfSupply: number;
  targetDemand: number;
  postReportEstimatedReceipts: number;
  projectedAvailableStock: number | null;
  rawReorderNeed: number;
  suggestedReorderQty: number;
  suggestedCases: number;
  reorderSignal: ReorderSignal;
  reorderConfidence: ReorderConfidence;
  isOrderable: boolean;

  // Store-level Breakdown
  storesBreakdown: StorePerformanceBreakdown[];
}

export interface PerformanceDashboardData {
  companyId: string;
  userRole: string;
  selectedPeriod: ReportingPeriod;
  selectedCoverage: ReorderCoverage;
  selectedStoreId: string | "all";
  stores: Array<{ id: string; name: string }>;
  
  // Data Coverage
  dataCoverage: {
    totalStores: number;
    reportingStores: number;
    percent: number;
    isPartial: boolean;
  };

  // Top Summary KPIs
  summary: {
    totalEstimatedMovement: number | null;
    totalEstimatedRetailSales: number | null;
    totalEstimatedGrossProfit: number | null;
    averageGrossMargin: number | null;
    financialStatus: FinancialReliabilityStatus;
    productsNeedingReorderCount: number;
    totalProductsAssorted: number;
    totalIncomingQty: number;
    totalInTransitQty: number;
    totalPendingQty: number;
    skusWithEstimatesCount: number;
    skusNeedsReviewCount: number;
    defaultShippingDays: number;
    priceBasisNotice: string;
    isFinancialsHidden: boolean;
    coverageDays: number;
  };

  // Product List
  products: ProductPerformanceItem[];
}

/**
 * Filter checks by period date range
 */
function getPeriodCutoffDate(period: ReportingPeriod): Date | null {
  const now = new Date();
  if (period === "7d") {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    return d;
  }
  if (period === "30d") {
    const d = new Date(now);
    d.setDate(d.getDate() - 30);
    return d;
  }
  if (period === "90d") {
    const d = new Date(now);
    d.setDate(d.getDate() - 90);
    return d;
  }
  return null; // "all"
}

/**
 * Main DAL: Fetch Company & Store Product Performance Data
 */
export async function getRetailerPerformanceData(
  period: ReportingPeriod = "30d",
  storeIdFilter: string = "all",
  coverage: ReorderCoverage = "30d"
): Promise<PerformanceDashboardData> {
  const session = await verifyRetailerSession();
  const adminClient = createAdminClient();

  // 1. Resolve store accessibility & role
  const { companyId, userRole, stores } = await getRetailerAccessibleStores();
  if (!companyId) {
    throw new Error("Retailer company not found.");
  }

  const isFinancialsHidden = userRole === "employee";
  const validStoreIds = stores.map((s) => s.id);

  const activeStoreIds =
    storeIdFilter !== "all" && validStoreIds.includes(storeIdFilter)
      ? [storeIdFilter]
      : validStoreIds;

  // 2. Fetch all submitted weekly checks for this company & active stores
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

  const cutoffDate = getPeriodCutoffDate(period);
  if (cutoffDate) {
    const isoDate = cutoffDate.toISOString().split("T")[0];
    checksQuery = checksQuery.gte("report_date", isoDate);
  }

  const { data: rawChecks, error: checksError } = await checksQuery;
  if (checksError) {
    console.error("Error fetching weekly checks for performance:", checksError);
  }

  const submittedChecks = rawChecks || [];

  // 3. Compute Reporting Coverage
  const reportingStoreIdSet = new Set<string>();
  submittedChecks.forEach((c) => reportingStoreIdSet.add(c.store_id));
  const totalStores = validStoreIds.length;
  const reportingStores = reportingStoreIdSet.size;
  const coveragePercent = totalStores > 0 ? Math.round((reportingStores / totalStores) * 100) : 0;
  const isPartial = reportingStores < totalStores;

  // 4. Fetch Products Catalog, Curations & Images
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
      product_curations (
        wholesale_price,
        suggest_retail_price,
        status
      ),
      product_images (
        id,
        storage_path,
        position
      )
    `);

  if (prodError || !rawProducts) {
    console.error("Error fetching products for performance:", prodError);
  }

  const productMap = new Map<string, any>();
  (rawProducts || []).forEach((p) => productMap.set(p.id, p));

  // 5. Fetch Store Assortment (retailer_store_products) to know eligible products
  let storeProductQuery = adminClient
    .from("retailer_store_products")
    .select("store_id, product_id, is_active")
    .eq("company_id", companyId)
    .eq("is_active", true);

  if (activeStoreIds.length > 0) {
    storeProductQuery = storeProductQuery.in("store_id", activeStoreIds);
  }

  const { data: storeProductRows, error: spError } = await storeProductQuery;
  if (spError) {
    console.error("Error fetching retailer_store_products for performance:", spError);
  }

  // 6. Fetch Ordered Products from valid non-draft orders for this company & active stores
  let orderItemsQuery = adminClient
    .from("retailer_order_items")
    .select(`
      id,
      product_id,
      sku,
      quantity,
      quantity_shipped,
      quantity_cancelled,
      retailer_orders!inner (
        id,
        order_number,
        company_id,
        store_id,
        order_status,
        created_at
      )
    `)
    .eq("retailer_orders.company_id", companyId)
    .neq("retailer_orders.order_status", "draft");

  if (activeStoreIds.length > 0) {
    orderItemsQuery = orderItemsQuery.in("retailer_orders.store_id", activeStoreIds);
  }

  const { data: orderItemRows, error: orderItemsError } = await orderItemsQuery;
  if (orderItemsError) {
    console.error("Error fetching ordered items for performance inclusion:", orderItemsError);
  }

  // 6.1 Fetch Confirmed Fulfillments & items for this company
  let fulfillmentsQuery = adminClient
    .from("retailer_order_fulfillments")
    .select(`
      id,
      fulfillment_number,
      order_id,
      company_id,
      store_id,
      status,
      carrier,
      tracking_number,
      shipped_at,
      delivered_at,
      created_at,
      retailer_order_fulfillment_items (
        id,
        order_item_id,
        product_id,
        quantity_shipped,
        quantity_delivered
      )
    `)
    .eq("company_id", companyId)
    .in("status", ["shipped", "delivered"]);

  if (activeStoreIds.length > 0) {
    fulfillmentsQuery = fulfillmentsQuery.in("store_id", activeStoreIds);
  }

  const { data: rawFulfillments, error: ffError } = await fulfillmentsQuery;
  if (ffError) {
    console.error("Error fetching fulfillments for performance reconciliation:", ffError);
  }

  // 6.2 Fetch Invoices for this company to identify voided dispatches
  const { data: rawInvoices, error: invError } = await adminClient
    .from("retailer_invoices")
    .select("id, fulfillment_id, fulfillment_number, invoice_status")
    .eq("retailer_company_id", companyId);

  if (invError) {
    console.error("Error fetching invoices for performance reconciliation:", invError);
  }

  const voidFulfillmentIds = new Set<string>();
  const voidFulfillmentNumbers = new Set<string>();
  (rawInvoices || []).forEach((inv) => {
    if (inv.invoice_status === "void") {
      if (inv.fulfillment_id) voidFulfillmentIds.add(inv.fulfillment_id);
      if (inv.fulfillment_number) voidFulfillmentNumbers.add(inv.fulfillment_number);
    }
  });

  // 6.3 Fetch Authoritative Fulfillment Settings (default shipping days)
  const fulfillmentSettings = await getFulfillmentSettings();
  const defaultShippingDays =
    fulfillmentSettings.default_estimated_shipping_days || DEFAULT_ESTIMATED_SHIPPING_DAYS;

  // 6.4 Build Store Inventory Flow Map (ProductId -> StoreId -> StoreInventoryFlow)
  interface StoreInventoryFlow {
    orderedQty: number;
    cancelledQty: number;
    confirmedShippedQty: number;
    orderReportedShippedQty: number;
    pendingQty: number;
    inTransitQty: number;
    estimatedReceivedQty: number;
    incomingQty: number;
    nextEstimatedReceiptDate: string | null;
    hasLegacyDispatch: boolean;
  }

  const productStoreFlows = new Map<string, Map<string, StoreInventoryFlow>>();

  interface ProductStoreDispatch {
    estDateStr: string | null;
    qty: number;
    isReceived: boolean;
  }

  const productStoreDispatches = new Map<string, Map<string, ProductStoreDispatch[]>>();
  const productStoreReceiptEvents = new Map<string, Map<string, ReceiptEvent[]>>();

  const getOrCreateFlow = (pId: string, sId: string): StoreInventoryFlow => {
    if (!productStoreFlows.has(pId)) {
      productStoreFlows.set(pId, new Map());
    }
    const storeMap = productStoreFlows.get(pId)!;
    if (!storeMap.has(sId)) {
      storeMap.set(sId, {
        orderedQty: 0,
        cancelledQty: 0,
        confirmedShippedQty: 0,
        orderReportedShippedQty: 0,
        pendingQty: 0,
        inTransitQty: 0,
        estimatedReceivedQty: 0,
        incomingQty: 0,
        nextEstimatedReceiptDate: null,
        hasLegacyDispatch: false,
      });
    }
    return storeMap.get(sId)!;
  };

  // Process Order Items
  (orderItemRows || []).forEach((row: any) => {
    const pId = row.product_id;
    const sId = row.retailer_orders?.store_id || "unassigned";
    const orderStatus = row.retailer_orders?.order_status;
    const ordered = Number(row.quantity) || 0;
    let cancelled = Number(row.quantity_cancelled) || 0;
    const shipped = Number(row.quantity_shipped) || 0;

    if (orderStatus === "cancelled") {
      if (cancelled === 0) {
        cancelled = Math.max(0, ordered - shipped);
      }
    }

    const pending = orderStatus === "cancelled"
      ? 0
      : Math.max(0, ordered - shipped - cancelled);

    const flow = getOrCreateFlow(pId, sId);
    flow.orderedQty += ordered;
    flow.cancelledQty += cancelled;
    flow.pendingQty += pending;
    flow.orderReportedShippedQty += shipped;
  });

  // Process Confirmed Fulfillments
  const nowMs = Date.now();
  (rawFulfillments || []).forEach((ff: any) => {
    // Exclude voided/cancelled dispatches
    if (
      voidFulfillmentIds.has(ff.id) ||
      (ff.fulfillment_number && voidFulfillmentNumbers.has(ff.fulfillment_number))
    ) {
      return;
    }

    const sId = ff.store_id || "unassigned";
    const isExplicitlyDelivered = ff.status === "delivered" || !!ff.delivered_at;
    const shippedTimestamp = ff.shipped_at || ff.created_at;
    const estDate = shippedTimestamp
      ? new Date(new Date(shippedTimestamp).getTime() + defaultShippingDays * 86400000)
      : null;

    const isDateReached = estDate ? nowMs >= estDate.getTime() : false;
    const isReceived = isExplicitlyDelivered || isDateReached;
    const estDateStr = estDate ? estDate.toISOString().split("T")[0] : null;

    const ffItems = (ff.retailer_order_fulfillment_items as any[]) || [];
    ffItems.forEach((fi) => {
      const pId = fi.product_id;
      const qty = Number(fi.quantity_shipped) || 0;
      const flow = getOrCreateFlow(pId, sId);
      flow.confirmedShippedQty += qty;

      if (!productStoreDispatches.has(pId)) {
        productStoreDispatches.set(pId, new Map());
      }
      const pDispMap = productStoreDispatches.get(pId)!;
      if (!pDispMap.has(sId)) {
        pDispMap.set(sId, []);
      }
      pDispMap.get(sId)!.push({
        estDateStr,
        qty,
        isReceived,
      });

      // P5: Collect structured receipt events for observation interval reconciliation
      if (estDateStr) {
        if (!productStoreReceiptEvents.has(pId)) {
          productStoreReceiptEvents.set(pId, new Map());
        }
        const pReceiptMap = productStoreReceiptEvents.get(pId)!;
        if (!pReceiptMap.has(sId)) {
          pReceiptMap.set(sId, []);
        }
        pReceiptMap.get(sId)!.push({
          id: `${ff.id}_${fi.id || pId}`,
          orderId: ff.order_id || "",
          storeId: sId,
          productId: pId,
          quantity: qty,
          receiptDate: estDateStr,
          receiptTimestamp: estDate ? estDate.getTime() : 0,
          isEstimated: !isExplicitlyDelivered,
          deliveryStatus: isExplicitlyDelivered ? "delivered" : "estimated_in_transit",
        });
      }

      if (isReceived) {
        flow.estimatedReceivedQty += qty;
      } else {
        flow.inTransitQty += qty;
        if (estDateStr) {
          if (!flow.nextEstimatedReceiptDate || estDateStr < flow.nextEstimatedReceiptDate) {
            flow.nextEstimatedReceiptDate = estDateStr;
          }
        }
      }
    });
  });

  // Reconcile and calculate incomingQty
  for (const [, storeMap] of productStoreFlows.entries()) {
    for (const [, flow] of storeMap.entries()) {
      if (flow.orderReportedShippedQty > flow.confirmedShippedQty) {
        const legacyDiff = flow.orderReportedShippedQty - flow.confirmedShippedQty;
        flow.confirmedShippedQty += legacyDiff;
        flow.estimatedReceivedQty += legacyDiff;
        flow.hasLegacyDispatch = true;
      }
      flow.incomingQty = flow.pendingQty + flow.inTransitQty;
    }
  }

  // Group check items by product and store
  // Structure: ProductId -> StoreId -> Array of submitted check item snapshots sorted chronologically
  interface CheckItemSnapshot {
    checkId: string;
    storeId: string;
    reportDate: string;
    reportingWeek: string;
    reportedRemaining: number;
    previousReported: number | null;
    deliveredSincePrevious: number | null;
    estimatedMovement: number | null;
    retailPriceSnapshot: number | null;
    retailPriceBasis: string | null;
  }

  const productStoreSnapshots = new Map<string, Map<string, CheckItemSnapshot[]>>();

  // Track which stores are associated with each product (assortment, check, or order)
  const productAssociatedStoreIds = new Map<string, Set<string>>();
  const addProductStoreAssociation = (
    productId: string | null | undefined,
    storeId: string | null | undefined
  ) => {
    if (!productId) return;
    if (!productAssociatedStoreIds.has(productId)) {
      productAssociatedStoreIds.set(productId, new Set());
    }
    if (storeId) {
      productAssociatedStoreIds.get(productId)!.add(storeId);
    }
  };

  // 1. Assortment associations
  (storeProductRows || []).forEach((sp) => {
    if (activeStoreIds.includes(sp.store_id)) {
      addProductStoreAssociation(sp.product_id, sp.store_id);
    }
  });

  // 2. Weekly check associations
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
        reportingWeek: check.reporting_week,
        reportedRemaining: item.reported_remaining_qty ?? 0,
        previousReported: item.previous_reported_qty,
        deliveredSincePrevious: item.delivered_since_previous,
        estimatedMovement: item.estimated_movement,
        retailPriceSnapshot: item.retail_price_snapshot ?? null,
        retailPriceBasis: item.retail_price_basis ?? null,
      });
    });
  });

  // 3. Ordered SKU associations
  (orderItemRows || []).forEach((row: any) => {
    const pId = row.product_id;
    const sId = row.retailer_orders?.store_id;
    if (sId && activeStoreIds.includes(sId)) {
      addProductStoreAssociation(pId, sId);
    } else if (!sId) {
      // Legacy order without store association: preserve product in company view
      addProductStoreAssociation(pId, null);
    }
  });

  // Collect all eligible product IDs (union of assortment, checks, and orders)
  const allProductIds = Array.from(productAssociatedStoreIds.keys());

  // 7. Authoritative Image Resolution & Target Coverage Settings
  const imageMap = await resolveAuthoritativeProductImages(adminClient, allProductIds);
  const coverageDays = coverage === "60d" ? 60 : 30;

  // 8. Process Performance Metrics per Product
  const productPerformanceList: ProductPerformanceItem[] = [];
  const allCompanySkuEstimates: CompanySkuFinancialEstimate[] = [];

  for (const productId of Array.from(allProductIds)) {
    const rawProd = productMap.get(productId);
    if (!rawProd) continue;

    const info = (rawProd.price_additional_info as any) || {};
    const overrides = info.admin_overrides || {};
    const curation = Array.isArray(rawProd.product_curations)
      ? rawProd.product_curations[0]
      : rawProd.product_curations;

    const brand = (rawProd.brands as any) || {};
    const brandId = rawProd.brand_id || brand.id || "unassigned";
    const brandName = brand.name || "K SELECT Brand";

    const categoryCode = rawProd.category_code || rawProd.category || "skincare";
    const categoryLabel = formatCategoryName(rawProd.category || rawProd.category_code);

    const effectiveSku =
      resolveEffectiveSku(overrides.letusto_sku, rawProd.letusto_sku) ||
      resolveEffectiveSku(overrides.manufacture_sku, rawProd.manufacture_sku) ||
      "KS-PROD";

    // Wholesale Price & MSRP Resolution
    const salesPolicy = info.retailer_sales_policy || {};
    let wholesalePrice = 0;
    if (curation?.wholesale_price && Number(curation.wholesale_price) > 0) {
      wholesalePrice = Number(curation.wholesale_price);
    } else if (salesPolicy.promo_wholesale_price && Number(salesPolicy.promo_wholesale_price) > 0) {
      wholesalePrice = Number(salesPolicy.promo_wholesale_price);
    } else if (salesPolicy.base_wholesale_price && Number(salesPolicy.base_wholesale_price) > 0) {
      wholesalePrice = Number(salesPolicy.base_wholesale_price);
    } else if (rawProd.trading_wholesale_price && Number(rawProd.trading_wholesale_price) > 0) {
      wholesalePrice = Number(rawProd.trading_wholesale_price);
    }

    const isOrderable =
      wholesalePrice > 0 &&
      rawProd.status !== "discontinued" &&
      (rawProd.status === "selling" ||
        rawProd.trading_status === "active" ||
        rawProd.selection_status === "SELECTED" ||
        rawProd.retailer_visibility === "visible");

    let msrp = 0;
    if (curation?.suggest_retail_price && Number(curation.suggest_retail_price) > 0) {
      msrp = Number(curation.suggest_retail_price);
    } else if (salesPolicy.srp_price && Number(salesPolicy.srp_price) > 0) {
      msrp = Number(salesPolicy.srp_price);
    } else if (info.trading_overrides?.srp_price && Number(info.trading_overrides.srp_price) > 0) {
      msrp = Number(info.trading_overrides.srp_price);
    } else if (rawProd.estimated_retail_price && Number(rawProd.estimated_retail_price) > 0) {
      msrp = Number(rawProd.estimated_retail_price);
    } else if (wholesalePrice > 0) {
      msrp = Number((wholesalePrice * 2.0).toFixed(2));
    }

    const cartonPackQty = Math.max(
      1,
      overrides.carton_pack_qty ||
      salesPolicy.moq ||
      salesPolicy.order_multiple ||
      rawProd.carton_pack_qty ||
      1
    );

    // Authoritative Product Image
    const thumbnailUrl = imageMap[productId]?.primaryUrl || null;

    // Evaluate Store Snapshots for this product
    const storeBreakdowns: StorePerformanceBreakdown[] = [];
    const storeSnapMap = productStoreSnapshots.get(productId) || new Map();
    const skuStoreEstimates: StoreSkuFinancialEstimate[] = [];

    let companyTotalRemaining = 0;
    let companyTotalMovement = 0;
    let companyProvisionalMovement = 0;
    let companyUsableWeeks = 0;
    let companyTotalObservedDays = 0;
    let companyVarianceCount = 0;
    let companyTotalSales = 0;
    let companyTotalPostReportReceipts = 0;
    let hasAnyCount = false;
    let isAllBaseline = true;
    let hasTaggedPriceSnapshot = false;

    // Filter target stores: only include stores associated with this product
    const associatedStores = productAssociatedStoreIds.get(productId) || new Set<string>();
    const targetStores = stores.filter(
      (s) =>
        activeStoreIds.includes(s.id) &&
        (associatedStores.size === 0 || associatedStores.has(s.id))
    );

    const pricingInput: PricingInput = {
      wholesalePrice,
      curationSrp: curation?.suggest_retail_price ? Number(curation.suggest_retail_price) : null,
      catalogErp: rawProd.estimated_retail_price ? Number(rawProd.estimated_retail_price) : null,
    };

    // Process each relevant store for this product
    for (const store of targetStores) {
      const snapshots = storeSnapMap.get(store.id) || [];
      const storeFlow = productStoreFlows.get(productId)?.get(store.id) || {
        orderedQty: 0,
        cancelledQty: 0,
        confirmedShippedQty: 0,
        orderReportedShippedQty: 0,
        pendingQty: 0,
        inTransitQty: 0,
        estimatedReceivedQty: 0,
        incomingQty: 0,
        nextEstimatedReceiptDate: null,
        hasLegacyDispatch: false,
      };

      if (snapshots.length === 0) {
        const emptyStoreEstimate = buildStoreSkuFinancialEstimate({
          storeId: store.id,
          storeName: store.name,
          productId: rawProd.id,
          sku: effectiveSku,
          selectedPeriod: period as any,
          snapshots: [],
          receipts: [],
          pricing: pricingInput,
        });
        skuStoreEstimates.push(emptyStoreEstimate);

        storeBreakdowns.push({
          storeId: store.id,
          storeName: store.name,
          latestReportedRemaining: null,
          estimatedMovement: 0,
          movementStatus: "no_data",
          avgWeeklyMovement: 0,
          dailyVelocity: 0,
          totalObservedDays: 0,
          approxWeeksOfSupply: null,
          usableWeeksCount: 0,
          lastReportDate: null,
          lastReportingWeek: null,

          orderedQty: storeFlow.orderedQty,
          cancelledQty: storeFlow.cancelledQty,
          confirmedShippedQty: storeFlow.confirmedShippedQty,
          pendingQty: storeFlow.pendingQty,
          inTransitQty: storeFlow.inTransitQty,
          estimatedReceivedQty: storeFlow.estimatedReceivedQty,
          incomingQty: storeFlow.incomingQty,
          nextEstimatedReceiptDate: storeFlow.nextEstimatedReceiptDate,
          dataReliability: storeFlow.hasLegacyDispatch ? "estimated" : "verified",

          postReportEstimatedReceipts: 0,
          projectedAvailableStock: null,
          targetDemand: 0,
          rawReorderNeed: 0,
          suggestedReorderQty: 0,

          financialStatus: emptyStoreEstimate.periodMetrics.status,
          periodMetrics: emptyStoreEstimate.periodMetrics,
          cumulativeMetrics: emptyStoreEstimate.cumulativeMetrics,
        });
        continue;
      }

      hasAnyCount = true;
      const latestSnapshot = snapshots[snapshots.length - 1];
      const latestRemaining = latestSnapshot.reportedRemaining;
      companyTotalRemaining += latestRemaining;

      // P5: Build store financial estimate using pure calculation engine
      const storeReceipts = productStoreReceiptEvents.get(productId)?.get(store.id) || [];
      const storeSnapshotsInput: SnapshotInput[] = snapshots.map((s: any) => ({
        checkId: s.checkId,
        storeId: s.storeId,
        reportDate: s.reportDate,
        reportedRemaining: s.reportedRemaining,
        retailPriceSnapshot: s.retailPriceSnapshot,
        retailPriceBasis: s.retailPriceBasis,
      }));

      const storeSkuEstimate = buildStoreSkuFinancialEstimate({
        storeId: store.id,
        storeName: store.name,
        productId: rawProd.id,
        sku: effectiveSku,
        selectedPeriod: period as any,
        snapshots: storeSnapshotsInput,
        receipts: storeReceipts,
        pricing: pricingInput,
      });
      skuStoreEstimates.push(storeSkuEstimate);

      // Extract metrics from P5 estimate
      const storePeriodMetrics = storeSkuEstimate.periodMetrics;
      const storeMovement = storePeriodMetrics.estimatedUnitsSold ?? 0;
      const storeDailyVelocity = storePeriodMetrics.estimatedDailySalesRate ?? 0;
      const storeAvgWeekly = storePeriodMetrics.estimatedWeeklySalesRate ?? 0;
      const storeObservedDays = storePeriodMetrics.observedDays;
      const storeUsableWeeks = storePeriodMetrics.intervalsCount;

      let storeVarianceCount = 0;
      let storeMovementStatus: MovementStatus = "baseline";
      if (storePeriodMetrics.status === "needs_review") {
        storeMovementStatus = "variance";
        storeVarianceCount += 1;
      } else if (storePeriodMetrics.status === "available") {
        storeMovementStatus = "normal";
        isAllBaseline = false;
      } else if (snapshots.length > 1) {
        storeMovementStatus = "provisional";
      }

      // Check if price snapshots exist
      if (snapshots.some((s: any) => s.retailPriceSnapshot !== null && s.retailPriceSnapshot > 0)) {
        hasTaggedPriceSnapshot = true;
      }

      // Time-aware Post-Report Estimated Receipts for this store
      let storePostReportReceipts = 0;
      const storeDispatches = productStoreDispatches.get(productId)?.get(store.id) || [];
      for (const disp of storeDispatches) {
        if (
          disp.isReceived &&
          disp.estDateStr &&
          latestSnapshot.reportDate &&
          disp.estDateStr > latestSnapshot.reportDate
        ) {
          storePostReportReceipts += disp.qty;
        }
      }

      const storeWeeksSupply =
        storeAvgWeekly > 0 ? Number((latestRemaining / storeAvgWeekly).toFixed(1)) : null;

      const storeTargetDemand = Math.ceil(storeDailyVelocity * coverageDays);
      const storeProjectedStock =
        latestRemaining + storePostReportReceipts + storeFlow.incomingQty;
      const storeRawReorder =
        storeUsableWeeks > 0 ? Math.max(0, storeTargetDemand - storeProjectedStock) : 0;
      const storeSuggestedReorder =
        storeRawReorder > 0 ? Math.ceil(storeRawReorder / cartonPackQty) * cartonPackQty : 0;

      companyTotalMovement += storeMovement;
      companyUsableWeeks += storeUsableWeeks;
      companyTotalObservedDays += storeObservedDays;
      companyVarianceCount += storeVarianceCount;
      companyTotalPostReportReceipts += storePostReportReceipts;

      storeBreakdowns.push({
        storeId: store.id,
        storeName: store.name,
        latestReportedRemaining: latestRemaining,
        estimatedMovement: storeMovement,
        movementStatus: storeMovementStatus,
        avgWeeklyMovement: storeAvgWeekly,
        dailyVelocity: storeDailyVelocity,
        totalObservedDays: storeObservedDays,
        approxWeeksOfSupply: storeWeeksSupply,
        usableWeeksCount: storeUsableWeeks,
        lastReportDate: latestSnapshot.reportDate,
        lastReportingWeek: latestSnapshot.reportingWeek,

        orderedQty: storeFlow.orderedQty,
        cancelledQty: storeFlow.cancelledQty,
        confirmedShippedQty: storeFlow.confirmedShippedQty,
        pendingQty: storeFlow.pendingQty,
        inTransitQty: storeFlow.inTransitQty,
        estimatedReceivedQty: storeFlow.estimatedReceivedQty,
        incomingQty: storeFlow.incomingQty,
        nextEstimatedReceiptDate: storeFlow.nextEstimatedReceiptDate,
        dataReliability: storeFlow.hasLegacyDispatch ? "estimated" : "verified",

        postReportEstimatedReceipts: storePostReportReceipts,
        projectedAvailableStock: storeProjectedStock,
        targetDemand: storeTargetDemand,
        rawReorderNeed: storeRawReorder,
        suggestedReorderQty: storeSuggestedReorder,

        financialStatus: storePeriodMetrics.status,
        periodMetrics: storePeriodMetrics,
        cumulativeMetrics: storeSkuEstimate.cumulativeMetrics,
      });
    }

    // Aggregate store estimates into Company-level SKU estimate via P5 pure engine
    const companySkuEstimate = aggregateStoreEstimatesToCompany({
      companyId,
      productId: rawProd.id,
      sku: effectiveSku,
      productName: overrides.name?.trim() || rawProd.name,
      productNameEn: overrides.name_en?.trim() || rawProd.name_en || null,
      brandName,
      category: rawProd.category || "skincare",
      cartonPackQty,
      selectedPeriod: period as any,
      totalCompanyStoresCount: targetStores.length || stores.length,
      storeEstimates: skuStoreEstimates,
    });
    allCompanySkuEstimates.push(companySkuEstimate);

    const compPeriodMetrics = companySkuEstimate.periodMetrics;

    // Movement status
    let companyMovementStatus: MovementStatus = "no_data";
    if (hasAnyCount) {
      if (compPeriodMetrics.status === "needs_review") {
        companyMovementStatus = "variance";
      } else if (compPeriodMetrics.status === "available") {
        companyMovementStatus = "normal";
      } else if (isAllBaseline) {
        companyMovementStatus = "baseline";
      } else {
        companyMovementStatus = "provisional";
      }
    }

    const companyDailyVelocity = compPeriodMetrics.estimatedDailySalesRate ?? 0;
    const averageWeeklyMovement = compPeriodMetrics.estimatedWeeklySalesRate ?? 0;

    const approxWeeksOfSupply =
      averageWeeklyMovement > 0
        ? Number((companyTotalRemaining / averageWeeklyMovement).toFixed(1))
        : null;

    // Authoritative P5 financial metrics
    const estimatedRetailSales = compPeriodMetrics.estimatedRetailSales;
    const estimatedGrossProfit = compPeriodMetrics.estimatedGrossProfit;
    const estimatedGrossMargin = compPeriodMetrics.estimatedGrossMargin;
    const estimatedUnitsSold = compPeriodMetrics.estimatedUnitsSold;

    // Aggregate Company-level Inventory Flow & Incoming quantities
    let companyOrderedQty = 0;
    let companyCancelledQty = 0;
    let companyConfirmedShippedQty = 0;
    let companyPendingQty = 0;
    let companyInTransitQty = 0;
    let companyEstimatedReceivedQty = 0;
    let companyNextEstDate: string | null = null;
    let companyHasLegacy = false;

    const allStoreFlowsForProduct = productStoreFlows.get(productId);
    if (allStoreFlowsForProduct) {
      for (const [sId, fl] of allStoreFlowsForProduct.entries()) {
        if (activeStoreIds.length === 0 || activeStoreIds.includes(sId) || sId === "unassigned") {
          companyOrderedQty += fl.orderedQty;
          companyCancelledQty += fl.cancelledQty;
          companyConfirmedShippedQty += fl.confirmedShippedQty;
          companyPendingQty += fl.pendingQty;
          companyInTransitQty += fl.inTransitQty;
          companyEstimatedReceivedQty += fl.estimatedReceivedQty;
          if (fl.nextEstimatedReceiptDate) {
            if (!companyNextEstDate || fl.nextEstimatedReceiptDate < companyNextEstDate) {
              companyNextEstDate = fl.nextEstimatedReceiptDate;
            }
          }
          if (fl.hasLegacyDispatch) {
            companyHasLegacy = true;
          }
        }
      }
    }

    const companyIncomingQty = companyPendingQty + companyInTransitQty;

    // Company Projected Available Stock
    const totalReportedRemaining: number | null = hasAnyCount ? companyTotalRemaining : null;
    const projectedAvailableStock: number | null = hasAnyCount
      ? companyTotalRemaining + companyTotalPostReportReceipts + companyIncomingQty
      : null;

    // Reorder Calculations (P3 Engine aligned with P5 Velocity)
    const targetDemand = Math.ceil(companyDailyVelocity * coverageDays);

    const rawReorderNeed =
      compPeriodMetrics.intervalsCount > 0 && projectedAvailableStock !== null
        ? Math.max(0, targetDemand - projectedAvailableStock)
        : 0;

    // Round UP to valid MOQ / Case Pack Multiple
    let suggestedReorderQty = 0;
    if (rawReorderNeed > 0) {
      suggestedReorderQty = Math.ceil(rawReorderNeed / cartonPackQty) * cartonPackQty;
    }
    const suggestedCases =
      suggestedReorderQty > 0 ? Math.ceil(suggestedReorderQty / cartonPackQty) : 0;

    // Reorder Confidence & Signal
    let reorderConfidence: ReorderConfidence = "insufficient_data";
    if (compPeriodMetrics.status === "needs_review" || companyVarianceCount > 0) {
      reorderConfidence = "needs_review";
    } else if (compPeriodMetrics.intervalsCount >= 2) {
      reorderConfidence = "recommendation_available";
    } else if (compPeriodMetrics.intervalsCount === 1) {
      reorderConfidence = "early_signal";
    }

    let reorderSignal: ReorderSignal = "insufficient_data";
    if (reorderConfidence === "needs_review") {
      reorderSignal = "needs_review";
    } else if (reorderConfidence === "insufficient_data") {
      reorderSignal = "insufficient_data";
    } else if (suggestedReorderQty > 0) {
      reorderSignal = "reorder_needed";
    } else if (
      approxWeeksOfSupply !== null &&
      approxWeeksOfSupply > (coverage === "60d" ? 12 : 8)
    ) {
      reorderSignal = "overstock";
    } else {
      reorderSignal = "sufficient_stock";
    }

    const priceBasisLabel = hasTaggedPriceSnapshot
      ? "Store Tagged Price"
      : "Suggested Retail Price (MSRP)";

    productPerformanceList.push({
      productId: rawProd.id,
      productName: overrides.name?.trim() || rawProd.name,
      productNameEn: overrides.name_en?.trim() || rawProd.name_en || null,
      brandName,
      brandId,
      sku: effectiveSku,
      thumbnailUrl,
      category: rawProd.category || "skincare",
      categoryLabel,
      cartonPackQty,
      wholesalePrice,
      msrp,
      priceBasisLabel,
      totalReportedRemaining,
      estimatedMovement: estimatedUnitsSold ?? 0,
      movementStatus: companyMovementStatus,
      provisionalMovement: companyProvisionalMovement,
      usableWeeksCount: compPeriodMetrics.intervalsCount,
      totalObservedDays: compPeriodMetrics.observedDays,
      averageWeeklyMovement,
      dailyVelocity: companyDailyVelocity,
      hasNegativeVariance: companyVarianceCount > 0 || compPeriodMetrics.status === "needs_review",
      varianceCount: companyVarianceCount,

      // P2: Automatic Estimated Receipt & Inventory Flow
      orderedQty: companyOrderedQty,
      cancelledQty: companyCancelledQty,
      confirmedShippedQty: companyConfirmedShippedQty,
      pendingQty: companyPendingQty,
      inTransitQty: companyInTransitQty,
      estimatedReceivedQty: companyEstimatedReceivedQty,
      incomingQty: companyIncomingQty,
      nextEstimatedReceiptDate: companyNextEstDate,
      dataReliability: companyHasLegacy ? "estimated" : "verified",

      // Financials (P5 Engine Authoritative)
      estimatedRetailSales,
      estimatedGrossProfit,
      estimatedGrossMargin,
      estimatedUnitsSold,
      financialStatus: compPeriodMetrics.status,
      financialStatusReason: compPeriodMetrics.statusReason,
      cumulativeMetrics: companySkuEstimate.cumulativeMetrics,
      isFinancialsHidden,

      // P3: Supply, Coverage & Reorder
      approxWeeksOfSupply,
      coverage,
      coverageDays,
      targetWeeksOfSupply: Math.round(coverageDays / 7),
      targetDemand,
      postReportEstimatedReceipts: companyTotalPostReportReceipts,
      projectedAvailableStock,
      rawReorderNeed,
      suggestedReorderQty,
      suggestedCases,
      reorderSignal,
      reorderConfidence,
      isOrderable,
      storesBreakdown: storeBreakdowns,
    });
  }

  // Sort by Estimated Movement DESC, then Suggested Reorder DESC, then Product Name ASC
  productPerformanceList.sort((a, b) => {
    if (b.estimatedMovement !== a.estimatedMovement) {
      return b.estimatedMovement - a.estimatedMovement;
    }
    if (b.suggestedReorderQty !== a.suggestedReorderQty) {
      return b.suggestedReorderQty - a.suggestedReorderQty;
    }
    return (a.productName || "").localeCompare(b.productName || "");
  });

  // 9. Calculate Top Summary KPIs using P5 aggregateCompanySummary
  const companySummary = aggregateCompanySummary({
    companyId,
    selectedPeriod: period as any,
    totalStoresCount: stores.length,
    products: allCompanySkuEstimates,
  });

  const hasReliableEstimates = companySummary.skusWithEstimatesCount > 0;
  const overallFinancialStatus: FinancialReliabilityStatus =
    companySummary.skusWithEstimatesCount > 0
      ? "available"
      : companySummary.skusNeedsReviewCount > 0
      ? "needs_review"
      : "insufficient_data";

  let productsNeedingReorderCount = 0;
  let totalIncomingQty = 0;
  let totalInTransitQty = 0;
  let totalPendingQty = 0;

  productPerformanceList.forEach((p) => {
    totalIncomingQty += p.incomingQty;
    totalInTransitQty += p.inTransitQty;
    totalPendingQty += p.pendingQty;
    if (p.suggestedReorderQty > 0) {
      productsNeedingReorderCount += 1;
    }
  });

  return {
    companyId,
    userRole,
    selectedPeriod: period,
    selectedCoverage: coverage,
    selectedStoreId: storeIdFilter,
    stores: stores.map((s) => ({ id: s.id, name: s.name })),
    dataCoverage: {
      totalStores,
      reportingStores,
      percent: coveragePercent,
      isPartial,
    },
    summary: {
      totalEstimatedMovement: hasReliableEstimates ? companySummary.totalEstimatedUnitsSold : null,
      totalEstimatedRetailSales: hasReliableEstimates ? companySummary.totalEstimatedRetailSales : null,
      totalEstimatedGrossProfit: hasReliableEstimates ? companySummary.totalEstimatedGrossProfit : null,
      averageGrossMargin: hasReliableEstimates ? companySummary.weightedGrossMargin : null,
      financialStatus: overallFinancialStatus,
      productsNeedingReorderCount,
      totalProductsAssorted: productPerformanceList.length,
      totalIncomingQty,
      totalInTransitQty,
      totalPendingQty,
      skusWithEstimatesCount: companySummary.skusWithEstimatesCount,
      skusNeedsReviewCount: companySummary.skusNeedsReviewCount,
      defaultShippingDays,
      priceBasisNotice: "Retail sales and gross profit estimated based on Suggested Retail Price (MSRP)",
      isFinancialsHidden,
      coverageDays,
    },
    products: productPerformanceList,
  };
}

/**
 * Fetch a single product performance detail for /sales/[id]
 */
export async function getProductPerformanceDetail(
  productId: string,
  period: ReportingPeriod = "30d",
  coverage: ReorderCoverage = "30d"
): Promise<{
  product: ProductPerformanceItem | null;
  stores: Array<{ id: string; name: string }>;
  userRole: string;
  selectedCoverage: ReorderCoverage;
}> {
  const data = await getRetailerPerformanceData(period, "all", coverage);
  const product = data.products.find((p) => p.productId === productId) || null;
  return {
    product,
    stores: data.stores,
    userRole: data.userRole,
    selectedCoverage: coverage,
  };
}
