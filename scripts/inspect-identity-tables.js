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
  const email = "chae@letusto.com";
  console.log(`=== Inspecting identity tables for ${email} ===`);

  // 1. Supabase Auth Users
  const { data: authUsers, error: authErr } = await admin.auth.admin.listUsers();
  console.log("Auth Users count:", authUsers?.users?.length, "Auth error:", authErr);
  const foundAuth = authUsers?.users?.filter(u => (u.email || '').toLowerCase() === email.toLowerCase());
  console.log("Found in auth.users:", foundAuth);

  // 2. company_users
  const { data: cu, error: cuErr } = await admin.from("company_users").select("*").ilike("email", email);
  console.log("Found in company_users:", cu, cuErr);

  // 3. applications
  const { data: apps, error: appErr } = await admin.from("applications").select("*").ilike("applicant_contact_email", email);
  console.log("Found in applications:", apps, appErr);

  // 4. retailer_invitations
  const { data: retInv, error: retInvErr } = await admin.from("retailer_invitations").select("*").ilike("email", email);
  console.log("Found in retailer_invitations:", retInv, retInvErr);

  // 5. Check table list in public schema
  const { data: tables } = await admin.rpc("exec_sql", {
    sql_query: "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE '%user%';"
  }).catch(() => ({ data: null }));
  console.log("User-related public tables:", tables);
}

main().catch(console.error);
