/**
 * Product Performance V2.0 — Domain Types & KPI Result Contract
 * Task ID: ADM-SALES-PERF-003-R1
 * Location: lib/product/performance/types.ts
 */

import type { SkuDataReadiness } from "./sku-readiness";

export type KpiStatus = "ACTUAL" | "ESTIMATED" | "PARTIAL" | "UNAVAILABLE";
export type KpiUnit = "USD" | "PERCENT" | "DAYS" | "UNITS" | "COUNT" | "RATIO";

/**
 * Authoritative Shared Result Contract for all Product Performance KPIs.
 */
export interface KpiResult<T = number> {
  value: T | null;
  unit: KpiUnit;
  period: {
    start: string; // ISO date YYYY-MM-DD
    end: string;   // ISO date YYYY-MM-DD
  };
  status: KpiStatus;
  dataConfidence: number; // 0.0 to 1.0
  sourceBasis: string;    // Human-readable source explanation
  missingInputReason?: string; // e.g. "Missing landed cost record"
  metadata?: Record<string, any>;
}

export interface EvaluationPeriod {
  timezone: string; // "America/New_York"
  asOfDate: string; // YYYY-MM-DD
  periodStart: string; // YYYY-MM-DD (inclusive)
  periodEnd: string;   // YYYY-MM-DD (inclusive)
  daysInPeriod: number;
}

// -------------------------------------------------------------
// 1. FINANCIAL ENGINE TYPES
// -------------------------------------------------------------

export interface FinancialOrderLine {
  id: string; // unique line item id
  order_id: string;
  order_number?: string;
  product_id: string;
  sku: string;
  order_date: string; // YYYY-MM-DD
  order_status: "PENDING" | "PAID" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED" | "REFUNDED" | string;
  ordered_qty: number;
  shipped_qty: number;
  unit_price: number; // wholesale price per unit
  merchandise_discount?: number; // promotional discount on merchandise
  shipping_fee_allocated?: number; // outbound shipping fee (excluded from merchandise sales)
  tax_allocated?: number; // sales tax (excluded from merchandise sales)
  refunded_qty?: number;
  refunded_amount?: number; // merchandise refund amount
  credit_redeemed_allocated?: number; // exchange credit settlement (does NOT reduce sales)
  fulfillment_id?: string | null;
}

export interface LandedCostRecord {
  product_id: string;
  effective_date: string; // YYYY-MM-DD
  unit_landed_cost: number;
  cost_status: "FINAL" | "ESTIMATED" | "OVERRIDE" | "FALLBACK";
  source: "landed_cost_results" | "inventory_cost_layers" | "override_landed_cost" | "manual";
  freight_cost_per_unit?: number;
  duty_cost_per_unit?: number;
  supplier_cost_per_unit?: number;
}

export interface ProductCostMaster {
  product_id: string;
  sku: string;
  override_landed_cost?: number | null;
  override_effective_date?: string | null; // ISO YYYY-MM-DD when override became effective
  override_reason?: string | null;
  base_wholesale_price?: number | null;
}

export interface FinancialEngineInput {
  period: EvaluationPeriod;
  product_id: string;
  orderLines: FinancialOrderLine[];
  costRecords: LandedCostRecord[];
  costMaster?: ProductCostMaster;
}

export interface FinancialKpis {
  b2bNetSales: KpiResult<number>;
  landedCogs: KpiResult<number>;
  grossProfit: KpiResult<number>;
  grossMargin: KpiResult<number>;
  totalUnitsSold: KpiResult<number>;
  refundedAmount: KpiResult<number>;
  merchandiseDiscountAmount: KpiResult<number>;
  creditSettlementAmount: KpiResult<number>;
}

// -------------------------------------------------------------
// 2. INVENTORY ENGINE TYPES
// -------------------------------------------------------------

export interface FifoInventoryLayer {
  id: string;
  product_id: string;
  warehouse_id: string;
  received_date: string; // YYYY-MM-DD
  original_qty: number;
  remaining_qty: number;
  unit_landed_cost: number;
  status: "ACTIVE" | "DEPLETED" | "ON_HOLD" | string;
}

export interface HqInventorySnapshot {
  date: string; // YYYY-MM-DD
  qty_on_hand: number;
  qty_available: number;
  qty_hold: number;
  valuation_usd?: number | null;
}

export interface InventoryEngineInput {
  period: EvaluationPeriod;
  product_id: string;
  activeLayers: FifoInventoryLayer[];
  historicalSnapshots?: HqInventorySnapshot[];
  currentAvailableUnits?: number | null;
  periodLandedCogs?: number | null;
  periodGrossProfit?: number | null;
  dailyShipmentVelocity?: number | null;
  fallbackUnitLandedCost?: number | null;
}

