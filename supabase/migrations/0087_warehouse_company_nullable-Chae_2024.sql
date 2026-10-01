-- 0087_warehouse_company_nullable.sql
-- ADM-WHS-001: Warehouse Company Link Optional Logic (Allow own warehouses without company)

-- 1. Make company_id nullable
ALTER TABLE public.warehouses ALTER COLUMN company_id DROP NOT NULL;
ALTER TABLE public.warehouses ALTER COLUMN company_id SET DEFAULT NULL;

-- 2. Unique index for default receiving warehouse among own / null-company warehouses
CREATE UNIQUE INDEX IF NOT EXISTS idx_warehouses_default_receiving_null_company
  ON public.warehouses ((company_id IS NULL))
  WHERE (company_id IS NULL AND is_default_receiving = true);
