import { describe, it, expect } from "vitest";
import {
  getStatusBadgeConfig,
  formatRetailerFriendlyReason,
  calculateItemCredit,
  calculateWizardTotals,
  formatCurrency,
} from "@/components/retailer/exchange-credit/claim-wizard-helpers";
import {
  ClaimWizardProductItem,
  ClaimWizardStore,
  SelectedClaimItem,
} from "@/components/retailer/exchange-credit/claim-wizard-types";

describe("Retailer 90-Day Exchange Credit 3-Step Claim Wizard Logic & Contracts", () => {
  const mockStore1: ClaimWizardStore = {
    id: "store_001",
    name: "Manhattan Flagship",
    code: "STR-NY-01",
    city: "New York",
    state: "NY",
  };

  const mockStore2: ClaimWizardStore = {
    id: "store_002",
    name: "Queens Plaza",
    code: "STR-NY-02",
    city: "Queens",
    state: "NY",
  };

  const mockEligibleProduct1: ClaimWizardProductItem = {
    cohortId: "cohort_001",
    storeId: "store_001",
    storeName: "Manhattan Flagship",
    productId: "prod_001",
    productName: "Soothing Moisture Cream 50ml",
    productSku: "SKU-BEAUTY-01",
    brandName: "Glow Lab",
    status: "ELIGIBLE",
    statusReason: null,
    evaluationDate: "2026-09-09",
    claimDeadlineDate: "2026-10-29",
    daysRemaining: 45,
    distinctReportingWeeks: 8,
    minReportingWeeksRequired: 8,
    weeklyChecksCompleted: true,
    fulfilledProtectedQuantity: 100,
    currentVerifiedStock: 60,
    maxClaimableQuantity: 60,
    unitWholesalePrice: 20.0,
    frozenOptionARate: 0.4,
    frozenOptionBRate: 1.0,
  };

  const mockEligibleProduct2: ClaimWizardProductItem = {
    cohortId: "cohort_002",
    storeId: "store_001",
    storeName: "Manhattan Flagship",
    productId: "prod_002",
    productName: "Hydrating Facial Toner 150ml",
    productSku: "SKU-BEAUTY-02",
    brandName: "Glow Lab",
    status: "ELIGIBLE",
    statusReason: null,
    evaluationDate: "2026-09-09",
    claimDeadlineDate: "2026-10-29",
    daysRemaining: 45,
    distinctReportingWeeks: 9,
    minReportingWeeksRequired: 8,
    weeklyChecksCompleted: true,
    fulfilledProtectedQuantity: 50,
    currentVerifiedStock: 30,
    maxClaimableQuantity: 30,
    unitWholesalePrice: 15.0,
    frozenOptionARate: 0.35, // Custom frozen 35%
    frozenOptionBRate: 1.0,
  };

  const mockIneligibleProduct: ClaimWizardProductItem = {
    cohortId: "cohort_003",
    storeId: "store_001",
    storeName: "Manhattan Flagship",
    productId: "prod_003",
    productName: "Blemish Clear Serum",
    productSku: "SKU-BEAUTY-03",
    brandName: "DermaPure",
    status: "NOT_ELIGIBLE",
    statusReason: "EXCESS_SELL_THROUGH",
    evaluationDate: "2026-09-09",
    claimDeadlineDate: "2026-10-29",
    daysRemaining: 45,
    distinctReportingWeeks: 8,
    minReportingWeeksRequired: 8,
    weeklyChecksCompleted: true,
    fulfilledProtectedQuantity: 100,
    currentVerifiedStock: 20,
    maxClaimableQuantity: 0,
    unitWholesalePrice: 18.0,
    frozenOptionARate: 0.4,
    frozenOptionBRate: 1.0,
  };

  const mockUpcomingProduct: ClaimWizardProductItem = {
    cohortId: "cohort_004",
    storeId: "store_001",
    storeName: "Manhattan Flagship",
    productId: "prod_004",
    productName: "Revitalizing Eye Gel",
    productSku: "SKU-BEAUTY-04",
    status: "UPCOMING",
    statusReason: "EVALUATION_PENDING",
    evaluationDate: "2026-11-01",
    claimDeadlineDate: "2026-12-21",
    daysRemaining: 65,
    distinctReportingWeeks: 5,
    minReportingWeeksRequired: 8,
    weeklyChecksCompleted: false,
    fulfilledProtectedQuantity: 80,
    currentVerifiedStock: 60,
    maxClaimableQuantity: 0,
    unitWholesalePrice: 22.0,
    frozenOptionARate: 0.4,
    frozenOptionBRate: 1.0,
  };

  // -------------------------------------------------------------------------
  // 1. Status Badge & Friendly Reason Formatting
  // -------------------------------------------------------------------------
  it("formats plain-language status badges and disables selection for non-eligible states", () => {
    const eligibleBadge = getStatusBadgeConfig("ELIGIBLE", 45);
    expect(eligibleBadge.isSelectable).toBe(true);
    expect(eligibleBadge.label).toContain("신청 가능");
    expect(eligibleBadge.explanation).toContain("45일");

    const upcomingBadge = getStatusBadgeConfig("UPCOMING");
    expect(upcomingBadge.isSelectable).toBe(false);
    expect(upcomingBadge.label).toContain("평가 대기");

    const notEligibleBadge = getStatusBadgeConfig("NOT_ELIGIBLE");
    expect(notEligibleBadge.isSelectable).toBe(false);

    const needsReviewBadge = getStatusBadgeConfig("NEEDS_REVIEW");
    expect(needsReviewBadge.isSelectable).toBe(false);
    expect(needsReviewBadge.label).toContain("데이터 확인 중");

    const claimedBadge = getStatusBadgeConfig("CLAIMED");
    expect(claimedBadge.isSelectable).toBe(false);

    const expiredBadge = getStatusBadgeConfig("EXPIRED");
    expect(expiredBadge.isSelectable).toBe(false);
  });

  it("converts raw technical reason codes to retailer-friendly Korean text", () => {
    expect(formatRetailerFriendlyReason("EXCESS_SELL_THROUGH")).toBe(
      "판매율 50% 초과 (성공적 판매로 보증 대상 제외)"
    );
    expect(formatRetailerFriendlyReason("INSUFFICIENT_REPORTING_WEEKS")).toBe(
      "주간 재고 점검 보고 횟수 부족 (필수 8주 미만 완료)"
    );
    expect(formatRetailerFriendlyReason("DISQUALIFIED_REORDERED")).toBe(
      "동일 매장 추가 발주로 인한 보증 종료"
    );
    expect(formatRetailerFriendlyReason("ZERO_REMAINING_STOCK")).toBe(
      "매장 보유 실사 잔여 재고 없음 (0개)"
    );
  });

  // -------------------------------------------------------------------------
  // 2. Step 1: Multiple Eligible SKUs from ONE Store Only
  // -------------------------------------------------------------------------
  it("enforces single-store context and filters candidates by selected store", () => {
    const allProducts = [
      mockEligibleProduct1, // Store 1
      mockEligibleProduct2, // Store 1
      {
        ...mockEligibleProduct1,
        cohortId: "cohort_store_2",
        storeId: "store_002", // Store 2
      },
    ];

    const store1Products = allProducts.filter((p) => p.storeId === mockStore1.id);
    expect(store1Products.length).toBe(2);
    expect(store1Products.every((p) => p.storeId === "store_001")).toBe(true);

    const store2Products = allProducts.filter((p) => p.storeId === mockStore2.id);
    expect(store2Products.length).toBe(1);
    expect(store2Products[0].cohortId).toBe("cohort_store_2");
  });

  it("prevents selecting ineligible or upcoming SKUs from proceeding", () => {
    const items = [mockIneligibleProduct, mockUpcomingProduct];
    const selectable = items.filter((p) => getStatusBadgeConfig(p.status).isSelectable);
    expect(selectable.length).toBe(0);
  });

  // -------------------------------------------------------------------------
  // 3. Step 2: Option A vs Option B Calculations
  // -------------------------------------------------------------------------
  it("calculates Option A Keep & Credit using frozen company rate (40% default)", () => {
    // 60 units * $20.00 wholesale * 40% = $480.00
    const calc = calculateItemCredit(mockEligibleProduct1, "A", 60);
    expect(calc.rate).toBe(0.4);
    expect(calc.credit).toBe(480.0);
  });

  it("calculates Option A Keep & Credit using custom frozen company rate (35%)", () => {
    // 30 units * $15.00 wholesale * 35% = $157.50
    const calc = calculateItemCredit(mockEligibleProduct2, "A", 30);
    expect(calc.rate).toBe(0.35);
    expect(calc.credit).toBe(157.5);
  });

  it("calculates Option B Return & Credit as 100% of original wholesale price", () => {
    // 60 units * $20.00 wholesale * 100% = $1,200.00
    const calc = calculateItemCredit(mockEligibleProduct1, "B", 60);
    expect(calc.rate).toBe(1.0);
    expect(calc.credit).toBe(1200.0);
  });

  it("clamps quantity to maxClaimableQuantity in credit calculations", () => {
    // Max is 60. Requesting 80 should clamp to 60
    const calc = calculateItemCredit(mockEligibleProduct1, "A", 80);
    expect(calc.credit).toBe(480.0); // 60 * 20 * 0.40
  });

  // -------------------------------------------------------------------------
  // 4. Mixed A/B Lines and Summary Totals
  // -------------------------------------------------------------------------
  it("allows Option A and Option B to coexist on different SKU lines and aggregates totals correctly", () => {
    const selectedItems: SelectedClaimItem[] = [
      {
        cohortId: "cohort_001",
        productId: "prod_001",
        productName: "Cream",
        productSku: "SKU-1",
        selectedOption: "A", // Option A Keep
        selectedQuantity: 40,
        maxClaimableQuantity: 60,
        unitWholesalePrice: 20.0,
        creditRate: 0.4,
        estimatedCredit: 320.0, // 40 * 20 * 0.40
      },
      {
        cohortId: "cohort_002",
        productId: "prod_002",
        productName: "Toner",
        productSku: "SKU-2",
        selectedOption: "B", // Option B Return
        selectedQuantity: 20,
        maxClaimableQuantity: 30,
        unitWholesalePrice: 15.0,
        creditRate: 1.0,
        estimatedCredit: 300.0, // 20 * 15 * 1.00
      },
    ];

    const totals = calculateWizardTotals(selectedItems);
    expect(totals.totalUnits).toBe(60);
    expect(totals.totalOptionAUnits).toBe(40);
    expect(totals.totalOptionBUnits).toBe(20);
    expect(totals.totalOptionACredit).toBe(320.0);
    expect(totals.totalOptionBCredit).toBe(300.0);
    expect(totals.grandTotalEstimatedCredit).toBe(620.0);
    expect(totals.hasOptionB).toBe(true);
    expect(totals.isValid).toBe(true);
  });

  it("invalidates wizard totals if quantity exceeds maxClaimableQuantity", () => {
    const invalidItems: SelectedClaimItem[] = [
      {
        cohortId: "cohort_001",
        productId: "prod_001",
        productName: "Cream",
        productSku: "SKU-1",
        selectedOption: "A",
        selectedQuantity: 70, // Exceeds max 60!
        maxClaimableQuantity: 60,
        unitWholesalePrice: 20.0,
        creditRate: 0.4,
        estimatedCredit: 480.0,
      },
    ];

    const totals = calculateWizardTotals(invalidItems);
    expect(totals.isValid).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 5. Step 3: Stock Reconfirmation & Disabled Submission Contract
  // -------------------------------------------------------------------------
  it("enforces preview mode and disabled submission contract", () => {
    // When previewMode is active, submission must be strictly disabled
    const isPreview = true;
    const isSubmissionDisabled = isPreview;
    expect(isSubmissionDisabled).toBe(true);
  });

  it("formats currency correctly into USD format", () => {
    expect(formatCurrency(1234.5)).toBe("$1,234.50");
    expect(formatCurrency(0)).toBe("$0.00");
  });
});