export interface InventoryAgingBracket {
  label: string; // e.g. "0-30 days", "31-60 days", "61-90 days", "91-120 days", "121+ days"
  minDays: number;
  maxDays: number | null;
  units: number;
  valueUsd: number;
  percentOfTotalUnits: number;
}

export interface InventoryAgingProfile {
  weightedAverageAgeDays: number | null;
  brackets: InventoryAgingBracket[];
  oldestLayerAgeDays: number | null;
  newestLayerAgeDays: number | null;
}

export interface InventoryKpis {
  hqInventoryValue: KpiResult<number>;
  hqAvailableUnits: KpiResult<number>;
  averageInventoryValue: KpiResult<number>;
  fifoInventoryAging: KpiResult<InventoryAgingProfile>;
  inventoryTurnover: KpiResult<number>;
  dioDays: KpiResult<number>;
  daysOfSupply: KpiResult<number>;
  gmroi: KpiResult<number>;
}

// -------------------------------------------------------------
// 3. VELOCITY ENGINE TYPES
// -------------------------------------------------------------

export interface RetailerWeeklyReportLine {
  id: string;
  report_id: string;
  store_id: string;
  product_id: string;
  week_start_date: string; // YYYY-MM-DD
  week_end_date: string;   // YYYY-MM-DD
  beginning_stock?: number | null;
  received_units?: number | null; // replenishment
  sales_units?: number | null;    // estimated/reported retail sales
  ending_stock?: number | null;
}

export interface StoreCoverageTarget {
  store_id: string;
  is_active: boolean;
  carries_sku: boolean;
}

export interface VelocityEngineInput {
  period: EvaluationPeriod;
  product_id: string;
  orderLines: FinancialOrderLine[];
  weeklyReports: RetailerWeeklyReportLine[];
  storesTarget?: StoreCoverageTarget[];
}

export interface ReportingQualification {
  expectedReportsCount: number;
  actualReportsCount: number;
  complianceRate: number; // 0.0 to 1.0
  missingWeeksCount: number;
  reportingStoresCount: number;
  totalTargetStoresCount: number;
}

export interface VelocityKpis {
  b2bShipmentVelocityDaily: KpiResult<number>;
  b2bShipmentVelocityWeekly: KpiResult<number>;
  estimatedRetailerSellThroughUnits: KpiResult<number>;
  estimatedRetailerSellThroughWeeklyRate: KpiResult<number>;
  reportingQualification: KpiResult<ReportingQualification>;
  replenishmentAdjustmentUnits: KpiResult<number>;
  weeklyReportsCount?: KpiResult<number>;
}

// -------------------------------------------------------------
// 4. EXCHANGE FREQUENCY ENGINE TYPES
// -------------------------------------------------------------

export type ClaimLifecycleStatus =
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "APPROVED_OPTION_A"
  | "APPROVED_OPTION_B"
  | "RMA_INSPECTED"
  | "SETTLED"
  | "REJECTED"
  | "CANCELLED";

export interface ExchangeClaimRecord {
  id: string; // unique claim line id
  claim_id: string;
  company_id: string;
  store_id: string;
  product_id: string;
  cohort_id: string;
  claim_date: string; // YYYY-MM-DD
  status: ClaimLifecycleStatus;
  requested_units: number;
  approved_units?: number | null;
  settled_units?: number | null;
  unit_wholesale_price: number;
  claimed_dollar_value: number;
  settled_credit_amount?: number | null;
  rma_id?: string | null;
}

export interface StoreCohortEligibilityRecord {
  store_id: string;
  product_id: string;
  cohort_id: string;
  cohort_date: string; // YYYY-MM-DD (Order / fulfillment date)
  initial_order_date?: string; // YYYY-MM-DD
  protection_end_date?: string; // YYYY-MM-DD (Day 90: end of active protection window)
  claim_eligibility_date?: string; // YYYY-MM-DD (Day 100: maturity date when claim submission opens)
  is_eligible?: boolean; // legacy compatibility: alias for is_matured_day_100
  is_matured_day_100?: boolean; // reached Day 100 on or before periodEnd
  is_in_active_protection_window?: boolean; // currently within Day 1-90 window
  cohort_units: number;
}

export interface ExchangeFrequencyInput {
  period: EvaluationPeriod;
  product_id: string;
  claimRecords: ExchangeClaimRecord[];
  eligibilityRecords: StoreCohortEligibilityRecord[];
}

