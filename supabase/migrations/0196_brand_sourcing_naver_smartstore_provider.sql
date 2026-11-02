-- Migration: 0196_brand_sourcing_naver_smartstore_provider.sql
-- Task ID: ADM-BSRC-NAVER-001
-- Description: Align sourcing_sources provider check constraint with Production allowed values
-- Standards: DEPLOY-STD-001, CONCURRENT-DEV-001, DEV-SQL-MIGRATION-STD-001, AGENTS.md Rule 24 & Rule 27

ALTER TABLE public.sourcing_sources DROP CONSTRAINT IF EXISTS sourcing_sources_provider_check;

ALTER TABLE public.sourcing_sources
  ADD CONSTRAINT sourcing_sources_provider_check
  CHECK (provider IN (
    'INTERCHARM',
    'COSMOPROF',
    'INDIE_BEAUTY_SHOW',
    'MANUAL',
    'OTHER',
    'NAVER_SMARTSTORE'
  ));

NOTIFY pgrst, 'reload schema';
