/**
 * Retailer Performance Domain & API Types
 * Task ID: ADM-SALES-PERF-002
 * Location: lib/retailer/sales-performance/performance-types.ts
 */

export type StoreEvaluationStatus = "new" | "not_rated" | "graded";
export type PerformanceGrade = "A" | "B" | "C" | null;

export type SupportStatus = "healthy" | "monitor" | "support_required" | "action_required";
export type DataConfidence = "high" | "partial" | "insufficient";

export type DisplayComplianceStatus = "compliant" | "violation" | "not_verified";
export type WeeklyInventoryComplianceStatus = "compliant" | "partial" | "non_compliant" | "not_verified";
export type ProductTrainingComplianceStatus = "compliant" | "partial" | "non_compliant" | "not_verified";

export type HqFollowUpStatus = "on_track" | "attention" | "action_required" | "data_review";

export type RecommendedProgramType =
  | "new_store_onboarding"
  | "growth_expansion"
  | "sales_improvement"
  | "follow_up_recovery"
  | "inventory_reporting_recovery"
  | "training_support"
  | "display_compliance_review";

export interface EvaluationPeriod {
  timezone: string; // "America/New_York"
  asOfDate: string; // ISO date string YYYY-MM-DD
  currentPeriodStart: string; // T - 60 days (inclusive)
  currentPeriodEnd: string; // T (exclusive)
  previousPeriodStart: string; // T - 120 days (inclusive)
  previousPeriodEnd: string; // T - 60 days (exclusive)
}

export interface StoreSalesMetrics {
  currentNetSalesDollars: number;
  previousNetSalesDollars: number;
  salesGrowthPercent: number | null; // null if previous === 0
  salesGrowthLabel: string; // e.g. "+15.2%", "-8.4%", "New Revenue", "N/A"
  currentValidOrdersCount: number;
  previousValidOrdersCount: number;
  confirmedReordersCount: number; // Orders beyond the store's initial lifetime order
  grossSubtotalDollars: number;
  discountsDollars: number;
  refundsDollars: number;
  firstShipmentDate: string | null;
  storeAgeDays: number;
  isNewStore: boolean; // storeAgeDays < 60 days
}

export interface StoreComplianceMetrics {
  display: {
    status: DisplayComplianceStatus;
    fixturesCount: number;
    placementsCount: number;
    lastInspectedDate: string | null;
    evidenceNotes: string | null;
  };
  weeklyInventory: {
    status: WeeklyInventoryComplianceStatus;
    eligibleWeeksCount: number;
    submittedWeeksCount: number;
    reportingCoveragePercent: number | null;
    missedWeeksCount: number;
    lastSubmittedDate: string | null;
    latestReportingWeek: string | null;
  };
  productTraining: {
    status: ProductTrainingComplianceStatus;
    purchasedProductsCount: number;
    coveredProductsCount: number;
    trainingGapsCount: number;
    coveragePercent: number | null;
    assignedStaffCount: number;
    qualifiedStaffCount: number;
  };
}

export interface StoreFollowUpMetrics {
  status: HqFollowUpStatus;
  totalActivitiesCount: number;
  lastActivityDate: string | null;
  lastActivityType: string | null;
  lastResponsibleAdmin: string | null;
  hasPendingFollowUp: boolean;
  nextFollowUpDate: string | null;
  isFollowUpOverdue: boolean;
  overdueDays: number;
}

export interface RecommendedSupportProgram {
  programType: RecommendedProgramType;
  title: string;
  priority: "high" | "medium" | "low";
  reason: string;
  triggerMetric: string;
  suggestedAction: string;
  targetActivityType: string;
}

export interface StorePerformanceRecord {
  storeId: string;
  storeName: string;
  storeCode: string | null;
  companyId: string;
  companyName: string;
  companyCode: string | null;
  city: string | null;
  state: string | null;
  status: "active" | "inactive" | "closed" | string;
  createdAt: string;

  evaluationStatus: StoreEvaluationStatus;
  performanceGrade: PerformanceGrade;
  gradeReason: string;

  supportStatus: SupportStatus;
  dataConfidence: DataConfidence;

  sales: StoreSalesMetrics;
  compliance: StoreComplianceMetrics;
  followUp: StoreFollowUpMetrics;
  recommendedPrograms: RecommendedSupportProgram[];
}

export interface UnallocatedCompanyOrder {
  orderId: string;
  orderNumber: string;
  companyId: string;
  orderStatus: string;
  paymentStatus: string;
  subtotalAmount: number;
  discountAmount: number;
  totalAmount: number;
  createdAt: string;
}

export interface CompanyPerformanceRecord {
  companyId: string;
  companyName: string;
  companyCode: string | null;
  storesCount: number;
  activeStoresCount: number;

  totalNetSalesDollars: number;
  allocatedStoreSalesDollars: number;
  unallocatedSalesDollars: number;
  unallocatedOrdersCount: number;
  unallocatedOrders: UnallocatedCompanyOrder[];

  totalValidOrdersCount: number;
  supportRequiredStoresCount: number;
  actionRequiredStoresCount: number;

  stores: StorePerformanceRecord[];
}

export interface PerformanceKpiSummary {
  totalNetSalesDollars: number;
  previousNetSalesDollars: number;
  salesGrowthPercent: number | null;
  salesGrowthLabel: string;

  totalActiveStoresCount: number;
  supportRequiredStoresCount: number; // Distinct stores
  hqFollowUpGapsCount: number; // Distinct stores with Action Required or Attention

  evaluationPeriod: EvaluationPeriod;
  lastRefreshedAt: string;
}

export interface RetailerPerformanceOverview {
  kpis: PerformanceKpiSummary;
  stores: StorePerformanceRecord[];
  companies: CompanyPerformanceRecord[];
  isTestModeActive: boolean;
}

export interface PerformanceFilterOptions {
  companyId?: string;
  state?: string;
  grade?: string; // "A" | "B" | "C" | "new" | "not_rated" | "all"
  supportStatus?: string; // "healthy" | "support_required" | "action_required" | "all"
  searchQuery?: string;
  includeTestOrders?: boolean;
}
