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

const { createClient } = require('@supabase/supabase-js');
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://shzfrppdobpmrstcjfqu.supabase.co',
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log('=== 1. Checking Companies with name or retailer_code ===');
  const { data: companies, error: errComp } = await sb.from('companies').select('*').ilike('name', '%Retailer%');
  console.log('Companies:', companies, 'Error:', errComp);

  console.log('\n=== 2. Checking Retailer Profiles ===');
  const { data: rp, error: errRp } = await sb.from('retailer_profiles').select('*');
  console.log('retailer_profiles:', rp, 'Error:', errRp);

  console.log('\n=== 3. Checking all company_users ===');
  const { data: cu, error: errCu } = await sb.from('company_users').select('*').limit(10);
  console.log('sample company_users:', cu, 'Error:', errCu);

  console.log('\n=== 4. Checking Agreement Templates ===');
  const { data: at, error: errAt } = await sb.from('agreement_templates').select('*');
  console.log('agreement_templates:', at, 'Error:', errAt);

  console.log('\n=== 5. Checking Company Agreements ===');
  const { data: ca, error: errCa } = await sb.from('company_agreements').select('*');
  console.log('company_agreements:', ca, 'Error:', errCa);
}

main().catch(console.error);
