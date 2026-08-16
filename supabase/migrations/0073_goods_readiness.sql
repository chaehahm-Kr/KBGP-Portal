-- 0073_goods_readiness.sql — Shipping Responsibility, Goods Readiness tracking, and Security Policies

-- 1. Extend existing tables with shipping responsibility and carrier columns
ALTER TABLE public.supplier_profiles 
  ADD COLUMN IF NOT EXISTS default_shipping_responsibility TEXT CHECK (default_shipping_responsibility IN ('LETUSTO_ARRANGED', 'SUPPLIER_ARRANGED')) DEFAULT 'LETUSTO_ARRANGED';

ALTER TABLE public.purchase_orders 
  ADD COLUMN IF NOT EXISTS shipping_responsibility TEXT CHECK (shipping_responsibility IN ('LETUSTO_ARRANGED', 'SUPPLIER_ARRANGED')) DEFAULT 'LETUSTO_ARRANGED';

ALTER TABLE public.inbound_shipments 
  ADD COLUMN IF NOT EXISTS shipping_responsibility TEXT CHECK (shipping_responsibility IN ('LETUSTO_ARRANGED', 'SUPPLIER_ARRANGED')) DEFAULT 'LETUSTO_ARRANGED',
  ADD COLUMN IF NOT EXISTS carrier TEXT;


-- 2. Create goods_readiness table (Header)
CREATE TABLE IF NOT EXISTS public.goods_readiness (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders (id) ON DELETE RESTRICT,
  supplier_id UUID NOT NULL REFERENCES public.companies (id) ON DELETE RESTRICT,
  goods_ready_date DATE NOT NULL,
  pickup_location TEXT,
  handover_location TEXT,
  fob_port TEXT,
  warehouse_factory_address TEXT,
  contact_person TEXT,
  special_instructions TEXT,
  handover_status TEXT CHECK (handover_status IN ('DRAFT', 'READY_SUBMITTED', 'HANDOVER_PENDING', 'HANDED_OVER')) DEFAULT 'DRAFT',
  packing_list_path TEXT,
  packing_list_filename TEXT,
  commercial_invoice_path TEXT,
  commercial_invoice_filename TEXT,
  created_by UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.goods_readiness IS '공급사 출고 준비(Goods Ready) 정보 헤더';

-- Enable RLS
ALTER TABLE public.goods_readiness ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goods_readiness FORCE ROW LEVEL SECURITY;


-- 3. Create goods_readiness_lines table (Line)
CREATE TABLE IF NOT EXISTS public.goods_readiness_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goods_readiness_id UUID NOT NULL REFERENCES public.goods_readiness (id) ON DELETE CASCADE,
  purchase_order_line_id UUID NOT NULL REFERENCES public.purchase_order_lines (id) ON DELETE RESTRICT,
  product_id UUID NOT NULL REFERENCES public.products (id) ON DELETE RESTRICT,
  ready_qty INTEGER NOT NULL CHECK (ready_qty >= 0),
  cartons INTEGER CHECK (cartons >= 0),
  gross_weight NUMERIC(10, 2) CHECK (gross_weight >= 0),
  cbm NUMERIC(10, 3) CHECK (cbm >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT goods_ready_po_line_unique UNIQUE (goods_readiness_id, purchase_order_line_id)
);

COMMENT ON TABLE public.goods_readiness_lines IS '공급사 출고 준비 상세 수량 정보';

-- Enable RLS
ALTER TABLE public.goods_readiness_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goods_readiness_lines FORCE ROW LEVEL SECURITY;


-- 4. Extend inbound_shipment_lines table to reference goods_readiness_lines
ALTER TABLE public.inbound_shipment_lines 
  ADD COLUMN IF NOT EXISTS goods_readiness_line_id UUID REFERENCES public.goods_readiness_lines (id) ON DELETE SET NULL;


-- 5. Security helper function: auth_owns_goods_readiness
CREATE OR REPLACE FUNCTION public.auth_owns_goods_readiness(gr_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.goods_readiness
    WHERE id = gr_id AND supplier_id = public.auth_company_id()
  );
$$;

GRANT EXECUTE ON FUNCTION public.auth_owns_goods_readiness(UUID) TO authenticated;


-- 6. Setup RLS SELECT policies for portal users
DROP POLICY IF EXISTS "goods_readiness_portal_select" ON public.goods_readiness;
CREATE POLICY "goods_readiness_portal_select"
  ON public.goods_readiness FOR SELECT
  TO authenticated
  USING (supplier_id = public.auth_company_id());

DROP POLICY IF EXISTS "goods_readiness_lines_portal_select" ON public.goods_readiness_lines;
CREATE POLICY "goods_readiness_lines_portal_select"
  ON public.goods_readiness_lines FOR SELECT
  TO authenticated
  USING (public.auth_owns_goods_readiness(goods_readiness_id));

-- Admin policies
DROP POLICY IF EXISTS "goods_readiness_admin_all" ON public.goods_readiness;
CREATE POLICY "goods_readiness_admin_all"
  ON public.goods_readiness FOR ALL
  TO authenticated
  USING (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());

DROP POLICY IF EXISTS "goods_readiness_lines_admin_all" ON public.goods_readiness_lines;
CREATE POLICY "goods_readiness_lines_admin_all"
  ON public.goods_readiness_lines FOR ALL
  TO authenticated
  USING (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());


-- 7. Explicitly revoke raw write access from authenticated role (writes must use secure Server Actions)
REVOKE INSERT, UPDATE, DELETE ON public.goods_readiness FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.goods_readiness_lines FROM authenticated, anon;


-- 8. Update portal_inbound_shipments secure view to include shipping_responsibility and carrier
DROP VIEW IF EXISTS public.portal_inbound_shipments;
CREATE OR REPLACE VIEW public.portal_inbound_shipments WITH (security_barrier) AS
SELECT 
  id,
  shipment_number,
  purchase_order_id,
  status,
  shipping_method,
  shipping_responsibility,
  carrier,
  origin_port,
  destination_warehouse_id,
  etd,
  eta,
  actual_departure_date,
  actual_arrival_date,
  container_number,
  tracking_number,
  bill_of_lading,
  air_waybill,
  booking_number,
  created_at
FROM public.inbound_shipments
WHERE 
  public.auth_is_admin()
  OR
  (purchase_order_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.purchase_orders po
    WHERE po.id = purchase_order_id AND po.supplier_id = public.auth_company_id()
  ))
  OR
  EXISTS (
    SELECT 1 FROM public.inbound_shipment_lines isl
    JOIN public.purchase_order_lines pol ON isl.purchase_order_line_id = pol.id
    JOIN public.purchase_orders po ON pol.purchase_order_id = po.id
    WHERE isl.inbound_shipment_id = inbound_shipments.id AND po.supplier_id = public.auth_company_id()
  );

GRANT SELECT ON public.portal_inbound_shipments TO authenticated;
