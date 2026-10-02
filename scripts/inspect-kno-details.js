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

async function inspectDetail() {
  const { data: logItem } = await supabase.from('knowledge_items').select('*').eq('id', 'kno-shipping-logistics-v10').single();
  console.log('LOG Item structure:', JSON.stringify(logItem, null, 2));

  const { data: permItem } = await supabase.from('knowledge_items').select('*').eq('id', 'kno-permissions-user-management-v10').single();
  console.log('\nPERM Item structure:', JSON.stringify(permItem, null, 2));

  const { data: logVer } = await supabase.from('knowledge_versions').select('*').eq('knowledge_id', 'kno-shipping-logistics-v10');
  console.log('\nLOG Version structure:', JSON.stringify(logVer, null, 2));

  const { data: permVer } = await supabase.from('knowledge_versions').select('*').eq('knowledge_id', 'kno-permissions-user-management-v10');
  console.log('\nPERM Version structure:', JSON.stringify(permVer, null, 2));

  const { data: rels, error: rErr } = await supabase.from('knowledge_relations').select('*');
  if (rErr) console.log('knowledge_relations table error:', rErr.message);
  else console.log('\nKnowledge Relations count:', rels.length, 'sample:', JSON.stringify(rels.slice(0, 5), null, 2));
}

inspectDetail().catch(console.error);
