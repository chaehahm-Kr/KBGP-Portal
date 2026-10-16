export type CompanyEnrollmentStatus = "active" | "paused" | "terminated";

export type ProtectedCohortStatus =
  | "registered"
  | "partially_fulfilled"
  | "active_protection"
  | "evaluation_ready"
  | "claim_window_open"
  | "claim_submitted"
  | "claim_resolved"
  | "disqualified_reordered"
  | "disqualified_insufficient_checks"
  | "disqualified_high_sales"
  | "expired_unclaimed"
  | "cancelled";

export interface CompanyExchangeEnrollment {
  id: string;
  companyId: string;
  companyName: string;
  companyCode: string | null;
  status: CompanyEnrollmentStatus;
  
  // Option A is configurable per company (20% to 50%, default: 40%)
  optionACreditRate: number;
  
  // Option B is fixed at 100% of original wholesale unit cost for resaleable returned units
  optionBCreditRate: 1.0;
  
  // Fixed Pilot Program Conditions (Non-editable per company)
  minInventoryReportingWeeks: 8;
  trialPeriodDays: 90;
  evaluationDay: 100;
  claimWindowDays: 50;
  maxSellThroughRate: 0.5;
  reorderDisqualifies: true;

  enrolledBy: string;
  enrolledByName?: string;
  enrolledAt: string;
  effectiveDate: string;
  pausedAt: string | null;
  pausedBy: string | null;
  pauseReason: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  
  // Summary counters
  activeCohortsCount?: number;
  totalProtectedValue?: number;
}

export interface EnrollmentAuditLog {
  id: string;
  enrollmentId: string;
  companyId: string;
  action: "enroll" | "update_policy" | "pause" | "resume" | "terminate";
  changedBy: string;
  changedByName?: string;
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown>;
  reason: string;
  createdAt: string;
}

export interface ProtectedSupplyShipment {
  id: string;
  cohortId: string;
  fulfillmentId: string;
  fulfillmentNumber: string;
  fulfillmentItemId: string | null;
  shipmentSequence: number;
  quantityShipped: number;
  quantityDelivered: number;
  shippedAt: string;
  deliveredAt: string | null;
  trackingNumber: string | null;
  carrier: string | null;
  isFirstShipment: boolean;
  notes: string | null;
  createdAt: string;
}

export interface ProtectedSupplyCohort {
  id: string;
  cohortCode: string;
  companyId: string;
  companyName: string;
  storeId: string;
  storeName: string;
  storeCode: string | null;
  productId: string;
  productName: string;
  productSku: string;
  productThumbnailUrl: string | null;
  enrollmentId: string;
  sourceOrderId: string;
  sourceOrderNumber: string;
  sourceOrderItemId: string;

  // Frozen metrics (Permanent financial baseline)
  totalProtectedQuantity: number;
  fulfilledProtectedQuantity: number;
  frozenUnitWholesalePrice: number;
  frozenOptionARate: number; // 0.20 to 0.50
  frozenOptionBRate: 1.0; // Fixed 100%
  frozenMinReportingWeeks: 8;
  frozenMaxSellThroughRate: 0.5;

  status: ProtectedCohortStatus;
  statusLabel: string;

  // Key Dates (Day 0 = first actual Letusto shipment date; Timezone: America/New_York)
  firstShipmentDate: string | null; // Day 0
  trialEndDate: string | null;      // Day 0 + 90 days
  evaluationDate: string | null;    // Day 0 + 100 days
  claimDeadlineDate: string | null; // Day 0 + 150 days

  // Disqualification details
  disqualificationReason: string | null;
  disqualifiedAt: string | null;
  disqualifiedByOrderId: string | null;
  disqualifiedByOrderNumber: string | null;

  createdBy: string;
  createdByName?: string;
  createdAt: string;
  updatedAt: string;

  shipments?: ProtectedSupplyShipment[];
}

export interface EnrollCompanyInput {
  companyId: string;
  optionARate?: number; // 0.20 to 0.50 (default: 0.40)
  effectiveDate?: string; // YYYY-MM-DD
  notes?: string;
}

