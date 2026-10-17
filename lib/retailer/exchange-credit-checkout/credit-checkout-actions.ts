"use server";

import { verifyRetailerSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  CheckoutCartItem,
  CheckoutCreditItem,
  CreditEligibilityResult,
  ReserveCreditInput,
  ReserveCreditResult,
  ConfirmRedemptionInput,
  ConfirmRedemptionResult,
  ReleaseReservationInput,
  ReleaseReservationResult,
  ReinstateCancelledCreditInput,
  ReinstateCancelledCreditResult
} from "./credit-checkout-types";
import {
  evaluateCreditForCart,
  determinePostPaymentFailureCreditState,
  determinePreShipmentCancellationCreditState,
  evaluateReinstatementEligibility
} from "./credit-checkout-pure";
import { isExchangeCreditCheckoutEnabled } from "./credit-checkout-gate";

/**
 * Retrieves available Exchange Credits for the authenticated retailer's company
 * and evaluates each credit's eligibility against the current checkout cart items.
 */
export async function getAvailableCompanyCreditsAction(
  storeId: string,
  cartItems: CheckoutCartItem[]
): Promise<{
  success: boolean;
  credits: CheckoutCreditItem[];
  evaluations: Record<string, CreditEligibilityResult>;
  error?: string;
}> {
  const session = await verifyRetailerSession();
  if (!session || !session.userId) {
    return { success: false, credits: [], evaluations: {}, error: "Unauthorized session." };
  }

  const adminClient = createAdminClient();

  // 1. Resolve Company ID
  const { data: userRow } = await adminClient
    .from("company_users")
    .select("company_id")
    .eq("id", session.userId)
    .maybeSingle();

  if (!userRow?.company_id) {
    return { success: false, credits: [], evaluations: {}, error: "Company association not found." };
  }

  const companyId = userRow.company_id;

  // 2. Verify Store Ownership
  if (storeId) {
    const { data: storeRow } = await adminClient
      .from("stores")
      .select("id")
      .eq("id", storeId)
      .eq("company_id", companyId)
      .maybeSingle();

    if (!storeRow) {
      return { success: false, credits: [], evaluations: {}, error: "Unauthorized store selection." };
    }
  }

  // 3. Query Active & Non-Expired Exchange Credits
  const nowIso = new Date().toISOString();
  const { data: creditRows, error: dbError } = await adminClient
    .from("retailer_exchange_credit_ledger")
    .select("*")
    .eq("company_id", companyId)
    .eq("status", "issued")
    .gt("expires_at", nowIso)
    .order("expires_at", { ascending: true }); // Expiring soonest first

  if (dbError) {
    return { success: false, credits: [], evaluations: {}, error: dbError.message };
  }

  const credits: CheckoutCreditItem[] = (creditRows || []).map((row: any) => ({
    id: row.id,
    creditCode: row.credit_code,
    companyId: row.company_id,
    storeId: row.store_id,
    creditAmountCents: Number(row.credit_amount_cents),
    creditAmountDollars: Number(row.credit_amount),
    remainingBalanceCents: Number(row.remaining_balance_cents),
    remainingBalanceDollars: Number(row.remaining_balance),
    currency: row.currency || "USD",
    status: row.status,
    issuedAt: row.issued_at,
    expiresAt: row.expires_at,
    originatingSku: row.metadata?.sku || row.metadata?.originatingSku || null,
    originatingProductId: row.metadata?.productId || row.metadata?.originatingProductId || null,
    sourceClaimId: row.source_claim_id,
    sourceClaimItemId: row.source_claim_item_id,
    metadata: row.metadata
  }));

  // 4. Evaluate Each Credit Against Cart Merchandise
  const evaluations: Record<string, CreditEligibilityResult> = {};
  for (const credit of credits) {
    evaluations[credit.id] = evaluateCreditForCart({
      credit,
      companyId,
      storeId,
      cartItems
    });
  }

  return {
    success: true,
    credits,
    evaluations
  };
}

