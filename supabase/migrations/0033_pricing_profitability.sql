-- 0033_pricing_profitability.sql — 가격 및 수익성 분석(Pricing & Profitability) 모듈 테이블 스키마 및 기본 데이터 구축

BEGIN;

-- 1. 시나리오 테이블
CREATE TABLE IF NOT EXISTS public.pricing_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. 시나리오 그룹 테이블
CREATE TABLE IF NOT EXISTS public.pricing_scenario_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. 시나리오 설정 항목 테이블
CREATE TABLE IF NOT EXISTS public.pricing_scenario_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.pricing_scenario_groups (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  applicable_channel TEXT NOT NULL DEFAULT 'both' CHECK (applicable_channel IN ('b2b', 'amazon', 'both')),
  value_type TEXT NOT NULL CHECK (value_type IN ('percentage', 'dollar_per_unit', 'fixed_total', 'actual_manual', 'calculated')),
  cost_basis TEXT CHECK (cost_basis IN ('supplier_cost', 'supplier_cost_usd', 'landed_cost', 'gross_sales', 'net_sales', 'wholesale_price', 'amazon_price', 'fba_fee', 'returned_unit', 'order_quantity')),
  profit_stage TEXT NOT NULL CHECK (profit_stage IN ('revenue_reduction', 'product_landed_cost', 'contribution_cost', 'operating_expense', 'financing_risk')),
  min_value NUMERIC,
  max_value NUMERIC,
  decimal_precision INTEGER NOT NULL DEFAULT 2,
  product_override_allowed BOOLEAN NOT NULL DEFAULT TRUE,
  is_required BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  display_order INTEGER NOT NULL DEFAULT 0,
  tooltip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. 시나리오 항목 값 테이블
CREATE TABLE IF NOT EXISTS public.pricing_scenario_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id UUID NOT NULL REFERENCES public.pricing_scenarios (id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.pricing_scenario_items (id) ON DELETE CASCADE,
  value NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (scenario_id, item_id)
);

-- 5. 계산 기록 스냅샷 테이블
CREATE TABLE IF NOT EXISTS public.pricing_calculations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('analyze_profitability', 'calculate_pricing')),
  channel TEXT NOT NULL CHECK (channel IN ('b2b', 'amazon', 'both')),
  scenario_id UUID NOT NULL REFERENCES public.pricing_scenarios (id),
  product_id UUID REFERENCES public.products (id) ON DELETE SET NULL,
  brand_id UUID REFERENCES public.brands (id) ON DELETE SET NULL,
  company_id UUID REFERENCES public.companies (id) ON DELETE SET NULL,
  target_metric TEXT,
  target_value NUMERIC,
  supplier_unit_price NUMERIC NOT NULL,
  proposed_msrp NUMERIC,
  wholesale_price NUMERIC,
  amazon_list_price NUMERIC,
  retailer_target_margin NUMERIC,
  exchange_rate NUMERIC NOT NULL DEFAULT 1300,
  fba_fee_source TEXT NOT NULL DEFAULT 'scenario_default',
  package_info JSONB DEFAULT '{}'::JSONB,
  detailed_import_info JSONB DEFAULT '{}'::JSONB,
  input_overrides JSONB DEFAULT '{}'::JSONB,
  applied_scenario_snapshot JSONB NOT NULL DEFAULT '{}'::JSONB,
  calculated_results JSONB NOT NULL DEFAULT '{}'::JSONB,
  status TEXT NOT NULL DEFAULT 'draft',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID
);

