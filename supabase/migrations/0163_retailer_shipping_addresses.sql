-- 0163_retailer_shipping_addresses.sql
-- RTP-CHECKOUT-ACCOUNT-SETUP-001: Retailer Shipping Addresses, Safe Payment Methods Metadata & Order Shipping Snapshot

-- 1. Create retailer_shipping_addresses table
CREATE TABLE IF NOT EXISTS public.retailer_shipping_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  recipient_name TEXT NOT NULL,
  attention_name TEXT,
  address_line1 TEXT NOT NULL,
  address_line2 TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  zip TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'US',
  phone TEXT,
  delivery_notes TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_retailer_shipping_addresses_company_id 
  ON public.retailer_shipping_addresses(company_id);
CREATE INDEX IF NOT EXISTS idx_retailer_shipping_addresses_active 
  ON public.retailer_shipping_addresses(company_id, is_active);

COMMENT ON TABLE public.retailer_shipping_addresses IS '리테일러 배송지 주소록 (물류창고, 지점, 본사 등 재사용 배송 목적지)';

-- Enable RLS for retailer_shipping_addresses
ALTER TABLE public.retailer_shipping_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retailer_shipping_addresses FORCE ROW LEVEL SECURITY;

-- Admin Policy
DROP POLICY IF EXISTS "Admin full access on retailer_shipping_addresses" ON public.retailer_shipping_addresses;
CREATE POLICY "Admin full access on retailer_shipping_addresses" ON public.retailer_shipping_addresses
  FOR ALL TO authenticated
  USING (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());

-- Retailer Policy (Tenant Isolation via auth_company_id & company_roles)
DROP POLICY IF EXISTS "Retailer manage own shipping addresses" ON public.retailer_shipping_addresses;
CREATE POLICY "Retailer manage own shipping addresses" ON public.retailer_shipping_addresses
  FOR ALL TO authenticated
  USING (
    company_id = public.auth_company_id()
    AND EXISTS (
      SELECT 1 FROM public.company_roles cr
      WHERE cr.company_id = public.auth_company_id()
        AND cr.role = 'Retailer'
    )
  )
  WITH CHECK (
    company_id = public.auth_company_id()
    AND EXISTS (
      SELECT 1 FROM public.company_roles cr
      WHERE cr.company_id = public.auth_company_id()
        AND cr.role = 'Retailer'
    )
  );

-- 2. Create retailer_payment_methods table (Safe metadata foundation only - NO raw card/bank data)
CREATE TABLE IF NOT EXISTS public.retailer_payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  payment_method_type TEXT NOT NULL CHECK (payment_method_type IN ('card', 'ach')),
  provider_name TEXT NOT NULL DEFAULT 'stripe',
  provider_payment_method_id TEXT,
  brand TEXT,
  last4 TEXT,
  exp_month INTEGER,
  exp_year INTEGER,
  bank_name TEXT,
  account_holder_type TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'revoked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_retailer_payment_methods_company_id 
  ON public.retailer_payment_methods(company_id);

COMMENT ON TABLE public.retailer_payment_methods IS '리테일러 안전 결제 수단 메타데이터 (카드 끝 4자리, 은행명 등 토큰화 메타데이터 - 민감 정보 미저장)';

-- Enable RLS for retailer_payment_methods
ALTER TABLE public.retailer_payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retailer_payment_methods FORCE ROW LEVEL SECURITY;

-- Admin Policy
DROP POLICY IF EXISTS "Admin full access on retailer_payment_methods" ON public.retailer_payment_methods;
CREATE POLICY "Admin full access on retailer_payment_methods" ON public.retailer_payment_methods
  FOR ALL TO authenticated
  USING (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());

-- Retailer Policy
DROP POLICY IF EXISTS "Retailer manage own payment methods" ON public.retailer_payment_methods;
CREATE POLICY "Retailer manage own payment methods" ON public.retailer_payment_methods
  FOR ALL TO authenticated
  USING (
    company_id = public.auth_company_id()
    AND EXISTS (
      SELECT 1 FROM public.company_roles cr
      WHERE cr.company_id = public.auth_company_id()
        AND cr.role = 'Retailer'
    )
  )
  WITH CHECK (
    company_id = public.auth_company_id()
    AND EXISTS (
      SELECT 1 FROM public.company_roles cr
      WHERE cr.company_id = public.auth_company_id()
        AND cr.role = 'Retailer'
    )
  );

-- 3. Extend retailer_orders with shipping destination columns
ALTER TABLE public.retailer_orders
  ADD COLUMN IF NOT EXISTS shipping_address_line2 TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS shipping_destination_type TEXT DEFAULT 'store',
  ADD COLUMN IF NOT EXISTS shipping_snapshot JSONB DEFAULT NULL;

-- 4. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
