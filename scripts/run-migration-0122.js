const fs = require('fs');
const path = require('path');
const envFile = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = (match[2] || '').trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    env[match[1]] = value;
  }
});
const { createClient } = require('@supabase/supabase-js');
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  console.log('Running migration 0122...');

  const sql = `
    ALTER TABLE public.company_users 
      ADD COLUMN IF NOT EXISTS english_name text;

    COMMENT ON COLUMN public.company_users.english_name IS 'Official English legal/business name used for POs, Invoices, English agreements, and shipping/export documents.';
  `;

  const { data: rpcRes, error: rpcErr } = await admin.rpc('exec_sql', { sql_query: sql });
  console.log('RPC result:', rpcRes, 'RPC error:', rpcErr);

  const { data: cu, error: cuErr } = await admin.from('company_users').select('id, name, english_name, email').limit(3);
  console.log('Test select english_name from company_users:', cu, cuErr);
}

main().catch(console.error);
