-- 0054_inventory_foundation.sql — Inventory Foundation
--

-- 1. Create inventory_balances table
CREATE TABLE IF NOT EXISTS public.inventory_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products (id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES public.warehouses (id) ON DELETE CASCADE,
  qty_on_hand INTEGER NOT NULL DEFAULT 0 CHECK (qty_on_hand >= 0),
  qty_hold INTEGER NOT NULL DEFAULT 0 CHECK (qty_hold >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT product_warehouse_unique UNIQUE (product_id, warehouse_id)
);

COMMENT ON TABLE public.inventory_balances IS '물류창고별 제품 재고 잔고 스냅샷';
COMMENT ON COLUMN public.inventory_balances.qty_on_hand IS '물리적으로 존재하는 실재고 수량';
COMMENT ON COLUMN public.inventory_balances.qty_hold IS '불량, 보류 등의 이유로 판매 대기/보류된 수량';

-- Enable RLS
ALTER TABLE public.inventory_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_balances FORCE ROW LEVEL SECURITY;

-- Select/All operations policy for admin
CREATE POLICY "inventory_balances_admin_all"
  ON public.inventory_balances
  FOR ALL
  TO authenticated
  USING (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());


-- 2. Create inventory_movements table
CREATE TABLE IF NOT EXISTS public.inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products (id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES public.warehouses (id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('OPENING_BALANCE', 'MANUAL_ADJUSTMENT', 'RECEIVING', 'SHIPMENT', 'TRANSFER')),
  qty_change INTEGER NOT NULL DEFAULT 0,
  qty_hold_change INTEGER NOT NULL DEFAULT 0,
  balance_on_hand_after INTEGER NOT NULL CHECK (balance_on_hand_after >= 0),
  balance_hold_after INTEGER NOT NULL CHECK (balance_hold_after >= 0),
  reason TEXT,
  note TEXT,
  created_by UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.inventory_movements IS '재고 증감 변동 이력 로그 (감사 추적용)';
COMMENT ON COLUMN public.inventory_movements.type IS '변동 유형 (OPENING_BALANCE: 기초 재고 입력, MANUAL_ADJUSTMENT: 수동 조정, RECEIVING: 입고, SHIPMENT: 출고, TRANSFER: 창고 간 이동)';

-- Enable RLS
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements FORCE ROW LEVEL SECURITY;

CREATE POLICY "inventory_movements_admin_all"
  ON public.inventory_movements
  FOR ALL
  TO authenticated
  USING (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());


-- 3. Create Trigger to keep inventory_balances synced and compute "after" balances atomically
CREATE OR REPLACE FUNCTION public.sync_inventory_balance()
RETURNS TRIGGER AS $$
DECLARE
  current_on_hand INTEGER := 0;
  current_hold INTEGER := 0;
  new_on_hand INTEGER;
  new_hold INTEGER;
BEGIN
  -- Check if balance row exists
  SELECT qty_on_hand, qty_hold
  INTO current_on_hand, current_hold
  FROM public.inventory_balances
  WHERE product_id = NEW.product_id AND warehouse_id = NEW.warehouse_id
  FOR UPDATE; -- Lock row for concurrency

  IF NOT FOUND THEN
    -- If not found, create new balance row
    new_on_hand := NEW.qty_change;
    new_hold := NEW.qty_hold_change;

    -- Validate that initial values are not negative
    IF new_on_hand < 0 OR new_hold < 0 THEN
      RAISE EXCEPTION 'Inventory balance cannot be negative. Resulting on_hand: %, hold: %', new_on_hand, new_hold;
    END IF;

    INSERT INTO public.inventory_balances (product_id, warehouse_id, qty_on_hand, qty_hold)
    VALUES (NEW.product_id, NEW.warehouse_id, new_on_hand, new_hold);
  ELSE
    -- If found, update existing balance row
    new_on_hand := current_on_hand + NEW.qty_change;
    new_hold := current_hold + NEW.qty_hold_change;

    -- Validate that new values are not negative
    IF new_on_hand < 0 OR new_hold < 0 THEN
      RAISE EXCEPTION 'Inventory balance cannot be negative. Resulting on_hand: %, hold: %', new_on_hand, new_hold;
    END IF;

    UPDATE public.inventory_balances
    SET qty_on_hand = new_on_hand,
        qty_hold = new_hold,
        updated_at = now()
    WHERE product_id = NEW.product_id AND warehouse_id = NEW.warehouse_id;
  END IF;

  -- Populate balance_on_hand_after and balance_hold_after on the movement row itself
  NEW.balance_on_hand_after := new_on_hand;
  NEW.balance_hold_after := new_hold;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sync_inventory_balance
  BEFORE INSERT ON public.inventory_movements
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_inventory_balance();
