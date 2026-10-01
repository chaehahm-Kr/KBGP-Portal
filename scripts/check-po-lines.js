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

async function checkPOLines() {
  const { data: poLines } = await admin.from('purchase_order_lines').select('*').eq('product_id', '4fcaeb00-8dcf-4743-be68-9bd697881847');
  console.log("purchase_order_lines with test product:", poLines);

  const poIds = (poLines || []).map(l => l.po_id);
  if (poIds.length > 0) {
    const { data: pos } = await admin.from('purchase_orders').select('*').in('id', poIds);
    console.log("purchase_orders associated with these lines:", pos);
  }
}

checkPOLines().catch(console.error);
