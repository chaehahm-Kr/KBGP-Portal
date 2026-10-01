-- Migration 0086: Company Shipping Origins Table
-- Task IDs: ADM-CMP-002, PORT-CMP-001

CREATE TABLE IF NOT EXISTS public.company_shipping_origins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  contact_name text,
  phone text,
  email text,
  country text NOT NULL,
  address_line1 text NOT NULL,
  address_line2 text,
  city text NOT NULL,
  state_province text,
  postal_code text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.company_shipping_origins IS '회사별 기본 출고지(Ship From / Shipping Origin) 프로필 정보';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_company_shipping_origins_company_id 
  ON public.company_shipping_origins(company_id);

CREATE INDEX IF NOT EXISTS idx_company_shipping_origins_company_default 
  ON public.company_shipping_origins(company_id, is_default);

-- Enable & Force RLS
ALTER TABLE public.company_shipping_origins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_shipping_origins FORCE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "company_shipping_origins_select" ON public.company_shipping_origins;
CREATE POLICY "company_shipping_origins_select"
  ON public.company_shipping_origins FOR SELECT
  TO authenticated
  USING (public.auth_is_admin() OR public.auth_company_id() = company_id);

DROP POLICY IF EXISTS "company_shipping_origins_write_admin" ON public.company_shipping_origins;
CREATE POLICY "company_shipping_origins_write_admin"
  ON public.company_shipping_origins FOR ALL
  TO authenticated
  USING (public.auth_is_admin());

DROP POLICY IF EXISTS "company_shipping_origins_write_portal" ON public.company_shipping_origins;
CREATE POLICY "company_shipping_origins_write_portal"
  ON public.company_shipping_origins FOR ALL
  TO authenticated
  USING (public.auth_company_id() = company_id)
  WITH CHECK (public.auth_company_id() = company_id);
