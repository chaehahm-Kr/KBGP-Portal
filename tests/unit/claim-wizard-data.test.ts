import { describe, it, expect } from "vitest";
import {
  mapEvaluatorStatusToWizardStatus,
  adaptCohortToWizardProductItem,
  convertWizardSelectionToClaimInput,
  RawCohortWithRelations,
} from "@/lib/retailer/exchange-credit-wizard-adapter";
import {
  formatCurrency,
  formatRetailerFriendlyReason,
  calculateItemCredit,
  calculateWizardTotals,
} from "@/components/retailer/exchange-credit/claim-wizard-helpers";
import {
  ClaimWizardProductItem,
  SelectedClaimItem,
} from "@/components/retailer/exchange-credit/claim-wizard-types";

describe("Retailer Claim Wizard Real Data Integration (EXCHANGE-CREDIT-PH2-008)", () => {
  // Helper to construct baseline mock cohort
  function buildTestCohort(overrides: Partial<RawCohortWithRelations> = {}): RawCohortWithRelations {
    const defaultChecks = [];
    for (let i = 1; i <= 8; i++) {
      defaultChecks.push({
        reportingWeek: `2026-W${20 + i}`,
        submittedAt: `2026-06-${String(i * 7).padStart(2, "0")}`,
        status: "submitted" as const,
        onHandQuantity: 60,
      });
    }

    return {
      cohort: {
        id: "cohort_alpha_01",
        cohort_code: "PSC-2026-000101",
        company_id: "comp_test_01",
        store_id: "store_seoul_01",
        product_id: "prod_ampoule_01",
        total_protected_quantity: 100,
        fulfilled_protected_quantity: 100,
        frozen_unit_wholesale_price: 32.5,
        frozen_option_a_rate: 0.45,
        frozen_option_b_rate: 1.0,
        current_stock: 60,
        status: "active_protection",
      },
      product: {
        id: "prod_ampoule_01",
        name: "Glow Radiance Ampoule 30ml",
        sku: "SKU-AMP-30",
        brand_name: "LumiSkin",
        thumbnail_url: "https://example.com/ampoule.png",
      },
      store: {
        id: "store_seoul_01",
        name: "Seoul Main Store",
        code: "STR-SEOUL-01",
      },
      shipments: [
        {
          shipmentId: "ship_01",
          shipmentDate: "2026-06-01", // Day 0
          quantityShipped: 100,
          isFirstShipment: true,
        },
      ],
      weeklyChecks: defaultChecks,
      salesEvidence: {
        source: "pos_verified",
        isTrustworthy: true,
        cumulativeSoldUnits: 30, // 30% sold (< 50%)
      },
      reorders: [],
      existingClaimState: { lifecycleState: "none" },
      currentVerifiedStock: 60,
      ...overrides,
    };
  }

  // 1. Company & Store Isolation
  describe("Company & Multi-Store Tenant Isolation", () => {
    it("ensures product item retains authoritative storeId and storeName", () => {
      const cohortData = buildTestCohort();
      const item = adaptCohortToWizardProductItem(cohortData, "2026-09-15"); // Day 106

      expect(item.storeId).toBe("store_seoul_01");
      expect(item.storeName).toBe("Seoul Main Store");
      expect(item.productSku).toBe("SKU-AMP-30");
    });

    it("rejects claim conversion when target store does not match item store", () => {
      const selectedItems: SelectedClaimItem[] = [
        {
          cohortId: "cohort_alpha_01",
          productId: "prod_ampoule_01",
          productName: "Glow Ampoule",
          productSku: "SKU-AMP-30",
          selectedOption: "A",
          selectedQuantity: 20,
          maxClaimableQuantity: 60,
          unitWholesalePrice: 32.5,
          creditRate: 0.45,
          estimatedCredit: 292.5,
        },
      ];

      const result = convertWizardSelectionToClaimInput(
        "", // Missing storeId
        selectedItems,
        true
      );

      expect(result.isValid).toBe(false);
      expect(result.error).toContain("매장을 선택해 주세요.");
    });
  });

  // 2. Date Boundaries: Day 0 -> Day 100 -> Day 150
  describe("Authoritative Timeline & Date Boundaries", () => {
    it("classifies cohort before Day 100 as UPCOMING with 0 claimable quantity", () => {
      const cohortData = buildTestCohort();
      // Day 45: 2026-07-16
      const item = adaptCohortToWizardProductItem(cohortData, "2026-07-16");

      expect(item.status).toBe("UPCOMING");
      expect(item.maxClaimableQuantity).toBe(0);
      expect(item.statusReason).toContain("EVALUATION_PENDING");
    });

    it("classifies cohort on Day 105 as ELIGIBLE with full claimable quantity", () => {
      const cohortData = buildTestCohort();
      // Day 105: 2026-09-14
      const item = adaptCohortToWizardProductItem(cohortData, "2026-09-14");

      expect(item.status).toBe("ELIGIBLE");
      expect(item.maxClaimableQuantity).toBe(60);
      expect(item.daysRemaining).toBe(45); // Day 150 - Day 105 = 45 days
    });

    it("classifies cohort after Day 150 as EXPIRED with 0 claimable quantity", () => {
      const cohortData = buildTestCohort();
      // Day 155: 2026-11-03
      const item = adaptCohortToWizardProductItem(cohortData, "2026-11-03");

      expect(item.status).toBe("EXPIRED");
      expect(item.maxClaimableQuantity).toBe(0);
      expect(item.statusReason).toContain("DEADLINE_EXPIRED");
    });
  });

  // 3. Weekly Report Coverage & Sell-Through Rules
  describe("Weekly Check & Sell-Through Validation", () => {
    it("disqualifies cohort with only 7 submitted weekly checks at Day 105", () => {
      const sevenChecks = [];
      for (let i = 1; i <= 7; i++) {
        sevenChecks.push({
          reportingWeek: `2026-W${20 + i}`,
          submittedAt: `2026-06-${String(i * 7).padStart(2, "0")}`,
          status: "submitted" as const,
          onHandQuantity: 60,
        });
      }

      const cohortData = buildTestCohort({ weeklyChecks: sevenChecks });
      const item = adaptCohortToWizardProductItem(cohortData, "2026-09-14");

      expect(item.status).toBe("NOT_ELIGIBLE");
      expect(item.distinctReportingWeeks).toBe(7);
      expect(item.weeklyChecksCompleted).toBe(false);
      expect(item.maxClaimableQuantity).toBe(0);
      expect(item.statusReason).toContain("INSUFFICIENT_REPORTING_WEEKS");
    });

    it("disqualifies cohort with sell-through >= 50% at Day 105", () => {
      const cohortData = buildTestCohort({
        salesEvidence: {
          source: "pos_verified",
          isTrustworthy: true,
          cumulativeSoldUnits: 50, // 50 / 100 = 50.00% (Not strictly below 50%)
        },
      });

      const item = adaptCohortToWizardProductItem(cohortData, "2026-09-14");

      expect(item.status).toBe("NOT_ELIGIBLE");
      expect(item.maxClaimableQuantity).toBe(0);
      expect(item.statusReason).toContain("EXCESS_SELL_THROUGH");
    });
  });

  // 4. Confirmed Reorder Disqualification
  describe("Confirmed Reorder Disqualification", () => {
    it("disqualifies cohort when confirmed reorder exists for same store and SKU", () => {
      const cohortData = buildTestCohort({
        reorders: [
          {
            orderId: "ord_reorder_101",
            storeId: "store_seoul_01",
            productId: "prod_ampoule_01",
            orderDate: "2026-08-01",
            status: "confirmed",
          },
        ],
      });

      const item = adaptCohortToWizardProductItem(cohortData, "2026-09-14");

      expect(item.status).toBe("NOT_ELIGIBLE");
      expect(item.statusReason).toContain("DISQUALIFIED_REORDERED");
      expect(item.maxClaimableQuantity).toBe(0);
    });

    it("does NOT disqualify when reorder was cancelled or draft", () => {
      const cohortData = buildTestCohort({
        reorders: [
          {
            orderId: "ord_draft_101",
            storeId: "store_seoul_01",
            productId: "prod_ampoule_01",
            orderDate: "2026-08-01",
            status: "cancelled",
          },
        ],
      });

      const item = adaptCohortToWizardProductItem(cohortData, "2026-09-14");

      expect(item.status).toBe("ELIGIBLE");
      expect(item.maxClaimableQuantity).toBe(60);
    });

    it("does NOT disqualify when order was for a different store", () => {
      const cohortData = buildTestCohort({
        reorders: [
          {
            orderId: "ord_diff_store",
            storeId: "store_busan_02", // Different store
            productId: "prod_ampoule_01",
            orderDate: "2026-08-01",
            status: "delivered",
          },
        ],
      });

      const item = adaptCohortToWizardProductItem(cohortData, "2026-09-14");

      expect(item.status).toBe("ELIGIBLE");
      expect(item.maxClaimableQuantity).toBe(60);
    });
  });

  // 5. Financial Estimate Calculations
  describe("Option A & Option B Credit Calculations", () => {
    const mockItem: ClaimWizardProductItem = {
      cohortId: "cohort_01",
      storeId: "store_01",
      storeName: "Seoul Store",
      productId: "prod_01",
      productName: "Cream 50ml",
      productSku: "SKU-CRM-50",
      status: "ELIGIBLE",
      statusReason: null,
      evaluationDate: "2026-09-10",
      claimDeadlineDate: "2026-10-30",
      daysRemaining: 40,
      distinctReportingWeeks: 8,
      minReportingWeeksRequired: 8,
      weeklyChecksCompleted: true,
      fulfilledProtectedQuantity: 100,
      currentVerifiedStock: 50,
      maxClaimableQuantity: 50,
      unitWholesalePrice: 20.0,
      frozenOptionARate: 0.40,
      frozenOptionBRate: 1.0,
    };

    it("calculates Option A credit at frozen rate (40%)", () => {
      const res = calculateItemCredit(mockItem, "A", 25);
      // 25 units * $20.00 * 0.40 = $200.00
      expect(res.rate).toBe(0.40);
      expect(res.credit).toBe(200.0);
    });

    it("calculates Option B credit at 100% of original wholesale price", () => {
      const res = calculateItemCredit(mockItem, "B", 25);
      // 25 units * $20.00 * 1.00 = $500.00
      expect(res.rate).toBe(1.0);
      expect(res.credit).toBe(500.0);
    });

    it("aggregates mixed SKU selections in WizardTotals", () => {
      const selected: SelectedClaimItem[] = [
        {
          cohortId: "cohort_01",
          productId: "prod_01",
          productName: "Cream 50ml",
          productSku: "SKU-CRM-50",
          selectedOption: "A",
          selectedQuantity: 20,
          maxClaimableQuantity: 50,
          unitWholesalePrice: 20.0,
          creditRate: 0.40,
          estimatedCredit: 160.0, // 20 * 20 * 0.4
        },
        {
          cohortId: "cohort_02",
          productId: "prod_02",
          productName: "Serum 30ml",
          productSku: "SKU-SER-30",
          selectedOption: "B",
          selectedQuantity: 10,
          maxClaimableQuantity: 30,
          unitWholesalePrice: 30.0,
          creditRate: 1.0,
          estimatedCredit: 300.0, // 10 * 30 * 1.0
        },
      ];

      const totals = calculateWizardTotals(selected);

      expect(totals.totalUnits).toBe(30);
      expect(totals.totalOptionAUnits).toBe(20);
      expect(totals.totalOptionBUnits).toBe(10);
      expect(totals.totalOptionACredit).toBe(160.0);
      expect(totals.totalOptionBCredit).toBe(300.0);
      expect(totals.grandTotalEstimatedCredit).toBe(460.0);
      expect(totals.hasOptionB).toBe(true);
      expect(totals.isValid).toBe(true);
    });
  });

  // 6. Safe Currency Formatting (No Unknown as $0)
  describe("formatCurrency safety", () => {
    it("formats valid dollar amount accurately", () => {
      expect(formatCurrency(25.5)).toBe("$25.50");
      expect(formatCurrency(1200)).toBe("$1,200.00");
    });

    it("formats 0 as $0.00 when explicitly zero", () => {
      expect(formatCurrency(0)).toBe("$0.00");
    });

    it("gracefully returns em-dash for undefined or null amounts", () => {
      expect(formatCurrency(undefined)).toBe("—");
      expect(formatCurrency(null)).toBe("—");
      expect(formatCurrency(NaN)).toBe("—");
      expect(formatCurrency(-1)).toBe("—");
    });
  });

  // 7. Duplicate Claim & Prior Claim Protection
  describe("Duplicate Claim Prevention", () => {
    it("marks cohort as CLAIMED if existing submitted claim exists", () => {
      const cohortData = buildTestCohort({
        existingClaimState: {
          lifecycleState: "submitted",
          claimId: "claim_prior_01",
        },
      });

      const item = adaptCohortToWizardProductItem(cohortData, "2026-09-14");

      expect(item.status).toBe("CLAIMED");
      expect(item.maxClaimableQuantity).toBe(0);
      expect(item.statusReason).toContain("CLAIM_ALREADY_PENDING");
    });
  });

  // 8. Physical Stock Reconfirmation Requirement
  describe("Physical Stock Reconfirmation Guard", () => {
    it("rejects claim conversion when stock reconfirmation is false", () => {
      const selected: SelectedClaimItem[] = [
        {
          cohortId: "cohort_01",
          productId: "prod_01",
          productName: "Cream",
          productSku: "SKU-CRM-50",
          selectedOption: "A",
          selectedQuantity: 10,
          maxClaimableQuantity: 50,
          unitWholesalePrice: 20.0,
          creditRate: 0.40,
          estimatedCredit: 80.0,
        },
      ];

      const res = convertWizardSelectionToClaimInput("store_01", selected, false);

      expect(res.isValid).toBe(false);
      expect(res.error).toContain("매장 실재고 일치 확인");
    });
  });
});
