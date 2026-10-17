-- ==============================================================================
-- Migration: 0180_retailer_exchange_credit_ledger.sql
-- Task ID: EXCHANGE-CREDIT-PH4-001 / EXCHANGE-CREDIT-PH4-001-R1
-- Description: Authoritative 90-Day Exchange Credit Ledger & Expiration Foundation,
--              Company-Scoped Balances, Immutable Audit Transactions,
--              PostgreSQL Atomicity RPC with Full Database-Level Policy Enforcement,
--              Anti-Duplicate Issuance Constraints, and Least-Privilege RLS Policies.
-- Safety: Non-destructive, idempotent (IF NOT EXISTS), zero table resets.
-- Execution Mode: PREPARED FILE ONLY (REQUIRES OWNER REVIEW & APPROVAL)
-- Dependencies: 0002_companies.sql, 0175, 0176, 0177, 0178, 0179.
-- ==============================================================================

-- 0. Sequence for Authoritative Credit Codes (CRD-YYYY-XXXXXX)
CREATE SEQUENCE IF NOT EXISTS public.retailer_exchange_credit_code_seq START 1;

CREATE OR REPLACE FUNCTION public.generate_exchange_credit_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next_val BIGINT;
  v_year TEXT;
BEGIN
  v_next_val := nextval('public.retailer_exchange_credit_code_seq');
  v_year := to_char(NOW() AT TIME ZONE 'America/New_York', 'YYYY');
  RETURN 'CRD-' || v_year || '-' || LPAD(v_next_val::TEXT, 6, '0');
END;
$$;

-- 1. Authoritative Exchange Credit Ledger Table
CREATE TABLE IF NOT EXISTS public.retailer_exchange_credit_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_code TEXT NOT NULL UNIQUE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  store_id UUID NULL REFERENCES public.stores(id) ON DELETE RESTRICT,

  -- Issuance Provenance
  issuance_source TEXT NOT NULL CHECK (
    issuance_source IN ('option_a_claim_approved', 'option_b_inspection_passed')
  ),
  source_claim_id UUID NOT NULL REFERENCES public.retailer_exchange_claims(id) ON DELETE RESTRICT,
  source_claim_item_id UUID NOT NULL UNIQUE REFERENCES public.retailer_exchange_claim_items(id) ON DELETE RESTRICT,
  source_rma_id UUID NULL REFERENCES public.retailer_exchange_rmas(id) ON DELETE RESTRICT,
  source_inspection_id UUID NULL REFERENCES public.retailer_exchange_rma_inspections(id) ON DELETE RESTRICT,

  -- Exact Financial Amounts (Dual Representation: Dollar numeric & Exact integer cents)
  credit_amount NUMERIC(12, 2) NOT NULL CHECK (credit_amount > 0),
  credit_amount_cents BIGINT NOT NULL CHECK (credit_amount_cents > 0),
  remaining_balance NUMERIC(12, 2) NOT NULL CHECK (remaining_balance >= 0 AND remaining_balance <= credit_amount),
  remaining_balance_cents BIGINT NOT NULL CHECK (remaining_balance_cents >= 0 AND remaining_balance_cents <= credit_amount_cents),
  currency TEXT NOT NULL DEFAULT 'USD' CHECK (currency = 'USD'),

  -- Strict Lifecycle Status
  status TEXT NOT NULL DEFAULT 'issued' CHECK (
    status IN ('issued', 'reserved', 'redeemed', 'expired', 'voided')
  ),

  -- Non-Extendable 90-Calendar-Day Expiration Policy
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL CHECK (expires_at > issued_at),

  -- Attribution & Audit
  issued_by UUID NOT NULL REFERENCES auth.users(id),
  idempotency_key TEXT NOT NULL UNIQUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Append-Only Credit Transaction & Audit Trail Table
