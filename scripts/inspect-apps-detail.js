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

async function inspectAppsDetail() {
  const { data: apps } = await admin.from('applications').select('*');
  console.log("All Applications Details:");
  for (const a of apps) {
    console.log(`ID: ${a.id} | Application No: ${a.application_no || a.app_no} | Status: ${a.status}`);
    console.log(`  Raw/Meta:`, {
      company_name: a.company_name,
      company_name_en: a.company_name_en,
      brand_name: a.brand_name,
      applicant_name: a.applicant_name,
      email: a.email,
      created_at: a.created_at
    });
  }
}

inspectAppsDetail().catch(console.error);
