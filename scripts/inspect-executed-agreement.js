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

async function main() {
  const { data: caList, error: caErr } = await admin
    .from("company_agreements")
    .select("*")
    .order("created_at", { ascending: false });

  console.log("All company_agreements rows count:", caList ? caList.length : caErr);
  console.log("Recent company_agreements rows:", JSON.stringify(caList, null, 2));

  if (caList && caList.length > 0) {
    for (const ca of caList) {
      console.log(`\n--- Agreement: ${ca.agreement_id} (Status: ${ca.status}) ---`);
      console.log("id:", ca.id);
      console.log("company_id:", ca.company_id);
      console.log("final_pdf_path:", ca.final_pdf_path);
      console.log("final_pdf_hash:", ca.final_pdf_hash);
      console.log("executed_at / signed_at:", ca.executed_at, ca.signed_at);

      if (ca.final_pdf_path) {
        // Try bucket 'company-uploads'
        const { data: signed, error: signErr } = await admin.storage
          .from("company-uploads")
          .createSignedUrl(ca.final_pdf_path, 3600);

        console.log("Signed URL in 'company-uploads':", signErr ? `Error: ${signErr.message}` : signed?.signedUrl);

        // Check if object exists in company-uploads
        const pathParts = ca.final_pdf_path.split("/");
        const filename = pathParts.pop();
        const dir = pathParts.join("/");
        const { data: listData, error: listErr } = await admin.storage
          .from("company-uploads")
          .list(dir);

        console.log(`Listing files in 'company-uploads' dir '${dir}':`, listErr ? `List error: ${listErr.message}` : listData?.map(f => f.name));
      }
    }
  }
}

main().catch(console.error);
