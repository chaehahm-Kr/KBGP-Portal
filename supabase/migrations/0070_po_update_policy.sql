-- 0070_po_update_policy.sql — Allow portal users to update supplier_confirmation_status on their own POs

DROP POLICY IF EXISTS "purchase_orders_portal_update" ON public.purchase_orders;
CREATE POLICY "purchase_orders_portal_update"
  ON public.purchase_orders FOR UPDATE
  TO authenticated
  USING (supplier_id = public.auth_company_id())
  WITH CHECK (supplier_id = public.auth_company_id());
