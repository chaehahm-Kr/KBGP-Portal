-- ==============================================================================
-- Migration: 0188_marketing_footer_and_assets.sql
-- Description: Centralized Marketing Email Footer Settings, Template Assets,
--              and Campaign Authoritative Metadata (Preview Text, Landing Page URL)
-- Task ID: ADM-BSRC-009 / ADM-BSRC-009-R1
-- Mode: ADDITIVE ONLY / PREPARED FOR QA VERIFICATION / PENDING OWNER APPROVAL
-- Standards: DEPLOY-STD-001, DEV-SQL-MIGRATION-STD-001, AGENTS.md Rule 27
-- ==============================================================================

-- 1. TABLE: marketing_footer_settings
-- Centrally managed legal and contact footer for all Brand Marketing campaigns.
-- Applies strictly to marketing emails under Brand Marketing (never transactional).
CREATE TABLE IF NOT EXISTS public.marketing_footer_settings (
  id VARCHAR(64) PRIMARY KEY DEFAULT 'central_marketing_footer',
  brand_display_name TEXT NOT NULL DEFAULT 'K SELECT NETWORK',
  legal_company_name TEXT NOT NULL DEFAULT 'Operated by Letusto Inc.',
  physical_address TEXT NOT NULL DEFAULT '23B Roland Ave., Mount Laurel, NJ 08054, USA',
  contact_email TEXT NOT NULL DEFAULT 'Contact@letusto.com',
  contact_website TEXT DEFAULT 'https://www.kselectnetwork.com',
  disclosure_ko TEXT NOT NULL DEFAULT '본 메일은 K SELECT NETWORK의 브랜드 파트너십 안내 이메일입니다.',
  disclosure_en TEXT NOT NULL DEFAULT 'This email provides information about K SELECT NETWORK brand partnerships.',
  default_language VARCHAR(8) NOT NULL DEFAULT 'ko' CHECK (default_language IN ('ko', 'en')),
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed / Update authoritative initial row with official business details
INSERT INTO public.marketing_footer_settings (
  id,
  brand_display_name,
  legal_company_name,
  physical_address,
  contact_email,
  contact_website,
  disclosure_ko,
  disclosure_en,
  default_language
) VALUES (
  'central_marketing_footer',
  'K SELECT NETWORK',
  'Operated by Letusto Inc.',
  '23B Roland Ave., Mount Laurel, NJ 08054, USA',
  'Contact@letusto.com',
  'https://www.kselectnetwork.com',
  '본 메일은 K SELECT NETWORK의 브랜드 파트너십 안내 이메일입니다.',
  'This email provides information about K SELECT NETWORK brand partnerships.',
  'ko'
)
ON CONFLICT (id) DO UPDATE SET
  brand_display_name = EXCLUDED.brand_display_name,
  legal_company_name = EXCLUDED.legal_company_name,
  physical_address = EXCLUDED.physical_address,
  contact_email = EXCLUDED.contact_email,
  contact_website = EXCLUDED.contact_website,
  disclosure_ko = EXCLUDED.disclosure_ko,
  disclosure_en = EXCLUDED.disclosure_en,
  default_language = EXCLUDED.default_language;

-- 2. TABLE: marketing_template_assets
-- Registry of hosted image assets extracted from imported HTML / ZIP designer packages.
CREATE TABLE IF NOT EXISTS public.marketing_template_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.marketing_templates(id) ON DELETE CASCADE,
  original_filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  public_url TEXT NOT NULL,
  content_type TEXT,
  byte_size BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketing_template_assets_template 
  ON public.marketing_template_assets(template_id);

-- 3. ADDITIVE COLUMNS: marketing_campaigns
-- Authoritative Step 1 Campaign Settings: preview_text and landing_page_url
ALTER TABLE public.marketing_campaigns 
  ADD COLUMN IF NOT EXISTS preview_text TEXT,
  ADD COLUMN IF NOT EXISTS landing_page_url TEXT;

-- 4. PERMISSIONS & PRIVILEGES (Least-Privilege Hardening)
REVOKE ALL ON public.marketing_footer_settings FROM anon, public;
GRANT SELECT ON public.marketing_footer_settings TO authenticated;
GRANT ALL ON public.marketing_footer_settings TO service_role;

REVOKE ALL ON public.marketing_template_assets FROM anon, public;
GRANT SELECT ON public.marketing_template_assets TO authenticated;
GRANT ALL ON public.marketing_template_assets TO service_role;

-- 5. ROW-LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.marketing_footer_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_template_assets ENABLE ROW LEVEL SECURITY;

-- Idempotent Policy Drop & Recreate: marketing_footer_settings
DROP POLICY IF EXISTS "marketing_footer_select_all" ON public.marketing_footer_settings;
DROP POLICY IF EXISTS "marketing_footer_select_authenticated" ON public.marketing_footer_settings;
DROP POLICY IF EXISTS "marketing_footer_admin_all" ON public.marketing_footer_settings;

CREATE POLICY "marketing_footer_select_authenticated"
  ON public.marketing_footer_settings
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "marketing_footer_admin_all"
  ON public.marketing_footer_settings
  FOR ALL
  TO authenticated
  USING (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());

-- Idempotent Policy Drop & Recreate: marketing_template_assets
DROP POLICY IF EXISTS "marketing_template_assets_select" ON public.marketing_template_assets;
DROP POLICY IF EXISTS "marketing_template_assets_select_authenticated" ON public.marketing_template_assets;
DROP POLICY IF EXISTS "marketing_template_assets_admin_all" ON public.marketing_template_assets;

CREATE POLICY "marketing_template_assets_select_authenticated"
  ON public.marketing_template_assets
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "marketing_template_assets_admin_all"
  ON public.marketing_template_assets
  FOR ALL
  TO authenticated
  USING (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());
