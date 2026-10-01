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

async function inspectAdminCompaniesList() {
  const { data: companies } = await admin
    .from("companies")
    .select(`
      id, name, country, status, intro, created_at,
      brands (id, is_active),
      products (id, name, selection_status, status, price_usd_fob, price_krw_retail)
    `)
    .order("created_at", { ascending: false });

  console.log("Admin Companies List Rows:");
  console.table(companies.map(c => ({
    id: c.id,
    name: c.name,
    country: c.country,
    status: c.status,
    brandsCount: c.brands?.length || 0,
    productsCount: c.products?.length || 0,
    created_at: c.created_at
  })));
}

inspectAdminCompaniesList().catch(console.error);
