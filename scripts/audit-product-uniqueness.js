const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envContent = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
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

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY);

async function audit() {
  console.log("=== Auditing Existing Products in Production DB ===");

  const { data: products, error } = await supabase
    .from('products')
    .select('id, name, name_en, manufacture_sku, upc, ean, company_id, brand_id, status');

  if (error) {
    console.error("Error fetching products:", error);
    return;
  }

  console.log(`Total products in DB: ${products.length}`);

  // 1. Audit same-company duplicate manufacture_sku (case-insensitive & trimmed)
  const skuCompanyMap = new Map();
  const duplicateSkus = [];

  products.forEach(p => {
    if (!p.manufacture_sku) return;
    const normSku = p.manufacture_sku.trim().toUpperCase();
    if (!normSku) return;
    const key = `${p.company_id}:::${normSku}`;
    if (skuCompanyMap.has(key)) {
      duplicateSkus.push({
        company_id: p.company_id,
        sku: normSku,
        product1: skuCompanyMap.get(key),
        product2: { id: p.id, name: p.name_en || p.name }
      });
    } else {
      skuCompanyMap.set(key, { id: p.id, name: p.name_en || p.name });
    }
  });

  console.log(`\n[Audit 1] Same-Company Duplicate SKUs count: ${duplicateSkus.length}`);
  if (duplicateSkus.length > 0) {
    console.log("Details:", JSON.stringify(duplicateSkus, null, 2));
  }

  // 2. Audit Global Duplicate UPC
  const upcMap = new Map();
  const duplicateUpcs = [];

  products.forEach(p => {
    if (!p.upc) return;
    const normUpc = p.upc.trim();
    if (!normUpc) return;
    if (upcMap.has(normUpc)) {
      duplicateUpcs.push({
        upc: normUpc,
        product1: upcMap.get(normUpc),
        product2: { id: p.id, name: p.name_en || p.name, company_id: p.company_id }
      });
    } else {
      upcMap.set(normUpc, { id: p.id, name: p.name_en || p.name, company_id: p.company_id });
    }
  });

  console.log(`\n[Audit 2] Global Duplicate UPC count: ${duplicateUpcs.length}`);
  if (duplicateUpcs.length > 0) {
    console.log("Details:", JSON.stringify(duplicateUpcs, null, 2));
  }

  // 3. Audit Global Duplicate EAN
  const eanMap = new Map();
  const duplicateEans = [];

  products.forEach(p => {
    if (!p.ean) return;
    const normEan = p.ean.trim();
    if (!normEan) return;
    if (eanMap.has(normEan)) {
      duplicateEans.push({
        ean: normEan,
        product1: eanMap.get(normEan),
        product2: { id: p.id, name: p.name_en || p.name, company_id: p.company_id }
      });
    } else {
      eanMap.set(normEan, { id: p.id, name: p.name_en || p.name, company_id: p.company_id });
    }
  });

  console.log(`\n[Audit 3] Global Duplicate EAN count: ${duplicateEans.length}`);
  if (duplicateEans.length > 0) {
    console.log("Details:", JSON.stringify(duplicateEans, null, 2));
  }
}

audit();
