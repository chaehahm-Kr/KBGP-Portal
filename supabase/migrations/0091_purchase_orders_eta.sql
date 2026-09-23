-- 0091_purchase_orders_eta.sql — Add ETA column to purchase_orders table

ALTER TABLE public.purchase_orders
ADD COLUMN IF NOT EXISTS eta DATE;

COMMENT ON COLUMN public.purchase_orders.eta IS '예상 도착일 (Estimated Time of Arrival)';
