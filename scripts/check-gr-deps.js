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

async function checkGRDeps() {
  const grId = '373e98de-8d95-4fed-9e95-4dca58b94eb5';
  const grLineId = '463a8be1-e853-4ec4-a7cc-15674f461cbd';

  const { data: inbWithGR } = await admin.from('inbound_shipment_lines').select('*').eq('goods_readiness_line_id', grLineId);
  console.log("inbound_shipment_lines with goods_readiness_line_id:", inbWithGR);

  const { error: dGRLines } = await admin.from('goods_readiness_lines').delete().eq('id', grLineId);
  console.log("dGRLines err:", dGRLines);

  const { error: dGR } = await admin.from('goods_readiness').delete().eq('id', grId);
  console.log("dGR err:", dGR);

  const { error: dPOLines } = await admin.from('purchase_order_lines').delete().eq('purchase_order_id', '2f378a31-c186-4413-a932-e2e07d6bed4f');
  console.log("dPOLines err:", dPOLines);

  const { error: dPOs } = await admin.from('purchase_orders').delete().eq('id', '2f378a31-c186-4413-a932-e2e07d6bed4f');
  console.log("dPOs err:", dPOs);

  const { error: dProds } = await admin.from('products').delete().eq('id', '4fcaeb00-8dcf-4743-be68-9bd697881847');
  console.log("dProds err:", dProds);

  const { error: dBrands } = await admin.from('brands').delete().eq('id', '3f8f1299-3da4-4397-8566-d7ed634d7a95');
  console.log("dBrands err:", dBrands);

  const { data: dComps, error: dCompsErr } = await admin.from('companies').delete().in('id', [
    '9f37ece5-e164-4357-9ecb-3982ee118ad4',
    '0ec853ef-45dc-4f8f-aa63-59debeaf4af1',
    '053723dd-aa07-4200-9406-7b8773dd323e'
  ]).select('id, name');
  console.log("dComps:", dComps, "err:", dCompsErr);
}

checkGRDeps().catch(console.error);
