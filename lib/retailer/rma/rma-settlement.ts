/**
 * Option B: Credit Settlement Contract & Amount Calculation
 * Task ID: EXCHANGE-CREDIT-PH3-001
 * Location: lib/retailer/rma/rma-settlement.ts
 *
 * Exact integer-cents calculation, no early credit issuance, and deterministic idempotency keys.
 * Pure logic only — zero DB writes, zero ledger entries.
 */

import {
  RmaAggregate,
  InspectionRecord,
  ProposedSettlementInstruction,
  SettlementLineDetail,
} from "./rma-types";
import { generateDeterministicHash } from "./rma-engine";

export interface SettlementCalculationResult {
  success: boolean;
  settlementInstruction?: ProposedSettlementInstruction;
  error?: string;
  errorCode?: string;
}

/**
 * Generate a deterministic idempotency key for proposed settlement instruction.
 */
export function generateSettlementIdempotencyKey(
  rmaId: string,
  claimId: string,
  inspectionId: string,
  totalSettlementCents: number
): string {
  const hash = generateDeterministicHash(
    `SETTLE:${rmaId}:${claimId}:${inspectionId}:${totalSettlementCents}`
  );
  return `IDEMP-SETTLE-${rmaId.slice(0, 8)}-${hash}`;
}

/**
 * Pure calculation function: calculates settlement-ready credit amount for Option B return.
 *
 * Rules:
 * 1. NO CREDIT BEFORE INSPECTION: Must have a completed inspection record.
 * 2. 100% of frozen original wholesale price for units accepted as resaleable.
 * 3. 0% credit ($0.00) for rejected units (damaged, expired, wrong SKU, opened).
 * 4. 0% credit ($0.00) for missing units.
 * 5. Decimal-safe integer cents arithmetic (no floating-point rounding errors).
 * 6. Returns proposed settlement instruction only (no database write or ledger modification).
 */
export function calculateSettlementReadyAmount(
  rma: RmaAggregate,
  inspectionRecord?: InspectionRecord | null,
  calculatedBy = "system"
): SettlementCalculationResult {
  const inspection = inspectionRecord || rma.inspectionRecord;

  // RULE 1: No Credit Before Inspection
  if (!inspection) {
    return {
      success: false,
      errorCode: "NO_CREDIT_BEFORE_INSPECTION",
      error: "Credit calculation is strictly forbidden before warehouse inspection is completed.",
    };
  }

  // Pre-condition: RMA status cannot be uninspected
  if (
    rma.status === "awaiting_admin_approval" ||
    rma.status === "approved" ||
    rma.status === "shipped" ||
    rma.status === "delivered" ||
    rma.status === "cancelled" ||
    rma.status === "expired"
  ) {
    return {
      success: false,
      errorCode: "INVALID_RMA_STATUS_FOR_SETTLEMENT",
      error: `Cannot propose credit settlement while RMA is in status "${rma.status}". Inspection must be completed first.`,
    };
  }

  const linesMap = new Map(rma.lines.map((l) => [l.id, l]));
  const settlementLines: SettlementLineDetail[] = [];
  let totalAcceptedUnits = 0;
  let totalSettlementCents = 0;

  for (const inspectedLine of inspection.lines) {
    const originalLine = linesMap.get(inspectedLine.lineId);
    if (!originalLine) {
      return {
        success: false,
        errorCode: "INSPECTED_LINE_NOT_FOUND",
        error: `Inspected line ID "${inspectedLine.lineId}" was not found on original RMA lines.`,
      };
    }

    const acceptedUnits = inspectedLine.quantityAcceptedResaleable;
    totalAcceptedUnits += acceptedUnits;

    // Integer cents arithmetic
    const priceCents = originalLine.frozenWholesalePriceCents;
    const lineSettlementCents = acceptedUnits * priceCents;
    const lineSettlementDollars = Math.round(lineSettlementCents) / 100;

    totalSettlementCents += lineSettlementCents;

    settlementLines.push({
      lineId: inspectedLine.lineId,
      productId: originalLine.productId,
      productSku: originalLine.productSku,
      acceptedResaleableUnits: acceptedUnits,
      frozenWholesalePriceCents: priceCents,
      settlementAmountCents: lineSettlementCents,
      settlementAmountDollars: lineSettlementDollars,
    });
  }

  const totalSettlementDollars = Math.round(totalSettlementCents) / 100;
  const idempotencyKey = generateSettlementIdempotencyKey(
    rma.id,
    rma.claimId,
    inspection.id,
    totalSettlementCents
  );

  const settlementInstruction: ProposedSettlementInstruction = {
    idempotencyKey,
    rmaId: rma.id,
    claimId: rma.claimId,
    storeId: rma.storeId,
    companyId: rma.companyId,
    calculatedAt: new Date().toISOString(),
    lines: settlementLines,
    totalAcceptedUnits,
    totalSettlementAmountCents: totalSettlementCents,
    totalSettlementAmountDollars: totalSettlementDollars,
    creditRate: 1.0, // 100% of frozen wholesale price
    status: "settlement_proposed",
    disclaimer:
      "Proposed settlement instruction only. No credit ledger entry created and no credit redeemed. Financial issuance remains Phase 4.",
    auditProvenance: {
      inspectionRecordId: inspection.id,
      inspectedAt: inspection.inspectedAt,
      calculatedBy,
    },
  };

  return {
    success: true,
    settlementInstruction,
  };
}

/**
 * Verifies if an existing settlement instruction matches a new calculation (idempotency check).
 */
export function verifySettlementIdempotency(
  existing: ProposedSettlementInstruction | null,
  newInstruction: ProposedSettlementInstruction
): boolean {
  if (!existing) return false;
  return existing.idempotencyKey === newInstruction.idempotencyKey;
}
