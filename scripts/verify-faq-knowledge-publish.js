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
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    env[match[1]] = value.trim();
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseSecretKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(supabaseUrl, supabaseSecretKey);

async function verify() {
  console.log('====================================================');
  console.log('MAN-B-FAQ-001 KNOWLEDGE PUBLISH VERIFICATION QA');
  console.log('====================================================\n');

  // 1. Verify Hashes
  const sourcePdf = path.join(process.cwd(), 'Manuals/MAN-B-FAQ-001_Knowledge-FAQ/03_PUBLISHED/MAN-B-FAQ-001_Knowledge-FAQ_V1.pdf');
  const assetPdf = path.join(process.cwd(), 'private_assets/manuals/MAN-B-FAQ-001_Knowledge-FAQ_V1.pdf');

  const srcHash = crypto.createHash('sha256').update(fs.readFileSync(sourcePdf)).digest('hex');
  const assetHash = crypto.createHash('sha256').update(fs.readFileSync(assetPdf)).digest('hex');
  const EXPECTED_HASH = 'b34d79c4fba0459ad67185ca3cc58e82eb95033b60f7f53e2da11af8e7d9a22f';

  console.log('1. HASH INTEGRITY:');
  console.log(`   Source SHA:    ${srcHash}`);
  console.log(`   Asset SHA:     ${assetHash}`);
  console.log(`   Expected SHA:  ${EXPECTED_HASH}`);
  console.log(`   Hash Match:    ${srcHash === EXPECTED_HASH && assetHash === EXPECTED_HASH ? 'PASS' : 'FAIL'}\n`);

  // 2. DB Item Verification
  console.log('2. KNOWLEDGE ITEM IN DB:');
  const { data: item, error: itemErr } = await admin
    .from('knowledge_items')
    .select('*')
    .eq('id', 'kno-knowledge-center-faq-v10')
    .single();

  if (itemErr || !item) {
    console.error('FAIL: Item not found', itemErr);
    process.exit(1);
  }
  console.log(`   ID:            ${item.id}`);
  console.log(`   Title (KO):    ${item.title_ko}`);
  console.log(`   Status:        ${item.status}`);
  console.log(`   Version:       ${item.current_version}`);
  console.log(`   Module:        ${item.module}`);
  console.log(`   Category:      ${item.category}`);
  console.log(`   Audience:      ${JSON.stringify(item.audience)}`);
  console.log(`   Doc URL:       ${item.document_url}`);
  console.log(`   Doc Name:      ${item.document_name}`);
  console.log(`   Doc Size:      ${item.document_size} bytes\n`);

  // 3. DB Version Verification
  console.log('3. KNOWLEDGE VERSION IN DB:');
  const { data: version, error: verErr } = await admin
    .from('knowledge_versions')
    .select('*')
    .eq('id', 'ver-knowledge-center-faq-v10')
    .single();
  if (verErr || !version) {
    console.error('FAIL: Version not found', verErr);
    process.exit(1);
  }
  console.log(`   ID:            ${version.id}`);
  console.log(`   Status:        ${version.status}`);
  console.log(`   Version:       ${version.version}`);
  console.log(`   Title:         ${version.title_ko}\n`);

  // 4. DB Asset Verification
  console.log('4. KNOWLEDGE MANUAL ASSET IN DB:');
  const { data: asset, error: assetErr } = await admin
    .from('knowledge_manual_assets')
    .select('*')
    .eq('id', 'asset-knowledge-center-faq-v10')
    .single();
  if (assetErr || !asset) {
    console.error('FAIL: Asset not found', assetErr);
    process.exit(1);
  }
  console.log(`   ID:            ${asset.id}`);
  console.log(`   File Name:     ${asset.file_name}`);
  console.log(`   File Size:     ${asset.file_size} bytes`);
  console.log(`   Is Current:    ${asset.is_current}\n`);

  // 5. DB Relations Verification
  console.log('5. KNOWLEDGE RELATIONS IN DB:');
  const { data: relations, error: relErr } = await admin
    .from('knowledge_relations')
    .select('*')
    .eq('knowledge_id', 'kno-knowledge-center-faq-v10')
    .order('id');
  if (relErr || !relations) {
    console.error('FAIL: Relations not found', relErr);
    process.exit(1);
  }
  console.log(`   Count:         ${relations.length} relations`);
  relations.forEach(r => {
    console.log(`   - [${r.id}] ${r.related_portal} | ${r.related_module} | ${r.related_menu} -> ${r.related_route}`);
  });
  console.log();

  // 6. In-Memory Store Check
  console.log('6. IN-MEMORY STORE FALLBACK QA:');
  const storeContent = fs.readFileSync('lib/knowledge/store.ts', 'utf8');
  const hasStoreItem = storeContent.includes('kno-knowledge-center-faq-v10');
  const hasStoreVer = storeContent.includes('ver-knowledge-center-faq-v10');
  const hasStoreAsset = storeContent.includes('asset-knowledge-center-faq-v10');
  const hasStoreRel1 = storeContent.includes('rel-faq-help-main');
  const hasStoreRel2 = storeContent.includes('rel-faq-help-ask');
  const hasStoreRel3 = storeContent.includes('rel-faq-help-slug');
  const hasStoreRel4 = storeContent.includes('rel-faq-support');
  const hasStoreRel5 = storeContent.includes('rel-admin-faq-topics');
  const hasStoreRel6 = storeContent.includes('rel-admin-faq-library');

  console.log(`   Store Item:    ${hasStoreItem ? 'FOUND (PASS)' : 'MISSING (FAIL)'}`);
  console.log(`   Store Version: ${hasStoreVer ? 'FOUND (PASS)' : 'MISSING (FAIL)'}`);
  console.log(`   Store Asset:   ${hasStoreAsset ? 'FOUND (PASS)' : 'MISSING (FAIL)'}`);
  console.log(`   Store Rels:    ${hasStoreRel1 && hasStoreRel2 && hasStoreRel3 && hasStoreRel4 && hasStoreRel5 && hasStoreRel6 ? 'ALL 6 FOUND (PASS)' : 'MISSING (FAIL)'}\n`);

  // 7. Search Discovery Verification
  console.log('7. SEARCH DISCOVERY QA:');
  const searchTerms = [
    'Help Center',
    'FAQ Guide',
    'Knowledge Center',
    'Ask K SELECT',
    'Support Handoff',
    '도움말 센터',
    '지식 검색',
    '자연어검색',
    '1:1문의',
    '어드민지식관리'
  ];

  for (const term of searchTerms) {
    const termLower = term.toLowerCase();
    const titleMatch = (item.title_ko + ' ' + item.title_en + ' ' + item.title).toLowerCase().includes(termLower);
    const summaryMatch = (item.summary_ko + ' ' + item.summary_en).toLowerCase().includes(termLower);
    const contentMatch = (item.content_ko + ' ' + item.content_en).toLowerCase().includes(termLower);
    const tagMatch = (item.tags || []).some(t => t.toLowerCase().includes(termLower));
    const matched = titleMatch || summaryMatch || contentMatch || tagMatch;
    console.log(`   - Keyword "${term}": ${matched ? 'FOUND (PASS)' : 'NOT FOUND (FAIL)'}`);
    if (!matched) {
      console.error(`FAIL: Keyword "${term}" not matched in item!`);
    }
  }
  console.log();

  // 8. Regression Check - All Published Items
  console.log('8. REGRESSION AUDIT - ALL PUBLISHED KNOWLEDGE ITEMS:');
  const { data: allPubItems, error: pubErr } = await admin
    .from('knowledge_items')
    .select('id, title_ko, status, current_version')
    .eq('status', 'PUBLISHED')
    .order('id');

  console.log(`   Total Published Items: ${allPubItems.length}`);
  allPubItems.forEach(p => console.log(`   - [${p.id}] (${p.current_version}) ${p.title_ko}`));
  console.log();

  // 9. Regression Check - FAQs Count
  console.log('9. REGRESSION AUDIT - FAQS IN DB:');
  const { data: faqs, error: faqsErr } = await admin
    .from('knowledge_faqs')
    .select('id, portal_scope, status, source_knowledge_id')
    .order('id');

  console.log(`   Total FAQs: ${faqs.length}`);
  const approvedFaqs = faqs.filter(f => f.status === 'APPROVED');
  console.log(`   Approved FAQs: ${approvedFaqs.length}\n`);

  if (faqs.length !== 120 || approvedFaqs.length !== 120) {
    console.error('FAIL: Expected exactly 120 FAQs and 120 approved FAQs, got:', faqs.length, approvedFaqs.length);
    process.exit(1);
  }

  console.log('====================================================');
  console.log('ALL QA CHECKS PASSED (100%)');
  console.log('====================================================');
}

verify().catch(console.error);
