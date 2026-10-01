const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const envVars = {};
env.split('\n').forEach(line => {
  const parts = line.split('=');
  const k = parts[0];
  const v = parts.slice(1).join('=');
  if (k && v) envVars[k.trim()] = v.trim().replace(/^["']|["']$/g, '');
});

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SECRET_KEY);

async function run() {
  const companyId = '4c845ae8-b93b-4db2-858f-bda3252e8167';
  const { data: apps, error } = await supabase.from('applications').select('*').eq('company_id', companyId);
  console.log('Applications for Brands Global Inc.:', apps?.length, apps, error);
}
run();
