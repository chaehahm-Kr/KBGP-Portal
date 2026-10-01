import { createAdminClient } from '../lib/supabase/admin';

async function main() {
  const supabase = createAdminClient();

  console.log('--- Inspecting user support@letusto.com ---');
  const { data: user, error: uErr } = await supabase
    .from('company_users')
    .select('*, companies(*)')
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

  console.log('\n--- All users in Beauty Maker 33 ---');
  if (user?.company_id) {
    const { data: team } = await supabase
      .from('company_users')
      .select('id, email, name, company_role, status, permissions')
      .eq('company_id', user.company_id);
    console.log('Team Members:', JSON.stringify(team, null, 2));
  }
}

main().catch(console.error);
