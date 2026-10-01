-- 0066_selected_product_trading_auto_sync.sql — Selected Product Trading Auto-Sync & Backfill
--

-- 1. Backfill existing products where selection_status = 'SELECTED' and trading_status = 'inactive'
UPDATE public.products
SET trading_status = 'active',
    updated_at = now()
WHERE selection_status = 'SELECTED'
  AND trading_status = 'inactive';

-- 2. Create Trigger Function to automatically activate trading_status when selection_status becomes 'SELECTED'
CREATE OR REPLACE FUNCTION public.sync_selected_product_trading_status()
RETURNS TRIGGER AS $$
BEGIN
  -- When selection_status is or becomes 'SELECTED', auto-activate trading_status unless already active/historical
  IF NEW.selection_status = 'SELECTED' AND (NEW.trading_status IS NULL OR NEW.trading_status = 'inactive') THEN
    NEW.trading_status := 'active';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Create Trigger on public.products
DROP TRIGGER IF EXISTS trigger_sync_selected_product_trading_status ON public.products;
CREATE TRIGGER trigger_sync_selected_product_trading_status
  BEFORE INSERT OR UPDATE OF selection_status ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_selected_product_trading_status();

COMMENT ON FUNCTION public.sync_selected_product_trading_status IS '선정 상태가 SELECTED가 될 때 trading_status를 active로 자동 동기화';
