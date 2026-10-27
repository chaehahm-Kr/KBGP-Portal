const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Read .env.qa.local safely
const content = fs.readFileSync('.env.qa.local', 'utf8');
const lines = content.split(/\r?\n/);
let qaDbUrl = '';
for (const line of lines) {
  if (line.startsWith('QA_DATABASE_URL=')) {
    qaDbUrl = line.substring('QA_DATABASE_URL='.length).trim();
    if ((qaDbUrl.startsWith('"') && qaDbUrl.endsWith('"')) || (qaDbUrl.startsWith("'") && qaDbUrl.endsWith("'"))) {
      qaDbUrl = qaDbUrl.slice(1, -1);
    }
    break;
  }
}

if (!qaDbUrl) {
  console.error('❌ QA_DATABASE_URL not found in .env.qa.local');
  process.exit(1);
}

// Safety check: NEVER run on Production ref shzfrppdobpmrstcjfqu
if (qaDbUrl.includes('shzfrppdobpmrstcjfqu')) {
  console.error('❌ FATAL SAFETY VIOLATION: QA script targeted production ref shzfrppdobpmrstcjfqu! Aborting immediately.');
  process.exit(1);
}

const client = new Client({
  connectionString: qaDbUrl,
  ssl: { rejectUnauthorized: false },
});

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(message);
  }
  console.log(`  ✓ ${message}`);
}

