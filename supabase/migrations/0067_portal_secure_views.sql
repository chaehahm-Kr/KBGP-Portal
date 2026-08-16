-- 0067_portal_secure_views.sql — Drop direct portal SELECT policies on headers and create secure company-isolated views

-- 1. Drop direct portal SELECT policies on raw header tables
DROP POLICY IF EXISTS "purchase_orders_portal_select" ON public.purchase_orders;
DROP POLICY IF EXISTS "inbound_shipments_portal_select" ON public.inbound_shipments;
DROP POLICY IF EXISTS "receivings_portal_select" ON public.receivings;

-- 2. Create portal_purchase_orders view with security_barrier and column-level restriction
CREATE OR REPLACE VIEW public.portal_purchase_orders WITH (security_barrier) AS
SELECT 
  id,
  po_number,
  supplier_id,
  order_date,
  po_status,
  fulfillment_status,
  currency,
  destination_warehouse_id,
  created_at
FROM public.purchase_orders
WHERE 
  public.auth_is_admin()
  OR 
  supplier_id = public.auth_company_id();

-- 3. Create portal_inbound_shipments view with security_barrier and column-level restriction
CREATE OR REPLACE VIEW public.portal_inbound_shipments WITH (security_barrier) AS
SELECT 
  id,
  shipment_number,
  purchase_order_id,
  status,
  shipping_method,
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

-- 4. Create portal_receivings view with security_barrier and column-level restriction
CREATE OR REPLACE VIEW public.portal_receivings WITH (security_barrier) AS
SELECT 
  id,
  receiving_number,
  inbound_shipment_id,
  purchase_order_id,
  warehouse_id,
  received_date,
  status,
  created_at
FROM public.receivings
WHERE 
  public.auth_is_admin()
  OR EXISTS (
    SELECT 1 FROM public.purchase_orders po
    WHERE po.id = purchase_order_id AND po.supplier_id = public.auth_company_id()
  );

-- 5. Grant access privileges on the new views to authenticated users
GRANT SELECT ON public.portal_purchase_orders TO authenticated;
GRANT SELECT ON public.portal_inbound_shipments TO authenticated;
GRANT SELECT ON public.portal_receivings TO authenticated;
