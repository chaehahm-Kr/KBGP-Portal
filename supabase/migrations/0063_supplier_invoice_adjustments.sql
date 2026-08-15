-- 0063_supplier_invoice_adjustments.sql — Supplier Invoice Adjustments & Settlement Foundation
-- Introduce adjustments (shortage, damage, price discrepancy) and settlement tracking.

-- 1. Add settlement_status to supplier_invoices
ALTER TABLE public.supplier_invoices 
  ADD COLUMN IF NOT EXISTS settlement_status TEXT NOT NULL DEFAULT 'OPEN' 
  CHECK (settlement_status IN ('OPEN', 'PENDING_ADJUSTMENT', 'SETTLED'));

COMMENT ON COLUMN public.supplier_invoices.settlement_status IS '대금 정산 진행 상태 (OPEN: 개시/미정산, PENDING_ADJUSTMENT: 조정 진행중, SETTLED: 정산 완료)';

-- 2. Create supplier_invoice_adjustments table
CREATE TABLE IF NOT EXISTS public.supplier_invoice_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_invoice_id UUID NOT NULL REFERENCES public.supplier_invoices(id) ON DELETE RESTRICT,
  supplier_invoice_line_id UUID REFERENCES public.supplier_invoice_lines(id) ON DELETE RESTRICT,
  adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('SHORTAGE', 'DAMAGE', 'PRICE_DIFFERENCE', 'OTHER')),
  adjustment_direction TEXT NOT NULL CHECK (adjustment_direction IN ('CREDIT', 'CHARGE')),
  quantity INT CHECK (quantity >= 0),
  unit_amount NUMERIC(12, 4) CHECK (unit_amount >= 0),
  adjustment_amount NUMERIC(12, 2) NOT NULL CHECK (adjustment_amount >= 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  reason TEXT NOT NULL,
  reference_type TEXT CHECK (reference_type IN ('SHIPMENT', 'RECEIVING', 'VARIANCE_CLOSE', 'OTHER')),
  reference_id UUID,
  supplier_credit_reference TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'VOID')),
  internal_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  rejected_at TIMESTAMPTZ,
  rejected_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  rejection_reason TEXT,
  voided_at TIMESTAMPTZ,
  voided_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.supplier_invoice_adjustments IS '공급사 송장 조정 및 크레딧/차지 항목 명세 테이블';

-- 3. Enable RLS
ALTER TABLE public.supplier_invoice_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_invoice_adjustments FORCE ROW LEVEL SECURITY;

-- 4. RLS Policies
DROP POLICY IF EXISTS "supplier_invoice_adjustments_admin_all" ON public.supplier_invoice_adjustments;
CREATE POLICY "supplier_invoice_adjustments_admin_all"
  ON public.supplier_invoice_adjustments FOR ALL
  TO authenticated
  USING (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());

DROP POLICY IF EXISTS "supplier_invoice_adjustments_portal_select" ON public.supplier_invoice_adjustments;
CREATE POLICY "supplier_invoice_adjustments_portal_select"
  ON public.supplier_invoice_adjustments FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.supplier_invoices si
    WHERE si.id = supplier_invoice_id
      AND si.supplier_company_id = public.auth_company_id()
  ));
