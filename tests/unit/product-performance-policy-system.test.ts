/**
 * Product Performance Settings V1.0 — Policy System & Validation Engine Unit Tests
 * Task ID: ADM-SALES-PERF-005-R2
 * Location: tests/unit/product-performance-policy-system.test.ts
 */

import { describe, it, expect } from "vitest";
import {
  validatePolicyDraft,
  type PolicyDraftInput,
  BASELINE_ACTIVE_POLICY,
  policyToContract,
} from "../../lib/product/performance/policy-types";
import {
  OWNER_APPROVED_GRADE_POLICY,
  checkProductEligibility,
  calculateCompositeScore,
  mapScoreToGradeBand,
  evaluateProductGrade,
  type GradePolicyContract,
  type ProductEligibilityInput,
} from "../../lib/product/performance/grade-policy";

describe("Product Performance Settings V1.0 — Policy System & Engine Integration", () => {
  // Baseline valid draft fixture
  const validDraft: PolicyDraftInput = {
    draftTitle: "Test Policy V1.1",
    evaluationPeriodDays: 60,
    eligibilityCriteria: {
      minOperatingHistoryDays: 60,
      minCompletedOrders: 3,
      minDistinctStores: 3,
      requireHistoricalLandedCost: true,
      missingCostPolicy: "N/A",
    },
    dimensionWeights: {
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
  };

  // =========================================================================
  // 1. DRAFT VALIDATION ENGINE & INVARIANTS
  // =========================================================================
  describe("1. Policy Draft Validation Engine", () => {
    it("accepts an exact Owner-approved baseline configuration", () => {
      const result = validatePolicyDraft(validDraft);
      expect(result.isValid).toBe(true);
      expect(result.totalWeight).toBe(100);
      expect(result.weightErrors).toHaveLength(0);
      expect(result.bandErrors).toHaveLength(0);
      expect(result.eligibilityErrors).toHaveLength(0);
    });

    it("rejects when weights sum to less than 100%", () => {
      const invalid = {
        ...validDraft,
        dimensionWeights: {
          ...validDraft.dimensionWeights,
          profitability: 20, // Sums to 95%
        },
      };
      const result = validatePolicyDraft(invalid);
      expect(result.isValid).toBe(false);
      expect(result.totalWeight).toBe(95);
      expect(result.weightErrors.some((e) => e.includes("must equal exactly 100%"))).toBe(true);
    });

    it("rejects when weights sum to more than 100%", () => {
      const invalid = {
        ...validDraft,
        dimensionWeights: {
          ...validDraft.dimensionWeights,
          profitability: 35, // Sums to 110%
        },
      };
      const result = validatePolicyDraft(invalid);
      expect(result.isValid).toBe(false);
      expect(result.totalWeight).toBe(110);
      expect(result.weightErrors.some((e) => e.includes("must equal exactly 100%"))).toBe(true);
    });

    it("rejects negative weight values", () => {
      const invalid = {
        ...validDraft,
        dimensionWeights: {
          ...validDraft.dimensionWeights,
          profitability: -10,
          salesPerformance: 55,
        },
      };
      const result = validatePolicyDraft(invalid);
      expect(result.isValid).toBe(false);
      expect(result.weightErrors.some((e) => e.includes("non-negative"))).toBe(true);
    });

    it("rejects when Grade Band D does not start at 0", () => {
      const invalid = {
        ...validDraft,
        gradeBands: {
          ...validDraft.gradeBands,
          D: { grade: "D" as const, min: 10, max: 50, label: "D: 10-50" },
        },
      };
      const result = validatePolicyDraft(invalid);
      expect(result.isValid).toBe(false);
      expect(result.bandErrors.some((e) => e.includes("min must start at 0"))).toBe(true);
    });

    it("rejects when Grade Band A does not end at 100", () => {
      const invalid = {
        ...validDraft,
        gradeBands: {
          ...validDraft.gradeBands,
          A: { grade: "A" as const, min: 80, max: 95, label: "A: 80-95" },
        },
      };
      const result = validatePolicyDraft(invalid);
      expect(result.isValid).toBe(false);
      expect(result.bandErrors.some((e) => e.includes("end at exactly 100"))).toBe(true);
    });

    it("rejects non-contiguous grade bands with gap between C and B", () => {
      const invalid = {
        ...validDraft,
        gradeBands: {
          ...validDraft.gradeBands,
          C: { grade: "C" as const, min: 50, max: 60, label: "C: 50-60" }, // Gap: 60 to 65
          B: { grade: "B" as const, min: 65, max: 80, label: "B: 65-80" },
        },
      };
      const result = validatePolicyDraft(invalid);
      expect(result.isValid).toBe(false);
      expect(result.bandErrors.some((e) => e.includes("must match Grade Band C max"))).toBe(true);
    });

    it("rejects non-contiguous grade bands with inverted or zero-range bounds", () => {
      const invalid = {
        ...validDraft,
        gradeBands: {
          ...validDraft.gradeBands,
          C: { grade: "C" as const, min: 50, max: 50, label: "C: 50-50" },
        },
      };
      const result = validatePolicyDraft(invalid);
      expect(result.isValid).toBe(false);
      expect(result.bandErrors.some((e) => e.includes("strictly greater than min"))).toBe(true);
    });

    it("rejects empty draft title", () => {
      const invalid = { ...validDraft, draftTitle: "   " };
      const result = validatePolicyDraft(invalid);
      expect(result.isValid).toBe(false);
      expect(result.generalErrors).toContain("Draft title is required.");
    });

    it("rejects invalid missingCostPolicy (must strictly be 'N/A')", () => {
      const invalid: any = {
        ...validDraft,
        eligibilityCriteria: {
          ...validDraft.eligibilityCriteria,
          missingCostPolicy: "CURRENT_COST_SUBSTITUTE",
        },
      };
      const result = validatePolicyDraft(invalid);
      expect(result.isValid).toBe(false);
      expect(result.eligibilityErrors.some((e) => e.includes("strictly be 'N/A'"))).toBe(true);
    });
  });

  // =========================================================================
  // 2. DYNAMIC POLICY INJECTION INTO CALCULATION ENGINE
  // =========================================================================
  describe("2. Dynamic Policy Injection in Calculation Engine", () => {
    it("evaluates eligibility differently when threshold is relaxed from 60 to 30 days", () => {
      const productInput: ProductEligibilityInput = {
        product_id: "prod_pilot_01",
        operatingHistoryDays: 45,
        completedOrdersCount: 5,
        distinctStoresCount: 4,
        hasHistoricalCost: true,
      };

      // 1. Under default baseline policy (60 days required): product is NEW
      const baselineResult = checkProductEligibility(productInput);
      expect(baselineResult.isEligible).toBe(false);
      expect(baselineResult.status).toBe("NEW");

      // 2. Under relaxed policy (30 days required): product is ELIGIBLE
      const relaxedPolicy: GradePolicyContract = {
        ...OWNER_APPROVED_GRADE_POLICY,
        eligibility: {
          ...OWNER_APPROVED_GRADE_POLICY.eligibility,
          minOperatingHistoryDays: 30,
        },
      };
      const relaxedResult = checkProductEligibility(productInput, relaxedPolicy);
      expect(relaxedResult.isEligible).toBe(true);
      expect(relaxedResult.status).toBe("GRADED");
    });

    it("evaluates eligibility under custom order count threshold", () => {
      const productInput: ProductEligibilityInput = {
        product_id: "prod_orders_01",
        operatingHistoryDays: 90,
        completedOrdersCount: 5,
        distinctStoresCount: 5,
        hasHistoricalCost: true,
      };

      // Baseline requires 3 orders -> eligible
      expect(checkProductEligibility(productInput).isEligible).toBe(true);

      // Stricter policy requiring 10 orders -> ineligible (NOT_RATED)
      const strictPolicy: GradePolicyContract = {
        ...OWNER_APPROVED_GRADE_POLICY,
        eligibility: {
          ...OWNER_APPROVED_GRADE_POLICY.eligibility,
          minCompletedOrders: 10,
        },
      };
      const strictResult = checkProductEligibility(productInput, strictPolicy);
      expect(strictResult.isEligible).toBe(false);
      expect(strictResult.status).toBe("NOT_RATED");
      expect(strictResult.primaryReason).toBe("INSUFFICIENT_COMPLETED_ORDERS");
    });

    it("calculates composite score with custom pillar weights", () => {
      const scores = {
        profitability: 100,
        salesPerformance: 50,
        inventoryEfficiency: 50,
        exchangeRisk: 50,
        retailVelocity: 50,
        growthPotential: 50,
        operationalReliability: 50,
      };

      // Baseline weights: profitability is 25%, others sum to 75% * 50 = 37.5. Total = 25 + 37.5 = 62.5
      const baselineComposite = calculateCompositeScore(scores);
      expect(baselineComposite?.score).toBe(62.5);

      // Custom weights: profitability is 70%, others are 5% each (6 * 5% = 30%)
      const customWeights = {
        profitability: 70,
        salesPerformance: 5,
        inventoryEfficiency: 5,
        exchangeRisk: 5,
        retailVelocity: 5,
        growthPotential: 5,
        operationalReliability: 5,
      };
      // Score = (100 * 0.70) + (50 * 0.30) = 70 + 15 = 85.0
      const customComposite = calculateCompositeScore(scores, customWeights);
      expect(customComposite?.score).toBe(85.0);
      expect(customComposite?.weightedContributions.profitability).toBe(70);
    });

    it("maps scores to grade bands using custom band thresholds", () => {
      const score = 82;

      // Baseline bands: A is 80-100 -> score 82 is Grade A
      const baselineBand = mapScoreToGradeBand(score);
      expect(baselineBand?.grade).toBe("A");

      // Custom bands where A starts at 85, B is 70-<85
      const customBands = {
        A: { grade: "A" as const, min: 85, max: 100, label: "A: 85-100" },
        B: { grade: "B" as const, min: 70, max: 85, label: "B: 70-<85" },
        C: { grade: "C" as const, min: 50, max: 70, label: "C: 50-<70" },
        D: { grade: "D" as const, min: 0, max: 50, label: "D: 0-<50" },
      };
      const customBand = mapScoreToGradeBand(score, customBands);
      expect(customBand?.grade).toBe("B");
    });
  });

  // =========================================================================
  // 3. SAFETY GATES & FALLBACK
  // =========================================================================
  describe("3. Safety Gates & Baseline Fallback", () => {
    it("maintains automaticGradingEnabled locked to false in BASELINE_ACTIVE_POLICY", () => {
      expect(BASELINE_ACTIVE_POLICY.automaticGradingEnabled).toBe(false);
      expect(BASELINE_ACTIVE_POLICY.status).toBe("published");
      expect(BASELINE_ACTIVE_POLICY.isActive).toBe(true);
      expect(BASELINE_ACTIVE_POLICY.version).toBe("v1.0.0");
    });

    it("evaluates product grade with automatic grading disabled by default", () => {
      const input = {
        eligibilityInput: {
          product_id: "prod_safe_01",
          operatingHistoryDays: 120,
          completedOrdersCount: 10,
          distinctStoresCount: 8,
          hasHistoricalCost: true,
        },
      };

      const result = evaluateProductGrade(input);
      expect(result.status).toBe("NOT_RATED");
      expect(result.grade).toBe("NOT_RATED");
      expect(result.overallScore).toBeNull();
      expect(result.automaticGradingEnabled).toBe(false);
      expect(result.eligibility.primaryReason).toBe("PENDING_SCORING_NORMALIZATION");
    });

    it("converts PerformancePolicy to GradePolicyContract cleanly", async () => {
      const contract = await policyToContract(BASELINE_ACTIVE_POLICY);
      expect(contract.evaluationPeriodDays).toBe(60);
      expect(contract.eligibility.minOperatingHistoryDays).toBe(60);
      expect(contract.eligibility.minCompletedOrders).toBe(3);
      expect(contract.weights.profitability).toBe(25);
      expect(contract.gradeBands.A.min).toBe(80);
      expect(contract.automaticGradingEnabled).toBe(false);
    });
  });

  // =========================================================================
  // 4. STRUCTURAL PREVIEW & INVARIANT CHECKS
  // =========================================================================
  describe("4. Structural Preview & Invariant Guarantees", () => {
    it("guarantees structural preview never produces speculative A/B/C/D grades", () => {
      // Invariant: Structural preview MUST ONLY project eligibility shifts (NEW, NOT_RATED, GRADED).
      // Under no circumstance should preview fabricate A, B, C, D letter grades.
      const catalogItems = [
        {
          product_id: "p1",
          operatingHistoryDays: 100,
          completedOrdersCount: 5,
          distinctStoresCount: 4,
          hasHistoricalCost: true,
        },
        {
          product_id: "p2",
          operatingHistoryDays: 20, // NEW
          completedOrdersCount: 1,
          distinctStoresCount: 1,
          hasHistoricalCost: true,
        },
        {
          product_id: "p3",
          operatingHistoryDays: 100,
          completedOrdersCount: 5,
          distinctStoresCount: 4,
          hasHistoricalCost: false, // NOT_RATED
        },
      ];

      const baselineContract = policyToContract(BASELINE_ACTIVE_POLICY);
      const results = catalogItems.map((item) => checkProductEligibility(item, baselineContract));

      results.forEach((res) => {
        expect(["NEW", "NOT_RATED", "GRADED"]).toContain(res.status);
        // Assert no A/B/C/D grades are produced by eligibility engine
        expect(["A", "B", "C", "D"]).not.toContain((res as any).grade);
      });

      expect(results[0].status).toBe("GRADED");
      expect(results[1].status).toBe("NEW");
      expect(results[2].status).toBe("NOT_RATED");
    });

    it("enforces strict missing cost policy regardless of pillar weights", () => {
      const missingCostProduct: ProductEligibilityInput = {
        product_id: "prod_no_cost",
        operatingHistoryDays: 365,
        completedOrdersCount: 100,
        distinctStoresCount: 50,
        hasHistoricalCost: false,
      };

      // Even if profitability weight is reduced to 0%, missing landed cost must strictly disqualify from grading
      const zeroProfitabilityPolicy: GradePolicyContract = {
        ...OWNER_APPROVED_GRADE_POLICY,
        weights: {
          ...OWNER_APPROVED_GRADE_POLICY.weights,
          profitability: 0,
          salesPerformance: 45,
        },
      };

      const result = checkProductEligibility(missingCostProduct, zeroProfitabilityPolicy);
      expect(result.isEligible).toBe(false);
      expect(result.status).toBe("NOT_RATED");
      expect(result.primaryReason).toBe("MISSING_HISTORICAL_COST");
    });
  });
});
