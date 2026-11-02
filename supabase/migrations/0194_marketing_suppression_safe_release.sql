-- Migration: 0194_marketing_suppression_safe_release.sql
-- Task ID: ADM-EMAIL-SUP-001
-- Description: Suppression List Safe Admin Release & Immutable Audit Log Schema
-- Standards: DEPLOY-STD-001, CONCURRENT-DEV-001, DEV-SQL-MIGRATION-STD-001, AGENTS.md Rule 24
-- Mode: Additive schema change for QA / Staging. DO NOT APPLY TO PRODUCTION SUPABASE WITHOUT OWNER APPROVAL.

-- ------------------------------------------------------------------------------
-- 1. ADDITIVE COLUMNS: marketing_suppression_list
-- ------------------------------------------------------------------------------

-- 1.1 Add status column to marketing_suppression_list (Defaults to 'ACTIVE' for existing records)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'marketing_suppression_list' 
      AND column_name = 'status'
  ) THEN
    ALTER TABLE public.marketing_suppression_list 
      ADD COLUMN status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE' 
      CHECK (status IN ('ACTIVE', 'RELEASED'));
  END IF;
END $$;

-- 1.2 Add release audit metadata columns to marketing_suppression_list
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'marketing_suppression_list' 
      AND column_name = 'released_at'
  ) THEN
    ALTER TABLE public.marketing_suppression_list 
      ADD COLUMN released_at TIMESTAMPTZ,
      ADD COLUMN released_by TEXT,
      ADD COLUMN release_reason TEXT,
      ADD COLUMN release_evidence TEXT,
      ADD COLUMN policy_validation_notes TEXT;
  END IF;
END $$;

-- 1.3 Create composite index for efficient active suppression lookup
CREATE INDEX IF NOT EXISTS idx_marketing_suppression_status_email 
  ON public.marketing_suppression_list(status, email);

-- ------------------------------------------------------------------------------
-- 2. NEW AUDIT TABLE: marketing_suppression_audit_log
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.marketing_suppression_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suppression_id UUID REFERENCES public.marketing_suppression_list(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  action VARCHAR(32) NOT NULL CHECK (action IN ('SUPPRESS', 'RELEASE', 'REACTIVATE')),
  previous_status VARCHAR(16),
  new_status VARCHAR(16) NOT NULL,
  suppression_reason VARCHAR(32),
  release_reason TEXT,
  release_evidence TEXT,
  policy_validation_notes TEXT,
  performed_by TEXT NOT NULL,
  performed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address TEXT,
  user_agent TEXT
);

-- Indexes for audit lookup and reporting
CREATE INDEX IF NOT EXISTS idx_suppression_audit_email 
  ON public.marketing_suppression_audit_log(email);

CREATE INDEX IF NOT EXISTS idx_suppression_audit_performed_at 
  ON public.marketing_suppression_audit_log(performed_at DESC);

-- ------------------------------------------------------------------------------
-- 3. PERMISSIONS & ROW LEVEL SECURITY (RLS)
-- ------------------------------------------------------------------------------

ALTER TABLE public.marketing_suppression_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_suppression_audit_log FORCE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON public.marketing_suppression_audit_log TO authenticated, service_role;
REVOKE ALL ON public.marketing_suppression_audit_log FROM anon;

DROP POLICY IF EXISTS "suppression_audit_admin_read" ON public.marketing_suppression_audit_log;
CREATE POLICY "suppression_audit_admin_read"
  ON public.marketing_suppression_audit_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE admin_users.id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.company_users
      WHERE company_users.user_id = auth.uid()
        AND company_users.role = 'SUPER_ADMIN'
    )
  );

DROP POLICY IF EXISTS "suppression_audit_admin_insert" ON public.marketing_suppression_audit_log;
CREATE POLICY "suppression_audit_admin_insert"
  ON public.marketing_suppression_audit_log
  FOR INSERT
  TO authenticated, service_role
  WITH CHECK (true);
