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

async function checkInquiriesAndProducts() {
  console.log("=== Inquiries table check ===");
  const { data: inqs, error: inqErr } = await admin.from('inquiries').select('*').or(`converted_company_id.in.(${targetCompanyIds.join(',')})`);
  console.log("inquiries with converted_company_id:", inqs, inqErr);

  console.log("\n=== Products table check ===");
  const { data: prods, error: prodErr } = await admin.from('products').select('id, name, company_id, brand_id').in('company_id', targetCompanyIds);
  console.log("products remaining:", prods, prodErr);

  console.log("\n=== Brands table check ===");
  const { data: brands, error: brandErr } = await admin.from('brands').select('id, name, company_id').in('company_id', targetCompanyIds);
  console.log("brands remaining:", brands, brandErr);
}

checkInquiriesAndProducts().catch(console.error);
