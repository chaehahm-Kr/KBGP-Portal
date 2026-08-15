-- 0057_inbound_shipment_receiving.sql — Inbound Shipment + Receiving Foundation
--

-- 1. Create sequences for shipment and receiving numbers
CREATE SEQUENCE IF NOT EXISTS public.shipment_number_seq START WITH 1;
CREATE SEQUENCE IF NOT EXISTS public.receiving_number_seq START WITH 1;


-- 2. Create inbound_shipments table
CREATE TABLE IF NOT EXISTS public.inbound_shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_number TEXT NOT NULL UNIQUE,
  purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders (id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'BOOKED', 'IN_TRANSIT', 'ARRIVED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED')),
  shipping_method TEXT NOT NULL CHECK (shipping_method IN ('Ocean', 'Air', 'Ground', 'Courier', 'Other')),
  origin_port TEXT,
  destination_warehouse_id UUID NOT NULL REFERENCES public.warehouses (id) ON DELETE RESTRICT,
  etd DATE,
  eta DATE,
  actual_departure_date DATE,
  actual_arrival_date DATE,
  container_number TEXT,
  tracking_number TEXT,
  bill_of_lading TEXT,
  air_waybill TEXT,
  booking_number TEXT,
  internal_note TEXT,
  created_by UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.inbound_shipments IS '인바운드 선적(Inbound Shipment) 정보';
COMMENT ON COLUMN public.inbound_shipments.shipment_number IS '물류 추적용 고유 선적 번호 (예: SHP-2026-0001)';
COMMENT ON COLUMN public.inbound_shipments.status IS '선적 진행 상태 (DRAFT: 초안, BOOKED: 선적예약, IN_TRANSIT: 선적중, ARRIVED: 창고도착, PARTIALLY_RECEIVED: 일부입고, RECEIVED: 입고완료, CANCELLED: 취소됨)';

-- Enable RLS
ALTER TABLE public.inbound_shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inbound_shipments FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inbound_shipments_admin_all" ON public.inbound_shipments;
CREATE POLICY "inbound_shipments_admin_all"
  ON public.inbound_shipments
  FOR ALL
  TO authenticated
  USING (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());


-- 3. Create inbound_shipment_lines table
CREATE TABLE IF NOT EXISTS public.inbound_shipment_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inbound_shipment_id UUID NOT NULL REFERENCES public.inbound_shipments (id) ON DELETE CASCADE,
  purchase_order_line_id UUID NOT NULL REFERENCES public.purchase_order_lines (id) ON DELETE RESTRICT,
  product_id UUID NOT NULL REFERENCES public.products (id) ON DELETE RESTRICT,
  shipped_qty INTEGER NOT NULL CHECK (shipped_qty > 0),
  line_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT shipment_po_line_unique UNIQUE (inbound_shipment_id, purchase_order_line_id)
);

COMMENT ON TABLE public.inbound_shipment_lines IS '인바운드 선적 상세 품목 라인 정보';

-- Enable RLS
ALTER TABLE public.inbound_shipment_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inbound_shipment_lines FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inbound_shipment_lines_admin_all" ON public.inbound_shipment_lines;
CREATE POLICY "inbound_shipment_lines_admin_all"
  ON public.inbound_shipment_lines
  FOR ALL
  TO authenticated
  USING (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());


-- 4. Create receivings table
CREATE TABLE IF NOT EXISTS public.receivings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receiving_number TEXT NOT NULL UNIQUE,
  inbound_shipment_id UUID NOT NULL REFERENCES public.inbound_shipments (id) ON DELETE RESTRICT,
  purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders (id) ON DELETE RESTRICT,
  warehouse_id UUID NOT NULL REFERENCES public.warehouses (id) ON DELETE RESTRICT,
  received_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'FINALIZED', 'CANCELLED')),
  received_by UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  internal_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finalized_at TIMESTAMPTZ,
  finalized_by UUID REFERENCES public.profiles (id) ON DELETE SET NULL
);

