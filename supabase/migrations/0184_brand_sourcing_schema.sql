-- Migration: 0184_brand_sourcing_schema.sql
-- Task ID: ADM-BSRC-003
-- Description: Brand Sourcing & Marketing Domain Foundation — Dedicated Tables, Constraints, Indexes & RLS
-- Standards: DEPLOY-STD-001, CONCURRENT-DEV-001, DEV-SQL-MIGRATION-STD-001
-- Mode: Safe forward idempotent migration. Strictly isolated from core partner companies table.

-- ------------------------------------------------------------------------------
-- 1. TABLE: sourcing_companies
-- Master record for external candidate companies discovered through exhibition/sourcing channels.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sourcing_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name_kr TEXT NOT NULL,
  company_name_en TEXT,
  description_kr TEXT,
  description_en TEXT,
  business_types TEXT[] NOT NULL DEFAULT '{}',
  business_type_evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  representative_name TEXT,
  business_registration_number TEXT,

  -- Address fields
  address_line1 TEXT,
  address_line2 TEXT,
  address_city TEXT,
  address_state_province TEXT,
  address_postcode TEXT,
  address_country TEXT DEFAULT '한국',
  address_country_code TEXT DEFAULT 'KR',
  address_formatted_kr TEXT,
  address_formatted_en TEXT,

  -- Sourcing Evaluation & Admin Workflow
  grade VARCHAR(16) NOT NULL DEFAULT 'UNRATED' CHECK (grade IN ('A', 'B', 'C', 'UNRATED')),
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'REVIEWED', 'SAVED', 'ARCHIVED')),
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  internal_notes TEXT,

  -- Legal & Compliance: Marketing consent is strictly decoupled from email storage
  marketing_consent_status VARCHAR(32) NOT NULL DEFAULT 'UNCONFIRMED' CHECK (marketing_consent_status IN ('UNCONFIRMED', 'CONSENTED', 'REFUSED', 'EXCLUDED')),

  -- Audit & Metadata
  raw_payload_snapshot JSONB,
  audit_summary JSONB NOT NULL DEFAULT '{"status": "SUCCESS", "missingKeyFields": [], "notes": []}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 2. TABLE: sourcing_brands
-- Brands represented or owned by the sourcing candidate company.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sourcing_brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.sourcing_companies(id) ON DELETE CASCADE,
  brand_name_kr TEXT NOT NULL,
  brand_name_en TEXT,
  description TEXT,
  categories TEXT[] NOT NULL DEFAULT '{}',
  key_products JSONB NOT NULL DEFAULT '[]'::jsonb,
  source VARCHAR(32) NOT NULL DEFAULT 'SOURCE_EXHIBITION' CHECK (source IN ('SOURCE_EXHIBITION', 'OFFICIAL_WEBSITE', 'INFERRED', 'MANUAL')),
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 3. TABLE: sourcing_contacts
-- Contact persons and direct email/phone channels discovered for the company.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sourcing_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.sourcing_companies(id) ON DELETE CASCADE,
  name TEXT,
  department TEXT,
  job_title TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  source VARCHAR(32) NOT NULL DEFAULT 'SOURCE_EXHIBITION' CHECK (source IN ('SOURCE_EXHIBITION', 'OFFICIAL_WEBSITE', 'MANUAL')),
  source_url TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 4. TABLE: sourcing_websites
