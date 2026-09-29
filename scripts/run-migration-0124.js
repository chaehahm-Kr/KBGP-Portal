const fs = require('fs');
const path = require('path');
const envFile = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = (match[2] || '').trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    env[match[1]] = value;
  }
});
const { createClient } = require('@supabase/supabase-js');
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  console.log('Running migration 0124 (carton_pack_qty default and uniqueness indexes)...');

  const sql = `
    ALTER TABLE public.products ALTER COLUMN carton_pack_qty DROP DEFAULT;
    ALTER TABLE public.products ALTER COLUMN carton_pack_qty SET DEFAULT NULL;

    CREATE UNIQUE INDEX IF NOT EXISTS products_company_id_manufacture_sku_unique 
      ON public.products (company_id, UPPER(TRIM(manufacture_sku))) 
      WHERE manufacture_sku IS NOT NULL AND TRIM(manufacture_sku) != '';

    CREATE UNIQUE INDEX IF NOT EXISTS products_ean_unique 
      ON public.products (TRIM(ean)) 
      WHERE ean IS NOT NULL AND TRIM(ean) != '';
  `;

  const { data: rpcRes, error: rpcErr } = await admin.rpc('exec_sql', { sql_query: sql });
  console.log('RPC result:', rpcRes, 'RPC error:', rpcErr);

  // Verify carton_pack_qty default is now null by inserting a test product
  const { data: brand } = await admin.from('brands').select('id, company_id').limit(1).single();
  const { data: testProd, error: testErr } = await admin.from('products').insert({
    brand_id: brand.id,
    company_id: brand.company_id,
    name: 'TEST_CARTON_DEFAULT_NULL',
    name_en: 'TEST_CARTON_DEFAULT_NULL',
    category: 'other',
    category_code: 'OTHER',
    manufacture_sku: 'TEST-CARTON-DEF-001',
  }).select('id, carton_pack_qty').single();

  console.log('Test product carton_pack_qty:', testProd?.carton_pack_qty);
  if (testProd?.carton_pack_qty === null || testProd?.carton_pack_qty === undefined) {
    console.log('[PASS] carton_pack_qty default is NULL (not 1).');
  } else {
    console.error('[FAIL] carton_pack_qty default is still:', testProd?.carton_pack_qty);
  }

  // Verify unique index prevents same-company duplicate SKU
  const { error: dupErr } = await admin.from('products').insert({
    brand_id: brand.id,
    company_id: brand.company_id,
    name: 'TEST_CARTON_DEFAULT_NULL_DUP',
    name_en: 'TEST_CARTON_DEFAULT_NULL_DUP',
    category: 'other',
    category_code: 'OTHER',
    manufacture_sku: '  test-carton-def-001  ', // normalized duplicate
  });

  if (dupErr && dupErr.code === '23505') {
    console.log('[PASS] Same-company duplicate SKU successfully blocked by DB index.');
  } else {
    console.log('Duplicate insert result:', dupErr);
  }

  // Cleanup test product
  if (testProd) {
    await admin.from('products').delete().eq('id', testProd.id);
    console.log('Cleaned up test product.');
  }
}

main().catch(console.error);
