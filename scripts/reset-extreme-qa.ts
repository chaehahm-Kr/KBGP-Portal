import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

function loadEnv() {
  const envFiles = [".env.local", ".env.production.local", ".env"];
  for (const file of envFiles) {
    const fullPath = path.resolve(process.cwd(), file);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx !== -1) {
          const key = trimmed.slice(0, eqIdx).trim();
          let val = trimmed.slice(eqIdx + 1).trim();
          if (
            (val.startsWith('"') && val.endsWith('"')) ||
            (val.startsWith("'") && val.endsWith("'"))
          ) {
            val = val.slice(1, -1);
          }
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    }
  }
}

loadEnv();

async function run() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SECRET_KEY!;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Missing env vars: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const companyId = "7d669d13-1c62-494e-a520-c2133348edbe";
  const userEmail = "tammyhahm77@gmail.com";

  console.log("Fetching company and user info...");
  const { data: comp } = await admin.from("companies").select("*").eq("id", companyId).single();
  console.log("Current company name:", comp?.name);

  // 1. Reset onboarding flags inside companies.intro metadata JSON
  let introMeta: any = {};
  if (comp?.intro && typeof comp.intro === "string" && comp.intro.startsWith("__COMPANY_METADATA__:")) {
    try {
      introMeta = JSON.parse(comp.intro.substring("__COMPANY_METADATA__:".length));
    } catch (e) {}
  }
  delete introMeta.company_onboarding_confirmed_at;
  delete introMeta.admin_profile_onboarding_confirmed_at;
  delete introMeta.brand_onboarding_confirmed_at;
  delete introMeta.team_onboarding_skipped;

  const newIntro = `__COMPANY_METADATA__:${JSON.stringify(introMeta)}`;
  const { error: compErr } = await admin.from("companies").update({
    intro: newIntro,
  }).eq("id", companyId);
  console.log("Reset companies intro metadata onboarding flags:", compErr ? compErr : "SUCCESS");

  // 2. Reset user profile fields (title, position, phone) for test user while preserving auth credentials
  const { error: userErr } = await admin.from("company_users").update({
    title: null,
    position: null,
    phone: null,
  }).eq("email", userEmail);
  console.log("Reset company_users profile fields for " + userEmail + ":", userErr ? userErr : "SUCCESS");

  // 3. Reset agreement status to pending and clear signature info
  const { data: agreements } = await admin.from("company_agreements").select("id").eq("company_id", companyId);
  if (agreements && agreements.length > 0) {
    for (const a of agreements) {
      await admin.from("agreement_recipients").delete().eq("company_agreement_id", a.id);
    }
  }
  const { error: agErr } = await admin.from("company_agreements").update({
    status: "pending",
    signed_at: null,
    signer_name: null,
    signer_title: null,
    signer_email: null,
    final_pdf_path: null,
  }).eq("company_id", companyId);
  console.log("Reset company_agreements to pending:", agErr ? agErr : "SUCCESS");

  // 4. Ensure product price: price_krw_retail = 35000, estimated_retail_price = null
  const { error: prodErr } = await admin.from("products").update({
    price_krw_retail: 35000,
    estimated_retail_price: null,
  }).eq("company_id", companyId);
  console.log("Updated products price:", prodErr ? prodErr : "SUCCESS");

  // 5. Reset company_task_assignments for company
  const { error: taskErr } = await admin.from("company_task_assignments").delete().eq("company_id", companyId);
  console.log("Reset company_task_assignments:", taskErr ? taskErr : "SUCCESS");

  // Verify final state
  const { data: finalComp } = await admin.from("companies").select("id, name, intro").eq("id", companyId).single();
  const { data: finalCu } = await admin.from("company_users").select("id, name, email, title, position, phone").eq("email", userEmail);
  const { data: finalCa } = await admin.from("company_agreements").select("id, agreement_id, status, signed_at, signer_title").eq("company_id", companyId);
  const { data: finalProds } = await admin.from("products").select("id, name, price_krw_retail, estimated_retail_price, status").eq("company_id", companyId);

  console.log("\n--- Verification Summary ---");
  console.log("Company Intro Metadata:", finalComp?.intro);
  console.log("User Profile:", finalCu);
  console.log("Agreement Status:", finalCa);
  console.log("Products:", finalProds);
  console.log("Extreme Inc QA Retest Reset Completed Successfully!");
}

run().catch(console.error);
