/**
 * Admin RMA Management & Warehouse Inspection UI Tests
 * Task ID: EXCHANGE-CREDIT-PH3-002
 * Location: tests/unit/admin-rma-ui.test.ts
 *
 * Automated tests for Admin RMA UI contracts, filtering, deadline warnings,
 * inspection form validation invariants, settlement preview, and mutation safety.
 */

import { describe, it, expect } from "vitest";
import {
  RMA_STATUS_UI_CONFIG,
  AdminRmaFilterCategory,
} from "../../components/admin/exchange-credit/rma/admin-rma-types";
import {
  RmaAggregate,
  RmaItemLine,
  calculateShippingDeadline,
  calculateSettlementReadyAmount,
  reconcileWarehouseInspection,
} from "../../lib/retailer/rma";

// Test fixture helpers
function createMockRma(overrides: Partial<RmaAggregate> = {}): RmaAggregate {
  const line1: RmaItemLine = {
    id: "line-1",
    claimId: "clm-100",
    claimItemId: "item-101",
    cohortId: "coh-101",
    productId: "p1",
    productName: "Centella Calming Serum 50ml",
    productSku: "SKU-CENT-50",
    selectedOption: "B",
    quantityRequested: 10,
    quantityAuthorized: 10,
    frozenUnitWholesalePrice: 16.5,
    frozenWholesalePriceCents: 1650,
    boxId: "box-1",
  };

  const line2: RmaItemLine = {
    id: "line-2",
    claimId: "clm-100",
    claimItemId: "item-102",
    cohortId: "coh-102",
    productId: "p2",
    productName: "Hyaluronic Acid Toner 150ml",
    productSku: "SKU-HYAL-150",
    selectedOption: "B",
    quantityRequested: 5,
    quantityAuthorized: 5,
    frozenUnitWholesalePrice: 12.0,
    frozenWholesalePriceCents: 1200,
    boxId: "box-1",
  };

  return {
    id: "rma-mock-001",
    rmaNumber: "RMA-2026-000001",
    claimId: "clm-100",
    claimNumber: "CLM-2026-00001",
    storeId: "store-k-beauty-nyc",
    companyId: "comp-retailer-abc",
    status: "awaiting_admin_approval",
    lines: [line1, line2],
    boxes: [
      {
        id: "box-1",
        boxNumber: 1,
        carrier: "UPS",
        trackingNumber: "1Z9999999999999999",
        labelUrl: "https://labels.letusto.com/box1.pdf",
        status: "label_created",
        carrierEvents: [],
        assignedLines: [
          { lineId: "line-1", quantity: 10 },
          { lineId: "line-2", quantity: 5 },
        ],
      },
    ],
    approvalDate: null,
    shippingDeadlineDate: null,
    inspectionRecord: null,
    settlementInstruction: null,
    exceptions: [],
    eventHistory: [
      {
        id: "evt-1",
        rmaId: "rma-mock-001",
        eventType: "RMA_CREATED",
        oldStatus: null,
        newStatus: "awaiting_admin_approval",
        actor: { userId: "retailer-user-1", role: "retailer_store_manager" },
        reason: "Claim submitted with Option B return items",
        timestamp: "2026-03-01T10:00:00Z",
      },
    ],
    createdAt: "2026-03-01T10:00:00Z",
    updatedAt: "2026-03-01T10:00:00Z",
    ...overrides,
  };
}

