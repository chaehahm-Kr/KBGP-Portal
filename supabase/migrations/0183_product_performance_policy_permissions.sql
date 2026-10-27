-- Migration: 0183_product_performance_policy_permissions.sql
-- Task ID: ADM-SALES-PERF-005-R5
-- Description: Product Performance Policy System — Table-Level Grants, Role Permissions, and Restricted-Role RLS Hardening
-- Note: Idempotent forward migration applying table-level grants required for PostgREST / Supabase Client and restricted-role RBAC enforcement.

-- 1. Table-Level Privileges for Authenticated and Service Role
-- In PostgreSQL, table-level grants are prerequisites before Row Level Security (RLS) can be evaluated by PostgREST.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_performance_policies TO authenticated, service_role;
GRANT SELECT, INSERT ON public.product_performance_policy_audit_logs TO authenticated, service_role;
GRANT SELECT, INSERT ON public.product_performance_historical_evaluations TO authenticated, service_role;

-- 2. Explicit Revocations from Anonymous / Public Users
REVOKE ALL ON public.product_performance_policies FROM anon;
REVOKE ALL ON public.product_performance_policy_audit_logs FROM anon;
REVOKE ALL ON public.product_performance_historical_evaluations FROM anon;

REVOKE ALL ON FUNCTION public.publish_product_performance_policy_atomic(UUID, TEXT, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.publish_product_performance_policy_atomic(UUID, TEXT, UUID, TEXT) FROM anon;

-- 3. Stored Procedure Permissions
GRANT EXECUTE ON FUNCTION public.publish_product_performance_policy_atomic(UUID, TEXT, UUID, TEXT) TO authenticated, service_role;

-- 4. Re-affirm and Solidify Restricted-Role RLS Policies
-- Ensures direct table writes cannot bypass Owner-only policy transitions
DROP POLICY IF EXISTS "Admins and Staff can view policies" ON public.product_performance_policies;
CREATE POLICY "Admins and Staff can view policies"
ON public.product_performance_policies
FOR SELECT
TO authenticated
USING (public.auth_is_admin());

DROP POLICY IF EXISTS "Admins can insert draft policies" ON public.product_performance_policies;
CREATE POLICY "Admins can insert draft policies"
ON public.product_performance_policies
FOR INSERT
TO authenticated
WITH CHECK (
    public.auth_is_admin()
    AND status = 'draft'
    AND is_active = false
);

DROP POLICY IF EXISTS "Admins can update draft policies" ON public.product_performance_policies;
CREATE POLICY "Admins can update draft policies"
ON public.product_performance_policies
FOR UPDATE
TO authenticated
USING (
    public.auth_is_admin()
    AND (status = 'draft' OR public.auth_is_super_admin())
)
WITH CHECK (
    public.auth_is_admin()
    AND (
        (status = 'draft' AND is_active = false)
        OR public.auth_is_super_admin()
    )
);

-- Policies for Audit Logs (Append-only via RLS + Trigger)
DROP POLICY IF EXISTS "Admins can view policy audit logs" ON public.product_performance_policy_audit_logs;
CREATE POLICY "Admins can view policy audit logs"
ON public.product_performance_policy_audit_logs
FOR SELECT
TO authenticated
USING (public.auth_is_admin());

DROP POLICY IF EXISTS "Admins can insert policy audit logs" ON public.product_performance_policy_audit_logs;
CREATE POLICY "Admins can insert policy audit logs"
ON public.product_performance_policy_audit_logs
FOR INSERT
TO authenticated
WITH CHECK (public.auth_is_admin());

-- Policies for Historical Evaluations (Read-only for Admins)
DROP POLICY IF EXISTS "Admins can view historical evaluations" ON public.product_performance_historical_evaluations;
CREATE POLICY "Admins can view historical evaluations"
ON public.product_performance_historical_evaluations
FOR SELECT
TO authenticated
USING (public.auth_is_admin());
