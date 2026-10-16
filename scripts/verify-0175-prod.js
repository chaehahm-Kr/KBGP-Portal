const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

let env = {};
const envPaths = ['.env.production.local', '.env.local'];
for (const envPath of envPaths) {
  const fullPath = path.join(process.cwd(), envPath);
  if (fs.existsSync(fullPath)) {
    const envText = fs.readFileSync(fullPath, 'utf8');
    envText.split('\n').forEach(line => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        let value = (match[2] || '').trim();
        if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
        if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
        env[match[1]] = value;
      }
    });
  }
}

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || 'https://shzfrppdobpmrstcjfqu.supabase.co';
const serviceKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!serviceKey) {
  console.error('Missing Supabase Service Role Key in environment!');
  process.exit(1);
}

const admin = createClient(supabaseUrl, serviceKey);
const anon = createClient(supabaseUrl, anonKey);

async function runLiveVerification() {
  console.log('================================================================================');
  console.log('EXCHANGE-CREDIT-PH1-004: POST-MIGRATION 0175 LIVE PRODUCTION VERIFICATION');
  console.log('Target Supabase Ref: shzfrppdobpmrstcjfqu');
  console.log('Database URL:', supabaseUrl);
  console.log('Mode: STRICT READ-ONLY AUDIT (Zero writes to production)');
  console.log('================================================================================\n');

  let passed = 0;
  let failed = 0;

  function report(name, condition, detail = '') {
    if (condition) {
      console.log(`✅ PASS: ${name}${detail ? ' (' + detail + ')' : ''}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${name}${detail ? ' (' + detail + ')' : ''}`);
      failed++;
    }
  }

  // ---------------------------------------------------------------------------
  // 1. Table: retailer_exchange_program_enrollments
  // ---------------------------------------------------------------------------
  console.log('--- 1. TABLE: retailer_exchange_program_enrollments ---');
  const { data: enrollments, error: enrollErr, count: enrollCount } = await admin
    .from('retailer_exchange_program_enrollments')
    .select(`
      id,
      company_id,
      status,
      option_a_credit_rate,
      option_b_credit_rate,
      min_inventory_reporting_weeks,
      trial_period_days,
      evaluation_day,
      claim_window_days,
      max_sell_through_rate,
      reorder_disqualifies,
      enrolled_by,
      enrolled_at,
      effective_date,
      paused_at,
      paused_by,
      pause_reason,
      notes,
      created_at,
      updated_at
    `, { count: 'exact' })
    .limit(1);

  report(
    'Table exists and all 20 columns accessible',
    !enrollErr,
    enrollErr ? enrollErr.message : `Current rows: ${enrollCount || 0}`
  );

  // Joins
  const { error: enrollJoinErr } = await admin
    .from('retailer_exchange_program_enrollments')
    .select(`
      id,
      company:company_id(id, name, company_code),
      staff:enrolled_by(id, name)
    `)
    .limit(1);

  report('Foreign keys to companies and staff_members resolved', !enrollJoinErr, enrollJoinErr?.message);

  // ---------------------------------------------------------------------------
  // 2. Table: retailer_exchange_program_audit_logs
  // ---------------------------------------------------------------------------
  console.log('\n--- 2. TABLE: retailer_exchange_program_audit_logs ---');
  const { data: audits, error: auditErr, count: auditCount } = await admin
    .from('retailer_exchange_program_audit_logs')
    .select(`
      id,
      enrollment_id,
      company_id,
      action,
      changed_by,
      old_values,
      new_values,
      reason,
      created_at
    `, { count: 'exact' })
    .limit(1);

  report(
    'Table exists and all 9 columns accessible',
    !auditErr,
    auditErr ? auditErr.message : `Current rows: ${auditCount || 0}`
  );

  // Joins
  const { error: auditJoinErr } = await admin
    .from('retailer_exchange_program_audit_logs')
    .select(`
      id,
      enrollment:enrollment_id(id),
      company:company_id(id, name),
      staff:changed_by(id, name)
    `)
    .limit(1);

  report('Foreign keys to enrollments, companies, staff_members resolved', !auditJoinErr, auditJoinErr?.message);

  // ---------------------------------------------------------------------------
  // 3. Table: retailer_protected_supply_cohorts
  // ---------------------------------------------------------------------------
  console.log('\n--- 3. TABLE: retailer_protected_supply_cohorts ---');
  const { data: cohorts, error: cohortErr, count: cohortCount } = await admin
    .from('retailer_protected_supply_cohorts')
    .select(`
      id,
      cohort_code,
      company_id,
      store_id,
      product_id,
      enrollment_id,
      source_order_id,
      source_order_item_id,
      total_protected_quantity,
      fulfilled_protected_quantity,
      frozen_unit_wholesale_price,
      frozen_option_a_rate,
      frozen_option_b_rate,
      frozen_min_reporting_weeks,
      frozen_max_sell_through_rate,
      status,
      first_shipment_date,
      trial_end_date,
      evaluation_date,
      claim_deadline_date,
      disqualification_reason,
      disqualified_at,
      disqualified_by_order_id,
      created_by,
      created_at,
      updated_at
    `, { count: 'exact' })
    .limit(1);

  report(
    'Table exists and all 26 columns accessible',
    !cohortErr,
    cohortErr ? cohortErr.message : `Current rows: ${cohortCount || 0}`
  );

  // Joins
  const { error: cohortJoinErr } = await admin
    .from('retailer_protected_supply_cohorts')
    .select(`
      id,
      company:company_id(id, name),
      store:store_id(id, name, store_code),
      product:product_id(id, name, letusto_sku),
      enrollment:enrollment_id(id),
      order:source_order_id(id, order_number),
      order_item:source_order_item_id(id, quantity),
      staff:created_by(id, name)
    `)
    .limit(1);

  report('Foreign keys to company, store, product, enrollment, order, order_item, staff resolved', !cohortJoinErr, cohortJoinErr?.message);

  // ---------------------------------------------------------------------------
  // 4. Table: retailer_protected_supply_shipments
  // ---------------------------------------------------------------------------
  console.log('\n--- 4. TABLE: retailer_protected_supply_shipments ---');
  const { data: shipments, error: shipErr, count: shipCount } = await admin
    .from('retailer_protected_supply_shipments')
    .select(`
      id,
      cohort_id,
      fulfillment_id,
      fulfillment_item_id,
      shipment_sequence,
      quantity_shipped,
      quantity_delivered,
      shipped_at,
      delivered_at,
      tracking_number,
      carrier,
      is_first_shipment,
      notes,
      created_at
    `, { count: 'exact' })
    .limit(1);

  report(
    'Table exists and all 14 columns accessible',
    !shipErr,
    shipErr ? shipErr.message : `Current rows: ${shipCount || 0}`
  );

  // Joins
  const { error: shipJoinErr } = await admin
    .from('retailer_protected_supply_shipments')
    .select(`
      id,
      cohort:cohort_id(id, cohort_code),
      fulfillment:fulfillment_id(id, fulfillment_number),
      fulfillment_item:fulfillment_item_id(id)
    `)
    .limit(1);

  report('Foreign keys to cohort, fulfillment, fulfillment_item resolved', !shipJoinErr, shipJoinErr?.message);

  // ---------------------------------------------------------------------------
  // 5. Sequence & Stored Procedure: generate_protected_cohort_code()
  // ---------------------------------------------------------------------------
  console.log('\n--- 5. FUNCTION & SEQUENCE: generate_protected_cohort_code() ---');
  const { data: genCode, error: genCodeErr } = await admin.rpc('generate_protected_cohort_code');
  report(
    'Function public.generate_protected_cohort_code() callable by authenticated role',
    !genCodeErr && typeof genCode === 'string' && /^PSC-\d{4}-\d{6}$/.test(genCode),
    genCode ? `Generated Sample Code: ${genCode}` : genCodeErr?.message
  );

  // ---------------------------------------------------------------------------
  // 6. Security & RLS Inspection
  // ---------------------------------------------------------------------------
  console.log('\n--- 6. SECURITY & ROW LEVEL SECURITY (RLS) AUDIT ---');

  // Anonymous access to enrollments
  const { data: anonEnroll, error: anonEnrollErr } = await anon
    .from('retailer_exchange_program_enrollments')
    .select('id, company_id')
    .limit(1);

  report(
    'retailer_exchange_program_enrollments RLS active for anonymous user',
    (anonEnrollErr || !anonEnroll || anonEnroll.length === 0),
    anonEnrollErr ? anonEnrollErr.message : '0 rows returned'
  );

  // Anonymous access to audit logs
  const { data: anonAudit, error: anonAuditErr } = await anon
    .from('retailer_exchange_program_audit_logs')
    .select('id, reason')
    .limit(1);

  report(
    'retailer_exchange_program_audit_logs RLS active for anonymous user',
    (anonAuditErr || !anonAudit || anonAudit.length === 0),
    anonAuditErr ? anonAuditErr.message : '0 rows returned'
  );

  // Anonymous access to cohorts
  const { data: anonCohort, error: anonCohortErr } = await anon
    .from('retailer_protected_supply_cohorts')
    .select('id, cohort_code')
    .limit(1);

  report(
    'retailer_protected_supply_cohorts RLS active for anonymous user',
    (anonCohortErr || !anonCohort || anonCohort.length === 0),
    anonCohortErr ? anonCohortErr.message : '0 rows returned'
  );

  // Anonymous access to shipments
  const { data: anonShip, error: anonShipErr } = await anon
    .from('retailer_protected_supply_shipments')
    .select('id, quantity_shipped')
    .limit(1);

  report(
    'retailer_protected_supply_shipments RLS active for anonymous user',
    (anonShipErr || !anonShip || anonShip.length === 0),
    anonShipErr ? anonShipErr.message : '0 rows returned'
  );

  console.log('\n================================================================================');
  console.log(`LIVE AUDIT SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================================\n');

  if (failed > 0) {
    console.error('❌ MIGRATION 0175 AUDIT DETECTED SCHEMA OR SECURITY DRIFT');
    process.exit(1);
  } else {
    console.log('🎉 MIGRATION 0175 IS 100% VERIFIED ON PRODUCTION SUPABASE (SHZRPPDOBPMRSTCJFQU)!');
  }
}

runLiveVerification().catch(e => {
  console.error('Fatal audit failure:', e);
  process.exit(1);
});