-- 6. 시나리오 변경 로그 테이블
CREATE TABLE IF NOT EXISTS public.pricing_scenario_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID REFERENCES public.pricing_scenario_items (id) ON DELETE CASCADE,
  scenario_id UUID REFERENCES public.pricing_scenarios (id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  changed_by UUID,
  change_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- [중요] 기존 테이블이 있을 시 누락되었을 수 있는 컬럼들 강제 보장 (Lock-free ALTER)
-- -----------------------------------------------------------------------------
ALTER TABLE public.pricing_scenario_values ADD COLUMN IF NOT EXISTS scenario_id UUID;
ALTER TABLE public.pricing_scenario_values ADD COLUMN IF NOT EXISTS item_id UUID;
ALTER TABLE public.pricing_scenario_values ADD COLUMN IF NOT EXISTS value NUMERIC;

-- 기존 제약 조건 보완
ALTER TABLE public.pricing_scenario_values DROP CONSTRAINT IF EXISTS pricing_scenario_values_scenario_id_item_id_key;
ALTER TABLE public.pricing_scenario_values ADD CONSTRAINT pricing_scenario_values_scenario_id_item_id_key UNIQUE (scenario_id, item_id);

-- 데이터 초기 청소 (시드 데이터 및 외래키 꼬임 방지)
DELETE FROM public.pricing_scenario_values;
DELETE FROM public.pricing_scenario_items;
DELETE FROM public.pricing_scenario_groups;
DELETE FROM public.pricing_scenarios;

-- RLS 활성화
ALTER TABLE public.pricing_scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_scenario_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_scenario_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_scenario_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_calculations ENABLE ROW LEVEL SECURITY;

-- 정책 생성 시 기존 정책 존재로 인한 에러 방지 (DROP POLICY)
DROP POLICY IF EXISTS pricing_scenarios_select ON public.pricing_scenarios;
DROP POLICY IF EXISTS pricing_scenarios_all_admin ON public.pricing_scenarios;
DROP POLICY IF EXISTS pricing_scenario_groups_select ON public.pricing_scenario_groups;
DROP POLICY IF EXISTS pricing_scenario_groups_all_admin ON public.pricing_scenario_groups;
DROP POLICY IF EXISTS pricing_scenario_items_select ON public.pricing_scenario_items;
DROP POLICY IF EXISTS pricing_scenario_items_all_admin ON public.pricing_scenario_items;
DROP POLICY IF EXISTS pricing_scenario_values_select ON public.pricing_scenario_values;
DROP POLICY IF EXISTS pricing_scenario_values_all_admin ON public.pricing_scenario_values;
DROP POLICY IF EXISTS pricing_calculations_select ON public.pricing_calculations;
DROP POLICY IF EXISTS pricing_calculations_insert ON public.pricing_calculations;
DROP POLICY IF EXISTS pricing_calculations_update ON public.pricing_calculations;
DROP POLICY IF EXISTS pricing_calculations_delete ON public.pricing_calculations;

-- 정책 재작성
CREATE POLICY pricing_scenarios_select ON public.pricing_scenarios FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY pricing_scenarios_all_admin ON public.pricing_scenarios FOR ALL TO authenticated USING (public.auth_is_admin());

CREATE POLICY pricing_scenario_groups_select ON public.pricing_scenario_groups FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY pricing_scenario_groups_all_admin ON public.pricing_scenario_groups FOR ALL TO authenticated USING (public.auth_is_admin());

CREATE POLICY pricing_scenario_items_select ON public.pricing_scenario_items FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY pricing_scenario_items_all_admin ON public.pricing_scenario_items FOR ALL TO authenticated USING (public.auth_is_admin());

CREATE POLICY pricing_scenario_values_select ON public.pricing_scenario_values FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY pricing_scenario_values_all_admin ON public.pricing_scenario_values FOR ALL TO authenticated USING (public.auth_is_admin());

CREATE POLICY pricing_calculations_select ON public.pricing_calculations FOR SELECT TO authenticated 
  USING (company_id = public.auth_company_id() OR public.auth_is_admin());
CREATE POLICY pricing_calculations_insert ON public.pricing_calculations FOR INSERT TO authenticated 
  WITH CHECK (company_id = public.auth_company_id() OR public.auth_is_admin());
CREATE POLICY pricing_calculations_update ON public.pricing_calculations FOR UPDATE TO authenticated 
  USING (company_id = public.auth_company_id() OR public.auth_is_admin());
CREATE POLICY pricing_calculations_delete ON public.pricing_calculations FOR DELETE TO authenticated 
  USING (company_id = public.auth_company_id() OR public.auth_is_admin());

-- -----------------------------------------------------------------------------
-- 초기 데이터 시드 삽입
-- -----------------------------------------------------------------------------

-- 시나리오 생성
INSERT INTO public.pricing_scenarios (id, name, code, description)
VALUES 
  ('a82d77d7-fca8-47fb-ba0d-7b242b36a100', 'Conservative', 'conservative', '보수적 시나리오: 높은 수입/물류비, 높은 광고비 및 광고비 효율 저하 가정'),
  ('a82d77d7-fca8-47fb-ba0d-7b242b36a101', 'Expected', 'expected', '표준 시나리오: 현재 사업계획 및 평균적 운영 효율 반영'),
  ('a82d77d7-fca8-47fb-ba0d-7b242b36a102', 'Optimistic', 'optimistic', '낙관적 시나리오: 주문 단위 증가에 따른 물류 단가 절감 및 마케팅 효율 상승 가정');

-- 설정 그룹 생성
INSERT INTO public.pricing_scenario_groups (id, name, code, display_order)
VALUES
  ('f0000000-0000-0000-0000-000000000001', 'Profit Targets', 'profit_targets', 1),
  ('f0000000-0000-0000-0000-000000000002', 'Revenue Reductions', 'revenue_reductions', 2),
  ('f0000000-0000-0000-0000-000000000003', 'Product & Import Cost', 'product_import_cost', 3),
  ('f0000000-0000-0000-0000-000000000004', 'Marketing & Sales', 'marketing_sales', 4),
  ('f0000000-0000-0000-0000-000000000005', 'Fulfillment & Channel Costs', 'fulfillment_channel', 5),
  ('f0000000-0000-0000-0000-000000000006', 'Labor', 'labor', 6),
  ('f0000000-0000-0000-0000-000000000007', 'Administrative & Overhead', 'overhead', 7),
  ('f0000000-0000-0000-0000-000000000008', 'Financing & Risk', 'financing_risk', 8);

-- 설정 항목 생성
INSERT INTO public.pricing_scenario_items (id, group_id, name, code, applicable_channel, value_type, cost_basis, profit_stage, display_order)
VALUES
  ('e0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'Target Gross Margin', 'target_gross_margin', 'both', 'percentage', 'net_sales', 'revenue_reduction', 1),
  ('e0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000001', 'Target Contribution Margin', 'target_contribution_margin', 'both', 'percentage', 'net_sales', 'contribution_cost', 2),
  ('e0000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000001', 'Target Net Margin', 'target_net_margin', 'both', 'percentage', 'net_sales', 'financing_risk', 3),
  ('e0000000-0000-0000-0000-000000000004', 'f0000000-0000-0000-0000-000000000001', 'Minimum Net Profit per Unit', 'min_net_profit_per_unit', 'both', 'dollar_per_unit', NULL, 'financing_risk', 4),
  ('e0000000-0000-0000-0000-000000000005', 'f0000000-0000-0000-0000-000000000002', 'General Discount Rate', 'general_discount_rate', 'both', 'percentage', 'gross_sales', 'revenue_reduction', 1),
  ('e0000000-0000-0000-0000-000000000006', 'f0000000-0000-0000-0000-000000000002', 'Coupon / Promotion Rate', 'coupon_promotion_rate', 'both', 'percentage', 'gross_sales', 'revenue_reduction', 2),
  ('e0000000-0000-0000-0000-000000000007', 'f0000000-0000-0000-0000-000000000002', 'Sales Return Rate', 'sales_return_rate', 'both', 'percentage', 'gross_sales', 'revenue_reduction', 3),
  ('e0000000-0000-0000-0000-000000000008', 'f0000000-0000-0000-0000-000000000003', 'General Import Cost Rate', 'general_import_cost_rate', 'both', 'percentage', 'supplier_cost_usd', 'product_landed_cost', 1),
  ('e0000000-0000-0000-0000-000000000009', 'f0000000-0000-0000-0000-000000000003', 'Damage and Shrinkage Rate', 'damage_shrinkage_rate', 'both', 'percentage', 'landed_cost', 'product_landed_cost', 2),
  ('e0000000-0000-0000-0000-000000000010', 'f0000000-0000-0000-0000-000000000004', 'B2B Marketing Rate', 'b2b_marketing_rate', 'b2b', 'percentage', 'net_sales', 'contribution_cost', 1),
  ('e0000000-0000-0000-0000-000000000011', 'f0000000-0000-0000-0000-000000000004', 'Amazon Advertising Rate', 'amazon_advertising_rate', 'amazon', 'percentage', 'net_sales', 'contribution_cost', 2),
  ('e0000000-0000-0000-0000-000000000012', 'f0000000-0000-0000-0000-000000000004', 'Sales Commission Rate', 'sales_commission_rate', 'both', 'percentage', 'net_sales', 'contribution_cost', 3),
  ('e0000000-0000-0000-0000-000000000013', 'f0000000-0000-0000-0000-000000000005', 'Amazon Referral Fee Rate', 'amazon_referral_fee_rate', 'amazon', 'percentage', 'gross_sales', 'contribution_cost', 1),
  ('e0000000-0000-0000-0000-000000000014', 'f0000000-0000-0000-0000-000000000005', 'B2B Payment Processing Fee Rate', 'b2b_payment_fee_rate', 'b2b', 'percentage', 'gross_sales', 'contribution_cost', 2),
  ('e0000000-0000-0000-0000-000000000015', 'f0000000-0000-0000-0000-000000000005', 'Store Delivery Cost Rate', 'store_delivery_cost_rate', 'b2b', 'percentage', 'gross_sales', 'contribution_cost', 3),
  ('e0000000-0000-0000-0000-000000000016', 'f0000000-0000-0000-0000-000000000005', 'FBA Fulfillment Fee Default', 'fba_fulfillment_fee_default', 'amazon', 'dollar_per_unit', NULL, 'contribution_cost', 4),
  ('e0000000-0000-0000-0000-000000000017', 'f0000000-0000-0000-0000-000000000006', 'Variable Labor Rate', 'variable_labor_rate', 'both', 'percentage', 'net_sales', 'contribution_cost', 1),
  ('e0000000-0000-0000-0000-000000000018', 'f0000000-0000-0000-0000-000000000006', 'Payroll Allocation Rate', 'payroll_allocation_rate', 'both', 'percentage', 'net_sales', 'operating_expense', 2),
  ('e0000000-0000-0000-0000-000000000019', 'f0000000-0000-0000-0000-000000000007', 'General Overhead Rate', 'general_overhead_rate', 'both', 'percentage', 'net_sales', 'operating_expense', 1),
  ('e0000000-0000-0000-0000-000000000020', 'f0000000-0000-0000-0000-000000000008', 'Inventory Financing Rate', 'inventory_financing_rate', 'both', 'percentage', 'landed_cost', 'financing_risk', 1),
  ('e0000000-0000-0000-0000-000000000021', 'f0000000-0000-0000-0000-000000000008', 'Currency Risk Allowance Rate', 'currency_risk_rate', 'both', 'percentage', 'supplier_cost_usd', 'financing_risk', 2);

-- 시나리오별 값 매핑 시드 적재
INSERT INTO public.pricing_scenario_values (scenario_id, item_id, value) VALUES
  -- Profit Targets
  ('a82d77d7-fca8-47fb-ba0d-7b242b36a100', 'e0000000-0000-0000-0000-000000000001', 30.00),
  ('a82d77d7-fca8-47fb-ba0d-7b242b36a101', 'e0000000-0000-0000-0000-000000000001', 40.00),
  ('a82d77d7-fca8-47fb-ba0d-7b242b36a102', 'e0000000-0000-0000-0000-000000000001', 50.00),
  
  ('a82d77d7-fca8-47fb-ba0d-7b242b36a100', 'e0000000-0000-0000-0000-000000000002', 20.00),
  ('a82d77d7-fca8-47fb-ba0d-7b242b36a101', 'e0000000-0000-0000-0000-000000000002', 30.00),
  ('a82d77d7-fca8-47fb-ba0d-7b242b36a102', 'e0000000-0000-0000-0000-000000000002', 40.00),
  
  ('a82d77d7-fca8-47fb-ba0d-7b242b36a100', 'e0000000-0000-0000-0000-000000000003', 5.00),
  ('a82d77d7-fca8-47fb-ba0d-7b242b36a101', 'e0000000-0000-0000-0000-000000000003', 15.00),
  ('a82d77d7-fca8-47fb-ba0d-7b242b36a102', 'e0000000-0000-0000-0000-000000000003', 25.00),
  
  ('a82d77d7-fca8-47fb-ba0d-7b242b36a100', 'e0000000-0000-0000-0000-000000000004', 1.00),
  ('a82d77d7-fca8-47fb-ba0d-7b242b36a101', 'e0000000-0000-0000-0000-000000000004', 2.00),
  ('a82d77d7-fca8-47fb-ba0d-7b242b36a102', 'e0000000-0000-0000-0000-000000000004', 4.00),

  -- Revenue Reductions
  ('a82d77d7-fca8-47fb-ba0d-7b242b36a100', 'e0000000-0000-0000-0000-000000000005', 5.00),
  ('a82d77d7-fca8-47fb-ba0d-7b242b36a101', 'e0000000-0000-0000-0000-000000000005', 2.00),
  ('a82d77d7-fca8-47fb-ba0d-7b242b36a102', 'e0000000-0000-0000-0000-000000000005', 0.00),
  
  ('a82d77d7-fca8-47fb-ba0d-7b242b36a100', 'e0000000-0000-0000-0000-000000000006', 8.00),
  ('a82d77d7-fca8-47fb-ba0d-7b242b36a101', 'e0000000-0000-0000-0000-000000000006', 3.00),
  ('a82d77d7-fca8-47fb-ba0d-7b242b36a102', 'e0000000-0000-0000-0000-000000000006', 1.00),
  
  ('a82d77d7-fca8-47fb-ba0d-7b242b36a100', 'e0000000-0000-0000-0000-000000000007', 3.00),
  ('a82d77d7-fca8-47fb-ba0d-7b242b36a101', 'e0000000-0000-0000-0000-000000000007', 1.50),
  ('a82d77d7-fca8-47fb-ba0d-7b242b36a102', 'e0000000-0000-0000-0000-000000000007', 0.50),

  -- Product & Import Cost
  ('a82d77d7-fca8-47fb-ba0d-7b242b36a100', 'e0000000-0000-0000-0000-000000000008', 25.00),
  ('a82d77d7-fca8-47fb-ba0d-7b242b36a101', 'e0000000-0000-0000-0000-000000000008', 15.00),
  ('a82d77d7-fca8-47fb-ba0d-7b242b36a102', 'e0000000-0000-0000-0000-000000000008', 10.00),
  
  ('a82d77d7-fca8-47fb-ba0d-7b242b36a100', 'e0000000-0000-0000-0000-000000000009', 2.00),
  ('a82d77d7-fca8-47fb-ba0d-7b242b36a101', 'e0000000-0000-0000-0000-000000000009', 1.00),
  ('a82d77d7-fca8-47fb-ba0d-7b242b36a102', 'e0000000-0000-0000-0000-000000000009', 0.50),

  -- Marketing & Sales
  ('a82d77d7-fca8-47fb-ba0d-7b242b36a100', 'e0000000-0000-0000-0000-000000000010', 10.00),
  ('a82d77d7-fca8-47fb-ba0d-7b242b36a101', 'e0000000-0000-0000-0000-000000000010', 5.00),
  ('a82d77d7-fca8-47fb-ba0d-7b242b36a102', 'e0000000-0000-0000-0000-000000000010', 2.00),
  
  ('a82d77d7-fca8-47fb-ba0d-7b242b36a100', 'e0000000-0000-0000-0000-000000000011', 25.00),
  ('a82d77d7-fca8-47fb-ba0d-7b242b36a101', 'e0000000-0000-0000-0000-000000000011', 15.00),
  ('a82d77d7-fca8-47fb-ba0d-7b242b36a102', 'e0000000-0000-0000-0000-000000000011', 10.00),
  
  ('a82d77d7-fca8-47fb-ba0d-7b242b36a100', 'e0000000-0000-0000-0000-000000000012', 5.00),
  ('a82d77d7-fca8-47fb-ba0d-7b242b36a101', 'e0000000-0000-0000-0000-000000000012', 3.00),
  ('a82d77d7-fca8-47fb-ba0d-7b242b36a102', 'e0000000-0000-0000-0000-000000000012', 1.50),

  -- Fulfillment & Channel Costs
  ('a82d77d7-fca8-47fb-ba0d-7b242b36a100', 'e0000000-0000-0000-0000-000000000013', 15.00),
  ('a82d77d7-fca8-47fb-ba0d-7b242b36a101', 'e0000000-0000-0000-0000-000000000013', 15.00),
  ('a82d77d7-fca8-47fb-ba0d-7b242b36a102', 'e0000000-0000-0000-0000-000000000013', 15.00),
  
  ('a82d77d7-fca8-47fb-ba0d-7b242b36a100', 'e0000000-0000-0000-0000-000000000014', 3.00),
  ('a82d77d7-fca8-47fb-ba0d-7b242b36a101', 'e0000000-0000-0000-0000-000000000014', 2.50),
  ('a82d77d7-fca8-47fb-ba0d-7b242b36a102', 'e0000000-0000-0000-0000-000000000014', 2.00),
  
  ('a82d77d7-fca8-47fb-ba0d-7b242b36a100', 'e0000000-0000-0000-0000-000000000015', 5.00),
  ('a82d77d7-fca8-47fb-ba0d-7b242b36a101', 'e0000000-0000-0000-0000-000000000015', 3.00),
  ('a82d77d7-fca8-47fb-ba0d-7b242b36a102', 'e0000000-0000-0000-0000-000000000015', 1.00),
  
  ('a82d77d7-fca8-47fb-ba0d-7b242b36a100', 'e0000000-0000-0000-0000-000000000016', 6.50),
  ('a82d77d7-fca8-47fb-ba0d-7b242b36a101', 'e0000000-0000-0000-0000-000000000016', 5.20),
  ('a82d77d7-fca8-47fb-ba0d-7b242b36a102', 'e0000000-0000-0000-0000-000000000016', 4.50),

  -- Labor
  ('a82d77d7-fca8-47fb-ba0d-7b242b36a100', 'e0000000-0000-0000-0000-000000000017', 5.00),
  ('a82d77d7-fca8-47fb-ba0d-7b242b36a101', 'e0000000-0000-0000-0000-000000000017', 3.00),
  ('a82d77d7-fca8-47fb-ba0d-7b242b36a102', 'e0000000-0000-0000-0000-000000000017', 1.00),
  
  ('a82d77d7-fca8-47fb-ba0d-7b242b36a100', 'e0000000-0000-0000-0000-000000000018', 12.00),
  ('a82d77d7-fca8-47fb-ba0d-7b242b36a101', 'e0000000-0000-0000-0000-000000000018', 8.00),
  ('a82d77d7-fca8-47fb-ba0d-7b242b36a102', 'e0000000-0000-0000-0000-000000000018', 5.00),

  -- Administrative & Overhead
  ('a82d77d7-fca8-47fb-ba0d-7b242b36a100', 'e0000000-0000-0000-0000-000000000019', 15.00),
  ('a82d77d7-fca8-47fb-ba0d-7b242b36a101', 'e0000000-0000-0000-0000-000000000019', 10.00),
  ('a82d77d7-fca8-47fb-ba0d-7b242b36a102', 'e0000000-0000-0000-0000-000000000019', 6.00),

  -- Financing & Risk
  ('a82d77d7-fca8-47fb-ba0d-7b242b36a100', 'e0000000-0000-0000-0000-000000000020', 4.00),
  ('a82d77d7-fca8-47fb-ba0d-7b242b36a101', 'e0000000-0000-0000-0000-000000000020', 2.00),
  ('a82d77d7-fca8-47fb-ba0d-7b242b36a102', 'e0000000-0000-0000-0000-000000000020', 1.00),
  
  ('a82d77d7-fca8-47fb-ba0d-7b242b36a100', 'e0000000-0000-0000-0000-000000000021', 3.00),
  ('a82d77d7-fca8-47fb-ba0d-7b242b36a101', 'e0000000-0000-0000-0000-000000000021', 1.00),
  ('a82d77d7-fca8-47fb-ba0d-7b242b36a102', 'e0000000-0000-0000-0000-000000000021', 0.00)
ON CONFLICT (scenario_id, item_id) DO UPDATE SET value = EXCLUDED.value;

COMMIT;
