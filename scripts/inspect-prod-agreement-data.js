const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

// Read .env.local
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

console.log("Supabase URL:", supabaseUrl);
console.log("Secret key prefix:", supabaseSecretKey ? supabaseSecretKey.substring(0, 12) : "MISSING");

const admin = createClient(supabaseUrl, supabaseSecretKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function inspect() {
  console.log("\n=== 1. Querying company_users for email = 'account@letusto.com' ===");
  const { data: cuAll, error: cuErr } = await admin.from("company_users").select("*").eq("email", "account@letusto.com");
  console.log("company_users by email:", cuAll, cuErr);

  console.log("\n=== 2. Querying all company_users ===");
  const { data: cuList, error: cuErr2 } = await admin.from("company_users").select("id, name, email, company_id");
  console.log("company_users list:", cuList, cuErr2);

  console.log("\n=== 3. Querying companies ===");
  const { data: compList, error: compErr } = await admin.from("companies").select("id, name, company_type");
  console.log("Companies:", compList, compErr);

  console.log("\n=== 4. Querying company_agreements ===");
  const { data: caList, error: caErr } = await admin.from("company_agreements").select("*").order("created_at", { ascending: false });
  console.log("Company Agreements:", caList, caErr);

  console.log("\n=== 5. Querying agreement_templates ===");
  const { data: tmplList, error: tmplErr } = await admin.from("agreement_templates").select("*");
  console.log("Agreement Templates:", tmplList, tmplErr);

  console.log("\n=== 6. Querying company_agreement_recipients ===");
  const { data: recList, error: recErr } = await admin.from("company_agreement_recipients").select("*");
  console.log("Company Agreement Recipients:", recList, recErr);

  console.log("\n=== 7. Querying agreement_audit_logs ===");
  const { data: auditList, error: auditErr } = await admin.from("agreement_audit_logs").select("*");
  console.log("Agreement Audit Logs:", auditList, auditErr);
}

inspect();
