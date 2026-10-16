-- ==============================================================================
-- Schema Specification: Option B Return & RMA Persistence Engine
-- Task ID: EXCHANGE-CREDIT-PH3-003
-- Location: supabase/migrations/specs/rma_persistence_specification.sql
-- Description: Complete schema specification for RMA headers, return SKU lines,
--              multi-box tracking, warehouse inspections, exception reviews,
--              audit logs, constraints, and Row-Level Security (RLS).
-- Numbering Gate: Prepared specification awaiting sequence coordination with
--                 concurrent task EXCHANGE-CREDIT-PH2-005-R1 before final numbering.
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

  -- Frozen Wholesale Price
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

  -- Aggregate Invariant Totals
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
  -- Invariant Constraints
  CONSTRAINT chk_accepted_lte_received CHECK (quantity_accepted_resaleable <= quantity_received),
  CONSTRAINT chk_accepted_lte_authorized CHECK (quantity_accepted_resaleable <= quantity_authorized),
  CONSTRAINT chk_received_eq_accepted_plus_rejected CHECK (quantity_received = quantity_accepted_resaleable + quantity_rejected)
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

-- 8. Append-Only RMA Audit Logs Table
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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
-- Row-Level Security (RLS) Policies
-- ==============================================================================
ALTER TABLE public.retailer_exchange_rmas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retailer_exchange_rma_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retailer_exchange_rma_boxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retailer_exchange_rma_box_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retailer_exchange_rma_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retailer_exchange_rma_inspection_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retailer_exchange_rma_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retailer_exchange_rma_audit_logs ENABLE ROW LEVEL SECURITY;

-- Admin Full Access Policies (Letusto staff & Admins)
DROP POLICY IF EXISTS "Admins have full access to exchange rmas" ON public.retailer_exchange_rmas;
CREATE POLICY "Admins have full access to exchange rmas"
  ON public.retailer_exchange_rmas
  FOR ALL
  TO authenticated
  USING (
    (auth.jwt() ->> 'email') LIKE '%@letusto.com'
    OR (auth.jwt() ->> 'email') LIKE '%@kselectnetwork.com'
  );

DROP POLICY IF EXISTS "Admins have full access to rma lines" ON public.retailer_exchange_rma_lines;
CREATE POLICY "Admins have full access to rma lines"
  ON public.retailer_exchange_rma_lines
  FOR ALL
  TO authenticated
  USING (
    (auth.jwt() ->> 'email') LIKE '%@letusto.com'
    OR (auth.jwt() ->> 'email') LIKE '%@kselectnetwork.com'
  );

DROP POLICY IF EXISTS "Admins have full access to rma boxes" ON public.retailer_exchange_rma_boxes;
CREATE POLICY "Admins have full access to rma boxes"
  ON public.retailer_exchange_rma_boxes
  FOR ALL
  TO authenticated
  USING (
    (auth.jwt() ->> 'email') LIKE '%@letusto.com'
    OR (auth.jwt() ->> 'email') LIKE '%@kselectnetwork.com'
  );

DROP POLICY IF EXISTS "Admins have full access to rma inspections" ON public.retailer_exchange_rma_inspections;
CREATE POLICY "Admins have full access to rma inspections"
  ON public.retailer_exchange_rma_inspections
  FOR ALL
  TO authenticated
  USING (
    (auth.jwt() ->> 'email') LIKE '%@letusto.com'
    OR (auth.jwt() ->> 'email') LIKE '%@kselectnetwork.com'
  );

-- Retailer Read-Only Policies (Company Users can view RMAs for their own company)
-- Note: Uses verified email lookup on company_users to protect against schema drift
DROP POLICY IF EXISTS "Retailers can read own company rmas" ON public.retailer_exchange_rmas;
CREATE POLICY "Retailers can read own company rmas"
  ON public.retailer_exchange_rmas
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM public.company_users WHERE email = (auth.jwt() ->> 'email')
    )
    OR (auth.jwt() ->> 'email') LIKE '%@letusto.com'
    OR (auth.jwt() ->> 'email') LIKE '%@kselectnetwork.com'
  );

DROP POLICY IF EXISTS "Retailers can read own company rma lines" ON public.retailer_exchange_rma_lines;
CREATE POLICY "Retailers can read own company rma lines"
  ON public.retailer_exchange_rma_lines
  FOR SELECT
  TO authenticated
  USING (
    rma_id IN (
      SELECT id FROM public.retailer_exchange_rmas WHERE company_id IN (
        SELECT company_id FROM public.company_users WHERE email = (auth.jwt() ->> 'email')
      )
    )
    OR (auth.jwt() ->> 'email') LIKE '%@letusto.com'
    OR (auth.jwt() ->> 'email') LIKE '%@kselectnetwork.com'
  );
