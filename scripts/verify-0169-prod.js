const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

let env = {};
fs.readFileSync('.env.local', 'utf8').split('\n').forEach(l => {
  const m = l.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (m) env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
});

const c = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY);

async function run() {
  console.log('=== VERIFYING SQL 0169 ON PRODUCTION SUPABASE ===');
  const { data, error } = await c
    .from('companies')
    .select('id, name, default_shipping_store_id')
    .limit(3);

  if (error) {
    console.log('Verification Status: PENDING APPLICATION');
    console.log('Error:', error.message);
  } else {
    console.log('Verification Status: APPLIED ✓');
    console.log('Sample rows:', data);
  }
}

run();
