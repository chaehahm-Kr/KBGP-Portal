-- 0074_update_portal_views.sql — Update secure views and column-level privileges

-- Drop views to allow schema/column changes
DROP VIEW IF EXISTS public.portal_purchase_orders CASCADE;
DROP VIEW IF EXISTS public.portal_inbound_shipments CASCADE;

-- 1. Grant SELECT on missing columns on inbound_shipments to authenticated
GRANT SELECT (shipping_responsibility, carrier) ON public.inbound_shipments TO authenticated;

-- 2. Re-create portal_purchase_orders view with all required fields
CREATE OR REPLACE VIEW public.portal_purchase_orders WITH (security_barrier) AS
SELECT 
  id,
  po_number,
  supplier_id,
  order_date,
  po_status,
  fulfillment_status,
  supplier_confirmation_status,
  currency,
  payment_terms,
  incoterms,
  port_of_loading,
  expected_ready_date,
  expected_ship_date,
  destination_warehouse_id,
  ship_from_warehouse_id,
  po_receiving_email,
  supplier_facing_note,
  created_at,
  updated_at
FROM public.purchase_orders
WHERE 
  public.auth_is_admin()
  OR 
  supplier_id = public.auth_company_id();

-- 3. Re-create portal_inbound_shipments view with all required fields
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
  shipping_responsibility,
  carrier,
  created_at,
  updated_at
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

-- 4. Re-grant select permissions
GRANT SELECT ON public.portal_purchase_orders TO authenticated;
GRANT SELECT ON public.portal_inbound_shipments TO authenticated;
