-- ==============================================================================
-- Migration: 0181_retailer_exchange_credit_checkout_redemption.sql
-- Task ID: EXCHANGE-CREDIT-PH4-002-R1
-- Description: Atomic Credit Reservation, One-Time Full Redemption, Reservation
--              Release, and Pre-Shipment Order Cancellation Reinstatement RPCs
--              for Retailer Checkout Integration.
-- Policy Enforcements:
--   1. One-Time Full Redemption (100% balance consumed, remaining_balance = 0)
--   2. Strict Non-Extendable Expiration (expires_at is never modified or revived)
--   3. Concurrency Protection (SELECT ... FOR UPDATE row-level locking)
--   4. Pre-Shipment Cancellation Reinstatement (REDEEMED -> AVAILABLE or EXPIRED)
--   5. Idempotent Execution & Anti-Double-Redemption Guards
-- Safety: Additive only. Non-destructive. Idempotent.
-- Execution Mode: PREPARED FILE ONLY (REQUIRES OWNER REVIEW & APPROVAL)
-- Dependencies: 0002_companies.sql, 0175, 0176, 0177, 0178, 0179, 0180 (Ledger)
-- ==============================================================================

-- 1. Extend Transaction Type Check Constraint to Support Reinstatement
ALTER TABLE public.retailer_exchange_credit_transactions
  DROP CONSTRAINT IF EXISTS retailer_exchange_credit_transactions_transaction_type_check;

ALTER TABLE public.retailer_exchange_credit_transactions
  ADD CONSTRAINT retailer_exchange_credit_transactions_transaction_type_check
  CHECK (transaction_type IN ('issuance', 'reservation', 'reservation_release', 'redemption', 'expiration', 'void', 'reinstatement'));

