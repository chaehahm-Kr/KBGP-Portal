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

async function diagnose() {
  console.log('=== TEST 1: Select with companies!company_users_company_id_fkey ===');
  const { data: userWithFkey, error: fkeyErr } = await admin
    .from('company_users')
    .select('id, company_id, name, email, company_role, status, title, position, phone, is_primary, permissions, created_at, joined_at, companies!company_users_company_id_fkey(id, name)')
    .eq('email', 'tammyhahm77@gmail.com')
    .single();

  console.log('User with explicit fkey:', userWithFkey, 'Error:', fkeyErr);

  console.log('=== TEST 2: Select directly from company_users, then fetch company ===');
  const { data: userDirect, error: directErr } = await admin
    .from('company_users')
    .select('id, company_id, name, email, company_role, status, title, position, phone, is_primary, permissions, created_at, joined_at')
    .eq('email', 'tammyhahm77@gmail.com')
    .single();

  console.log('User direct:', userDirect, 'Error:', directErr);

  if (userDirect?.company_id) {
    const { data: comp } = await admin.from('companies').select('id, name').eq('id', userDirect.company_id).single();
    console.log('Company:', comp);
  }
}

diagnose().catch(console.error);
