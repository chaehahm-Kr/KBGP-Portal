/**
 * Product Performance Settings V1.0 — Policy Domain & Validation Types
 * Task ID: ADM-SALES-PERF-005-R2
 * Location: lib/product/performance/policy-types.ts
 */

import {
  OWNER_APPROVED_GRADE_POLICY,
  type GradePolicyContract,
  type PillarName,
  type ProductPerformanceGrade,
  type GradeBandDefinition,
} from "./grade-policy";

export const BASELINE_ACTIVE_POLICY: PerformancePolicy = {
  id: "00000000-0000-0000-0000-000000000001",
  version: "v1.0.0",
  draftTitle: "Owner Approved Baseline Policy V1.0",
  status: "published",
  isActive: true,
  effectiveFrom: "2026-03-01T00:00:00Z",
  effectiveTo: null,
  evaluationPeriodDays: OWNER_APPROVED_GRADE_POLICY.evaluationPeriodDays,
  eligibilityCriteria: {
    minOperatingHistoryDays: OWNER_APPROVED_GRADE_POLICY.eligibility.minOperatingHistoryDays,
    minCompletedOrders: OWNER_APPROVED_GRADE_POLICY.eligibility.minCompletedOrders,
    minDistinctStores: OWNER_APPROVED_GRADE_POLICY.eligibility.minDistinctStores,
    requireHistoricalLandedCost: true,
    missingCostPolicy: OWNER_APPROVED_GRADE_POLICY.eligibility.missingHistoricalCostPolicy,
  },
  dimensionWeights: OWNER_APPROVED_GRADE_POLICY.weights,
  gradeBands: OWNER_APPROVED_GRADE_POLICY.gradeBands,
  automaticGradingEnabled: OWNER_APPROVED_GRADE_POLICY.automaticGradingEnabled,
  lockVersion: 1,
  changeSummary: "System initial baseline codified from Owner approval.",
  createdBy: "system",
  publishedBy: "Owner",
  createdAt: "2026-03-01T00:00:00Z",
  updatedAt: "2026-03-01T00:00:00Z",
  publishedAt: "2026-03-01T00:00:00Z",
};

export function policyToContract(policy: PerformancePolicy): GradePolicyContract {
  return {
    evaluationPeriodDays: policy.evaluationPeriodDays,
    eligibility: {
      minOperatingHistoryDays: policy.eligibilityCriteria.minOperatingHistoryDays,
      minCompletedOrders: policy.eligibilityCriteria.minCompletedOrders,
      minDistinctStores: policy.eligibilityCriteria.minDistinctStores,
      missingHistoricalCostPolicy: policy.eligibilityCriteria.missingCostPolicy,
    },
    weights: policy.dimensionWeights,
    gradeBands: policy.gradeBands,
    automaticGradingEnabled: false,
  };
}

export type PolicyStatus = "draft" | "published" | "superseded" | "archived";

export interface PolicyEligibilityCriteria {
  minOperatingHistoryDays: number;
  minCompletedOrders: number;
  minDistinctStores: number;
  requireHistoricalLandedCost: boolean;
  missingCostPolicy: "N/A";
}

export interface PerformancePolicy {
  id: string;
  version: string;
  draftTitle: string;
  status: PolicyStatus;
  isActive: boolean;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  evaluationPeriodDays: number;
  eligibilityCriteria: PolicyEligibilityCriteria;
  dimensionWeights: Record<PillarName, number>;
  gradeBands: Record<ProductPerformanceGrade, GradeBandDefinition>;
  automaticGradingEnabled: boolean;
  lockVersion: number;
  changeSummary: string | null;
  createdBy: string | null;
  publishedBy: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}

export interface PolicyDraftInput {
  id?: string;
  draftTitle: string;
  evaluationPeriodDays: number;
  eligibilityCriteria: PolicyEligibilityCriteria;
  dimensionWeights: Record<PillarName, number>;
  gradeBands: Record<ProductPerformanceGrade, GradeBandDefinition>;
  lockVersion?: number;
  changeSummary?: string | null;
}

export interface PolicyValidationResult {
  isValid: boolean;
  totalWeight: number;
  weightErrors: string[];
  bandErrors: string[];
  eligibilityErrors: string[];
  generalErrors: string[];
}

export type PolicyAuditAction =
  | "create_draft"
  | "update_draft"
  | "discard_draft"
  | "publish"
  | "rollback";

export interface PolicyAuditLog {
  id: string;
  policyId: string;
  action: PolicyAuditAction;
  actorId: string | null;
  actorEmail: string | null;
  previousState: any;
  newState: any;
  changeReason: string;
  createdAt: string;
}

