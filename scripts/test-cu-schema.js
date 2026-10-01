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

async function run() {
  console.log("Checking agreement_templates schema via Supabase Admin REST API...");
  const { data: list, error } = await admin.from("agreement_templates").select("*");
  console.log("Current agreement_templates rows:", list, "Error:", error);

  // Seed Retailer Agreement Template if not present
  const { data: retailerTmpl } = await admin
    .from("agreement_templates")
    .select("*")
    .eq("version", "1.0")
    .eq("agreement_type", "RETAILER")
    .maybeSingle();

  if (!retailerTmpl) {
    console.log("Seeding Retailer Agreement Template Version 1.0...");
    const { data: seeded, error: seedErr } = await admin.from("agreement_templates").insert({
      agreement_type: "RETAILER",
      name: "Retailer Supply & K SELECT Platform Agreement",
      version: "1.0",
      status: "active",
      source_pdf_path: "agreements/retailer_template_v1.pdf",
      letusto_signer_name: "Chae Hahm",
      letusto_signer_title: "CEO",
      letusto_company_name: "Letusto Inc.",
      letusto_address: "23B Roland Ave. Mount Laurel NJ 08054 USA",
      initial_term_years: 2,
      renewal_term_years: 2,
      non_renewal_notice_days: 90,
      notes: "Initial Retailer Agreement Template (S1 source specification)",
      activated_at: new Date().toISOString(),
    }).select().single();

    console.log("Seeded Retailer Template Result:", seeded, "Error:", seedErr);
  } else {
    console.log("Retailer Agreement Template already exists:", retailerTmpl);
  }
}

run().catch(console.error);
