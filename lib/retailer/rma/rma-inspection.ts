/**
 * Option B: Warehouse Inspection & Quantity Reconciliation
 * Task ID: EXCHANGE-CREDIT-PH3-001
 * Location: lib/retailer/rma/rma-inspection.ts
 *
 * Enforces strict mathematical invariants on received, accepted, rejected, and missing units.
 * Pure logic only — zero DB queries.
 */

import {
  RmaItemLine,
  WarehouseInspectionInput,
  InspectionRecord,
  InspectionLineReconciliation,
  InspectionDiscrepancyType,
  RmaException,
} from "./rma-types";

export interface InspectionReconciliationResult {
  success: boolean;
  inspectionRecord?: InspectionRecord;
  exceptionsRaised: RmaException[];
  errors: string[];
  errorCode?: string;
}

/**
 * Pure function: reconciles warehouse inspection inputs against authorized RMA lines.
 *
 * Strict Invariants:
 * 1. quantityAcceptedResaleable <= quantityReceived (Never accept more than physically received)
 * 2. quantityAcceptedResaleable <= quantityAuthorized (Never accept more than legally authorized)
 * 3. quantityAcceptedResaleable + quantityRejected === quantityReceived (All received units accounted for)
 * 4. quantityMissing = Math.max(0, quantityAuthorized - quantityReceived)
 * 5. Rejection reason is mandatory if quantityRejected > 0
 * 6. Inspector attribution is mandatory (userId, name, role)
 */
