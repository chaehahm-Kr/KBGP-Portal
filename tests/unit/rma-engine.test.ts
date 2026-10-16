/**
 * Option B: Return & RMA Domain Engine Tests
 * Task ID: EXCHANGE-CREDIT-PH3-001
 * Location: tests/unit/rma-engine.test.ts
 *
 * Comprehensive policy tests covering 21+ required scenarios:
 * - One-SKU RMA
 * - Multi-SKU RMA
 * - Multiple return boxes & one label per box
 * - Mixed A/B claim filtering & cross-store rejection
 * - Day 14 / Day 15 deadline calculation & DST boundaries
 * - Late carrier scan & carrier lost parcel
 * - Warehouse inspection reconciliation invariants (accepted <= received, accepted <= authorized, etc.)
 * - Wrong SKU & damaged unit handling
 * - Partial receipt & over-receipt
 * - Credit settlement calculation, integer-cents money precision, & no early credit issuance
 * - Idempotency key generation & duplicate event/settlement prevention
 * - State machine transition validation & illegal transition rejection
 */

import { describe, it, expect } from "vitest";
import {
  RmaAggregate,
  RmaItemLine,
  RmaBoxInput,
  RmaCarrierEvent,
  WarehouseInspectionInput,
  ProposedSettlementInstruction,
  calculateShippingDeadline,
  addCalendarDays,
  diffCalendarDays,
  filterOptionBLinesFromClaim,
  validateBoxLabelAllocation,
  validateRmaTransition,
  evaluateCarrierTrackingEvent,
  generateRmaIdempotencyKey,
  reconcileWarehouseInspection,
  calculateSettlementReadyAmount,
  verifySettlementIdempotency,
} from "../../lib/retailer/rma";

// Test fixture helpers
function createMockRmaItem(overrides: Partial<RmaItemLine> = {}): RmaItemLine {
  return {
    id: "rma-line-1",
    claimId: "clm-100",
    claimItemId: "clm-item-1",
    cohortId: "cohort-1",
    productId: "prod-1",
    productName: "Glow Serum 50ml",
    productSku: "SKU-GLOW-01",
    selectedOption: "B",
    quantityRequested: 10,
    quantityAuthorized: 10,
    frozenUnitWholesalePrice: 15.5,
    frozenWholesalePriceCents: 1550,
    boxId: null,
    ...overrides,
  };
}

function createMockRmaAggregate(overrides: Partial<RmaAggregate> = {}): RmaAggregate {
  const line = createMockRmaItem();
  return {
    id: "rma-test-001",
    rmaNumber: "RMA-2026-000001",
    claimId: "clm-100",
    claimNumber: "CLM-2026-00001",
    storeId: "store-alpha",
    companyId: "comp-retailer-1",
    status: "awaiting_admin_approval",
    lines: [line],
    boxes: [],
    approvalDate: null,
    shippingDeadlineDate: null,
    inspectionRecord: null,
    settlementInstruction: null,
    exceptions: [],
    eventHistory: [],
    createdAt: "2026-03-01T10:00:00Z",
    updatedAt: "2026-03-01T10:00:00Z",
    ...overrides,
  };
}

