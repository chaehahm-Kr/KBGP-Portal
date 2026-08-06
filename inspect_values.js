const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env.local');
let supabaseUrl = '';
let supabaseServiceKey = '';

if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf-8');
  content.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
      if (key === 'NEXT_PUBLIC_SUPABASE_URL') supabaseUrl = val;
      if (key === 'SUPABASE_SECRET_KEY') supabaseServiceKey = val;
    }
  });
}

async function run() {
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
  
  // 1. 해당 상품의 모든 저장된 속성값을 product_attribute_values 테이블에서 조회
  const { data, error } = await supabaseAdmin
    .from('product_attribute_values')
    .select('*')
    .eq('product_id', 'a5107091-0b10-410d-a3fc-ff7a2b5038a2');

  if (error) {
    console.error("Failed to query product_attribute_values:", error);
  } else {
    console.log("Saved Attribute Values for this product:", JSON.stringify(data, null, 2));
  }
}

run();
