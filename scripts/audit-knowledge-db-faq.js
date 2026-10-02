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

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data: topics, error: tErr } = await admin.from('knowledge_topics').select('*');
  if (tErr) console.error('Topics error:', tErr);
  console.log('--- KNOWLEDGE TOPICS ---');
  if (topics) console.table(topics.map(t => ({ id: t.id, name_ko: t.name_ko, name_en: t.name_en, slug: t.slug, portal_scope: t.portal_scope })));

  const { data: faqs, error: fErr } = await admin.from('knowledge_faqs').select('*');
  if (fErr) console.error('Faqs error:', fErr);
  if (faqs) {
    console.log('\nTotal FAQs in DB:', faqs.length);
    console.log('FAQ sample keys:', Object.keys(faqs[0]));
    console.log('Featured FAQs count:', faqs.filter(f => f.is_featured).length);
    console.log('Published FAQs count:', faqs.filter(f => f.status === 'PUBLISHED').length);
  }
}

main().catch(console.error);
