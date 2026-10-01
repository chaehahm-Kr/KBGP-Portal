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

async function debugPODelete() {
  const { data: poLines, error: err1 } = await admin.from('purchase_order_lines').select('*');
  console.log("All po lines:", poLines, err1);

  const { data: pos, error: err2 } = await admin.from('purchase_orders').select('*');
  console.log("All POs:", pos, err2);

  const { error: dLinesErr } = await admin.from('purchase_order_lines').delete().eq('purchase_order_id', '2f378a31-c186-4413-a932-e2e07d6bed4f');
  console.log("Delete PO lines err:", dLinesErr);

  const { error: dPOErr } = await admin.from('purchase_orders').delete().eq('id', '2f378a31-c186-4413-a932-e2e07d6bed4f');
  console.log("Delete PO err:", dPOErr);
}

debugPODelete().catch(console.error);
