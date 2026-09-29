-- 0124_product_carton_default_and_unique_indexes.sql
-- 1. Remove DEFAULT 1 from products.carton_pack_qty
ALTER TABLE public.products ALTER COLUMN carton_pack_qty DROP DEFAULT;
ALTER TABLE public.products ALTER COLUMN carton_pack_qty SET DEFAULT NULL;

-- 2. Add Unique Index on (company_id, UPPER(TRIM(manufacture_sku))) where manufacture_sku is not empty
CREATE UNIQUE INDEX IF NOT EXISTS products_company_id_manufacture_sku_unique 
  ON public.products (company_id, UPPER(TRIM(manufacture_sku))) 
  WHERE manufacture_sku IS NOT NULL AND TRIM(manufacture_sku) != '';

-- 3. Add Unique Index on TRIM(ean) where ean is not empty
CREATE UNIQUE INDEX IF NOT EXISTS products_ean_unique 
  ON public.products (TRIM(ean)) 
  WHERE ean IS NOT NULL AND TRIM(ean) != '';
