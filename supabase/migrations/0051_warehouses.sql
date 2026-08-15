-- 0051_warehouses.sql — Warehouse Master/Settings Foundation
--

-- 1. Create warehouses table
CREATE TABLE IF NOT EXISTS public.warehouses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL,
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('own', '3pl', 'other')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  is_default_receiving boolean NOT NULL DEFAULT false,
  address1 text NOT NULL,
  address2 text,
  city text NOT NULL,
  state text NOT NULL,
  zip_code text NOT NULL,
  country text NOT NULL,
  internal_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Add comments
COMMENT ON TABLE public.warehouses IS '회사별 물류창고 마스터 정보';
COMMENT ON COLUMN public.warehouses.type IS '창고 유형: own (자사 창고), 3pl (제3자 물류), other (기타)';
COMMENT ON COLUMN public.warehouses.status IS '창고 활성 상태: active (활성), inactive (비활성)';
COMMENT ON COLUMN public.warehouses.is_default_receiving IS '기본 입고 목적지 창고 여부';

-- 3. Unique Constraints & Checks
-- A company can only have at most one default receiving warehouse
CREATE UNIQUE INDEX IF NOT EXISTS idx_warehouses_default_receiving_per_company 
  ON public.warehouses (company_id) 
  WHERE (is_default_receiving = true);

-- Warehouse Code must be unique globally
ALTER TABLE public.warehouses DROP CONSTRAINT IF EXISTS warehouses_code_key;
ALTER TABLE public.warehouses ADD CONSTRAINT warehouses_code_key UNIQUE (code);

-- Inactive warehouse cannot be default receiving warehouse
ALTER TABLE public.warehouses DROP CONSTRAINT IF EXISTS chk_default_active;
ALTER TABLE public.warehouses ADD CONSTRAINT chk_default_active 
  CHECK (NOT (is_default_receiving = true AND status = 'inactive'));

-- 4. Enable RLS
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouses FORCE ROW LEVEL SECURITY;

-- 5. Create RLS Policies
DROP POLICY IF EXISTS "warehouses_select_admin" ON public.warehouses;
CREATE POLICY "warehouses_select_admin"
  ON public.warehouses FOR SELECT
  TO authenticated
  USING (public.auth_is_admin());

DROP POLICY IF EXISTS "warehouses_insert_admin" ON public.warehouses;
CREATE POLICY "warehouses_insert_admin"
  ON public.warehouses FOR INSERT
  TO authenticated
  WITH CHECK (public.auth_is_admin());

DROP POLICY IF EXISTS "warehouses_update_admin" ON public.warehouses;
CREATE POLICY "warehouses_update_admin"
  ON public.warehouses FOR UPDATE
  TO authenticated
  USING (public.auth_is_admin());

DROP POLICY IF EXISTS "warehouses_delete_admin" ON public.warehouses;
CREATE POLICY "warehouses_delete_admin"
  ON public.warehouses FOR DELETE
  TO authenticated
  USING (public.auth_is_admin());
