-- 0041_flexible_programs.sql
-- 1. display_programs 및 assortment_profiles 제약조건(IN) 제거로 동적 프로그램 추가 허용
ALTER TABLE public.display_programs DROP CONSTRAINT IF EXISTS display_programs_code_check;
ALTER TABLE public.assortment_profiles DROP CONSTRAINT IF EXISTS assortment_profiles_display_program_check;

-- 2. display_programs 테이블에 min_sku, max_sku 목표 수치 컬럼 추가
ALTER TABLE public.display_programs 
ADD COLUMN IF NOT EXISTS min_sku integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_sku integer NOT NULL DEFAULT 0;

-- 3. 기존 START, GROW, EXPAND 프로그램의 디폴트 가이드라인 SKU 설정 업데이트
UPDATE public.display_programs SET min_sku = 5, max_sku = 15 WHERE code = 'START_4FT';
UPDATE public.display_programs SET min_sku = 15, max_sku = 35 WHERE code = 'GROW_8FT';
UPDATE public.display_programs SET min_sku = 30, max_sku = 60 WHERE code = 'EXPAND_12FT';
