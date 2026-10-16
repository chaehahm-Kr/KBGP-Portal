-- ==============================================================================
-- Migration: 0177_retailer_exchange_claims_backend.sql
-- Task ID: EXCHANGE-CREDIT-PH2-004
-- Description: Store-level 90-Day Exchange Credit Claim Schema, SKU Lines,
--              Audit Trail, Single-Claim Guarantee Indexes, and RLS Policies.
-- Safety: Non-destructive, idempotent, zero table resets.
-- Execution Mode: PREPARED FILE ONLY (DO NOT EXECUTE WITHOUT OWNER APPROVAL)
-- ==============================================================================

-- 1. Store-Level Exchange Claims Table
CREATE TABLE IF NOT EXISTS public.retailer_exchange_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_number TEXT NOT NULL UNIQUE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE RESTRICT,
  
  -- Lifecycle Status
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (
    status IN (
      'draft',
      'submitted',
      'under_review',
      'information_requested',
      'approved',
      'rejected',
      'cancelled',
      'awaiting_return',
      'inspection_pending',
      'resolved'
    )
  ),
  
  -- Summary Metrics
  total_items_count INT NOT NULL CHECK (total_items_count > 0),
  total_units_count INT NOT NULL CHECK (total_units_count > 0),
  total_option_a_units INT NOT NULL DEFAULT 0 CHECK (total_option_a_units >= 0),
  total_option_b_units INT NOT NULL DEFAULT 0 CHECK (total_option_b_units >= 0),
  
  -- Financial Estimates (Monetary Precision)
  estimated_credit_option_a NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (estimated_credit_option_a >= 0),
  estimated_credit_option_b NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (estimated_credit_option_b >= 0),
  total_estimated_credit NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (total_estimated_credit >= 0),
  final_credit_amount NUMERIC(12, 2) NULL CHECK (final_credit_amount >= 0),
  
  -- Retailer Reconfirmation Evidence
  stock_reconfirmed_by TEXT NOT NULL,
  stock_reconfirmed_at TIMESTAMPTZ NOT NULL,
  retailer_notes TEXT NULL,
  admin_notes TEXT NULL,
  
  -- User Audit & Timestamps
  submitted_by UUID NOT NULL REFERENCES auth.users(id),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_by UUID NULL REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ NULL,
  resolved_by UUID NULL REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ NULL,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Claim SKU Line Items Table
CREATE TABLE IF NOT EXISTS public.retailer_exchange_claim_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID NOT NULL REFERENCES public.retailer_exchange_claims(id) ON DELETE CASCADE,
  cohort_id UUID NOT NULL REFERENCES public.retailer_protected_supply_cohorts(id) ON DELETE RESTRICT,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE RESTRICT,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  
  -- Chosen Option
  selected_option TEXT NOT NULL CHECK (selected_option IN ('A', 'B')),
  
  -- Quantities & Authoritative Limits
  selected_quantity INT NOT NULL CHECK (selected_quantity > 0),
  max_claimable_quantity INT NOT NULL CHECK (max_claimable_quantity >= selected_quantity),
  
  -- Frozen Pricing & Rates
  frozen_unit_wholesale_price NUMERIC(12, 4) NOT NULL CHECK (frozen_unit_wholesale_price >= 0),
  frozen_credit_rate NUMERIC(6, 4) NOT NULL CHECK (frozen_credit_rate >= 0.20 AND frozen_credit_rate <= 1.00),
  estimated_credit_amount NUMERIC(12, 2) NOT NULL CHECK (estimated_credit_amount >= 0),
  
  -- Line-Level Status
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (
    status IN (
      'draft',
      'submitted',
      'under_review',
      'approved',
      'rejected',
      'cancelled',
      'awaiting_return',
      'inspection_pending',
      'resolved'
    )
  ),
  
  -- Frozen Day 100 Assessment Snapshot & Evidence Provenance
  day_100_snapshot JSONB NOT NULL,
  evidence_provenance JSONB NOT NULL,
  
  -- Option B Return Logistics Tracking
  return_tracking_number TEXT NULL,
  return_carrier TEXT NULL,
  return_shipped_at TIMESTAMPTZ NULL,
  return_delivered_at TIMESTAMPTZ NULL,
  
  -- Resolution & Inspection Evidence
  inspected_quantity INT NULL CHECK (inspected_quantity >= 0),
  final_credit_amount NUMERIC(12, 2) NULL CHECK (final_credit_amount >= 0),
  resolution_notes TEXT NULL,
  resolved_at TIMESTAMPTZ NULL,
  resolved_by UUID NULL REFERENCES auth.users(id),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Claim Audit & State Transition Logs
