/**
 * RTP-PERFORMANCE-P5-001: Product Performance Financial Estimates Pure Calculation Engine
 *
 * Deterministic, pure calculation functions for:
 * 1. Estimated unit movement across consecutive inventory observations
 * 2. Sales velocity rates (daily, weekly)
 * 3. Estimated retail sales, merchandise wholesale cost, and gross profit
 * 4. Multi-store rollups with weighted gross margins (Sum(GP)/Sum(Sales))
 * 5. Period filtering (7d, 30d, 90d, all) and cumulative baseline tracking
 */

import {
  AnalysisPeriod,
  FinancialMetrics,
  FinancialReliabilityStatus,
  ObservationInterval,
  PricingSource,
  ReceiptEvent,
  StockAdjustment,
  StoreSkuFinancialEstimate,
  CompanySkuFinancialEstimate,
  CompanyFinancialPerformanceSummary,
} from "./performance-financial-types";

export interface SnapshotInput {
  checkId: string;
  storeId: string;
  reportDate: string;          // YYYY-MM-DD
  reportedRemaining: number;
  retailPriceSnapshot?: number | null;
  retailPriceBasis?: string | null;
}

export interface PricingInput {
  wholesalePrice: number | null;
  curationSrp?: number | null;
  catalogErp?: number | null;
}

/**
 * Resolves the applicable SRP and pricing source.
 * Priority:
 * 1. Snapshot taken during check (if > 0)
 * 2. Authorized Retailer curation suggest_retail_price (if > 0)
 * 3. Catalog estimated_retail_price (if > 0)
 * 4. Fallback 2.0x wholesale cost (if wholesale cost > 0)
 */
export function resolveEffectiveSrp(
  snapshotPrice: number | null | undefined,
  pricing: PricingInput
): { srp: number | null; source: PricingSource | null } {
  if (typeof snapshotPrice === "number" && snapshotPrice > 0) {
    return { srp: Number(snapshotPrice.toFixed(2)), source: "item_snapshot" };
  }
  if (typeof pricing.curationSrp === "number" && pricing.curationSrp > 0) {
    return { srp: Number(pricing.curationSrp.toFixed(2)), source: "curation_srp" };
  }
  if (typeof pricing.catalogErp === "number" && pricing.catalogErp > 0) {
    return { srp: Number(pricing.catalogErp.toFixed(2)), source: "product_erp" };
  }
  if (typeof pricing.wholesalePrice === "number" && pricing.wholesalePrice > 0) {
    return { srp: Number((pricing.wholesalePrice * 2.0).toFixed(2)), source: "wholesale_markup" };
  }
  return { srp: null, source: null };
}

/**
 * Filter receipt events strictly falling within the interval:
 * intervalStart < receiptDate <= intervalEnd
 * This guarantees every receipt event is counted at most once.
 */
export function filterReceiptsInInterval(
  receipts: ReceiptEvent[],
  intervalStartIso: string,
  intervalEndIso: string
): ReceiptEvent[] {
  return receipts.filter((r) => r.receiptDate > intervalStartIso && r.receiptDate <= intervalEndIso);
}

/**
 * Filter stock adjustments strictly falling within the interval:
 * intervalStart < adjustmentDate <= intervalEnd
 */
export function filterAdjustmentsInInterval(
  adjustments: StockAdjustment[],
  intervalStartIso: string,
  intervalEndIso: string
): StockAdjustment[] {
  return adjustments.filter((a) => a.date > intervalStartIso && a.date <= intervalEndIso);
}

/**
 * Calculates estimated unit movement for a single observation interval.
 *
 * Formula:
 * Estimated Units Moved =
 *   Previous Reported Stock
 *   + Estimated Receipts Within Observation Interval
 *   + Verified Positive Adjustments
 *   - Verified Negative Adjustments
 *   - Current Reported Stock
 */
