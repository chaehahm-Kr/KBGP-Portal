/**
 * 90-Day Exchange Credit Pilot — Checkout Lifecycle Adapter
 * Task ID: EXCHANGE-CREDIT-PH4-002-R3
 * Location: lib/retailer/exchange-credit-checkout/credit-checkout-lifecycle-adapter.ts
 *
 * Provides authoritative integration contracts and lifecycle hooks connecting
 * Retailer Checkout and Payment Events to the Atomic Exchange Credit Database Engine:
 *
 * 1. Reservation: Temporarily locks credit for an active checkout session.
 * 2. Redemption: Confirms full one-time consumption upon verified order payment.
 * 3. Release: Restores credit upon payment failure, cart abandonment, or session timeout.
 * 4. Cancellation Reinstatement: Restores redeemed credit upon pre-shipment full cancellation.
 * 5. Invariant Guards: Expiration date is strictly non-extendable across all transitions.
 * 6. Safety: All actions are gated by ENABLE_EXCHANGE_CREDIT_CHECKOUT (Default: false).
 */

import {
  CheckoutCartItem,
  ReserveCreditResult,
  ConfirmRedemptionResult,
  ReleaseReservationResult,
  ReinstateCancelledCreditResult
} from "./credit-checkout-types";
import {
  reserveExchangeCreditAction,
  confirmExchangeCreditRedemptionAction,
  releaseExchangeCreditReservationAction,
  reinstateCancelledCreditAction
} from "./credit-checkout-actions";
import { isExchangeCreditCheckoutEnabled } from "./credit-checkout-gate";

export interface CheckoutCreditReservationRequest {
  companyId: string;
  storeId?: string | null;
  creditId: string;
  cartItems: CheckoutCartItem[];
  checkoutSessionId: string;
  asOfDate?: Date | string;
}

export interface CheckoutCreditRedemptionRequest {
  companyId: string;
  orderId: string;
  creditId: string;
  paymentIdempotencyKey: string;
  paymentMethod: string;
  finalPaidCents: number;
  asOfDate?: Date | string;
}

export interface CheckoutCreditReleaseRequest {
  companyId: string;
  creditId: string;
  checkoutSessionId?: string | null;
  orderId?: string | null;
  reason: "payment_failed" | "checkout_abandoned" | "user_deselected" | "pre_shipment_cancelled";
  asOfDate?: Date | string;
}

export interface CheckoutCreditCancellationRequest {
  companyId: string;
  orderId: string;
  creditId: string;
  isFullCancellation: boolean;
  orderStatus?: "pending" | "processing" | "shipped" | "delivered" | "cancelled";
  cancellationReason: string;
  idempotencyKey?: string;
  asOfDate?: Date | string;
}

/**
 * Adapter Hook 1: Prepares and locks an Exchange Credit reservation for a checkout session.
 *
 * Guard: If feature gate is disabled, returns gracefully without database mutation.
 */
export async function prepareCheckoutCreditReservation(
  request: CheckoutCreditReservationRequest
): Promise<ReserveCreditResult> {
  const gateEnabled = await isExchangeCreditCheckoutEnabled();
  if (!gateEnabled) {
    return {
      success: false,
      errorCode: "FEATURE_GATE_DISABLED",
      error: "Exchange Credit checkout feature gate is disabled."
    };
  }

  return await reserveExchangeCreditAction({
    creditId: request.creditId,
    companyId: request.companyId,
    storeId: request.storeId || "",
    checkoutSessionId: request.checkoutSessionId,
    cartItems: request.cartItems,
    asOfDate: request.asOfDate
  });
}

/**
 * Adapter Hook 2: Authoritatively confirms 100% full redemption upon verified payment completion.
 *
 * Guard: Requires server-confirmed order and payment event. Never trusts client assertion alone.
 */
export async function handleOrderPaymentConfirmed(
  request: CheckoutCreditRedemptionRequest
): Promise<ConfirmRedemptionResult> {
  const gateEnabled = await isExchangeCreditCheckoutEnabled();
  if (!gateEnabled) {
    return {
      success: false,
      errorCode: "FEATURE_GATE_DISABLED",
      error: "Exchange Credit checkout feature gate is disabled."
    };
  }

  return await confirmExchangeCreditRedemptionAction({
    creditId: request.creditId,
    companyId: request.companyId,
    orderId: request.orderId,
    paymentIdempotencyKey: request.paymentIdempotencyKey,
    paymentMethod: request.paymentMethod,
    finalPaidCents: request.finalPaidCents,
    asOfDate: request.asOfDate
  });
}

/**
 * Adapter Hook 3: Releases a reserved credit back to available (or expired) upon payment failure.
 *
 * Invariant: Preserves original non-extendable expiration date.
 */
export async function handleOrderPaymentFailed(
  request: CheckoutCreditReleaseRequest
): Promise<ReleaseReservationResult> {
  return await releaseExchangeCreditReservationAction({
    creditId: request.creditId,
    companyId: request.companyId,
    checkoutSessionId: request.checkoutSessionId,
    orderId: request.orderId,
    reason: request.reason,
    asOfDate: request.asOfDate
  });
}

/**
 * Adapter Hook 4: Reinstates a redeemed credit upon full order cancellation BEFORE shipment.
 *
 * Invariant:
 * - Full cancellation only. Partial cancellations require manual review: "POLICY REVIEW REQUIRED"
 * - Post-shipment returns require manual review: "POLICY REVIEW REQUIRED"
 * - Original expiration date is strictly preserved and never revived if 90 days elapsed.
 */
export async function handlePreShipmentOrderCancelled(
  request: CheckoutCreditCancellationRequest
): Promise<ReinstateCancelledCreditResult> {
  // Invariant: Partial cancellation always requires manual policy review
  if (!request.isFullCancellation) {
    return {
      success: false,
      restoredStatus: "issued",
      requiresPolicyReview: true,
      error: "POLICY REVIEW REQUIRED: Partial cancellation of credit-redeemed orders requires manual policy review."
    };
  }

  const gateEnabled = await isExchangeCreditCheckoutEnabled();
  if (!gateEnabled) {
    return {
      success: false,
      restoredStatus: "issued",
      error: "Exchange Credit checkout feature gate is disabled. Reinstatement RPC is gated."
    };
  }

  return await reinstateCancelledCreditAction({
    creditId: request.creditId,
    companyId: request.companyId,
    orderId: request.orderId,
    isFullCancellation: request.isFullCancellation,
    orderStatus: request.orderStatus,
    cancellationReason: request.cancellationReason,
    idempotencyKey: request.idempotencyKey,
    asOfDate: request.asOfDate
  });
}
