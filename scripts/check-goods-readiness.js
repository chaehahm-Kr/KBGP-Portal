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

async function checkGoodsReadiness() {
  const { data: grLines } = await admin.from('goods_readiness_lines').select('*').eq('purchase_order_line_id', '92326d16-c3d8-4db5-8a36-908a2ff7d4d2');
  console.log("goods_readiness_lines:", grLines);

  const { data: gr } = await admin.from('goods_readiness').select('*').eq('purchase_order_id', '2f378a31-c186-4413-a932-e2e07d6bed4f');
  console.log("goods_readiness:", gr);
}

checkGoodsReadiness().catch(console.error);
