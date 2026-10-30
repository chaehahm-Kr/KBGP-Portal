/**
 * Product Performance & Investment Grading — Simulation Engine V1
 * Task ID: ADM-GRADING-POLICY-002
 * Location: lib/product/performance/grading-simulation-engine.ts
 *
 * OWNER-APPROVED DECISIONS IMPLEMENTED:
 * - D1: First fulfilled B2B shipment date is the operating-age anchor.
 * - D2: Verified financial data mandatory. Missing non-core dimensions may use
 *       restricted weight redistribution only after evidence thresholds (80%) are satisfied.
 * - D3: Tiered gross-margin scoring (PROPOSED).
 * - D4: Base inventory DOS corridor 30–75 days, adjusted for verified replenishment lead time.
 * - D5: Exchange risk before Day 100 is UNOBSERVED, not a positive or negative score.
 *
 * NOTE: For internal Letusto simulation and calibration only. Automatic grading remains OFF.
 */

import { safeRound, daysBetween } from "./helpers";
import {
  PillarName,
  ProductPerformanceGrade,
  ProductEvaluationStatus,
  ProductIneligibilityReason,
} from "./grade-policy";

export type InvestmentPriority =
  | "P0_INCUBATE"
  | "P1_CORE_SCALE"
  | "P2_SELECTIVE_GROWTH"
  | "P3_MONITOR_DEFENSIVE"
  | "P4_CAPITAL_EXIT"
  | "P_HOLD_AUDIT";

export interface SimulationSkuInput {
  productId: string;
  sku: string;
  name: string;
  category: string;
  firstShipmentDate?: string | null; // YYYY-MM-DD (D1 Anchor)
  launchDate?: string | null;
  asOfDate: string; // YYYY-MM-DD
  completedOrdersCount: number;
  distinctStoresCount: number;
  hasHistoricalCost: boolean;
  costSource?: string | null;
  // Raw Dimension Metrics
  b2bGrossMarginPercent?: number | null;
  b2bNetSalesUsd?: number | null;
  daysOfSupply?: number | null;
  replenishmentLeadTimeDays?: number;
  claimingStoreRatePercent?: number | null;
  hasReachedDay100?: boolean;
  weeklySellThroughUnits?: number | null;
  reportingComplianceRate?: number | null;
  orderGrowthRatePercent?: number | null;
  orderFillRatePercent?: number | null;
}

export interface SimulationProposalConfig {
  proposedCoverageThreshold: number; // e.g. 0.80 (80%)
  allowRestrictedRedistribution: boolean;
  baseDosCorridor: { min: number; max: number }; // [30, 75]
}

export const DEFAULT_PROPOSAL_CONFIG: SimulationProposalConfig = {
  proposedCoverageThreshold: 0.80,
  allowRestrictedRedistribution: true,
  baseDosCorridor: { min: 30, max: 75 },
};

export const APPROVED_BASE_WEIGHTS: Record<PillarName, number> = {
  profitability: 25,
  salesPerformance: 20,
  inventoryEfficiency: 20,
  exchangeRisk: 15,
  retailVelocity: 10,
  growthPotential: 5,
  operationalReliability: 5,
};

// ============================================================================
// 1. PROPOSED SCORING FUNCTIONS
// ============================================================================

/**
 * Proposed Tiered Gross Margin Scoring (Owner Decision D3)
 */
export function calculateProposedMarginScore(margin: number | null | undefined): {
  score: number | null;
  tier: string;
} {
  if (margin === null || margin === undefined || !Number.isFinite(margin)) {
    return { score: null, tier: "UNAVAILABLE" };
  }

  if (margin >= 50) return { score: 100, tier: "Tier 1: Exceptional (>=50%)" };
  if (margin >= 40) return { score: 85, tier: "Tier 2: Target/Healthy (40-49%)" };
  if (margin >= 30) return { score: 70, tier: "Tier 3: Acceptable (30-39%)" };
  if (margin >= 15) return { score: 50, tier: "Tier 4: Thin (15-29%)" };
  if (margin >= 0) return { score: 20, tier: "Tier 5: Distressed (0-14%)" };
  return { score: 0, tier: "Tier 6: Negative Margin (<0%)" };
}

/**
 * Proposed Inventory DOS Corridor Scoring (Owner Decision D4)
 */