describe("EXCHANGE-CREDIT-PH3-001: Option B Return & RMA Engine", () => {
  // ==========================================================================
  // 1. MIXED A/B CLAIM FILTERING & STORE SCOPE
  // ==========================================================================
  describe("1. Mixed A/B Claim Filtering & Store Scope", () => {
    it("extracts Option B items and calculates price in integer cents", () => {
      const claim = {
        claimId: "clm-101",
        claimNumber: "CLM-001",
        storeId: "store-01",
        companyId: "comp-01",
        items: [
          {
            claimItemId: "item-1",
            cohortId: "coh-1",
            productId: "p1",
            productName: "Toner",
            productSku: "SKU-TNR",
            selectedOption: "B" as const,
            selectedQuantity: 8,
            frozenUnitWholesalePrice: 12.75,
          },
        ],
      };

      const result = filterOptionBLinesFromClaim(claim);
      expect(result.success).toBe(true);
      expect(result.optionBLines).toHaveLength(1);
      expect(result.optionBLines[0].quantityRequested).toBe(8);
      expect(result.optionBLines[0].frozenWholesalePriceCents).toBe(1275);
      expect(result.optionACount).toBe(0);
    });

    it("filters out Option A items and extracts only Option B lines", () => {
      const claim = {
        claimId: "clm-102",
        claimNumber: "CLM-002",
        storeId: "store-01",
        companyId: "comp-01",
        items: [
          {
            claimItemId: "item-a",
            cohortId: "coh-a",
            productId: "p-a",
            productName: "Option A Cream",
            productSku: "SKU-OPT-A",
            selectedOption: "A" as const,
            selectedQuantity: 15,
            frozenUnitWholesalePrice: 20.0,
          },
          {
            claimItemId: "item-b",
            cohortId: "coh-b",
            productId: "p-b",
            productName: "Option B Serum",
            productSku: "SKU-OPT-B",
            selectedOption: "B" as const,
            selectedQuantity: 5,
            frozenUnitWholesalePrice: 30.0,
          },
        ],
      };

      const result = filterOptionBLinesFromClaim(claim);
      expect(result.success).toBe(true);
      expect(result.optionBLines).toHaveLength(1);
      expect(result.optionBLines[0].productSku).toBe("SKU-OPT-B");
      expect(result.optionACount).toBe(1);
    });

    it("supports multi-SKU Option B claims under one store claim", () => {
      const claim = {
        claimId: "clm-103",
        claimNumber: "CLM-003",
        storeId: "store-01",
        companyId: "comp-01",
        items: [
          {
            claimItemId: "item-b1",
            cohortId: "coh-1",
            productId: "p1",
            productName: "Product 1",
            productSku: "SKU-1",
            selectedOption: "B" as const,
            selectedQuantity: 4,
            frozenUnitWholesalePrice: 10.0,
          },
          {
            claimItemId: "item-b2",
            cohortId: "coh-2",
            productId: "p2",
            productName: "Product 2",
            productSku: "SKU-2",
            selectedOption: "B" as const,
            selectedQuantity: 6,
            frozenUnitWholesalePrice: 18.5,
          },
        ],
      };

      const result = filterOptionBLinesFromClaim(claim);
      expect(result.success).toBe(true);
      expect(result.optionBLines).toHaveLength(2);
    });

    it("rejects cross-store claims when line item has a differing storeId", () => {
      const claim = {
        claimId: "clm-104",
        claimNumber: "CLM-004",
        storeId: "store-alpha",
        companyId: "comp-01",
        items: [
          {
            claimItemId: "item-1",
            cohortId: "coh-1",
            productId: "p1",
            productName: "Product 1",
            productSku: "SKU-1",
            selectedOption: "B" as const,
            selectedQuantity: 5,
            frozenUnitWholesalePrice: 10.0,
            storeId: "store-beta", // Mismatched store!
          },
        ],
      };

      const result = filterOptionBLinesFromClaim(claim);
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe("CROSS_STORE_CLAIM_REJECTED");
    });

    it("rejects claims with zero Option B items", () => {
      const claim = {
        claimId: "clm-105",
        claimNumber: "CLM-005",
        storeId: "store-01",
        companyId: "comp-01",
        items: [
          {
            claimItemId: "item-a1",
            cohortId: "coh-1",
            productId: "p1",
            productName: "Product 1",
            productSku: "SKU-1",
            selectedOption: "A" as const,
            selectedQuantity: 10,
            frozenUnitWholesalePrice: 10.0,
          },
        ],
      };

      const result = filterOptionBLinesFromClaim(claim);
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe("NO_OPTION_B_ITEMS");
    });
  });

  // ==========================================================================
  // 2. SHIPPING DEADLINE & DST BOUNDARIES
  // ==========================================================================
  describe("2. Shipping Deadline & Calendar Date Arithmetic", () => {
    it("calculates exact 14-day calendar deadline from approval date", () => {
      const approvalDate = "2026-03-01";
      const result = calculateShippingDeadline(approvalDate, "2026-03-01");

      expect(result.approvalDate).toBe("2026-03-01");
      expect(result.deadlineDate).toBe("2026-03-15");
      expect(result.daysElapsed).toBe(0);
      expect(result.daysRemaining).toBe(14);
      expect(result.isOverdue).toBe(false);
      expect(result.status).toBe("active");
    });

    it("verifies Day 14 deadline boundary: active on Day 14 (not overdue)", () => {
      const approvalDate = "2026-03-01";
      const result = calculateShippingDeadline(approvalDate, "2026-03-15");

      expect(result.daysElapsed).toBe(14);
      expect(result.daysRemaining).toBe(0);
      expect(result.isOverdue).toBe(false);
      expect(result.status).toBe("deadline_day");
    });

    it("verifies Day 15 overdue boundary: overdue on Day 15 (isOverdue = true)", () => {
      const approvalDate = "2026-03-01";
      const result = calculateShippingDeadline(approvalDate, "2026-03-16");

      expect(result.daysElapsed).toBe(15);
      expect(result.daysRemaining).toBe(-1);
      expect(result.isOverdue).toBe(true);
      expect(result.status).toBe("overdue");
    });

    it("handles Spring Forward Daylight Saving Time boundary cleanly", () => {
      // US DST begins March 8, 2026 in America/New_York (23-hour day)
      const approvalDate = "2026-03-01";
      const deadline = calculateShippingDeadline(approvalDate, "2026-03-10");

      expect(deadline.deadlineDate).toBe("2026-03-15");
      expect(diffCalendarDays("2026-03-01", "2026-03-15")).toBe(14);
      expect(deadline.daysRemaining).toBe(5);
    });

    it("handles Fall Back Daylight Saving Time boundary cleanly", () => {
      // US DST ends November 1, 2026 in America/New_York (25-hour day)
      const approvalDate = "2026-10-25";
      const deadline = calculateShippingDeadline(approvalDate, "2026-10-28");

      expect(deadline.deadlineDate).toBe("2026-11-08");
      expect(diffCalendarDays("2026-10-25", "2026-11-08")).toBe(14);
      expect(deadline.daysRemaining).toBe(11);
    });
  });

  // ==========================================================================
  // 3. MULTI-SKU & MULTI-BOX LABEL ALLOCATION
  // ==========================================================================
  describe("3. Multi-SKU & Multi-Box Label Allocation", () => {
    it("validates single-box allocation with one label", () => {
      const line = createMockRmaItem({ id: "line-1", quantityAuthorized: 10 });
      const boxes: RmaBoxInput[] = [
        {
          boxNumber: 1,
          carrier: "UPS",
          trackingNumber: "1Z9999999999999999",
          labelUrl: "https://labels.letusto.com/box1.pdf",
          assignedLines: [{ lineId: "line-1", quantity: 10 }],
        },
      ];

      const res = validateBoxLabelAllocation(boxes, [line]);
      expect(res.isValid).toBe(true);
      expect(res.validatedBoxes).toHaveLength(1);
      expect(res.validatedBoxes![0].trackingNumber).toBe("1Z9999999999999999");
    });

    it("validates multi-SKU packed into multiple return boxes with distinct tracking numbers", () => {
      const lineA = createMockRmaItem({ id: "line-a", productSku: "SKU-A", quantityAuthorized: 10 });
      const lineB = createMockRmaItem({ id: "line-b", productSku: "SKU-B", quantityAuthorized: 20 });

      // Box 1: 10 units of A, 5 units of B
      // Box 2: 15 units of B
      const boxes: RmaBoxInput[] = [
        {
          boxNumber: 1,
          carrier: "UPS",
          trackingNumber: "1Z1111111111111111",
          assignedLines: [
            { lineId: "line-a", quantity: 10 },
            { lineId: "line-b", quantity: 5 },
          ],
        },
        {
          boxNumber: 2,
          carrier: "UPS",
          trackingNumber: "1Z2222222222222222",
          assignedLines: [{ lineId: "line-b", quantity: 15 }],
        },
      ];

      const res = validateBoxLabelAllocation(boxes, [lineA, lineB]);
      expect(res.isValid).toBe(true);
      expect(res.validatedBoxes).toHaveLength(2);
    });

    it("rejects duplicate tracking numbers across boxes", () => {
      const line = createMockRmaItem({ id: "line-1", quantityAuthorized: 10 });
      const boxes: RmaBoxInput[] = [
        {
          boxNumber: 1,
          carrier: "UPS",
          trackingNumber: "1Z9999999999999999",
          assignedLines: [{ lineId: "line-1", quantity: 5 }],
        },
        {
          boxNumber: 2,
          carrier: "UPS",
          trackingNumber: "1Z9999999999999999", // Duplicate!
          assignedLines: [{ lineId: "line-1", quantity: 5 }],
        },
      ];

      const res = validateBoxLabelAllocation(boxes, [line]);
      expect(res.isValid).toBe(false);
      expect(res.errors.some((e) => e.includes("Duplicate tracking number"))).toBe(true);
    });

    it("rejects under-allocation or over-allocation of product lines", () => {
      const line = createMockRmaItem({ id: "line-1", quantityAuthorized: 10 });
      const boxes: RmaBoxInput[] = [
        {
          boxNumber: 1,
          carrier: "UPS",
          trackingNumber: "1Z1111111111111111",
          assignedLines: [{ lineId: "line-1", quantity: 7 }], // Only 7 assigned, authorized is 10
        },
      ];

      const res = validateBoxLabelAllocation(boxes, [line]);
      expect(res.isValid).toBe(false);
      expect(res.errors.some((e) => e.includes("does not match authorized"))).toBe(true);
    });
  });

  // ==========================================================================
  // 4. RMA STATE MACHINE & TRANSITION VALIDATION
  // ==========================================================================
  describe("4. RMA State Machine & Lifecycle Transitions", () => {
    it("executes complete lifecycle happy path from awaiting approval to resolution ready", () => {
      const actor = { userId: "admin-1", role: "admin", name: "Operations Lead" };
      let rma = createMockRmaAggregate();
      expect(rma.status).toBe("awaiting_admin_approval");

      // 1. Approve RMA
      const approveRes = validateRmaTransition(rma, {
        eventType: "RMA_APPROVED",
        actor,
        asOfDate: "2026-03-01",
      });
      expect(approveRes.success).toBe(true);
      expect(approveRes.newStatus).toBe("approved");
      rma = approveRes.rma!;
      expect(rma.approvalDate).toBe("2026-03-01");
      expect(rma.shippingDeadlineDate).toBe("2026-03-15");

      // 2. Carrier Pickup / Shipped
      const shipRes = validateRmaTransition(rma, {
        eventType: "CARRIER_PICKUP",
        actor: { userId: "system", role: "carrier_webhook" },
        asOfDate: "2026-03-05",
      });
      expect(shipRes.success).toBe(true);
      expect(shipRes.newStatus).toBe("shipped");
      rma = shipRes.rma!;

      // 3. Carrier Delivered
      const deliverRes = validateRmaTransition(rma, {
        eventType: "CARRIER_DELIVERED",
        actor: { userId: "system", role: "carrier_webhook" },
        asOfDate: "2026-03-08",
      });
      expect(deliverRes.success).toBe(true);
      expect(deliverRes.newStatus).toBe("delivered");
      rma = deliverRes.rma!;

      // 4. Warehouse Starts Inspection
      const startInspRes = validateRmaTransition(rma, {
        eventType: "INSPECTION_STARTED",
        actor: { userId: "wh-1", role: "warehouse_staff", name: "Receiver Bob" },
        asOfDate: "2026-03-09",
      });
      expect(startInspRes.success).toBe(true);
      expect(startInspRes.newStatus).toBe("inspection_in_progress");
      rma = startInspRes.rma!;

      // 5. Inspection Recorded
      const finishInspRes = validateRmaTransition(rma, {
        eventType: "INSPECTION_RECORDED",
        actor: { userId: "wh-1", role: "warehouse_staff", name: "Receiver Bob" },
        asOfDate: "2026-03-09",
      });
      expect(finishInspRes.success).toBe(true);
      expect(finishInspRes.newStatus).toBe("inspection_completed");
      rma = finishInspRes.rma!;

      // 6. Propose Settlement
      const settleRes = validateRmaTransition(rma, {
        eventType: "SETTLEMENT_PROPOSED",
        actor,
        asOfDate: "2026-03-10",
      });
      expect(settleRes.success).toBe(true);
      expect(settleRes.newStatus).toBe("resolution_ready");
      rma = settleRes.rma!;
    });

    it("rejects illegal state transition: awaiting_approval directly to delivered", () => {
      const rma = createMockRmaAggregate();
      const res = validateRmaTransition(rma, {
        eventType: "CARRIER_DELIVERED",
        actor: { userId: "wh-1", role: "warehouse_staff" },
      });
      expect(res.success).toBe(false);
      expect(res.errorCode).toBe("INVALID_TRANSITION");
    });

    it("rejects illegal backward transition: delivered back to approved", () => {
      const rma = createMockRmaAggregate({ status: "delivered" });
      const res = validateRmaTransition(rma, {
        eventType: "RMA_APPROVED",
        actor: { userId: "admin-1", role: "admin" },
      });
      expect(res.success).toBe(false);
      expect(res.errorCode).toBe("INVALID_TRANSITION");
    });

    it("rejects shipping a cancelled RMA", () => {
      const rma = createMockRmaAggregate({ status: "cancelled" });
      const res = validateRmaTransition(rma, {
        eventType: "CARRIER_PICKUP",
        actor: { userId: "carrier", role: "carrier" },
      });
      expect(res.success).toBe(false);
      expect(res.errorCode).toBe("INVALID_TRANSITION");
    });

    it("supports idempotent event handling with duplicate idempotency key", () => {
      const key = "IDEMP-EVENT-12345";
      const rma = createMockRmaAggregate({
        eventHistory: [
          {
            id: "log-1",
            rmaId: "rma-test-001",
            eventType: "RMA_APPROVED",
            oldStatus: "awaiting_admin_approval",
            newStatus: "approved",
            actor: { userId: "admin-1", role: "admin" },
            metadata: { idempotencyKey: key },
            timestamp: "2026-03-01T12:00:00Z",
          },
        ],
        status: "approved",
      });

      // Submit identical event
      const res = validateRmaTransition(rma, {
        eventType: "RMA_APPROVED",
        actor: { userId: "admin-1", role: "admin" },
        idempotencyKey: key,
      });

      expect(res.success).toBe(true);
      expect(res.isDuplicate).toBe(true);
      expect(res.newStatus).toBe("approved");
    });
  });

  // ==========================================================================
  // 5. CARRIER TRACKING & EXCEPTION HANDLING
  // ==========================================================================
  describe("5. Carrier Tracking & Exception Handling", () => {
    it("handles on-time carrier pickup within 14 days without exception", () => {
      const rma = createMockRmaAggregate({
        status: "approved",
        approvalDate: "2026-03-01",
        shippingDeadlineDate: "2026-03-15",
        boxes: [
          {
            id: "box-1",
            boxNumber: 1,
            carrier: "UPS",
            trackingNumber: "1Z123",
            status: "label_created",
            carrierEvents: [],
            assignedLines: [{ lineId: "line-1", quantity: 10 }],
          },
        ],
      });

      const carrierEvent: RmaCarrierEvent = {
        id: "evt-1",
        trackingNumber: "1Z123",
        eventType: "in_transit",
        timestamp: "2026-03-05T14:00:00Z",
        location: "Secaucus, NJ",
      };

      const evalRes = evaluateCarrierTrackingEvent(rma, "box-1", carrierEvent, "2026-03-05");
      expect(evalRes.isOverdueHandoff).toBe(false);
      expect(evalRes.isCarrierLost).toBe(false);
      expect(evalRes.recommendedRmaStatus).toBe("shipped");
      expect(evalRes.exceptionRaised).toBeUndefined();
    });

    it("flags late carrier scan after Day 14 deadline for Admin review without auto-forfeiture", () => {
      const rma = createMockRmaAggregate({
        status: "approved",
        approvalDate: "2026-03-01",
        shippingDeadlineDate: "2026-03-15",
        boxes: [
          {
            id: "box-1",
            boxNumber: 1,
            carrier: "UPS",
            trackingNumber: "1Z123",
            status: "label_created",
            carrierEvents: [],
            assignedLines: [{ lineId: "line-1", quantity: 10 }],
          },
        ],
      });

      // Carrier pickup occurs on Day 16 (2026-03-17)
      const carrierEvent: RmaCarrierEvent = {
        id: "evt-late",
        trackingNumber: "1Z123",
        eventType: "in_transit",
        timestamp: "2026-03-17T10:00:00Z",
      };

      const evalRes = evaluateCarrierTrackingEvent(rma, "box-1", carrierEvent, "2026-03-17");
      expect(evalRes.isOverdueHandoff).toBe(true);
      expect(evalRes.exceptionRaised).toBeDefined();
      expect(evalRes.exceptionRaised!.code).toBe("LATE_CARRIER_SCAN");
      expect(evalRes.exceptionRaised!.requiresAdminReview).toBe(true);
      expect(evalRes.recommendedRmaStatus).toBe("exception");
    });

    it("flags carrier lost parcel for Letusto prepaid label and routes to Admin review without auto-denial", () => {
      const rma = createMockRmaAggregate({
        status: "shipped",
        approvalDate: "2026-03-01",
        shippingDeadlineDate: "2026-03-15",
        boxes: [
          {
            id: "box-1",
            boxNumber: 1,
            carrier: "UPS",
            trackingNumber: "1Z123",
            status: "in_transit",
            carrierEvents: [],
            assignedLines: [{ lineId: "line-1", quantity: 10 }],
          },
        ],
      });

      const carrierEvent: RmaCarrierEvent = {
        id: "evt-lost",
        trackingNumber: "1Z123",
        eventType: "lost",
        rawStatus: "Shipment lost in transit by carrier",
        timestamp: "2026-03-10T12:00:00Z",
      };

      const evalRes = evaluateCarrierTrackingEvent(rma, "box-1", carrierEvent, "2026-03-10");
      expect(evalRes.isCarrierLost).toBe(true);
      expect(evalRes.exceptionRaised).toBeDefined();
      expect(evalRes.exceptionRaised!.code).toBe("CARRIER_LOST_PARCEL");
      expect(evalRes.exceptionRaised!.flagCarrierClaim).toBe(true);
      expect(evalRes.exceptionRaised!.requiresAdminReview).toBe(true);
      expect(evalRes.recommendedRmaStatus).toBe("exception");
    });
  });

  // ==========================================================================
  // 6. WAREHOUSE INSPECTION & RECONCILIATION
  // ==========================================================================
  describe("6. Warehouse Inspection & Reconciliation", () => {
    const defaultInspector = {
      userId: "wh-inspector-1",
      name: "Alex Inspector",
      role: "inspector" as const,
    };

    it("reconciles exact match inspection: 100% received and accepted resaleable", () => {
      const line = createMockRmaItem({ id: "line-1", quantityAuthorized: 10 });
      const input: WarehouseInspectionInput = {
        inspectedBy: defaultInspector,
        boxCondition: "intact",
        lineInspections: [
          {
            lineId: "line-1",
            quantityReceived: 10,
            quantityAcceptedResaleable: 10,
            quantityRejected: 0,
          },
        ],
      };

      const res = reconcileWarehouseInspection([line], input, "rma-001");
      expect(res.success).toBe(true);
      expect(res.inspectionRecord!.totalAuthorized).toBe(10);
      expect(res.inspectionRecord!.totalReceived).toBe(10);
      expect(res.inspectionRecord!.totalAcceptedResaleable).toBe(10);
      expect(res.inspectionRecord!.totalRejected).toBe(0);
      expect(res.inspectionRecord!.totalMissing).toBe(0);
      expect(res.inspectionRecord!.hasDiscrepancies).toBe(false);
    });

    it("reconciles partial resaleable acceptance: 7 accepted, 3 rejected for damage", () => {
      const line = createMockRmaItem({ id: "line-1", quantityAuthorized: 10 });
      const input: WarehouseInspectionInput = {
        inspectedBy: defaultInspector,
        boxCondition: "damaged",
        lineInspections: [
          {
            lineId: "line-1",
            quantityReceived: 10,
            quantityAcceptedResaleable: 7,
            quantityRejected: 3,
            rejectionReason: "damaged",
            discrepancyNotes: "3 bottles leaking and crushed inside packaging",
          },
        ],
      };

      const res = reconcileWarehouseInspection([line], input, "rma-001");
      expect(res.success).toBe(true);
      expect(res.inspectionRecord!.totalAcceptedResaleable).toBe(7);
      expect(res.inspectionRecord!.totalRejected).toBe(3);
      expect(res.inspectionRecord!.hasDiscrepancies).toBe(true);
      expect(res.inspectionRecord!.lines[0].discrepancyType).toBe("partial_acceptance");
    });

    it("reconciles partial receipt with missing units: 6 received of 10 authorized", () => {
      const line = createMockRmaItem({ id: "line-1", quantityAuthorized: 10 });
      const input: WarehouseInspectionInput = {
        inspectedBy: defaultInspector,
        boxCondition: "intact",
        lineInspections: [
          {
            lineId: "line-1",
            quantityReceived: 6,
            quantityAcceptedResaleable: 6,
            quantityRejected: 0,
          },
        ],
      };

      const res = reconcileWarehouseInspection([line], input, "rma-001");
      expect(res.success).toBe(true);
      expect(res.inspectionRecord!.totalReceived).toBe(6);
      expect(res.inspectionRecord!.totalMissing).toBe(4);
      expect(res.inspectionRecord!.lines[0].quantityMissing).toBe(4);
      expect(res.inspectionRecord!.lines[0].discrepancyType).toBe("partial_receipt");
    });

    it("reconciles over-receipt: 12 received vs 10 authorized", () => {
      const line = createMockRmaItem({ id: "line-1", quantityAuthorized: 10 });
      const input: WarehouseInspectionInput = {
        inspectedBy: defaultInspector,
        boxCondition: "intact",
        lineInspections: [
          {
            lineId: "line-1",
            quantityReceived: 12,
            quantityAcceptedResaleable: 10, // Capped at authorized
            quantityRejected: 2,
            rejectionReason: "other",
            discrepancyNotes: "2 extra units returned beyond authorization",
          },
        ],
      };

      const res = reconcileWarehouseInspection([line], input, "rma-001");
      expect(res.success).toBe(true);
      expect(res.inspectionRecord!.totalReceived).toBe(12);
      expect(res.inspectionRecord!.lines[0].discrepancyType).toBe("over_receipt");
    });

    it("rejects inspection when acceptedResaleable exceeds received units (Invariant 1)", () => {
      const line = createMockRmaItem({ id: "line-1", quantityAuthorized: 10 });
      const input: WarehouseInspectionInput = {
        inspectedBy: defaultInspector,
        boxCondition: "intact",
        lineInspections: [
          {
            lineId: "line-1",
            quantityReceived: 5,
            quantityAcceptedResaleable: 8, // ILLEGAL: 8 > 5
            quantityRejected: 0,
          },
        ],
      };

      const res = reconcileWarehouseInspection([line], input, "rma-001");
      expect(res.success).toBe(false);
      expect(res.errorCode).toBe("INSPECTION_INVARIANT_VIOLATION");
      expect(res.errors.some((e) => e.includes("cannot exceed received units"))).toBe(true);
    });

    it("rejects inspection when acceptedResaleable exceeds authorized units (Invariant 2)", () => {
      const line = createMockRmaItem({ id: "line-1", quantityAuthorized: 10 });
      const input: WarehouseInspectionInput = {
        inspectedBy: defaultInspector,
        boxCondition: "intact",
        lineInspections: [
          {
            lineId: "line-1",
            quantityReceived: 15,
            quantityAcceptedResaleable: 15, // ILLEGAL: 15 > 10 authorized
            quantityRejected: 0,
          },
        ],
      };

      const res = reconcileWarehouseInspection([line], input, "rma-001");
      expect(res.success).toBe(false);
      expect(res.errorCode).toBe("INSPECTION_INVARIANT_VIOLATION");
      expect(res.errors.some((e) => e.includes("cannot exceed authorized units"))).toBe(true);
    });

    it("rejects inspection when received != accepted + rejected (Invariant 3)", () => {
      const line = createMockRmaItem({ id: "line-1", quantityAuthorized: 10 });
      const input: WarehouseInspectionInput = {
        inspectedBy: defaultInspector,
        boxCondition: "intact",
        lineInspections: [
          {
            lineId: "line-1",
            quantityReceived: 10,
            quantityAcceptedResaleable: 6,
            quantityRejected: 2, // 6 + 2 = 8, but received = 10 -> 2 units unaccounted!
          },
        ],
      };

      const res = reconcileWarehouseInspection([line], input, "rma-001");
      expect(res.success).toBe(false);
      expect(res.errorCode).toBe("INSPECTION_INVARIANT_VIOLATION");
      expect(res.errors.some((e) => e.includes("must equal accepted"))).toBe(true);
    });

    it("rejects inspection when units are rejected without providing rejectionReason", () => {
      const line = createMockRmaItem({ id: "line-1", quantityAuthorized: 10 });
      const input: WarehouseInspectionInput = {
        inspectedBy: defaultInspector,
        boxCondition: "intact",
        lineInspections: [
          {
            lineId: "line-1",
            quantityReceived: 10,
            quantityAcceptedResaleable: 7,
            quantityRejected: 3,
            rejectionReason: null, // Missing!
          },
        ],
      };

      const res = reconcileWarehouseInspection([line], input, "rma-001");
      expect(res.success).toBe(false);
      expect(res.errors.some((e) => e.includes("Rejection reason is required"))).toBe(true);
    });

    it("requires inspector attribution (missing inspector throws error)", () => {
      const line = createMockRmaItem({ id: "line-1", quantityAuthorized: 10 });
      const input = {
        inspectedBy: { userId: "", name: "", role: "inspector" as const },
        boxCondition: "intact" as const,
        lineInspections: [],
      };

      const res = reconcileWarehouseInspection([line], input, "rma-001");
      expect(res.success).toBe(false);
      expect(res.errorCode).toBe("INSPECTOR_ATTRIBUTION_REQUIRED");
    });

    it("reconciles wrong SKU return: 0 accepted resaleable, flags exception", () => {
      const line = createMockRmaItem({ id: "line-1", quantityAuthorized: 10 });
      const input: WarehouseInspectionInput = {
        inspectedBy: defaultInspector,
        boxCondition: "intact",
        lineInspections: [
          {
            lineId: "line-1",
            quantityReceived: 10,
            quantityAcceptedResaleable: 0,
            quantityRejected: 10,
            rejectionReason: "wrong_sku",
            discrepancyNotes: "Received Hair Oil instead of Glow Serum",
          },
        ],
      };

      const res = reconcileWarehouseInspection([line], input, "rma-001");
      expect(res.success).toBe(true);
      expect(res.inspectionRecord!.totalAcceptedResaleable).toBe(0);
      expect(res.inspectionRecord!.totalRejected).toBe(10);
      expect(res.inspectionRecord!.lines[0].discrepancyType).toBe("wrong_sku");
      expect(res.exceptionsRaised.some((ex) => ex.code === "WRONG_SKU_RETURNED")).toBe(true);
    });
  });

  // ==========================================================================
  // 7. CREDIT SETTLEMENT & MONEY PRECISION
  // ==========================================================================
  describe("7. Credit Settlement Calculation & Money Precision", () => {
    it("prohibits early credit calculation before warehouse inspection is completed", () => {
      const rma = createMockRmaAggregate({ status: "approved" });
      const res = calculateSettlementReadyAmount(rma);

      expect(res.success).toBe(false);
      expect(res.errorCode).toBe("NO_CREDIT_BEFORE_INSPECTION");
    });

    it("prohibits credit calculation when RMA is in shipped or delivered status without inspection", () => {
      const rma = createMockRmaAggregate({ status: "delivered" });
      const res = calculateSettlementReadyAmount(rma);

      expect(res.success).toBe(false);
      expect(res.errorCode).toBe("NO_CREDIT_BEFORE_INSPECTION");
    });

    it("calculates 100% frozen wholesale price for accepted resaleable units with exact integer-cents precision", () => {
      // Line 1: 3 units @ $19.99 = $59.97
      // Line 2: 7 units @ $14.33 = $100.31
      // Line 3: 11 units @ $25.05 = $275.55
      // Total = 59.97 + 100.31 + 275.55 = $435.83 (43583 cents)
      const line1 = createMockRmaItem({
        id: "l1",
        productSku: "SKU-1",
        quantityAuthorized: 3,
        frozenUnitWholesalePrice: 19.99,
        frozenWholesalePriceCents: 1999,
      });
      const line2 = createMockRmaItem({
        id: "l2",
        productSku: "SKU-2",
        quantityAuthorized: 7,
        frozenUnitWholesalePrice: 14.33,
        frozenWholesalePriceCents: 1433,
      });
      const line3 = createMockRmaItem({
        id: "l3",
        productSku: "SKU-3",
        quantityAuthorized: 11,
        frozenUnitWholesalePrice: 25.05,
        frozenWholesalePriceCents: 2505,
      });

      const inspection = {
        id: "insp-100",
        rmaId: "rma-test",
        inspectedBy: { userId: "wh-1", name: "Inspector", role: "inspector" as const },
        inspectedAt: "2026-03-10T12:00:00Z",
        boxCondition: "intact" as const,
        lines: [
          {
            lineId: "l1",
            productId: "p1",
            productSku: "SKU-1",
            productName: "Item 1",
            quantityAuthorized: 3,
            quantityReceived: 3,
            quantityAcceptedResaleable: 3,
            quantityRejected: 0,
            quantityMissing: 0,
            discrepancyType: "exact_match" as const,
          },
          {
            lineId: "l2",
            productId: "p2",
            productSku: "SKU-2",
            productName: "Item 2",
            quantityAuthorized: 7,
            quantityReceived: 7,
            quantityAcceptedResaleable: 7,
            quantityRejected: 0,
            quantityMissing: 0,
            discrepancyType: "exact_match" as const,
          },
          {
            lineId: "l3",
            productId: "p3",
            productSku: "SKU-3",
            productName: "Item 3",
            quantityAuthorized: 11,
            quantityReceived: 11,
            quantityAcceptedResaleable: 11,
            quantityRejected: 0,
            quantityMissing: 0,
            discrepancyType: "exact_match" as const,
          },
        ],
        totalAuthorized: 21,
        totalReceived: 21,
        totalAcceptedResaleable: 21,
        totalRejected: 0,
        totalMissing: 0,
        hasDiscrepancies: false,
      };

      const rma = createMockRmaAggregate({
        status: "inspection_completed",
        lines: [line1, line2, line3],
        inspectionRecord: inspection,
      });

      const res = calculateSettlementReadyAmount(rma);
      expect(res.success).toBe(true);

      const instruction = res.settlementInstruction!;
      expect(instruction.totalAcceptedUnits).toBe(21);
      expect(instruction.totalSettlementAmountCents).toBe(43583);
      expect(instruction.totalSettlementAmountDollars).toBe(435.83);
      expect(instruction.creditRate).toBe(1.0);
      expect(instruction.status).toBe("settlement_proposed");

      // Verify line 1: 3 * 1999 = 5997 cents ($59.97)
      expect(instruction.lines[0].settlementAmountCents).toBe(5997);
      expect(instruction.lines[0].settlementAmountDollars).toBe(59.97);

      // Verify line 2: 7 * 1433 = 10031 cents ($100.31)
      expect(instruction.lines[1].settlementAmountCents).toBe(10031);
      expect(instruction.lines[1].settlementAmountDollars).toBe(100.31);

      // Verify line 3: 11 * 2505 = 27555 cents ($275.55)
      expect(instruction.lines[2].settlementAmountCents).toBe(27555);
      expect(instruction.lines[2].settlementAmountDollars).toBe(275.55);
    });

    it("excludes rejected units and missing units from settlement credit", () => {
      // 10 authorized @ $20.00 ($200.00)
      // 10 received, 6 accepted resaleable, 4 rejected (damaged)
      // Settlement must be 6 * $20.00 = $120.00 ($0 for the 4 damaged units)
      const line = createMockRmaItem({
        id: "l1",
        quantityAuthorized: 10,
        frozenUnitWholesalePrice: 20.0,
        frozenWholesalePriceCents: 2000,
      });

      const inspection = {
        id: "insp-200",
        rmaId: "rma-test",
        inspectedBy: { userId: "wh-1", name: "Inspector", role: "inspector" as const },
        inspectedAt: "2026-03-10T12:00:00Z",
        boxCondition: "damaged" as const,
        lines: [
          {
            lineId: "l1",
            productId: "p1",
            productSku: "SKU-1",
            productName: "Item 1",
            quantityAuthorized: 10,
            quantityReceived: 10,
            quantityAcceptedResaleable: 6,
            quantityRejected: 4,
            quantityMissing: 0,
            discrepancyType: "partial_acceptance" as const,
          },
        ],
        totalAuthorized: 10,
        totalReceived: 10,
        totalAcceptedResaleable: 6,
        totalRejected: 4,
        totalMissing: 0,
        hasDiscrepancies: true,
      };

      const rma = createMockRmaAggregate({
        status: "inspection_completed",
        lines: [line],
        inspectionRecord: inspection,
      });

      const res = calculateSettlementReadyAmount(rma);
      expect(res.success).toBe(true);
      expect(res.settlementInstruction!.totalAcceptedUnits).toBe(6);
      expect(res.settlementInstruction!.totalSettlementAmountDollars).toBe(120.0);
      expect(res.settlementInstruction!.totalSettlementAmountCents).toBe(12000);
    });

    it("awards $0.00 credit when wrong SKU was returned (0 accepted resaleable)", () => {
      const line = createMockRmaItem({
        id: "l1",
        quantityAuthorized: 10,
        frozenUnitWholesalePrice: 25.0,
        frozenWholesalePriceCents: 2500,
      });

      const inspection = {
        id: "insp-300",
        rmaId: "rma-test",
        inspectedBy: { userId: "wh-1", name: "Inspector", role: "inspector" as const },
        inspectedAt: "2026-03-10T12:00:00Z",
        boxCondition: "intact" as const,
        lines: [
          {
            lineId: "l1",
            productId: "p1",
            productSku: "SKU-1",
            productName: "Item 1",
            quantityAuthorized: 10,
            quantityReceived: 10,
            quantityAcceptedResaleable: 0,
            quantityRejected: 10,
            quantityMissing: 0,
            discrepancyType: "wrong_sku" as const,
          },
        ],
        totalAuthorized: 10,
        totalReceived: 10,
        totalAcceptedResaleable: 0,
        totalRejected: 10,
        totalMissing: 0,
        hasDiscrepancies: true,
      };

      const rma = createMockRmaAggregate({
        status: "inspection_completed",
        lines: [line],
        inspectionRecord: inspection,
      });

      const res = calculateSettlementReadyAmount(rma);
      expect(res.success).toBe(true);
      expect(res.settlementInstruction!.totalAcceptedUnits).toBe(0);
      expect(res.settlementInstruction!.totalSettlementAmountDollars).toBe(0);
      expect(res.settlementInstruction!.totalSettlementAmountCents).toBe(0);
    });

    it("generates deterministic idempotency key and prevents duplicate settlement proposals", () => {
      const line = createMockRmaItem({
        id: "l1",
        quantityAuthorized: 5,
        frozenUnitWholesalePrice: 10.0,
        frozenWholesalePriceCents: 1000,
      });

      const inspection = {
        id: "insp-400",
        rmaId: "rma-test-idem",
        inspectedBy: { userId: "wh-1", name: "Inspector", role: "inspector" as const },
        inspectedAt: "2026-03-10T12:00:00Z",
        boxCondition: "intact" as const,
        lines: [
          {
            lineId: "l1",
            productId: "p1",
            productSku: "SKU-1",
            productName: "Item 1",
            quantityAuthorized: 5,
            quantityReceived: 5,
            quantityAcceptedResaleable: 5,
            quantityRejected: 0,
            quantityMissing: 0,
            discrepancyType: "exact_match" as const,
          },
        ],
        totalAuthorized: 5,
        totalReceived: 5,
        totalAcceptedResaleable: 5,
        totalRejected: 0,
        totalMissing: 0,
        hasDiscrepancies: false,
      };

      const rma = createMockRmaAggregate({
        id: "rma-test-idem",
        status: "inspection_completed",
        lines: [line],
        inspectionRecord: inspection,
      });

      const res1 = calculateSettlementReadyAmount(rma);
      const res2 = calculateSettlementReadyAmount(rma);

      expect(res1.settlementInstruction!.idempotencyKey).toBe(
        res2.settlementInstruction!.idempotencyKey
      );

      const isMatch = verifySettlementIdempotency(
        res1.settlementInstruction!,
        res2.settlementInstruction!
      );
      expect(isMatch).toBe(true);
    });
  });
});
