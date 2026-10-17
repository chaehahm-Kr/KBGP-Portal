import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("@/lib/auth/dal", () => ({
  verifyRetailerSession: vi.fn().mockResolvedValue({ userId: "retailer-1", role: "retailer", email: "retailer@test.com" }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn().mockImplementation(() => ({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
    rpc: vi.fn().mockResolvedValue({ data: { success: true }, error: null }),
  })),
}));

import * as fs from "fs";
import * as path from "path";
import {
  dollarsToCents,
  centsToDollars,
  isCreditExpired,
  calculateEligibleMerchandiseBreakdown,
  evaluateCreditForCart,
  calculateCheckoutTotalsWithCredit,
  determinePostPaymentFailureCreditState,
  determinePreShipmentCancellationCreditState,
  evaluateReinstatementEligibility
} from "../../lib/retailer/exchange-credit-checkout/credit-checkout-pure";
import {
  CheckoutCartItem,
  CheckoutCreditItem
} from "../../lib/retailer/exchange-credit-checkout/credit-checkout-types";
import {
  checkExchangeCreditCheckoutEnabled,
  setExchangeCreditCheckoutGateForTesting
} from "../../lib/retailer/exchange-credit-checkout/credit-checkout-gate";
import {
  prepareCheckoutCreditReservation,
  handleOrderPaymentConfirmed,
  handleOrderPaymentFailed,
  handlePreShipmentOrderCancelled
} from "../../lib/retailer/exchange-credit-checkout/credit-checkout-lifecycle-adapter";
import { ExchangeCreditCheckoutSelector } from "../../components/retailer/checkout/credit/exchange-credit-checkout-selector";

const BASE_DATE = new Date("2026-10-17T00:00:00.000Z");

function createMockCredit(overrides: Partial<CheckoutCreditItem> = {}): CheckoutCreditItem {
  return {
    id: "crd-00000000-0000-4000-a000-000000000001",
    creditCode: "CRD-2026-000001",
    companyId: "comp-alpha",
    storeId: "store-1",
    creditAmountCents: 5000, // $50.00
    creditAmountDollars: 50.00,
    remainingBalanceCents: 5000,
    remainingBalanceDollars: 50.00,
    currency: "USD",
    status: "issued",
    issuedAt: "2026-09-01T00:00:00.000Z",
    expiresAt: "2026-11-30T00:00:00.000Z", // 90 days from issuedAt
    originatingSku: "SKU-ORIGIN-SERUM",
    originatingProductId: "prod-serum-origin",
    metadata: {
      sku: "SKU-ORIGIN-SERUM",
      productId: "prod-serum-origin"
    },
    ...overrides
  };
}

describe("Exchange Credit Checkout Engine — Scenarios A through R", () => {
  beforeEach(async () => {
    await setExchangeCreditCheckoutGateForTesting(null);
  });

  // Scenario A: Valid full redemption
  it("Scenario A: Valid full redemption (eligible subtotal >= credit amount)", () => {
    const credit = createMockCredit({ creditAmountCents: 5000 }); // $50.00
    const cartItems: CheckoutCartItem[] = [
      {
        id: "item-1",
        productId: "prod-cream",
        sku: "SKU-CREAM",
        name: "Protective Cream",
        unitPriceCents: 3500, // $35.00
        quantity: 2 // $70.00
      }
    ];

    const result = evaluateCreditForCart({
      credit,
      companyId: "comp-alpha",
      storeId: "store-1",
      cartItems,
      asOfDate: BASE_DATE
    });

    expect(result.eligible).toBe(true);
    expect(result.fullRedemptionFeasible).toBe(true);
    expect(result.appliedCreditAmountCents).toBe(5000);
    expect(result.eligibleSubtotalCents).toBe(7000);
    expect(result.remainingChargeCents).toBe(2000); // $70 - $50 = $20 remaining
  });

  // Scenario B: Insufficient eligible subtotal
  it("Scenario B: Insufficient eligible subtotal (cannot do partial redemption)", () => {
    const credit = createMockCredit({ creditAmountCents: 5000 }); // $50.00
    const cartItems: CheckoutCartItem[] = [
      {
        id: "item-1",
        productId: "prod-cream",
        sku: "SKU-CREAM",
        name: "Protective Cream",
        unitPriceCents: 4500, // $45.00
        quantity: 1
      }
    ];

    const result = evaluateCreditForCart({
      credit,
      companyId: "comp-alpha",
      storeId: "store-1",
      cartItems,
      asOfDate: BASE_DATE
    });

    expect(result.eligible).toBe(false);
    expect(result.fullRedemptionFeasible).toBe(false);
    expect(result.rejectionCode).toBe("INSUFFICIENT_ELIGIBLE_SUBTOTAL");
    expect(result.appliedCreditAmountCents).toBe(0);
    expect(result.rejectionMessage).toContain("requires 100% full redemption");
  });

  // Scenario C: Originating SKU exclusion
  it("Scenario C: Originating SKU exclusion (originating protected product is excluded from eligible subtotal)", () => {
    const credit = createMockCredit({
      creditAmountCents: 5000,
      originatingSku: "SKU-ORIGIN-SERUM"
    });

    const cartItems: CheckoutCartItem[] = [
      {
        id: "item-1",
        productId: "prod-origin",
        sku: "SKU-ORIGIN-SERUM", // ORIGINATING SKU!
        name: "Originating Serum",
        unitPriceCents: 3000,
        quantity: 1 // $30.00 (EXCLUDED)
      },
      {
        id: "item-2",
        productId: "prod-cream",
        sku: "SKU-OTHER-CREAM",
        name: "Other Cream",
        unitPriceCents: 4000,
        quantity: 1 // $40.00 (ELIGIBLE)
      }
    ];

    // Total cart = $70.00, but eligible subtotal = $40.00!
    // Since eligible subtotal ($40.00) < credit ($50.00), it MUST be rejected!
    const result = evaluateCreditForCart({
      credit,
      companyId: "comp-alpha",
      storeId: "store-1",
      cartItems,
      asOfDate: BASE_DATE
    });

    expect(result.subtotalCents).toBe(7000);
    expect(result.excludedSkuAmountCents).toBe(3000);
    expect(result.eligibleSubtotalCents).toBe(4000);
    expect(result.eligible).toBe(false);
    expect(result.rejectionCode).toBe("INSUFFICIENT_ELIGIBLE_SUBTOTAL");
  });

  it("Scenario C.2: Cart containing ONLY originating SKU is rejected with ORIGINATING_SKU_ONLY_CART", () => {
    const credit = createMockCredit({
      creditAmountCents: 2500,
      originatingSku: "SKU-ORIGIN-SERUM"
    });

    const cartItems: CheckoutCartItem[] = [
      {
        id: "item-1",
        productId: "prod-origin",
        sku: "SKU-ORIGIN-SERUM",
        name: "Originating Serum",
        unitPriceCents: 5000,
        quantity: 1
      }
    ];

    const result = evaluateCreditForCart({
      credit,
      companyId: "comp-alpha",
      cartItems,
      asOfDate: BASE_DATE
    });

    expect(result.eligible).toBe(false);
    expect(result.rejectionCode).toBe("ORIGINATING_SKU_ONLY_CART");
  });

  // Scenario D: Shipping and tax exclusion
  it("Scenario D: Shipping and tax exclusion (credit applies strictly to eligible merchandise, never fees)", () => {
    const credit = createMockCredit({ creditAmountCents: 5000 }); // $50.00

    const cartItems: CheckoutCartItem[] = [
      {
        id: "item-1",
        productId: "prod-cream",
        sku: "SKU-CREAM",
        name: "Cream",
        unitPriceCents: 4000, // Merchandise $40.00
        quantity: 1
      }
    ];

    // Merchandise ($40.00) + Shipping ($15.00) + Tax ($5.00) = $60.00 total order
    // But merchandise ($40.00) < credit ($50.00)!
    const totals = calculateCheckoutTotalsWithCredit({
      cartItems,
      selectedCredit: credit,
      companyId: "comp-alpha",
      storeId: "store-1",
      shippingCents: 1500,
      taxCents: 500,
      asOfDate: BASE_DATE
    });

    // Credit MUST NOT be applied because eligible merchandise is less than $50.00
    expect(totals.isCreditApplied).toBe(false);
    expect(totals.appliedCreditAmountCents).toBe(0);
    expect(totals.totalPayableCents).toBe(6000); // full $60.00 payable
    expect(totals.rejectionCode).toBe("INSUFFICIENT_ELIGIBLE_SUBTOTAL");
  });

  // Scenario E: Cross-company rejection
  it("Scenario E: Cross-company rejection (credit cannot be used by a different company)", () => {
    const credit = createMockCredit({ companyId: "comp-alpha" });
    const cartItems: CheckoutCartItem[] = [
      { id: "i1", productId: "p1", sku: "S1", name: "P1", unitPriceCents: 10000, quantity: 1 }
    ];

    const result = evaluateCreditForCart({
      credit,
      companyId: "comp-beta", // DIFFERENT COMPANY
      cartItems,
      asOfDate: BASE_DATE
    });

    expect(result.eligible).toBe(false);
    expect(result.rejectionCode).toBe("COMPANY_MISMATCH");
  });

  // Scenario F: Cross-store unauthorized use
  it("Scenario F: Cross-store unauthorized use (store-restricted credit cannot be used at another store)", () => {
    const credit = createMockCredit({ storeId: "store-alpha-main" });
    const cartItems: CheckoutCartItem[] = [
      { id: "i1", productId: "p1", sku: "S1", name: "P1", unitPriceCents: 10000, quantity: 1 }
    ];

    const result = evaluateCreditForCart({
      credit,
      companyId: "comp-alpha",
      storeId: "store-alpha-branch", // DIFFERENT STORE
      cartItems,
      asOfDate: BASE_DATE
    });

    expect(result.eligible).toBe(false);
    expect(result.rejectionCode).toBe("STORE_UNAUTHORIZED");
  });

  // Scenario G: Credit already redeemed
  it("Scenario G: Credit already redeemed (status = redeemed)", () => {
    const credit = createMockCredit({ status: "redeemed" });
    const cartItems: CheckoutCartItem[] = [
      { id: "i1", productId: "p1", sku: "S1", name: "P1", unitPriceCents: 10000, quantity: 1 }
    ];

    const result = evaluateCreditForCart({
      credit,
      companyId: "comp-alpha",
      cartItems,
      asOfDate: BASE_DATE
    });

    expect(result.eligible).toBe(false);
    expect(result.rejectionCode).toBe("CREDIT_ALREADY_REDEEMED");
  });

  // Scenario H: Credit already reserved
  it("Scenario H: Credit already reserved (status = reserved)", () => {
    const credit = createMockCredit({ status: "reserved" });
    const cartItems: CheckoutCartItem[] = [
      { id: "i1", productId: "p1", sku: "S1", name: "P1", unitPriceCents: 10000, quantity: 1 }
    ];

    const result = evaluateCreditForCart({
      credit,
      companyId: "comp-alpha",
      cartItems,
      asOfDate: BASE_DATE
    });

    expect(result.eligible).toBe(false);
    expect(result.rejectionCode).toBe("CREDIT_ALREADY_RESERVED");
  });

  // Scenario I: Credit expired
  it("Scenario I: Credit expired (expires_at <= current date)", () => {
    const credit = createMockCredit({
      expiresAt: "2026-10-01T00:00:00.000Z" // Expired 16 days ago relative to BASE_DATE
    });
    const cartItems: CheckoutCartItem[] = [
      { id: "i1", productId: "p1", sku: "S1", name: "P1", unitPriceCents: 10000, quantity: 1 }
    ];

    const result = evaluateCreditForCart({
      credit,
      companyId: "comp-alpha",
      cartItems,
      asOfDate: BASE_DATE
    });

    expect(result.eligible).toBe(false);
    expect(result.rejectionCode).toBe("CREDIT_EXPIRED");
  });

  // Scenario J: Payment success idempotency
  it("Scenario J: Payment success calculation handles exact zero residual balance", () => {
    const credit = createMockCredit({ creditAmountCents: 5000 });
    const cartItems: CheckoutCartItem[] = [
      { id: "i1", productId: "p1", sku: "S1", name: "P1", unitPriceCents: 5000, quantity: 1 }
    ];

    const totals = calculateCheckoutTotalsWithCredit({
      cartItems,
      selectedCredit: credit,
      companyId: "comp-alpha",
      asOfDate: BASE_DATE
    });

    expect(totals.isCreditApplied).toBe(true);
    expect(totals.appliedCreditAmountCents).toBe(5000);
    expect(totals.remainingMerchandiseCents).toBe(0);
    expect(totals.totalPayableCents).toBe(0);
    expect(totals.fullRedemptionMet).toBe(true);
  });

  // Scenario K: Payment failure release
  it("Scenario K: Payment failure release restores credit to 'issued' if not expired", () => {
    const credit = createMockCredit({
      status: "reserved",
      expiresAt: "2026-11-30T00:00:00.000Z"
    });

    const restored = determinePostPaymentFailureCreditState(credit, BASE_DATE);
    expect(restored.restoredStatus).toBe("issued");
    expect(restored.expiresAt).toBe("2026-11-30T00:00:00.000Z"); // Original expiration preserved!
  });

  // Scenario L: Cancellation before shipment
  it("Scenario L: Pre-shipment cancellation restores credit with original expiration date", () => {
    const credit = createMockCredit({
      status: "reserved",
      expiresAt: "2026-12-01T00:00:00.000Z"
    });

    const restored = determinePreShipmentCancellationCreditState(credit, BASE_DATE);
    expect(restored.restoredStatus).toBe("issued");
    expect(restored.expiresAt).toBe("2026-12-01T00:00:00.000Z");
  });

  // Scenario M: Expiration during reservation
  it("Scenario M: Expiration during reservation transitions to 'expired' upon release", () => {
    const credit = createMockCredit({
      status: "reserved",
      expiresAt: "2026-10-10T00:00:00.000Z" // Expired 7 days ago relative to BASE_DATE (Oct 17)
    });

    const restored = determinePostPaymentFailureCreditState(credit, BASE_DATE);
    expect(restored.restoredStatus).toBe("expired");
  });

  // Scenario N: No expiry extension
  it("Scenario N: No expiry extension (expiration timestamp is NEVER revived or extended)", () => {
    const credit = createMockCredit({
      issuedAt: "2026-07-01T00:00:00.000Z",
      expiresAt: "2026-09-29T00:00:00.000Z" // 90 days strictly
    });

    const failureState = determinePostPaymentFailureCreditState(credit, BASE_DATE);
    expect(failureState.expiresAt).toBe("2026-09-29T00:00:00.000Z");

    const cancelState = determinePreShipmentCancellationCreditState(credit, BASE_DATE);
    expect(cancelState.expiresAt).toBe("2026-09-29T00:00:00.000Z");
  });

  // Scenario O: Multiple simultaneous attempts / concurrency state
  it("Scenario O: Multiple simultaneous attempts rejected if credit is not 'issued'", () => {
    const credit = createMockCredit({ status: "reserved" });
    const cartItems: CheckoutCartItem[] = [
      { id: "i1", productId: "p1", sku: "S1", name: "P1", unitPriceCents: 10000, quantity: 1 }
    ];

    const result = evaluateCreditForCart({
      credit,
      companyId: "comp-alpha",
      cartItems,
      asOfDate: BASE_DATE
    });

    expect(result.eligible).toBe(false);
    expect(result.rejectionCode).toBe("CREDIT_ALREADY_RESERVED");
  });

  // Scenario P: Zero and rounding boundaries
  it("Scenario P: Exact integer cents and zero rounding boundaries", () => {
    expect(dollarsToCents(19.99)).toBe(1999);
    expect(dollarsToCents(0.00)).toBe(0);
    expect(centsToDollars(1999)).toBe(19.99);
    expect(centsToDollars(0)).toBe(0);

    const credit = createMockCredit({ creditAmountCents: 0 });
    const cartItems: CheckoutCartItem[] = [
      { id: "i1", productId: "p1", sku: "S1", name: "P1", unitPriceCents: 1000, quantity: 1 }
    ];

    const result = evaluateCreditForCart({
      credit,
      companyId: "comp-alpha",
      cartItems,
      asOfDate: BASE_DATE
    });

    expect(result.eligible).toBe(false);
    expect(result.rejectionCode).toBe("INVALID_CREDIT_AMOUNT");
  });

  // Scenario Q: Currency mismatch
  it("Scenario Q: Currency mismatch is rejected (must be USD)", () => {
    const credit = createMockCredit({ currency: "EUR" as any });
    const cartItems: CheckoutCartItem[] = [
      { id: "i1", productId: "p1", sku: "S1", name: "P1", unitPriceCents: 10000, quantity: 1 }
    ];

    const result = evaluateCreditForCart({
      credit,
      companyId: "comp-alpha",
      cartItems,
      asOfDate: BASE_DATE
    });

    expect(result.eligible).toBe(false);
    expect(result.rejectionCode).toBe("CURRENCY_MISMATCH");
  });

  // Scenario R: Feature gate disabled
  it("Scenario R: Feature gate is disabled by default in production and testing", async () => {
    expect(checkExchangeCreditCheckoutEnabled()).toBe(false);

    await setExchangeCreditCheckoutGateForTesting(true);
    expect(checkExchangeCreditCheckoutEnabled()).toBe(true);

    await setExchangeCreditCheckoutGateForTesting(false);
    expect(checkExchangeCreditCheckoutEnabled()).toBe(false);
  });

  // Scenario S: Pre-shipment full cancellation reinstatement
  it("Scenario S: Pre-shipment full cancellation restores credit to 'issued' if not expired", () => {
    const credit = createMockCredit({
      status: "redeemed",
      remainingBalanceCents: 0,
      creditAmountCents: 5000,
      expiresAt: "2026-11-30T00:00:00.000Z"
    });

    const eligibility = evaluateReinstatementEligibility({
      orderStatus: "cancelled",
      isFullCancellation: true,
      credit,
      asOfDate: BASE_DATE
    });

    expect(eligibility.eligible).toBe(true);
    expect(eligibility.requiresPolicyReview).toBe(false);
    expect(eligibility.restoredStatus).toBe("issued");

    const restoredState = determinePreShipmentCancellationCreditState(credit, BASE_DATE);
    expect(restoredState.restoredStatus).toBe("issued");
    expect(restoredState.expiresAt).toBe("2026-11-30T00:00:00.000Z"); // Original expiration preserved
  });

  // Scenario T: Pre-shipment cancellation after expiration window passed
  it("Scenario T: Pre-shipment cancellation transitions to 'expired' if 90 days already elapsed", () => {
    const credit = createMockCredit({
      status: "redeemed",
      remainingBalanceCents: 0,
      creditAmountCents: 5000,
      expiresAt: "2026-10-01T00:00:00.000Z" // Expired 16 days ago relative to BASE_DATE
    });

    const eligibility = evaluateReinstatementEligibility({
      orderStatus: "cancelled",
      isFullCancellation: true,
      credit,
      asOfDate: BASE_DATE
    });

    expect(eligibility.eligible).toBe(true);
    expect(eligibility.requiresPolicyReview).toBe(false);
    expect(eligibility.restoredStatus).toBe("expired");

    const restoredState = determinePreShipmentCancellationCreditState(credit, BASE_DATE);
    expect(restoredState.restoredStatus).toBe("expired");
    expect(restoredState.expiresAt).toBe("2026-10-01T00:00:00.000Z"); // Never revived!
  });

  // Scenario U: Unsupported cases require policy review (Partial cancellation or post-shipment return)
  it("Scenario U: Partial cancellation or post-shipment return requires policy review", () => {
    const credit = createMockCredit({
      status: "redeemed",
      expiresAt: "2026-11-30T00:00:00.000Z"
    });

    // U.1: Partial cancellation
    const partialResult = evaluateReinstatementEligibility({
      orderStatus: "cancelled",
      isFullCancellation: false, // PARTIAL!
      credit,
      asOfDate: BASE_DATE
    });

    expect(partialResult.eligible).toBe(false);
    expect(partialResult.requiresPolicyReview).toBe(true);
    expect(partialResult.reason).toContain("POLICY REVIEW REQUIRED");

    // U.2: Post-shipment return
    const postShipResult = evaluateReinstatementEligibility({
      orderStatus: "shipped", // SHIPPED!
      isFullCancellation: true,
      credit,
      asOfDate: BASE_DATE
    });

    expect(postShipResult.eligible).toBe(false);
    expect(postShipResult.requiresPolicyReview).toBe(true);
    expect(postShipResult.reason).toContain("Post-shipment returns cannot automatically reinstate");
  });

  // Scenario V: Strict Non-Extendable Expiration invariant across all operations
  it("Scenario V: Non-extendable expiration invariant is preserved across all states", () => {
    const originalExpiry = "2026-11-15T12:00:00.000Z";
    const credit = createMockCredit({
      issuedAt: "2026-08-17T12:00:00.000Z",
      expiresAt: originalExpiry
    });

    // Payment failure release
    const failureState = determinePostPaymentFailureCreditState(credit, BASE_DATE);
    expect(failureState.expiresAt).toBe(originalExpiry);

    // Pre-shipment cancellation
    const cancelState = determinePreShipmentCancellationCreditState(credit, BASE_DATE);
    expect(cancelState.expiresAt).toBe(originalExpiry);
  });

  // Scenario W: SQL Migration 0181 Static Integrity Audit
  it("Scenario W: SQL Migration 0181 static audit passes all security and policy invariants", () => {
    const migrationPath = path.resolve(
      __dirname,
      "../../supabase/migrations/0181_retailer_exchange_credit_checkout_redemption.sql"
    );

    expect(fs.existsSync(migrationPath)).toBe(true);
    const sqlContent = fs.readFileSync(migrationPath, "utf-8");

    // Verify 4 Atomic Stored Procedures are present
    expect(sqlContent).toContain("CREATE OR REPLACE FUNCTION public.reserve_exchange_credit_atomic");
    expect(sqlContent).toContain("CREATE OR REPLACE FUNCTION public.release_exchange_credit_reservation_atomic");
    expect(sqlContent).toContain("CREATE OR REPLACE FUNCTION public.redeem_exchange_credit_atomic");
    expect(sqlContent).toContain("CREATE OR REPLACE FUNCTION public.reinstate_cancelled_exchange_credit_atomic");

    // Verify SECURITY DEFINER and search_path on each function
    const secDefinerCount = (sqlContent.match(/SECURITY DEFINER/g) || []).length;
    expect(secDefinerCount).toBeGreaterThanOrEqual(4);

    const searchPathCount = (sqlContent.match(/SET search_path = public/g) || []).length;
    expect(searchPathCount).toBeGreaterThanOrEqual(4);

    // Verify Row-Level Locking (FOR UPDATE) is used for concurrency safety
    const forUpdateCount = (sqlContent.match(/FOR UPDATE/g) || []).length;
    expect(forUpdateCount).toBeGreaterThanOrEqual(4);

    // Verify Grants and Revokes
    expect(sqlContent).toContain("REVOKE EXECUTE ON FUNCTION public.reserve_exchange_credit_atomic FROM PUBLIC, anon;");
    expect(sqlContent).toContain("GRANT EXECUTE ON FUNCTION public.reserve_exchange_credit_atomic TO authenticated, service_role;");
    expect(sqlContent).toContain("REVOKE EXECUTE ON FUNCTION public.release_exchange_credit_reservation_atomic FROM PUBLIC, anon;");
    expect(sqlContent).toContain("GRANT EXECUTE ON FUNCTION public.release_exchange_credit_reservation_atomic TO authenticated, service_role;");
    expect(sqlContent).toContain("REVOKE EXECUTE ON FUNCTION public.redeem_exchange_credit_atomic FROM PUBLIC, anon;");
    expect(sqlContent).toContain("GRANT EXECUTE ON FUNCTION public.redeem_exchange_credit_atomic TO authenticated, service_role;");
    expect(sqlContent).toContain("REVOKE EXECUTE ON FUNCTION public.reinstate_cancelled_exchange_credit_atomic FROM PUBLIC, anon;");
    expect(sqlContent).toContain("GRANT EXECUTE ON FUNCTION public.reinstate_cancelled_exchange_credit_atomic TO authenticated, service_role;");

    // Verify Transaction Type Check Constraint extension for 'reinstatement'
    expect(sqlContent).toContain("transaction_type IN ('issuance', 'reservation', 'reservation_release', 'redemption', 'expiration', 'void', 'reinstatement')");
  });

  // Scenario X: Lifecycle Adapter enforces feature gate disabled by default
  it("Scenario X: Lifecycle adapter returns FEATURE_GATE_DISABLED when gate is off", async () => {
    // Ensure gate is off
    await setExchangeCreditCheckoutGateForTesting(false);

    // Reservation attempt
    const resResult = await prepareCheckoutCreditReservation({
      companyId: "comp-1",
      creditId: "crd-1",
      checkoutSessionId: "sess-1",
      cartItems: []
    });
    expect(resResult.success).toBe(false);
    expect(resResult.errorCode).toBe("FEATURE_GATE_DISABLED");

    // Redemption attempt
    const redResult = await handleOrderPaymentConfirmed({
      companyId: "comp-1",
      orderId: "ord-1",
      creditId: "crd-1",
      paymentIdempotencyKey: "pay-1",
      paymentMethod: "CARD",
      finalPaidCents: 5000
    });
    expect(redResult.success).toBe(false);
    expect(redResult.errorCode).toBe("FEATURE_GATE_DISABLED");
  });

  // Scenario Y: Pre-shipment cancellation routing via lifecycle adapter
  it("Scenario Y: Pre-shipment cancellation adapter requires policy review for partial cancellations", async () => {
    const cancelResult = await handlePreShipmentOrderCancelled({
      companyId: "comp-1",
      orderId: "ord-1",
      creditId: "crd-1",
      isFullCancellation: false, // PARTIAL!
      cancellationReason: "Customer changed mind on single item"
    });

    expect(cancelResult.success).toBe(false);
    expect(cancelResult.requiresPolicyReview).toBe(true);
    expect(cancelResult.error).toContain("POLICY REVIEW REQUIRED");
  });

  // Scenario Z: ExchangeCreditCheckoutSelector gate condition
  it("Scenario Z: ExchangeCreditCheckoutSelector returns null when gate is disabled or credits empty", () => {
    const credit = createMockCredit();
    const totals = calculateCheckoutTotalsWithCredit({
      cartItems: [],
      companyId: "comp-alpha"
    });

    // Case 1: isGateEnabled is false -> must return null
    const resultGated = ExchangeCreditCheckoutSelector({
      credits: [credit],
      evaluations: {},
      selectedCreditId: null,
      onSelectCredit: () => {},
      totals,
      isGateEnabled: false
    });
    expect(resultGated).toBeNull();

    // Case 2: credits is empty -> must return null
    const resultEmpty = ExchangeCreditCheckoutSelector({
      credits: [],
      evaluations: {},
      selectedCreditId: null,
      onSelectCredit: () => {},
      totals,
      isGateEnabled: true
    });
    expect(resultEmpty).toBeNull();

    // Case 3: isGateEnabled is true and credits present -> returns valid React element
    const resultActive = ExchangeCreditCheckoutSelector({
      credits: [credit],
      evaluations: {},
      selectedCreditId: null,
      onSelectCredit: () => {},
      totals,
      isGateEnabled: true
    });
    expect(resultActive).not.toBeNull();
  });
});

