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

const admin = createClient(url, key);

async function main() {
  console.log("=== Inspecting TEST 123456 Product Fields ===");

  const { data: p } = await admin
    .from('products')
    .select('*')
    .or('name.eq.TEST 123456,manufacture_sku.eq.TEST-1111-001-TEST')
    .single();

  if (!p) {
    console.log("Product not found by name/sku, fetching all 7 active products for company 4c845ae8-b93b-4db2-858f-bda3252e8167:");
    const { data: list } = await admin.from('products').select('id, name, name_en, manufacture_sku, status, price_additional_info').eq('company_id', '4c845ae8-b93b-4db2-858f-bda3252e8167');
    list?.forEach(prod => console.log(prod.id, prod.name, prod.name_en, prod.manufacture_sku, prod.status));
    return;
  }

  console.log("Product ID:", p.id);
  console.log("Name:", p.name, "Name En:", p.name_en);
  console.log("SKUs:", p.letusto_sku, p.manufacture_sku);
  console.log("Status:", p.status);
  console.log("Category Code:", p.category_code);
  console.log("Brand ID:", p.brand_id);
  console.log("Prices:", p.price_krw_retail, p.price_usd_fob);
  console.log("Item Spec:", p.item_width, p.item_depth, p.item_height, p.item_weight);
  console.log("Pkg Spec:", p.package_width, p.package_depth, p.package_height, p.package_weight);
  console.log("Carton Spec:", p.carton_pack_qty, p.carton_width, p.carton_depth, p.carton_height, p.carton_weight);
  console.log("Barcodes:", p.upc, p.ean);
  console.log("Price Additional Info:", JSON.stringify(p.price_additional_info, null, 2));

  // Check product_attribute_values
  const { data: attrVals } = await admin.from('product_attribute_values').select('*').eq('product_id', p.id);
  console.log("Attribute values count:", attrVals?.length);
  attrVals?.forEach(av => console.log(` - ${av.attribute_code}: ${JSON.stringify(av.value_json)}`));

  // Check category_profile_mappings & profile_attributes
  if (p.category_code) {
    const { data: map } = await admin.from('category_profile_mappings').select('*').eq('category_code', p.category_code).maybeSingle();
    console.log("Category profile mapping:", map);
    if (map) {
      const { data: pas } = await admin.from('profile_attributes').select('*, attributes(*)').eq('profile_code', map.profile_code);
      console.log("Profile attributes count:", pas?.length);
      pas?.forEach(pa => console.log(` - ProfileAttr: ${pa.attribute_code}, Required: ${pa.is_required_override}, AttrRequired: ${pa.attributes?.is_required}`));
    }
  }

  // Check images
  const { data: imgs } = await admin.from('product_images').select('*').eq('product_id', p.id);
  console.log("Product images count:", imgs?.length);
}

main().catch(console.error);
