-- ==============================================================================
-- Migration: 0178_repair_exchange_claims_rls_and_atomicity.sql
-- Task ID: EXCHANGE-CREDIT-PH2-005-R1
-- Description: Repair 90-Day Exchange Claims RLS Policies (use canonical
--              public.auth_company_id() / public.auth_is_admin()) and introduce
--              an atomic submission stored procedure for ACID guarantee.
-- Safety: Non-destructive, idempotent, preserves all existing tables and rows.
-- Execution Mode: PREPARED FILE ONLY (REQUIRES OWNER REVIEW & APPROVAL)
-- ==============================================================================

-- 1. Ensure RLS is enabled on all 3 tables
ALTER TABLE public.retailer_exchange_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retailer_exchange_claim_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retailer_exchange_claim_audit_logs ENABLE ROW LEVEL SECURITY;

-- 2. Drop legacy / flawed policies if they exist
DROP POLICY IF EXISTS "Retailers can read own company claims" ON public.retailer_exchange_claims;
DROP POLICY IF EXISTS "Retailers can insert own company claims" ON public.retailer_exchange_claims;
DROP POLICY IF EXISTS "Admins have full access to exchange claims" ON public.retailer_exchange_claims;

DROP POLICY IF EXISTS "Retailers can read own company claim items" ON public.retailer_exchange_claim_items;
DROP POLICY IF EXISTS "Retailers can insert own company claim items" ON public.retailer_exchange_claim_items;
DROP POLICY IF EXISTS "Admins have full access to claim items" ON public.retailer_exchange_claim_items;

DROP POLICY IF EXISTS "Users can read own company claim audit logs" ON public.retailer_exchange_claim_audit_logs;
DROP POLICY IF EXISTS "Users can insert own company claim audit logs" ON public.retailer_exchange_claim_audit_logs;
DROP POLICY IF EXISTS "Admins have full access to audit logs" ON public.retailer_exchange_claim_audit_logs;

-- 3. Recreate Canonical RLS Policies using public.auth_company_id() & public.auth_is_admin()

-- 3.1 Claims Table Policies
CREATE POLICY "Retailers can read own company claims"
  ON public.retailer_exchange_claims
  FOR SELECT
  TO authenticated
  USING (
    company_id = public.auth_company_id()
    OR public.auth_is_admin()
  );

CREATE POLICY "Retailers can insert own company claims"
  ON public.retailer_exchange_claims
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = public.auth_company_id()
    OR public.auth_is_admin()
  );

CREATE POLICY "Admins have full access to exchange claims"
  ON public.retailer_exchange_claims
  FOR ALL
  TO authenticated
  USING (public.auth_is_admin());

-- 3.2 Claim Items Table Policies
CREATE POLICY "Retailers can read own company claim items"
  ON public.retailer_exchange_claim_items
  FOR SELECT
  TO authenticated
  USING (
    company_id = public.auth_company_id()
    OR public.auth_is_admin()
  );

CREATE POLICY "Retailers can insert own company claim items"
  ON public.retailer_exchange_claim_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = public.auth_company_id()
    OR public.auth_is_admin()
  );

CREATE POLICY "Admins have full access to claim items"
  ON public.retailer_exchange_claim_items
  FOR ALL
  TO authenticated
  USING (public.auth_is_admin());

-- 3.3 Audit Logs Table Policies
CREATE POLICY "Users can read own company claim audit logs"
  ON public.retailer_exchange_claim_audit_logs
  FOR SELECT
  TO authenticated
  USING (
    claim_id IN (
      SELECT id FROM public.retailer_exchange_claims WHERE company_id = public.auth_company_id()
    )
    OR public.auth_is_admin()
  );

CREATE POLICY "Users can insert own company claim audit logs"
  ON public.retailer_exchange_claim_audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    claim_id IN (
      SELECT id FROM public.retailer_exchange_claims WHERE company_id = public.auth_company_id()
    )
    OR public.auth_is_admin()
  );

CREATE POLICY "Admins have full access to audit logs"
  ON public.retailer_exchange_claim_audit_logs
  FOR ALL
  TO authenticated
  USING (public.auth_is_admin());

