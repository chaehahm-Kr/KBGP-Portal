import fs from "fs";
import { createClient } from "@supabase/supabase-js";

// Read Production credentials safely
const prodBackupPath = ".env.local.production_backup";
if (!fs.existsSync(prodBackupPath)) {
  console.error("FATAL: .env.local.production_backup not found!");
  process.exit(1);
}

const prodEnv = fs.readFileSync(prodBackupPath, "utf8");
let prodUrl = "";
let prodKey = "";
for (const line of prodEnv.split(/\r?\n/)) {
  if (line.startsWith("NEXT_PUBLIC_SUPABASE_URL=")) {
    prodUrl = line.split("=")[1].trim().replace(/^['"]|['"]$/g, "");
  }
  if (line.startsWith("SUPABASE_SECRET_KEY=")) {
    prodKey = line.split("=")[1].trim().replace(/^['"]|['"]$/g, "");
  }
}

if (!prodUrl.includes("shzfrppdobpmrstcjfqu") || !prodKey) {
  console.error("FATAL: Invalid production credentials! Expected shzfrppdobpmrstcjfqu");
  process.exit(1);
}

const prodSupabase = createClient(prodUrl, prodKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  console.log("================================================================================");
  console.log("PRODUCTION SCHEMA VERIFICATION FOR MIGRATIONS 0185 - 0190 (READ-ONLY)");
  console.log("Target Project: shzfrppdobpmrstcjfqu (K SELECT Production)");
  console.log("================================================================================\n");

  let allPassed = true;

  // 1. Verify 0185 / 0186: marketing_campaigns, marketing_templates, marketing_campaign_recipients
  console.log("[1. Migration 0185 & 0186: Marketing Campaigns & Recipients]");
  const { data: tmpls, error: tErr } = await prodSupabase
    .from("marketing_templates")
    .select("id, name, template_type, language")
    .limit(3);
  if (tErr) {
    console.error("  ❌ marketing_templates error:", tErr.message);
    allPassed = false;
  } else {
    console.log(`  ✓ marketing_templates table exists (${tmpls?.length} templates found)`);
  }

  const { data: camps, error: cErr } = await prodSupabase
    .from("marketing_campaigns")
    .select("id, name, status, approval_status, language")
    .limit(3);
  if (cErr) {
    console.error("  ❌ marketing_campaigns error:", cErr.message);
    allPassed = false;
  } else {
    console.log(`  ✓ marketing_campaigns table exists (${camps?.length} campaigns found)`);
  }

  const { data: results, error: rErr } = await prodSupabase
    .from("marketing_campaign_recipients")
    .select("id, campaign_id, recipient_email, send_eligibility, status")
    .limit(3);
  if (rErr) {
    console.error("  ❌ marketing_campaign_recipients error:", rErr.message);
    allPassed = false;
  } else {
    console.log(`  ✓ marketing_campaign_recipients table exists (${results?.length} recipients found)`);
  }

  // 2. Verify 0188: marketing_suppression_list
  console.log("\n[2. Migration 0188: Marketing Suppression List & Assets]");
  const { data: supps, error: supErr } = await prodSupabase
    .from("marketing_suppression_list")
    .select("id, email, reason, notes, suppressed_at")
    .limit(3);
  if (supErr) {
    console.error("  ❌ marketing_suppression_list error:", supErr.message);
    allPassed = false;
  } else {
    console.log(`  ✓ marketing_suppression_list table exists (${supps?.length} suppression entries found)`);
  }

  // 3. Verify 0189: Duplicate Prevention (sourcing_sources & sourcing_duplicate_exceptions)
  console.log("\n[3. Migration 0189: Duplicate Prevention (sourcing_sources & exceptions)]");
  const { data: srcCols, error: srcErr } = await prodSupabase
    .from("sourcing_sources")
    .select("id, canonical_source_url, source_identifier, source_url")
    .limit(3);
  if (srcErr) {
    console.error("  ❌ sourcing_sources error:", srcErr.message);
    allPassed = false;
  } else {
    console.log(`  ✓ sourcing_sources columns (canonical_source_url, source_identifier) exist (${srcCols?.length} sources checked)`);
  }

  const { data: excRows, error: excErr } = await prodSupabase
    .from("sourcing_duplicate_exceptions")
    .select("id, company_id, matched_company_id, matched_rule, reason, approved_by, created_at")
    .limit(3);
  if (excErr) {
    console.error("  ❌ sourcing_duplicate_exceptions error:", excErr.message);
    allPassed = false;
  } else {
    console.log(`  ✓ sourcing_duplicate_exceptions table exists (${excRows?.length} exceptions found)`);
  }

  const { data: normCols, error: normErr } = await prodSupabase
    .from("sourcing_companies")
    .select("id, normalized_name_kr, normalized_name_en")
    .limit(3);
  if (normErr) {
    console.error("  ❌ sourcing_companies normalized columns error:", normErr.message);
    allPassed = false;
  } else {
    console.log(`  ✓ sourcing_companies normalized columns (normalized_name_kr, normalized_name_en) exist`);
  }

  // 4. Verify 0190: Primary Product Categories
  console.log("\n[4. Migration 0190: Primary Product Categories]");
  const { data: catCols, error: catErr } = await prodSupabase
    .from("sourcing_companies")
    .select("id, company_name_kr, primary_product_categories, primary_categories_confirmed")
    .limit(5);
  if (catErr) {
    console.error("  ❌ sourcing_companies primary categories error:", catErr.message);
    allPassed = false;
  } else {
    console.log(`  ✓ sourcing_companies primary categories columns exist! Sample rows:`);
    for (const row of catCols || []) {
      console.log(`    - ${row.company_name_kr}: categories=${JSON.stringify(row.primary_product_categories)}, confirmed=${row.primary_categories_confirmed}`);
    }
  }

  console.log("\n================================================================================");
  if (allPassed) {
    console.log("PRODUCTION SCHEMA VERIFICATION RESULT: ALL 5 MIGRATIONS VERIFIED & PASS");
    console.log("Database: shzfrppdobpmrstcjfqu has migrations 0185, 0186, 0188, 0189, 0190 active!");
  } else {
    console.error("PRODUCTION SCHEMA VERIFICATION RESULT: SOME MIGRATIONS MISSING OR INCOMPATIBLE");
  }
  console.log("================================================================================");
}

main().catch(console.error);