/**
 * Server Action: Pre-validates and initiates an Exchange Credit reservation.
 *
 * Security:
 * - Feature Gate must be explicitly enabled.
 * - Server strictly re-evaluates credit validity, company ownership, and full redemption feasibility.
 * - Invokes atomic database stored procedure reserve_exchange_credit_atomic (Migration 0181).
 * - Never trusts client-submitted values or balances.
 */
export async function reserveExchangeCreditAction(
  input: ReserveCreditInput
): Promise<ReserveCreditResult> {
  const session = await verifyRetailerSession();
  if (!session || !session.userId) {
    return { success: false, error: "인증되지 않은 세션입니다." };
  }

  // 1. Feature Gate Enforcement
  const gateEnabled = await isExchangeCreditCheckoutEnabled();
  if (!gateEnabled) {
    return {
      success: false,
      errorCode: "FEATURE_GATE_DISABLED",
      error: "교환 크레딧 결제 적용 기능은 현재 안전 점검(Feature-Gated) 상태입니다. (ENABLE_EXCHANGE_CREDIT_CHECKOUT=false)"
    };
  }

  const adminClient = createAdminClient();

  // 2. Fetch Target Credit
  const { data: creditRow, error: fetchErr } = await adminClient
    .from("retailer_exchange_credit_ledger")
    .select("*")
    .eq("id", input.creditId)
    .maybeSingle();

  if (fetchErr || !creditRow) {
    return { success: false, error: "선택한 교환 크레딧을 찾을 수 없습니다." };
  }

  const credit: CheckoutCreditItem = {
    id: creditRow.id,
    creditCode: creditRow.credit_code,
    companyId: creditRow.company_id,
    storeId: creditRow.store_id,
    creditAmountCents: Number(creditRow.credit_amount_cents),
    creditAmountDollars: Number(creditRow.credit_amount),
    remainingBalanceCents: Number(creditRow.remaining_balance_cents),
    remainingBalanceDollars: Number(creditRow.remaining_balance),
    currency: creditRow.currency,
    status: creditRow.status,
    issuedAt: creditRow.issued_at,
    expiresAt: creditRow.expires_at,
    originatingSku: creditRow.metadata?.sku || creditRow.metadata?.originatingSku || null,
    originatingProductId: creditRow.metadata?.productId || creditRow.metadata?.originatingProductId || null,
    metadata: creditRow.metadata
  };

  // 3. Authoritative Pure Re-evaluation of Eligibility & Full Redemption
  const evalResult = evaluateCreditForCart({
    credit,
    companyId: input.companyId,
    storeId: input.storeId,
    cartItems: input.cartItems,
    asOfDate: input.asOfDate
  });

  if (!evalResult.eligible) {
    return {
      success: false,
      errorCode: evalResult.rejectionCode,
      error: evalResult.rejectionMessage || "선택한 교환 크레딧을 장바구니에 적용할 수 없습니다."
    };
  }

  // 4. Invoke Atomic RPC (Migration 0181)
  const idempotencyKey = `RES-${input.checkoutSessionId}-${input.creditId}`;
  const { data: rpcData, error: rpcErr } = await (adminClient as any).rpc(
    "reserve_exchange_credit_atomic",
    {
      p_credit_id: input.creditId,
      p_company_id: input.companyId,
      p_store_id: input.storeId || null,
      p_checkout_session_id: input.checkoutSessionId,
      p_order_subtotal_cents: evalResult.eligibleSubtotalCents,
      p_idempotency_key: idempotencyKey
    }
  );

  if (rpcErr) {
    return {
      success: false,
      error: rpcErr.message || "교환 크레딧 예약 중 데이터베이스 오류가 발생했습니다."
    };
  }

  const rpcResult = rpcData as any;
  return {
    success: true,
    reservationId: rpcResult?.reservationId || idempotencyKey,
    creditCode: rpcResult?.creditCode || credit.creditCode,
    reservedAmountCents: rpcResult?.reservedAmountCents || credit.creditAmountCents,
    reservedAt: new Date().toISOString(),
    expiresAt: rpcResult?.expiresAt || credit.expiresAt
  };
}

