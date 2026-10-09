-- ADM-TRD-VIS-002: Trading Products Hub Visibility Policy Simplification & Existing Data Normalization
-- Enforces authoritative operational status & visibility rules:
-- 1. Inactive or Historical trading_status -> retailer_visibility MUST be 'hidden'
-- 2. Normalizes any legacy contradicting visibility records in DB

-- 1. Force hidden for inactive / historical trading products
UPDATE public.products
SET retailer_visibility = 'hidden'
WHERE trading_status IN ('inactive', 'historical');

-- 2. Force hidden for active products missing essential wholesale price, retail price, or MOQ
UPDATE public.products
SET retailer_visibility = 'hidden'
WHERE retailer_visibility = 'visible'
  AND (
    (trading_wholesale_price IS NULL OR trading_wholesale_price <= 0)
    OR (price_krw_retail IS NULL OR price_krw_retail <= 0) AND (estimated_retail_price IS NULL OR estimated_retail_price <= 0)
    OR (carton_pack_qty IS NULL OR carton_pack_qty <= 0)
  );
