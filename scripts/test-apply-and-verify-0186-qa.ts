import { Client } from 'pg';
import * as fs from 'fs';

// Read .env.qa.local safely
const content = fs.readFileSync('.env.qa.local', 'utf8');
const lines = content.split(/\r?\n/);
let qaDbUrl = '';
for (const line of lines) {
  if (line.startsWith('QA_DATABASE_URL=')) {
    qaDbUrl = line.substring('QA_DATABASE_URL='.length).trim().replace(/^['"]|['"]$/g, '');
    break;
  }
}

if (!qaDbUrl || qaDbUrl.includes('shzfrppdobpmrstcjfqu')) {
  console.error('FATAL: QA script cannot run on Production ref shzfrppdobpmrstcjfqu! Aborting.');
  process.exit(1);
}

const client = new Client({
  connectionString: qaDbUrl,
  ssl: { rejectUnauthorized: false },
});

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(message);
  }
  console.log(`  ✓ ${message}`);
}

async function main() {
  await client.connect();
  console.log('================================================================================');
  console.log('ADM-BSRC-007-R1-ADD1: QA Schema Migration 0186 Final Re-Execution & Alignment');
  console.log('Target QA DB: elkgizqgksshukxgcndy');
  console.log('================================================================================\n');

  // Step 1: Read and re-apply corrected 0186 SQL
  const sqlPath = 'supabase/migrations/0186_brand_marketing_results_and_followup.sql';
  const sql = fs.readFileSync(sqlPath, 'utf8');
  console.log(`Re-executing corrected migration ${sqlPath}...`);

  await client.query('BEGIN');
  try {
    await client.query(sql);

    // Record migration in schema_migrations
    await client.query(`
      INSERT INTO supabase_migrations.schema_migrations (version)
      VALUES ('0186_brand_marketing_results_and_followup')
      ON CONFLICT DO NOTHING;
    `);

    await client.query('COMMIT');
    console.log('Migration 0186 re-executed and committed successfully.\n');
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('Migration failed, rolled back transaction:', err.message);
    throw err;
  }

  // Step 2: Verify columns on sourcing_companies
  console.log('--- Verification 1: Extended Columns on sourcing_companies ---');
  const cols = await client.query(`
    SELECT column_name, data_type, column_default, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'sourcing_companies'
      AND column_name IN ('interest_status', 'next_followup_date', 'followup_note', 'followup_completed_at', 'last_contact_date')
    ORDER BY column_name;
  `);

  const colMap = new Map(cols.rows.map((r: any) => [r.column_name, r]));
  assert(colMap.has('interest_status'), 'Column interest_status exists on sourcing_companies');
  assert(colMap.has('next_followup_date'), 'Column next_followup_date exists on sourcing_companies');
  assert(colMap.has('followup_note'), 'Column followup_note exists on sourcing_companies');
  assert(colMap.has('followup_completed_at'), 'Column followup_completed_at exists on sourcing_companies');
  assert(colMap.has('last_contact_date'), 'Column last_contact_date exists on sourcing_companies');
  const lastContactCol = colMap.get('last_contact_date');
  assert(lastContactCol.data_type === 'timestamp with time zone', 'last_contact_date is TIMESTAMPTZ (timestamp with time zone)');

  // Step 3: Verify constraint chk_sourcing_companies_interest_status exists
  console.log('\n--- Verification 2: Check Constraint chk_sourcing_companies_interest_status ---');
  const constraints = await client.query(`
    SELECT conname, pg_get_constraintdef(oid) as def
    FROM pg_constraint
    WHERE conrelid = 'public.sourcing_companies'::regclass
      AND conname = 'chk_sourcing_companies_interest_status';
  `);
  assert(constraints.rows.length > 0, 'Constraint chk_sourcing_companies_interest_status is active');
  console.log(`  Definition: ${constraints.rows[0].def}`);

  // Step 4: Verify table sourcing_company_activities
  console.log('\n--- Verification 3: Table sourcing_company_activities ---');
  const tableCheck = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'sourcing_company_activities';
  `);
  assert(tableCheck.rows.length === 1, 'Table sourcing_company_activities created');

  // Step 5: Verify Foreign Key Constraints on sourcing_company_activities
  console.log('\n--- Verification 4: Foreign Key Constraints & Deletion Rules ---');
  const fks = await client.query(`
    SELECT
      tc.constraint_name,
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name,
      rc.delete_rule
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    JOIN information_schema.referential_constraints AS rc
      ON rc.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      AND tc.table_name = 'sourcing_company_activities';
  `);

  console.log('Foreign keys on sourcing_company_activities:');
  for (const fk of fks.rows) {
    console.log(`  - ${fk.column_name} -> ${fk.foreign_table_name}.${fk.foreign_column_name} (ON DELETE ${fk.delete_rule})`);
  }
  const companyFk = fks.rows.find((f: any) => f.column_name === 'company_id');
  assert(
    companyFk && (companyFk.delete_rule === 'RESTRICT' || companyFk.delete_rule === 'NO ACTION'),
    `company_id references sourcing_companies(id) ON DELETE RESTRICT (actual rule: ${companyFk?.delete_rule})`
  );

  const campFk = fks.rows.find((f: any) => f.column_name === 'campaign_id');
  assert(campFk && campFk.delete_rule === 'SET NULL', 'campaign_id references marketing_campaigns(id) ON DELETE SET NULL');

  const recFk = fks.rows.find((f: any) => f.column_name === 'recipient_id');
  assert(recFk && recFk.delete_rule === 'SET NULL', 'recipient_id references marketing_campaign_recipients(id) ON DELETE SET NULL');

  // Step 6: Verify Indexes
  console.log('\n--- Verification 5: Performance Indexes ---');
  const idx = await client.query(`
    SELECT indexname 
    FROM pg_indexes 
    WHERE schemaname = 'public' 
      AND (tablename = 'sourcing_company_activities' OR tablename = 'sourcing_companies')
      AND indexname IN (
        'idx_sourcing_companies_interest',
        'idx_sourcing_companies_followup_date',
        'idx_sourcing_company_activities_cid',
        'idx_sourcing_company_activities_camp',
        'idx_sourcing_company_activities_created'
      );
  `);
  assert(idx.rows.length === 5, 'All 5 performance indexes are verified');

  // Step 7: Verify Table Grants (No UPDATE/DELETE for authenticated or service_role)
  console.log('\n--- Verification 6: Table Privileges ---');
  const grants = await client.query(`
    SELECT grantee, privilege_type
    FROM information_schema.role_table_grants
    WHERE table_schema = 'public'
      AND table_name = 'sourcing_company_activities'
      AND grantee IN ('authenticated', 'service_role')
    ORDER BY grantee, privilege_type;
  `);
  console.log('Grants on sourcing_company_activities:', grants.rows);

  const authPrivs = grants.rows.filter((g: any) => g.grantee === 'authenticated').map((g: any) => g.privilege_type);
  const srvPrivs = grants.rows.filter((g: any) => g.grantee === 'service_role').map((g: any) => g.privilege_type);
  assert(authPrivs.includes('SELECT'), 'authenticated has SELECT');
  assert(authPrivs.includes('INSERT'), 'authenticated has INSERT');
  assert(!authPrivs.includes('UPDATE'), 'authenticated DOES NOT have UPDATE');
  assert(!authPrivs.includes('DELETE'), 'authenticated DOES NOT have DELETE');
  assert(srvPrivs.includes('SELECT'), 'service_role has SELECT');
  assert(srvPrivs.includes('INSERT'), 'service_role has INSERT');
  assert(!srvPrivs.includes('UPDATE'), 'service_role DOES NOT have UPDATE');
  assert(!srvPrivs.includes('DELETE'), 'service_role DOES NOT have DELETE');

  // Step 8: Verify RLS is Enabled & Policy Exists
  console.log('\n--- Verification 7: RLS and Security Policies ---');
  const rls = await client.query(`
    SELECT relname, relrowsecurity, relforcerowsecurity
    FROM pg_class
    WHERE relname = 'sourcing_company_activities';
  `);
  assert(rls.rows[0].relrowsecurity === true, 'RLS is enabled on sourcing_company_activities');
  assert(rls.rows[0].relforcerowsecurity === true, 'FORCE RLS is enabled on sourcing_company_activities');

  const pol = await client.query(`
    SELECT policyname, permissive, roles, cmd, qual
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'sourcing_company_activities'
    ORDER BY policyname;
  `);
  console.log(`Verified RLS policies:`, pol.rows.map((p: any) => `"${p.policyname}" (${p.cmd})`).join(', '));
  assert(pol.rows.some((p: any) => p.policyname === 'sourcing_company_activities_admin_select'), 'sourcing_company_activities_admin_select is active');
  assert(pol.rows.some((p: any) => p.policyname === 'sourcing_company_activities_admin_insert'), 'sourcing_company_activities_admin_insert is active');

  // Step 9: Verify Append-Only Trigger & Function search_path
  console.log('\n--- Verification 8: Trigger & Function Security ---');
  const fnCheck = await client.query(`
    SELECT proname, prosecdef, proconfig
    FROM pg_proc
    WHERE proname = 'trg_fn_protect_sourcing_company_activities';
  `);
  assert(fnCheck.rows.length === 1, 'Function trg_fn_protect_sourcing_company_activities exists');
  assert(fnCheck.rows[0].prosecdef === true, 'Function has SECURITY DEFINER');
  assert(
    fnCheck.rows[0].proconfig && fnCheck.rows[0].proconfig.some((c: string) => c.includes('search_path')),
    `Function enforces search_path (${JSON.stringify(fnCheck.rows[0].proconfig)})`
  );

  const trg = await client.query(`
    SELECT trigger_name, event_manipulation, action_statement
    FROM information_schema.triggers
    WHERE event_object_schema = 'public'
      AND event_object_table = 'sourcing_company_activities'
      AND trigger_name = 'trg_protect_sourcing_company_activities';
  `);
  assert(trg.rows.length > 0, 'Trigger trg_protect_sourcing_company_activities is active');

  console.log('\n================================================================================');
  console.log('🎉 ALL FINAL MIGRATION 0186 QA VERIFICATIONS PASSED (100%)');
  console.log('================================================================================\n');

  await client.end();
}

main().catch(err => {
  console.error('Verification failed:', err.message);
  process.exit(1);
});
