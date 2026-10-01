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
  console.log('Running migration 0123 (Add other to products_category_check)...');

  const sql = `
    ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_category_check;
    ALTER TABLE public.products ADD CONSTRAINT products_category_check 
      CHECK (category IN ('skincare', 'hair_scalp', 'beauty_tools', 'daily_care', 'wellness_patch', 'other'));
  `;

  const { data: rpcRes, error: rpcErr } = await admin.rpc('exec_sql', { sql_query: sql });
  console.log('RPC result:', rpcRes, 'RPC error:', rpcErr);

  // Verify by inserting a test product with category = 'other'
  const { data: brand } = await admin.from('brands').select('id, company_id').limit(1).single();
  const { data: testProd, error: testErr } = await admin.from('products').insert({
    brand_id: brand.id,
    company_id: brand.company_id,
    name: 'TEST_CATEGORY_OTHER_VERIFICATION',
    name_en: 'TEST_CATEGORY_OTHER_VERIFICATION',
    category: 'other',
    category_code: 'OTHER',
    manufacture_sku: 'TEST-CAT-OTHER-001',
  }).select().single();

  console.log('Insert test product with category other:', testProd ? 'SUCCESS' : 'FAILED', testErr);

  if (testProd) {
    await admin.from('products').delete().eq('id', testProd.id);
    console.log('Test product cleaned up successfully.');
  }
}

main().catch(console.error);