export interface UpdateEnrollmentInput {
  enrollmentId: string;
  optionARate: number; // 0.20 to 0.50
  reason: string;
}

export interface PauseEnrollmentInput {
  enrollmentId: string;
  pauseReason: string;
}

export interface RegisterProtectedCohortInput {
  companyId: string;
  storeId: string;
  productId: string;
  sourceOrderId: string;
  sourceOrderItemId: string;
  protectedQuantity: number;
  unitWholesalePrice: number;
  firstShipmentDate?: string;
  notes?: string;
}

export interface LinkSplitShipmentInput {
  cohortId: string;
  fulfillmentId: string;
  fulfillmentItemId?: string;
  quantityShipped: number;
  quantityDelivered?: number;
  shippedAt?: string;
  deliveredAt?: string;
  carrier?: string;
  trackingNumber?: string;
  isFirstShipment?: boolean;
  notes?: string;
}

export interface ExchangeCreditOverviewStats {
  isSchemaAvailable: boolean;
  totalEnrolledCompanies: number;
  activeCompaniesCount: number;
  pausedCompaniesCount: number;
  totalProtectedCohortsCount: number;
  activeProtectedCohortsCount: number;
  totalProtectedWholesaleValue: number;
  upcomingDay100Count: number;
}

export interface StoreProtectionSummary {
  storeId: string;
  activeCohortsCount: number;
  totalWholesaleValue: number;
  cohorts: Array<{
    id: string;
    cohortCode: string;
    productName: string;
    productSku: string;
    protectedQuantity: number;
    status: ProtectedCohortStatus;
    evaluationDate: string | null;
  }>;
}

export const COHORT_STATUS_CONFIG: Record<
  ProtectedCohortStatus,
  { label: string; bg: string; text: string; border: string }
> = {
  registered: {
    label: "출고 대기 (Registered)",
    bg: "bg-blue-500/10",
    text: "text-blue-400",
    border: "border-blue-500/20",
  },
  partially_fulfilled: {
    label: "부분 출고 (Partial)",
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    border: "border-amber-500/20",
  },
  active_protection: {
    label: "90일 보호중 (Active)",
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    border: "border-emerald-500/20",
  },
  evaluation_ready: {
    label: "Day 100 심사대기 (Eval Ready)",
    bg: "bg-indigo-500/10",
    text: "text-indigo-400",
    border: "border-indigo-500/20",
  },
  claim_window_open: {
    label: "청구 가능 (Claim Open)",
    bg: "bg-cyan-500/10",
    text: "text-cyan-400",
    border: "border-cyan-500/20",
  },
  claim_submitted: {
    label: "청구 접수됨 (Claimed)",
    bg: "bg-purple-500/10",
    text: "text-purple-400",
    border: "border-purple-500/20",
  },
  claim_resolved: {
    label: "크레딧 발행완료 (Resolved)",
    bg: "bg-teal-500/10",
    text: "text-teal-400",
    border: "border-teal-500/20",
  },
  disqualified_reordered: {
    label: "재발주 탈락 (Reordered)",
    bg: "bg-rose-500/10",
    text: "text-rose-400",
    border: "border-rose-500/20",
  },
  disqualified_insufficient_checks: {
    label: "실사 부족 탈락 (Under 8 Checks)",
    bg: "bg-rose-500/10",
    text: "text-rose-400",
    border: "border-rose-500/20",
  },
  disqualified_high_sales: {
    label: "판매율 초과 탈락 (Sales >= 50%)",
    bg: "bg-rose-500/10",
    text: "text-rose-400",
    border: "border-rose-500/20",
  },
  expired_unclaimed: {
    label: "기한 경과 (Expired)",
    bg: "bg-zinc-500/10",
    text: "text-zinc-400",
    border: "border-zinc-500/20",
  },
  cancelled: {
    label: "주문 취소 (Cancelled)",
    bg: "bg-zinc-500/10",
    text: "text-zinc-400",
    border: "border-zinc-500/20",
  },
};
