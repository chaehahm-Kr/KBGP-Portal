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

const targetCompanyIds = [
  '9f37ece5-e164-4357-9ecb-3982ee118ad4', // John
  '0ec853ef-45dc-4f8f-aa63-59debeaf4af1', // Carmel
  '053723dd-aa07-4200-9406-7b8773dd323e', // Carmel2
];

const targetPoIds = [
  '2f378a31-c186-4413-a932-e2e07d6bed4f'
];

async function checkFinanceAndPurchasing() {
  console.log("=== Checking PO / Purchasing Tables ===");
  
  const tables = [
    'purchase_order_lines',
    'purchase_order_items',
    'purchase_orders',
    'po_shipments',
    'po_shipment_items',
    'po_receiving_records',
    'po_receiving_items',
    'po_revisions',
    'po_shipping_documents',
    'invoices',
    'supplier_invoices',
    'supplier_invoice_items',
    'supplier_payments',
    'landed_cost_cases',
    'landed_cost_lines',
    'inquiries'
  ];

  for (const t of tables) {
    try {
      const { data: d1 } = await admin.from(t).select('*').in('company_id', targetCompanyIds);
      if (d1 && d1.length > 0) console.log(`- ${t} (by company_id): ${d1.length}`);
    } catch(e) {}

    try {
      const { data: d2 } = await admin.from(t).select('*').in('supplier_id', targetCompanyIds);
      if (d2 && d2.length > 0) console.log(`- ${t} (by supplier_id): ${d2.length}`);
    } catch(e) {}

    try {
      const { data: d3 } = await admin.from(t).select('*').in('purchase_order_id', targetPoIds);
      if (d3 && d3.length > 0) console.log(`- ${t} (by purchase_order_id): ${d3.length}`);
    } catch(e) {}

    try {
      const { data: d4 } = await admin.from(t).select('*').in('po_id', targetPoIds);
      if (d4 && d4.length > 0) console.log(`- ${t} (by po_id): ${d4.length}`);
    } catch(e) {}

    try {
      const { data: d5 } = await admin.from(t).select('*').in('converted_company_id', targetCompanyIds);
      if (d5 && d5.length > 0) console.log(`- ${t} (by converted_company_id): ${d5.length}`);
    } catch(e) {}
  }
}

checkFinanceAndPurchasing().catch(console.error);
