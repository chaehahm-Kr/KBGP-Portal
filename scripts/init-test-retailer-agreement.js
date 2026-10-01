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

async function test() {
  const companyId = 'dc9249be-a9e0-4975-a4c9-b602bb2baa47';
  console.log('=== Testing retailer agreement initialization for companyId', companyId, '===');

  // 1. Fetch company
  const { data: comp, error: compErr } = await admin
    .from('companies')
    .select('id, name, country, contact_name, contact_phone, intro, company_code')
    .eq('id', companyId)
    .single();
  console.log('Company:', comp?.name, 'Code:', comp?.company_code);

  // 2. Fetch active template
  const { data: tmpl, error: tmplErr } = await admin
    .from('agreement_templates')
    .select('id, version, name, agreement_type, status')
    .eq('agreement_type', 'RETAILER')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  console.log('Active Retailer Template:', tmpl?.name, 'Version:', tmpl?.version);

  // 3. Fetch company agreements
  const { data: caList, error: caErr } = await admin
    .from('company_agreements')
    .select('*, agreement_templates(id, name, version, agreement_type)')
    .eq('company_id', companyId);
  console.log('Existing caList length:', caList?.length);

  // 4. If empty, create pending agreement
  if (caList.length === 0 && tmpl) {
    const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
    let suffix = "";
    for (let i = 0; i < 4; i++) suffix += chars.charAt(Math.floor(Math.random() * chars.length));
    const agreementId = `KSN-AGR-RET00-26-${suffix}`;

    console.log('Creating pending agreement with ID:', agreementId);
    const { data: newCa, error: createErr } = await admin
      .from('company_agreements')
      .insert({
        company_id: companyId,
        template_id: tmpl.id,
        agreement_id: agreementId,
        version: tmpl.version || '1.0',
        status: 'pending',
      })
      .select('*, agreement_templates(id, name, version, agreement_type)')
      .single();

    console.log('Created pending agreement:', newCa, 'Error:', createErr);
  }
}

test().catch(console.error);