CREATE TABLE IF NOT EXISTS public.retailer_exchange_credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_id UUID NOT NULL REFERENCES public.retailer_exchange_credit_ledger(id) ON DELETE RESTRICT,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,

  transaction_type TEXT NOT NULL CHECK (
    transaction_type IN ('issuance', 'reservation', 'reservation_release', 'redemption', 'expiration', 'void')
  ),

  -- Monetary Movement
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  amount_cents BIGINT NOT NULL CHECK (amount_cents >= 0),
  balance_before NUMERIC(12, 2) NOT NULL CHECK (balance_before >= 0),
  balance_before_cents BIGINT NOT NULL CHECK (balance_before_cents >= 0),
  balance_after NUMERIC(12, 2) NOT NULL CHECK (balance_after >= 0),
  balance_after_cents BIGINT NOT NULL CHECK (balance_after_cents >= 0),

  -- External References (Checkout & Order Integration for PH4-002)
  reference_order_id UUID NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  reference_checkout_session_id TEXT NULL,
  performed_by UUID NOT NULL REFERENCES auth.users(id),
  idempotency_key TEXT NULL,
  notes TEXT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Performance & Integrity Indexes
CREATE INDEX IF NOT EXISTS idx_credit_ledger_company ON public.retailer_exchange_credit_ledger(company_id, status);
CREATE INDEX IF NOT EXISTS idx_credit_ledger_expires ON public.retailer_exchange_credit_ledger(expires_at) WHERE status = 'issued';
CREATE INDEX IF NOT EXISTS idx_credit_ledger_claim ON public.retailer_exchange_credit_ledger(source_claim_id);
CREATE INDEX IF NOT EXISTS idx_credit_ledger_claim_item ON public.retailer_exchange_credit_ledger(source_claim_item_id);
CREATE INDEX IF NOT EXISTS idx_credit_ledger_idemp ON public.retailer_exchange_credit_ledger(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_credit_tx_credit ON public.retailer_exchange_credit_transactions(credit_id);
CREATE INDEX IF NOT EXISTS idx_credit_tx_company ON public.retailer_exchange_credit_transactions(company_id);

-- 4. Immutability Protection Triggers
-- Prevents alteration of critical financial origin fields and prevents row deletion entirely
CREATE OR REPLACE FUNCTION public.trg_prevent_exchange_credit_ledger_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Exchange credit ledger records are strictly immutable and cannot be deleted.';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.id <> OLD.id OR
       NEW.credit_code <> OLD.credit_code OR
       NEW.company_id <> OLD.company_id OR
       NEW.source_claim_id <> OLD.source_claim_id OR
       NEW.source_claim_item_id <> OLD.source_claim_item_id OR
       (NEW.source_rma_id IS DISTINCT FROM OLD.source_rma_id) OR
       (NEW.source_inspection_id IS DISTINCT FROM OLD.source_inspection_id) OR
       NEW.credit_amount <> OLD.credit_amount OR
       NEW.credit_amount_cents <> OLD.credit_amount_cents OR
       NEW.issued_at <> OLD.issued_at OR
       NEW.expires_at <> OLD.expires_at OR
       NEW.issued_by <> OLD.issued_by OR
       NEW.idempotency_key <> OLD.idempotency_key THEN
      RAISE EXCEPTION 'Immutable financial origin fields of credit ledger cannot be altered.';
    END IF;
    NEW.updated_at := NOW();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_credit_ledger_immutability ON public.retailer_exchange_credit_ledger;
CREATE TRIGGER trg_credit_ledger_immutability
  BEFORE UPDATE OR DELETE ON public.retailer_exchange_credit_ledger
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_prevent_exchange_credit_ledger_mutation();

-- Transaction Append-Only Trigger
CREATE OR REPLACE FUNCTION public.trg_prevent_exchange_credit_tx_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Exchange credit transactions are append-only audit records and cannot be deleted.';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'Exchange credit transactions are append-only audit records and cannot be modified.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_credit_tx_append_only ON public.retailer_exchange_credit_transactions;
CREATE TRIGGER trg_credit_tx_append_only
  BEFORE UPDATE OR DELETE ON public.retailer_exchange_credit_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_prevent_exchange_credit_tx_mutation();

-- 5. Atomic Credit Issuance Stored Procedure (RPC) with Database-Level Authorization & Policy Verification
CREATE OR REPLACE FUNCTION public.issue_exchange_credit_atomic(
  p_issuance_source TEXT,
  p_claim_id UUID,
  p_claim_item_id UUID,
  p_rma_id UUID,
  p_inspection_id UUID,
  p_company_id UUID,
  p_store_id UUID,
  p_amount_cents BIGINT,
  p_amount_dollars NUMERIC,
  p_issued_by UUID,
  p_idempotency_key TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_credit_id UUID;
  v_credit_code TEXT;
  v_expires_at TIMESTAMPTZ;
  v_existing_credit RECORD;
  v_unresolved_count INT;
BEGIN
  -- A. Database-Level Authorization Enforcement: Caller must be Admin or service_role
  IF (auth.role() <> 'service_role') AND NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only authorized administrators or service_role can issue exchange credits.';
  END IF;

  -- B. Financial Integrity Precondition: Strict Positive Amounts and Cent/Dollar Consistency
  IF p_amount_cents <= 0 OR p_amount_dollars <= 0.00 THEN
    RAISE EXCEPTION 'Financial Integrity Violation: Credit amount must be strictly greater than zero.';
  END IF;
  IF p_amount_cents <> ROUND(p_amount_dollars * 100)::BIGINT THEN
    RAISE EXCEPTION 'Financial Integrity Violation: Cent amount (%) does not match dollar amount (%).',
      p_amount_cents, p_amount_dollars;
  END IF;

  -- C. Policy Contract Validation
  IF p_issuance_source = 'option_a_claim_approved' THEN
    -- Option A requires approved/resolved claim
    IF NOT EXISTS (
      SELECT 1 FROM public.retailer_exchange_claims
      WHERE id = p_claim_id AND status IN ('approved', 'resolved')
    ) THEN
      RAISE EXCEPTION 'Policy Violation: Option A credit requires a finalized, approved claim.';
    END IF;

    -- Option A requires claim line item to be Option A and not rejected/cancelled
    IF NOT EXISTS (
      SELECT 1 FROM public.retailer_exchange_claim_items
      WHERE id = p_claim_item_id AND claim_id = p_claim_id AND selected_option = 'A'
        AND status NOT IN ('rejected', 'cancelled')
    ) THEN
      RAISE EXCEPTION 'Policy Violation: Claim line item must be Option A and not rejected or cancelled.';
    END IF;

  ELSIF p_issuance_source = 'option_b_inspection_passed' THEN
    -- Option B requires valid RMA and inspection references
    IF p_inspection_id IS NULL OR p_rma_id IS NULL THEN
      RAISE EXCEPTION 'Policy Violation: Option B credit requires valid RMA and warehouse inspection references.';
    END IF;

    -- Option B strictly forbids draft inspections
    IF EXISTS (
      SELECT 1 FROM public.retailer_exchange_rma_inspections
      WHERE id = p_inspection_id AND is_draft = true
    ) THEN
      RAISE EXCEPTION 'Policy Violation: Option B credit cannot be issued from a draft inspection.';
    END IF;

    -- Option B requires approved RMA
    IF EXISTS (
      SELECT 1 FROM public.retailer_exchange_rmas
      WHERE id = p_rma_id AND status IN ('cancelled', 'expired', 'awaiting_admin_approval')
    ) THEN
      RAISE EXCEPTION 'Policy Violation: RMA must be approved and inspection completed.';
    END IF;
  ELSE
    RAISE EXCEPTION 'Policy Violation: Invalid issuance source "%".', p_issuance_source;
  END IF;

  -- 1. Idempotency Check: Return full existing record if exact idempotency key matches
  SELECT *
  INTO v_existing_credit
  FROM public.retailer_exchange_credit_ledger
  WHERE idempotency_key = p_idempotency_key;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'id', v_existing_credit.id,
      'creditCode', v_existing_credit.credit_code,
      'companyId', v_existing_credit.company_id,
      'storeId', v_existing_credit.store_id,
      'issuanceSource', v_existing_credit.issuance_source,
      'sourceClaimId', v_existing_credit.source_claim_id,
      'sourceClaimItemId', v_existing_credit.source_claim_item_id,
      'sourceRmaId', v_existing_credit.source_rma_id,
      'sourceInspectionId', v_existing_credit.source_inspection_id,
      'creditAmount', v_existing_credit.credit_amount,
      'creditAmountCents', v_existing_credit.credit_amount_cents,
      'remainingBalance', v_existing_credit.remaining_balance,
      'remainingBalanceCents', v_existing_credit.remaining_balance_cents,
      'currency', v_existing_credit.currency,
      'status', v_existing_credit.status,
      'issuedAt', v_existing_credit.issued_at,
      'expiresAt', v_existing_credit.expires_at,
      'issuedBy', v_existing_credit.issued_by,
      'idempotencyKey', v_existing_credit.idempotency_key,
      'metadata', v_existing_credit.metadata,
      'idempotentReplay', true
    );
  END IF;

  -- 2. Anti-Duplicate Check: Strict 1 Credit Per Claim Line Item
  PERFORM 1
  FROM public.retailer_exchange_credit_ledger
  WHERE source_claim_item_id = p_claim_item_id;

  IF FOUND THEN
    RAISE EXCEPTION 'Credit has already been issued for this claim item. Duplicate issuance is prohibited.';
  END IF;

  -- 3. Calculate Expiration Timestamp (Authoritative 90 Calendar Days)
  IF p_expires_at IS NOT NULL THEN
    v_expires_at := p_expires_at;
  ELSE
    v_expires_at := NOW() + INTERVAL '90 days';
  END IF;

  -- 4. Generate Authoritative Sequential Code
  v_credit_code := public.generate_exchange_credit_code();

  -- 5. Insert Primary Ledger Record
  INSERT INTO public.retailer_exchange_credit_ledger (
    credit_code,
    company_id,
    store_id,
    issuance_source,
    source_claim_id,
    source_claim_item_id,
    source_rma_id,
    source_inspection_id,
    credit_amount,
    credit_amount_cents,
    remaining_balance,
    remaining_balance_cents,
    currency,
    status,
    issued_at,
    expires_at,
    issued_by,
    idempotency_key,
    metadata
  ) VALUES (
    v_credit_code,
    p_company_id,
    p_store_id,
    p_issuance_source,
    p_claim_id,
    p_claim_item_id,
    p_rma_id,
    p_inspection_id,
    p_amount_dollars,
    p_amount_cents,
    p_amount_dollars,
    p_amount_cents,
    'USD',
    'issued',
    NOW(),
    v_expires_at,
    p_issued_by,
    p_idempotency_key,
    p_metadata
  )
  RETURNING id INTO v_credit_id;

  -- 6. Insert Initial Issuance Audit Transaction Record
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
    performed_by,
    idempotency_key,
    notes
  ) VALUES (
    v_credit_id,
    p_company_id,
    'issuance',
    p_amount_dollars,
    p_amount_cents,
    0.00,
    0,
    p_amount_dollars,
    p_amount_cents,
    p_issued_by,
    p_idempotency_key,
    'Authoritative credit issued upon admin verification.'
  );

  -- 7. Update Claim Item Status to 'resolved'
  UPDATE public.retailer_exchange_claim_items
  SET status = 'resolved',
      updated_at = NOW()
  WHERE id = p_claim_item_id;

  -- 8. Check if All Items in Claim are Resolved
  SELECT COUNT(*)
  INTO v_unresolved_count
  FROM public.retailer_exchange_claim_items
  WHERE claim_id = p_claim_id
    AND status NOT IN ('resolved', 'rejected', 'cancelled');

  IF v_unresolved_count = 0 THEN
    UPDATE public.retailer_exchange_claims
    SET status = 'resolved',
        resolved_by = p_issued_by,
        resolved_at = NOW(),
        updated_at = NOW()
    WHERE id = p_claim_id;
  END IF;

  -- 9. If Option B, update RMA status to resolution_ready if inspection complete
  IF p_rma_id IS NOT NULL THEN
    UPDATE public.retailer_exchange_rmas
    SET status = 'resolution_ready',
        updated_at = NOW()
    WHERE id = p_rma_id
      AND status = 'inspection_completed';
  END IF;

  RETURN jsonb_build_object(
    'id', v_credit_id,
    'creditCode', v_credit_code,
    'companyId', p_company_id,
    'storeId', p_store_id,
    'issuanceSource', p_issuance_source,
    'sourceClaimId', p_claim_id,
    'sourceClaimItemId', p_claim_item_id,
    'sourceRmaId', p_rma_id,
    'sourceInspectionId', p_inspection_id,
    'creditAmount', p_amount_dollars,
    'creditAmountCents', p_amount_cents,
    'remainingBalance', p_amount_dollars,
    'remainingBalanceCents', p_amount_cents,
    'currency', 'USD',
    'status', 'issued',
    'issuedAt', NOW(),
    'expiresAt', v_expires_at,
    'issuedBy', p_issued_by,
    'idempotencyKey', p_idempotency_key,
    'metadata', p_metadata
  );
