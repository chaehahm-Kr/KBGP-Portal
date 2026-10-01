const fs = require('fs');
const path = require('path');
const envFile = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = (match[2] || '').trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    env[match[1]] = value;
  }
});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const companyId = '7d669d13-1c62-494e-a520-c2133348edbe';
  const { data: prods } = await supabase
    .from('products')
    .select('id, name, letusto_sku, manufacture_sku, category_code, price_krw_retail, price_usd_fob, package_width, package_depth, package_height, package_weight, upc, ean')
    .eq('company_id', companyId);
  console.log('Products for Extreme Inc:', JSON.stringify(prods, null, 2));

  const { data: comp } = await supabase
    .from('companies')
    .select('id, name, intro')
    .eq('id', companyId)
    .single();
  console.log('Company:', comp);
}
check();
