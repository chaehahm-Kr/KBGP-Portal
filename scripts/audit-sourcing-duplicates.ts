import fs from "fs";
import { createClient } from "@supabase/supabase-js";

// Read Production credentials
const prodEnv = fs.readFileSync(".env.local.production_backup", "utf8");
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

// Read QA credentials from .env.qa or .env.local
let qaUrl = "";
let qaKey = "";
if (fs.existsSync(".env.local")) {
  const qaEnv = fs.readFileSync(".env.local", "utf8");
  for (const line of qaEnv.split(/\r?\n/)) {
    if (line.startsWith("NEXT_PUBLIC_SUPABASE_URL=")) {
      qaUrl = line.split("=")[1].trim().replace(/^['"]|['"]$/g, "");
    }
    if (line.startsWith("SUPABASE_SECRET_KEY=")) {
      qaKey = line.split("=")[1].trim().replace(/^['"]|['"]$/g, "");
    }
  }
}

async function auditEnvironment(name: string, url: string, key: string) {
  console.log(`\n======================================================`);
  console.log(`AUDITING ${name}: ${url}`);
  console.log(`======================================================`);
  const client = createClient(url, key);

  // 1. Check Table Counts
  const { count: compCount, error: cErr } = await client
    .from("sourcing_companies")
    .select("*", { count: "exact", head: true });
  console.log(`Total sourcing_companies: ${compCount} (Err: ${cErr?.message || "none"})`);

  const { count: srcCount, error: sErr } = await client
    .from("sourcing_sources")
    .select("*", { count: "exact", head: true });
  console.log(`Total sourcing_sources: ${srcCount} (Err: ${sErr?.message || "none"})`);

  const { count: brandCount } = await client
    .from("sourcing_brands")
    .select("*", { count: "exact", head: true });
  console.log(`Total sourcing_brands: ${brandCount}`);

  const { count: contactCount } = await client
    .from("sourcing_contacts")
    .select("*", { count: "exact", head: true });
  console.log(`Total sourcing_contacts: ${contactCount}`);

  const { count: webCount } = await client
    .from("sourcing_websites")
    .select("*", { count: "exact", head: true });
  console.log(`Total sourcing_websites: ${webCount}`);

  // 2. Fetch all sourcing_sources to inspect for duplicates
  const { data: allSources, error: srcListErr } = await client
    .from("sourcing_sources")
    .select("id, company_id, provider, source_url, source_identifier, collected_at");

  console.log(`\nFetched ${allSources?.length || 0} sourcing_sources rows.`);

  // 3. Fetch all sourcing_companies to inspect for name duplicates
  const { data: allCompanies, error: compListErr } = await client
    .from("sourcing_companies")
    .select("id, company_name_kr, company_name_en, status, grade, created_at");

  console.log(`Fetched ${allCompanies?.length || 0} sourcing_companies rows.`);

  // 4. Fetch all sourcing_websites
  const { data: allWebsites } = await client
    .from("sourcing_websites")
    .select("id, company_id, url");

  console.log(`Fetched ${allWebsites?.length || 0} sourcing_websites rows.`);

  // Audit A: Duplicate source_url or source_identifier
  const urlMap = new Map<string, string[]>();
  for (const s of allSources || []) {
    const rawUrl = s.source_url?.toLowerCase().trim() || "";
    if (rawUrl) {
      const list = urlMap.get(rawUrl) || [];
      list.push(s.company_id);
      urlMap.set(rawUrl, list);
    }
  }

  const dupUrls = Array.from(urlMap.entries()).filter(([_, ids]) => ids.length > 1);
  console.log(`\n[Audit A] Duplicate source_url groups: ${dupUrls.length}`);
  for (const [url, ids] of dupUrls) {
    console.log(`  - URL: ${url} (Companies: ${ids.join(", ")})`);
  }

  // Audit B: Duplicate Korean Name (Exact or Normalized)
  const cleanName = (n: string) =>
    (n || "")
      .replace(/\(주\)|㈜|주식회사|\(유\)|유한회사/g, "")
      .replace(/\s+/g, "")
      .toLowerCase();

  const nameMap = new Map<string, Array<{ id: string; nameKr: string }>>();
  for (const c of allCompanies || []) {
    const norm = cleanName(c.company_name_kr);
    if (norm) {
      const list = nameMap.get(norm) || [];
      list.push({ id: c.id, nameKr: c.company_name_kr });
      nameMap.set(norm, list);
    }
  }

  const dupNames = Array.from(nameMap.entries()).filter(([_, comps]) => comps.length > 1);
  console.log(`\n[Audit B] Duplicate Normalized Korean Name groups: ${dupNames.length}`);
  for (const [norm, comps] of dupNames) {
    console.log(`  - Normalized: "${norm}" -> [${comps.map((c) => `${c.nameKr} (${c.id})`).join(", ")}]`);
    for (const c of comps) {
      const { data: compDetail } = await client.from("sourcing_companies").select("*").eq("id", c.id).single();
      const { data: cSources } = await client.from("sourcing_sources").select("*").eq("company_id", c.id);
      const { data: cContacts } = await client.from("sourcing_contacts").select("*").eq("company_id", c.id);
      const { data: cBrands } = await client.from("sourcing_brands").select("*").eq("company_id", c.id);
      const { data: cRecips } = await client.from("marketing_campaign_recipients").select("id, campaign_id").eq("company_id", c.id);
      const { data: cActs } = await client.from("company_followup_activities").select("id, activity_type").eq("company_id", c.id);
      console.log(`    Detail for ${c.id}:`);
      console.log(`      Status: ${compDetail?.status}, Grade: ${compDetail?.grade}, Created: ${compDetail?.created_at}`);
      console.log(`      Sources (${cSources?.length}): ${cSources?.map((s) => s.source_url).join(", ")}`);
      console.log(`      Contacts (${cContacts?.length}): ${cContacts?.map((con) => con.email).join(", ")}`);
      console.log(`      Brands (${cBrands?.length}): ${cBrands?.map((b) => b.brand_name_kr).join(", ")}`);
      console.log(`      Campaign Recipients (${cRecips?.length}): ${cRecips?.map((r) => r.id).join(", ")}`);
      console.log(`      Follow-up Activities (${cActs?.length}): ${cActs?.map((a) => a.id).join(", ")}`);
    }
  }

  // Audit C: Duplicate Domain in websites
  const getDomain = (u: string) => {
    try {
      return new URL(u).hostname.replace(/^www\./, "").toLowerCase();
    } catch {
      return u.toLowerCase().trim();
    }
  };

  const domainMap = new Map<string, string[]>();
  for (const w of allWebsites || []) {
    const d = getDomain(w.url);
    if (d) {
      const list = domainMap.get(d) || [];
      if (!list.includes(w.company_id)) {
        list.push(w.company_id);
      }
      domainMap.set(d, list);
    }
  }

  const dupDomains = Array.from(domainMap.entries()).filter(([_, ids]) => ids.length > 1);
  console.log(`\n[Audit C] Duplicate Official Domain groups: ${dupDomains.length}`);
  for (const [dom, ids] of dupDomains) {
    console.log(`  - Domain: ${dom} (Companies: ${ids.join(", ")})`);
  }
}

async function run() {
  if (qaUrl && qaKey) {
    await auditEnvironment("QA ENVIRONMENT", qaUrl, qaKey);
  }
  if (prodUrl && prodKey) {
    await auditEnvironment("PRODUCTION ENVIRONMENT", prodUrl, prodKey);
  }
}

run().catch(console.error);
