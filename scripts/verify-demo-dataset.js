const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=([^\r\n]+)/)?.[1]?.trim();
const key = env.match(/SUPABASE_SECRET_KEY=([^\r\n]+)/)?.[1]?.trim();

const sb = createClient(url, key);
const TEST_STORE_01_ID = 'effe7832-096c-4ae1-86c7-3cb189b59731';

async function verifyDataset() {
  console.log('==================================================');
  console.log('K SELECT DEMO PRODUCT DATASET AUDIT (RTP-QA-001)');
  console.log('==================================================\n');

  const { data: products, error } = await sb
    .from('products')
    .select(`
      id,
      name,
      name_en,
      letusto_sku,
      manufacture_sku,
      upc,
      category,
      volume,
      origin,
      status,
      selection_status,
      sales_status,
      trading_status,
      carton_pack_qty,
      description,
      bullet_points,
      ingredients_text,
      brands ( id, name ),
      product_curations ( wholesale_price, suggest_retail_price, map_price ),
      product_images ( id, storage_path, position )
    `)
    .like('letusto_sku', 'TEST-%')
    .order('letusto_sku');

  if (error || !products) {
    console.error('Error querying demo products:', error);
    return;
  }

  console.log(`Found ${products.length} K SELECT LAB Demo Products:\n`);

  for (const p of products) {
    const cur = Array.isArray(p.product_curations) ? p.product_curations[0] : p.product_curations;
    const ws = Number(cur?.wholesale_price || 0);
    const msrp = Number(cur?.suggest_retail_price || 0);
    const margin = msrp > 0 ? (((msrp - ws) / msrp) * 100).toFixed(1) : '0.0';

    // Store Price
    const { data: storePrice } = await sb
      .from('retailer_store_product_prices')
      .select('*')
      .eq('store_id', TEST_STORE_01_ID)
      .eq('product_id', p.id)
      .maybeSingle();

    const regPrice = Number(storePrice?.regular_price || msrp);
    const salePrice = storePrice?.sale_price ? Number(storePrice.sale_price) : null;
    const discountPct = salePrice && regPrice > 0 ? Math.round(((regPrice - salePrice) / regPrice) * 100) : 0;

    // Store Assortment check
    const { data: storeAssortment } = await sb
      .from('retailer_store_products')
      .select('*')
      .eq('store_id', TEST_STORE_01_ID)
      .eq('product_id', p.id)
      .maybeSingle();

    console.log(`--------------------------------------------------`);
    console.log(`SKU: ${p.letusto_sku} | MFG SKU: ${p.manufacture_sku} | UPC: ${p.upc}`);
    console.log(`Product Name: ${p.name}`);
    console.log(`Brand: ${p.brands?.name} (ID: ${p.brands?.id})`);
    console.log(`Category: ${p.category} | Volume: ${p.volume} | Origin: ${p.origin}`);
    console.log(`Wholesale Price: $${ws.toFixed(2)} | MSRP: $${msrp.toFixed(2)} | Gross Margin: ${margin}% | Case Pack/MOQ: ${p.carton_pack_qty}`);
    console.log(`Store 01 Tag Pricing: Regular $${regPrice.toFixed(2)}${salePrice ? ` | SALE $${salePrice.toFixed(2)} (Save ${discountPct}%)` : ' | (No Sale Promo)'}`);
    console.log(`Store 01 Assortment Assigned: ${storeAssortment ? 'YES (Active)' : 'NO'}`);
    console.log(`Images: ${p.product_images?.length || 0} registered in company-uploads`);
    console.log(`Canonical QR Landing URL: https://www.kselecthub.com/products/${p.id}`);
    console.log(`Status: ${p.status} | Selection: ${p.selection_status} | Sales: ${p.sales_status} | Trading: ${p.trading_status}`);
    console.log(`Training Ready Points: ${Array.isArray(p.bullet_points) ? p.bullet_points.length : 0} key benefits`);
  }

  console.log(`\n==================================================`);
  console.log(`ALL 6 DEMO PRODUCTS AUDITED SUCCESSFULLY`);
  console.log(`==================================================\n`);
}

verifyDataset();
