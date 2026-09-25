-- ==============================================================================
-- Migration 0110: Retailer Organization Management & Audit Logs Foundation
-- Task ID: RTP-ORG-001
-- Description:
-- 1. Creates public.retailer_organization_audit_logs to record organization changes
--    (Company, Store, User, Role, Store Access, Invitation actions)
-- 2. Enables strict RLS (Supervisory Admin full access, Retailer Owner/Buyer read for own company)
-- ==============================================================================

-- 1. Table: retailer_organization_audit_logs
CREATE TABLE IF NOT EXISTS public.retailer_organization_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  entity_type text NOT NULL, -- 'company', 'store', 'user', 'role', 'store_access', 'invitation'
  entity_id text NOT NULL,
  action text NOT NULL, -- 'create', 'update', 'status_change', 'role_change', 'store_access_change', 'invite', 'resend_invite', 'revoke_invite'
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_type text NOT NULL DEFAULT 'retailer', -- 'retailer', 'admin', 'system'
  old_data jsonb,
  new_data jsonb,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_retailer_org_audit_company_id 
  ON public.retailer_organization_audit_logs(company_id);

CREATE INDEX IF NOT EXISTS idx_retailer_org_audit_created_at 
  ON public.retailer_organization_audit_logs(created_at DESC);

COMMENT ON TABLE public.retailer_organization_audit_logs IS 
  '리테일러 기업, 매장, 팀원 권한 및 접근 제어 변경에 대한 통합 감사 로그 (RTP-ORG-001)';

-- 2. Enable RLS
ALTER TABLE public.retailer_organization_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retailer_organization_audit_logs FORCE ROW LEVEL SECURITY;

-- 3. RLS Policies
DROP POLICY IF EXISTS "retailer_org_audit_select_owner_admin" ON public.retailer_organization_audit_logs;
CREATE POLICY "retailer_org_audit_select_owner_admin"
  ON public.retailer_organization_audit_logs
  FOR SELECT
  TO authenticated
  USING (
    public.auth_is_admin()
    OR (
      company_id = public.auth_company_id()
      AND EXISTS (
        SELECT 1 FROM public.retailer_user_roles rur
        WHERE rur.user_id = auth.uid()
          AND rur.company_id = retailer_organization_audit_logs.company_id
          AND rur.role IN ('owner', 'buyer')
      )
    )
  );

DROP POLICY IF EXISTS "retailer_org_audit_insert" ON public.retailer_organization_audit_logs;
CREATE POLICY "retailer_org_audit_insert"
  ON public.retailer_organization_audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.auth_is_admin()
    OR company_id = public.auth_company_id()
  );

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