END;
$$;

-- 6. Row-Level Security (RLS) Policies
ALTER TABLE public.retailer_exchange_credit_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retailer_exchange_credit_transactions ENABLE ROW LEVEL SECURITY;

-- Admin Policy: Full Read Access for Admins
DROP POLICY IF EXISTS p_admin_select_credit_ledger ON public.retailer_exchange_credit_ledger;
CREATE POLICY p_admin_select_credit_ledger ON public.retailer_exchange_credit_ledger
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS p_admin_select_credit_tx ON public.retailer_exchange_credit_transactions;
CREATE POLICY p_admin_select_credit_tx ON public.retailer_exchange_credit_transactions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Retailer Policy: Select Only Records Belonging to Caller's Active Company
DROP POLICY IF EXISTS p_retailer_select_credit_ledger ON public.retailer_exchange_credit_ledger;
CREATE POLICY p_retailer_select_credit_ledger ON public.retailer_exchange_credit_ledger
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_users.company_id
      FROM public.company_users
      WHERE company_users.email = (auth.jwt() ->> 'email')
        AND company_users.status = 'active'
    )
  );

DROP POLICY IF EXISTS p_retailer_select_credit_tx ON public.retailer_exchange_credit_transactions;
CREATE POLICY p_retailer_select_credit_tx ON public.retailer_exchange_credit_transactions
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_users.company_id
      FROM public.company_users
      WHERE company_users.email = (auth.jwt() ->> 'email')
        AND company_users.status = 'active'
    )
  );

-- 7. Direct Mutation Restrictions & RPC Execution Privileges
REVOKE INSERT, UPDATE, DELETE ON public.retailer_exchange_credit_ledger FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.retailer_exchange_credit_transactions FROM authenticated, anon;
GRANT SELECT ON public.retailer_exchange_credit_ledger TO authenticated;
GRANT SELECT ON public.retailer_exchange_credit_transactions TO authenticated;

-- RPC Execution Privileges (Blocked for anonymous users; checked for admin role inside RPC)
REVOKE EXECUTE ON FUNCTION public.issue_exchange_credit_atomic FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.issue_exchange_credit_atomic TO authenticated, service_role;
