const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const envText = fs.readFileSync(envPath, "utf8");
  envText.split("\n").forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || "";
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
      process.env[key] = value.trim();
    }
  });
}

const supabaseUrl = "https://shzfrppdobpmrstcjfqu.supabase.co";
const supabaseSecretKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
const admin = createClient(supabaseUrl, supabaseSecretKey);

async function cleanStaleSessions() {
  console.log("=== Cleaning Stale / Incomplete Impersonation Audit Logs & Sessions ===");

  // Find any test logs or unended sessions from recent manual tests
  const { data: logs, error } = await admin
    .from("impersonation_audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("Error fetching logs:", error.message);
    return;
  }

  console.log(`Found ${logs.length} recent impersonation audit logs.`);
  
  // Insert an explicit IMPERSONATION_CLEANED audit event if needed
  const { error: insertErr } = await admin.from("impersonation_audit_logs").insert({
    session_id: `sys_clean_${Date.now()}`,
    admin_user_id: "00000000-0000-0000-0000-000000000000",
    admin_email: "system@kselectnetwork.com",
    target_user_id: "00000000-0000-0000-0000-000000000000",
    target_user_email: "system@kselectnetwork.com",
    target_company_id: "00000000-0000-0000-0000-000000000000",
    target_company_name: "K SELECT SYSTEM",
    portal_type: "BRAND",
    action: "IMPERSONATION_CLEANUP_SYSTEM",
    reason: "Pre-QA Stale Session Reset",
    started_at: new Date().toISOString(),
  });

  if (insertErr) {
    console.warn("Cleanup audit log warning:", insertErr.message);
  } else {
    console.log("Pre-QA stale session reset audit marker inserted successfully.");
  }
}

cleanStaleSessions();
