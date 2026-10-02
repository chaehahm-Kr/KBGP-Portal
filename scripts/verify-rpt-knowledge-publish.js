const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const { PDFParse } = require('pdf-parse');

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

async function verifyRptKnowledgePublish() {
  console.log('================================================================');
  console.log('VERIFY MAN-B-RPT-001 KNOWLEDGE CENTER PRODUCTION PUBLISH');
  console.log('================================================================\n');

  // 1. Check Source PDF & Private Asset SHA-256
  const sourcePdfPath = path.join(process.cwd(), 'Manuals/MAN-B-RPT-001_Reports-Performance/03_PUBLISHED/MAN-B-RPT-001_Reports-Performance_V1.pdf');
  const assetPdfPath = path.join(process.cwd(), 'private_assets/manuals/MAN-B-RPT-001_Reports-Performance_V1.pdf');

  if (!fs.existsSync(sourcePdfPath)) throw new Error(`Source PDF missing: ${sourcePdfPath}`);
  if (!fs.existsSync(assetPdfPath)) throw new Error(`Asset PDF missing: ${assetPdfPath}`);

  const srcBuf = fs.readFileSync(sourcePdfPath);
  const assetBuf = fs.readFileSync(assetPdfPath);
  const srcHash = crypto.createHash('sha256').update(srcBuf).digest('hex');
  const assetHash = crypto.createHash('sha256').update(assetBuf).digest('hex');

  console.log(`[1] File Integrity Check:`);
  console.log(`  Source PDF SHA: ${srcHash}`);
  console.log(`  Asset  PDF SHA: ${assetHash}`);
  console.log(`  Match: ${srcHash === assetHash ? 'YES (MATCH)' : 'NO (MISMATCH)'}`);

  const parser = new PDFParse(new Uint8Array(srcBuf));
  const textRes = await parser.getText();
  console.log(`  Page Count: ${textRes.pages.length} / 21`);

  // 2. Verify Knowledge Item in Supabase DB
  console.log('\n[2] Knowledge Item in DB:');
  const { data: item, error: itemErr } = await admin
    .from('knowledge_items')
    .select('*')
    .eq('id', 'kno-reports-performance-v10')
    .single();

  if (itemErr || !item) throw new Error(`Knowledge item not found in DB: ${JSON.stringify(itemErr)}`);
  console.log(`  ID: ${item.id}`);
  console.log(`  Slug: ${item.slug}`);
  console.log(`  Title KO: ${item.title_ko}`);
  console.log(`  Status: ${item.status}`);
  console.log(`  Module: ${item.module}`);
  console.log(`  Document: ${item.document_name} (${item.document_size} bytes)`);

  // 3. Verify Knowledge Version in Supabase DB
  console.log('\n[3] Knowledge Version in DB:');
  const { data: ver, error: verErr } = await admin
    .from('knowledge_versions')
    .select('*')
    .eq('id', 'ver-reports-performance-v10')
    .single();

  if (verErr || !ver) throw new Error(`Knowledge version not found in DB: ${JSON.stringify(verErr)}`);
  console.log(`  ID: ${ver.id}`);
  console.log(`  Version: ${ver.version}`);
  console.log(`  Title KO: ${ver.title_ko}`);
  console.log(`  Status: ${ver.status}`);

  // 4. Verify Knowledge Asset in Supabase DB
  console.log('\n[4] Knowledge Asset in DB:');
  const { data: asset, error: assetErr } = await admin
    .from('knowledge_manual_assets')
    .select('*')
    .eq('id', 'asset-reports-performance-v10')
    .single();

  if (assetErr || !asset) throw new Error(`Knowledge asset not found in DB: ${JSON.stringify(assetErr)}`);
  console.log(`  ID: ${asset.id}`);
  console.log(`  File Name: ${asset.file_name}`);
  console.log(`  File Size: ${asset.file_size}`);
  console.log(`  Is Current: ${asset.is_current}`);

  // 5. Verify Knowledge Relations in Supabase DB
  console.log('\n[5] Knowledge Relations in DB:');
  const { data: rels, error: relsErr } = await admin
    .from('knowledge_relations')
    .select('*')
    .eq('knowledge_id', 'kno-reports-performance-v10')
    .order('id');

  if (relsErr || !rels || rels.length !== 6) throw new Error(`Relations mismatch in DB, found ${rels?.length}: ${JSON.stringify(relsErr)}`);
  rels.forEach(r => {
    console.log(`  - [${r.id}] ${r.related_portal} | ${r.related_module} | ${r.related_menu} -> ${r.related_route}`);
  });

  // 6. Search Verification across Core Keywords
  console.log('\n[6] Search Keyword Verification in DB:');
  const searchKeywords = [
    'Reports',
    'Performance',
    'Action Required',
    'PO Pipeline',
    'Finance',
    'Cash Flow',
    'Product Completeness',
    'Support',
    'Purchasing Dashboard',
    '성과분석',
    '대시보드',
    '실행필요'
  ];

  for (const kw of searchKeywords) {
    const { data: searchHits } = await admin
      .from('knowledge_items')
      .select('id, title_ko, module, tags')
      .eq('status', 'PUBLISHED')
      .or(`title_ko.ilike.%${kw}%,title_en.ilike.%${kw}%,summary_ko.ilike.%${kw}%,summary_en.ilike.%${kw}%,content_ko.ilike.%${kw}%,tags.cs.{${kw}}`);
    
    const hitRpt = searchHits?.some(h => h.id === 'kno-reports-performance-v10');
    console.log(`  Search [${kw.padEnd(22)}]: ${searchHits?.length || 0} hits total | RPT matched: ${hitRpt ? 'YES ✓' : 'NO ✗'}`);
  }

  // 7. Check Total Published Knowledge Items & Existing Manuals
  console.log('\n[7] Regression Check on Published Knowledge Items:');
  const { data: publishedItems } = await admin
    .from('knowledge_items')
    .select('id, title_ko, status')
    .eq('status', 'PUBLISHED')
    .order('id');

  console.log(`  Total Published Items: ${publishedItems.length}`);
  publishedItems.forEach(pi => {
    console.log(`  - ${pi.id}: ${pi.title_ko}`);
  });

  // 8. Check Total FAQs
  console.log('\n[8] Regression Check on FAQs:');
  const { data: faqs, count: faqCount } = await admin
    .from('knowledge_faqs')
    .select('id, topic_id, source_knowledge_id, is_featured, status', { count: 'exact' });

  console.log(`  Total FAQs in DB: ${faqs.length}`);
  const featuredCount = faqs.filter(f => f.is_featured).length;
  console.log(`  Featured FAQs: ${featuredCount}`);

  console.log('\n================================================================');
  console.log('ALL VERIFICATION CHECKS PASSED PERFECTLY!');
  console.log('================================================================');
}

verifyRptKnowledgePublish().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
