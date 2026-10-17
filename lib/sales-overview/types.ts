/**
 * Sales Overview V1.0 — Domain & KPI Types
 * Task ID: ADM-SALES-PERF-004-R1
 * Location: lib/sales-overview/types.ts
 *
 * OWNER-APPROVED SPECIFICATIONS:
 * - Scope: K SELECT Retail Network only (retailer_orders where is_test = false)
 * - Evaluation Period: Completed 30 calendar days in America/New_York [T-30, T)
 * - Comparison: Preceding equal-length 30 calendar days [T-60, T-30)
 * - Read-only operations, zero DB mutations.
 * - Single Source of Truth (SSOT): Reuses Product Performance and Store Performance engines.
 */

export interface SalesOverviewPeriod {
  timezone: string; // "America/New_York"
  asOfDate: string; // ISO date string YYYY-MM-DD
  currentPeriodStart: string; // T - 30 days (inclusive)
  currentPeriodEnd: string; // T (exclusive, completed days only)
  previousPeriodStart: string; // T - 60 days (inclusive)
  previousPeriodEnd: string; // T - 30 days (exclusive)
  daysInPeriod: number; // 30
}

export type KpiDataStatus = "ACTUAL" | "ESTIMATED" | "UNAVAILABLE";

export interface KpiMetric<T> {
  value: T | null;
  formatted: string;
  status: KpiDataStatus;
  dataConfidence: number; // 0.0 to 1.0
  sourceBasis: string;
  metadata?: Record<string, unknown>;
}

export interface DailySalesTrendPoint {
  date: string; // YYYY-MM-DD
  dayLabel: string; // e.g. "Oct 01"
  currentNetSales: number;
  previousNetSales: number;
  currentOrdersCount: number;
  previousOrdersCount: number;
}

export interface BrandSalesMixItem {
  brandId: string;
  brandName: string;
  netSalesDollars: number;
  sharePercent: number; // 0.0 to 100.0
  unitsSold: number;
}

export interface CategorySalesMixItem {
  categoryId: string;
  categoryName: string;
  netSalesDollars: number;
  sharePercent: number; // 0.0 to 100.0
  unitsSold: number;
}

export interface SalesGrowthMetric {
  percent: number | null; // null if previous period === 0
  label: string; // "+14.2%", "-8.5%", "New Revenue", "N/A"
  currentSales: number;
  previousSales: number;
}

export interface ExchangeExposureSummary {
  activeProtectedStoresCount: number;
  submittedClaimsCount: number;
  submittedClaimDollars: number;
  settledClaimDollars: number;
  pendingReviewClaimsCount: number;
}

export interface DataCompletenessSummary {
  costCoveragePercent: number | null; // % of B2B Net Sales with verified historical Landed COGS
  totalOrderLinesCount: number;
  orderLinesWithVerifiedCostCount: number;
  orderLinesMissingCostCount: number;
  storeAttributionRatePercent: number; // % of orders attributed to stores vs unallocated
  unallocatedOrdersCount: number;
}

export interface SalesOverviewReconciliation {
  networkNetSales: number;
  storeAttributedSales: number;
  companyUnallocatedSales: number;
  storeDiscrepancyDollars: number; // networkNetSales - (storeAttributed + companyUnallocated)
  isStoreReconciled: boolean;

  skuAttributedGrossSales: number;
  lineLevelDiscounts: number;
  lineLevelRefunds: number;
  unallocatedDiscountsAndRefunds: number;
  skuDiscrepancyDollars: number;
  isSkuReconciled: boolean;
}

// ----------------------------------------------------------------------------
// Action Center Factual Items (Strictly factual; no arbitrary thresholds)
// ----------------------------------------------------------------------------

export interface DecliningStoreFact {
  storeId: string;
  storeName: string;
  companyName: string;
  city: string | null;
  state: string | null;
  currentSalesDollars: number;
  previousSalesDollars: number;
  declineDollars: number;
  declinePercent: number;
}

export interface DormantStoreFact {
  storeId: string;
  storeName: string;
  companyName: string;
  city: string | null;
  state: string | null;
  previousSalesDollars: number;
  lastOrderDate: string | null;
  daysSinceLastOrder: number | null;
}

export interface MissingCostProductFact {
  productId: string;
  sku: string;
  name: string;
  brandName: string;
  unitsSoldInPeriod: number;
  netSalesInPeriod: number;
}

export interface InventoryCoverageWarningFact {
  productId: string;
  sku: string;
  name: string;
  brandName: string;
  currentHqAvailableUnits: number;
  averageDailyVelocityUnits: number;
  daysOfSupply: number | null;
}

export interface ExchangeActivityFact {
  claimId: string;
  claimNumber: string;
  storeId: string;
  storeName: string;
  claimDate: string;
  status: string;
  totalClaimAmountDollars: number;
}

export interface ReportingGapStoreFact {
  storeId: string;
  storeName: string;
  companyName: string;
  missedWeeksCount: number;
  lastSubmittedDate: string | null;
}

export interface ActionCenterFacts {
  decliningStores: DecliningStoreFact[];
  dormantStores: DormantStoreFact[];
  missingCostProducts: MissingCostProductFact[];
  inventoryCoverageWarnings: InventoryCoverageWarningFact[];
  exchangeActivities: ExchangeActivityFact[];
  reportingGapStores: ReportingGapStoreFact[];
}

// ----------------------------------------------------------------------------
// Master Overview Dashboard Payload
// ----------------------------------------------------------------------------

export interface SalesOverviewKpiPayload {
  b2bNetSales: KpiMetric<number>;
  grossProfit: KpiMetric<number>;
  grossMargin: KpiMetric<number>;
  orderingStores: KpiMetric<number>;
  reorderStores: KpiMetric<number>;
  reorderRate: KpiMetric<number>;
  hqInventoryValue: KpiMetric<number>;
  salesGrowth: SalesGrowthMetric;
  dailySalesTrend: DailySalesTrendPoint[];
  brandSalesMix: BrandSalesMixItem[];
  categorySalesMix: CategorySalesMixItem[];
  exchangeExposure: ExchangeExposureSummary;
  dataCompleteness: DataCompletenessSummary;
}

export interface SalesOverviewDashboardData {
  period: SalesOverviewPeriod;
  activeStoresCount: number; // Kept distinct from orderingStores
  kpis: SalesOverviewKpiPayload;
  reconciliation: SalesOverviewReconciliation;
  actionCenter: ActionCenterFacts;
  lastRefreshedAt: string;
}
