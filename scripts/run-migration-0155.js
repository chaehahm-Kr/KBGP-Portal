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
  console.log('Running migration 0155_product_media_assets_foundation.sql via exec_sql RPC...');

  const sql = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'migrations', '0155_product_media_assets_foundation.sql'), 'utf8');

  const { data: rpcRes, error: rpcErr } = await admin.rpc('exec_sql', { sql_query: sql });
  console.log('RPC exec_sql result:', rpcRes, 'RPC error:', rpcErr);

  console.log('\n=== VERIFYING TABLES AFTER MIGRATION 0155 ===');
  
  const { data: sources, error: sErr } = await admin
    .from('product_media_sources')
    .select('*')
    .limit(1);
  console.log('product_media_sources table test:', sources, sErr);

  const { data: assets, error: aErr } = await admin
    .from('product_media_assets')
    .select('*')
    .limit(1);
  console.log('product_media_assets table test:', assets, aErr);

  const { data: jobs, error: jErr } = await admin
    .from('product_media_generation_jobs')
    .select('*')
    .limit(1);
  console.log('product_media_generation_jobs table test:', jobs, jErr);

  if (sErr || aErr || jErr) {
    throw new Error('Table verification failed after migration 0155');
  }

  console.log('SUCCESS: Migration 0155 applied and schema verified!');
}

main().catch(err => {
  console.error('Migration 0155 failed:', err);
  process.exit(1);
});
