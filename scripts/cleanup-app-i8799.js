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
  console.log("=== SAFELY DELETING TEST RECORD APP-20260929-I8799 ===");

  const appId = "0dcfcce6-eceb-4844-9a81-45f95fdb9930";
  const compId = "8723b734-e6a7-4ae2-9339-df11892396ba";
  const authUserId = "3c1d0533-4f1a-4dfb-a085-d031e06f38bc";

  // 1. Delete application
  const { error: appErr } = await admin.from("applications").delete().eq("id", appId);
  console.log("Deleted application:", appErr ? appErr.message : "SUCCESS");

  // 2. Delete company_users
  const { error: cuErr } = await admin.from("company_users").delete().eq("company_id", compId);
  console.log("Deleted company_users:", cuErr ? cuErr.message : "SUCCESS");

  // 3. Delete company
  const { error: compErr } = await admin.from("companies").delete().eq("id", compId);
  console.log("Deleted company:", compErr ? compErr.message : "SUCCESS");

  // 4. Delete auth user created exclusively for this test
  const { error: authErr } = await admin.auth.admin.deleteUser(authUserId);
  console.log("Deleted test auth user (legal@letusto.com):", authErr ? authErr.message : "SUCCESS");

  // 5. Verify Sequence Counter is NOT rewound
  const { data: counter } = await admin.from("application_sequence_counter").select("*").single();
  console.log("Global Sequence Counter after deletion (MUST BE >= 22):", counter);

  // 6. Verify Application lookup by UUID returns no active application
  const { data: checkApp } = await admin.from("applications").select("id").eq("id", appId).maybeSingle();
  console.log("Check application by UUID (must be null):", checkApp);
}

main().catch(console.error);