export function calculateIntervalMovement(params: {
  previousStock: number;
  currentStock: number;
  receiptsInInterval: number;
  positiveAdjustments?: number;
  negativeAdjustments?: number;
}): {
  estimatedUnitsMoved: number;
  status: FinancialReliabilityStatus;
  statusReason?: string;
} {
  const prev = Math.max(0, params.previousStock);
  const curr = Math.max(0, params.currentStock);
  const receipts = Math.max(0, params.receiptsInInterval);
  const posAdj = Math.max(0, params.positiveAdjustments || 0);
  const negAdj = Math.max(0, params.negativeAdjustments || 0);

  const rawMovement = prev + receipts + posAdj - negAdj - curr;

  if (rawMovement < 0) {
    // Inventory count increased without recorded receipts or positive adjustments.
    // Must NOT be silently clamped to 0 and called sales.
    return {
      estimatedUnitsMoved: rawMovement,
      status: "needs_review",
      statusReason: `Negative unit movement detected (${rawMovement}): ending stock (${curr}) exceeds opening stock (${prev}) + receipts (${receipts})`,
    };
  }

  return {
    estimatedUnitsMoved: rawMovement,
    status: "available",
  };
}

/**
 * Calculates sales velocity from units moved and observed calendar days.
 */
export function calculateVelocity(
  unitsMoved: number,
  observedDays: number
): { dailyRate: number; weeklyRate: number } {
  if (observedDays <= 0 || isNaN(observedDays) || unitsMoved < 0) {
    return { dailyRate: 0, weeklyRate: 0 };
  }
  const dailyRate = Number((unitsMoved / observedDays).toFixed(2));
  const weeklyRate = Number((dailyRate * 7).toFixed(1));
  return { dailyRate, weeklyRate };
}

/**
 * Calculates financial amounts for an interval or aggregate.
 */
export function calculateFinancials(
  unitsMoved: number,
  srp: number | null,
  wholesaleCost: number | null
): {
  retailSales: number | null;
  wholesaleCostAmount: number | null;
  grossProfit: number | null;
  grossMargin: number | null;
  status: FinancialReliabilityStatus;
  statusReason?: string;
} {
  if (unitsMoved < 0) {
    return {
      retailSales: null,
      wholesaleCostAmount: null,
      grossProfit: null,
      grossMargin: null,
      status: "needs_review",
      statusReason: "Cannot calculate financials on negative unit movement",
    };
  }

  const hasValidSrp = typeof srp === "number" && srp > 0 && !isNaN(srp);
  const hasValidCost = typeof wholesaleCost === "number" && wholesaleCost > 0 && !isNaN(wholesaleCost);

  if (!hasValidSrp) {
    return {
      retailSales: null,
      wholesaleCostAmount: hasValidCost ? Number((unitsMoved * wholesaleCost).toFixed(2)) : null,
      grossProfit: null,
      grossMargin: null,
      status: "not_available",
      statusReason: "Suggested Retail Price (SRP) missing or invalid",
    };
  }

  const retailSales = Number((unitsMoved * srp).toFixed(2));

  if (!hasValidCost) {
    return {
      retailSales,
      wholesaleCostAmount: null,
      grossProfit: null,
      grossMargin: null,
      status: "not_available",
      statusReason: "Wholesale purchase cost missing or invalid",
    };
  }

  const wholesaleCostAmount = Number((unitsMoved * wholesaleCost).toFixed(2));
  const grossProfit = Number((retailSales - wholesaleCostAmount).toFixed(2));
  const grossMargin = retailSales > 0 ? Number(((grossProfit / retailSales) * 100).toFixed(2)) : 0;

  return {
    retailSales,
    wholesaleCostAmount,
    grossProfit,
    grossMargin,
    status: "available",
  };
}

/**
 * Builds chronological observation intervals for a store + SKU.
 * Requires at least 2 distinct weekly check snapshots.
 */
