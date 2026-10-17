-- ==============================================================================
-- Schema Specification: Option B Return & RMA Persistence Engine (Corrected)
-- Task ID: EXCHANGE-CREDIT-PH3-003-R1
-- Location: supabase/migrations/specs/rma_persistence_specification.sql
-- Description: Complete schema specification for RMA headers, return SKU lines,
--              multi-box tracking, warehouse inspections (draft & final),
--              exception reviews, append-only audit logs with idempotency keys,
--              atomic transactional stored procedures (RPCs), and canonical
--              Role-Level Security (RLS) policies.
-- Numbering Gate: Prepared specification awaiting sequence coordination with
--                 concurrent task EXCHANGE-CREDIT-PH2-005-R1 before final numbering (0179).
-- Safety: Non-destructive, idempotent (IF NOT EXISTS), zero table resets.
-- DO NOT EXECUTE DIRECTLY IN PRODUCTION WITHOUT OWNER APPROVAL GATE.
-- ==============================================================================

-- 0. Sequence for RMA Codes
CREATE SEQUENCE IF NOT EXISTS public.retailer_exchange_rma_code_seq START 1;

CREATE OR REPLACE FUNCTION public.generate_exchange_rma_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_next_val BIGINT;
  v_year TEXT;
BEGIN
  v_next_val := nextval('public.retailer_exchange_rma_code_seq');
  v_year := to_char(NOW() AT TIME ZONE 'America/New_York', 'YYYY');
  RETURN 'RMA-' || v_year || '-' || LPAD(v_next_val::TEXT, 6, '0');
END;
$$;

-- 1. RMA Headers Table
CREATE TABLE IF NOT EXISTS public.retailer_exchange_rmas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rma_number TEXT NOT NULL UNIQUE,
  claim_id UUID NOT NULL UNIQUE REFERENCES public.retailer_exchange_claims(id) ON DELETE RESTRICT,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE RESTRICT,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,

  -- Strict Lifecycle Status
  status TEXT NOT NULL DEFAULT 'awaiting_admin_approval' CHECK (
    status IN (
      'awaiting_admin_approval',
      'approved',
      'shipped',
      'delivered',
      'inspection_in_progress',
      'inspection_completed',
      'resolution_ready',
      'cancelled',
      'expired',
      'exception'
    )
  ),

  -- 14-Calendar-Day Return Timeline (America/New_York)
  approval_date DATE NULL,
  shipping_deadline_date DATE NULL,

  -- Aggregate Metrics
  total_lines_count INT NOT NULL DEFAULT 1 CHECK (total_lines_count > 0),
  total_requested_units INT NOT NULL CHECK (total_requested_units > 0),
  total_authorized_units INT NOT NULL DEFAULT 0 CHECK (total_authorized_units >= 0),
  total_wholesale_value_cents BIGINT NOT NULL DEFAULT 0 CHECK (total_wholesale_value_cents >= 0),
  total_wholesale_value_dollars NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (total_wholesale_value_dollars >= 0),

  -- Admin Approval Attribution
  approved_by UUID NULL REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ NULL,
  admin_notes TEXT NULL,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. RMA Return SKU Lines Table
CREATE TABLE IF NOT EXISTS public.retailer_exchange_rma_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rma_id UUID NOT NULL REFERENCES public.retailer_exchange_rmas(id) ON DELETE CASCADE,
  claim_item_id UUID NOT NULL UNIQUE REFERENCES public.retailer_exchange_claim_items(id) ON DELETE RESTRICT,
  cohort_id UUID NOT NULL REFERENCES public.retailer_protected_supply_cohorts(id) ON DELETE RESTRICT,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,

  -- Quantities
  quantity_requested INT NOT NULL CHECK (quantity_requested > 0),
  quantity_authorized INT NOT NULL DEFAULT 0 CHECK (quantity_authorized >= 0),

  -- Frozen Wholesale Price (Option B 100% credit rate basis)
  frozen_unit_wholesale_price NUMERIC(12, 4) NOT NULL CHECK (frozen_unit_wholesale_price >= 0),
  frozen_wholesale_price_cents INT NOT NULL CHECK (frozen_wholesale_price_cents >= 0),

  -- Optional Box Assignment Reference
  box_id UUID NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Return Boxes Table (1 Label per Box)
CREATE TABLE IF NOT EXISTS public.retailer_exchange_rma_boxes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rma_id UUID NOT NULL REFERENCES public.retailer_exchange_rmas(id) ON DELETE CASCADE,
  box_number INT NOT NULL CHECK (box_number > 0),
  carrier TEXT NOT NULL CHECK (carrier IN ('UPS', 'USPS', 'FEDEX', 'OTHER')),
  tracking_number TEXT NOT NULL,
  label_url TEXT NULL,

  status TEXT NOT NULL DEFAULT 'label_created' CHECK (
    status IN ('label_created', 'in_transit', 'delivered', 'exception', 'lost')
  ),

  shipped_at TIMESTAMPTZ NULL,
  delivered_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_rma_box_number UNIQUE (rma_id, box_number),
  CONSTRAINT uq_rma_box_tracking UNIQUE (tracking_number)
);

-- 4. Box-to-SKU Allocation Table
CREATE TABLE IF NOT EXISTS public.retailer_exchange_rma_box_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  box_id UUID NOT NULL REFERENCES public.retailer_exchange_rma_boxes(id) ON DELETE CASCADE,
  rma_line_id UUID NOT NULL REFERENCES public.retailer_exchange_rma_lines(id) ON DELETE RESTRICT,
  quantity INT NOT NULL CHECK (quantity > 0),

  CONSTRAINT uq_box_line_allocation UNIQUE (box_id, rma_line_id)
);

