-- ==============================================================================
-- Migration 0105: Retailer Protection Review & Resolution Foundation
-- Task ID: RTP-PRT-002
-- Description:
-- 1. Creates retailer_protection_resolutions for auditable Admin review & decision records
-- 2. Expands retailer_initial_trial_protections status check constraint
-- 3. Enables strict RLS with company-level isolation for Retailers and full access for Admins
-- 4. Seeds test review records for K SELECT Test Retailer
-- ==============================================================================

-- 1. Expand status check constraint on retailer_initial_trial_protections
ALTER TABLE public.retailer_initial_trial_protections 
  DROP CONSTRAINT IF EXISTS retailer_initial_trial_protections_status_check;

ALTER TABLE public.retailer_initial_trial_protections 
  ADD CONSTRAINT retailer_initial_trial_protections_status_check 
  CHECK (status IN ('pending_start', 'active', 'threshold_met', 'review_available', 'review_requested', 'needs_review', 'needs_information', 'approved', 'rejected', 'closed'));

-- 2. Table: retailer_protection_resolutions
CREATE TABLE IF NOT EXISTS public.retailer_protection_resolutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  protection_id uuid NOT NULL REFERENCES public.retailer_initial_trial_protections(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  requested_at timestamptz NOT NULL DEFAULT now(),
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  request_notes text,
  decision text NOT NULL DEFAULT 'pending' CHECK (decision IN ('pending', 'needs_information', 'approved', 'rejected')),
  decision_at timestamptz,
  decision_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  decision_notes text,
  approved_quantity integer CHECK (approved_quantity >= 0),
  approved_credit_amount numeric(10, 2) CHECK (approved_credit_amount >= 0),
  credit_processing_status text NOT NULL DEFAULT 'pending' CHECK (credit_processing_status IN ('not_applicable', 'pending', 'issued')),
  is_test boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_protection_resolutions_protection UNIQUE (protection_id)
);

CREATE INDEX IF NOT EXISTS idx_prot_resolutions_protection_id 
  ON public.retailer_protection_resolutions(protection_id);

CREATE INDEX IF NOT EXISTS idx_prot_resolutions_company_id 
  ON public.retailer_protection_resolutions(company_id);

CREATE INDEX IF NOT EXISTS idx_prot_resolutions_product_id 
  ON public.retailer_protection_resolutions(product_id);

CREATE INDEX IF NOT EXISTS idx_prot_resolutions_decision 
  ON public.retailer_protection_resolutions(decision);

CREATE INDEX IF NOT EXISTS idx_prot_resolutions_created_at 
  ON public.retailer_protection_resolutions(created_at DESC);

-- 3. Enable RLS
ALTER TABLE public.retailer_protection_resolutions ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
-- SELECT Policy: Retailers can view their own company's resolutions; Admins and Service Role can view all
DROP POLICY IF EXISTS "Retailers can view own company protection resolutions" ON public.retailer_protection_resolutions;
CREATE POLICY "Retailers can view own company protection resolutions"
  ON public.retailer_protection_resolutions
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

-- INSERT Policy: Retailers can submit new review requests (pending only) or Admins can insert
DROP POLICY IF EXISTS "Retailers can submit protection review requests" ON public.retailer_protection_resolutions;
CREATE POLICY "Retailers can submit protection review requests"
  ON public.retailer_protection_resolutions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (
      company_id IN (
        SELECT company_id FROM public.company_users WHERE id = auth.uid()
      )
      AND decision = 'pending'
      AND approved_quantity IS NULL
      AND approved_credit_amount IS NULL
      AND decision_by IS NULL
      AND decision_at IS NULL
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
    OR auth.role() = 'service_role'
  );

-- UPDATE Policy: Admin/Service role can update decisions and resolutions
DROP POLICY IF EXISTS "Admins can update protection review decisions" ON public.retailer_protection_resolutions;
CREATE POLICY "Admins can update protection review decisions"
  ON public.retailer_protection_resolutions
  FOR UPDATE
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

-- 5. Seed Test Review Record for TEST-HAR-001 (K SELECT Test Retailer)
INSERT INTO public.retailer_protection_resolutions (
  protection_id,
  company_id,
  product_id,
  requested_at,
  request_notes,
  decision,
  credit_processing_status,
  is_test
)
SELECT
  tp.id,
  tp.company_id,
  tp.product_id,
  now() - interval '2 days',
  'Staff reported customer interest in scent and formula, but velocity remained at 33% after 90 days across store shelves. Submitting for K SELECT trial review.',
  'pending',
  'pending',
  true
FROM public.retailer_initial_trial_protections tp
JOIN public.products p ON p.id = tp.product_id
WHERE tp.company_id = 'dc9249be-a9e0-4975-a4c9-b602bb2baa47'
  AND p.letusto_sku = 'TEST-HAR-001'
ON CONFLICT DO NOTHING;
