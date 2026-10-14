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

async function verifySchema() {
  console.log('=== VERIFYING PRODUCTION SCHEMA (shzfrppdobpmrstcjfqu) FOR MIGRATION 0165 ===\n');

  // 1. Verify retailer_invoices columns
  console.log('1. Checking retailer_invoices extended columns...');
  const { data: invSample, error: invErr } = await admin
    .from('retailer_invoices')
    .select('id, invoice_number, fulfillment_id, fulfillment_number, prepayment_allocated_amount, prepayment_allocation_status, dispatch_notes')
    .limit(1);

  if (invErr) {
    console.error('❌ retailer_invoices check FAILED:', invErr);
  } else {
    console.log('✓ retailer_invoices columns exist:', Object.keys(invSample?.[0] || {}));
  }

  // 2. Verify retailer_invoice_items table
  console.log('\n2. Checking retailer_invoice_items table...');
  const { data: itemsSample, error: itemsErr } = await admin
    .from('retailer_invoice_items')
    .select('id, invoice_id, order_item_id, product_id, sku, product_name, brand_name, quantity, unit_wholesale_price, line_total')
    .limit(1);

  if (itemsErr) {
    console.error('❌ retailer_invoice_items check FAILED:', itemsErr);
  } else {
    console.log('✓ retailer_invoice_items table verified. Sample count:', itemsSample?.length);
  }

  // 3. Verify retailer_prepayment_allocations table
  console.log('\n3. Checking retailer_prepayment_allocations table...');
  const { data: prepaySample, error: prepayErr } = await admin
    .from('retailer_prepayment_allocations')
    .select('id, order_id, payment_id, invoice_id, allocated_amount, allocated_at, notes')
    .limit(1);

  if (prepayErr) {
    console.error('❌ retailer_prepayment_allocations check FAILED:', prepayErr);
  } else {
    console.log('✓ retailer_prepayment_allocations table verified. Sample count:', prepaySample?.length);
  }

  const success = !invErr && !itemsErr && !prepayErr;
  console.log('\n========================================');
  console.log('Overall Schema 0165 Verification Result:', success ? 'ALL VERIFIED (PASS)' : 'FAILED');
  console.log('========================================');
  process.exit(success ? 0 : 1);
}

verifySchema().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
