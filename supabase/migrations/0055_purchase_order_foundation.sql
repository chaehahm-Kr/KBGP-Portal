-- 0055_purchase_order_foundation.sql — Purchase Order Foundation
--

-- 1. Create po_number sequence
CREATE SEQUENCE IF NOT EXISTS public.po_number_seq START WITH 1;

-- 2. Create purchase_orders table
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number TEXT NOT NULL UNIQUE,
  supplier_id UUID NOT NULL REFERENCES public.companies (id) ON DELETE RESTRICT,
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  po_status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (po_status IN ('DRAFT', 'APPROVED', 'SENT', 'CANCELLED')),
  fulfillment_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (fulfillment_status IN ('PENDING', 'IN_PRODUCTION', 'READY_TO_SHIP', 'SHIPPED', 'RECEIVED')),
  currency TEXT NOT NULL DEFAULT 'USD',
  payment_terms TEXT,
  incoterms TEXT,
  port_of_loading TEXT,
  expected_ready_date DATE,
  expected_ship_date DATE,
  ship_from_warehouse_id UUID REFERENCES public.warehouses (id) ON DELETE RESTRICT,
  destination_warehouse_id UUID NOT NULL REFERENCES public.warehouses (id) ON DELETE RESTRICT,
  po_receiving_email TEXT,
  internal_note TEXT,
  supplier_facing_note TEXT,
  created_by UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_by UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  cancelled_by UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  cancelled_at TIMESTAMPTZ
);

COMMENT ON TABLE public.purchase_orders IS '발주(Purchase Order) 헤더 정보';
COMMENT ON COLUMN public.purchase_orders.po_number IS '사람이 식별 가능한 고유 발주 번호 (예: PO-2026-0001)';
COMMENT ON COLUMN public.purchase_orders.po_status IS '발주서 상태 (DRAFT: 초안, APPROVED: 승인됨, SENT: 전송됨, CANCELLED: 취소됨)';
COMMENT ON COLUMN public.purchase_orders.fulfillment_status IS '공급사 이행/물류 상태 (PENDING: 대기, IN_PRODUCTION: 생산중, READY_TO_SHIP: 선적대기, SHIPPED: 선적완료, RECEIVED: 입고완료)';
COMMENT ON COLUMN public.purchase_orders.ship_from_warehouse_id IS '공급사의 실제 물류 출고지 창고 ID';

-- Enable RLS
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "purchase_orders_admin_all" ON public.purchase_orders;
CREATE POLICY "purchase_orders_admin_all"
  ON public.purchase_orders
  FOR ALL
  TO authenticated
  USING (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());


-- 3. Create purchase_order_lines table
CREATE TABLE IF NOT EXISTS public.purchase_order_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders (id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products (id) ON DELETE RESTRICT,
  product_name_snapshot TEXT NOT NULL,
  letusto_sku_snapshot TEXT,
  manufacture_sku_snapshot TEXT,
  qty INTEGER NOT NULL CHECK (qty > 0),
  unit_cost NUMERIC(15, 4) NOT NULL CHECK (unit_cost >= 0),
  line_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT po_product_unique UNIQUE (purchase_order_id, product_id)
);

COMMENT ON TABLE public.purchase_order_lines IS '발주 상세 품목 라인 정보';

-- Enable RLS
ALTER TABLE public.purchase_order_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_lines FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "purchase_order_lines_admin_all" ON public.purchase_order_lines;
CREATE POLICY "purchase_order_lines_admin_all"
  ON public.purchase_order_lines
  FOR ALL
  TO authenticated
  USING (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());


-- 4. Create trigger to auto-set po_number
CREATE OR REPLACE FUNCTION public.set_purchase_order_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.po_number IS NULL OR NEW.po_number = '' THEN
    NEW.po_number := 'PO-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.po_number_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_purchase_order_number ON public.purchase_orders;
CREATE TRIGGER trigger_set_purchase_order_number
  BEFORE INSERT ON public.purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.set_purchase_order_number();
