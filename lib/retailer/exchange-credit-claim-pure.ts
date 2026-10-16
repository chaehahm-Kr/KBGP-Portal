/**
 * Pure Validation and Calculation Logic for Exchange Credit Claims
 * Task ID: EXCHANGE-CREDIT-PH2-004
 * Location: lib/retailer/exchange-credit-claim-pure.ts
 *
 * Framework-independent pure logic, zero server-only dependencies.
 */

import {
  evaluateCohortEligibility,
  EvaluatorWeeklyCheck,
  EvaluatorShipmentEvidence,
  EvaluatorSalesEvidence,
  EvaluatorReorderOrder,
} from "./exchange-credit-evaluator";
import {
  SubmitClaimInput,
  ClaimValidationError,
  ClaimTotalsCalculation,
} from "./exchange-credit-claim-types";

export interface CohortValidationBundle {
  cohort: any;
  shipments: EvaluatorShipmentEvidence[];
  weeklyChecks: EvaluatorWeeklyCheck[];
  salesEvidence: EvaluatorSalesEvidence;
  reorders: EvaluatorReorderOrder[];
  existingClaimState?: any;
}

export interface ValidatedClaimPayloadResult {
  isValid: boolean;
  errors: ClaimValidationError[];
  totals: ClaimTotalsCalculation;
  validatedLines: Array<{
    cohortId: string;
    productId: string;
    selectedOption: "A" | "B";
    selectedQuantity: number;
    maxClaimableQuantity: number;
    unitWholesalePrice: number;
    creditRate: number;
    estimatedCreditAmount: number;
    day100Snapshot: any;
    evidenceProvenance: any;
  }>;
}

/**
 * Pure validation engine for claim submission.
 * Validates inputs against business rules and the pure evaluator.
 */
