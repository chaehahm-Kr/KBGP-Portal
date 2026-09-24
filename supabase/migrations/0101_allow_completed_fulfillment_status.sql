-- Migration 0101: Update purchase_orders_fulfillment_status_check constraint to include 'COMPLETED' and 'PARTIALLY_RECEIVED'

ALTER TABLE purchase_orders 
  DROP CONSTRAINT IF EXISTS purchase_orders_fulfillment_status_check;

ALTER TABLE purchase_orders 
  ADD CONSTRAINT purchase_orders_fulfillment_status_check 
  CHECK (fulfillment_status IN ('PENDING', 'IN_PRODUCTION', 'READY_TO_SHIP', 'SHIPPED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'COMPLETED'));
