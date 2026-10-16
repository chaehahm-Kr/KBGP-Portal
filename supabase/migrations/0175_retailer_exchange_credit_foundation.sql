-- ==============================================================================
-- Migration 0175: Retailer 90-Day Exchange Credit Program Foundation
-- Task ID: EXCHANGE-CREDIT-PH1-003
-- Target Project: shzfrppdobpmrstcjfqu (K SELECT Production)
-- Status: PREPARED FILE ONLY — REQUIRES OWNER MANUAL EXECUTION
--
-- Description:
-- 1. Create retailer_exchange_program_enrollments (Company Program Participation)
-- 2. Create retailer_exchange_program_audit_logs (Immutable Policy & Enrollment Audit)
-- 3. Create retailer_protected_supply_cohorts (Store + SKU Lifetime Protection Master)
-- 4. Create retailer_protected_supply_shipments (Authorized Split Shipment Tracking)
-- 5. Create atomic sequence & generator function for cohort codes (PSC-YYYY-XXXXXX)
-- 6. Configure strict tenant-isolated Row Level Security (RLS) policies
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Atomic Sequence for Protected Supply Cohort Codes
-- ------------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.retailer_protected_cohort_seq START 1;

CREATE OR REPLACE FUNCTION public.generate_protected_cohort_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_year TEXT;
  next_val BIGINT;
BEGIN
  current_year := to_char(now(), 'YYYY');
  next_val := nextval('public.retailer_protected_cohort_seq');
  RETURN 'PSC-' || current_year || '-' || LPAD(next_val::TEXT, 6, '0');
END;
$$;

-- ------------------------------------------------------------------------------
-- 2. TABLE: public.retailer_exchange_program_enrollments
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.retailer_exchange_program_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'terminated')),
  
  -- Policy parameters (immutable baseline for future cohorts)
  option_a_credit_rate NUMERIC(5, 4) NOT NULL DEFAULT 0.4000
    CHECK (option_a_credit_rate BETWEEN 0.2000 AND 0.5000),
  option_b_credit_rate NUMERIC(5, 4) NOT NULL DEFAULT 0.2000
    CHECK (option_b_credit_rate BETWEEN 0.1000 AND 0.3500),
  min_inventory_reporting_weeks INTEGER NOT NULL DEFAULT 8
    CHECK (min_inventory_reporting_weeks BETWEEN 4 AND 12),
  trial_period_days INTEGER NOT NULL DEFAULT 90
    CHECK (trial_period_days BETWEEN 30 AND 180),
  evaluation_day INTEGER NOT NULL DEFAULT 100
    CHECK (evaluation_day > trial_period_days),
  claim_window_days INTEGER NOT NULL DEFAULT 50
    CHECK (claim_window_days BETWEEN 10 AND 90),
  
  -- Attribution & Audit
  enrolled_by UUID NOT NULL REFERENCES public.staff_members(id) ON DELETE RESTRICT,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  paused_at TIMESTAMPTZ,
  paused_by UUID REFERENCES public.staff_members(id) ON DELETE SET NULL,
  pause_reason TEXT,
  notes TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT uq_retailer_exchange_company UNIQUE (company_id)
);

CREATE INDEX IF NOT EXISTS idx_exchange_enrollments_company 
  ON public.retailer_exchange_program_enrollments(company_id);
CREATE INDEX IF NOT EXISTS idx_exchange_enrollments_status 
  ON public.retailer_exchange_program_enrollments(status);

COMMENT ON TABLE public.retailer_exchange_program_enrollments IS '소매점 기업의 90일 교환 크레딧 프로그램 가입 마스터 및 기본 환급률 정책';

