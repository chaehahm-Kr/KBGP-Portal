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

-- Revoke all permissions from anon, authenticated, and service_role to ensure clean least-privilege baseline
REVOKE ALL ON public.marketing_suppression_audit_log FROM anon, authenticated, service_role;

-- Grant SELECT only to authenticated users (filtered by RLS)
GRANT SELECT ON public.marketing_suppression_audit_log TO authenticated;

-- Grant minimum required privileges to trusted server-side service_role (strictly append-only: SELECT, INSERT only)
GRANT SELECT, INSERT ON public.marketing_suppression_audit_log TO service_role;

-- RLS Policy: Authenticated users can only read audit logs if they are verified Admin
-- Uses canonical public.auth_is_admin() from 0002_companies.sql
DROP POLICY IF EXISTS "suppression_audit_admin_read" ON public.marketing_suppression_audit_log;
CREATE POLICY "suppression_audit_admin_read"
  ON public.marketing_suppression_audit_log
  FOR SELECT
  TO authenticated
  USING (public.auth_is_admin());

-- ------------------------------------------------------------------------------
-- 5. ATOMIC TRANSACTIONAL FUNCTION: fn_release_marketing_suppression
-- Ensures suppression status release and audit log insertion execute in a single
-- atomic PostgreSQL transaction. Restricted strictly to trusted service_role.
-- Direct execution by authenticated browser clients is strictly prohibited.
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_release_marketing_suppression(
  p_id UUID,
  p_email TEXT,
  p_release_reason TEXT,
  p_release_evidence TEXT,
  p_evidence_type TEXT,
  p_policy_validation_notes TEXT DEFAULT NULL,
  p_released_by TEXT DEFAULT 'admin',
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_rec RECORD;
  v_now TIMESTAMPTZ := now();
  v_normalized_email TEXT := lower(trim(p_email));
  v_audit_id UUID;
  v_valid_types TEXT[] := ARRAY[
    'WRITTEN_CONSENT_EMAIL',
    'CUSTOMER_PORTAL_REQUEST',
    'SUPPORT_TICKET',
    'PHONE_VERIFICATION',
    'ADMIN_ERROR_CORRECTION',
    'INTERNAL_TESTING'
  ];
BEGIN
  -- 1. Authorization check: strictly restrict to trusted server-side execution (service_role or superuser)
  IF current_user != 'service_role' AND current_user != 'postgres' AND auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized: fn_release_marketing_suppression can only be executed via trusted server-side service_role path';
  END IF;

  -- 2. Input validation (defense-in-depth at DB engine level)
  IF p_release_reason IS NULL OR length(trim(p_release_reason)) < 5 THEN
    RAISE EXCEPTION '유효하지 않은 해제 사유입니다. 구체적인 사유를 최소 5자 이상 기술해주세요.';
  END IF;

  IF p_evidence_type IS NULL OR NOT (p_evidence_type = ANY(v_valid_types)) THEN
    RAISE EXCEPTION '유효한 소명 증빙 유형(Evidence Type)을 지정해야 합니다.';
  END IF;

  IF p_release_evidence IS NULL OR length(trim(p_release_evidence)) < 5 THEN
    RAISE EXCEPTION '소명 증빙 근거를 최소 5자 이상 상세히 입력해주세요.';
  END IF;

  -- 3. Lock and fetch target suppression record
  SELECT * INTO v_rec
  FROM public.marketing_suppression_list
  WHERE id = p_id AND lower(email) = v_normalized_email
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '해제 대상 수신 거부 레코드를 찾을 수 없습니다. (ID: %)', p_id;
  END IF;

  IF v_rec.status = 'RELEASED' THEN
    RAISE EXCEPTION '이미 안전 해제 처리된 이메일 주소입니다. (ID: %)', p_id;
  END IF;

  -- 4. Elevated policy validation check for BOUNCED or COMPLAINT records inside DB
  IF upper(coalesce(v_rec.reason, '')) IN ('BOUNCED', 'COMPLAINT') THEN
    IF p_policy_validation_notes IS NULL OR length(trim(p_policy_validation_notes)) < 10 THEN
      RAISE EXCEPTION '영구 반송/스팸 신고 해제 시 메일박스 정상화 확인 및 재발송 타당성에 관한 10자 이상의 상세 정책 소명이 필수입니다.';
    END IF;
  END IF;

  -- 5. Update suppression record to RELEASED
  UPDATE public.marketing_suppression_list
  SET
    status = 'RELEASED',
    released_at = v_now,
    released_by = p_released_by,
    release_reason = p_release_reason,
    release_evidence = p_release_evidence,
    evidence_type = p_evidence_type,
    policy_validation_notes = p_policy_validation_notes
  WHERE id = p_id;

  -- 6. Append immutable audit log entry in the SAME atomic transaction
  INSERT INTO public.marketing_suppression_audit_log (
    suppression_id,
    email,
    action,
    previous_status,
    new_status,
    suppression_reason,
    release_reason,
    release_evidence,
    evidence_type,
    policy_validation_notes,
    performed_by,
    performed_at,
    ip_address,
    user_agent
  ) VALUES (
    v_rec.id,
    v_normalized_email,
    'RELEASE',
    v_rec.status,
    'RELEASED',
    v_rec.reason,
    p_release_reason,
    p_release_evidence,
    p_evidence_type,
    p_policy_validation_notes,
    p_released_by,
    v_now,
    p_ip_address,
    p_user_agent
  ) RETURNING id INTO v_audit_id;

  -- 7. Return JSONB payload with updated data
  RETURN jsonb_build_object(
    'id', v_rec.id,
    'email', v_normalized_email,
    'status', 'RELEASED',
    'released_at', v_now,
    'released_by', p_released_by,
    'release_reason', p_release_reason,
    'release_evidence', p_release_evidence,
    'evidence_type', p_evidence_type,
    'policy_validation_notes', p_policy_validation_notes,
    'audit_log_id', v_audit_id
  );
END;
$$;

-- Revoke execute from all public/client roles; grant strictly to trusted service_role
REVOKE ALL ON FUNCTION public.fn_release_marketing_suppression FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_release_marketing_suppression TO service_role;
