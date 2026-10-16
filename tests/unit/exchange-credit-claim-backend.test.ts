import { describe, it, expect } from "vitest";
import { validateClaimPayload } from "@/lib/retailer/exchange-credit-claim-pure";
import { SubmitClaimInput } from "@/lib/retailer/exchange-credit-claim-types";

describe("Exchange Credit Claim Backend Validation & Business Rules", () => {
  // Helper to create valid mock cohort bundle
  function createMockCohortBundle(overrides: {
    cohortId?: string;
    storeId?: string;
    productId?: string;
    wholesalePrice?: number;
    optionARate?: number;
    fulfilledQuantity?: number;
    currentStock?: number;
    soldUnits?: number;
    reportingWeeksCount?: number;
    hasReorder?: boolean;
    existingClaimStatus?: string;
    isSalesTrustworthy?: boolean;
  } = {}) {
    const cohortId = overrides.cohortId || "cohort_001";
    const storeId = overrides.storeId || "store_001";
    const productId = overrides.productId || "prod_001";
    const wholesalePrice = overrides.wholesalePrice ?? 20.0;
    const optionARate = overrides.optionARate ?? 0.4;
    const fulfilledQuantity = overrides.fulfilledQuantity ?? 100;
    const currentStock = overrides.currentStock ?? 75;
    const soldUnits = overrides.soldUnits ?? 25; // 25% sold (< 50%)
    const reportingWeeksCount = overrides.reportingWeeksCount ?? 8;

    const weeklyChecks = [];
    for (let i = 1; i <= reportingWeeksCount; i++) {
      weeklyChecks.push({
        reportingWeek: `2026-W${String(20 + i).padStart(2, "0")}`,
        submittedAt: `2026-06-${String(i * 7).padStart(2, "0")}`,
        status: "submitted" as const,
        onHandQuantity: currentStock,
      });
    }

    const reorders = overrides.hasReorder
      ? [
          {
            orderId: "ord_reorder_01",
            storeId,
            productId,
            orderDate: "2026-07-15",
            status: "confirmed",
          },
        ]
      : [];

    return {
      cohort: {
        id: cohortId,
        company_id: "company_001",
        store_id: storeId,
        product_id: productId,
        product_sku: `SKU-${productId}`,
        source_order_id: "ord_init_001",
        total_protected_quantity: fulfilledQuantity,
        fulfilled_protected_quantity: fulfilledQuantity,
        frozen_unit_wholesale_price: wholesalePrice,
        frozen_option_a_rate: optionARate,
      },
      shipments: [
        {
          shipmentId: "ship_001",
          shipmentDate: "2026-06-01", // Day 0
          quantityShipped: fulfilledQuantity,
          isFirstShipment: true,
        },
      ],
      weeklyChecks,
      salesEvidence: {
        source: "pos_verified" as const,
        isTrustworthy: overrides.isSalesTrustworthy ?? true,
        cumulativeSoldUnits: soldUnits,
      },
      reorders,
      existingClaimState: overrides.existingClaimStatus
        ? { lifecycleState: overrides.existingClaimStatus as any }
        : undefined,
    };
  }

  // -------------------------------------------------------------------------
  // 1. Valid Single-SKU Claim
  // -------------------------------------------------------------------------
  it("successfully validates a valid single-SKU claim with Option A", () => {
    const bundle = createMockCohortBundle({
      cohortId: "cohort_001",
      wholesalePrice: 25.0,
      optionARate: 0.4,
      currentStock: 60,
    });

    const input: SubmitClaimInput = {
      storeId: "store_001",
      isStockReconfirmed: true,
      items: [
        {
          cohortId: "cohort_001",
          productId: "prod_001",
          selectedOption: "A",
          selectedQuantity: 30, // 30 units out of 60
          currentConfirmedStock: 60,
        },
      ],
    };

    const res = validateClaimPayload(input, [bundle]);
    expect(res.isValid).toBe(true);
    expect(res.errors.length).toBe(0);
    expect(res.totals.totalItemsCount).toBe(1);
    expect(res.totals.totalUnitsCount).toBe(30);
    expect(res.totals.totalOptionAUnits).toBe(30);
    // Credit: 30 * $25.00 * 0.40 = $300.00
    expect(res.totals.estimatedCreditOptionA).toBe(300.0);
    expect(res.totals.totalEstimatedCredit).toBe(300.0);
  });

  // -------------------------------------------------------------------------
  // 2. Multi-SKU Same Store Claim
  // -------------------------------------------------------------------------
  it("successfully validates multiple SKUs belonging to the SAME store", () => {
    const bundle1 = createMockCohortBundle({
      cohortId: "cohort_001",
      productId: "prod_001",
      wholesalePrice: 20.0,
      currentStock: 50,
    });
    const bundle2 = createMockCohortBundle({
      cohortId: "cohort_002",
      productId: "prod_002",
      wholesalePrice: 15.0,
      currentStock: 40,
    });

    const input: SubmitClaimInput = {
      storeId: "store_001",
      isStockReconfirmed: true,
      items: [
        {
          cohortId: "cohort_001",
          productId: "prod_001",
          selectedOption: "A",
          selectedQuantity: 20,
          currentConfirmedStock: 50,
        },
        {
          cohortId: "cohort_002",
          productId: "prod_002",
          selectedOption: "B",
          selectedQuantity: 10,
          currentConfirmedStock: 40,
        },
      ],
    };

    const res = validateClaimPayload(input, [bundle1, bundle2]);
    expect(res.isValid).toBe(true);
    expect(res.totals.totalItemsCount).toBe(2);
    expect(res.totals.totalUnitsCount).toBe(30);
    // Option A: 20 * 20 * 0.4 = $160.00
    expect(res.totals.estimatedCreditOptionA).toBe(160.0);
    // Option B: 10 * 15 * 1.0 = $150.00
    expect(res.totals.estimatedCreditOptionB).toBe(150.0);
    expect(res.totals.totalEstimatedCredit).toBe(310.0);
  });

  // -------------------------------------------------------------------------
  // 3. Mixed A/B Claim Lines
  // -------------------------------------------------------------------------
  it("allows Option A and Option B on different lines within the same claim", () => {
    const bundleA = createMockCohortBundle({ cohortId: "c_a", wholesalePrice: 10 });
    const bundleB = createMockCohortBundle({ cohortId: "c_b", wholesalePrice: 20 });

    const input: SubmitClaimInput = {
      storeId: "store_001",
      isStockReconfirmed: true,
      items: [
        { cohortId: "c_a", productId: "prod_001", selectedOption: "A", selectedQuantity: 10, currentConfirmedStock: 50 },
        { cohortId: "c_b", productId: "prod_001", selectedOption: "B", selectedQuantity: 5, currentConfirmedStock: 50 },
      ],
    };

    const res = validateClaimPayload(input, [bundleA, bundleB]);
    expect(res.isValid).toBe(true);
    expect(res.totals.totalOptionAUnits).toBe(10);
    expect(res.totals.totalOptionBUnits).toBe(5);
  });

  // -------------------------------------------------------------------------
  // 4. Cross-Store Rejection
  // -------------------------------------------------------------------------
  it("rejects claim when an item belongs to a DIFFERENT store", () => {
    const bundleOtherStore = createMockCohortBundle({
      cohortId: "c_other",
      storeId: "store_002", // Different store!
    });

    const input: SubmitClaimInput = {
      storeId: "store_001", // Claim is for store_001
      isStockReconfirmed: true,
      items: [
        {
          cohortId: "c_other",
          productId: "prod_001",
          selectedOption: "A",
          selectedQuantity: 10,
          currentConfirmedStock: 20,
        },
      ],
    };

    const res = validateClaimPayload(input, [bundleOtherStore]);
    expect(res.isValid).toBe(false);
    expect(res.errors.some((e) => e.code === "CROSS_STORE_MISMATCH")).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 5. SKU Mismatch Rejection
  // -------------------------------------------------------------------------
  it("rejects claim when requested productId does not match cohort product", () => {
    const bundle = createMockCohortBundle({
      cohortId: "cohort_001",
      productId: "prod_001",
    });

    const input: SubmitClaimInput = {
      storeId: "store_001",
      isStockReconfirmed: true,
      items: [
        {
          cohortId: "cohort_001",
          productId: "prod_DIFFERENT", // Mismatched product ID!
          selectedOption: "A",
          selectedQuantity: 10,
          currentConfirmedStock: 20,
        },
      ],
    };

    const res = validateClaimPayload(input, [bundle]);
    expect(res.isValid).toBe(false);
    expect(res.errors.some((e) => e.code === "PRODUCT_MISMATCH")).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 6. Sell-Through: Exactly 50.00% Rejection
  // -------------------------------------------------------------------------
  it("strictly rejects cohort with exactly 50.00% sell-through", () => {
    const bundle50Percent = createMockCohortBundle({
      fulfilledQuantity: 100,
      soldUnits: 50, // Exactly 50% sold!
      currentStock: 50,
    });

    const input: SubmitClaimInput = {
      storeId: "store_001",
      isStockReconfirmed: true,
      items: [
        {
          cohortId: "cohort_001",
          productId: "prod_001",
          selectedOption: "A",
          selectedQuantity: 10,
          currentConfirmedStock: 50,
        },
      ],
    };

    const res = validateClaimPayload(input, [bundle50Percent]);
    expect(res.isValid).toBe(false);
    expect(res.errors.some((e) => e.code.includes("NOT_ELIGIBLE"))).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 7. Reorder Disqualification
  // -------------------------------------------------------------------------
  it("rejects cohort that had a confirmed reorder for the same store and SKU", () => {
    const bundleReordered = createMockCohortBundle({
      hasReorder: true,
    });

    const input: SubmitClaimInput = {
      storeId: "store_001",
      isStockReconfirmed: true,
      items: [
        {
          cohortId: "cohort_001",
          productId: "prod_001",
          selectedOption: "A",
          selectedQuantity: 10,
          currentConfirmedStock: 50,
        },
      ],
    };

    const res = validateClaimPayload(input, [bundleReordered]);
    expect(res.isValid).toBe(false);
    expect(res.errors.some((e) => e.code.includes("NOT_ELIGIBLE"))).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 8. Single-Claim Guarantee & Concurrent Duplicate Lock
  // -------------------------------------------------------------------------
  it("prevents submitting a cohort that has an existing SUBMITTED pending claim", () => {
    const bundlePendingClaim = createMockCohortBundle({
      existingClaimStatus: "submitted",
    });

    const input: SubmitClaimInput = {
      storeId: "store_001",
      isStockReconfirmed: true,
      items: [
        {
          cohortId: "cohort_001",
          productId: "prod_001",
          selectedOption: "A",
          selectedQuantity: 10,
          currentConfirmedStock: 50,
        },
      ],
    };

    const res = validateClaimPayload(input, [bundlePendingClaim]);
    expect(res.isValid).toBe(false);
    expect(res.errors.some((e) => e.code.includes("NOT_ELIGIBLE"))).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 9. Draft Claim Without Lock
  // -------------------------------------------------------------------------
  it("allows submitting a cohort if previous claim was only a DRAFT", () => {
    const bundleDraft = createMockCohortBundle({
      existingClaimStatus: "draft",
    });

    const input: SubmitClaimInput = {
      storeId: "store_001",
      isStockReconfirmed: true,
      items: [
        {
          cohortId: "cohort_001",
          productId: "prod_001",
          selectedOption: "A",
          selectedQuantity: 10,
          currentConfirmedStock: 50,
        },
      ],
    };

    const res = validateClaimPayload(input, [bundleDraft]);
    expect(res.isValid).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 10. Cancelled Claim Resubmission
  // -------------------------------------------------------------------------
  it("allows resubmission of cohort whose previous claim was CANCELLED", () => {
    const bundleCancelled = createMockCohortBundle({
      existingClaimStatus: "cancelled",
    });

    const input: SubmitClaimInput = {
      storeId: "store_001",
      isStockReconfirmed: true,
      items: [
        {
          cohortId: "cohort_001",
          productId: "prod_001",
          selectedOption: "A",
          selectedQuantity: 10,
          currentConfirmedStock: 50,
        },
      ],
    };

    const res = validateClaimPayload(input, [bundleCancelled]);
    expect(res.isValid).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 11. Final Rejected & Completed Claims Permanently Locked
  // -------------------------------------------------------------------------
  it("permanently locks cohort whose previous claim was REJECTED", () => {
    const bundleRejected = createMockCohortBundle({
      existingClaimStatus: "rejected",
    });

    const input: SubmitClaimInput = {
      storeId: "store_001",
      isStockReconfirmed: true,
      items: [
        { cohortId: "cohort_001", productId: "prod_001", selectedOption: "A", selectedQuantity: 10, currentConfirmedStock: 50 },
      ],
    };

    const res = validateClaimPayload(input, [bundleRejected]);
    expect(res.isValid).toBe(false);
  });

  it("permanently locks cohort whose previous claim was SETTLED / RESOLVED", () => {
    const bundleSettled = createMockCohortBundle({
      existingClaimStatus: "settled",
    });

    const input: SubmitClaimInput = {
      storeId: "store_001",
      isStockReconfirmed: true,
      items: [
        { cohortId: "cohort_001", productId: "prod_001", selectedOption: "A", selectedQuantity: 10, currentConfirmedStock: 50 },
      ],
    };

    const res = validateClaimPayload(input, [bundleSettled]);
    expect(res.isValid).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 12. Quantity Overflow Validation
  // -------------------------------------------------------------------------
  it("rejects claim when requested quantity exceeds validated max claimable", () => {
    const bundle = createMockCohortBundle({
      currentStock: 40, // Max is 40
    });

    const input: SubmitClaimInput = {
      storeId: "store_001",
      isStockReconfirmed: true,
      items: [
        {
          cohortId: "cohort_001",
          productId: "prod_001",
          selectedOption: "A",
          selectedQuantity: 45, // 45 > 40!
          currentConfirmedStock: 40,
        },
      ],
    };

    const res = validateClaimPayload(input, [bundle]);
    expect(res.isValid).toBe(false);
    expect(res.errors.some((e) => e.code === "QUANTITY_EXCEEDS_MAX")).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 13. Stock Reconfirmation Mandatory
  // -------------------------------------------------------------------------
  it("rejects claim when stock reconfirmation checkbox is NOT checked", () => {
    const bundle = createMockCohortBundle();

    const input: SubmitClaimInput = {
      storeId: "store_001",
      isStockReconfirmed: false, // NOT checked!
      items: [
        { cohortId: "cohort_001", productId: "prod_001", selectedOption: "A", selectedQuantity: 10, currentConfirmedStock: 50 },
      ],
    };

    const res = validateClaimPayload(input, [bundle]);
    expect(res.isValid).toBe(false);
    expect(res.errors.some((e) => e.code === "STOCK_NOT_RECONFIRMED")).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 14. Untrusted / Missing Evidence
  // -------------------------------------------------------------------------
  it("rejects submission when sales evidence is untrustworthy", () => {
    const bundleUntrustedSales = createMockCohortBundle({
      isSalesTrustworthy: false,
    });

    const input: SubmitClaimInput = {
      storeId: "store_001",
      isStockReconfirmed: true,
      items: [
        { cohortId: "cohort_001", productId: "prod_001", selectedOption: "A", selectedQuantity: 10, currentConfirmedStock: 50 },
      ],
    };

    const res = validateClaimPayload(input, [bundleUntrustedSales]);
    expect(res.isValid).toBe(false);
    expect(res.errors.some((e) => e.code.includes("NOT_ELIGIBLE"))).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 15. Duplicate Item in Same Payload
  // -------------------------------------------------------------------------
  it("rejects payload that lists the same cohort multiple times", () => {
    const bundle = createMockCohortBundle();

    const input: SubmitClaimInput = {
      storeId: "store_001",
      isStockReconfirmed: true,
      items: [
        { cohortId: "cohort_001", productId: "prod_001", selectedOption: "A", selectedQuantity: 10, currentConfirmedStock: 50 },
        { cohortId: "cohort_001", productId: "prod_001", selectedOption: "B", selectedQuantity: 10, currentConfirmedStock: 50 },
      ],
    };

    const res = validateClaimPayload(input, [bundle]);
    expect(res.isValid).toBe(false);
    expect(res.errors.some((e) => e.code === "DUPLICATE_ITEM_IN_CLAIM")).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 16. Frozen Financial Precision
  // -------------------------------------------------------------------------
  it("ensures precise monetary calculations without floating point errors", () => {
    const bundle = createMockCohortBundle({
      wholesalePrice: 19.99,
      optionARate: 0.35,
    });

    const input: SubmitClaimInput = {
      storeId: "store_001",
      isStockReconfirmed: true,
      items: [
        {
          cohortId: "cohort_001",
          productId: "prod_001",
          selectedOption: "A",
          selectedQuantity: 3, // 3 * 19.99 * 0.35 = 20.9895 -> 20.99
          currentConfirmedStock: 50,
        },
      ],
    };

    const res = validateClaimPayload(input, [bundle]);
    expect(res.isValid).toBe(true);
    expect(res.totals.estimatedCreditOptionA).toBe(20.99);
  });
});
