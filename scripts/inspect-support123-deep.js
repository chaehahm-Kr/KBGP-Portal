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
  const uid = '40e4d4ac-ec2c-49b3-bbd9-aafd686206de';
  
  console.log('--- checking profiles ---');
  const { data: profiles } = await supabase.from('profiles').select('*').eq('id', uid);
  console.log('profiles:', profiles);

  console.log('--- checking company_users by email or user_id ---');
  const { data: cuAll } = await supabase.from('company_users').select('*').or(`user_id.eq.${uid},email.eq.support123@letusto.com`);
  console.log('company_users:', cuAll);

  console.log('--- checking companies by business_registration_number or contact_email ---');
  const { data: comp } = await supabase.from('companies').select('id, name, partner_type, contact_email, business_registration_number').ilike('contact_email', '%support123%');
  console.log('companies by contact_email:', comp);

  console.log('--- checking all company_users table sample ---');
  const { data: sampleCU } = await supabase.from('company_users').select('*').limit(5);
  console.log('sampleCU:', sampleCU);
}
check();
