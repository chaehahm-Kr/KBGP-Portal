-- 0015_brand_trademarks.sql
-- Add South Korea and US trademark fields to brands table

ALTER TABLE public.brands
ADD COLUMN has_kr_trademark BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN kr_trademark_number TEXT,
ADD COLUMN kr_trademark_path TEXT,
ADD COLUMN has_us_trademark BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN us_trademark_number TEXT,
ADD COLUMN us_trademark_path TEXT;

COMMENT ON COLUMN public.brands.has_kr_trademark IS '대한민국 특허청 상표권 등록 여부';
COMMENT ON COLUMN public.brands.kr_trademark_number IS '대한민국 특허청 상표권 등록 번호';
COMMENT ON COLUMN public.brands.kr_trademark_path IS '대한민국 특허청 상표권 증빙 파일 경로';
COMMENT ON COLUMN public.brands.has_us_trademark IS '미국 USPTO 상표권 등록 여부';
COMMENT ON COLUMN public.brands.us_trademark_number IS '미국 USPTO 상표권 등록 번호';
COMMENT ON COLUMN public.brands.us_trademark_path IS '미국 USPTO 상표권 증빙 파일 경로';