export function buildStoreObservationIntervals(params: {
  snapshots: SnapshotInput[];
  receipts: ReceiptEvent[];
  adjustments?: StockAdjustment[];
  pricing: PricingInput;
}): ObservationInterval[] {
  const { snapshots, receipts, adjustments = [], pricing } = params;

  // Sort snapshots chronologically by reportDate
  const sorted = [...snapshots].sort((a, b) => a.reportDate.localeCompare(b.reportDate));

  if (sorted.length < 2) {
    // Baseline only or no counts: cannot form intervals
    return [];
  }

  const intervals: ObservationInterval[] = [];

  for (let i = 1; i < sorted.length; i++) {
    const prevSnap = sorted[i - 1];
    const currSnap = sorted[i];

    const startDate = prevSnap.reportDate;
    const endDate = currSnap.reportDate;

    // Calculate days elapsed between observation dates
    const startMs = new Date(startDate + "T00:00:00Z").getTime();
    const endMs = new Date(endDate + "T00:00:00Z").getTime();
    const diffDays = Math.max(1, Math.round((endMs - startMs) / 86400000));

    // Filter receipts and adjustments strictly within this interval
    const intervalReceipts = filterReceiptsInInterval(receipts, startDate, endDate);
    const intervalAdjustments = filterAdjustmentsInInterval(adjustments, startDate, endDate);

    const totalReceiptQty = intervalReceipts.reduce((sum, r) => sum + Math.max(0, r.quantity), 0);
    const positiveAdj = intervalAdjustments
      .filter((a) => a.direction === "positive")
      .reduce((sum, a) => sum + Math.max(0, a.quantity), 0);
    const negativeAdj = intervalAdjustments
      .filter((a) => a.direction === "negative")
      .reduce((sum, a) => sum + Math.max(0, a.quantity), 0);

    const movementRes = calculateIntervalMovement({
      previousStock: prevSnap.reportedRemaining,
      currentStock: currSnap.reportedRemaining,
      receiptsInInterval: totalReceiptQty,
      positiveAdjustments: positiveAdj,
      negativeAdjustments: negativeAdj,
    });

    const { srp, source: srpSource } = resolveEffectiveSrp(currSnap.retailPriceSnapshot, pricing);
    const wholesaleCost =
      typeof pricing.wholesalePrice === "number" && pricing.wholesalePrice > 0
        ? Number(pricing.wholesalePrice.toFixed(2))
        : null;

    let finStatus = movementRes.status;
    let finReason = movementRes.statusReason;
    let retailSales: number | null = null;
    let wholesaleCostAmount: number | null = null;
    let grossProfit: number | null = null;

    if (movementRes.status === "available") {
      const fin = calculateFinancials(movementRes.estimatedUnitsMoved, srp, wholesaleCost);
      if (fin.status !== "available") {
        finStatus = fin.status;
        finReason = fin.statusReason;
      }
      retailSales = fin.retailSales;
      wholesaleCostAmount = fin.wholesaleCostAmount;
      grossProfit = fin.grossProfit;
    }

    intervals.push({
      intervalIndex: i,
      startDate,
      endDate,
      daysElapsed: diffDays,
      previousStock: prevSnap.reportedRemaining,
      currentStock: currSnap.reportedRemaining,
      receiptsInInterval: totalReceiptQty,
      positiveAdjustments: positiveAdj,
      negativeAdjustments: negativeAdj,
      estimatedUnitsMoved: movementRes.estimatedUnitsMoved,
      status: finStatus,
      statusReason: finReason,
      applicableSrp: srp,
      srpSource: srpSource || undefined,
      applicableWholesaleCost: wholesaleCost,
      estimatedRetailSales: retailSales,
      estimatedWholesaleCost: wholesaleCostAmount,
      estimatedGrossProfit: grossProfit,
      receiptEventsCount: intervalReceipts.length,
    });
  }

  return intervals;
}

/**
 * Filter intervals for a given analysis period (7d, 30d, 90d, all).
 * An interval is included if its endDate falls within the period window.
 */
