-- 0037_add_product_selling_fields.sql
-- Add selling status and link fields to products table

ALTER TABLE products ADD COLUMN selling_online boolean NOT NULL DEFAULT false;
ALTER TABLE products ADD COLUMN selling_offline boolean NOT NULL DEFAULT false;
ALTER TABLE products ADD COLUMN sales_link_1 text;
ALTER TABLE products ADD COLUMN sales_link_2 text;