-- 5. Warehouse Physical Inspection Record
CREATE TABLE IF NOT EXISTS public.retailer_exchange_rma_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rma_id UUID NOT NULL UNIQUE REFERENCES public.retailer_exchange_rmas(id) ON DELETE RESTRICT,
  box_condition TEXT NOT NULL CHECK (
    box_condition IN ('intact', 'damaged', 'crushed', 'tampered', 'water_damaged')
  ),

  -- Mandatory Inspector Attribution
  inspector_id UUID NOT NULL REFERENCES auth.users(id),
  inspector_name TEXT NOT NULL,
  inspector_role TEXT NOT NULL DEFAULT 'inspector',

  -- Aggregate Totals
  total_authorized INT NOT NULL CHECK (total_authorized >= 0),
  total_received INT NOT NULL CHECK (total_received >= 0),
  total_accepted_resaleable INT NOT NULL CHECK (total_accepted_resaleable >= 0),
  total_rejected INT NOT NULL CHECK (total_rejected >= 0),
  total_missing INT NOT NULL CHECK (total_missing >= 0),

  has_discrepancies BOOLEAN NOT NULL DEFAULT false,
  is_draft BOOLEAN NOT NULL DEFAULT false,
  overall_notes TEXT NULL,

  inspected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Warehouse Inspection Line Results Table
-- Note: Line-level CHECK (received = accepted + rejected) is intentionally relaxed to allow
-- unclassified units in valid Draft inspections. Strict reconciliation is enforced on finalization.
CREATE TABLE IF NOT EXISTS public.retailer_exchange_rma_inspection_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id UUID NOT NULL REFERENCES public.retailer_exchange_rma_inspections(id) ON DELETE CASCADE,
  rma_line_id UUID NOT NULL REFERENCES public.retailer_exchange_rma_lines(id) ON DELETE RESTRICT,

  -- Quantities
  quantity_authorized INT NOT NULL CHECK (quantity_authorized >= 0),
  quantity_received INT NOT NULL CHECK (quantity_received >= 0),
  quantity_accepted_resaleable INT NOT NULL CHECK (quantity_accepted_resaleable >= 0),
  quantity_rejected INT NOT NULL CHECK (quantity_rejected >= 0),
  quantity_missing INT NOT NULL CHECK (quantity_missing >= 0),

  -- Rejection Classification
  rejection_reason TEXT NULL CHECK (
    rejection_reason IS NULL OR
    rejection_reason IN (
      'damaged',
      'expired',
      'opened_unsealed',
      'wrong_sku',
      'counterfeit',
      'missing_parts',
      'other'
    )
  ),

  discrepancy_type TEXT NOT NULL DEFAULT 'exact_match' CHECK (
    discrepancy_type IN (
      'exact_match',
      'partial_acceptance',
      'partial_receipt',
      'over_receipt',
      'wrong_sku',
      'total_rejection'
    )
  ),
  discrepancy_notes TEXT NULL,

  CONSTRAINT uq_inspection_line UNIQUE (inspection_id, rma_line_id),
  -- Invariant Constraints (Hold true for both draft and final)
  CONSTRAINT chk_accepted_lte_received CHECK (quantity_accepted_resaleable <= quantity_received),
  CONSTRAINT chk_accepted_lte_authorized CHECK (quantity_accepted_resaleable <= quantity_authorized),
  CONSTRAINT chk_accepted_plus_rejected_lte_received CHECK (quantity_accepted_resaleable + quantity_rejected <= quantity_received)
);

-- 7. RMA Exceptions Table
CREATE TABLE IF NOT EXISTS public.retailer_exchange_rma_exceptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rma_id UUID NOT NULL REFERENCES public.retailer_exchange_rmas(id) ON DELETE CASCADE,
  code TEXT NOT NULL CHECK (
    code IN (
      'UNSHIPPED_OVERDUE',
      'LATE_CARRIER_SCAN',
      'PARTIAL_RECEIPT',
      'OVER_RECEIPT',
      'DAMAGED_UNITS',
      'WRONG_SKU_RETURNED',
      'CARRIER_LOST_PARCEL',
      'MISSING_TRACKING',
      'MULTIPLE_BOXES_SPLIT_DELIVERY',
      'ADMIN_MANUAL_HOLD'
    )
  ),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  description TEXT NOT NULL,
  requires_admin_review BOOLEAN NOT NULL DEFAULT true,
  flag_carrier_claim BOOLEAN NOT NULL DEFAULT false,

  resolved BOOLEAN NOT NULL DEFAULT false,
  resolution_notes TEXT NULL,
  resolved_by UUID NULL REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Append-Only RMA Audit Logs Table with Database Idempotency