export interface PolicyStructuralPreviewItem {
  productId: string;
  sku: string;
  name: string;
  brandName: string;
  operatingHistoryDays: number;
  completedOrdersCount: number;
  distinctStoresCount: number;
  hasHistoricalCost: boolean;
  currentStatus: "NEW" | "NOT_RATED" | "GRADED";
  projectedStatus: "NEW" | "NOT_RATED" | "GRADED";
  isStatusChanged: boolean;
  projectedReasons: string[];
}

export interface PolicyStructuralPreviewResult {
  totalCatalogSkus: number;
  eligibleSkusCount: number;
  newSkusCount: number;
  notRatedSkusCount: number;
  missingCostSkusCount: number;
  activePolicyComparison: {
    eligibleSkusDelta: number;
    newSkusDelta: number;
    notRatedSkusDelta: number;
  };
  sampleItems: PolicyStructuralPreviewItem[];
}

/**
 * Validates a policy draft against mathematical and structural invariants.
 */
export function validatePolicyDraft(draft: PolicyDraftInput): PolicyValidationResult {
  const weightErrors: string[] = [];
  const bandErrors: string[] = [];
  const eligibilityErrors: string[] = [];
  const generalErrors: string[] = [];

  if (!draft.draftTitle || draft.draftTitle.trim().length === 0) {
    generalErrors.push("Draft title is required.");
  }

  if (typeof draft.evaluationPeriodDays !== "number" || draft.evaluationPeriodDays <= 0) {
    generalErrors.push("Evaluation period must be greater than 0 days.");
  }

  // Weight validation
  const weights = draft.dimensionWeights;
  let totalWeight = 0;
  if (!weights || typeof weights !== "object") {
    weightErrors.push("Pillar weights object is missing.");
  } else {
    for (const [pillar, weight] of Object.entries(weights)) {
      if (typeof weight !== "number" || Number.isNaN(weight) || weight < 0) {
        weightErrors.push(`Pillar ${pillar} must have a non-negative number weight.`);
      } else {
        totalWeight += weight;
      }
    }
    // Allow precision rounding check
    if (Math.round(totalWeight * 100) / 100 !== 100) {
      weightErrors.push(`Total weights sum to ${totalWeight}%, but must equal exactly 100%.`);
    }
  }

  // Grade bands validation
  const bands = draft.gradeBands;
  if (!bands || !bands.A || !bands.B || !bands.C || !bands.D) {
    bandErrors.push("All 4 grade bands (A, B, C, D) must be defined.");
  } else {
    const { A, B, C, D } = bands;
    if (D.min !== 0) {
      bandErrors.push("Grade Band D min must start at 0.");
    }
    if (D.max <= D.min) {
      bandErrors.push("Grade Band D max must be strictly greater than min.");
    }
    if (C.min !== D.max) {
      bandErrors.push(`Grade Band C min (${C.min}) must match Grade Band D max (${D.max}).`);
    }
    if (C.max <= C.min) {
      bandErrors.push("Grade Band C max must be strictly greater than min.");
    }
    if (B.min !== C.max) {
      bandErrors.push(`Grade Band B min (${B.min}) must match Grade Band C max (${C.max}).`);
    }
    if (B.max <= B.min) {
      bandErrors.push("Grade Band B max must be strictly greater than min.");
    }
    if (A.min !== B.max) {
      bandErrors.push(`Grade Band A min (${A.min}) must match Grade Band B max (${B.max}).`);
    }
    if (A.max !== 100) {
      bandErrors.push(`Grade Band A max (${A.max}) must end at exactly 100.`);
    }
  }

  // Eligibility criteria validation
  const crit = draft.eligibilityCriteria;
  if (!crit) {
    eligibilityErrors.push("Eligibility criteria are required.");
  } else {
    if (typeof crit.minOperatingHistoryDays !== "number" || crit.minOperatingHistoryDays < 0) {
      eligibilityErrors.push("Minimum operating history days must be >= 0.");
    }
    if (typeof crit.minCompletedOrders !== "number" || crit.minCompletedOrders < 0) {
      eligibilityErrors.push("Minimum completed orders must be >= 0.");
    }
    if (typeof crit.minDistinctStores !== "number" || crit.minDistinctStores < 0) {
      eligibilityErrors.push("Minimum distinct stores must be >= 0.");
    }
    if (crit.missingCostPolicy !== "N/A") {
      eligibilityErrors.push("Missing historical cost policy must strictly be 'N/A'.");
    }
  }

  const isValid =
    weightErrors.length === 0 &&
    bandErrors.length === 0 &&
    eligibilityErrors.length === 0 &&
    generalErrors.length === 0;

  return {
    isValid,
    totalWeight: Math.round(totalWeight * 100) / 100,
    weightErrors,
    bandErrors,
    eligibilityErrors,
    generalErrors,
  };
}

