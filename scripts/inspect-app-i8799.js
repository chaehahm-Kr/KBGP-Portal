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
  console.log("=== Inspecting Target Production Test Record APP-20260929-I8799 ===");

  const { data: app } = await admin
    .from("applications")
    .select("*")
    .eq("id", "0dcfcce6-eceb-4844-9a81-45f95fdb9930")
    .maybeSingle();

  console.log("Application Row:", app);

  const { data: counter } = await admin.from("application_sequence_counter").select("*").single();
  console.log("Current Global Counter Row:", counter);

  if (app) {
    const { data: comp } = await admin.from("companies").select("*").eq("id", app.company_id).maybeSingle();
    console.log("Linked Company Row:", comp);

    const { data: compUsers } = await admin.from("company_users").select("*").eq("company_id", app.company_id);
    console.log("Linked Company Users:", compUsers);
  }
}

main().catch(console.error);
