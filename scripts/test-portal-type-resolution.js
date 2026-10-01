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

async function resolveAuthoritativePortalType(admin, companyId) {
  const { data: roles } = await admin
    .from("company_roles")
    .select("role")
    .eq("company_id", companyId);

  if (roles && roles.some(r => r.role?.toLowerCase() === "retailer")) {
    return "RETAILER";
  }

  const { data: retUserRoles } = await admin
    .from("retailer_user_roles")
    .select("id")
    .eq("company_id", companyId)
    .limit(1);

  if (retUserRoles && retUserRoles.length > 0) {
    return "RETAILER";
  }

  const { data: stores } = await admin
    .from("stores")
    .select("id")
    .eq("company_id", companyId)
    .limit(1);

  if (stores && stores.length > 0) {
    return "RETAILER";
  }

  const { data: company } = await admin
    .from("companies")
    .select("company_code, intro")
    .eq("id", companyId)
    .maybeSingle();

  if (company) {
    if (company.company_code?.toUpperCase().startsWith("RET-")) {
      return "RETAILER";
    }
  }

  return "BRAND";
}

async function run() {
  const brandType = await resolveAuthoritativePortalType(admin, "4c845ae8-b93b-4db2-858f-bda3252e8167");
  const retailerType = await resolveAuthoritativePortalType(admin, "dc9249be-a9e0-4975-a4c9-b602bb2baa47");

  console.log("Brands Global Inc. resolved portal type:", brandType);
  console.log("K SELECT Test Retailer resolved portal type:", retailerType);
}

run();
