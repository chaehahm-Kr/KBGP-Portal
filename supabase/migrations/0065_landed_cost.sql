-- 0065_landed_cost.sql — Landed Cost & FIFO Inventory Costing V1
-- Introduce landed cost tracking, expense allocations, and FIFO cost layers.

-- 1. Create landed cost numbering sequence
CREATE SEQUENCE IF NOT EXISTS public.landed_cost_number_seq START WITH 1;

-- 2. Create landed_cost_cases table
CREATE TABLE IF NOT EXISTS public.landed_cost_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landed_cost_number TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'FINALIZED')),
  description TEXT,
  internal_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  finalized_at TIMESTAMPTZ,
  finalized_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reopened_at TIMESTAMPTZ,
  reopened_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reopen_reason TEXT
);

COMMENT ON TABLE public.landed_cost_cases IS '창고 도착 총원가(Landed Cost) 관리 사건/케이스';

-- 3. Create landed_cost_case_shipments mapping
CREATE TABLE IF NOT EXISTS public.landed_cost_case_shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landed_cost_case_id UUID NOT NULL REFERENCES public.landed_cost_cases(id) ON DELETE CASCADE,
  inbound_shipment_id UUID NOT NULL UNIQUE REFERENCES public.inbound_shipments(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Create landed_cost_expenses table
CREATE TABLE IF NOT EXISTS public.landed_cost_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landed_cost_case_id UUID NOT NULL REFERENCES public.landed_cost_cases(id) ON DELETE CASCADE,
  cost_type TEXT NOT NULL CHECK (cost_type IN (
    'OCEAN_FREIGHT', 'AIR_FREIGHT', 'DUTY', 'CUSTOMS_BROKER', 'PORT_TERMINAL',
    'TRUCKING', 'DOMESTIC_FREIGHT', 'INSURANCE', 'INSPECTION', 'STORAGE_DEMURRAGE', 'OTHER'
  )),
  vendor_company_id UUID REFERENCES public.companies(id) ON DELETE RESTRICT,
  description TEXT,
  currency TEXT NOT NULL DEFAULT 'USD',
  estimated_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  actual_amount NUMERIC(12, 2),
  fx_rate_to_base NUMERIC(12, 6) NOT NULL DEFAULT 1.000000,
  base_currency_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  allocation_method TEXT NOT NULL CHECK (allocation_method IN ('CBM', 'WEIGHT', 'VALUE', 'DIRECT', 'MANUAL')),
  invoice_reference TEXT,
  invoice_date DATE,
  attachment_path TEXT,
  internal_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- 5. Create landed_cost_allocations table
CREATE TABLE IF NOT EXISTS public.landed_cost_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landed_cost_expense_id UUID NOT NULL REFERENCES public.landed_cost_expenses(id) ON DELETE CASCADE,
  receiving_line_id UUID NOT NULL REFERENCES public.receiving_lines(id) ON DELETE RESTRICT,
  allocated_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  manual_override_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT landed_cost_allocation_unique UNIQUE (landed_cost_expense_id, receiving_line_id)
);

-- 6. Create landed_cost_results snapshot table
CREATE TABLE IF NOT EXISTS public.landed_cost_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landed_cost_case_id UUID NOT NULL REFERENCES public.landed_cost_cases(id) ON DELETE CASCADE,
  receiving_line_id UUID NOT NULL REFERENCES public.receiving_lines(id) ON DELETE RESTRICT,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  received_date DATE NOT NULL,
  inventory_received_qty INTEGER NOT NULL CHECK (inventory_received_qty >= 0),
  supplier_acquisition_cost NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  freight_cost NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  duty_cost NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  broker_cost NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  port_cost NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  trucking_cost NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  insurance_cost NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  inspection_cost NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  other_cost NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  total_ancillary_cost NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  total_landed_cost NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  unit_landed_cost NUMERIC(12, 4) NOT NULL DEFAULT 0.0000,
  cost_status TEXT NOT NULL CHECK (cost_status IN ('PROVISIONAL', 'FINAL')),
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT landed_cost_result_receiving_unique UNIQUE (receiving_line_id)
);

