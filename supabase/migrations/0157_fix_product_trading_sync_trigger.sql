-- 0157_fix_product_trading_sync_trigger.sql
-- Allow setting trading_status to 'inactive' or 'historical' even when selection_status is 'SELECTED'
-- Only auto-activate trading_status when selection_status transitions to 'SELECTED' from a non-SELECTED status

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

  -- 1. Auto-activate trading_status ONLY when selection_status transitions to 'SELECTED' from a non-SELECTED status
  -- (Do NOT overwrite if selection_status was already SELECTED and trading_status is being explicitly modified)
  IF (TG_OP = 'INSERT' AND NEW.selection_status = 'SELECTED' AND NEW.trading_status = 'inactive')
     OR (TG_OP = 'UPDATE' AND NEW.selection_status = 'SELECTED' AND OLD.selection_status IS DISTINCT FROM 'SELECTED' AND NEW.trading_status = 'inactive') THEN
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

COMMENT ON FUNCTION public.sync_product_trading_and_visibility IS '선정/운영/노출 상태 동기화 및 비활성화 시 자동 비노출 트리거 (SELECTED 상태에서 운영 중지 설정 보존)';

-- Update DR120 (KLALAB DR120 Barrier Cream) to authoritative inactive & hidden state
UPDATE public.products
SET trading_status = 'inactive',
    retailer_visibility = 'hidden'
WHERE id = 'b88c8e01-c7fe-49ee-ba3a-a4deba5c00ed';
