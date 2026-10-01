const { createClient } = require('@supabase/supabase-js');
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

const supabaseUrl = 'https://shzfrppdobpmrstcjfqu.supabase.co';
const supabaseSecretKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
const supabase = createClient(supabaseUrl, supabaseSecretKey);

async function main() {
  console.log('--- Inspecting user support@letusto.com ---');
  const { data: user, error: uErr } = await supabase
    .from('company_users')
    .select('*, companies!company_users_company_id_fkey(*)')
    .eq('email', 'support@letusto.com')
    .maybeSingle();

  if (uErr) {
    console.error('Error fetching company_user:', uErr);
    return;
  }

  console.log('Company User Record:');
  console.log(JSON.stringify(user, null, 2));

  console.log('\n--- Searching for Company "Beauty Maker 33" ---');
  const { data: companies, error: cErr } = await supabase
    .from('companies')
    .select('id, name, company_name_ko, company_name_en')
    .ilike('name', '%Beauty Maker%');
  console.log('Companies:', companies);

  if (user?.company_id) {
    console.log('\n--- All users in Beauty Maker 33 ---');
    const { data: team } = await supabase
      .from('company_users')
      .select('id, email, name, company_role, status, permissions')
      .eq('company_id', user.company_id);
    console.log('Team Members:', JSON.stringify(team, null, 2));
  }
}

main().catch(console.error);