-- 2. Atomic Stored Procedure: reserve_exchange_credit_atomic
-- Purpose: Temporarily locks credit for an active checkout session.
CREATE OR REPLACE FUNCTION public.reserve_exchange_credit_atomic(
  p_credit_id UUID,
  p_company_id UUID,
  p_store_id UUID,
  p_checkout_session_id TEXT,
  p_order_subtotal_cents BIGINT,
  p_idempotency_key TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_credit RECORD;
BEGIN
  -- A. Authorization: Verify caller belongs to company, or is admin/service_role
  IF (auth.role() <> 'service_role') AND NOT EXISTS (
    SELECT 1 FROM public.company_users
    WHERE company_id = p_company_id
      AND email = (auth.jwt() ->> 'email')
      AND status = 'active'
  ) AND NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Caller does not belong to the retailer company.'
      USING ERRCODE = 'P0001';
  END IF;

  -- B. Concurrency Guard: Lock Target Credit Row
  SELECT * INTO v_credit
  FROM public.retailer_exchange_credit_ledger
  WHERE id = p_credit_id AND company_id = p_company_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Exchange credit not found or does not belong to target company.'
      USING ERRCODE = 'P0002';
  END IF;

  -- C. Store Scope Validation (if credit is restricted to a specific store)
  IF v_credit.store_id IS NOT NULL AND p_store_id IS NOT NULL AND v_credit.store_id <> p_store_id THEN
    RAISE EXCEPTION 'Exchange credit is restricted to a different store location.'
      USING ERRCODE = 'P0003';
  END IF;

  -- D. Idempotency Check: Same session or same idempotency key already reserved
  IF v_credit.status = 'reserved' AND (
    (v_credit.metadata ->> 'checkout_session_id') = p_checkout_session_id OR
    (v_credit.metadata ->> 'last_reservation_idempotency_key') = p_idempotency_key
  ) THEN
    RETURN jsonb_build_object(
      'success', true,
      'creditId', v_credit.id,
      'creditCode', v_credit.credit_code,
      'reservedAmountCents', v_credit.credit_amount_cents,
      'expiresAt', v_credit.expires_at,
      'status', 'reserved',
      'idempotentReplay', true
    );
  END IF;

  -- E. Availability & Lifecycle Validation
  IF v_credit.status = 'redeemed' THEN
    RAISE EXCEPTION 'Exchange credit has already been redeemed in a previous order.'
      USING ERRCODE = 'P0004';
  END IF;

  IF v_credit.status = 'reserved' THEN
    RAISE EXCEPTION 'Exchange credit is already reserved in another checkout session.'
      USING ERRCODE = 'P0005';
  END IF;

  IF v_credit.status <> 'issued' THEN
    RAISE EXCEPTION 'Exchange credit is not available for reservation (Status: %).', v_credit.status
      USING ERRCODE = 'P0006';
  END IF;

  -- F. Strict Expiration Validation (Original expiration is immutable)
  IF v_credit.expires_at <= NOW() THEN
    UPDATE public.retailer_exchange_credit_ledger
    SET status = 'expired', updated_at = NOW()
    WHERE id = p_credit_id;

    RAISE EXCEPTION 'Exchange credit expired on %. 90-day validity cannot be extended.', v_credit.expires_at
      USING ERRCODE = 'P0007';
  END IF;

  -- G. Full Redemption Feasibility Check (Order merchandise subtotal must cover full credit amount)
  IF p_order_subtotal_cents < v_credit.credit_amount_cents THEN
    RAISE EXCEPTION 'Order eligible subtotal is insufficient for full redemption.'
      USING ERRCODE = 'P0008';
  END IF;

  -- H. Transition Status to 'reserved' (Preserving original expires_at unchanged)
  UPDATE public.retailer_exchange_credit_ledger
  SET status = 'reserved',
      metadata = metadata || jsonb_build_object(
        'checkout_session_id', p_checkout_session_id,
        'reserved_at', NOW(),
        'last_reservation_idempotency_key', p_idempotency_key
      ),
      updated_at = NOW()
  WHERE id = p_credit_id;

  -- I. Record Reservation Audit Transaction
  INSERT INTO public.retailer_exchange_credit_transactions (
    credit_id,
    company_id,
    transaction_type,
    amount,
    amount_cents,
    balance_before,
    balance_before_cents,
    balance_after,
    balance_after_cents,
    reference_checkout_session_id,
    performed_by,
    idempotency_key,
    notes
  ) VALUES (
    v_credit.id,
    p_company_id,
    'reservation',
    0.00,
    0,
    v_credit.remaining_balance,
    v_credit.remaining_balance_cents,
    v_credit.remaining_balance,
    v_credit.remaining_balance_cents,
    p_checkout_session_id,
    COALESCE(auth.uid(), v_credit.issued_by),
    p_idempotency_key,
    COALESCE(p_notes, 'Locked for checkout session: ' || p_checkout_session_id)
  );

  RETURN jsonb_build_object(
    'success', true,
    'creditId', v_credit.id,
    'creditCode', v_credit.credit_code,
    'reservedAmountCents', v_credit.credit_amount_cents,
    'expiresAt', v_credit.expires_at,
    'status', 'reserved'
  );
END;
$$;

-- 3. Atomic Stored Procedure: release_exchange_credit_reservation_atomic
-- Purpose: Safely releases a reservation upon checkout abandonment, user deselection, or payment failure.
CREATE OR REPLACE FUNCTION public.release_exchange_credit_reservation_atomic(
  p_credit_id UUID,
  p_company_id UUID,
  p_reason TEXT,
  p_checkout_session_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_credit RECORD;
  v_new_status TEXT;
BEGIN
  -- A. Authorization Check
  IF (auth.role() <> 'service_role') AND NOT EXISTS (
    SELECT 1 FROM public.company_users
    WHERE company_id = p_company_id
      AND email = (auth.jwt() ->> 'email')
      AND status = 'active'
  ) AND NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Caller does not belong to the retailer company.'
      USING ERRCODE = 'P0001';
  END IF;

  -- B. Concurrency Guard: Lock Target Credit Row
  SELECT * INTO v_credit
  FROM public.retailer_exchange_credit_ledger
  WHERE id = p_credit_id AND company_id = p_company_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Credit not found.');
  END IF;

  -- C. Validate Current Status
  IF v_credit.status <> 'reserved' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Credit is not currently reserved (Current status: ' || v_credit.status || ').'
    );
  END IF;

  -- D. Session Identity Verification (if provided)
  IF p_checkout_session_id IS NOT NULL AND (v_credit.metadata ->> 'checkout_session_id') IS DISTINCT FROM p_checkout_session_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Checkout session mismatch during reservation release.'
    );
  END IF;

  -- E. Determine Restored Status (Strict Non-Extendable Expiration: expires_at is NEVER modified)
  IF v_credit.expires_at <= NOW() THEN
    v_new_status := 'expired';
  ELSE
    v_new_status := 'issued';
  END IF;

  -- F. Update Ledger Status
  UPDATE public.retailer_exchange_credit_ledger
  SET status = v_new_status,
      metadata = metadata || jsonb_build_object(
        'released_at', NOW(),
        'release_reason', p_reason
      ),
      updated_at = NOW()
  WHERE id = p_credit_id;

  -- G. Record Release Audit Transaction
  INSERT INTO public.retailer_exchange_credit_transactions (
    credit_id,
    company_id,
    transaction_type,
    amount,
    amount_cents,
    balance_before,
    balance_before_cents,
    balance_after,
    balance_after_cents,
    reference_checkout_session_id,
    performed_by,
    notes
  ) VALUES (
    v_credit.id,
    p_company_id,
    'reservation_release',
    0.00,
    0,
    v_credit.remaining_balance,
    v_credit.remaining_balance_cents,
    v_credit.remaining_balance,
    v_credit.remaining_balance_cents,
    COALESCE(p_checkout_session_id, v_credit.metadata ->> 'checkout_session_id'),
    COALESCE(auth.uid(), v_credit.issued_by),
    'Reservation released: ' || p_reason || ' (Original expiry preserved)'
  );

  RETURN jsonb_build_object(
    'success', true,
    'creditId', v_credit.id,
    'creditCode', v_credit.credit_code,
    'restoredStatus', v_new_status,
    'expiresAt', v_credit.expires_at
  );
