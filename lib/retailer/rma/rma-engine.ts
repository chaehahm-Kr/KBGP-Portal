/**
 * Option B: Return & RMA Domain Engine Core
 * Task ID: EXCHANGE-CREDIT-PH3-001
 * Location: lib/retailer/rma/rma-engine.ts
 *
 * Strict state machine, deadline calculations, box allocations, and carrier evaluation.
 * Pure logic only — zero DB queries, zero external network calls.
 */

import {
  RmaStatus,
  RmaEventType,
  RmaItemLine,
  RmaBox,
  RmaBoxInput,
  RmaCarrierEvent,
  RmaAggregate,
  RmaTransitionEvent,
  RmaTransitionResult,
  ShippingDeadlineResult,
  RmaException,
  RmaExceptionCode,
  RmaAuditLogEntry,
} from "./rma-types";

// Business timezone for the 90-Day Exchange Credit program
export const RMA_BUSINESS_TIMEZONE = "America/New_York";
export const RMA_SHIPPING_DEADLINE_DAYS = 14;

// ============================================================================
// 1. DATE-ONLY ARITHMETIC & DEADLINE UTILITIES (America/New_York)
// ============================================================================

export interface DateParts {
  year: number;
  month: number; // 0-indexed (0 = Jan)
  day: number;
}

export function parseDateOnly(dateStr: string): DateParts {
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) {
    throw new Error(`Invalid date format for RMA calculation: "${dateStr}". Expected YYYY-MM-DD.`);
  }
  return {
    year: parseInt(match[1], 10),
    month: parseInt(match[2], 10) - 1,
    day: parseInt(match[3], 10),
  };
}

