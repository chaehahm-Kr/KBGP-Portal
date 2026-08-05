-- 0035_pricing_landed_cost.sql — Landed Cost 및 패키지/카톤 체적 분석용 컬럼 추가

BEGIN;

-- pricing_calculations 테이블에 Landed Cost 산출 데이터 스냅샷용 컬럼들 추가
ALTER TABLE public.pricing_calculations ADD COLUMN IF NOT EXISTS import_quantity INTEGER DEFAULT 1000;
ALTER TABLE public.pricing_calculations ADD COLUMN IF NOT EXISTS package_length_cm NUMERIC;
ALTER TABLE public.pricing_calculations ADD COLUMN IF NOT EXISTS package_width_cm NUMERIC;
ALTER TABLE public.pricing_calculations ADD COLUMN IF NOT EXISTS package_height_cm NUMERIC;
ALTER TABLE public.pricing_calculations ADD COLUMN IF NOT EXISTS package_weight_kg NUMERIC;
ALTER TABLE public.pricing_calculations ADD COLUMN IF NOT EXISTS package_data_source TEXT DEFAULT 'default'; -- 'default', 'partial_default', 'user_entered'
ALTER TABLE public.pricing_calculations ADD COLUMN IF NOT EXISTS preferred_dimension_unit TEXT DEFAULT 'cm'; -- 'cm', 'in'
ALTER TABLE public.pricing_calculations ADD COLUMN IF NOT EXISTS preferred_weight_unit TEXT DEFAULT 'g'; -- 'g', 'kg', 'lb'

ALTER TABLE public.pricing_calculations ADD COLUMN IF NOT EXISTS maximum_carton_weight_kg NUMERIC DEFAULT 25.0;
ALTER TABLE public.pricing_calculations ADD COLUMN IF NOT EXISTS carton_packing_weight_kg NUMERIC DEFAULT 1.0;
ALTER TABLE public.pricing_calculations ADD COLUMN IF NOT EXISTS carton_size_allowance NUMERIC DEFAULT 1.5; -- cm 가산 여유

ALTER TABLE public.pricing_calculations ADD COLUMN IF NOT EXISTS units_per_carton INTEGER;
ALTER TABLE public.pricing_calculations ADD COLUMN IF NOT EXISTS full_cartons INTEGER;
ALTER TABLE public.pricing_calculations ADD COLUMN IF NOT EXISTS remaining_units INTEGER;
ALTER TABLE public.pricing_calculations ADD COLUMN IF NOT EXISTS total_cartons INTEGER;

ALTER TABLE public.pricing_calculations ADD COLUMN IF NOT EXISTS full_carton_dimensions_cm JSONB; -- { length, width, height }
ALTER TABLE public.pricing_calculations ADD COLUMN IF NOT EXISTS partial_carton_dimensions_cm JSONB; -- { length, width, height }

ALTER TABLE public.pricing_calculations ADD COLUMN IF NOT EXISTS gross_weight_kg NUMERIC;
ALTER TABLE public.pricing_calculations ADD COLUMN IF NOT EXISTS volumetric_weight_kg NUMERIC;
ALTER TABLE public.pricing_calculations ADD COLUMN IF NOT EXISTS billable_weight_kg NUMERIC;

ALTER TABLE public.pricing_calculations ADD COLUMN IF NOT EXISTS twoday_shipping_cost_krw NUMERIC;
ALTER TABLE public.pricing_calculations ADD COLUMN IF NOT EXISTS twoday_lookup_at TIMESTAMPTZ;
ALTER TABLE public.pricing_calculations ADD COLUMN IF NOT EXISTS twoday_lookup_status TEXT DEFAULT 'pending'; -- 'pending', 'success', 'failed'
ALTER TABLE public.pricing_calculations ADD COLUMN IF NOT EXISTS shipping_cost_entry_type TEXT DEFAULT 'automatic'; -- 'automatic', 'manual'
ALTER TABLE public.pricing_calculations ADD COLUMN IF NOT EXISTS twoday_error_message TEXT;

ALTER TABLE public.pricing_calculations ADD COLUMN IF NOT EXISTS exchange_rate_snapshot NUMERIC;
ALTER TABLE public.pricing_calculations ADD COLUMN IF NOT EXISTS exchange_rate_updated_at TEXT;

ALTER TABLE public.pricing_calculations ADD COLUMN IF NOT EXISTS total_shipping_cost_usd NUMERIC;
ALTER TABLE public.pricing_calculations ADD COLUMN IF NOT EXISTS shipping_cost_per_unit NUMERIC;
ALTER TABLE public.pricing_calculations ADD COLUMN IF NOT EXISTS import_tax_cost_percentage NUMERIC DEFAULT 10.0;
ALTER TABLE public.pricing_calculations ADD COLUMN IF NOT EXISTS import_tax_cost_total NUMERIC;
ALTER TABLE public.pricing_calculations ADD COLUMN IF NOT EXISTS import_tax_cost_per_unit NUMERIC;
ALTER TABLE public.pricing_calculations ADD COLUMN IF NOT EXISTS total_product_cost NUMERIC;
ALTER TABLE public.pricing_calculations ADD COLUMN IF NOT EXISTS total_landed_cost NUMERIC;
ALTER TABLE public.pricing_calculations ADD COLUMN IF NOT EXISTS landed_cost_per_unit NUMERIC;

COMMIT;
