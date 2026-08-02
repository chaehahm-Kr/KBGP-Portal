-- 0018_add_extended_product_fields.sql — 제품 상세 정보 필드 확장 및 비디오 관리 테이블 추가

-- 1. Products 테이블에 상세 정보 및 물류 정보 컬럼 추가
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS name_en TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS bullet_points TEXT[] DEFAULT '{}'::TEXT[],
  ADD COLUMN IF NOT EXISTS color TEXT,
  ADD COLUMN IF NOT EXISTS color_map TEXT,
  ADD COLUMN IF NOT EXISTS origin TEXT,
  ADD COLUMN IF NOT EXISTS lead_time TEXT,
  
  -- SKU 관련 필드
  ADD COLUMN IF NOT EXISTS parent_sku TEXT,
  ADD COLUMN IF NOT EXISTS child_sku TEXT,
  ADD COLUMN IF NOT EXISTS manufacture_sku TEXT,
  ADD COLUMN IF NOT EXISTS letusto_sku TEXT,

  -- 가격 관련 필드
  ADD COLUMN IF NOT EXISTS price_krw_retail NUMERIC,
  ADD COLUMN IF NOT EXISTS price_krw_wholesale NUMERIC,
  ADD COLUMN IF NOT EXISTS price_usd_fob NUMERIC,
  ADD COLUMN IF NOT EXISTS price_additional_info JSONB DEFAULT '{}'::JSONB,

  -- 물류 스펙: Item (아이템)
  ADD COLUMN IF NOT EXISTS item_width NUMERIC,
  ADD COLUMN IF NOT EXISTS item_depth NUMERIC,
  ADD COLUMN IF NOT EXISTS item_height NUMERIC,
  ADD COLUMN IF NOT EXISTS item_weight NUMERIC,

  -- 물류 스펙: Package (단품 포장)
  ADD COLUMN IF NOT EXISTS package_width NUMERIC,
  ADD COLUMN IF NOT EXISTS package_depth NUMERIC,
  ADD COLUMN IF NOT EXISTS package_height NUMERIC,
  ADD COLUMN IF NOT EXISTS package_weight NUMERIC,

  -- 물류 스펙: Carton (카톤 박스)
  ADD COLUMN IF NOT EXISTS carton_pack_qty INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS carton_width NUMERIC,
  ADD COLUMN IF NOT EXISTS carton_depth NUMERIC,
  ADD COLUMN IF NOT EXISTS carton_height NUMERIC,
  ADD COLUMN IF NOT EXISTS carton_weight NUMERIC,
  ADD COLUMN IF NOT EXISTS carton_cbm NUMERIC,

  -- 물류 스펙: Palette (팔레트)
  ADD COLUMN IF NOT EXISTS palette_carton_qty INTEGER,
  ADD COLUMN IF NOT EXISTS palette_width NUMERIC,
  ADD COLUMN IF NOT EXISTS palette_depth NUMERIC,
  ADD COLUMN IF NOT EXISTS palette_height NUMERIC,
  ADD COLUMN IF NOT EXISTS palette_weight NUMERIC,

  -- 물류 스펙: Container Loading (컨테이너 적재량)
  ADD COLUMN IF NOT EXISTS container_20ft_qty INTEGER,
  ADD COLUMN IF NOT EXISTS container_20ft_weight NUMERIC,
  ADD COLUMN IF NOT EXISTS container_20ft_cbm NUMERIC,
  ADD COLUMN IF NOT EXISTS container_40fthc_qty INTEGER,
  ADD COLUMN IF NOT EXISTS container_40fthc_weight NUMERIC,
  ADD COLUMN IF NOT EXISTS container_40fthc_cbm NUMERIC;

-- 2. Product Videos (제품 동영상 정보) 테이블 생성
CREATE TABLE IF NOT EXISTS public.product_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products (id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  storage_path TEXT, -- 직접 비디오 파일 업로드 시 스토리지 경로
  video_url TEXT,    -- 유튜브 등 외부 비디오 링크
  position SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.product_videos IS '제품에 연결된 동영상 정보 (직접 업로드 파일 또는 외부 동영상 URL)';

-- 3. Product Videos 테이블 RLS 설정
ALTER TABLE public.product_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_videos FORCE ROW LEVEL SECURITY;

CREATE POLICY "product_videos_select_own_or_admin"
  ON public.product_videos FOR SELECT
  TO authenticated
  USING (company_id = public.auth_company_id() or public.auth_is_admin());

CREATE POLICY "product_videos_insert_own"
  ON public.product_videos FOR INSERT
  TO authenticated
  WITH CHECK (company_id = public.auth_company_id());

CREATE POLICY "product_videos_delete_own"
  ON public.product_videos FOR DELETE
  TO authenticated
  USING (company_id = public.auth_company_id());
