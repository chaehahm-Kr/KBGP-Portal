const fs = require('fs');
const path = require('path');
const envFile = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = (match[2] || '').trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    env[match[1]] = value;
  }
});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY);

async function testSignupVerification() {
  const brn = '123456789';
  const email = 'tammyhahm77@gmail.com';

  const { data: allCompanies } = await supabase
    .from('companies')
    .select('id, name, business_registration_number, contact_name');

  const sanitizedBrn = brn.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  const matched = allCompanies.filter(c => (c.business_registration_number || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === sanitizedBrn);

  console.log('Matched company:', matched);

  const companyIds = matched.map(c => c.id);
  const { data: users } = await supabase
    .from('company_users')
    .select('id, name, email, status, invited_at, company_role, company_id')
    .in('company_id', companyIds);

  const matchedUser = users.find(u => u.email.toLowerCase() === email.toLowerCase());
  console.log('Matched user:', matchedUser);

  if (matchedUser.status === 'invited' && matchedUser.invited_at) {
    console.log('Verification check: PASS (Case D - Ready to activate and set password)');
  } else {
    console.log('Verification check: FAIL - Unexpected state:', matchedUser);
  }
}

testSignupVerification();
