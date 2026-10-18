/**
 * Product Performance V2.0 — Grade Policy Contract & Eligibility Engine
 * Task ID: ADM-SALES-PERF-003-R3
 * Location: lib/product/performance/grade-policy.ts
 *
 * OWNER-APPROVED SPECIFICATIONS:
 * - Evaluation Window: Trailing 60 days
 * - Eligibility Criteria:
 *     1. Minimum operating history: 60 days (from first shipment / launch date)
 *     2. Minimum completed orders: 3 orders
 *     3. Minimum distinct stores: 3 stores
 *     4. Missing historical cost: N/A (Missing landed cost prevents grading -> NOT_RATED)
 * - Grade Weights (Total: 100%):
 *     - Profitability: 25%
 *     - Sales Performance: 20%
 *     - Inventory Efficiency: 20%
 *     - Exchange Risk: 15%
 *     - Retail Velocity: 10%
 *     - Growth Potential: 5%
 *     - Operational Reliability: 5%
 * - Grade Bands:
 *     - A: 80–100
 *     - B: 65–<80
 *     - C: 50–<65
 *     - D: 0–<50
 * - AUTOMATIC GRADING: Strictly gated (disabled) until scoring normalization receives Owner approval.
 */

import { safeRound, daysBetween } from "./helpers";

// ============================================================================
// 1. POLICY TYPES & CONSTANTS
// ============================================================================

export type ProductPerformanceGrade = "A" | "B" | "C" | "D";
export type ProductEvaluationStatus = "NEW" | "NOT_RATED" | "GRADED";

export type ProductIneligibilityReason =
  | "INSUFFICIENT_OPERATING_HISTORY"
  | "INSUFFICIENT_COMPLETED_ORDERS"
  | "INSUFFICIENT_DISTINCT_STORES"
  | "MISSING_HISTORICAL_COST"
  | "PENDING_SCORING_NORMALIZATION";

export type PillarName =
  | "profitability"
  | "salesPerformance"
  | "inventoryEfficiency"
  | "exchangeRisk"
  | "retailVelocity"
  | "growthPotential"
  | "operationalReliability";

export interface GradeBandDefinition {
  grade: ProductPerformanceGrade;
  min: number; // inclusive
  max: number; // inclusive for A, exclusive for B, C, D
  label: string;
}

export interface GradePolicyContract {
  evaluationPeriodDays: number;
  eligibility: {
    minOperatingHistoryDays: number;
    minCompletedOrders: number;
    minDistinctStores: number;
    missingHistoricalCostPolicy: "N/A";
  };
  weights: Record<PillarName, number>;
  gradeBands: Record<ProductPerformanceGrade, GradeBandDefinition>;
  automaticGradingEnabled: boolean;
}

/**
 * Authoritative Owner-Approved Grade Policy Contract.
 */
export const OWNER_APPROVED_GRADE_POLICY: GradePolicyContract = {
  evaluationPeriodDays: 60,
  eligibility: {
    minOperatingHistoryDays: 60,
    minCompletedOrders: 3,
    minDistinctStores: 3,
    missingHistoricalCostPolicy: "N/A" as const,
  },
  weights: {
    profitability: 25,
    salesPerformance: 20,
    inventoryEfficiency: 20,
    exchangeRisk: 15,
    retailVelocity: 10,
    growthPotential: 5,
    operationalReliability: 5,
  },
  gradeBands: {
    A: { grade: "A", min: 80, max: 100, label: "A: 80–100" },
    B: { grade: "B", min: 65, max: 80, label: "B: 65–<80" },
    C: { grade: "C", min: 50, max: 65, label: "C: 50–<65" },
    D: { grade: "D", min: 0, max: 50, label: "D: 0–<50" },
  },
  /**
   * Safety Gate: Automatic grading remains disabled until Owner approves
   * the scoring normalization curves and thresholds.
   */
  automaticGradingEnabled: false,
};

// ============================================================================
// 2. ELIGIBILITY INTERFACES
// ============================================================================

export interface ProductEligibilityInput {
  product_id: string;
  operatingHistoryDays?: number | null;
  firstShipmentDate?: string | null; // YYYY-MM-DD
  launchDate?: string | null;        // YYYY-MM-DD
  asOfDate?: string | null;          // YYYY-MM-DD
  completedOrdersCount: number;
  distinctStoresCount: number;
  hasHistoricalCost: boolean;
  costStatus?: string | null;
}

