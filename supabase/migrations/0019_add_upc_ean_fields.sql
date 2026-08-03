-- 0019_add_upc_ean_fields.sql — 제품 바코드 식별자(UPC, EAN), 영문 성분 인증 파일 및 특허 인증 유형 추가

-- 1. products 테이블에 바코드(UPC, EAN) 및 영문 성분 인증 파일 경로 추가
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS upc TEXT,
  ADD COLUMN IF NOT EXISTS ean TEXT,
  ADD COLUMN IF NOT EXISTS ingredients_file_path_en TEXT;

COMMENT ON COLUMN public.products.upc IS '미국 표준 바코드 (Universal Product Code)';
COMMENT ON COLUMN public.products.ean IS '유럽/글로벌 바코드 (European Article Number)';
COMMENT ON COLUMN public.products.ingredients_file_path_en IS '영문 전성분 증빙 서류 파일 경로';

-- 2. product_certificates 테이블의 제약 조건을 수정하여 'patent' (특허) 허용
ALTER TABLE public.product_certificates
  DROP CONSTRAINT IF EXISTS product_certificates_certificate_type_check;

ALTER TABLE public.product_certificates
  ADD CONSTRAINT product_certificates_certificate_type_check
  CHECK (certificate_type IN ('ingredient_certification', 'trademark', 'fda_registration', 'patent', 'other'));
