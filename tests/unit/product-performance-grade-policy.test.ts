/**
 * Product Performance V2.0 — Grade Policy Contract & Eligibility Engine Unit Tests
 * Task ID: ADM-SALES-PERF-003-R3
 * Location: tests/unit/product-performance-grade-policy.test.ts
 */

import { describe, it, expect } from "vitest";
import {
  OWNER_APPROVED_GRADE_POLICY,
  validateGradePolicyIntegrity,
  checkProductEligibility,
  mapScoreToGradeBand,
  calculateCompositeScore,
  evaluateProductGrade,
} from "../../lib/product/performance/grade-policy";
import type {
  ProductEligibilityInput,
  PillarScoresInput,
} from "../../lib/product/performance/grade-policy";

describe("Product Performance V2.0 — Grade Policy Contract & Eligibility Engine", () => {
  // =========================================================================
  // 1. POLICY CONTRACT INTEGRITY
  // =========================================================================
  describe("1. Policy Contract & Constants Integrity", () => {
    it("satisfies the Owner-approved evaluation period of 60 days", () => {
      expect(OWNER_APPROVED_GRADE_POLICY.evaluationPeriodDays).toBe(60);
    });

    it("satisfies Owner-approved eligibility criteria thresholds", () => {
      const { eligibility } = OWNER_APPROVED_GRADE_POLICY;
      expect(eligibility.minOperatingHistoryDays).toBe(60);
      expect(eligibility.minCompletedOrders).toBe(3);
      expect(eligibility.minDistinctStores).toBe(3);
      expect(eligibility.missingHistoricalCostPolicy).toBe("N/A");
    });

    it("verifies that grade weights sum to exactly 100%", () => {
      const integrity = validateGradePolicyIntegrity();
      expect(integrity.isValid).toBe(true);
      expect(integrity.totalWeight).toBe(100);
      expect(integrity.bandErrors).toEqual([]);
    });

    it("codifies exact Owner-approved pillar weights", () => {
      const { weights } = OWNER_APPROVED_GRADE_POLICY;
      expect(weights.profitability).toBe(25);
      expect(weights.salesPerformance).toBe(20);
      expect(weights.inventoryEfficiency).toBe(20);
      expect(weights.exchangeRisk).toBe(15);
      expect(weights.retailVelocity).toBe(10);
      expect(weights.growthPotential).toBe(5);
      expect(weights.operationalReliability).toBe(5);
    });

    it("codifies contiguous non-overlapping grade bands A (80-100), B (65-<80), C (50-<65), D (0-<50)", () => {
      const { A, B, C, D } = OWNER_APPROVED_GRADE_POLICY.gradeBands;
      expect(A.min).toBe(80);
      expect(A.max).toBe(100);
      expect(B.min).toBe(65);
      expect(B.max).toBe(80);
      expect(C.min).toBe(50);
      expect(C.max).toBe(65);
      expect(D.min).toBe(0);
      expect(D.max).toBe(50);
    });

    it("verifies automatic grading is strictly disabled by default pending normalization approval", () => {
      expect(OWNER_APPROVED_GRADE_POLICY.automaticGradingEnabled).toBe(false);
    });
  });

  // =========================================================================
  // 2. ELIGIBILITY ENGINE: OPERATING HISTORY & NEW CLASSIFICATION
  // =========================================================================
  describe("2. Operating History & NEW Classification", () => {
    it("classifies products with < 60 days operating history as NEW", () => {
      const input: ProductEligibilityInput = {
        product_id: "prod_new_01",
        operatingHistoryDays: 45,
        completedOrdersCount: 5,
        distinctStoresCount: 4,
        hasHistoricalCost: true,
      };

      const res = checkProductEligibility(input);
      expect(res.isEligible).toBe(false);
      expect(res.status).toBe("NEW");
      expect(res.primaryReason).toBe("INSUFFICIENT_OPERATING_HISTORY");
      expect(res.allReasons).toContain("INSUFFICIENT_OPERATING_HISTORY");
      expect(res.metrics.operatingHistoryDays).toBe(45);
      expect(res.message).toContain("NEW");
    });

    it("classifies products with exactly 59 days as NEW (strict boundary)", () => {
      const input: ProductEligibilityInput = {
        product_id: "prod_new_59",
        operatingHistoryDays: 59,
        completedOrdersCount: 3,
        distinctStoresCount: 3,
        hasHistoricalCost: true,
      };

      const res = checkProductEligibility(input);
      expect(res.isEligible).toBe(false);
      expect(res.status).toBe("NEW");
      expect(res.primaryReason).toBe("INSUFFICIENT_OPERATING_HISTORY");
    });

    it("qualifies products with exactly 60 days operating history", () => {
      const input: ProductEligibilityInput = {
        product_id: "prod_mature_60",
        operatingHistoryDays: 60,
        completedOrdersCount: 3,
        distinctStoresCount: 3,
        hasHistoricalCost: true,
      };

      const res = checkProductEligibility(input);
      expect(res.isEligible).toBe(true);
      expect(res.status).toBe("GRADED");
      expect(res.allReasons).toEqual([]);
    });

    it("calculates operating history from launchDate and asOfDate if operatingHistoryDays is omitted", () => {
      const input: ProductEligibilityInput = {
        product_id: "prod_date_calc",
        launchDate: "2026-08-01",
        asOfDate: "2026-10-15", // 75 days difference
        completedOrdersCount: 10,
        distinctStoresCount: 5,
        hasHistoricalCost: true,
      };

      const res = checkProductEligibility(input);
      expect(res.metrics.operatingHistoryDays).toBe(75);
      expect(res.isEligible).toBe(true);
    });
  });

  // =========================================================================
  // 3. ELIGIBILITY ENGINE: COMPLETED ORDERS & DISTINCT STORES
  // =========================================================================
  describe("3. Orders & Stores Ineligibility Reasons", () => {
    it("flags products with < 3 completed orders as NOT_RATED (INSUFFICIENT_COMPLETED_ORDERS)", () => {
      const input: ProductEligibilityInput = {
        product_id: "prod_low_orders",
        operatingHistoryDays: 90,
        completedOrdersCount: 2, // Required >= 3
        distinctStoresCount: 4,
        hasHistoricalCost: true,
      };

      const res = checkProductEligibility(input);
      expect(res.isEligible).toBe(false);
      expect(res.status).toBe("NOT_RATED");
      expect(res.primaryReason).toBe("INSUFFICIENT_COMPLETED_ORDERS");
      expect(res.allReasons).toEqual(["INSUFFICIENT_COMPLETED_ORDERS"]);
    });

    it("flags products with < 3 distinct stores as NOT_RATED (INSUFFICIENT_DISTINCT_STORES)", () => {
      const input: ProductEligibilityInput = {
        product_id: "prod_low_stores",
        operatingHistoryDays: 90,
        completedOrdersCount: 5,
        distinctStoresCount: 2, // Required >= 3
        hasHistoricalCost: true,
      };

      const res = checkProductEligibility(input);
      expect(res.isEligible).toBe(false);
      expect(res.status).toBe("NOT_RATED");
      expect(res.primaryReason).toBe("INSUFFICIENT_DISTINCT_STORES");
      expect(res.allReasons).toEqual(["INSUFFICIENT_DISTINCT_STORES"]);
    });
  });

  // =========================================================================
  // 4. ELIGIBILITY ENGINE: MISSING HISTORICAL COST (N/A POLICY)
  // =========================================================================
  describe("4. Missing Historical Cost Policy (N/A)", () => {
    it("flags products with missing historical cost as NOT_RATED (MISSING_HISTORICAL_COST)", () => {
      const input: ProductEligibilityInput = {
        product_id: "prod_missing_cost",
        operatingHistoryDays: 120,
        completedOrdersCount: 15,
        distinctStoresCount: 8,
        hasHistoricalCost: false, // Landed cost unavailable
      };

      const res = checkProductEligibility(input);
      expect(res.isEligible).toBe(false);
      expect(res.status).toBe("NOT_RATED");
      expect(res.primaryReason).toBe("MISSING_HISTORICAL_COST");
      expect(res.message).toContain("Historical landed cost is missing");
    });
  });

  // =========================================================================
  // 5. MULTIPLE DEFECTS & PRIORITY PRESERVATION
  // =========================================================================
  describe("5. Multiple Defects & Diagnostics Preservation", () => {
    it("preserves all failure reasons when multiple thresholds fail", () => {
      const input: ProductEligibilityInput = {
        product_id: "prod_multi_fail",
        operatingHistoryDays: 20, // < 60 (NEW)
        completedOrdersCount: 1,  // < 3
        distinctStoresCount: 1,   // < 3
        hasHistoricalCost: false, // missing cost
      };

      const res = checkProductEligibility(input);
      expect(res.isEligible).toBe(false);
      expect(res.status).toBe("NEW");
      expect(res.primaryReason).toBe("INSUFFICIENT_OPERATING_HISTORY");
      expect(res.allReasons).toHaveLength(4);
      expect(res.allReasons).toEqual([
        "INSUFFICIENT_OPERATING_HISTORY",
        "MISSING_HISTORICAL_COST",
        "INSUFFICIENT_COMPLETED_ORDERS",
        "INSUFFICIENT_DISTINCT_STORES",
      ]);
    });

    it("prioritizes MISSING_HISTORICAL_COST over low orders for mature products", () => {
      const input: ProductEligibilityInput = {
        product_id: "prod_cost_and_orders",
        operatingHistoryDays: 90,
        completedOrdersCount: 1,
        distinctStoresCount: 1,
        hasHistoricalCost: false,
      };

      const res = checkProductEligibility(input);
      expect(res.status).toBe("NOT_RATED");
      expect(res.primaryReason).toBe("MISSING_HISTORICAL_COST");
      expect(res.allReasons).toContain("MISSING_HISTORICAL_COST");
      expect(res.allReasons).toContain("INSUFFICIENT_COMPLETED_ORDERS");
      expect(res.allReasons).toContain("INSUFFICIENT_DISTINCT_STORES");
    });
  });

  // =========================================================================
  // 6. GRADE-BAND MAPPING
  // =========================================================================
  describe("6. Grade-Band Mapping Pure Function", () => {
    it("maps 80–100 to Grade A", () => {
      expect(mapScoreToGradeBand(100)?.grade).toBe("A");
      expect(mapScoreToGradeBand(85)?.grade).toBe("A");
      expect(mapScoreToGradeBand(80)?.grade).toBe("A");
    });

    it("maps 65–<80 to Grade B", () => {
      expect(mapScoreToGradeBand(79.99)?.grade).toBe("B");
      expect(mapScoreToGradeBand(72)?.grade).toBe("B");
      expect(mapScoreToGradeBand(65)?.grade).toBe("B");
    });

    it("maps 50–<65 to Grade C", () => {
      expect(mapScoreToGradeBand(64.99)?.grade).toBe("C");
      expect(mapScoreToGradeBand(55)?.grade).toBe("C");
      expect(mapScoreToGradeBand(50)?.grade).toBe("C");
    });

    it("maps 0–<50 to Grade D", () => {
      expect(mapScoreToGradeBand(49.99)?.grade).toBe("D");
      expect(mapScoreToGradeBand(25)?.grade).toBe("D");
      expect(mapScoreToGradeBand(0)?.grade).toBe("D");
    });

    it("handles boundary clamping for >100 and <0", () => {
      expect(mapScoreToGradeBand(105)?.grade).toBe("A");
      expect(mapScoreToGradeBand(-10)?.grade).toBe("D");
    });

    it("returns null for invalid / null / NaN inputs", () => {
      expect(mapScoreToGradeBand(null)).toBeNull();
      expect(mapScoreToGradeBand(undefined)).toBeNull();
      expect(mapScoreToGradeBand(Number.NaN)).toBeNull();
    });
  });

  // =========================================================================
  // 7. COMPOSITE SCORE CALCULATION
  // =========================================================================
  describe("7. Composite Score Weighted Calculation", () => {
    it("computes exact composite score matching Owner weights", () => {
      const pillarScores: PillarScoresInput = {
        profitability: 100,         // 100 * 25% = 25.0
        salesPerformance: 80,       // 80 * 20%  = 16.0
        inventoryEfficiency: 70,    // 70 * 20%  = 14.0
        exchangeRisk: 90,           // 90 * 15%  = 13.5
        retailVelocity: 60,         // 60 * 10%  = 6.0
        growthPotential: 50,        // 50 * 5%   = 2.5
        operationalReliability: 40, // 40 * 5%   = 2.0
      };

      const res = calculateCompositeScore(pillarScores);
      expect(res).not.toBeNull();
      expect(res?.score).toBe(79.0); // 25 + 16 + 14 + 13.5 + 6 + 2.5 + 2 = 79.0
      expect(res?.weightedContributions.profitability).toBe(25.0);
      expect(res?.weightedContributions.salesPerformance).toBe(16.0);
      expect(res?.weightedContributions.inventoryEfficiency).toBe(14.0);
      expect(res?.weightedContributions.exchangeRisk).toBe(13.5);
      expect(res?.weightedContributions.retailVelocity).toBe(6.0);
      expect(res?.weightedContributions.growthPotential).toBe(2.5);
      expect(res?.weightedContributions.operationalReliability).toBe(2.0);
    });

    it("returns null if any of the 7 pillars is missing or invalid", () => {
      const incompletePillars: PillarScoresInput = {
        profitability: 80,
        salesPerformance: 70,
        // inventoryEfficiency missing
        exchangeRisk: 90,
        retailVelocity: 60,
        growthPotential: 50,
        operationalReliability: 40,
      };

      expect(calculateCompositeScore(incompletePillars)).toBeNull();
    });
  });

  // =========================================================================
  // 8. MASTER EVALUATION & AUTOMATIC GRADE GATING
  // =========================================================================
  describe("8. Full Grade Evaluation & Safety Gating", () => {
    it("outputs NEW grade for new products without running scoring", () => {
      const res = evaluateProductGrade({
        eligibilityInput: {
          product_id: "prod_new",
          operatingHistoryDays: 30,
          completedOrdersCount: 2,
          distinctStoresCount: 2,
          hasHistoricalCost: true,
        },
      });

      expect(res.status).toBe("NEW");
      expect(res.grade).toBe("NEW");
      expect(res.overallScore).toBeNull();
      expect(res.gradeBand).toBeNull();
      expect(res.automaticGradingEnabled).toBe(false);
    });

    it("outputs NOT_RATED for ineligible products", () => {
      const res = evaluateProductGrade({
        eligibilityInput: {
          product_id: "prod_ineligible",
          operatingHistoryDays: 90,
          completedOrdersCount: 1, // < 3
          distinctStoresCount: 5,
          hasHistoricalCost: true,
        },
      });

      expect(res.status).toBe("NOT_RATED");
      expect(res.grade).toBe("NOT_RATED");
      expect(res.overallScore).toBeNull();
    });

    it("strictly gates eligible products as NOT_RATED (PENDING_SCORING_NORMALIZATION) when automatic grading is OFF", () => {
      const res = evaluateProductGrade({
        eligibilityInput: {
          product_id: "prod_eligible_pending",
          operatingHistoryDays: 100,
          completedOrdersCount: 8,
          distinctStoresCount: 6,
          hasHistoricalCost: true,
        },
      });

      expect(res.status).toBe("NOT_RATED");
      expect(res.grade).toBe("NOT_RATED");
      expect(res.overallScore).toBeNull();
      expect(res.automaticGradingEnabled).toBe(false);
      expect(res.eligibility.primaryReason).toBe("PENDING_SCORING_NORMALIZATION");
      expect(res.statusMessage).toContain("automatic grades are gated until scoring normalization curves receive Owner sign-off");
    });

    it("evaluates and grades correctly when manual pillar scores are explicitly provided and permitted", () => {
      const res = evaluateProductGrade({
        eligibilityInput: {
          product_id: "prod_manual_scored",
          operatingHistoryDays: 120,
          completedOrdersCount: 10,
          distinctStoresCount: 7,
          hasHistoricalCost: true,
        },
        allowManualPillarScores: true,
        pillarScores: {
          profitability: 95,          // 23.75
          salesPerformance: 85,        // 17.00
          inventoryEfficiency: 80,     // 16.00
          exchangeRisk: 90,            // 13.50
          retailVelocity: 75,          // 7.50
          growthPotential: 70,         // 3.50
          operationalReliability: 80,  // 4.00 -> Total: 85.25 (Grade A)
        },
      });

      expect(res.status).toBe("GRADED");
      expect(res.grade).toBe("A");
      expect(res.overallScore).toBe(85.25);
      expect(res.gradeBand?.grade).toBe("A");
      expect(res.gradeBand?.label).toBe("A: 80–100");
      expect(res.pillarScores?.profitability).toBe(95);
      expect(res.weightedContributions?.profitability).toBe(23.75);
    });

    it("refuses to grade an ineligible product even if manual pillar scores are passed", () => {
      const res = evaluateProductGrade({
        eligibilityInput: {
          product_id: "prod_ineligible_attempt",
          operatingHistoryDays: 30, // NEW!
          completedOrdersCount: 10,
          distinctStoresCount: 5,
          hasHistoricalCost: true,
        },
        allowManualPillarScores: true,
        pillarScores: {
          profitability: 100,
          salesPerformance: 100,
          inventoryEfficiency: 100,
          exchangeRisk: 100,
          retailVelocity: 100,
          growthPotential: 100,
          operationalReliability: 100,
        },
      });

      expect(res.status).toBe("NEW");
      expect(res.grade).toBe("NEW");
      expect(res.overallScore).toBeNull();
    });
  });
});