export function validateClaimPayload(
  input: SubmitClaimInput,
  cohortsData: CohortValidationBundle[]
): ValidatedClaimPayloadResult {
  const errors: ClaimValidationError[] = [];
  const validatedLines: any[] = [];

  // 1. Reconfirmation Requirement
  if (!input.isStockReconfirmed) {
    errors.push({
      code: "STOCK_NOT_RECONFIRMED",
      message: "매장 실재고 일치 확인 체크박스를 필수로 확인해 주셔야 합니다.",
    });
  }

  // 2. Minimum Items Requirement
  if (!input.items || input.items.length === 0) {
    errors.push({
      code: "EMPTY_ITEMS",
      message: "신청할 보증 품목이 최소 1개 이상 선택되어야 합니다.",
    });
  }

  let totalOptionAUnits = 0;
  let totalOptionBUnits = 0;
  let estimatedCreditOptionA = 0;
  let estimatedCreditOptionB = 0;

  const cohortsMap = new Map<string, CohortValidationBundle>();
  for (const c of cohortsData) {
    cohortsMap.set(c.cohort.id || c.cohort.cohortId, c);
  }

  // Set to check for duplicate cohorts in the same submission
  const seenCohorts = new Set<string>();

  for (const item of input.items || []) {
    // Check for duplicate in payload
    if (seenCohorts.has(item.cohortId)) {
      errors.push({
        cohortId: item.cohortId,
        productId: item.productId,
        code: "DUPLICATE_ITEM_IN_CLAIM",
        message: "동일한 품목이 한 신청서에 중복 포함되었습니다.",
      });
      continue;
    }
    seenCohorts.add(item.cohortId);

    const cohortBundle = cohortsMap.get(item.cohortId);
    if (!cohortBundle) {
      errors.push({
        cohortId: item.cohortId,
        productId: item.productId,
        code: "COHORT_NOT_FOUND",
        message: "보증 공급 코호트 정보를 찾을 수 없습니다.",
      });
      continue;
    }

    const { cohort, shipments, weeklyChecks, salesEvidence, reorders, existingClaimState } = cohortBundle;

    // Single-Store Cross-Store check
    if (cohort.store_id !== input.storeId && cohort.storeId !== input.storeId) {
      errors.push({
        cohortId: item.cohortId,
        productId: item.productId,
        code: "CROSS_STORE_MISMATCH",
        message: "다른 매장의 품목은 동일한 신청서에 포함할 수 없습니다.",
      });
      continue;
    }

    // SKU match check
    if (cohort.product_id !== item.productId && cohort.productId !== item.productId) {
      errors.push({
        cohortId: item.cohortId,
        productId: item.productId,
        code: "PRODUCT_MISMATCH",
        message: "코호트의 등록 상품과 요청 SKU가 일치하지 않습니다.",
      });
      continue;
    }

    // Authoritative Eligibility Evaluation
    const evalResult = evaluateCohortEligibility({
      asOfDate: new Date().toISOString(),
      companyEnrollmentStatus: "active",
      cohort: {
        cohortId: cohort.id || cohort.cohortId,
        companyId: cohort.company_id || cohort.companyId,
        storeId: cohort.store_id || cohort.storeId,
        productId: cohort.product_id || cohort.productId,
        productSku: cohort.product_sku || cohort.productSku || "SKU",
        sourceOrderId: cohort.source_order_id || cohort.sourceOrderId || "ORD",
        totalProtectedQuantity: cohort.total_protected_quantity || cohort.totalProtectedQuantity || 0,
        fulfilledProtectedQuantity: cohort.fulfilled_protected_quantity || cohort.fulfilledProtectedQuantity || 0,
        frozenUnitWholesalePrice: Number(cohort.frozen_unit_wholesale_price || cohort.frozenUnitWholesalePrice || 0),
        frozenOptionARate: Number(cohort.frozen_option_a_rate || cohort.frozenOptionARate || 0.4),
        frozenOptionBRate: 1.0,
      },
      shipments,
      weeklyChecks,
      salesEvidence,
      reorders,
      claimState: existingClaimState || { lifecycleState: "none" },
      currentVerifiedStock: item.currentConfirmedStock,
      selectedClaimQuantity: item.selectedQuantity,
    });

    if (evalResult.quantities.quantityValidationError) {
      errors.push({
        cohortId: item.cohortId,
        productId: item.productId,
        code: evalResult.quantities.quantityValidationError,
        message:
          evalResult.quantities.quantityValidationError === "QUANTITY_EXCEEDS_MAX"
            ? `신청 수량(${item.selectedQuantity}개)이 최대 청구 가능 수량(${evalResult.quantities.maxClaimableQuantity}개)을 초과했습니다.`
            : "유효하지 않은 신청 수량입니다.",
      });
      continue;
    }

    if (!evalResult.isEligible && evalResult.status !== "ELIGIBLE") {
      errors.push({
        cohortId: item.cohortId,
        productId: item.productId,
        code: `NOT_ELIGIBLE_${evalResult.status}`,
        message: `해당 품목은 현재 적격 상태가 아닙니다. (${evalResult.reasons.join(", ")})`,
      });
      continue;
    }

    // Quantity range validation
    const maxQty = evalResult.quantities.maxClaimableQuantity;
    if (!Number.isInteger(item.selectedQuantity) || item.selectedQuantity <= 0) {
      errors.push({
        cohortId: item.cohortId,
        productId: item.productId,
        code: "INVALID_QUANTITY",
        message: "신청 수량은 1개 이상의 정수여야 합니다.",
      });
      continue;
    }

    if (item.selectedQuantity > maxQty) {
      errors.push({
        cohortId: item.cohortId,
        productId: item.productId,
        code: "QUANTITY_EXCEEDS_MAX",
        message: `신청 수량(${item.selectedQuantity}개)이 최대 청구 가능 수량(${maxQty}개)을 초과했습니다.`,
      });
      continue;
    }

    // Pricing & Credit Calculations
    const wholesalePrice = evalResult.credits.unitWholesalePrice;
    let creditRate = 1.0;
    let lineCredit = 0;

    if (item.selectedOption === "A") {
      creditRate = evalResult.credits.optionARate;
      lineCredit = Math.round(item.selectedQuantity * wholesalePrice * creditRate * 100) / 100;
      totalOptionAUnits += item.selectedQuantity;
      estimatedCreditOptionA += lineCredit;
    } else {
      creditRate = 1.0;
      lineCredit = Math.round(item.selectedQuantity * wholesalePrice * 1.0 * 100) / 100;
      totalOptionBUnits += item.selectedQuantity;
      estimatedCreditOptionB += lineCredit;
    }

    validatedLines.push({
      cohortId: item.cohortId,
      productId: item.productId,
      selectedOption: item.selectedOption,
      selectedQuantity: item.selectedQuantity,
      maxClaimableQuantity: maxQty,
      unitWholesalePrice: wholesalePrice,
      creditRate,
      estimatedCreditAmount: lineCredit,
      day100Snapshot: evalResult.day100Snapshot,
      evidenceProvenance: evalResult.provenance,
    });
  }

  const totals: ClaimTotalsCalculation = {
    totalItemsCount: validatedLines.length,
    totalUnitsCount: totalOptionAUnits + totalOptionBUnits,
    totalOptionAUnits,
    totalOptionBUnits,
    estimatedCreditOptionA: Math.round(estimatedCreditOptionA * 100) / 100,
    estimatedCreditOptionB: Math.round(estimatedCreditOptionB * 100) / 100,
    totalEstimatedCredit: Math.round((estimatedCreditOptionA + estimatedCreditOptionB) * 100) / 100,
  };

  return {
    isValid: errors.length === 0,
    errors,
    totals,
    validatedLines,
  };
}
