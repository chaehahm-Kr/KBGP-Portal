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

async function resetBrandsGlobalAgreement() {
  const companyId = "4c845ae8-b93b-4db2-858f-bda3252e8167"; // Brands Global Inc.
  console.log("=== Controlled Reset for Brands Global Inc. (Company ID:", companyId, ") ===");

  // 1. Fetch current company_agreements row
  const { data: caList, error: caFetchErr } = await admin
    .from("company_agreements")
    .select("*")
    .eq("company_id", companyId);

  if (caFetchErr) {
    console.error("Fetch Error:", caFetchErr);
    return;
  }

  console.log("Found agreements count for company:", caList ? caList.length : 0);

  for (const ca of caList || []) {
    console.log(`Processing agreement ${ca.id} (${ca.agreement_id})...`);

    // Delete recipients
    const { data: rDel, error: rErr } = await admin
      .from("company_agreement_recipients")
      .delete()
      .eq("company_agreement_id", ca.id);
    console.log("Deleted recipients result:", rErr ? `Error: ${rErr.message}` : "Success");

    // Delete audit logs
    const { data: aDel, error: aErr } = await admin
      .from("agreement_audit_logs")
      .delete()
      .eq("company_agreement_id", ca.id);
    console.log("Deleted audit logs result:", aErr ? `Error: ${aErr.message}` : "Success");

    // Delete storage PDF if exists
    if (ca.final_pdf_path) {
      console.log("Deleting storage PDF:", ca.final_pdf_path);
      const { data: sDel, error: sErr } = await admin.storage
        .from("company-uploads")
        .remove([ca.final_pdf_path]);
      console.log("Deleted storage result:", sErr ? `Error: ${sErr.message}` : "Success", sDel);
    }

    // Generate new external non-sequential Agreement ID for test company
    const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
    let randSuffix = "";
    for (let i = 0; i < 4; i++) randSuffix += chars.charAt(Math.floor(Math.random() * chars.length));
    const newExternalAgreementId = `KSN-AGR-BGI-26-${randSuffix}`;

    // Delete or Reset the company_agreements row to Pending
    const { data: uRes, error: uErr } = await admin
      .from("company_agreements")
      .update({
        agreement_id: newExternalAgreementId,
        status: "pending",
        signer_user_id: null,
        signer_name: null,
        signer_title: null,
        signer_email: null,
        authority_confirmed: false,
        authority_confirmed_at: null,
        consent_to_agreement: false,
        consent_to_e_signature: false,
        signed_at: null,
        effective_date: null,
        expiration_date: null,
        next_renewal_date: null,
        non_renewal_notice_deadline: null,
        final_pdf_path: null,
        final_pdf_hash: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", ca.id);

    console.log("Reset agreement row to pending:", uErr ? `Error: ${uErr.message}` : "SUCCESS");
  }

  console.log("\n=== Reset Complete! Brands Global Inc. is now in 'Pending / 계약 서명 필요' state. ===");
}

resetBrandsGlobalAgreement().catch(console.error);
