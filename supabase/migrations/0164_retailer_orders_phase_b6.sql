-- 0164_retailer_orders_phase_b6.sql
-- RTP-ORDER-PHASE-B6: Retailer Orders Phase B6 - 6 Approved Statuses, Units Reconciliation & Multi-Box Logistics

-- 1. Update Order Status Constraint on public.retailer_orders
DO $$
BEGIN
  -- Drop previous constraint if exists
  ALTER TABLE public.retailer_orders 
    DROP CONSTRAINT IF EXISTS retailer_orders_order_status_check;

  -- Re-create constraint including all 6 approved statuses + legacy states for safety
  ALTER TABLE public.retailer_orders
    ADD CONSTRAINT retailer_orders_order_status_check
    CHECK (order_status IN (
      'draft',
      'submitted',
      'confirmed',
      'processing',
      'partially_shipped',
      'shipped',
      'delivered',
      'partially_cancelled',
      'cancelled'
    ));
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;

-- 2. Add units accounting, box counts, and refund fields to public.retailer_orders
ALTER TABLE public.retailer_orders
  ADD COLUMN IF NOT EXISTS total_ordered_units INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_shipped_units INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_cancelled_units INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_remaining_units INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_box_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cancellation_requested BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cancellation_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancellation_notes TEXT,
  ADD COLUMN IF NOT EXISTS refund_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS refund_status TEXT DEFAULT 'none' CHECK (refund_status IN ('none', 'requested', 'partially_refunded', 'refunded')),
  ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;

-- 3. Add item-level shipped/cancelled units to public.retailer_order_items
ALTER TABLE public.retailer_order_items
  ADD COLUMN IF NOT EXISTS quantity_shipped INTEGER NOT NULL DEFAULT 0 CHECK (quantity_shipped >= 0),
  ADD COLUMN IF NOT EXISTS quantity_cancelled INTEGER NOT NULL DEFAULT 0 CHECK (quantity_cancelled >= 0),
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

-- 4. Add box count to public.retailer_order_fulfillments
ALTER TABLE public.retailer_order_fulfillments
  ADD COLUMN IF NOT EXISTS box_count INTEGER NOT NULL DEFAULT 1 CHECK (box_count >= 1);

-- 5. Create public.retailer_order_packages (Multi-Box Carton Tracking Architecture)
CREATE TABLE IF NOT EXISTS public.retailer_order_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fulfillment_id UUID NOT NULL REFERENCES public.retailer_order_fulfillments(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.retailer_orders(id) ON DELETE CASCADE,
  box_number INTEGER NOT NULL DEFAULT 1,
  box_total INTEGER NOT NULL DEFAULT 1,
  carrier TEXT NOT NULL DEFAULT 'ups',
  tracking_number TEXT NOT NULL,
  tracking_url TEXT,
  weight_lbs NUMERIC(8, 2),
  dimensions_inch TEXT,
  package_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_packages_order_id ON public.retailer_order_packages(order_id);
CREATE INDEX IF NOT EXISTS idx_order_packages_fulfillment_id ON public.retailer_order_packages(fulfillment_id);
CREATE INDEX IF NOT EXISTS idx_order_packages_tracking ON public.retailer_order_packages(tracking_number);

COMMENT ON TABLE public.retailer_order_packages IS '출고 배송(Fulfillment)별 개별 포장 박스(Carton) 운송장 번호, 규격, 중량 및 포장 품목';

-- 6. Enable RLS on retailer_order_packages
ALTER TABLE public.retailer_order_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retailer_order_packages FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access on retailer_order_packages" ON public.retailer_order_packages;
CREATE POLICY "Admin full access on retailer_order_packages" ON public.retailer_order_packages
  FOR ALL TO authenticated
  USING (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());

DROP POLICY IF EXISTS "Retailer view own order packages" ON public.retailer_order_packages;
CREATE POLICY "Retailer view own order packages" ON public.retailer_order_packages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.retailer_orders ro
      WHERE ro.id = retailer_order_packages.order_id
        AND ro.company_id = public.auth_company_id()
    )
  );

-- 7. Safe Backfill for Existing Orders Units Reconciliation
UPDATE public.retailer_orders ro
SET 
  total_ordered_units = COALESCE((
    SELECT SUM(roi.quantity) FROM public.retailer_order_items roi WHERE roi.order_id = ro.id
  ), ro.total_items_count),
  total_shipped_units = CASE 
    WHEN ro.order_status IN ('shipped', 'delivered') THEN COALESCE((
      SELECT SUM(roi.quantity) FROM public.retailer_order_items roi WHERE roi.order_id = ro.id
    ), ro.total_items_count)
    ELSE 0
  END,
  total_remaining_units = CASE 
    WHEN ro.order_status IN ('shipped', 'delivered') THEN 0
    ELSE COALESCE((
      SELECT SUM(roi.quantity) FROM public.retailer_order_items roi WHERE roi.order_id = ro.id
    ), ro.total_items_count)
  END
WHERE total_ordered_units = 0;

-- Backfill quantity_shipped on order items for shipped orders
UPDATE public.retailer_order_items roi
SET quantity_shipped = roi.quantity
FROM public.retailer_orders ro
WHERE roi.order_id = ro.id
  AND ro.order_status IN ('shipped', 'delivered')
  AND roi.quantity_shipped = 0;

-- 8. PostgREST Schema Cache Reload
NOTIFY pgrst, 'reload schema';