CREATE TABLE IF NOT EXISTS public.retailer_exchange_claim_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID NOT NULL REFERENCES public.retailer_exchange_claims(id) ON DELETE CASCADE,
  claim_item_id UUID NULL REFERENCES public.retailer_exchange_claim_items(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  performed_by UUID NOT NULL REFERENCES auth.users(id),
  old_status TEXT NULL,
  new_status TEXT NOT NULL,
  reason TEXT NULL,
  metadata JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 4. Single-Claim Guarantee & Performance Indexes
-- ==============================================================================

-- A. Authoritative Single-Claim Constraint per Protected Cohort
-- Only active/submitted/completed claims lock the cohort. Drafts and cancelled claims allow resubmission.
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_claim_cohort
  ON public.retailer_exchange_claim_items (cohort_id)
  WHERE status NOT IN ('draft', 'cancelled');

-- B. Fast lookup indexes
CREATE INDEX IF NOT EXISTS idx_exchange_claims_company_store
  ON public.retailer_exchange_claims (company_id, store_id);

CREATE INDEX IF NOT EXISTS idx_exchange_claims_status
  ON public.retailer_exchange_claims (status);

CREATE INDEX IF NOT EXISTS idx_exchange_claim_items_claim_id
  ON public.retailer_exchange_claim_items (claim_id);

CREATE INDEX IF NOT EXISTS idx_exchange_claim_items_product_id
  ON public.retailer_exchange_claim_items (product_id);

CREATE INDEX IF NOT EXISTS idx_exchange_claim_items_status
  ON public.retailer_exchange_claim_items (status);

CREATE INDEX IF NOT EXISTS idx_exchange_claim_audit_claim_id
  ON public.retailer_exchange_claim_audit_logs (claim_id);

-- ==============================================================================
-- 5. Row-Level Security (RLS) Policies
-- ==============================================================================

ALTER TABLE public.retailer_exchange_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retailer_exchange_claim_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retailer_exchange_claim_audit_logs ENABLE ROW LEVEL SECURITY;

-- Claims Table RLS:
-- Retailer: Company users can read and insert claims belonging to their company
DROP POLICY IF EXISTS "Retailers can read own company claims" ON public.retailer_exchange_claims;
CREATE POLICY "Retailers can read own company claims"
  ON public.retailer_exchange_claims
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM public.company_users WHERE user_id = auth.uid()
    )
    OR (auth.jwt() ->> 'email') LIKE '%@letusto.com'
    OR (auth.jwt() ->> 'email') LIKE '%@kselectnetwork.com'
  );

DROP POLICY IF EXISTS "Retailers can insert own company claims" ON public.retailer_exchange_claims;
CREATE POLICY "Retailers can insert own company claims"
  ON public.retailer_exchange_claims
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.company_users WHERE user_id = auth.uid()
    )
    OR (auth.jwt() ->> 'email') LIKE '%@letusto.com'
    OR (auth.jwt() ->> 'email') LIKE '%@kselectnetwork.com'
  );

DROP POLICY IF EXISTS "Admins have full access to exchange claims" ON public.retailer_exchange_claims;
CREATE POLICY "Admins have full access to exchange claims"
  ON public.retailer_exchange_claims
  FOR ALL
  TO authenticated
  USING (
    (auth.jwt() ->> 'email') LIKE '%@letusto.com'
    OR (auth.jwt() ->> 'email') LIKE '%@kselectnetwork.com'
  );

-- Claim Items Table RLS:
DROP POLICY IF EXISTS "Retailers can read own company claim items" ON public.retailer_exchange_claim_items;
CREATE POLICY "Retailers can read own company claim items"
  ON public.retailer_exchange_claim_items
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM public.company_users WHERE user_id = auth.uid()
    )
    OR (auth.jwt() ->> 'email') LIKE '%@letusto.com'
    OR (auth.jwt() ->> 'email') LIKE '%@kselectnetwork.com'
  );

DROP POLICY IF EXISTS "Retailers can insert own company claim items" ON public.retailer_exchange_claim_items;
CREATE POLICY "Retailers can insert own company claim items"
  ON public.retailer_exchange_claim_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.company_users WHERE user_id = auth.uid()
    )
    OR (auth.jwt() ->> 'email') LIKE '%@letusto.com'
    OR (auth.jwt() ->> 'email') LIKE '%@kselectnetwork.com'
  );

DROP POLICY IF EXISTS "Admins have full access to claim items" ON public.retailer_exchange_claim_items;
CREATE POLICY "Admins have full access to claim items"
  ON public.retailer_exchange_claim_items
  FOR ALL
  TO authenticated
  USING (
    (auth.jwt() ->> 'email') LIKE '%@letusto.com'
    OR (auth.jwt() ->> 'email') LIKE '%@kselectnetwork.com'
  );

-- Audit Logs Table RLS:
DROP POLICY IF EXISTS "Users can read own company claim audit logs" ON public.retailer_exchange_claim_audit_logs;
CREATE POLICY "Users can read own company claim audit logs"
  ON public.retailer_exchange_claim_audit_logs
  FOR SELECT
  TO authenticated
  USING (
    claim_id IN (
      SELECT id FROM public.retailer_exchange_claims WHERE company_id IN (
        SELECT company_id FROM public.company_users WHERE user_id = auth.uid()
      )
    )
    OR (auth.jwt() ->> 'email') LIKE '%@letusto.com'
    OR (auth.jwt() ->> 'email') LIKE '%@kselectnetwork.com'
  );

DROP POLICY IF EXISTS "Admins have full access to audit logs" ON public.retailer_exchange_claim_audit_logs;
CREATE POLICY "Admins have full access to audit logs"
  ON public.retailer_exchange_claim_audit_logs
  FOR ALL
  TO authenticated
  USING (
    (auth.jwt() ->> 'email') LIKE '%@letusto.com'
    OR (auth.jwt() ->> 'email') LIKE '%@kselectnetwork.com'
  );
