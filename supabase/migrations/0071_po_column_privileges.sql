-- 0071_po_column_privileges.sql — Configure column-level privileges and SELECT RLS on PO, Shipment, and Receiving tables

-- 1. Create SELECT RLS policies on raw tables for portal users (required for UPDATE queries to match rows)
DROP POLICY IF EXISTS "purchase_orders_portal_select" ON public.purchase_orders;
CREATE POLICY "purchase_orders_portal_select"
  ON public.purchase_orders FOR SELECT
  TO authenticated
  USING (supplier_id = public.auth_company_id());

DROP POLICY IF EXISTS "inbound_shipments_portal_select" ON public.inbound_shipments;
CREATE POLICY "inbound_shipments_portal_select"
  ON public.inbound_shipments FOR SELECT
  TO authenticated
  USING (
    (purchase_order_id IS NOT NULL AND public.auth_owns_po(purchase_order_id))
    OR
    EXISTS (
      SELECT 1 FROM public.inbound_shipment_lines isl
      WHERE isl.inbound_shipment_id = inbound_shipments.id AND public.auth_owns_po_line(isl.purchase_order_line_id)
    )
  );

DROP POLICY IF EXISTS "receivings_portal_select" ON public.receivings;
CREATE POLICY "receivings_portal_select"
  ON public.receivings FOR SELECT
  TO authenticated
  USING (public.auth_owns_po(purchase_order_id));


-- 2. Restrict column-level SELECT on purchase_orders
REVOKE SELECT ON public.purchase_orders FROM authenticated;
GRANT SELECT (
  id, po_number, supplier_id, order_date, po_status, fulfillment_status, supplier_confirmation_status, 
  currency, payment_terms, incoterms, port_of_loading, expected_ready_date, expected_ship_date, 
  destination_warehouse_id, ship_from_warehouse_id, po_receiving_email, supplier_facing_note, created_at, updated_at
) ON public.purchase_orders TO authenticated;


-- 3. Restrict column-level SELECT on inbound_shipments
REVOKE SELECT ON public.inbound_shipments FROM authenticated;
GRANT SELECT (
  id, shipment_number, purchase_order_id, status, shipping_method, origin_port, destination_warehouse_id, 
  etd, eta, actual_departure_date, actual_arrival_date, container_number, tracking_number, 
  bill_of_lading, air_waybill, booking_number, created_at, updated_at
) ON public.inbound_shipments TO authenticated;


-- 4. Restrict column-level SELECT on receivings
REVOKE SELECT ON public.receivings FROM authenticated;
GRANT SELECT (
  id, receiving_number, inbound_shipment_id, purchase_order_id, warehouse_id, received_date, status, created_at, updated_at
) ON public.receivings TO authenticated;
