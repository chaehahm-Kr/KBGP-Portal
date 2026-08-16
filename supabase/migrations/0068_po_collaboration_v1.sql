-- 0068_po_collaboration_v1.sql — Purchase Order Collaboration V1 Schema Extensions

-- 1. Extend purchase_order_lines
ALTER TABLE public.purchase_order_lines ADD COLUMN IF NOT EXISTS confirmed_qty INTEGER;
COMMENT ON COLUMN public.purchase_order_lines.confirmed_qty IS '공급사와 합의하여 확정된 입고 수량 (NULL: 미확정)';

-- 2. Extend purchase_orders
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS supplier_confirmation_status TEXT DEFAULT 'PENDING' CHECK (supplier_confirmation_status IN ('PENDING', 'CONFIRMED', 'CHANGE_REQUESTED'));
COMMENT ON COLUMN public.purchase_orders.supplier_confirmation_status IS '공급사의 PO 수락 및 조율 상태 (PENDING: 대기, CONFIRMED: 확정, CHANGE_REQUESTED: 변경요청됨)';

-- 3. Create purchase_order_change_requests table
CREATE TABLE IF NOT EXISTS public.purchase_order_change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  purchase_order_line_id UUID REFERENCES public.purchase_order_lines(id) ON DELETE CASCADE,
  requested_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  requested_by_company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL CHECK (request_type IN ('QUANTITY', 'PRICE', 'OTHER')),
  original_qty INTEGER,
  proposed_qty INTEGER,
  original_unit_price NUMERIC(15, 4),
  proposed_unit_price NUMERIC(15, 4),
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN')),
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.purchase_order_change_requests IS '공급사에서 요청한 발주 변경 제안 및 처리 이력';

-- 4. Enable RLS
ALTER TABLE public.purchase_order_change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_change_requests FORCE ROW LEVEL SECURITY;

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_po_change_requests_po ON public.purchase_order_change_requests(purchase_order_id);

-- Enforce ONE active PENDING request per PO line
CREATE UNIQUE INDEX IF NOT EXISTS po_line_active_pending_request_idx 
ON public.purchase_order_change_requests (purchase_order_line_id) 
WHERE status = 'PENDING';

-- Enforce ONE active PENDING request per PO header (when line_id is null)
CREATE UNIQUE INDEX IF NOT EXISTS po_active_pending_request_idx 
ON public.purchase_order_change_requests (purchase_order_id) 
WHERE (purchase_order_line_id IS NULL AND status = 'PENDING');

-- 6. RLS Policies
DROP POLICY IF EXISTS "change_requests_admin_all" ON public.purchase_order_change_requests;
CREATE POLICY "change_requests_admin_all"
  ON public.purchase_order_change_requests FOR ALL
  TO authenticated
  USING (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());

DROP POLICY IF EXISTS "change_requests_portal_select" ON public.purchase_order_change_requests;
CREATE POLICY "change_requests_portal_select"
  ON public.purchase_order_change_requests FOR SELECT
  TO authenticated
  USING (requested_by_company_id = public.auth_company_id());

DROP POLICY IF EXISTS "change_requests_portal_insert" ON public.purchase_order_change_requests;
CREATE POLICY "change_requests_portal_insert"
  ON public.purchase_order_change_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    requested_by_company_id = public.auth_company_id() 
    AND EXISTS (
      SELECT 1 FROM public.purchase_orders po
      WHERE po.id = purchase_order_id AND po.supplier_id = public.auth_company_id()
    )
  );

DROP POLICY IF EXISTS "change_requests_portal_update" ON public.purchase_order_change_requests;
CREATE POLICY "change_requests_portal_update"
  ON public.purchase_order_change_requests FOR UPDATE
  TO authenticated
  USING (requested_by_company_id = public.auth_company_id() AND status = 'PENDING')
  WITH CHECK (requested_by_company_id = public.auth_company_id() AND status = 'PENDING');