export function calculateProposedDosScore(
  dos: number | null | undefined,
  leadTimeDays: number = 0,
  corridor: { min: number; max: number } = { min: 30, max: 75 }
): { score: number | null; bracket: string } {
  if (dos === null || dos === undefined || !Number.isFinite(dos)) {
    return { score: null, bracket: "UNAVAILABLE" };
  }

  const effectiveMin = corridor.min + leadTimeDays;
  const effectiveMax = corridor.max + leadTimeDays;

  if (dos >= effectiveMin && dos <= effectiveMax) {
    return { score: 100, bracket: `Optimal Corridor (${effectiveMin}-${effectiveMax}d)` };
  }
  if (dos < effectiveMin) {
    if (dos >= 15) return { score: 75, bracket: "Mild Understock (15d to Corridor)" };
    if (dos > 0) return { score: 50, bracket: "Severe Understock (<15d)" };
    return { score: 25, bracket: "Stockout (0d)" };
  }
  // dos > effectiveMax
  if (dos <= effectiveMax + 15) return { score: 80, bracket: "Mild Overstock" };
  if (dos <= effectiveMax + 45) return { score: 60, bracket: "Moderate Overstock" };

  // D4 Option C: Continuous Inventory DOS Decline (181d - 239d)
  const overstock180 = effectiveMax + 105;
  const overstock240 = effectiveMax + 165;

  if (dos <= overstock180) {
    return { score: 30, bracket: "High Overstock (91-180d)" };
  }
  if (dos < overstock240) {
    const rawScore = 30 - 0.5 * (dos - overstock180);
    const score = Math.max(0, Math.min(100, safeRound(rawScore, 4) ?? 0));
    return { score, bracket: "Overstock Capital Decay (181-239d)" };
  }
  return { score: 0, bracket: "Chronic Capital Stagnation (>=240d)" };
}

/**
 * Proposed Exchange Risk Scoring (Owner Decision D5)
 */
export function calculateProposedExchangeScore(
  claimingRate: number | null | undefined,
  hasReachedDay100: boolean = false
): { score: number | null; status: "UNOBSERVED" | "OBSERVED" | "UNAVAILABLE" } {
  if (!hasReachedDay100) {
    // D5: Pre-Day 100 is strictly UNOBSERVED (not positive 100, not negative 0)
    return { score: null, status: "UNOBSERVED" };
  }
  if (claimingRate === null || claimingRate === undefined || !Number.isFinite(claimingRate)) {
    return { score: null, status: "UNAVAILABLE" };
  }
  if (claimingRate === 0) return { score: 100, status: "OBSERVED" };
  if (claimingRate <= 5) return { score: 80, status: "OBSERVED" };
  if (claimingRate <= 10) return { score: 50, status: "OBSERVED" };
  return { score: 0, status: "OBSERVED" };
}

/**
 * Proposed Sales Performance Scoring
 */
export function calculateProposedSalesScore(salesUsd: number | null | undefined): number | null {
  if (salesUsd === null || salesUsd === undefined || !Number.isFinite(salesUsd)) return null;
  if (salesUsd >= 10000) return 100;
  if (salesUsd >= 5000) return 80;
  if (salesUsd >= 2000) return 60;
  if (salesUsd >= 500) return 40;
  if (salesUsd > 0) return 20;
  return 0;
}

/**
 * Proposed Retail Velocity Scoring
 */
export function calculateProposedVelocityScore(
  weeklySellThrough: number | null | undefined,
  complianceRate: number = 1.0
): number | null {
  if (weeklySellThrough === null || weeklySellThrough === undefined || !Number.isFinite(weeklySellThrough)) {
    return null;
  }
  let baseScore = 25;
  if (weeklySellThrough >= 5) baseScore = 100;
  else if (weeklySellThrough >= 2) baseScore = 75;
  else if (weeklySellThrough >= 1) baseScore = 50;

  const validCompliance = Math.max(0, Math.min(1, complianceRate));
  return Math.round(baseScore * validCompliance);
}

/**
 * Proposed Growth Potential Scoring
 */
export function calculateProposedGrowthScore(growthPercent: number | null | undefined): number | null {
  if (growthPercent === null || growthPercent === undefined || !Number.isFinite(growthPercent)) return null;
  if (growthPercent >= 25) return 100;
  if (growthPercent >= 0) return 60;
  if (growthPercent >= -20) return 30;
  return 10;
}

