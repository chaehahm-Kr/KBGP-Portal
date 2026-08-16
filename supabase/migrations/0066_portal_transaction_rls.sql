-- 0066_portal_transaction_rls.sql — Enable Portal RLS SELECT policies for PO, Shipment, and Receiving tables

-- 1. purchase_orders
DROP POLICY IF EXISTS "purchase_orders_portal_select" ON public.purchase_orders;
CREATE POLICY "purchase_orders_portal_select"
  ON public.purchase_orders
  FOR SELECT
  TO authenticated
  USING (supplier_id = public.auth_company_id());

-- 2. purchase_order_lines
DROP POLICY IF EXISTS "purchase_order_lines_portal_select" ON public.purchase_order_lines;
CREATE POLICY "purchase_order_lines_portal_select"
  ON public.purchase_order_lines
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.purchase_orders po
    WHERE po.id = purchase_order_id AND po.supplier_id = public.auth_company_id()
  ));

-- 3. inbound_shipments
DROP POLICY IF EXISTS "inbound_shipments_portal_select" ON public.inbound_shipments;
CREATE POLICY "inbound_shipments_portal_select"
  ON public.inbound_shipments
  FOR SELECT
  TO authenticated
  USING (
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
    )
  );

-- 4. inbound_shipment_lines
DROP POLICY IF EXISTS "inbound_shipment_lines_portal_select" ON public.inbound_shipment_lines;
CREATE POLICY "inbound_shipment_lines_portal_select"
  ON public.inbound_shipment_lines
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.purchase_order_lines pol
    JOIN public.purchase_orders po ON pol.purchase_order_id = po.id
    WHERE pol.id = purchase_order_line_id AND po.supplier_id = public.auth_company_id()
  ));

-- 5. receivings
DROP POLICY IF EXISTS "receivings_portal_select" ON public.receivings;
CREATE POLICY "receivings_portal_select"
  ON public.receivings
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.purchase_orders po
    WHERE po.id = purchase_order_id AND po.supplier_id = public.auth_company_id()
  ));

-- 6. receiving_lines
DROP POLICY IF EXISTS "receiving_lines_portal_select" ON public.receiving_lines;
CREATE POLICY "receiving_lines_portal_select"
  ON public.receiving_lines
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.purchase_order_lines pol
    JOIN public.purchase_orders po ON pol.purchase_order_id = po.id
    WHERE pol.id = purchase_order_line_id AND po.supplier_id = public.auth_company_id()
  ));
