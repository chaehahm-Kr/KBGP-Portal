-- ==============================================================================
-- Migration 0104: Retailer Initial Trial Protection Foundation
-- Task ID: RTP-PRT-001
-- Description:
-- 1. Creates retailer_initial_trial_protections for 90-Day Initial Trial Protection
-- 2. Enforces strict unique constraint on (company_id, product_id)
-- 3. Enables RLS with company-level tenant isolation
-- 4. Seeds realistic test protection scenarios for K SELECT Test Retailer
-- ==============================================================================

-- 1. Table: retailer_initial_trial_protections
CREATE TABLE IF NOT EXISTS public.retailer_initial_trial_protections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  trial_start_date date NOT NULL DEFAULT CURRENT_DATE,
  trial_end_date date NOT NULL DEFAULT (CURRENT_DATE + interval '90 days')::date,
  protected_quantity integer NOT NULL CHECK (protected_quantity > 0),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('pending_start', 'active', 'threshold_met', 'review_available', 'review_requested', 'needs_review', 'closed')),
  activation_source text NOT NULL DEFAULT 'initial_order' CHECK (activation_source IN ('initial_order', 'manual_admin', 'confirmed_delivery', 'test_seed')),
  source_order_id uuid REFERENCES public.retailer_orders(id) ON DELETE SET NULL,
  source_delivery_reference text,
  review_requested_at timestamptz,
  review_requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  review_notes text,
  is_test boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_retailer_trial_protection_company_product UNIQUE (company_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_retailer_trial_prot_company 
  ON public.retailer_initial_trial_protections(company_id);

CREATE INDEX IF NOT EXISTS idx_retailer_trial_prot_product 
  ON public.retailer_initial_trial_protections(product_id);

CREATE INDEX IF NOT EXISTS idx_retailer_trial_prot_status 
  ON public.retailer_initial_trial_protections(status);

-- 2. Enable RLS
ALTER TABLE public.retailer_initial_trial_protections ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
-- Retailer users can view their own company's protection records
DROP POLICY IF EXISTS "Retailers can view own company trial protections" ON public.retailer_initial_trial_protections;
CREATE POLICY "Retailers can view own company trial protections"
  ON public.retailer_initial_trial_protections
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM public.company_users WHERE id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
    OR auth.role() = 'service_role'
  );

-- Retailer users (Owner/Buyer) can request review on eligible records
DROP POLICY IF EXISTS "Retailers can update review request for own company protections" ON public.retailer_initial_trial_protections;
CREATE POLICY "Retailers can update review request for own company protections"
  ON public.retailer_initial_trial_protections
  FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM public.company_users WHERE id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
    OR auth.role() = 'service_role'
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.company_users WHERE id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
    OR auth.role() = 'service_role'
  );

-- Service role & Admin can manage all protection records
DROP POLICY IF EXISTS "Service role manages trial protections" ON public.retailer_initial_trial_protections;
CREATE POLICY "Service role manages trial protections"
  ON public.retailer_initial_trial_protections
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
    OR auth.role() = 'service_role'
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
    OR auth.role() = 'service_role'
  );

-- 4. Seed Deterministic Trial Scenarios for K SELECT Test Retailer
-- Company ID: dc9249be-a9e0-4975-a4c9-b602bb2baa47
-- Scenario A: TEST-SKN-001 (Active Trial, Day ~35 of 90)
INSERT INTO public.retailer_initial_trial_protections (
  company_id,
  product_id,
  trial_start_date,
  trial_end_date,
  protected_quantity,
  status,
  activation_source,
  is_test
)
SELECT
  'dc9249be-a9e0-4975-a4c9-b602bb2baa47'::uuid,
  p.id,
  (CURRENT_DATE - interval '35 days')::date,
  (CURRENT_DATE - interval '35 days' + interval '90 days')::date,
  36,
  'active',
  'test_seed',
  true
FROM public.products p
WHERE p.letusto_sku = 'TEST-SKN-001'
ON CONFLICT (company_id, product_id) DO UPDATE SET
  trial_start_date = EXCLUDED.trial_start_date,
  trial_end_date = EXCLUDED.trial_end_date,
  protected_quantity = EXCLUDED.protected_quantity,
  status = EXCLUDED.status,
  is_test = EXCLUDED.is_test,
  updated_at = now();

-- Scenario B: TEST-SKN-002 (Threshold Met, 67% sold, Day ~45 of 90)
INSERT INTO public.retailer_initial_trial_protections (
  company_id,
  product_id,
  trial_start_date,
  trial_end_date,
  protected_quantity,
  status,
  activation_source,
  is_test
)
SELECT
  'dc9249be-a9e0-4975-a4c9-b602bb2baa47'::uuid,
  p.id,
  (CURRENT_DATE - interval '45 days')::date,
  (CURRENT_DATE - interval '45 days' + interval '90 days')::date,
  36,
  'threshold_met',
  'test_seed',
  true
