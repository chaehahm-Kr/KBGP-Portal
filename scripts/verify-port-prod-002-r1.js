const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    env[match[1]] = value.trim();
  }
});

const url = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(url, key);

// Canonical resolver logic
const CATEGORY_TO_CODE_MAP = {
  skincare: "SKINCARE",
  hair_scalp: "HAIR_CARE",
  beauty_tools: "BEAUTY_TOOLS",
  daily_care: "BODY_CARE",
  wellness_patch: "PERSONAL_CARE",
  other: "OTHER",
};

function resolveAuthoritativeCategoryCode(categoryOrCode) {
  if (!categoryOrCode || typeof categoryOrCode !== "string") return null;
  const trimmed = categoryOrCode.trim();
  if (!trimmed) return null;
  if (trimmed in CATEGORY_TO_CODE_MAP) return CATEGORY_TO_CODE_MAP[trimmed];
  const lower = trimmed.toLowerCase();
  if (lower in CATEGORY_TO_CODE_MAP) return CATEGORY_TO_CODE_MAP[lower];
  if (trimmed === "스킨케어") return "SKINCARE";
  if (trimmed === "헤어케어" || trimmed === "헤어&스칼프" || trimmed === "헤어") return "HAIR_CARE";
  if (trimmed === "바디케어" || trimmed === "데일리케어") return "BODY_CARE";
  if (trimmed === "뷰티툴" || trimmed === "뷰티소품·툴") return "BEAUTY_TOOLS";
  if (trimmed === "퍼스널케어" || trimmed === "웰니스·기능성패치") return "PERSONAL_CARE";
  if (trimmed === "기타") return "OTHER";
  return "OTHER";
}