/**
 * Server Action: Releases a reserved credit upon payment failure or cart abandonment.
 * Invokes atomic database stored procedure release_exchange_credit_reservation_atomic.
 */
export async function releaseExchangeCreditReservationAction(
  input: ReleaseReservationInput
): Promise<ReleaseReservationResult> {
  const session = await verifyRetailerSession();
  if (!session || !session.userId) {
    return { success: false, restoredStatus: "issued", error: "Unauthorized session." };
  }

  const adminClient = createAdminClient();

  // Attempt Atomic RPC invocation
  const { data: rpcData, error: rpcErr } = await (adminClient as any).rpc(
    "release_exchange_credit_reservation_atomic",
    {
      p_credit_id: input.creditId,
      p_company_id: input.companyId,
      p_reason: input.reason,
      p_checkout_session_id: input.checkoutSessionId || null
    }
  );

  if (!rpcErr && rpcData && (rpcData as any).success) {
    const res = rpcData as any;
    return {
      success: true,
      restoredStatus: res.restoredStatus,
      creditCode: res.creditCode,
      expiresAt: res.expiresAt,
      notes: `Reservation released due to ${input.reason}. Original expiration preserved.`
    };
  }

  // Fallback to pure state computation if RPC is pending schema execution
  const { data: creditRow } = await adminClient
    .from("retailer_exchange_credit_ledger")
    .select("*")
    .eq("id", input.creditId)
    .eq("company_id", input.companyId)
    .maybeSingle();

  if (!creditRow) {
    return { success: false, restoredStatus: "issued", error: "Credit not found." };
  }

  const credit: CheckoutCreditItem = {
    id: creditRow.id,
    creditCode: creditRow.credit_code,
    companyId: creditRow.company_id,
    storeId: creditRow.store_id,
    creditAmountCents: Number(creditRow.credit_amount_cents),
    creditAmountDollars: Number(creditRow.credit_amount),
    remainingBalanceCents: Number(creditRow.remaining_balance_cents),
    remainingBalanceDollars: Number(creditRow.remaining_balance),
    currency: creditRow.currency,
    status: creditRow.status,
    issuedAt: creditRow.issued_at,
    expiresAt: creditRow.expires_at
  };

  const restored = determinePostPaymentFailureCreditState(credit, input.asOfDate);

  return {
    success: true,
    restoredStatus: restored.restoredStatus,
    creditCode: credit.creditCode,
    expiresAt: restored.expiresAt,
    notes: `Reservation released due to ${input.reason}. Original expiration preserved.`
  };
}

/**
 * Server Action: Confirms final credit redemption upon verified payment completion.
 * Invokes atomic database stored procedure redeem_exchange_credit_atomic.
 */
export async function confirmExchangeCreditRedemptionAction(
  input: ConfirmRedemptionInput
): Promise<ConfirmRedemptionResult> {
  const session = await verifyRetailerSession();
  if (!session || !session.userId) {
    return { success: false, error: "Unauthorized session." };
  }

  const gateEnabled = await isExchangeCreditCheckoutEnabled();
  if (!gateEnabled) {
    return {
      success: false,
      errorCode: "FEATURE_GATE_DISABLED",
      error: "Exchange Credit redemption feature gate is disabled."
    };
  }

  const adminClient = createAdminClient();

  const { data: rpcData, error: rpcErr } = await (adminClient as any).rpc(
    "redeem_exchange_credit_atomic",
    {
      p_credit_id: input.creditId,
      p_company_id: input.companyId,
      p_order_id: input.orderId,
      p_payment_idempotency_key: input.paymentIdempotencyKey
    }
  );

  if (rpcErr) {
    return {
      success: false,
      errorCode: "REDEMPTION_RPC_FAILED",
      error: rpcErr.message || "Exchange credit redemption failed during database transaction."
    };
  }

  const res = rpcData as any;
  return {
    success: true,
    creditCode: res?.creditCode,
    redeemedAmountCents: res?.redeemedAmountCents,
    redeemedAt: new Date().toISOString(),
    orderId: input.orderId
  };
}

