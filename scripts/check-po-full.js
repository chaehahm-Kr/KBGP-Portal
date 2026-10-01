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

async function checkPO() {
  const { data: po } = await admin.from('purchase_orders').select('*').eq('id', '2f378a31-c186-4413-a932-e2e07d6bed4f');
  console.log("PO 2f378a31-c186-4413-a932-e2e07d6bed4f:", po);

  const { data: docs } = await admin.from('po_shipping_documents').select('*').eq('po_id', '2f378a31-c186-4413-a932-e2e07d6bed4f');
  console.log("po_shipping_documents:", docs);

  const { data: revs } = await admin.from('po_revisions').select('*').eq('po_id', '2f378a31-c186-4413-a932-e2e07d6bed4f');
  console.log("po_revisions:", revs);
}

checkPO().catch(console.error);
