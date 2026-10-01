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

const targetCids = [
  '9f37ece5-e164-4357-9ecb-3982ee118ad4', // John
  '0ec853ef-45dc-4f8f-aa63-59debeaf4af1', // Carmel
  '053723dd-aa07-4200-9406-7b8773dd323e', // Carmel2
];

const testEmails = [
  'john@letusto.com',
  'polo7104@naver.com',
  'david.lee.tact@gmail.com',
  'jinseoklee81@gmail.com'
];

async function checkOverlap() {
  console.log("=== Checking if test users are in any OTHER company ===");
  const { data: cUsers } = await admin.from('company_users').select('*').in('email', testEmails);
  for (const cu of cUsers || []) {
    const isTarget = targetCids.includes(cu.company_id);
    console.log(`CompanyUser ${cu.email} in company ${cu.company_id} => isTargetCompany: ${isTarget}`);
  }

  // Also check admin_users or other tables
  const { data: adminUsers } = await admin.from('admin_users').select('*').in('email', testEmails);
  console.log("admin_users matching test emails:", adminUsers);
}

checkOverlap().catch(console.error);