export interface ProductEligibilityResult {
  isEligible: boolean;
  status: ProductEvaluationStatus;
  primaryReason?: ProductIneligibilityReason;
  allReasons: ProductIneligibilityReason[];
  metrics: {
    operatingHistoryDays: number;
    completedOrdersCount: number;
    distinctStoresCount: number;
    hasHistoricalCost: boolean;
  };
  thresholds: {
    minOperatingHistoryDays: number;
    minCompletedOrders: number;
    minDistinctStores: number;
    missingHistoricalCostPolicy: "N/A";
  };
  message: string;
}

// ============================================================================
// 3. GRADE EVALUATION INTERFACES
// ============================================================================

export type PillarScoresInput = Partial<Record<PillarName, number | null>>;

export interface CompositeScoreResult {
  score: number;
  weightedContributions: Record<PillarName, number>;
}

export interface ProductGradeEvaluationInput {
  eligibilityInput: ProductEligibilityInput;
  pillarScores?: PillarScoresInput;
  /**
   * When true, allows manual pillar scores for simulation/testing,
   * bypassing the automaticGradingEnabled gate.
   */
  allowManualPillarScores?: boolean;
  asOfDate?: string;
}

export interface ProductGradeEvaluationResult {
  product_id: string;
  status: ProductEvaluationStatus;
  grade: ProductPerformanceGrade | "NEW" | "NOT_RATED";
  overallScore: number | null;
  gradeBand: GradeBandDefinition | null;
  eligibility: ProductEligibilityResult;
  pillarScores: Record<PillarName, number | null> | null;
  weightedContributions: Record<PillarName, number> | null;
  automaticGradingEnabled: boolean;
  statusMessage: string;
  evaluatedAt: string;
}

// ============================================================================
// 4. CORE ENGINE FUNCTIONS
// ============================================================================

/**
 * Validates the mathematical and structural integrity of the grade policy.
 * Asserts that weights sum to exactly 100 and grade bands cover 0–100 contiguously.
 */
export function validateGradePolicyIntegrity(
  policy: GradePolicyContract = OWNER_APPROVED_GRADE_POLICY
): {
  isValid: boolean;
  totalWeight: number;
  bandErrors: string[];
} {
  const weights = policy.weights;
  const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0);

  const bandErrors: string[] = [];
  if (totalWeight !== 100) {
    bandErrors.push(`Total weights sum to ${totalWeight}, expected exactly 100.`);
  }

  const { A, B, C, D } = policy.gradeBands;
  if (D.min !== 0 || D.max !== 50) bandErrors.push("Band D must be 0 to <50.");
  if (C.min !== 50 || C.max !== 65) bandErrors.push("Band C must be 50 to <65.");
  if (B.min !== 65 || B.max !== 80) bandErrors.push("Band B must be 65 to <80.");
  if (A.min !== 80 || A.max !== 100) bandErrors.push("Band A must be 80 to 100.");

  return {
    isValid: bandErrors.length === 0,
    totalWeight,
    bandErrors,
  };
}

/**
 * Evaluates whether a product meets the Owner-approved eligibility criteria.
 */
