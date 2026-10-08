const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envText = fs.readFileSync('.env.local', 'utf8');
const env = {};
envText.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    env[match[1]] = value.trim();
  }
});

const adminClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY);

async function checkFK() {
  const res = await adminClient
    .from('company_users')
    .select('company_id, company_role, companies!company_users_company_id_fkey(id, name)')
    .eq('id', '7c3c4899-fa85-4cf0-94c8-6d497b36f82f')
    .maybeSingle();

  console.log('Result with explicit FK:', res);
}

checkFK().catch(console.error);