export function filterIntervalsForPeriod(
  intervals: ObservationInterval[],
  period: AnalysisPeriod,
  asOfDate: Date = new Date()
): ObservationInterval[] {
  if (period === "all") return intervals;

  const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
  const cutoffMs = asOfDate.getTime() - days * 86400000;
  const cutoffIso = new Date(cutoffMs).toISOString().split("T")[0];

  return intervals.filter((inv) => inv.endDate >= cutoffIso);
}

/**
 * Aggregate a list of observation intervals into FinancialMetrics.
 */
export function aggregateIntervalsToMetrics(
  intervals: ObservationInterval[],
  defaultSrp: number | null = null,
  defaultSrpSource: PricingSource | null = null,
  defaultWholesaleCost: number | null = null
): FinancialMetrics {
  if (intervals.length === 0) {
    return {
      status: "insufficient_data",
      statusReason: "No completed observation intervals available in this period",
      observedDays: 0,
      intervalsCount: 0,
      estimatedUnitsSold: null,
      estimatedDailySalesRate: null,
      estimatedWeeklySalesRate: null,
      estimatedRetailSales: null,
      estimatedWholesaleCost: null,
      estimatedGrossProfit: null,
      estimatedGrossMargin: null,
      srp: defaultSrp,
      srpSource: defaultSrpSource,
      wholesaleCost: defaultWholesaleCost,
    };
  }

  // Check if any interval has "needs_review"
  const needsReviewInterval = intervals.find((i) => i.status === "needs_review");
  if (needsReviewInterval) {
    const totalDays = intervals.reduce((sum, i) => sum + i.daysElapsed, 0);
    return {
      status: "needs_review",
      statusReason: needsReviewInterval.statusReason || "Negative or anomalous inventory movement detected",
      observedDays: totalDays,
      intervalsCount: intervals.length,
      estimatedUnitsSold: null,
      estimatedDailySalesRate: null,
      estimatedWeeklySalesRate: null,
      estimatedRetailSales: null,
      estimatedWholesaleCost: null,
      estimatedGrossProfit: null,
      estimatedGrossMargin: null,
      srp: defaultSrp,
      srpSource: defaultSrpSource,
      wholesaleCost: defaultWholesaleCost,
    };
  }

  const totalDays = intervals.reduce((sum, i) => sum + i.daysElapsed, 0);
  const totalUnits = intervals.reduce((sum, i) => sum + i.estimatedUnitsMoved, 0);
  const velocity = calculateVelocity(totalUnits, totalDays);

  // Check pricing across intervals
  let hasMissingSrp = false;
  let hasMissingCost = false;
  let totalSales = 0;
  let totalCost = 0;

  for (const inv of intervals) {
    if (inv.estimatedRetailSales === null) {
      hasMissingSrp = true;
    } else {
      totalSales += inv.estimatedRetailSales;
    }

    if (inv.estimatedWholesaleCost === null) {
      hasMissingCost = true;
    } else {
      totalCost += inv.estimatedWholesaleCost;
    }
  }

  const roundedSales = hasMissingSrp ? null : Number(totalSales.toFixed(2));
  const roundedCost = hasMissingCost ? null : Number(totalCost.toFixed(2));
  const roundedProfit =
    roundedSales !== null && roundedCost !== null ? Number((roundedSales - roundedCost).toFixed(2)) : null;

  // Weighted Gross Margin: Total GP / Total Sales * 100
  const grossMargin =
    roundedProfit !== null && roundedSales !== null && roundedSales > 0
      ? Number(((roundedProfit / roundedSales) * 100).toFixed(2))
      : null;

  let overallStatus: FinancialReliabilityStatus = "available";
  let statusReason: string | undefined;

  if (hasMissingSrp || hasMissingCost) {
    overallStatus = "not_available";
    statusReason = hasMissingSrp
      ? "Suggested Retail Price (SRP) missing for one or more intervals"
      : "Wholesale purchase cost missing for one or more intervals";
  }

  return {
    status: overallStatus,
    statusReason,
    observedDays: totalDays,
    intervalsCount: intervals.length,
    estimatedUnitsSold: totalUnits,
    estimatedDailySalesRate: velocity.dailyRate,
    estimatedWeeklySalesRate: velocity.weeklyRate,
    estimatedRetailSales: roundedSales,
    estimatedWholesaleCost: roundedCost,
    estimatedGrossProfit: roundedProfit,
    estimatedGrossMargin: grossMargin,
    srp: defaultSrp,
    srpSource: defaultSrpSource,
    wholesaleCost: defaultWholesaleCost,
  };
}

