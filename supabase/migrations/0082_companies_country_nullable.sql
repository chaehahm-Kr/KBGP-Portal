-- 0082_companies_country_nullable.sql
-- PRT-CMP-INFO-002: Allow nullable country for companies without default fallback

ALTER TABLE public.companies ALTER COLUMN country DROP NOT NULL;
ALTER TABLE public.companies ALTER COLUMN country SET DEFAULT NULL;