-- Official corporate, brand, or shop websites associated with the company.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sourcing_websites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.sourcing_companies(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  label VARCHAR(32) NOT NULL DEFAULT 'OFFICIAL' CHECK (label IN ('OFFICIAL', 'BRAND', 'SHOP', 'OTHER')),
  is_primary BOOLEAN NOT NULL DEFAULT false,
  source VARCHAR(32) NOT NULL DEFAULT 'SOURCE_EXHIBITION' CHECK (source IN ('SOURCE_EXHIBITION', 'OFFICIAL_WEBSITE', 'MANUAL')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 5. TABLE: sourcing_sources
-- Exhibition provider links and raw provenance tracking (e.g. InterCHARM exhibitor page).
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sourcing_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.sourcing_companies(id) ON DELETE CASCADE,
  provider VARCHAR(32) NOT NULL DEFAULT 'INTERCHARM' CHECK (provider IN ('INTERCHARM', 'COSMOPROF', 'MANUAL', 'OTHER')),
  source_url TEXT NOT NULL,
  source_identifier TEXT NOT NULL,
  event_edition_id TEXT,
  stand_location TEXT,
  raw_payload JSONB,
  collected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_sourcing_sources_provider_identifier UNIQUE (provider, source_identifier)
);

-- ------------------------------------------------------------------------------
-- 6. INDEXES FOR PERFORMANCE & DUPLICATE DETECTION
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_sourcing_companies_name_kr ON public.sourcing_companies(company_name_kr);
CREATE INDEX IF NOT EXISTS idx_sourcing_companies_name_en ON public.sourcing_companies(company_name_en);
CREATE INDEX IF NOT EXISTS idx_sourcing_companies_lower_kr ON public.sourcing_companies(lower(company_name_kr));
CREATE INDEX IF NOT EXISTS idx_sourcing_companies_grade ON public.sourcing_companies(grade);
CREATE INDEX IF NOT EXISTS idx_sourcing_companies_status ON public.sourcing_companies(status);
CREATE INDEX IF NOT EXISTS idx_sourcing_companies_assigned_to ON public.sourcing_companies(assigned_to);

CREATE INDEX IF NOT EXISTS idx_sourcing_brands_company_id ON public.sourcing_brands(company_id);
CREATE INDEX IF NOT EXISTS idx_sourcing_brands_name_kr ON public.sourcing_brands(brand_name_kr);

CREATE INDEX IF NOT EXISTS idx_sourcing_contacts_company_id ON public.sourcing_contacts(company_id);
CREATE INDEX IF NOT EXISTS idx_sourcing_contacts_email ON public.sourcing_contacts(lower(email));

CREATE INDEX IF NOT EXISTS idx_sourcing_websites_company_id ON public.sourcing_websites(company_id);
CREATE INDEX IF NOT EXISTS idx_sourcing_websites_url ON public.sourcing_websites(url);

CREATE INDEX IF NOT EXISTS idx_sourcing_sources_company_id ON public.sourcing_sources(company_id);
CREATE INDEX IF NOT EXISTS idx_sourcing_sources_identifier ON public.sourcing_sources(source_identifier);

-- ------------------------------------------------------------------------------
-- 7. ROW LEVEL SECURITY (RLS) & PRIVILEGES
-- ------------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sourcing_companies TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sourcing_brands TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sourcing_contacts TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sourcing_websites TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sourcing_sources TO authenticated, service_role;

REVOKE ALL ON public.sourcing_companies FROM anon;
REVOKE ALL ON public.sourcing_brands FROM anon;
REVOKE ALL ON public.sourcing_contacts FROM anon;
REVOKE ALL ON public.sourcing_websites FROM anon;
REVOKE ALL ON public.sourcing_sources FROM anon;

ALTER TABLE public.sourcing_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sourcing_companies FORCE ROW LEVEL SECURITY;

ALTER TABLE public.sourcing_brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sourcing_brands FORCE ROW LEVEL SECURITY;

ALTER TABLE public.sourcing_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sourcing_contacts FORCE ROW LEVEL SECURITY;

ALTER TABLE public.sourcing_websites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sourcing_websites FORCE ROW LEVEL SECURITY;

ALTER TABLE public.sourcing_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sourcing_sources FORCE ROW LEVEL SECURITY;

-- Policy definitions for Admin authenticated staff
DROP POLICY IF EXISTS "sourcing_companies_admin_all" ON public.sourcing_companies;
CREATE POLICY "sourcing_companies_admin_all"
  ON public.sourcing_companies
  FOR ALL
  TO authenticated
  USING (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());

DROP POLICY IF EXISTS "sourcing_brands_admin_all" ON public.sourcing_brands;
CREATE POLICY "sourcing_brands_admin_all"
  ON public.sourcing_brands
  FOR ALL
  TO authenticated
  USING (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());

DROP POLICY IF EXISTS "sourcing_contacts_admin_all" ON public.sourcing_contacts;
CREATE POLICY "sourcing_contacts_admin_all"
  ON public.sourcing_contacts
  FOR ALL
  TO authenticated
  USING (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());

DROP POLICY IF EXISTS "sourcing_websites_admin_all" ON public.sourcing_websites;
CREATE POLICY "sourcing_websites_admin_all"
  ON public.sourcing_websites
  FOR ALL
  TO authenticated
  USING (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());

DROP POLICY IF EXISTS "sourcing_sources_admin_all" ON public.sourcing_sources;
CREATE POLICY "sourcing_sources_admin_all"
  ON public.sourcing_sources
  FOR ALL
  TO authenticated
  USING (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());

-- ------------------------------------------------------------------------------
-- 8. DOCUMENTATION COMMENTS
-- ------------------------------------------------------------------------------
COMMENT ON TABLE public.sourcing_companies IS 'External candidate brand/manufacturer leads discovered via exhibitions. Decoupled from core partner companies table.';
COMMENT ON TABLE public.sourcing_brands IS 'Brands owned or represented by sourcing candidates.';
COMMENT ON TABLE public.sourcing_contacts IS 'Contact persons and communication channels for sourcing candidates.';
COMMENT ON TABLE public.sourcing_websites IS 'Corporate, brand, and webshop URLs for sourcing candidates.';
COMMENT ON TABLE public.sourcing_sources IS 'Exhibition and provenance attribution tracking for sourcing candidates.';
