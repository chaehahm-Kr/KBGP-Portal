import fs from "fs";
import { createClient } from "@supabase/supabase-js";
import {
  normalizeSourceUrl,
  normalizeKoreanCompanyName,
  normalizeEnglishCompanyName,
  normalizeWebsiteDomain,
} from "../lib/brand-sourcing/duplicate-detector";

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

async function runPreflightAudit() {
  console.log("================================================================================");
  console.log("PRODUCTION PREFLIGHT AUDIT FOR MIGRATION 0189 (READ-ONLY)");
  console.log("Target Project: shzfrppdobpmrstcjfqu (K SELECT Production)");
  console.log("Time:", new Date().toISOString());
  console.log("================================================================================\n");

  // 1. Audit sourcing_sources table
  console.log("[1. AUDITING sourcing_sources IN PRODUCTION]");
  const { data: sources, error: sErr } = await prodSupabase
    .from("sourcing_sources")
    .select("id, company_id, provider, source_url, source_identifier, collected_at, sourcing_companies(id, company_name_kr, company_name_en, status, grade)");

  if (sErr) {
    console.error("Failed to query sourcing_sources:", sErr);
    return;
  }

  console.log(`Total sourcing_sources rows in PROD: ${sources?.length || 0}`);

  // Check providers
  const providersCount: Record<string, number> = {};
  for (const s of sources || []) {
    providersCount[s.provider] = (providersCount[s.provider] || 0) + 1;
  }
  console.log("Providers breakdown:", providersCount);

  // Check canonical URLs and duplicates
  const rawUrlMap = new Map<string, any[]>();
  const canonicalUrlMap = new Map<string, any[]>();
  const providerCanonicalMap = new Map<string, any[]>();

  for (const s of sources || []) {
    const raw = s.source_url || "";
    const canonical = normalizeSourceUrl(raw);
    const provKey = `${s.provider}:::${canonical}`;

    // Raw URL map
    if (raw) {
      const list = rawUrlMap.get(raw) || [];
      list.push(s);
      rawUrlMap.set(raw, list);
    }

    // Canonical URL map
    if (canonical) {
      const list = canonicalUrlMap.get(canonical) || [];
      list.push(s);
      canonicalUrlMap.set(canonical, list);
    }

    // Provider + Canonical map
    if (canonical) {
      const list = providerCanonicalMap.get(provKey) || [];
      list.push(s);
      providerCanonicalMap.set(provKey, list);
    }
  }

  console.log("\n--- URL DUPLICATE CHECKS ---");
  const duplicateRawUrls = Array.from(rawUrlMap.entries()).filter(([_, rows]) => rows.length > 1);
  console.log(`Duplicate Raw URLs count: ${duplicateRawUrls.length}`);
  for (const [url, rows] of duplicateRawUrls) {
    console.log(`  Raw URL: "${url}" -> ${rows.length} rows (IDs: ${rows.map(r => r.id).join(", ")})`);
  }

  const duplicateCanonicalUrls = Array.from(canonicalUrlMap.entries()).filter(([_, rows]) => rows.length > 1);
  console.log(`Duplicate Canonical URLs count: ${duplicateCanonicalUrls.length}`);
  for (const [url, rows] of duplicateCanonicalUrls) {
    console.log(`  Canonical URL: "${url}" -> ${rows.length} rows (IDs: ${rows.map(r => r.id).join(", ")})`);
  }

  const duplicateProviderCanonical = Array.from(providerCanonicalMap.entries()).filter(([_, rows]) => rows.length > 1);
  console.log(`Duplicate (Provider, Canonical URL) pairs count: ${duplicateProviderCanonical.length}`);
  for (const [key, rows] of duplicateProviderCanonical) {
    console.log(`  (Provider, Canonical): "${key}" -> ${rows.length} rows (IDs: ${rows.map(r => r.id).join(", ")})`);
  }

  // 2. Audit sourcing_companies table
  console.log("\n[2. AUDITING sourcing_companies IN PRODUCTION]");
  const { data: companies, error: cErr } = await prodSupabase
    .from("sourcing_companies")
    .select(`
      id, company_name_kr, company_name_en, status, grade, created_at, updated_at,
      sourcing_sources(id, provider, source_url),
      sourcing_brands(id, brand_name_kr),
      sourcing_contacts(id, email),
      sourcing_websites(id, url)
    `);

  if (cErr) {
    console.error("Failed to query sourcing_companies:", cErr);
    return;
  }

  console.log(`Total sourcing_companies rows in PROD: ${companies?.length || 0}`);

  // Exact Name KR duplicates
  const rawNameKrMap = new Map<string, any[]>();
  const normNameKrMap = new Map<string, any[]>();
  const normNameEnMap = new Map<string, any[]>();

  for (const c of companies || []) {
    const rawKr = c.company_name_kr || "";
    const normKr = normalizeKoreanCompanyName(rawKr);
    const normEn = normalizeEnglishCompanyName(c.company_name_en || "");

    if (rawKr) {
      const list = rawNameKrMap.get(rawKr) || [];
      list.push(c);
      rawNameKrMap.set(rawKr, list);
    }

    if (normKr) {
      const list = normNameKrMap.get(normKr) || [];
      list.push(c);
      normNameKrMap.set(normKr, list);
    }

    if (normEn) {
      const list = normNameEnMap.get(normEn) || [];
      list.push(c);
      normNameEnMap.set(normEn, list);
    }
  }

  console.log("\n--- COMPANY NAME DUPLICATE CHECKS ---");
  const dupRawKr = Array.from(rawNameKrMap.entries()).filter(([_, rows]) => rows.length > 1);
  console.log(`Exact raw company_name_kr duplicates count: ${dupRawKr.length}`);
  for (const [name, rows] of dupRawKr) {
    console.log(`  Raw Name KR: "${name}" -> ${rows.length} rows:`);
    for (const r of rows) {
      console.log(`    - ID: ${r.id}, Created: ${r.created_at}, Sources: ${r.sourcing_sources?.length || 0}, Brands: ${r.sourcing_brands?.length || 0}`);
    }
  }

  const dupNormKr = Array.from(normNameKrMap.entries()).filter(([_, rows]) => rows.length > 1);
  console.log(`Normalized Korean legal name duplicates count: ${dupNormKr.length}`);
  for (const [norm, rows] of dupNormKr) {
    console.log(`  Normalized Name KR: "${norm}" -> ${rows.length} rows:`);
    for (const r of rows) {
      console.log(`    - ID: ${r.id}, Raw: "${r.company_name_kr}", Created: ${r.created_at}, Status: ${r.status}, Grade: ${r.grade}, Sources: ${r.sourcing_sources?.length || 0}, Brands: ${r.sourcing_brands?.length || 0}`);
    }
  }

  const dupNormEn = Array.from(normNameEnMap.entries()).filter(([_, rows]) => rows.length > 1);
  console.log(`Normalized English legal name duplicates count: ${dupNormEn.length}`);
  for (const [norm, rows] of dupNormEn) {
    console.log(`  Normalized Name EN: "${norm}" -> ${rows.length} rows`);
  }

  // 3. Inspect existing constraints & columns on Production
  console.log("\n[3. AUDITING EXISTING SCHEMA / COLUMNS ON PROD]");
  // Try querying canonical_source_url on sourcing_sources
  const { error: colCheckSrc } = await prodSupabase
    .from("sourcing_sources")
    .select("canonical_source_url")
    .limit(1);
  console.log("Does sourcing_sources.canonical_source_url already exist?", !colCheckSrc ? "YES" : `NO (${colCheckSrc.message})`);

  // Try querying normalized_name_kr on sourcing_companies
  const { error: colCheckComp } = await prodSupabase
    .from("sourcing_companies")
    .select("normalized_name_kr, normalized_name_en")
    .limit(1);
  console.log("Does sourcing_companies.normalized_name_kr already exist?", !colCheckComp ? "YES" : `NO (${colCheckComp.message})`);

  // Check if sourcing_duplicate_exceptions table exists
  const { error: tblCheckExc } = await prodSupabase
    .from("sourcing_duplicate_exceptions")
    .select("id")
    .limit(1);
  console.log("Does sourcing_duplicate_exceptions table already exist?", !tblCheckExc ? "YES" : `NO (${tblCheckExc.message})`);

  console.log("\n================================================================================");
  console.log("PREFLIGHT AUDIT COMPLETE — ZERO MUTATIONS PERFORMED");
  console.log("================================================================================");
}

runPreflightAudit().catch(err => {
  console.error("FATAL ERROR in preflight audit:", err);
  process.exit(1);
});
