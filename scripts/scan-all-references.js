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

const TABLES = [
  'companies',
  'brands',
  'products',
  'product_images',
  'product_certificates',
  'product_videos',
  'product_attribute_values',
  'product_change_logs',
  'company_users',
  'user_profiles',
  'applications',
  'brand_applications',
  'company_invitations',
  'company_onboarding_status',
  'company_agreements',
  'company_shipping_origins',
  'company_task_assignments',
  'partner_inquiries',
  'inquiry_messages',
  'inquiry_events',
  'po_requests',
  'po_request_items',
  'purchase_orders',
  'purchase_order_items',
  'supplier_invoices',
  'supplier_payments',
  'activity_logs',
  'notifications'
];

async function scanTables() {
  const targetIds = {
    'John': '9f37ece5-e164-4357-9ecb-3982ee118ad4',
    'Carmel': '0ec853ef-45dc-4f8f-aa63-59debeaf4af1',
    'Carmel2': '053723dd-aa07-4200-9406-7b8773dd323e'
  };

  for (const [name, cid] of Object.entries(targetIds)) {
    console.log(`\n=============================================================`);
    console.log(`SCANNING REFERENCES FOR: ${name} (${cid})`);
    console.log(`=============================================================`);

    for (const table of TABLES) {
      try {
        // Try selecting records where company_id = cid or id = cid
        const { data: byCompanyId, error: err1 } = await admin.from(table).select('*').eq('company_id', cid);
        if (!err1 && byCompanyId && byCompanyId.length > 0) {
          console.log(`  - [${table}] (company_id=${cid}): ${byCompanyId.length} records`);
        }

        if (table === 'companies') {
          const { data: byId } = await admin.from('companies').select('*').eq('id', cid);
          if (byId && byId.length > 0) {
            console.log(`  - [companies] (id=${cid}): 1 record`);
          }
        }

        if (table === 'applications') {
          const { data: byOnboarded } = await admin.from('applications').select('*').eq('onboarded_company_id', cid);
          if (byOnboarded && byOnboarded.length > 0) {
            console.log(`  - [applications] (onboarded_company_id=${cid}): ${byOnboarded.length} records`);
          }
        }
      } catch (e) {
        // Table might not have company_id or might not exist
      }
    }
  }
}

scanTables().catch(console.error);
