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
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://shzfrppdobpmrstcjfqu.supabase.co',
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testAdmin360() {
  const companyId = 'dc9249be-a9e0-4975-a4c9-b602bb2baa47';
  console.log('Testing Admin Retailer 360 agreements for companyId:', companyId);

  const { data: caList, error: caErr } = await admin
    .from('company_agreements')
    .select('*, agreement_templates(id, name, version, agreement_type)')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });

  console.log('Admin 360 caList:', caList);
}

testAdmin360().catch(console.error);
