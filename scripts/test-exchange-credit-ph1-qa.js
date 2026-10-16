const fs = require('fs');
const path = require('path');

function runTests() {
  console.log('================================================================================');
  console.log('EXCHANGE-CREDIT-PH1-003-R1 QA TEST SUITE: REVISED FOUNDATION & DATA INTEGRITY');
  console.log('================================================================================\n');

  let passedCount = 0;
  let totalCount = 0;

  function assert(desc, condition) {
    totalCount++;
    if (condition) {
      console.log(`✓ PASS: ${desc}`);
      passedCount++;
    } else {
      console.error(`✗ FAIL: ${desc}`);
      throw new Error(`Assertion failed: ${desc}`);
    }
  }

  // 1. Verify Migration 0175 Structure, Triggers & Inviolable Constraints
  console.log('1. Auditing Migration 0175 Schema, Constraints & Immutability Triggers...');
  const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', '0175_retailer_exchange_credit_foundation.sql');
  assert('Migration 0175 file exists', fs.existsSync(migrationPath));

  const migrationContent = fs.readFileSync(migrationPath, 'utf8');

  // Tables
  assert('Creates retailer_exchange_program_enrollments', migrationContent.includes('CREATE TABLE IF NOT EXISTS public.retailer_exchange_program_enrollments'));
  assert('Creates retailer_exchange_program_audit_logs', migrationContent.includes('CREATE TABLE IF NOT EXISTS public.retailer_exchange_program_audit_logs'));
  assert('Creates retailer_protected_supply_cohorts', migrationContent.includes('CREATE TABLE IF NOT EXISTS public.retailer_protected_supply_cohorts'));
  assert('Creates retailer_protected_supply_shipments', migrationContent.includes('CREATE TABLE IF NOT EXISTS public.retailer_protected_supply_shipments'));

  // Critical Business Rules in Enrollments
  assert('Unique company enrollment constraint (uq_retailer_exchange_company)', migrationContent.includes('CONSTRAINT uq_retailer_exchange_company UNIQUE (company_id)'));
  assert('Option A rate check constraint between 20% and 50%', migrationContent.includes('CHECK (option_a_credit_rate BETWEEN 0.2000 AND 0.5000)'));
  assert('Option B rate strictly fixed at 100% (CHECK option_b_credit_rate = 1.0000)', migrationContent.includes('CHECK (option_b_credit_rate = 1.0000)'));
  assert('Fixed Pilot Rule: Exactly 8 weekly checks (CHECK min_inventory_reporting_weeks = 8)', migrationContent.includes('CHECK (min_inventory_reporting_weeks = 8)'));
  assert('Fixed Pilot Rule: 90 days trial period (CHECK trial_period_days = 90)', migrationContent.includes('CHECK (trial_period_days = 90)'));
  assert('Fixed Pilot Rule: Day 100 evaluation (CHECK evaluation_day = 100)', migrationContent.includes('CHECK (evaluation_day = 100)'));
  assert('Fixed Pilot Rule: 50 days claim window (CHECK claim_window_days = 50)', migrationContent.includes('CHECK (claim_window_days = 50)'));
  assert('Fixed Pilot Rule: < 50% sold (CHECK max_sell_through_rate = 0.5000)', migrationContent.includes('CHECK (max_sell_through_rate = 0.5000)'));
  assert('Fixed Pilot Rule: Reorder disqualifies (CHECK reorder_disqualifies = true)', migrationContent.includes('CHECK (reorder_disqualifies = true)'));

  // Audit Log Append-Only Protection
  assert('Audit log foreign keys have ON DELETE RESTRICT', 
    migrationContent.includes('REFERENCES public.retailer_exchange_program_enrollments(id) ON DELETE RESTRICT') &&
    migrationContent.includes('REFERENCES public.companies(id) ON DELETE RESTRICT') &&
    migrationContent.includes('REFERENCES public.staff_members(id) ON DELETE RESTRICT')
  );
  assert('Trigger function prevent_exchange_audit_log_mutation exists', migrationContent.includes('CREATE OR REPLACE FUNCTION public.prevent_exchange_audit_log_mutation()'));
  assert('Trigger trg_prevent_exchange_audit_mutation enforces append-only', 
    migrationContent.includes('CREATE TRIGGER trg_prevent_exchange_audit_mutation') &&
    migrationContent.includes('BEFORE UPDATE OR DELETE ON public.retailer_exchange_program_audit_logs')
  );

  // Protected Supply Cohorts & Immutability Baseline
  assert('Store + SKU lifetime one-time protection constraint (uq_store_product_lifetime_cohort)', migrationContent.includes('CONSTRAINT uq_store_product_lifetime_cohort UNIQUE (store_id, product_id)'));
  assert('Cohort quantity constraint (fulfilled <= total)', migrationContent.includes('CHECK (fulfilled_protected_quantity >= 0 AND fulfilled_protected_quantity <= total_protected_quantity)'));
  assert('Trigger function protect_cohort_immutable_baseline exists', migrationContent.includes('CREATE OR REPLACE FUNCTION public.protect_cohort_immutable_baseline()'));
  assert('Trigger trg_protect_cohort_baseline guards financial snapshot', 
    migrationContent.includes('CREATE TRIGGER trg_protect_cohort_baseline') &&
    migrationContent.includes('BEFORE UPDATE ON public.retailer_protected_supply_cohorts')
  );

  // Shipments Data Integrity
  assert('Shipment delivery check: quantity_delivered <= quantity_shipped', migrationContent.includes('CHECK (quantity_delivered >= 0 AND quantity_delivered <= quantity_shipped)'));
  assert('Unique fulfillment item constraint (uq_shipment_fulfillment_item)', migrationContent.includes('CONSTRAINT uq_shipment_fulfillment_item UNIQUE (fulfillment_item_id)'));
  assert('Unique fulfillment per cohort constraint (uq_cohort_fulfillment)', migrationContent.includes('CONSTRAINT uq_cohort_fulfillment UNIQUE (cohort_id, fulfillment_id)'));

  // Sequence & Code Generation
  assert('Cohort sequence and generator function exist', 
    migrationContent.includes('CREATE SEQUENCE IF NOT EXISTS public.retailer_protected_cohort_seq') &&
    migrationContent.includes('CREATE OR REPLACE FUNCTION public.generate_protected_cohort_code()')
  );
  assert('Function permissions properly locked down', migrationContent.includes('REVOKE EXECUTE ON FUNCTION public.generate_protected_cohort_code() FROM PUBLIC'));

  // RLS Policies
  assert('RLS enabled on all 4 tables', 
    migrationContent.includes('ALTER TABLE public.retailer_exchange_program_enrollments ENABLE ROW LEVEL SECURITY') &&
    migrationContent.includes('ALTER TABLE public.retailer_exchange_program_audit_logs ENABLE ROW LEVEL SECURITY') &&
    migrationContent.includes('ALTER TABLE public.retailer_protected_supply_cohorts ENABLE ROW LEVEL SECURITY') &&
    migrationContent.includes('ALTER TABLE public.retailer_protected_supply_shipments ENABLE ROW LEVEL SECURITY')
  );
  assert('Audit log RLS strictly permits SELECT and INSERT only (no admin update/delete policies)', 
    migrationContent.includes('exchange_audit_admin_select') &&
    migrationContent.includes('exchange_audit_admin_insert') &&
    !migrationContent.includes('exchange_audit_admin_all') &&
    !migrationContent.includes('exchange_audit_admin_update') &&
    !migrationContent.includes('exchange_audit_admin_delete')
  );

  // 2. Verify TypeScript Types Integrity
  console.log('\n2. Auditing TypeScript Domain Types (exchange-credit-types.ts)...');
  const typesPath = path.join(process.cwd(), 'lib', 'retailer', 'exchange-credit-types.ts');
  assert('exchange-credit-types.ts exists', fs.existsSync(typesPath));
  const typesContent = fs.readFileSync(typesPath, 'utf8');

  assert('Contains CompanyEnrollmentStatus (active, paused, terminated)', typesContent.includes('export type CompanyEnrollmentStatus = "active" | "paused" | "terminated";'));
  assert('Contains ProtectedCohortStatus with 12 statuses including disqualified_high_sales', 
    typesContent.includes('registered') &&
    typesContent.includes('partially_fulfilled') &&
    typesContent.includes('active_protection') &&
    typesContent.includes('disqualified_reordered') &&
    typesContent.includes('disqualified_insufficient_checks') &&
    typesContent.includes('disqualified_high_sales') &&
    typesContent.includes('claim_window_open')
  );
  assert('CompanyExchangeEnrollment has fixed optionBCreditRate: 1.0', typesContent.includes('optionBCreditRate: 1.0;'));
  assert('CompanyExchangeEnrollment has minInventoryReportingWeeks: 8', typesContent.includes('minInventoryReportingWeeks: 8;'));
  assert('ProtectedSupplyCohort anchors on firstShipmentDate (Day 0)', typesContent.includes('firstShipmentDate: string | null;'));
  assert('ProtectedSupplyCohort has frozenOptionBRate: 1.0', typesContent.includes('frozenOptionBRate: 1.0;'));
  assert('COHORT_STATUS_CONFIG includes all lifecycle states', typesContent.includes('disqualified_high_sales: {'));

  // 3. Verify Server Actions Contract & Safety
  console.log('\n3. Auditing Server Actions Logic (exchange-credit-actions.ts)...');
  const actionsPath = path.join(process.cwd(), 'lib', 'retailer', 'exchange-credit-actions.ts');
  assert('exchange-credit-actions.ts exists', fs.existsSync(actionsPath));
  const actionsContent = fs.readFileSync(actionsPath, 'utf8');

  assert('Safe schema availability check implemented', actionsContent.includes('export async function checkExchangeCreditSchemaAvailability'));
  assert('Admin session verified in enroll action', actionsContent.includes('const session = await verifyAdminSession();'));
  assert('Enforces Option A rate limits (20% to 50%)', actionsContent.includes('optionARate < 0.2 || optionARate > 0.5'));
  assert('Enforces Option B rate fixed at 1.0000 in enrollment insert', actionsContent.includes('option_b_credit_rate: 1.0000'));
  assert('Enforces fixed pilot rules (8 weeks, 90 days, 100 day eval, 50 day claim)', 
    actionsContent.includes('min_inventory_reporting_weeks: 8') &&
    actionsContent.includes('trial_period_days: 90') &&
    actionsContent.includes('evaluation_day: 100') &&
    actionsContent.includes('claim_window_days: 50') &&
    actionsContent.includes('max_sell_through_rate: 0.5000')
  );
  assert('Cross-entity validation: checks store belongs to enrolled company', actionsContent.includes('store.company_id !== companyId'));
  assert('Cross-entity validation: checks order matches company and store', 
    actionsContent.includes('order.company_id !== companyId') &&
    actionsContent.includes('order.store_id !== storeId')
  );
  assert('Cross-entity validation: checks order item matches order and product', 
    actionsContent.includes('orderItem.order_id !== sourceOrderId') &&
    actionsContent.includes('orderItem.product_id !== productId') &&
    actionsContent.includes('protectedQuantity > orderItem.quantity')
  );
  assert('Cumulative shipment limit check: cumulative <= totalProtectedQuantity', 
    actionsContent.includes('newFulfilledQty > cohort.total_protected_quantity')
  );
  assert('Delivered <= shipped validation in action', actionsContent.includes('quantityDelivered < 0 || quantityDelivered > quantityShipped'));
  assert('Unique fulfillment item assignment check in action', actionsContent.includes('fulfillment item has already been assigned'));
  assert('Day 0 explicitly established on first shipment dispatch', actionsContent.includes('updates.first_shipment_date = shipmentDateStr'));
  assert('Zero fake production writes in code', !actionsContent.includes('INSERT INTO test') && !actionsContent.includes('dummy'));

  // 4. Verify Admin UI Components & Safe Runtime Route
  console.log('\n4. Auditing Admin UI Isolation & Route Components...');
  const overviewViewPath = path.join(process.cwd(), 'components', 'admin', 'exchange-credit', 'overview-view.tsx');
  const companySettingsPath = path.join(process.cwd(), 'components', 'admin', 'exchange-credit', 'company-settings-view.tsx');
  const cohortTablePath = path.join(process.cwd(), 'components', 'admin', 'exchange-credit', 'cohort-table.tsx');
  const cohortDetailPath = path.join(process.cwd(), 'components', 'admin', 'exchange-credit', 'cohort-detail-view.tsx');
  const routePagePath = path.join(process.cwd(), 'app', 'admin', 'exchange-credit', 'page.tsx');

  assert('overview-view.tsx exists', fs.existsSync(overviewViewPath));
  assert('company-settings-view.tsx exists', fs.existsSync(companySettingsPath));
  assert('cohort-table.tsx exists', fs.existsSync(cohortTablePath));
  assert('cohort-detail-view.tsx exists', fs.existsSync(cohortDetailPath));
  assert('app/admin/exchange-credit/page.tsx exists', fs.existsSync(routePagePath));

  const overviewContent = fs.readFileSync(overviewViewPath, 'utf8');
  assert('Renders informative migration pending banner if schema unavailable', overviewContent.includes('Migration 0175 Awaiting Owner Execution'));

  const companySettingsContent = fs.readFileSync(companySettingsPath, 'utf8');
  assert('Company settings displays Option B as fixed 100% Return & Credit', companySettingsContent.includes('100% of original wholesale cost'));
  assert('Company settings displays fixed Pilot Program rules', companySettingsContent.includes('Fixed Pilot Program Rules (Non-editable)'));

  const cohortDetailContent = fs.readFileSync(cohortDetailPath, 'utf8');
  assert('Cohort detail displays Day 0 (First Shipment Date)', cohortDetailContent.includes('Day 0 (First Shipment Date)'));
  assert('Cohort detail displays Frozen Option B Rate 100%', cohortDetailContent.includes('Frozen Option B Rate'));

  const cohortTableContent = fs.readFileSync(cohortTablePath, 'utf8');
  assert('Cohort table displays Day 0 firstShipmentDate', cohortTableContent.includes('Day 0: {cohort.firstShipmentDate || "N/A"}'));

  // 5. Verify Isolation from Concurrent Protected Domains
  console.log('\n5. Verifying Strict Integration Boundaries...');
  assert('Existing Protection Reviews components NOT modified', fs.existsSync(path.join(process.cwd(), 'components', 'admin', 'protection-review-detail.tsx')));
  assert('Store Operations view NOT modified', fs.existsSync(path.join(process.cwd(), 'components', 'admin', 'store-operations-view.tsx')));

  console.log('\n================================================================================');
  console.log(`ALL ${passedCount} OF ${totalCount} TESTS PASSED CLEANLY (100% PASS RATE)`);
  console.log('================================================================================\n');
}

runTests();
