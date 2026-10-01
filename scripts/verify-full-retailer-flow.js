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

async function verifyFullRetailerFlow() {
  const companyId = 'dc9249be-a9e0-4975-a4c9-b602bb2baa47';
  console.log('=== Step 1: Checking K SELECT Test Retailer Company & Agreement in DB ===');
  
  const { data: comp } = await admin.from('companies').select('*').eq('id', companyId).single();
  console.log('Company:', comp.name, 'Code:', comp.company_code);

  const { data: caList } = await admin
    .from('company_agreements')
    .select('*, agreement_templates(*)')
    .eq('company_id', companyId);
  console.log('Agreements for company:', caList.map(ca => ({
    id: ca.id,
    agreement_id: ca.agreement_id,
    status: ca.status,
    version: ca.version,
    template: ca.agreement_templates?.name,
    type: ca.agreement_templates?.agreement_type
  })));

  console.log('\n=== Step 2: Verifying Storage Access ===');
  const { data: buckets } = await admin.storage.listBuckets();
  console.log('Available buckets:', buckets.map(b => b.name));

  console.log('\n=== Step 3: Verifying Recipients & Audit Logs for Agreement ===');
  if (caList.length > 0) {
    const caId = caList[0].id;
    const { data: recs } = await admin.from('company_agreement_recipients').select('*').eq('company_agreement_id', caId);
    console.log('Recipients count:', recs?.length || 0);

    const { data: logs } = await admin.from('agreement_audit_logs').select('*').eq('company_agreement_id', caId);
    console.log('Audit logs count:', logs?.length || 0);
  }
}

verifyFullRetailerFlow().catch(console.error);
