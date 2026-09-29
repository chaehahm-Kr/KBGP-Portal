-- Migration 0125: Admin Direct Invitation Tokens, Activation Guards & Indexes

ALTER TABLE public.company_users 
  ADD COLUMN IF NOT EXISTS invitation_token_hash text,
  ADD COLUMN IF NOT EXISTS invitation_expires_at timestamptz;

COMMENT ON COLUMN public.company_users.invitation_token_hash IS 'SHA-256 hash of single-use secure brand invitation token';
COMMENT ON COLUMN public.company_users.invitation_expires_at IS 'Expiration timestamp for brand invitation link';

CREATE INDEX IF NOT EXISTS idx_company_users_email_lower ON public.company_users (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_applications_email_lower ON public.applications (LOWER(applicant_contact_email));
CREATE INDEX IF NOT EXISTS idx_company_users_invitation_token_hash ON public.company_users (invitation_token_hash) WHERE invitation_token_hash IS NOT NULL;
