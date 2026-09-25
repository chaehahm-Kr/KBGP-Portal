const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=([^\r\n]+)/)?.[1]?.trim();
const key = env.match(/SUPABASE_SECRET_KEY=([^\r\n]+)/)?.[1]?.trim();

const sb = createClient(url, key);

async function main() {
  const { data: products } = await sb
    .from('products')
    .select(`*, brands:brand_id ( * ), product_images ( * )`)
    .ilike('letusto_sku', 'TEST-%')
    .limit(1);

  if (products && products[0]) {
    console.log("Product columns & values:");
    console.log(JSON.stringify(products[0], null, 2));
  }
}

main();
