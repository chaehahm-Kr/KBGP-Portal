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

async function testFixedQuery() {
  console.log("--- Testing Fixed Companies Query (without is_draft) ---");
  const { data: dbCompanies, error: companiesErr } = await supabase
    .from("companies")
    .select(`
      id, name, country, status, intro, created_at,
      brands (id, is_active),
      products (id, name, selection_status, status, price_usd_fob, price_krw_retail)
    `)
    .order("created_at", { ascending: false });

  console.log("companiesErr:", companiesErr);
  console.log("dbCompanies count:", dbCompanies ? dbCompanies.length : 0);
  if (dbCompanies) {
    dbCompanies.forEach(c => {
      console.log(`- ${c.name} (ID: ${c.id}, Country: ${c.country}, Brands: ${c.brands?.length || 0}, Products: ${c.products?.length || 0})`);
    });
  }
}

testFixedQuery();
