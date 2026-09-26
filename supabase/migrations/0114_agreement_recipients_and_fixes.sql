-- Migration 0114: Company Agreement Recipients & Distribution History
-- PORT-AGR-001-R1 / ADM-AGR-001-R1 / ADM-CASE-004-R1

CREATE TABLE IF NOT EXISTS public.company_agreement_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_agreement_id uuid NOT NULL REFERENCES public.company_agreements(id) ON DELETE CASCADE,
  agreement_id text NOT NULL,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  recipient_name text NOT NULL,
  recipient_title text NOT NULL,
  recipient_email text NOT NULL,
  recipient_type text NOT NULL DEFAULT 'additional_recipient', -- 'signer', 'additional_recipient'
  sent_at timestamptz DEFAULT now(),
  delivery_status text NOT NULL DEFAULT 'sent', -- 'pending', 'sent', 'failed'
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agreement_recipients_agreement ON public.company_agreement_recipients(company_agreement_id);
CREATE INDEX IF NOT EXISTS idx_agreement_recipients_company ON public.company_agreement_recipients(company_id);

ALTER TABLE public.company_agreement_recipients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own agreement recipients" ON public.company_agreement_recipients;
CREATE POLICY "Users can view own agreement recipients"
  ON public.company_agreement_recipients FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM public.company_users WHERE id = auth.uid()
    )
    OR public.auth_is_admin()
    OR auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS "Users can insert/manage own agreement recipients" ON public.company_agreement_recipients;
CREATE POLICY "Users can insert/manage own agreement recipients"
  ON public.company_agreement_recipients FOR ALL
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM public.company_users WHERE id = auth.uid()
    )
    OR public.auth_is_admin()
    OR auth.role() = 'service_role'
  );
