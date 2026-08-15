-- 0060_fix_po_fulfillment_status.sql — Fix PO fulfillment status transition
-- Redefine finalize_receiving_transaction function to check if all shipped quantities are resolved.

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

  -- 6. Calculate and update PO fulfillment status
  -- A PO line is considered fully resolved when the sum of shipped_qty across all RECEIVED shipments for this PO line meets or exceeds the ordered qty.
  SELECT NOT EXISTS (
    SELECT 1 
    FROM public.purchase_order_lines pol
    LEFT JOIN (
      SELECT isl.purchase_order_line_id, sum(isl.shipped_qty) as total_resolved
      FROM public.inbound_shipment_lines isl
      JOIN public.inbound_shipments sh ON sh.id = isl.inbound_shipment_id
      WHERE sh.status = 'RECEIVED'
      GROUP BY isl.purchase_order_line_id
    ) sh_res ON sh_res.purchase_order_line_id = pol.id
    WHERE pol.purchase_order_id = v_rec.purchase_order_id
      AND (sh_res.total_resolved IS NULL OR sh_res.total_resolved < pol.qty)
  ) INTO v_po_all_received;

  UPDATE public.purchase_orders
  SET fulfillment_status = CASE 
        WHEN v_po_all_received THEN 'RECEIVED'
        ELSE 'SHIPPED'
      END,
      updated_at = now()
  WHERE id = v_rec.purchase_order_id AND po_status = 'SENT';

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql;