COMMENT ON TABLE public.receivings IS '창고 실제 입고 검수(Receiving) 기록 정보';
COMMENT ON COLUMN public.receivings.receiving_number IS '창고 실물 입고 전용 문서 고유 번호 (예: RCV-2026-0001)';
COMMENT ON COLUMN public.receivings.status IS '입고 단계 상태 (DRAFT: 검수입력중, FINALIZED: 입고확정/재고반영완료, CANCELLED: 취소됨)';

-- Enable RLS
ALTER TABLE public.receivings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receivings FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "receivings_admin_all" ON public.receivings;
CREATE POLICY "receivings_admin_all"
  ON public.receivings
  FOR ALL
  TO authenticated
  USING (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());


-- 5. Create receiving_lines table
CREATE TABLE IF NOT EXISTS public.receiving_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receiving_id UUID NOT NULL REFERENCES public.receivings (id) ON DELETE CASCADE,
  inbound_shipment_line_id UUID NOT NULL REFERENCES public.inbound_shipment_lines (id) ON DELETE RESTRICT,
  purchase_order_line_id UUID NOT NULL REFERENCES public.purchase_order_lines (id) ON DELETE RESTRICT,
  product_id UUID NOT NULL REFERENCES public.products (id) ON DELETE RESTRICT,
  received_qty INTEGER NOT NULL CHECK (received_qty >= 0),
  damaged_qty INTEGER NOT NULL DEFAULT 0 CHECK (damaged_qty >= 0),
  hold_qty INTEGER NOT NULL DEFAULT 0 CHECK (hold_qty >= 0),
  line_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT receiving_shipment_line_unique UNIQUE (receiving_id, inbound_shipment_line_id),
  CONSTRAINT hold_qty_limit CHECK (hold_qty <= received_qty)
);

COMMENT ON TABLE public.receiving_lines IS '창고 실제 입고 상세 품목 라인 정보';

-- Enable RLS
ALTER TABLE public.receiving_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receiving_lines FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "receiving_lines_admin_all" ON public.receiving_lines;
CREATE POLICY "receiving_lines_admin_all"
  ON public.receiving_lines
  FOR ALL
  TO authenticated
  USING (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());


-- 6. Add Audit Reference columns to public.inventory_movements table
ALTER TABLE public.inventory_movements ADD COLUMN IF NOT EXISTS reference_type TEXT;
ALTER TABLE public.inventory_movements ADD COLUMN IF NOT EXISTS reference_id UUID;

COMMENT ON COLUMN public.inventory_movements.reference_type IS '재고 변동을 발생시킨 연동 트랜잭션 타입 (예: RECEIVING_LINE)';
COMMENT ON COLUMN public.inventory_movements.reference_id IS '재고 변동을 발생시킨 연동 트랜잭션 레코드 고유 ID (예: receiving_lines.id)';


-- 7. Number generator triggers
CREATE OR REPLACE FUNCTION public.set_shipment_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.shipment_number IS NULL OR NEW.shipment_number = '' THEN
    NEW.shipment_number := 'SHP-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.shipment_number_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trigger_set_shipment_number
  BEFORE INSERT ON public.inbound_shipments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_shipment_number();


CREATE OR REPLACE FUNCTION public.set_receiving_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.receiving_number IS NULL OR NEW.receiving_number = '' THEN
    NEW.receiving_number := 'RCV-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.receiving_number_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trigger_set_receiving_number
  BEFORE INSERT ON public.receivings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_receiving_number();


