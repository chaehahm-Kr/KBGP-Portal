const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envPath = path.join(process.cwd(), '.env.local');
const envText = fs.readFileSync(envPath, 'utf8');
const env = {};
envText.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    value = value.trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    env[match[1]] = value.trim();
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseSecretKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseSecretKey);

async function inspectAssets() {
  const { data: ma } = await supabase.from('knowledge_manual_assets').select('*');
  console.log('=== All knowledge_manual_assets in Supabase ===');
  ma.forEach(d => console.log(`- ${d.id} | ${d.knowledge_id} | ${d.file_name} | ${d.version} | ${d.file_size} bytes`));

  const { data: rels } = await supabase.from('knowledge_relations').select('*');
  console.log(`\n=== All knowledge_relations count: ${rels.length} ===`);
  const grouped = {};
  rels.forEach(r => {
    grouped[r.knowledge_id] = (grouped[r.knowledge_id] || 0) + 1;
  });
  console.log('Relations by knowledge_id:', JSON.stringify(grouped, null, 2));
}

inspectAssets().catch(console.error);
