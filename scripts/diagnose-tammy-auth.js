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

async function check() {
  const { data: authUsers, error: authErr } = await admin.auth.admin.listUsers();
  const tammyAuth = authUsers.users.find(u => u.email === 'tammyhahm77@gmail.com');
  console.log('AUTH USER:', tammyAuth ? { id: tammyAuth.id, email: tammyAuth.email, user_metadata: tammyAuth.user_metadata } : 'Not found');

  const { data: cuList, error: cuErr } = await admin.from('company_users').select('*').ilike('email', '%tammyhahm77%');
  console.log('COMPANY USERS LIST for tammy:', cuList);

  if (tammyAuth) {
    const { data: profiles } = await admin.from('profiles').select('*').eq('id', tammyAuth.id);
    console.log('PROFILES for tammyAuth.id:', profiles);

    const { data: cuByAuthId } = await admin.from('company_users').select('*').eq('id', tammyAuth.id);
    console.log('COMPANY USERS by auth id:', cuByAuthId);
  }

  // Also check all company_users
  const { data: allCu } = await admin.from('company_users').select('id, company_id, name, email, title, position, phone, permissions');
  console.log('ALL COMPANY USERS:', allCu);
}

check().catch(console.error);
