-- 0088_warehouse_partner_type.sql
-- ADM-WHS-001-R1: Add 'partner' type to warehouses.type check constraint

ALTER TABLE public.warehouses DROP CONSTRAINT IF EXISTS warehouses_type_check;
ALTER TABLE public.warehouses ADD CONSTRAINT warehouses_type_check CHECK (type IN ('own', '3pl', 'partner', 'other'));

COMMENT ON COLUMN public.warehouses.type IS '창고 유형: own (자사 창고), 3pl (3PL 물류 창고), partner (파트너 창고), other (기타)';
