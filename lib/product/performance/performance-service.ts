/**
 * Product Performance V2.0 — Canonical Query & Performance Service Layer
 * Task ID: ADM-SALES-PERF-003-R5
 * Location: lib/product/performance/performance-service.ts
 *
 * Implements a reusable server-side query layer that connects canonical Supabase
 * tables into the Product Performance calculation engine and grade readiness evaluator.
 *
 * Directives:
 * - Batched parallel queries to eliminate N+1 queries.
 * - Injected Supabase client support for deterministic unit/integration testing.
 * - Boundary protection: Strips confidential cost/COGS data for retailer callers.
 * - Automatic grading safety gate: automaticGradingEnabled remains false.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveEvaluationPeriod, daysBetween, safeRound } from "./helpers";
import { calculateProductPerformanceKpis } from "./master-engine";
import { checkProductEligibility } from "./grade-policy";
import { buildMasterProductPerformanceInput } from "./data-adapter";
import type {
  ProductPerformanceQueryOptions,
  ProductPerformanceQueryResult,
  ProductPerformanceSummary,
  ProductPerformanceKpiSummary,
  GradeReadinessSummary,
  RawDbProduct,
  RawDbLandedCostResult,
  RawDbInventoryCostLayer,
  RawDbInventoryBalance,
  RawDbRetailerOrder,
  RawDbRetailerOrderItem,
  RawDbRetailerOrderFulfillment,
  RawDbRetailerOrderFulfillmentItem,
  RawDbRetailerOrderRefundRecord,
  RawDbRetailerWeeklyCheck,
  RawDbRetailerWeeklyCheckItem,
  RawDbRetailerExchangeClaim,
  RawDbRetailerExchangeClaimItem,
  RawDbRetailerProtectedSupplyCohort,
  RawDbStore,
  RawDbRetailerStoreProduct,
} from "./types";

/**
 * Sanitizes a product performance summary for retailer-facing views,
 * strictly stripping confidential landed cost, COGS, gross margin, and HQ valuation data.
 */
export function sanitizeRetailerPerformanceView(
  summary: ProductPerformanceSummary
): ProductPerformanceSummary {
  const sanitized = JSON.parse(JSON.stringify(summary)) as ProductPerformanceSummary;

  const periodObj = {
    start: sanitized.kpis.period.periodStart,
    end: sanitized.kpis.period.periodEnd,
  };

  // 1. Strip confidential financial COGS & Margins
  sanitized.kpis.financial.landedCogs = {
    value: null,
    unit: "USD",
    period: periodObj,
    status: "UNAVAILABLE",
    dataConfidence: 0.0,
    sourceBasis: "Confidential cost data is restricted to authorized HQ administrators.",
    missingInputReason: "Restricted access: Wholesale landed cost is confidential.",
  };

  sanitized.kpis.financial.grossProfit = {
    value: null,
    unit: "USD",
    period: periodObj,
    status: "UNAVAILABLE",
    dataConfidence: 0.0,
    sourceBasis: "Confidential profit data is restricted to authorized HQ administrators.",
    missingInputReason: "Restricted access: Gross profit is confidential.",
  };

  sanitized.kpis.financial.grossMargin = {
    value: null,
    unit: "PERCENT",
    period: periodObj,
    status: "UNAVAILABLE",
    dataConfidence: 0.0,
    sourceBasis: "Confidential margin data is restricted to authorized HQ administrators.",
    missingInputReason: "Restricted access: Gross margin is confidential.",
  };

  // 2. Strip confidential HQ Inventory Valuations & GMROI
  sanitized.kpis.inventory.hqInventoryValue = {
    value: null,
    unit: "USD",
    period: periodObj,
    status: "UNAVAILABLE",
    dataConfidence: 0.0,
    sourceBasis: "HQ warehouse inventory valuation is restricted to authorized HQ administrators.",
    missingInputReason: "Restricted access: Valuation is confidential.",
  };

  sanitized.kpis.inventory.averageInventoryValue = {
    value: null,
    unit: "USD",
    period: periodObj,
    status: "UNAVAILABLE",
    dataConfidence: 0.0,
    sourceBasis: "HQ average inventory valuation is restricted to authorized HQ administrators.",
    missingInputReason: "Restricted access: Valuation is confidential.",
  };

  sanitized.kpis.inventory.inventoryTurnover = {
    value: null,
    unit: "RATIO",
    period: periodObj,
    status: "UNAVAILABLE",
    dataConfidence: 0.0,
    sourceBasis: "Turnover based on Landed COGS is restricted to authorized HQ administrators.",
    missingInputReason: "Restricted access: Landed COGS is confidential.",
  };

  sanitized.kpis.inventory.dioDays = {
    value: null,
    unit: "DAYS",
    period: periodObj,
    status: "UNAVAILABLE",
    dataConfidence: 0.0,
    sourceBasis: "DIO based on Landed COGS is restricted to authorized HQ administrators.",
    missingInputReason: "Restricted access: Landed COGS is confidential.",
  };

  sanitized.kpis.inventory.gmroi = {
    value: null,
    unit: "RATIO",
    period: periodObj,
    status: "UNAVAILABLE",
    dataConfidence: 0.0,
    sourceBasis: "GMROI based on Gross Profit is restricted to authorized HQ administrators.",
    missingInputReason: "Restricted access: Gross profit is confidential.",
  };

  return sanitized;
}

