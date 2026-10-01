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

async function testCompanySelect() {
  console.log('Testing select("name, company_name_ko, company_name_en"):');
  const res1 = await admin.from('companies').select('name, company_name_ko, company_name_en').eq('id', '4c845ae8-b93b-4db2-858f-bda3252e8167').maybeSingle();
  console.log('Res1 error:', res1.error);
  console.log('Res1 data:', res1.data);

  console.log('\nTesting select("name"):');
  const res2 = await admin.from('companies').select('name').eq('id', '4c845ae8-b93b-4db2-858f-bda3252e8167').maybeSingle();
  console.log('Res2 error:', res2.error);
  console.log('Res2 data:', res2.data);
}

testCompanySelect().catch(console.error);
