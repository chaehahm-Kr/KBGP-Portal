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
  -- Ensure interest_status column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sourcing_companies' AND column_name = 'interest_status'
  ) THEN
    ALTER TABLE public.sourcing_companies
      ADD COLUMN interest_status VARCHAR(32) NOT NULL DEFAULT 'UNKNOWN';
  END IF;

  -- Ensure CHECK constraint exists even if column already existed
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_sourcing_companies_interest_status'
      AND conrelid = 'public.sourcing_companies'::regclass
  ) THEN
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
-- interest changes, staff notes, and follow-up completions.
-- Retains activity history by enforcing ON DELETE RESTRICT on company_id.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sourcing_company_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.sourcing_companies(id) ON DELETE RESTRICT,
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

-- Ensure foreign key constraint on company_id is ON DELETE RESTRICT even if table existed
DO $$
DECLARE
  v_conname TEXT;
  v_deltype CHAR;
BEGIN
  SELECT conname, confdeltype INTO v_conname, v_deltype
  FROM pg_constraint
  WHERE conrelid = 'public.sourcing_company_activities'::regclass
    AND contype = 'f'
    AND conkey = ARRAY[(
      SELECT attnum FROM pg_attribute
      WHERE attrelid = 'public.sourcing_company_activities'::regclass
        AND attname = 'company_id'
    )];

  IF v_conname IS NOT NULL AND v_deltype <> 'r' THEN
    EXECUTE format('ALTER TABLE public.sourcing_company_activities DROP CONSTRAINT %I', v_conname);
    ALTER TABLE public.sourcing_company_activities
      ADD CONSTRAINT sourcing_company_activities_company_id_fkey
      FOREIGN KEY (company_id) REFERENCES public.sourcing_companies(id) ON DELETE RESTRICT;
  ELSIF v_conname IS NULL THEN
    ALTER TABLE public.sourcing_company_activities
      ADD CONSTRAINT sourcing_company_activities_company_id_fkey
      FOREIGN KEY (company_id) REFERENCES public.sourcing_companies(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- Ensure foreign key constraint on campaign_id is ON DELETE SET NULL even if table existed
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.sourcing_company_activities'::regclass
      AND conname = 'sourcing_company_activities_campaign_id_fkey'
  ) THEN
    ALTER TABLE public.sourcing_company_activities
      ADD CONSTRAINT sourcing_company_activities_campaign_id_fkey
      FOREIGN KEY (campaign_id) REFERENCES public.marketing_campaigns(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Ensure foreign key constraint on recipient_id is ON DELETE SET NULL even if table existed
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.sourcing_company_activities'::regclass
      AND conname = 'sourcing_company_activities_recipient_id_fkey'
  ) THEN
    ALTER TABLE public.sourcing_company_activities
      ADD CONSTRAINT sourcing_company_activities_recipient_id_fkey
      FOREIGN KEY (recipient_id) REFERENCES public.marketing_campaign_recipients(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 3. INDEXES
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_sourcing_companies_interest ON public.sourcing_companies(interest_status);
CREATE INDEX IF NOT EXISTS idx_sourcing_companies_followup_date ON public.sourcing_companies(next_followup_date);
CREATE INDEX IF NOT EXISTS idx_sourcing_company_activities_cid ON public.sourcing_company_activities(company_id);
CREATE INDEX IF NOT EXISTS idx_sourcing_company_activities_camp ON public.sourcing_company_activities(campaign_id);
CREATE INDEX IF NOT EXISTS idx_sourcing_company_activities_created ON public.sourcing_company_activities(created_at DESC);

-- ------------------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY (RLS) & APPEND-ONLY PRIVILEGES
-- Explicitly revoke destructive permissions; only allow SELECT & INSERT
-- ------------------------------------------------------------------------------
GRANT SELECT, INSERT ON public.sourcing_company_activities TO authenticated, service_role;
REVOKE UPDATE, DELETE, TRUNCATE ON public.sourcing_company_activities FROM authenticated, service_role, anon, public;
REVOKE ALL ON public.sourcing_company_activities FROM anon;

ALTER TABLE public.sourcing_company_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sourcing_company_activities FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sourcing_company_activities_admin_all" ON public.sourcing_company_activities;
DROP POLICY IF EXISTS "sourcing_company_activities_admin_select" ON public.sourcing_company_activities;
DROP POLICY IF EXISTS "sourcing_company_activities_admin_insert" ON public.sourcing_company_activities;

CREATE POLICY "sourcing_company_activities_admin_select"
  ON public.sourcing_company_activities
  FOR SELECT
  TO authenticated
  USING (public.auth_is_admin());

CREATE POLICY "sourcing_company_activities_admin_insert"
  ON public.sourcing_company_activities
  FOR INSERT
  TO authenticated
  WITH CHECK (public.auth_is_admin());

-- ------------------------------------------------------------------------------
-- 5. APPEND-ONLY IMMUTABILITY TRIGGER (ALIGNED WITH MIGRATION 0185)
-- Blocks UPDATE and DELETE unconditionally regardless of application role
-- ------------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_prevent_sourcing_company_activities_modification ON public.sourcing_company_activities;
DROP FUNCTION IF EXISTS public.prevent_sourcing_company_activities_modification();

CREATE OR REPLACE FUNCTION public.trg_fn_protect_sourcing_company_activities()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'sourcing_company_activities is an append-only audit log. UPDATE and DELETE operations are strictly prohibited.';
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_sourcing_company_activities ON public.sourcing_company_activities;
CREATE TRIGGER trg_protect_sourcing_company_activities
  BEFORE UPDATE OR DELETE ON public.sourcing_company_activities
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_protect_sourcing_company_activities();

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
