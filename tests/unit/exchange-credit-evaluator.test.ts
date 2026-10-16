import { describe, it, expect } from "vitest";
import {
  evaluateCohortEligibility,
  addCalendarDays,
  diffCalendarDays,
  toNewYorkDateString,
  EvaluatorInput,
} from "@/lib/retailer/exchange-credit-evaluator";

describe("Isolated 90-Day Exchange Credit Eligibility Evaluator", () => {
  // Common baseline helper
  function createBaseInput(overrides: Partial<EvaluatorInput> = {}): EvaluatorInput {
    const defaultInput: EvaluatorInput = {
      asOfDate: "2026-09-15", // Default evaluation date (Day 106)
      companyEnrollmentStatus: "active",
      cohort: {
        cohortId: "cohort_001",
        companyId: "company_001",
        storeId: "store_001",
        productId: "prod_001",
        productSku: "SKU-BEAUTY-01",
        sourceOrderId: "order_init_001",
        sourceOrderItemId: "item_init_001",
        totalProtectedQuantity: 100,
        fulfilledProtectedQuantity: 100,
        frozenUnitWholesalePrice: 20.0,
        frozenOptionARate: 0.4,
        frozenOptionBRate: 1.0,
        previouslySettledUnits: 0,
      },
      shipments: [
        {
          shipmentId: "ship_001",
          shipmentDate: "2026-06-01", // Day 0
          deliveredAt: "2026-06-07", // Delivery date distinct from shipment
          quantityShipped: 100,
          quantityDelivered: 100,
          isFirstShipment: true,
          isSplitShipment: false,
          trackingNumber: "TRK-987654",
          carrier: "UPS",
        },
      ],
      weeklyChecks: [
        { reportingWeek: "2026-W23", submittedAt: "2026-06-08", status: "submitted", onHandQuantity: 95 },
        { reportingWeek: "2026-W24", submittedAt: "2026-06-15", status: "submitted", onHandQuantity: 92 },
        { reportingWeek: "2026-W25", submittedAt: "2026-06-22", status: "submitted", onHandQuantity: 88 },
        { reportingWeek: "2026-W26", submittedAt: "2026-06-29", status: "submitted", onHandQuantity: 85 },
        { reportingWeek: "2026-W27", submittedAt: "2026-07-06", status: "submitted", onHandQuantity: 82 },
        { reportingWeek: "2026-W28", submittedAt: "2026-07-13", status: "submitted", onHandQuantity: 80 },
        { reportingWeek: "2026-W29", submittedAt: "2026-07-20", status: "submitted", onHandQuantity: 78 },
        { reportingWeek: "2026-W30", submittedAt: "2026-07-27", status: "submitted", onHandQuantity: 75 },
      ],
      salesEvidence: {
        source: "pos_verified",
        isTrustworthy: true,
        cumulativeSoldUnits: 25, // 25% sell-through (< 50%)
      },
      adjustments: {
        transferredUnits: 0,
        damagedUnits: 0,
        missingUnits: 0,
      },
      reorders: [],
      claimState: {
        lifecycleState: "none",
      },
      currentVerifiedStock: 75,
    };

    return {
      ...defaultInput,
      ...overrides,
      cohort: {
        ...defaultInput.cohort,
        ...(overrides.cohort || {}),
      },
      salesEvidence:
        overrides.salesEvidence !== undefined
          ? overrides.salesEvidence
          : defaultInput.salesEvidence,
      claimState: {
        ...defaultInput.claimState,
        ...(overrides.claimState || {}),
      } as any,
    };
  }

  // -------------------------------------------------------------------------
  // 1. Day 0 Shipment vs Delivery
  // -------------------------------------------------------------------------
  it("determines Day 0 from authoritative shipment date, NOT delivery date", () => {
    const input = createBaseInput({
      shipments: [
        {
          shipmentId: "ship_001",
          shipmentDate: "2026-06-01", // Day 0
          deliveredAt: "2026-06-15", // Delivery was 14 days later
          quantityShipped: 100,
          quantityDelivered: 100,
          isFirstShipment: true,
        },
      ],
    });

    const result = evaluateCohortEligibility(input);

    expect(result.day0Date).toBe("2026-06-01");
    // Day 100 = 2026-06-01 + 100 days = 2026-09-09
    expect(result.evaluationDate).toBe("2026-09-09");
    // Day 150 = 2026-06-01 + 150 days = 2026-10-29
    expect(result.claimDeadlineDate).toBe("2026-10-29");
  });

  // -------------------------------------------------------------------------
  // 2. Day 99 / 100 / 150 / 151 Timeline Boundaries
  // -------------------------------------------------------------------------
  it("evaluates Day 99 as UPCOMING (before Day 100 evaluation cutoff)", () => {
    const input = createBaseInput({
      asOfDate: "2026-09-08", // Day 99
    });
    const result = evaluateCohortEligibility(input);

    expect(result.status).toBe("UPCOMING");
    expect(result.isEligible).toBe(false);
    expect(result.canSubmitClaim).toBe(false);
    expect(result.reasons).toContain("EVALUATION_PENDING");
  });

  it("evaluates Day 100 as ELIGIBLE (start of claim window)", () => {
    const input = createBaseInput({
      asOfDate: "2026-09-09", // Day 100 exactly
    });
    const result = evaluateCohortEligibility(input);

    expect(result.status).toBe("ELIGIBLE");
    expect(result.isEligible).toBe(true);
    expect(result.canSubmitClaim).toBe(true);
    expect(result.isWithinClaimWindow).toBe(true);
  });

  it("evaluates Day 150 as ELIGIBLE (inclusive last day of claim window)", () => {
    const input = createBaseInput({
      asOfDate: "2026-10-29", // Day 150
    });
    const result = evaluateCohortEligibility(input);

    expect(result.status).toBe("ELIGIBLE");
    expect(result.isEligible).toBe(true);
    expect(result.canSubmitClaim).toBe(true);
    expect(result.daysRemainingInClaimWindow).toBe(0);
  });

  it("evaluates Day 151 as EXPIRED (after Day 150 deadline)", () => {
    const input = createBaseInput({
      asOfDate: "2026-10-30", // Day 151
    });
    const result = evaluateCohortEligibility(input);

    expect(result.status).toBe("EXPIRED");
    expect(result.isEligible).toBe(false);
    expect(result.canSubmitClaim).toBe(false);
    expect(result.reasons).toContain("DEADLINE_EXPIRED");
  });

  // -------------------------------------------------------------------------
  // 3. DST Boundary & America/New_York Timezone
  // -------------------------------------------------------------------------
  it("handles DST spring-forward boundary cleanly with calendar day arithmetic", () => {
    // US Spring forward occurred March 8, 2026
    const shipmentDate = "2026-02-15";
    const day100 = addCalendarDays(shipmentDate, 100);
    expect(day100).toBe("2026-05-26");
    expect(diffCalendarDays(shipmentDate, day100)).toBe(100);

    // US Fall back occurs November 1, 2026
    const fallShipment = "2026-08-01";
    const fallDay100 = addCalendarDays(fallShipment, 100);
    expect(fallDay100).toBe("2026-11-09");
    expect(diffCalendarDays(fallShipment, fallDay100)).toBe(100);
  });

  it("evaluates ISO timestamp in America/New_York without hardcoded UTC offset", () => {
    // 2026-09-09T03:30:00Z is 2026-09-08 23:30:00 EDT (Day 99 in NY)
    const inputBeforeMidnight = createBaseInput({
      asOfDate: "2026-09-09T03:30:00Z",
    });
    const resultBefore = evaluateCohortEligibility(inputBeforeMidnight);
    expect(resultBefore.status).toBe("UPCOMING");

    // 2026-09-09T04:00:00Z is 2026-09-09 00:00:00 EDT (Day 100 midnight in NY)
    const inputAtMidnight = createBaseInput({
      asOfDate: "2026-09-09T04:00:00Z",
    });
    const resultAt = evaluateCohortEligibility(inputAtMidnight);
    expect(resultAt.status).toBe("ELIGIBLE");
  });

  // -------------------------------------------------------------------------
  // 4. Eight Distinct Official Weeks Requirement
  // -------------------------------------------------------------------------
  it("passes when exactly 8 distinct official weeks are submitted on or before Day 100", () => {
    const input = createBaseInput();
    const result = evaluateCohortEligibility(input);

    expect(result.distinctReportingWeeksCount).toBe(8);
    expect(result.hasSufficientReportingWeeks).toBe(true);
    expect(result.status).toBe("ELIGIBLE");
  });

  it("fails as NOT_ELIGIBLE with INSUFFICIENT_REPORTING_WEEKS when only 7 weeks submitted", () => {
    const input = createBaseInput({
      weeklyChecks: [
        { reportingWeek: "2026-W23", submittedAt: "2026-06-08", status: "submitted", onHandQuantity: 95 },
        { reportingWeek: "2026-W24", submittedAt: "2026-06-15", status: "submitted", onHandQuantity: 92 },
        { reportingWeek: "2026-W25", submittedAt: "2026-06-22", status: "submitted", onHandQuantity: 88 },
        { reportingWeek: "2026-W26", submittedAt: "2026-06-29", status: "submitted", onHandQuantity: 85 },
        { reportingWeek: "2026-W27", submittedAt: "2026-07-06", status: "submitted", onHandQuantity: 82 },
        { reportingWeek: "2026-W28", submittedAt: "2026-07-13", status: "submitted", onHandQuantity: 80 },
        { reportingWeek: "2026-W29", submittedAt: "2026-07-20", status: "submitted", onHandQuantity: 78 },
        // Only 7 distinct weeks
      ],
    });

    const result = evaluateCohortEligibility(input);
    expect(result.distinctReportingWeeksCount).toBe(7);
    expect(result.hasSufficientReportingWeeks).toBe(false);
    expect(result.status).toBe("NOT_ELIGIBLE");
    expect(result.reasons).toContain("INSUFFICIENT_REPORTING_WEEKS");
  });

  // -------------------------------------------------------------------------
  // 5. Duplicate Official Week Deduplication
  // -------------------------------------------------------------------------
  it("deduplicates multiple submissions for the same official week", () => {
    const input = createBaseInput({
      weeklyChecks: [
        { reportingWeek: "2026-W23", submittedAt: "2026-06-08", status: "submitted", onHandQuantity: 95 },
        { reportingWeek: "2026-W24", submittedAt: "2026-06-15", status: "submitted", onHandQuantity: 92 },
        // Week 25 submitted 3 times:
        { reportingWeek: "2026-W25", submittedAt: "2026-06-22T10:00:00Z", status: "submitted", onHandQuantity: 90 },
        { reportingWeek: "2026-W25", submittedAt: "2026-06-22T14:00:00Z", status: "submitted", onHandQuantity: 88 },
        { reportingWeek: "2026-W25", submittedAt: "2026-06-23T09:00:00Z", status: "submitted", onHandQuantity: 88 },
        { reportingWeek: "2026-W26", submittedAt: "2026-06-29", status: "submitted", onHandQuantity: 85 },
        { reportingWeek: "2026-W27", submittedAt: "2026-07-06", status: "submitted", onHandQuantity: 82 },
        { reportingWeek: "2026-W28", submittedAt: "2026-07-13", status: "submitted", onHandQuantity: 80 },
        { reportingWeek: "2026-W29", submittedAt: "2026-07-20", status: "submitted", onHandQuantity: 78 },
        // Total rows: 9, but distinct weeks: 7
      ],
    });

    const result = evaluateCohortEligibility(input);
    expect(result.distinctReportingWeeksCount).toBe(7);
    expect(result.status).toBe("NOT_ELIGIBLE");
    expect(result.reasons).toContain("INSUFFICIENT_REPORTING_WEEKS");
  });

  // -------------------------------------------------------------------------
  // 6. Missing Inventory Evidence
  // -------------------------------------------------------------------------
  it("returns NEEDS_REVIEW when weekly inventory checks are missing", () => {
    const input = createBaseInput({
      weeklyChecks: [],
    });
    const result = evaluateCohortEligibility(input);

    expect(result.status).toBe("NEEDS_REVIEW");
    expect(result.reasons).toContain("MISSING_INVENTORY_EVIDENCE");
    expect(result.manualReviewRequired).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 7. Sell-Through Threshold: 49% vs Exactly 50% vs 51%
  // -------------------------------------------------------------------------
  it("accepts 49% sell-through as ELIGIBLE (< 50% threshold)", () => {
    const input = createBaseInput({
      cohort: {
        cohortId: "cohort_001",
        companyId: "company_001",
        storeId: "store_001",
        productId: "prod_001",
        productSku: "SKU-01",
        sourceOrderId: "ord_1",
        totalProtectedQuantity: 100,
        fulfilledProtectedQuantity: 100,
        frozenUnitWholesalePrice: 20,
        frozenOptionARate: 0.4,
      },
      salesEvidence: {
        source: "pos_verified",
        isTrustworthy: true,
        cumulativeSoldUnits: 49, // 49%
      },
      currentVerifiedStock: 51,
    });

    const result = evaluateCohortEligibility(input);
    expect(result.sellThrough.isBelow50PercentThreshold).toBe(true);
    expect(result.status).toBe("ELIGIBLE");
  });

  it("strictly rejects exactly 50.00% sell-through as NOT_ELIGIBLE", () => {
    const input = createBaseInput({
      cohort: {
        cohortId: "cohort_001",
        companyId: "company_001",
        storeId: "store_001",
        productId: "prod_001",
        productSku: "SKU-01",
        sourceOrderId: "ord_1",
        totalProtectedQuantity: 100,
        fulfilledProtectedQuantity: 100,
        frozenUnitWholesalePrice: 20,
        frozenOptionARate: 0.4,
      },
      salesEvidence: {
        source: "pos_verified",
        isTrustworthy: true,
        cumulativeSoldUnits: 50, // Exactly 50%
      },
      currentVerifiedStock: 50,
    });

    const result = evaluateCohortEligibility(input);
    expect(result.sellThrough.isBelow50PercentThreshold).toBe(false);
    expect(result.status).toBe("NOT_ELIGIBLE");
    expect(result.reasons).toContain("EXCESS_SELL_THROUGH");
  });

  it("strictly rejects 51% sell-through as NOT_ELIGIBLE", () => {
    const input = createBaseInput({
      salesEvidence: {
        source: "pos_verified",
        isTrustworthy: true,
        cumulativeSoldUnits: 51, // 51%
      },
      currentVerifiedStock: 49,
    });

    const result = evaluateCohortEligibility(input);
    expect(result.sellThrough.isBelow50PercentThreshold).toBe(false);
    expect(result.status).toBe("NOT_ELIGIBLE");
    expect(result.reasons).toContain("EXCESS_SELL_THROUGH");
  });

  // -------------------------------------------------------------------------
  // 8. Sales Evidence Unavailable (Truthful Data Sourcing)
  // -------------------------------------------------------------------------
  it("returns NEEDS_REVIEW instead of fabricating sales when sales evidence is untrusted", () => {
    const input = createBaseInput({
      salesEvidence: {
        source: "unverified",
        isTrustworthy: false,
        evidenceNotes: "POS integration pending at store",
      },
    });

    const result = evaluateCohortEligibility(input);
    expect(result.status).toBe("NEEDS_REVIEW");
    expect(result.reasons).toContain("UNVERIFIED_SALES_EVIDENCE");
    expect(result.manualReviewRequired).toBe(true);
    expect(result.sellThrough.soldUnits).toBeNull();
  });

  // -------------------------------------------------------------------------
  // 9. Transfer and Damage Adjustments
  // -------------------------------------------------------------------------
  it("accounts for transfers and damages without fabricating sales numbers", () => {
    const input = createBaseInput({
      cohort: {
        cohortId: "cohort_001",
        companyId: "company_001",
        storeId: "store_001",
        productId: "prod_001",
        productSku: "SKU-01",
        sourceOrderId: "ord_1",
        totalProtectedQuantity: 100,
        fulfilledProtectedQuantity: 100,
        frozenUnitWholesalePrice: 20,
        frozenOptionARate: 0.4,
      },
      salesEvidence: {
        source: "pos_verified",
        isTrustworthy: true,
        cumulativeSoldUnits: 30, // 30 units sold (30%)
      },
      adjustments: {
        transferredUnits: 15, // 15 transferred to other store
        damagedUnits: 5,      // 5 damaged
        missingUnits: 0,
      },
      currentVerifiedStock: 50, // 100 - 30 - 15 - 5 = 50 remaining
    });

    const result = evaluateCohortEligibility(input);
    expect(result.status).toBe("ELIGIBLE");
    expect(result.sellThrough.soldUnits).toBe(30);
    expect(result.quantities.maxClaimableQuantity).toBe(50);
  });

  it("flags CONTRADICTORY_INVENTORY_EVIDENCE if sold + adjustments exceed fulfilled units", () => {
    const input = createBaseInput({
      cohort: {
        cohortId: "cohort_001",
        companyId: "company_001",
        storeId: "store_001",
        productId: "prod_001",
        productSku: "SKU-01",
        sourceOrderId: "ord_1",
        totalProtectedQuantity: 100,
        fulfilledProtectedQuantity: 100,
        frozenUnitWholesalePrice: 20,
        frozenOptionARate: 0.4,
      },
      salesEvidence: {
        source: "pos_verified",
        isTrustworthy: true,
        cumulativeSoldUnits: 70,
      },
      adjustments: {
        transferredUnits: 40, // 70 + 40 = 110 > 100 fulfilled!
      },
    });

    const result = evaluateCohortEligibility(input);
    expect(result.status).toBe("NEEDS_REVIEW");
    expect(result.reasons).toContain("CONTRADICTORY_INVENTORY_EVIDENCE");
  });

  // -------------------------------------------------------------------------
  // 10. Cross-Store Reorder vs Same-Store Reorder
  // -------------------------------------------------------------------------
  it("does NOT disqualify when a reorder is placed by a DIFFERENT store under the same company", () => {
    const input = createBaseInput({
      reorders: [
        {
          orderId: "ord_other_store_01",
          storeId: "store_002", // Different store!
          productId: "prod_001", // Same product
          orderDate: "2026-07-15",
          status: "confirmed",
          quantity: 50,
        },
      ],
    });

    const result = evaluateCohortEligibility(input);
    expect(result.status).toBe("ELIGIBLE");
    expect(result.reasons).not.toContain("DISQUALIFIED_REORDERED");
  });

  it("disqualifies as NOT_ELIGIBLE when a confirmed reorder is placed for the SAME store and product", () => {
    const input = createBaseInput({
      reorders: [
        {
          orderId: "ord_reorder_01",
          storeId: "store_001", // Same store!
          productId: "prod_001", // Same product!
          orderDate: "2026-07-15",
          status: "confirmed",
          quantity: 50,
        },
      ],
    });

    const result = evaluateCohortEligibility(input);
    expect(result.status).toBe("NOT_ELIGIBLE");
    expect(result.reasons).toContain("DISQUALIFIED_REORDERED");
  });

  // -------------------------------------------------------------------------
  // 11. Cancelled/Draft/Cart Reorders
  // -------------------------------------------------------------------------
  it("does NOT disqualify when reorder is in cart, draft, or cancelled status", () => {
    const input = createBaseInput({
      reorders: [
        {
          orderId: "cart_01",
          storeId: "store_001",
          productId: "prod_001",
          orderDate: "2026-07-10",
          status: "cart",
        },
        {
          orderId: "ord_cancelled_01",
          storeId: "store_001",
          productId: "prod_001",
          orderDate: "2026-07-20",
          status: "cancelled",
        },
      ],
    });

    const result = evaluateCohortEligibility(input);
    expect(result.status).toBe("ELIGIBLE");
    expect(result.reasons).not.toContain("DISQUALIFIED_REORDERED");
  });

  // -------------------------------------------------------------------------
  // 12. Authorized Split Shipment of Initial Order
  // -------------------------------------------------------------------------
  it("does NOT disqualify an authorized split shipment of the initial order", () => {
    const input = createBaseInput({
      reorders: [
        {
          orderId: "split_shipment_leg_2",
          storeId: "store_001",
          productId: "prod_001",
          orderDate: "2026-06-20",
          status: "delivered",
          isSplitShipmentOfInitial: true, // Authorized split shipment
        },
      ],
    });

    const result = evaluateCohortEligibility(input);
    expect(result.status).toBe("ELIGIBLE");
    expect(result.reasons).not.toContain("DISQUALIFIED_REORDERED");
  });

  // -------------------------------------------------------------------------
  // 13. Company Pause Rule: Paused Enrollment Does NOT Invalidate Existing Cohort
  // -------------------------------------------------------------------------
  it("preserves eligibility of existing protected cohorts when company enrollment is PAUSED", () => {
    const input = createBaseInput({
      companyEnrollmentStatus: "paused",
    });

    const result = evaluateCohortEligibility(input);
    expect(result.status).toBe("ELIGIBLE");
    expect(result.canSubmitClaim).toBe(true);
    expect(result.provenance.enrollmentStatus).toBe("paused");
  });

  // -------------------------------------------------------------------------
  // 14. Frozen Baseline Financial Terms
  // -------------------------------------------------------------------------
  it("strictly honors frozen baseline terms (Option A rate 35%, Wholesale price $25)", () => {
    const input = createBaseInput({
      cohort: {
        cohortId: "cohort_001",
        companyId: "company_001",
        storeId: "store_001",
        productId: "prod_001",
        productSku: "SKU-01",
        sourceOrderId: "ord_1",
        totalProtectedQuantity: 100,
        fulfilledProtectedQuantity: 100,
        frozenUnitWholesalePrice: 25.0, // Frozen $25
        frozenOptionARate: 0.35,        // Frozen 35%
        frozenOptionBRate: 1.0,
      },
      currentVerifiedStock: 50,
      selectedClaimQuantity: 20,
    });

    const result = evaluateCohortEligibility(input);
    expect(result.credits.unitWholesalePrice).toBe(25.0);
    expect(result.credits.optionARate).toBe(0.35);
    // Option A credit: 20 * 25 * 0.35 = $175.00
    expect(result.credits.estimatedCreditOptionA).toBe(175.0);
    // Option B credit: 20 * 25 * 1.0 = $500.00
    expect(result.credits.estimatedCreditOptionB).toBe(500.0);
  });

  // -------------------------------------------------------------------------
  // 15. Partial Fulfillment Protection
  // -------------------------------------------------------------------------
  it("evaluates protection against actual fulfilled quantity (partial fulfillment)", () => {
    const input = createBaseInput({
      cohort: {
        cohortId: "cohort_001",
        companyId: "company_001",
        storeId: "store_001",
        productId: "prod_001",
        productSku: "SKU-01",
        sourceOrderId: "ord_1",
        totalProtectedQuantity: 100,
        fulfilledProtectedQuantity: 60, // Only 60 shipped/fulfilled
        frozenUnitWholesalePrice: 20,
        frozenOptionARate: 0.4,
      },
      salesEvidence: {
        source: "pos_verified",
        isTrustworthy: true,
        cumulativeSoldUnits: 20, // 20 / 60 = 33.3% (< 50%)
      },
      currentVerifiedStock: 40,
    });

    const result = evaluateCohortEligibility(input);
    expect(result.status).toBe("ELIGIBLE");
    expect(result.quantities.fulfilledProtectedQuantity).toBe(60);
    expect(result.quantities.maxClaimableQuantity).toBe(40);
  });

  // -------------------------------------------------------------------------
  // 16. Current Stock Below Day 100 Stock
  // -------------------------------------------------------------------------
  it("caps maximum claimable quantity at validated current stock if lower than Day 100", () => {
    const input = createBaseInput({
      currentVerifiedStock: 30, // Current store physical inventory is 30
    });

    const result = evaluateCohortEligibility(input);
    expect(result.status).toBe("ELIGIBLE");
    expect(result.quantities.maxClaimableQuantity).toBe(30);
  });

  // -------------------------------------------------------------------------
  // 17. Partial Quantity Claim Selection
  // -------------------------------------------------------------------------
  it("allows selecting any positive integer quantity up to max claimable quantity", () => {
    const input = createBaseInput({
      currentVerifiedStock: 75,
      selectedClaimQuantity: 30, // Partial selection (30 out of 75)
    });

    const result = evaluateCohortEligibility(input);
    expect(result.quantities.isClaimQuantityValid).toBe(true);
    expect(result.credits.selectedQuantity).toBe(30);
    // Option A: 30 * 20 * 0.40 = $240.00
    expect(result.credits.estimatedCreditOptionA).toBe(240.0);
    // Option B: 30 * 20 * 1.0 = $600.00
    expect(result.credits.estimatedCreditOptionB).toBe(600.0);
  });

  // -------------------------------------------------------------------------
  // 18. Quantity Overflow Error
  // -------------------------------------------------------------------------
  it("rejects claim when requested quantity exceeds validated maximum claimable", () => {
    const input = createBaseInput({
      currentVerifiedStock: 50,
      selectedClaimQuantity: 55, // Exceeds 50!
    });

    const result = evaluateCohortEligibility(input);
    expect(result.quantities.isClaimQuantityValid).toBe(false);
    expect(result.quantities.quantityValidationError).toBe("QUANTITY_EXCEEDS_MAX");
  });

  // -------------------------------------------------------------------------
  // 19. Draft Claim Lifecycle
  // -------------------------------------------------------------------------
  it("treats draft claim as non-locking, allowing eligibility evaluation", () => {
    const input = createBaseInput({
      claimState: {
        lifecycleState: "draft",
      },
    });

    const result = evaluateCohortEligibility(input);
    expect(result.status).toBe("ELIGIBLE");
    expect(result.canSubmitClaim).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 20. Submitted Pending Claim (Concurrency Lock)
  // -------------------------------------------------------------------------
  it("locks cohort with CLAIM_PENDING when a claim is currently submitted and under review", () => {
    const input = createBaseInput({
      claimState: {
        lifecycleState: "submitted",
        claimId: "claim_001",
      },
    });

    const result = evaluateCohortEligibility(input);
    expect(result.status).toBe("CLAIM_PENDING");
    expect(result.canSubmitClaim).toBe(false);
    expect(result.reasons).toContain("CLAIM_ALREADY_PENDING");
  });

  // -------------------------------------------------------------------------
  // 21. Cancelled Claim Resubmission Before Day 150
  // -------------------------------------------------------------------------
  it("allows resubmission of cancelled claim before Day 150 when no credit was issued", () => {
    const input = createBaseInput({
      asOfDate: "2026-10-15", // Before Day 150
      claimState: {
        lifecycleState: "cancelled", // Cancelled due to input error
        creditIssued: false,
        physicalReturnReceived: false,
      },
    });

    const result = evaluateCohortEligibility(input);
    expect(result.status).toBe("ELIGIBLE");
    expect(result.canSubmitClaim).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 22. Final Denial (Rejected Claim Cannot Resubmit)
  // -------------------------------------------------------------------------
  it("prevents resubmission when a previous claim was finally REJECTED", () => {
    const input = createBaseInput({
      claimState: {
        lifecycleState: "rejected",
      },
    });

    const result = evaluateCohortEligibility(input);
    expect(result.status).toBe("CLAIM_REJECTED");
    expect(result.canSubmitClaim).toBe(false);
    expect(result.reasons).toContain("CLAIM_ALREADY_REJECTED");
  });

  // -------------------------------------------------------------------------
  // 23. Completed/Settled Claim
  // -------------------------------------------------------------------------
  it("marks settled claims as CLAIM_SETTLED and prevents duplicate submission", () => {
    const input = createBaseInput({
      claimState: {
        lifecycleState: "settled",
        creditIssued: true,
      },
    });

    const result = evaluateCohortEligibility(input);
    expect(result.status).toBe("CLAIM_SETTLED");
    expect(result.canSubmitClaim).toBe(false);
    expect(result.reasons).toContain("CLAIM_ALREADY_SETTLED");
  });

  // -------------------------------------------------------------------------
  // 24. Contract Test: Concurrent Submission Constraint
  // -------------------------------------------------------------------------
  it("strictly enforces canSubmitClaim contract flag across all lifecycle states", () => {
    const states = ["submitted", "under_review", "settled", "rejected"] as const;
    for (const state of states) {
      const input = createBaseInput({
        claimState: { lifecycleState: state },
      });
      const result = evaluateCohortEligibility(input);
      expect(result.canSubmitClaim).toBe(false);
    }
  });

  // -------------------------------------------------------------------------
  // 25. Option A Variable Rate (20% to 50% Clamping)
  // -------------------------------------------------------------------------
  it("clamps Option A rate between 20% and 50% correctly", () => {
    // Test lower clamp: 10% should clamp to 20%
    const inputLow = createBaseInput({
      cohort: {
        cohortId: "c1",
        companyId: "comp1",
        storeId: "s1",
        productId: "p1",
        productSku: "SKU1",
        sourceOrderId: "o1",
        totalProtectedQuantity: 10,
        fulfilledProtectedQuantity: 10,
        frozenUnitWholesalePrice: 100,
        frozenOptionARate: 0.1, // Too low
      },
      currentVerifiedStock: 10,
    });
    const resultLow = evaluateCohortEligibility(inputLow);
    expect(resultLow.credits.optionARate).toBe(0.2);

    // Test upper clamp: 60% should clamp to 50%
    const inputHigh = createBaseInput({
      cohort: {
        cohortId: "c1",
        companyId: "comp1",
        storeId: "s1",
        productId: "p1",
        productSku: "SKU1",
        sourceOrderId: "o1",
        totalProtectedQuantity: 10,
        fulfilledProtectedQuantity: 10,
        frozenUnitWholesalePrice: 100,
        frozenOptionARate: 0.6, // Too high
      },
      currentVerifiedStock: 10,
    });
    const resultHigh = evaluateCohortEligibility(inputHigh);
    expect(resultHigh.credits.optionARate).toBe(0.5);
  });

  // -------------------------------------------------------------------------
  // 26. Option B 100% Estimate Formula
  // -------------------------------------------------------------------------
  it("calculates Option B estimated credit as exactly 100% of frozen wholesale value", () => {
    const input = createBaseInput({
      cohort: {
        cohortId: "c1",
        companyId: "comp1",
        storeId: "s1",
        productId: "p1",
        productSku: "SKU1",
        sourceOrderId: "o1",
        totalProtectedQuantity: 50,
        fulfilledProtectedQuantity: 50,
        frozenUnitWholesalePrice: 17.5,
        frozenOptionARate: 0.4,
      },
      currentVerifiedStock: 40,
      selectedClaimQuantity: 40,
    });

    const result = evaluateCohortEligibility(input);
    expect(result.credits.estimatedCreditOptionB).toBe(700.0); // 40 * 17.50 * 1.0 = 700.00
  });

  // -------------------------------------------------------------------------
  // 27. Contradictory Inputs (Negative Stock, Negative Sales)
  // -------------------------------------------------------------------------
  it("flags CONTRADICTORY_SALES_EVIDENCE when cumulative sales is negative", () => {
    const input = createBaseInput({
      salesEvidence: {
        source: "pos_verified",
        isTrustworthy: true,
        cumulativeSoldUnits: -5, // Impossible negative sales
      },
    });

    const result = evaluateCohortEligibility(input);
    expect(result.status).toBe("NEEDS_REVIEW");
    expect(result.reasons).toContain("CONTRADICTORY_SALES_EVIDENCE");
    expect(result.manualReviewRequired).toBe(true);
  });

  it("flags CONTRADICTORY_INVENTORY_EVIDENCE when negative on-hand stock is reported", () => {
    const input = createBaseInput({
      weeklyChecks: [
        { reportingWeek: "2026-W23", submittedAt: "2026-06-08", status: "submitted", onHandQuantity: -2 }, // Contradictory
      ],
    });

    const result = evaluateCohortEligibility(input);
    expect(result.status).toBe("NEEDS_REVIEW");
    expect(result.reasons).toContain("CONTRADICTORY_INVENTORY_EVIDENCE");
  });

  it("flags MISSING_SHIPMENT_EVIDENCE when shipments array is empty", () => {
    const input = createBaseInput({
      shipments: [],
    });

    const result = evaluateCohortEligibility(input);
    expect(result.status).toBe("NEEDS_REVIEW");
    expect(result.reasons).toContain("MISSING_SHIPMENT_EVIDENCE");
    expect(result.day0Date).toBeNull();
  });

  // -------------------------------------------------------------------------
  // 28. Deterministic Day 100 Snapshot
  // -------------------------------------------------------------------------
  it("generates a complete, immutable Day 100 snapshot payload", () => {
    const input = createBaseInput();
    const result = evaluateCohortEligibility(input);

    expect(result.day100Snapshot).not.toBeNull();
    const snap = result.day100Snapshot!;
    expect(snap.snapshotVersion).toBe("2.0.0");
    expect(snap.cohortId).toBe("cohort_001");
    expect(snap.day0Date).toBe("2026-06-01");
    expect(snap.trialEndDate).toBe("2026-08-30");
    expect(snap.evaluationDate).toBe("2026-09-09");
    expect(snap.claimDeadlineDate).toBe("2026-10-29");
    expect(snap.distinctReportingWeeksCount).toBe(8);
    expect(snap.cumulativeSoldUnits).toBe(25);
    expect(snap.sellThroughRate).toBe(25.0);
    expect(snap.isDay100Eligible).toBe(true);
    expect(snap.day100Status).toBe("ELIGIBLE");
  });
});
