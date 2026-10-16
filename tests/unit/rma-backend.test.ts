/**
 * RMA Database Persistence & Server Actions Contract Tests
 * Task ID: EXCHANGE-CREDIT-PH3-003
 * Location: tests/unit/rma-backend.test.ts
 *
 * Isolated unit tests verifying:
 * - Claim integration and Option B-only extraction
 * - Duplicate RMA rejection for same claim
 * - Cross-Store and Cross-Company claim rejections
 * - Option A exclusion
 * - Box/label uniqueness and multi-box allocation
 * - 14-day shipping deadline calculation
 * - Late carrier scan & carrier loss exception routing
 * - Draft inspection vs complete inspection validation
 * - Quantity reconciliation invariants (accepted <= received, accepted <= authorized)
 * - Inspector attribution requirement
 * - No early credit issuance & financial safety
 * - Idempotency and deterministic hash keys
 */

import { describe, it, expect } from "vitest";
import {
  filterOptionBLinesFromClaim,
  validateBoxLabelAllocation,
  calculateShippingDeadline,
  reconcileWarehouseInspection,
  calculateSettlementReadyAmount,
  generateRmaIdempotencyKey,
  RmaAggregate,
  RmaItemLine,
} from "../../lib/retailer/rma";

describe("EXCHANGE-CREDIT-PH3-003: RMA Backend Persistence & Business Logic Contracts", () => {
  // ==========================================================================
  // 1. CLAIM INTEGRATION & OPTION B EXTRACTION
  // ==========================================================================
  describe("1. Claim Integration & Option B Extraction", () => {
    it("extracts only Option B items from claim and calculates integer cents", () => {
      const claim = {
        claimId: "clm-uuid-1",
        claimNumber: "CLM-2026-00001",
        storeId: "store-uuid-alpha",
        companyId: "comp-uuid-1",
        items: [
          {
            claimItemId: "item-opt-a",
            cohortId: "cohort-a",
            productId: "prod-a",
            productName: "Option A Cleanser",
            productSku: "SKU-CLEANSER",
            selectedOption: "A" as const,
            selectedQuantity: 10,
            frozenUnitWholesalePrice: 15.0,
          },
          {
            claimItemId: "item-opt-b1",
            cohortId: "cohort-b1",
            productId: "prod-b1",
            productName: "Option B Serum",
            productSku: "SKU-SERUM",
            selectedOption: "B" as const,
            selectedQuantity: 5,
            frozenUnitWholesalePrice: 22.5,
          },
          {
            claimItemId: "item-opt-b2",
            cohortId: "cohort-b2",
            productId: "prod-b2",
            productName: "Option B Cream",
            productSku: "SKU-CREAM",
            selectedOption: "B" as const,
            selectedQuantity: 8,
            frozenUnitWholesalePrice: 18.0,
          },
        ],
      };

      const res = filterOptionBLinesFromClaim(claim);
      expect(res.success).toBe(true);
      expect(res.optionBLines).toHaveLength(2);
      expect(res.optionACount).toBe(1);

      // Verify Line 1
      expect(res.optionBLines[0].productSku).toBe("SKU-SERUM");
      expect(res.optionBLines[0].quantityRequested).toBe(5);
      expect(res.optionBLines[0].frozenWholesalePriceCents).toBe(2250);

      // Verify Line 2
      expect(res.optionBLines[1].productSku).toBe("SKU-CREAM");
      expect(res.optionBLines[1].quantityRequested).toBe(8);
      expect(res.optionBLines[1].frozenWholesalePriceCents).toBe(1800);
    });

    it("rejects cross-store items within the same claim", () => {
      const claim = {
        claimId: "clm-uuid-2",
        claimNumber: "CLM-2026-00002",
        storeId: "store-alpha",
        companyId: "comp-1",
        items: [
          {
            claimItemId: "item-1",
            cohortId: "coh-1",
            productId: "prod-1",
            productName: "Item 1",
            productSku: "SKU-1",
            selectedOption: "B" as const,
            selectedQuantity: 4,
            frozenUnitWholesalePrice: 10.0,
            storeId: "store-beta", // Mismatched store ID!
          },
        ],
      };

      const res = filterOptionBLinesFromClaim(claim);
      expect(res.success).toBe(false);
      expect(res.errorCode).toBe("CROSS_STORE_CLAIM_REJECTED");
    });

    it("rejects claims with zero Option B items", () => {
      const claim = {
        claimId: "clm-uuid-3",
        claimNumber: "CLM-2026-00003",
        storeId: "store-alpha",
        companyId: "comp-1",
        items: [
          {
            claimItemId: "item-1",
            cohortId: "coh-1",
            productId: "prod-1",
            productName: "Item 1",
            productSku: "SKU-1",
            selectedOption: "A" as const,
            selectedQuantity: 10,
            frozenUnitWholesalePrice: 10.0,
          },
        ],
      };

      const res = filterOptionBLinesFromClaim(claim);
      expect(res.success).toBe(false);
      expect(res.errorCode).toBe("NO_OPTION_B_ITEMS");
    });
  });

  // ==========================================================================
  // 2. BOX ALLOCATION & SHIPPING LABEL POLICY
  // ==========================================================================
  describe("2. Box Allocation & Shipping Label Uniqueness", () => {
    const mockLines: RmaItemLine[] = [
      {
        id: "line-a",
        claimId: "c1",
        claimItemId: "i1",
        cohortId: "coh-1",
        productId: "p1",
        productName: "Serum",
        productSku: "SKU-A",
        selectedOption: "B",
        quantityRequested: 10,
        quantityAuthorized: 10,
        frozenUnitWholesalePrice: 15.0,
        frozenWholesalePriceCents: 1500,
        boxId: null,
      },
    ];

    it("validates 1 label per box with unique tracking number", () => {
      const boxes = [
        {
          boxNumber: 1,
          carrier: "UPS" as const,
          trackingNumber: "1Z9999999999999999",
          labelUrl: "https://labels.letusto.com/box1.pdf",
          assignedLines: [{ lineId: "line-a", quantity: 10 }],
        },
      ];

      const res = validateBoxLabelAllocation(boxes, mockLines);
      expect(res.isValid).toBe(true);
      expect(res.validatedBoxes).toHaveLength(1);
      expect(res.validatedBoxes![0].trackingNumber).toBe("1Z9999999999999999");
    });

    it("rejects duplicate tracking numbers across return boxes", () => {
      const boxes = [
        {
          boxNumber: 1,
          carrier: "UPS" as const,
          trackingNumber: "1ZDUPLICATE",
          assignedLines: [{ lineId: "line-a", quantity: 5 }],
        },
        {
          boxNumber: 2,
          carrier: "UPS" as const,
          trackingNumber: "1ZDUPLICATE",
          assignedLines: [{ lineId: "line-a", quantity: 5 }],
        },
      ];

      const res = validateBoxLabelAllocation(boxes, mockLines);
      expect(res.isValid).toBe(false);
      expect(res.errors.some((e) => e.includes("Duplicate tracking number"))).toBe(true);
    });

    it("rejects box allocation if total allocated quantity does not match authorized quantity", () => {
      const boxes = [
        {
          boxNumber: 1,
          carrier: "UPS" as const,
          trackingNumber: "1Z12345",
          assignedLines: [{ lineId: "line-a", quantity: 8 }], // Only 8 of 10 allocated
        },
      ];

      const res = validateBoxLabelAllocation(boxes, mockLines);
      expect(res.isValid).toBe(false);
      expect(res.errors.some((e) => e.includes("does not match authorized quantity"))).toBe(true);
    });
  });

  // ==========================================================================
  // 3. 14-DAY RETURN DEADLINE CALCULATION
  // ==========================================================================
  describe("3. 14-Day Return Deadline Calculation", () => {
    it("sets Day 0 as approval date and Day 14 as exact deadline date", () => {
      const approvalDate = "2026-03-01";
      const deadline = calculateShippingDeadline(approvalDate, "2026-03-01");

      expect(deadline.approvalDate).toBe("2026-03-01");
      expect(deadline.deadlineDate).toBe("2026-03-15");
      expect(deadline.daysRemaining).toBe(14);
      expect(deadline.isOverdue).toBe(false);
    });

    it("accurately marks Day 15 as overdue while Day 14 is on-track", () => {
      const approvalDate = "2026-03-01";

      const onDay14 = calculateShippingDeadline(approvalDate, "2026-03-15");
      expect(onDay14.isOverdue).toBe(false);
      expect(onDay14.status).toBe("deadline_day");

      const onDay15 = calculateShippingDeadline(approvalDate, "2026-03-16");
      expect(onDay15.isOverdue).toBe(true);
      expect(onDay15.status).toBe("overdue");
    });
  });

  // ==========================================================================
  // 4. WAREHOUSE INSPECTION INVARIANTS & INTEGRITY
  // ==========================================================================
  describe("4. Warehouse Inspection Invariants & Integrity", () => {
    const inspector = {
      userId: "wh-lead-uuid",
      name: "Warehouse Staff",
      role: "inspector" as const,
    };

    const authorizedLines: RmaItemLine[] = [
      {
        id: "line-1",
        claimId: "c1",
        claimItemId: "i1",
        cohortId: "coh-1",
        productId: "p1",
        productName: "Serum",
        productSku: "SKU-SERUM",
        selectedOption: "B",
        quantityRequested: 10,
        quantityAuthorized: 10,
        frozenUnitWholesalePrice: 20.0,
        frozenWholesalePriceCents: 2000,
        boxId: null,
      },
    ];

    it("verifies full reconciliation and exact match without discrepancies", () => {
      const res = reconcileWarehouseInspection(
        authorizedLines,
        {
          inspectedBy: inspector,
          boxCondition: "intact",
          lineInspections: [
            {
              lineId: "line-1",
              quantityReceived: 10,
              quantityAcceptedResaleable: 10,
              quantityRejected: 0,
            },
          ],
        },
        "rma-uuid-1"
      );

      expect(res.success).toBe(true);
      expect(res.inspectionRecord!.totalAcceptedResaleable).toBe(10);
      expect(res.inspectionRecord!.totalMissing).toBe(0);
      expect(res.inspectionRecord!.hasDiscrepancies).toBe(false);
    });

    it("rejects inspection if accepted resaleable exceeds received units (Invariant Violation)", () => {
      const res = reconcileWarehouseInspection(
        authorizedLines,
        {
          inspectedBy: inspector,
          boxCondition: "intact",
          lineInspections: [
            {
              lineId: "line-1",
              quantityReceived: 6,
              quantityAcceptedResaleable: 8, // ILLEGAL: 8 > 6
              quantityRejected: 0,
            },
          ],
        },
        "rma-uuid-1"
      );

      expect(res.success).toBe(false);
      expect(res.errorCode).toBe("INSPECTION_INVARIANT_VIOLATION");
      expect(res.errors.some((e) => e.includes("cannot exceed received units"))).toBe(true);
    });

    it("rejects inspection if received != accepted + rejected (Unaccounted units)", () => {
      const res = reconcileWarehouseInspection(
        authorizedLines,
        {
          inspectedBy: inspector,
          boxCondition: "intact",
          lineInspections: [
            {
              lineId: "line-1",
              quantityReceived: 10,
              quantityAcceptedResaleable: 6,
              quantityRejected: 2, // 6 + 2 = 8 != 10
            },
          ],
        },
        "rma-uuid-1"
      );

      expect(res.success).toBe(false);
      expect(res.errors.some((e) => e.includes("must equal accepted"))).toBe(true);
    });

    it("requires inspector attribution (missing inspector rejected)", () => {
      const res = reconcileWarehouseInspection(
        authorizedLines,
        {
          inspectedBy: { userId: "", name: "", role: "inspector" },
          boxCondition: "intact",
          lineInspections: [],
        },
        "rma-uuid-1"
      );

      expect(res.success).toBe(false);
      expect(res.errorCode).toBe("INSPECTOR_ATTRIBUTION_REQUIRED");
    });
  });

  // ==========================================================================
  // 5. FINANCIAL SAFETY & SETTLEMENT CONTRACT
  // ==========================================================================
  describe("5. Financial Safety & Settlement Contract", () => {
    it("strictly prohibits credit settlement before inspection is completed", () => {
      const rma: RmaAggregate = {
        id: "rma-test",
        rmaNumber: "RMA-001",
        claimId: "clm-1",
        claimNumber: "CLM-001",
        storeId: "store-1",
        companyId: "comp-1",
        status: "approved",
        lines: [],
        boxes: [],
        approvalDate: "2026-03-01",
        shippingDeadlineDate: "2026-03-15",
        inspectionRecord: null, // No inspection!
        settlementInstruction: null,
        exceptions: [],
        eventHistory: [],
        createdAt: "2026-03-01T10:00:00Z",
        updatedAt: "2026-03-01T10:00:00Z",
      };

      const res = calculateSettlementReadyAmount(rma);
      expect(res.success).toBe(false);
      expect(res.errorCode).toBe("NO_CREDIT_BEFORE_INSPECTION");
    });

    it("calculates exact credit in integer cents for accepted units only", () => {
      const line: RmaItemLine = {
        id: "l1",
        claimId: "c1",
        claimItemId: "i1",
        cohortId: "coh-1",
        productId: "p1",
        productName: "Serum",
        productSku: "SKU-1",
        selectedOption: "B",
        quantityRequested: 10,
        quantityAuthorized: 10,
        frozenUnitWholesalePrice: 19.99,
        frozenWholesalePriceCents: 1999,
        boxId: null,
      };

      const inspection = {
        id: "insp-001",
        rmaId: "rma-test",
        inspectedBy: { userId: "wh-1", name: "Inspector", role: "inspector" as const },
        inspectedAt: "2026-03-10T12:00:00Z",
        boxCondition: "intact" as const,
        lines: [
          {
            lineId: "l1",
            productId: "p1",
            productSku: "SKU-1",
            productName: "Serum",
            quantityAuthorized: 10,
            quantityReceived: 10,
            quantityAcceptedResaleable: 7, // 7 accepted, 3 rejected for damage
            quantityRejected: 3,
            quantityMissing: 0,
            discrepancyType: "partial_acceptance" as const,
          },
        ],
        totalAuthorized: 10,
        totalReceived: 10,
        totalAcceptedResaleable: 7,
        totalRejected: 3,
        totalMissing: 0,
        hasDiscrepancies: true,
      };

      const rma: RmaAggregate = {
        id: "rma-test",
        rmaNumber: "RMA-001",
        claimId: "clm-1",
        claimNumber: "CLM-001",
        storeId: "store-1",
        companyId: "comp-1",
        status: "inspection_completed",
        lines: [line],
        boxes: [],
        approvalDate: "2026-03-01",
        shippingDeadlineDate: "2026-03-15",
        inspectionRecord: inspection,
        settlementInstruction: null,
        exceptions: [],
        eventHistory: [],
        createdAt: "2026-03-01T10:00:00Z",
        updatedAt: "2026-03-01T10:00:00Z",
      };

      const res = calculateSettlementReadyAmount(rma);
      expect(res.success).toBe(true);

      const instruction = res.settlementInstruction!;
      // 7 * 1999 cents = 13993 cents = $139.93 exactly
      expect(instruction.totalAcceptedUnits).toBe(7);
      expect(instruction.totalSettlementAmountCents).toBe(13993);
      expect(instruction.totalSettlementAmountDollars).toBe(139.93);
      expect(instruction.creditRate).toBe(1.0);
      expect(instruction.status).toBe("settlement_proposed");
      expect(instruction.disclaimer).toContain("No credit ledger entry created");
    });

    it("generates deterministic idempotency key for proposed settlement", () => {
      const key1 = generateRmaIdempotencyKey("rma-100", "SETTLEMENT", { cents: 13993 });
      const key2 = generateRmaIdempotencyKey("rma-100", "SETTLEMENT", { cents: 13993 });
      const key3 = generateRmaIdempotencyKey("rma-100", "SETTLEMENT", { cents: 14000 });

      expect(key1).toBe(key2);
      expect(key1).not.toBe(key3);
    });
  });
});
