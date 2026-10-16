/**
 * Isolated 90-Day Exchange Credit Eligibility Evaluator
 * Task ID: EXCHANGE-CREDIT-PH2-002
 * Location: lib/retailer/exchange-credit-evaluator.ts
 *
 * Standalone, deterministic, framework-independent pure evaluation engine
 * for K SELECT NETWORK Retailer 90-Day Exchange Credit program.
 * 
 * ZERO external network calls, ZERO database dependencies.
 */

// ---------------------------------------------------------------------------
// 1. DATE ARITHMETIC & CALENDAR UTILITIES (America/New_York)
// ---------------------------------------------------------------------------

export function parseDateOnly(dateStr: string): { year: number; month: number; day: number } {
  const clean = dateStr.trim().split("T")[0];
  const parts = clean.split("-").map(Number);
  if (parts.length !== 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
    throw new Error(`Invalid date format: "${dateStr}". Expected YYYY-MM-DD.`);
  }
  return { year: parts[0], month: parts[1] - 1, day: parts[2] };
}

export function formatDateOnly(year: number, month: number, day: number): string {
  const y = String(year).padStart(4, "0");
  const m = String(month + 1).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Add integer calendar days using pure UTC arithmetic.
 * Immune to Daylight Saving Time (DST) hour shifts.
 */
export function addCalendarDays(dateStr: string, days: number): string {
  const { year, month, day } = parseDateOnly(dateStr);
  const utcDate = new Date(Date.UTC(year, month, day + days));
  return formatDateOnly(utcDate.getUTCFullYear(), utcDate.getUTCMonth(), utcDate.getUTCDate());
}

/**
 * Calculate calendar day difference: date2 - date1
 */
export function diffCalendarDays(dateStr1: string, dateStr2: string): number {
  const p1 = parseDateOnly(dateStr1);
  const p2 = parseDateOnly(dateStr2);
  const utc1 = Date.UTC(p1.year, p1.month, p1.day);
  const utc2 = Date.UTC(p2.year, p2.month, p2.day);
  return Math.round((utc2 - utc1) / (1000 * 60 * 60 * 24));
}

/**
 * Resolves a date string in America/New_York.
 * If input is YYYY-MM-DD, returns it directly.
 * If input is an ISO timestamp, formats in America/New_York.
 */
export function toNewYorkDateString(timestampOrDate: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(timestampOrDate.trim())) {
    return timestampOrDate.trim();
  }
  const date = new Date(timestampOrDate);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid timestamp or date: "${timestampOrDate}".`);
  }
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(date); // Output format: YYYY-MM-DD
}

// ---------------------------------------------------------------------------
// 2. TYPES & INTERFACES
// ---------------------------------------------------------------------------

export type EvaluatorEligibilityStatus =
  | "UPCOMING"
  | "ELIGIBLE"
  | "NOT_ELIGIBLE"
  | "NEEDS_REVIEW"
  | "CLAIM_PENDING"
  | "CLAIM_SETTLED"
  | "CLAIM_REJECTED"
  | "EXPIRED";

export type EvaluatorDisqualificationReason =
  | "EVALUATION_PENDING"
  | "DEADLINE_EXPIRED"
  | "INSUFFICIENT_REPORTING_WEEKS"
  | "EXCESS_SELL_THROUGH"
  | "DISQUALIFIED_REORDERED"
  | "ZERO_REMAINING_STOCK"
  | "UNVERIFIED_SALES_EVIDENCE"
  | "CONTRADICTORY_SALES_EVIDENCE"
  | "CONTRADICTORY_INVENTORY_EVIDENCE"
  | "MISSING_INVENTORY_EVIDENCE"
  | "MISSING_SHIPMENT_EVIDENCE"
  | "UNFULFILLED_PROTECTED_SUPPLY"
  | "ENROLLMENT_TERMINATED"
  | "CLAIM_ALREADY_PENDING"
  | "CLAIM_ALREADY_SETTLED"
  | "CLAIM_ALREADY_REJECTED";

export type ClaimQuantityValidationError =
  | "QUANTITY_EXCEEDS_MAX"
  | "INVALID_CLAIM_QUANTITY"
  | "ZERO_MAX_CLAIMABLE";

export interface EvaluatorProtectedCohortBaseline {
  cohortId: string;
  companyId: string;
  storeId: string;
  productId: string;
  productSku: string;
  sourceOrderId: string;
  sourceOrderItemId?: string;
  totalProtectedQuantity: number;
  fulfilledProtectedQuantity: number;
  frozenUnitWholesalePrice: number;
  frozenOptionARate: number; // Configurable per company [0.20, 0.50], default 0.40
  frozenOptionBRate?: number; // Fixed at 1.0 (100%)
  previouslySettledUnits?: number;
}

export interface EvaluatorShipmentEvidence {
  shipmentId: string;
  fulfillmentId?: string;
  shipmentDate: string; // Authoritative shipment date (NOT delivery date)
  deliveredAt?: string | null; // Kept separate from Day 0 protection clock
  quantityShipped: number;
  quantityDelivered?: number;
  isFirstShipment: boolean;
  isSplitShipment?: boolean;
  trackingNumber?: string | null;
  carrier?: string | null;
}

export interface EvaluatorWeeklyCheck {
  reportingWeek: string; // Official Store week identity (e.g. "2026-W35")
  reportDate?: string;
  submittedAt: string; // ISO timestamp or YYYY-MM-DD
  status: "draft" | "submitted" | "cancelled";
  onHandQuantity?: number | null;
  isTest?: boolean;
}

export interface EvaluatorSalesEvidence {
  source: "pos_verified" | "store_sales_log" | "manual_audit" | "unverified" | "none";
  isTrustworthy: boolean;
  cumulativeSoldUnits?: number;
  evidenceNotes?: string;
  verifiedAt?: string;
  verifiedBy?: string;
}

export interface EvaluatorInventoryAdjustments {
  transferredUnits?: number;
  damagedUnits?: number;
  missingUnits?: number;
  otherAdjustmentUnits?: number;
}

export interface EvaluatorReorderOrder {
  orderId: string;
  orderNumber?: string;
  storeId: string;
  productId: string;
  orderDate: string; // ISO or YYYY-MM-DD
  status: string; // e.g. "draft", "cart", "cancelled", "confirmed", "delivered"
  isSplitShipmentOfInitial?: boolean;
  quantity?: number;
}

export interface EvaluatorClaimState {
  lifecycleState:
    | "none"
    | "draft"
    | "submitted"
    | "under_review"
    | "approved"
    | "settled"
    | "rejected"
    | "cancelled";
  claimId?: string;
  submittedAt?: string;
  selectedOption?: "A" | "B";
  claimedQuantity?: number;
  creditIssued?: boolean;
  physicalReturnReceived?: boolean;
}

export interface EvaluatorInput {
  asOfDate: string; // Reference date/timestamp in America/New_York
  companyEnrollmentStatus?: "active" | "paused" | "terminated";
  cohort: EvaluatorProtectedCohortBaseline;
  shipments: EvaluatorShipmentEvidence[];
  weeklyChecks?: EvaluatorWeeklyCheck[];
  salesEvidence?: EvaluatorSalesEvidence;
  adjustments?: EvaluatorInventoryAdjustments;
  reorders?: EvaluatorReorderOrder[];
  claimState?: EvaluatorClaimState;
  currentVerifiedStock: number;
  selectedClaimQuantity?: number;
}

export interface Day100SnapshotPayload {
  snapshotVersion: "2.0.0";
  cohortId: string;
  companyId: string;
  storeId: string;
  productId: string;
  productSku: string;
  day0Date: string;
  trialEndDate: string;
  evaluationDate: string;
  claimDeadlineDate: string;
  fulfilledProtectedQuantity: number;
  frozenUnitWholesalePrice: number;
  frozenOptionARate: number;
  frozenOptionBRate: number;
  distinctReportingWeeksCount: number;
  reportingWeeksList: string[];
  cumulativeSoldUnits: number | null;
  sellThroughRate: number | null;
  latestDay100OnHandQuantity: number | null;
  hasDisqualifyingReorder: boolean;
  isDay100Eligible: boolean;
  day100Status: EvaluatorEligibilityStatus;
  day100Reasons: EvaluatorDisqualificationReason[];
  evaluatedAt: string;
}

export interface CreditCalculationResult {
  selectedQuantity: number;
  unitWholesalePrice: number;
  optionARate: number;
  optionBRate: number;
  estimatedCreditOptionA: number;
  estimatedCreditOptionB: number;
}

export interface EvaluatorResult {
  status: EvaluatorEligibilityStatus;
  isEligible: boolean;
  canSubmitClaim: boolean;
  reasons: EvaluatorDisqualificationReason[];

  // Date Boundaries
  day0Date: string | null;
  trialEndDate: string | null;
  evaluationDate: string | null;
  claimDeadlineDate: string | null;
  isWithinClaimWindow: boolean;
  daysRemainingInClaimWindow: number;

  // Inventory Reporting
  distinctReportingWeeksCount: number;
  validReportingWeeks: string[];
  lateReportingWeeks: string[];
  hasSufficientReportingWeeks: boolean;

  // Sell-Through
  sellThrough: {
    isSalesTrustworthy: boolean;
    soldUnits: number | null;
    fulfilledUnits: number;
    sellThroughRatePercent: number | null;
    isBelow50PercentThreshold: boolean | null;
  };

  // Stock and Claim Quantities
  quantities: {
    fulfilledProtectedQuantity: number;
    currentVerifiedStock: number;
    latestDay100OnHandQuantity: number | null;
    maxClaimableQuantity: number;
    selectedClaimQuantity?: number;
    isClaimQuantityValid: boolean;
    quantityValidationError?: ClaimQuantityValidationError;
  };

  // Pricing & Credit Estimates
  credits: CreditCalculationResult;

  // Day 100 Snapshot
  day100Snapshot: Day100SnapshotPayload | null;

  // Evidence Provenance & Manual Review Flags
  provenance: {
    shipmentSource: string;
    day0DeterminedBy: "first_shipment_date" | "earliest_shipment_record" | "missing";
    salesEvidenceSource: string;
    reorderCheckCount: number;
    enrollmentStatus: "active" | "paused" | "terminated";
  };
  manualReviewRequired: boolean;
  manualReviewReasons: string[];
}

// ---------------------------------------------------------------------------
// 3. CORE EVALUATION ENGINE (PURE FUNCTION)
// ---------------------------------------------------------------------------

export const DISQUALIFYING_REORDER_STATUSES = new Set([
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "completed",
  "paid",
]);

export const EXCLUDED_REORDER_STATUSES = new Set([
  "draft",
  "cart",
  "cancelled",
  "rejected",
]);

export function evaluateCohortEligibility(input: EvaluatorInput): EvaluatorResult {
  const reasons: EvaluatorDisqualificationReason[] = [];
  const manualReviewReasons: string[] = [];

  // 1. Resolve Reference Date in America/New_York
  const currentDate = toNewYorkDateString(input.asOfDate);

  // 2. Company Enrollment Status
  const enrollmentStatus = input.companyEnrollmentStatus || "active";
  if (enrollmentStatus === "terminated") {
    reasons.push("ENROLLMENT_TERMINATED");
  }
  // NOTE: "paused" enrollment prevents NEW protected cohorts, but does NOT invalidate existing ones!

  // 3. Authoritative Day 0 Determination (First actual Letusto shipment date)
  // Day 0 is SHIPMENT date, NOT delivery date.
  const validShipments = (input.shipments || []).filter((s) => s.quantityShipped > 0);
  let day0Date: string | null = null;
  let day0DeterminedBy: "first_shipment_date" | "earliest_shipment_record" | "missing" = "missing";

  const explicitFirstShipment = validShipments.find((s) => s.isFirstShipment);
  if (explicitFirstShipment) {
    day0Date = toNewYorkDateString(explicitFirstShipment.shipmentDate);
    day0DeterminedBy = "first_shipment_date";
  } else if (validShipments.length > 0) {
    const sorted = [...validShipments].sort((a, b) =>
      toNewYorkDateString(a.shipmentDate).localeCompare(toNewYorkDateString(b.shipmentDate))
    );
    day0Date = toNewYorkDateString(sorted[0].shipmentDate);
    day0DeterminedBy = "earliest_shipment_record";
  }

  // Calculate Key Protection Timeline Dates
  let trialEndDate: string | null = null;      // Day 90
  let evaluationDate: string | null = null;    // Day 100
  let claimDeadlineDate: string | null = null; // Day 150
  let isWithinClaimWindow = false;
  let daysRemainingInClaimWindow = 0;

  if (day0Date) {
    trialEndDate = addCalendarDays(day0Date, 90);
    evaluationDate = addCalendarDays(day0Date, 100);
    claimDeadlineDate = addCalendarDays(day0Date, 150);

    isWithinClaimWindow = currentDate >= evaluationDate && currentDate <= claimDeadlineDate;
    if (isWithinClaimWindow) {
      daysRemainingInClaimWindow = Math.max(0, diffCalendarDays(currentDate, claimDeadlineDate));
    }
  } else {
    reasons.push("MISSING_SHIPMENT_EVIDENCE");
    manualReviewReasons.push("Authoritative Day 0 shipment record is missing or has zero shipped quantity.");
  }

  // 4. Authoritative Supply Fulfillment Baseline
  const fulfilledProtectedQuantity = Math.max(0, input.cohort.fulfilledProtectedQuantity || 0);
  if (fulfilledProtectedQuantity === 0) {
    reasons.push("UNFULFILLED_PROTECTED_SUPPLY");
    manualReviewReasons.push("Protected cohort has zero fulfilled quantity.");
  }

  // 5. Official Store Weekly Inventory Reports (8 Distinct Weeks)
  const validReportingWeeksMap = new Map<string, EvaluatorWeeklyCheck>();
  const lateReportingWeeks: string[] = [];
  let latestDay100OnHandQuantity: number | null = null;

  for (const check of input.weeklyChecks || []) {
    if (check.isTest) continue;
    if (check.status !== "submitted") continue;

    // Reject contradictory negative inventory
    if (check.onHandQuantity !== null && check.onHandQuantity !== undefined && check.onHandQuantity < 0) {
      if (!reasons.includes("CONTRADICTORY_INVENTORY_EVIDENCE")) {
        reasons.push("CONTRADICTORY_INVENTORY_EVIDENCE");
        manualReviewReasons.push(`Negative on-hand stock reported in week ${check.reportingWeek}: ${check.onHandQuantity}`);
      }
      continue;
    }

    const checkSubmittedDate = toNewYorkDateString(check.submittedAt);

    // Cutoff check: Submitted on or before Day 100
    if (evaluationDate && checkSubmittedDate > evaluationDate) {
      lateReportingWeeks.push(check.reportingWeek);
      continue;
    }

    // Keep the latest submitted check for this distinct official reporting week (deduplication)
    const existing = validReportingWeeksMap.get(check.reportingWeek);
    if (!existing || checkSubmittedDate >= toNewYorkDateString(existing.submittedAt)) {
      validReportingWeeksMap.set(check.reportingWeek, check);
    }
  }

  const validReportingWeeks = Array.from(validReportingWeeksMap.keys()).sort();
  const distinctReportingWeeksCount = validReportingWeeks.length;
  const hasSufficientReportingWeeks = distinctReportingWeeksCount >= 8;

  // Determine latest verified on-hand stock as of Day 100
  if (distinctReportingWeeksCount > 0) {
    // Sort checks by submission date ascending to find the latest
    const sortedChecks = Array.from(validReportingWeeksMap.values()).sort((a, b) =>
      toNewYorkDateString(a.submittedAt).localeCompare(toNewYorkDateString(b.submittedAt))
    );
    const lastCheck = sortedChecks[sortedChecks.length - 1];
    if (lastCheck.onHandQuantity !== null && lastCheck.onHandQuantity !== undefined) {
      latestDay100OnHandQuantity = lastCheck.onHandQuantity;
    }
  }

  // If reports are completely missing and cohort is evaluated
  if ((!input.weeklyChecks || input.weeklyChecks.length === 0) && evaluationDate && currentDate >= evaluationDate) {
    reasons.push("MISSING_INVENTORY_EVIDENCE");
    manualReviewReasons.push("No weekly inventory reports were submitted during the 90-day trial.");
  } else if (!hasSufficientReportingWeeks && evaluationDate && currentDate >= evaluationDate) {
    reasons.push("INSUFFICIENT_REPORTING_WEEKS");
  }

  // 6. Sell-Through Evaluation (< 50.00% strictly required; 50% = NOT_ELIGIBLE)
  const salesEvidence = input.salesEvidence;
  let isSalesTrustworthy = false;
  let cumulativeSoldUnits: number | null = null;
  let sellThroughRatePercent: number | null = null;
  let isBelow50PercentThreshold: boolean | null = null;

  if (!salesEvidence || !salesEvidence.isTrustworthy || salesEvidence.cumulativeSoldUnits === undefined) {
    // Cannot assume (fulfilled - onHand) equals sales due to transfers, damages, or discrepancies
    reasons.push("UNVERIFIED_SALES_EVIDENCE");
    manualReviewReasons.push(
      "Trustworthy cumulative sales evidence is not established. Inventory delta cannot be assumed as sales."
    );
  } else {
    isSalesTrustworthy = true;
    cumulativeSoldUnits = salesEvidence.cumulativeSoldUnits;

    if (cumulativeSoldUnits < 0) {
      reasons.push("CONTRADICTORY_SALES_EVIDENCE");
      manualReviewReasons.push(`Cumulative sold units cannot be negative: ${cumulativeSoldUnits}`);
    } else {
      // Check total accounted units against fulfilled supply
      const adjustments = input.adjustments || {};
      const nonSalesOutflow =
        (adjustments.transferredUnits || 0) +
        (adjustments.damagedUnits || 0) +
        (adjustments.missingUnits || 0) +
        (adjustments.otherAdjustmentUnits || 0);

      if (fulfilledProtectedQuantity > 0 && cumulativeSoldUnits + nonSalesOutflow > fulfilledProtectedQuantity) {
        if (!reasons.includes("CONTRADICTORY_INVENTORY_EVIDENCE")) {
          reasons.push("CONTRADICTORY_INVENTORY_EVIDENCE");
          manualReviewReasons.push(
            `Sum of sold units (${cumulativeSoldUnits}) and adjustments (${nonSalesOutflow}) exceeds fulfilled quantity (${fulfilledProtectedQuantity}).`
          );
        }
      }

      if (fulfilledProtectedQuantity > 0) {
        sellThroughRatePercent = Math.round((cumulativeSoldUnits / fulfilledProtectedQuantity) * 10000) / 100;
        // Integer arithmetic comparison for strict < 50% threshold:
        // sold / fulfilled < 0.50  <=>  sold * 2 < fulfilled
        isBelow50PercentThreshold = cumulativeSoldUnits * 2 < fulfilledProtectedQuantity;

        if (!isBelow50PercentThreshold && evaluationDate && currentDate >= evaluationDate) {
          reasons.push("EXCESS_SELL_THROUGH");
        }
      }
    }
  }

  // 7. Confirmed Reorder Disqualification
  let hasDisqualifyingReorder = false;
  let reorderCheckCount = 0;

  for (const order of input.reorders || []) {
    reorderCheckCount++;
    // Check if order belongs to the same store and same product
    if (order.storeId !== input.cohort.storeId || order.productId !== input.cohort.productId) {
      continue; // Multi-store isolation or different product
    }

    // Exclude authorized split shipments of the initial order
    if (order.isSplitShipmentOfInitial || order.orderId === input.cohort.sourceOrderId) {
      continue;
    }

    const orderStatus = (order.status || "").toLowerCase().trim();
    if (EXCLUDED_REORDER_STATUSES.has(orderStatus)) {
      continue; // Carts, unsubmitted, and cancelled orders do NOT disqualify
    }

    if (DISQUALIFYING_REORDER_STATUSES.has(orderStatus)) {
      hasDisqualifyingReorder = true;
      reasons.push("DISQUALIFIED_REORDERED");
      break;
    }
  }

  // 8. Stock & Claim Quantities
  const currentVerifiedStock = Math.max(0, input.currentVerifiedStock || 0);
  const previouslySettledUnits = Math.max(0, input.cohort.previouslySettledUnits || 0);
  const remainingProtectedUnits = Math.max(0, fulfilledProtectedQuantity - previouslySettledUnits);

  const maxClaimableQuantity = Math.min(
    remainingProtectedUnits,
    currentVerifiedStock,
    fulfilledProtectedQuantity
  );

  if (currentVerifiedStock === 0 && evaluationDate && currentDate >= evaluationDate) {
    if (!reasons.includes("ZERO_REMAINING_STOCK") && !reasons.includes("EXCESS_SELL_THROUGH")) {
      reasons.push("ZERO_REMAINING_STOCK");
    }
  }

  // 9. Pricing & Credit Estimates
  const frozenUnitWholesalePrice = Math.max(0, input.cohort.frozenUnitWholesalePrice || 0);
  // Option A rate: Configurable per company [0.20, 0.50], default 0.40
  let optionARate = input.cohort.frozenOptionARate;
  if (typeof optionARate !== "number" || isNaN(optionARate) || optionARate <= 0) {
    optionARate = 0.40;
  }
  optionARate = Math.max(0.20, Math.min(0.50, optionARate));
  const optionBRate = 1.0; // Fixed 100%

  // Validate Selected Claim Quantity if provided
  let isClaimQuantityValid = true;
  let quantityValidationError: ClaimQuantityValidationError | undefined;
  let effectiveSelectedQuantity = maxClaimableQuantity;

  if (input.selectedClaimQuantity !== undefined) {
    const sel = input.selectedClaimQuantity;
    if (!Number.isInteger(sel) || sel <= 0) {
      isClaimQuantityValid = false;
      quantityValidationError = "INVALID_CLAIM_QUANTITY";
    } else if (sel > maxClaimableQuantity) {
      isClaimQuantityValid = false;
      quantityValidationError = "QUANTITY_EXCEEDS_MAX";
    } else {
      effectiveSelectedQuantity = sel;
    }
  } else if (maxClaimableQuantity === 0) {
    isClaimQuantityValid = false;
    quantityValidationError = "ZERO_MAX_CLAIMABLE";
  }

  const credits: CreditCalculationResult = {
    selectedQuantity: effectiveSelectedQuantity,
    unitWholesalePrice: frozenUnitWholesalePrice,
    optionARate,
    optionBRate,
    estimatedCreditOptionA: Math.round(effectiveSelectedQuantity * frozenUnitWholesalePrice * optionARate * 100) / 100,
    estimatedCreditOptionB: Math.round(effectiveSelectedQuantity * frozenUnitWholesalePrice * optionBRate * 100) / 100,
  };

  // 10. Claim Lifecycle State & Concurrency Lock
  const claimState = input.claimState || { lifecycleState: "none" };
  let canSubmitClaim = false;

  // 11. Determine Final Status
  let status: EvaluatorEligibilityStatus;

  if (claimState.lifecycleState === "submitted" || claimState.lifecycleState === "under_review") {
    status = "CLAIM_PENDING";
    reasons.push("CLAIM_ALREADY_PENDING");
    canSubmitClaim = false;
  } else if (claimState.lifecycleState === "settled" || claimState.lifecycleState === "approved") {
    status = "CLAIM_SETTLED";
    reasons.push("CLAIM_ALREADY_SETTLED");
    canSubmitClaim = false;
  } else if (claimState.lifecycleState === "rejected") {
    status = "CLAIM_REJECTED";
    reasons.push("CLAIM_ALREADY_REJECTED");
    canSubmitClaim = false;
  } else if (!day0Date || manualReviewReasons.length > 0) {
    status = "NEEDS_REVIEW";
    canSubmitClaim = false;
  } else if (evaluationDate && currentDate < evaluationDate) {
    status = "UPCOMING";
    reasons.push("EVALUATION_PENDING");
    canSubmitClaim = false;
  } else if (claimDeadlineDate && currentDate > claimDeadlineDate) {
    status = "EXPIRED";
    reasons.push("DEADLINE_EXPIRED");
    canSubmitClaim = false;
  } else {
    // Within claim window [Day 100, Day 150]
    const disqualifying = reasons.filter(
      (r) =>
        r === "INSUFFICIENT_REPORTING_WEEKS" ||
        r === "EXCESS_SELL_THROUGH" ||
        r === "DISQUALIFIED_REORDERED" ||
        r === "ZERO_REMAINING_STOCK" ||
        r === "ENROLLMENT_TERMINATED"
    );

    if (disqualifying.length > 0) {
      status = "NOT_ELIGIBLE";
      canSubmitClaim = false;
    } else if (maxClaimableQuantity > 0 && isClaimQuantityValid) {
      status = "ELIGIBLE";
      canSubmitClaim = true;
    } else {
      status = "NOT_ELIGIBLE";
      canSubmitClaim = false;
    }
  }

  const isEligible = status === "ELIGIBLE";

  // 12. Day 100 Deterministic Assessment Snapshot
  let day100Snapshot: Day100SnapshotPayload | null = null;
  if (day0Date && evaluationDate && claimDeadlineDate && trialEndDate) {
    const isDay100Eligible =
      hasSufficientReportingWeeks &&
      isSalesTrustworthy &&
      isBelow50PercentThreshold === true &&
      !hasDisqualifyingReorder &&
      enrollmentStatus !== "terminated";

    day100Snapshot = {
      snapshotVersion: "2.0.0",
      cohortId: input.cohort.cohortId,
      companyId: input.cohort.companyId,
      storeId: input.cohort.storeId,
      productId: input.cohort.productId,
      productSku: input.cohort.productSku,
      day0Date,
      trialEndDate,
      evaluationDate,
      claimDeadlineDate,
      fulfilledProtectedQuantity,
      frozenUnitWholesalePrice,
      frozenOptionARate: optionARate,
      frozenOptionBRate: optionBRate,
      distinctReportingWeeksCount,
      reportingWeeksList: validReportingWeeks,
      cumulativeSoldUnits,
      sellThroughRate: sellThroughRatePercent,
      latestDay100OnHandQuantity,
      hasDisqualifyingReorder,
      isDay100Eligible,
      day100Status: isDay100Eligible ? "ELIGIBLE" : "NOT_ELIGIBLE",
      day100Reasons: [...reasons],
      evaluatedAt: new Date().toISOString(),
    };
  }

  return {
    status,
    isEligible,
    canSubmitClaim,
    reasons,
    day0Date,
    trialEndDate,
    evaluationDate,
    claimDeadlineDate,
    isWithinClaimWindow,
    daysRemainingInClaimWindow,
    distinctReportingWeeksCount,
    validReportingWeeks,
    lateReportingWeeks,
    hasSufficientReportingWeeks,
    sellThrough: {
      isSalesTrustworthy,
      soldUnits: cumulativeSoldUnits,
      fulfilledUnits: fulfilledProtectedQuantity,
      sellThroughRatePercent,
      isBelow50PercentThreshold,
    },
    quantities: {
      fulfilledProtectedQuantity,
      currentVerifiedStock,
      latestDay100OnHandQuantity,
      maxClaimableQuantity,
      selectedClaimQuantity: input.selectedClaimQuantity,
      isClaimQuantityValid,
      quantityValidationError,
    },
    credits,
    day100Snapshot,
    provenance: {
      shipmentSource: validShipments.length > 0 ? "Letusto Authoritative Shipment" : "None",
      day0DeterminedBy,
      salesEvidenceSource: salesEvidence?.source || "none",
      reorderCheckCount,
      enrollmentStatus,
    },
    manualReviewRequired: manualReviewReasons.length > 0,
    manualReviewReasons,
  };
}