export interface ExposureStatusBreakdown {
  status: ClaimLifecycleStatus;
  claimsCount: number;
  units: number;
  dollarValue: number;
}

export interface ExchangeFrequencyKpis {
  uniqueClaimingStoreCount: KpiResult<number>;
  eligibleStoreCohortCount: KpiResult<number>; // Matured Day-100 cohort stores in evaluation period
  claimingStoreRate: KpiResult<number>; // uniqueClaimingStoreCount / eligibleStoreCohortCount
  protectedStoresCount: KpiResult<number>; // Distinct stores in active 90-day protection window
  totalClaimRequestedUnits: KpiResult<number>;
  totalClaimDollarValue: KpiResult<number>;
  exposureByStatus: KpiResult<ExposureStatusBreakdown[]>;
}

// -------------------------------------------------------------
// 5. MASTER PRODUCT PERFORMANCE RESULT
// -------------------------------------------------------------

export interface ProductPerformanceKpis {
  product_id: string;
  period: EvaluationPeriod;
  financial: FinancialKpis;
  inventory: InventoryKpis;
  velocity: VelocityKpis;
  exchange: ExchangeFrequencyKpis;
  asOfTimestamp: string;
}

// -------------------------------------------------------------
// 6. CANONICAL DATABASE ROW SCHEMAS (READ-ONLY ADAPTER CONTRACTS)
// -------------------------------------------------------------

export interface RawDbProduct {
  id: string;
  name: string;
  name_en?: string | null;
  letusto_sku?: string | null;
  parent_sku?: string | null;
  child_sku?: string | null;
  manufacture_sku?: string | null;
  brand_id?: string | null;
  category?: string | null;
  category_code?: string | null;
  status?: string | null;
  created_at: string;
  first_shipment_date?: string | null;
  override_landed_cost?: number | null;
  override_landed_cost_updated_at?: string | null;
  override_landed_cost_reason?: string | null;
  price_usd_fob?: number | null;
  price_krw_wholesale?: number | null;
  brands?: {
    id: string;
    name: string;
    name_ko?: string | null;
  } | null;
  categories?: {
    id: string;
    name: string;
    code?: string | null;
  } | null;
}

export interface RawDbLandedCostResult {
  id: string;
  product_id: string;
  received_date: string;
  inventory_received_qty?: number;
  unit_landed_cost: number | string;
  cost_status: "FINAL" | "PROVISIONAL" | string;
  supplier_acquisition_cost?: number | string;
  freight_cost?: number | string;
  duty_cost?: number | string;
  total_landed_cost?: number | string;
  calculated_at?: string;
}

export interface RawDbInventoryCostLayer {
  id: string;
  product_id: string;
  warehouse_id: string;
  received_date: string;
  original_qty: number;
  remaining_qty: number;
  unit_landed_cost: number | string;
  original_total_cost?: number | string;
  status: "ACTIVE" | "EXHAUSTED" | string;
  created_at?: string;
  updated_at?: string;
}

export interface RawDbInventoryBalance {
  id?: string;
  product_id: string;
  warehouse_id: string;
  qty_on_hand: number;
  qty_hold: number;
  qty_damaged?: number | null;
  updated_at?: string;
}

export interface RawDbRetailerOrder {
  id: string;
  order_number: string;
  company_id: string;
  store_id: string;
  order_status: string;
  payment_status?: string | null;
  subtotal_amount: number | string;
  discount_amount?: number | string | null;
  shipping_amount?: number | string | null;
  tax_amount?: number | string | null;
  total_amount: number | string;
  is_test?: boolean;
  created_at: string;
}

export interface RawDbRetailerOrderItem {
  id: string;
  order_id: string;
  product_id: string;
  sku: string;
  product_name?: string;
  brand_name?: string;
  unit_wholesale_price: number | string;
  quantity: number;
  line_total: number | string;
  created_at?: string;
}

export interface RawDbRetailerOrderFulfillment {
  id: string;
  order_id: string;
  store_id: string;
  status: "pending" | "processing" | "shipped" | "delivered" | "cancelled" | string;
  shipped_at?: string | null;
  delivered_at?: string | null;
  created_at?: string;
}

export interface RawDbRetailerOrderFulfillmentItem {
  id: string;
  fulfillment_id: string;
  order_item_id: string;
  product_id: string;
  quantity_shipped: number;
  quantity_delivered?: number;
}

export interface RawDbRetailerOrderRefundRecord {
  id: string;
  order_id: string;
  company_id: string;
  merchandise_amount: number | string;
  tax_amount?: number | string;
  total_refund_amount: number | string;
  refund_status: "due" | "approved" | "processing" | "completed" | "failed" | string;
  created_at?: string;
}

