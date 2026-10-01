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

async function listAllAuthUsers() {
  const { data: authList, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) {
    console.error("Error fetching auth users:", error);
    return;
  }
  
  console.log(`Total Auth Users: ${authList.users.length}`);
  console.table(authList.users.map(u => ({
    id: u.id,
    email: u.email,
    name: u.user_metadata?.display_name || u.user_metadata?.full_name || u.user_metadata?.name,
    role: u.user_metadata?.role || u.app_metadata?.role,
    created_at: u.created_at,
    last_sign_in_at: u.last_sign_in_at
  })));
}

listAllAuthUsers().catch(console.error);
