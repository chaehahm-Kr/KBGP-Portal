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

async function inspectSpecific() {
  const targetIds = [
    '9f37ece5-e164-4357-9ecb-3982ee118ad4', // John
    '0ec853ef-45dc-4f8f-aa63-59debeaf4af1', // Carmel
    '053723dd-aa07-4200-9406-7b8773dd323e', // Carmel2
  ];

  for (const id of targetIds) {
    const { data: comp } = await admin.from('companies').select('*').eq('id', id).single();
    console.log(`\n======================================================`);
    console.log(`COMPANY: ${comp?.name} (${comp?.id}) created_at: ${comp?.created_at}`);
    console.log(`======================================================`);

    const { data: cUsers } = await admin.from('company_users').select('*').eq('company_id', id);
    console.log(`company_users:`, cUsers?.map(u => ({ id: u.id, user_id: u.user_id, email: u.email, name: u.name })));

    const userIds = (cUsers || []).map(u => u.user_id).filter(Boolean);
    const emails = (cUsers || []).map(u => u.email).filter(Boolean);

    const { data: brands } = await admin.from('brands').select('*').eq('company_id', id);
    console.log(`brands:`, brands?.map(b => ({ id: b.id, name: b.name })));

    const { data: products } = await admin.from('products').select('id, name, display_name, letusto_sku, manufacture_sku').eq('company_id', id);
    console.log(`products:`, products);

    const { data: apps } = await admin.from('brand_applications').select('id, application_no, company_name, email').eq('company_id', id);
    console.log(`brand_applications:`, apps);

    const { data: allApps } = await admin.from('brand_applications').select('id, application_no, company_name, email');
    const matchingApps = (allApps || []).filter(a => (a.company_name && a.company_name.toLowerCase().includes(comp?.name?.toLowerCase())) || emails.includes(a.email));
    console.log(`matching brand_applications by name/email:`, matchingApps);

    const { data: invites } = await admin.from('company_invitations').select('id, email, role').eq('company_id', id);
    console.log(`company_invitations:`, invites);

    const { data: agreements } = await admin.from('company_agreements').select('id, agreement_id, status, signer_name, signer_email').eq('company_id', id);
    console.log(`company_agreements:`, agreements);

    const { data: inqs } = await admin.from('partner_inquiries').select('id, case_number, title, status').eq('company_id', id);
    console.log(`partner_inquiries:`, inqs);
  }
}

inspectSpecific().catch(console.error);
