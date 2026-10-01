const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

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

const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: { users } } = await client.auth.admin.listUsers();
  const testUser = users.find(u => u.email === 'qa-portal-test@letusto.com');
  console.log('Test user auth:', testUser ? {
    id: testUser.id,
    email: testUser.email,
    app_metadata: testUser.app_metadata,
    user_metadata: testUser.user_metadata
  } : 'not found');

  if (testUser) {
    const { data: prof, error: pe } = await client.from('profiles').select('*').eq('id', testUser.id).maybeSingle();
    console.log('profiles:', prof, pe?.message);

    const { data: compUser, error: ce } = await client.from('company_users').select('*').eq('user_id', testUser.id).maybeSingle();
    console.log('company_users:', compUser, ce?.message);

    const { data: staff, error: se } = await client.from('staff').select('*').eq('id', testUser.id).maybeSingle();
    console.log('staff:', staff, se?.message);
  }
}

run();
