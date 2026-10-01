import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

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

async function main() {
  const { data: companies } = await admin.from('companies').select('id, name').ilike('name', '%Extreme%');
  console.log('=== Companies matching Extreme ===');
  console.log(companies);

  if (!companies || companies.length === 0) return;

  const companyId = companies[0].id;
  const { data: products } = await admin.from('products').select('*').eq('company_id', companyId);
  console.log('=== Products for Extreme Inc ===');
  console.log(products?.map(p => ({ id: p.id, name: p.name, name_en: p.name_en, sku: p.manufacture_sku, category_code: p.category_code })));

  if (!products || products.length === 0) return;

  const p = products.find(x => x.manufacture_sku === 'EXT-123456' || x.name?.includes('Night') || x.name_en?.includes('Night')) || products[0];
  console.log('=== Target Product Details ===');
  console.log({
    id: p.id,
    name: p.name,
    name_en: p.name_en,
    manufacture_sku: p.manufacture_sku,
    category_code: p.category_code,
    brand_id: p.brand_id,
    company_id: p.company_id
  });

  const { data: images } = await admin.from('product_images').select('*').eq('product_id', p.id);
  console.log('=== Product Images ===');
  console.log(images);

  const { data: attrVals } = await admin.from('product_attribute_values').select('*').eq('product_id', p.id);
  console.log('=== Product Attribute Values ===');
  console.log(attrVals);

  if (p.category_code) {
    const { data: cat } = await admin.from('categories').select('*').eq('code', p.category_code).single();
    console.log('=== Saved Category Record ===');
    console.log(cat);

    if (cat && cat.parent_code) {
      const { data: cat2 } = await admin.from('categories').select('*').eq('code', cat.parent_code).single();
      console.log('=== Parent Category (2Depth) ===');
      console.log(cat2);

      if (cat2 && cat2.parent_code) {
        const { data: cat1 } = await admin.from('categories').select('*').eq('code', cat2.parent_code).single();
        console.log('=== Root Category (1Depth) ===');
        console.log(cat1);
      }
    }
  }
}

main().catch(console.error);