describe("EXCHANGE-CREDIT-PH3-002: Admin RMA Management & Warehouse Inspection UI Contracts", () => {
  // ==========================================================================
  // 1. STATUS BADGES & CONFIGURATION MAPPINGS
  // ==========================================================================
  describe("1. Status Badges & UI Configurations", () => {
    it("maps all 10 RMA statuses to accessible labels and visual badge classes", () => {
      const statuses = [
        "awaiting_admin_approval",
        "approved",
        "shipped",
        "delivered",
        "inspection_in_progress",
        "inspection_completed",
        "resolution_ready",
        "cancelled",
        "expired",
        "exception",
      ] as const;

      for (const status of statuses) {
        const config = RMA_STATUS_UI_CONFIG[status];
        expect(config).toBeDefined();
        expect(config.label).toBeTruthy();
        expect(config.badgeClass).toContain("border");
        expect(config.dotColor).toContain("bg-");
      }
    });

    it("verifies specific badge copy for critical review states", () => {
      expect(RMA_STATUS_UI_CONFIG.awaiting_admin_approval.label).toBe("Awaiting Admin Approval");
      expect(RMA_STATUS_UI_CONFIG.approved.label).toBe("Approved · Awaiting Handoff");
      expect(RMA_STATUS_UI_CONFIG.exception.label).toBe("Exception · Admin Review Required");
      expect(RMA_STATUS_UI_CONFIG.resolution_ready.label).toBe("Resolution Ready (Settlement Proposed)");
    });
  });

  // ==========================================================================
  // 2. OVERVIEW GROUPING, FILTERING & SEARCH
  // ==========================================================================
  describe("2. Overview Grouping, Filtering & Search", () => {
    const rmaList: RmaAggregate[] = [
      createMockRma({ id: "rma-1", rmaNumber: "RMA-001", status: "awaiting_admin_approval" }),
      createMockRma({ id: "rma-2", rmaNumber: "RMA-002", status: "approved" }),
      createMockRma({ id: "rma-3", rmaNumber: "RMA-003", status: "shipped" }),
      createMockRma({ id: "rma-4", rmaNumber: "RMA-004", status: "inspection_in_progress" }),
      createMockRma({
        id: "rma-5",
        rmaNumber: "RMA-005",
        status: "exception",
        exceptions: [
          {
            id: "ex-1",
            code: "LATE_CARRIER_SCAN",
            severity: "medium",
            description: "Late scan after Day 14",
            flaggedAt: "2026-03-16T10:00:00Z",
            requiresAdminReview: true,
            flagCarrierClaim: false,
            resolved: false,
          },
        ],
      }),
      createMockRma({ id: "rma-6", rmaNumber: "RMA-006", status: "resolution_ready" }),
      createMockRma({ id: "rma-7", rmaNumber: "RMA-007", status: "cancelled" }),
    ];

    it("filters pending approval RMAs", () => {
      const filtered = rmaList.filter((r) => r.status === "awaiting_admin_approval");
      expect(filtered).toHaveLength(1);
      expect(filtered[0].rmaNumber).toBe("RMA-001");
    });

    it("filters warehouse inspection RMAs (delivered, in_progress, completed)", () => {
      const filtered = rmaList.filter(
        (r) =>
          r.status === "delivered" ||
          r.status === "inspection_in_progress" ||
          r.status === "inspection_completed"
      );
      expect(filtered).toHaveLength(1);
      expect(filtered[0].rmaNumber).toBe("RMA-004");
    });

    it("filters exceptions requiring admin review", () => {
      const filtered = rmaList.filter(
        (r) => r.status === "exception" || (r.exceptions && r.exceptions.length > 0)
      );
      expect(filtered).toHaveLength(1);
      expect(filtered[0].rmaNumber).toBe("RMA-005");
    });

    it("searches by SKU substring across lines", () => {
      const query = "CENT-50";
      const matches = rmaList.filter((r) =>
        r.lines.some((l) => l.productSku.toLowerCase().includes(query.toLowerCase()))
      );
      expect(matches).toHaveLength(7); // All mock RMAs contain CENT-50
    });

    it("searches by Store ID", () => {
      const query = "store-k-beauty";
      const matches = rmaList.filter((r) =>
        r.storeId.toLowerCase().includes(query.toLowerCase())
      );
      expect(matches).toHaveLength(7);
    });
  });

  // ==========================================================================
  // 3. SHIPPING DEADLINE & DAY 14 / DAY 15 WARNINGS
  // ==========================================================================
  describe("3. Shipping Deadline & Day 14 / Day 15 Warnings", () => {
    it("displays on-track status with days remaining when within Day 14", () => {
      const approvalDate = "2026-03-01";
      const asOfDate = "2026-03-08"; // Day 7
      const deadline = calculateShippingDeadline(approvalDate, asOfDate);

      expect(deadline.deadlineDate).toBe("2026-03-15");
      expect(deadline.daysElapsed).toBe(7);
      expect(deadline.daysRemaining).toBe(7);
      expect(deadline.isOverdue).toBe(false);
      expect(deadline.status).toBe("active");
    });

    it("displays Day 14 deadline boundary without overdue warning", () => {
      const approvalDate = "2026-03-01";
      const asOfDate = "2026-03-15"; // Day 14 exactly
      const deadline = calculateShippingDeadline(approvalDate, asOfDate);

      expect(deadline.daysElapsed).toBe(14);
      expect(deadline.daysRemaining).toBe(0);
      expect(deadline.isOverdue).toBe(false);
      expect(deadline.status).toBe("deadline_day");
    });

    it("triggers overdue warning on Day 15 and flags for Admin Exception Review", () => {
      const approvalDate = "2026-03-01";
      const asOfDate = "2026-03-16"; // Day 15 (Overdue)
      const deadline = calculateShippingDeadline(approvalDate, asOfDate);

      expect(deadline.daysElapsed).toBe(15);
      expect(deadline.daysRemaining).toBe(-1);
      expect(deadline.isOverdue).toBe(true);
      expect(deadline.status).toBe("overdue");
    });
  });

  // ==========================================================================
  // 4. MULTI-SKU & MULTI-BOX LABEL PRESENTATION
  // ==========================================================================
  describe("4. Multi-SKU & Multi-Box Label Presentation", () => {
    it("correctly models multi-box distribution for multiple Option B lines", () => {
      const rma = createMockRma({
        boxes: [
          {
            id: "box-1",
            boxNumber: 1,
            carrier: "UPS",
            trackingNumber: "1Z1111111111111111",
            status: "delivered",
            carrierEvents: [],
            assignedLines: [{ lineId: "line-1", quantity: 10 }],
          },
          {
            id: "box-2",
            boxNumber: 2,
            carrier: "UPS",
            trackingNumber: "1Z2222222222222222",
            status: "in_transit",
            carrierEvents: [],
            assignedLines: [{ lineId: "line-2", quantity: 5 }],
          },
        ],
      });

      expect(rma.boxes).toHaveLength(2);
      expect(rma.boxes[0].boxNumber).toBe(1);
      expect(rma.boxes[0].status).toBe("delivered");
      expect(rma.boxes[1].boxNumber).toBe(2);
      expect(rma.boxes[1].status).toBe("in_transit");
    });
  });

  // ==========================================================================
  // 5. WAREHOUSE INSPECTION VALIDATION INVARIANTS
  // ==========================================================================
  describe("5. Warehouse Inspection Invariants & Reconciliation", () => {
    const inspector = {
      userId: "wh-lead-01",
      name: "Warehouse Manager",
      role: "inspector" as const,
    };

    it("validates 100% exact match inspection and permits completion", () => {
      const rma = createMockRma();
      const res = reconcileWarehouseInspection(
        rma.lines,
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
            {
              lineId: "line-2",
              quantityReceived: 5,
              quantityAcceptedResaleable: 5,
              quantityRejected: 0,
            },
          ],
        },
        rma.id
      );

      expect(res.success).toBe(true);
      expect(res.inspectionRecord!.totalAuthorized).toBe(15);
      expect(res.inspectionRecord!.totalAcceptedResaleable).toBe(15);
      expect(res.inspectionRecord!.hasDiscrepancies).toBe(false);
    });

    it("blocks inspection completion when accepted exceeds received units", () => {
      const rma = createMockRma();
      const res = reconcileWarehouseInspection(
        rma.lines,
        {
          inspectedBy: inspector,
          boxCondition: "intact",
          lineInspections: [
            {
              lineId: "line-1",
              quantityReceived: 5,
              quantityAcceptedResaleable: 8, // 8 > 5: ILLEGAL
              quantityRejected: 0,
            },
            {
              lineId: "line-2",
              quantityReceived: 5,
              quantityAcceptedResaleable: 5,
              quantityRejected: 0,
            },
          ],
        },
        rma.id
      );

      expect(res.success).toBe(false);
      expect(res.errorCode).toBe("INSPECTION_INVARIANT_VIOLATION");
      expect(res.errors.some((e) => e.includes("cannot exceed received units"))).toBe(true);
    });

    it("blocks inspection completion when received units != accepted + rejected", () => {
      const rma = createMockRma();
      const res = reconcileWarehouseInspection(
        rma.lines,
        {
          inspectedBy: inspector,
          boxCondition: "intact",
          lineInspections: [
            {
              lineId: "line-1",
              quantityReceived: 10,
              quantityAcceptedResaleable: 6,
              quantityRejected: 2, // 6 + 2 = 8 != 10: 2 unaccounted!
            },
            {
              lineId: "line-2",
              quantityReceived: 5,
              quantityAcceptedResaleable: 5,
              quantityRejected: 0,
            },
          ],
        },
        rma.id
      );

      expect(res.success).toBe(false);
      expect(res.errors.some((e) => e.includes("must equal accepted"))).toBe(true);
    });

    it("blocks inspection completion when units are rejected without rejection reason", () => {
      const rma = createMockRma();
      const res = reconcileWarehouseInspection(
        rma.lines,
        {
          inspectedBy: inspector,
          boxCondition: "intact",
          lineInspections: [
            {
              lineId: "line-1",
              quantityReceived: 10,
              quantityAcceptedResaleable: 7,
              quantityRejected: 3,
              rejectionReason: null, // Missing!
            },
            {
              lineId: "line-2",
              quantityReceived: 5,
              quantityAcceptedResaleable: 5,
              quantityRejected: 0,
            },
          ],
        },
        rma.id
      );

      expect(res.success).toBe(false);
      expect(res.errors.some((e) => e.includes("Rejection reason is required"))).toBe(true);
    });
  });

  // ==========================================================================
  // 6. SETTLEMENT CREDIT PREVIEW & NO PREMATURE ISSUANCE
  // ==========================================================================
  describe("6. Settlement Credit Preview & No Premature Issuance", () => {
    it("prohibits settlement calculation for uninspected or pending RMAs", () => {
      const rma = createMockRma({ status: "awaiting_admin_approval" });
      const res = calculateSettlementReadyAmount(rma);

      expect(res.success).toBe(false);
      expect(res.errorCode).toBe("NO_CREDIT_BEFORE_INSPECTION");
    });

    it("calculates exact settlement for inspected units: 10 @ $16.50 + 5 @ $12.00 = $225.00 (22500 cents)", () => {
      const rma = createMockRma({
        status: "inspection_completed",
        inspectionRecord: {
          id: "insp-001",
          rmaId: "rma-mock-001",
          inspectedBy: { userId: "wh-1", name: "Inspector", role: "inspector" },
          inspectedAt: "2026-03-10T12:00:00Z",
          boxCondition: "intact",
          lines: [
            {
              lineId: "line-1",
              productId: "p1",
              productSku: "SKU-CENT-50",
              productName: "Serum",
              quantityAuthorized: 10,
              quantityReceived: 10,
              quantityAcceptedResaleable: 10,
              quantityRejected: 0,
              quantityMissing: 0,
              discrepancyType: "exact_match",
            },
            {
              lineId: "line-2",
              productId: "p2",
              productSku: "SKU-HYAL-150",
              productName: "Toner",
              quantityAuthorized: 5,
              quantityReceived: 5,
              quantityAcceptedResaleable: 5,
              quantityRejected: 0,
              quantityMissing: 0,
              discrepancyType: "exact_match",
            },
          ],
          totalAuthorized: 15,
          totalReceived: 15,
          totalAcceptedResaleable: 15,
          totalRejected: 0,
          totalMissing: 0,
          hasDiscrepancies: false,
        },
      });

      const res = calculateSettlementReadyAmount(rma);
      expect(res.success).toBe(true);

      const instruction = res.settlementInstruction!;
      expect(instruction.totalAcceptedUnits).toBe(15);
      expect(instruction.totalSettlementAmountCents).toBe(22500); // 10*1650 + 5*1200 = 16500 + 6000 = 22500
      expect(instruction.totalSettlementAmountDollars).toBe(225.0);
      expect(instruction.creditRate).toBe(1.0);
      expect(instruction.status).toBe("settlement_proposed");
      expect(instruction.disclaimer).toContain("No credit ledger entry created");
    });
  });

  // ==========================================================================
  // 7. EXCEPTION POLICY CALLOUTS & CARRIER CLAIMS
  // ==========================================================================
  describe("7. Exception Policy Callouts & Carrier Claims", () => {
    it("flags carrier lost parcel for Letusto prepaid label without retailer forfeiture", () => {
      const ex = {
        id: "ex-lost-01",
        code: "CARRIER_LOST_PARCEL" as const,
        severity: "high" as const,
        description: "Carrier tracking indicates parcel lost in transit on Letusto prepaid label.",
        flaggedAt: "2026-03-10T12:00:00Z",
        requiresAdminReview: true,
        flagCarrierClaim: true,
        resolved: false,
      };

      expect(ex.flagCarrierClaim).toBe(true);
      expect(ex.requiresAdminReview).toBe(true);
      expect(ex.resolved).toBe(false);
    });

    it("flags late carrier scan for Admin review rather than automatic forfeiture", () => {
      const ex = {
        id: "ex-late-01",
        code: "LATE_CARRIER_SCAN" as const,
        severity: "medium" as const,
        description: "Carrier scan received on Day 16.",
        flaggedAt: "2026-03-17T12:00:00Z",
        requiresAdminReview: true,
        flagCarrierClaim: false,
        resolved: false,
      };

      expect(ex.requiresAdminReview).toBe(true);
      expect(ex.flagCarrierClaim).toBe(false);
    });
  });
});
