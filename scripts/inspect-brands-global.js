const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const envVars = {};
const lines = env.split('\n');
for (const line of lines) {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let key = match[1];
    let value = match[2] || '';
    if (value.length > 0 && value.charAt(0) === '"' && value.charAt(value.length - 1) === '"') {
      value = value.replace(/^"|"$/g, '');
    }
    if (value.length > 0 && value.charAt(0) === "'" && value.charAt(value.length - 1) === "'") {
      value = value.replace(/^'|'$/g, '');
    }
    envVars[key] = value.trim();
  }
}

const { createClient } = require('@supabase/supabase-js');
const supabaseKey = envVars.SUPABASE_SECRET_KEY || envVars.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, supabaseKey);

async function run() {
  const companyId = '4c845ae8-b93b-4db2-858f-bda3252e8167';
  const { data: comp } = await supabase.from('companies').select('*').eq('id', companyId).single();
  console.log('Company:', comp?.name);

  const { data: brands } = await supabase.from('brands').select('id, name').eq('company_id', companyId);
  console.log('Brands:', brands?.length, brands?.map(b => b.name));

  const { data: products } = await supabase.from('products').select('id, name').eq('company_id', companyId);
  console.log('Products:', products?.length, products?.map(p => p.name));

  const { data: pos } = await supabase.from('purchase_orders').select('id, po_number, po_status').eq('supplier_id', companyId);
  console.log('POs:', pos?.length, pos?.map(p => p.po_number));

  const { data: invs } = await supabase.from('supplier_invoices').select('id, invoice_number').eq('company_id', companyId);
  console.log('Invoices:', invs?.length);

  const { data: inqs } = await supabase.from('partner_inquiries').select('id, title').eq('company_id', companyId);
  console.log('Inquiries:', inqs?.length, inqs?.map(i => i.title));
}
run();
