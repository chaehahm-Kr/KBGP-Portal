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

async function checkShipmentDeps() {
  const shpId = '71248552-6780-4028-9ee3-f8646c678f79';
  
  const tables = [
    'inbound_receiving_records',
    'receiving_records',
    'receiving_lines',
    'po_shipment_documents',
    'landed_cost_cases',
    'landed_cost_allocations',
    'goods_readiness_lines'
  ];

  for (const t of tables) {
    try {
      const { data } = await admin.from(t).select('*').eq('inbound_shipment_id', shpId);
      if (data && data.length > 0) console.log(`${t} (by inbound_shipment_id):`, data.length);
    } catch (e) {}

    try {
      const { data } = await admin.from(t).select('*').eq('shipment_id', shpId);
      if (data && data.length > 0) console.log(`${t} (by shipment_id):`, data.length);
    } catch (e) {}
  }
}

checkShipmentDeps().catch(console.error);
