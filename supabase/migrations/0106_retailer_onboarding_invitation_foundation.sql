-- ==============================================================================
-- Migration 0106: Retailer Onboarding, Team Invitation & Store Access Foundation
-- Task ID: RTP-ONB-001
-- Description:
-- 1. Creates retailer_invitations for secure, single-use hashed token team invitations
-- 2. Creates retailer_agreement_acceptances for lightweight auditable terms acceptance
-- 3. Enables strict RLS with company-level isolation for Retailers and full access for Admins
-- ==============================================================================

-- 1. Table: retailer_invitations
CREATE TABLE IF NOT EXISTS public.retailer_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  email text NOT NULL,
  invited_name text,
  role text NOT NULL CHECK (role IN ('owner', 'buyer', 'store_manager', 'employee', 'accounting')),
  has_all_stores_access boolean NOT NULL DEFAULT false,
  store_ids uuid[] DEFAULT '{}',
  token_hash text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  expires_at timestamptz NOT NULL,
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_at timestamptz,
  accepted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  email_delivery_status text NOT NULL DEFAULT 'sent' CHECK (email_delivery_status IN ('sent', 'failed', 'skipped')),
  is_test boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.retailer_invitations ADD COLUMN IF NOT EXISTS invited_name text;

CREATE INDEX IF NOT EXISTS idx_retailer_invitations_company_id 
  ON public.retailer_invitations(company_id);

CREATE INDEX IF NOT EXISTS idx_retailer_invitations_email 
  ON public.retailer_invitations(email);

CREATE INDEX IF NOT EXISTS idx_retailer_invitations_token_hash 
  ON public.retailer_invitations(token_hash);

CREATE INDEX IF NOT EXISTS idx_retailer_invitations_status 
  ON public.retailer_invitations(status);

-- 2. Table: retailer_agreement_acceptances
CREATE TABLE IF NOT EXISTS public.retailer_agreement_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agreement_type text NOT NULL DEFAULT 'retailer_terms_v1',
  agreement_version text NOT NULL DEFAULT '1.0',
  accepted_name text,
  accepted_ip text,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_retailer_agreement_company_user_version UNIQUE (company_id, user_id, agreement_version)
);

CREATE INDEX IF NOT EXISTS idx_retailer_agreements_company_user 
  ON public.retailer_agreement_acceptances(company_id, user_id);

-- 3. Enable RLS
ALTER TABLE public.retailer_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retailer_agreement_acceptances ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for retailer_invitations
DROP POLICY IF EXISTS "Retailers can view own company invitations" ON public.retailer_invitations;
CREATE POLICY "Retailers can view own company invitations"
  ON public.retailer_invitations
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

DROP POLICY IF EXISTS "Retailer owners and Admins can manage invitations" ON public.retailer_invitations;
CREATE POLICY "Retailer owners and Admins can manage invitations"
  ON public.retailer_invitations
  FOR ALL
  TO authenticated
  USING (
    (
      company_id IN (
        SELECT company_id FROM public.company_users WHERE id = auth.uid()
      )
      AND EXISTS (
        SELECT 1 FROM public.retailer_user_roles rur 
        WHERE rur.user_id = auth.uid() 
          AND rur.company_id = retailer_invitations.company_id 
          AND rur.role IN ('owner', 'buyer')
      )
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
    OR auth.role() = 'service_role'
  )
  WITH CHECK (
    (
      company_id IN (
        SELECT company_id FROM public.company_users WHERE id = auth.uid()
      )
      AND EXISTS (
        SELECT 1 FROM public.retailer_user_roles rur 
        WHERE rur.user_id = auth.uid() 
          AND rur.company_id = retailer_invitations.company_id 
          AND rur.role IN ('owner', 'buyer')
      )
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
    OR auth.role() = 'service_role'
  );

-- 5. RLS Policies for retailer_agreement_acceptances
DROP POLICY IF EXISTS "Retailers can view own agreement acceptances" ON public.retailer_agreement_acceptances;
CREATE POLICY "Retailers can view own agreement acceptances"
  ON public.retailer_agreement_acceptances
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

DROP POLICY IF EXISTS "Retailers can insert own agreement acceptances" ON public.retailer_agreement_acceptances;
CREATE POLICY "Retailers can insert own agreement acceptances"
  ON public.retailer_agreement_acceptances
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
    OR auth.role() = 'service_role'
  );
