-- 0039_product_curation_system.sql
-- 큐레이션 관리 기능을 위한 테이블 정의 및 Seed 데이터

-- 1. 개별 상품 큐레이션 프로필 (1:1 관계)
CREATE TABLE IF NOT EXISTS public.product_curations (
  product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'NOT_REVIEWED' CHECK (status IN ('NOT_REVIEWED', 'CANDIDATE', 'APPROVED', 'ACTIVE', 'HOLD', 'REMOVED')),
  curator text,
  last_review_date date,
  next_review_date date,
  role text NOT NULL DEFAULT 'SUPPORT' CHECK (role IN ('HERO', 'CORE', 'TRAFFIC', 'TREND', 'MARGIN', 'TRIAL', 'SUPPORT')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Assortment Profile (AP) 마스터 테이블
CREATE TABLE IF NOT EXISTS public.assortment_profiles (
  id serial PRIMARY KEY,
  display_program text NOT NULL CHECK (display_program IN ('START_4FT', 'GROW_8FT', 'EXPAND_12FT')),
  code text NOT NULL CHECK (code IN ('AP-01', 'AP-02', 'AP-03', 'AP-04', 'AP-05', 'AP-06')),
  name text NOT NULL,
  description text,
  target_sku integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT unique_program_ap_code UNIQUE (display_program, code)
);

-- 3. Product x AP Matrix 테이블 (M:N 관계 매핑)
CREATE TABLE IF NOT EXISTS public.product_curation_matrix (
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  ap_id integer NOT NULL REFERENCES public.assortment_profiles(id) ON DELETE CASCADE,
  priority_role text NOT NULL DEFAULT 'EXCLUDE' CHECK (priority_role IN ('REQUIRED', 'CORE', 'OPTIONAL', 'TEST', 'EXCLUDE')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (product_id, ap_id)
);

-- 4. Curation Version & Snapshot History (변경 이력 관리)
CREATE TABLE IF NOT EXISTS public.curation_history (
  id bigserial PRIMARY KEY,
  ap_id integer NOT NULL REFERENCES public.assortment_profiles(id) ON DELETE CASCADE,
  version integer NOT NULL,
  snapshot_json jsonb NOT NULL,
  updated_by text,
  change_note text,
  created_at timestamptz DEFAULT now()
);

-- RLS 정책 설정
ALTER TABLE public.product_curations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assortment_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_curation_matrix ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curation_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "product_curations_all" ON public.product_curations;
DROP POLICY IF EXISTS "assortment_profiles_all" ON public.assortment_profiles;
DROP POLICY IF EXISTS "product_curation_matrix_all" ON public.product_curation_matrix;
DROP POLICY IF EXISTS "curation_history_all" ON public.curation_history;

CREATE POLICY "product_curations_all" ON public.product_curations FOR ALL TO authenticated USING (true);
CREATE POLICY "assortment_profiles_all" ON public.assortment_profiles FOR ALL TO authenticated USING (true);
CREATE POLICY "product_curation_matrix_all" ON public.product_curation_matrix FOR ALL TO authenticated USING (true);
CREATE POLICY "curation_history_all" ON public.curation_history FOR ALL TO authenticated USING (true);

-- Seed assortment_profiles
INSERT INTO public.assortment_profiles (display_program, code, name, description, target_sku) VALUES
('START_4FT', 'AP-01', 'START 4FT - 기본 구성 01', '소규모 스토어를 위한 표준형 Assortment', 10),
('START_4FT', 'AP-02', 'START 4FT - 기본 구성 02', '스킨케어 특화 초소형 카운터 배치용', 12),
('START_4FT', 'AP-03', 'START 4FT - 기본 구성 03', '시즌 이슈 트렌드 전용 소량 매대', 8),
('START_4FT', 'AP-04', 'START 4FT - 기본 구성 04', '헤어/바디 퀵 케어 컴팩트 진열', 10),
('START_4FT', 'AP-05', 'START 4FT - 기본 구성 05', '이너뷰티 및 웰니스 패치 집중 구성', 15),
('START_4FT', 'AP-06', 'START 4FT - 기본 구성 06', '트라이얼 키트 및 미니 세트 특화 매대', 12),

('GROW_8FT', 'AP-01', 'GROW 8FT - 기본 구성 01', '표준 리테일 채널을 위한 균형 잡힌 Assortment', 25),
('GROW_8FT', 'AP-02', 'GROW 8FT - 기본 구성 02', '스킨케어 & 메이크업 비중 극대화 매대', 30),
('GROW_8FT', 'AP-03', 'GROW 8FT - 기본 구성 03', '헤어 & 퍼스널 라이프스타일 웰니스형', 20),
('GROW_8FT', 'AP-04', 'GROW 8FT - 기본 구성 04', '데일리 루틴 위주의 베이직 매대 구성', 25),
('GROW_8FT', 'AP-05', 'GROW 8FT - 기본 구성 05', '영/트렌디 타겟 전용 스페셜 큐레이션', 28),
('GROW_8FT', 'AP-06', 'GROW 8FT - 기본 구성 06', '프리미엄 & 고단가 마진 특화 Assortment', 20),

('EXPAND_12FT', 'AP-01', 'EXPAND 12FT - 기본 구성 01', '대형 플래그십 매장을 위한 풀 포트폴리오 큐레이션', 45),
('EXPAND_12FT', 'AP-02', 'EXPAND 12FT - 기본 구성 02', '스킨케어 솔루션 중심의 대형 진열대', 50),
('EXPAND_12FT', 'AP-03', 'EXPAND 12FT - 기본 구성 03', '헤어/바디/퍼스널케어 풀 스펙 Assortment', 40),
('EXPAND_12FT', 'AP-04', 'EXPAND 12FT - 기본 구성 04', '메이크업 & 뷰티툴 메이저 매대 기획', 45),
('EXPAND_12FT', 'AP-05', 'EXPAND 12FT - 기본 구성 05', '세트/기획 상품 중심의 메이저 카운터 구성', 35),
('EXPAND_12FT', 'AP-06', 'EXPAND 12FT - 기본 구성 06', '신규 인큐베이팅 브랜드 중심의 웰컴 매대', 40)
ON CONFLICT (display_program, code) DO NOTHING;