async function runTests() {
  console.log("=== PORT-PROD-002-R1 Category Code FK Verification ===");

  // 1. Fetch Extreme Inc company and brand
  const { data: company, error: compErr } = await supabase
    .from('companies')
    .select('id, name')
    .ilike('name', '%Extreme%')
    .single();

  if (compErr || !company) {
    console.error("Company Extreme Inc not found:", compErr);
    process.exit(1);
  }
  console.log(`[PASS] Target Company: ${company.name} (${company.id})`);

  const { data: brand, error: brandErr } = await supabase
    .from('brands')
    .select('id, name')
    .eq('company_id', company.id)
    .limit(1)
    .single();

  if (brandErr || !brand) {
    console.error("Brand not found for company:", brandErr);
    process.exit(1);
  }
  console.log(`[PASS] Target Brand: ${brand.name} (${brand.id})`);

  const testProductIds = [];

  try {
    // TEST 1: Draft Save with 'skincare' -> category_code 'SKINCARE'
    const draftSku1 = `QA-DRAFT-SKIN-${Date.now()}`;
    const catCode1 = resolveAuthoritativeCategoryCode('skincare');
    console.log(`\nTest 1: Draft Save with category='skincare', category_code='${catCode1}'`);
    const { data: p1, error: err1 } = await supabase
      .from('products')
      .insert({
        company_id: company.id,
        brand_id: brand.id,
        name: 'QA Test Draft Skincare',
        name_en: 'QA Test Draft Skincare',
        category: 'skincare',
        category_code: catCode1,
        manufacture_sku: draftSku1,
      })
      .select('id, name, category, category_code')
      .single();

    if (err1 || !p1) {
      console.error("[FAIL] Test 1 Failed:", err1);
      throw err1;
    }
    testProductIds.push(p1.id);
    console.log(`[PASS] Test 1 Succeeded: id=${p1.id}, category=${p1.category}, category_code=${p1.category_code}`);

    // TEST 2: Draft Save with 'other' -> category_code 'OTHER'
    const draftSku2 = `QA-DRAFT-OTHER-${Date.now()}`;
    const catCode2 = resolveAuthoritativeCategoryCode('other');
    console.log(`\nTest 2: Draft Save with category='other', category_code='${catCode2}'`);
    const { data: p2, error: err2 } = await supabase
      .from('products')
      .insert({
        company_id: company.id,
        brand_id: brand.id,
        name: 'QA Test Draft Other',
        name_en: 'QA Test Draft Other',
        category: 'other',
        category_code: catCode2,
        manufacture_sku: draftSku2,
      })
      .select('id, name, category, category_code')
      .single();

    if (err2 || !p2) {
      console.error("[FAIL] Test 2 Failed:", err2);
      throw err2;
    }
    testProductIds.push(p2.id);
    console.log(`[PASS] Test 2 Succeeded: id=${p2.id}, category=${p2.category}, category_code=${p2.category_code}`);

    // TEST 3: Final Registration with 'skincare' -> category_code 'SKINCARE'
    const finalSku1 = `QA-FINAL-SKIN-${Date.now()}`;
    const catCode3 = resolveAuthoritativeCategoryCode('skincare');
    console.log(`\nTest 3: Final Registration with category='skincare', category_code='${catCode3}'`);
    const { data: p3, error: err3 } = await supabase
      .from('products')
      .insert({
        company_id: company.id,
        brand_id: brand.id,
        name: 'QA Test Final Skincare',
        name_en: 'QA Test Final Skincare',
        category: 'skincare',
        category_code: catCode3,
        manufacture_sku: finalSku1,
        price_krw_retail: 25000,
        price_usd_fob: 8.5,
        upc: '8801234567890',
        selling_online: true,
      })
      .select('id, name, category, category_code, price_krw_retail, price_usd_fob')
      .single();

    if (err3 || !p3) {
      console.error("[FAIL] Test 3 Failed:", err3);
      throw err3;
    }
    testProductIds.push(p3.id);
    console.log(`[PASS] Test 3 Succeeded: id=${p3.id}, category=${p3.category}, category_code=${p3.category_code}`);

    // TEST 4: Final Registration with 'other' -> category_code 'OTHER'
    const finalSku2 = `QA-FINAL-OTHER-${Date.now()}`;
    const catCode4 = resolveAuthoritativeCategoryCode('other');
    console.log(`\nTest 4: Final Registration with category='other', category_code='${catCode4}'`);
    const { data: p4, error: err4 } = await supabase
      .from('products')
      .insert({
        company_id: company.id,
        brand_id: brand.id,
        name: 'QA Test Final Other',
        name_en: 'QA Test Final Other',
        category: 'other',
        category_code: catCode4,
        manufacture_sku: finalSku2,
        price_krw_retail: 30000,
        price_usd_fob: 10.0,
        ean: '8809876543210',
        selling_offline: true,
      })
      .select('id, name, category, category_code, price_krw_retail, price_usd_fob')
      .single();

    if (err4 || !p4) {
      console.error("[FAIL] Test 4 Failed:", err4);
      throw err4;
    }
    testProductIds.push(p4.id);
    console.log(`[PASS] Test 4 Succeeded: id=${p4.id}, category=${p4.category}, category_code=${p4.category_code}`);

    // TEST 5: Verify foreign key references public.categories table
    console.log("\nTest 5: Verify category codes exist in categories table");
    const { data: catRows, error: catErr } = await supabase
      .from('categories')
      .select('code, name_ko, depth')
      .in('code', ['SKINCARE', 'OTHER', 'HAIR_CARE', 'BODY_CARE', 'BEAUTY_TOOLS', 'PERSONAL_CARE']);

    if (catErr || !catRows || catRows.length === 0) {
      console.error("[FAIL] Test 5 Failed querying categories table:", catErr);
      throw catErr;
    }
    console.log(`[PASS] Found ${catRows.length} valid category rows in public.categories:`);
    catRows.forEach(c => console.log(`   - ${c.code} (${c.name_ko}, depth ${c.depth})`));

    console.log("\n========================================================");
    console.log("ALL 5 QA VERIFICATION TESTS PASSED WITH ZERO ERRORS!");
    console.log("========================================================");

  } finally {
    // Cleanup QA products
    if (testProductIds.length > 0) {
      console.log(`\nCleaning up ${testProductIds.length} QA test products...`);
      const { error: delErr } = await supabase
        .from('products')
        .delete()
        .in('id', testProductIds);
      if (delErr) {
        console.warn("Cleanup warning:", delErr);
      } else {
        console.log("[PASS] QA test products successfully cleaned up.");
      }
    }
  }
}

runTests().catch(e => {
  console.error("Test execution failed:", e);
  process.exit(1);
});
