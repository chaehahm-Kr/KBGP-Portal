-- 0165_dispatch_invoicing_and_prepayment_allocation.sql
-- RTP-ORDER-PHASE-B3-001: Phase B3 — Dispatch-Based Invoice & Prepayment Allocation

-- 1. Extend retailer_invoices with fulfillment relationship and prepayment allocation
ALTER TABLE public.retailer_invoices
  ADD COLUMN IF NOT EXISTS fulfillment_id UUID REFERENCES public.retailer_order_fulfillments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fulfillment_number TEXT,
  ADD COLUMN IF NOT EXISTS prepayment_allocated_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (prepayment_allocated_amount >= 0),
  ADD COLUMN IF NOT EXISTS prepayment_allocation_status TEXT NOT NULL DEFAULT 'none' CHECK (prepayment_allocation_status IN ('none', 'partial', 'fully_allocated')),
  ADD COLUMN IF NOT EXISTS dispatch_notes TEXT;

-- Replace single-active-invoice-per-order index with dispatch-level uniqueness:
-- Exactly one active invoice per confirmed dispatch (fulfillment)
DROP INDEX IF EXISTS public.uq_retailer_invoices_active_order;

CREATE UNIQUE INDEX IF NOT EXISTS uq_retailer_invoices_active_fulfillment 
  ON public.retailer_invoices(fulfillment_id) 
  WHERE (fulfillment_id IS NOT NULL AND invoice_status NOT IN ('void', 'cancelled'));

-- Preserve legacy order-level guard for invoices created before dispatch separation
CREATE UNIQUE INDEX IF NOT EXISTS uq_retailer_invoices_active_order_legacy
  ON public.retailer_invoices(order_id)
  WHERE (fulfillment_id IS NULL AND invoice_status NOT IN ('void', 'cancelled'));

CREATE INDEX IF NOT EXISTS idx_retailer_invoices_fulfillment_id
  ON public.retailer_invoices(fulfillment_id);

COMMENT ON COLUMN public.retailer_invoices.fulfillment_id IS '출고 배송(Fulfillment) ID 연결 (Dispatch-Based Invoicing)';
COMMENT ON COLUMN public.retailer_invoices.fulfillment_number IS '출고 번호 (예: KSF-2026-000001)';
COMMENT ON COLUMN public.retailer_invoices.prepayment_allocated_amount IS '해당 인보이스에 상계(충당) 배정된 선결제 금액';
COMMENT ON COLUMN public.retailer_invoices.prepayment_allocation_status IS '선결제 상계 배정 상태 (none, partial, fully_allocated)';

-- 2. Create retailer_invoice_items table for dispatch line item tracking
CREATE TABLE IF NOT EXISTS public.retailer_invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.retailer_invoices(id) ON DELETE CASCADE,
  order_item_id UUID REFERENCES public.retailer_order_items(id) ON DELETE SET NULL,
  product_id UUID REFERENCES public.products(id),
  sku TEXT NOT NULL,
  product_name TEXT NOT NULL,
  brand_name TEXT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_wholesale_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  unit_msrp NUMERIC(12, 2),
  line_subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  allocated_discount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  line_total NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_retailer_invoice_items_invoice_id 
  ON public.retailer_invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_retailer_invoice_items_order_item_id 
  ON public.retailer_invoice_items(order_item_id);
CREATE INDEX IF NOT EXISTS idx_retailer_invoice_items_sku 
  ON public.retailer_invoice_items(sku);

COMMENT ON TABLE public.retailer_invoice_items IS '출고별 인보이스에 포함된 실제 출고 품목 및 금액 명세';

-- Enable RLS on retailer_invoice_items
ALTER TABLE public.retailer_invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retailer_invoice_items FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access on retailer_invoice_items" ON public.retailer_invoice_items;
CREATE POLICY "Admin full access on retailer_invoice_items" ON public.retailer_invoice_items
  FOR ALL TO authenticated
  USING (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());

DROP POLICY IF EXISTS "Retailer read own invoice items" ON public.retailer_invoice_items;
CREATE POLICY "Retailer read own invoice items" ON public.retailer_invoice_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.retailer_invoices ri
      WHERE ri.id = retailer_invoice_items.invoice_id
        AND ri.retailer_company_id = public.auth_company_id()
    )
  );

-- 3. Create retailer_prepayment_allocations table for audit trail
CREATE TABLE IF NOT EXISTS public.retailer_prepayment_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.retailer_orders(id) ON DELETE CASCADE,
  payment_id UUID REFERENCES public.retailer_order_payments(id) ON DELETE SET NULL,
  invoice_id UUID NOT NULL REFERENCES public.retailer_invoices(id) ON DELETE CASCADE,
  allocated_amount NUMERIC(12, 2) NOT NULL CHECK (allocated_amount > 0),
  allocated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_prepay_alloc_order_id ON public.retailer_prepayment_allocations(order_id);
CREATE INDEX IF NOT EXISTS idx_prepay_alloc_invoice_id ON public.retailer_prepayment_allocations(invoice_id);
CREATE INDEX IF NOT EXISTS idx_prepay_alloc_payment_id ON public.retailer_prepayment_allocations(payment_id);

COMMENT ON TABLE public.retailer_prepayment_allocations IS '주문 선결제금의 출고 인보이스별 상계 배정 이력';

-- Enable RLS on retailer_prepayment_allocations
ALTER TABLE public.retailer_prepayment_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retailer_prepayment_allocations FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access on retailer_prepayment_allocations" ON public.retailer_prepayment_allocations;
CREATE POLICY "Admin full access on retailer_prepayment_allocations" ON public.retailer_prepayment_allocations
  FOR ALL TO authenticated
  USING (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());

DROP POLICY IF EXISTS "Retailer read own prepayment allocations" ON public.retailer_prepayment_allocations;
CREATE POLICY "Retailer read own prepayment allocations" ON public.retailer_prepayment_allocations
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.retailer_orders ro
      WHERE ro.id = retailer_prepayment_allocations.order_id
        AND ro.company_id = public.auth_company_id()
    )
  );

-- 4. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
