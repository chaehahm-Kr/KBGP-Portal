-- Migration: 0193_marketing_campaign_manual_recipients.sql
-- Task ID: ADM-BSRC-009-R5
-- Description: Allow standalone manual email recipients by relaxing company_id and company_name_kr NOT NULL constraints on marketing_campaign_recipients
-- Standards: DEPLOY-STD-001, CONCURRENT-DEV-001, DEV-SQL-MIGRATION-STD-001
-- Mode: Additive schema change for QA ONLY. DO NOT APPLY TO PRODUCTION SUPABASE.

-- 1. Relax company_id constraint to allow null values for standalone manual emails
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'marketing_campaign_recipients' 
      AND column_name = 'company_id' 
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.marketing_campaign_recipients 
      ALTER COLUMN company_id DROP NOT NULL;
  END IF;
END $$;

-- 2. Relax company_name_kr constraint to allow null values for standalone manual emails
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'marketing_campaign_recipients' 
      AND column_name = 'company_name_kr' 
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.marketing_campaign_recipients 
      ALTER COLUMN company_name_kr DROP NOT NULL;
  END IF;
END $$;
