const fs = require('fs');
const path = require('path');
const envFile = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = (match[2] || '').trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    env[match[1]] = value;
  }
});

const { createClient } = require('@supabase/supabase-js');
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY);
const crypto = require('crypto');

async function main() {
  console.log("=== Creating Fresh Admin Direct Invitation for E2E QA ===");

  const testEmail = `qa-brand-${Date.now()}@letusto.com`;
  const companyName = `Beauty Master ${Date.now().toString().slice(-4)}`;
  const contactName = "QA Tester";

  // Check sequence before creation
  const { data: seqBefore } = await admin.from("application_sequence_counter").select("*").single();
  console.log("Sequence Counter BEFORE creation:", seqBefore);

  // Generate token and app number logic (matching invitation-actions.ts)
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  // Create Company
  const introStr = `__COMPANY_METADATA__:${JSON.stringify({
    description: "",
    address: "",
    website: "",
    admin_memo: "E2E Test Invitation",
    contacts: [{ id: crypto.randomUUID(), name: contactName, email: testEmail, isPrimary: true }],
    type: "Brand Owner",
    status: "Active",
  })}`;

  const { data: comp } = await admin.from("companies").insert({
    name: companyName,
    business_registration_number: "PENDING",
    country: "대한민국",
    status: "active",
    contact_name: contactName,
    intro: introStr,
  }).select("id").single();

  console.log("Created Company:", comp.id, companyName);

  // Create company_users
  const { data: invitedAuth } = await admin.auth.admin.createUser({
    email: testEmail,
    email_confirm: false,
    user_metadata: { role: "portal", display_name: contactName },
  });

  const userId = invitedAuth.user.id;
  await admin.from("company_users").insert({
    id: userId,
    company_id: comp.id,
    name: contactName,
    email: testEmail,
    company_role: "company_admin",
    status: "invited",
    invited_at: new Date().toISOString(),
    invitation_token_hash: tokenHash,
    invitation_expires_at: expiresAt,
    is_primary: true,
  });
  console.log("Created Company User & Auth User:", userId, testEmail);

  // Increment sequence
  const nextVal = (seqBefore.current_val || 23) + 1;
  await admin.from("application_sequence_counter").update({
    current_val: nextVal,
    updated_at: new Date().toISOString(),
  }).eq("id", 1);

  const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const code = (10000 - nextVal).toString().padStart(4, "0");
  const reversedCode = code.split("").reverse().join("");
  const appNumber = `APP-${todayStr}-I${reversedCode}`;

  const { data: appRow } = await admin.from("applications").insert({
    company_id: comp.id,
    application_number: appNumber,
    partner_type: "brand",
    entry_mode: "admin_invitation",
    status: "invitation_sent",
    applicant_company_name: companyName,
    applicant_contact_name: contactName,
    applicant_contact_email: testEmail,
    submitted_at: new Date().toISOString(),
    motivation_note: "Admin Brand Direct Invitation",
  }).select("id").single();

  console.log("Created Application:", appRow.id, appNumber);

  // Check sequence after creation
  const { data: seqAfter } = await admin.from("application_sequence_counter").select("*").single();
  console.log("Sequence Counter AFTER creation:", seqAfter);

  // Build CTA URL using canonical domain
  const portalSignupUrl = `https://portal.kselectnetwork.com/portal/signup?token=${encodeURIComponent(rawToken)}`;
  console.log("\nGenerated CTA URL:", portalSignupUrl);
  console.log("Host === portal.kselectnetwork.com?:", portalSignupUrl.startsWith("https://portal.kselectnetwork.com"));

  // Verify token lookup works against Production DB using the raw token
  const verifyHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const { data: verifyRow, error: verifyErr } = await admin
    .from("company_users")
    .select("id, name, email, status, companies!company_users_company_id_fkey(name)")
    .eq("invitation_token_hash", verifyHash)
    .single();

  console.log("\nServer Token Verification Result:", verifyRow, "Error:", verifyErr);

  // Cleanup disposable test
  console.log("\nCleaning up disposable E2E test record...");
  await admin.from("applications").delete().eq("id", appRow.id);
  await admin.from("company_users").delete().eq("id", userId);
  await admin.auth.admin.deleteUser(userId);
  await admin.from("companies").delete().eq("id", comp.id);
  console.log("Disposable test cleaned up safely!");

  const { data: seqFinal } = await admin.from("application_sequence_counter").select("*").single();
  console.log("Sequence Counter FINAL (not rewound):", seqFinal);
}

main().catch(console.error);