/**
 * Derives operational and financial risk flags from computed KPIs.
 */
function deriveRiskFlags(kpis: ProductPerformanceSummary["kpis"]): string[] {
  const flags: string[] = [];

  // 1. Stockout risk: Available units > 0 but Days of Supply < 14 days
  const dos = kpis.inventory.daysOfSupply.value;
  const avail = kpis.inventory.hqAvailableUnits.value;
  if (avail !== null && avail > 0 && dos !== null && dos < 14) {
    flags.push("LOW_STOCK_RISK");
  }

  // 2. Out of stock
  if (avail === 0) {
    flags.push("OUT_OF_STOCK");
  }

  // 3. Excess inventory: Days of Supply > 180 days with available stock
  if (avail !== null && avail > 0 && dos !== null && dos > 180) {
    flags.push("EXCESS_INVENTORY_RISK");
  }

  // 4. Uncosted inventory / missing historical COGS
  if (kpis.financial.landedCogs.status === "UNAVAILABLE") {
    flags.push("UNCOSTED_INVENTORY_RISK");
  }

  // 5. Elevated exchange claim frequency (> 15% of eligible stores)
  const claimRate = kpis.exchange.claimingStoreRate.value;
  if (claimRate !== null && claimRate > 15.0) {
    flags.push("ELEVATED_EXCHANGE_RISK");
  }

  // 6. Low retailer weekly reporting compliance (< 50%)
  const repQual = kpis.velocity.reportingQualification.value;
  if (repQual && repQual.complianceRate < 0.5 && repQual.expectedReportsCount > 0) {
    flags.push("LOW_REPORTING_COMPLIANCE");
  }

  return flags;
}

/**
 * Derives an overall aggregated data confidence score (0.0 to 1.0)
 * across the four calculation pillars.
 */
function deriveOverallDataConfidence(kpis: ProductPerformanceSummary["kpis"]): number {
  const finConf = kpis.financial.b2bNetSales.dataConfidence * 0.35;
  const invConf = kpis.inventory.hqAvailableUnits.dataConfidence * 0.25;
  const velConf = kpis.velocity.b2bShipmentVelocityDaily.dataConfidence * 0.25;
  const excConf = kpis.exchange.uniqueClaimingStoreCount.dataConfidence * 0.15;

  const total = finConf + invConf + velConf + excConf;
  return safeRound(total, 2) ?? 1.0;
}

/**
 * Reusable Product Performance Query Service.
 * Retrieves canonical data in batched queries and executes the engine.
 */
