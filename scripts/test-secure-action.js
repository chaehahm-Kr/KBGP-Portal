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

async function testAccess(userId, targetPathOrId, downloadFilename) {
  let targetPath = targetPathOrId;
  let targetCompanyId = null;

  const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(targetPathOrId);

  let query = admin.from("company_agreements").select("id, company_id, agreement_id, final_pdf_path, status");
  if (targetPathOrId.includes("/")) {
    query = query.eq("final_pdf_path", targetPathOrId);
  } else if (isUuid) {
    query = query.eq("id", targetPathOrId);
  } else {
    query = query.eq("agreement_id", targetPathOrId);
  }

  const { data: ca } = await query.maybeSingle();

  if (ca) {
    targetPath = ca.final_pdf_path || targetPath;
    targetCompanyId = ca.company_id;
  } else if (targetPathOrId.includes("agreements/")) {
    const parts = targetPathOrId.split("/");
    if (parts.length >= 2) targetCompanyId = parts[1];
  }

  if (targetCompanyId && userId) {
    // 1) Check if staff/admin
    const { data: staff } = await admin
      .from("staff_members")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    const isAdmin = !!staff;

    if (!isAdmin) {
      // 2) Check company_users where id = userId
      const { data: cu } = await admin
        .from("company_users")
        .select("company_id, status")
        .eq("id", userId)
        .maybeSingle();

      const isCompanyMember = cu && cu.company_id === targetCompanyId && cu.status === "active";

      if (!isCompanyMember) {
        return { url: null, error: "해당 계약서에 접근할 권한이 없습니다." };
      }
    }
  }

  const downloadOpt = downloadFilename ? { download: downloadFilename } : undefined;
  const { data: signed, error: signErr } = await admin.storage
    .from("company-uploads")
    .createSignedUrl(targetPath, 3600, downloadOpt);

  if (signErr || !signed) return { url: null, error: signErr?.message || "URL 생성 실패" };
  return { url: signed.signedUrl };
}

async function main() {
  const validUser = "ae811579-4b8e-4cc6-aae7-deab0635e814"; // Tammy Hahm (company 4c845ae8-b93b-4db2-858f-bda3252e8167)
  const invalidUser = "00000000-0000-0000-0000-000000000000"; // Random fake user

  console.log("--- Test 1: Valid User View Agreement ---");
  const r1 = await testAccess(validUser, "KSN-AGR-2026-000001");
  console.log("Result 1:", r1.error ? `Error: ${r1.error}` : `URL generated OK: ${r1.url.substring(0, 80)}...`);

  console.log("\n--- Test 2: Valid User Download Agreement ---");
  const r2 = await testAccess(validUser, "KSN-AGR-2026-000001", "K_SELECT_Agreement_KSN-AGR-2026-000001.pdf");
  console.log("Result 2:", r2.error ? `Error: ${r2.error}` : `Download URL generated OK: ${r2.url.substring(0, 80)}...`);
  if (r2.url) {
    const res = await fetch(r2.url);
    console.log("Download URL HTTP status:", res.status);
    console.log("Content-Disposition:", res.headers.get("content-disposition"));
  }

  console.log("\n--- Test 3: Invalid User (Tenant Isolation) ---");
  const r3 = await testAccess(invalidUser, "KSN-AGR-2026-000001");
  console.log("Result 3:", r3);
}

main().catch(console.error);
