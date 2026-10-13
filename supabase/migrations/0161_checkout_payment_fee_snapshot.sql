-- Migration 0161: Checkout Payment Fee, Snapshots, and Retailer Fee Overrides
-- RTP-CHECKOUT-PAYMENT-001 & ADM-PAY-FOUNDATION-001

-- 1. Extend public.retailer_orders with fee, discount, and snapshot columns
ALTER TABLE public.retailer_orders
  ADD COLUMN IF NOT EXISTS processing_fee NUMERIC(10, 2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS payment_snapshot JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10, 2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS coupon_code TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS promotion_id UUID DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS promotion_snapshot JSONB DEFAULT NULL;

-- 2. Extend public.retailer_order_payments with fee breakdown and snapshot columns
ALTER TABLE public.retailer_order_payments
  ADD COLUMN IF NOT EXISTS fee_amount NUMERIC(10, 2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS fee_rate NUMERIC(5, 2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS fee_type TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS fee_source TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS payment_snapshot JSONB DEFAULT NULL;

-- 3. Extend public.retailer_profiles with fee override columns
ALTER TABLE public.retailer_profiles
  ADD COLUMN IF NOT EXISTS card_fee_override NUMERIC(5, 2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS card_fee_waived BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ach_fee_override NUMERIC(8, 2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ach_fee_waived BOOLEAN NOT NULL DEFAULT false;

-- 4. Ensure payment_settings row exists in system_settings
INSERT INTO public.system_settings (key, value, created_at, updated_at)
VALUES (
  'payment_settings',
  jsonb_build_object(
    'provider', 'not_connected',
    'provider_display_name', 'Not Connected',
    'card_enabled', true,
    'card_fee_type', 'percentage',
    'card_fee_rate', 3.50,
    'card_fee_charged_to', 'retailer',
    'card_fee_min', null,
    'card_fee_max', null,
    'ach_enabled', true,
    'ach_fee_type', 'fixed',
    'ach_fee_amount', 5.00,
    'ach_fee_charged_to', 'retailer',
    'past_due_blocks_terms', true,
    'default_grace_period_days', 0
  ),
  NOW(),
  NOW()
)
ON CONFLICT (key) DO NOTHING;

-- 5. Extend public.retailer_order_items with discount and promotion columns
ALTER TABLE public.retailer_order_items
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10, 2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS promotion_id UUID DEFAULT NULL;
