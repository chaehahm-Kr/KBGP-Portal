const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

let env = {};
const envPaths = ['.env.production.local', '.env.local'];
for (const envPath of envPaths) {
  const fullPath = path.join(process.cwd(), envPath);
  if (fs.existsSync(fullPath)) {
    const envText = fs.readFileSync(fullPath, 'utf8');
    envText.split('\n').forEach((line) => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        let value = (match[2] || '').trim();
        if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
        if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
        env[match[1]] = value;
      }
    });
  }
}

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || 'https://shzfrppdobpmrstcjfqu.supabase.co';
const serviceKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(supabaseUrl, serviceKey);

async function investigate() {
  console.log('=== INVESTIGATING ORDER KSR-2026-000022 (READ-ONLY) ===\n');

  // 1. Fetch Order Header
  const { data: order, error: orderErr } = await admin
    .from('retailer_orders')
    .select('*')
    .eq('order_number', 'KSR-2026-000022')
    .maybeSingle();

  if (orderErr || !order) {
    console.error('Order KSR-2026-000022 not found:', orderErr);
    process.exit(1);
  }

  console.log('1. Order Header:');
  console.log({
    id: order.id,
    order_number: order.order_number,
    company_id: order.company_id,
    order_status: order.order_status,
    payment_status: order.payment_status,
    payment_method: order.payment_method,
    payment_terms: order.payment_terms,
    total_amount: order.total_amount,
    subtotal_amount: order.subtotal_amount,
    tax_amount: order.tax_amount,
    shipping_amount: order.shipping_amount,
    total_ordered_units: order.total_ordered_units,
    total_shipped_units: order.total_shipped_units,
    total_cancelled_units: order.total_cancelled_units,
    total_remaining_units: order.total_remaining_units,
    created_at: order.created_at,
  });

  // 2. Fetch Order Items
  const { data: items } = await admin
    .from('retailer_order_items')
    .select('id, sku, product_name, quantity, quantity_shipped, quantity_cancelled, unit_wholesale_price, line_total')
    .eq('order_id', order.id);

  console.log('\n2. Order Items count:', items?.length);
  console.log(items);

  // 3. Fetch Dispatches / Fulfillments
  const { data: fulfillments } = await admin
    .from('retailer_order_fulfillments')
    .select(`
      id,
      fulfillment_number,
      status,
      carrier,
      tracking_number,
      tracking_url,
      box_count,
      shipped_at,
      delivered_at,
      created_at,
      retailer_order_fulfillment_items (
        id,
        order_item_id,
        product_id,
        quantity_shipped,
        quantity_delivered
      )
    `)
    .eq('order_id', order.id);

  console.log('\n3. Fulfillments count:', fulfillments?.length);
  console.log(JSON.stringify(fulfillments, null, 2));

  // 4. Fetch Packages
  const { data: packages } = await admin
    .from('retailer_order_packages')
    .select('*')
    .eq('order_id', order.id);

  console.log('\n4. Packages count:', packages?.length);
  console.log(packages);

  // 5. Fetch ALL Invoices (including voided/cancelled)
  const { data: invoices } = await admin
    .from('retailer_invoices')
    .select('*')
    .eq('order_id', order.id);

  console.log('\n5. Invoices count:', invoices?.length);
  console.log(invoices);

  // 6. Fetch Payments
  const { data: payments } = await admin
    .from('retailer_order_payments')
    .select('*')
    .eq('order_id', order.id);

  console.log('\n6. Payments count:', payments?.length);
  console.log(payments);
}

investigate().catch(console.error);
