-- 0099_retailer_weekly_check_safety_correction.sql
-- RTP-RPT-001-R1: Store Product Assortment Foundation & Delivered Quantity Semantics Correction

-- 1. Correct delivered_since_previous semantics in retailer_weekly_check_items
-- Allow NULL to represent "Delivery Data Pending / Not Available" rather than falsely asserting confirmed 0.
ALTER TABLE public.retailer_weekly_check_items
  ALTER COLUMN delivered_since_previous DROP NOT NULL,
  ALTER COLUMN delivered_since_previous SET DEFAULT NULL;

-- 2. Create retailer_store_products table
-- Represents the explicit list of products a specific Store is assigned/expected to carry.
CREATE TABLE IF NOT EXISTS public.retailer_store_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_retailer_store_product UNIQUE (store_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_retailer_store_products_company_id ON public.retailer_store_products(company_id);
CREATE INDEX IF NOT EXISTS idx_retailer_store_products_store_id ON public.retailer_store_products(store_id);
CREATE INDEX IF NOT EXISTS idx_retailer_store_products_product_id ON public.retailer_store_products(product_id);
CREATE INDEX IF NOT EXISTS idx_retailer_store_products_is_active ON public.retailer_store_products(is_active);

COMMENT ON TABLE public.retailer_store_products IS '매장별 취급/진열 대상 K SELECT 상품 할당 관계 (Store Assortment)';

-- 3. Row Level Security for retailer_store_products
ALTER TABLE public.retailer_store_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retailer_store_products FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "retailer_store_products_admin_all" ON public.retailer_store_products;
DROP POLICY IF EXISTS "retailer_store_products_select" ON public.retailer_store_products;
DROP POLICY IF EXISTS "retailer_store_products_modify" ON public.retailer_store_products;

CREATE POLICY "retailer_store_products_select"
  ON public.retailer_store_products FOR SELECT
  TO authenticated
  USING (
    public.auth_is_admin()
    OR (
      company_id = public.auth_company_id()
      AND public.auth_can_retailer_view_weekly_check(company_id, store_id)
    )
  );

CREATE POLICY "retailer_store_products_modify"
  ON public.retailer_store_products FOR ALL
  TO authenticated
  USING (
    public.auth_is_admin()
    OR (
      company_id = public.auth_company_id()
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
