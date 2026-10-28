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

async function main() {
  await client.connect();
  console.log('================================================================================');
  console.log('ADM-BSRC-010: Apply Migration 0189 to QA Database');
  console.log('Target QA DB: elkgizqgksshukxgcndy');
  console.log('================================================================================\n');

  // Check current schema_migrations
  const { rows: migrations } = await client.query(`
    SELECT version FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 10;
  `);
  console.log('Latest migrations in QA:', migrations.map(m => m.version));

  // Check 0188 status
  const has0188 = migrations.some(m => m.version.includes('0188'));
  if (!has0188 && fs.existsSync('supabase/migrations/0188_marketing_footer_and_assets.sql')) {
    console.log('Applying 0188 to QA first...');
    const sql0188 = fs.readFileSync('supabase/migrations/0188_marketing_footer_and_assets.sql', 'utf8');
    await client.query('BEGIN');
    try {
      await client.query(sql0188);
      await client.query(`
        INSERT INTO supabase_migrations.schema_migrations (version)
        VALUES ('0188_marketing_footer_and_assets')
        ON CONFLICT DO NOTHING;
      `);
      await client.query('COMMIT');
      console.log('✓ Migration 0188 applied to QA.');
    } catch (err: any) {
      await client.query('ROLLBACK');
      console.error('Migration 0188 failed:', err.message);
    }
  }

  // Apply 0189
  const sql0189Path = 'supabase/migrations/0189_brand_sourcing_duplicate_prevention.sql';
  console.log(`\nApplying migration ${sql0189Path} to QA...`);
  const sql0189 = fs.readFileSync(sql0189Path, 'utf8');

  await client.query('BEGIN');
  try {
    await client.query(sql0189);
    await client.query(`
      INSERT INTO supabase_migrations.schema_migrations (version)
      VALUES ('0189_brand_sourcing_duplicate_prevention')
      ON CONFLICT DO NOTHING;
    `);
    await client.query('COMMIT');
    console.log('✓ Migration 0189 applied and committed successfully to QA DB!\n');
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('❌ Migration 0189 failed, rolled back:', err.message);
    throw err;
  }

  // Verify Schema in QA
  console.log('--- VERIFYING SCHEMA IN QA ---');
  const { rows: colsSources } = await client.query(`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_name = 'sourcing_sources' AND column_name = 'canonical_source_url';
  `);
  console.log('sourcing_sources.canonical_source_url:', colsSources);

  const { rows: colsComp } = await client.query(`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_name = 'sourcing_companies' AND column_name IN ('normalized_name_kr', 'normalized_name_en');
  `);
  console.log('sourcing_companies normalized columns:', colsComp);

  const { rows: excTable } = await client.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_name = 'sourcing_duplicate_exceptions';
  `);
  console.log('sourcing_duplicate_exceptions table exists:', excTable.length > 0);

  const { rows: indexes } = await client.query(`
    SELECT indexname, indexdef FROM pg_indexes
    WHERE tablename IN ('sourcing_sources', 'sourcing_companies', 'sourcing_duplicate_exceptions')
      AND indexname IN ('uq_sourcing_sources_canonical_url', 'idx_sourcing_companies_normalized_name_kr', 'idx_sourcing_dup_exceptions_company_id');
  `);
  console.log('Indexes created:', indexes.map(i => i.indexname));

  await client.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
