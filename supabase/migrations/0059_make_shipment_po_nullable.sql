-- 0059_make_shipment_po_nullable.sql — Make Shipment PO ID Nullable for Multi-PO Readiness
--

ALTER TABLE public.inbound_shipments ALTER COLUMN purchase_order_id DROP NOT NULL;
