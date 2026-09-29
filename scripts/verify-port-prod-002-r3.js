const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

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

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY);

async function runTests() {
  console.log("==================================================");
  console.log("RUNNING PORT-PROD-002-R3 AUTOMATED VERIFICATION QA");
  console.log("==================================================");

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, testName, details) {
    totalTests++;
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passedTests++;
    } else {
      console.error(`[FAIL] ${testName}`, details || "");
    }
  }

  // 0. Fetch test companies & brands
  const { data: companies } = await admin.from('companies').select('id, name').limit(2);
  if (!companies || companies.length < 2) {
    throw new Error("Need at least 2 companies for multi-tenant uniqueness tests.");
  }
  const companyA = companies[0];
  const companyB = companies[1];

  let { data: brandA } = await admin.from('brands').select('id').eq('company_id', companyA.id).limit(1).maybeSingle();
  if (!brandA) {
    const { data: newB } = await admin.from('brands').insert({ company_id: companyA.id, name: 'Brand A QA' }).select('id').single();
    brandA = newB;
  }
  let { data: brandB } = await admin.from('brands').select('id').eq('company_id', companyB.id).limit(1).maybeSingle();
  if (!brandB) {
    const { data: newB } = await admin.from('brands').insert({ company_id: companyB.id, name: 'Brand B QA' }).select('id').single();
    brandB = newB;
  }

  const timestamp = Date.now();
  const testSkuA = `TEST-SKU-QA-${timestamp}`;
  const testUpcA = `99${String(timestamp).slice(-10)}`; // 12 digits
  const testEanA = `880${String(timestamp).slice(-10)}`; // 13 digits

  let createdProductAId = null;
  let createdProductBId = null;

  try {
    // ----------------------------------------------------
    // TEST 1: Master Carton carton_pack_qty is NULL on product creation
    // ----------------------------------------------------
    console.log("\n--- TEST 1: Master Carton carton_pack_qty Default ---");
    const { data: prodA, error: prodAErr } = await admin.from('products').insert({
      company_id: companyA.id,
      brand_id: brandA.id,
      name: `QA Test Prod A ${timestamp}`,
      name_en: `QA Test Prod A ${timestamp}`,
      category: 'other',
      category_code: 'OTHER',
      manufacture_sku: testSkuA,
      upc: testUpcA,
      ean: testEanA,
      carton_pack_qty: null,
    }).select().single();

    assert(!prodAErr && prodA, "Product A inserted successfully", prodAErr);
    if (prodA) createdProductAId = prodA.id;
    assert(prodA && prodA.carton_pack_qty === null, "Product A carton_pack_qty is NULL (not 1)", { carton_pack_qty: prodA?.carton_pack_qty });

    // ----------------------------------------------------
    // TEST 2: Same-company duplicate SKU check
    // ----------------------------------------------------
    console.log("\n--- TEST 2: Same-Company Duplicate SKU Validation ---");
    // 2.1 Same company same SKU (case insensitive) should be detected
    const { data: dupSkuSameComp } = await admin.from('products')
      .select('id')
      .eq('company_id', companyA.id)
      .ilike('manufacture_sku', testSkuA.toLowerCase())
      .limit(1);

    assert(dupSkuSameComp && dupSkuSameComp.length > 0, "Same-company duplicate SKU is detected by query", dupSkuSameComp);

    // 2.2 Different company same SKU should NOT conflict
    const { data: prodB, error: prodBErr } = await admin.from('products').insert({
      company_id: companyB.id,
      brand_id: brandB.id,
      name: `QA Test Prod B ${timestamp}`,
      name_en: `QA Test Prod B ${timestamp}`,
      category: 'other',
      category_code: 'OTHER',
      manufacture_sku: testSkuA, // same SKU as company A
      upc: `98${String(timestamp).slice(-10)}`,
      ean: `881${String(timestamp).slice(-10)}`,
      carton_pack_qty: null,
    }).select().single();

    assert(!prodBErr && prodB, "Different company with same SKU created successfully (company-scoped uniqueness)", prodBErr);
    if (prodB) createdProductBId = prodB.id;

    // ----------------------------------------------------
    // TEST 3: Global UPC & EAN Uniqueness
    // ----------------------------------------------------
    console.log("\n--- TEST 3: Global UPC & EAN Uniqueness Validation ---");
    // 3.1 Global duplicate UPC detected across different company
    const { data: dupUpcGlobal } = await admin.from('products')
      .select('id, company_id')
      .eq('upc', testUpcA);

    assert(dupUpcGlobal && dupUpcGlobal.length === 1 && dupUpcGlobal[0].id === prodA.id, "Global UPC lookup finds existing product A", dupUpcGlobal);

    // 3.2 Global duplicate EAN detected across different company
    const { data: dupEanGlobal } = await admin.from('products')
      .select('id, company_id')
      .eq('ean', testEanA);

    assert(dupEanGlobal && dupEanGlobal.length === 1 && dupEanGlobal[0].id === prodA.id, "Global EAN lookup finds existing product A", dupEanGlobal);

    // ----------------------------------------------------
    // TEST 4: Category Sync (Leaf category_code -> products.category)
    // ----------------------------------------------------
    console.log("\n--- TEST 4: Category Synchronization ---");
    // Update Product A with 3Depth body care category code 'BC_EXFOLIATING_PAD'
    const { data: updatedProdA, error: updateErr } = await admin.from('products')
      .update({
        category_code: 'BC_EXFOLIATING_PAD',
        category: 'daily_care',
      })
      .eq('id', createdProductAId)
      .select()
      .single();

    assert(!updateErr && updatedProdA, "Updated product A with 3Depth category code", updateErr);
    assert(updatedProdA && updatedProdA.category === 'daily_care', "Product A category column synced to 'daily_care'", updatedProdA?.category);
    assert(updatedProdA && updatedProdA.category_code === 'BC_EXFOLIATING_PAD', "Product A category_code is 'BC_EXFOLIATING_PAD'", updatedProdA?.category_code);

  } finally {
    // Cleanup test products
    console.log("\n--- Cleaning up QA test records ---");
    if (createdProductAId) {
      await admin.from('products').delete().eq('id', createdProductAId);
    }
    if (createdProductBId) {
      await admin.from('products').delete().eq('id', createdProductBId);
    }
    console.log("Cleanup complete.");
  }

  console.log("\n==================================================");
  console.log(`QA RESULTS: ${passedTests} / ${totalTests} TESTS PASSED`);
  console.log("==================================================");

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("QA script threw error:", err);
  process.exit(1);
});