async function run() {
  await client.connect();
  console.log('\n================================================================================');
  console.log('ADM-BSRC-006-R1: Apply & Verify Hardened Migration 0185 in QA Database');
  console.log('================================================================================\n');

  // Verify connection target
  const hostRes = await client.query('SELECT current_database(), current_user, inet_server_addr();');
  console.log('[1/10] Connected to QA DB Target:', hostRes.rows[0]);

  // Read migration 0185 SQL
  const migrationPath = path.join(__dirname, '../supabase/migrations/0185_brand_marketing_campaigns.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');
  console.log(`[2/10] Loaded 0185 SQL (${sql.length} bytes, ${sql.split('\n').length} lines).`);

  // Execute migration
  console.log('[3/10] Applying 0185 migration to QA DB...');
  await client.query('BEGIN');
  try {
    await client.query(sql);
    // Record in schema migrations table
    await client.query(`
      CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
        version text not null primary key,
        statements text[],
        name text
      );
    `);
    await client.query(`
      INSERT INTO supabase_migrations.schema_migrations (version, name)
      VALUES ('0185', '0185_brand_marketing_campaigns.sql')
      ON CONFLICT (version) DO NOTHING;
    `);
    await client.query('COMMIT');
    console.log('  ✓ Migration 0185 committed successfully in QA DB.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed, rolled back:', err);
    throw err;
  }

  // ----------------------------------------------------------------------------
  // VERIFICATION 1: All 5 tables created with correct UUID PKs
  // ----------------------------------------------------------------------------
  console.log('\n[4/10] Verifying Table Existence and Primary Key Types...');
  const expectedTables = [
    'marketing_templates',
    'marketing_campaigns',
    'marketing_campaign_recipients',
    'marketing_campaign_logs',
    'marketing_suppression_list',
  ];

  for (const table of expectedTables) {
    const res = await client.query(
      `SELECT table_name, column_name, data_type, udt_name 
       FROM information_schema.columns 
       WHERE table_schema = 'public' AND table_name = $1 AND column_name = 'id';`,
      [table]
    );
    assert(res.rows.length === 1, `Table ${table} exists`);
    assert(res.rows[0].udt_name === 'uuid', `Table ${table}.id is UUID type`);
  }

  // ----------------------------------------------------------------------------
  // VERIFICATION 2: Default Template Packages Seeded
  // ----------------------------------------------------------------------------
  console.log('\n[5/10] Verifying Seeded Default Templates...');
  const tplRes = await client.query(
    "SELECT id, name, language, is_default, version FROM public.marketing_templates ORDER BY language;"
  );
  assert(tplRes.rows.length >= 2, `Seeded templates count (${tplRes.rows.length}) >= 2`);
  const koTpl = tplRes.rows.find((t) => t.id === 'e0000000-0000-4000-8000-000000000001');
  const enTpl = tplRes.rows.find((t) => t.id === 'e0000000-0000-4000-8000-000000000002');
  assert(!!koTpl, 'Korean template seeded at deterministic UUID e0000000-0000-4000-8000-000000000001');
  assert(!!enTpl, 'English template seeded at deterministic UUID e0000000-0000-4000-8000-000000000002');

  // ----------------------------------------------------------------------------
  // VERIFICATION 3: LIVE_MODE Check Constraint Enforcement
  // ----------------------------------------------------------------------------
  console.log('\n[6/10] Verifying LIVE_MODE Constraint (chk_marketing_campaigns_live_mode_disabled)...');
  let liveModeBlocked = false;
  try {
    await client.query(`
      INSERT INTO public.marketing_campaigns (id, name, is_live_mode_enabled)
      VALUES (gen_random_uuid(), 'Disallowed Live Campaign', true);
    `);
  } catch (err) {
    if (err.message.includes('chk_marketing_campaigns_live_mode_disabled') || err.message.includes('check constraint')) {
      liveModeBlocked = true;
    }
  }
  assert(liveModeBlocked, 'Database engine strictly rejects is_live_mode_enabled = true via check constraint');

  // Insert valid test campaign
  const testCampId = '11111111-1111-4111-8111-111111111111';
  await client.query(`
    INSERT INTO public.marketing_campaigns (id, name, is_live_mode_enabled, status)
    VALUES ($1, 'QA Hardening Test Campaign', false, 'TESTING')
    ON CONFLICT (id) DO NOTHING;
  `, [testCampId]);
  console.log('  ✓ Valid campaign inserted with is_live_mode_enabled = false');

  // ----------------------------------------------------------------------------
  // VERIFICATION 4: Append-Only Audit Log Immutability
  // ----------------------------------------------------------------------------
  console.log('\n[7/10] Verifying Append-Only Audit Log Immutability (marketing_campaign_logs)...');
  const testLogId = '22222222-2222-4222-8222-222222222222';
  await client.query(`
    INSERT INTO public.marketing_campaign_logs (id, campaign_id, event_type, is_test_mode, details)
    VALUES ($1, $2, 'TEST_AUDIT_EVENT', true, '{"reason": "verification"}');
  `, [testLogId, testCampId]);
  console.log('  ✓ Audit log inserted successfully');

  // Test UPDATE on audit log -> MUST FAIL
  let logUpdateBlocked = false;
  try {
    await client.query(`
      UPDATE public.marketing_campaign_logs
      SET event_type = 'TAMPERED_EVENT'
      WHERE id = $1;
    `, [testLogId]);
  } catch (err) {
    if (err.message.includes('append-only audit log') || err.message.includes('UPDATE and DELETE operations are strictly prohibited')) {
      logUpdateBlocked = true;
    }
  }
  assert(logUpdateBlocked, 'UPDATE on marketing_campaign_logs blocked by exception trigger');

  // Test DELETE on audit log -> MUST FAIL
  let logDeleteBlocked = false;
  try {
    await client.query(`
      DELETE FROM public.marketing_campaign_logs
      WHERE id = $1;
    `, [testLogId]);
  } catch (err) {
    if (err.message.includes('append-only audit log') || err.message.includes('UPDATE and DELETE operations are strictly prohibited')) {
      logDeleteBlocked = true;
    }
  }
  assert(logDeleteBlocked, 'DELETE on marketing_campaign_logs blocked by exception trigger');

  // ----------------------------------------------------------------------------
  // VERIFICATION 5: Cascade Deletion Restrict Protection
  // ----------------------------------------------------------------------------
  console.log('\n[8/10] Verifying Foreign Key RESTRICT Protection against Cascade Deletion...');
  let campDeleteBlocked = false;
  try {
    await client.query(`DELETE FROM public.marketing_campaigns WHERE id = $1;`, [testCampId]);
  } catch (err) {
    if (err.message.includes('violates foreign key constraint') || err.message.includes('marketing_campaign_logs')) {
      campDeleteBlocked = true;
    }
  }
  assert(campDeleteBlocked, 'Campaign cannot be deleted while child records (logs/recipients) exist (ON DELETE RESTRICT)');

  // ----------------------------------------------------------------------------
  // VERIFICATION 6: Email Normalization & Duplicate Detection
  // ----------------------------------------------------------------------------
  console.log('\n[9/10] Verifying Email Normalization & Case-Insensitive Uniqueness...');
  
  // Suppression list test: insert mixed case with leading/trailing spaces
  const rawEmail = '  SuPpOrT.Test@Example.COM  ';
  const suppRes = await client.query(`
    INSERT INTO public.marketing_suppression_list (id, email, reason)
    VALUES (gen_random_uuid(), $1, 'MANUAL_ADMIN')
    RETURNING email;
  `, [rawEmail]);
  assert(suppRes.rows[0].email === 'support.test@example.com', 'Suppression email normalized to lower(trim) via trigger');

  // Test duplicate suppression email in different case -> MUST FAIL UNIQUE
  let suppDuplicateBlocked = false;
  try {
    await client.query(`
      INSERT INTO public.marketing_suppression_list (id, email, reason)
      VALUES (gen_random_uuid(), 'SUPPORT.TEST@EXAMPLE.COM', 'MANUAL_ADMIN');
    `);
  } catch (err) {
    if (err.message.includes('duplicate key value') || err.message.includes('unique constraint')) {
      suppDuplicateBlocked = true;
    }
  }
  assert(suppDuplicateBlocked, 'Duplicate email in different case blocked by suppression unique constraint');

  // Clean up suppression test row
  await client.query(`DELETE FROM public.marketing_suppression_list WHERE email = 'support.test@example.com';`);

  // ----------------------------------------------------------------------------
  // VERIFICATION 7: RLS and Security Policies
  // ----------------------------------------------------------------------------
  console.log('\n[10/10] Verifying Row Level Security & Policies on all 5 tables...');
  const rlsCheck = await client.query(`
    SELECT relname, relrowsecurity, relforcerowsecurity
    FROM pg_class
    WHERE relname IN (
      'marketing_templates',
      'marketing_campaigns',
      'marketing_campaign_recipients',
      'marketing_campaign_logs',
      'marketing_suppression_list'
    )
    ORDER BY relname;
  `);

  for (const row of rlsCheck.rows) {
    assert(row.relrowsecurity === true, `${row.relname} has ROW LEVEL SECURITY enabled`);
    assert(row.relforcerowsecurity === true, `${row.relname} has FORCE ROW LEVEL SECURITY enabled`);
  }

  const policies = await client.query(`
    SELECT tablename, policyname, cmd
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename LIKE 'marketing_%'
    ORDER BY tablename, policyname;
  `);
  console.log('  Active policies:', policies.rows.map(p => `${p.tablename}.${p.policyname} (${p.cmd})`));
  assert(policies.rows.length >= 6, 'All expected RLS policies defined');

  console.log('\n================================================================================');
  console.log('🎉 ALL 10 HARDENING & SCHEMA CHECKS PASSED IN QA DATABASE!');
  console.log('================================================================================\n');

  await client.end();
}

run().catch((err) => {
  console.error('\n❌ QA Verification Script Failed:', err);
  client.end().finally(() => process.exit(1));
});
