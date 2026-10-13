-- 0158_promotions_and_coupons_engine.sql
-- RTP-PROMO-COUPON-001: Promotion & Coupon Engine Schema Architecture

-- 1. Main promotions table
CREATE TABLE IF NOT EXISTS public.promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  internal_description TEXT,
  trigger_type TEXT NOT NULL DEFAULT 'coupon' CHECK (trigger_type IN ('coupon', 'automatic')),
  code TEXT,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed_amount', 'unit_discount', 'bogo')),
  discount_value NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (discount_value >= 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'paused', 'archived')),
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  no_expiration BOOLEAN NOT NULL DEFAULT false,
  applies_to_scope TEXT NOT NULL DEFAULT 'all' CHECK (applies_to_scope IN ('all', 'selected_products', 'selected_brands', 'selected_categories')),
  retailer_scope TEXT NOT NULL DEFAULT 'all' CHECK (retailer_scope IN ('all', 'selected_retailers')),
  minimum_spend NUMERIC(12, 2) DEFAULT 0.00 CHECK (minimum_spend >= 0),
  minimum_quantity INTEGER DEFAULT 0 CHECK (minimum_quantity >= 0),
  maximum_discount NUMERIC(12, 2) CHECK (maximum_discount IS NULL OR maximum_discount > 0),
  total_usage_limit INTEGER CHECK (total_usage_limit IS NULL OR total_usage_limit > 0),
  per_retailer_usage_limit INTEGER CHECK (per_retailer_usage_limit IS NULL OR per_retailer_usage_limit > 0),
  combinable_with_quantity_tiers BOOLEAN NOT NULL DEFAULT true,
  combinable_with_automatic_promotions BOOLEAN NOT NULL DEFAULT false,
  -- BOGO configuration
  bogo_buy_quantity INTEGER DEFAULT 1 CHECK (bogo_buy_quantity IS NULL OR bogo_buy_quantity > 0),
  bogo_get_product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  bogo_get_quantity INTEGER DEFAULT 1 CHECK (bogo_get_quantity IS NULL OR bogo_get_quantity > 0),
  bogo_discount_percent NUMERIC(5, 2) DEFAULT 100.00 CHECK (bogo_discount_percent >= 0 AND bogo_discount_percent <= 100),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexing for high-performance lookup
CREATE INDEX IF NOT EXISTS idx_promotions_trigger_type ON public.promotions(trigger_type);
CREATE INDEX IF NOT EXISTS idx_promotions_code ON public.promotions(upper(code));
CREATE INDEX IF NOT EXISTS idx_promotions_status ON public.promotions(status);
CREATE INDEX IF NOT EXISTS idx_promotions_dates ON public.promotions(start_at, end_at);

COMMENT ON TABLE public.promotions IS '프로모션 및 쿠폰 할인 마스터 테이블 (트리거 방식, 할인 유형, 적용 범위 및 한도)';

-- 2. Scope relation tables
CREATE TABLE IF NOT EXISTS public.promotion_products (
  promotion_id UUID NOT NULL REFERENCES public.promotions(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (promotion_id, product_id)
);

CREATE TABLE IF NOT EXISTS public.promotion_brands (
  promotion_id UUID NOT NULL REFERENCES public.promotions(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (promotion_id, brand_id)
);

CREATE TABLE IF NOT EXISTS public.promotion_categories (
  promotion_id UUID NOT NULL REFERENCES public.promotions(id) ON DELETE CASCADE,
  category_code TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (promotion_id, category_code)
);

CREATE TABLE IF NOT EXISTS public.promotion_retailers (
  promotion_id UUID NOT NULL REFERENCES public.promotions(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (promotion_id, company_id)
);

-- 3. Promotion usages table (tracks each applied order)
CREATE TABLE IF NOT EXISTS public.promotion_usages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id UUID NOT NULL REFERENCES public.promotions(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.retailer_orders(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_promotion_usages_promotion_id ON public.promotion_usages(promotion_id);
CREATE INDEX IF NOT EXISTS idx_promotion_usages_company_id ON public.promotion_usages(company_id);
CREATE INDEX IF NOT EXISTS idx_promotion_usages_order_id ON public.promotion_usages(order_id);

-- 4. Extend retailer_orders table with promotion snapshot columns
ALTER TABLE public.retailer_orders
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS promotion_id UUID REFERENCES public.promotions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS coupon_code TEXT,
  ADD COLUMN IF NOT EXISTS promotion_snapshot JSONB;

-- 5. Extend retailer_order_items with discount & BOGO tracking
ALTER TABLE public.retailer_order_items
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS is_bogo_free BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS promotion_id UUID REFERENCES public.promotions(id) ON DELETE SET NULL;

-- 6. Enable RLS
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotion_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotion_brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotion_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotion_retailers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotion_usages ENABLE ROW LEVEL SECURITY;

-- Service role & Admin full access
DROP POLICY IF EXISTS "Admin full access on promotions" ON public.promotions;
CREATE POLICY "Admin full access on promotions" ON public.promotions
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_users cu
      JOIN public.companies c ON cu.company_id = c.id
      WHERE cu.id = auth.uid() AND c.company_type = 'PLATFORM_OPERATOR'
    )
  );

DROP POLICY IF EXISTS "Admin full access on promotion_products" ON public.promotion_products;
CREATE POLICY "Admin full access on promotion_products" ON public.promotion_products
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_users cu
      JOIN public.companies c ON cu.company_id = c.id
      WHERE cu.id = auth.uid() AND c.company_type = 'PLATFORM_OPERATOR'
    )
  );

DROP POLICY IF EXISTS "Admin full access on promotion_brands" ON public.promotion_brands;
CREATE POLICY "Admin full access on promotion_brands" ON public.promotion_brands
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_users cu
      JOIN public.companies c ON cu.company_id = c.id
      WHERE cu.id = auth.uid() AND c.company_type = 'PLATFORM_OPERATOR'
    )
  );

DROP POLICY IF EXISTS "Admin full access on promotion_categories" ON public.promotion_categories;
CREATE POLICY "Admin full access on promotion_categories" ON public.promotion_categories
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_users cu
      JOIN public.companies c ON cu.company_id = c.id
      WHERE cu.id = auth.uid() AND c.company_type = 'PLATFORM_OPERATOR'
    )
  );

DROP POLICY IF EXISTS "Admin full access on promotion_retailers" ON public.promotion_retailers;
CREATE POLICY "Admin full access on promotion_retailers" ON public.promotion_retailers
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_users cu
      JOIN public.companies c ON cu.company_id = c.id
      WHERE cu.id = auth.uid() AND c.company_type = 'PLATFORM_OPERATOR'
    )
  );

DROP POLICY IF EXISTS "Admin full access on promotion_usages" ON public.promotion_usages;
CREATE POLICY "Admin full access on promotion_usages" ON public.promotion_usages
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_users cu
      JOIN public.companies c ON cu.company_id = c.id
      WHERE cu.id = auth.uid() AND c.company_type = 'PLATFORM_OPERATOR'
    )
  );

-- Retailer access: Retailers can read active promotions applicable to them (or via server dal / adminClient)
DROP POLICY IF EXISTS "Retailers view active promotions" ON public.promotions;
CREATE POLICY "Retailers view active promotions" ON public.promotions
  FOR SELECT TO authenticated
  USING (
    status = 'active'
    AND (start_at IS NULL OR start_at <= now())
    AND (end_at IS NULL OR end_at >= now() OR no_expiration = true)
  );
