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

const supabaseUrl = "https://shzfrppdobpmrstcjfqu.supabase.co";
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectCompanyRoles() {
  const { data: companies } = await supabase.from("companies").select("id, name, intro, country");
  const { data: roles } = await supabase.from("company_roles").select("company_id, role");

  console.log("=== COMPANIES & ROLES ===");
  companies.forEach(c => {
    const cRoles = (roles || []).filter(r => r.company_id === c.id).map(r => r.role);
    let metaType = "";
    if (c.intro && c.intro.startsWith("__COMPANY_METADATA__:")) {
      try {
        const meta = JSON.parse(c.intro.substring("__COMPANY_METADATA__:".length));
        metaType = meta.types || meta.type;
      } catch (e) {}
    }
    console.log(`Company: ${c.name}`);
    console.log(`  DB Roles:`, cRoles);
    console.log(`  Meta Types:`, metaType);
  });
}

inspectCompanyRoles();
