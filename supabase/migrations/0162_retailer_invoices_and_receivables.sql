-- 0162_retailer_invoices_and_receivables.sql
-- ADM-INV-AR-001: Retailer Invoices & Accounts Receivable Foundation

-- 1. Sequence for human-readable, concurrency-safe invoice number generation (e.g. KSI-2026-000001)
CREATE SEQUENCE IF NOT EXISTS public.retailer_invoice_seq START WITH 1;

CREATE OR REPLACE FUNCTION public.generate_next_invoice_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  next_val BIGINT;
  curr_year TEXT;
BEGIN
  next_val := nextval('public.retailer_invoice_seq');
  curr_year := to_char(CURRENT_DATE, 'YYYY');
  RETURN 'KSI-' || curr_year || '-' || lpad(next_val::text, 6, '0');
END;
$$;

-- 2. Retailer Invoices table
CREATE TABLE IF NOT EXISTS public.retailer_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL UNIQUE DEFAULT public.generate_next_invoice_number(),
  order_id UUID NOT NULL REFERENCES public.retailer_orders(id) ON DELETE CASCADE,
  retailer_company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  terms_days INTEGER NOT NULL DEFAULT 30 CHECK (terms_days >= 0),
  terms_name TEXT NOT NULL DEFAULT 'Net 30',
  subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  discount_total NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  processing_fee NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  shipping NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  tax NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (total_amount >= 0),
  amount_paid NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (amount_paid >= 0),
  balance_due NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  invoice_status TEXT NOT NULL DEFAULT 'open' CHECK (invoice_status IN ('draft', 'open', 'paid', 'void', 'cancelled')),
  payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'partial', 'paid', 'failed', 'refunded')),
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ,
  voided_at TIMESTAMPTZ,
  notes TEXT,
  terms_snapshot JSONB,
  billing_snapshot JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Idempotency protection: Prevent duplicate active invoices for the same order
CREATE UNIQUE INDEX IF NOT EXISTS uq_retailer_invoices_active_order 
  ON public.retailer_invoices(order_id) 
  WHERE (invoice_status NOT IN ('void', 'cancelled'));

-- Query performance indexes
CREATE INDEX IF NOT EXISTS idx_retailer_invoices_order_id ON public.retailer_invoices(order_id);
CREATE INDEX IF NOT EXISTS idx_retailer_invoices_company_id ON public.retailer_invoices(retailer_company_id);
CREATE INDEX IF NOT EXISTS idx_retailer_invoices_due_date ON public.retailer_invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_retailer_invoices_status ON public.retailer_invoices(invoice_status, payment_status);
CREATE INDEX IF NOT EXISTS idx_retailer_invoices_number ON public.retailer_invoices(upper(invoice_number));

COMMENT ON TABLE public.retailer_invoices IS '리테일러 Net Terms 주문 인보이스 및 외상매출금(AR) 마스터 테이블';

-- 3. Extend retailer_order_payments with invoice relation
ALTER TABLE public.retailer_order_payments
  ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES public.retailer_invoices(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_retailer_order_payments_invoice_id 
  ON public.retailer_order_payments(invoice_id);

-- 4. Enable Row Level Security
ALTER TABLE public.retailer_invoices ENABLE ROW LEVEL SECURITY;

-- Admin full access policy
DROP POLICY IF EXISTS "Admin full access on retailer_invoices" ON public.retailer_invoices;
CREATE POLICY "Admin full access on retailer_invoices" ON public.retailer_invoices
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_users cu
      JOIN public.companies c ON cu.company_id = c.id
      WHERE cu.id = auth.uid() AND c.company_type = 'PLATFORM_OPERATOR'
    )
  );

-- Retailer tenant read isolation policy
DROP POLICY IF EXISTS "Retailer read own invoices" ON public.retailer_invoices;
CREATE POLICY "Retailer read own invoices" ON public.retailer_invoices
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_users cu
      WHERE cu.id = auth.uid() AND cu.company_id = retailer_invoices.retailer_company_id
    )
  );

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
