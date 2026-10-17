# Database Contract Specification: Exchange Credit Checkout Reservation & Redemption
## Proposed Migration: 0181_retailer_exchange_credit_checkout_redemption.sql
**Task ID**: EXCHANGE-CREDIT-PH4-002  
**Status**: DESIGN CONTRACT PROPOSAL (Awaiting Owner Approval — DO NOT EXECUTE ON PRODUCTION)  
**Dependencies**: 0002_companies.sql, 0175, 0177, 0178, 0179, 0180 (Ledger)

---

### 1. Overview & Architecture

This contract defines the PostgreSQL atomicity and Row-Level Security (RLS) extensions required to support Checkout-side Exchange Credit reservation, full redemption, and payment failure/cancellation restoration.

```
       +-------------------------------------------------------------+
       |                      CREDIT STATUS                          |
       +-------------------------------------------------------------+
                                     |
                                     | (reserve_exchange_credit_atomic)
                                     v
       +-------------------------------------------------------------+
       |                         RESERVED                            |
       +-------------------------------------------------------------+
                 /                                         \
                / (Payment Success)                         \ (Payment Failed / Cancelled)
               v                                             v
+-----------------------------+               +-------------------------------+
|          REDEEMED           |               |   RESTORED (issued / expired) |
| (100% Consumed, Balance = 0)|               |  (Original Expiry Preserved)  |
+-----------------------------+               +-------------------------------+
```

---

### 2. Proposed PostgreSQL Stored Procedures (RPCs)

#### A. `reserve_exchange_credit_atomic`
Locks the credit row (`SELECT FOR UPDATE`), verifies active company membership and non-expired status, transitions `status = 'reserved'`, and writes a `'reservation'` audit transaction.

```sql
CREATE OR REPLACE FUNCTION public.reserve_exchange_credit_atomic(
  p_credit_id UUID,
  p_company_id UUID,
  p_store_id UUID,
  p_checkout_session_id TEXT,
  p_order_subtotal_cents BIGINT,
  p_idempotency_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_credit RECORD;
BEGIN
  -- 1. Authorization: Verify caller belongs to company
  IF NOT EXISTS (
    SELECT 1 FROM public.company_users
    WHERE company_id = p_company_id
      AND email = (auth.jwt() ->> 'email')
      AND status = 'active'
  ) AND (auth.role() <> 'service_role') THEN
    RAISE EXCEPTION 'Unauthorized: Caller does not belong to the target retailer company.';
  END IF;

  -- 2. Lock credit row
  SELECT * INTO v_credit
  FROM public.retailer_exchange_credit_ledger
  WHERE id = p_credit_id AND company_id = p_company_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Exchange credit not found or does not belong to company.';
  END IF;

  -- Idempotency check
  IF v_credit.status = 'reserved' AND v_credit.metadata ->> 'checkout_session_id' = p_checkout_session_id THEN
    RETURN jsonb_build_object(
      'success', true,
      'creditId', v_credit.id,
      'creditCode', v_credit.credit_code,
      'status', 'reserved',
      'idempotentReplay', true
    );
  END IF;

  -- Validate availability
  IF v_credit.status <> 'issued' THEN
    RAISE EXCEPTION 'Credit is not available for reservation (Current status: %).', v_credit.status;
  END IF;

  -- Validate expiration
  IF v_credit.expires_at <= NOW() THEN
    UPDATE public.retailer_exchange_credit_ledger SET status = 'expired' WHERE id = p_credit_id;
    RAISE EXCEPTION 'Credit expired on %. Expiration cannot be extended.', v_credit.expires_at;
  END IF;

  -- Validate full redemption feasibility
  IF p_order_subtotal_cents < v_credit.credit_amount_cents THEN
    RAISE EXCEPTION 'Order subtotal is insufficient for full redemption.';
  END IF;

  -- Transition to reserved
  UPDATE public.retailer_exchange_credit_ledger
  SET status = 'reserved',
      metadata = metadata || jsonb_build_object('checkout_session_id', p_checkout_session_id, 'reserved_at', NOW()),
      updated_at = NOW()
  WHERE id = p_credit_id;

  -- Record audit transaction
  INSERT INTO public.retailer_exchange_credit_transactions (
    credit_id, company_id, transaction_type, amount, amount_cents,
    balance_before, balance_before_cents, balance_after, balance_after_cents,
    reference_checkout_session_id, performed_by, idempotency_key, notes
  ) VALUES (
    v_credit.id, p_company_id, 'reservation', 0.00, 0,
    v_credit.remaining_balance, v_credit.remaining_balance_cents,
    v_credit.remaining_balance, v_credit.remaining_balance_cents,
    p_checkout_session_id, auth.uid(), p_idempotency_key, 'Locked for checkout session.'
  );

  RETURN jsonb_build_object(
    'success', true,
    'creditId', v_credit.id,
    'creditCode', v_credit.credit_code,
    'reservedAmountCents', v_credit.credit_amount_cents,
    'expiresAt', v_credit.expires_at
  );
END;
$$;
```