/**
 * Proposed Operational Reliability Scoring
 */
export function calculateProposedReliabilityScore(fillRatePercent: number | null | undefined): number | null {
  if (fillRatePercent === null || fillRatePercent === undefined || !Number.isFinite(fillRatePercent)) return null;
  if (fillRatePercent >= 98) return 100;
  if (fillRatePercent >= 90) return 75;
  if (fillRatePercent >= 80) return 50;
  return 10;
}

// ============================================================================
// 2. SIMULATION EVALUATION ENGINE
// ============================================================================

export interface SimulationResultItem {
  productId: string;
  sku: string;
  name: string;
  category: string;
  status: ProductEvaluationStatus;
  operatingAgeDays: number;
  primaryReason?: ProductIneligibilityReason;
  hasHistoricalCost: boolean;
  costSource: string;
  completedOrdersCount: number;
  distinctStoresCount: number;
  // Raw metrics
  grossMarginPercent: number | null;
  b2bNetSalesUsd: number | null;
  daysOfSupply: number | null;
  claimingStoreRatePercent: number | null;
  hasReachedDay100: boolean;
  // Pillar Scores
  pillarScores: Record<PillarName, number | null>;
  // Coverage & Redistribution
  dataCoverageRatio: number; // 0.0 to 1.0
  isRedistributed: boolean;
  effectiveWeights: Record<PillarName, number>;
  compositeScore: number | null;
  grade: ProductPerformanceGrade | "NEW" | "NOT_RATED";
  investmentPriority: InvestmentPriority;
  recommendedAction: string;
}

