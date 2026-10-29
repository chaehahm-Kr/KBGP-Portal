-- Migration: 0191_brand_sourcing_multi_source_providers.sql
-- Task ID: ADM-BSRC-014
-- Description: Expand sourcing_sources provider check constraint to support INDIE_BEAUTY_SHOW and future exhibition providers
-- Standards: DEPLOY-STD-001, CONCURRENT-DEV-001, DEV-SQL-MIGRATION-STD-001, AGENTS.md Rule 27

DO $$
BEGIN
  -- 1. Drop existing provider check constraint if present
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.sourcing_sources'::regclass
      AND conname = 'sourcing_sources_provider_check'
  ) THEN
    ALTER TABLE public.sourcing_sources DROP CONSTRAINT sourcing_sources_provider_check;
  END IF;

  -- 2. Add expanded provider check constraint supporting INDIE_BEAUTY_SHOW
  ALTER TABLE public.sourcing_sources
    ADD CONSTRAINT sourcing_sources_provider_check
    CHECK (provider IN ('INTERCHARM', 'COSMOPROF', 'INDIE_BEAUTY_SHOW', 'MANUAL', 'OTHER'));

  -- 3. Ensure source_url is nullable for manual entries where no exhibition URL exists
  ALTER TABLE public.sourcing_sources
    ALTER COLUMN source_url DROP NOT NULL;
END $$;

NOTIFY pgrst, 'reload schema';
