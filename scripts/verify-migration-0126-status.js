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
  console.log("=== Checking Migration 0126 DB objects in Supabase Production ===");

  // 1. Check table application_sequence_counter
  const { data: tableData, error: tableErr } = await admin
    .from("application_sequence_counter")
    .select("*")
    .maybeSingle();

  console.log("Table application_sequence_counter query result:", tableData, "Error:", tableErr);

  // 2. Check RPC next_application_sequence
  const { data: rpcVal, error: rpcErr } = await admin.rpc("next_application_sequence");
  console.log("RPC next_application_sequence test result:", rpcVal, "Error:", rpcErr);
}

main().catch(console.error);
