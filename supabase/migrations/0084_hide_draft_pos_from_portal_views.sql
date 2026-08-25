-- 0084_hide_draft_pos_from_portal_views.sql — Hide DRAFT purchase orders from Brand Portal

-- 1. Drop existing portal_purchase_orders view
DROP VIEW IF EXISTS public.portal_purchase_orders CASCADE;

-- 2. Re-create portal_purchase_orders view WITH (security_barrier)
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
  (supplier_id = public.auth_company_id() AND po_status <> 'DRAFT');

-- 3. Re-grant select permissions
GRANT SELECT ON public.portal_purchase_orders TO authenticated;
