const fs = require('fs');
const envText = fs.readFileSync('.env.local', 'utf8');
const env = {};
envText.split('\n').forEach(line => {
  const idx = line.indexOf('=');
  if (idx > 0) {
    const key = line.substring(0, idx).trim();
    const val = line.substring(idx + 1).trim().replace(/^['"]|['"]$/g, '');
    env[key] = val;
  }
});
const { createClient } = require('@supabase/supabase-js');
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, serviceKey);

async function testOtherInsert() {
  const { data: brand } = await supabase.from('brands').select('id, company_id').limit(1).single();
  console.log('Brand:', brand);
  const { data, error } = await supabase.from('products').insert({
    brand_id: brand.id,
    company_id: brand.company_id,
    name: 'TEST_CHECK_CONSTRAINT_123',
    name_en: 'TEST_CHECK_CONSTRAINT_123',
    category: 'other',
    category_code: 'OTHER',
    manufacture_sku: 'TEST_CHECK_123'
  }).select();
  console.log('Insert other result:', { data, error });
  if (data && data[0]) {
    await supabase.from('products').delete().eq('id', data[0].id);
    console.log('Cleaned up test product.');
  }
}
testOtherInsert();
