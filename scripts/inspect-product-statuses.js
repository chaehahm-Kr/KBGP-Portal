const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const envVars = {};
env.split('\n').forEach(line => {
  const parts = line.split('=');
  const k = parts[0];
  const v = parts.slice(1).join('=');
  if (k && v) envVars[k.trim()] = v.trim().replace(/^["']|["']$/g, '');
});

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SECRET_KEY);

const { evaluateProductRegistrationStatus } = require('../lib/product/registration-status');

async function run() {
  const companyId = '4c845ae8-b93b-4db2-858f-bda3252e8167';
  const { data: products } = await supabase
    .from('products')
    .select('*')
    .eq('company_id', companyId);

  const { data: images } = await supabase
    .from('product_images')
    .select('product_id')
    .eq('company_id', companyId);

  const imageSet = new Set((images ?? []).map(i => i.product_id));

  console.log(`Total Products for company ${companyId}: ${products?.length}`);

  let registeredCount = 0;
  let draftCount = 0;
  let deletedCount = 0;

  for (const p of products ?? []) {
    const adminOverrides = p.price_additional_info?.admin_overrides || {};
    const hasImages = imageSet.has(p.id);
    const deletedAt = p.deleted_at || p.price_additional_info?.deleted_at || null;

    const evalResult = evaluateProductRegistrationStatus({
      id: p.id,
      name: p.name,
      name_en: p.name_en,
      brand_id: p.brand_id,
      category_code: p.category_code,
      manufacture_sku: p.manufacture_sku,
      origin: p.origin,
      price_krw_retail: p.price_krw_retail,
      price_usd_fob: p.price_usd_fob,
      item_width: p.item_width,
      item_depth: p.item_depth,
      item_height: p.item_height,
      item_weight: p.item_weight,
      package_width: p.package_width,
      package_depth: p.package_depth,
      package_height: p.package_height,
      package_weight: p.package_weight,
      carton_pack_qty: p.carton_pack_qty,
      carton_width: p.carton_width,
      carton_depth: p.carton_depth,
      carton_height: p.carton_height,
      carton_weight: p.carton_weight,
      upc: p.upc,
      ean: p.ean,
      selling_online: p.selling_online,
      sales_link_1: p.sales_link_1,
      deleted_at: deletedAt,
      adminOverrides,
      hasImages,
    });

    if (evalResult.isDeleted) {
      deletedCount++;
    } else if (evalResult.isDraft) {
      draftCount++;
    } else {
      registeredCount++;
    }

    console.log(`- [${evalResult.status}] ID: ${p.id} Name: "${p.name}" (db status: ${p.status}, is_deleted: ${evalResult.isDeleted}, is_draft: ${evalResult.isDraft}, missing: ${evalResult.missingFields.join(', ')})`);
  }

  console.log(`\nSummary: Registered/Complete: ${registeredCount}, Draft: ${draftCount}, Deleted: ${deletedCount}`);
}
run();
