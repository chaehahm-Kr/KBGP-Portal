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
const admin = createClient(supabaseUrl, serviceKey);

async function main() {
  console.log('Running migration 0156_product_faqs_foundation.sql via exec_sql RPC...');

  const sql = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'migrations', '0156_product_faqs_foundation.sql'), 'utf8');

  const { data: rpcRes, error: rpcErr } = await admin.rpc('exec_sql', { sql_query: sql });
  console.log('RPC exec_sql result:', rpcRes, 'RPC error:', rpcErr);

  console.log('\n=== VERIFYING PRODUCT_FAQS AFTER MIGRATION 0156 ===');
  const { data: faqs, error: fErr } = await admin
    .from('product_faqs')
    .select('id, product_id, question, answer, category, audience, status')
    .limit(5);

  if (fErr) {
    console.error('Error querying product_faqs after migration:', fErr);
    process.exit(1);
  } else {
    console.log(`Successfully verified product_faqs table. Current row count: ${faqs.length}`);
  }
}

main().catch(err => {
  console.error('Migration 0156 failed:', err);
  process.exit(1);
});
