-- supabase/migrations/0168_retailer_order_fulfillment_boxes.sql
-- Migration 0168: Phase B2 — Multi-Box Shipment Management & Tracking Synchronization

-- 1. Create public.retailer_order_fulfillment_boxes table
CREATE TABLE IF NOT EXISTS public.retailer_order_fulfillment_boxes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fulfillment_id UUID NOT NULL REFERENCES public.retailer_order_fulfillments(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.retailer_orders(id) ON DELETE CASCADE,
  box_number INTEGER NOT NULL DEFAULT 1,
  box_total INTEGER NOT NULL DEFAULT 1,
  carrier TEXT NOT NULL DEFAULT 'ups',
  tracking_number TEXT,
  tracking_url TEXT,
  weight_lbs NUMERIC(8, 2),
  dimensions_inch TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'void', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Indexes for fast batch queries and tenant joins
CREATE INDEX IF NOT EXISTS idx_order_fulfillment_boxes_fulfillment_id ON public.retailer_order_fulfillment_boxes(fulfillment_id);
CREATE INDEX IF NOT EXISTS idx_order_fulfillment_boxes_order_id ON public.retailer_order_fulfillment_boxes(order_id);
CREATE INDEX IF NOT EXISTS idx_order_fulfillment_boxes_tracking ON public.retailer_order_fulfillment_boxes(tracking_number);
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_fulfillment_box_number ON public.retailer_order_fulfillment_boxes(fulfillment_id, box_number) WHERE status = 'active';

-- 3. Comments
COMMENT ON TABLE public.retailer_order_fulfillment_boxes IS '출고 배송(Fulfillment)별 복수 포장 박스(Carton) 및 운송장 정보 (Phase B2 Multi-Box Architecture)';

-- 4. Enable and force Row Level Security (RLS)
ALTER TABLE public.retailer_order_fulfillment_boxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retailer_order_fulfillment_boxes FORCE ROW LEVEL SECURITY;

-- 5. RLS Policies
DROP POLICY IF EXISTS "Admin full access on retailer_order_fulfillment_boxes" ON public.retailer_order_fulfillment_boxes;
CREATE POLICY "Admin full access on retailer_order_fulfillment_boxes" ON public.retailer_order_fulfillment_boxes
  FOR ALL TO authenticated
  USING (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());

DROP POLICY IF EXISTS "Retailer view own order fulfillment boxes" ON public.retailer_order_fulfillment_boxes;
CREATE POLICY "Retailer view own order fulfillment boxes" ON public.retailer_order_fulfillment_boxes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.retailer_orders ro
      WHERE ro.id = retailer_order_fulfillment_boxes.order_id
        AND ro.company_id = public.auth_company_id()
    )
  );

-- 6. Trigger for updated_at
CREATE OR REPLACE FUNCTION public.handle_fulfillment_boxes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_fulfillment_boxes_updated_at ON public.retailer_order_fulfillment_boxes;
CREATE TRIGGER trigger_fulfillment_boxes_updated_at
  BEFORE UPDATE ON public.retailer_order_fulfillment_boxes
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_fulfillment_boxes_updated_at();
