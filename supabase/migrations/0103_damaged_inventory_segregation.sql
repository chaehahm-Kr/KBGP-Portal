-- 0103_damaged_inventory_segregation.sql
-- ADM-INV-002 / ADM-REC-002: Damaged/Hold Inventory Segregation, Available Stock Calculation & Receiving-to-Inventory Posting Fix

-- 1. Add qty_damaged column to inventory_balances table
ALTER TABLE public.inventory_balances
  ADD COLUMN IF NOT EXISTS qty_damaged INTEGER NOT NULL DEFAULT 0 CHECK (qty_damaged >= 0);

COMMENT ON COLUMN public.inventory_balances.qty_damaged IS '불량/파손으로 인한 판매 불가 재고 수량';

-- 2. Add qty_damaged_change and balance_damaged_after columns to inventory_movements table
ALTER TABLE public.inventory_movements
  ADD COLUMN IF NOT EXISTS qty_damaged_change INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS balance_damaged_after INTEGER NOT NULL DEFAULT 0 CHECK (balance_damaged_after >= 0);

COMMENT ON COLUMN public.inventory_movements.qty_damaged_change IS '불량 수량 변동폭';
COMMENT ON COLUMN public.inventory_movements.balance_damaged_after IS '변동 후 불량 수량 잔고';

-- 3. Update sync_inventory_balance trigger function to include damaged quantity tracking
CREATE OR REPLACE FUNCTION public.sync_inventory_balance()
RETURNS TRIGGER AS $$
DECLARE
  current_on_hand INTEGER := 0;
  current_hold INTEGER := 0;
  current_damaged INTEGER := 0;
  new_on_hand INTEGER;
  new_hold INTEGER;
  new_damaged INTEGER;
BEGIN
  -- Check if balance row exists
  SELECT qty_on_hand, qty_hold, COALESCE(qty_damaged, 0)
  INTO current_on_hand, current_hold, current_damaged
  FROM public.inventory_balances
  WHERE product_id = NEW.product_id AND warehouse_id = NEW.warehouse_id
  FOR UPDATE;

  IF NOT FOUND THEN
    -- If not found, create new balance row
    new_on_hand := NEW.qty_change;
    new_hold := NEW.qty_hold_change;
    new_damaged := COALESCE(NEW.qty_damaged_change, 0);

    IF new_on_hand < 0 OR new_hold < 0 OR new_damaged < 0 THEN
      RAISE EXCEPTION 'Inventory balance cannot be negative. Resulting on_hand: %, hold: %, damaged: %', new_on_hand, new_hold, new_damaged;
    END IF;

    INSERT INTO public.inventory_balances (product_id, warehouse_id, qty_on_hand, qty_hold, qty_damaged)
    VALUES (NEW.product_id, NEW.warehouse_id, new_on_hand, new_hold, new_damaged);
  ELSE
    -- If found, update existing balance row
    new_on_hand := current_on_hand + NEW.qty_change;
    new_hold := current_hold + NEW.qty_hold_change;
    new_damaged := current_damaged + COALESCE(NEW.qty_damaged_change, 0);

    IF new_on_hand < 0 OR new_hold < 0 OR new_damaged < 0 THEN
      RAISE EXCEPTION 'Inventory balance cannot be negative. Resulting on_hand: %, hold: %, damaged: %', new_on_hand, new_hold, new_damaged;
    END IF;

    UPDATE public.inventory_balances
    SET qty_on_hand = new_on_hand,
        qty_hold = new_hold,
        qty_damaged = new_damaged,
        updated_at = now()
    WHERE product_id = NEW.product_id AND warehouse_id = NEW.warehouse_id;
  END IF;

  -- Populate balance_on_hand_after, balance_hold_after, balance_damaged_after on the movement row itself
  NEW.balance_on_hand_after := new_on_hand;
  NEW.balance_hold_after := new_hold;
  NEW.balance_damaged_after := new_damaged;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Update post_receiving_inventory_transaction RPC to post physical received_qty to qty_change, damaged_qty to qty_damaged_change, and hold_qty to qty_hold_change
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
            qty_damaged_change,
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
            COALESCE(v_line.damaged_qty, 0),
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

-- 5. Safe Reconciliation for historical movements already posted
DO $$
DECLARE
  v_m RECORD;
  v_damaged INT;
BEGIN
  FOR v_m IN 
    SELECT * FROM public.inventory_movements WHERE reference_type = 'RECEIVING' AND (qty_damaged_change = 0 OR qty_damaged_change IS NULL)
  LOOP
    SELECT COALESCE(SUM(rl.damaged_qty), 0) INTO v_damaged
    FROM public.receiving_lines rl
    WHERE rl.receiving_id = v_m.reference_id 
      AND (rl.product_id = v_m.product_id OR rl.product_id IS NULL);

    IF v_damaged > 0 THEN
      UPDATE public.inventory_movements
      SET qty_damaged_change = v_damaged,
          balance_damaged_after = v_damaged
      WHERE id = v_m.id;

      UPDATE public.inventory_balances
      SET qty_damaged = COALESCE(qty_damaged, 0) + v_damaged,
          updated_at = now()
      WHERE product_id = v_m.product_id AND warehouse_id = v_m.warehouse_id;
    END IF;
  END LOOP;
END;
$$;
