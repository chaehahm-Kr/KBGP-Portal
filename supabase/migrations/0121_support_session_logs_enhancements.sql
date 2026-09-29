-- Migration 0121: Enhance Impersonation Audit Logs for Support Session Logs (ADM-IMP-002)

ALTER TABLE public.impersonation_audit_logs 
  ADD COLUMN IF NOT EXISTS admin_name text,
  ADD COLUMN IF NOT EXISTS target_user_name text,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_impersonation_logs_started_at ON public.impersonation_audit_logs(started_at DESC);
