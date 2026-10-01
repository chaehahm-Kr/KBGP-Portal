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

async function generateCompanyShortCode(companyName, companyCode) {
  if (companyCode) {
    const code = companyCode.toUpperCase().replace(/[^A-Z0-9]/g, "").trim();
    if (code.startsWith("RET-")) {
      return "RET" + code.replace("RET-", "").substring(0, 3);
    }
    if (code.length >= 2) return code.substring(0, 5);
  }

  const cleanName = (companyName || "").toUpperCase().replace(/[^A-Z0-9\s-]/g, "").trim();
  if (!cleanName) return "CMP";

  const words = cleanName.split(/[\s-]+/).filter(Boolean);
  if (words.length >= 3) {
    return (words[0][0] + words[1][0] + words[2][0]).substring(0, 5);
  } else if (words.length === 2) {
    const w1 = words[0];
    const w2 = words[1];
    return (w1.substring(0, 2) + w2[0]).substring(0, 5);
  } else if (words.length === 1 && words[0].length >= 3) {
    return words[0].substring(0, 3);
  } else if (words.length === 1 && words[0].length > 0) {
    return (words[0] + "X").substring(0, 3);
  }

  return "CMP";
}

async function testRetailerAgreement() {
  const companyId = 'dc9249be-a9e0-4975-a4c9-b602bb2baa47';
  console.log('Testing retailer agreement for companyId:', companyId);

  // 1. Fetch company
  const { data: comp, error: compErr } = await admin
    .from('companies')
    .select('id, name, country, contact_name, contact_phone, intro, company_code')
    .eq('id', companyId)
    .single();
  console.log('comp:', comp, 'compErr:', compErr);

  // 2. Fetch active template
  const { data: tmpl, error: tmplErr } = await admin
    .from('agreement_templates')
    .select('id, version, name, agreement_type, status')
    .eq('agreement_type', 'RETAILER')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  console.log('tmpl:', tmpl, 'tmplErr:', tmplErr);

  // 3. Short code
  const shortCode = await generateCompanyShortCode(comp.name, comp.company_code);
  console.log('Generated shortCode:', shortCode);

  // 4. Fetch existing agreement
  const { data: caList, error: caErr } = await admin
    .from('company_agreements')
    .select('*, agreement_templates(id, name, version, agreement_type)')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });
  console.log('Existing caList:', caList);
}

testRetailerAgreement().catch(console.error);
