-- Migration: 0192_brand_sourcing_company_phone.sql
-- Task ID: ADM-BSRC-013-R1
-- Description: Add company_phone column to sourcing_companies table for corporate-level contact phone numbers
-- Standards: DEPLOY-STD-001, CONCURRENT-DEV-001, DEV-SQL-MIGRATION-STD-001, AGENTS.md Rule 27

DO $$
BEGIN
  -- Add company_phone column to sourcing_companies if it does not exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sourcing_companies'
      AND column_name = 'company_phone'
  ) THEN
    ALTER TABLE public.sourcing_companies
      ADD COLUMN company_phone TEXT;
    
    COMMENT ON COLUMN public.sourcing_companies.company_phone IS 'Corporate legal entity phone number, distinct from individual contact phones.';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
