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
  console.log('=== FIXING MAN-BRAND-001 ASSET & DB LINKS ===\n');

  // 1. Update knowledge_items
  const { data: itemUpdate, error: itemErr } = await client
    .from('knowledge_items')
    .update({
      document_url: '/api/admin/knowledge/asset/asset-brand-policy-v10',
      document_name: 'MAN-BRAND-001 Brand Policy.pdf',
      document_size: 1391802,
      document_type: 'application/pdf',
      updated_at: new Date().toISOString()
    })
    .eq('id', 'kno-brand-policy-v10')
    .select();

  console.log('1. knowledge_items update:', itemErr ? itemErr.message : 'SUCCESS', itemUpdate);

  // 2. Upsert knowledge_manual_assets
  const { data: assetUpsert, error: assetErr } = await client
    .from('knowledge_manual_assets')
    .upsert({
      id: 'asset-brand-policy-v10',
      knowledge_id: 'kno-brand-policy-v10',
      manual_title: 'K SELECT 브랜드 등록 및 관리 정책 (MAN-BRAND-001)',
      version: 'v1.0',
      language: 'KO',
      is_current: true,
      file_url: '/api/admin/knowledge/asset/asset-brand-policy-v10',
      file_name: 'MAN-BRAND-001_Brand_Policy_v1.0.pdf',
      file_size: 1391802,
      published_date: '2026-10-01'
    })
    .select();

  console.log('2. knowledge_manual_assets upsert:', assetErr ? assetErr.message : 'SUCCESS', assetUpsert);
}

run();
