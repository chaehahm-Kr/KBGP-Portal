const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envText = fs.readFileSync(envPath, 'utf8');
  envText.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let value = match[2] || '';
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
      process.env[match[1]] = value.trim();
    }
  });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://shzfrppdobpmrstcjfqu.supabase.co';
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;
const admin = createClient(supabaseUrl, supabaseSecretKey);

const TARGET_COMPANY_IDS = [
  '9f37ece5-e164-4357-9ecb-3982ee118ad4', // John
  '0ec853ef-45dc-4f8f-aa63-59debeaf4af1', // Carmel
  '053723dd-aa07-4200-9406-7b8773dd323e', // Carmel2
];

const TARGET_PRODUCT_IDS = [
  '007c67dd-c1c7-4c6b-8df1-d3cfad7ce632', // Vitamin Essence (Carmel)
  '751c5ba2-4dff-4a9f-9d87-37ae14a7ba94', // Vitamin Lotion (Carmel)
  '4fcaeb00-8dcf-4743-be68-9bd697881847', // Vitamin A Whitening Lotion (Carmel2)
  '47ee85b1-54aa-481c-9f19-35fed602e706', // Face Cream Antiaging (John)
];

const TARGET_BRAND_IDS = [
  '4bc9f6ea-5cb8-4b23-a624-8db24b8f5c27', // Carmel (Carmel)
  '3f8f1299-3da4-4397-8566-d7ed634d7a95', // 브랜드테스트 (Carmel2)
  '61d74ec6-e986-483f-92ad-65486d68186b', // Kselect (John)
];

const TARGET_PO_IDS = [
  '2f378a31-c186-4413-a932-e2e07d6bed4f' // PO-20260929-CAR-665-001 (Carmel2)
];

const TARGET_SHIPMENT_IDS = [
  '71248552-6780-4028-9ee3-f8646c678f79' // SHP-2026-0051 (Carmel2)
];

async function executeFullPurge() {
  console.log("=== EXECUTING COMPLETE CLEAN PURGE ===");

  // 1. Delete Inbound Shipment Lines & Inbound Shipments
  const { data: dInbLines, error: inbLinesErr } = await admin
    .from('inbound_shipment_lines')
    .delete()
    .or(`inbound_shipment_id.in.(${TARGET_SHIPMENT_IDS.join(',')}),product_id.in.(${TARGET_PRODUCT_IDS.join(',')})`)
    .select('id');
  console.log(`1. Deleted ${dInbLines?.length || 0} inbound_shipment_lines`, inbLinesErr || "");

  const { data: dInb, error: inbErr } = await admin
    .from('inbound_shipments')
    .delete()
    .or(`id.in.(${TARGET_SHIPMENT_IDS.join(',')}),purchase_order_id.in.(${TARGET_PO_IDS.join(',')})`)
    .select('id');
  console.log(`2. Deleted ${dInb?.length || 0} inbound_shipments`, inbErr || "");

  // 2. Delete PO Lines & POs
  const { data: dPOLines, error: poLinesErr } = await admin
    .from('purchase_order_lines')
    .delete()
    .or(`purchase_order_id.in.(${TARGET_PO_IDS.join(',')}),product_id.in.(${TARGET_PRODUCT_IDS.join(',')})`)
    .select('id');
  console.log(`3. Deleted ${dPOLines?.length || 0} purchase_order_lines`, poLinesErr || "");

  const { data: dPOs, error: posErr } = await admin
    .from('purchase_orders')
    .delete()
    .or(`id.in.(${TARGET_PO_IDS.join(',')}),supplier_id.in.(${TARGET_COMPANY_IDS.join(',')})`)
    .select('id');
  console.log(`4. Deleted ${dPOs?.length || 0} purchase_orders`, posErr || "");

  // 3. Delete Product Attribute Values, Images, Certs, and Products
  const { data: dAttrs } = await admin.from('product_attribute_values').delete().in('product_id', TARGET_PRODUCT_IDS).select('id');
  console.log(`5. Deleted ${dAttrs?.length || 0} product_attribute_values`);

  const { data: dImgs } = await admin.from('product_images').delete().in('product_id', TARGET_PRODUCT_IDS).select('id');
  console.log(`6. Deleted ${dImgs?.length || 0} product_images`);

  const { data: dCerts } = await admin.from('product_certificates').delete().in('product_id', TARGET_PRODUCT_IDS).select('id');
  console.log(`7. Deleted ${dCerts?.length || 0} product_certificates`);

  const { data: dProds, error: prodsErr } = await admin
    .from('products')
    .delete()
    .or(`id.in.(${TARGET_PRODUCT_IDS.join(',')}),company_id.in.(${TARGET_COMPANY_IDS.join(',')})`)
    .select('id');
  console.log(`8. Deleted ${dProds?.length || 0} products`, prodsErr || "");

  // 4. Delete Brands
  const { data: dBrands, error: brandsErr } = await admin
    .from('brands')
    .delete()
    .or(`id.in.(${TARGET_BRAND_IDS.join(',')}),company_id.in.(${TARGET_COMPANY_IDS.join(',')})`)
    .select('id');
  console.log(`9. Deleted ${dBrands?.length || 0} brands`, brandsErr || "");

  // 5. Delete Companies
  const { data: dComps, error: compsErr } = await admin
    .from('companies')
    .delete()
    .in('id', TARGET_COMPANY_IDS)
    .select('id, name');
  console.log(`10. Deleted ${dComps?.length || 0} companies:`, dComps, compsErr || "");
}

executeFullPurge().catch(console.error);
