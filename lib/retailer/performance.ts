import "server-only";
import { verifyRetailerSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveEffectiveSku } from "@/lib/product/types";
import { formatCategoryName } from "@/lib/retailer/products";
import { getRetailerAccessibleStores } from "@/lib/retailer/weekly-check";

export const TARGET_WEEKS_OF_SUPPLY = 4; // Centralized configurable V1 target

export type ReportingPeriod = "7d" | "30d" | "90d" | "all";

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
  approxWeeksOfSupply: number | null;
  usableWeeksCount: number;
  lastReportDate: string | null;
  lastReportingWeek: string | null;
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
  totalReportedRemaining: number;
  estimatedMovement: number;
  movementStatus: MovementStatus;
  provisionalMovement: number;
  usableWeeksCount: number;
  averageWeeklyMovement: number;
  hasNegativeVariance: boolean;
  varianceCount: number;

  // Financials
  estimatedRetailSales: number;
  estimatedGrossProfit: number;
  estimatedGrossMargin: number;
  isFinancialsHidden: boolean;

  // Supply & Reorder
  approxWeeksOfSupply: number | null;
  targetWeeksOfSupply: number;
  targetQty: number;
  rawReorderNeed: number;
  suggestedReorderQty: number;
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
    totalEstimatedMovement: number;
    totalEstimatedRetailSales: number;
    totalEstimatedGrossProfit: number;
    averageGrossMargin: number;
    productsNeedingReorderCount: number;
    totalProductsAssorted: number;
    priceBasisNotice: string;
    isFinancialsHidden: boolean;
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
  storeIdFilter: string = "all"
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
        is_counted
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
  const { data: storeProductRows } = await adminClient
    .from("retailer_store_products")
    .select("store_id, product_id, is_active")
    .eq("company_id", companyId)
    .eq("is_active", true);

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
  }

  const productStoreSnapshots = new Map<string, Map<string, CheckItemSnapshot[]>>();

  submittedChecks.forEach((check) => {
    const items = (check.retailer_weekly_check_items as any[]) || [];
    items.forEach((item) => {
      if (!item.is_counted) return;
      const pId = item.product_id;
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
      });
    });
  });

  // Collect all eligible product IDs (either in store assortment or with check snapshots)
  const allProductIds = new Set<string>();
  (storeProductRows || []).forEach((sp) => {
    if (activeStoreIds.includes(sp.store_id)) {
      allProductIds.add(sp.product_id);
    }
  });
  productStoreSnapshots.forEach((_, pId) => allProductIds.add(pId));

  // 6. Process Performance Metrics per Product
  const productPerformanceList: ProductPerformanceItem[] = [];

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
    let wholesalePrice = 0;
    if (curation?.wholesale_price && Number(curation.wholesale_price) > 0) {
      wholesalePrice = Number(curation.wholesale_price);
    }
    const isOrderable = wholesalePrice > 0;

    let msrp = 0;
    if (curation?.suggest_retail_price && Number(curation.suggest_retail_price) > 0) {
      msrp = Number(curation.suggest_retail_price);
    } else if (rawProd.estimated_retail_price && Number(rawProd.estimated_retail_price) > 0) {
      msrp = Number(rawProd.estimated_retail_price);
    } else if (wholesalePrice > 0) {
      msrp = Number((wholesalePrice * 2.0).toFixed(2));
    }

    const cartonPackQty = Math.max(1, overrides.carton_pack_qty || rawProd.carton_pack_qty || 1);

    // Image signing
    const rawImages = (rawProd.product_images as any[]) || [];
    const sortedImages = [...rawImages].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    let thumbnailUrl: string | null = null;
    if (sortedImages.length > 0 && sortedImages[0].storage_path) {
      try {
        const { data: signed } = await adminClient.storage
          .from("company-uploads")
          .createSignedUrl(sortedImages[0].storage_path, 3600);
        thumbnailUrl = signed?.signedUrl || null;
      } catch {
        // ignore
      }
    }

    // Evaluate Store Snapshots for this product
    const storeBreakdowns: StorePerformanceBreakdown[] = [];
    const storeSnapMap = productStoreSnapshots.get(productId) || new Map();

    let companyTotalRemaining = 0;
    let companyTotalMovement = 0;
    let companyProvisionalMovement = 0;
    let companyUsableWeeks = 0;
    let companyVarianceCount = 0;
    let hasAnyCount = false;
    let isAllBaseline = true;

    // Process each accessible store for this product
    for (const store of stores.filter((s) => activeStoreIds.includes(s.id))) {
      const snapshots = storeSnapMap.get(store.id) || [];
      if (snapshots.length === 0) {
        storeBreakdowns.push({
          storeId: store.id,
          storeName: store.name,
          latestReportedRemaining: null,
          estimatedMovement: 0,
          movementStatus: "no_data",
          avgWeeklyMovement: 0,
          approxWeeksOfSupply: null,
          usableWeeksCount: 0,
          lastReportDate: null,
          lastReportingWeek: null,
        });
        continue;
      }

      hasAnyCount = true;
      const latestSnapshot = snapshots[snapshots.length - 1];
      const latestRemaining = latestSnapshot.reportedRemaining;
      companyTotalRemaining += latestRemaining;

      // Calculate movements across consecutive intervals in this store
      let storeMovement = 0;
      let storeUsableWeeks = 0;
      let storeVarianceCount = 0;
      let storeMovementStatus: MovementStatus = "baseline";

      for (const snap of snapshots) {
        if (snap.previousReported === null) {
          // Baseline check -> No movement calculation
          continue;
        }

        isAllBaseline = false;
        const prev = snap.previousReported;
        const curr = snap.reportedRemaining;
        const delivered = snap.deliveredSincePrevious;

        let intervalMovement: number;

        if (delivered !== null) {
          // Confirmed Delivery Available: prev + delivered - curr
          intervalMovement = prev + delivered - curr;
          storeMovementStatus = "normal";
        } else {
          // Delivery Data Unknown: prev - curr (Provisional)
          intervalMovement = prev - curr;
          if (storeMovementStatus !== "variance") {
            storeMovementStatus = "provisional";
          }
        }

        if (intervalMovement < 0) {
          // Negative / Unusual movement (Variance)
          storeVarianceCount += 1;
          storeMovementStatus = "variance";
          // Defensible aggregation rule: do not let unresolved negative error depress legitimate movement
          // We flag the variance count and do not add negative to total sales movement
        } else {
          storeMovement += intervalMovement;
          storeUsableWeeks += 1;
        }
      }

      const storeAvgWeekly = storeUsableWeeks > 0 ? Number((storeMovement / storeUsableWeeks).toFixed(1)) : 0;
      const storeWeeksSupply =
        storeAvgWeekly > 0 ? Number((latestRemaining / storeAvgWeekly).toFixed(1)) : null;

      companyTotalMovement += storeMovement;
      companyUsableWeeks += storeUsableWeeks;
      companyVarianceCount += storeVarianceCount;

      storeBreakdowns.push({
        storeId: store.id,
        storeName: store.name,
        latestReportedRemaining: latestRemaining,
        estimatedMovement: storeMovement,
        movementStatus: storeMovementStatus,
        avgWeeklyMovement: storeAvgWeekly,
        approxWeeksOfSupply: storeWeeksSupply,
        usableWeeksCount: storeUsableWeeks,
        lastReportDate: latestSnapshot.reportDate,
        lastReportingWeek: latestSnapshot.reportingWeek,
      });
    }

    // Determine Company-level Movement Status
    let companyMovementStatus: MovementStatus = "no_data";
    if (hasAnyCount) {
      if (isAllBaseline) {
        companyMovementStatus = "baseline";
      } else if (companyVarianceCount > 0 && companyTotalMovement === 0) {
        companyMovementStatus = "variance";
      } else if (storeBreakdowns.some((s) => s.movementStatus === "provisional")) {
        companyMovementStatus = "provisional";
      } else {
        companyMovementStatus = "normal";
      }
    }

    // Velocity & Average Weekly Movement
    const averageWeeklyMovement =
      companyUsableWeeks > 0 ? Number((companyTotalMovement / companyUsableWeeks).toFixed(1)) : 0;

    // Approx Weeks of Supply
    const approxWeeksOfSupply =
      averageWeeklyMovement > 0
        ? Number((companyTotalRemaining / averageWeeklyMovement).toFixed(1))
        : null;

    // Financial Metrics
    const estimatedRetailSales = Number((companyTotalMovement * msrp).toFixed(2));
    const estimatedProductCost = Number((companyTotalMovement * wholesalePrice).toFixed(2));
    const estimatedGrossProfit = Number((estimatedRetailSales - estimatedProductCost).toFixed(2));
    const estimatedGrossMargin =
      estimatedRetailSales > 0
        ? Number((((estimatedGrossProfit) / estimatedRetailSales) * 100).toFixed(1))
        : 0;

    // Reorder Calculations
    const targetQty = Math.ceil(averageWeeklyMovement * TARGET_WEEKS_OF_SUPPLY);
    const rawReorderNeed = Math.max(0, targetQty - companyTotalRemaining);

    // Round UP to valid MOQ / Case Pack Multiple
    let suggestedReorderQty = 0;
    if (rawReorderNeed > 0) {
      suggestedReorderQty = Math.ceil(rawReorderNeed / cartonPackQty) * cartonPackQty;
    }

    // Reorder Confidence & Signal
    let reorderConfidence: ReorderConfidence = "insufficient_data";
    if (companyVarianceCount > 0) {
      reorderConfidence = "needs_review";
    } else if (companyUsableWeeks >= 2) {
      reorderConfidence = "recommendation_available";
    } else if (companyUsableWeeks === 1) {
      reorderConfidence = "early_signal";
    }

    let reorderSignal: ReorderSignal = "insufficient_data";
    if (reorderConfidence === "needs_review") {
      reorderSignal = "needs_review";
    } else if (reorderConfidence === "insufficient_data") {
      reorderSignal = "insufficient_data";
    } else if (suggestedReorderQty > 0) {
      reorderSignal = "reorder_needed";
    } else if (approxWeeksOfSupply !== null && approxWeeksOfSupply > 8) {
      reorderSignal = "overstock";
    } else {
      reorderSignal = "sufficient_stock";
    }

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
      priceBasisLabel: "Suggested Retail Price (MSRP)",
      totalReportedRemaining: companyTotalRemaining,
      estimatedMovement: companyTotalMovement,
      movementStatus: companyMovementStatus,
      provisionalMovement: companyProvisionalMovement,
      usableWeeksCount: companyUsableWeeks,
      averageWeeklyMovement,
      hasNegativeVariance: companyVarianceCount > 0,
      varianceCount: companyVarianceCount,
      estimatedRetailSales,
      estimatedGrossProfit,
      estimatedGrossMargin,
      isFinancialsHidden,
      approxWeeksOfSupply,
      targetWeeksOfSupply: TARGET_WEEKS_OF_SUPPLY,
      targetQty,
      rawReorderNeed,
      suggestedReorderQty,
      reorderSignal,
      reorderConfidence,
      isOrderable,
      storesBreakdown: storeBreakdowns,
    });
  }

  // Sort by Estimated Movement DESC, then Suggested Reorder DESC
  productPerformanceList.sort((a, b) => {
    if (b.estimatedMovement !== a.estimatedMovement) {
      return b.estimatedMovement - a.estimatedMovement;
    }
    return b.suggestedReorderQty - a.suggestedReorderQty;
  });

  // 7. Calculate Top Summary KPIs
  let totalEstimatedMovement = 0;
  let totalEstimatedRetailSales = 0;
  let totalEstimatedGrossProfit = 0;
  let productsNeedingReorderCount = 0;

  productPerformanceList.forEach((p) => {
    totalEstimatedMovement += p.estimatedMovement;
    totalEstimatedRetailSales += p.estimatedRetailSales;
    totalEstimatedGrossProfit += p.estimatedGrossProfit;
    if (p.suggestedReorderQty > 0) {
      productsNeedingReorderCount += 1;
    }
  });

  const averageGrossMargin =
    totalEstimatedRetailSales > 0
      ? Number(((totalEstimatedGrossProfit / totalEstimatedRetailSales) * 100).toFixed(1))
      : 0;

  return {
    companyId,
    userRole,
    selectedPeriod: period,
    selectedStoreId: storeIdFilter,
    stores: stores.map((s) => ({ id: s.id, name: s.name })),
    dataCoverage: {
      totalStores,
      reportingStores,
      percent: coveragePercent,
      isPartial,
    },
    summary: {
      totalEstimatedMovement,
      totalEstimatedRetailSales: Number(totalEstimatedRetailSales.toFixed(2)),
      totalEstimatedGrossProfit: Number(totalEstimatedGrossProfit.toFixed(2)),
      averageGrossMargin,
      productsNeedingReorderCount,
      totalProductsAssorted: productPerformanceList.length,
      priceBasisNotice: "Retail sales and gross profit estimated based on Suggested Retail Price (MSRP)",
      isFinancialsHidden,
    },
    products: productPerformanceList,
  };
}

/**
 * Fetch a single product performance detail for /sales/[id]
 */
export async function getProductPerformanceDetail(
  productId: string,
  period: ReportingPeriod = "30d"
): Promise<{
  product: ProductPerformanceItem | null;
  stores: Array<{ id: string; name: string }>;
  userRole: string;
}> {
  const data = await getRetailerPerformanceData(period, "all");
  const product = data.products.find((p) => p.productId === productId) || null;
  return {
    product,
    stores: data.stores,
    userRole: data.userRole,
  };
}
