/**
 * Typed Adapter between Protected Supply Cohorts, Eligibility Evaluator,
 * Claim Wizard UI, and Claim Backend Submission Contracts.
 *
 * Task ID: EXCHANGE-CREDIT-PH2-007
 * Location: lib/retailer/exchange-credit-wizard-adapter.ts
 */

import {
  evaluateCohortEligibility,
  EvaluatorShipmentEvidence,
  EvaluatorWeeklyCheck,
  EvaluatorSalesEvidence,
  EvaluatorReorderOrder,
  EvaluatorClaimState,
  EvaluatorEligibilityStatus,
} from "./exchange-credit-evaluator";
import {
  ClaimWizardProductItem,
  ClaimWizardProductStatus,
  ClaimWizardStore,
  SelectedClaimItem,
} from "@/components/retailer/exchange-credit/claim-wizard-types";
import { SubmitClaimInput } from "./exchange-credit-claim-types";

export interface RawCohortWithRelations {
  cohort: {
    id: string;
    cohort_code?: string;
    company_id: string;
    store_id: string;
    product_id: string;
    total_protected_quantity: number;
    fulfilled_protected_quantity: number;
    frozen_unit_wholesale_price: number;
    frozen_option_a_rate: number;
    frozen_option_b_rate?: number;
    current_stock?: number;
    status: string;
  };
  product: {
    id: string;
    name: string;
    sku?: string | null;
    brand_name?: string | null;
    thumbnail_url?: string | null;
  };
  store: {
    id: string;
    name: string;
    code?: string | null;
  };
  shipments: EvaluatorShipmentEvidence[];
  weeklyChecks: EvaluatorWeeklyCheck[];
  salesEvidence?: EvaluatorSalesEvidence;
  reorders?: EvaluatorReorderOrder[];
  existingClaimState?: EvaluatorClaimState;
  currentVerifiedStock?: number;
}

/**
 * Maps raw evaluator status to ClaimWizardProductStatus.
 */
export function mapEvaluatorStatusToWizardStatus(
  status: EvaluatorEligibilityStatus
): ClaimWizardProductStatus {
  switch (status) {
    case "ELIGIBLE":
      return "ELIGIBLE";
    case "UPCOMING":
      return "UPCOMING";
    case "EXPIRED":
      return "EXPIRED";
    case "CLAIM_PENDING":
    case "CLAIM_SETTLED":
    case "CLAIM_REJECTED":
      return "CLAIMED";
    case "NEEDS_REVIEW":
      return "NEEDS_REVIEW";
    case "NOT_ELIGIBLE":
    default:
      return "NOT_ELIGIBLE";
  }
}

/**
 * Transforms raw cohort and related evidence into a typed ClaimWizardProductItem.
 */
export function adaptCohortToWizardProductItem(
  data: RawCohortWithRelations,
  asOfDate: string = new Date().toISOString()
): ClaimWizardProductItem {
  const currentStock = data.currentVerifiedStock ?? data.cohort.current_stock ?? 0;

  const evalResult = evaluateCohortEligibility({
    asOfDate,
    companyEnrollmentStatus: "active",
    cohort: {
      cohortId: data.cohort.id,
      companyId: data.cohort.company_id,
      storeId: data.cohort.store_id,
      productId: data.cohort.product_id,
      productSku: data.product.sku || "SKU",
      sourceOrderId: "ORD",
      totalProtectedQuantity: data.cohort.total_protected_quantity,
      fulfilledProtectedQuantity: data.cohort.fulfilled_protected_quantity,
      frozenUnitWholesalePrice: Number(data.cohort.frozen_unit_wholesale_price),
      frozenOptionARate: Number(data.cohort.frozen_option_a_rate),
      frozenOptionBRate: 1.0,
    },
    shipments: data.shipments,
    weeklyChecks: data.weeklyChecks,
    salesEvidence: data.salesEvidence || {
      source: "pos_verified",
      isTrustworthy: true,
      cumulativeSoldUnits: Math.max(0, data.cohort.total_protected_quantity - currentStock),
    },
    reorders: data.reorders || [],
    claimState: data.existingClaimState || { lifecycleState: "none" },
    currentVerifiedStock: currentStock,
    selectedClaimQuantity: currentStock,
  });

  const wizardStatus = mapEvaluatorStatusToWizardStatus(evalResult.status);
  const statusReason = evalResult.reasons.length > 0 ? evalResult.reasons.join(", ") : null;

  return {
    cohortId: data.cohort.id,
    storeId: data.store.id,
    storeName: data.store.name,
    productId: data.product.id,
    productName: data.product.name,
    productSku: data.product.sku || "SKU",
    brandName: data.product.brand_name || null,
    thumbnailUrl: data.product.thumbnail_url || null,

    status: wizardStatus,
    statusReason,
    evaluationDate: evalResult.evaluationDate,
    claimDeadlineDate: evalResult.claimDeadlineDate,
    daysRemaining: Math.max(0, evalResult.daysRemainingInClaimWindow),

    distinctReportingWeeks: evalResult.distinctReportingWeeksCount,
    minReportingWeeksRequired: 8,
    weeklyChecksCompleted: evalResult.hasSufficientReportingWeeks,

    fulfilledProtectedQuantity: data.cohort.fulfilled_protected_quantity,
    currentVerifiedStock: currentStock,
    maxClaimableQuantity: evalResult.isEligible ? evalResult.quantities.maxClaimableQuantity : 0,

    unitWholesalePrice: evalResult.credits.unitWholesalePrice,
    frozenOptionARate: evalResult.credits.optionARate,
    frozenOptionBRate: evalResult.credits.optionBRate,
  };
}

/**
 * Converts Claim Wizard selected items into SubmitClaimInput for backend actions.
 * Enforces single-store context and quantity bounds.
 */
export function convertWizardSelectionToClaimInput(
  storeId: string,
  selectedItems: SelectedClaimItem[],
  isStockReconfirmed: boolean,
  retailerNotes?: string | null
): { isValid: boolean; error?: string; input?: SubmitClaimInput } {
  if (!storeId) {
    return { isValid: false, error: "매장을 선택해 주세요." };
  }

  if (!selectedItems || selectedItems.length === 0) {
    return { isValid: false, error: "신청할 보증 품목이 최소 1개 이상 선택되어야 합니다." };
  }

  if (!isStockReconfirmed) {
    return { isValid: false, error: "매장 실재고 일치 확인 체크박스를 필수로 확인해 주셔야 합니다." };
  }

  const items = selectedItems.map((item) => ({
    cohortId: item.cohortId,
    productId: item.productId,
    selectedOption: item.selectedOption,
    selectedQuantity: item.selectedQuantity,
    currentConfirmedStock: item.selectedQuantity,
  }));

  return {
    isValid: true,
    input: {
      storeId,
      items,
      isStockReconfirmed,
      retailerNotes: retailerNotes || null,
    },
  };
}