-- ------------------------------------------------------------------------------
-- 3. TABLE: public.retailer_exchange_program_audit_logs
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.retailer_exchange_program_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES public.retailer_exchange_program_enrollments(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  action VARCHAR(30) NOT NULL 
    CHECK (action IN ('enroll', 'update_policy', 'pause', 'resume', 'terminate')),
  changed_by UUID NOT NULL REFERENCES public.staff_members(id) ON DELETE RESTRICT,
  old_values JSONB,
  new_values JSONB NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_exchange_audit_enrollment 
  ON public.retailer_exchange_program_audit_logs(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_exchange_audit_company 
  ON public.retailer_exchange_program_audit_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_exchange_audit_created_at 
  ON public.retailer_exchange_program_audit_logs(created_at DESC);

COMMENT ON TABLE public.retailer_exchange_program_audit_logs IS '소매점 교환 크레딧 가입 상태 및 정책 변경 불변 감사 이력';

-- ------------------------------------------------------------------------------
-- 4. TABLE: public.retailer_protected_supply_cohorts
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.retailer_protected_supply_cohorts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_code VARCHAR(50) NOT NULL UNIQUE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  enrollment_id UUID NOT NULL REFERENCES public.retailer_exchange_program_enrollments(id) ON DELETE RESTRICT,
  source_order_id UUID NOT NULL REFERENCES public.retailer_orders(id) ON DELETE RESTRICT,
  source_order_item_id UUID NOT NULL REFERENCES public.retailer_order_items(id) ON DELETE RESTRICT,
  
  -- Frozen Baseline Metrics (발주 체결 당시 수치 영구 박제)
  total_protected_quantity INTEGER NOT NULL CHECK (total_protected_quantity > 0),
  fulfilled_protected_quantity INTEGER NOT NULL DEFAULT 0 CHECK (fulfilled_protected_quantity >= 0),
  frozen_unit_wholesale_price NUMERIC(12, 2) NOT NULL CHECK (frozen_unit_wholesale_price >= 0),
  frozen_option_a_rate NUMERIC(5, 4) NOT NULL CHECK (frozen_option_a_rate BETWEEN 0.2000 AND 0.5000),
  frozen_option_b_rate NUMERIC(5, 4) NOT NULL DEFAULT 0.2000,
  frozen_min_reporting_weeks INTEGER NOT NULL DEFAULT 8,
  
  -- Status Lifecycle
  status VARCHAR(35) NOT NULL DEFAULT 'registered'
    CHECK (status IN (
      'registered',
      'partially_fulfilled',
      'active_protection',
      'evaluation_ready',
      'claim_window_open',
      'claim_submitted',
      'claim_resolved',
      'disqualified_reordered',
      'disqualified_insufficient_checks',
      'expired_unclaimed',
      'cancelled'
    )),
  
  -- Key Dates (Timezone: America/New_York 기준 Date)
  first_shipment_date DATE,
  first_delivery_date DATE,
  protection_start_date DATE,
  trial_end_date DATE,
  evaluation_date DATE,
  claim_deadline_date DATE,
  
  -- Disqualification Audit
  disqualification_reason TEXT,
  disqualified_at TIMESTAMPTZ,
  disqualified_by_order_id UUID REFERENCES public.retailer_orders(id) ON DELETE SET NULL,
  
  -- Attribution
  created_by UUID NOT NULL REFERENCES public.staff_members(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Store + SKU Lifetime One-Time Enforcement (동일 매장+동일 상품은 평생 1회만 보호)
  CONSTRAINT uq_store_product_lifetime_cohort UNIQUE (store_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_protected_cohorts_store 
  ON public.retailer_protected_supply_cohorts(store_id);
CREATE INDEX IF NOT EXISTS idx_protected_cohorts_company 
  ON public.retailer_protected_supply_cohorts(company_id);
CREATE INDEX IF NOT EXISTS idx_protected_cohorts_product 
  ON public.retailer_protected_supply_cohorts(product_id);
CREATE INDEX IF NOT EXISTS idx_protected_cohorts_status 
  ON public.retailer_protected_supply_cohorts(status);
CREATE INDEX IF NOT EXISTS idx_protected_cohorts_eval_date 
  ON public.retailer_protected_supply_cohorts(evaluation_date) 
  WHERE status IN ('active_protection', 'partially_fulfilled');

COMMENT ON TABLE public.retailer_protected_supply_cohorts IS '매장(Store) 및 상품(SKU) 단위의 90일 교환 보증 초기 공급 물량 코호트 마스터';

-- ------------------------------------------------------------------------------
-- 5. TABLE: public.retailer_protected_supply_shipments
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.retailer_protected_supply_shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id UUID NOT NULL REFERENCES public.retailer_protected_supply_cohorts(id) ON DELETE CASCADE,
  fulfillment_id UUID NOT NULL REFERENCES public.retailer_order_fulfillments(id) ON DELETE RESTRICT,
  fulfillment_item_id UUID REFERENCES public.retailer_order_fulfillment_items(id) ON DELETE RESTRICT,
  shipment_sequence INTEGER NOT NULL DEFAULT 1 CHECK (shipment_sequence >= 1),
  quantity_shipped INTEGER NOT NULL CHECK (quantity_shipped > 0),
  quantity_delivered INTEGER NOT NULL DEFAULT 0 CHECK (quantity_delivered >= 0),
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  tracking_number VARCHAR(100),
  carrier VARCHAR(50),
  is_first_shipment BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT uq_cohort_fulfillment UNIQUE (cohort_id, fulfillment_id)
);

CREATE INDEX IF NOT EXISTS idx_cohort_shipments_cohort_id 
  ON public.retailer_protected_supply_shipments(cohort_id);
CREATE INDEX IF NOT EXISTS idx_cohort_shipments_fulfillment_id 
  ON public.retailer_protected_supply_shipments(fulfillment_id);

COMMENT ON TABLE public.retailer_protected_supply_shipments IS '코호트에 귀속된 승인된 최초 및 분할 배송(Split Shipments) 실적 추적';

-- ------------------------------------------------------------------------------
-- 6. Row Level Security (RLS) Configuration
-- ------------------------------------------------------------------------------
ALTER TABLE public.retailer_exchange_program_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retailer_exchange_program_enrollments FORCE ROW LEVEL SECURITY;

ALTER TABLE public.retailer_exchange_program_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retailer_exchange_program_audit_logs FORCE ROW LEVEL SECURITY;

ALTER TABLE public.retailer_protected_supply_cohorts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retailer_protected_supply_cohorts FORCE ROW LEVEL SECURITY;

ALTER TABLE public.retailer_protected_supply_shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retailer_protected_supply_shipments FORCE ROW LEVEL SECURITY;

-- 6.1 Policies for enrollments
CREATE POLICY "exchange_enrollments_admin_all"
  ON public.retailer_exchange_program_enrollments FOR ALL
  TO authenticated
  USING (public.auth_is_admin());

CREATE POLICY "exchange_enrollments_retailer_select"
  ON public.retailer_exchange_program_enrollments FOR SELECT
  TO authenticated
  USING (company_id = public.auth_company_id());

-- 6.2 Policies for audit logs
CREATE POLICY "exchange_audit_admin_all"
  ON public.retailer_exchange_program_audit_logs FOR ALL
  TO authenticated
  USING (public.auth_is_admin());

-- 6.3 Policies for cohorts
CREATE POLICY "protected_cohorts_admin_all"
  ON public.retailer_protected_supply_cohorts FOR ALL
  TO authenticated
  USING (public.auth_is_admin());

CREATE POLICY "protected_cohorts_retailer_select"
  ON public.retailer_protected_supply_cohorts FOR SELECT
  TO authenticated
  USING (company_id = public.auth_company_id());

-- 6.4 Policies for shipments
CREATE POLICY "protected_shipments_admin_all"
  ON public.retailer_protected_supply_shipments FOR ALL
  TO authenticated
  USING (public.auth_is_admin());

CREATE POLICY "protected_shipments_retailer_select"
  ON public.retailer_protected_supply_shipments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.retailer_protected_supply_cohorts c
      WHERE c.id = cohort_id AND c.company_id = public.auth_company_id()
    )
  );
