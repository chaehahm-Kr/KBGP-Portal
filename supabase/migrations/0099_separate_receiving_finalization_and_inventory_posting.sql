-- 0099_separate_receiving_finalization_and_inventory_posting.sql
-- ADM-REC-001-R3 / PORT-REC-001-R3: Separate Receiving Finalization from Inventory Posting

-- 1. Redefine finalize_receiving_transaction (Receiving Finalization WITHOUT immediate inventory posting)
CREATE OR REPLACE FUNCTION public.finalize_receiving_transaction(p_receiving_id UUID, p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_rec RECORD;
  v_total_shipped INT;
  v_total_received INT;
  v_shipment_status TEXT;
  v_po_all_received BOOLEAN;
BEGIN
  -- Lock receiving row and verify status
  SELECT * INTO v_rec FROM public.receivings WHERE id = p_receiving_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', '입고 기록서가 존재하지 않습니다.');
  END IF;
  IF v_rec.status = 'FINALIZED' THEN
    RETURN jsonb_build_object('success', false, 'error', '이미 입고 검수 확정 처리된 전표입니다.');
  END IF;
  IF v_rec.status = 'CANCELLED' THEN
    RETURN jsonb_build_object('success', false, 'error', '취소된 입고 전표는 확정할 수 없습니다.');
  END IF;

  -- Lock related shipment if present
  IF v_rec.inbound_shipment_id IS NOT NULL THEN
    PERFORM id FROM public.inbound_shipments WHERE id = v_rec.inbound_shipment_id FOR UPDATE;
  END IF;

  -- Mark receiving as FINALIZED (Inspection finalized, but inventory posting deferred to PO Completion)
  UPDATE public.receivings 
  SET status = 'FINALIZED',
      finalized_at = now(),
      finalized_by = p_user_id,
      updated_at = now()
  WHERE id = p_receiving_id;

  -- Calculate and update Shipment status if receiving is linked to shipment
  IF v_rec.inbound_shipment_id IS NOT NULL THEN
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
  END IF;

  -- Calculate total received across all finalized receivings for this PO
  SELECT coalesce(sum(rl.received_qty), 0) INTO v_total_received
  FROM public.receiving_lines rl
  JOIN public.receivings r ON r.id = rl.receiving_id
  WHERE r.purchase_order_id = v_rec.purchase_order_id AND r.status = 'FINALIZED';

  -- Update PO fulfillment status (keeps SENT / SHIPPED / PARTIALLY_RECEIVED; does NOT mark COMPLETED)
  UPDATE public.purchase_orders
  SET fulfillment_status = CASE 
        WHEN v_total_received >= (
          SELECT coalesce(sum(qty), 0) FROM public.purchase_order_lines WHERE purchase_order_id = v_rec.purchase_order_id
        ) THEN 'RECEIVED'
        WHEN v_total_received > 0 THEN 'PARTIALLY_RECEIVED'
        ELSE 'SHIPPED'
      END,
      updated_at = now()
  WHERE id = v_rec.purchase_order_id AND po_status = 'SENT' AND fulfillment_status != 'COMPLETED';

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql;


-- 2. Create post_receiving_inventory_transaction (Executed at PO Completion to post inventory idempotently)
CREATE OR REPLACE FUNCTION public.post_receiving_inventory_transaction(p_po_id UUID, p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_po RECORD;
  v_rec RECORD;
  v_line RECORD;
  v_movement_id UUID;
  v_posted_count INT := 0;
BEGIN
  -- Lock PO
  SELECT * INTO v_po FROM public.purchase_orders WHERE id = p_po_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', '발주서를 찾을 수 없습니다.');
  END IF;

  -- Loop through all FINALIZED receivings for this PO
  FOR v_rec IN 
    SELECT * FROM public.receivings 
    WHERE purchase_order_id = p_po_id AND status = 'FINALIZED'
  LOOP
    FOR v_line IN 
      SELECT 
        rl.*, 
        COALESCE(rl.product_id, isl.product_id) as target_product_id, 
        r.warehouse_id, 
        r.receiving_number
      FROM public.receiving_lines rl
      JOIN public.receivings r ON r.id = rl.receiving_id
      LEFT JOIN public.inbound_shipment_lines isl ON isl.id = rl.inbound_shipment_line_id
      WHERE rl.receiving_id = v_rec.id
    LOOP
      IF v_line.received_qty > 0 AND v_line.target_product_id IS NOT NULL THEN
        -- Check idempotency: avoid inserting duplicate movements for the same receiving line / product
        IF NOT EXISTS (
          SELECT 1 FROM public.inventory_movements 
          WHERE reference_type = 'RECEIVING' 
            AND reference_id = v_rec.id 
            AND product_id = v_line.target_product_id
        ) THEN
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
            v_line.target_product_id,
            v_line.warehouse_id,
            'RECEIVING',
            v_line.received_qty,
            COALESCE(v_line.hold_qty, 0),
            'Inbound PO Receiving',
            'Receiving doc: ' || v_line.receiving_number,
            'RECEIVING',
            v_rec.id,
            p_user_id
          ) RETURNING id INTO v_movement_id;

          v_posted_count := v_posted_count + 1;
        END IF;
      END IF;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'posted_count', v_posted_count);
END;
$$ LANGUAGE plpgsql;
