-- 0044_add_company_code_and_supplier_tables.sql
-- K-Select Network Company Code, Multi-Role, Supplier Profile 및 Remittance 테이블 생성

-- 1. companies 테이블에 company_code 컬럼 추가
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS company_code text;

-- 2. 한글 초성 추출 헬퍼 함수 정의
CREATE OR REPLACE FUNCTION public.get_chosung_char(ch text)
RETURNS text AS $$
DECLARE
  code integer;
  idx integer;
  chosung_arr text[] := ARRAY['G', 'G', 'N', 'D', 'D', 'R', 'M', 'B', 'B', 'S', 'S', 'E', 'J', 'J', 'C', 'K', 'T', 'P', 'H'];
BEGIN
  code := ascii(ch);
  IF code >= 44032 AND code <= 55203 THEN
    idx := ((code - 44032) / 588) + 1;
    RETURN chosung_arr[idx];
  END IF;
  RETURN '';
END;
$$ LANGUAGE plpgsql;

-- 3. 지능형 company_code 자동 생성 함수 정의
CREATE OR REPLACE FUNCTION public.generate_company_code_sql(comp_name text)
RETURNS text AS $$
DECLARE
  clean_name text := '';
  ch text;
  chosung text;
  prefix text;
  rand_num integer;
  final_code text;
  code_exists boolean;
  i integer;
BEGIN
  FOR i IN 1..char_length(comp_name) LOOP
    ch := substring(comp_name from i for 1);
    
    IF ch ~ '[a-zA-Z]' THEN
      clean_name := clean_name || upper(ch);
    ELSE
      chosung := public.get_chosung_char(ch);
      IF chosung <> '' THEN
        clean_name := clean_name || chosung;
      END IF;
    END IF;
    
    EXIT WHEN length(clean_name) >= 3;
  END LOOP;
  
  IF length(clean_name) < 3 THEN
    clean_name := clean_name || 'KSE';
  END IF;
  
  prefix := substring(clean_name from 1 for 3);
  
  LOOP
    rand_num := floor(random() * 900) + 100; -- 100 ~ 999
    final_code := prefix || '-' || rand_num;
    
    SELECT EXISTS(SELECT 1 FROM public.companies WHERE company_code = final_code) INTO code_exists;
    IF NOT code_exists THEN
      RETURN final_code;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 4. 기존 등록된 회사에 코드 백필 적용
UPDATE public.companies 
SET company_code = public.generate_company_code_sql(name)
WHERE company_code IS NULL;

-- 5. company_code 제약조건 추가 (NOT NULL, UNIQUE)
ALTER TABLE public.companies ALTER COLUMN company_code SET NOT NULL;
ALTER TABLE public.companies ADD CONSTRAINT companies_company_code_key UNIQUE (company_code);

-- 6. 신규 회사 등록 시 company_code 자동 할당 트리거 정의
CREATE OR REPLACE FUNCTION public.companies_assign_company_code_trigger()
RETURNS trigger AS $$
BEGIN
  IF NEW.company_code IS NULL THEN
    NEW.company_code := public.generate_company_code_sql(NEW.name);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS companies_assign_company_code ON public.companies;
CREATE TRIGGER companies_assign_company_code
BEFORE INSERT ON public.companies
FOR EACH ROW
EXECUTE FUNCTION public.companies_assign_company_code_trigger();

-- 7. Supplier Profile 테이블 생성 (당사 거래조건 관리)
CREATE TABLE IF NOT EXISTS public.supplier_profiles (
  company_id uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'on_hold', 'inactive')),
  default_currency text NOT NULL DEFAULT 'USD',
  default_payment_terms text NOT NULL DEFAULT 'Prepaid 100%',
  default_payment_terms_custom text,
  default_incoterms text,
  default_ship_from_address text,
  default_port_of_loading text,
  default_production_lead_time text,
  default_moq integer,
  po_receiving_email text,
  internal_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 8. Supplier Remittance 테이블 생성 (송금용 은행 정보)
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
  account_currency text,
  intermediary_bank_info text,
  remittance_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 9. RLS 활성화
ALTER TABLE public.supplier_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_profiles FORCE ROW LEVEL SECURITY;

ALTER TABLE public.supplier_remittances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_remittances FORCE ROW LEVEL SECURITY;

-- 10. RLS SELECT/ALL 정책 생성 (authenticated에 오픈하되 비즈니스 권한은 API에서 분기)
DROP POLICY IF EXISTS "supplier_profiles_select" ON public.supplier_profiles;
CREATE POLICY "supplier_profiles_select" 
  ON public.supplier_profiles FOR SELECT TO authenticated 
  USING (company_id = public.auth_company_id() OR public.auth_is_admin());

DROP POLICY IF EXISTS "supplier_profiles_all_admin" ON public.supplier_profiles;
CREATE POLICY "supplier_profiles_all_admin" 
  ON public.supplier_profiles FOR ALL TO authenticated 
  USING (public.auth_is_admin());

DROP POLICY IF EXISTS "supplier_remittances_select" ON public.supplier_remittances;
CREATE POLICY "supplier_remittances_select" 
  ON public.supplier_remittances FOR SELECT TO authenticated 
  USING (company_id = public.auth_company_id() OR public.auth_is_admin());

DROP POLICY IF EXISTS "supplier_remittances_all_admin" ON public.supplier_remittances;
CREATE POLICY "supplier_remittances_all_admin" 
  ON public.supplier_remittances FOR ALL TO authenticated 
  USING (public.auth_is_admin());
