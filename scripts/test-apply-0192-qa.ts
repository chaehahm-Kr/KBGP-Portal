import * as fs from 'fs';
import * as path from 'path';
// @ts-ignore
import { Client } from 'pg';

const envPath = path.resolve(__dirname, '../.env.qa.local');
const content = fs.readFileSync(envPath, 'utf8');
let qaDbUrl = '';
for (const line of content.split(/\r?\n/)) {
  if (line.startsWith('QA_DATABASE_URL=')) {
    qaDbUrl = line.substring('QA_DATABASE_URL='.length).trim().replace(/^['"]|['"]$/g, '');
    break;
  }
}

// STRICT GUARD: Must NOT target Production ref
if (!qaDbUrl || qaDbUrl.includes('shzfrppdobpmrstcjfqu')) {
  console.error('FATAL: Script must NOT run against Production ref shzfrppdobpmrstcjfqu! Aborting.');
  process.exit(1);
}

const client = new Client({
  connectionString: qaDbUrl,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  await client.connect();
  console.log('================================================================================');
  console.log('QA MIGRATION TEST: 0192_brand_sourcing_company_phone.sql');
  console.log('Target Database: QA elkgizqgksshukxgcndy');
  console.log('================================================================================\n');

  try {
    const migrationPath = path.resolve(__dirname, '../supabase/migrations/0192_brand_sourcing_company_phone.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    // 1. First execution
    console.log('Step 1: Applying migration 0192 (First run)...');
    await client.query(sql);
    console.log('  ✓ First run executed successfully');

    // 2. Verify column exists
    console.log('\nStep 2: Verifying column in information_schema...');
    const checkRes1 = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'sourcing_companies'
        AND column_name = 'company_phone'
    `);
    if (checkRes1.rows.length !== 1) {
      throw new Error('company_phone column not found in sourcing_companies after first run');
    }
    console.log('  ✓ company_phone column exists:', checkRes1.rows[0]);

    // 3. Second execution (Idempotency test)
    console.log('\nStep 3: Re-applying migration 0192 (Second run - Idempotency)...');
    await client.query(sql);
    console.log('  ✓ Second run executed successfully without error');

    // 4. Test insert / select / update with company_phone on QA
    console.log('\nStep 4: Testing persistence of company_phone...');
    const insertRes = await client.query(`
      INSERT INTO public.sourcing_companies (company_name_kr, company_phone, status, grade)
      VALUES ('QA_PHONE_TEST_CO', '02-1234-5678', 'DRAFT', 'UNRATED')
      RETURNING id, company_name_kr, company_phone
    `);
    const testId = insertRes.rows[0].id;
    console.log('  ✓ Inserted row with company_phone:', insertRes.rows[0]);

    const selectRes = await client.query(`
      SELECT id, company_name_kr, company_phone
      FROM public.sourcing_companies
      WHERE id = $1
    `, [testId]);
    if (selectRes.rows[0].company_phone !== '02-1234-5678') {
      throw new Error(`Expected company_phone 02-1234-5678, got ${selectRes.rows[0].company_phone}`);
    }
    console.log('  ✓ Selected row verified');

    // Clean up test row
    await client.query(`DELETE FROM public.sourcing_companies WHERE id = $1`, [testId]);
    console.log('  ✓ Cleaned up test record');

    console.log('\n================================================================================');
    console.log('MIGRATION 0192 QA VERIFICATION PASSED (100%)');
    console.log('================================================================================');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Migration QA failed:', err);
  process.exit(1);
});