export function checkProductEligibility(
  input: ProductEligibilityInput,
  policy: GradePolicyContract = OWNER_APPROVED_GRADE_POLICY
): ProductEligibilityResult {
  const {
    minOperatingHistoryDays,
    minCompletedOrders,
    minDistinctStores,
    missingHistoricalCostPolicy,
  } = policy.eligibility;

  // Resolve operating history days
  let operatingHistoryDays = 0;
  if (typeof input.operatingHistoryDays === "number" && input.operatingHistoryDays >= 0) {
    operatingHistoryDays = input.operatingHistoryDays;
  } else {
    const referenceStart = input.firstShipmentDate || input.launchDate;
    const asOf = input.asOfDate || new Date().toISOString().split("T")[0];
    if (referenceStart && asOf) {
      operatingHistoryDays = daysBetween(referenceStart, asOf);
    }
  }

  const completedOrdersCount = Math.max(0, input.completedOrdersCount || 0);
  const distinctStoresCount = Math.max(0, input.distinctStoresCount || 0);
  const hasHistoricalCost = Boolean(input.hasHistoricalCost);

  const allReasons: ProductIneligibilityReason[] = [];

  // Check 1: Operating History (< 60 days is classified as NEW)
  const isNewProduct = operatingHistoryDays < minOperatingHistoryDays;
  if (isNewProduct) {
    allReasons.push("INSUFFICIENT_OPERATING_HISTORY");
  }

  // Check 2: Historical Landed Cost
  if (!hasHistoricalCost) {
    allReasons.push("MISSING_HISTORICAL_COST");
  }

  // Check 3: Minimum Completed Orders
  if (completedOrdersCount < minCompletedOrders) {
    allReasons.push("INSUFFICIENT_COMPLETED_ORDERS");
  }

  // Check 4: Minimum Distinct Stores
  if (distinctStoresCount < minDistinctStores) {
    allReasons.push("INSUFFICIENT_DISTINCT_STORES");
  }

  const isEligible = allReasons.length === 0;

  // Determine Primary Reason and Evaluation Status
  let status: ProductEvaluationStatus = "GRADED";
  let primaryReason: ProductIneligibilityReason | undefined;
  let message = "Product meets all eligibility criteria for performance evaluation.";

  if (isNewProduct) {
    status = "NEW";
    primaryReason = "INSUFFICIENT_OPERATING_HISTORY";
    message = `Product is classified as NEW (operating history: ${operatingHistoryDays} days < required ${minOperatingHistoryDays} days).`;
  } else if (!isEligible) {
    status = "NOT_RATED";
    // Prioritize missing cost, then orders, then stores
    if (!hasHistoricalCost) {
      primaryReason = "MISSING_HISTORICAL_COST";
      message = "Historical landed cost is missing or unavailable (Policy: N/A).";
    } else if (completedOrdersCount < minCompletedOrders) {
      primaryReason = "INSUFFICIENT_COMPLETED_ORDERS";
      message = `Insufficient completed orders (${completedOrdersCount} < required ${minCompletedOrders}).`;
    } else {
      primaryReason = "INSUFFICIENT_DISTINCT_STORES";
      message = `Insufficient distinct retail stores (${distinctStoresCount} < required ${minDistinctStores}).`;
    }
  }

  return {
    isEligible,
    status,
    primaryReason,
    allReasons,
    metrics: {
      operatingHistoryDays,
      completedOrdersCount,
      distinctStoresCount,
      hasHistoricalCost,
    },
    thresholds: {
      minOperatingHistoryDays,
      minCompletedOrders,
      minDistinctStores,
      missingHistoricalCostPolicy,
    },
    message,
  };
}

/**
 * Maps a numeric score (0–100) to an Owner-approved Grade Band (A, B, C, D).
 * Returns null if score is null, undefined, or NaN.
 */
export function mapScoreToGradeBand(
  score: number | null | undefined,
  gradeBands: Record<ProductPerformanceGrade, GradeBandDefinition> = OWNER_APPROVED_GRADE_POLICY.gradeBands
): GradeBandDefinition | null {
  if (score === null || score === undefined || !Number.isFinite(score) || Number.isNaN(score)) {
    return null;
  }

  // Clamp score safely into [0, 100]
  const clampedScore = Math.max(0, Math.min(100, score));
  const { A, B, C, D } = gradeBands;

  if (clampedScore >= A.min) {
    return A;
  }
  if (clampedScore >= B.min) {
    return B;
  }
  if (clampedScore >= C.min) {
    return C;
  }
  return D;
}

/**
 * Calculates composite score from 7 pillar scores using Owner-approved weights.
 * Returns null if any pillar score is missing or invalid.
 */
export function calculateCompositeScore(
  pillarScores?: PillarScoresInput,
  weights: Record<PillarName, number> = OWNER_APPROVED_GRADE_POLICY.weights
): CompositeScoreResult | null {
  if (!pillarScores) {
    return null;
  }

  const pillars = Object.keys(weights) as PillarName[];

  const weightedContributions: Partial<Record<PillarName, number>> = {};
  let totalScore = 0;

  for (const pillar of pillars) {
    const rawScore = pillarScores[pillar];
    if (
      rawScore === null ||
      rawScore === undefined ||
      !Number.isFinite(rawScore) ||
      Number.isNaN(rawScore)
    ) {
      return null; // All 7 pillar scores must be present and valid
    }

    const clamped = Math.max(0, Math.min(100, rawScore));
    const contribution = (clamped * weights[pillar]) / 100;
    const roundedContribution = safeRound(contribution, 4) ?? 0;

    weightedContributions[pillar] = roundedContribution;
    totalScore += roundedContribution;
  }

  const finalScore = safeRound(totalScore, 2) ?? 0;

  return {
    score: finalScore,
    weightedContributions: weightedContributions as Record<PillarName, number>,
  };
}

