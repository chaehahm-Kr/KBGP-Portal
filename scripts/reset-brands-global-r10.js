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
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(supabaseUrl, supabaseSecretKey);

async function resetBrandsGlobalAgreementR10() {
  console.log("=== PORT-AGR-001-R10: Brands Global Inc. Agreement Reset for Completion Email E2E Retest ===");

  // 1. Fetch Brands Global Inc. company
  const { data: comp, error: compErr } = await admin
    .from("companies")
    .select("id, name")
    .ilike("name", "%Brands Global%")
    .single();

  if (compErr || !comp) {
    console.error("Company Fetch Error:", compErr);
    return;
  }

  console.log(`Target Company: ${comp.name} (ID: ${comp.id})`);

  // 2. Fetch current company_agreements record
  const { data: caList, error: caFetchErr } = await admin
    .from("company_agreements")
    .select("*")
    .eq("company_id", comp.id);

  if (caFetchErr) {
    console.error("Fetch Error:", caFetchErr);
    return;
  }

  console.log(`Found ${caList?.length || 0} agreement records.`);

  for (const ca of caList || []) {
    console.log(`\nProcessing Agreement ID: ${ca.agreement_id} (Internal UUID: ${ca.id})...`);
    console.log(`Current Status: ${ca.status}, Signer: ${ca.signer_name || 'none'}, PDF: ${ca.final_pdf_path || 'none'}`);

    // 3. Delete recipient records
    const { count: recCount, error: rErr } = await admin
      .from("company_agreement_recipients")
      .delete({ count: "exact" })
      .eq("company_agreement_id", ca.id);
    console.log(`Deleted company_agreement_recipients: ${rErr ? `Error: ${rErr.message}` : `Success (${recCount ?? 'all'} records removed)`}`);

    // 4. Delete audit log records
    const { count: logCount, error: aErr } = await admin
      .from("agreement_audit_logs")
      .delete({ count: "exact" })
      .eq("company_agreement_id", ca.id);
    console.log(`Deleted agreement_audit_logs: ${aErr ? `Error: ${aErr.message}` : `Success (${logCount ?? 'all'} records removed)`}`);

    // 5. Delete executed PDF from storage
    if (ca.final_pdf_path) {
      console.log(`Removing executed PDF from storage: ${ca.final_pdf_path}`);
      const { data: sDel, error: sErr } = await admin.storage
        .from("company-uploads")
        .remove([ca.final_pdf_path]);
      console.log(`Deleted storage object: ${sErr ? `Error: ${sErr.message}` : "Success"}`);
    } else {
      console.log("No executed PDF path stored on agreement.");
    }

    // 6. Reset the agreement record back to pending while preserving Agreement ID
    const targetAgreementId = ca.agreement_id || "KSN-AGR-BGI-26-8J8W";
    const { data: uRes, error: uErr } = await admin
      .from("company_agreements")
      .update({
        agreement_id: targetAgreementId,
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
      .eq("id", ca.id)
      .select()
      .single();

    if (uErr) {
      console.error("Update Error:", uErr);
    } else {
      console.log(`Reset company_agreements row: SUCCESS`);
      console.log(`Verified Status: ${uRes.status}, Agreement ID: ${uRes.agreement_id}`);
    }
  }

  // 7. Verify final DB state
  const { data: verifyCa } = await admin
    .from("company_agreements")
    .select("id, agreement_id, status, version, final_pdf_path, signer_name, updated_at")
    .eq("company_id", comp.id);

  const { data: verifyRec } = await admin
    .from("company_agreement_recipients")
    .select("id")
    .in("company_agreement_id", (verifyCa || []).map(a => a.id));

  const { data: verifyLogs } = await admin
    .from("agreement_audit_logs")
    .select("id")
    .in("company_agreement_id", (verifyCa || []).map(a => a.id));

  console.log("\n=== Final Verification ===");
  console.log("Company Agreements:", JSON.stringify(verifyCa, null, 2));
  console.log("Remaining Recipients Count:", verifyRec?.length || 0);
  console.log("Remaining Audit Logs Count:", verifyLogs?.length || 0);
  console.log("\n=== Reset Complete! Brands Global Inc. is Ready for User E2E Email Test ===");
}

resetBrandsGlobalAgreementR10().catch(console.error);
