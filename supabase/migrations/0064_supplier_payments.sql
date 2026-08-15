-- 0064_supplier_payments.sql — Supplier Payments / Remittance Transaction V1
-- Introduce payments tracking linked to approved supplier invoices and remittance bank accounts.

-- 1. Create payment number sequence
CREATE SEQUENCE IF NOT EXISTS public.supplier_payment_number_seq START WITH 1;

-- 2. Create supplier_payments table
CREATE TABLE IF NOT EXISTS public.supplier_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_number TEXT NOT NULL UNIQUE,
  supplier_invoice_id UUID NOT NULL REFERENCES public.supplier_invoices(id) ON DELETE RESTRICT,
  supplier_remittance_id UUID REFERENCES public.supplier_remittances(company_id) ON DELETE RESTRICT,
  payment_date DATE NOT NULL,
  payment_amount NUMERIC(12, 2) NOT NULL CHECK (payment_amount > 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  payment_method TEXT NOT NULL CHECK (payment_method IN ('WIRE', 'ACH', 'CHECK', 'OTHER')),
  bank_reference TEXT,
  remittance_reference TEXT,
  internal_note TEXT,
  attachment_path TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'COMPLETED', 'VOID')),
  
  -- Historical Remittance Destination Snapshot (Masked/Safe)
  remittance_bank_name TEXT,
  remittance_beneficiary_name TEXT,
  remittance_account_last4 TEXT,
  remittance_swift_bic_masked TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  voided_at TIMESTAMPTZ,
  voided_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.supplier_payments IS '공급사 대금 지급 내역 관리 테이블';

-- 3. Enable RLS
ALTER TABLE public.supplier_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_payments FORCE ROW LEVEL SECURITY;

-- 4. RLS Policies
DROP POLICY IF EXISTS "supplier_payments_admin_all" ON public.supplier_payments;
CREATE POLICY "supplier_payments_admin_all"
  ON public.supplier_payments FOR ALL
  TO authenticated
  USING (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());

DROP POLICY IF EXISTS "supplier_payments_portal_select" ON public.supplier_payments;
CREATE POLICY "supplier_payments_portal_select"
  ON public.supplier_payments FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.supplier_invoices si
    WHERE si.id = supplier_invoice_id
      AND si.supplier_company_id = public.auth_company_id()
  ));

-- 5. Trigger to auto-set payment_number
CREATE OR REPLACE FUNCTION public.set_supplier_payment_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.payment_number IS NULL OR NEW.payment_number = '' THEN
    NEW.payment_number := 'PAY-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.supplier_payment_number_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_supplier_payment_number ON public.supplier_payments;
CREATE TRIGGER trigger_set_supplier_payment_number
  BEFORE INSERT ON public.supplier_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_supplier_payment_number();
