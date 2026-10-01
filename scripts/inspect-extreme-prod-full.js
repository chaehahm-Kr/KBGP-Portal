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

async function inspectDetail() {
  const prodId = 'b84e6e9c-1b31-44b1-bfe0-41f11d5a86e0';
  const { data: prod } = await supabase.from('products').select('*').eq('id', prodId).single();
  console.log('price_additional_info:', JSON.stringify(prod.price_additional_info, null, 2));
  console.log('price_krw_retail:', prod.price_krw_retail);
  console.log('estimated_retail_price:', prod.estimated_retail_price);
  console.log('price_usd_fob:', prod.price_usd_fob);
}
inspectDetail();
