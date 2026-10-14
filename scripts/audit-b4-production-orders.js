const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

let env = {};
const envPaths = ['.env.production.local', '.env.local'];
for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf8').split('\n').forEach((l) => {
      const m = l.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (m) env[m[1]] = (m[2] || '').trim().replace(/^['"]|['"]$/g, '');
    });
  }
}

const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY);

(async () => {
  console.log('=== AUDITING PRODUCTION ORDERS & INVOICES FOR B4 CREDIT EXPOSURE ===\n');

  // 1. Retailer Profiles
  const { data: profiles } = await client
    .from('retailer_profiles')
    .select('company_id, credit_limit, approved_terms, payment_terms');
  console.log('--- Retailer Profiles (Count: ' + (profiles?.length || 0) + ') ---');
  for (const p of profiles || []) {
    console.log(`Company: ${p.company_id} | Credit Limit: $${p.credit_limit} | Approved Terms: ${p.approved_terms} | Terms: ${p.payment_terms}`);
  }

  // 2. Retailer Orders
  const { data: orders } = await client
    .from('retailer_orders')
    .select('id, order_number, company_id, order_status, payment_status, payment_method, payment_terms, total_amount, subtotal_amount, created_at')
    .order('created_at', { ascending: false });

  console.log('\n--- Retailer Orders (Count: ' + (orders?.length || 0) + ') ---');
  for (const o of orders || []) {
    console.log(`Order: ${o.order_number} (${o.id}) | Company: ${o.company_id} | Status: ${o.order_status} | Method: ${o.payment_method} | Terms: ${o.payment_terms} | PayStatus: ${o.payment_status} | Total: $${o.total_amount}`);
  }

  // 3. Retailer Invoices
  const { data: invoices } = await client
    .from('retailer_invoices')
    .select('id, invoice_number, order_id, fulfillment_id, retailer_company_id, total_amount, amount_paid, balance_due, invoice_status, payment_status')
    .order('created_at', { ascending: false });

  console.log('\n--- Retailer Invoices (Count: ' + (invoices?.length || 0) + ') ---');
  for (const inv of invoices || []) {
    console.log(`Invoice: ${inv.invoice_number} | Order: ${inv.order_id} | Ful: ${inv.fulfillment_id} | Total: $${inv.total_amount} | BalDue: $${inv.balance_due} | Status: ${inv.invoice_status}`);
  }
})();
