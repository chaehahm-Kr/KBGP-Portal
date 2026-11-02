-- Migration: 0194_marketing_suppression_safe_release.sql
-- Task ID: ADM-EMAIL-SUP-002 (Hardened from ADM-EMAIL-SUP-001)
-- Description: Suppression List Safe Admin Release, Strict Least-Privilege Permissions & Append-Only Audit Log
-- Standards: DEPLOY-STD-001, CONCURRENT-DEV-001, DEV-SQL-MIGRATION-STD-001, AGENTS.md Rule 24
-- Mode: Additive schema change for QA / Staging ONLY. DO NOT APPLY TO PRODUCTION SUPABASE WITHOUT OWNER APPROVAL.

-- ------------------------------------------------------------------------------
-- 1. INDIVIDUALLY GUARDED ADDITIVE COLUMNS: marketing_suppression_list
-- ------------------------------------------------------------------------------

-- 1.1 Add status column (defaults to 'ACTIVE' for all existing data)
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

-- 1.2 Add released_at timestamp
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'marketing_suppression_list' 
      AND column_name = 'released_at'
  ) THEN
    ALTER TABLE public.marketing_suppression_list 
      ADD COLUMN released_at TIMESTAMPTZ;
  END IF;
END $$;

-- 1.3 Add released_by actor
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'marketing_suppression_list' 
      AND column_name = 'released_by'
  ) THEN
    ALTER TABLE public.marketing_suppression_list 
      ADD COLUMN released_by TEXT;
  END IF;
END $$;

-- 1.4 Add release_reason
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'marketing_suppression_list' 
      AND column_name = 'release_reason'
  ) THEN
    ALTER TABLE public.marketing_suppression_list 
      ADD COLUMN release_reason TEXT;
  END IF;
END $$;

-- 1.5 Add release_evidence
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'marketing_suppression_list' 
      AND column_name = 'release_evidence'
  ) THEN
    ALTER TABLE public.marketing_suppression_list 
      ADD COLUMN release_evidence TEXT;
  END IF;
END $$;

-- 1.6 Add evidence_type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'marketing_suppression_list' 
      AND column_name = 'evidence_type'
  ) THEN
    ALTER TABLE public.marketing_suppression_list 
      ADD COLUMN evidence_type VARCHAR(32) 
      CHECK (evidence_type IS NULL OR evidence_type IN (
        'WRITTEN_CONSENT_EMAIL',
        'CUSTOMER_PORTAL_REQUEST',
        'SUPPORT_TICKET',
        'PHONE_VERIFICATION',
        'ADMIN_ERROR_CORRECTION',
        'INTERNAL_TESTING'
      ));
  END IF;
END $$;

-- 1.7 Add policy_validation_notes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'marketing_suppression_list' 
      AND column_name = 'policy_validation_notes'
  ) THEN
    ALTER TABLE public.marketing_suppression_list 
      ADD COLUMN policy_validation_notes TEXT;
  END IF;
END $$;

-- 1.8 Idempotent composite index for efficient active suppression check
CREATE INDEX IF NOT EXISTS idx_marketing_suppression_status_email 
  ON public.marketing_suppression_list(status, email);

-- ------------------------------------------------------------------------------
-- 2. NEW AUDIT TABLE: marketing_suppression_audit_log (IMMUTABLE APPEND-ONLY)
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
  evidence_type VARCHAR(32),
  policy_validation_notes TEXT,
  performed_by TEXT NOT NULL,
  performed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address TEXT,
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_suppression_audit_email 
  ON public.marketing_suppression_audit_log(email);

CREATE INDEX IF NOT EXISTS idx_suppression_audit_performed_at 
  ON public.marketing_suppression_audit_log(performed_at DESC);

-- ------------------------------------------------------------------------------
-- 3. APPEND-ONLY IMMUTABILITY TRIGGER
-- Prevents UPDATE and DELETE on audit log records even by direct SQL
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.trg_fn_protect_marketing_suppression_audit_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'marketing_suppression_audit_log is an immutable append-only audit trail. UPDATE and DELETE operations are strictly prohibited.';
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_marketing_suppression_audit_log ON public.marketing_suppression_audit_log;
CREATE TRIGGER trg_protect_marketing_suppression_audit_log
  BEFORE UPDATE OR DELETE ON public.marketing_suppression_audit_log
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_protect_marketing_suppression_audit_log();

-- ------------------------------------------------------------------------------
-- 4. LEAST-PRIVILEGE SECURITY & ROW LEVEL SECURITY (RLS)
-- Direct client/authenticated INSERT is strictly prohibited.
-- Only trusted server-side execution (service_role) may append audit records.
-- ------------------------------------------------------------------------------

ALTER TABLE public.marketing_suppression_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_suppression_audit_log FORCE ROW LEVEL SECURITY;

-- Revoke all permissions from anon and authenticated users
REVOKE ALL ON public.marketing_suppression_audit_log FROM anon, authenticated;

-- Grant SELECT only to authenticated users (filtered by RLS)
GRANT SELECT ON public.marketing_suppression_audit_log TO authenticated;

-- Grant full access only to trusted server-side service_role
GRANT ALL ON public.marketing_suppression_audit_log TO service_role;

-- RLS Policy: Authenticated users can only read audit logs if they are verified Admin / Super Admin
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