CREATE TABLE IF NOT EXISTS public.retailer_exchange_rma_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rma_id UUID NOT NULL REFERENCES public.retailer_exchange_rmas(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  old_status TEXT NULL,
  new_status TEXT NOT NULL,
  actor_id UUID NULL REFERENCES auth.users(id),
  actor_name TEXT NULL,
  actor_role TEXT NOT NULL,
  reason TEXT NULL,
  metadata JSONB NULL,
  idempotency_key TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique index on idempotency key per RMA to prevent duplicate audit event inserts on retries
CREATE UNIQUE INDEX IF NOT EXISTS idx_rma_audit_idempotency
  ON public.retailer_exchange_rma_audit_logs (rma_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- ==============================================================================
-- Indexes for High Performance Queries
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_exchange_rmas_claim_id ON public.retailer_exchange_rmas(claim_id);
CREATE INDEX IF NOT EXISTS idx_exchange_rmas_company_id ON public.retailer_exchange_rmas(company_id);
CREATE INDEX IF NOT EXISTS idx_exchange_rmas_store_id ON public.retailer_exchange_rmas(store_id);
CREATE INDEX IF NOT EXISTS idx_exchange_rmas_status ON public.retailer_exchange_rmas(status);
CREATE INDEX IF NOT EXISTS idx_exchange_rma_lines_rma_id ON public.retailer_exchange_rma_lines(rma_id);
CREATE INDEX IF NOT EXISTS idx_exchange_rma_boxes_rma_id ON public.retailer_exchange_rma_boxes(rma_id);
CREATE INDEX IF NOT EXISTS idx_exchange_rma_exceptions_rma_id ON public.retailer_exchange_rma_exceptions(rma_id);
CREATE INDEX IF NOT EXISTS idx_exchange_rma_audit_rma_id ON public.retailer_exchange_rma_audit_logs(rma_id);

-- ==============================================================================
-- Triggers: Finalized Inspection Immutability
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.check_finalized_inspection_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- If the existing inspection record was already finalized (is_draft = false)
  IF OLD.is_draft = false THEN
    -- Disallow mutation of reconciled totals or reverting to draft
    IF (NEW.is_draft = true OR
        NEW.total_authorized <> OLD.total_authorized OR
        NEW.total_received <> OLD.total_received OR
        NEW.total_accepted_resaleable <> OLD.total_accepted_resaleable OR
        NEW.total_rejected <> OLD.total_rejected OR
        NEW.total_missing <> OLD.total_missing) THEN
      RAISE EXCEPTION 'INSPECTION_ALREADY_FINALIZED: Finalized warehouse inspections are immutable and cannot be overwritten.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_finalized_inspection_immutable ON public.retailer_exchange_rma_inspections;
CREATE TRIGGER trg_finalized_inspection_immutable
  BEFORE UPDATE ON public.retailer_exchange_rma_inspections
  FOR EACH ROW
  EXECUTE FUNCTION public.check_finalized_inspection_immutable();

-- ==============================================================================
-- Row-Level Security (RLS) Policies (Canonical Role-Based Enforcement)
-- No email domain-only privileges. Requires authentic app role & active status.
-- ==============================================================================
ALTER TABLE public.retailer_exchange_rmas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retailer_exchange_rma_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retailer_exchange_rma_boxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retailer_exchange_rma_box_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retailer_exchange_rma_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retailer_exchange_rma_inspection_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retailer_exchange_rma_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retailer_exchange_rma_audit_logs ENABLE ROW LEVEL SECURITY;

-- 1. Admin Full Access Policies (Uses canonical public.auth_is_admin() from 0002_companies.sql)
DROP POLICY IF EXISTS "Admins have full access to exchange rmas" ON public.retailer_exchange_rmas;
CREATE POLICY "Admins have full access to exchange rmas"
  ON public.retailer_exchange_rmas
  FOR ALL
  TO authenticated
  USING (public.auth_is_admin());

DROP POLICY IF EXISTS "Admins have full access to rma lines" ON public.retailer_exchange_rma_lines;
CREATE POLICY "Admins have full access to rma lines"
  ON public.retailer_exchange_rma_lines
  FOR ALL
  TO authenticated
  USING (public.auth_is_admin());

DROP POLICY IF EXISTS "Admins have full access to rma boxes" ON public.retailer_exchange_rma_boxes;
CREATE POLICY "Admins have full access to rma boxes"
  ON public.retailer_exchange_rma_boxes
  FOR ALL
  TO authenticated
  USING (public.auth_is_admin());

DROP POLICY IF EXISTS "Admins have full access to rma box allocations" ON public.retailer_exchange_rma_box_allocations;
CREATE POLICY "Admins have full access to rma box allocations"
  ON public.retailer_exchange_rma_box_allocations
  FOR ALL
  TO authenticated
  USING (public.auth_is_admin());

DROP POLICY IF EXISTS "Admins have full access to rma inspections" ON public.retailer_exchange_rma_inspections;
CREATE POLICY "Admins have full access to rma inspections"
  ON public.retailer_exchange_rma_inspections
  FOR ALL
  TO authenticated
  USING (public.auth_is_admin());

DROP POLICY IF EXISTS "Admins have full access to rma inspection lines" ON public.retailer_exchange_rma_inspection_lines;
CREATE POLICY "Admins have full access to rma inspection lines"
  ON public.retailer_exchange_rma_inspection_lines
  FOR ALL
  TO authenticated
  USING (public.auth_is_admin());

DROP POLICY IF EXISTS "Admins have full access to rma exceptions" ON public.retailer_exchange_rma_exceptions;
CREATE POLICY "Admins have full access to rma exceptions"
  ON public.retailer_exchange_rma_exceptions
  FOR ALL
  TO authenticated
  USING (public.auth_is_admin());

DROP POLICY IF EXISTS "Admins have full access to rma audit logs" ON public.retailer_exchange_rma_audit_logs;
CREATE POLICY "Admins have full access to rma audit logs"
  ON public.retailer_exchange_rma_audit_logs
  FOR ALL
  TO authenticated
  USING (public.auth_is_admin());

-- 2. Retailer Scoped Read-Only Policies (Enforces active company membership)
DROP POLICY IF EXISTS "Retailers can read own company rmas" ON public.retailer_exchange_rmas;
CREATE POLICY "Retailers can read own company rmas"
  ON public.retailer_exchange_rmas
  FOR SELECT
  TO authenticated
  USING (
    public.auth_is_admin()
    OR company_id IN (
      SELECT cu.company_id
      FROM public.company_users cu
      WHERE (cu.id = auth.uid() OR cu.email = (auth.jwt() ->> 'email'))
        AND cu.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Retailers can read own company rma lines" ON public.retailer_exchange_rma_lines;
CREATE POLICY "Retailers can read own company rma lines"
  ON public.retailer_exchange_rma_lines
  FOR SELECT
  TO authenticated
  USING (
    public.auth_is_admin()
    OR rma_id IN (
      SELECT r.id FROM public.retailer_exchange_rmas r
      WHERE r.company_id IN (
        SELECT cu.company_id
        FROM public.company_users cu
        WHERE (cu.id = auth.uid() OR cu.email = (auth.jwt() ->> 'email'))
          AND cu.status = 'active'
      )
    )
  );

DROP POLICY IF EXISTS "Retailers can read own company rma boxes" ON public.retailer_exchange_rma_boxes;
CREATE POLICY "Retailers can read own company rma boxes"
  ON public.retailer_exchange_rma_boxes
  FOR SELECT
  TO authenticated
  USING (
    public.auth_is_admin()
    OR rma_id IN (
      SELECT r.id FROM public.retailer_exchange_rmas r
      WHERE r.company_id IN (
        SELECT cu.company_id
        FROM public.company_users cu
        WHERE (cu.id = auth.uid() OR cu.email = (auth.jwt() ->> 'email'))
          AND cu.status = 'active'
      )
    )
  );

DROP POLICY IF EXISTS "Retailers can read own company rma box allocations" ON public.retailer_exchange_rma_box_allocations;
CREATE POLICY "Retailers can read own company rma box allocations"
  ON public.retailer_exchange_rma_box_allocations
  FOR SELECT
  TO authenticated
  USING (
    public.auth_is_admin()
    OR box_id IN (
      SELECT b.id FROM public.retailer_exchange_rma_boxes b
      JOIN public.retailer_exchange_rmas r ON r.id = b.rma_id
      WHERE r.company_id IN (
        SELECT cu.company_id
        FROM public.company_users cu
        WHERE (cu.id = auth.uid() OR cu.email = (auth.jwt() ->> 'email'))
          AND cu.status = 'active'
      )
    )
  );

-- Draft inspections are strictly ADMIN ONLY. Retailers can only view FINALIZED inspections.
DROP POLICY IF EXISTS "Retailers can read own finalized rma inspections" ON public.retailer_exchange_rma_inspections;
CREATE POLICY "Retailers can read own finalized rma inspections"
  ON public.retailer_exchange_rma_inspections
  FOR SELECT
  TO authenticated
  USING (
    public.auth_is_admin()
    OR (
      is_draft = false
      AND rma_id IN (
        SELECT r.id FROM public.retailer_exchange_rmas r
        WHERE r.company_id IN (
          SELECT cu.company_id
          FROM public.company_users cu
          WHERE (cu.id = auth.uid() OR cu.email = (auth.jwt() ->> 'email'))
            AND cu.status = 'active'
        )
      )
    )
  );

DROP POLICY IF EXISTS "Retailers can read own finalized rma inspection lines" ON public.retailer_exchange_rma_inspection_lines;
CREATE POLICY "Retailers can read own finalized rma inspection lines"
  ON public.retailer_exchange_rma_inspection_lines
  FOR SELECT
  TO authenticated
  USING (
    public.auth_is_admin()
    OR inspection_id IN (
      SELECT i.id FROM public.retailer_exchange_rma_inspections i
      JOIN public.retailer_exchange_rmas r ON r.id = i.rma_id
      WHERE i.is_draft = false
        AND r.company_id IN (
          SELECT cu.company_id
          FROM public.company_users cu
          WHERE (cu.id = auth.uid() OR cu.email = (auth.jwt() ->> 'email'))
            AND cu.status = 'active'
        )
    )
  );

DROP POLICY IF EXISTS "Retailers can read own company rma exceptions" ON public.retailer_exchange_rma_exceptions;
CREATE POLICY "Retailers can read own company rma exceptions"
  ON public.retailer_exchange_rma_exceptions
  FOR SELECT
  TO authenticated
  USING (
    public.auth_is_admin()
    OR rma_id IN (
      SELECT r.id FROM public.retailer_exchange_rmas r
      WHERE r.company_id IN (
        SELECT cu.company_id
        FROM public.company_users cu
        WHERE (cu.id = auth.uid() OR cu.email = (auth.jwt() ->> 'email'))
          AND cu.status = 'active'
      )
    )
  );

DROP POLICY IF EXISTS "Retailers can read own company rma audit logs" ON public.retailer_exchange_rma_audit_logs;
CREATE POLICY "Retailers can read own company rma audit logs"
  ON public.retailer_exchange_rma_audit_logs
  FOR SELECT
  TO authenticated
  USING (
    public.auth_is_admin()
    OR rma_id IN (
      SELECT r.id FROM public.retailer_exchange_rmas r
      WHERE r.company_id IN (
        SELECT cu.company_id
        FROM public.company_users cu
        WHERE (cu.id = auth.uid() OR cu.email = (auth.jwt() ->> 'email'))
          AND cu.status = 'active'
      )
    )
  );

-- ==============================================================================
-- 9. Authoritative Atomic Stored Procedures (RPCs)
-- ACID Transaction guarantees for RMA operations
-- ==============================================================================

-- 9.1 Atomic RMA Creation Stored Procedure
CREATE OR REPLACE FUNCTION public.create_exchange_rma_atomic(
  p_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_claim_id UUID;
  v_company_id UUID;
  v_store_id UUID;
  v_rma_id UUID;
  v_rma_number TEXT;
  v_actor_id UUID;
  v_actor_name TEXT;
  v_idempotency_key TEXT;
  v_line JSONB;
  v_lines_count INT := 0;
  v_total_requested INT := 0;
  v_total_cents BIGINT := 0;
  v_total_dollars NUMERIC(12, 2) := 0.00;
BEGIN
  -- 1. Authorization Gate (Admin Only)
  IF NOT public.auth_is_admin() THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Only authenticated administrators can create RMAs';
  END IF;

  v_claim_id := (p_payload->>'claim_id')::UUID;
  v_company_id := (p_payload->>'company_id')::UUID;
  v_store_id := (p_payload->>'store_id')::UUID;
  v_actor_id := COALESCE(auth.uid(), (p_payload->>'actor_id')::UUID);
  v_actor_name := COALESCE(p_payload->>'actor_name', 'Admin');
  v_idempotency_key := p_payload->>'idempotency_key';

  -- 2. Lock Claim Row to prevent race condition
  PERFORM id FROM public.retailer_exchange_claims WHERE id = v_claim_id FOR UPDATE;

  -- 3. Check for Duplicate RMA
  IF EXISTS (SELECT 1 FROM public.retailer_exchange_rmas WHERE claim_id = v_claim_id) THEN
    RAISE EXCEPTION 'DUPLICATE_RMA_FOR_CLAIM: An RMA already exists for Claim %', v_claim_id;
  END IF;

  -- 4. Generate Authoritative RMA Number
  v_rma_number := public.generate_exchange_rma_code();

  -- 5. Calculate Metrics from Payload
  v_lines_count := jsonb_array_length(p_payload->'lines');
  IF v_lines_count = 0 THEN
    RAISE EXCEPTION 'NO_OPTION_B_ITEMS: RMA must contain at least one Option B line';
  END IF;

  v_total_requested := (p_payload->>'total_requested_units')::INT;
  v_total_cents := (p_payload->>'total_wholesale_value_cents')::BIGINT;
  v_total_dollars := (p_payload->>'total_wholesale_value_dollars')::NUMERIC(12, 2);

  -- 6. Insert RMA Header
  INSERT INTO public.retailer_exchange_rmas (
    rma_number,
    claim_id,
    store_id,
    company_id,
    status,
    total_lines_count,
    total_requested_units,
    total_authorized_units,
    total_wholesale_value_cents,
    total_wholesale_value_dollars
  ) VALUES (
    v_rma_number,
    v_claim_id,
    v_store_id,
    v_company_id,
    'awaiting_admin_approval',
    v_lines_count,
    v_total_requested,
    v_total_requested,
    v_total_cents,
    v_total_dollars
  )
  RETURNING id INTO v_rma_id;

  -- 7. Insert Return Lines
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_payload->'lines')
  LOOP
    INSERT INTO public.retailer_exchange_rma_lines (
      rma_id,
      claim_item_id,
      cohort_id,
      product_id,
      quantity_requested,
      quantity_authorized,
      frozen_unit_wholesale_price,
      frozen_wholesale_price_cents
    ) VALUES (
      v_rma_id,
      (v_line->>'claim_item_id')::UUID,
      (v_line->>'cohort_id')::UUID,
      (v_line->>'product_id')::UUID,
      (v_line->>'quantity_requested')::INT,
      (v_line->>'quantity_requested')::INT,
      (v_line->>'frozen_unit_wholesale_price')::NUMERIC(12, 4),
      (v_line->>'frozen_wholesale_price_cents')::INT
    );
  END LOOP;

  -- 8. Append Authoritative Audit Log
  INSERT INTO public.retailer_exchange_rma_audit_logs (
    rma_id,
    event_type,
    new_status,
    actor_id,
    actor_name,
    actor_role,
    reason,
    metadata,
    idempotency_key
  ) VALUES (
    v_rma_id,
    'RMA_CREATED_FROM_CLAIM',
    'awaiting_admin_approval',
    v_actor_id,
    v_actor_name,
    'admin',
    'RMA created from Option B items on approved claim',
    jsonb_build_object('claim_id', v_claim_id, 'rma_number', v_rma_number),
    COALESCE(v_idempotency_key, 'rma_create:' || v_claim_id::TEXT)
  )
  ON CONFLICT (rma_id, idempotency_key) DO NOTHING;

  RETURN jsonb_build_object(
    'success', true,
    'rma_id', v_rma_id,
    'rma_number', v_rma_number,
    'lines_count', v_lines_count,
    'total_requested_units', v_total_requested
  );
END;
$$;

-- 9.2 Atomic Multi-Box & SKU Allocation Stored Procedure
CREATE OR REPLACE FUNCTION public.save_rma_box_allocations_atomic(
  p_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rma_id UUID;
  v_actor_id UUID;
  v_actor_name TEXT;
  v_idempotency_key TEXT;
  v_box JSONB;
  v_alloc JSONB;
  v_box_id UUID;
  v_boxes_count INT := 0;
BEGIN
  IF NOT public.auth_is_admin() THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Only authenticated administrators can manage box allocations';
  END IF;

  v_rma_id := (p_payload->>'rma_id')::UUID;
  v_actor_id := COALESCE(auth.uid(), (p_payload->>'actor_id')::UUID);
  v_actor_name := COALESCE(p_payload->>'actor_name', 'Admin');
  v_idempotency_key := p_payload->>'idempotency_key';

  -- Lock RMA
  PERFORM id FROM public.retailer_exchange_rmas WHERE id = v_rma_id FOR UPDATE;

  -- Clear existing box allocations and boxes for this RMA
  DELETE FROM public.retailer_exchange_rma_boxes WHERE rma_id = v_rma_id;

  -- Insert boxes and allocations
  FOR v_box IN SELECT * FROM jsonb_array_elements(p_payload->'boxes')
  LOOP
    v_boxes_count := v_boxes_count + 1;

    INSERT INTO public.retailer_exchange_rma_boxes (
      rma_id,
      box_number,
      carrier,
      tracking_number,
      label_url,
      status
    ) VALUES (
      v_rma_id,
      (v_box->>'box_number')::INT,
      v_box->>'carrier',
      v_box->>'tracking_number',
      v_box->>'label_url',
      COALESCE(v_box->>'status', 'label_created')
    )
    RETURNING id INTO v_box_id;

    IF v_box ? 'assigned_lines' THEN
      FOR v_alloc IN SELECT * FROM jsonb_array_elements(v_box->'assigned_lines')
      LOOP
        INSERT INTO public.retailer_exchange_rma_box_allocations (
          box_id,
          rma_line_id,
          quantity
        ) VALUES (
          v_box_id,
          (v_alloc->>'line_id')::UUID,
          (v_alloc->>'quantity')::INT
        );
      END LOOP;
    END IF;
  END LOOP;

  -- Log Audit Event
  INSERT INTO public.retailer_exchange_rma_audit_logs (
    rma_id,
    event_type,
    new_status,
    actor_id,
    actor_name,
    actor_role,
    reason,
    metadata,
    idempotency_key
  ) VALUES (
    v_rma_id,
    'BOX_ALLOCATION_UPDATED',
    (SELECT status FROM public.retailer_exchange_rmas WHERE id = v_rma_id),
    v_actor_id,
    v_actor_name,
    'admin',
    'Shipping boxes and SKU allocations updated',
    jsonb_build_object('boxes_count', v_boxes_count),
    COALESCE(v_idempotency_key, 'box_alloc:' || v_rma_id::TEXT || ':' || v_boxes_count::TEXT)
  )
  ON CONFLICT (rma_id, idempotency_key) DO NOTHING;

  RETURN jsonb_build_object('success', true, 'rma_id', v_rma_id, 'boxes_count', v_boxes_count);
END;
$$;

-- 9.3 Atomic Draft Warehouse Inspection Stored Procedure
CREATE OR REPLACE FUNCTION public.save_warehouse_inspection_draft_atomic(
  p_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rma_id UUID;
  v_inspector_id UUID;
  v_inspector_name TEXT;
  v_inspector_role TEXT;
  v_box_condition TEXT;
  v_overall_notes TEXT;
  v_inspection_id UUID;
  v_existing_is_draft BOOLEAN;
  v_current_status TEXT;
  v_line JSONB;
  v_idempotency_key TEXT;
BEGIN
  IF NOT public.auth_is_admin() THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Only authorized warehouse staff can record inspections';
  END IF;

  v_rma_id := (p_payload->>'rma_id')::UUID;
  v_inspector_id := COALESCE(auth.uid(), (p_payload->>'inspector_id')::UUID);
  v_inspector_name := COALESCE(p_payload->>'inspector_name', 'Inspector');
  v_inspector_role := COALESCE(p_payload->>'inspector_role', 'inspector');
  v_box_condition := COALESCE(p_payload->>'box_condition', 'intact');
  v_overall_notes := p_payload->>'overall_notes';
  v_idempotency_key := p_payload->>'idempotency_key';

  -- Check if already finalized (IMMUTABLE)
  SELECT id, is_draft INTO v_inspection_id, v_existing_is_draft
  FROM public.retailer_exchange_rma_inspections
  WHERE rma_id = v_rma_id
  FOR UPDATE;

  IF v_inspection_id IS NOT NULL AND v_existing_is_draft = false THEN
    RAISE EXCEPTION 'FINALIZED_INSPECTION_IMMUTABLE: Cannot overwrite or revert a finalized warehouse inspection';
  END IF;

  -- Upsert draft inspection header
  INSERT INTO public.retailer_exchange_rma_inspections (
    rma_id,
    box_condition,
    inspector_id,
    inspector_name,
    inspector_role,
    total_authorized,
    total_received,
    total_accepted_resaleable,
    total_rejected,
    total_missing,
    has_discrepancies,
    is_draft,
    overall_notes,
    inspected_at
  ) VALUES (
    v_rma_id,
    v_box_condition,
    v_inspector_id,
    v_inspector_name,
    v_inspector_role,
    (p_payload->>'total_authorized')::INT,
    (p_payload->>'total_received')::INT,
    (p_payload->>'total_accepted_resaleable')::INT,
    (p_payload->>'total_rejected')::INT,
    (p_payload->>'total_missing')::INT,
    COALESCE((p_payload->>'has_discrepancies')::BOOLEAN, false),
    true, -- Draft
    v_overall_notes,
    NOW()
  )
  ON CONFLICT (rma_id) DO UPDATE SET
    box_condition = EXCLUDED.box_condition,
    inspector_id = EXCLUDED.inspector_id,
    inspector_name = EXCLUDED.inspector_name,
    total_authorized = EXCLUDED.total_authorized,
    total_received = EXCLUDED.total_received,
    total_accepted_resaleable = EXCLUDED.total_accepted_resaleable,
    total_rejected = EXCLUDED.total_rejected,
    total_missing = EXCLUDED.total_missing,
    has_discrepancies = EXCLUDED.has_discrepancies,
    overall_notes = EXCLUDED.overall_notes,
    inspected_at = NOW()
  RETURNING id INTO v_inspection_id;

  -- Upsert lines
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_payload->'lines')
  LOOP
    INSERT INTO public.retailer_exchange_rma_inspection_lines (
      inspection_id,
      rma_line_id,
      quantity_authorized,
      quantity_received,
      quantity_accepted_resaleable,
      quantity_rejected,
      quantity_missing,
      rejection_reason,
      discrepancy_type,
      discrepancy_notes
    ) VALUES (
      v_inspection_id,
      (v_line->>'line_id')::UUID,
      (v_line->>'quantity_authorized')::INT,
      (v_line->>'quantity_received')::INT,
      (v_line->>'quantity_accepted_resaleable')::INT,
      (v_line->>'quantity_rejected')::INT,
      (v_line->>'quantity_missing')::INT,
      v_line->>'rejection_reason',
      COALESCE(v_line->>'discrepancy_type', 'exact_match'),
      v_line->>'discrepancy_notes'
    )
    ON CONFLICT (inspection_id, rma_line_id) DO UPDATE SET
      quantity_authorized = EXCLUDED.quantity_authorized,
      quantity_received = EXCLUDED.quantity_received,
      quantity_accepted_resaleable = EXCLUDED.quantity_accepted_resaleable,
      quantity_rejected = EXCLUDED.quantity_rejected,
      quantity_missing = EXCLUDED.quantity_missing,
      rejection_reason = EXCLUDED.rejection_reason,
      discrepancy_type = EXCLUDED.discrepancy_type,
      discrepancy_notes = EXCLUDED.discrepancy_notes;
  END LOOP;

  -- Move RMA status to inspection_in_progress if currently delivered
  SELECT status INTO v_current_status FROM public.retailer_exchange_rmas WHERE id = v_rma_id;
  IF v_current_status = 'delivered' THEN
    UPDATE public.retailer_exchange_rmas SET status = 'inspection_in_progress', updated_at = NOW() WHERE id = v_rma_id;
  END IF;

  -- Audit log
  INSERT INTO public.retailer_exchange_rma_audit_logs (
    rma_id,
    event_type,
    new_status,
    actor_id,
    actor_name,
    actor_role,
    reason,
    metadata,
    idempotency_key
  ) VALUES (
    v_rma_id,
    'INSPECTION_DRAFT_SAVED',
    COALESCE(v_current_status, 'inspection_in_progress'),
    v_inspector_id,
    v_inspector_name,
    v_inspector_role,
    'Warehouse inspection draft saved with unclassified units permitted',
    jsonb_build_object('inspection_id', v_inspection_id, 'is_draft', true),
    COALESCE(v_idempotency_key, 'draft_insp:' || v_rma_id::TEXT || ':' || EXTRACT(EPOCH FROM NOW())::TEXT)
  )
  ON CONFLICT (rma_id, idempotency_key) DO NOTHING;

  RETURN jsonb_build_object('success', true, 'inspection_id', v_inspection_id, 'is_draft', true);
END;
$$;

-- 9.4 Atomic Final Inspection Stored Procedure
CREATE OR REPLACE FUNCTION public.finalize_warehouse_inspection_atomic(
  p_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rma_id UUID;
  v_inspector_id UUID;
  v_inspector_name TEXT;
  v_inspector_role TEXT;
  v_box_condition TEXT;
  v_overall_notes TEXT;
  v_inspection_id UUID;
  v_existing_is_draft BOOLEAN;
  v_line JSONB;
  v_ex JSONB;
  v_next_status TEXT;
  v_has_discrepancies BOOLEAN;
  v_idempotency_key TEXT;
BEGIN
  IF NOT public.auth_is_admin() THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Only authorized warehouse staff can finalize inspections';
  END IF;

  v_rma_id := (p_payload->>'rma_id')::UUID;
  v_inspector_id := COALESCE(auth.uid(), (p_payload->>'inspector_id')::UUID);
  v_inspector_name := COALESCE(p_payload->>'inspector_name', 'Inspector');
  v_inspector_role := COALESCE(p_payload->>'inspector_role', 'inspector');
  v_box_condition := COALESCE(p_payload->>'box_condition', 'intact');
  v_overall_notes := p_payload->>'overall_notes';
  v_has_discrepancies := COALESCE((p_payload->>'has_discrepancies')::BOOLEAN, false);
  v_idempotency_key := p_payload->>'idempotency_key';

  -- 1. Check if already finalized (IMMUTABLE)
  SELECT id, is_draft INTO v_inspection_id, v_existing_is_draft
  FROM public.retailer_exchange_rma_inspections
  WHERE rma_id = v_rma_id
  FOR UPDATE;

  IF v_inspection_id IS NOT NULL AND v_existing_is_draft = false THEN
    RAISE EXCEPTION 'FINALIZED_INSPECTION_IMMUTABLE: Cannot overwrite or re-finalize a completed inspection';
  END IF;

  -- 2. Validate strict reconciliation on all lines
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_payload->'lines')
  LOOP
    IF (v_line->>'quantity_received')::INT <> ((v_line->>'quantity_accepted_resaleable')::INT + (v_line->>'quantity_rejected')::INT) THEN
      RAISE EXCEPTION 'RECONCILIATION_INCOMPLETE: Line % received units must equal accepted + rejected', v_line->>'line_id';
    END IF;

    IF (v_line->>'quantity_rejected')::INT > 0 AND (v_line->>'rejection_reason' IS NULL OR v_line->>'rejection_reason' = '') THEN
      RAISE EXCEPTION 'REJECTION_REASON_REQUIRED: Line % has rejected units without a rejection reason', v_line->>'line_id';
    END IF;
  END LOOP;

  -- 3. Upsert Finalized Inspection Header
  INSERT INTO public.retailer_exchange_rma_inspections (
    rma_id,
    box_condition,
    inspector_id,
    inspector_name,
    inspector_role,
    total_authorized,
    total_received,
    total_accepted_resaleable,
    total_rejected,
    total_missing,
    has_discrepancies,
    is_draft,
    overall_notes,
    inspected_at
  ) VALUES (
    v_rma_id,
    v_box_condition,
    v_inspector_id,
    v_inspector_name,
    v_inspector_role,
    (p_payload->>'total_authorized')::INT,
    (p_payload->>'total_received')::INT,
    (p_payload->>'total_accepted_resaleable')::INT,
    (p_payload->>'total_rejected')::INT,
    (p_payload->>'total_missing')::INT,
    v_has_discrepancies,
    false, -- Finalized
    v_overall_notes,
    NOW()
  )
  ON CONFLICT (rma_id) DO UPDATE SET
    box_condition = EXCLUDED.box_condition,
    inspector_id = EXCLUDED.inspector_id,
    inspector_name = EXCLUDED.inspector_name,
    total_authorized = EXCLUDED.total_authorized,
    total_received = EXCLUDED.total_received,
    total_accepted_resaleable = EXCLUDED.total_accepted_resaleable,
    total_rejected = EXCLUDED.total_rejected,
    total_missing = EXCLUDED.total_missing,
    has_discrepancies = EXCLUDED.has_discrepancies,
    is_draft = false,
    overall_notes = EXCLUDED.overall_notes,
    inspected_at = NOW()
  RETURNING id INTO v_inspection_id;

  -- 4. Upsert Lines
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_payload->'lines')
  LOOP
    INSERT INTO public.retailer_exchange_rma_inspection_lines (
      inspection_id,
      rma_line_id,
      quantity_authorized,
      quantity_received,
      quantity_accepted_resaleable,
      quantity_rejected,
      quantity_missing,
      rejection_reason,
      discrepancy_type,
      discrepancy_notes
    ) VALUES (
      v_inspection_id,
      (v_line->>'line_id')::UUID,
      (v_line->>'quantity_authorized')::INT,
      (v_line->>'quantity_received')::INT,
      (v_line->>'quantity_accepted_resaleable')::INT,
      (v_line->>'quantity_rejected')::INT,
      (v_line->>'quantity_missing')::INT,
      v_line->>'rejection_reason',
      COALESCE(v_line->>'discrepancy_type', 'exact_match'),
      v_line->>'discrepancy_notes'
    )
    ON CONFLICT (inspection_id, rma_line_id) DO UPDATE SET
      quantity_authorized = EXCLUDED.quantity_authorized,
      quantity_received = EXCLUDED.quantity_received,
      quantity_accepted_resaleable = EXCLUDED.quantity_accepted_resaleable,
      quantity_rejected = EXCLUDED.quantity_rejected,
      quantity_missing = EXCLUDED.quantity_missing,
      rejection_reason = EXCLUDED.rejection_reason,
      discrepancy_type = EXCLUDED.discrepancy_type,
      discrepancy_notes = EXCLUDED.discrepancy_notes;
  END LOOP;

  -- 5. Insert Exceptions (if any)
  IF p_payload ? 'exceptions' THEN
    FOR v_ex IN SELECT * FROM jsonb_array_elements(p_payload->'exceptions')
    LOOP
      INSERT INTO public.retailer_exchange_rma_exceptions (
        rma_id,
        code,
        severity,
        description,
        requires_admin_review,
        flag_carrier_claim,
        resolved,
        resolution_notes
      ) VALUES (
        v_rma_id,
        v_ex->>'code',
        v_ex->>'severity',
        v_ex->>'description',
        COALESCE((v_ex->>'requires_admin_review')::BOOLEAN, true),
        COALESCE((v_ex->>'flag_carrier_claim')::BOOLEAN, false),
        COALESCE((v_ex->>'resolved')::BOOLEAN, false),
        v_ex->>'resolution_notes'
      );
    END LOOP;
  END IF;

  -- 6. Transition RMA Status
  IF v_has_discrepancies OR (p_payload ? 'exceptions' AND jsonb_array_length(p_payload->'exceptions') > 0) THEN
    v_next_status := 'exception';
  ELSE
    v_next_status := 'inspection_completed';
  END IF;

  UPDATE public.retailer_exchange_rmas
  SET status = v_next_status, updated_at = NOW()
  WHERE id = v_rma_id;

  -- 7. Authoritative Audit Log
  INSERT INTO public.retailer_exchange_rma_audit_logs (
    rma_id,
    event_type,
    new_status,
    actor_id,
    actor_name,
    actor_role,
    reason,
    metadata,
    idempotency_key
  ) VALUES (
    v_rma_id,
    'INSPECTION_FINALIZED',
    v_next_status,
    v_inspector_id,
    v_inspector_name,
    v_inspector_role,
    'Warehouse inspection completed and reconciled',
    jsonb_build_object(
      'inspection_id', v_inspection_id,
      'has_discrepancies', v_has_discrepancies,
      'total_accepted', (p_payload->>'total_accepted_resaleable')::INT
    ),
    COALESCE(v_idempotency_key, 'final_insp:' || v_rma_id::TEXT)
  )
  ON CONFLICT (rma_id, idempotency_key) DO NOTHING;

  RETURN jsonb_build_object(
    'success', true,
    'inspection_id', v_inspection_id,
    'rma_status', v_next_status
  );
END;
$$;
