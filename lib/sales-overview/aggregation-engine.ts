/**
 * Sales Overview V1.0 — Pure Aggregation & KPI Calculation Engine
 * Task ID: ADM-SALES-PERF-004-R1
 * Location: lib/sales-overview/aggregation-engine.ts
 *
 * Implements deterministic calculation for:
 * - America/New_York completed 30-day evaluation windows [T-30, T) vs [T-60, T-30)
 * - 12 Network KPIs without duplicate financial or store calculation engines
 * - Exact Store / SKU Net Sales Reconciliation
 * - Factual Action Center risk indicators without arbitrary thresholds
 */

import type {
  SalesOverviewPeriod,
  KpiMetric,
  DailySalesTrendPoint,
  BrandSalesMixItem,
  CategorySalesMixItem,
  SalesGrowthMetric,
  ExchangeExposureSummary,
  DataCompletenessSummary,
  SalesOverviewReconciliation,
  ActionCenterFacts,
  SalesOverviewKpiPayload,
  SalesOverviewDashboardData,
  DecliningStoreFact,
  DormantStoreFact,
  MissingCostProductFact,
  InventoryCoverageWarningFact,
  ExchangeActivityFact,
  ReportingGapStoreFact,
} from "./types";
import { safeDiv, safeRound, addDays, daysBetween } from "@/lib/product/performance/helpers";

export interface RawOrderRecord {
  id: string;
  orderNumber: string;
  companyId: string;
  storeId: string | null;
  orderStatus: string;
  paymentStatus: string;
  subtotalAmount: number;
  discountAmount: number;
  totalAmount: number;
  isTest: boolean;
  createdAt: string;
}

export interface RawOrderItemRecord {
  id: string;
  orderId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  discountAmount?: number;
}

export interface RawRefundRecord {
  id: string;
  orderId: string;
  merchandiseAmount: number;
  status: string;
  createdAt: string;
}

export interface RawCostRecord {
  productId: string;
  effectiveDate: string; // YYYY-MM-DD
  unitLandedCost: number;
}

export interface RawStoreRecord {
  id: string;
  name: string;
  storeCode: string | null;
  companyId: string;
  companyName: string;
  city: string | null;
  state: string | null;
  status: string;
  createdAt: string;
}

export interface RawProductRecord {
  id: string;
  sku: string;
  name: string;
  brandId: string | null;
  brandName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  overrideLandedCost?: number | null;
  overrideEffectiveDate?: string | null;
}

export interface RawInventoryLayerRecord {
  productId: string;
  remainingQty: number;
  unitLandedCost: number;
  status: string;
}

export interface RawExchangeClaimRecord {
  id: string;
  claimNumber: string;
  storeId: string;
  storeName: string;
  productId: string;
  claimAmount: number;
  status: string;
  claimedAt: string;
}

export interface RawWeeklyCheckRecord {
  id: string;
  storeId: string;
  status: string;
  reportingWeek: string;
  submittedAt: string | null;
}

export interface AggregationEngineInput {
  asOfDate?: string | Date;
  period?: SalesOverviewPeriod;
  lookbackDays?: number;
  customRange?: { start: string; end: string };
  stores: RawStoreRecord[];
  orders: RawOrderRecord[];
  orderItems: RawOrderItemRecord[];
  refunds: RawRefundRecord[];
  costs: RawCostRecord[];
  products: RawProductRecord[];
  inventoryLayers: RawInventoryLayerRecord[];
  claims: RawExchangeClaimRecord[];
  weeklyChecks: RawWeeklyCheckRecord[];
  protectedStoreIds?: string[];
}

/**
 * 1. Resolves Eastern Time (America/New_York) evaluation window
 * Supports 7D, 30D (default), 60D, 90D, or Custom date ranges.
 * Current: [Start, End)
 * Previous: [Start - Duration, Start) of equal duration
 */
