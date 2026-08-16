-- Create supplier_remittance_logs table
CREATE TABLE IF NOT EXISTS public.supplier_remittance_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  changed_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  changed_by_name text,
  changed_at timestamptz NOT NULL DEFAULT now(),
  actor_type text NOT NULL CHECK (actor_type IN ('letusto_admin', 'portal_admin')),
  field_name text NOT NULL,
  old_value text,
  new_value text
);

-- Enable RLS
ALTER TABLE public.supplier_remittance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_remittance_logs FORCE ROW LEVEL SECURITY;

-- Allow select for authenticated super admins or company admin/staff of that company
CREATE POLICY "supplier_remittance_logs_select"
  ON public.supplier_remittance_logs FOR SELECT
  TO authenticated
  USING (
    public.auth_is_super_admin()
    OR public.auth_is_admin()
    OR EXISTS (
      SELECT 1 FROM public.company_users
      WHERE company_id = supplier_remittance_logs.company_id
        AND id = auth.uid()
    )
  );

-- Only superadmins/admins can write, but we bypass RLS on server side via createAdminClient()
CREATE POLICY "supplier_remittance_logs_insert"
  ON public.supplier_remittance_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    public.auth_is_super_admin()
    OR public.auth_is_admin()
  );
