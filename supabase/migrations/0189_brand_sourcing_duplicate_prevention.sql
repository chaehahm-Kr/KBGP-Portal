-- Migration: 0189_brand_sourcing_duplicate_prevention.sql
-- Task ID: ADM-BSRC-010
-- Task Name: Brand Sourcing Duplicate Detection & Prevention
-- Standards: DEPLOY-STD-001, CONCURRENT-DEV-001, DEV-SQL-MIGRATION-STD-001, AGENTS.md Rule 24
-- Mode: Safe forward idempotent additive migration. No destructive alters, no table drops.

-- ------------------------------------------------------------------------------
-- 1. EXTEND TABLE: sourcing_sources
-- Add canonical_source_url for deterministic duplicate URL detection and uniqueness.
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sourcing_sources'
      AND column_name = 'canonical_source_url'
  ) THEN
    ALTER TABLE public.sourcing_sources ADD COLUMN canonical_source_url TEXT;
  END IF;
END $$;

-- Populate canonical_source_url for existing rows where null (strip trailing slashes and hash fragments)
UPDATE public.sourcing_sources
SET canonical_source_url = regexp_replace(regexp_replace(source_url, '#.*$', ''), '/+$', '')
WHERE canonical_source_url IS NULL AND source_url IS NOT NULL;

-- Create performance & lookup indexes on canonical_source_url
CREATE INDEX IF NOT EXISTS idx_sourcing_sources_canonical_url
  ON public.sourcing_sources(canonical_source_url);

-- Enforce uniqueness of canonical source URL per provider to prevent parallel duplicate insertion
-- Uses partial unique index so nulls are ignored if any legacy records lack source URLs
CREATE UNIQUE INDEX IF NOT EXISTS uq_sourcing_sources_canonical_url
  ON public.sourcing_sources(provider, canonical_source_url)
  WHERE canonical_source_url IS NOT NULL;

-- ------------------------------------------------------------------------------
-- 2. EXTEND TABLE: sourcing_companies
-- Add normalized company name columns for fast server-side duplicate matching.
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sourcing_companies'
      AND column_name = 'normalized_name_kr'
  ) THEN
    ALTER TABLE public.sourcing_companies ADD COLUMN normalized_name_kr TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sourcing_companies'
      AND column_name = 'normalized_name_en'
  ) THEN
    ALTER TABLE public.sourcing_companies ADD COLUMN normalized_name_en TEXT;
  END IF;
END $$;

-- Populate normalized names for existing rows
UPDATE public.sourcing_companies
SET normalized_name_kr = regexp_replace(
  regexp_replace(
    regexp_replace(company_name_kr, '\(주\)|\㈜|\주식회사|\(유\)|\유한회사|\(합\)|\합자회사|\합명회사', '', 'g'),
    '\s+', '', 'g'
  ),
  '^\s+|\s+$', '', 'g'
)
WHERE normalized_name_kr IS NULL AND company_name_kr IS NOT NULL;

UPDATE public.sourcing_companies
SET normalized_name_en = lower(
  regexp_replace(
    regexp_replace(
      company_name_en,
      '\s+(inc\.?|llc|co\.?,?\s*ltd\.?|ltd\.?|corp\.?|corporation|co\.?)$', '', 'i'
    ),
    '^\s+|\s+$', '', 'g'
  )
)
WHERE normalized_name_en IS NULL AND company_name_en IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sourcing_companies_normalized_name_kr
  ON public.sourcing_companies(normalized_name_kr);

CREATE INDEX IF NOT EXISTS idx_sourcing_companies_normalized_name_en
  ON public.sourcing_companies(normalized_name_en);

-- ------------------------------------------------------------------------------
-- 3. NEW TABLE: sourcing_duplicate_exceptions
-- Stores explicit Admin exception authorizations when registering a distinct legal
-- entity that shares a company name or website domain with an existing company.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sourcing_duplicate_exceptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.sourcing_companies(id) ON DELETE CASCADE,
  matched_company_id UUID NOT NULL REFERENCES public.sourcing_companies(id) ON DELETE RESTRICT,
  matched_rule VARCHAR(64) NOT NULL CHECK (matched_rule IN (
    'SAME_NAME_KR',
    'SAME_NAME_EN',
    'SAME_DOMAIN',
    'SIMILAR_NAME',
    'OTHER'
  )),
  reason TEXT NOT NULL,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sourcing_dup_exceptions_company_id
  ON public.sourcing_duplicate_exceptions(company_id);

CREATE INDEX IF NOT EXISTS idx_sourcing_dup_exceptions_matched_id
  ON public.sourcing_duplicate_exceptions(matched_company_id);

CREATE INDEX IF NOT EXISTS idx_sourcing_dup_exceptions_created_at
  ON public.sourcing_duplicate_exceptions(created_at DESC);

-- Privileges & RLS
GRANT SELECT, INSERT, UPDATE ON public.sourcing_duplicate_exceptions TO authenticated, service_role;

ALTER TABLE public.sourcing_duplicate_exceptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read sourcing_duplicate_exceptions"
  ON public.sourcing_duplicate_exceptions
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated insert sourcing_duplicate_exceptions"
  ON public.sourcing_duplicate_exceptions
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
