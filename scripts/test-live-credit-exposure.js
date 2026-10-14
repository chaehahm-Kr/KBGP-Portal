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

async function main() {
  console.log('=== TESTING LIVE CREDIT EXPOSURE ON PRODUCTION SUPABASE ===\n');

  // Load calculation logic
  const { calculateCreditExposure } = require('../lib/finance/credit-exposure');

  // Test company
  const companyId = 'dc9249be-a9e0-4975-a4c9-b602bb2baa47';

  // 1. Fetch profile
  const { data: profile } = await admin
    .from('retailer_profiles')
    .select('credit_limit, approved_terms')
    .eq('company_id', companyId)
    .single();

  // 2. Fetch active invoices
  const { data: invoices } = await admin
    .from('retailer_invoices')
    .select('id, order_id, total_amount, balance_due, due_date, invoice_status')
    .eq('retailer_company_id', companyId)
    .not('invoice_status', 'in', '("void","cancelled")');

  // 3. Fetch active orders
  const { data: orders } = await admin
    .from('retailer_orders')
    .select(`
      id,
      order_number,
      order_status,
      payment_method,
      payment_terms,
      total_amount,
      subtotal_amount,
      total_ordered_units,
      total_cancelled_units,
      retailer_order_items (
        id,
        quantity,
        quantity_cancelled,
        line_total,
        unit_wholesale_price
      )
    `)
    .eq('company_id', companyId)
    .not('order_status', 'in', '("cancelled","shipped","delivered")');

  const exposure = calculateCreditExposure({
    creditLimit: Number(profile?.credit_limit || 0),
    invoices: invoices || [],
    orders: orders || [],
    companyId,
  });

  console.log('Live Exposure Output:');
  console.log(JSON.stringify(exposure, null, 2));

  console.log('\n--- VERIFICATION CHECKS ---');
  console.log('Credit Limit:', exposure.creditLimit);
  console.log('Open AR (active issued invoices):', exposure.openAR);
  console.log('Unbilled Reservation (submitted Net Terms orders):', exposure.unbilledReservation);
  console.log('Total Credit Exposure:', exposure.totalExposure);
  console.log('Available Credit:', exposure.availableCredit);
  console.log('Over Limit Amount:', exposure.overLimitAmount);
  console.log('Reserved Orders Count:', exposure.reservedOrdersCount);
}

main().catch(console.error);
