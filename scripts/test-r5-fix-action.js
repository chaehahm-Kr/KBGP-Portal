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

async function simulateGetSignedExecutedPdfUrl(userId, storagePathOrAgreementId, options) {
  if (!userId) {
    console.error("[Auth Security Audit] [AUTH_FAILED] User not authenticated");
    return { url: null, error: "인증되지 않은 사용자입니다. 다시 로그인해 주세요." };
  }

  if (!storagePathOrAgreementId) {
    console.error("[Auth Security Audit] [INVALID_PARAMS] Missing storage path or agreement ID");
    return { url: null, error: "저장된 PDF 경로 또는 계약서 ID가 필요합니다." };
  }

  let targetPath = storagePathOrAgreementId;
  let targetCompanyId = null;

  const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
    storagePathOrAgreementId
  );

  let query = admin
    .from("company_agreements")
    .select("id, company_id, agreement_id, final_pdf_path, status");

  if (storagePathOrAgreementId.includes("/")) {
    query = query.eq("final_pdf_path", storagePathOrAgreementId);
  } else if (isUuid) {
    query = query.eq("id", storagePathOrAgreementId);
  } else {
    query = query.eq("agreement_id", storagePathOrAgreementId);
  }

  const { data: ca, error: caErr } = await query.maybeSingle();

  if (caErr) {
    console.error("[Auth Security Audit] [AGREEMENT_QUERY_FAILED]", caErr.message);
  }

  if (ca) {
    targetPath = ca.final_pdf_path || targetPath;
    targetCompanyId = ca.company_id;
  } else if (storagePathOrAgreementId.includes("agreements/")) {
    const parts = storagePathOrAgreementId.split("/");
    if (parts.length >= 2) targetCompanyId = parts[1];
  }

  if (!targetPath) {
    console.error("[Auth Security Audit] [FINAL_PDF_PATH_MISSING] No final PDF path for agreement", storagePathOrAgreementId);
    return { url: null, error: "저장된 PDF 계약서 경로를 찾을 수 없습니다." };
  }

  // Tenant Security Check:
  if (targetCompanyId) {
    const { data: staff } = await admin
      .from("staff_members")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    const isAdmin = !!staff;

    if (!isAdmin) {
      const { data: cu } = await admin
        .from("company_users")
        .select("company_id, status")
        .eq("id", userId)
        .maybeSingle();

      const isCompanyMember = cu && cu.company_id === targetCompanyId && cu.status === "active";

      if (!isCompanyMember) {
        console.warn(`[Auth Security Audit] [AGREEMENT_COMPANY_MISMATCH] User ${userId} requested company ${targetCompanyId} agreement ${storagePathOrAgreementId}`);
        return { url: null, error: "해당 계약서에 접근할 권한이 없습니다." };
      }
    }
  }

  try {
    const downloadOpt = options?.downloadFilename
      ? { download: options.downloadFilename }
      : undefined;

    // Use adminClient (server-side privileged client) for signed URL generation AFTER authorization check
    const { data: signed, error: signErr } = await admin.storage
      .from("company-uploads")
      .createSignedUrl(targetPath, 3600, downloadOpt);

    if (signErr || !signed?.signedUrl) {
      console.error("[Auth Security Audit] [SIGNED_URL_CREATION_FAILED]", signErr?.message);
      return { url: null, error: "서명된 다운로드 URL을 생성할 수 없습니다." };
    }

    return { url: signed.signedUrl };
  } catch (err) {
    console.error("[Auth Security Audit] [SIGNED_URL_EXCEPTION]", err.message);
    return { url: null, error: err.message || "PDF URL 생성 중 오류가 발생했습니다." };
  }
}

async function main() {
  const brandUserId = "ae811579-4b8e-4cc6-aae7-deab0635e814"; // Tammy Hahm (account@letusto.com)

  console.log("=== 1. Test Brand User VIEW Executed PDF ===");
  const vRes = await simulateGetSignedExecutedPdfUrl(brandUserId, "KSN-AGR-2026-000001");
  console.log("View Result:", vRes);

  console.log("\n=== 2. Test Brand User DOWNLOAD Executed PDF ===");
  const dRes = await simulateGetSignedExecutedPdfUrl(brandUserId, "KSN-AGR-2026-000001", {
    downloadFilename: "K_SELECT_Agreement_KSN-AGR-2026-000001.pdf"
  });
  console.log("Download Result:", dRes);
  if (dRes.url) {
    const fetchRes = await fetch(dRes.url);
    console.log("Download HTTP Status:", fetchRes.status);
    console.log("Content-Disposition:", fetchRes.headers.get("content-disposition"));
  }

  console.log("\n=== 3. Test Tenant Isolation (Unauthorized User) ===");
  const uRes = await simulateGetSignedExecutedPdfUrl("00000000-0000-0000-0000-000000000000", "KSN-AGR-2026-000001");
  console.log("Unauthorized Result:", uRes);
}

main().catch(console.error);
