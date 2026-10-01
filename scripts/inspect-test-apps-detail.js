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
  console.log("=== Inspecting Dependencies for APP-000013, APP-000014, APP-000015 ===");

  const appIds = [
    '3619cdae-0556-419d-90a9-6a162e1314f0', // APP-000015
    '548f882d-5da7-49fc-a156-f52dce731a3b', // APP-000014
    'd156e2f7-1eaf-41e3-941d-b6b07bd339ca'  // APP-000013
  ];

  const { data: apps } = await admin.from("applications").select("*").in("id", appIds);
  console.log("Applications:", apps);

  const companyIds = (apps || []).map(a => a.company_id).filter(Boolean);
  console.log("Linked Company IDs:", companyIds);

  if (companyIds.length > 0) {
    const { data: comps } = await admin.from("companies").select("*").in("id", companyIds);
    console.log("Linked Companies:", comps);

    const { data: compUsers } = await admin.from("company_users").select("*").in("company_id", companyIds);
    console.log("Linked Company Users:", compUsers);
  }

  // Check company_users by email
  const emails = ["chae@letusto.com", "contact@letusto.com"];
  const { data: cuEmails } = await admin.from("company_users").select("*").in("email", emails);
  console.log("Company users with emails:", cuEmails);

  // Check auth.users with emails
  const { data: authUsers } = await admin.auth.admin.listUsers();
  const foundAuth = (authUsers?.users || []).filter(u => emails.includes((u.email || '').toLowerCase()));
  console.log("Auth users matching emails:", foundAuth.map(u => ({ id: u.id, email: u.email, created_at: u.created_at })));
}

main().catch(console.error);