FROM public.products p
WHERE p.letusto_sku = 'TEST-SKN-002'
ON CONFLICT (company_id, product_id) DO UPDATE SET
  trial_start_date = EXCLUDED.trial_start_date,
  trial_end_date = EXCLUDED.trial_end_date,
  protected_quantity = EXCLUDED.protected_quantity,
  status = EXCLUDED.status,
  is_test = EXCLUDED.is_test,
  updated_at = now();

-- Scenario C: TEST-SKN-003 (Review Available, Day 95, 29% sold < 50%)
INSERT INTO public.retailer_initial_trial_protections (
  company_id,
  product_id,
  trial_start_date,
  trial_end_date,
  protected_quantity,
  status,
  activation_source,
  is_test
)
SELECT
  'dc9249be-a9e0-4975-a4c9-b602bb2baa47'::uuid,
  p.id,
  (CURRENT_DATE - interval '95 days')::date,
  (CURRENT_DATE - interval '95 days' + interval '90 days')::date,
  48,
  'review_available',
  'test_seed',
  true
FROM public.products p
WHERE p.letusto_sku = 'TEST-SKN-003'
ON CONFLICT (company_id, product_id) DO UPDATE SET
  trial_start_date = EXCLUDED.trial_start_date,
  trial_end_date = EXCLUDED.trial_end_date,
  protected_quantity = EXCLUDED.protected_quantity,
  status = EXCLUDED.status,
  is_test = EXCLUDED.is_test,
  updated_at = now();

-- Scenario D: TEST-CLN-001 (Active Trial, Day ~15 of 90)
INSERT INTO public.retailer_initial_trial_protections (
  company_id,
  product_id,
  trial_start_date,
  trial_end_date,
  protected_quantity,
  status,
  activation_source,
  is_test
)
SELECT
  'dc9249be-a9e0-4975-a4c9-b602bb2baa47'::uuid,
  p.id,
  (CURRENT_DATE - interval '15 days')::date,
  (CURRENT_DATE - interval '15 days' + interval '90 days')::date,
  48,
  'active',
  'test_seed',
  true
FROM public.products p
WHERE p.letusto_sku = 'TEST-CLN-001'
ON CONFLICT (company_id, product_id) DO UPDATE SET
  trial_start_date = EXCLUDED.trial_start_date,
  trial_end_date = EXCLUDED.trial_end_date,
  protected_quantity = EXCLUDED.protected_quantity,
  status = EXCLUDED.status,
  is_test = EXCLUDED.is_test,
  updated_at = now();

-- Scenario E: TEST-HAR-001 (Review Requested, Day 92)
INSERT INTO public.retailer_initial_trial_protections (
  company_id,
  product_id,
  trial_start_date,
  trial_end_date,
  protected_quantity,
  status,
  activation_source,
  review_requested_at,
  is_test
)
SELECT
  'dc9249be-a9e0-4975-a4c9-b602bb2baa47'::uuid,
  p.id,
  (CURRENT_DATE - interval '92 days')::date,
  (CURRENT_DATE - interval '92 days' + interval '90 days')::date,
  24,
  'review_requested',
  'test_seed',
  (now() - interval '2 days'),
  true
FROM public.products p
WHERE p.letusto_sku = 'TEST-HAR-001'
ON CONFLICT (company_id, product_id) DO UPDATE SET
  trial_start_date = EXCLUDED.trial_start_date,
  trial_end_date = EXCLUDED.trial_end_date,
  protected_quantity = EXCLUDED.protected_quantity,
  status = EXCLUDED.status,
  review_requested_at = EXCLUDED.review_requested_at,
  is_test = EXCLUDED.is_test,
  updated_at = now();

-- Scenario F: TEST-TRD-001 (Active Trial, Day ~20 of 90)
INSERT INTO public.retailer_initial_trial_protections (
  company_id,
  product_id,
  trial_start_date,
  trial_end_date,
  protected_quantity,
  status,
  activation_source,
  is_test
)
SELECT
  'dc9249be-a9e0-4975-a4c9-b602bb2baa47'::uuid,
  p.id,
  (CURRENT_DATE - interval '20 days')::date,
  (CURRENT_DATE - interval '20 days' + interval '90 days')::date,
  48,
  'active',
  'test_seed',
  true
FROM public.products p
WHERE p.letusto_sku = 'TEST-TRD-001'
ON CONFLICT (company_id, product_id) DO UPDATE SET
  trial_start_date = EXCLUDED.trial_start_date,
  trial_end_date = EXCLUDED.trial_end_date,
  protected_quantity = EXCLUDED.protected_quantity,
  status = EXCLUDED.status,
  is_test = EXCLUDED.is_test,
  updated_at = now();