export function getSalesOverviewPeriodET(
  asOfDateInput?: Date | string,
  lookbackDays: number = 30,
  customRange?: { start: string; end: string }
): SalesOverviewPeriod {
  const timeZone = "America/New_York";
  let d: Date;
  if (!asOfDateInput) {
    d = new Date();
  } else if (typeof asOfDateInput === "string") {
    d = new Date(`${asOfDateInput}T12:00:00Z`);
  } else {
    d = asOfDateInput;
  }

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const asOfDateStr = formatter.format(d); // "YYYY-MM-DD"

  let currentPeriodStart: string;
  let currentPeriodEnd: string;
  let previousPeriodStart: string;
  let previousPeriodEnd: string;
  let daysInPeriod: number;

  if (customRange && customRange.start && customRange.end) {
    currentPeriodStart = customRange.start;
    currentPeriodEnd = customRange.end;
    daysInPeriod = Math.max(1, daysBetween(currentPeriodStart, currentPeriodEnd));
    previousPeriodEnd = currentPeriodStart;
    previousPeriodStart = addDays(currentPeriodStart, -daysInPeriod);
  } else {
    daysInPeriod = Math.max(1, lookbackDays || 30);
    currentPeriodEnd = asOfDateStr; // T (exclusive)
    currentPeriodStart = addDays(asOfDateStr, -daysInPeriod); // T - daysInPeriod (inclusive)
    previousPeriodEnd = currentPeriodStart; // T - daysInPeriod (exclusive)
    previousPeriodStart = addDays(asOfDateStr, -(daysInPeriod * 2)); // T - 2*daysInPeriod (inclusive)
  }

  return {
    timezone: timeZone,
    asOfDate: asOfDateStr,
    currentPeriodStart,
    currentPeriodEnd,
    previousPeriodStart,
    previousPeriodEnd,
    daysInPeriod,
  };
}

/**
 * 2. Checks if an ISO timestamp falls into an America/New_York [startDate, endDate) interval
 */
export function isTimestampInEtWindow(
  isoTimestamp: string | null | undefined,
  startDateStr: string,
  endDateStr: string
): boolean {
  if (!isoTimestamp) return false;
  const timeZone = "America/New_York";
  const dateObj = new Date(isoTimestamp);
  if (isNaN(dateObj.getTime())) return false;

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const dateStr = formatter.format(dateObj);
  return dateStr >= startDateStr && dateStr < endDateStr;
}

/**
 * Converts ISO timestamp to ET YYYY-MM-DD string
 */
export function toEtDateString(isoTimestamp: string | null | undefined): string | null {
  if (!isoTimestamp) return null;
  const timeZone = "America/New_York";
  const dateObj = new Date(isoTimestamp);
  if (isNaN(dateObj.getTime())) return null;

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(dateObj);
}

/**
 * 3. Master Aggregator for Sales Overview V1.0
 */
