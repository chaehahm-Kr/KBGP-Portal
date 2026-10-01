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

async function checkAppsAndCompanies() {
  console.log("=== Applications table ===");
  const { data: apps, error: err1 } = await admin.from('applications').select('*');
  if (err1) console.error("applications err:", err1);
  else console.log(apps.map(a => ({ id: a.id, app_no: a.application_no, company_name: a.company_name, brand_name: a.brand_name, email: a.email, status: a.status })));

  console.log("\n=== All Companies ===");
  const { data: companies, error: err2 } = await admin.from('companies').select('*');
  if (err2) console.error("companies err:", err2);
  else console.log(companies.map(c => ({ id: c.id, name: c.name, status: c.status, created_at: c.created_at })));

  console.log("\n=== All Brands ===");
  const { data: brands, error: err3 } = await admin.from('brands').select('id, name, company_id, created_at');
  if (err3) console.error("brands err:", err3);
  else console.log(brands);
}

checkAppsAndCompanies().catch(console.error);
