-- 0167_order_cancellation_and_refund_architecture.sql
-- RTP-ORDER-PHASE-B5-001: Order Cancellation, Credit Release & Refund Management

-- 1. Create retailer_order_cancellation_requests table
CREATE TABLE IF NOT EXISTS public.retailer_order_cancellation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.retailer_orders(id) ON DELETE RESTRICT,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
  requested_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  request_type TEXT NOT NULL CHECK (request_type IN ('full', 'partial')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'withdrawn')),
  reason_category TEXT NOT NULL CHECK (reason_category IN ('buyer_request', 'out_of_stock', 'delivery_delay', 'duplicate_order', 'pricing_error', 'other')),
  reason_notes TEXT,
  admin_reviewer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  admin_notes TEXT,
  idempotency_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for performance and company isolation
CREATE INDEX IF NOT EXISTS idx_cancellation_requests_order_id ON public.retailer_order_cancellation_requests(order_id);
CREATE INDEX IF NOT EXISTS idx_cancellation_requests_company_id ON public.retailer_order_cancellation_requests(company_id);
CREATE INDEX IF NOT EXISTS idx_cancellation_requests_status ON public.retailer_order_cancellation_requests(status);
CREATE INDEX IF NOT EXISTS idx_cancellation_requests_created_at ON public.retailer_order_cancellation_requests(created_at DESC);

-- Concurrency Protection: Exactly one active pending cancellation request per order
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_cancellation_request_per_order 
  ON public.retailer_order_cancellation_requests(order_id) 
  WHERE (status = 'pending');

COMMENT ON TABLE public.retailer_order_cancellation_requests IS '리테일러 주문 취소 요청 헤더 및 관리자 심사 이력';

-- 2. Create retailer_order_cancellation_request_items table
CREATE TABLE IF NOT EXISTS public.retailer_order_cancellation_request_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.retailer_order_cancellation_requests(id) ON DELETE CASCADE,
  order_item_id UUID NOT NULL REFERENCES public.retailer_order_items(id) ON DELETE RESTRICT,
  quantity_requested INTEGER NOT NULL CHECK (quantity_requested > 0),
  quantity_approved INTEGER NOT NULL DEFAULT 0 CHECK (quantity_approved >= 0),
  quantity_rejected INTEGER NOT NULL DEFAULT 0 CHECK (quantity_rejected >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_cancellation_request_item UNIQUE (request_id, order_item_id)
);

CREATE INDEX IF NOT EXISTS idx_cancellation_request_items_request_id ON public.retailer_order_cancellation_request_items(request_id);
CREATE INDEX IF NOT EXISTS idx_cancellation_request_items_order_item_id ON public.retailer_order_cancellation_request_items(order_item_id);

COMMENT ON TABLE public.retailer_order_cancellation_request_items IS '취소 요청별 품목 단위 요청 수량 및 승인/반려 내역';

-- 3. Create retailer_order_refund_records table
CREATE TABLE IF NOT EXISTS public.retailer_order_refund_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.retailer_orders(id) ON DELETE RESTRICT,
  cancellation_request_id UUID REFERENCES public.retailer_order_cancellation_requests(id) ON DELETE SET NULL,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  payment_id UUID REFERENCES public.retailer_order_payments(id) ON DELETE SET NULL,
  merchandise_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  tax_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  shipping_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  fee_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  total_refund_amount NUMERIC(12, 2) NOT NULL CHECK (total_refund_amount >= 0),
  refund_status TEXT NOT NULL DEFAULT 'due' CHECK (refund_status IN ('due', 'approved', 'processing', 'completed', 'failed')),
  provider TEXT NOT NULL DEFAULT 'manual',
  provider_refund_id TEXT,
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_refund_records_order_id ON public.retailer_order_refund_records(order_id);
CREATE INDEX IF NOT EXISTS idx_order_refund_records_company_id ON public.retailer_order_refund_records(company_id);
CREATE INDEX IF NOT EXISTS idx_order_refund_records_status ON public.retailer_order_refund_records(refund_status);

COMMENT ON TABLE public.retailer_order_refund_records IS '선결제(카드/ACH) 주문 취소에 따른 환불 의무 및 승인/지급 원장';

-- 4. Enable Row Level Security
ALTER TABLE public.retailer_order_cancellation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retailer_order_cancellation_requests FORCE ROW LEVEL SECURITY;

ALTER TABLE public.retailer_order_cancellation_request_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retailer_order_cancellation_request_items FORCE ROW LEVEL SECURITY;

ALTER TABLE public.retailer_order_refund_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retailer_order_refund_records FORCE ROW LEVEL SECURITY;

-- Admin full access policies
DROP POLICY IF EXISTS "Admin full access on retailer_order_cancellation_requests" ON public.retailer_order_cancellation_requests;
CREATE POLICY "Admin full access on retailer_order_cancellation_requests" ON public.retailer_order_cancellation_requests
  FOR ALL TO authenticated
  USING (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());

DROP POLICY IF EXISTS "Admin full access on retailer_order_cancellation_request_items" ON public.retailer_order_cancellation_request_items;
CREATE POLICY "Admin full access on retailer_order_cancellation_request_items" ON public.retailer_order_cancellation_request_items
  FOR ALL TO authenticated
  USING (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());

DROP POLICY IF EXISTS "Admin full access on retailer_order_refund_records" ON public.retailer_order_refund_records;
CREATE POLICY "Admin full access on retailer_order_refund_records" ON public.retailer_order_refund_records
  FOR ALL TO authenticated
  USING (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());

