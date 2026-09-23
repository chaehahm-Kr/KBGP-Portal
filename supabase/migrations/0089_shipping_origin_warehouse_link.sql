-- 0089_shipping_origin_warehouse_link.sql
-- Task IDs: ADM-WHS-002, PORT-CMP-001-R1
-- Description: Link Company Shipping Origins to Warehouses with duplicate prevention and cascade-safe nullification

-- 1. Add shipping_origin_id column to warehouses
ALTER TABLE public.warehouses 
  ADD COLUMN IF NOT EXISTS shipping_origin_id uuid REFERENCES public.company_shipping_origins(id) ON DELETE SET NULL;

-- 2. Create unique index: at most 1 active warehouse link per shipping origin
CREATE UNIQUE INDEX IF NOT EXISTS idx_warehouses_shipping_origin_id 
  ON public.warehouses (shipping_origin_id) 
  WHERE (shipping_origin_id IS NOT NULL);

-- 3. Add column comment
COMMENT ON COLUMN public.warehouses.shipping_origin_id IS '연결된 회사 출고지 ID (Company Shipping Origin Link)';
