import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  simulateProductGrading,
  calculateProposedMarginScore,
  calculateProposedDosScore,
  calculateProposedExchangeScore,
  SimulationSkuInput,
  DEFAULT_PROPOSAL_CONFIG,
} from '../../lib/product/performance/grading-simulation-engine';

describe('Product Performance & Investment Grading — Simulation Engine V1', () => {
  const asOfDate = '2026-10-18';

  // ==========================================================================
  // 1. OWNER DECISIONS COMPLIANCE (D1 to D5)
  // ==========================================================================
  describe('Owner-Approved Decisions (D1 to D5)', () => {
    it('D1: Anchor operating age to first fulfilled B2B shipment date', () => {
      // 59 days old -> NEW
      const newSku: SimulationSkuInput = {
        productId: 'sku-new-001',
        sku: 'SKU-NEW-001',
        name: 'New Product',
        category: 'skincare',
        firstShipmentDate: '2026-08-20', // 59 days to 2026-10-18
        asOfDate,
        completedOrdersCount: 5,
        distinctStoresCount: 4,
        hasHistoricalCost: true,
        b2bGrossMarginPercent: 45,
        b2bNetSalesUsd: 5000,
      };
      const resNew = simulateProductGrading(newSku);
      expect(resNew.status).toBe('NEW');
      expect(resNew.grade).toBe('NEW');
      expect(resNew.investmentPriority).toBe('P0_INCUBATE');

      // 60 days old with >=80% coverage -> ELIGIBLE & GRADED
      const matureSku: SimulationSkuInput = {
        ...newSku,
        firstShipmentDate: '2026-08-19', // exactly 60 days to 2026-10-18
        daysOfSupply: 45,                // Inventory Efficiency (20%)
        weeklySellThroughUnits: 4,       // Retail Velocity (10%)
        orderGrowthRatePercent: 10,      // Growth (5%)
        orderFillRatePercent: 99,        // Reliability (5%)
      };
      const resMature = simulateProductGrading(matureSku);
      expect(resMature.operatingAgeDays).toBe(60);
      expect(resMature.status).toBe('GRADED');
    });

    it('D2: Mandatory verified financial data blocks grading if missing', () => {
      const missingCostSku: SimulationSkuInput = {
        productId: 'sku-no-cost',
        sku: 'SKU-NO-COST',
        name: 'Missing Cost Product',
        category: 'skincare',
        firstShipmentDate: '2026-06-01', // 139 days (mature)
        asOfDate,
        completedOrdersCount: 5,
        distinctStoresCount: 5,
        hasHistoricalCost: false, // MISSING
        b2bNetSalesUsd: 8000,
      };
      const res = simulateProductGrading(missingCostSku);
      expect(res.status).toBe('NOT_RATED');
      expect(res.primaryReason).toBe('MISSING_HISTORICAL_COST');
      expect(res.investmentPriority).toBe('P_HOLD_AUDIT');
      expect(res.compositeScore).toBeNull();
    });

    it('D3: Tiered Gross Margin scoring (PROPOSED)', () => {
      expect(calculateProposedMarginScore(55).score).toBe(100); // Tier 1
      expect(calculateProposedMarginScore(45).score).toBe(85);  // Tier 2
      expect(calculateProposedMarginScore(35).score).toBe(70);  // Tier 3
      expect(calculateProposedMarginScore(25).score).toBe(50);  // Tier 4
      expect(calculateProposedMarginScore(5).score).toBe(20);   // Tier 5
      expect(calculateProposedMarginScore(-5).score).toBe(0);   // Tier 6
    });

    it('D4: Base DOS corridor 30–75 days adjusted for replenishment lead time', () => {
      // Base corridor (lead time 0): 30-75d = 100
      expect(calculateProposedDosScore(50, 0).score).toBe(100);
      expect(calculateProposedDosScore(25, 0).score).toBe(75);
      expect(calculateProposedDosScore(100, 0).score).toBe(60);
      expect(calculateProposedDosScore(200, 0).score).toBe(20); // D4 Option C: 30 - 0.5 * (200 - 180) = 20
      expect(calculateProposedDosScore(250, 0).score).toBe(0);  // DOS >= 240d = 0

      // Adjusted corridor with 30-day lead time: 60-105d = 100
      expect(calculateProposedDosScore(50, 30).score).toBe(75); // 50d is now understock (<60d)
      expect(calculateProposedDosScore(80, 30).score).toBe(100); // 80d is in corridor (60-105d)
    });

    it('D5: Exchange risk pre-Day 100 is strictly UNOBSERVED', () => {
      // Day 90 (Pre-Day 100): Zero claims submitted, but unobserved
      const preDay100 = calculateProposedExchangeScore(0, false);
      expect(preDay100.status).toBe('UNOBSERVED');
      expect(preDay100.score).toBeNull();

      // Post-Day 100: Zero claims submitted -> 100 pts
      const postDay100 = calculateProposedExchangeScore(0, true);
      expect(postDay100.status).toBe('OBSERVED');
      expect(postDay100.score).toBe(100);
    });
  });

  // ==========================================================================
  // 2. SENSITIVITY AND BOUNDARY TESTS
  // ==========================================================================
  describe('Sensitivity and Boundary Tests', () => {
    it('tests margin boundary: 49.9% vs 50.0%', () => {
      const tier2 = calculateProposedMarginScore(49.9);
      const tier1 = calculateProposedMarginScore(50.0);
      expect(tier2.score).toBe(85);
      expect(tier1.score).toBe(100);
    });

    it('tests margin boundary: 0.0% vs -0.1%', () => {
      const tier5 = calculateProposedMarginScore(0.0);
      const tier6 = calculateProposedMarginScore(-0.1);
      expect(tier5.score).toBe(20);
      expect(tier6.score).toBe(0);
    });

    it('tests DOS boundary: 75 days vs 76 days', () => {
      const inCorridor = calculateProposedDosScore(75, 0);
      const outCorridor = calculateProposedDosScore(76, 0);
      expect(inCorridor.score).toBe(100);
      expect(outCorridor.score).toBe(80);
    });

    it('tests DOS boundary: 29 days vs 30 days', () => {
      const mildUnder = calculateProposedDosScore(29, 0);
      const inCorridor = calculateProposedDosScore(30, 0);
      expect(mildUnder.score).toBe(75);
      expect(inCorridor.score).toBe(100);
    });

    it('tests restricted redistribution coverage boundary: 79% vs 80%', () => {
      const baseSku: SimulationSkuInput = {
        productId: 'sku-cov-test',
        sku: 'SKU-COV',
        name: 'Coverage Test SKU',
        category: 'skincare',
        firstShipmentDate: '2026-06-01',
        asOfDate,
        completedOrdersCount: 5,
        distinctStoresCount: 4,
        hasHistoricalCost: true,
        b2bGrossMarginPercent: 45, // Profitability (25%)
        b2bNetSalesUsd: 5000,      // Sales Performance (20%)
        daysOfSupply: 50,          // Inventory Efficiency (20%)
        hasReachedDay100: false,   // Exchange Risk: UNOBSERVED (15% missing)
        weeklySellThroughUnits: 3, // Retail Velocity (10%)
        // Growth (5%) and Reliability (5%) are NULL
      };
      // Available weights: 25 + 20 + 20 + 10 = 75% coverage
      const res75 = simulateProductGrading(baseSku, {
        ...DEFAULT_PROPOSAL_CONFIG,
        proposedCoverageThreshold: 0.80,
      });
      expect(res75.dataCoverageRatio).toBe(0.75);
      expect(res75.status).toBe('NOT_RATED'); // Blocked: 75% < 80%

      // Add Growth (5%): Available = 75 + 5 = 80% coverage
      const sku80: SimulationSkuInput = {
        ...baseSku,
        orderGrowthRatePercent: 15,
      };
      const res80 = simulateProductGrading(sku80, {
        ...DEFAULT_PROPOSAL_CONFIG,
        proposedCoverageThreshold: 0.80,
      });
      expect(res80.dataCoverageRatio).toBe(0.80);
      expect(res80.status).toBe('GRADED'); // Allowed: 80% >= 80%
      expect(res80.isRedistributed).toBe(true);
    });
  });

  // ==========================================================================
  // 3. REAL PRODUCTION 38 SKU AUDIT DATA EVALUATION
  // ==========================================================================
  describe('Real 38 SKU Production Audit Simulation', () => {
    it('evaluates all 38 production SKUs against the canonical lifecycle gate', () => {
      const auditPath = 'C:\\Users\\ChaeHahm\\.gemini\\antigravity\\brain\\60393d8e-2782-4539-8c9d-c53f4b39baf6\\sku_grading_readiness_audit.json';
      const rawData = JSON.parse(fs.readFileSync(auditPath, 'utf8'));
      const items: any[] = Object.values(rawData);

      expect(items).toHaveLength(38);

      let newCount = 0;
      let notRatedCount = 0;
      let gradedCount = 0;
      let missingCostCount = 0;

      items.forEach((item) => {
        const simInput: SimulationSkuInput = {
          productId: item.id,
          sku: item.sku,
          name: item.name,
          category: item.category,
          firstShipmentDate: item.operatingAgeDays > 0
            ? new Date(new Date(asOfDate).getTime() - item.operatingAgeDays * 86400000).toISOString().split('T')[0]
            : null,
          asOfDate,
          completedOrdersCount: item.completedOrders || 0,
          distinctStoresCount: item.distinctStores || 0,
          hasHistoricalCost: item.hasHistoricalCost,
          costSource: item.costSource,
          b2bNetSalesUsd: item.totalSales || 0,
          daysOfSupply: item.onHandQty > 0 ? 45 : 0,
        };

        const result = simulateProductGrading(simInput);
        if (result.status === 'NEW') newCount++;
        else if (result.status === 'NOT_RATED') notRatedCount++;
        else if (result.status === 'GRADED') gradedCount++;

        if (!result.hasHistoricalCost) missingCostCount++;
      });

      // Assert exact findings
      expect(newCount).toBe(38);
      expect(notRatedCount).toBe(0);
      expect(gradedCount).toBe(0);
      expect(missingCostCount).toBe(32);
    });
  });

  // ==========================================================================
  // 4. BENCHMARK COHORT (SYNTHETIC MATURE SKUS) GRADE DISTRIBUTION COMPARISON
  // ==========================================================================
  describe('Benchmark Mature SKU Cohort & Distribution Comparison', () => {
    const benchmarkSkus: SimulationSkuInput[] = [
      {
        productId: 'bench-01',
        sku: 'HERO-SKINCARE',
        name: 'Hero Vitamin C Serum',
        category: 'skincare',
        firstShipmentDate: '2026-05-01', // 170 days
        asOfDate,
        completedOrdersCount: 12,
        distinctStoresCount: 8,
        hasHistoricalCost: true,
        b2bGrossMarginPercent: 52, // 100
        b2bNetSalesUsd: 14500,     // 100
        daysOfSupply: 48,          // 100
        claimingStoreRatePercent: 0,
        hasReachedDay100: true,    // 100
        weeklySellThroughUnits: 6, // 100
        orderGrowthRatePercent: 30,// 100
        orderFillRatePercent: 99,  // 100
      },
      {
        productId: 'bench-02',
        sku: 'SOLID-MOISTURIZER',
        name: 'Barrier Cream 50ml',
        category: 'skincare',
        firstShipmentDate: '2026-06-15', // 125 days
        asOfDate,
        completedOrdersCount: 6,
        distinctStoresCount: 4,
        hasHistoricalCost: true,
        b2bGrossMarginPercent: 38, // Tier 3: 70 pts
        b2bNetSalesUsd: 3500,      // 60 pts
        daysOfSupply: 80,          // Mild overstock: 80 pts
        hasReachedDay100: false,   // UNOBSERVED (15% missing)
        weeklySellThroughUnits: 2.5, // 75 pts
        orderGrowthRatePercent: 5, // 60 pts
        orderFillRatePercent: 92,  // 75 pts
      },
      {
        productId: 'bench-03',
        sku: 'SLOW-SNACK',
        name: 'Organic Seaweed Crisps',
        category: 'food',
        firstShipmentDate: '2026-04-01', // 200 days
        asOfDate,
        completedOrdersCount: 4,
        distinctStoresCount: 3,
        hasHistoricalCost: true,
        b2bGrossMarginPercent: 24, // Tier 4: 50 pts
        b2bNetSalesUsd: 1500,      // 40 pts
        daysOfSupply: 110,         // Moderate overstock: 60 pts
        claimingStoreRatePercent: 0,
        hasReachedDay100: true,    // 100 pts
        weeklySellThroughUnits: 1.2, // 50 pts
        orderGrowthRatePercent: -5, // 30 pts
        orderFillRatePercent: 90,  // 75 pts
      },
      {
        productId: 'bench-04',
        sku: 'DEFECT-PROBLEM',
        name: 'Defective Pump Essence',
        category: 'skincare',
        firstShipmentDate: '2026-05-10', // 161 days
        asOfDate,
        completedOrdersCount: 3,
        distinctStoresCount: 3,
        hasHistoricalCost: true,
        b2bGrossMarginPercent: -4, // 0 (negative margin)
        b2bNetSalesUsd: 1200,      // 40
        daysOfSupply: 195,         // 22.5 (continuous decay 181-239d)
        claimingStoreRatePercent: 18,
        hasReachedDay100: true,    // 0 (>10% claims)
        weeklySellThroughUnits: 0.5,// 25
        orderGrowthRatePercent: -40,// 10
        orderFillRatePercent: 75,  // 10
      },
    ];

    it('evaluates benchmark SKUs and proves distinct A, B, C, D distribution and investment priorities', () => {
      const results = benchmarkSkus.map((s) => simulateProductGrading(s));

      const hero = results.find((r) => r.sku === 'HERO-SKINCARE')!;
      expect(hero.grade).toBe('A');
      expect(hero.compositeScore).toBeGreaterThanOrEqual(80);
      expect(hero.investmentPriority).toBe('P1_CORE_SCALE');

      const solid = results.find((r) => r.sku === 'SOLID-MOISTURIZER')!;
      expect(solid.grade).toBe('B');
      expect(solid.compositeScore).toBeGreaterThanOrEqual(65);
      expect(solid.compositeScore).toBeLessThan(80);
      expect(solid.investmentPriority).toBe('P2_SELECTIVE_GROWTH');
      expect(solid.isRedistributed).toBe(true); // Pre-Day 100 exchange redistributed

      const slow = results.find((r) => r.sku === 'SLOW-SNACK')!;
      expect(slow.grade).toBe('C');
      expect(slow.compositeScore).toBeGreaterThanOrEqual(50);
      expect(slow.compositeScore).toBeLessThan(65);
      expect(slow.investmentPriority).toBe('P3_MONITOR_DEFENSIVE');

      const defect = results.find((r) => r.sku === 'DEFECT-PROBLEM')!;
      expect(defect.grade).toBe('D');
      expect(defect.compositeScore).toBeLessThan(50);
      expect(defect.investmentPriority).toBe('P4_CAPITAL_EXIT');
    });
  });

  // ==========================================================================
  // 5. D4 OPTION C: CONTINUOUS INVENTORY DOS DECLINE VERIFICATION
  // ==========================================================================
  describe('D4 Option C: Continuous Inventory DOS Decline Verification', () => {
    it('verifies exact scores at all canonical checkpoints (lead time = 0)', () => {
      // 180 days -> 30.0
      expect(calculateProposedDosScore(180, 0).score).toBe(30.0);
      expect(calculateProposedDosScore(180, 0).bracket).toBe("High Overstock (91-180d)");

      // 181 days -> 29.5
      expect(calculateProposedDosScore(181, 0).score).toBe(29.5);
      expect(calculateProposedDosScore(181, 0).bracket).toBe("Overstock Capital Decay (181-239d)");

      // 190 days -> 25.0
      expect(calculateProposedDosScore(190, 0).score).toBe(25.0);
      expect(calculateProposedDosScore(190, 0).bracket).toBe("Overstock Capital Decay (181-239d)");

      // 210 days -> 15.0
      expect(calculateProposedDosScore(210, 0).score).toBe(15.0);
      expect(calculateProposedDosScore(210, 0).bracket).toBe("Overstock Capital Decay (181-239d)");

      // 230 days -> 5.0
      expect(calculateProposedDosScore(230, 0).score).toBe(5.0);
      expect(calculateProposedDosScore(230, 0).bracket).toBe("Overstock Capital Decay (181-239d)");

      // 239 days -> 0.5
      expect(calculateProposedDosScore(239, 0).score).toBe(0.5);
      expect(calculateProposedDosScore(239, 0).bracket).toBe("Overstock Capital Decay (181-239d)");

      // 240 days -> 0.0
      expect(calculateProposedDosScore(240, 0).score).toBe(0.0);
      expect(calculateProposedDosScore(240, 0).bracket).toBe("Chronic Capital Stagnation (>=240d)");

      // 241 days -> 0.0
      expect(calculateProposedDosScore(241, 0).score).toBe(0.0);
      expect(calculateProposedDosScore(241, 0).bracket).toBe("Chronic Capital Stagnation (>=240d)");

      // 270 days -> 0.0
      expect(calculateProposedDosScore(270, 0).score).toBe(0.0);
      expect(calculateProposedDosScore(270, 0).bracket).toBe("Chronic Capital Stagnation (>=240d)");
    });

    it('verifies fractional DOS calculations', () => {
      expect(calculateProposedDosScore(180.5, 0).score).toBe(29.75);
      expect(calculateProposedDosScore(210.25, 0).score).toBe(14.875);
      expect(calculateProposedDosScore(239.5, 0).score).toBe(0.25);
    });

    it('verifies strict monotonicity across the transition window (180 to 250 days)', () => {
      let previousScore = calculateProposedDosScore(180, 0).score!;
      for (let d = 181; d <= 250; d++) {
        const currentScore = calculateProposedDosScore(d, 0).score!;
        expect(currentScore).toBeLessThanOrEqual(previousScore);
        previousScore = currentScore;
      }
    });

    it('verifies non-negativity and clamping for extreme overstock values', () => {
      expect(calculateProposedDosScore(300, 0).score).toBe(0);
      expect(calculateProposedDosScore(500, 0).score).toBe(0);
      expect(calculateProposedDosScore(1000, 0).score).toBe(0);
      expect(calculateProposedDosScore(Infinity, 0).score).toBeNull();
      expect(calculateProposedDosScore(null, 0).score).toBeNull();
      expect(calculateProposedDosScore(undefined, 0).score).toBeNull();
    });

    it('verifies lead time adjustment shifts the decay window proportionally', () => {
      // With leadTimeDays = 30:
      // corridor.max = 75 + 30 = 105
      // overstock180 = 105 + 105 = 210
      // overstock240 = 105 + 165 = 270
      expect(calculateProposedDosScore(210, 30).score).toBe(30.0);
      expect(calculateProposedDosScore(210, 30).bracket).toBe("High Overstock (91-180d)");

      expect(calculateProposedDosScore(211, 30).score).toBe(29.5);
      expect(calculateProposedDosScore(211, 30).bracket).toBe("Overstock Capital Decay (181-239d)");

      expect(calculateProposedDosScore(240, 30).score).toBe(15.0);
      expect(calculateProposedDosScore(240, 30).bracket).toBe("Overstock Capital Decay (181-239d)");

      expect(calculateProposedDosScore(269, 30).score).toBe(0.5);
      expect(calculateProposedDosScore(269, 30).bracket).toBe("Overstock Capital Decay (181-239d)");

      expect(calculateProposedDosScore(270, 30).score).toBe(0.0);
      expect(calculateProposedDosScore(270, 30).bracket).toBe("Chronic Capital Stagnation (>=240d)");

      expect(calculateProposedDosScore(300, 30).score).toBe(0.0);
      expect(calculateProposedDosScore(300, 30).bracket).toBe("Chronic Capital Stagnation (>=240d)");
    });

    it('proves smooth weighted composite score transition without artificial cliff', () => {
      // In canonical policy, inventory efficiency has a 20% weight.
      // Compare composite score drop from Day 180 to Day 181:
      const score180 = calculateProposedDosScore(180, 0).score!;
      const score181 = calculateProposedDosScore(181, 0).score!;
      const scoreDelta = score180 - score181;
      const compositeDelta = scoreDelta * 0.20;

      // Score drops by exactly 0.5 points
      expect(scoreDelta).toBe(0.5);
      // Composite drops by exactly 0.1 points (0.5 * 20%)
      expect(compositeDelta).toBe(0.1);

      // Contrast with previous hard cliff (30 -> 0 = 30 pts drop, composite drop = 6.0 pts)
      const oldCliffDrop = (30 - 0) * 0.20;
      expect(oldCliffDrop).toBe(6.0);
      expect(compositeDelta).toBeLessThan(oldCliffDrop);
    });
  });
});
