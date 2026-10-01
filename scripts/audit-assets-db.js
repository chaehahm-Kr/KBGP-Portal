const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envText = fs.readFileSync('.env.local', 'utf8');
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

const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: d1, error: e1 } = await client.from('knowledge_manual_assets').select('*');
  console.log('knowledge_manual_assets count:', d1 ? d1.length : 'none', 'error:', e1 ? e1.message : null);
  if (d1 && d1.length > 0) {
    console.log('knowledge_manual_assets sample:', d1);
  }

  const { data: d2, error: e2 } = await client.from('knowledge_assets').select('*');
  console.log('knowledge_assets count:', d2 ? d2.length : 'none', 'error:', e2 ? e2.message : null);
  if (d2 && d2.length > 0) {
    console.log('knowledge_assets sample:', d2);
  }

  const { data: item } = await client.from('knowledge_items').select('*').eq('id', 'kno-brand-policy-v10').single();
  console.log('kno-brand-policy-v10 item in DB:', item ? {
    id: item.id,
    slug: item.slug,
    title: item.title,
    document_url: item.document_url,
    document_name: item.document_name,
    status: item.status,
    audience: item.audience
  } : null);
}

run();
