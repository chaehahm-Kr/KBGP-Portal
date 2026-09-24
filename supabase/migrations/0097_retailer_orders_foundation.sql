-- 0097_retailer_orders_foundation.sql
-- RTP-ORD-001: Retailer Orders & Order Items Data Architecture with Strict Multi-Tenant RLS

-- 1. Create retailer_orders table
CREATE TABLE IF NOT EXISTS public.retailer_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
  order_status TEXT NOT NULL DEFAULT 'submitted' CHECK (order_status IN ('draft', 'submitted', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled')),
  payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'pending', 'paid', 'partially_paid', 'failed', 'refunded')),
  payment_terms TEXT,
  subtotal_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  tax_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  shipping_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  total_items_count INTEGER NOT NULL DEFAULT 0,
  total_skus_count INTEGER NOT NULL DEFAULT 0,
  shipping_address TEXT,
  shipping_city TEXT,
  shipping_state TEXT,
  shipping_zip TEXT,
  shipping_phone TEXT,
  recipient_name TEXT,
  notes TEXT,
  is_test BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_retailer_orders_company_id ON public.retailer_orders(company_id);
CREATE INDEX IF NOT EXISTS idx_retailer_orders_store_id ON public.retailer_orders(store_id);
CREATE INDEX IF NOT EXISTS idx_retailer_orders_user_id ON public.retailer_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_retailer_orders_order_status ON public.retailer_orders(order_status);
CREATE INDEX IF NOT EXISTS idx_retailer_orders_created_at ON public.retailer_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_retailer_orders_is_test ON public.retailer_orders(is_test);

COMMENT ON TABLE public.retailer_orders IS '리테일러 기업의 B2B 상품 발주 주문서 (주문 상태, 배송 매장, 결제 조건 및 총액)';

-- 2. Create retailer_order_items table
CREATE TABLE IF NOT EXISTS public.retailer_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.retailer_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  sku TEXT NOT NULL,
  product_name TEXT NOT NULL,
  brand_name TEXT NOT NULL,
  unit_wholesale_price NUMERIC(12, 2) NOT NULL CHECK (unit_wholesale_price >= 0),
  unit_msrp NUMERIC(12, 2) CHECK (unit_msrp >= 0),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  case_pack_qty INTEGER NOT NULL DEFAULT 1 CHECK (case_pack_qty > 0),
  line_total NUMERIC(12, 2) NOT NULL CHECK (line_total >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_retailer_order_items_order_id ON public.retailer_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_retailer_order_items_product_id ON public.retailer_order_items(product_id);

COMMENT ON TABLE public.retailer_order_items IS '리테일러 주문서의 개별 품목 및 체결 당시의 도매단가(Wholesale) 스냅샷';

-- 3. Row Level Security for retailer_orders
ALTER TABLE public.retailer_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retailer_orders FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "retailer_orders_admin_all" ON public.retailer_orders;
DROP POLICY IF EXISTS "retailer_orders_retailer_select" ON public.retailer_orders;
DROP POLICY IF EXISTS "retailer_orders_retailer_insert" ON public.retailer_orders;
DROP POLICY IF EXISTS "retailer_orders_retailer_update" ON public.retailer_orders;

CREATE POLICY "retailer_orders_admin_all"
  ON public.retailer_orders FOR ALL
  TO authenticated
  USING (public.auth_is_admin());

CREATE POLICY "retailer_orders_retailer_select"
  ON public.retailer_orders FOR SELECT
  TO authenticated
  USING (company_id = public.auth_company_id());

CREATE POLICY "retailer_orders_retailer_insert"
  ON public.retailer_orders FOR INSERT
  TO authenticated
  WITH CHECK (company_id = public.auth_company_id());

CREATE POLICY "retailer_orders_retailer_update"
  ON public.retailer_orders FOR UPDATE
  TO authenticated
  USING (company_id = public.auth_company_id())
  WITH CHECK (company_id = public.auth_company_id());

-- 4. Row Level Security for retailer_order_items
ALTER TABLE public.retailer_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retailer_order_items FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "retailer_order_items_admin_all" ON public.retailer_order_items;
DROP POLICY IF EXISTS "retailer_order_items_retailer_select" ON public.retailer_order_items;
DROP POLICY IF EXISTS "retailer_order_items_retailer_insert" ON public.retailer_order_items;

CREATE POLICY "retailer_order_items_admin_all"
  ON public.retailer_order_items FOR ALL
  TO authenticated
  USING (public.auth_is_admin());

CREATE POLICY "retailer_order_items_retailer_select"
  ON public.retailer_order_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.retailer_orders ro
      WHERE ro.id = retailer_order_items.order_id
        AND ro.company_id = public.auth_company_id()
    )
  );

CREATE POLICY "retailer_order_items_retailer_insert"
  ON public.retailer_order_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.retailer_orders ro
      WHERE ro.id = retailer_order_items.order_id
        AND ro.company_id = public.auth_company_id()
    )
  );

-- 5. Helper Function: Atomic Order Number Generation (e.g. KSR-2026-000001)
CREATE OR REPLACE FUNCTION public.generate_retailer_order_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_year TEXT;
  next_seq INTEGER;
  new_order_number TEXT;
BEGIN
  current_year := to_char(now(), 'YYYY');
  
  SELECT COALESCE(
    MAX(
      NULLIF(
        substring(order_number from 'KSR-' || current_year || '-(\d+)'),
        ''
      )::INTEGER
    ),
    0
  ) + 1
  INTO next_seq
  FROM public.retailer_orders
  WHERE order_number LIKE 'KSR-' || current_year || '-%';

  new_order_number := 'KSR-' || current_year || '-' || LPAD(next_seq::TEXT, 6, '0');
  RETURN new_order_number;
END;
$$;
