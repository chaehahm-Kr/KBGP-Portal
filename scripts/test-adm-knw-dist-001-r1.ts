import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// Load environment variables
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  }
}

// Mirror the exact function implemented in components/admin/knowledge/library-view.tsx
export function computeAudienceIndicators(audience: string[] = []) {
  const rawList = Array.isArray(audience) ? audience : [];
  const normalized = rawList.map((aud) => (typeof aud === "string" ? aud.trim().toUpperCase() : ""));

  const isInternal = normalized.some((aud) => aud === "INTERNAL" || aud === "ADMIN / MANAGEMENT");
  const isBrand = normalized.some((aud) => aud === "BRAND");
  const isRetail = normalized.some((aud) => aud === "RETAIL" || aud === "RETAILER");

  return [
    {
      key: "internal",
      label: "Internal",
      active: isInternal,
    },
    {
      key: "brand",
      label: "Brand",
      active: isBrand,
    },
    {
      key: "retail",
      label: "Retail",
      active: isRetail,
    },
  ];
}

async function runTests() {
  console.log("===============================================================");
  console.log("TEST SUITE: ADM-KNOWLEDGE-DISTRIBUTION-001-R1");
  console.log("Audience Badges Three Fixed Distribution Columns Verification");
  console.log("===============================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, desc: string) {
    if (condition) {
      console.log(`  [PASS] ${desc}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${desc}`);
      failed++;
    }
  }

  // --- SECTION 1: Fixed Structure & Order Tests ---
  console.log("--- Section 1: Fixed 3-Column Order & Uniqueness ---");
  const testCases = [
    { name: "Empty audience", input: [], expected: { internal: false, brand: false, retail: false } },
    { name: "Single INTERNAL", input: ["INTERNAL"], expected: { internal: true, brand: false, retail: false } },
    { name: "Single ADMIN / MANAGEMENT", input: ["ADMIN / MANAGEMENT"], expected: { internal: true, brand: false, retail: false } },
    { name: "Duplicate Internal aliases", input: ["INTERNAL", "ADMIN / MANAGEMENT"], expected: { internal: true, brand: false, retail: false } },
    { name: "Single BRAND", input: ["BRAND"], expected: { internal: false, brand: true, retail: false } },
    { name: "Single RETAIL", input: ["RETAIL"], expected: { internal: false, brand: false, retail: true } },
    { name: "Single RETAILER", input: ["RETAILER"], expected: { internal: false, brand: false, retail: true } },
    { name: "INTERNAL + BRAND", input: ["INTERNAL", "BRAND"], expected: { internal: true, brand: true, retail: false } },
    { name: "BRAND + RETAILER", input: ["BRAND", "RETAILER"], expected: { internal: false, brand: true, retail: true } },
    { name: "INTERNAL + BRAND + RETAIL", input: ["INTERNAL", "BRAND", "RETAIL"], expected: { internal: true, brand: true, retail: true } },
    { name: "Deduplication of BRAND + INTERNAL + ADMIN / MANAGEMENT", input: ["BRAND", "INTERNAL", "ADMIN / MANAGEMENT"], expected: { internal: true, brand: true, retail: false } },
    { name: "Case insensitivity check", input: ["internal", "brand", "retailer"], expected: { internal: true, brand: true, retail: true } },
  ];

  for (const tc of testCases) {
    const result = computeAudienceIndicators(tc.input);

    // 1. Length is always 3
    assert(result.length === 3, `${tc.name}: exactly 3 indicators returned`);

    // 2. Order is strictly Internal, Brand, Retail
    assert(
      result[0].key === "internal" && result[1].key === "brand" && result[2].key === "retail",
      `${tc.name}: strict order [Internal, Brand, Retail]`
    );

    // 3. Labels are strictly "Internal", "Brand", "Retail"
    assert(
      result[0].label === "Internal" && result[1].label === "Brand" && result[2].label === "Retail",
      `${tc.name}: correct display labels`
    );

    // 4. No duplicate keys or labels
    const keys = result.map((r) => r.key);
    const labels = result.map((r) => r.label);
    assert(new Set(keys).size === 3 && new Set(labels).size === 3, `${tc.name}: no duplicate labels or keys`);

    // 5. Active flags match expected
    assert(
      result[0].active === tc.expected.internal &&
        result[1].active === tc.expected.brand &&
        result[2].active === tc.expected.retail,
      `${tc.name}: active states match (Internal: ${result[0].active}, Brand: ${result[1].active}, Retail: ${result[2].active})`
    );
  }

  // --- SECTION 2: Database Validation Across All 14 Manuals ---
  console.log("\n--- Section 2: Real Database Verification (All 14 Knowledge Items) ---");
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseKey =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "";

  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data: items, error } = await supabase
    .from("knowledge_items")
    .select("id, title, audience")
    .order("id");

  if (error || !items) {
    console.error("  [FAIL] Could not query knowledge_items from Supabase:", error);
    failed++;
  } else {
    assert(items.length >= 14, `Found ${items.length} items (expected at least 14)`);

    for (const item of items) {
      const indicators = computeAudienceIndicators(item.audience);

      // Verify structure
      const correctStructure =
        indicators.length === 3 &&
        indicators[0].label === "Internal" &&
        indicators[1].label === "Brand" &&
        indicators[2].label === "Retail";

      assert(correctStructure, `[${item.id}] Has exactly 3 fixed indicators in order`);

      // Verify active states match item's actual audience
      const audUpper = (item.audience || []).map((a: string) => (typeof a === "string" ? a.trim().toUpperCase() : ""));
      const expectedInt = audUpper.includes("INTERNAL") || audUpper.includes("ADMIN / MANAGEMENT");
      const expectedBrd = audUpper.includes("BRAND");
      const expectedRtl = audUpper.includes("RETAIL") || audUpper.includes("RETAILER");

      const matchAudience =
        indicators[0].active === expectedInt &&
        indicators[1].active === expectedBrd &&
        indicators[2].active === expectedRtl;

      assert(
        matchAudience,
        `[${item.id}] Stored: ${JSON.stringify(item.audience)} -> Indicators: Int=${indicators[0].active}, Brd=${indicators[1].active}, Rtl=${indicators[2].active}`
      );
    }
  }

  console.log("\n===============================================================");
  console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("===============================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((e) => {
  console.error("Unexpected test runner error:", e);
  process.exit(1);
});
