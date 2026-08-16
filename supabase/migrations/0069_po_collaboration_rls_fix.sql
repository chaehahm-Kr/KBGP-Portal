-- 0069_po_collaboration_rls_fix.sql — Create security definer helper functions for PO ownership and update RLS policies

-- 1. Helper function: auth_owns_po
CREATE OR REPLACE FUNCTION public.auth_owns_po(po_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.purchase_orders
    WHERE id = po_id AND supplier_id = public.auth_company_id()
  );
$$;

GRANT EXECUTE ON FUNCTION public.auth_owns_po(UUID) TO authenticated;

-- 2. Helper function: auth_owns_po_line
CREATE OR REPLACE FUNCTION public.auth_owns_po_line(line_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.purchase_order_lines pol
    JOIN public.purchase_orders po ON pol.purchase_order_id = po.id
    WHERE pol.id = line_id AND po.supplier_id = public.auth_company_id()
  );
$$;

GRANT EXECUTE ON FUNCTION public.auth_owns_po_line(UUID) TO authenticated;


-- 3. Update purchase_order_lines policies
DROP POLICY IF EXISTS "purchase_order_lines_portal_select" ON public.purchase_order_lines;
CREATE POLICY "purchase_order_lines_portal_select"
  ON public.purchase_order_lines FOR SELECT
  TO authenticated
  USING (public.auth_owns_po_line(id));

DROP POLICY IF EXISTS "purchase_order_lines_portal_update" ON public.purchase_order_lines;
CREATE POLICY "purchase_order_lines_portal_update"
  ON public.purchase_order_lines FOR UPDATE
  TO authenticated
  USING (public.auth_owns_po_line(id))
  WITH CHECK (public.auth_owns_po_line(id));


-- 4. Update inbound_shipment_lines policies
DROP POLICY IF EXISTS "inbound_shipment_lines_portal_select" ON public.inbound_shipment_lines;
CREATE POLICY "inbound_shipment_lines_portal_select"
  ON public.inbound_shipment_lines FOR SELECT
  TO authenticated
  USING (public.auth_owns_po_line(purchase_order_line_id));


-- 5. Update receiving_lines policies
DROP POLICY IF EXISTS "receiving_lines_portal_select" ON public.receiving_lines;
CREATE POLICY "receiving_lines_portal_select"
  ON public.receiving_lines FOR SELECT
  TO authenticated
  USING (public.auth_owns_po_line(purchase_order_line_id));


-- 6. Update purchase_order_change_requests policies
DROP POLICY IF EXISTS "change_requests_portal_select" ON public.purchase_order_change_requests;
CREATE POLICY "change_requests_portal_select"
  ON public.purchase_order_change_requests FOR SELECT
  TO authenticated
  USING (requested_by_company_id = public.auth_company_id());

DROP POLICY IF EXISTS "change_requests_portal_insert" ON public.purchase_order_change_requests;
CREATE POLICY "change_requests_portal_insert"
  ON public.purchase_order_change_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    requested_by_company_id = public.auth_company_id() 
    AND public.auth_owns_po(purchase_order_id)
    AND (purchase_order_line_id IS NULL OR public.auth_owns_po_line(purchase_order_line_id))
  );

DROP POLICY IF EXISTS "change_requests_portal_update" ON public.purchase_order_change_requests;
CREATE POLICY "change_requests_portal_update"
  ON public.purchase_order_change_requests FOR UPDATE
  TO authenticated
  USING (requested_by_company_id = public.auth_company_id() AND status = 'PENDING')
  WITH CHECK (requested_by_company_id = public.auth_company_id() AND status = 'PENDING');
