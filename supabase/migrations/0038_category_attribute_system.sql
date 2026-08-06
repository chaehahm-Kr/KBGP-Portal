-- 0038_category_attribute_system.sql
-- 3Depth 카테고리 구조 및 dynamic EAV 속성 테이블 및 Seed 데이터

CREATE TABLE IF NOT EXISTS public.categories (
  code text PRIMARY KEY,
  name_ko text NOT NULL,
  name_en text,
  depth integer NOT NULL CHECK (depth IN (1, 2, 3)),
  parent_code text REFERENCES public.categories (code) ON DELETE CASCADE,
  is_final boolean NOT NULL DEFAULT false,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.attribute_profiles (
  code text PRIMARY KEY,
  name_ko text NOT NULL,
  name_en text,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.attributes (
  code text PRIMARY KEY,
  name_ko text NOT NULL,
  name_en text,
  scope text NOT NULL CHECK (scope IN ('COMMON', 'PROFILE')),
  attr_group text,
  input_type text NOT NULL,
  is_multiple boolean NOT NULL DEFAULT false,
  unit_set text,
  is_required boolean NOT NULL DEFAULT false,
  allow_na boolean NOT NULL DEFAULT false,
  allow_unknown boolean NOT NULL DEFAULT false,
  allow_other boolean NOT NULL DEFAULT false,
  brand_editable boolean NOT NULL DEFAULT true,
  admin_only boolean NOT NULL DEFAULT false,
  is_searchable boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  help_text text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.attribute_options (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  attribute_code text NOT NULL REFERENCES public.attributes (code) ON DELETE CASCADE,
  option_code text NOT NULL,
  option_ko text NOT NULL,
  option_en text,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  CONSTRAINT unique_attribute_option_code UNIQUE (attribute_code, option_code)
);

CREATE TABLE IF NOT EXISTS public.profile_attributes (
  profile_code text NOT NULL REFERENCES public.attribute_profiles (code) ON DELETE CASCADE,
  attribute_code text NOT NULL REFERENCES public.attributes (code) ON DELETE CASCADE,
  is_required_override boolean NOT NULL DEFAULT false,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  PRIMARY KEY (profile_code, attribute_code)
);

CREATE TABLE IF NOT EXISTS public.category_profile_mappings (
  category_code text NOT NULL REFERENCES public.categories (code) ON DELETE CASCADE,
  profile_code text NOT NULL REFERENCES public.attribute_profiles (code) ON DELETE CASCADE,
  auto_apply boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  PRIMARY KEY (category_code, profile_code)
);

CREATE TABLE IF NOT EXISTS public.product_attribute_values (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES public.products (id) ON DELETE CASCADE,
  attribute_code text NOT NULL REFERENCES public.attributes (code) ON DELETE CASCADE,
  value_json jsonb,
  text_value text,
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT unique_product_attribute_code UNIQUE (product_id, attribute_code)
);

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS category_code text REFERENCES public.categories (code) ON DELETE SET NULL;

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attribute_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attributes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attribute_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_attributes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_profile_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_attribute_values ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.categories FORCE ROW LEVEL SECURITY;
ALTER TABLE public.attribute_profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.attributes FORCE ROW LEVEL SECURITY;
ALTER TABLE public.attribute_options FORCE ROW LEVEL SECURITY;
ALTER TABLE public.profile_attributes FORCE ROW LEVEL SECURITY;
ALTER TABLE public.category_profile_mappings FORCE ROW LEVEL SECURITY;
ALTER TABLE public.product_attribute_values FORCE ROW LEVEL SECURITY;

-- DROP policies if they exist to avoid 42710 already exists errors
DROP POLICY IF EXISTS "categories_select" ON public.categories;
DROP POLICY IF EXISTS "attribute_profiles_select" ON public.attribute_profiles;
DROP POLICY IF EXISTS "attributes_select" ON public.attributes;
DROP POLICY IF EXISTS "attribute_options_select" ON public.attribute_options;
DROP POLICY IF EXISTS "profile_attributes_select" ON public.profile_attributes;
DROP POLICY IF EXISTS "category_profile_mappings_select" ON public.category_profile_mappings;
DROP POLICY IF EXISTS "product_attribute_values_select" ON public.product_attribute_values;
DROP POLICY IF EXISTS "product_attribute_values_write" ON public.product_attribute_values;

DROP POLICY IF EXISTS "categories_admin_write" ON public.categories;
DROP POLICY IF EXISTS "attribute_profiles_admin_write" ON public.attribute_profiles;
DROP POLICY IF EXISTS "attributes_admin_write" ON public.attributes;
DROP POLICY IF EXISTS "attribute_options_admin_write" ON public.attribute_options;
DROP POLICY IF EXISTS "profile_attributes_admin_write" ON public.profile_attributes;
DROP POLICY IF EXISTS "category_profile_mappings_admin_write" ON public.category_profile_mappings;

CREATE POLICY "categories_select" ON public.categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "attribute_profiles_select" ON public.attribute_profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "attributes_select" ON public.attributes FOR SELECT TO authenticated USING (true);
CREATE POLICY "attribute_options_select" ON public.attribute_options FOR SELECT TO authenticated USING (true);
CREATE POLICY "profile_attributes_select" ON public.profile_attributes FOR SELECT TO authenticated USING (true);
CREATE POLICY "category_profile_mappings_select" ON public.category_profile_mappings FOR SELECT TO authenticated USING (true);
CREATE POLICY "product_attribute_values_select" ON public.product_attribute_values FOR SELECT TO authenticated USING (public.auth_is_admin() OR EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND p.company_id = public.auth_company_id()));
CREATE POLICY "product_attribute_values_write" ON public.product_attribute_values FOR ALL TO authenticated USING (public.auth_is_admin() OR EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND p.company_id = public.auth_company_id()));

CREATE POLICY "categories_admin_write" ON public.categories FOR ALL TO authenticated USING (public.auth_is_admin());
CREATE POLICY "attribute_profiles_admin_write" ON public.attribute_profiles FOR ALL TO authenticated USING (public.auth_is_admin());
CREATE POLICY "attributes_admin_write" ON public.attributes FOR ALL TO authenticated USING (public.auth_is_admin());
CREATE POLICY "attribute_options_admin_write" ON public.attribute_options FOR ALL TO authenticated USING (public.auth_is_admin());
CREATE POLICY "profile_attributes_admin_write" ON public.profile_attributes FOR ALL TO authenticated USING (public.auth_is_admin());
CREATE POLICY "category_profile_mappings_admin_write" ON public.category_profile_mappings FOR ALL TO authenticated USING (public.auth_is_admin());

-- ----------------------------------------------------
-- Schema Migration Completed (Use Excel Importer for data upload)
-- ----------------------------------------------------