-- 4. Atomic Stored Procedure for ACID Claim Submission
-- This guarantees header + items + audit log write in a single PostgreSQL transaction.
-- If any item violates uq_active_claim_cohort, the entire transaction rolls back automatically.
CREATE OR REPLACE FUNCTION public.submit_exchange_claim_atomic(
  p_claim_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_company_id UUID;
  v_store_id UUID;
  v_store_company_id UUID;
  v_claim_id UUID;
  v_claim_number TEXT;
  v_item JSONB;
  v_result JSONB;
BEGIN
  v_user_id := COALESCE(auth.uid(), (p_claim_payload->>'user_id')::UUID);
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: User must be authenticated';
  END IF;

  v_company_id := (p_claim_payload->>'company_id')::UUID;
  v_store_id := (p_claim_payload->>'store_id')::UUID;
  v_claim_number := p_claim_payload->>'claim_number';

  -- 1. Authorization Verification
  IF NOT public.auth_is_admin() THEN
    IF v_company_id <> public.auth_company_id() THEN
      RAISE EXCEPTION 'FORBIDDEN: You do not have access to this company';
    END IF;
  END IF;

  -- 2. Verify Store belongs to Company
  SELECT company_id INTO v_store_company_id
  FROM public.stores
  WHERE id = v_store_id;

  IF v_store_company_id IS NULL OR v_store_company_id <> v_company_id THEN
    RAISE EXCEPTION 'FORBIDDEN: Store does not belong to your company';
  END IF;

  -- 3. Insert Claim Header
  INSERT INTO public.retailer_exchange_claims (
    claim_number,
    company_id,
    store_id,
    status,
    total_items_count,
    total_units_count,
    total_option_a_units,
    total_option_b_units,
    estimated_credit_option_a,
    estimated_credit_option_b,
    total_estimated_credit,
    stock_reconfirmed_by,
    stock_reconfirmed_at,
    retailer_notes,
    submitted_by,
    submitted_at
  ) VALUES (
    v_claim_number,
    v_company_id,
    v_store_id,
    'submitted',
    (p_claim_payload->>'total_items_count')::INT,
    (p_claim_payload->>'total_units_count')::INT,
    COALESCE((p_claim_payload->>'total_option_a_units')::INT, 0),
    COALESCE((p_claim_payload->>'total_option_b_units')::INT, 0),
    COALESCE((p_claim_payload->>'estimated_credit_option_a')::NUMERIC, 0.00),
    COALESCE((p_claim_payload->>'estimated_credit_option_b')::NUMERIC, 0.00),
    COALESCE((p_claim_payload->>'total_estimated_credit')::NUMERIC, 0.00),
    p_claim_payload->>'stock_reconfirmed_by',
    COALESCE((p_claim_payload->>'stock_reconfirmed_at')::TIMESTAMPTZ, NOW()),
    p_claim_payload->>'retailer_notes',
    v_user_id,
    NOW()
  )
  RETURNING id INTO v_claim_id;

  -- 4. Insert Items (One-by-one; uq_active_claim_cohort triggers rollback on duplicate)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_claim_payload->'items')
  LOOP
    INSERT INTO public.retailer_exchange_claim_items (
      claim_id,
      cohort_id,
      product_id,
      store_id,
      company_id,
      selected_option,
      selected_quantity,
      max_claimable_quantity,
      frozen_unit_wholesale_price,
      frozen_credit_rate,
      estimated_credit_amount,
      status,
      day_100_snapshot,
      evidence_provenance
    ) VALUES (
      v_claim_id,
      (v_item->>'cohort_id')::UUID,
      (v_item->>'product_id')::UUID,
      v_store_id,
      v_company_id,
      v_item->>'selected_option',
      (v_item->>'selected_quantity')::INT,
      (v_item->>'max_claimable_quantity')::INT,
      (v_item->>'frozen_unit_wholesale_price')::NUMERIC,
      (v_item->>'frozen_credit_rate')::NUMERIC,
      (v_item->>'estimated_credit_amount')::NUMERIC,
      'submitted',
      COALESCE(v_item->'day_100_snapshot', '{}'::JSONB),
      COALESCE(v_item->'evidence_provenance', '{}'::JSONB)
    );
  END LOOP;

  -- 5. Insert Audit Log
  INSERT INTO public.retailer_exchange_claim_audit_logs (
    claim_id,
    action,
    performed_by,
    old_status,
    new_status,
    reason
  ) VALUES (
    v_claim_id,
    'submit_claim',
    v_user_id,
    NULL,
    'submitted',
    '리테일러 포털에서 90일 교환 크레딧 신청 제출 완료 (Atomic RPC)'
  );

  v_result := jsonb_build_object(
    'success', true,
    'claim_id', v_claim_id,
    'claim_number', v_claim_number,
    'status', 'submitted'
  );

  RETURN v_result;
END;
$$;