-- 8. Transactional Finalize Receiving Function
CREATE OR REPLACE FUNCTION public.finalize_receiving_transaction(p_receiving_id UUID, p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_rec RECORD;
  v_line RECORD;
  v_movement_id UUID;
  v_total_shipped INT;
  v_total_received INT;
  v_shipment_status TEXT;
  v_po_status TEXT;
  v_po_all_received BOOLEAN;
BEGIN
  -- 1. Lock the receiving row and verify status
  SELECT * INTO v_rec FROM public.receivings WHERE id = p_receiving_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', '입고 기록서가 존재하지 않습니다.');
  END IF;
  IF v_rec.status = 'FINALIZED' THEN
    RETURN jsonb_build_object('success', false, 'error', '이미 입고 확정 처리된 전표입니다.');
  END IF;
  IF v_rec.status = 'CANCELLED' THEN
    RETURN jsonb_build_object('success', false, 'error', '취소된 입고 전표는 확정할 수 없습니다.');
  END IF;

  -- 2. Lock the related shipment
  PERFORM id FROM public.inbound_shipments WHERE id = v_rec.inbound_shipment_id FOR UPDATE;

  -- 3. Loop and post inventory movements
  FOR v_line IN 
    SELECT rl.*, isl.product_id, r.warehouse_id, r.receiving_number
    FROM public.receiving_lines rl
    JOIN public.receivings r ON r.id = rl.receiving_id
    JOIN public.inbound_shipment_lines isl ON isl.id = rl.inbound_shipment_line_id
    WHERE rl.receiving_id = p_receiving_id
  LOOP
    IF v_line.received_qty > 0 THEN
      INSERT INTO public.inventory_movements (
        product_id,
        warehouse_id,
        type,
        qty_change,
        qty_hold_change,
        reason,
        note,
        reference_type,
        reference_id,
        created_by
      ) VALUES (
        v_line.product_id,
        v_line.warehouse_id,
        'RECEIVING',
        v_line.received_qty,
        v_line.hold_qty,
        'Inbound PO Receiving',
        'Receiving doc: ' || v_line.receiving_number,
        'RECEIVING',
        p_receiving_id,
        p_user_id
      ) RETURNING id INTO v_movement_id;
    END IF;
  END LOOP;

  -- 4. Mark receiving as finalized
  UPDATE public.receivings 
  SET status = 'FINALIZED',
      finalized_at = now(),
      finalized_by = p_user_id,
      updated_at = now()
  WHERE id = p_receiving_id;

  -- 5. Calculate and update Shipment status
  SELECT coalesce(sum(shipped_qty), 0) INTO v_total_shipped 
  FROM public.inbound_shipment_lines 
  WHERE inbound_shipment_id = v_rec.inbound_shipment_id;

  SELECT coalesce(sum(rl.received_qty), 0) INTO v_total_received
  FROM public.receiving_lines rl
  JOIN public.receivings r ON r.id = rl.receiving_id
  WHERE r.inbound_shipment_id = v_rec.inbound_shipment_id AND r.status = 'FINALIZED';

  IF v_total_received = 0 THEN
    v_shipment_status := 'ARRIVED';
  ELSIF v_total_received >= v_total_shipped THEN
    v_shipment_status := 'RECEIVED';
  ELSE
    v_shipment_status := 'PARTIALLY_RECEIVED';
  END IF;

  UPDATE public.inbound_shipments 
  SET status = v_shipment_status,
      updated_at = now()
  WHERE id = v_rec.inbound_shipment_id;

  -- 6. Calculate and update PO status
  SELECT NOT EXISTS (
    SELECT 1 
    FROM public.purchase_order_lines pol
    LEFT JOIN (
      SELECT rl.purchase_order_line_id, sum(rl.received_qty) as total_rec
      FROM public.receiving_lines rl
      JOIN public.receivings r ON r.id = rl.receiving_id
      WHERE r.status = 'FINALIZED' AND r.purchase_order_id = v_rec.purchase_order_id
      GROUP BY rl.purchase_order_line_id
    ) rec ON rec.purchase_order_line_id = pol.id
    WHERE pol.purchase_order_id = v_rec.purchase_order_id
      AND (rec.total_rec IS NULL OR rec.total_rec < pol.qty)
  ) INTO v_po_all_received;

  IF v_po_all_received THEN
    v_po_status := 'RECEIVED';
  ELSE
    IF EXISTS (
      SELECT 1 
      FROM public.receivings r
      WHERE r.purchase_order_id = v_rec.purchase_order_id AND r.status = 'FINALIZED'
    ) THEN
      v_po_status := 'PARTIALLY_RECEIVED';
    ELSE
      v_po_status := 'SENT';
    END IF;
  END IF;

  UPDATE public.purchase_orders
  SET fulfillment_status = CASE 
        WHEN v_po_all_received THEN 'RECEIVED'
        ELSE 'SHIPPED' -- under SENT po_status, partially received is SHIPPED
      END,
      updated_at = now()
  WHERE id = v_rec.purchase_order_id AND po_status = 'SENT';

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql;
