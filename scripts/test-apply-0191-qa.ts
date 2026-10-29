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
  console.log('ADM-BSRC-014: QA Schema Migration 0191 Application & Verification');
  console.log('Target QA DB: elkgizqgksshukxgcndy');
  console.log('================================================================================\n');

  // Step 1: Read and apply 0191 SQL
  const sqlPath = 'supabase/migrations/0191_brand_sourcing_multi_source_providers.sql';
  const sql = fs.readFileSync(sqlPath, 'utf8');
  console.log(`Applying migration ${sqlPath}...`);

  await client.query('BEGIN');
  try {
    await client.query(sql);

    // Record migration in schema_migrations
    await client.query(`
      INSERT INTO supabase_migrations.schema_migrations (version)
      VALUES ('0191_brand_sourcing_multi_source_providers')
      ON CONFLICT DO NOTHING;
    `);

    await client.query('COMMIT');
    console.log('Migration 0191 executed and committed successfully.\n');
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('Migration failed, rolled back transaction:', err.message);
    throw err;
  }

  // Step 2: Verify provider check constraint on sourcing_sources
  console.log('--- Verification 1: Provider CHECK Constraint ---');
  const constraints = await client.query(`
    SELECT conname, pg_get_constraintdef(oid) as def
    FROM pg_constraint
    WHERE conrelid = 'public.sourcing_sources'::regclass
      AND conname = 'sourcing_sources_provider_check';
  `);
  assert(constraints.rows.length === 1, 'Constraint sourcing_sources_provider_check exists');
  console.log(`  Definition: ${constraints.rows[0].def}`);
  assert(constraints.rows[0].def.includes('INDIE_BEAUTY_SHOW'), 'Constraint definition includes INDIE_BEAUTY_SHOW');

  // Step 3: Verify source_url is nullable
  console.log('\n--- Verification 2: Nullable source_url ---');
  const cols = await client.query(`
    SELECT column_name, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'sourcing_sources' AND column_name = 'source_url';
  `);
  assert(cols.rows[0].is_nullable === 'YES', 'source_url is nullable (is_nullable === YES)');

  console.log('\n================================================================================');
  console.log('🎉 MIGRATION 0191 QA APPLICATION & VERIFICATION PASSED (100%)');
  console.log('================================================================================\n');

  await client.end();
}

main().catch(err => {
  console.error('Verification failed:', err.message);
  process.exit(1);
});
