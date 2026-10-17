/**
 * 90-Day Exchange Credit Pilot — Phase 4-002: Checkout Credit Types
 * Location: lib/retailer/exchange-credit-checkout/credit-checkout-types.ts
 *
 * Core domain contracts for Company Exchange Credit application during checkout:
 * - One-time Full Redemption Policy (No partial redemption, no residual balance)
 * - Originating Protected SKU Exclusions
 * - Shipping, Tax & Processing Fee Exclusions
 * - Strict 90-Day Non-Extendable Expiration
 * - Integer-Cents Financial Precision
 * - Anti-Stacking & Concurrency Boundaries
 */

export type CreditCheckoutStatus =
  | "issued"    // Available for reservation
  | "reserved"  // Temporarily locked in active checkout session
  | "redeemed"  // Consumed in full upon verified order payment
  | "expired"   // 90-day window passed
  | "voided";   // Cancelled by admin action

export type CreditCheckoutRejectionCode =
  | "FEATURE_GATE_DISABLED"
  | "CREDIT_NOT_AVAILABLE"
  | "CREDIT_ALREADY_RESERVED"
  | "CREDIT_ALREADY_REDEEMED"
  | "CREDIT_EXPIRED"
  | "COMPANY_MISMATCH"
  | "STORE_UNAUTHORIZED"
  | "CURRENCY_MISMATCH"
  | "ORIGINATING_SKU_ONLY_CART"
  | "INSUFFICIENT_ELIGIBLE_SUBTOTAL"
  | "MULTI_CREDIT_STACKING_DISABLED"
  | "INVALID_CREDIT_AMOUNT";

export interface CheckoutCartItem {
  id: string;
  productId: string;
  sku: string;
  name: string;
  unitPriceCents: number;
  quantity: number;
  isProtected?: boolean;
}

export interface CheckoutCreditItem {
  id: string;
  creditCode: string; // e.g. CRD-2026-000001
  companyId: string;
  storeId: string | null;
  creditAmountCents: number;
  creditAmountDollars: number;
  remainingBalanceCents: number;
  remainingBalanceDollars: number;
  currency: "USD";
  status: CreditCheckoutStatus;
  issuedAt: string;
  expiresAt: string; // Non-extendable 90 days from issuedAt
  originatingSku?: string | null;
  originatingProductId?: string | null;
  sourceClaimId?: string | null;
  sourceClaimItemId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface EvaluateCreditEligibilityInput {
  credit: CheckoutCreditItem;
  companyId: string;
  storeId?: string | null;
  cartItems: CheckoutCartItem[];
  asOfDate?: string | Date;
}

export interface CreditEligibilityResult {
  eligible: boolean;
  creditId: string;
  creditCode: string;
  rejectionCode?: CreditCheckoutRejectionCode;
  rejectionMessage?: string;

  // Breakdown
  subtotalCents: number;
  excludedSkuAmountCents: number;
  eligibleSubtotalCents: number;
  creditAmountCents: number;
  fullRedemptionFeasible: boolean;
  appliedCreditAmountCents: number;
  remainingChargeCents: number;
}

export interface CheckoutTotalsCalculationInput {
  cartItems: CheckoutCartItem[];
  selectedCredit?: CheckoutCreditItem | null;
  companyId: string;
  storeId?: string | null;
  shippingCents?: number;
  taxCents?: number;
  processingFeeCents?: number;
  asOfDate?: string | Date;
}

export interface CheckoutTotalsCalculationResult {
  // Merchandise totals
  subtotalCents: number;
  subtotalDollars: number;
  excludedSkuAmountCents: number;
  excludedSkuAmountDollars: number;
  eligibleSubtotalCents: number;
  eligibleSubtotalDollars: number;

  // Credit Application
  isCreditApplied: boolean;
  appliedCreditCode: string | null;
  appliedCreditAmountCents: number;
  appliedCreditAmountDollars: number;
  remainingMerchandiseCents: number;
  remainingMerchandiseDollars: number;
  fullRedemptionMet: boolean;

  // Other order costs (Never covered by exchange credit)
  shippingCents: number;
  shippingDollars: number;
  taxCents: number;
  taxDollars: number;
  processingFeeCents: number;
  processingFeeDollars: number;

  // Final Customer Charge (Amount processed via primary payment method)
  totalPayableCents: number;
  totalPayableDollars: number;

  // Diagnostics
  rejectionCode?: CreditCheckoutRejectionCode;
  rejectionMessage?: string;
}

export interface ReserveCreditInput {
  creditId: string;
  companyId: string;
  storeId: string;
  orderId?: string | null;
  checkoutSessionId: string;
  cartItems: CheckoutCartItem[];
  asOfDate?: string | Date;
}

export interface ReserveCreditResult {
  success: boolean;
  reservationId?: string;
  creditCode?: string;
  reservedAmountCents?: number;
  reservedAt?: string;
  expiresAt?: string;
  error?: string;
  errorCode?: CreditCheckoutRejectionCode;
}

export interface ConfirmRedemptionInput {
  creditId: string;
  companyId: string;
  orderId: string;
  paymentIdempotencyKey: string;
  paymentMethod: string;
  finalPaidCents: number;
  asOfDate?: string | Date;
}

export interface ConfirmRedemptionResult {
  success: boolean;
  creditCode?: string;
  redeemedAmountCents?: number;
  redeemedAt?: string;
  orderId?: string;
  error?: string;
  errorCode?: string;
}

export interface ReleaseReservationInput {
  creditId: string;
  companyId: string;
  orderId?: string | null;
  checkoutSessionId?: string | null;
  reason: "payment_failed" | "checkout_abandoned" | "user_deselected" | "pre_shipment_cancelled";
  asOfDate?: string | Date;
}

export interface ReleaseReservationResult {
  success: boolean;
  restoredStatus: "issued" | "expired";
  creditCode?: string;
  expiresAt?: string;
  notes?: string;
  error?: string;
}

export interface ReinstateCancelledCreditInput {
  creditId: string;
  companyId: string;
  orderId: string;
  cancellationReason: string;
  isFullCancellation: boolean;
  orderStatus?: "pending" | "processing" | "shipped" | "delivered" | "cancelled";
  idempotencyKey?: string;
  asOfDate?: string | Date;
}

export interface ReinstateCancelledCreditResult {
  success: boolean;
  restoredStatus: "issued" | "expired";
  creditCode?: string;
  expiresAt?: string;
  remainingBalanceCents?: number;
  requiresPolicyReview?: boolean;
  idempotentReplay?: boolean;
  error?: string;
}

export interface ReinstatementEligibilityInput {
  orderStatus: "pending" | "processing" | "shipped" | "delivered" | "cancelled";
  isFullCancellation: boolean;
  credit: CheckoutCreditItem;
  asOfDate?: Date | string;
}

export interface ReinstatementEligibilityResult {
  eligible: boolean;
  requiresPolicyReview: boolean;
  reason?: string;
  restoredStatus?: "issued" | "expired";
}

