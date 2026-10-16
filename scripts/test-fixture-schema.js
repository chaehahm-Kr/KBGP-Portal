const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
let env = {};
if (fs.existsSync('.env.local')) {
  fs.readFileSync('.env.local', 'utf8').split('\n').forEach(l => {
    const m = l.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (m) env[m[1]] = (m[2] || '').trim().replace(/^['"]|['"]$/g, '');
  });
}
const c = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data, error, count } = await c.from('store_fixtures').select('*', { count: 'exact' });
  console.log('store_fixtures count:', count, 'error:', error, 'data:', data);
  const { data: pData, error: pErr, count: pCount } = await c.from('store_fixture_placements').select('*', { count: 'exact' });
  console.log('store_fixture_placements count:', pCount, 'error:', pErr);
}
run();
