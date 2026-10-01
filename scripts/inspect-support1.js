const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envText = fs.readFileSync(envPath, 'utf8');
  envText.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let v = match[2] || '';
      if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
      if (v.startsWith("'") && v.endsWith("'")) v = v.slice(1, -1);
      process.env[match[1]] = v.trim();
    }
  });
}

const admin = createClient('https://shzfrppdobpmrstcjfqu.supabase.co', process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY);

async function inspectSupport1() {
  console.log('=== Inspecting support1@letusto.com in Production ===');
  const targetEmail = 'support1@letusto.com';
  
  // 1. Auth Users
  const { data: authUsers } = await admin.auth.admin.listUsers();
  const authUser = authUsers?.users?.find(u => u.email === targetEmail);
  console.log('Auth User:', authUser ? { id: authUser.id, email: authUser.email, created_at: authUser.created_at } : 'NOT FOUND');

  // 2. company_users table
  const { data: cuRecords } = await admin.from('company_users').select('*, companies!company_users_company_id_fkey(name)').eq('email', targetEmail);
  console.log('company_users Records:', JSON.stringify(cuRecords, null, 2));

  // 3. Let's check company Beauty Maker 33 users
  const { data: bmUsers } = await admin.from('company_users').select('id, name, email, company_role, status').eq('company_id', 'a41d3721-9775-4448-9265-278c02b92aa1');
  console.log('Beauty Maker 33 Team Members:', JSON.stringify(bmUsers, null, 2));
}

inspectSupport1().catch(console.error);
