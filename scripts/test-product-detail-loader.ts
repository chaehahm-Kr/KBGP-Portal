import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { evaluateProductRegistrationStatus } from '@/lib/product/registration-status';

const envPath = path.join(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env: Record<string, string> = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let val = match[2] || '';
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
    env[match[1]] = val.trim();
  }
});

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(url, key);

async function testExtremeProduct() {
  const productId = "b84e6e9c-1b31-44b1-bfe0-41f11d5a86e0";
  console.log("=== Testing Product Detail Parity for Extreme Night Cream 120mg ===");
  console.log("Product ID:", productId);

  const { data: p } = await admin.from("products").select("*").eq("id", productId).single();
  const { data: images } = await admin.from("product_images").select("*").eq("product_id", productId);
  const { data: cat } = await admin.from("categories").select("*").eq("code", p.category_code).single();
  const { data: cat2 } = await admin.from("categories").select("*").eq("code", cat.parent_code).single();
  const { data: cat1 } = await admin.from("categories").select("*").eq("code", cat2.parent_code).single();
  const { data: attrVals } = await admin.from("product_attribute_values").select("*").eq("product_id", productId);

  console.log("Product Name:", p.name);
  console.log("Manufacture SKU:", p.manufacture_sku);
  console.log("Primary Image Storage Path:", images?.[0]?.storage_path);
  console.log("1Depth Category:", cat1.name_ko, `(${cat1.code})`);
  console.log("2Depth Category:", cat2.name_ko, `(${cat2.code})`);
  console.log("3Depth Category:", cat.name_ko, `(${cat.code})`);
  console.log("Attribute Values Count:", attrVals?.length);
  console.log("Attribute Value Sample:", attrVals?.[0]);
}

testExtremeProduct().catch(console.error);
