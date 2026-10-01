const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envText = fs.readFileSync('.env.local', 'utf8');
const env = {};
envText.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    env[match[1]] = value.trim();
  }
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY);

function parseBrandTrademarks(brand) {
  if (brand.has_kr_trademark !== undefined && brand.has_kr_trademark !== null) {
    return {
      has_kr_trademark: brand.has_kr_trademark,
      kr_trademark_number: brand.kr_trademark_number || null,
      kr_trademark_path: brand.kr_trademark_path || null,
      has_us_trademark: brand.has_us_trademark,
      us_trademark_number: brand.us_trademark_number || null,
      us_trademark_path: brand.us_trademark_path || null,
      intro_text: brand.intro || null
    };
  }

  const intro = brand.intro || "";
  if (intro.startsWith("__JSON_METADATA__:")) {
    try {
      const jsonStr = intro.substring("__JSON_METADATA__:".length);
      const data = JSON.parse(jsonStr);
      return {
        has_kr_trademark: !!data.trademarks?.has_kr_trademark,
        kr_trademark_number: data.trademarks?.kr_trademark_number || null,
        kr_trademark_path: data.trademarks?.kr_trademark_path || null,
        has_us_trademark: !!data.trademarks?.has_us_trademark,
        us_trademark_number: data.trademarks?.us_trademark_number || null,
        us_trademark_path: data.trademarks?.us_trademark_path || null,
        intro_text: data.description || null
      };
    } catch (e) {}
  }

  return {
    has_kr_trademark: false,
    kr_trademark_number: null,
    kr_trademark_path: null,
    has_us_trademark: false,
    us_trademark_number: null,
    us_trademark_path: null,
    intro_text: brand.intro || null
  };
}

async function auditProductionData() {
  console.log('=== AUDITING PRODUCTION DATA FOR ADM-BRAND-002 ===\n');

  // Safely fetch brands with trademark fallback
  let brandsData = [];
  const { data: brandsWithCode, error: brandsError } = await supabase
    .from("brands")
    .select(`
      id, brand_code, name, intro, logo_path, company_id, is_active, created_at, updated_at,
      companies (id, name),
      has_kr_trademark, kr_trademark_number, kr_trademark_path,
      has_us_trademark, us_trademark_number, us_trademark_path
    `)
    .order("created_at", { ascending: true });

  if (!brandsError && brandsWithCode) {
    brandsData = brandsWithCode;
  } else {
    const { data: coreBrands } = await supabase
      .from("brands")
      .select(`
        id, brand_code, name, intro, logo_path, company_id, is_active, created_at, updated_at,
        companies (id, name)
      `)
      .order("created_at", { ascending: true });
    brandsData = coreBrands ?? [];
  }

  const totalBrands = brandsData.length;
  const activeBrands = brandsData.filter(b => b.is_active !== false);
  const inactiveBrands = brandsData.filter(b => b.is_active === false);
  const brandsWithCodeList = brandsData.filter(b => b.brand_code);
  const brandsWithoutCodeList = brandsData.filter(b => !b.brand_code);

  const brandCodes = brandsData.map(b => b.brand_code).filter(Boolean);
  const uniqueBrandCodes = new Set(brandCodes);
  const duplicateBrandCodes = brandCodes.length - uniqueBrandCodes.size;

  const invalidCompanyRelations = brandsData.filter(b => !b.companies || !b.company_id);

  console.log('--- Brand Metrics ---');
  console.log(`Total Brands: ${totalBrands}`);
  console.log(`Brands with Brand Code: ${brandsWithCodeList.length}`);
  console.log(`Brands missing Brand Code: ${brandsWithoutCodeList.length}`);
  console.log(`Duplicate Brand Codes: ${duplicateBrandCodes}`);
  console.log(`Active Brands: ${activeBrands.length}`);
  console.log(`Inactive Brands: ${inactiveBrands.length}`);
  console.log(`Invalid Brand -> Company Relations: ${invalidCompanyRelations.length}`);

  // 2. Audit Products & Brand Relations
  const { data: products } = await supabase.from('products').select('id, brand_id, company_id');
  const totalProducts = products ? products.length : 0;
  const validBrandIds = new Set(brandsData.map(b => b.id));

  let productsWithValidBrand = 0;
  let orphanProducts = 0;

  (products || []).forEach(p => {
    if (p.brand_id && validBrandIds.has(p.brand_id)) {
      productsWithValidBrand++;
    } else {
      orphanProducts++;
    }
  });

  console.log('\n--- Product Metrics ---');
  console.log(`Total Products: ${totalProducts}`);
  console.log(`Products with Valid Brand Relation: ${productsWithValidBrand}`);
  console.log(`Orphan Products: ${orphanProducts}`);

  console.log('\n=== Detailed Brand Record & Trademark Summary ===');
  brandsData.forEach(b => {
    const tm = parseBrandTrademarks(b);
    const pCount = (products || []).filter(p => p.brand_id === b.id).length;
    console.log(`[${b.brand_code || 'NO-CODE'}] "${b.name}" (UUID: ${b.id})`);
    console.log(`  Owner Company: ${b.companies?.name || 'UNKNOWN'} (ID: ${b.company_id})`);
    console.log(`  Status: ${b.is_active !== false ? 'Active' : 'Inactive'} | Products: ${pCount}`);
    console.log(`  KR TM: ${tm.has_kr_trademark ? 'YES' : 'NO'} (${tm.kr_trademark_number || '-'}) File: ${tm.kr_trademark_path || 'none'}`);
    console.log(`  US TM: ${tm.has_us_trademark ? 'YES' : 'NO'} (${tm.us_trademark_number || '-'}) File: ${tm.us_trademark_path || 'none'}`);
  });
}

auditProductionData().catch(console.error);
