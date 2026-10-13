-- Migration 0159: Add billing override flags to retailer_profiles
-- Purpose: Unify authoritative Company Core vs Retailer Billing Address and Primary Contact vs Billing Contact

ALTER TABLE public.retailer_profiles
  ADD COLUMN IF NOT EXISTS billing_same_as_hq BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS billing_contact_same_as_primary BOOLEAN NOT NULL DEFAULT true;

-- Data Preservation Strategy for existing records:
-- If an existing retailer has billing_address set and it does not match company HQ address (or company HQ address is NULL),
-- treat it safely as an explicit separate billing address override (billing_same_as_hq = false).
UPDATE public.retailer_profiles rp
SET billing_same_as_hq = false
FROM public.companies c
WHERE rp.company_id = c.id
  AND rp.billing_address IS NOT NULL
  AND TRIM(rp.billing_address) != ''
  AND (c.address_1 IS NULL OR TRIM(c.address_1) = '' OR TRIM(c.address_1) != TRIM(rp.billing_address));

-- If billing_contact_name is set and does not match company contact_name,
-- treat it safely as an explicit separate billing contact override (billing_contact_same_as_primary = false).
UPDATE public.retailer_profiles rp
SET billing_contact_same_as_primary = false
FROM public.companies c
WHERE rp.company_id = c.id
  AND rp.billing_contact_name IS NOT NULL
  AND TRIM(rp.billing_contact_name) != ''
  AND (c.contact_name IS NULL OR TRIM(c.contact_name) = '' OR TRIM(c.contact_name) != TRIM(rp.billing_contact_name));
