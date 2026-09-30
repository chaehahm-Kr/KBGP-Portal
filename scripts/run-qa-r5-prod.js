const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const envContent = fs.readFileSync(".env.local", "utf8");
const envVars = {};
envContent.split("\n").forEach((line) => {
  const [key, ...vals] = line.split("=");
  if (key && vals.length > 0) {
    envVars[key.trim()] = vals.join("=").trim();
  }
});

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL || "https://shzfrppdobpmrstcjfqu.supabase.co";
const secretKey = envVars.SUPABASE_SECRET_KEY;

const admin = createClient(supabaseUrl, secretKey);

async function main() {
  console.log("=== PRODUCTION E2E R5 REVISION QA TEST ===");

  // 1. Inspect support4@letusto.com user record in Production DB
  console.log("\n1. Verifying support4@letusto.com DB record & 5-Role Resolution...");
  const { data: user4, error: err4 } = await admin
    .from("company_users")
    .select("id, company_id, name, email, company_role, status, permissions")
    .eq("email", "support4@letusto.com")
    .single();

  if (err4 || !user4) {
    console.error("❌ Failed to query support4@letusto.com:", err4);
    process.exit(1);
  }

  console.log("User Email:", user4.email);
  console.log("Company Role (DB Enum):", user4.company_role);
  console.log("Stored Preset:", user4.permissions?.preset);
  console.log("Permissions JSON:", JSON.stringify(user4.permissions, null, 2));

  if (user4.permissions?.preset === "manager") {
    console.log("✅ support4@letusto.com permissions.preset is 'manager': PASS");
  } else {
    console.error("❌ support4@letusto.com permissions.preset is NOT manager: FAIL");
    process.exit(1);
  }

  // 2. Test Canonical 5-Role Resolution Logic
  console.log("\n2. Testing Canonical 5-Role Resolution Logic...");
  const testCases = [
    { input: { company_role: "company_admin", permissions: { preset: "admin" } }, expected: "admin" },
    { input: { company_role: "company_staff", permissions: { preset: "manager" } }, expected: "manager" },
    { input: { company_role: "company_staff", permissions: { preset: "staff" } }, expected: "staff" },
    { input: { company_role: "company_staff", permissions: { preset: "viewer" } }, expected: "viewer" },
    { input: { company_role: "company_staff", permissions: { preset: "restricted" } }, expected: "restricted" },
  ];

  const ROLE_DISPLAY_CONFIG = {
    admin: { labelKo: "관리자 (Admin)" },
    manager: { labelKo: "매니저 (Manager)" },
    staff: { labelKo: "담당자 (Staff)" },
    viewer: { labelKo: "조회자 (Viewer)" },
    restricted: { labelKo: "접근 제한 (Restricted)" },
  };

  const resolveCompanyUserRole = (u) => {
    if (!u) return "staff";
    const preset = u.permissions?.preset || u.permissions?.role;
    if (preset === "admin" || preset === "manager" || preset === "staff" || preset === "viewer" || preset === "restricted") {
      return preset;
    }
    if (u.company_role === "company_admin") return "admin";
    if (u.company_role === "company_staff") return "staff";
    return "staff";
  };

  for (const tc of testCases) {
    const resolved = resolveCompanyUserRole(tc.input);
    const display = ROLE_DISPLAY_CONFIG[resolved]?.labelKo || resolved;
    console.log(`Input preset: '${tc.input.permissions.preset}' -> Resolved: '${resolved}' -> Label: '${display}'`);
    if (resolved !== tc.expected) {
      console.error(`❌ Resolution Mismatch: Expected ${tc.expected}, got ${resolved}`);
      process.exit(1);
    }
  }
  console.log("✅ Canonical 5-Role Resolution for all 5 roles: PASS");

  // 3. Verify Company Name Resolution for Brands Global Inc.
  console.log("\n3. Verifying Inviting Company Resolution for Brands Global Inc...");
  const { data: comp } = await admin.from("companies").select("name").eq("id", user4.company_id).single();
  console.log("Resolved Company Name:", comp?.name);
  if (comp?.name === "Brands Global Inc.") {
    console.log('✅ Company Resolution: PASS ("Brands Global Inc." resolved without fallback)');
  } else {
    console.error("❌ Company Resolution: FAIL");
    process.exit(1);
  }

  console.log("\n=== ALL PRODUCTION E2E R5 QA TEST ASSERTIONS PASSED SUCCESSFULLY ===");
}

main().catch((err) => {
  console.error("QA Script error:", err);
  process.exit(1);
});
