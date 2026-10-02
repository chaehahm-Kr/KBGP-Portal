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
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    env[match[1]] = value.trim();
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function fullAudit() {
  console.log('=== PRODUCTION FAQ AUDIT ===');
  
  // 1. Table schema & records
  const { data: faqs, error: fErr } = await supabase
    .from('knowledge_faqs')
    .select('*')
    .order('source_knowledge_id', { ascending: true })
    .order('display_order', { ascending: true });

  if (fErr) throw fErr;
  console.log('Total FAQs in DB:', faqs.length);

  // Group by manual/knowledge
  const groups = {};
  faqs.forEach(f => {
    const k = f.source_knowledge_id || 'UNKNOWN';
    if (!groups[k]) groups[k] = [];
    groups[k].push(f);
  });

  for (const [k, list] of Object.entries(groups)) {
    console.log(`\n--- Knowledge Item: ${k} (Count: ${list.length}) ---`);
    console.log(`Topic: ${list[0].topic_id} | Portal Scope: ${list[0].portal_scope} | Status: ${list[0].status}`);
    const featured = list.filter(x => x.is_featured);
    console.log(`Featured: ${featured.length} (${featured.map(x => x.id).join(', ')})`);
    list.forEach(f => {
      console.log(`  [${f.id}] (order ${f.display_order}) ${f.is_featured ? '⭐' : '  '} Q: ${f.question_ko.substring(0, 50)}...`);
    });
  }

  // 2. Knowledge items
  const { data: items, error: iErr } = await supabase
    .from('knowledge_items')
    .select('id, slug, title_ko, module, category, status, current_version')
    .eq('status', 'PUBLISHED');

  if (iErr) throw iErr;
  console.log('\n--- Published Knowledge Items in DB ---');
  items.forEach(it => {
    console.log(`  ${it.id}: [${it.module}] ${it.title_ko} (${it.current_version})`);
  });

  // 3. Topics
  const { data: topics, error: tErr } = await supabase
    .from('knowledge_topics')
    .select('*');

  if (tErr) console.log('knowledge_topics error/not accessed:', tErr.message);
  else {
    console.log('\n--- Knowledge Topics in DB ---');
    topics.forEach(t => console.log(`  ${t.id}: ${t.name_ko} (${t.portal_scope}) match_modules: ${JSON.stringify(t.match_modules)}`));
  }

  // Save all FAQs as JSON for inventory analysis
  fs.writeFileSync('scripts/prod_faqs_dump.json', JSON.stringify(faqs, null, 2));
  console.log('\nDumped FAQs to scripts/prod_faqs_dump.json');
}

fullAudit().catch(console.error);
