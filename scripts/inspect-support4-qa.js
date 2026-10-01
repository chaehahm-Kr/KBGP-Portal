const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envText = fs.readFileSync(envPath, 'utf8');
  envText.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let value = match[2] || '';
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
      process.env[match[1]] = value.trim();
    }
  });
}

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://shzfrppdobpmrstcjfqu.supabase.co', process.env.SUPABASE_SECRET_KEY);

async function inspect() {
  console.log('=== INSPECTING SUPPORT4 & ACCOUNT USERS ===');
  const { data: users, error } = await admin
    .from('company_users')
    .select('*, companies:companies!company_users_company_id_fkey(*)')
    .in('email', ['support4@letusto.com', 'account@letusto.com', 'legal@letusto.com']);

  if (error) console.error('Error fetching users:', error);
  console.log('Found users in company_users:');
  console.log(JSON.stringify(users, null, 2));

  // Check auth users
  const { data: authData } = await admin.auth.admin.listUsers();
  const foundAuth = authData?.users?.filter(u => ['support4@letusto.com', 'account@letusto.com'].includes(u.email));
  console.log('Found Auth users:', JSON.stringify(foundAuth, null, 2));
}

inspect().catch(console.error);
