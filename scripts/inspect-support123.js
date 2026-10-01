const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envText = fs.readFileSync('.env.local', 'utf8');
const env = {};
envText.split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '');
});

const url = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(url, key);

async function check() {
  const { data: users, error: uErr } = await supabase.auth.admin.listUsers();
  const targetUser = users?.users?.find(u => u.email === 'support123@letusto.com');
  console.log('Target Auth User:', targetUser ? { id: targetUser.id, email: targetUser.email, metadata: targetUser.user_metadata } : 'Not found');
  
  if (targetUser) {
    const { data: cu, error: cuErr } = await supabase.from('company_users').select('*').eq('user_id', targetUser.id);
    console.log('company_users for target user:', JSON.stringify(cu, null, 2));
    
    if (cu && cu.length > 0) {
      for (const row of cu) {
        const { data: comp } = await supabase.from('companies').select('id, name, partner_type').eq('id', row.company_id).single();
        console.log('Company:', comp);
      }
    }
  }
}
check();
