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

async function inspect() {
  console.log('=== KNOWLEDGE TOPICS ===');
  const { data: topics, error: tErr } = await supabase.from('knowledge_topics').select('*');
  if (tErr) console.error(tErr);
  else topics.forEach(t => console.log(`- ${t.id} | slug: ${t.slug} | ${t.name_ko} (${t.name_en}) | scope: ${t.portal_scope} | modules: ${JSON.stringify(t.match_modules)}`));

  console.log('\n=== KNOWLEDGE ITEMS ===');
  const { data: items, error: iErr } = await supabase.from('knowledge_items').select('*').order('created_at', { ascending: true });
  if (iErr) console.error(iErr);
  else items.forEach(i => console.log(`- ${i.id} | slug: ${i.slug} | [${i.module}] ${i.title_ko} | ${i.category} | ${i.status} | v: ${i.current_version}`));

  console.log('\n=== KNOWLEDGE VERSIONS ===');
  const { data: versions, error: vErr } = await supabase.from('knowledge_versions').select('*').order('created_at', { ascending: true });
  if (vErr) console.error(vErr);
  else versions.forEach(v => console.log(`- ${v.id} | kid: ${v.knowledge_id} | ${v.version} | ${v.title_ko} | ${v.status}`));

  console.log('\n=== KNOWLEDGE ASSETS ===');
  const { data: assets, error: aErr } = await supabase.from('knowledge_assets').select('*').order('created_at', { ascending: true });
  if (aErr) console.error(aErr);
  else assets.forEach(a => console.log(`- ${a.id} | kid: ${a.knowledge_id} | ${a.file_name} | sha: ${a.sha256}`));
}

inspect().catch(console.error);