export async function queryProductPerformanceList(
  options: ProductPerformanceQueryOptions = {},
  customClient?: SupabaseClient
): Promise<ProductPerformanceQueryResult> {
  const startTime = Date.now();
  const client = customClient || createAdminClient();

  const period = resolveEvaluationPeriod(options.asOfDate, options.lookbackDays || 60);

  // 1. Fetch Target Products
  let productQuery = client
    .from("products")
    .select(`
      id,
      name,
      name_en,
      letusto_sku,
      parent_sku,
      child_sku,
      manufacture_sku,
      brand_id,
      category,
      category_code,
      status,
      created_at,
      override_landed_cost,
      override_landed_cost_updated_at,
      override_landed_cost_reason,
      price_usd_fob,
      price_krw_wholesale,
      brands (
        id,
        name
      )
    `);

  if (options.productId) {
    productQuery = productQuery.eq("id", options.productId);
  } else if (options.productIds && options.productIds.length > 0) {
    productQuery = productQuery.in("id", options.productIds);
  }

  if (options.brandId) {
    productQuery = productQuery.eq("brand_id", options.brandId);
  }

  if (options.searchQuery) {
    const q = options.searchQuery.trim();
    productQuery = productQuery.or(`name.ilike.%${q}%,letusto_sku.ilike.%${q}%`);
  }

  // Ordering
  productQuery = productQuery.order("name", { ascending: true });

  // Pagination
  const page = Math.max(1, options.page || 1);
  const pageSize = Math.max(1, Math.min(100, options.pageSize || 50));
  const fromIndex = (page - 1) * pageSize;
  const toIndex = fromIndex + pageSize - 1;

  // Retrieve products
  const { data: rawProducts, count: rawCount, error: productError } = await productQuery.range(
    fromIndex,
    toIndex
  );

  if (productError) {
    throw new Error(`Failed to query products from database: ${productError.message}`);
  }

  const products: RawDbProduct[] = (rawProducts || []) as any[];
  const totalCount = rawCount !== null && rawCount !== undefined ? rawCount : products.length;
  const totalPages = Math.ceil(totalCount / pageSize);

  if (products.length === 0) {
    return {
      items: [],
      totalCount: 0,
      page,
      pageSize,
      totalPages: 0,
      period,
      benchmarkMs: Date.now() - startTime,
    };
  }

  const productIds = products.map((p) => p.id);

  // 2. Fetch all dependent canonical data in parallel for the retrieved product IDs
  const [
    costResultsRes,
    costLayersRes,
    inventoryBalancesRes,
    orderItemsRes,
    weeklyCheckItemsRes,
    claimItemsRes,
    cohortsRes,
    storeProductsRes,
    storesRes,
    productImagesRes,
  ] = await Promise.all([
    // A. Landed Cost Results
    client
      .from("landed_cost_results")
      .select("id, product_id, received_date, inventory_received_qty, unit_landed_cost, cost_status, supplier_acquisition_cost, freight_cost, duty_cost, total_landed_cost, calculated_at")
      .in("product_id", productIds),

    // B. Inventory Cost Layers
    client
      .from("inventory_cost_layers")
      .select("id, product_id, warehouse_id, received_date, original_qty, remaining_qty, unit_landed_cost, original_total_cost, status, created_at, updated_at")
      .in("product_id", productIds),

    // C. Inventory Balances
    client
      .from("inventory_balances")
      .select("id, product_id, warehouse_id, qty_on_hand, qty_hold, qty_damaged, updated_at")
      .in("product_id", productIds),

    // D. Order Items (to extract order IDs)
    client
      .from("retailer_order_items")
      .select("id, order_id, product_id, sku, product_name, brand_name, unit_wholesale_price, quantity, line_total, created_at")
      .in("product_id", productIds),

    // E. Weekly Check Items
    client
      .from("retailer_weekly_check_items")
      .select("id, check_id, product_id, reported_remaining_qty, previous_reported_qty, delivered_since_previous, estimated_movement, is_counted")
      .in("product_id", productIds),

    // F. Exchange Claim Items
    client
      .from("retailer_exchange_claim_items")
      .select("id, claim_id, cohort_id, product_id, store_id, company_id, selected_option, selected_quantity, frozen_unit_wholesale_price, final_credit_amount, status, created_at")
      .in("product_id", productIds),

    // G. Protected Supply Cohorts
    client
      .from("retailer_protected_supply_cohorts")
      .select("id, cohort_code, company_id, store_id, product_id, source_order_id, total_protected_quantity, status, first_shipment_date, trial_end_date, evaluation_date, claim_deadline_date, created_at")
      .in("product_id", productIds),

    // H. Retailer Store Products (Coverage)
    client
      .from("retailer_store_products")
      .select("store_id, product_id, company_id, is_active")
      .in("product_id", productIds),

    // I. Stores Master
    client
      .from("stores")
      .select("id, name, store_code, status, company_id"),

    // J. Product Images
    client
      .from("product_images")
      .select("id, product_id, storage_path, position")
      .in("product_id", productIds)
      .order("position", { ascending: true }),
  ]);

  const costResults = (costResultsRes.data || []) as RawDbLandedCostResult[];
  const costLayers = (costLayersRes.data || []) as RawDbInventoryCostLayer[];
  const balances = (inventoryBalancesRes.data || []) as RawDbInventoryBalance[];
  const orderItems = (orderItemsRes.data || []) as RawDbRetailerOrderItem[];
  const weeklyCheckItems = (weeklyCheckItemsRes.data || []) as RawDbRetailerWeeklyCheckItem[];
  const claimItems = (claimItemsRes.data || []) as RawDbRetailerExchangeClaimItem[];
  const cohorts = (cohortsRes.data || []) as RawDbRetailerProtectedSupplyCohort[];
  const storeProducts = (storeProductsRes.data || []) as RawDbRetailerStoreProduct[];
  const stores = (storesRes.data || []) as RawDbStore[];
  const productImages = (productImagesRes?.data || []) as Array<{ id: string; product_id: string; storage_path?: string | null; position?: number }>;

  // 3. Secondary Batched Queries: Fetch Orders, Fulfillments, Refunds, Checks, Claims by ID
  const orderIds = Array.from(new Set(orderItems.map((i) => i.order_id)));
  const checkIds = Array.from(new Set(weeklyCheckItems.map((i) => i.check_id)));
  const claimIds = Array.from(new Set(claimItems.map((i) => i.claim_id)));

  const [ordersRes, fulfillmentsRes, fulfillmentItemsRes, refundsRes, checksRes, claimsRes] =
    await Promise.all([
      // Orders
      orderIds.length > 0
        ? client
            .from("retailer_orders")
            .select("id, order_number, company_id, store_id, order_status, payment_status, subtotal_amount, discount_amount, shipping_amount, tax_amount, total_amount, is_test, created_at")
            .in("id", orderIds)
        : Promise.resolve({ data: [] }),

      // Fulfillments
      orderIds.length > 0
        ? client
            .from("retailer_order_fulfillments")
            .select("id, order_id, store_id, status, shipped_at, delivered_at, created_at")
            .in("order_id", orderIds)
        : Promise.resolve({ data: [] }),

      // Fulfillment Items
      orderIds.length > 0
        ? client
            .from("retailer_order_fulfillment_items")
            .select("id, fulfillment_id, order_item_id, product_id, quantity_shipped, quantity_delivered")
            .in("product_id", productIds)
        : Promise.resolve({ data: [] }),

      // Refunds
      orderIds.length > 0
        ? client
            .from("retailer_order_refund_records")
            .select("id, order_id, company_id, merchandise_amount, tax_amount, total_refund_amount, refund_status, created_at")
            .in("order_id", orderIds)
        : Promise.resolve({ data: [] }),

      // Weekly Checks
      checkIds.length > 0
        ? client
            .from("retailer_weekly_checks")
            .select("id, company_id, store_id, reporting_week, report_date, status, is_test, submitted_at, created_at")
            .in("id", checkIds)
        : Promise.resolve({ data: [] }),

      // Exchange Claims
      claimIds.length > 0
        ? client
            .from("retailer_exchange_claims")
            .select("id, claim_number, company_id, store_id, status, total_units_count, total_estimated_credit, created_at, submitted_at")
            .in("id", claimIds)
        : Promise.resolve({ data: [] }),
    ]);

  const ordersMap = new Map<string, RawDbRetailerOrder>();
  for (const o of (ordersRes.data || []) as RawDbRetailerOrder[]) {
    ordersMap.set(o.id, o);
  }

  const fulfillmentsMap = new Map<string, RawDbRetailerOrderFulfillment>();
  for (const f of (fulfillmentsRes.data || []) as RawDbRetailerOrderFulfillment[]) {
    fulfillmentsMap.set(f.id, f);
  }

  const checksMap = new Map<string, RawDbRetailerWeeklyCheck>();
  for (const c of (checksRes.data || []) as RawDbRetailerWeeklyCheck[]) {
    checksMap.set(c.id, c);
  }

  const claimsMap = new Map<string, RawDbRetailerExchangeClaim>();
  for (const cl of (claimsRes.data || []) as RawDbRetailerExchangeClaim[]) {
    claimsMap.set(cl.id, cl);
  }

  const fulfillmentItems = (fulfillmentItemsRes.data || []) as RawDbRetailerOrderFulfillmentItem[];
  const refunds = (refundsRes.data || []) as RawDbRetailerOrderRefundRecord[];
  // Resolve first product image signed URL for each product
  const imageUrlMap = new Map<string, string>();
  const seenImageProductIds = new Set<string>();

  for (const img of productImages) {
    if (!img.storage_path || seenImageProductIds.has(img.product_id)) continue;
    seenImageProductIds.add(img.product_id);
    try {
      if (typeof (client as any)?.storage?.from === "function") {
        const { data: signedData } = await (client as any).storage
          .from("company-uploads")
          .createSignedUrl(img.storage_path, 3600);
        if (signedData?.signedUrl) {
          imageUrlMap.set(img.product_id, signedData.signedUrl);
        }
      }
    } catch {
      // Ignore image signing errors safely
    }
  }

  // 4. Calculate KPIs and Grade Readiness for Each Product
  const items: ProductPerformanceSummary[] = [];

  for (const product of products) {
    const masterInput = buildMasterProductPerformanceInput({
      period,
      product,
      landedCostResults: costResults,
      inventoryCostLayers: costLayers,
      inventoryBalances: balances,
      orderItems,
      ordersMap,
      fulfillmentItems,
      fulfillmentsMap,
      refunds,
      weeklyCheckItems,
      checksMap,
      claimsMap,
      claimItems,
      cohorts,
      stores,
      storeProducts,
      includeTestOrders: options.includeTestOrders,
    });

    const kpis = calculateProductPerformanceKpis(masterInput);

    // Compute Completed Orders & Distinct Stores for Grade Eligibility
    const completedOrdersSet = new Set<string>();
    const distinctStoresSet = new Set<string>();

    for (const line of masterInput.financial.orderLines) {
      const order = ordersMap.get(line.order_id);
      const isFulfilled =
        line.order_status === "DELIVERED" ||
        line.order_status === "SHIPPED" ||
        line.shipped_qty > 0;

      if (isFulfilled) {
        completedOrdersSet.add(line.order_id);
        if (order?.store_id) {
          distinctStoresSet.add(order.store_id);
        }
      }
    }

    const completedOrdersCount = completedOrdersSet.size;
    const distinctStoresCount = distinctStoresSet.size;
    const hasHistoricalCost = kpis.financial.landedCogs.status !== "UNAVAILABLE";
    const operatingHistoryDays = daysBetween(product.created_at.slice(0, 10), period.asOfDate);

    // Grade Eligibility check from authoritative R3 engine
    const gradeEligibility = checkProductEligibility({
      product_id: product.id,
      operatingHistoryDays,
      completedOrdersCount,
      distinctStoresCount,
      hasHistoricalCost,
      asOfDate: period.asOfDate,
    });

    const gradeReadiness: GradeReadinessSummary = {
      isEligible: gradeEligibility.isEligible,
      evaluationStatus: gradeEligibility.status,
      ineligibilityReason: gradeEligibility.primaryReason,
      allReasons: gradeEligibility.allReasons,
      metrics: gradeEligibility.metrics,
      policyGate: {
        automaticGradingEnabled: false,
        note: "Automatic A/B/C/D grading is strictly disabled pending Owner scoring normalization approval.",
      },
    };

    let summary: ProductPerformanceSummary = {
      productId: product.id,
      sku: product.letusto_sku || product.child_sku || product.parent_sku || product.name,
      productName: product.name,
      productNameEn: product.name_en || null,
      imageUrl: imageUrlMap.get(product.id) || null,
      manufactureSku: product.manufacture_sku || null,
      brand: {
        id: product.brands?.id || product.brand_id || "",
        name: product.brands?.name || "Unknown Brand",
      },
      category: {
        id: product.categories?.id || null,
        name: product.categories?.name || product.category || "Uncategorized",
        code: product.categories?.code || product.category_code || null,
      },
      status: product.status || "active",
      createdAt: product.created_at,
      kpis,
      gradeReadiness,
      overallDataConfidence: deriveOverallDataConfidence(kpis),
      riskFlags: deriveRiskFlags(kpis),
    };

    if (options.isRetailerView) {
      summary = sanitizeRetailerPerformanceView(summary);
    }

    items.push(summary);
  }

  // 5. Aggregate KPI Summary across evaluated items
  let totalB2bNetSales = 0;
  let totalGrossProfit: number | null = 0;
  let totalHqInventoryValue: number | null = 0;
  let totalAvailableUnits = 0;
  let hasMissingCostProvenance = false;
  let hasMissingInventoryCost = false;
  const distinctClaimingStoresSet = new Set<string>();

  for (const item of items) {
    const netSales = item.kpis.financial.b2bNetSales.value || 0;
    totalB2bNetSales += netSales;

    if (item.kpis.financial.grossProfit.status === "UNAVAILABLE") {
      hasMissingCostProvenance = true;
      totalGrossProfit = null;
    } else if (totalGrossProfit !== null) {
      totalGrossProfit += item.kpis.financial.grossProfit.value || 0;
    }

    const availUnits = item.kpis.inventory.hqAvailableUnits.value || 0;
    totalAvailableUnits += availUnits;

    if (item.kpis.inventory.hqInventoryValue.status === "UNAVAILABLE") {
      hasMissingInventoryCost = true;
      totalHqInventoryValue = null;
    } else if (totalHqInventoryValue !== null) {
      totalHqInventoryValue += item.kpis.inventory.hqInventoryValue.value || 0;
    }

    const claimingStores = item.kpis.exchange.uniqueClaimingStoreCount.value || 0;
    if (claimingStores > 0) {
      for (let i = 0; i < claimingStores; i++) {
        distinctClaimingStoresSet.add(`${item.productId}:store:${i}`);
      }
    }
  }

  const aggregateGrossMargin =
    totalGrossProfit !== null && totalB2bNetSales > 0
      ? safeRound((totalGrossProfit / totalB2bNetSales) * 100, 1)
      : null;

  const kpiSummary: ProductPerformanceKpiSummary = {
    totalB2bNetSales: safeRound(totalB2bNetSales, 2) || 0,
    totalGrossProfit: totalGrossProfit !== null ? safeRound(totalGrossProfit, 2) : null,
    aggregateGrossMargin,
    totalHqInventoryValue: totalHqInventoryValue !== null ? safeRound(totalHqInventoryValue, 2) : null,
    totalAvailableUnits,
    uniqueExchangeClaimingStores: distinctClaimingStoresSet.size,
    productsNeedingAction: "POLICY PENDING",
    hasMissingCostProvenance,
    hasMissingInventoryCost,
  };

  return {
    items,
    totalCount,
    page,
    pageSize,
    totalPages,
    period,
    benchmarkMs: Date.now() - startTime,
    kpiSummary,
  };
}

/**
 * Reusable single-product query convenience helper.
 */
export async function getProductPerformanceById(
  productId: string,
  options: Omit<ProductPerformanceQueryOptions, "productId" | "productIds"> = {},
  customClient?: SupabaseClient
): Promise<ProductPerformanceSummary | null> {
  const result = await queryProductPerformanceList(
    {
      ...options,
      productId,
      pageSize: 1,
    },
    customClient
  );

  return result.items.length > 0 ? result.items[0] : null;
}
