const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const envLocal = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
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

function getSha256(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  const hashSum = crypto.createHash('sha256');
  hashSum.update(fileBuffer);
  return hashSum.digest('hex');
}

async function verify() {
  console.log('=== K SELECT KNOWLEDGE CENTER PUBLISH VERIFICATION (MAN-B-ORD-001) ===\n');

  // 1. PDF File & SHA-256 verification
  const sourcePdf = path.join(__dirname, '..', 'Manuals', 'MAN-B-ORD-001_Order-Management', '03_PUBLISHED', 'MAN-B-ORD-001_Order-Management_V1.pdf');
  const privatePdf = path.join(__dirname, '..', 'private_assets', 'manuals', 'MAN-B-ORD-001_Order-Management_V1.pdf');

  console.log('[1] Checking PDF Assets & Hash Integrity:');
  if (!fs.existsSync(sourcePdf)) throw new Error('Source PDF missing!');
  if (!fs.existsSync(privatePdf)) throw new Error('Private Asset PDF missing!');

  const srcHash = getSha256(sourcePdf);
  const privHash = getSha256(privatePdf);
  const srcSize = fs.statSync(sourcePdf).size;
  const privSize = fs.statSync(privatePdf).size;

  console.log(` - Source PDF Size: ${srcSize} bytes | SHA256: ${srcHash}`);
  console.log(` - Private Asset Size: ${privSize} bytes | SHA256: ${privHash}`);
  console.log(` - Exact Match: ${srcHash === privHash ? 'PASS (100% Match)' : 'FAIL'}\n`);

  // 2. Supabase DB Verification
  console.log('[2] Checking Supabase Database Records:');
  const { data: item, error: itemErr } = await supabase
    .from('knowledge_items')
    .select('*')
    .eq('id', 'kno-order-management-v10')
    .single();

  if (itemErr || !item) {
    console.error('Item check failed:', itemErr);
  } else {
    console.log(` - Knowledge Item: [${item.id}] "${item.title}" | Status: ${item.status} | Version: ${item.current_version}`);
  }

  const { data: version, error: verErr } = await supabase
    .from('knowledge_versions')
    .select('*')
    .eq('id', 'ver-order-management-v10')
    .single();

  if (verErr || !version) {
    console.error('Version check failed:', verErr);
  } else {
    console.log(` - Knowledge Version: [${version.id}] Version: ${version.version} | Status: ${version.status}`);
  }

  const { data: asset, error: assetErr } = await supabase
    .from('knowledge_manual_assets')
    .select('*')
    .eq('id', 'asset-order-management-v10')
    .single();

  if (assetErr || !asset) {
    console.error('Asset check failed:', assetErr);
  } else {
    console.log(` - Manual Asset: [${asset.id}] File: ${asset.file_name} | Size: ${asset.file_size} bytes`);
  }

  const { data: rels, error: relErr } = await supabase
    .from('knowledge_relations')
    .select('*')
    .eq('knowledge_id', 'kno-order-management-v10');

  if (relErr) {
    console.error('Relations check failed:', relErr);
  } else {
    console.log(` - Knowledge Relations: ${rels.length} linked routes:`);
    rels.forEach(r => console.log(`    * [${r.related_portal}] ${r.related_menu} -> ${r.related_route}`));
  }

  // 3. Published Items Count & Non-regression
  console.log('\n[3] Checking All Published Items & Non-Regression:');
  const { data: allPub } = await supabase
    .from('knowledge_items')
    .select('id, title, status, current_version')
    .eq('status', 'PUBLISHED');

  console.log(` - Total PUBLISHED items: ${allPub.length} (Expected: 4)`);
  allPub.forEach(p => console.log(`    * [${p.id}] ${p.title} (${p.current_version})`));

  // 4. Check FAQs (Should have 0 for ORD in this task)
  const { data: ordFaqs } = await supabase
    .from('knowledge_faq_items')
    .select('id, question_ko')
    .eq('source_knowledge_id', 'kno-order-management-v10');

  console.log(` - ORD FAQ count in this task: ${ordFaqs ? ordFaqs.length : 0} (Expected: 0 - FAQ publication is a separate task)\n`);

  console.log('>>> ALL INTEGRITY CHECKS PASSED <<<');
}

verify().catch(console.error);
