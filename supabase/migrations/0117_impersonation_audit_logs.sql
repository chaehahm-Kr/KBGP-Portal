-- Migration 0117: Secure Admin Impersonation Audit Logs (ADM-IMP-001)

CREATE TABLE IF NOT EXISTS public.impersonation_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  admin_user_id uuid NOT NULL,
  admin_email text NOT NULL,
  target_user_id uuid NOT NULL,
  target_user_email text NOT NULL,
  target_company_id uuid NOT NULL,
  target_company_name text NOT NULL,
  portal_type text NOT NULL, -- 'BRAND' | 'RETAILER'
  action text NOT NULL, -- 'IMPERSONATION_STARTED' | 'IMPERSONATION_ENDED'
  reason text NOT NULL,
  note text,
  exit_reason text, -- 'manual' | 'expired' | 'logout'
  duration_seconds integer,
  ip_address text,
  user_agent text,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_impersonation_logs_admin ON public.impersonation_audit_logs(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_impersonation_logs_target ON public.impersonation_audit_logs(target_user_id);
CREATE INDEX IF NOT EXISTS idx_impersonation_logs_company ON public.impersonation_audit_logs(target_company_id);
CREATE INDEX IF NOT EXISTS idx_impersonation_logs_session ON public.impersonation_audit_logs(session_id);
