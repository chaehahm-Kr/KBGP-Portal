const fs = require("fs");
const { createClient } = require("@supabase/supabase-js");

// Read .env.local
const envText = fs.readFileSync(".env.local", "utf8");
const env = {};
envText.split("\n").forEach((line) => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || "";
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    env[match[1]] = value.trim();
  }
});

const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  console.log("=== PRE-DEVELOPMENT AUDIT FOR ADM-BRAND-002-R1 ===");

  const { data: brands, error } = await client
    .from("brands")
    .select(`id, brand_code, name, intro, logo_path, company_id, is_active, created_at, updated_at`)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching brands:", error);
    process.exit(1);
  }

  console.log(`Total Brands in Production DB: ${brands.length}`);

  let normalDescCount = 0;
  let emptyDescCount = 0;
  let legacyMetadataDescCount = 0;

  const auditedBrands = [];

  for (const b of brands) {
    const rawIntro = b.intro || "";
    let descType = "empty";
    let extractedDesc = "";
    let metadataObj = null;

    if (rawIntro.startsWith("__JSON_METADATA__:")) {
      descType = "legacy_metadata";
      legacyMetadataDescCount++;
      try {
        metadataObj = JSON.parse(rawIntro.substring("__JSON_METADATA__:".length));
        extractedDesc = metadataObj.description || "";
      } catch (e) {
        console.error(`Failed to parse JSON metadata for brand ${b.name} (${b.id})`);
      }
    } else if (rawIntro.trim().length > 0) {
      descType = "normal";
      normalDescCount++;
      extractedDesc = rawIntro.trim();
    } else {
      descType = "empty";
      emptyDescCount++;
    }

    auditedBrands.push({
      id: b.id,
      brandCode: b.brand_code,
      name: b.name,
      rawIntro,
      descType,
      extractedDesc,
      metadataObj,
    });
  }

  console.log("\n--- Audit Summary Classification ---");
  console.log(`1. Normal Description Count: ${normalDescCount}`);
  console.log(`2. Empty Description Count: ${emptyDescCount}`);
  console.log(`3. Legacy Metadata Description Count: ${legacyMetadataDescCount}`);

  console.log("\n--- Detailed Brand Inventory ---");
  auditedBrands.forEach((item, idx) => {
    console.log(`\n[${idx + 1}] Brand: ${item.name} (${item.brandCode || item.id})`);
    console.log(`    - Desc Type: ${item.descType}`);
    console.log(`    - Raw Intro Preview: "${item.rawIntro.substring(0, 60)}${item.rawIntro.length > 60 ? '...' : ''}"`);
    console.log(`    - Extracted Description: "${item.extractedDesc}"`);
    if (item.metadataObj) {
      console.log(`    - Trademark Metadata inside intro:`, JSON.stringify(item.metadataObj.trademarks));
    }
  });
}

main().catch(console.error);