export function formatDateOnly(year: number, month: number, day: number): string {
  const y = String(year).padStart(4, "0");
  const m = String(month + 1).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Add integer calendar days using pure UTC arithmetic.
 * Ensures that 14 calendar days is exact regardless of Daylight Saving Time (DST) shifts.
 */
export function addCalendarDays(dateStr: string, days: number): string {
  const { year, month, day } = parseDateOnly(dateStr);
  const utcDate = new Date(Date.UTC(year, month, day + days));
  return formatDateOnly(utcDate.getUTCFullYear(), utcDate.getUTCMonth(), utcDate.getUTCDate());
}

/**
 * Difference in whole calendar days (date2 - date1).
 */
export function diffCalendarDays(dateStr1: string, dateStr2: string): number {
  const p1 = parseDateOnly(dateStr1);
  const p2 = parseDateOnly(dateStr2);
  const utc1 = Date.UTC(p1.year, p1.month, p1.day);
  const utc2 = Date.UTC(p2.year, p2.month, p2.day);
  return Math.round((utc2 - utc1) / (1000 * 60 * 60 * 24));
}

/**
 * Resolves a date string or timestamp in America/New_York date-only format.
 */
export function resolveAsOfDate(inputDate?: string): string {
  if (!inputDate) {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: RMA_BUSINESS_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(inputDate)) {
    return inputDate;
  }
  const d = new Date(inputDate);
  if (isNaN(d.getTime())) {
    throw new Error(`Invalid date/timestamp: "${inputDate}"`);
  }
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: RMA_BUSINESS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/**
 * Calculate the 14-calendar-day shipping deadline.
 * Day 0 = RMA approval date.
 * Day 14 = Exact deadline date.
 * Day 15 = Overdue date.
 */
export function calculateShippingDeadline(
  approvalDate: string,
  asOfDateInput?: string,
  timezone: string = RMA_BUSINESS_TIMEZONE
): ShippingDeadlineResult {
  const appDate = resolveAsOfDate(approvalDate);
  const deadlineDate = addCalendarDays(appDate, RMA_SHIPPING_DEADLINE_DAYS);
  const asOf = resolveAsOfDate(asOfDateInput);

  const daysElapsed = diffCalendarDays(appDate, asOf);
  const daysRemaining = diffCalendarDays(asOf, deadlineDate);

  let status: "active" | "deadline_day" | "overdue";
  let isOverdue = false;

  if (daysRemaining > 0) {
    status = "active";
    isOverdue = false;
  } else if (daysRemaining === 0) {
    status = "deadline_day";
    isOverdue = false;
  } else {
    status = "overdue";
    isOverdue = true;
  }

  return {
    approvalDate: appDate,
    deadlineDate,
    asOfDate: asOf,
    daysElapsed,
    daysRemaining,
    isOverdue,
    status,
    businessTimezone: timezone,
  };
}

// ============================================================================
// 2. CLAIM EXTRACTION & OPTION B LINE FILTERING
// ============================================================================

export interface RawClaimLineInput {
  claimItemId: string;
  cohortId: string;
  productId: string;
  productName: string;
  productSku: string;
  selectedOption: "A" | "B";
  selectedQuantity: number;
  frozenUnitWholesalePrice: number;
  [key: string]: unknown;
}

export interface RawClaimInput {
  claimId: string;
  claimNumber: string;
  storeId: string;
  companyId: string;
  items: RawClaimLineInput[];
}

export interface OptionBFilterResult {
  success: boolean;
  storeId?: string;
  companyId?: string;
  claimId?: string;
  claimNumber?: string;
  optionBLines: RmaItemLine[];
  optionACount: number;
  error?: string;
  errorCode?: string;
}

/**
 * Filters Option B items from a claim.
 * Enforces:
 * - One Store per claim (rejects cross-store submissions)
 * - Only items where selectedOption === "B" and selectedQuantity > 0 enter RMA
 * - Option A items are safely excluded
 * - Rejects if no Option B lines exist
 */
export function filterOptionBLinesFromClaim(claim: RawClaimInput): OptionBFilterResult {
  if (!claim.storeId || typeof claim.storeId !== "string" || !claim.storeId.trim()) {
    return {
      success: false,
      optionBLines: [],
      optionACount: 0,
      errorCode: "INVALID_STORE_ID",
      error: "Claim must have a valid storeId.",
    };
  }

  let optionACount = 0;
  const optionBLines: RmaItemLine[] = [];

  for (const item of claim.items || []) {
    // Cross-store verification if storeId is present on line
    if ("storeId" in item && item.storeId && item.storeId !== claim.storeId) {
      return {
        success: false,
        optionBLines: [],
        optionACount: 0,
        errorCode: "CROSS_STORE_CLAIM_REJECTED",
        error: `Cross-store claim detected: line store ${item.storeId} does not match claim store ${claim.storeId}`,
      };
    }

    if (item.selectedOption === "A") {
      optionACount++;
      continue;
    }

    if (item.selectedOption === "B") {
      if (!item.selectedQuantity || item.selectedQuantity <= 0) {
        continue;
      }

      const priceDollars = Number(item.frozenUnitWholesalePrice) || 0;
      const priceCents = Math.round(priceDollars * 100);

      optionBLines.push({
        id: `rma-line-${item.claimItemId || Math.random().toString(36).substring(2, 9)}`,
        claimId: claim.claimId,
        claimItemId: item.claimItemId,
        cohortId: item.cohortId,
        productId: item.productId,
        productName: item.productName || "Product",
        productSku: item.productSku || "SKU",
        selectedOption: "B",
        quantityRequested: item.selectedQuantity,
        quantityAuthorized: item.selectedQuantity, // Default authorized = requested, subject to Admin adjustment
        frozenUnitWholesalePrice: priceDollars,
        frozenWholesalePriceCents: priceCents,
        boxId: null,
      });
    }
  }

  if (optionBLines.length === 0) {
    return {
      success: false,
      optionBLines: [],
      optionACount,
      errorCode: "NO_OPTION_B_ITEMS",
      error: "No Option B return items found in claim. RMA not required for Option A-only claims.",
    };
  }

  return {
    success: true,
    storeId: claim.storeId,
    companyId: claim.companyId,
    claimId: claim.claimId,
    claimNumber: claim.claimNumber,
    optionBLines,
    optionACount,
  };
}

// ============================================================================
// 3. MULTI-SKU & MULTI-BOX LABEL ALLOCATION
// ============================================================================

export interface BoxAllocationValidationResult {
  isValid: boolean;
  errors: string[];
  validatedBoxes?: RmaBox[];
}

/**
 * Validates box and shipping label allocation for an RMA.
 * Enforces:
 * - One shipping label per box
 * - Carrier and tracking number required for each box
 * - Quantity of each line allocated across boxes must exactly match authorized quantity
 * - Supports Multi-SKU packed into 1 box, or distributed across multiple boxes
 */
export function validateBoxLabelAllocation(
  boxesInput: RmaBoxInput[],
  authorizedLines: RmaItemLine[]
): BoxAllocationValidationResult {
  const errors: string[] = [];

  if (!boxesInput || boxesInput.length === 0) {
    return {
      isValid: false,
      errors: ["At least one return box must be allocated."],
    };
  }

  const authorizedMap = new Map<string, number>();
  for (const line of authorizedLines) {
    authorizedMap.set(line.id, line.quantityAuthorized);
  }

  const allocatedMap = new Map<string, number>();
  const seenTrackingNumbers = new Set<string>();
  const validatedBoxes: RmaBox[] = [];

  for (let i = 0; i < boxesInput.length; i++) {
    const box = boxesInput[i];
    const boxNum = box.boxNumber || i + 1;

    if (!box.carrier) {
      errors.push(`Box ${boxNum}: Carrier is required (UPS, USPS, etc.)`);
    }

    if (!box.trackingNumber || !box.trackingNumber.trim()) {
      errors.push(`Box ${boxNum}: Tracking number is required`);
    } else {
      const tracking = box.trackingNumber.trim();
      if (seenTrackingNumbers.has(tracking)) {
        errors.push(`Box ${boxNum}: Duplicate tracking number "${tracking}" allocated`);
      }
      seenTrackingNumbers.add(tracking);
    }

    if (!box.assignedLines || box.assignedLines.length === 0) {
      errors.push(`Box ${boxNum}: Must have at least one product line assigned`);
      continue;
    }

    for (const assignment of box.assignedLines) {
      if (!authorizedMap.has(assignment.lineId)) {
        errors.push(`Box ${boxNum}: Line ID "${assignment.lineId}" does not exist in authorized RMA lines`);
        continue;
      }
      if (assignment.quantity <= 0) {
        errors.push(`Box ${boxNum}: Assigned quantity for line "${assignment.lineId}" must be positive`);
        continue;
      }

      const currentAllocated = allocatedMap.get(assignment.lineId) || 0;
      allocatedMap.set(assignment.lineId, currentAllocated + assignment.quantity);
    }

    validatedBoxes.push({
      id: `box-${boxNum}`,
      boxNumber: boxNum,
      carrier: box.carrier,
      trackingNumber: (box.trackingNumber || "").trim(),
      labelUrl: box.labelUrl || null,
      status: "label_created",
      shippedAt: null,
      deliveredAt: null,
      carrierEvents: [],
      assignedLines: box.assignedLines,
    });
  }

  // Verify full allocation reconciliation
  for (const [lineId, authorizedQty] of authorizedMap.entries()) {
    const allocatedQty = allocatedMap.get(lineId) || 0;
    if (allocatedQty !== authorizedQty) {
      errors.push(
        `Line "${lineId}": Total allocated across boxes (${allocatedQty}) does not match authorized quantity (${authorizedQty})`
      );
    }
  }

  if (errors.length > 0) {
    return {
      isValid: false,
      errors,
    };
  }

  return {
    isValid: true,
    errors: [],
    validatedBoxes,
  };
}

// ============================================================================
// 4. DETERMINISTIC IDEMPOTENCY KEY GENERATOR
// ============================================================================

/**
 * Pure deterministic hash function (FNV-1a 32-bit hex) to create framework-independent idempotency keys.
 */
export function generateDeterministicHash(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export function generateRmaIdempotencyKey(
  rmaId: string,
  eventType: string,
  payload: unknown
): string {
  const normalized = JSON.stringify(payload, Object.keys(payload as object).sort());
  const hash = generateDeterministicHash(`${rmaId}:${eventType}:${normalized}`);
  return `IDEMP-RMA-${rmaId.slice(0, 8)}-${eventType}-${hash}`;
}

// ============================================================================
// 5. STRICT STATE-TRANSITION ENGINE
// ============================================================================

/**
 * Valid state transitions mapping:
 * currentStatus -> Array of allowed target statuses
 */
const VALID_TRANSITIONS: Record<RmaStatus, RmaStatus[]> = {
  awaiting_admin_approval: ["approved", "cancelled", "exception"],
  approved: ["shipped", "expired", "cancelled", "exception"],
  shipped: ["delivered", "exception"],
  delivered: ["inspection_in_progress", "exception"],
  inspection_in_progress: ["inspection_completed", "exception"],
  inspection_completed: ["resolution_ready", "exception"],
  resolution_ready: ["exception"], // Terminal in Phase 3; Phase 4 will handle credit issuance
  cancelled: [],                  // Terminal state
  expired: ["exception"],         // Can enter exception via Admin review if late carrier scan verified
  exception: [
    "awaiting_admin_approval",
    "approved",
    "shipped",
    "delivered",
    "inspection_in_progress",
    "inspection_completed",
    "resolution_ready",
    "cancelled",
    "expired",
  ],
};

/**
 * Pure transition engine: validates and executes state changes on an RMA aggregate.
 */
export function validateRmaTransition(
  currentRma: RmaAggregate,
  event: RmaTransitionEvent
): RmaTransitionResult {
  const currentStatus = currentRma.status;
  const asOf = resolveAsOfDate(event.asOfDate);

  // Check for duplicate / idempotent re-application of event
  if (event.idempotencyKey) {
    const existingLog = currentRma.eventHistory.find(
      (h) => h.metadata && (h.metadata as Record<string, unknown>).idempotencyKey === event.idempotencyKey
    );
    if (existingLog) {
      return {
        success: true,
        isDuplicate: true,
        rma: currentRma,
        oldStatus: currentStatus,
        newStatus: currentStatus,
      };
    }
  }

  let targetStatus: RmaStatus;
  const nowIso = new Date().toISOString();

  switch (event.eventType) {
    case "RMA_APPROVED": {
      if (currentStatus !== "awaiting_admin_approval" && currentStatus !== "exception") {
        return {
          success: false,
          errorCode: "INVALID_TRANSITION",
          error: `Cannot approve RMA in status "${currentStatus}". Must be "awaiting_admin_approval" or "exception".`,
        };
      }
      targetStatus = "approved";
      break;
    }

    case "CARRIER_PICKUP":
    case "CARRIER_IN_TRANSIT": {
      if (currentStatus !== "approved" && currentStatus !== "exception") {
        return {
          success: false,
          errorCode: "INVALID_TRANSITION",
          error: `Cannot ship RMA in status "${currentStatus}". Must be "approved" or "exception".`,
        };
      }
      targetStatus = "shipped";
      break;
    }

    case "CARRIER_DELIVERED": {
      if (currentStatus !== "shipped" && currentStatus !== "exception") {
        return {
          success: false,
          errorCode: "INVALID_TRANSITION",
          error: `Cannot deliver RMA in status "${currentStatus}". Must be "shipped" or "exception".`,
        };
      }
      targetStatus = "delivered";
      break;
    }

    case "INSPECTION_STARTED": {
      if (currentStatus !== "delivered" && currentStatus !== "exception") {
        return {
          success: false,
          errorCode: "INVALID_TRANSITION",
          error: `Cannot start inspection in status "${currentStatus}". Must be "delivered" or "exception".`,
        };
      }
      targetStatus = "inspection_in_progress";
      break;
    }

    case "INSPECTION_RECORDED": {
      if (currentStatus !== "inspection_in_progress" && currentStatus !== "exception") {
        return {
          success: false,
          errorCode: "INVALID_TRANSITION",
          error: `Cannot complete inspection in status "${currentStatus}". Must be "inspection_in_progress" or "exception".`,
        };
      }
      targetStatus = "inspection_completed";
      break;
    }

    case "SETTLEMENT_PROPOSED": {
      if (currentStatus !== "inspection_completed" && currentStatus !== "exception") {
        return {
          success: false,
          errorCode: "INVALID_TRANSITION",
          error: `Cannot propose settlement in status "${currentStatus}". Must be "inspection_completed" or "exception".`,
        };
      }
      targetStatus = "resolution_ready";
      break;
    }

    case "EXCEPTION_FLAGGED": {
      targetStatus = "exception";
      break;
    }

    case "EXCEPTION_RESOLVED": {
      if (currentStatus !== "exception") {
        return {
          success: false,
          errorCode: "INVALID_TRANSITION",
          error: `Cannot resolve exception for RMA in status "${currentStatus}". Must be in "exception" status.`,
        };
      }
      const overrideStatus = event.metadata?.targetStatus as RmaStatus;
      if (!overrideStatus || !VALID_TRANSITIONS.exception.includes(overrideStatus)) {
        return {
          success: false,
          errorCode: "INVALID_OVERRIDE_STATUS",
          error: `Invalid target status for exception resolution: "${overrideStatus}".`,
        };
      }
      targetStatus = overrideStatus;
      break;
    }

    case "RMA_CANCELLED": {
      if (currentStatus !== "awaiting_admin_approval" && currentStatus !== "approved" && currentStatus !== "exception") {
        return {
          success: false,
          errorCode: "INVALID_TRANSITION",
          error: `Cannot cancel RMA in status "${currentStatus}". Once shipped or delivered, cancel is forbidden.`,
        };
      }
      targetStatus = "cancelled";
      break;
    }

    case "RMA_EXPIRED": {
      if (currentStatus !== "approved") {
        return {
          success: false,
          errorCode: "INVALID_TRANSITION",
          error: `Cannot expire RMA in status "${currentStatus}". Only un-shipped "approved" RMAs can expire.`,
        };
      }
      if (!currentRma.shippingDeadlineDate) {
        return {
          success: false,
          errorCode: "MISSING_DEADLINE",
          error: "RMA has no shipping deadline date defined.",
        };
      }
      const deadline = calculateShippingDeadline(currentRma.approvalDate || asOf, asOf);
      if (!deadline.isOverdue) {
        return {
          success: false,
          errorCode: "DEADLINE_NOT_EXPIRED",
          error: `RMA shipping deadline (${deadline.deadlineDate}) has not yet passed as of ${asOf}. ${deadline.daysRemaining} days remaining.`,
        };
      }
      targetStatus = "expired";
      break;
    }

    default:
      return {
        success: false,
        errorCode: "UNKNOWN_EVENT_TYPE",
        error: `Unknown RMA event type: "${event.eventType}".`,
      };
  }

  // Validate state machine rule
  const allowedNext = VALID_TRANSITIONS[currentStatus];
  if (!allowedNext.includes(targetStatus)) {
    return {
      success: false,
      errorCode: "ILLEGAL_STATE_TRANSITION",
      error: `Transition from "${currentStatus}" to "${targetStatus}" is prohibited by RMA state machine.`,
    };
  }

  // Produce new RMA aggregate
  const updatedRma: RmaAggregate = {
    ...currentRma,
    status: targetStatus,
    updatedAt: nowIso,
    eventHistory: [
      ...currentRma.eventHistory,
      {
        id: `audit-${Math.random().toString(36).substring(2, 9)}`,
        rmaId: currentRma.id,
        eventType: event.eventType,
        oldStatus: currentStatus,
        newStatus: targetStatus,
        actor: event.actor,
        reason: event.reason || null,
        metadata: event.metadata || null,
        timestamp: nowIso,
      },
    ],
  };

  // If approved, set approvalDate and shippingDeadlineDate
  if (targetStatus === "approved" && !updatedRma.approvalDate) {
    const approvalDate = asOf;
    updatedRma.approvalDate = approvalDate;
    updatedRma.shippingDeadlineDate = addCalendarDays(approvalDate, RMA_SHIPPING_DEADLINE_DAYS);
  }

  return {
    success: true,
    rma: updatedRma,
    oldStatus: currentStatus,
    newStatus: targetStatus,
  };
}

// ============================================================================
// 6. CARRIER TRACKING EVENT EVALUATION
// ============================================================================

export interface CarrierEventEvaluationResult {
  boxId: string;
  boxStatus: "label_created" | "in_transit" | "delivered" | "exception" | "lost";
  isOverdueHandoff: boolean;
  isCarrierLost: boolean;
  exceptionRaised?: RmaException;
  allBoxesDelivered: boolean;
  recommendedRmaStatus: RmaStatus;
}

/**
 * Evaluates a carrier tracking event for a box.
 * Enforces:
 * - Day 14 deadline check: Late carrier scan flags LATE_CARRIER_SCAN exception, routes to Admin review (no automatic forfeiture!)
 * - Carrier lost parcel: On Letusto prepaid label, flags CARRIER_LOST_PARCEL, routes to Admin review (no automatic denial!)
 * - Multi-box delivery tracking
 */
export function evaluateCarrierTrackingEvent(
  rma: RmaAggregate,
  boxId: string,
  event: RmaCarrierEvent,
  asOfDateInput?: string
): CarrierEventEvaluationResult {
  const asOf = resolveAsOfDate(asOfDateInput || event.timestamp);
  const box = rma.boxes.find((b) => b.id === boxId);
  if (!box) {
    throw new Error(`Box "${boxId}" not found on RMA "${rma.rmaNumber}".`);
  }

  let isOverdueHandoff = false;
  let isCarrierLost = false;
  let boxStatus: "label_created" | "in_transit" | "delivered" | "exception" | "lost" = box.status;
  let exceptionRaised: RmaException | undefined;

  // 1. Check for Carrier Lost Parcel
  if (event.eventType === "lost" || (event.rawStatus && /lost/i.test(event.rawStatus))) {
    isCarrierLost = true;
    boxStatus = "lost";
    exceptionRaised = {
      id: `ex-${Math.random().toString(36).substring(2, 9)}`,
      code: "CARRIER_LOST_PARCEL",
      severity: "high",
      description: `Carrier (${box.carrier}) tracking indicates parcel lost in transit for tracking "${box.trackingNumber}". Letusto prepaid return label applies.`,
      flaggedAt: new Date().toISOString(),
      requiresAdminReview: true,
      flagCarrierClaim: true, // Letusto pays return postage and files carrier insurance claim
      resolved: false,
    };
  }
  // 2. Check for Carrier Delivered
  else if (event.eventType === "delivered") {
    boxStatus = "delivered";
  }
  // 3. Check for Carrier Pickup / In Transit
  else if (event.eventType === "in_transit") {
    boxStatus = "in_transit";

    // Check if initial handoff scan is after Day 14 deadline
    if (rma.shippingDeadlineDate) {
      const deadline = calculateShippingDeadline(rma.approvalDate || asOf, asOf);
      if (deadline.isOverdue) {
        isOverdueHandoff = true;
        exceptionRaised = {
          id: `ex-${Math.random().toString(36).substring(2, 9)}`,
          code: "LATE_CARRIER_SCAN",
          severity: "medium",
          description: `Carrier first scan occurred on ${asOf}, which is after Day 14 deadline (${deadline.deadlineDate}). Routed to Admin exception review; no automatic forfeiture.`,
          flaggedAt: new Date().toISOString(),
          requiresAdminReview: true,
          flagCarrierClaim: false,
          resolved: false,
        };
      }
    }
  }

  // 4. Multi-box completion check
  const updatedBoxes = rma.boxes.map((b) =>
    b.id === boxId ? { ...b, status: boxStatus } : b
  );
  const allBoxesDelivered = updatedBoxes.every((b) => b.status === "delivered");
  const anyBoxLost = updatedBoxes.some((b) => b.status === "lost");

  let recommendedRmaStatus: RmaStatus = rma.status;
  if (isCarrierLost || anyBoxLost) {
    recommendedRmaStatus = "exception";
  } else if (allBoxesDelivered) {
    recommendedRmaStatus = "delivered";
  } else if (boxStatus === "in_transit" && rma.status === "approved") {
    recommendedRmaStatus = isOverdueHandoff ? "exception" : "shipped";
  }

  return {
    boxId,
    boxStatus,
    isOverdueHandoff,
    isCarrierLost,
    exceptionRaised,
    allBoxesDelivered,
    recommendedRmaStatus,
  };
}
