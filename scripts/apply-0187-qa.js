const { Client } = require('pg');
const fs = require('fs');

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

if (qaDbUrl.includes('shzfrppdobpmrstcjfqu')) {
  console.error('❌ FATAL: Targeted production ref! Aborting.');
  process.exit(1);
}

const client = new Client({
  connectionString: qaDbUrl,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await client.connect();
  console.log('Connected to QA database elkgizqgksshukxgcndy');

  const sql = fs.readFileSync('supabase/migrations/0187_email_campaigns_dual_templates.sql', 'utf8');
  console.log('Applying 0187_email_campaigns_dual_templates.sql...');
  await client.query(sql);
  console.log('✅ 0187 applied successfully to QA.');

  // Verify columns
  const res1 = await client.query(`
    SELECT column_name, data_type, column_default 
    FROM information_schema.columns 
    WHERE table_name = 'marketing_campaigns' AND column_name = 'subject_override'
  `);
  console.log('marketing_campaigns.subject_override:', res1.rows[0]);

  const res2 = await client.query(`
    SELECT column_name, data_type, column_default 
    FROM information_schema.columns 
    WHERE table_name = 'marketing_templates' AND column_name = 'template_type'
  `);
  console.log('marketing_templates.template_type:', res2.rows[0]);

  await client.end();
  console.log('Done.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