#### B. `release_exchange_credit_reservation_atomic`
Releases the reservation upon payment failure, cart abandonment, or session timeout. If the credit expired in the meantime, it transitions to `'expired'` (never extends the original expiration timestamp).

```sql
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
  SELECT * INTO v_credit
  FROM public.retailer_exchange_credit_ledger
  WHERE id = p_credit_id AND company_id = p_company_id
  FOR UPDATE;

  IF NOT FOUND OR v_credit.status <> 'reserved' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Credit is not in reserved status.');
  END IF;

  -- Determine restored status (Preserve strict expiration date!)
  IF v_credit.expires_at <= NOW() THEN
    v_new_status := 'expired';
  ELSE
    v_new_status := 'issued';
  END IF;

  UPDATE public.retailer_exchange_credit_ledger
  SET status = v_new_status,
      updated_at = NOW()
  WHERE id = p_credit_id;

  INSERT INTO public.retailer_exchange_credit_transactions (
    credit_id, company_id, transaction_type, amount, amount_cents,
    balance_before, balance_before_cents, balance_after, balance_after_cents,
    reference_checkout_session_id, performed_by, notes
  ) VALUES (
    v_credit.id, p_company_id, 'reservation_release', 0.00, 0,
    v_credit.remaining_balance, v_credit.remaining_balance_cents,
    v_credit.remaining_balance, v_credit.remaining_balance_cents,
    p_checkout_session_id, auth.uid(), 'Reservation released: ' || p_reason
  );

  RETURN jsonb_build_object('success', true, 'restoredStatus', v_new_status, 'expiresAt', v_credit.expires_at);
END;
$$;
```

#### C. `redeem_exchange_credit_atomic`
Finalizes redemption upon verified payment. Consumes 100% of credit amount, sets remaining balance to 0, and updates status to `'redeemed'`.

```sql
CREATE OR REPLACE FUNCTION public.redeem_exchange_credit_atomic(
  p_credit_id UUID,
  p_company_id UUID,
  p_order_id UUID,
  p_payment_idempotency_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_credit RECORD;
BEGIN
  SELECT * INTO v_credit
  FROM public.retailer_exchange_credit_ledger
  WHERE id = p_credit_id AND company_id = p_company_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Credit not found.';
  END IF;

  -- Idempotency
  IF v_credit.status = 'redeemed' AND v_credit.metadata ->> 'order_id' = p_order_id::TEXT THEN
    RETURN jsonb_build_object('success', true, 'idempotentReplay', true);
  END IF;

  IF v_credit.status NOT IN ('issued', 'reserved') THEN
    RAISE EXCEPTION 'Credit cannot be redeemed (Status: %).', v_credit.status;
  END IF;

  -- One-time full redemption: Remaining balance becomes exactly 0
  UPDATE public.retailer_exchange_credit_ledger
  SET status = 'redeemed',
      remaining_balance = 0.00,
      remaining_balance_cents = 0,
      metadata = metadata || jsonb_build_object('order_id', p_order_id, 'redeemed_at', NOW()),
      updated_at = NOW()
  WHERE id = p_credit_id;

  INSERT INTO public.retailer_exchange_credit_transactions (
    credit_id, company_id, transaction_type, amount, amount_cents,
    balance_before, balance_before_cents, balance_after, balance_after_cents,
    reference_order_id, performed_by, idempotency_key, notes
  ) VALUES (
    v_credit.id, p_company_id, 'redemption', v_credit.credit_amount, v_credit.credit_amount_cents,
    v_credit.credit_amount, v_credit.credit_amount_cents,
    0.00, 0,
    p_order_id, auth.uid(), p_payment_idempotency_key, 'Full redemption applied to order.'
  );

  RETURN jsonb_build_object(
    'success', true,
    'creditId', v_credit.id,
    'creditCode', v_credit.credit_code,
    'redeemedAmountCents', v_credit.credit_amount_cents,
    'remainingBalanceCents', 0
  );
END;
$$;
```

---

### 3. Safety Directives
1. **Zero Production Mutation**: This specification is design-only. No SQL has been applied to `shzfrppdobpmrstcjfqu`.
2. **Phase 4 Alignment**: Complements `0180_retailer_exchange_credit_ledger.sql` by adding checkout lifecycle handlers without altering existing ledger structures.
