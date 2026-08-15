-- 0061_supplier_invoices.sql — Supplier Invoice / Accounts Payable V1
--

-- 1. Create ap_number sequence
CREATE SEQUENCE IF NOT EXISTS public.supplier_invoice_ap_number_seq START WITH 1;

-- 2. Create supplier_invoices table
CREATE TABLE IF NOT EXISTS public.supplier_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  internal_ap_number TEXT NOT NULL UNIQUE,
  supplier_invoice_number TEXT NOT NULL,
  invoice_date DATE NOT NULL,
  received_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  payment_terms_snapshot TEXT,
  incoterms_snapshot TEXT,
  subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  tax_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  other_charges NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  invoice_total NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  amount_paid NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  balance_due NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  invoice_status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (invoice_status IN ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'VOID')),
  payment_status TEXT NOT NULL DEFAULT 'UNPAID' CHECK (payment_status IN ('UNPAID', 'PARTIALLY_PAID', 'PAID')),
  attachment_path TEXT,
  internal_note TEXT,
  rejection_reason TEXT,
  submitted_at TIMESTAMPTZ,
  submitted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  rejected_at TIMESTAMPTZ,
  rejected_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  voided_at TIMESTAMPTZ,
  voided_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT supplier_invoice_number_unique UNIQUE (supplier_company_id, supplier_invoice_number)
);

COMMENT ON TABLE public.supplier_invoices IS '공급사 청구 인보이스 및 외상매입금(AP) 관리 테이블';

-- 3. Create supplier_invoice_lines table
CREATE TABLE IF NOT EXISTS public.supplier_invoice_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_invoice_id UUID NOT NULL REFERENCES public.supplier_invoices(id) ON DELETE CASCADE,
  purchase_order_line_id UUID REFERENCES public.purchase_order_lines(id) ON DELETE SET NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  sku_snapshot TEXT NOT NULL,
  product_name_snapshot TEXT NOT NULL,
  invoiced_qty INT NOT NULL CHECK (invoiced_qty > 0),
  unit_price NUMERIC(12, 4) NOT NULL CHECK (unit_price >= 0),
  line_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  line_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.supplier_invoice_lines IS '공급사 인보이스 세부 품목 라인 테이블';

-- 4. Enable RLS
ALTER TABLE public.supplier_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_invoices FORCE ROW LEVEL SECURITY;

ALTER TABLE public.supplier_invoice_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_invoice_lines FORCE ROW LEVEL SECURITY;

-- 5. RLS Policies
DROP POLICY IF EXISTS "supplier_invoices_admin_all" ON public.supplier_invoices;
CREATE POLICY "supplier_invoices_admin_all"
  ON public.supplier_invoices FOR ALL
  TO authenticated
  USING (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());

DROP POLICY IF EXISTS "supplier_invoices_portal_select" ON public.supplier_invoices;
CREATE POLICY "supplier_invoices_portal_select"
  ON public.supplier_invoices FOR SELECT
  TO authenticated
  USING (supplier_company_id = public.auth_company_id());

DROP POLICY IF EXISTS "supplier_invoice_lines_admin_all" ON public.supplier_invoice_lines;
CREATE POLICY "supplier_invoice_lines_admin_all"
  ON public.supplier_invoice_lines FOR ALL
  TO authenticated
  USING (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());

DROP POLICY IF EXISTS "supplier_invoice_lines_portal_select" ON public.supplier_invoice_lines;
CREATE POLICY "supplier_invoice_lines_portal_select"
  ON public.supplier_invoice_lines FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.supplier_invoices si
    WHERE si.id = supplier_invoice_id
      AND si.supplier_company_id = public.auth_company_id()
  ));

-- 6. Trigger to auto-set internal_ap_number
CREATE OR REPLACE FUNCTION public.set_supplier_invoice_ap_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.internal_ap_number IS NULL OR NEW.internal_ap_number = '' THEN
    NEW.internal_ap_number := 'AP-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.supplier_invoice_ap_number_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_supplier_invoice_ap_number ON public.supplier_invoices;
CREATE TRIGGER trigger_set_supplier_invoice_ap_number
  BEFORE INSERT ON public.supplier_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.set_supplier_invoice_ap_number();