-- Retailer tenant-scoped access policies
DROP POLICY IF EXISTS "Retailer read own cancellation requests" ON public.retailer_order_cancellation_requests;
CREATE POLICY "Retailer read own cancellation requests" ON public.retailer_order_cancellation_requests
  FOR SELECT TO authenticated
  USING (company_id = public.auth_company_id());

DROP POLICY IF EXISTS "Retailer read own cancellation request items" ON public.retailer_order_cancellation_request_items;
CREATE POLICY "Retailer read own cancellation request items" ON public.retailer_order_cancellation_request_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.retailer_order_cancellation_requests req
      WHERE req.id = retailer_order_cancellation_request_items.request_id
        AND req.company_id = public.auth_company_id()
    )
  );

DROP POLICY IF EXISTS "Retailer read own refund records" ON public.retailer_order_refund_records;
CREATE POLICY "Retailer read own refund records" ON public.retailer_order_refund_records
  FOR SELECT TO authenticated
  USING (company_id = public.auth_company_id());

-- 5. Extend retailer_orders.refund_status check constraint to support granular financial workflow states
DO $$
BEGIN
  ALTER TABLE public.retailer_orders DROP CONSTRAINT IF EXISTS retailer_orders_refund_status_check;
  ALTER TABLE public.retailer_orders
    ADD CONSTRAINT retailer_orders_refund_status_check
    CHECK (refund_status IN (
      'none',
      'requested',
      'due',
      'approved',
      'processing',
      'partially_refunded',
      'refunded',
      'completed',
      'failed'
    ));
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;

-- 6. Upgrade compute_retailer_credit_exposure with Mixed-Price SKU Itemized Accuracy and partially_cancelled exclusion
CREATE OR REPLACE FUNCTION public.compute_retailer_credit_exposure(
  p_company_id UUID
)
RETURNS TABLE (
  credit_limit NUMERIC(12, 2),
  open_ar NUMERIC(12, 2),
  unbilled_reservation NUMERIC(12, 2),
  total_exposure NUMERIC(12, 2),
  available_credit NUMERIC(12, 2),
  over_limit_amount NUMERIC(12, 2)
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_credit_limit NUMERIC(12, 2) := 0.00;
  v_open_ar NUMERIC(12, 2) := 0.00;
  v_unbilled_reservation NUMERIC(12, 2) := 0.00;
  v_total_exposure NUMERIC(12, 2) := 0.00;
  v_available_credit NUMERIC(12, 2) := 0.00;
  v_over_limit_amount NUMERIC(12, 2) := 0.00;
BEGIN
  -- A. Fetch Credit Limit
  SELECT COALESCE(rp.credit_limit, 0.00)
  INTO v_credit_limit
  FROM public.retailer_profiles rp
  WHERE rp.company_id = p_company_id;

  IF v_credit_limit IS NULL THEN
    v_credit_limit := 0.00;
  END IF;

  -- B. Fetch Open AR from active issued invoices (excluding void and cancelled)
  SELECT COALESCE(SUM(ri.balance_due), 0.00)
  INTO v_open_ar
  FROM public.retailer_invoices ri
  WHERE ri.retailer_company_id = p_company_id
    AND ri.invoice_status NOT IN ('void', 'cancelled')
    AND ri.balance_due > 0;

  IF v_open_ar IS NULL THEN
    v_open_ar := 0.00;
  END IF;

  -- C. Fetch Unbilled Reservation across active Net Terms orders
  -- Excludes: cancelled, shipped, delivered, partially_cancelled orders, and prepaid (card/ach) orders
  SELECT COALESCE(SUM(
    GREATEST(0.00,
      ro.total_amount -
      COALESCE((
        SELECT SUM(ri.total_amount)
        FROM public.retailer_invoices ri
        WHERE ri.order_id = ro.id
          AND ri.invoice_status NOT IN ('void', 'cancelled')
      ), 0.00) -
      COALESCE((
        SELECT SUM(
          CASE 
            WHEN roi.quantity > 0 AND roi.quantity_cancelled > 0 THEN
              ROUND((roi.quantity_cancelled::numeric / roi.quantity::numeric) * roi.line_total, 2)
            ELSE 0.00
          END
        )
        FROM public.retailer_order_items roi
        WHERE roi.order_id = ro.id
      ), 0.00)
    )
  ), 0.00)
  INTO v_unbilled_reservation
  FROM public.retailer_orders ro
  WHERE ro.company_id = p_company_id
    AND (
      ro.payment_method = 'terms' OR
      (ro.payment_terms IS NOT NULL AND UPPER(ro.payment_terms) NOT IN ('PREPAID', 'PREPAID_CARD', 'PREPAID_ACH', 'CARD', 'ACH'))
    )
    AND ro.order_status NOT IN ('cancelled', 'shipped', 'delivered', 'partially_cancelled');

  IF v_unbilled_reservation IS NULL THEN
    v_unbilled_reservation := 0.00;
  END IF;

  -- D. Compute Total Exposure & Available Credit
  v_total_exposure := ROUND(v_open_ar + v_unbilled_reservation, 2);
  v_available_credit := GREATEST(0.00, ROUND(v_credit_limit - v_total_exposure, 2));
  v_over_limit_amount := GREATEST(0.00, ROUND(v_total_exposure - v_credit_limit, 2));

  RETURN QUERY SELECT
    v_credit_limit,
    v_open_ar,
    v_unbilled_reservation,
    v_total_exposure,
    v_available_credit,
    v_over_limit_amount;
END;
$$;

-- 7. Reload PostgREST Schema Cache
NOTIFY pgrst, 'reload schema';
