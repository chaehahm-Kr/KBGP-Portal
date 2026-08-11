-- public.product_curations 테이블에 어드민 가격/마진 책정용 컬럼 추가
ALTER TABLE public.product_curations
ADD COLUMN IF NOT EXISTS landed_cost NUMERIC(10, 2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS wholesale_price NUMERIC(10, 2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS suggest_retail_price NUMERIC(10, 2) DEFAULT NULL;

COMMENT ON COLUMN public.product_curations.landed_cost IS '어드민이 기입한 수입 원가 (USD)';
COMMENT ON COLUMN public.product_curations.wholesale_price IS '어드민이 기입한 뷰티 서플라이 공급 도매가 (USD)';
COMMENT ON COLUMN public.product_curations.suggest_retail_price IS '어드민이 기입한 제안 소비자 가격 (MSRP, USD)';
