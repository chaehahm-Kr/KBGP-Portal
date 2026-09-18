-- 0085: Product Soft Delete & Change History Audit (ADM-PROD-001)
--
-- 1. Create product_change_logs table for tracking all changes from Admin, Brand Portal, and System
CREATE TABLE IF NOT EXISTS public.product_change_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name TEXT NOT NULL,
  user_email TEXT,
  source TEXT NOT NULL CHECK (source IN ('ADMIN', 'BRAND_PORTAL', 'SYSTEM', 'AUTOMATION')),
  company_name TEXT,
  section TEXT NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('CREATE', 'UPDATE', 'DELETE', 'RESTORE', 'STATUS_CHANGE')),
  summary TEXT NOT NULL,
  changes JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast retrieval by product
CREATE INDEX IF NOT EXISTS idx_product_change_logs_product_id ON public.product_change_logs (product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_change_logs_created_at ON public.product_change_logs (created_at DESC);

-- Enable RLS
ALTER TABLE public.product_change_logs ENABLE ROW LEVEL SECURITY;

-- Select policies: Admins can view all change logs
CREATE POLICY "product_change_logs_select_admin"
  ON public.product_change_logs FOR SELECT
  TO authenticated
  USING (public.auth_is_admin());

-- Select policies: Portal users can view logs for their company's products
CREATE POLICY "product_change_logs_select_portal"
  ON public.product_change_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      JOIN public.company_users cu ON cu.company_id = p.company_id
      WHERE p.id = product_change_logs.product_id
      AND cu.id = auth.uid()
    )
  );

-- Insert policies: Authenticated users can insert logs (via Server Actions)
CREATE POLICY "product_change_logs_insert_authenticated"
  ON public.product_change_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- No update/delete policies for anyone to ensure audit trail immutability

-- 2. Add last updated metadata columns to products table for high-performance catalog list queries
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS last_updated_by_name TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS last_updated_source TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS last_updated_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
