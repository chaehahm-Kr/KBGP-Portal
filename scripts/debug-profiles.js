const fs = require('fs');
const path = require('path');

const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envText = fs.readFileSync(envPath, 'utf8');
  envText.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || '';
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
      process.env[key] = value.trim();
    }
  });
}

const { createClient } = require('@supabase/supabase-js');
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://shzfrppdobpmrstcjfqu.supabase.co',
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const { data: users } = await sb.auth.admin.listUsers();
  const u = users?.users?.find(x => x.email === 'tammyhahm77@gmail.com');
  console.log('auth.users:', u ? { id: u.id, email: u.email } : 'NOT FOUND');

  const { data: cu, error: cuErr } = await sb.from('company_users').select('*').eq('email', 'tammyhahm77@gmail.com');
  console.log('company_users by email:', cu);

  if (u) {
    const { data: cuById } = await sb.from('company_users').select('*').eq('id', u.id);
    console.log('company_users by auth id:', cuById);

    const { data: prof } = await sb.from('profiles').select('*').eq('id', u.id);
    console.log('profiles by auth id:', prof);
  }
}

main().catch(console.error);
