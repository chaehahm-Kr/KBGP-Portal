const fs = require("fs");
const path = require("path");

function loadEnv() {
  const envFiles = [".env.production.local", ".env.local"];
  const env = {};
  for (const file of envFiles) {
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, "utf8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx !== -1) {
          const key = trimmed.slice(0, eqIdx).trim();
          const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
          env[key] = val;
        }
      }
    }
  }
  return env;
}

const env = loadEnv();
const { createClient } = require("@supabase/supabase-js");
const client = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL || "https://shzfrppdobpmrstcjfqu.supabase.co",
  env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifyRecord() {
  console.log("=== Verifying Production Database Row for APP-000010 ===");
  const { data, error } = await client
    .from("applications")
    .select("*")
    .eq("application_number", "APP-000010")
    .single();

  if (error) {
    console.error("Database query error:", error);
    process.exit(1);
  }

  console.log("Database Row Found:");
  console.log(JSON.stringify(data, null, 2));

  console.log("\nField Verifications:");
  console.log("- id:", data.id);
  console.log("- application_number:", data.application_number, data.application_number === "APP-000010" ? "PASS" : "FAIL");
  console.log("- partner_type:", data.partner_type, data.partner_type === "retailer" ? "PASS" : "FAIL");
  console.log("- entry_mode:", data.entry_mode, data.entry_mode === "public_application" ? "PASS" : "FAIL");
  console.log("- status:", data.status, data.status === "submitted" ? "PASS" : "FAIL");
  console.log("- applicant_company_name:", data.applicant_company_name, data.applicant_company_name === "K SELECT Browser E2E Retailer Test 2026" ? "PASS" : "FAIL");
  console.log("- applicant_contact_name:", data.applicant_contact_name, data.applicant_contact_name === "Chae Hahm E2E" ? "PASS" : "FAIL");
  console.log("- applicant_contact_phone:", data.applicant_contact_phone, data.applicant_contact_phone === "856-383-8288" ? "PASS" : "FAIL");
  console.log("- applicant_address:", JSON.stringify(data.applicant_address));
  console.log("- eligibility_responses:", JSON.stringify(data.eligibility_responses));
  console.log("- self_check_answers:", JSON.stringify(data.self_check_answers));
  console.log("- motivation_note:", data.motivation_note);
  console.log("- submitted_at:", data.submitted_at);
}

verifyRecord();