/**
 * Builds StoreSkuFinancialEstimate for a single store and product.
 */
export function buildStoreSkuFinancialEstimate(params: {
  storeId: string;
  storeName: string;
  productId: string;
  sku: string;
  selectedPeriod: AnalysisPeriod;
  snapshots: SnapshotInput[];
  receipts: ReceiptEvent[];
  adjustments?: StockAdjustment[];
  pricing: PricingInput;
  asOfDate?: Date;
}): StoreSkuFinancialEstimate {
  const { storeId, storeName, productId, sku, selectedPeriod, snapshots, receipts, adjustments, pricing, asOfDate } = params;

  const { srp: defaultSrp, source: defaultSrpSource } = resolveEffectiveSrp(null, pricing);
  const wholesaleCost =
    typeof pricing.wholesalePrice === "number" && pricing.wholesalePrice > 0
      ? Number(pricing.wholesalePrice.toFixed(2))
      : null;

  // All intervals from baseline onwards
  const allIntervals = buildStoreObservationIntervals({
    snapshots,
    receipts,
    adjustments,
    pricing,
  });

  // Cumulative metrics: across all eligible reliable intervals from baseline
  const cumulativeMetrics = aggregateIntervalsToMetrics(
    allIntervals,
    defaultSrp,
    defaultSrpSource,
    wholesaleCost
  );

  // Period-specific intervals
  const periodIntervals = filterIntervalsForPeriod(allIntervals, selectedPeriod, asOfDate);
  const periodMetrics = aggregateIntervalsToMetrics(
    periodIntervals,
    defaultSrp,
    defaultSrpSource,
    wholesaleCost
  );

  return {
    storeId,
    storeName,
    productId,
    sku,
    selectedPeriod,
    periodMetrics,
    cumulativeMetrics,
    intervals: periodIntervals,
    receiptEvents: receipts,
  };
}

/**
 * Aggregates multiple StoreSkuFinancialEstimates into a CompanySkuFinancialEstimate.
 *
 * Rules:
 * 1. Weighted Gross Margin: Total Estimated Gross Profit / Total Estimated Retail Sales * 100
 *    NEVER average individual percentages!
 * 2. Status propagation:
 *    - If any store has "needs_review", company SKU is "needs_review"
 *    - If no stores have data, "insufficient_data"
 *    - If pricing is missing, "not_available"
 *    - If at least one store has "available", company SKU is "available"
 */
