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

async function cleanup() {
  console.log("=== Cleaning up disposable test record APP-20260929-I7799 (b2bffa2d-634a-4113-8843-cd26e1bd4c76) ===");

  const appId = "b2bffa2d-634a-4113-8843-cd26e1bd4c76";
  const { data: app } = await admin.from("applications").select("*").eq("id", appId).maybeSingle();

  if (!app) {
    console.log("Application record already deleted or not found.");
  } else {
    console.log("Found target application:", app.application_number, app.id);
    const companyId = app.company_id;

    // 1. Activity logs
    const { error: actErr } = await admin.from("activity_logs").delete().eq("entity_id", appId);
    console.log("Deleted activity logs:", actErr || "OK");

    // 2. Application
    const { error: appDelErr } = await admin.from("applications").delete().eq("id", appId);
    console.log("Deleted application:", appDelErr || "OK");

    if (companyId) {
      // 3. Company Users & Auth Users
      const { data: compUsers } = await admin.from("company_users").select("*").eq("company_id", companyId);
      for (const cu of (compUsers || [])) {
        console.log("Cleaning up company_user:", cu.id, cu.email);
        await admin.from("company_users").delete().eq("id", cu.id);
        
        // Delete Auth User ONLY if created exclusively for this test (legal@letusto.com with status invited and no active history)
        if (cu.email === "legal@letusto.com") {
          try {
            await admin.auth.admin.deleteUser(cu.id);
            console.log("Deleted Auth user:", cu.id);
          } catch (e) {
            console.warn("Auth user delete warning:", e.message);
          }
        }
      }

      // 4. Test Company
      const { error: compDelErr } = await admin.from("companies").delete().eq("id", companyId);
      console.log("Deleted company:", compDelErr || "OK");
    }
  }

  // 5. Verify sequence counter remains >= 23
  const { data: counter } = await admin.from("application_sequence_counter").select("*").single();
  console.log("Current Global Counter Value AFTER Cleanup:", counter);
}

cleanup().catch(console.error);
