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
  console.error('Safety violation or QA_DATABASE_URL not found');
  process.exit(1);
}

const client = new Client({
  connectionString: qaDbUrl,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  await client.connect();
  console.log('Connected to QA DB (elkgizqgksshukxgcndy)');

  // 1. Schema migrations
  try {
    const migs = await client.query('SELECT version FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 15;');
    console.log('Recent applied QA migrations:\n', migs.rows.map((r: any) => r.version).join('\n'));
  } catch (e: any) {
    console.log('schema_migrations query error:', e.message);
  }

  // 2. Check marketing / sourcing tables
  const tables = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND (table_name LIKE 'marketing%' OR table_name LIKE 'sourcing%')
    ORDER BY table_name;
  `);
  console.log('\nRelevant tables in QA public schema:\n', tables.rows.map((r: any) => r.table_name).join('\n'));

  // 3. Check columns in sourcing_companies
  const cols = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'sourcing_companies'
    ORDER BY ordinal_position;
  `);
  console.log('\nsourcing_companies columns in QA:\n', cols.rows.map((r: any) => `${r.column_name} (${r.data_type})`).join('\n'));

  await client.end();
}

main().catch(err => {
  console.error('QA inspection failed:', err.message);
  process.exit(1);
});
