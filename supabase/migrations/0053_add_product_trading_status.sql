-- 0053_add_product_trading_status.sql — Trading Product Membership Status
--

-- 1. Add trading_status column to products table
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS trading_status TEXT NOT NULL DEFAULT 'inactive'
  CHECK (trading_status IN ('inactive', 'active', 'historical'));

-- 2. Add comment explaining values
COMMENT ON COLUMN public.products.trading_status IS '거래 운영 상품 멤버십 상태 (inactive: 비대상, active: 운영 대상, historical: 과거 운영 이력 대상)';

-- 3. Initialize existing selected products to 'active'
UPDATE public.products
SET trading_status = 'active'
WHERE selection_status = 'SELECTED';