END;
$$;

-- 4. Atomic Stored Procedure: redeem_exchange_credit_atomic
-- Purpose: Confirms full one-time redemption upon verified order payment completion.
CREATE OR REPLACE FUNCTION public.redeem_exchange_credit_atomic(
  p_credit_id UUID,
  p_company_id UUID,
  p_order_id UUID,
  p_payment_idempotency_key TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_credit RECORD;
BEGIN
  -- A. Authorization Check
  IF (auth.role() <> 'service_role') AND NOT EXISTS (
    SELECT 1 FROM public.company_users
    WHERE company_id = p_company_id
      AND email = (auth.jwt() ->> 'email')
      AND status = 'active'
  ) AND NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Caller does not belong to the retailer company.'
      USING ERRCODE = 'P0001';
  END IF;

  -- B. Concurrency Guard: Lock Target Credit Row
  SELECT * INTO v_credit
  FROM public.retailer_exchange_credit_ledger
  WHERE id = p_credit_id AND company_id = p_company_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Exchange credit not found or does not belong to target company.'
      USING ERRCODE = 'P0002';
  END IF;

  -- C. Idempotency Check: Return success if already redeemed for this exact order or payment key
  IF v_credit.status = 'redeemed' AND (
    (v_credit.metadata ->> 'order_id') = p_order_id::TEXT OR
    (v_credit.metadata ->> 'payment_idempotency_key') = p_payment_idempotency_key
  ) THEN
    RETURN jsonb_build_object(
      'success', true,
      'creditId', v_credit.id,
      'creditCode', v_credit.credit_code,
      'redeemedAmountCents', v_credit.credit_amount_cents,
      'remainingBalanceCents', 0,
      'status', 'redeemed',
      'idempotentReplay', true
    );
  END IF;

  -- D. Validate Lifecycle Status
  IF v_credit.status = 'redeemed' THEN
    RAISE EXCEPTION 'Exchange credit has already been redeemed in another order.'
      USING ERRCODE = 'P0004';
  END IF;

  IF v_credit.status NOT IN ('reserved', 'issued') THEN
    RAISE EXCEPTION 'Exchange credit cannot be redeemed (Status: %).', v_credit.status
      USING ERRCODE = 'P0006';
  END IF;

  -- E. Expiration Guard
  IF v_credit.expires_at <= NOW() THEN
    UPDATE public.retailer_exchange_credit_ledger
    SET status = 'expired', updated_at = NOW()
    WHERE id = p_credit_id;

    RAISE EXCEPTION 'Exchange credit expired on %. Redemption is rejected.', v_credit.expires_at
      USING ERRCODE = 'P0007';
  END IF;

  -- F. Enforce One-Time Full Redemption Policy: Balance is 100% consumed (Remaining = 0)
  UPDATE public.retailer_exchange_credit_ledger
  SET status = 'redeemed',
      remaining_balance = 0.00,
      remaining_balance_cents = 0,
      metadata = metadata || jsonb_build_object(
        'order_id', p_order_id,
        'redeemed_at', NOW(),
        'payment_idempotency_key', p_payment_idempotency_key
      ),
      updated_at = NOW()
  WHERE id = p_credit_id;

  -- G. Record Redemption Audit Transaction
  INSERT INTO public.retailer_exchange_credit_transactions (
    credit_id,
    company_id,
    transaction_type,
    amount,
    amount_cents,
    balance_before,
    balance_before_cents,
    balance_after,
    balance_after_cents,
    reference_order_id,
    performed_by,
    idempotency_key,
    notes
  ) VALUES (
    v_credit.id,
    p_company_id,
    'redemption',
    v_credit.credit_amount,
    v_credit.credit_amount_cents,
    v_credit.credit_amount,
    v_credit.credit_amount_cents,
    0.00,
    0,
    p_order_id,
    COALESCE(auth.uid(), v_credit.issued_by),
    p_payment_idempotency_key,
    COALESCE(p_notes, 'Full redemption applied to order: ' || p_order_id::TEXT)
  );

  RETURN jsonb_build_object(
    'success', true,
    'creditId', v_credit.id,
    'creditCode', v_credit.credit_code,
    'redeemedAmountCents', v_credit.credit_amount_cents,
    'remainingBalanceCents', 0,
    'status', 'redeemed'
  );
END;
$$;

-- 5. Atomic Stored Procedure: reinstate_cancelled_exchange_credit_atomic
-- Purpose: Reinstates a redeemed credit upon full order cancellation BEFORE shipment.
-- Rules:
--   - Restores credit status to 'issued' if original expiration timestamp has not passed.
--   - Transitions credit status to 'expired' if original expiration timestamp has passed.
--   - Original expires_at is NEVER modified or extended!
--   - Unsupported cases (partial cancellation, post-shipment returns) require policy review.
CREATE OR REPLACE FUNCTION public.reinstate_cancelled_exchange_credit_atomic(
  p_credit_id UUID,
  p_company_id UUID,
  p_order_id UUID,
  p_cancellation_reason TEXT,
  p_idempotency_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_credit RECORD;
  v_new_status TEXT;
  v_order_status TEXT;
BEGIN
  -- A. Authorization Check
  IF (auth.role() <> 'service_role') AND NOT EXISTS (
    SELECT 1 FROM public.company_users
    WHERE company_id = p_company_id
      AND email = (auth.jwt() ->> 'email')
      AND status = 'active'
  ) AND NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Caller does not belong to the retailer company.'
      USING ERRCODE = 'P0001';
  END IF;

  -- B. Concurrency Guard: Lock Target Credit Row
  SELECT * INTO v_credit
  FROM public.retailer_exchange_credit_ledger
  WHERE id = p_credit_id AND company_id = p_company_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Exchange credit not found or does not belong to target company.'
      USING ERRCODE = 'P0002';
  END IF;

  -- C. Validate Lifecycle Status: Must be in 'redeemed' state
  IF v_credit.status <> 'redeemed' THEN
    RAISE EXCEPTION 'Credit cannot be reinstated because it is not in redeemed status (Status: %).', v_credit.status
      USING ERRCODE = 'P0009';
  END IF;

  -- D. Order Association Check
  IF (v_credit.metadata ->> 'order_id') IS DISTINCT FROM p_order_id::TEXT THEN
    RAISE EXCEPTION 'Credit was not redeemed for the specified order.'
      USING ERRCODE = 'P0010';
  END IF;

  -- E. Duplicate Reinstatement Guard: Check idempotency
  IF (v_credit.metadata ->> 'reinstated_at') IS NOT NULL AND
     (v_credit.metadata ->> 'reinstatement_idempotency_key') = p_idempotency_key THEN
    RETURN jsonb_build_object(
      'success', true,
      'creditId', v_credit.id,
      'creditCode', v_credit.credit_code,
      'restoredStatus', v_credit.status,
      'expiresAt', v_credit.expires_at,
      'idempotentReplay', true
    );
  END IF;

  -- F. Check Pre-Shipment Order Status (if retailer_orders table exists)
  -- Policy: Post-shipment returns or partial cancellations require manual policy review.
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'retailer_orders'
  ) THEN
    SELECT status INTO v_order_status
    FROM public.retailer_orders
    WHERE id = p_order_id;

    IF v_order_status IN ('shipped', 'delivered', 'partially_shipped') THEN
      RETURN jsonb_build_object(
        'success', false,
        'requiresPolicyReview', true,
        'error', 'POLICY REVIEW REQUIRED: Post-shipment or partial order cancellation cannot automatically reinstate exchange credit.'
      );
    END IF;
  END IF;

  -- G. Determine Restored Status (Strict Non-Extendable Expiration: expires_at is NEVER modified)
  IF v_credit.expires_at <= NOW() THEN
    v_new_status := 'expired';
  ELSE
    v_new_status := 'issued';
  END IF;

  -- H. Restore Full Balance and Update Status (Original expires_at preserved!)
  UPDATE public.retailer_exchange_credit_ledger
  SET status = v_new_status,
      remaining_balance = v_credit.credit_amount,
      remaining_balance_cents = v_credit.credit_amount_cents,
      metadata = metadata || jsonb_build_object(
        'reinstated_at', NOW(),
        'reinstatement_reason', p_cancellation_reason,
        'reinstatement_idempotency_key', p_idempotency_key
      ),
      updated_at = NOW()
  WHERE id = p_credit_id;

  -- I. Record Reinstatement Audit Transaction
  INSERT INTO public.retailer_exchange_credit_transactions (
    credit_id,
    company_id,
    transaction_type,
    amount,
    amount_cents,
    balance_before,
    balance_before_cents,
    balance_after,
    balance_after_cents,
    reference_order_id,
    performed_by,
    idempotency_key,
    notes
  ) VALUES (
    v_credit.id,
    p_company_id,
    'reinstatement',
    v_credit.credit_amount,
    v_credit.credit_amount_cents,
    0.00,
    0,
    v_credit.credit_amount,
    v_credit.credit_amount_cents,
    p_order_id,
    COALESCE(auth.uid(), v_credit.issued_by),
    p_idempotency_key,
    'Credit reinstated upon pre-shipment cancellation: ' || p_cancellation_reason
  );

  RETURN jsonb_build_object(
    'success', true,
    'creditId', v_credit.id,
    'creditCode', v_credit.credit_code,
    'restoredStatus', v_new_status,
    'expiresAt', v_credit.expires_at,
    'remainingBalanceCents', CASE WHEN v_new_status = 'issued' THEN v_credit.credit_amount_cents ELSE 0 END
  );
END;
$$;

-- 6. RPC Execution Privileges (Blocked for anonymous; available to authenticated and service_role)
REVOKE EXECUTE ON FUNCTION public.reserve_exchange_credit_atomic FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reserve_exchange_credit_atomic TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.release_exchange_credit_reservation_atomic FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.release_exchange_credit_reservation_atomic TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.redeem_exchange_credit_atomic FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_exchange_credit_atomic TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.reinstate_cancelled_exchange_credit_atomic FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reinstate_cancelled_exchange_credit_atomic TO authenticated, service_role;
