const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=([^\r\n]+)/)?.[1]?.trim();
const key = env.match(/SUPABASE_SECRET_KEY=([^\r\n]+)/)?.[1]?.trim();

const sb = createClient(url, key);

async function main() {
  console.log("Auditing Demo Product fields for Training...");

  const { data: products, error } = await sb
    .from('products')
    .select(`
      *,
      brands:brand_id ( id, name ),
      product_images ( * )
    `)
    .ilike('letusto_sku', 'TEST-%');

  if (error) {
    console.error("Error querying products:", error);
    process.exit(1);
  }

  console.log(`Found ${products.length} demo products:`);
  products.forEach(p => {
    console.log(`\n========================================`);
    console.log(`SKU: ${p.letusto_sku} | ID: ${p.id}`);
    console.log(`Name: ${p.name}`);
    console.log(`Brand: ${p.brands?.name_en || p.brands?.name}`);
    console.log(`Specs: ${JSON.stringify(p.specs, null, 2)}`);
    console.log(`Images: ${p.product_images?.length} images`);
    p.product_images?.forEach(img => {
      console.log(`  - [${img.is_primary ? 'PRIMARY' : 'SECONDARY'}] ${img.image_url}`);
    });
  });

  // Check existing training tables
  const { error: tErr } = await sb
    .from('retailer_product_training_progress')
    .select('id')
    .limit(1);

  console.log(`\nTable retailer_product_training_progress exists?`, !tErr || !tErr.message.includes('relation "public.retailer_product_training_progress" does not exist'));
  if (tErr) console.log("Progress table check error:", tErr.message);

  const { error: cErr } = await sb
    .from('retailer_product_training_content')
    .select('id')
    .limit(1);

  console.log(`Table retailer_product_training_content exists?`, !cErr || !cErr.message.includes('relation "public.retailer_product_training_content" does not exist'));
  if (cErr) console.log("Content table check error:", cErr.message);
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
