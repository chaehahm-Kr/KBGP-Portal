-- 0058_concurrency_shipment.sql — Shipment Concurrency Control
--

CREATE OR REPLACE FUNCTION public.create_inbound_shipment_transaction(
  p_purchase_order_id UUID,
  p_shipping_method TEXT,
  p_origin_port TEXT,
  p_destination_warehouse_id UUID,
  p_etd DATE,
  p_eta DATE,
  p_actual_departure_date DATE,
  p_actual_arrival_date DATE,
  p_container_number TEXT,
  p_tracking_number TEXT,
  p_bill_of_lading TEXT,
  p_air_waybill TEXT,
  p_booking_number TEXT,
  p_internal_note TEXT,
  p_created_by UUID,
  p_lines JSONB
) RETURNS UUID AS $$
DECLARE
  v_shipment_id UUID;
  v_line RECORD;
  v_already_shipped INTEGER;
  v_po_qty INTEGER;
  v_product_name TEXT;
BEGIN
  -- 1. Lock the PO header row for update to ensure serialized execution
  PERFORM id FROM public.purchase_orders WHERE id = p_purchase_order_id FOR UPDATE;

  -- 2. Create Shipment Header
  INSERT INTO public.inbound_shipments (
    purchase_order_id,
    status,
    shipping_method,
    origin_port,
    destination_warehouse_id,
    etd,
    eta,
    actual_departure_date,
    actual_arrival_date,
    container_number,
    tracking_number,
    bill_of_lading,
    air_waybill,
    booking_number,
    internal_note,
    created_by
  ) VALUES (
    p_purchase_order_id,
    'DRAFT',
    p_shipping_method,
    p_origin_port,
    p_destination_warehouse_id,
    p_etd,
    p_eta,
    p_actual_departure_date,
    p_actual_arrival_date,
    p_container_number,
    p_tracking_number,
    p_bill_of_lading,
    p_air_waybill,
    p_booking_number,
    p_internal_note,
    p_created_by
  ) RETURNING id INTO v_shipment_id;

  -- 3. Loop and validate each proposed line item
  FOR v_line IN 
    SELECT * FROM jsonb_to_recordset(p_lines) AS x(
      purchase_order_line_id UUID,
      product_id UUID,
      shipped_qty INTEGER,
      line_note TEXT
    )
  LOOP
    -- Get PO line qty and product name
    SELECT qty, product_name_snapshot 
    INTO v_po_qty, v_product_name
    FROM public.purchase_order_lines 
    WHERE id = v_line.purchase_order_line_id;

    -- Calculate total already shipped (excluding cancelled shipments)
    SELECT coalesce(sum(isl.shipped_qty), 0)
    INTO v_already_shipped
    FROM public.inbound_shipment_lines isl
    JOIN public.inbound_shipments ishp ON ishp.id = isl.inbound_shipment_id
    WHERE isl.purchase_order_line_id = v_line.purchase_order_line_id
      AND ishp.status <> 'CANCELLED';

    -- Validate limit
    IF (v_already_shipped + v_line.shipped_qty) > v_po_qty THEN
      RAISE EXCEPTION '제품 [%]의 선적 수량(%개)이 PO 미선적 잔량(%개)을 초과할 수 없습니다.', 
        v_product_name, v_line.shipped_qty, (v_po_qty - v_already_shipped);
    END IF;

    -- Insert shipment line
    INSERT INTO public.inbound_shipment_lines (
      inbound_shipment_id,
      purchase_order_line_id,
      product_id,
      shipped_qty,
      line_note
    ) VALUES (
      v_shipment_id,
      v_line.purchase_order_line_id,
      v_line.product_id,
      v_line.shipped_qty,
      v_line.line_note
    );
  END LOOP;

  RETURN v_shipment_id;
END;
$$ LANGUAGE plpgsql;
