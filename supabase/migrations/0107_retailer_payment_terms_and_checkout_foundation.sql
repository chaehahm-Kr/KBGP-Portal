-- ==============================================================================
-- Migration 0107: Retailer Payment Methods, Terms Eligibility & Checkout Payment Foundation
-- Task ID: RTP-PAY-001
-- Description:
-- 1. Extend retailer_profiles with commercial payment method controls (Card, ACH, Terms, Approved Terms, Terms Status)
-- 2. Extend retailer_orders with payment_method, payment_due_date, paid_at, payment_provider, payment_provider_ref
-- 3. Create retailer_order_payments transaction log table with tenant RLS isolation
-- ==============================================================================

-- 1. Extend retailer_profiles with commercial payment controls
ALTER TABLE public.retailer_profiles 
  ADD COLUMN IF NOT EXISTS payment_method_card_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS payment_method_ach_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS terms_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS approved_terms TEXT NOT NULL DEFAULT 'prepaid',
  ADD COLUMN IF NOT EXISTS terms_status TEXT NOT NULL DEFAULT 'pending';

-- Add check constraints safely if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_retailer_profiles_approved_terms'
  ) THEN
    ALTER TABLE public.retailer_profiles
      ADD CONSTRAINT chk_retailer_profiles_approved_terms 
      CHECK (approved_terms IN ('prepaid', 'net15', 'net30', 'net45', 'net60'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_retailer_profiles_terms_status'
  ) THEN
    ALTER TABLE public.retailer_profiles
      ADD CONSTRAINT chk_retailer_profiles_terms_status 
      CHECK (terms_status IN ('pending', 'approved', 'suspended', 'rejected'));
  END IF;
END $$;

COMMENT ON COLUMN public.retailer_profiles.payment_method_card_enabled IS '리테일러의 신용카드 결제 허용 여부';
COMMENT ON COLUMN public.retailer_profiles.payment_method_ach_enabled IS '리테일러의 ACH 계좌이체 결제 허용 여부';
COMMENT ON COLUMN public.retailer_profiles.terms_enabled IS '리테일러의 후불 여신 거래(Net Terms) 허용 여부';
COMMENT ON COLUMN public.retailer_profiles.approved_terms IS '어드민이 승인한 결제 조건 (prepaid, net15, net30, net45, net60)';
COMMENT ON COLUMN public.retailer_profiles.terms_status IS '후불 여신 거래 상태 (pending, approved, suspended, rejected)';

-- 2. Extend retailer_orders with payment tracking fields
ALTER TABLE public.retailer_orders 
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS payment_due_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_provider TEXT,
  ADD COLUMN IF NOT EXISTS payment_provider_ref TEXT,
  ADD COLUMN IF NOT EXISTS payment_notes TEXT;

CREATE INDEX IF NOT EXISTS idx_retailer_orders_payment_status 
  ON public.retailer_orders(payment_status);

CREATE INDEX IF NOT EXISTS idx_retailer_orders_payment_method 
  ON public.retailer_orders(payment_method);

COMMENT ON COLUMN public.retailer_orders.payment_method IS '주문 시 선택/체결된 결제 수단 (card, ach, terms)';
COMMENT ON COLUMN public.retailer_orders.payment_due_date IS '후불 여신 주문 등의 결제 기한일';
COMMENT ON COLUMN public.retailer_orders.paid_at IS '실제 결제 완료 일시';
COMMENT ON COLUMN public.retailer_orders.payment_provider IS '결제 처리 게이트웨이 (stripe, manual, bank_transfer)';
COMMENT ON COLUMN public.retailer_orders.payment_provider_ref IS 'PG사 거래 고유 ID 또는 입금 레퍼런스';

-- 3. Create retailer_order_payments table
CREATE TABLE IF NOT EXISTS public.retailer_order_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.retailer_orders(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('card', 'ach', 'terms')),
  provider TEXT NOT NULL DEFAULT 'manual' CHECK (provider IN ('stripe', 'manual', 'bank_transfer')),
  provider_payment_id TEXT,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'refunded')),
  failure_reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_retailer_order_payments_order_id 
  ON public.retailer_order_payments(order_id);

CREATE INDEX IF NOT EXISTS idx_retailer_order_payments_company_id 
  ON public.retailer_order_payments(company_id);

CREATE INDEX IF NOT EXISTS idx_retailer_order_payments_status 
  ON public.retailer_order_payments(status);

COMMENT ON TABLE public.retailer_order_payments IS '리테일러 주문별 결제 시도 및 트랜잭션 기록';

-- 4. Enable Row Level Security
ALTER TABLE public.retailer_order_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retailer_order_payments FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "retailer_order_payments_admin_all" ON public.retailer_order_payments;
DROP POLICY IF EXISTS "retailer_order_payments_retailer_select" ON public.retailer_order_payments;
DROP POLICY IF EXISTS "retailer_order_payments_retailer_insert" ON public.retailer_order_payments;

CREATE POLICY "retailer_order_payments_admin_all"
  ON public.retailer_order_payments FOR ALL
  TO authenticated
  USING (public.auth_is_admin());

CREATE POLICY "retailer_order_payments_retailer_select"
  ON public.retailer_order_payments FOR SELECT
  TO authenticated
  USING (
    company_id = public.auth_company_id()
    AND EXISTS (
      SELECT 1 FROM public.retailer_orders ro
      WHERE ro.id = retailer_order_payments.order_id
        AND ro.company_id = public.auth_company_id()
        AND public.auth_can_retailer_view_order(ro.company_id, ro.store_id)
    )
  );

CREATE POLICY "retailer_order_payments_retailer_insert"
  ON public.retailer_order_payments FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = public.auth_company_id()
    AND EXISTS (
      SELECT 1 FROM public.retailer_orders ro
      WHERE ro.id = retailer_order_payments.order_id
        AND ro.company_id = public.auth_company_id()
        AND public.auth_can_retailer_submit_order(ro.company_id, ro.store_id)
    )
  );

-- Notify PostgREST
NOTIFY pgrst, 'reload schema';