export function aggregateStoreEstimatesToCompany(params: {
  companyId: string;
  productId: string;
  sku: string;
  productName: string;
  productNameEn?: string | null;
  brandName: string;
  category: string;
  cartonPackQty: number;
  selectedPeriod: AnalysisPeriod;
  totalCompanyStoresCount: number;
  storeEstimates: StoreSkuFinancialEstimate[];
}): CompanySkuFinancialEstimate {
  const {
    companyId,
    productId,
    sku,
    productName,
    productNameEn = null,
    brandName,
    category,
    cartonPackQty,
    selectedPeriod,
    totalCompanyStoresCount,
    storeEstimates,
  } = params;

  const reportingStores = storeEstimates.filter(
    (se) => se.periodMetrics.status !== "insufficient_data"
  );
  const reportingStoresCount = reportingStores.length;
  const coveragePercent =
    totalCompanyStoresCount > 0 ? Math.round((reportingStoresCount / totalCompanyStoresCount) * 100) : 0;
  const isPartial = reportingStoresCount < totalCompanyStoresCount;

  // Aggregate helper for either periodMetrics or cumulativeMetrics
  const aggregateMetricGroup = (selector: (s: StoreSkuFinancialEstimate) => FinancialMetrics): FinancialMetrics => {
    const list = storeEstimates.map(selector);
    const active = list.filter((m) => m.status !== "insufficient_data");

    if (active.length === 0) {
      return {
        status: "insufficient_data",
        statusReason: "No stores have completed observation intervals in this period",
        observedDays: 0,
        intervalsCount: 0,
        estimatedUnitsSold: null,
        estimatedDailySalesRate: null,
        estimatedWeeklySalesRate: null,
        estimatedRetailSales: null,
        estimatedWholesaleCost: null,
        estimatedGrossProfit: null,
        estimatedGrossMargin: null,
        srp: list[0]?.srp || null,
        srpSource: list[0]?.srpSource || null,
        wholesaleCost: list[0]?.wholesaleCost || null,
      };
    }

    const needsReview = active.find((m) => m.status === "needs_review");
    if (needsReview) {
      const maxDays = Math.max(...active.map((m) => m.observedDays));
      return {
        status: "needs_review",
        statusReason: needsReview.statusReason || "One or more stores have negative or anomalous movement",
        observedDays: maxDays,
        intervalsCount: active.reduce((sum, m) => sum + m.intervalsCount, 0),
        estimatedUnitsSold: null,
        estimatedDailySalesRate: null,
        estimatedWeeklySalesRate: null,
        estimatedRetailSales: null,
        estimatedWholesaleCost: null,
        estimatedGrossProfit: null,
        estimatedGrossMargin: null,
        srp: list[0]?.srp || null,
        srpSource: list[0]?.srpSource || null,
        wholesaleCost: list[0]?.wholesaleCost || null,
      };
    }

    const totalUnits = active.reduce((sum, m) => sum + (m.estimatedUnitsSold || 0), 0);
    const maxDays = Math.max(...active.map((m) => m.observedDays));
    const totalIntervals = active.reduce((sum, m) => sum + m.intervalsCount, 0);

    const velocity = calculateVelocity(totalUnits, maxDays);

    let hasMissingSrp = false;
    let hasMissingCost = false;
    let totalSales = 0;
    let totalCost = 0;

    for (const m of active) {
      if (m.estimatedRetailSales === null) hasMissingSrp = true;
      else totalSales += m.estimatedRetailSales;

      if (m.estimatedWholesaleCost === null) hasMissingCost = true;
      else totalCost += m.estimatedWholesaleCost;
    }

    const roundedSales = hasMissingSrp ? null : Number(totalSales.toFixed(2));
    const roundedCost = hasMissingCost ? null : Number(totalCost.toFixed(2));
    const roundedProfit =
      roundedSales !== null && roundedCost !== null ? Number((roundedSales - roundedCost).toFixed(2)) : null;

    // Weighted Gross Margin across stores: Total GP / Total Sales * 100
    const grossMargin =
      roundedProfit !== null && roundedSales !== null && roundedSales > 0
        ? Number(((roundedProfit / roundedSales) * 100).toFixed(2))
        : null;

    let status: FinancialReliabilityStatus = "available";
    let statusReason: string | undefined;

    if (hasMissingSrp || hasMissingCost) {
      status = "not_available";
      statusReason = hasMissingSrp
        ? "Suggested Retail Price (SRP) missing in one or more reporting stores"
        : "Wholesale purchase cost missing in one or more reporting stores";
    }

    return {
      status,
      statusReason,
      observedDays: maxDays,
      intervalsCount: totalIntervals,
      estimatedUnitsSold: totalUnits,
      estimatedDailySalesRate: velocity.dailyRate,
      estimatedWeeklySalesRate: velocity.weeklyRate,
      estimatedRetailSales: roundedSales,
      estimatedWholesaleCost: roundedCost,
      estimatedGrossProfit: roundedProfit,
      estimatedGrossMargin: grossMargin,
      srp: list[0]?.srp || null,
      srpSource: list[0]?.srpSource || null,
      wholesaleCost: list[0]?.wholesaleCost || null,
    };
  };

  const periodMetrics = aggregateMetricGroup((s) => s.periodMetrics);
  const cumulativeMetrics = aggregateMetricGroup((s) => s.cumulativeMetrics);
  const observedDaysMax = Math.max(0, ...storeEstimates.map((s) => s.periodMetrics.observedDays));

  return {
    companyId,
    productId,
    sku,
    productName,
    productNameEn,
    brandName,
    category,
    cartonPackQty,
    selectedPeriod,
    coverage: {
      totalStoresCount: totalCompanyStoresCount,
      reportingStoresCount,
      coveragePercent,
      isPartial,
      observedDaysMax,
    },
    periodMetrics,
    cumulativeMetrics,
    storeEstimates,
  };
}

