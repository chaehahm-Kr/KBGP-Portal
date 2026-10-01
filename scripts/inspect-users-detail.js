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
  const { data: user } = await admin
    .from("company_users")
    .select("*, companies(*)")
    .eq("id", "7c3c4899-fa85-4cf0-94c8-6d497b36f82f");

  console.log("User 7c3c4899:", user);

  const { data: allUsers } = await admin
    .from("company_users")
    .select("id, name, email, company_id, status")
    .limit(10);
  console.log("Sample company_users:", allUsers);
}

inspect();
