import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { evaluateProductRegistrationStatus } from '@/lib/product/registration-status';
import { getBatchProductCategoryCompletions } from '@/lib/product/attribute-completion';

const envPath = path.join(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env: Record<string, string> = {};
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

const admin = createClient(url!, key!);

async function main() {
  const { data: p } = await admin
    .from("products")
    .select("*")
    .eq("id", "e5d9fdcc-afcb-40a9-8ae6-72d60548042f")
    .single();

  const { data: images } = await admin
    .from("product_images")
    .select("id")
    .eq("product_id", p.id);

  const completions = await getBatchProductCategoryCompletions(
    [{ id: p.id, category_code: p.category_code }],
    admin
  );

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
    deleted_at: p.deleted_at || p.price_additional_info?.deleted_at,
    adminOverrides: p.price_additional_info?.admin_overrides,
    hasImages: (images?.length || 0) > 0,
    categoryCompletion: completions.get(p.id),
  });

  console.log("=== evaluateProductRegistrationStatus for TEST 123456 ===");
  console.log("Status:", evalResult.status);
  console.log("isDraft:", evalResult.isDraft);
  console.log("Missing fields:", evalResult.missingFields);
}

main().catch(console.error);
