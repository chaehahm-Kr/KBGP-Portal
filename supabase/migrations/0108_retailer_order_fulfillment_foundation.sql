-- ==============================================================================
-- Migration 0108: Retailer Order Fulfillment & Confirmed Delivered Quantity Foundation
-- Task ID: RTP-FUL-001
-- Description:
-- 1. Create retailer_order_fulfillments header table (carrier, tracking, shipment/delivery timestamps, status)
-- 2. Create retailer_order_fulfillment_items table (shipped and confirmed delivered quantities per order line)
-- 3. Create sequence and generator function for fulfillment numbers (e.g. KSF-YYYY-XXXXXX)
-- 4. Create authoritative helper function get_confirmed_delivered_qty(store_id, product_id, start_date, end_date)
-- 5. Enable strict tenant-isolated RLS (Admin full write/read, Retailer read-only)
-- ==============================================================================

-- 1. Create Fulfillment Number Sequence
CREATE SEQUENCE IF NOT EXISTS public.retailer_fulfillment_number_seq START 1;

-- 2. Create Helper Function: Generate Atomic Fulfillment Number
CREATE OR REPLACE FUNCTION public.generate_retailer_fulfillment_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_year TEXT;
  next_val BIGINT;
BEGIN
  current_year := to_char(now(), 'YYYY');
  next_val := nextval('public.retailer_fulfillment_number_seq');
  RETURN 'KSF-' || current_year || '-' || LPAD(next_val::TEXT, 6, '0');
END;
$$;

-- 3. Create retailer_order_fulfillments table
CREATE TABLE IF NOT EXISTS public.retailer_order_fulfillments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fulfillment_number TEXT NOT NULL UNIQUE,
  order_id UUID NOT NULL REFERENCES public.retailer_orders(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('pending', 'processing', 'shipped', 'delivered', 'cancelled')),
  carrier TEXT,
  tracking_number TEXT,
  tracking_url TEXT,
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  shipped_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  delivered_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_retailer_order_fulfillments_order_id 
  ON public.retailer_order_fulfillments(order_id);

CREATE INDEX IF NOT EXISTS idx_retailer_order_fulfillments_company_id 
  ON public.retailer_order_fulfillments(company_id);

CREATE INDEX IF NOT EXISTS idx_retailer_order_fulfillments_store_id 
  ON public.retailer_order_fulfillments(store_id);

CREATE INDEX IF NOT EXISTS idx_retailer_order_fulfillments_status 
  ON public.retailer_order_fulfillments(status);

CREATE INDEX IF NOT EXISTS idx_retailer_order_fulfillments_delivered_at 
  ON public.retailer_order_fulfillments(delivered_at);

COMMENT ON TABLE public.retailer_order_fulfillments IS '리테일러 주문별 출고 배송(Fulfillment/Shipment) 헤더 및 운송장, 배송 완료 일시';
COMMENT ON COLUMN public.retailer_order_fulfillments.status IS '배송 상태 (pending, processing, shipped, delivered, cancelled)';
COMMENT ON COLUMN public.retailer_order_fulfillments.delivered_at IS '매장 배송 완료 확인 일시 (주간 재고 점검 및 실판매 이동량 산출의 기준)';

-- 4. Create retailer_order_fulfillment_items table
CREATE TABLE IF NOT EXISTS public.retailer_order_fulfillment_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fulfillment_id UUID NOT NULL REFERENCES public.retailer_order_fulfillments(id) ON DELETE CASCADE,
  order_item_id UUID NOT NULL REFERENCES public.retailer_order_items(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity_shipped INTEGER NOT NULL CHECK (quantity_shipped >= 0),
  quantity_delivered INTEGER NOT NULL DEFAULT 0 CHECK (quantity_delivered >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_fulfillment_order_item UNIQUE (fulfillment_id, order_item_id)
);

CREATE INDEX IF NOT EXISTS idx_fulfillment_items_fulfillment_id 
  ON public.retailer_order_fulfillment_items(fulfillment_id);

CREATE INDEX IF NOT EXISTS idx_fulfillment_items_order_item_id 
  ON public.retailer_order_fulfillment_items(order_item_id);

CREATE INDEX IF NOT EXISTS idx_fulfillment_items_product_id 
  ON public.retailer_order_fulfillment_items(product_id);

COMMENT ON TABLE public.retailer_order_fulfillment_items IS '출고 배송 품목별 출고 수량(quantity_shipped) 및 최종 배송 완료 수량(quantity_delivered)';

-- 5. Helper Function: Calculate Confirmed Delivered Quantity for a Store & Product within a Time Interval
CREATE OR REPLACE FUNCTION public.get_confirmed_delivered_qty(
  p_store_id UUID,
  p_product_id UUID,
  p_start_time TIMESTAMPTZ DEFAULT NULL,
  p_end_time TIMESTAMPTZ DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(SUM(fi.quantity_delivered), 0)::INTEGER
  FROM public.retailer_order_fulfillment_items fi
  JOIN public.retailer_order_fulfillments f ON fi.fulfillment_id = f.id
  WHERE f.store_id = p_store_id
    AND fi.product_id = p_product_id
    AND f.status = 'delivered'
    AND f.delivered_at IS NOT NULL
    AND (p_start_time IS NULL OR f.delivered_at > p_start_time)
    AND (p_end_time IS NULL OR f.delivered_at <= p_end_time);
$$;

COMMENT ON FUNCTION public.get_confirmed_delivered_qty IS '특정 매장 및 상품의 확정 배송 입고 수량 합산 함수 (이전 점검 이후 ~ 현재 점검 시점까지)';

-- 6. Enable Row Level Security
ALTER TABLE public.retailer_order_fulfillments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retailer_order_fulfillments FORCE ROW LEVEL SECURITY;

ALTER TABLE public.retailer_order_fulfillment_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retailer_order_fulfillment_items FORCE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "fulfillments_admin_all" ON public.retailer_order_fulfillments;
DROP POLICY IF EXISTS "fulfillments_retailer_select" ON public.retailer_order_fulfillments;

DROP POLICY IF EXISTS "fulfillment_items_admin_all" ON public.retailer_order_fulfillment_items;
DROP POLICY IF EXISTS "fulfillment_items_retailer_select" ON public.retailer_order_fulfillment_items;

-- Policies for retailer_order_fulfillments
CREATE POLICY "fulfillments_admin_all"
  ON public.retailer_order_fulfillments FOR ALL
  TO authenticated
  USING (public.auth_is_admin());

CREATE POLICY "fulfillments_retailer_select"
  ON public.retailer_order_fulfillments FOR SELECT
  TO authenticated
  USING (
    company_id = public.auth_company_id()
    AND EXISTS (
      SELECT 1 FROM public.retailer_orders ro
      WHERE ro.id = retailer_order_fulfillments.order_id
        AND ro.company_id = public.auth_company_id()
        AND public.auth_can_retailer_view_order(ro.company_id, ro.store_id)
    )
  );

-- Policies for retailer_order_fulfillment_items
CREATE POLICY "fulfillment_items_admin_all"
  ON public.retailer_order_fulfillment_items FOR ALL
  TO authenticated
  USING (public.auth_is_admin());

CREATE POLICY "fulfillment_items_retailer_select"
  ON public.retailer_order_fulfillment_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.retailer_order_fulfillments f
      WHERE f.id = retailer_order_fulfillment_items.fulfillment_id
        AND f.company_id = public.auth_company_id()
        AND public.auth_can_retailer_view_order(f.company_id, f.store_id)
    )
  );

-- 7. Notify PostgREST schema reload
NOTIFY pgrst, 'reload schema';
