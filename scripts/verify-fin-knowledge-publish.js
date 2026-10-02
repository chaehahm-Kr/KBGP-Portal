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
const supabaseSecretKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseSecretKey);

async function verifyFinPublish() {
  console.log('====================================================');
  console.log('MAN-B-FIN-001 KNOWLEDGE PUBLISH VERIFICATION AUDIT');
  console.log('====================================================\n');

  // 1. Verify SHA-256 of physical files
  const sourcePdfPath = path.join(process.cwd(), 'Manuals', 'MAN-B-FIN-001_Finance-Settlement', '03_PUBLISHED', 'MAN-B-FIN-001_Finance-Settlement_V1.pdf');
  const assetPdfPath = path.join(process.cwd(), 'private_assets', 'manuals', 'MAN-B-FIN-001_Finance-Settlement_V1.pdf');

  const sourceBytes = fs.readFileSync(sourcePdfPath);
  const assetBytes = fs.readFileSync(assetPdfPath);

  const sourceHash = crypto.createHash('sha256').update(sourceBytes).digest('hex');
  const assetHash = crypto.createHash('sha256').update(assetBytes).digest('hex');

  console.log('--- 1. Asset File Integrity ---');
  console.log(`Source PDF:    ${sourcePdfPath} (${sourceBytes.length} bytes)`);
  console.log(`Source SHA:    ${sourceHash}`);
  console.log(`Asset PDF:     ${assetPdfPath} (${assetBytes.length} bytes)`);
  console.log(`Asset SHA:     ${assetHash}`);
  console.log(`SHA Match:     ${sourceHash === assetHash ? 'YES (100% Identical)' : 'NO'}`);

  if (sourceHash !== assetHash) {
    console.error('FAIL: Source and Asset SHA-256 mismatch');
    process.exit(1);
  }

  // 2. Verify Knowledge Item in Supabase
  console.log('\n--- 2. Supabase Knowledge Item Audit ---');
  const { data: item, error: iErr } = await supabase
    .from('knowledge_items')
    .select('*')
    .eq('id', 'kno-finance-settlement-v10')
    .single();

  if (iErr || !item) {
    console.error('FAIL: kno-finance-settlement-v10 not found in DB:', iErr);
    process.exit(1);
  }

  console.log(`✓ ID:              ${item.id}`);
  console.log(`✓ Slug:            ${item.slug}`);
  console.log(`✓ Title (KO):      ${item.title_ko}`);
  console.log(`✓ Title (EN):      ${item.title_en}`);
  console.log(`✓ Module:          ${item.module}`);
  console.log(`✓ Category:        ${item.category}`);
  console.log(`✓ Status:          ${item.status}`);
  console.log(`✓ Current Version: ${item.current_version}`);
  console.log(`✓ Document URL:    ${item.document_url}`);

  if (item.status !== 'PUBLISHED' || item.module !== 'FINANCE') {
    console.error('FAIL: Knowledge item status or module invalid');
    process.exit(1);
  }

  // 3. Verify Knowledge Version in Supabase
  console.log('\n--- 3. Supabase Knowledge Version Audit ---');
  const { data: versions, error: vErr } = await supabase
    .from('knowledge_versions')
    .select('*')
    .eq('knowledge_id', 'kno-finance-settlement-v10');

  if (vErr || !versions || versions.length === 0) {
    console.error('FAIL: ver-finance-settlement-v10 not found in DB:', vErr);
    process.exit(1);
  }

  const ver = versions[0];
  console.log(`✓ Version ID:      ${ver.id}`);
  console.log(`✓ Version Number:  ${ver.version}`);
  console.log(`✓ Title (KO):      ${ver.title_ko}`);
  console.log(`✓ Status:          ${ver.status}`);
  console.log(`✓ Document URL:    ${ver.document_url}`);

  // 4. Verify Manual Asset in Supabase
  console.log('\n--- 4. Supabase Manual Asset Audit ---');
  const { data: assets, error: aErr } = await supabase
    .from('knowledge_manual_assets')
    .select('*')
    .eq('knowledge_id', 'kno-finance-settlement-v10');

  if (aErr || !assets || assets.length === 0) {
    console.error('FAIL: asset-finance-settlement-v10 not found in DB:', aErr);
    process.exit(1);
  }

  const asset = assets[0];
  console.log(`✓ Asset ID:        ${asset.id}`);
  console.log(`✓ File Name:       ${asset.file_name}`);
  console.log(`✓ File Size:       ${asset.file_size} bytes`);
  console.log(`✓ Version:         ${asset.version}`);

  // 5. Verify Knowledge Relations in Supabase
  console.log('\n--- 5. Supabase Knowledge Relations Audit ---');
  const { data: rels, error: rErr } = await supabase
    .from('knowledge_relations')
    .select('*')
    .eq('knowledge_id', 'kno-finance-settlement-v10')
    .order('created_at', { ascending: true });

  if (rErr || !rels || rels.length !== 9) {
    console.error(`FAIL: Expected 9 relations, found ${rels?.length}:`, rErr);
    process.exit(1);
  }

  rels.forEach(r => {
    console.log(`✓ [${r.id}] ${r.related_portal} (${r.related_module}) -> ${r.related_route} [${r.related_menu}]`);
  });

  // 6. Verify Topic relation
  console.log('\n--- 6. Topic Association ---');
  const { data: topics, error: tErr } = await supabase
    .from('knowledge_topics')
    .select('*')
    .eq('id', 'topic-finance')
    .single();

  if (tErr || !topics) {
    console.error('FAIL: topic-finance not found:', tErr);
    process.exit(1);
  }
  console.log(`✓ Bound Topic: ${topics.id} (${topics.name_ko} / ${topics.name_en})`);
  console.log(`  Topic Modules: ${JSON.stringify(topics.match_modules)}`);

  // 7. Verify Search Queries
  console.log('\n--- 7. Search Discovery Simulation ---');
  const searchQueries = [
    'Invoice',
    'Payment',
    'Settlement',
    'Balance Due',
    'Partial Payment',
    'Single Active Invoice'
  ];

  const contentToSearch = (item.title_ko + ' ' + item.title_en + ' ' + item.summary_ko + ' ' + item.summary_en + ' ' + item.content_ko + ' ' + item.content_en + ' ' + item.tags.join(' ')).toLowerCase();

  for (const q of searchQueries) {
    const matched = contentToSearch.includes(q.toLowerCase());
    console.log(`  Query "${q}": ${matched ? '✓ MATCHED' : '✗ FAILED'}`);
    if (!matched) {
      console.error(`FAIL: Search query "${q}" failed to match`);
      process.exit(1);
    }
  }

  // 8. Verify Existing Manuals Intact
  console.log('\n--- 8. Existing Published Manuals Regression Check ---');
  const { data: allPublished, error: pErr } = await supabase
    .from('knowledge_items')
    .select('id, module, title_ko, status')
    .eq('status', 'PUBLISHED');

  if (pErr) {
    console.error('FAIL: Error fetching all published items:', pErr);
    process.exit(1);
  }

  console.log(`Total Published Manuals in DB: ${allPublished.length}`);
  allPublished.forEach(m => console.log(`  ✓ [${m.module}] ${m.id}: ${m.title_ko}`));

  const expectedManuals = [
    'kno-brand-policy-v10',
    'kno-onboarding-guide-v10',
    'kno-product-management-v10',
    'kno-order-management-v10',
    'kno-regulatory-compliance-v11',
    'kno-retail-applications-v10',
    'kno-shipping-logistics-v10',
    'kno-permissions-user-management-v10',
    'kno-finance-settlement-v10'
  ];

  for (const exp of expectedManuals) {
    const found = allPublished.find(p => p.id === exp);
    if (!found) {
      console.error(`FAIL: Expected manual ${exp} not found among published items`);
      process.exit(1);
    }
  }
  console.log('✓ All 9 Official Published Knowledge Manuals are intact without regression!');

  console.log('\n====================================================');
  console.log('ALL VERIFICATIONS PASSED: MAN-B-FIN-001 100% PUBLISHED & AUDITED');
  console.log('====================================================\n');
}

verifyFinPublish().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
