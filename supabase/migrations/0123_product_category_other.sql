-- 0123_product_category_other.sql
-- Add 'other' to products.category check constraint

ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_category_check;
ALTER TABLE public.products ADD CONSTRAINT products_category_check 
  CHECK (category IN ('skincare', 'hair_scalp', 'beauty_tools', 'daily_care', 'wellness_patch', 'other'));
