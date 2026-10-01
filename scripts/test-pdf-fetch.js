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
  const pathStr = "agreements/4c845ae8-b93b-4db2-858f-bda3252e8167/KSN-AGR-2026-000001.pdf";
  
  // Test createSignedUrl with options download: true vs default
  const { data: signed1, error: err1 } = await admin.storage
    .from("company-uploads")
    .createSignedUrl(pathStr, 3600);

  const { data: signed2, error: err2 } = await admin.storage
    .from("company-uploads")
    .createSignedUrl(pathStr, 3600, {
      download: "K_SELECT_Agreement_KSN-AGR-2026-000001.pdf"
    });

  console.log("Normal Signed URL:", signed1?.signedUrl);
  console.log("Download Signed URL:", signed2?.signedUrl);

  if (signed1?.signedUrl) {
    const res1 = await fetch(signed1.signedUrl);
    console.log("\nNormal fetch status:", res1.status);
    console.log("Headers:");
    res1.headers.forEach((v, k) => console.log(`  ${k}: ${v}`));
  }

  if (signed2?.signedUrl) {
    const res2 = await fetch(signed2.signedUrl);
    console.log("\nDownload fetch status:", res2.status);
    console.log("Headers:");
    res2.headers.forEach((v, k) => console.log(`  ${k}: ${v}`));
  }
}

main().catch(console.error);
