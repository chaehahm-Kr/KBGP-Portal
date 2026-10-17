/**
 * tests/unit/protection-aggregation.test.ts
 * Unit Tests for ADM-PROTECTION-AGG-001: Correct Company and Store Movement Aggregation
 *
 * Verifies:
 * 1. One Company / multiple Stores isolation
 * 2. Company aggregate without Store breakdown (Company total never duplicated into store rows)
 * 3. Store-specific reports with verified allocations
 * 4. Partial and missing reports (missing values remain null, never converted to 0)
 * 5. Deduplication of multiple submissions for the same reporting week
 * 6. Bottom-up store totals vs. company-level baseline preservation
 * 7. Incomplete inventory evidence handling (Insufficient Data / null movement)
 * 8. Accurate Store Participation Rate vs. Weekly Reporting Coverage
 */

import { describe, it, expect } from "vitest";
import {
  aggregateProtectionMovement,
  type WeeklyCheckInput,
} from "../../lib/protection/aggregation";

describe("ADM-PROTECTION-AGG-001: Protection Movement Aggregation Engine", () => {
  const mockStores = [
    { id: "store-01", name: "Test Store 01" },
    { id: "store-02", name: "Test Store 02" },
  ];
  const targetProductId = "prod-har-001";

  it("Scenario 1: Company aggregate without Store breakdown — NEVER duplicates company total into store rows", () => {
    // 24 units protected at company level, 8 units company baseline (e.g. TEST-HAR-001)
    // Neither store has submitted weekly checks for this product
    const result = aggregateProtectionMovement({
      productId: targetProductId,
      companyProtectedQuantity: 24,
      stores: mockStores,
      weeklyChecks: [], // No store-level checks
      companyBaselineMovement: 8,
    });

    // Company level metrics
    expect(result.companyProtectedQuantity).toBe(24);
    expect(result.companyEstimatedMovement).toBe(8);
    expect(result.sellThroughPercent).toBe(33); // 8 / 24 = 33%
    expect(result.movementBasis).toBe("company_level_baseline");

    // Store participation
    expect(result.totalStores).toBe(2);
    expect(result.storesReporting).toBe(0);
    expect(result.storeParticipationRate).toBe(0);
    expect(result.isStoreBreakdownAvailable).toBe(false);

    // CRITICAL: Individual store rows MUST NOT duplicate the 8 units!
    expect(result.storeBreakdown).toHaveLength(2);
    for (const sb of result.storeBreakdown) {
      expect(sb.estimatedMovement).toBeNull(); // Insufficient Data, NOT 8!
      expect(sb.currentRemainingQty).toBeNull(); // Unreported, NOT 16!
      expect(sb.reportingStatus).toBe("missing");
      expect(sb.movementEvidence).toBe("insufficient_data");
    }
  });

  it("Scenario 2: Partial reporting — One store reports, one store missing (missing value is not 0)", () => {
    const weeklyChecks: WeeklyCheckInput[] = [
      {
        id: "check-1",
        storeId: "store-01",
        reportingWeek: "2026-W40",
        reportDate: "2026-10-01",
        status: "submitted",
        submittedAt: "2026-10-01T10:00:00Z",
        items: [
          {
            productId: targetProductId,
            reportedRemainingQty: 5,
            isCounted: true,
          },
        ],
      },
    ];

    const result = aggregateProtectionMovement({
      productId: targetProductId,
      companyProtectedQuantity: 24,
      stores: mockStores,
      weeklyChecks,
      storeInitialAllocations: {
        "store-01": 12,
        // store-02 initial quantity unknown
      },
      companyBaselineMovement: 8,
    });

    expect(result.totalStores).toBe(2);
    expect(result.storesReporting).toBe(1);
    expect(result.storeParticipationRate).toBe(50); // 1 / 2 = 50%

    // Store 01 (Reported & Allocated)
    const store1 = result.storeBreakdown.find((s) => s.storeId === "store-01")!;
    expect(store1.reportingStatus).toBe("reported");
    expect(store1.currentRemainingQty).toBe(5);
    expect(store1.initialQuantity).toBe(12);
    expect(store1.estimatedMovement).toBe(7); // 12 initial - 5 remaining = 7 moved
    expect(store1.movementEvidence).toBe("verified_store_check");
    expect(store1.lastCheckDate).toBe("2026-10-01");

    // Store 02 (Missing)
    const store2 = result.storeBreakdown.find((s) => s.storeId === "store-02")!;
    expect(store2.reportingStatus).toBe("missing");
    expect(store2.currentRemainingQty).toBeNull(); // MUST NOT default to 0!
    expect(store2.estimatedMovement).toBeNull();
    expect(store2.movementEvidence).toBe("insufficient_data");
  });

  it("Scenario 3: Complete bottom-up store reporting — Aggregates store totals cleanly", () => {
    const weeklyChecks: WeeklyCheckInput[] = [
      {
        id: "check-1",
        storeId: "store-01",
        reportingWeek: "2026-W42",
        reportDate: "2026-10-15",
        status: "submitted",
        items: [{ productId: targetProductId, reportedRemainingQty: 4, isCounted: true }],
      },
      {
        id: "check-2",
        storeId: "store-02",
        reportingWeek: "2026-W42",
        reportDate: "2026-10-15",
        status: "approved",
        items: [{ productId: targetProductId, reportedRemainingQty: 6, isCounted: true }],
      },
    ];

    const result = aggregateProtectionMovement({
      productId: targetProductId,
      companyProtectedQuantity: 24,
      stores: mockStores,
      weeklyChecks,
      storeInitialAllocations: {
        "store-01": 12,
        "store-02": 12,
      },
    });

    expect(result.storesReporting).toBe(2);
    expect(result.storeParticipationRate).toBe(100);

    const s1 = result.storeBreakdown.find((s) => s.storeId === "store-01")!;
    expect(s1.estimatedMovement).toBe(8); // 12 - 4 = 8

    const s2 = result.storeBreakdown.find((s) => s.storeId === "store-02")!;
    expect(s2.estimatedMovement).toBe(6); // 12 - 6 = 6

    // Company level should be sum of stores (8 + 6 = 14)
    expect(result.companyEstimatedMovement).toBe(14);
    expect(result.sellThroughPercent).toBe(58); // 14 / 24 = 58.3% -> 58%
    expect(result.movementBasis).toBe("aggregated_store_checks");
  });

  it("Scenario 4: Duplicate reporting weeks — Deduplicates and takes latest submission", () => {
    const weeklyChecks: WeeklyCheckInput[] = [
      {
        id: "check-w42-v1",
        storeId: "store-01",
        reportingWeek: "2026-W42",
        reportDate: "2026-10-14",
        status: "submitted",
        submittedAt: "2026-10-14T08:00:00Z",
        items: [{ productId: targetProductId, reportedRemainingQty: 10, isCounted: true }],
      },
      {
        id: "check-w42-v2", // Revised submission later the same day
        storeId: "store-01",
        reportingWeek: "2026-W42",
        reportDate: "2026-10-14",
        status: "submitted",
        submittedAt: "2026-10-14T16:00:00Z",
        items: [{ productId: targetProductId, reportedRemainingQty: 7, isCounted: true }],
      },
    ];

    const result = aggregateProtectionMovement({
      productId: targetProductId,
      companyProtectedQuantity: 12,
      stores: [{ id: "store-01", name: "Test Store 01" }],
      weeklyChecks,
      storeInitialAllocations: { "store-01": 12 },
    });

    const s1 = result.storeBreakdown[0];
    expect(s1.submittedWeeksCount).toBe(1); // Deduplicated to 1 week!
    expect(s1.currentRemainingQty).toBe(7); // Used latest submission v2
    expect(s1.estimatedMovement).toBe(5); // 12 - 7 = 5 (NOT 12 - 10)
  });

  it("Scenario 5: Incomplete inventory evidence — Store reports count but initial allocation was never unbundled", () => {
    // Store reported 5 units remaining, but company order was placed as a bulk 50 units with no store split
    const weeklyChecks: WeeklyCheckInput[] = [
      {
        id: "check-1",
        storeId: "store-01",
        reportingWeek: "2026-W41",
        reportDate: "2026-10-08",
        status: "submitted",
        items: [{ productId: targetProductId, reportedRemainingQty: 5, isCounted: true }],
      },
    ];

    const result = aggregateProtectionMovement({
      productId: targetProductId,
      companyProtectedQuantity: 50,
      stores: mockStores,
      weeklyChecks,
      // No storeInitialAllocations provided!
    });

    const s1 = result.storeBreakdown.find((s) => s.storeId === "store-01")!;
    expect(s1.reportingStatus).toBe("reported");
    expect(s1.currentRemainingQty).toBe(5);
    // Since initial store quantity is unknown, estimatedMovement MUST NOT be guessed or divided proportionally!
    expect(s1.estimatedMovement).toBeNull();
    expect(s1.movementEvidence).toBe("insufficient_data");
  });

  it("Scenario 6: Draft checks are ignored — Only submitted or approved checks count as evidence", () => {
    const weeklyChecks: WeeklyCheckInput[] = [
      {
        id: "check-draft",
        storeId: "store-01",
        reportingWeek: "2026-W41",
        reportDate: "2026-10-08",
        status: "draft", // Unsubmitted draft!
        items: [{ productId: targetProductId, reportedRemainingQty: 2, isCounted: true }],
      },
    ];

    const result = aggregateProtectionMovement({
      productId: targetProductId,
      companyProtectedQuantity: 24,
      stores: mockStores,
      weeklyChecks,
    });

    const s1 = result.storeBreakdown.find((s) => s.storeId === "store-01")!;
    expect(s1.reportingStatus).toBe("missing");
    expect(s1.currentRemainingQty).toBeNull();
    expect(s1.estimatedMovement).toBeNull();
  });

  it("Scenario 7: Weekly Reporting Coverage distinguishes Store Participation Rate from time coverage", () => {
    // 2 stores, 12 weeks expected trial window (24 total expected weekly checks)
    // Store 01 submitted 6 weeks
    // Store 02 submitted 0 weeks
    const checks: WeeklyCheckInput[] = [];
    for (let w = 1; w <= 6; w++) {
      checks.push({
        id: `chk-${w}`,
        storeId: "store-01",
        reportingWeek: `2026-W${30 + w}`,
        reportDate: `2026-08-${10 + w}`,
        status: "submitted",
        items: [{ productId: targetProductId, reportedRemainingQty: 10 - w, isCounted: true }],
      });
    }

    const result = aggregateProtectionMovement({
      productId: targetProductId,
      companyProtectedQuantity: 24,
      stores: mockStores,
      weeklyChecks: checks,
      expectedWeeksCount: 12,
    });

    // 1 of 2 stores participated
    expect(result.storeParticipationRate).toBe(50);
    // 6 weeks received out of 24 expected weeks across all stores = 25% weekly coverage
    expect(result.weeklyReportingCoverage).toBe(25);
  });
});
