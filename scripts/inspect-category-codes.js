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

async function inspect() {
  const { data: cats } = await admin.from('categories').select('code, name_ko, name_en, depth, parent_code').order('depth', { ascending: true });
  console.log('Depth 1 Categories:');
  console.table(cats.filter(c => c.depth === 1));

  console.log('Depth 2 Categories:');
  console.table(cats.filter(c => c.depth === 2));

  console.log('Depth 3 Categories count:', cats.filter(c => c.depth === 3).length);
}

inspect().catch(console.error);
