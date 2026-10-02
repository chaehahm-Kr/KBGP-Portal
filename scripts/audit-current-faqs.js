const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envLocal = fs.readFileSync('.env.local', 'utf8');
const env = {};
envLocal.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w_]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let val = match[2] || '';
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
    env[match[1]] = val;
  }
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY);

async function check() {
  const { data: faqs, error } = await supabase.from('knowledge_faq_items').select('id, topic_id, source_knowledge_id, question_ko');
  if (error) {
    console.error('Error fetching FAQs:', error);
    return;
  }
  console.log('Total FAQs in DB:', faqs ? faqs.length : 0);
  const bySource = {};
  (faqs || []).forEach(f => {
    bySource[f.source_knowledge_id || 'NONE'] = (bySource[f.source_knowledge_id || 'NONE'] || 0) + 1;
  });
  console.log('FAQs by source knowledge item:', bySource);
  
  const ordFaqs = (faqs || []).filter(f => f.source_knowledge_id === 'kno-order-management-v10' || f.id.startsWith('faq-ord'));
  console.log('ORD FAQs in DB before task:', ordFaqs.length);
}
check().catch(console.error);
