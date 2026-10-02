const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
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
const supabaseKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase env vars missing');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function getSha256(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  const hashSum = crypto.createHash('sha256');
  hashSum.update(fileBuffer);
  return hashSum.digest('hex');
}

async function runVerification() {
  console.log('==================================================');
  console.log('MAN-B-LOG-001 KNOWLEDGE PUBLISH FINAL VERIFICATION');
  console.log('==================================================\n');

  // 1. PDF Asset & SHA Verification
  const sourcePath = 'Manuals/MAN-B-LOG-001_Shipping-Logistics/03_PUBLISHED/MAN-B-LOG-001_Shipping-Logistics_V1.pdf';
  const assetPath = 'private_assets/manuals/MAN-B-LOG-001_Shipping-Logistics_V1.pdf';

  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Source PDF missing at ${sourcePath}`);
  }
  if (!fs.existsSync(assetPath)) {
    throw new Error(`Asset PDF missing at ${assetPath}`);
  }

  const sourceSha = getSha256(sourcePath);
  const assetSha = getSha256(assetPath);
  const sourceStat = fs.statSync(sourcePath);
  const assetStat = fs.statSync(assetPath);

  console.log('[1] PDF Asset Verification:');
  console.log(`- Source Path: ${sourcePath}`);
  console.log(`- Asset Path:  ${assetPath}`);
  console.log(`- File Size:   ${sourceStat.size} bytes (Asset: ${assetStat.size} bytes)`);
  console.log(`- Source SHA:  ${sourceSha}`);
  console.log(`- Asset SHA:   ${assetSha}`);
  console.log(`- SHA Match:   ${sourceSha === assetSha ? 'PASS (Exact Match)' : 'FAIL'}`);

  // 2. Supabase DB Verification
  console.log('\n[2] Supabase Database Verification:');
  
  // Knowledge Item
  const { data: items, error: itemsErr } = await supabase
    .from('knowledge_items')
    .select('id, slug, title_ko, type, module, status, current_version, tags')
    .eq('status', 'PUBLISHED')
    .order('created_at', { ascending: true });

  if (itemsErr) throw itemsErr;
  console.log(`- Total Published Knowledge Items in DB: ${items.length} (Expected: 7)`);
  items.forEach((it, idx) => {
    console.log(`  ${idx + 1}. [${it.module}] ${it.id} (${it.slug}) - ${it.title_ko} (${it.status})`);
  });

  const logItem = items.find(i => i.id === 'kno-shipping-logistics-v10');
  if (!logItem) {
    throw new Error('kno-shipping-logistics-v10 is not found in published items!');
  }
  console.log(`- LOG Item Module: ${logItem.module}, Version: ${logItem.current_version} -> PASS`);

  // Versions
  const { data: versions, error: verErr } = await supabase
    .from('knowledge_versions')
    .select('id, knowledge_id, version, status')
    .eq('knowledge_id', 'kno-shipping-logistics-v10');

  if (verErr) throw verErr;
  console.log(`- Versions for LOG: ${versions.length} records ->`, versions);

  // Manual Assets
  const { data: assets, error: assetErr } = await supabase
    .from('knowledge_manual_assets')
    .select('id, knowledge_id, version, is_current, file_name, file_size')
    .eq('knowledge_id', 'kno-shipping-logistics-v10');

  if (assetErr) throw assetErr;
  console.log(`- Assets for LOG: ${assets.length} records ->`, assets);

  // Relations
  const { data: relations, error: relErr } = await supabase
    .from('knowledge_relations')
    .select('id, knowledge_id, related_portal, related_module, related_menu, related_route')
    .eq('knowledge_id', 'kno-shipping-logistics-v10');

  if (relErr) throw relErr;
  console.log(`- Relations for LOG: ${relations.length} records (Expected: 6) ->`);
  relations.forEach(r => console.log(`  - [${r.related_portal}] ${r.related_menu}: ${r.related_route}`));

  // 3. Topic Check
  console.log('\n[3] Topic Check:');
  const { data: topics, error: topErr } = await supabase
    .from('knowledge_topics')
    .select('id, name_ko, name_en, portal_scope')
    .eq('id', 'topic-logistics');

  if (topErr) throw topErr;
  console.log('- Topic in DB:', topics);

  // 4. Existing FAQs Check
  console.log('\n[4] Existing FAQs Check:');
  const { count: faqCount, error: faqErr } = await supabase
    .from('knowledge_faqs')
    .select('*', { count: 'exact', head: true });

  if (faqErr) throw faqErr;
  console.log(`- Existing FAQs Count in DB: ${faqCount} (Intact)`);

  // 5. In-Memory Store Check
  console.log('\n[5] In-Memory Fallback Check (lib/knowledge/store.ts):');
  const storeContent = fs.readFileSync(path.join(process.cwd(), 'lib/knowledge/store.ts'), 'utf8');
  const hasStoreItem = storeContent.includes('kno-shipping-logistics-v10');
  const hasStoreVer = storeContent.includes('ver-shipping-logistics-v10');
  const hasStoreAsset = storeContent.includes('asset-shipping-logistics-v10');
  const hasStoreRel = storeContent.includes('rel-log-shipping-hub') && storeContent.includes('rel-admin-warehouse-receiving');

  console.log(`- store.ts Item:    ${hasStoreItem ? 'PASS' : 'FAIL'}`);
  console.log(`- store.ts Version: ${hasStoreVer ? 'PASS' : 'FAIL'}`);
  console.log(`- store.ts Asset:   ${hasStoreAsset ? 'PASS' : 'FAIL'}`);
  console.log(`- store.ts Rel:     ${hasStoreRel ? 'PASS' : 'FAIL'}`);

  console.log('\n==================================================');
  if (
    sourceSha === assetSha &&
    logItem &&
    versions.length > 0 &&
    assets.length > 0 &&
    relations.length === 6 &&
    faqCount === 63 &&
    hasStoreItem &&
    hasStoreVer &&
    hasStoreAsset &&
    hasStoreRel
  ) {
    console.log('>>> FINAL VERIFICATION RESULT: PASS');
  } else {
    console.log('>>> FINAL VERIFICATION RESULT: FAIL');
    process.exit(1);
  }
}

runVerification().catch(err => {
  console.error('Verification Error:', err);
  process.exit(1);
});
