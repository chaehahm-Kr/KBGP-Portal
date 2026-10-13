-- Migration 0160: Payment Foundation, Global Settings, and Retailer Fee Overrides

-- 1. Add fee override columns to public.retailer_profiles
ALTER TABLE public.retailer_profiles
  ADD COLUMN IF NOT EXISTS card_fee_override NUMERIC(5, 2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS card_fee_waived BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ach_fee_override NUMERIC(8, 2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ach_fee_waived BOOLEAN NOT NULL DEFAULT false;

-- 2. Add fee breakdown snapshot columns to public.retailer_order_payments
ALTER TABLE public.retailer_order_payments
  ADD COLUMN IF NOT EXISTS fee_amount NUMERIC(10, 2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS fee_rate NUMERIC(5, 2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS fee_type TEXT CHECK (fee_type IN ('percentage', 'fixed', 'none')),
  ADD COLUMN IF NOT EXISTS fee_source TEXT CHECK (fee_source IN ('global', 'retailer_override', 'waived', 'none'));

-- 3. Seed default payment_settings into public.system_settings if not present
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
