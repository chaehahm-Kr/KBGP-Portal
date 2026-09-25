-- 0104_trading_product_360_architecture.sql
-- ADM-TRD-001: Trading Product 360° Operations Hub Architecture

-- 1. Add Trading Operational Pricing & Cost Override columns to products table
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS trading_wholesale_price NUMERIC(12,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS trading_promo_wholesale_price NUMERIC(12,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS trading_promo_start_date DATE DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS trading_promo_end_date DATE DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS trading_map_price NUMERIC(12,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS trading_srp_price NUMERIC(12,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS trading_pricing_active BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS trading_pricing_note TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS override_landed_cost NUMERIC(12,4) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS override_landed_cost_reason TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS override_landed_cost_updated_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS override_landed_cost_updated_by UUID DEFAULT NULL;

COMMENT ON COLUMN public.products.trading_wholesale_price IS 'Trading Product 운영 도매 공급가 (USD)';
COMMENT ON COLUMN public.products.trading_promo_wholesale_price IS 'Trading Product 프로모션 도매 공급가 (USD)';
COMMENT ON COLUMN public.products.trading_promo_start_date IS '프로모션 시작일';
COMMENT ON COLUMN public.products.trading_promo_end_date IS '프로모션 종료일';
COMMENT ON COLUMN public.products.trading_map_price IS 'Trading Product 최저 준수가격 (MAP Override USD)';
COMMENT ON COLUMN public.products.trading_srp_price IS 'Trading Product 권장 소비자가격 (SRP Override USD)';
COMMENT ON COLUMN public.products.override_landed_cost IS '수동 수입원가 오버라이드 (Effective Landed Cost 우선 적용)';

-- 2. Create trading_product_history audit table
CREATE TABLE IF NOT EXISTS public.trading_product_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  change_type VARCHAR(50) NOT NULL, -- 'PRICING', 'COST_OVERRIDE', 'PROMOTION', 'INVENTORY_ADJUSTMENT', 'STATUS'
  field_name VARCHAR(100),
  before_value JSONB,
  after_value JSONB,
  reason TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trading_product_history_product_id ON public.trading_product_history(product_id);
CREATE INDEX IF NOT EXISTS idx_trading_product_history_created_at ON public.trading_product_history(created_at DESC);

-- Enable RLS on trading_product_history
ALTER TABLE public.trading_product_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view trading product history" ON public.trading_product_history
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Service role full access trading product history" ON public.trading_product_history
  FOR ALL USING (true) WITH CHECK (true);
