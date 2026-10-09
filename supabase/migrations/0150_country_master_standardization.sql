-- ADM-COUNTRY-001: Country Master Standardization & Existing Data Normalization
-- Normalizes existing localized, alias, and abbreviation country strings to standard English canonical country names.

-- 1. Normalize products origin
UPDATE public.products
SET origin = 'South Korea'
WHERE origin IN ('대한민국', '한국', 'Korea', 'Republic of Korea', 'KR', 'kor', 'south korea');

UPDATE public.products
SET origin = 'United States'
WHERE origin IN ('미국', 'USA', 'U.S.A.', 'US', 'u.s.a.', 'usa', 'united states');

UPDATE public.products
SET origin = 'China'
WHERE origin IN ('중국', 'PRC', 'P.R.C.', 'CN', 'china');

UPDATE public.products
SET origin = 'Japan'
WHERE origin IN ('일본', 'Japan', 'JP', 'japan');

-- 2. Normalize companies country
UPDATE public.companies
SET country = 'South Korea'
WHERE country IN ('대한민국', '한국', 'Korea', 'Republic of Korea', 'KR', 'kor', 'south korea');

UPDATE public.companies
SET country = 'United States'
WHERE country IN ('미국', 'USA', 'U.S.A.', 'US', 'u.s.a.', 'usa', 'united states');

UPDATE public.companies
SET country = 'China'
WHERE country IN ('중국', 'PRC', 'P.R.C.', 'CN', 'china');

UPDATE public.companies
SET country = 'Japan'
WHERE country IN ('일본', 'Japan', 'JP', 'japan');

-- 3. Normalize warehouses country
UPDATE public.warehouses
SET country = 'South Korea'
WHERE country IN ('대한민국', '한국', 'Korea', 'Republic of Korea', 'KR', 'kor', 'south korea');

UPDATE public.warehouses
SET country = 'United States'
WHERE country IN ('미국', 'USA', 'U.S.A.', 'US', 'u.s.a.', 'usa', 'united states');

-- 4. Normalize company_shipping_origins country (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'company_shipping_origins') THEN
    UPDATE public.company_shipping_origins
    SET country = 'South Korea'
    WHERE country IN ('대한민국', '한국', 'Korea', 'Republic of Korea', 'KR', 'kor', 'south korea');

    UPDATE public.company_shipping_origins
    SET country = 'United States'
    WHERE country IN ('미국', 'USA', 'U.S.A.', 'US', 'u.s.a.', 'usa', 'united states');
  END IF;
END $$;