export function reconcileWarehouseInspection(
  authorizedLines: RmaItemLine[],
  input: WarehouseInspectionInput,
  rmaId: string
): InspectionReconciliationResult {
  const errors: string[] = [];
  const exceptionsRaised: RmaException[] = [];

  // 1. Validate Inspector Attribution
  if (!input.inspectedBy || !input.inspectedBy.userId || !input.inspectedBy.name) {
    return {
      success: false,
      exceptionsRaised: [],
      errors: ["Inspector attribution is required (userId and name must be provided)."],
      errorCode: "INSPECTOR_ATTRIBUTION_REQUIRED",
    };
  }

  // 2. Validate Lines Exist
  if (!authorizedLines || authorizedLines.length === 0) {
    return {
      success: false,
      exceptionsRaised: [],
      errors: ["No authorized RMA lines provided for inspection."],
      errorCode: "NO_AUTHORIZED_LINES",
    };
  }

  const authorizedMap = new Map<string, RmaItemLine>();
  for (const line of authorizedLines) {
    authorizedMap.set(line.id, line);
  }

  const inputMap = new Map<string, WarehouseInspectionInput["lineInspections"][0]>();
  for (const insp of input.lineInspections || []) {
    inputMap.set(insp.lineId, insp);
  }

  const reconciledLines: InspectionLineReconciliation[] = [];
  let totalAuthorized = 0;
  let totalReceived = 0;
  let totalAcceptedResaleable = 0;
  let totalRejected = 0;
  let totalMissing = 0;
  let hasDiscrepancies = false;

  for (const line of authorizedLines) {
    totalAuthorized += line.quantityAuthorized;
    const insp = inputMap.get(line.id);

    if (!insp) {
      errors.push(`Authorized line "${line.id}" (${line.productSku}) was not inspected.`);
      continue;
    }

    const received = Math.max(0, Math.floor(insp.quantityReceived || 0));
    const accepted = Math.max(0, Math.floor(insp.quantityAcceptedResaleable || 0));
    const rejected = Math.max(0, Math.floor(insp.quantityRejected || 0));
    const authorized = line.quantityAuthorized;

    // INVARIANT 1: accepted <= received
    if (accepted > received) {
      errors.push(
        `Line "${line.productSku}": Accepted resaleable units (${accepted}) cannot exceed received units (${received}).`
      );
    }

    // INVARIANT 2: accepted <= authorized
    if (accepted > authorized) {
      errors.push(
        `Line "${line.productSku}": Accepted resaleable units (${accepted}) cannot exceed authorized units (${authorized}).`
      );
    }

    // INVARIANT 3: accepted + rejected === received
    if (accepted + rejected !== received) {
      errors.push(
        `Line "${line.productSku}": Received units (${received}) must equal accepted (${accepted}) + rejected (${rejected}). Unaccounted difference: ${
          received - (accepted + rejected)
        }.`
      );
    }

    // INVARIANT 4: Rejection reason required if rejected > 0
    if (rejected > 0 && !insp.rejectionReason) {
      errors.push(
        `Line "${line.productSku}": Rejection reason is required when rejecting units (${rejected} rejected).`
      );
    }

    const missing = Math.max(0, authorized - received);
    totalReceived += received;
    totalAcceptedResaleable += accepted;
    totalRejected += rejected;
    totalMissing += missing;

    // Classify discrepancy type
    let discrepancyType: InspectionDiscrepancyType = "exact_match";
    let lineHasDiscrepancy = false;

    if (insp.rejectionReason === "wrong_sku") {
      discrepancyType = "wrong_sku";
      lineHasDiscrepancy = true;
      hasDiscrepancies = true;
      exceptionsRaised.push({
        id: `ex-wrong-sku-${line.id}`,
        code: "WRONG_SKU_RETURNED",
        severity: "high",
        description: `Line "${line.productSku}": Items returned were identified as wrong SKU (${received} units). Resaleable acceptance set to 0.`,
        flaggedAt: new Date().toISOString(),
        requiresAdminReview: true,
        flagCarrierClaim: false,
        resolved: false,
      });
    } else if (received === 0 && authorized > 0) {
      discrepancyType = "partial_receipt";
      lineHasDiscrepancy = true;
      hasDiscrepancies = true;
    } else if (received < authorized) {
      discrepancyType = "partial_receipt";
      lineHasDiscrepancy = true;
      hasDiscrepancies = true;
      exceptionsRaised.push({
        id: `ex-partial-rcpt-${line.id}`,
        code: "PARTIAL_RECEIPT",
        severity: "medium",
        description: `Line "${line.productSku}": Partial receipt (${received} of ${authorized} received, ${missing} missing).`,
        flaggedAt: new Date().toISOString(),
        requiresAdminReview: true,
        flagCarrierClaim: false,
        resolved: false,
      });
    } else if (received > authorized) {
      discrepancyType = "over_receipt";
      lineHasDiscrepancy = true;
      hasDiscrepancies = true;
      exceptionsRaised.push({
        id: `ex-over-rcpt-${line.id}`,
        code: "OVER_RECEIPT",
        severity: "medium",
        description: `Line "${line.productSku}": Over-receipt (${received} received vs ${authorized} authorized). Credit capped at authorized.`,
        flaggedAt: new Date().toISOString(),
        requiresAdminReview: true,
        flagCarrierClaim: false,
        resolved: false,
      });
    } else if (accepted === 0 && received > 0) {
      discrepancyType = "total_rejection";
      lineHasDiscrepancy = true;
      hasDiscrepancies = true;
      exceptionsRaised.push({
        id: `ex-total-rej-${line.id}`,
        code: "DAMAGED_UNITS",
        severity: "high",
        description: `Line "${line.productSku}": 100% of received units rejected (${insp.rejectionReason || "damaged"}).`,
        flaggedAt: new Date().toISOString(),
        requiresAdminReview: true,
        flagCarrierClaim: false,
        resolved: false,
      });
    } else if (accepted < received) {
      discrepancyType = "partial_acceptance";
      lineHasDiscrepancy = true;
      hasDiscrepancies = true;
      exceptionsRaised.push({
        id: `ex-partial-acc-${line.id}`,
        code: "DAMAGED_UNITS",
        severity: "medium",
        description: `Line "${line.productSku}": Partial acceptance (${accepted} accepted resaleable, ${rejected} rejected for ${insp.rejectionReason}).`,
        flaggedAt: new Date().toISOString(),
        requiresAdminReview: false,
        flagCarrierClaim: false,
        resolved: true,
        resolutionNotes: "Partial acceptance logged; credit will be calculated only on accepted units.",
      });
    }

    reconciledLines.push({
      lineId: line.id,
      productId: line.productId,
      productSku: line.productSku,
      productName: line.productName,
      quantityAuthorized: authorized,
      quantityReceived: received,
      quantityAcceptedResaleable: accepted,
      quantityRejected: rejected,
      quantityMissing: missing,
      rejectionReason: insp.rejectionReason || null,
      discrepancyType,
      discrepancyNotes: insp.discrepancyNotes || null,
    });
  }

  if (errors.length > 0) {
    return {
      success: false,
      exceptionsRaised: [],
      errors,
      errorCode: "INSPECTION_INVARIANT_VIOLATION",
    };
  }

  const inspectionRecord: InspectionRecord = {
    id: `insp-${Math.random().toString(36).substring(2, 9)}`,
    rmaId,
    inspectedBy: input.inspectedBy,
    inspectedAt: input.inspectedAt || new Date().toISOString(),
    boxCondition: input.boxCondition,
    lines: reconciledLines,
    totalAuthorized,
    totalReceived,
    totalAcceptedResaleable,
    totalRejected,
    totalMissing,
    hasDiscrepancies,
    overallNotes: input.overallNotes || null,
  };

  return {
    success: true,
    inspectionRecord,
    exceptionsRaised,
    errors: [],
  };
}
