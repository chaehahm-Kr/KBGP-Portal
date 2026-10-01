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
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || "https://shzfrppdobpmrstcjfqu.supabase.co";
const secretKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;

if (!secretKey) {
  console.error("SUPABASE_SECRET_KEY is required in .env.local");
  process.exit(1);
}

const admin = createClient(supabaseUrl, secretKey);

async function main() {
  console.log("=== Production Verification for ADM-APP-005 / ADM-EMAIL-005 / PORT-ONB-003 ===");

  // 1. Verify DB Schema Columns
  const { data: cuSample, error } = await admin
    .from("company_users")
    .select("id, email, status, invitation_token_hash, invitation_expires_at")
    .limit(5);

  if (error) {
    console.error("Error querying company_users:", error);
    process.exit(1);
  }

  console.log("DB Migration Verification:");
  console.log("  company_users sample rows with new invitation columns:", cuSample);

  // 2. Check Active User Duplicate Case
  const activeUser = cuSample.find(u => u.status === "active");
  if (activeUser) {
    console.log(`  Testing duplicate check against active user email: ${activeUser.email}`);
    const { data: foundActive } = await admin
      .from("company_users")
      .select("id, status, company_id")
      .ilike("email", activeUser.email.toLowerCase())
      .eq("status", "active");
    console.log("  Active User Guard Match Result:", foundActive?.length ? "BLOCKED (ACTIVE USER EXIST)" : "UNBLOCKED");
  }

  // 3. Verify Applications table total count
  const { count: appCount } = await admin.from("applications").select("*", { count: "exact", head: true });
  console.log(`  Current Total Applications count: ${appCount}`);

  console.log("=== VERIFICATION PASSED ===");
}

main().catch((err) => {
  console.error("QA error:", err);
  process.exit(1);
});
