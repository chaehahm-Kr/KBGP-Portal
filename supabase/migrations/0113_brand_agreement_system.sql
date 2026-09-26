-- Migration 0113: Brand Agreement System Architecture
-- ADM-AGR-001 / PORT-AGR-001 / PORT-DASH-002 / ADM-CASE-004

-- 1. Table: public.agreement_templates
CREATE TABLE IF NOT EXISTS public.agreement_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  version text NOT NULL,
  status text NOT NULL DEFAULT 'active', -- 'draft', 'active', 'archived'
  source_pdf_path text NOT NULL DEFAULT 'agreements/template_v1.pdf',
  letusto_signer_name text NOT NULL DEFAULT 'Chae Hahm',
  letusto_signer_title text NOT NULL DEFAULT 'CEO',
  letusto_company_name text NOT NULL DEFAULT 'Letusto Inc.',
  letusto_address text NOT NULL DEFAULT '23B Roland Ave. Mount Laurel NJ 08054 USA',
  initial_term_years integer NOT NULL DEFAULT 2,
  renewal_term_years integer NOT NULL DEFAULT 2,
  non_renewal_notice_days integer NOT NULL DEFAULT 90,
  activated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT uq_agreement_template_name_version UNIQUE (name, version)
);

CREATE INDEX IF NOT EXISTS idx_agreement_templates_status ON public.agreement_templates(status);

COMMENT ON TABLE public.agreement_templates IS 'Authoritative Agreement Templates for K SELECT NETWORK Brand Supply & Distribution';

-- Seed Agreement Template Version 1.0 (Active)
INSERT INTO public.agreement_templates (
  name,
  version,
  status,
  source_pdf_path,
  letusto_signer_name,
  letusto_signer_title,
  letusto_company_name,
  letusto_address,
  initial_term_years,
  renewal_term_years,
  non_renewal_notice_days,
  activated_at
) VALUES (
  'Brand Supply, U.S. Distribution & Platform Agreement (Non-Exclusive)',
  '1.0',
  'active',
  'agreements/template_v1.pdf',
  'Chae Hahm',
  'CEO',
  'Letusto Inc.',
  '23B Roland Ave. Mount Laurel NJ 08054 USA',
  2,
  2,
  90,
  now()
) ON CONFLICT (name, version) DO NOTHING;

-- 2. Sequence for immutable Agreement ID (KSN-AGR-YYYY-XXXXXX)
CREATE SEQUENCE IF NOT EXISTS public.company_agreement_seq START 1;

-- Function to generate immutable Agreement ID
CREATE OR REPLACE FUNCTION public.generate_agreement_id()
RETURNS text AS $$
DECLARE
  seq_val bigint;
  year_val text;
BEGIN
  seq_val := nextval('public.company_agreement_seq');
  year_val := to_char(now(), 'YYYY');
  RETURN 'KSN-AGR-' || year_val || '-' || lpad(seq_val::text, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- 3. Table: public.company_agreements
CREATE TABLE IF NOT EXISTS public.company_agreements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agreement_id text NOT NULL UNIQUE DEFAULT public.generate_agreement_id(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES public.agreement_templates(id),
  version text NOT NULL DEFAULT '1.0',
  status text NOT NULL DEFAULT 'pending', -- 'pending', 'active', 're_signature_required', 'expired', 'terminated', 'superseded'
  signer_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  signer_name text,
  signer_title text,
  signer_email text,
  authority_confirmed boolean DEFAULT false,
  authority_confirmed_at timestamptz,
  consent_to_agreement boolean DEFAULT false,
  consent_to_e_signature boolean DEFAULT false,
  signed_at timestamptz,
  effective_date date,
  expiration_date date,
  next_renewal_date date,
  non_renewal_notice_deadline date,
  final_pdf_path text,
  final_pdf_hash text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT uq_company_agreement_company_version UNIQUE (company_id, version)
);

CREATE INDEX IF NOT EXISTS idx_company_agreements_company ON public.company_agreements(company_id);
CREATE INDEX IF NOT EXISTS idx_company_agreements_status ON public.company_agreements(status);
CREATE INDEX IF NOT EXISTS idx_company_agreements_id_str ON public.company_agreements(agreement_id);

COMMENT ON TABLE public.company_agreements IS 'Company Agreement Records & Signatures for Brand Companies';

-- 4. Table: public.agreement_audit_logs
CREATE TABLE IF NOT EXISTS public.agreement_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_agreement_id uuid NOT NULL REFERENCES public.company_agreements(id) ON DELETE CASCADE,
  agreement_id text NOT NULL,
  action text NOT NULL, -- 'CREATED', 'VIEWED', 'SIGNED', 'PDF_GENERATED', 'REMINDER_SENT', 'CHANGE_REQUESTED'
  performed_by_user_id uuid,
  performed_by_name text,
  performed_by_email text,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agreement_audit_logs_agreement ON public.agreement_audit_logs(company_agreement_id);

-- 5. RLS Policies
ALTER TABLE public.agreement_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agreement_audit_logs ENABLE ROW LEVEL SECURITY;

-- Templates
DROP POLICY IF EXISTS "Authenticated users can view active agreement templates" ON public.agreement_templates;
CREATE POLICY "Authenticated users can view active agreement templates"
  ON public.agreement_templates FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can manage agreement templates" ON public.agreement_templates;
CREATE POLICY "Admins can manage agreement templates"
  ON public.agreement_templates FOR ALL
  TO authenticated
  USING (
    public.auth_is_admin()
    OR auth.role() = 'service_role'
  );

-- Company Agreements
DROP POLICY IF EXISTS "Users can view own company agreements" ON public.company_agreements;
CREATE POLICY "Users can view own company agreements"
  ON public.company_agreements FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM public.company_users WHERE id = auth.uid()
    )
    OR public.auth_is_admin()
    OR auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS "Users can insert/update own company agreements" ON public.company_agreements;
CREATE POLICY "Users can insert/update own company agreements"
  ON public.company_agreements FOR ALL
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM public.company_users WHERE id = auth.uid()
    )
    OR public.auth_is_admin()
    OR auth.role() = 'service_role'
  );

-- Audit Logs
DROP POLICY IF EXISTS "Users can view own agreement audit logs" ON public.agreement_audit_logs;
CREATE POLICY "Users can view own agreement audit logs"
  ON public.agreement_audit_logs FOR SELECT
  TO authenticated
  USING (
    company_agreement_id IN (
      SELECT ca.id FROM public.company_agreements ca
      WHERE ca.company_id IN (
        SELECT company_id FROM public.company_users WHERE id = auth.uid()
      )
    )
    OR public.auth_is_admin()
    OR auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS "Users can insert agreement audit logs" ON public.agreement_audit_logs;
CREATE POLICY "Users can insert agreement audit logs"
  ON public.agreement_audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);
