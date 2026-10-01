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
  console.log("=== Listing all tables in DB ===");

  const { data: cuAll } = await admin.from("company_users").select("id, email, name, role, status, company_id").limit(10);
  console.log("company_users sample:", cuAll);

  const { data: apps3 } = await admin.from("applications").select("id, application_number, applicant_company_name, applicant_contact_email, status, created_at").order("created_at", { ascending: false }).limit(10);
  console.log("Recent applications:", apps3);

  const { data: retInvAll } = await admin.from("retailer_invitations").select("*").limit(5);
  console.log("retailer_invitations sample:", retInvAll);
}

main().catch(console.error);
