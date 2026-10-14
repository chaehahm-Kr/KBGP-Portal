const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

let env = {};
fs.readFileSync('.env.local', 'utf8').split('\n').forEach(l => {
  const m = l.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (m) env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
});

const c = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY);

async function run() {
  console.log('=== VERIFYING SQL 0168 APPLICATION IN PRODUCTION SUPABASE ===');

  const { data: boxes, error: boxErr } = await c
    .from('retailer_order_fulfillment_boxes')
    .select('id, box_number, tracking_number, status')
    .limit(1);
  console.log('retailer_order_fulfillment_boxes:', boxErr ? `Error: ${boxErr.message}` : 'EXISTS ✓');

  const { data: sampleOrder, error: oErr } = await c
    .from('retailer_orders')
    .select('id, order_number, order_status')
    .eq('order_number', 'KSR-2026-000023')
    .single();

  if (sampleOrder) {
    console.log('Sample Order KSR-2026-000023:', sampleOrder);
    const { data: fuls } = await c
      .from('retailer_order_fulfillments')
      .select('id, fulfillment_number, status, carrier, tracking_number, box_count')
      .eq('order_id', sampleOrder.id);
    console.log('Order Fulfillments:', fuls);
  }
}

run();
