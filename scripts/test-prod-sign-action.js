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
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;
const admin = createClient(supabaseUrl, supabaseSecretKey);

function parseCompanyInfo(comp) {
  let fullAddress = "";
  let representativeName = comp?.contact_name || "";

  if (comp?.intro && typeof comp.intro === "string" && comp.intro.startsWith("__COMPANY_METADATA__:")) {
    try {
      const parsed = JSON.parse(comp.intro.substring("__COMPANY_METADATA__:".length));
      fullAddress = parsed.address || [parsed.address_1, parsed.address_2, parsed.city, parsed.state, parsed.zip_code].filter(Boolean).join(" ").trim();
      if (parsed.contacts && Array.isArray(parsed.contacts)) {
        const primary = parsed.contacts.find(c => c.isPrimary) || parsed.contacts[0];
        if (primary?.name) representativeName = primary.name;
      }
    } catch (e) {}
  }

  return {
    id: comp?.id,
    name: comp?.name || "",
    address: fullAddress || comp?.country || "",
    representativeName,
  };
}

async function testFetch() {
  const { data: ca, error: fetchErr } = await admin
    .from("company_agreements")
    .select("*, companies(id, name, country, contact_name, contact_phone, intro)")
    .eq("id", "396397c3-dcf8-4dd0-ba5b-09e2f0bd26a7")
    .single();

  console.log("Fetch Error:", fetchErr);
  if (ca) {
    const compInfo = parseCompanyInfo(ca.companies);
    console.log("Parsed Company Info:", compInfo);
  }
}

testFetch();