-- 7. Create inventory_cost_layers table (FIFO costing)
CREATE TABLE IF NOT EXISTS public.inventory_cost_layers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  receiving_line_id UUID REFERENCES public.receiving_lines(id) ON DELETE RESTRICT,
  landed_cost_result_id UUID REFERENCES public.landed_cost_results(id) ON DELETE SET NULL,
  received_date DATE NOT NULL,
  original_qty INTEGER NOT NULL CHECK (original_qty >= 0),
  remaining_qty INTEGER NOT NULL CHECK (remaining_qty >= 0),
  unit_landed_cost NUMERIC(12, 4) NOT NULL CHECK (unit_landed_cost >= 0),
  original_total_cost NUMERIC(12, 2) NOT NULL CHECK (original_total_cost >= 0),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'EXHAUSTED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Create inventory_cost_layer_consumptions table (Consumption audit trail)
CREATE TABLE IF NOT EXISTS public.inventory_cost_layer_consumptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_movement_id UUID NOT NULL REFERENCES public.inventory_movements(id) ON DELETE CASCADE,
  inventory_cost_layer_id UUID NOT NULL REFERENCES public.inventory_cost_layers(id) ON DELETE RESTRICT,
  qty_consumed INTEGER NOT NULL CHECK (qty_consumed > 0),
  unit_cost NUMERIC(12, 4) NOT NULL,
  total_cost NUMERIC(12, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. Trigger to auto-set landed_cost_number
CREATE OR REPLACE FUNCTION public.set_landed_cost_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.landed_cost_number IS NULL OR NEW.landed_cost_number = '' THEN
    NEW.landed_cost_number := 'LC-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.landed_cost_number_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_landed_cost_number ON public.landed_cost_cases;
CREATE TRIGGER trigger_set_landed_cost_number
  BEFORE INSERT ON public.landed_cost_cases
  FOR EACH ROW
  EXECUTE FUNCTION public.set_landed_cost_number();

-- 10. Enable RLS
ALTER TABLE public.landed_cost_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landed_cost_cases FORCE ROW LEVEL SECURITY;
ALTER TABLE public.landed_cost_case_shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landed_cost_case_shipments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.landed_cost_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landed_cost_expenses FORCE ROW LEVEL SECURITY;
ALTER TABLE public.landed_cost_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landed_cost_allocations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.landed_cost_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landed_cost_results FORCE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_cost_layers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_cost_layers FORCE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_cost_layer_consumptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_cost_layer_consumptions FORCE ROW LEVEL SECURITY;

-- 11. Admin All Policy
CREATE POLICY "landed_cost_cases_admin_all" ON public.landed_cost_cases FOR ALL TO authenticated USING (public.auth_is_admin()) WITH CHECK (public.auth_is_admin());
CREATE POLICY "landed_cost_case_shipments_admin_all" ON public.landed_cost_case_shipments FOR ALL TO authenticated USING (public.auth_is_admin()) WITH CHECK (public.auth_is_admin());
CREATE POLICY "landed_cost_expenses_admin_all" ON public.landed_cost_expenses FOR ALL TO authenticated USING (public.auth_is_admin()) WITH CHECK (public.auth_is_admin());
CREATE POLICY "landed_cost_allocations_admin_all" ON public.landed_cost_allocations FOR ALL TO authenticated USING (public.auth_is_admin()) WITH CHECK (public.auth_is_admin());
CREATE POLICY "landed_cost_results_admin_all" ON public.landed_cost_results FOR ALL TO authenticated USING (public.auth_is_admin()) WITH CHECK (public.auth_is_admin());
CREATE POLICY "inventory_cost_layers_admin_all" ON public.inventory_cost_layers FOR ALL TO authenticated USING (public.auth_is_admin()) WITH CHECK (public.auth_is_admin());
CREATE POLICY "inventory_cost_layer_consumptions_admin_all" ON public.inventory_cost_layer_consumptions FOR ALL TO authenticated USING (public.auth_is_admin()) WITH CHECK (public.auth_is_admin());

-- 12. Trigger to consume FIFO cost layers on negative inventory movements (depletion)
CREATE OR REPLACE FUNCTION public.consume_fifo_cost_layers()
RETURNS TRIGGER AS $$
DECLARE
  v_qty_to_deplete INTEGER;
  v_layer RECORD;
  v_consume_qty INTEGER;
  v_fallback_cost NUMERIC(12, 4);
BEGIN
  -- We only run for depletions (qty_change < 0)
  IF NEW.qty_change < 0 THEN
    v_qty_to_deplete := abs(NEW.qty_change);

    -- Loop through active layers in the same warehouse ordered by date (FIFO)
    FOR v_layer IN 
      SELECT * 
      FROM public.inventory_cost_layers 
      WHERE product_id = NEW.product_id 
        AND warehouse_id = NEW.warehouse_id
        AND remaining_qty > 0
      ORDER BY received_date ASC, created_at ASC
      FOR UPDATE
    LOOP
      IF v_qty_to_deplete <= 0 THEN
        EXIT;
      END IF;

      v_consume_qty := least(v_qty_to_deplete, v_layer.remaining_qty);

      -- Update layer
      UPDATE public.inventory_cost_layers
      SET remaining_qty = remaining_qty - v_consume_qty,
          status = CASE WHEN remaining_qty - v_consume_qty = 0 THEN 'EXHAUSTED'::text ELSE 'ACTIVE'::text END,
          updated_at = now()
      WHERE id = v_layer.id;

      -- Record consumption
      INSERT INTO public.inventory_cost_layer_consumptions (
        inventory_movement_id,
        inventory_cost_layer_id,
        qty_consumed,
        unit_cost,
        total_cost
      ) VALUES (
        NEW.id,
        v_layer.id,
        v_consume_qty,
        v_layer.unit_landed_cost,
        v_consume_qty * v_layer.unit_landed_cost
      );

      v_qty_to_deplete := v_qty_to_deplete - v_consume_qty;
    END LOOP;

    -- Fallback: If still has qty to deplete (e.g. no layers exist or inventory exceeds layers)
    IF v_qty_to_deplete > 0 THEN
      -- Get fallback unit cost (FOB or most recent layer or 0)
      SELECT COALESCE(
        (SELECT unit_landed_cost FROM public.inventory_cost_layers WHERE product_id = NEW.product_id ORDER BY received_date DESC, created_at DESC LIMIT 1),
        (SELECT price_usd_fob FROM public.products WHERE id = NEW.product_id),
        0.0000
      ) INTO v_fallback_cost;

      -- Create a default active or fallback layer representing opening/adjustment stock
      INSERT INTO public.inventory_cost_layers (
        product_id,
        warehouse_id,
        received_date,
        original_qty,
        remaining_qty,
        unit_landed_cost,
        original_total_cost,
        status
      ) VALUES (
        NEW.product_id,
        NEW.warehouse_id,
        CURRENT_DATE,
        v_qty_to_deplete,
        0,
        v_fallback_cost,
        v_qty_to_deplete * v_fallback_cost,
        'EXHAUSTED'
      ) RETURNING id INTO v_consume_qty; -- Temp reuse variable for layer id

      -- Record fallback consumption
      INSERT INTO public.inventory_cost_layer_consumptions (
        inventory_movement_id,
        inventory_cost_layer_id,
        qty_consumed,
        unit_cost,
        total_cost
      ) VALUES (
        NEW.id,
        v_consume_qty,
        v_qty_to_deplete,
        v_fallback_cost,
        v_qty_to_deplete * v_fallback_cost
      );
    END IF;

  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_consume_fifo_cost_layers ON public.inventory_movements;
CREATE TRIGGER trigger_consume_fifo_cost_layers
  AFTER INSERT ON public.inventory_movements
  FOR EACH ROW
  EXECUTE FUNCTION public.consume_fifo_cost_layers();
