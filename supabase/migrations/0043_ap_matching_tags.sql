-- 1. Matching Tags 마스터 테이블 생성
CREATE TABLE IF NOT EXISTS public.matching_tags (
  id serial PRIMARY KEY,
  tag_code text NOT NULL UNIQUE,
  name_ko text NOT NULL,
  name_en text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. AP와 Matching Tags의 M:N 매핑 테이블 생성
CREATE TABLE IF NOT EXISTS public.ap_matching_tags (
  ap_id integer NOT NULL REFERENCES public.assortment_profiles(id) ON DELETE CASCADE,
  tag_id integer NOT NULL REFERENCES public.matching_tags(id) ON DELETE CASCADE,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (ap_id, tag_id)
);

-- RLS 활성화
ALTER TABLE public.matching_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ap_matching_tags ENABLE ROW LEVEL SECURITY;

-- RLS 정책 생성 (인증된 모든 사용자에게 모든 권한 허용)
DROP POLICY IF EXISTS "matching_tags_all" ON public.matching_tags;
CREATE POLICY "matching_tags_all" ON public.matching_tags FOR ALL TO authenticated USING (true);

DROP POLICY IF EXISTS "ap_matching_tags_all" ON public.ap_matching_tags;
CREATE POLICY "ap_matching_tags_all" ON public.ap_matching_tags FOR ALL TO authenticated USING (true);
