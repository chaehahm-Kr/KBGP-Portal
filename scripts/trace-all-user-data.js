const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://shzfrppdobpmrstcjfqu.supabase.co";
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;
const admin = createClient(supabaseUrl, supabaseSecretKey);

async function traceAllUserCompanyData() {
  console.log("=== 1. Inspecting company_users ===");
  const { data: cuList, error: cuErr } = await admin.from("company_users").select("*");
  console.log("company_users count:", cuList ? cuList.length : cuErr);
  console.log("company_users rows:", cuList);

  console.log("\n=== 2. Inspecting profiles ===");
  const { data: pList, error: pErr } = await admin.from("profiles").select("*");
  console.log("profiles count:", pList ? pList.length : pErr);
  console.log("profiles rows:", pList);

  console.log("\n=== 3. Inspecting company_agreements ===");
  const { data: caList, error: caErr } = await admin.from("company_agreements").select("*");
  console.log("company_agreements rows:", caList);

  console.log("\n=== 4. Inspecting auth.users ===");
  const { data: authUsers, error: aErr } = await admin.auth.admin.listUsers();
  console.log("auth.users count:", authUsers ? authUsers.users.length : aErr);
  if (authUsers) {
    authUsers.users.forEach(u => {
      console.log(`User ${u.id}: email=${u.email}, user_metadata=`, u.user_metadata);
    });
  }
}

traceAllUserCompanyData().catch(console.error);
