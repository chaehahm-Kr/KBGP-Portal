const fs = require('fs');
const path = require('path');
const envFile = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = (match[2] || '').trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    env[match[1]] = value;
  }
});

const { createClient } = require('@supabase/supabase-js');
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const email = "legal@letusto.com";
  console.log(`=== Checking legal@letusto.com usage across system ===`);

  const { data: cu } = await admin.from("company_users").select("*").ilike("email", email);
  console.log("company_users for legal@letusto.com:", cu);

  const { data: apps } = await admin.from("applications").select("id, application_number, applicant_company_name").ilike("applicant_contact_email", email);
  console.log("applications for legal@letusto.com:", apps);

  const { data: authUsers } = await admin.auth.admin.listUsers();
  const found = (authUsers?.users || []).find(u => (u.email || '').toLowerCase() === email);
  console.log("auth.users for legal@letusto.com:", found ? { id: found.id, created_at: found.created_at } : null);
}

main().catch(console.error);
