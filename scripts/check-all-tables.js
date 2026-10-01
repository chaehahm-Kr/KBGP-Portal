const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const env = fs.readFileSync('.env.local', 'utf8');
const lines = env.split(/\r?\n/);
const parsed = {};
for (const line of lines) {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) parsed[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, '');
}

const supabaseUrl = parsed.NEXT_PUBLIC_SUPABASE_URL || 'https://shzfrppdobpmrstcjfqu.supabase.co';
const serviceKey = parsed.SUPABASE_SECRET_KEY || parsed.SUPABASE_SERVICE_ROLE_KEY || parsed.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, serviceKey);

async function listTables() {
  const tables = [
    'applications',
    'companies',
    'company_users',
    'brands',
    'products',
    'purchase_orders',
    'po_requests',
    'supplier_invoices',
    'partner_inquiries',
    'inquiries'
  ];

  for (const t of tables) {
    const { data, count, error } = await supabase.from(t).select('id', { count: 'exact', head: true });
    if (error) {
      console.log(`Table ${t}: ERROR - ${error.message} (${error.code})`);
    } else {
      console.log(`Table ${t}: EXISTS (count = ${count})`);
    }
  }
}

listTables();