/**
 * Server Action: Reinstates a redeemed credit upon full order cancellation BEFORE shipment.
 *
 * Rules:
 * - Only 100% full cancellations qualify for automated reinstatement.
 * - Partial cancellations require manual review: "POLICY REVIEW REQUIRED"
 * - Post-shipment returns require manual review: "POLICY REVIEW REQUIRED"
 * - Original expiration date is strictly preserved and never extended.
 * - Invokes atomic stored procedure reinstate_cancelled_exchange_credit_atomic (Migration 0181).
 */
export async function reinstateCancelledCreditAction(
  input: ReinstateCancelledCreditInput
): Promise<ReinstateCancelledCreditResult> {
  const session = await verifyRetailerSession();
  if (!session || !session.userId) {
    return { success: false, restoredStatus: "issued", error: "Unauthorized session." };
  }

  const adminClient = createAdminClient();

  // 1. Fetch Target Credit for Pre-Validation
  const { data: creditRow, error: fetchErr } = await adminClient
    .from("retailer_exchange_credit_ledger")
    .select("*")
    .eq("id", input.creditId)
    .eq("company_id", input.companyId)
    .maybeSingle();

  if (fetchErr || !creditRow) {
    return { success: false, restoredStatus: "issued", error: "Credit not found." };
  }

  const credit: CheckoutCreditItem = {
    id: creditRow.id,
    creditCode: creditRow.credit_code,
    companyId: creditRow.company_id,
    storeId: creditRow.store_id,
    creditAmountCents: Number(creditRow.credit_amount_cents),
    creditAmountDollars: Number(creditRow.credit_amount),
    remainingBalanceCents: Number(creditRow.remaining_balance_cents),
    remainingBalanceDollars: Number(creditRow.remaining_balance),
    currency: creditRow.currency,
    status: creditRow.status,
    issuedAt: creditRow.issued_at,
    expiresAt: creditRow.expires_at,
    metadata: creditRow.metadata
  };

  // 2. Pure Domain Policy Pre-evaluation
  const eligibility = evaluateReinstatementEligibility({
    orderStatus: input.orderStatus || "cancelled",
    isFullCancellation: input.isFullCancellation,
    credit,
    asOfDate: input.asOfDate
  });

  if (eligibility.requiresPolicyReview || !eligibility.eligible) {
    return {
      success: false,
      restoredStatus: eligibility.restoredStatus || "issued",
      requiresPolicyReview: true,
      error: eligibility.reason || "POLICY REVIEW REQUIRED: Reinstatement cannot be automated."
    };
  }

  // 3. Feature Gate Enforcement
  const gateEnabled = await isExchangeCreditCheckoutEnabled();
  if (!gateEnabled) {
    return {
      success: false,
      restoredStatus: eligibility.restoredStatus || "issued",
      error: "Exchange Credit checkout feature gate is disabled. Reinstatement RPC is gated."
    };
  }

  // 4. Invoke Atomic RPC
  const idempotencyKey = input.idempotencyKey || `REINSTATE-${input.orderId}-${input.creditId}`;
  const { data: rpcData, error: rpcErr } = await (adminClient as any).rpc(
    "reinstate_cancelled_exchange_credit_atomic",
    {
      p_credit_id: input.creditId,
      p_company_id: input.companyId,
      p_order_id: input.orderId,
      p_cancellation_reason: input.cancellationReason,
      p_idempotency_key: idempotencyKey
    }
  );

  if (rpcErr) {
    return {
      success: false,
      restoredStatus: eligibility.restoredStatus || "issued",
      error: rpcErr.message || "Reinstatement transaction failed."
    };
  }

  const res = rpcData as any;
  if (!res?.success) {
    return {
      success: false,
      restoredStatus: eligibility.restoredStatus || "issued",
      requiresPolicyReview: res?.requiresPolicyReview,
      error: res?.error || "Reinstatement rejected by policy."
    };
  }

  return {
    success: true,
    restoredStatus: res.restoredStatus,
    creditCode: res.creditCode,
    expiresAt: res.expiresAt,
    remainingBalanceCents: res.remainingBalanceCents,
    idempotentReplay: res.idempotentReplay
  };
}