export function simulateProductGrading(
  input: SimulationSkuInput,
  config: SimulationProposalConfig = DEFAULT_PROPOSAL_CONFIG
): SimulationResultItem {
  // 1. Calculate Operating Age according to Owner Decision D1 (First Fulfilled Shipment Anchor)
  let operatingAgeDays = 0;
  if (input.firstShipmentDate) {
    operatingAgeDays = daysBetween(input.firstShipmentDate, input.asOfDate);
  } else if (input.launchDate) {
    operatingAgeDays = daysBetween(input.launchDate, input.asOfDate);
  }

  const isNew = operatingAgeDays < 60;
  const hasHistoricalCost = input.hasHistoricalCost;
  const hasOrders = input.completedOrdersCount >= 3;
  const hasStores = input.distinctStoresCount >= 3;
  const isEligible = !isNew && hasHistoricalCost && hasOrders && hasStores;

  // Initial empty pillar scores
  const pillarScores: Record<PillarName, number | null> = {
    profitability: calculateProposedMarginScore(input.b2bGrossMarginPercent).score,
    salesPerformance: calculateProposedSalesScore(input.b2bNetSalesUsd),
    inventoryEfficiency: calculateProposedDosScore(
      input.daysOfSupply,
      input.replenishmentLeadTimeDays || 0,
      config.baseDosCorridor
    ).score,
    exchangeRisk: calculateProposedExchangeScore(
      input.claimingStoreRatePercent,
      input.hasReachedDay100 || false
    ).score,
    retailVelocity: calculateProposedVelocityScore(
      input.weeklySellThroughUnits,
      input.reportingComplianceRate ?? 1.0
    ),
    growthPotential: calculateProposedGrowthScore(input.orderGrowthRatePercent),
    operationalReliability: calculateProposedReliabilityScore(input.orderFillRatePercent),
  };

  // 2. Data Coverage Calculation
  let availableWeightSum = 0;
  for (const pillar of Object.keys(APPROVED_BASE_WEIGHTS) as PillarName[]) {
    if (pillarScores[pillar] !== null) {
      availableWeightSum += APPROVED_BASE_WEIGHTS[pillar];
    }
  }
  const dataCoverageRatio = availableWeightSum / 100;

  // 3. Handle Lifecycle Statuses: NEW and NOT_RATED
  if (isNew) {
    return {
      productId: input.productId,
      sku: input.sku,
      name: input.name,
      category: input.category,
      status: "NEW",
      operatingAgeDays,
      primaryReason: "INSUFFICIENT_OPERATING_HISTORY",
      hasHistoricalCost,
      costSource: input.costSource || (hasHistoricalCost ? "VERIFIED" : "MISSING"),
      completedOrdersCount: input.completedOrdersCount,
      distinctStoresCount: input.distinctStoresCount,
      grossMarginPercent: input.b2bGrossMarginPercent ?? null,
      b2bNetSalesUsd: input.b2bNetSalesUsd ?? null,
      daysOfSupply: input.daysOfSupply ?? null,
      claimingStoreRatePercent: input.claimingStoreRatePercent ?? null,
      hasReachedDay100: input.hasReachedDay100 || false,
      pillarScores,
      dataCoverageRatio,
      isRedistributed: false,
      effectiveWeights: APPROVED_BASE_WEIGHTS,
      compositeScore: null,
      grade: "NEW",
      investmentPriority: "P0_INCUBATE",
      recommendedAction: "Maintain initial trial supply; protect 90-day trial window; monitor early store weekly checks.",
    };
  }

  if (!isEligible) {
    let primaryReason: ProductIneligibilityReason = "INSUFFICIENT_ORDERS" as any;
    let action = "";
    if (!hasHistoricalCost) {
      primaryReason = "MISSING_HISTORICAL_COST";
      action = "Halt capital expansion; request verified landed cost documentation from brand before next replenishment.";
    } else if (!hasOrders) {
      primaryReason = "INSUFFICIENT_COMPLETED_ORDERS";
      action = "Accelerate wholesale door pitch to achieve minimum 3 completed orders.";
    } else {
      primaryReason = "INSUFFICIENT_DISTINCT_STORES";
      action = "Expand retailer distribution to achieve minimum 3 distinct purchasing stores.";
    }

    return {
      productId: input.productId,
      sku: input.sku,
      name: input.name,
      category: input.category,
      status: "NOT_RATED",
      operatingAgeDays,
      primaryReason,
      hasHistoricalCost,
      costSource: input.costSource || (hasHistoricalCost ? "VERIFIED" : "MISSING"),
      completedOrdersCount: input.completedOrdersCount,
      distinctStoresCount: input.distinctStoresCount,
      grossMarginPercent: input.b2bGrossMarginPercent ?? null,
      b2bNetSalesUsd: input.b2bNetSalesUsd ?? null,
      daysOfSupply: input.daysOfSupply ?? null,
      claimingStoreRatePercent: input.claimingStoreRatePercent ?? null,
      hasReachedDay100: input.hasReachedDay100 || false,
      pillarScores,
      dataCoverageRatio,
      isRedistributed: false,
      effectiveWeights: APPROVED_BASE_WEIGHTS,
      compositeScore: null,
      grade: "NOT_RATED",
      investmentPriority: "P_HOLD_AUDIT",
      recommendedAction: action,
    };
  }

  // 4. Product is ELIGIBLE: Apply Owner Decision D2 (Restricted Redistribution Engine)
  // Financial data MUST be verified
  const hasFinancialData =
    hasHistoricalCost &&
    pillarScores.profitability !== null &&
    pillarScores.salesPerformance !== null;

  if (!hasFinancialData) {
    return {
      productId: input.productId,
      sku: input.sku,
      name: input.name,
      category: input.category,
      status: "NOT_RATED",
      operatingAgeDays,
      primaryReason: "MISSING_HISTORICAL_COST",
      hasHistoricalCost,
      costSource: input.costSource || "MISSING",
      completedOrdersCount: input.completedOrdersCount,
      distinctStoresCount: input.distinctStoresCount,
      grossMarginPercent: input.b2bGrossMarginPercent ?? null,
      b2bNetSalesUsd: input.b2bNetSalesUsd ?? null,
      daysOfSupply: input.daysOfSupply ?? null,
      claimingStoreRatePercent: input.claimingStoreRatePercent ?? null,
      hasReachedDay100: input.hasReachedDay100 || false,
      pillarScores,
      dataCoverageRatio,
      isRedistributed: false,
      effectiveWeights: APPROVED_BASE_WEIGHTS,
      compositeScore: null,
      grade: "NOT_RATED",
      investmentPriority: "P_HOLD_AUDIT",
      recommendedAction: "Verified financial data missing; cannot calculate investment grade.",
    };
  }

  // Check coverage threshold (e.g. >= 80%)
  const meetsCoverage = dataCoverageRatio >= config.proposedCoverageThreshold;
  let compositeScore: number | null = null;
  let isRedistributed = false;
  const effectiveWeights = { ...APPROVED_BASE_WEIGHTS };

  if (meetsCoverage && config.allowRestrictedRedistribution) {
    isRedistributed = availableWeightSum < 100;
    let totalScore = 0;
    for (const pillar of Object.keys(APPROVED_BASE_WEIGHTS) as PillarName[]) {
      const pScore = pillarScores[pillar];
      if (pScore !== null) {
        const scaledWeight = (APPROVED_BASE_WEIGHTS[pillar] / availableWeightSum) * 100;
        effectiveWeights[pillar] = safeRound(scaledWeight, 2) ?? 0;
        totalScore += (pScore * scaledWeight) / 100;
      } else {
        effectiveWeights[pillar] = 0;
      }
    }
    compositeScore = safeRound(totalScore, 2);
  } else if (availableWeightSum === 100) {
    // 100% full coverage
    let totalScore = 0;
    for (const pillar of Object.keys(APPROVED_BASE_WEIGHTS) as PillarName[]) {
      totalScore += ((pillarScores[pillar] || 0) * APPROVED_BASE_WEIGHTS[pillar]) / 100;
    }
    compositeScore = safeRound(totalScore, 2);
  } else {
    // Coverage < 80%: Cannot redistribute. Missing data cannot be forgiven.
    return {
      productId: input.productId,
      sku: input.sku,
      name: input.name,
      category: input.category,
      status: "NOT_RATED",
      operatingAgeDays,
      primaryReason: "PENDING_SCORING_NORMALIZATION",
      hasHistoricalCost,
      costSource: input.costSource || "VERIFIED",
      completedOrdersCount: input.completedOrdersCount,
      distinctStoresCount: input.distinctStoresCount,
      grossMarginPercent: input.b2bGrossMarginPercent ?? null,
      b2bNetSalesUsd: input.b2bNetSalesUsd ?? null,
      daysOfSupply: input.daysOfSupply ?? null,
      claimingStoreRatePercent: input.claimingStoreRatePercent ?? null,
      hasReachedDay100: input.hasReachedDay100 || false,
      pillarScores,
      dataCoverageRatio,
      isRedistributed: false,
      effectiveWeights: APPROVED_BASE_WEIGHTS,
      compositeScore: null,
      grade: "NOT_RATED",
      investmentPriority: "P_HOLD_AUDIT",
      recommendedAction: `Data coverage (${Math.round(dataCoverageRatio * 100)}%) is below proposed 80% threshold; missing observations prevent definitive grading.`,
    };
  }

  // 5. Map to Grade Band & Investment Priority
  let grade: ProductPerformanceGrade = "D";
  let priority: InvestmentPriority = "P4_CAPITAL_EXIT";
  let action = "";

  if (compositeScore !== null) {
    if (compositeScore >= 80) {
      grade = "A";
      priority = "P1_CORE_SCALE";
      action = "Increase HQ purchase order volume by 25–50%; feature as top-tier recommended SKU for retailer network.";
    } else if (compositeScore >= 65) {
      grade = "B";
      priority = "P2_SELECTIVE_GROWTH";
      action = "Maintain steady replenishment; review inventory turnover and optimize store-level sell-through.";
    } else if (compositeScore >= 50) {
      grade = "C";
      priority = "P3_MONITOR_DEFENSIVE";
      action = "Freeze PO reorders; audit pricing and promotional discount structure; monitor store feedback.";
    } else {
      grade = "D";
      priority = "P4_CAPITAL_EXIT";
      action = "Cease replenishment; initiate inventory clearance promotion or return/exchange settlement; mark for delisting.";
    }
  }

  return {
    productId: input.productId,
    sku: input.sku,
    name: input.name,
    category: input.category,
    status: "GRADED",
    operatingAgeDays,
    hasHistoricalCost,
    costSource: input.costSource || "VERIFIED",
    completedOrdersCount: input.completedOrdersCount,
    distinctStoresCount: input.distinctStoresCount,
    grossMarginPercent: input.b2bGrossMarginPercent ?? null,
    b2bNetSalesUsd: input.b2bNetSalesUsd ?? null,
    daysOfSupply: input.daysOfSupply ?? null,
    claimingStoreRatePercent: input.claimingStoreRatePercent ?? null,
    hasReachedDay100: input.hasReachedDay100 || false,
    pillarScores,
    dataCoverageRatio,
    isRedistributed,
    effectiveWeights,
    compositeScore,
    grade,
    investmentPriority: priority,
    recommendedAction: action,
  };
}