/**
 * Evaluates the full product grade according to Owner policies.
 * Gated by automaticGradingEnabled: automatic grades will NOT be produced
 * without explicit manual/approved pillar scores or until scoring normalization is approved.
 */
export function evaluateProductGrade(
  input: ProductGradeEvaluationInput,
  policy: GradePolicyContract = OWNER_APPROVED_GRADE_POLICY
): ProductGradeEvaluationResult {
  const evaluatedAt = input.asOfDate || new Date().toISOString();
  const eligibility = checkProductEligibility(input.eligibilityInput, policy);
  const { automaticGradingEnabled } = policy;

  // Initialize default empty breakdown
  const emptyPillars: Record<PillarName, number | null> = {
    profitability: null,
    salesPerformance: null,
    inventoryEfficiency: null,
    exchangeRisk: null,
    retailVelocity: null,
    growthPotential: null,
    operationalReliability: null,
  };

  // Case 1: Product is NEW (< 60 days operating history)
  if (eligibility.status === "NEW") {
    return {
      product_id: input.eligibilityInput.product_id,
      status: "NEW",
      grade: "NEW",
      overallScore: null,
      gradeBand: null,
      eligibility,
      pillarScores: emptyPillars,
      weightedContributions: null,
      automaticGradingEnabled,
      statusMessage: eligibility.message,
      evaluatedAt,
    };
  }

  // Case 2: Product is NOT_RATED due to missing eligibility criteria
  if (!eligibility.isEligible) {
    return {
      product_id: input.eligibilityInput.product_id,
      status: "NOT_RATED",
      grade: "NOT_RATED",
      overallScore: null,
      gradeBand: null,
      eligibility,
      pillarScores: emptyPillars,
      weightedContributions: null,
      automaticGradingEnabled,
      statusMessage: eligibility.message,
      evaluatedAt,
    };
  }

  // Case 3: Product is ELIGIBLE
  // Check if manual pillar scores are provided and permitted
  if (input.allowManualPillarScores && input.pillarScores) {
    const composite = calculateCompositeScore(input.pillarScores, policy.weights);
    if (composite) {
      const gradeBand = mapScoreToGradeBand(composite.score, policy.gradeBands);
      return {
        product_id: input.eligibilityInput.product_id,
        status: "GRADED",
        grade: gradeBand ? gradeBand.grade : "NOT_RATED",
        overallScore: composite.score,
        gradeBand,
        eligibility,
        pillarScores: {
          profitability: input.pillarScores.profitability ?? null,
          salesPerformance: input.pillarScores.salesPerformance ?? null,
          inventoryEfficiency: input.pillarScores.inventoryEfficiency ?? null,
          exchangeRisk: input.pillarScores.exchangeRisk ?? null,
          retailVelocity: input.pillarScores.retailVelocity ?? null,
          growthPotential: input.pillarScores.growthPotential ?? null,
          operationalReliability: input.pillarScores.operationalReliability ?? null,
        },
        weightedContributions: composite.weightedContributions,
        automaticGradingEnabled,
        statusMessage: `Graded ${gradeBand?.grade} (${composite.score} pts) via verified pillar scores.`,
        evaluatedAt,
      };
    }
  }

  // Case 4: Eligible, but automatic grading is disabled pending Owner approval for normalization
  const eligibilityWithPendingReason: ProductEligibilityResult = {
    ...eligibility,
    status: "NOT_RATED",
    primaryReason: "PENDING_SCORING_NORMALIZATION",
    allReasons: ["PENDING_SCORING_NORMALIZATION"],
    message: "Eligible for grading; automatic grading disabled pending Owner approval for scoring normalization.",
  };

  return {
    product_id: input.eligibilityInput.product_id,
    status: "NOT_RATED",
    grade: "NOT_RATED",
    overallScore: null,
    gradeBand: null,
    eligibility: eligibilityWithPendingReason,
    pillarScores: emptyPillars,
    weightedContributions: null,
    automaticGradingEnabled,
    statusMessage: "Product is eligible for evaluation, but automatic grades are gated until scoring normalization curves receive Owner sign-off.",
    evaluatedAt,
  };
}