/**
 * Rollup of all CompanySkuFinancialEstimates into CompanyFinancialPerformanceSummary.
 */
export function buildCompanyFinancialSummary(params: {
  companyId: string;
  selectedPeriod: AnalysisPeriod;
  totalStoresCount: number;
  products: CompanySkuFinancialEstimate[];
}): CompanyFinancialPerformanceSummary {
  const { companyId, selectedPeriod, totalStoresCount, products } = params;

  let totalUnits = 0;
  let totalSales = 0;
  let totalCost = 0;
  let totalProfit = 0;
  let skusWithEstimates = 0;
  let skusNeedsReview = 0;
  let skusInsufficient = 0;
  let skusNotAvailable = 0;

  const activeReportingStoreIds = new Set<string>();

  for (const prod of products) {
    const st = prod.periodMetrics.status;
    if (st === "available") {
      skusWithEstimates += 1;
      totalUnits += prod.periodMetrics.estimatedUnitsSold || 0;
      totalSales += prod.periodMetrics.estimatedRetailSales || 0;
      totalCost += prod.periodMetrics.estimatedWholesaleCost || 0;
      totalProfit += prod.periodMetrics.estimatedGrossProfit || 0;
    } else if (st === "needs_review") {
      skusNeedsReview += 1;
    } else if (st === "insufficient_data") {
      skusInsufficient += 1;
    } else if (st === "not_available") {
      skusNotAvailable += 1;
      if (prod.periodMetrics.estimatedUnitsSold !== null) {
        totalUnits += prod.periodMetrics.estimatedUnitsSold;
      }
    }

    prod.storeEstimates.forEach((se) => {
      if (se.periodMetrics.status !== "insufficient_data") {
        activeReportingStoreIds.add(se.storeId);
      }
    });
  }

  const reportingStores = activeReportingStoreIds.size;
  const coveragePercent = totalStoresCount > 0 ? Math.round((reportingStores / totalStoresCount) * 100) : 0;
  const isPartial = reportingStores < totalStoresCount;

  // Network Weighted Gross Margin
  const weightedGrossMargin = totalSales > 0 ? Number(((totalProfit / totalSales) * 100).toFixed(2)) : 0;

  return {
    companyId,
    selectedPeriod,
    coverage: {
      totalStores: totalStoresCount,
      reportingStores,
      percent: coveragePercent,
      isPartial,
    },
    totalEstimatedUnitsSold: totalUnits,
    totalEstimatedRetailSales: Number(totalSales.toFixed(2)),
    totalEstimatedWholesaleCost: Number(totalCost.toFixed(2)),
    totalEstimatedGrossProfit: Number(totalProfit.toFixed(2)),
    weightedGrossMargin,
    skusWithEstimatesCount: skusWithEstimates,
    skusNeedsReviewCount: skusNeedsReview,
    skusInsufficientDataCount: skusInsufficient,
    skusNotAvailableCount: skusNotAvailable,
    products,
  };
}

export const aggregateCompanySummary = buildCompanyFinancialSummary;

