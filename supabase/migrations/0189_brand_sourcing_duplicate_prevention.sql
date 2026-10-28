-- Migration: 0189_brand_sourcing_duplicate_prevention.sql
-- Task ID: ADM-BSRC-010-R1
-- Task Name: Brand Sourcing Duplicate Detection & Prevention (Production Hardening)
-- Standards: DEPLOY-STD-001, CONCURRENT-DEV-001, DEV-SQL-MIGRATION-STD-001, AGENTS.md Rule 24, Rule 27
-- Mode: Safe forward idempotent additive migration. No destructive alters, no table drops.

-- ------------------------------------------------------------------------------
-- 1. DETERMINISTIC NORMALIZATION FUNCTIONS
-- Implement identical normalization logic in SQL as application code.
-- ------------------------------------------------------------------------------

-- 1a. Canonical Sourcing URL Normalizer
CREATE OR REPLACE FUNCTION public.fn_normalize_sourcing_url(p_url text)
RETURNS text AS $$
DECLARE
  v_url text;
BEGIN
  IF p_url IS NULL THEN
    RETURN NULL;
  END IF;

  v_url := btrim(p_url);
  IF v_url = '' THEN
    RETURN NULL;
  END IF;

  -- Strip hash fragment (#... and #/...)
  v_url := regexp_replace(v_url, '#.*$', '');

  -- Strip trailing slashes
  v_url := regexp_replace(v_url, '/+$', '');

  -- Strip tracking parameters from query string (utm_*, ref, fbclid, gclid, etc.)
  -- Leading or sole tracking parameter: ?utm_source=...& -> ?
  v_url := regexp_replace(v_url, '(\?)(?:utm_[a-zA-Z0-9_]+|ref|fbclid|gclid|_hsenc|_hsmi|mc_cid|mc_eid|trk)=[^&#]*&?', '\1', 'gi');
  -- Middle or trailing tracking parameter: &utm_source=...
  v_url := regexp_replace(v_url, '&(?:utm_[a-zA-Z0-9_]+|ref|fbclid|gclid|_hsenc|_hsmi|mc_cid|mc_eid|trk)=[^&#]*', '', 'gi');
  -- Clean up trailing ? or &
  v_url := regexp_replace(v_url, '[?&]+$', '');

  -- Final trailing slash strip
  v_url := regexp_replace(v_url, '/+$', '');

  IF v_url = '' THEN
    RETURN NULL;
  END IF;

  RETURN v_url;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 1b. Korean Company Legal Name Normalizer
CREATE OR REPLACE FUNCTION public.fn_normalize_company_name_kr(p_name text)
RETURNS text AS $$
DECLARE
  v_norm text;
BEGIN
  IF p_name IS NULL THEN
    RETURN NULL;
  END IF;

  -- Strip legal company designations: (주), ㈜, 주식회사, (유), 유한회사, (합), 합자회사, 합명회사, (재), 재단법인, (사), 사단법인
  v_norm := regexp_replace(
    p_name,
    '\(주\)|㈜|주식회사|\(유\)|유한회사|\(합\)|합자회사|합명회사|\(재\)|재단법인|\(사\)|사단법인',
    '',
    'gi'
  );

  -- Strip common punctuation and brackets
  v_norm := regexp_replace(v_norm, '[\[\]\(\)\{\}\<\>\.,_\-\/\\]', '', 'g');

  -- Strip all whitespace
  v_norm := regexp_replace(v_norm, '\s+', '', 'g');

  -- Lowercase for alphanumeric parts
  v_norm := lower(v_norm);

  IF v_norm = '' THEN
    RETURN NULL;
  END IF;

  RETURN v_norm;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 1c. English Company Name Normalizer
CREATE OR REPLACE FUNCTION public.fn_normalize_company_name_en(p_name text)
RETURNS text AS $$
DECLARE
  v_norm text;
BEGIN
  IF p_name IS NULL THEN
    RETURN NULL;
  END IF;

  v_norm := lower(btrim(p_name));

  -- Strip corporate suffixes
  v_norm := regexp_replace(
    v_norm,
    '\s+(inc\.?|llc|co\.?,?\s*ltd\.?|ltd\.?|corp\.?|corporation|co\.?)$',
    '',
    'i'
  );

  -- Normalize punctuation and collapse whitespace
  v_norm := regexp_replace(v_norm, '[,\.\-_]', ' ', 'g');
  v_norm := btrim(regexp_replace(v_norm, '\s+', ' ', 'g'));

  IF v_norm = '' THEN
    RETURN NULL;
  END IF;

  RETURN v_norm;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ------------------------------------------------------------------------------
-- 2. EXTEND TABLE: sourcing_sources
-- Add canonical_source_url and automatic sync trigger.
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

-- Populate canonical_source_url for existing rows where null
UPDATE public.sourcing_sources
SET canonical_source_url = public.fn_normalize_sourcing_url(source_url)
WHERE canonical_source_url IS NULL AND source_url IS NOT NULL;

-- Automatic sync trigger for canonical_source_url
CREATE OR REPLACE FUNCTION public.fn_sync_sourcing_sources_canonical_url()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.source_url IS NOT NULL THEN
    NEW.canonical_source_url := public.fn_normalize_sourcing_url(NEW.source_url);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_sourcing_sources_canonical_url ON public.sourcing_sources;
CREATE TRIGGER trg_sync_sourcing_sources_canonical_url
  BEFORE INSERT OR UPDATE OF source_url
  ON public.sourcing_sources
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_sync_sourcing_sources_canonical_url();

-- Create lookup index on canonical_source_url
CREATE INDEX IF NOT EXISTS idx_sourcing_sources_canonical_url
  ON public.sourcing_sources(canonical_source_url);

-- Enforce uniqueness of canonical source URL per provider to prevent parallel duplicate insertion
-- Uses partial unique index so nulls are safely ignored
CREATE UNIQUE INDEX IF NOT EXISTS uq_sourcing_sources_canonical_url
  ON public.sourcing_sources(provider, canonical_source_url)
  WHERE canonical_source_url IS NOT NULL;

-- ------------------------------------------------------------------------------
-- 3. EXTEND TABLE: sourcing_companies
-- Add normalized company name columns and automatic sync trigger.
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

-- Populate normalized names for existing rows where null (preserves existing data)
UPDATE public.sourcing_companies
SET normalized_name_kr = public.fn_normalize_company_name_kr(company_name_kr)
WHERE normalized_name_kr IS NULL AND company_name_kr IS NOT NULL;

UPDATE public.sourcing_companies
SET normalized_name_en = public.fn_normalize_company_name_en(company_name_en)
WHERE normalized_name_en IS NULL AND company_name_en IS NOT NULL;

-- Automatic sync trigger for normalized names on company updates
CREATE OR REPLACE FUNCTION public.fn_sync_sourcing_companies_normalized_names()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.company_name_kr IS NOT NULL THEN
    NEW.normalized_name_kr := public.fn_normalize_company_name_kr(NEW.company_name_kr);
  END IF;
  IF NEW.company_name_en IS NOT NULL THEN
    NEW.normalized_name_en := public.fn_normalize_company_name_en(NEW.company_name_en);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_sourcing_companies_normalized_names ON public.sourcing_companies;
CREATE TRIGGER trg_sync_sourcing_companies_normalized_names
  BEFORE INSERT OR UPDATE OF company_name_kr, company_name_en
  ON public.sourcing_companies
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_sync_sourcing_companies_normalized_names();

CREATE INDEX IF NOT EXISTS idx_sourcing_companies_normalized_name_kr
  ON public.sourcing_companies(normalized_name_kr);

CREATE INDEX IF NOT EXISTS idx_sourcing_companies_normalized_name_en
  ON public.sourcing_companies(normalized_name_en);

-- ------------------------------------------------------------------------------
-- 4. NEW TABLE: sourcing_duplicate_exceptions
-- Stores explicit Admin exception authorizations when registering a distinct legal
-- entity that shares a company name or website domain with an existing company.
-- Protects audit history by enforcing ON DELETE RESTRICT on company relationships.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sourcing_duplicate_exceptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.sourcing_companies(id) ON DELETE RESTRICT,
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

-- Ensure ON DELETE RESTRICT is enforced even if table previously existed with CASCADE
DO $$
DECLARE
  v_conname TEXT;
  v_deltype CHAR;
BEGIN
  -- company_id FK
  SELECT conname, confdeltype INTO v_conname, v_deltype
  FROM pg_constraint
  WHERE conrelid = 'public.sourcing_duplicate_exceptions'::regclass
    AND contype = 'f'
    AND conkey = ARRAY[(
      SELECT attnum FROM pg_attribute
      WHERE attrelid = 'public.sourcing_duplicate_exceptions'::regclass
        AND attname = 'company_id'
    )];

  IF v_conname IS NOT NULL AND v_deltype <> 'r' THEN
    EXECUTE format('ALTER TABLE public.sourcing_duplicate_exceptions DROP CONSTRAINT %I', v_conname);
    ALTER TABLE public.sourcing_duplicate_exceptions
      ADD CONSTRAINT sourcing_duplicate_exceptions_company_id_fkey
      FOREIGN KEY (company_id) REFERENCES public.sourcing_companies(id) ON DELETE RESTRICT;
  END IF;

  -- matched_company_id FK
  SELECT conname, confdeltype INTO v_conname, v_deltype
  FROM pg_constraint
  WHERE conrelid = 'public.sourcing_duplicate_exceptions'::regclass
    AND contype = 'f'
    AND conkey = ARRAY[(
      SELECT attnum FROM pg_attribute
      WHERE attrelid = 'public.sourcing_duplicate_exceptions'::regclass
        AND attname = 'matched_company_id'
    )];

  IF v_conname IS NOT NULL AND v_deltype <> 'r' THEN
    EXECUTE format('ALTER TABLE public.sourcing_duplicate_exceptions DROP CONSTRAINT %I', v_conname);
    ALTER TABLE public.sourcing_duplicate_exceptions
      ADD CONSTRAINT sourcing_duplicate_exceptions_matched_company_id_fkey
      FOREIGN KEY (matched_company_id) REFERENCES public.sourcing_companies(id) ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_sourcing_dup_exceptions_company_id
  ON public.sourcing_duplicate_exceptions(company_id);

CREATE INDEX IF NOT EXISTS idx_sourcing_dup_exceptions_matched_id
  ON public.sourcing_duplicate_exceptions(matched_company_id);

CREATE INDEX IF NOT EXISTS idx_sourcing_dup_exceptions_created_at
  ON public.sourcing_duplicate_exceptions(created_at DESC);

-- ------------------------------------------------------------------------------
-- 5. PERMISSIONS & ADMIN-ONLY RLS
-- Explicit grants and strict auth_is_admin() RLS policy enforcement.
-- ------------------------------------------------------------------------------
REVOKE ALL ON public.sourcing_duplicate_exceptions FROM anon, public;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sourcing_duplicate_exceptions TO authenticated, service_role;

ALTER TABLE public.sourcing_duplicate_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sourcing_duplicate_exceptions FORCE ROW LEVEL SECURITY;

-- Clean up any legacy or overly permissive policies
DROP POLICY IF EXISTS "Allow authenticated read sourcing_duplicate_exceptions" ON public.sourcing_duplicate_exceptions;
DROP POLICY IF EXISTS "Allow authenticated insert sourcing_duplicate_exceptions" ON public.sourcing_duplicate_exceptions;
DROP POLICY IF EXISTS "sourcing_dup_exceptions_admin_all" ON public.sourcing_duplicate_exceptions;

-- Strict Admin-only policy using verified canonical auth_is_admin()
CREATE POLICY "sourcing_dup_exceptions_admin_all"
  ON public.sourcing_duplicate_exceptions
  FOR ALL
  TO authenticated
  USING (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());
