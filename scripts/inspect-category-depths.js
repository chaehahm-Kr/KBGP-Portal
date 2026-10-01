const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envContent = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    env[match[1]] = value.trim();
  }
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY);

async function inspect() {
  const { data: depth1 } = await supabase.from('categories').select('code, name_ko, depth, is_final').eq('depth', 1);
  console.log('Depth 1 categories:', depth1);

  // Check product mentioned by user: FOOT SMELL REMOVER / EXTREME-BAL-002
  const { data: footProduct } = await supabase
    .from('products')
    .select('id, name, name_en, category, category_code, manufacture_sku, company_id')
    .ilike('manufacture_sku', '%EXTREME-BAL-002%');
  console.log('Foot product in DB:', footProduct);
}

inspect();
