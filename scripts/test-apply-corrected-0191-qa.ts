import * as fs from 'fs';
import * as path from 'path';
// @ts-ignore
import { Client } from 'pg';

// Read .env.qa.local safely
const envPath = path.resolve(__dirname, '../.env.qa.local');
const content = fs.readFileSync(envPath, 'utf8');
const lines = content.split(/\r?\n/);
let qaDbUrl = '';

for (const line of lines) {
  if (line.startsWith('QA_DATABASE_URL=')) {
    qaDbUrl = line.substring('QA_DATABASE_URL='.length).trim().replace(/^['"]|['"]$/g, '');
    break;
  }
}

// Security guard: MUST NOT target Production
if (!qaDbUrl || qaDbUrl.includes('shzfrppdobpmrstcjfqu')) {
  console.error('FATAL: Script must NOT run against Production ref shzfrppdobpmrstcjfqu! Aborting.');
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
  console.log('ADM-BSRC-014-R1: QA Corrected SQL 0191 Safety & Idempotency Audit');
  console.log('Target QA Database: elkgizqgksshukxgcndy');
  console.log('================================================================================\n');

  try {
    // 0. Ensure source_url is NOT NULL on QA
    console.log('Step 0: Restoring source_url NOT NULL constraint on QA DB...');
    await client.query('ALTER TABLE public.sourcing_sources ALTER COLUMN source_url SET NOT NULL;');
    const colRes = await client.query(`
      SELECT column_name, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'sourcing_sources'
        AND column_name = 'source_url'
    `);
    assert(colRes.rows.length === 1, 'source_url column found');
    assert(colRes.rows[0].is_nullable === 'NO', `source_url is_nullable is NO (got: ${colRes.rows[0].is_nullable})`);

    // 1. Read corrected migration SQL
    const migrationPath = path.resolve(__dirname, '../supabase/migrations/0191_brand_sourcing_multi_source_providers.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    assert(!sql.includes('DROP NOT NULL'), 'Corrected SQL 0191 does NOT contain DROP NOT NULL');

    // 2. First Execution of corrected SQL 0191
    console.log('\nStep 1: Applying corrected SQL 0191 (First Run)...');
    await client.query(sql);
    console.log('  ✓ First run executed successfully');

    // 3. Verify constraint
    console.log('\nStep 2: Verifying constraint definition after First Run...');
    const conRes1 = await client.query(`
      SELECT conname, pg_get_constraintdef(oid) as def
      FROM pg_constraint
      WHERE conrelid = 'public.sourcing_sources'::regclass
        AND conname = 'sourcing_sources_provider_check'
    `);
    assert(conRes1.rows.length === 1, 'sourcing_sources_provider_check exists');
    assert(conRes1.rows[0].def.includes('INDIE_BEAUTY_SHOW'), 'Constraint contains INDIE_BEAUTY_SHOW');
    assert(conRes1.rows[0].def.includes('INTERCHARM'), 'Constraint contains INTERCHARM');
    assert(conRes1.rows[0].def.includes('COSMOPROF'), 'Constraint contains COSMOPROF');
    assert(conRes1.rows[0].def.includes('MANUAL'), 'Constraint contains MANUAL');
    assert(conRes1.rows[0].def.includes('OTHER'), 'Constraint contains OTHER');
    console.log('  Constraint definition:', conRes1.rows[0].def);

    // 4. Second Execution of corrected SQL 0191 (Idempotency / Repeat Safety)
    console.log('\nStep 3: Re-applying corrected SQL 0191 (Second Run - Repeat Safety)...');
    await client.query(sql);
    console.log('  ✓ Second run executed without error (Idempotency verified)');

    // 5. Verify constraint again after Second Run
    const conRes2 = await client.query(`
      SELECT conname, pg_get_constraintdef(oid) as def
      FROM pg_constraint
      WHERE conrelid = 'public.sourcing_sources'::regclass
        AND conname = 'sourcing_sources_provider_check'
    `);
    assert(conRes2.rows.length === 1, 'sourcing_sources_provider_check exists after second run');
    assert(conRes2.rows[0].def.includes('INDIE_BEAUTY_SHOW'), 'Constraint contains INDIE_BEAUTY_SHOW after second run');

    // 6. Verify source_url remains strictly NOT NULL
    const colRes2 = await client.query(`
      SELECT column_name, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'sourcing_sources'
        AND column_name = 'source_url'
    `);
    assert(colRes2.rows[0].is_nullable === 'NO', 'source_url remains NOT NULL after migration');

    // 7. Verify functional insertion of INDIE_BEAUTY_SHOW provider
    console.log('\nStep 4: Functional insertion test with INDIE_BEAUTY_SHOW...');
    // Create a temporary company
    const tempCompRes = await client.query(`
      INSERT INTO public.sourcing_companies (company_name_kr)
      VALUES ('QA_MIGRATION_0191_TEMP_TEST')
      RETURNING id
    `);
    const tempCompId = tempCompRes.rows[0].id;

    try {
      // Insert sourcing_source with INDIE_BEAUTY_SHOW
      const tempSrcRes = await client.query(`
        INSERT INTO public.sourcing_sources (company_id, provider, source_url, source_identifier)
        VALUES ($1, 'INDIE_BEAUTY_SHOW', 'https://indiebeautyshow.com/test', 'ibs-test-qa')
        RETURNING id, provider
      `, [tempCompId]);
      assert(tempSrcRes.rows.length === 1, 'Inserted sourcing_sources with provider INDIE_BEAUTY_SHOW');
      assert(tempSrcRes.rows[0].provider === 'INDIE_BEAUTY_SHOW', 'Provider matches INDIE_BEAUTY_SHOW');

      // Verify null source_url is rejected
      let nullRejected = false;
      try {
        await client.query(`
          INSERT INTO public.sourcing_sources (company_id, provider, source_url, source_identifier)
          VALUES ($1, 'INDIE_BEAUTY_SHOW', NULL, 'ibs-test-null')
        `, [tempCompId]);
      } catch (err: any) {
        nullRejected = true;
        console.log('  ✓ Null source_url correctly rejected:', err.message);
      }
      assert(nullRejected, 'source_url NOT NULL constraint correctly rejected NULL insertion');

      // Verify invalid provider is rejected
      let invalidRejected = false;
      try {
        await client.query(`
          INSERT INTO public.sourcing_sources (company_id, provider, source_url, source_identifier)
          VALUES ($1, 'INVALID_EXPO_PROVIDER', 'https://invalid.com/test', 'inv-test')
        `, [tempCompId]);
      } catch (err: any) {
        invalidRejected = true;
        console.log('  ✓ Invalid provider correctly rejected:', err.message);
      }
      assert(invalidRejected, 'sourcing_sources_provider_check correctly rejected invalid provider');
    } finally {
      await client.query('DELETE FROM public.sourcing_companies WHERE id = $1', [tempCompId]);
      console.log('  ✓ Cleaned up temporary test company and sources from QA DB');
    }

    console.log('\n================================================================================');
    console.log('ALL CORRECTED MIGRATION 0191 AUDIT CHECKS PASSED (100%)');
    console.log('================================================================================');
  } catch (err: any) {
    console.error('QA AUDIT FAILED:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch(console.error);
