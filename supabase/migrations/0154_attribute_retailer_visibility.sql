-- 0154_attribute_retailer_visibility.sql
-- Add retailer_visible column to public.attributes table for authoritative visibility control in Retailer Portal Specifications

ALTER TABLE public.attributes 
ADD COLUMN IF NOT EXISTS retailer_visible boolean NOT NULL DEFAULT true;

-- Ensure admin_only attributes are default hidden from retailer portal
UPDATE public.attributes
SET retailer_visible = false
WHERE admin_only = true;

COMMENT ON COLUMN public.attributes.retailer_visible IS 'Controls whether this attribute is visible to retailers in the Retailer Portal Specifications tab (true: visible, false: hidden)';
