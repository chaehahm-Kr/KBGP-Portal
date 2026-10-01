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

async function inspect() {
  console.log("=== Inspecting K SELECT Test Retailer & Brands Global Inc ===");

  const { data: companies } = await admin
    .from("companies")
    .select("*, company_roles(*)")
    .or("name.ilike.%Test Retailer%,name.ilike.%Brands Global%");

  console.log("Companies:", JSON.stringify(companies, null, 2));

  // Check company_users for Tammy Chun & Tammy Hahm
  const { data: users } = await admin
    .from("company_users")
    .select("*, companies(*)")
    .or("email.ilike.%tammy%,name.ilike.%tammy%");

  console.log("Users:", JSON.stringify(users, null, 2));

  // Check retailer_user_roles / stores / retailer tables if any
  const { data: retailerRoles } = await admin
    .from("retailer_user_roles")
    .select("*");
  console.log("Retailer User Roles:", retailerRoles);

  const { data: stores } = await admin
    .from("stores")
    .select("id, name, company_id");
  console.log("Stores count:", stores?.length, "Sample stores:", stores?.slice(0, 3));
}

inspect();
