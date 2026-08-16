-- 0072_po_strict_write_privileges.sql — Restrict write privileges to the absolute minimum columns and tables for portal users

-- 1. Restrict UPDATE on purchase_orders to 'supplier_confirmation_status' column only
REVOKE UPDATE ON public.purchase_orders FROM authenticated, anon;
GRANT UPDATE (supplier_confirmation_status) ON public.purchase_orders TO authenticated;

-- 2. Restrict UPDATE on purchase_order_lines to 'confirmed_qty' column only
REVOKE UPDATE ON public.purchase_order_lines FROM authenticated, anon;
GRANT UPDATE (confirmed_qty) ON public.purchase_order_lines TO authenticated;

-- 3. Restrict UPDATE on purchase_order_change_requests to 'status' column only
REVOKE UPDATE ON public.purchase_order_change_requests FROM authenticated, anon;
GRANT UPDATE (status) ON public.purchase_order_change_requests TO authenticated;

-- 4. Explicitly revoke write permissions on Inbound Shipments (View Only)
REVOKE INSERT, UPDATE, DELETE ON public.inbound_shipments FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.inbound_shipment_lines FROM authenticated, anon;

-- 5. Explicitly revoke write permissions on Receivings (View Only)
REVOKE INSERT, UPDATE, DELETE ON public.receivings FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.receiving_lines FROM authenticated, anon;
