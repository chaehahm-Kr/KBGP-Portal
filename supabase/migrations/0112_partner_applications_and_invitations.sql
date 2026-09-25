-- Migration 0112: Unified Brand & Retailer Application + Admin Invitation Workflow
-- Task ID: ADM-APP-001
-- Description:
-- 1. Adds partner_type ('brand' | 'retailer') and entry_mode ('public_application' | 'admin_invitation') to public.applications
-- 2. Adds applicant info columns (company name, contact name, email, phone, address, notes) to support pure intake records
-- 3. Makes company_id and created_by nullable in public.applications so public applications can be persisted before company creation
-- 4. Adds invitation_id and onboarded_company_id linkage columns

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS partner_type text NOT NULL DEFAULT 'brand' CHECK (partner_type IN ('brand', 'retailer')),
  ADD COLUMN IF NOT EXISTS entry_mode text NOT NULL DEFAULT 'public_application' CHECK (entry_mode IN ('public_application', 'admin_invitation')),
  ADD COLUMN IF NOT EXISTS applicant_company_name text,
  ADD COLUMN IF NOT EXISTS applicant_contact_name text,
  ADD COLUMN IF NOT EXISTS applicant_contact_email text,
  ADD COLUMN IF NOT EXISTS applicant_contact_phone text,
  ADD COLUMN IF NOT EXISTS applicant_address jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS review_notes text,
  ADD COLUMN IF NOT EXISTS invitation_id uuid,
  ADD COLUMN IF NOT EXISTS onboarded_company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL;

-- Allow company_id and created_by to be NULL for pre-approval public applications
ALTER TABLE public.applications ALTER COLUMN company_id DROP NOT NULL;
ALTER TABLE public.applications ALTER COLUMN created_by DROP NOT NULL;

-- Update status check constraint if needed to include invitation_sent, onboarding, onboarded
ALTER TABLE public.applications DROP CONSTRAINT IF EXISTS applications_status_check;
ALTER TABLE public.applications ADD CONSTRAINT applications_status_check CHECK (
  status IN (
    'draft', 'submitted', 'assigned', 'under_review', 'info_requested',
    're_review', 'partial_approved', 'approved', 'invitation_sent',
    'onboarding', 'onboarded', 'on_hold', 'rejected', 'cancelled', 'deleted'
  )
);

CREATE INDEX IF NOT EXISTS idx_applications_partner_type ON public.applications(partner_type);
CREATE INDEX IF NOT EXISTS idx_applications_entry_mode ON public.applications(entry_mode);
CREATE INDEX IF NOT EXISTS idx_applications_onboarded_company_id ON public.applications(onboarded_company_id);
