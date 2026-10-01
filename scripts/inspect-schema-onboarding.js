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

async function check() {
  const companyId = '7d669d13-1c62-494e-a520-c2133348edbe'; // Extreme Inc.

  const { data: comp } = await supabase.from('companies').select('*').eq('id', companyId).single();
  console.log('--- COMPANY ---');
  console.log(comp);

  const { data: brands } = await supabase.from('brands').select('*').eq('company_id', companyId);
  console.log('--- BRANDS ---');
  console.log(brands);

  const { data: products } = await supabase.from('products').select('*').eq('company_id', companyId);
  console.log('--- PRODUCTS ---');
  console.log(products);

  const { data: agreements } = await supabase.from('company_agreements').select('*').eq('company_id', companyId);
  console.log('--- AGREEMENTS ---');
  console.log(agreements);

  const { data: users } = await supabase.from('company_users').select('*').eq('company_id', companyId);
  console.log('--- COMPANY USERS ---');
  console.log(users);
}

check();
