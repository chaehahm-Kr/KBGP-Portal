-- supabase/migrations/0169_company_default_shipping_store.sql
-- RTP-PERFORMANCE-P4-001-R4: Company Default Shipping Store Destination & Address Model Refinements

-- 1. Add default_shipping_store_id column to public.companies
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS default_shipping_store_id UUID DEFAULT NULL
  REFERENCES public.stores(id) ON DELETE SET NULL;

-- 2. Index for fast join and tenant lookup
CREATE INDEX IF NOT EXISTS idx_companies_default_shipping_store_id 
  ON public.companies(default_shipping_store_id)
  WHERE default_shipping_store_id IS NOT NULL;

-- 3. Document the column
COMMENT ON COLUMN public.companies.default_shipping_store_id IS '회사의 명시적 기본 배송지 등록 매장 (stores.id 참조). null인 경우 저장된 기본 주소록 또는 매장 폴백 규칙 적용.';

-- 4. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