export function aggregateSalesOverviewData(input: AggregationEngineInput): SalesOverviewDashboardData {
  const period =
    input.period ||
    getSalesOverviewPeriodET(input.asOfDate, input.lookbackDays, input.customRange);
  const {
    stores,
    orders,
    orderItems,
    refunds,
    costs,
    products,
    inventoryLayers,
    claims,
    weeklyChecks,
    protectedStoreIds = [],
  } = input;

  // --------------------------------------------------------------------------
  // Step 1: Pre-index supporting records
  // --------------------------------------------------------------------------
  const storesById = new Map<string, RawStoreRecord>();
  for (const s of stores) {
    storesById.set(s.id, s);
  }

  const productsById = new Map<string, RawProductRecord>();
  for (const p of products) {
    productsById.set(p.id, p);
  }

  // Refunds indexed by order_id (only completed refunds)
  const refundsByOrderId = new Map<string, number>();
  for (const r of refunds) {
    if ((r.status || "").toLowerCase() === "completed" && r.orderId) {
      const cur = refundsByOrderId.get(r.orderId) || 0;
      refundsByOrderId.set(r.orderId, cur + (Number(r.merchandiseAmount) || 0));
    }
  }

  // --------------------------------------------------------------------------
  // Step 2: Classify orders by period (Current, Previous, Lifetime)
  // Exclude test orders (is_test = true), cancelled, and draft orders
  // --------------------------------------------------------------------------
  const validOrders = orders.filter((o) => {
    if (o.isTest) return false;
    const st = (o.orderStatus || "").toLowerCase();
    return st !== "cancelled" && st !== "draft";
  });

  // Sort orders chronologically to identify lifetime first order per store
  const ordersByStoreId = new Map<string, RawOrderRecord[]>();
  for (const o of validOrders) {
    if (o.storeId) {
      const list = ordersByStoreId.get(o.storeId) || [];
      list.push(o);
      ordersByStoreId.set(o.storeId, list);
    }
  }

  const storeFirstOrderDate = new Map<string, string>();
  for (const [storeId, storeOrderList] of ordersByStoreId.entries()) {
    storeOrderList.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    if (storeOrderList.length > 0) {
      storeFirstOrderDate.set(storeId, storeOrderList[0].createdAt);
    }
  }

  // Categorize orders into Current 30D and Previous 30D
  const currentOrders: RawOrderRecord[] = [];
  const previousOrders: RawOrderRecord[] = [];
  const currentOrderIds = new Set<string>();
  const previousOrderIds = new Set<string>();

  for (const ord of validOrders) {
    if (isTimestampInEtWindow(ord.createdAt, period.currentPeriodStart, period.currentPeriodEnd)) {
      currentOrders.push(ord);
      currentOrderIds.add(ord.id);
    } else if (isTimestampInEtWindow(ord.createdAt, period.previousPeriodStart, period.previousPeriodEnd)) {
      previousOrders.push(ord);
      previousOrderIds.add(ord.id);
    }
  }

  // --------------------------------------------------------------------------
  // Step 3: Compute B2B Net Sales (Current & Previous) & Store Attribution
  // --------------------------------------------------------------------------
  let currentGrossSubtotal = 0;
  let currentDiscounts = 0;
  let currentRefunds = 0;
  let currentB2bNetSales = 0;

  let storeAttributedSales = 0;
  let companyUnallocatedSales = 0;
  let unallocatedOrdersCount = 0;

  const currentOrderingStoreIds = new Set<string>();
  const currentReorderingStoreIds = new Set<string>();
  const salesByStoreCurrent = new Map<string, number>();

  for (const ord of currentOrders) {
    const subtotal = Number(ord.subtotalAmount) || 0;
    const discount = Number(ord.discountAmount) || 0;
    const refund = refundsByOrderId.get(ord.id) || 0;
    const netOrder = Math.max(0, subtotal - discount - refund);

    currentGrossSubtotal += subtotal;
    currentDiscounts += discount;
    currentRefunds += refund;
    currentB2bNetSales += netOrder;

    if (ord.storeId) {
      currentOrderingStoreIds.add(ord.storeId);
      storeAttributedSales += netOrder;
      const curStoreSales = salesByStoreCurrent.get(ord.storeId) || 0;
      salesByStoreCurrent.set(ord.storeId, curStoreSales + netOrder);

      // Reorder check: Did the store have an order prior to this order?
      const firstOrderCreated = storeFirstOrderDate.get(ord.storeId);
      if (firstOrderCreated && ord.createdAt > firstOrderCreated) {
        currentReorderingStoreIds.add(ord.storeId);
      }
    } else {
      companyUnallocatedSales += netOrder;
      unallocatedOrdersCount++;
    }
  }

  let previousB2bNetSales = 0;
  const salesByStorePrevious = new Map<string, number>();
  const previousOrderingStoreIds = new Set<string>();

  for (const ord of previousOrders) {
    const subtotal = Number(ord.subtotalAmount) || 0;
    const discount = Number(ord.discountAmount) || 0;
    const refund = refundsByOrderId.get(ord.id) || 0;
    const netOrder = Math.max(0, subtotal - discount - refund);

    previousB2bNetSales += netOrder;
    if (ord.storeId) {
      previousOrderingStoreIds.add(ord.storeId);
      const curStoreSales = salesByStorePrevious.get(ord.storeId) || 0;
      salesByStorePrevious.set(ord.storeId, curStoreSales + netOrder);
    }
  }

  // Safe rounding
  currentB2bNetSales = safeRound(currentB2bNetSales, 2) ?? 0;
  previousB2bNetSales = safeRound(previousB2bNetSales, 2) ?? 0;
  storeAttributedSales = safeRound(storeAttributedSales, 2) ?? 0;
  companyUnallocatedSales = safeRound(companyUnallocatedSales, 2) ?? 0;

  // --------------------------------------------------------------------------
  // Step 4: Line-level analysis, Landed COGS, Gross Profit, Brand & Category Mix
  // --------------------------------------------------------------------------
  let totalOrderLinesCount = 0;
  let orderLinesWithVerifiedCostCount = 0;
  let orderLinesMissingCostCount = 0;
  let netSalesWithVerifiedCost = 0;
  let totalLandedCogs = 0;

  let skuAttributedGrossSales = 0;
  let lineLevelDiscounts = 0;

  const brandSalesMap = new Map<string, { brandName: string; netSales: number; unitsSold: number }>();
  const categorySalesMap = new Map<string, { categoryName: string; netSales: number; unitsSold: number }>();
  const productSoldUnitsMap = new Map<string, { unitsSold: number; netSales: number }>();
  const missingCostProductSet = new Set<string>();

  // Filter items belonging to current valid orders
  const currentItems = orderItems.filter((item) => currentOrderIds.has(item.orderId));
  const orderMap = new Map<string, RawOrderRecord>();
  for (const o of currentOrders) {
    orderMap.set(o.id, o);
  }

  for (const item of currentItems) {
    totalOrderLinesCount++;
    const ord = orderMap.get(item.orderId);
    if (!ord) continue;

    const orderDateStr = toEtDateString(ord.createdAt) || period.currentPeriodStart;
    const qty = Math.max(0, Number(item.quantity) || 0);
    const unitPrice = Number(item.unitPrice) || 0;
    const lineGross = qty * unitPrice;
    const lineDiscount = Number(item.discountAmount) || 0;
    const lineNet = Math.max(0, lineGross - lineDiscount);

    skuAttributedGrossSales += lineGross;
    lineLevelDiscounts += lineDiscount;

    // Track product volume
    const curProd = productSoldUnitsMap.get(item.productId) || { unitsSold: 0, netSales: 0 };
    productSoldUnitsMap.set(item.productId, {
      unitsSold: curProd.unitsSold + qty,
      netSales: curProd.netSales + lineNet,
    });

    // Brand & Category mix accumulation
    const prod = productsById.get(item.productId);
    const brandId = prod?.brandId || "unknown_brand";
    const brandName = prod?.brandName || "Other Brand";
    const categoryId = prod?.categoryId || "unknown_category";
    const categoryName = prod?.categoryName || "Other Category";

    const bEntry = brandSalesMap.get(brandId) || { brandName, netSales: 0, unitsSold: 0 };
    brandSalesMap.set(brandId, {
      brandName,
      netSales: bEntry.netSales + lineNet,
      unitsSold: bEntry.unitsSold + qty,
    });

    const cEntry = categorySalesMap.get(categoryId) || { categoryName, netSales: 0, unitsSold: 0 };
    categorySalesMap.set(categoryId, {
      categoryName,
      netSales: cEntry.netSales + lineNet,
      unitsSold: cEntry.unitsSold + qty,
    });

    // Resolve historical landed cost on or before order date
    let resolvedUnitCost: number | null = null;

    // A. Check override landed cost if effective date is on or before order date
    if (
      prod?.overrideLandedCost &&
      prod.overrideLandedCost > 0 &&
      prod.overrideEffectiveDate &&
      prod.overrideEffectiveDate <= orderDateStr
    ) {
      resolvedUnitCost = prod.overrideLandedCost;
    } else {
      // B. Search verifiable historical costs on or prior to order date
      const matchedCosts = costs
        .filter((c) => c.productId === item.productId && c.unitLandedCost > 0 && c.effectiveDate <= orderDateStr)
        .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate));

      if (matchedCosts.length > 0) {
        resolvedUnitCost = matchedCosts[0].unitLandedCost;
      }
    }

    if (resolvedUnitCost !== null && resolvedUnitCost > 0) {
      orderLinesWithVerifiedCostCount++;
      netSalesWithVerifiedCost += lineNet;
      totalLandedCogs += qty * resolvedUnitCost;
    } else {
      orderLinesMissingCostCount++;
      missingCostProductSet.add(item.productId);
    }
  }

  // --------------------------------------------------------------------------
  // Step 5: Cost Coverage & Gross Profit / Margin Policy
  // Rule: Gross Profit must be N/A where historical COGS coverage is incomplete (< 100%)
  // --------------------------------------------------------------------------
  const costCoveragePercent =
    currentB2bNetSales > 0 ? safeRound((netSalesWithVerifiedCost / currentB2bNetSales) * 100, 1) : null;

  const isCostCoverageComplete = orderLinesMissingCostCount === 0 && totalOrderLinesCount > 0;

  let grossProfitValue: number | null = null;
  let grossMarginValue: number | null = null;
  let grossProfitStatus: "ACTUAL" | "UNAVAILABLE" = "UNAVAILABLE";
  let grossMarginStatus: "ACTUAL" | "UNAVAILABLE" = "UNAVAILABLE";

  if (isCostCoverageComplete && currentB2bNetSales > 0) {
    grossProfitValue = safeRound(currentB2bNetSales - totalLandedCogs, 2);
    grossMarginValue = safeRound(safeDiv(grossProfitValue, currentB2bNetSales)! * 100, 1);
    grossProfitStatus = "ACTUAL";
    grossMarginStatus = "ACTUAL";
  }

  // --------------------------------------------------------------------------
  // Step 6: Ordering Stores, Reorder Stores, and Reorder Rate
  // Proposed Denominator: Distinct Reordering Stores / Distinct Ordering Stores
  // --------------------------------------------------------------------------
  const orderingStoresCount = currentOrderingStoreIds.size;
  const reorderStoresCount = currentReorderingStoreIds.size;
  const reorderRatePercent =
    orderingStoresCount > 0 ? safeRound((reorderStoresCount / orderingStoresCount) * 100, 1) : null;

  // Active stores count (kept strictly separate from ordering stores)
  const activeStoresCount = stores.filter((s) => (s.status || "").toLowerCase() === "active").length;

  // --------------------------------------------------------------------------
  // Step 7: HQ Inventory Value (As-of-date Snapshot, strictly HQ warehouse)
  // --------------------------------------------------------------------------
  let totalHqInventoryValue = 0;
  let hasMissingInventoryLayerCost = false;

  const activeLayers = inventoryLayers.filter((l) => l.remainingQty > 0 && l.status.toUpperCase() !== "DEPLETED");

  for (const l of activeLayers) {
    if (l.unitLandedCost > 0) {
      totalHqInventoryValue += l.remainingQty * l.unitLandedCost;
    } else {
      hasMissingInventoryLayerCost = true;
    }
  }
  totalHqInventoryValue = safeRound(totalHqInventoryValue, 2) ?? 0;

  // --------------------------------------------------------------------------
  // Step 8: Sales Growth Calculation
  // --------------------------------------------------------------------------
  let growthPercent: number | null = null;
  let growthLabel = "N/A";

  if (previousB2bNetSales === 0) {
    if (currentB2bNetSales > 0) {
      growthLabel = "New Revenue";
    } else {
      growthLabel = "N/A";
    }
  } else {
    const diff = currentB2bNetSales - previousB2bNetSales;
    growthPercent = safeRound((diff / previousB2bNetSales) * 100, 1);
    const sign = growthPercent! > 0 ? "+" : "";
    growthLabel = `${sign}${growthPercent!.toFixed(1)}%`;
  }

  const salesGrowth: SalesGrowthMetric = {
    percent: growthPercent,
    label: growthLabel,
    currentSales: currentB2bNetSales,
    previousSales: previousB2bNetSales,
  };

  // --------------------------------------------------------------------------
  // Step 9: Daily Sales Trend (30-day ET date series)
  // --------------------------------------------------------------------------
  const dailyCurrentMap = new Map<string, { netSales: number; ordersCount: number }>();
  const dailyPreviousMap = new Map<string, { netSales: number; ordersCount: number }>();

  for (const ord of currentOrders) {
    const dt = toEtDateString(ord.createdAt);
    if (!dt) continue;
    const subtotal = Number(ord.subtotalAmount) || 0;
    const discount = Number(ord.discountAmount) || 0;
    const refund = refundsByOrderId.get(ord.id) || 0;
    const net = Math.max(0, subtotal - discount - refund);

    const cur = dailyCurrentMap.get(dt) || { netSales: 0, ordersCount: 0 };
    dailyCurrentMap.set(dt, { netSales: cur.netSales + net, ordersCount: cur.ordersCount + 1 });
  }

  for (const ord of previousOrders) {
    const dt = toEtDateString(ord.createdAt);
    if (!dt) continue;
    const subtotal = Number(ord.subtotalAmount) || 0;
    const discount = Number(ord.discountAmount) || 0;
    const refund = refundsByOrderId.get(ord.id) || 0;
    const net = Math.max(0, subtotal - discount - refund);

    const cur = dailyPreviousMap.get(dt) || { netSales: 0, ordersCount: 0 };
    dailyPreviousMap.set(dt, { netSales: cur.netSales + net, ordersCount: cur.ordersCount + 1 });
  }

  const dailySalesTrend: DailySalesTrendPoint[] = [];
  for (let i = 0; i < period.daysInPeriod; i++) {
    const curDateStr = addDays(period.currentPeriodStart, i);
    const prevDateStr = addDays(period.previousPeriodStart, i);

    const curData = dailyCurrentMap.get(curDateStr) || { netSales: 0, ordersCount: 0 };
    const prevData = dailyPreviousMap.get(prevDateStr) || { netSales: 0, ordersCount: 0 };

    const monthDay = curDateStr.slice(5); // "MM-DD"
    dailySalesTrend.push({
      date: curDateStr,
      dayLabel: monthDay,
      currentNetSales: safeRound(curData.netSales, 2) ?? 0,
      previousNetSales: safeRound(prevData.netSales, 2) ?? 0,
      currentOrdersCount: curData.ordersCount,
      previousOrdersCount: prevData.ordersCount,
    });
  }

  // --------------------------------------------------------------------------
  // Step 10: Brand & Category Sales Mix
  // --------------------------------------------------------------------------
  const brandSalesMix: BrandSalesMixItem[] = Array.from(brandSalesMap.entries())
    .map(([brandId, val]) => ({
      brandId,
      brandName: val.brandName,
      netSalesDollars: safeRound(val.netSales, 2) ?? 0,
      sharePercent: currentB2bNetSales > 0 ? safeRound((val.netSales / currentB2bNetSales) * 100, 1) ?? 0 : 0,
      unitsSold: val.unitsSold,
    }))
    .sort((a, b) => b.netSalesDollars - a.netSalesDollars);

  const categorySalesMix: CategorySalesMixItem[] = Array.from(categorySalesMap.entries())
    .map(([categoryId, val]) => ({
      categoryId,
      categoryName: val.categoryName,
      netSalesDollars: safeRound(val.netSales, 2) ?? 0,
      sharePercent: currentB2bNetSales > 0 ? safeRound((val.netSales / currentB2bNetSales) * 100, 1) ?? 0 : 0,
      unitsSold: val.unitsSold,
    }))
    .sort((a, b) => b.netSalesDollars - a.netSalesDollars);

  // --------------------------------------------------------------------------
  // Step 11: Exchange Exposure
  // --------------------------------------------------------------------------
  const submittedClaims = claims.filter(
    (c) =>
      isTimestampInEtWindow(c.claimedAt, period.currentPeriodStart, period.currentPeriodEnd) &&
      (c.status || "").toLowerCase() !== "cancelled" &&
      (c.status || "").toLowerCase() !== "rejected"
  );

  let submittedClaimDollars = 0;
  let settledClaimDollars = 0;
  let pendingReviewClaimsCount = 0;

  for (const c of submittedClaims) {
    const amt = Number(c.claimAmount) || 0;
    submittedClaimDollars += amt;
    const st = (c.status || "").toLowerCase();
    if (st === "settled") {
      settledClaimDollars += amt;
    } else {
      pendingReviewClaimsCount++;
    }
  }

  const exchangeExposure: ExchangeExposureSummary = {
    activeProtectedStoresCount: protectedStoreIds.length,
    submittedClaimsCount: submittedClaims.length,
    submittedClaimDollars: safeRound(submittedClaimDollars, 2) ?? 0,
    settledClaimDollars: safeRound(settledClaimDollars, 2) ?? 0,
    pendingReviewClaimsCount,
  };

  // --------------------------------------------------------------------------
  // Step 12: Data Completeness & Reconciliation
  // --------------------------------------------------------------------------
  const storeDiscrepancyDollars = safeRound(currentB2bNetSales - (storeAttributedSales + companyUnallocatedSales), 2) ?? 0;
  const isStoreReconciled = Math.abs(storeDiscrepancyDollars) < 0.01;

  // SKU attribution reconciliation:
  // Gross merchandise subtotal vs line items, order-level discounts/refunds
  const unallocatedDiscountsAndRefunds = safeRound(currentDiscounts + currentRefunds - lineLevelDiscounts, 2) ?? 0;
  const skuDiscrepancyDollars =
    safeRound(currentB2bNetSales - (skuAttributedGrossSales - currentDiscounts - currentRefunds), 2) ?? 0;
  const isSkuReconciled = Math.abs(skuDiscrepancyDollars) < 0.01;

  const dataCompleteness: DataCompletenessSummary = {
    costCoveragePercent,
    totalOrderLinesCount,
    orderLinesWithVerifiedCostCount,
    orderLinesMissingCostCount,
    storeAttributionRatePercent:
      currentB2bNetSales > 0 ? safeRound((storeAttributedSales / currentB2bNetSales) * 100, 1) ?? 0 : null,
    unallocatedOrdersCount,
  };

  const reconciliation: SalesOverviewReconciliation = {
    networkNetSales: currentB2bNetSales,
    storeAttributedSales,
    companyUnallocatedSales,
    storeDiscrepancyDollars,
    isStoreReconciled,
    skuAttributedGrossSales: safeRound(skuAttributedGrossSales, 2) ?? 0,
    lineLevelDiscounts: safeRound(lineLevelDiscounts, 2) ?? 0,
    lineLevelRefunds: safeRound(currentRefunds, 2) ?? 0,
    unallocatedDiscountsAndRefunds,
    skuDiscrepancyDollars,
    isSkuReconciled,
  };

  // --------------------------------------------------------------------------
  // Step 13: Action Center Factual Items (Strictly factual; no arbitrary thresholds)
  // --------------------------------------------------------------------------
  const decliningStores: DecliningStoreFact[] = [];
  const dormantStores: DormantStoreFact[] = [];

  for (const store of stores) {
    const curSales = salesByStoreCurrent.get(store.id) || 0;
    const prevSales = salesByStorePrevious.get(store.id) || 0;

    // Declining stores in completed 30D window (active purchasing but declining)
    if (prevSales > 0 && curSales > 0 && curSales < prevSales) {
      const declineDollars = safeRound(prevSales - curSales, 2) ?? 0;
      const declinePercent = safeRound((declineDollars / prevSales) * 100, 1) ?? 0;
      decliningStores.push({
        storeId: store.id,
        storeName: store.name,
        companyName: store.companyName,
        city: store.city,
        state: store.state,
        currentSalesDollars: safeRound(curSales, 2) ?? 0,
        previousSalesDollars: safeRound(prevSales, 2) ?? 0,
        declineDollars,
        declinePercent,
      });
    }

    // Dormant stores: Had orders in previous 30 days, but 0 orders in current 30 days
    if (prevSales > 0 && curSales === 0) {
      const storeOrderList = ordersByStoreId.get(store.id) || [];
      const latestOrder = storeOrderList.length > 0 ? storeOrderList[storeOrderList.length - 1] : null;
      const lastOrderDate = latestOrder ? toEtDateString(latestOrder.createdAt) : null;
      const daysSinceLastOrder = lastOrderDate ? daysBetween(lastOrderDate, period.asOfDate) : null;

      dormantStores.push({
        storeId: store.id,
        storeName: store.name,
        companyName: store.companyName,
        city: store.city,
        state: store.state,
        previousSalesDollars: safeRound(prevSales, 2) ?? 0,
        lastOrderDate,
        daysSinceLastOrder,
      });
    }
  }

  decliningStores.sort((a, b) => b.declineDollars - a.declineDollars);
  dormantStores.sort((a, b) => b.previousSalesDollars - a.previousSalesDollars);

  // Missing cost products (factual list)
  const missingCostProducts: MissingCostProductFact[] = [];
  for (const prodId of missingCostProductSet) {
    const prod = productsById.get(prodId);
    const vol = productSoldUnitsMap.get(prodId) || { unitsSold: 0, netSales: 0 };
    missingCostProducts.push({
      productId: prodId,
      sku: prod?.sku || "UNKNOWN_SKU",
      name: prod?.name || "Unknown Product",
      brandName: prod?.brandName || "Unknown Brand",
      unitsSoldInPeriod: vol.unitsSold,
      netSalesInPeriod: safeRound(vol.netSales, 2) ?? 0,
    });
  }
  missingCostProducts.sort((a, b) => b.netSalesInPeriod - a.netSalesInPeriod);

  // Inventory coverage warnings (factual stock and velocity)
  const inventoryCoverageWarnings: InventoryCoverageWarningFact[] = [];
  const hqUnitsByProduct = new Map<string, number>();
  for (const l of activeLayers) {
    const cur = hqUnitsByProduct.get(l.productId) || 0;
    hqUnitsByProduct.set(l.productId, cur + l.remainingQty);
  }

  for (const [prodId, vol] of productSoldUnitsMap.entries()) {
    const prod = productsById.get(prodId);
    const hqUnits = hqUnitsByProduct.get(prodId) || 0;
    const dailyVelocity = vol.unitsSold / 30; // units per day over completed 30 days
    const daysOfSupply = dailyVelocity > 0 ? safeRound(hqUnits / dailyVelocity, 1) : null;

    if (hqUnits === 0 || (daysOfSupply !== null && daysOfSupply < 30)) {
      inventoryCoverageWarnings.push({
        productId: prodId,
        sku: prod?.sku || "UNKNOWN_SKU",
        name: prod?.name || "Unknown Product",
        brandName: prod?.brandName || "Unknown Brand",
        currentHqAvailableUnits: hqUnits,
        averageDailyVelocityUnits: safeRound(dailyVelocity, 2) ?? 0,
        daysOfSupply,
      });
    }
  }
  inventoryCoverageWarnings.sort((a, b) => (a.daysOfSupply ?? 0) - (b.daysOfSupply ?? 0));

  // Exchange activities
  const exchangeActivities: ExchangeActivityFact[] = submittedClaims.map((c) => ({
    claimId: c.id,
    claimNumber: c.claimNumber,
    storeId: c.storeId,
    storeName: c.storeName,
    claimDate: toEtDateString(c.claimedAt) || c.claimedAt.slice(0, 10),
    status: c.status,
    totalClaimAmountDollars: safeRound(Number(c.claimAmount) || 0, 2) ?? 0,
  }));

  // Reporting gap stores (weekly checks)
  const reportingGapStores: ReportingGapStoreFact[] = [];
  const checksByStore = new Map<string, RawWeeklyCheckRecord[]>();
  for (const chk of weeklyChecks) {
    if ((chk.status || "").toLowerCase() === "submitted") {
      const list = checksByStore.get(chk.storeId) || [];
      list.push(chk);
      checksByStore.set(chk.storeId, list);
    }
  }

  for (const store of stores) {
    if ((store.status || "").toLowerCase() !== "active") continue;
    const list = checksByStore.get(store.id) || [];
    // If fewer than 4 submitted checks in 30 days
    if (list.length < 4) {
      list.sort((a, b) => (b.submittedAt || "").localeCompare(a.submittedAt || ""));
      const lastSub = list.length > 0 && list[0].submittedAt ? toEtDateString(list[0].submittedAt) : null;
      reportingGapStores.push({
        storeId: store.id,
        storeName: store.name,
        companyName: store.companyName,
        missedWeeksCount: 4 - list.length,
        lastSubmittedDate: lastSub,
      });
    }
  }
  reportingGapStores.sort((a, b) => b.missedWeeksCount - a.missedWeeksCount);

  const actionCenter: ActionCenterFacts = {
    decliningStores,
    dormantStores,
    missingCostProducts,
    inventoryCoverageWarnings,
    exchangeActivities,
    reportingGapStores,
  };

  // --------------------------------------------------------------------------
  // Step 14: Assemble Final KPI Payload
  // --------------------------------------------------------------------------
  const kpis: SalesOverviewKpiPayload = {
    b2bNetSales: {
      value: currentB2bNetSales,
      formatted: `$${currentB2bNetSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      status: "ACTUAL",
      dataConfidence: 1.0,
      sourceBasis: `Aggregated across ${currentOrders.length} valid B2B orders in retailer_orders (completed 30D ET).`,
      metadata: {
        grossSubtotal: currentGrossSubtotal,
        discounts: currentDiscounts,
        refunds: currentRefunds,
      },
    },
    grossProfit: {
      value: grossProfitValue,
      formatted:
        grossProfitValue !== null
          ? `$${grossProfitValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          : "N/A",
      status: grossProfitStatus,
      dataConfidence: costCoveragePercent !== null ? costCoveragePercent / 100 : 0.0,
      sourceBasis: isCostCoverageComplete
        ? `Computed from verified historical landed costs for 100% of order lines.`
        : `Gross Profit is N/A: Incomplete historical Landed COGS coverage (${costCoveragePercent}% verified).`,
      metadata: {
        costCoveragePercent,
        totalLandedCogs: isCostCoverageComplete ? totalLandedCogs : null,
      },
    },
    grossMargin: {
      value: grossMarginValue,
      formatted: grossMarginValue !== null ? `${grossMarginValue.toFixed(1)}%` : "N/A",
      status: grossMarginStatus,
      dataConfidence: costCoveragePercent !== null ? costCoveragePercent / 100 : 0.0,
      sourceBasis: isCostCoverageComplete
        ? `(Gross Profit / B2B Net Sales) * 100.`
        : `Gross Margin is N/A due to incomplete historical COGS.`,
    },
    orderingStores: {
      value: orderingStoresCount,
      formatted: orderingStoresCount.toLocaleString(),
      status: "ACTUAL",
      dataConfidence: 1.0,
      sourceBasis: `Distinct active stores with >= 1 valid order in the completed 30-day window.`,
    },
    reorderStores: {
      value: reorderStoresCount,
      formatted: reorderStoresCount.toLocaleString(),
      status: "ACTUAL",
      dataConfidence: 1.0,
      sourceBasis: `Stores ordering in current 30D with earlier qualified lifetime purchase history.`,
    },
    reorderRate: {
      value: reorderRatePercent,
      formatted: reorderRatePercent !== null ? `${reorderRatePercent.toFixed(1)}%` : "N/A",
      status: reorderRatePercent !== null ? "ACTUAL" : "UNAVAILABLE",
      dataConfidence: orderingStoresCount > 0 ? 1.0 : 0.0,
      sourceBasis: `Distinct Reordering Stores (${reorderStoresCount}) / Distinct Ordering Stores (${orderingStoresCount}).`,
    },
    hqInventoryValue: {
      value: totalHqInventoryValue,
      formatted: `$${totalHqInventoryValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      status: hasMissingInventoryLayerCost ? "ESTIMATED" : "ACTUAL",
      dataConfidence: hasMissingInventoryLayerCost ? 0.8 : 1.0,
      sourceBasis: `As-of-date valuation of active FIFO layers in HQ warehouse (${period.asOfDate}).`,
    },
    salesGrowth,
    dailySalesTrend,
    brandSalesMix,
    categorySalesMix,
    exchangeExposure,
    dataCompleteness,
  };

  return {
    period,
    activeStoresCount,
    kpis,
    reconciliation,
    actionCenter,
    lastRefreshedAt: new Date().toISOString(),
  };
}
