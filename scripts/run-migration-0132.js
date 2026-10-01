const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

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

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || 'https://shzfrppdobpmrstcjfqu.supabase.co';
const serviceKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(supabaseUrl, serviceKey);

async function main() {
  console.log('Running migration 0132_knowledge_topics_and_portal_scope.sql...');

  const sql = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'migrations', '0132_knowledge_topics_and_portal_scope.sql'), 'utf8');

  const { data: rpcRes, error: rpcErr } = await admin.rpc('exec_sql', { sql_query: sql });
  console.log('RPC exec_sql result:', rpcRes, 'RPC error:', rpcErr);

  console.log('\n=== VERIFYING KNOWLEDGE_TOPICS TABLE ===');
  const { data: topics, error: tErr } = await admin
    .from('knowledge_topics')
    .select('id, portal_scope, name_ko, icon, display_order, is_active')
    .order('display_order', { ascending: true });

  if (tErr) {
    console.error('Error querying knowledge_topics:', tErr);
  } else {
    console.log(`Successfully verified knowledge_topics table! Row count: ${topics.length}`);
    console.log('Topics:', topics);
  }

  console.log('\n=== VERIFYING KNOWLEDGE_FAQS TABLE ===');
  const { data: faqs, error: fErr } = await admin
    .from('knowledge_faqs')
    .select('id, portal_scope, topic_id, question_ko, status, kind')
    .order('display_order', { ascending: true });

  if (fErr) {
    console.error('Error querying knowledge_faqs:', fErr);
  } else {
    console.log(`Successfully verified knowledge_faqs table! Row count: ${faqs.length}`);
    console.log('FAQs:', faqs);
  }
}

main().catch(console.error);
