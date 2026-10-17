import { describe, it, expect } from "vitest";
import {
  mapEvaluatorStatusToWizardStatus,
  adaptCohortToWizardProductItem,
  convertWizardSelectionToClaimInput,
  RawCohortWithRelations,
} from "@/lib/retailer/exchange-credit-wizard-adapter";
import { SelectedClaimItem } from "@/components/retailer/exchange-credit/claim-wizard-types";

describe("Retailer Claim Wizard Adapter (EXCHANGE-CREDIT-PH2-007)", () => {
  // 1. Status Mapping Tests
  describe("mapEvaluatorStatusToWizardStatus", () => {
    it("maps ELIGIBLE directly to ELIGIBLE", () => {
      expect(mapEvaluatorStatusToWizardStatus("ELIGIBLE")).toBe("ELIGIBLE");
    });

    it("maps UPCOMING to UPCOMING", () => {
      expect(mapEvaluatorStatusToWizardStatus("UPCOMING")).toBe("UPCOMING");
    });

    it("maps EXPIRED to EXPIRED", () => {
      expect(mapEvaluatorStatusToWizardStatus("EXPIRED")).toBe("EXPIRED");
    });

    it("maps CLAIM_PENDING, CLAIM_SETTLED, and CLAIM_REJECTED to CLAIMED", () => {
      expect(mapEvaluatorStatusToWizardStatus("CLAIM_PENDING")).toBe("CLAIMED");
      expect(mapEvaluatorStatusToWizardStatus("CLAIM_SETTLED")).toBe("CLAIMED");
      expect(mapEvaluatorStatusToWizardStatus("CLAIM_REJECTED")).toBe("CLAIMED");
    });

    it("maps NEEDS_REVIEW to NEEDS_REVIEW", () => {
      expect(mapEvaluatorStatusToWizardStatus("NEEDS_REVIEW")).toBe("NEEDS_REVIEW");
    });

    it("maps NOT_ELIGIBLE to NOT_ELIGIBLE", () => {
      expect(mapEvaluatorStatusToWizardStatus("NOT_ELIGIBLE")).toBe("NOT_ELIGIBLE");
    });
  });

  // 2. Cohort Adaptation Tests
  describe("adaptCohortToWizardProductItem", () => {
    function createMockRawCohort(overrides: Partial<RawCohortWithRelations> = {}): RawCohortWithRelations {
      const baseDeliveryDate = "2026-06-01"; // Day 0
      const weeklyChecks = [];
      for (let i = 1; i <= 8; i++) {
        weeklyChecks.push({
          reportingWeek: `2026-W${20 + i}`,
          submittedAt: `2026-06-${String(i * 7).padStart(2, "0")}`,
          status: "submitted" as const,
          onHandQuantity: 70,
        });
      }

      return {
        cohort: {
          id: "cohort_test_01",
          cohort_code: "COHORT-2026-001",
          company_id: "comp_01",
          store_id: "store_01",
          product_id: "prod_01",
          total_protected_quantity: 100,
          fulfilled_protected_quantity: 100,
          frozen_unit_wholesale_price: 25.0,
          frozen_option_a_rate: 0.45,
          current_stock: 75,
          status: "active_protection",
        },
        product: {
          id: "prod_01",
          name: "Ceramide Deep Cream 50ml",
          sku: "SKU-CRM-50",
          brand_name: "K-Beauty Essentials",
          thumbnail_url: "https://example.com/thumb.jpg",
        },
        store: {
          id: "store_01",
          name: "Gangnam Flagship Store",
          code: "STR-GN-01",
        },
        shipments: [
          {
            shipmentId: "ship_01",
            shipmentDate: baseDeliveryDate,
            quantityShipped: 100,
            isFirstShipment: true,
          },
        ],
        weeklyChecks,
        salesEvidence: {
          source: "pos_verified",
          isTrustworthy: true,
          cumulativeSoldUnits: 25, // 25% sold (< 50%)
        },
        reorders: [],
        currentVerifiedStock: 75,
        ...overrides,
      };
    }

    it("correctly adapts an eligible cohort at Day 105", () => {
      const raw = createMockRawCohort();
      // As of Day 105: 2026-06-01 + 105 days = 2026-09-14
      const item = adaptCohortToWizardProductItem(raw, "2026-09-14");

      expect(item.cohortId).toBe("cohort_test_01");
      expect(item.storeId).toBe("store_01");
      expect(item.storeName).toBe("Gangnam Flagship Store");
      expect(item.productId).toBe("prod_01");
      expect(item.productName).toBe("Ceramide Deep Cream 50ml");
      expect(item.productSku).toBe("SKU-CRM-50");
      expect(item.brandName).toBe("K-Beauty Essentials");
      expect(item.thumbnailUrl).toBe("https://example.com/thumb.jpg");

      expect(item.status).toBe("ELIGIBLE");
      expect(item.statusReason).toBeNull();
      expect(item.unitWholesalePrice).toBe(25.0);
      expect(item.frozenOptionARate).toBe(0.45);
      expect(item.frozenOptionBRate).toBe(1.0);
      expect(item.maxClaimableQuantity).toBe(75);
      expect(item.distinctReportingWeeks).toBe(8);
      expect(item.weeklyChecksCompleted).toBe(true);
    });

    it("correctly adapts an upcoming cohort before Day 90", () => {
      const raw = createMockRawCohort();
      // As of Day 50: 2026-07-21
      const item = adaptCohortToWizardProductItem(raw, "2026-07-21");

      expect(item.status).toBe("UPCOMING");
      expect(item.maxClaimableQuantity).toBe(0);
    });

    it("correctly adapts a disqualified cohort with repeat reorder", () => {
      const raw = createMockRawCohort({
        reorders: [
          {
            orderId: "ord_repeat_01",
            storeId: "store_01",
            productId: "prod_01",
            orderDate: "2026-08-10",
            status: "confirmed",
          },
        ],
      });
      const item = adaptCohortToWizardProductItem(raw, "2026-09-14");

      expect(item.status).toBe("NOT_ELIGIBLE");
      expect(item.statusReason).toContain("DISQUALIFIED_REORDERED");
      expect(item.maxClaimableQuantity).toBe(0);
    });
  });

  // 3. Selection Conversion Tests
  describe("convertWizardSelectionToClaimInput", () => {
    const mockSelectedItems: SelectedClaimItem[] = [
      {
        cohortId: "cohort_01",
        productId: "prod_01",
        productName: "Cream 50ml",
        productSku: "SKU-CRM-50",
        selectedOption: "A",
        selectedQuantity: 30,
        maxClaimableQuantity: 50,
        unitWholesalePrice: 20.0,
        creditRate: 0.4,
        estimatedCredit: 240.0,
      },
      {
        cohortId: "cohort_02",
        productId: "prod_02",
        productName: "Toner 150ml",
        productSku: "SKU-TNR-150",
        selectedOption: "B",
        selectedQuantity: 20,
        maxClaimableQuantity: 25,
        unitWholesalePrice: 15.0,
        creditRate: 1.0,
        estimatedCredit: 300.0,
      },
    ];

    it("rejects conversion when storeId is empty", () => {
      const result = convertWizardSelectionToClaimInput("", mockSelectedItems, true);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("매장");
    });

    it("rejects conversion when selectedItems array is empty", () => {
      const result = convertWizardSelectionToClaimInput("store_01", [], true);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("최소 1개");
    });

    it("rejects conversion when stock reconfirmation is false", () => {
      const result = convertWizardSelectionToClaimInput("store_01", mockSelectedItems, false);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("실재고 일치 확인");
    });

    it("successfully converts valid mixed Option A/B selections to SubmitClaimInput", () => {
      const result = convertWizardSelectionToClaimInput(
        "store_01",
        mockSelectedItems,
        true,
        "매장 담당자 교환 크레딧 신청"
      );

      expect(result.isValid).toBe(true);
      expect(result.input).toBeDefined();
      expect(result.input?.storeId).toBe("store_01");
      expect(result.input?.isStockReconfirmed).toBe(true);
      expect(result.input?.retailerNotes).toBe("매장 담당자 교환 크레딧 신청");
      expect(result.input?.items.length).toBe(2);

      expect(result.input?.items[0]).toEqual({
        cohortId: "cohort_01",
        productId: "prod_01",
        selectedOption: "A",
        selectedQuantity: 30,
        currentConfirmedStock: 30,
      });

      expect(result.input?.items[1]).toEqual({
        cohortId: "cohort_02",
        productId: "prod_02",
        selectedOption: "B",
        selectedQuantity: 20,
        currentConfirmedStock: 20,
      });
    });
  });
});
