-- 0052_company_supplier_foundation_fixes.sql
-- Consolidated Supplier Foundation fixes

-- 1. Create company_roles table
CREATE TABLE IF NOT EXISTS public.company_roles (
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('Brand Owner', 'Manufacturer', 'Supplier', 'Distributor', 'Retailer', 'Logistics Partner', 'Service Provider', 'Other')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, role)
);

COMMENT ON TABLE public.company_roles IS '회사의 다중 역할 매핑 테이블 (Source of Truth)';

-- Enable RLS on company_roles
ALTER TABLE public.company_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_roles FORCE ROW LEVEL SECURITY;

-- company_roles RLS policies
DROP POLICY IF EXISTS "company_roles_select" ON public.company_roles;
CREATE POLICY "company_roles_select"
  ON public.company_roles FOR SELECT
  TO authenticated
  USING (public.auth_is_admin() OR public.auth_company_id() = company_id);

DROP POLICY IF EXISTS "company_roles_write_admin" ON public.company_roles;
CREATE POLICY "company_roles_write_admin"
  ON public.company_roles FOR ALL
  TO authenticated
  USING (public.auth_is_admin());

-- 2. Add company_code to companies table (if it doesn't already exist)
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS company_code text;
COMMENT ON COLUMN public.companies.company_code IS '고유 비즈니스 식별자 (예: ABC-123)';

-- 3. Simple Chosung mapping function for Hangul characters
CREATE OR REPLACE FUNCTION public.get_simple_chosung_char(val text)
RETURNS text AS $$
DECLARE
  first_char text;
  code_val int;
  idx int;
  consonants text[];
BEGIN
  IF val IS NULL OR val = '' THEN
    RETURN 'X';
  END IF;
  
  first_char := substring(val from 1 for 1);
  code_val := ascii(first_char);
  
  -- Hangul range: 44032 (0xAC00) to 55203 (0xD7A3)
  IF code_val >= 44032 AND code_val <= 55203 THEN
    idx := (code_val - 44032) / 588;
    consonants := ARRAY['G','G','N','D','D','R','M','B','B','S','S','E','J','J','C','K','T','P','H'];
    IF idx >= 0 AND idx < 19 THEN
      RETURN consonants[idx + 1];
    END IF;
  END IF;
  
  -- If it's an English character
  IF first_char ~ '^[a-zA-Z]$' THEN
    RETURN upper(first_char);
  END IF;
  
  RETURN 'X';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 4. Code generator function (extracts 3 alphanumeric letters, fallback to chosung + padding, loops for unique code suffix)
CREATE OR REPLACE FUNCTION public.generate_company_code_sql(comp_name text)
RETURNS text AS $$
DECLARE
  clean_name text;
  prefix text;
  num_suffix text;
  full_code text;
  duplicate_exists boolean;
BEGIN
  -- Extract English alphabets only
  clean_name := upper(regexp_replace(comp_name, '[^a-zA-Z]', '', 'g'));
  
  IF length(clean_name) >= 3 THEN
    prefix := substring(clean_name from 1 for 3);
  ELSE
    -- Take what English we have, append Hangul chosung character, pad with X
    prefix := clean_name || public.get_simple_chosung_char(comp_name);
    IF length(prefix) >= 3 THEN
      prefix := substring(prefix from 1 for 3);
    ELSE
      prefix := rpad(prefix, 3, 'X');
    END IF;
  END IF;
  
  -- Suffix loop to ensure uniqueness
  LOOP
    num_suffix := lpad(floor(random() * 1000)::text, 3, '0');
    full_code := prefix || '-' || num_suffix;
    
    SELECT EXISTS(SELECT 1 FROM public.companies WHERE company_code = full_code) INTO duplicate_exists;
    IF NOT duplicate_exists THEN
      RETURN full_code;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 5. Trigger to assign company code automatically on creation
CREATE OR REPLACE FUNCTION public.assign_company_code_trigger()
RETURNS trigger AS $$
BEGIN
  IF NEW.company_code IS NULL OR NEW.company_code = '' THEN
    NEW.company_code := public.generate_company_code_sql(NEW.name);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_assign_company_code ON public.companies;
CREATE TRIGGER trg_assign_company_code
  BEFORE INSERT ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_company_code_trigger();

-- 6. Backfill existing company codes
UPDATE public.companies 
SET company_code = public.generate_company_code_sql(name)
WHERE company_code IS NULL;

-- Set NOT NULL and UNIQUE constraint
ALTER TABLE public.companies ALTER COLUMN company_code SET NOT NULL;
ALTER TABLE public.companies DROP CONSTRAINT IF EXISTS companies_company_code_key;
ALTER TABLE public.companies ADD CONSTRAINT companies_company_code_key UNIQUE (company_code);

-- 7. Backfill existing company roles from metadata intro field to company_roles table
DO $$
DECLARE
  r RECORD;
  meta jsonb;
  types_val text[];
  t text;
BEGIN
  FOR r IN SELECT id, intro FROM public.companies LOOP
    IF r.intro IS NOT NULL AND r.intro LIKE '__COMPANY_METADATA__:%' THEN
      BEGIN
        meta := (substring(r.intro from length('__COMPANY_METADATA__:') + 1))::jsonb;
        
        IF jsonb_typeof(meta->'types') = 'array' THEN
          types_val := ARRAY(SELECT jsonb_array_elements_text(meta->'types'));
        ELSIF jsonb_typeof(meta->'type') = 'string' THEN
          types_val := ARRAY[(meta->>'type')::text];
        ELSE
          types_val := ARRAY['Brand Owner'];
        END IF;
        
        FOREACH t IN ARRAY types_val LOOP
          IF t IN ('Brand Owner', 'Manufacturer', 'Supplier', 'Distributor', 'Retailer', 'Logistics Partner', 'Service Provider', 'Other') THEN
            INSERT INTO public.company_roles (company_id, role) 
            VALUES (r.id, t)
            ON CONFLICT DO NOTHING;
          END IF;
        END LOOP;
      EXCEPTION WHEN OTHERS THEN
        INSERT INTO public.company_roles (company_id, role) 
        VALUES (r.id, 'Brand Owner')
        ON CONFLICT DO NOTHING;
      END;
    ELSE
      INSERT INTO public.company_roles (company_id, role) 
      VALUES (r.id, 'Brand Owner')
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END;
$$;

-- 8. Create supplier_profiles table
CREATE TABLE IF NOT EXISTS public.supplier_profiles (
  company_id uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('active', 'inactive')),
  default_currency text,
  default_payment_terms text,
  default_payment_terms_custom text,
  default_incoterms text,
  default_ship_from_warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE SET NULL,
  default_port_of_loading text,
  default_production_lead_time text,
  default_moq integer,
  po_receiving_email text,
  internal_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.supplier_profiles IS '공급사 거래 조건 프로필 정보';

-- Enable RLS on supplier_profiles
ALTER TABLE public.supplier_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_profiles FORCE ROW LEVEL SECURITY;

-- supplier_profiles RLS policies
DROP POLICY IF EXISTS "supplier_profiles_select" ON public.supplier_profiles;
CREATE POLICY "supplier_profiles_select"
  ON public.supplier_profiles FOR SELECT
  TO authenticated
  USING (public.auth_is_admin() OR public.auth_company_id() = company_id);

DROP POLICY IF EXISTS "supplier_profiles_write_admin" ON public.supplier_profiles;
CREATE POLICY "supplier_profiles_write_admin"
  ON public.supplier_profiles FOR ALL
  TO authenticated
  USING (public.auth_is_admin());

-- 9. Create supplier_remittances table
CREATE TABLE IF NOT EXISTS public.supplier_remittances (
  company_id uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  payment_method text,
  beneficiary_name text,
  beneficiary_address text,
  bank_name text,
  bank_address text,
  bank_country text,
  account_number text,
  swift_bic text,
  routing_number text,
  account_currency text NOT NULL DEFAULT 'USD',
  intermediary_bank_info text,
  remittance_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.supplier_remittances IS '공급사 송금 은행 정보';

-- Enable RLS on supplier_remittances
ALTER TABLE public.supplier_remittances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_remittances FORCE ROW LEVEL SECURITY;

-- supplier_remittances RLS policies
DROP POLICY IF EXISTS "supplier_remittances_select" ON public.supplier_remittances;
CREATE POLICY "supplier_remittances_select"
  ON public.supplier_remittances FOR SELECT
  TO authenticated
  USING (
    public.auth_is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.company_task_assignments
      WHERE company_id = supplier_remittances.company_id
        AND user_id = auth.uid()
        AND task_code = 'settlement_inquiry'
    )
  );

DROP POLICY IF EXISTS "supplier_remittances_write_admin" ON public.supplier_remittances;
DROP POLICY IF EXISTS "supplier_remittances_write_policy" ON public.supplier_remittances;
CREATE POLICY "supplier_remittances_write_policy"
  ON public.supplier_remittances FOR ALL
  TO authenticated
  USING (
    public.auth_is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.company_task_assignments
      WHERE company_id = supplier_remittances.company_id
        AND user_id = auth.uid()
        AND task_code = 'settlement_inquiry'
    )
  )
  WITH CHECK (
    public.auth_is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.company_task_assignments
      WHERE company_id = supplier_remittances.company_id
        AND user_id = auth.uid()
        AND task_code = 'settlement_inquiry'
    )
  );
