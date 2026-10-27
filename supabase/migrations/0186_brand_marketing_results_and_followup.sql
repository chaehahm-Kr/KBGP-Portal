-- Migration: 0186_brand_marketing_results_and_followup.sql
-- Task ID: ADM-BSRC-007
-- Description: Brand Marketing Phase 2 — Campaign Results & Company Follow-up (Interest, Follow-up, Activity Timeline)
-- Standards: DEPLOY-STD-001, CONCURRENT-DEV-001, DEV-SQL-MIGRATION-STD-001, AGENTS.md Rule 27
-- Mode: Safe forward additive idempotent migration. Decoupled from core partner tables.

-- ------------------------------------------------------------------------------
-- 1. EXTEND TABLE: sourcing_companies
-- Add company-level interest status and follow-up management fields
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  -- Company interest status: UNKNOWN (default), INTERESTED, NOT_INTERESTED
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sourcing_companies' AND column_name = 'interest_status'
  ) THEN
    ALTER TABLE public.sourcing_companies
      ADD COLUMN interest_status VARCHAR(32) NOT NULL DEFAULT 'UNKNOWN';
    
    ALTER TABLE public.sourcing_companies
      ADD CONSTRAINT chk_sourcing_companies_interest_status
      CHECK (interest_status IN ('UNKNOWN', 'INTERESTED', 'NOT_INTERESTED'));
  END IF;

  -- Next follow-up date
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sourcing_companies' AND column_name = 'next_followup_date'
  ) THEN
    ALTER TABLE public.sourcing_companies
      ADD COLUMN next_followup_date DATE;
  END IF;

  -- Follow-up note
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sourcing_companies' AND column_name = 'followup_note'
  ) THEN
    ALTER TABLE public.sourcing_companies
      ADD COLUMN followup_note TEXT;
  END IF;

  -- Follow-up completed timestamp
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sourcing_companies' AND column_name = 'followup_completed_at'
  ) THEN
    ALTER TABLE public.sourcing_companies
      ADD COLUMN followup_completed_at TIMESTAMPTZ;
  END IF;

  -- Last contact date
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sourcing_companies' AND column_name = 'last_contact_date'
  ) THEN
    ALTER TABLE public.sourcing_companies
      ADD COLUMN last_contact_date TIMESTAMPTZ;
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 2. TABLE: sourcing_company_activities
-- Compact chronological activity timeline: email dispatches, delivery results,
-- interest changes, staff notes, and follow-up completions
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sourcing_company_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.sourcing_companies(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.marketing_campaigns(id) ON DELETE SET NULL,
  recipient_id UUID REFERENCES public.marketing_campaign_recipients(id) ON DELETE SET NULL,
  
  -- Activity Type Classification
  activity_type VARCHAR(64) NOT NULL CHECK (
    activity_type IN (
      'EMAIL_SENT',
      'EMAIL_DELIVERED',
      'EMAIL_FAILED',
      'EMAIL_BOUNCED',
      'EMAIL_CLICKED',
      'REPLY_RECORDED',
      'INTEREST_CHANGED',
      'FOLLOWUP_SCHEDULED',
      'FOLLOWUP_NOTE_UPDATED',
      'FOLLOWUP_COMPLETED',
      'MEETING_SCHEDULED',
      'PARTNER_CONVERTED'
    )
  ),
  
  summary TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  staff_email TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 3. INDEXES
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_sourcing_companies_interest ON public.sourcing_companies(interest_status);
CREATE INDEX IF NOT EXISTS idx_sourcing_companies_followup_date ON public.sourcing_companies(next_followup_date);
CREATE INDEX IF NOT EXISTS idx_sourcing_company_activities_cid ON public.sourcing_company_activities(company_id);
CREATE INDEX IF NOT EXISTS idx_sourcing_company_activities_camp ON public.sourcing_company_activities(campaign_id);
CREATE INDEX IF NOT EXISTS idx_sourcing_company_activities_created ON public.sourcing_company_activities(created_at DESC);

-- ------------------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY (RLS) & PRIVILEGES
-- ------------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sourcing_company_activities TO authenticated, service_role;
REVOKE ALL ON public.sourcing_company_activities FROM anon;

ALTER TABLE public.sourcing_company_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sourcing_company_activities FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sourcing_company_activities_admin_all" ON public.sourcing_company_activities;
CREATE POLICY "sourcing_company_activities_admin_all"
  ON public.sourcing_company_activities
  FOR ALL
  TO authenticated
  USING (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
