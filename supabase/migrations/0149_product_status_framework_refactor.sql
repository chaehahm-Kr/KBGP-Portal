-- 0149_product_status_framework_refactor.sql
-- ADM-PROD-STATUS-001-R1: Product Status Framework Refactor (Operational Status + Retailer Hub Visibility)

-- 1. Add retailer_visibility column if not exists
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS retailer_visibility TEXT DEFAULT 'hidden';

-- 2. Add check constraint on retailer_visibility
ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS check_products_retailer_visibility;

ALTER TABLE public.products
  ADD CONSTRAINT check_products_retailer_visibility
  CHECK (retailer_visibility IN ('visible', 'hidden'));

-- 3. Migration / Backfill existing products:
-- A. trading_status safe alignment based on sales_status & selection_status
-- Note: Do NOT overwrite valid existing trading_status unless null/unassigned
UPDATE public.products
SET trading_status = 'active',
    updated_at = now()
WHERE selection_status = 'SELECTED'
  AND (trading_status IS NULL OR trading_status = 'inactive');

UPDATE public.products
SET trading_status = 'inactive',
    updated_at = now()
WHERE trading_status IS NULL;

-- B. retailer_visibility backfill:
-- Set 'visible' for selected & active products that were on sale or have valid trading wholesale price
UPDATE public.products
SET retailer_visibility = 'visible',
    updated_at = now()
WHERE selection_status = 'SELECTED'
  AND trading_status = 'active'
  AND (sales_status = 'ON_SALE' OR trading_wholesale_price > 0);

-- All other products set to 'hidden'
UPDATE public.products
SET retailer_visibility = 'hidden',
    updated_at = now()
WHERE retailer_visibility IS NULL
   OR trading_status != 'active'
   OR selection_status != 'SELECTED';

-- 4. Create or Replace Trigger Function for Status & Visibility Synchronization
CREATE OR REPLACE FUNCTION public.sync_product_trading_and_visibility()
RETURNS TRIGGER AS $$
BEGIN
  -- Default fallbacks
  IF NEW.trading_status IS NULL THEN
    NEW.trading_status := 'inactive';
  END IF;

  IF NEW.retailer_visibility IS NULL THEN
    NEW.retailer_visibility := 'hidden';
  END IF;

  -- 1. Auto-activate trading_status when selection_status is/becomes 'SELECTED'
  IF NEW.selection_status = 'SELECTED' AND NEW.trading_status = 'inactive' THEN
    NEW.trading_status := 'active';
  END IF;

  -- 2. Auto-enforce visibility rules:
  -- If product is inactive or historical, retailer_visibility MUST NOT be visible
  IF NEW.trading_status IN ('inactive', 'historical') AND NEW.retailer_visibility = 'visible' THEN
    NEW.retailer_visibility := 'hidden';
  END IF;

  -- 3. If product is unselected, retailer_visibility must also be hidden
  IF NEW.selection_status != 'SELECTED' AND NEW.retailer_visibility = 'visible' THEN
    NEW.retailer_visibility := 'hidden';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Attach Trigger to public.products
DROP TRIGGER IF EXISTS trigger_sync_product_trading_and_visibility ON public.products;
DROP TRIGGER IF EXISTS trigger_sync_selected_product_trading_status ON public.products;

CREATE TRIGGER trigger_sync_product_trading_and_visibility
  BEFORE INSERT OR UPDATE OF selection_status, trading_status, retailer_visibility ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_product_trading_and_visibility();

-- 6. Add compatibility constraint preventing invalid state combinations
ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS check_products_trading_visibility_compat;

ALTER TABLE public.products
  ADD CONSTRAINT check_products_trading_visibility_compat
  CHECK (
    retailer_visibility = 'hidden'
    OR (retailer_visibility = 'visible' AND trading_status = 'active' AND selection_status = 'SELECTED')
  );

COMMENT ON COLUMN public.products.trading_status IS '운영 상태: active(운영 중), inactive(운영 중지), historical(운영 종료)';
COMMENT ON COLUMN public.products.retailer_visibility IS 'Retailer Hub 노출 상태: visible(노출), hidden(비노출)';
COMMENT ON FUNCTION public.sync_product_trading_and_visibility IS '선정/운영/노출 상태 동기화 및 비활성화 시 자동 비노출 트리거';
