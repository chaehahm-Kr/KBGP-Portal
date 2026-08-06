-- 0037_add_product_statuses.sql
-- 제품 선정 상태(selection_status) 및 판매 상태(sales_status) 컬럼 추가

-- 1. 제품 선정 상태 컬럼 추가 (기본값: 미검토 / UNREVIEWED)
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS selection_status text NOT NULL DEFAULT 'UNREVIEWED' 
CHECK (selection_status IN ('UNREVIEWED', 'UNDER_REVIEW', 'INFO_REQUESTED', 'SELECTED', 'NOT_SELECTED'));

-- 2. 제품 판매 상태 컬럼 추가 (기본값: 판매 준비 / PREPARING)
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS sales_status text NOT NULL DEFAULT 'PREPARING' 
CHECK (sales_status IN ('PREPARING', 'ON_SALE', 'PAUSED', 'ENDED'));

-- 3. 코멘트 추가
COMMENT ON COLUMN public.products.selection_status IS '제품 선정 상태 (UNREVIEWED: 미검토, UNDER_REVIEW: 검토 중, INFO_REQUESTED: 정보 요청, SELECTED: 선정, NOT_SELECTED: 미선정)';
COMMENT ON COLUMN public.products.sales_status IS '제품 판매 상태 (PREPARING: 판매 준비, ON_SALE: 판매 중, PAUSED: 일시 중지, ENDED: 판매 종료)';
