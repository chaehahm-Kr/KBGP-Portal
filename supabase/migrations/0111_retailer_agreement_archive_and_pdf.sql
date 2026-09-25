-- ==============================================================================
-- Migration 0111: Retailer Agreement Versions, Document Archive & PDF Lifecycle
-- Task ID: RTP-AGR-001
-- Description:
-- 1. Creates public.retailer_agreement_versions for authoritative agreement text
-- 2. Extends public.retailer_agreement_acceptances with signer details, snapshot & PDF lifecycle
-- 3. Creates public.retailer_documents for secure organization document archive
-- 4. Establishes RLS policies for tenant isolation (Retailer own-company read, Admin full access)
-- ==============================================================================

-- 1. Table: retailer_agreement_versions
CREATE TABLE IF NOT EXISTS public.retailer_agreement_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text NOT NULL UNIQUE,
  title text NOT NULL,
  effective_date date NOT NULL DEFAULT CURRENT_DATE,
  content_text text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'draft')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_retailer_agreement_versions_status 
  ON public.retailer_agreement_versions(status);

COMMENT ON TABLE public.retailer_agreement_versions IS 
  '리테일러 파트너 약관 및 운영 표준 버전 관리 (RTP-AGR-001)';

-- Pre-seed Version 1.0 authoritative operating standards text
INSERT INTO public.retailer_agreement_versions (
  version,
  title,
  effective_date,
  content_text,
  status
) VALUES (
  '1.0',
  'K SELECT Retailer Partner Operating Standards & Agreement',
  '2026-09-01',
  'K SELECT RETAILER PARTNER OPERATING STANDARDS & AGREEMENT (v1.0)

ARTICLE 1: WEEKLY COUNT VERIFICATION & REPORTING
Retailer Partner agrees to perform accurate, defensible weekly inventory counts for all active K SELECT product assortments. Submissions must be completed using the Retailer Portal mobile QR scanner or shelf verification module on a weekly cadence. Timely reporting ensures accurate reorder recommendations, replenishment continuity, and protection eligibility.

ARTICLE 2: STORE PRICE & TAG INTEGRITY
Retailer Partner maintains full autonomy to establish store regular retail prices and promotional sale prices. Retailer agrees to display standardized K SELECT item price tags and preserve common product QR code links to ensure authentic customer transparency and brand integrity.

ARTICLE 3: 90-DAY INITIAL TRIAL PROTECTION
Eligible first-time brand assortments qualify for formal protection review when cumulative store sell-through remains below 50% over the 90-day trial period, provided all required weekly inventory checks were submitted consistently. Approved reviews may result in return authorization, assortment rebalancing, or credit adjustment.

ARTICLE 4: ACCOUNT, STORE ACCESS & TENANT CONFIDENTIALITY
Retailer Partner is responsible for maintaining the confidentiality and access privileges of all authorized company users, roles, and assigned store scopes. User accounts must not be shared outside the retailer organization. Commercial terms, wholesale pricing, and operational records remain strictly confidential between Retailer Partner and K SELECT NETWORK.',
  'active'
) ON CONFLICT (version) DO UPDATE SET
  title = EXCLUDED.title,
  content_text = EXCLUDED.content_text,
  status = EXCLUDED.status;

-- 2. Extend retailer_agreement_acceptances
ALTER TABLE public.retailer_agreement_acceptances
  ADD COLUMN IF NOT EXISTS signer_title text,
  ADD COLUMN IF NOT EXISTS signer_email text,
  ADD COLUMN IF NOT EXISTS agreement_snapshot text,
  ADD COLUMN IF NOT EXISTS pdf_status text NOT NULL DEFAULT 'pending' CHECK (pdf_status IN ('pending', 'generated', 'failed')),
  ADD COLUMN IF NOT EXISTS pdf_storage_path text,
  ADD COLUMN IF NOT EXISTS pdf_filename text,
  ADD COLUMN IF NOT EXISTS pdf_generated_at timestamptz,
  ADD COLUMN IF NOT EXISTS pdf_error text;

-- 3. Table: retailer_documents
CREATE TABLE IF NOT EXISTS public.retailer_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  document_type text NOT NULL, -- 'RETAILER_AGREEMENT', 'RESALE_CERTIFICATE', 'TAX_W9', 'OTHER'
  agreement_acceptance_id uuid REFERENCES public.retailer_agreement_acceptances(id) ON DELETE SET NULL,
  agreement_version text,
  title text NOT NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  mime_type text NOT NULL DEFAULT 'application/pdf',
  file_size_bytes bigint,
  signer_name text,
  signer_email text,
  signer_title text,
  accepted_at timestamptz,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'superseded')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_retailer_documents_company_id 
  ON public.retailer_documents(company_id);

CREATE INDEX IF NOT EXISTS idx_retailer_documents_type 
  ON public.retailer_documents(document_type);

CREATE INDEX IF NOT EXISTS idx_retailer_documents_acceptance_id 
  ON public.retailer_documents(agreement_acceptance_id);

COMMENT ON TABLE public.retailer_documents IS 
  '리테일러 기업별 계약서 및 서명 문서 영구 아카이브 (RTP-AGR-001)';

-- 4. Enable RLS
ALTER TABLE public.retailer_agreement_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retailer_documents ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for retailer_agreement_versions
DROP POLICY IF EXISTS "Authenticated users can view active agreement versions" ON public.retailer_agreement_versions;
CREATE POLICY "Authenticated users can view active agreement versions"
  ON public.retailer_agreement_versions
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can manage agreement versions" ON public.retailer_agreement_versions;
CREATE POLICY "Admins can manage agreement versions"
  ON public.retailer_agreement_versions
  FOR ALL
  TO authenticated
  USING (
    public.auth_is_admin()
    OR auth.role() = 'service_role'
  )
  WITH CHECK (
    public.auth_is_admin()
    OR auth.role() = 'service_role'
  );

-- 6. RLS Policies for retailer_documents
DROP POLICY IF EXISTS "Retailers can view own company documents" ON public.retailer_documents;
CREATE POLICY "Retailers can view own company documents"
  ON public.retailer_documents
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM public.company_users WHERE id = auth.uid()
    )
    OR public.auth_is_admin()
    OR auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS "Admins and service role can manage retailer documents" ON public.retailer_documents;
CREATE POLICY "Admins and service role can manage retailer documents"
  ON public.retailer_documents
  FOR ALL
  TO authenticated
  USING (
    public.auth_is_admin()
    OR auth.role() = 'service_role'
  )
  WITH CHECK (
    public.auth_is_admin()
    OR auth.role() = 'service_role'
  );

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
