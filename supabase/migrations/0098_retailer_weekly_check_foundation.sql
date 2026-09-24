-- 0098_retailer_weekly_check_foundation.sql
-- RTP-RPT-001: Weekly Product Check & Estimated Movement Foundation

CREATE TABLE IF NOT EXISTS public.retailer_weekly_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  submitted_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  reporting_week TEXT NOT NULL,
  report_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'cancelled')),
  total_products_count INTEGER NOT NULL DEFAULT 0,
  total_counted_products INTEGER NOT NULL DEFAULT 0,
  total_remaining_units INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  is_test BOOLEAN NOT NULL DEFAULT false,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_weekly_checks_company_id ON public.retailer_weekly_checks(company_id);
CREATE INDEX IF NOT EXISTS idx_weekly_checks_store_id ON public.retailer_weekly_checks(store_id);
CREATE INDEX IF NOT EXISTS idx_weekly_checks_reporting_week ON public.retailer_weekly_checks(reporting_week);
CREATE INDEX IF NOT EXISTS idx_weekly_checks_status ON public.retailer_weekly_checks(status);
CREATE INDEX IF NOT EXISTS idx_weekly_checks_created_at ON public.retailer_weekly_checks(created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_weekly_checks_store_draft ON public.retailer_weekly_checks(store_id, reporting_week) WHERE status = 'draft';
CREATE UNIQUE INDEX IF NOT EXISTS uq_weekly_checks_store_submitted ON public.retailer_weekly_checks(store_id, reporting_week) WHERE status = 'submitted';

COMMENT ON TABLE public.retailer_weekly_checks IS '매장별 주간 상품 재고 현황(Weekly Product Check) 세션 헤더';

CREATE TABLE IF NOT EXISTS public.retailer_weekly_check_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  check_id UUID NOT NULL REFERENCES public.retailer_weekly_checks(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  reported_remaining_qty INTEGER NOT NULL DEFAULT 0 CHECK (reported_remaining_qty >= 0),
  previous_reported_qty INTEGER CHECK (previous_reported_qty >= 0),
  delivered_since_previous INTEGER NOT NULL DEFAULT 0 CHECK (delivered_since_previous >= 0),
  estimated_movement INTEGER,
  is_counted BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_weekly_check_item UNIQUE (check_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_weekly_check_items_check_id ON public.retailer_weekly_check_items(check_id);
CREATE INDEX IF NOT EXISTS idx_weekly_check_items_product_id ON public.retailer_weekly_check_items(product_id);

COMMENT ON TABLE public.retailer_weekly_check_items IS '주간 상품 점검 개별 품목 및 매장 실사 잔여 수량 스냅샷';

CREATE OR REPLACE FUNCTION public.auth_can_retailer_submit_weekly_check(p_company_id uuid, p_store_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.retailer_user_roles rur
    WHERE rur.user_id = auth.uid()
      AND rur.company_id = p_company_id
      AND rur.role IN ('owner', 'buyer', 'store_manager', 'employee')
      AND (
        rur.role IN ('owner', 'buyer')
        OR rur.has_all_stores_access = true
        OR p_store_id IS NULL
        OR EXISTS (
          SELECT 1 FROM public.retailer_user_store_access rusa
          WHERE rusa.user_id = auth.uid()
            AND rusa.company_id = p_company_id
            AND rusa.store_id = p_store_id
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.auth_can_retailer_view_weekly_check(p_company_id uuid, p_store_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.retailer_user_roles rur
    WHERE rur.user_id = auth.uid()
      AND rur.company_id = p_company_id
      AND (
        rur.role IN ('owner', 'buyer', 'accounting')
        OR rur.has_all_stores_access = true
        OR p_store_id IS NULL
        OR EXISTS (
          SELECT 1 FROM public.retailer_user_store_access rusa
          WHERE rusa.user_id = auth.uid()
            AND rusa.company_id = p_company_id
            AND rusa.store_id = p_store_id
        )
      )
  );
$$;

ALTER TABLE public.retailer_weekly_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retailer_weekly_checks FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "retailer_weekly_checks_admin_all" ON public.retailer_weekly_checks;
DROP POLICY IF EXISTS "retailer_weekly_checks_select" ON public.retailer_weekly_checks;
DROP POLICY IF EXISTS "retailer_weekly_checks_insert" ON public.retailer_weekly_checks;
DROP POLICY IF EXISTS "retailer_weekly_checks_update" ON public.retailer_weekly_checks;
DROP POLICY IF EXISTS "retailer_weekly_checks_delete" ON public.retailer_weekly_checks;

CREATE POLICY "retailer_weekly_checks_select"
  ON public.retailer_weekly_checks FOR SELECT
  TO authenticated
  USING (
    public.auth_is_admin()
    OR (
      company_id = public.auth_company_id()
      AND public.auth_can_retailer_view_weekly_check(company_id, store_id)
    )
  );

CREATE POLICY "retailer_weekly_checks_insert"
  ON public.retailer_weekly_checks FOR INSERT
  TO authenticated
  WITH CHECK (
    public.auth_is_admin()
    OR (
      company_id = public.auth_company_id()
      AND submitted_by = auth.uid()
      AND public.auth_can_retailer_submit_weekly_check(company_id, store_id)
    )
  );

CREATE POLICY "retailer_weekly_checks_update"
  ON public.retailer_weekly_checks FOR UPDATE
  TO authenticated
  USING (
    public.auth_is_admin()
    OR (
      company_id = public.auth_company_id()
      AND status = 'draft'
      AND public.auth_can_retailer_submit_weekly_check(company_id, store_id)
    )
  )
  WITH CHECK (
    public.auth_is_admin()
    OR (
      company_id = public.auth_company_id()
      AND public.auth_can_retailer_submit_weekly_check(company_id, store_id)
    )
  );

CREATE POLICY "retailer_weekly_checks_delete"
  ON public.retailer_weekly_checks FOR DELETE
  TO authenticated
  USING (
    public.auth_is_admin()
    OR (
      company_id = public.auth_company_id()
      AND status = 'draft'
      AND public.auth_can_retailer_submit_weekly_check(company_id, store_id)
    )
  );

ALTER TABLE public.retailer_weekly_check_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retailer_weekly_check_items FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "retailer_weekly_check_items_admin_all" ON public.retailer_weekly_check_items;
DROP POLICY IF EXISTS "retailer_weekly_check_items_select" ON public.retailer_weekly_check_items;
DROP POLICY IF EXISTS "retailer_weekly_check_items_insert" ON public.retailer_weekly_check_items;
DROP POLICY IF EXISTS "retailer_weekly_check_items_update" ON public.retailer_weekly_check_items;
DROP POLICY IF EXISTS "retailer_weekly_check_items_delete" ON public.retailer_weekly_check_items;

CREATE POLICY "retailer_weekly_check_items_select"
  ON public.retailer_weekly_check_items FOR SELECT
  TO authenticated
  USING (
    public.auth_is_admin()
    OR EXISTS (
      SELECT 1 FROM public.retailer_weekly_checks rwc
      WHERE rwc.id = retailer_weekly_check_items.check_id
        AND rwc.company_id = public.auth_company_id()
        AND public.auth_can_retailer_view_weekly_check(rwc.company_id, rwc.store_id)
    )
  );

CREATE POLICY "retailer_weekly_check_items_insert"
  ON public.retailer_weekly_check_items FOR INSERT
  TO authenticated
  WITH CHECK (
    public.auth_is_admin()
    OR EXISTS (
      SELECT 1 FROM public.retailer_weekly_checks rwc
      WHERE rwc.id = retailer_weekly_check_items.check_id
        AND rwc.company_id = public.auth_company_id()
        AND rwc.status = 'draft'
        AND public.auth_can_retailer_submit_weekly_check(rwc.company_id, rwc.store_id)
    )
  );

CREATE POLICY "retailer_weekly_check_items_update"
  ON public.retailer_weekly_check_items FOR UPDATE
  TO authenticated
  USING (
    public.auth_is_admin()
    OR EXISTS (
      SELECT 1 FROM public.retailer_weekly_checks rwc
      WHERE rwc.id = retailer_weekly_check_items.check_id
        AND rwc.company_id = public.auth_company_id()
        AND rwc.status = 'draft'
        AND public.auth_can_retailer_submit_weekly_check(rwc.company_id, rwc.store_id)
    )
  )
  WITH CHECK (
    public.auth_is_admin()
    OR EXISTS (
      SELECT 1 FROM public.retailer_weekly_checks rwc
      WHERE rwc.id = retailer_weekly_check_items.check_id
        AND rwc.company_id = public.auth_company_id()
        AND public.auth_can_retailer_submit_weekly_check(rwc.company_id, rwc.store_id)
    )
  );

CREATE POLICY "retailer_weekly_check_items_delete"
  ON public.retailer_weekly_check_items FOR DELETE
  TO authenticated
  USING (
    public.auth_is_admin()
    OR EXISTS (
      SELECT 1 FROM public.retailer_weekly_checks rwc
      WHERE rwc.id = retailer_weekly_check_items.check_id
        AND rwc.company_id = public.auth_company_id()
        AND rwc.status = 'draft'
        AND public.auth_can_retailer_submit_weekly_check(rwc.company_id, rwc.store_id)
    )
  );
