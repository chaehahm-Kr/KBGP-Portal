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

async function testAuthUsers() {
  console.log('=== 1. FETCH CARMEL2 USERS ===');
  const { data: comp } = await admin.from('companies').select('id, name').ilike('name', '%Carmel2%').single();
  console.log('Carmel2 company:', comp);

  const { data: cUsers } = await admin.from('company_users').select('*').eq('company_id', comp.id);
  console.log('Carmel2 company_users:', cUsers.map(u => ({ id: u.id, name: u.name, email: u.email })));

  console.log('\n=== 2. FETCH AUTH USERS IN BATCH ===');
  const { data: authData, error: authErr } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (authErr) {
    console.error('listUsers error:', authErr);
    return;
  }

  const authMapById = new Map();
  const authMapByEmail = new Map();
  authData.users.forEach(u => {
    authMapById.set(u.id, u);
    if (u.email) authMapByEmail.set(u.email.toLowerCase().trim(), u);
  });

  for (const cu of cUsers) {
    const authUser = authMapById.get(cu.id) || (cu.email ? authMapByEmail.get(cu.email.toLowerCase().trim()) : null);
    console.log(`User: ${cu.name} (${cu.email}) -> last_sign_in_at: ${authUser?.last_sign_in_at || null}`);
  }

  console.log('\n=== 3. EXTREME INC. USER TEST ===');
  const extremeUser = authMapByEmail.get('tammyhahm77@gmail.com');
  console.log('tammyhahm77@gmail.com last_sign_in_at:', extremeUser?.last_sign_in_at);
}

testAuthUsers().catch(console.error);
