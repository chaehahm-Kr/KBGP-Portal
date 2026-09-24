-- 0100_retailer_store_price_and_tag_foundation.sql
-- RTP-TAG-001: Store Price Tag & Common Product QR Foundation

-- 1. Create retailer_store_product_prices table
CREATE TABLE IF NOT EXISTS public.retailer_store_product_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  regular_price NUMERIC(12,2) NOT NULL CHECK (regular_price > 0),
  sale_price NUMERIC(12,2) CHECK (sale_price IS NULL OR (sale_price > 0 AND sale_price < regular_price)),
  sale_start_date DATE,
  sale_end_date DATE,
  currency TEXT NOT NULL DEFAULT 'USD',
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_store_product_price UNIQUE (store_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_store_prices_company_id ON public.retailer_store_product_prices(company_id);
CREATE INDEX IF NOT EXISTS idx_store_prices_store_id ON public.retailer_store_product_prices(store_id);
CREATE INDEX IF NOT EXISTS idx_store_prices_product_id ON public.retailer_store_product_prices(product_id);

COMMENT ON TABLE public.retailer_store_product_prices IS '매장별 개별 상품 판매가(정가/할인가/할인기간) 관리 테이블';

-- 2. Add price snapshot columns to retailer_weekly_check_items for forward-looking snapshot foundation
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'retailer_weekly_check_items'
      AND column_name = 'retail_price_snapshot'
  ) THEN
    ALTER TABLE public.retailer_weekly_check_items
      ADD COLUMN retail_price_snapshot NUMERIC(12,2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'retailer_weekly_check_items'
      AND column_name = 'retail_price_basis'
  ) THEN
    ALTER TABLE public.retailer_weekly_check_items
      ADD COLUMN retail_price_basis TEXT CHECK (retail_price_basis IS NULL OR retail_price_basis IN ('store_sale', 'store_regular', 'msrp', 'unknown'));
  END IF;
END $$;

-- 3. RLS Helper Functions
CREATE OR REPLACE FUNCTION public.auth_can_retailer_view_store_pricing(p_company_id uuid, p_store_id uuid)
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

CREATE OR REPLACE FUNCTION public.auth_can_retailer_manage_store_pricing(p_company_id uuid, p_store_id uuid)
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
      AND rur.role IN ('owner', 'buyer', 'store_manager')
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

-- 4. Enable RLS and Policies on retailer_store_product_prices
ALTER TABLE public.retailer_store_product_prices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "retailer_store_prices_select_policy" ON public.retailer_store_product_prices;
CREATE POLICY "retailer_store_prices_select_policy"
  ON public.retailer_store_product_prices
  FOR SELECT
  TO authenticated
  USING (
    public.auth_can_retailer_view_store_pricing(company_id, store_id)
    OR EXISTS (
      SELECT 1 FROM public.staff_members sm
      WHERE sm.id = auth.uid() AND sm.status = 'active'
    )
  );

DROP POLICY IF EXISTS "retailer_store_prices_insert_policy" ON public.retailer_store_product_prices;
CREATE POLICY "retailer_store_prices_insert_policy"
  ON public.retailer_store_product_prices
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.auth_can_retailer_manage_store_pricing(company_id, store_id)
    OR EXISTS (
      SELECT 1 FROM public.staff_members sm
      WHERE sm.id = auth.uid() AND sm.status = 'active'
    )
  );

DROP POLICY IF EXISTS "retailer_store_prices_update_policy" ON public.retailer_store_product_prices;
CREATE POLICY "retailer_store_prices_update_policy"
  ON public.retailer_store_product_prices
  FOR UPDATE
  TO authenticated
  USING (
    public.auth_can_retailer_manage_store_pricing(company_id, store_id)
    OR EXISTS (
      SELECT 1 FROM public.staff_members sm
      WHERE sm.id = auth.uid() AND sm.status = 'active'
    )
  )
  WITH CHECK (
    public.auth_can_retailer_manage_store_pricing(company_id, store_id)
    OR EXISTS (
      SELECT 1 FROM public.staff_members sm
      WHERE sm.id = auth.uid() AND sm.status = 'active'
    )
  );

DROP POLICY IF EXISTS "retailer_store_prices_delete_policy" ON public.retailer_store_product_prices;
CREATE POLICY "retailer_store_prices_delete_policy"
  ON public.retailer_store_product_prices
  FOR DELETE
  TO authenticated
  USING (
    public.auth_can_retailer_manage_store_pricing(company_id, store_id)
    OR EXISTS (
      SELECT 1 FROM public.staff_members sm
      WHERE sm.id = auth.uid() AND sm.status = 'active'
    )
  );