export interface RawDbRetailerWeeklyCheck {
  id: string;
  company_id: string;
  store_id: string;
  reporting_week: string;
  report_date: string;
  status: "draft" | "submitted" | "cancelled" | string;
  is_test?: boolean;
  submitted_at?: string | null;
  created_at?: string;
}

export interface RawDbRetailerWeeklyCheckItem {
  id: string;
  check_id: string;
  product_id: string;
  reported_remaining_qty: number;
  previous_reported_qty?: number | null;
  delivered_since_previous?: number | null;
  estimated_movement?: number | null;
  is_counted?: boolean;
}

export interface RawDbRetailerExchangeClaim {
  id: string;
  claim_number: string;
  company_id: string;
  store_id: string;
  status: string;
  total_units_count: number;
  total_estimated_credit?: number | string;
  created_at: string;
  submitted_at?: string | null;
}

export interface RawDbRetailerExchangeClaimItem {
  id: string;
  claim_id: string;
  cohort_id: string;
  product_id: string;
  store_id: string;
  company_id: string;
  selected_option: "A" | "B" | string;
  selected_quantity: number;
  frozen_unit_wholesale_price: number | string;
  final_credit_amount?: number | string | null;
  status: string;
  created_at: string;
}

export interface RawDbRetailerProtectedSupplyCohort {
  id: string;
  cohort_code: string;
  company_id: string;
  store_id: string;
  product_id: string;
  source_order_id: string;
  total_protected_quantity: number;
  status: string;
  first_shipment_date?: string | null;
  trial_end_date?: string | null;
  evaluation_date?: string | null;
  claim_deadline_date?: string | null;
  created_at: string;
}

export interface RawDbStore {
  id: string;
  name: string;
  store_code?: string | null;
  status: string;
  company_id: string;
}

export interface RawDbRetailerStoreProduct {
  store_id: string;
  product_id: string;
  company_id?: string;
  is_active: boolean;
}

// -------------------------------------------------------------
// 7. QUERY LAYER & SUMMARY MODELS
// -------------------------------------------------------------

export interface ProductPerformanceQueryOptions {
  productId?: string;
  productIds?: string[];
  brandId?: string;
  categoryId?: string;
  searchQuery?: string;
  readinessFilter?: string;
  sortBy?: "sales" | "profit" | "inventory" | "confidence" | "name";
  sortOrder?: "asc" | "desc";
  asOfDate?: string; // YYYY-MM-DD (defaults to today ET)
  lookbackDays?: number; // defaults to 60 days
  timezone?: string; // defaults to "America/New_York"
  includeTestOrders?: boolean; // defaults to false
  page?: number;
  pageSize?: number;
  isRetailerView?: boolean; // if true, confidential cost/COGS/margins are omitted
}

export interface GradeReadinessSummary {
  isEligible: boolean;
  evaluationStatus: "NEW" | "NOT_RATED" | "GRADED";
  ineligibilityReason?: string;
  allReasons: string[];
  metrics: {
    operatingHistoryDays: number;
    completedOrdersCount: number;
    distinctStoresCount: number;
    hasHistoricalCost: boolean;
  };
  policyGate: {
    automaticGradingEnabled: boolean;
    note: string;
  };
}

export interface ProductPerformanceSummary {
  productId: string;
  sku: string;
  productName: string;
  productNameEn?: string | null;
  imageUrl?: string | null;
  manufactureSku?: string | null;
  brand: {
    id: string;
    name: string;
  };
  category: {
    id?: string | null;
    name: string;
    code?: string | null;
  };
  status: string;
  createdAt: string;
  kpis: ProductPerformanceKpis;
  gradeReadiness: GradeReadinessSummary;
  dataReadiness?: SkuDataReadiness;
  overallDataConfidence: number; // 0.0 - 1.0 aggregate
  riskFlags: string[];
}

export interface ProductPerformanceKpiSummary {
  totalB2bNetSales: number;
  totalGrossProfit: number | null;
  aggregateGrossMargin: number | null;
  totalHqInventoryValue: number | null;
  totalAvailableUnits: number;
  uniqueExchangeClaimingStores: number;
  productsNeedingAction: "POLICY PENDING" | "N/A";
  hasMissingCostProvenance: boolean;
  hasMissingInventoryCost: boolean;
}

export interface ProductPerformanceQueryResult {
  items: ProductPerformanceSummary[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  period: EvaluationPeriod;
  benchmarkMs: number;
  kpiSummary?: ProductPerformanceKpiSummary;
}

