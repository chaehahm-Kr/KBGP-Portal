-- Migration 0153: Add how_to_use column to products table for Product Catalog & Retailer Portal Overview
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS how_to_use text;
