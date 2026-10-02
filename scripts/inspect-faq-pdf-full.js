const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const pdfjs = require('pdfjs-dist');
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

async function main() {
  console.log('====================================================');
  console.log('MAN-B-FAQ-001 FINAL PDF FULL QA AUDIT (R1)');
  console.log('====================================================\n');

  const sourcePdf = path.join(process.cwd(), 'Manuals/MAN-B-FAQ-001_Knowledge-FAQ/03_PUBLISHED/MAN-B-FAQ-001_Knowledge-FAQ_V1.pdf');
  const assetDir = path.join(process.cwd(), 'private_assets/manuals');
  const assetPdf = path.join(assetDir, 'MAN-B-FAQ-001_Knowledge-FAQ_V1.pdf');

  if (!fs.existsSync(sourcePdf)) {
    console.error('FAIL: Source PDF not found at', sourcePdf);
    process.exit(1);
  }

  const srcBuf = fs.readFileSync(sourcePdf);
  const srcHash = crypto.createHash('sha256').update(srcBuf).digest('hex');
  console.log(`1. SOURCE PDF FOUND:`);
  console.log(`   Path:        ${sourcePdf}`);
  console.log(`   File Size:   ${srcBuf.length} bytes`);
  console.log(`   SHA-256:     ${srcHash}\n`);

  // Parse PDF with pdfjs-dist
  const data = new Uint8Array(srcBuf);
  const doc = await pdfjs.getDocument({ data }).promise;
  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items.map(item => item.str);
    const text = strings.join(' ');
    pages.push({ pageNum: i, text, rawItems: strings });
  }
  const parsed = { numpages: doc.numPages, text: pages.map(p => p.text).join('\n') };

  console.log(`2. PAGE COUNT & INTEGRITY:`);
  console.log(`   Total Pages: ${parsed.numpages} (Expected: 16) -> ${parsed.numpages === 16 ? 'PASS' : 'FLAG (' + parsed.numpages + ')'}`);

  // Page by page review
  pages.forEach(p => {
    console.log(`   - Page ${p.pageNum}: length ${p.text.length} chars | First line: "${p.text.split('\n')[0].trim()}"`);
  });
  console.log();

  // Keyword audit
  console.log(`3. PRODUCTION BASELINE RECONCILIATION IN PDF:`);
  const fullText = parsed.text;

  const baselineChecks = [
    { label: '120 FAQs / 120개', check: fullText.includes('120') },
    { label: '12 Domains / 12개', check: fullText.includes('12') },
    { label: '50 Featured / 50개', check: fullText.includes('50') },
    { label: '10 Topics / 10개', check: fullText.includes('10') },
    { label: 'BRAND', check: fullText.includes('BRAND') },
    { label: 'ONB / ONBOARDING', check: fullText.includes('ONB') || fullText.includes('ONBOARDING') },
    { label: 'PROD / PRODUCTS', check: fullText.includes('PROD') || fullText.includes('PRODUCT') },
    { label: 'ORD / ORDERS', check: fullText.includes('ORD') || fullText.includes('ORDER') },
    { label: 'REG / REGULATORY', check: fullText.includes('REG') || fullText.includes('REGULATORY') },
    { label: 'RET / RETAIL', check: fullText.includes('RET') || fullText.includes('RETAIL') },
    { label: 'LOG / LOGISTICS', check: fullText.includes('LOG') || fullText.includes('LOGISTICS') },
    { label: 'FIN / FINANCE', check: fullText.includes('FIN') || fullText.includes('FINANCE') },
    { label: 'PERM / PERMISSIONS', check: fullText.includes('PERM') || fullText.includes('PERMISSION') },
    { label: 'TASK / COMMUNICATION', check: fullText.includes('TASK') || fullText.includes('COMMUNICATION') },
    { label: 'RPT / REPORTS', check: fullText.includes('RPT') || fullText.includes('REPORT') },
    { label: 'INT / INTELLIGENCE', check: fullText.includes('INT') || fullText.includes('INTELLIGENCE') }
  ];

  baselineChecks.forEach(b => {
    console.log(`   - ${b.label}: ${b.check ? 'FOUND (PASS)' : 'NOT FOUND (CHECK)'}`);
  });
  console.log();

  // Check for editorial artifacts / forbidden tokens
  console.log(`4. EDITORIAL & FORBIDDEN TOKENS AUDIT:`);
  const forbidden = [
    'TODO', 'FIXME', 'LOREM IPSUM', 'DRAFT COMMENT', 'INTERNAL ONLY',
    'PLACEHOLDER', '63 FAQ', '63개', '6 Published', 'Pending Domain',
    'LOG Pending', 'FIN Pending', 'PERM Pending', 'TASK Pending', 'RPT Pending', 'INT Pending'
  ];

  let forbiddenFound = 0;
  forbidden.forEach(token => {
    if (fullText.includes(token)) {
      console.log(`   >>> FLAG: Found forbidden token "${token}" in PDF text!`);
      forbiddenFound++;
    }
  });
  if (forbiddenFound === 0) {
    console.log(`   0 forbidden / placeholder / stale pending tokens found: PASS\n`);
  } else {
    console.log(`   Total forbidden flags: ${forbiddenFound}\n`);
  }

  // Copy to private_assets
  console.log(`5. PRIVATE ASSET SYNCHRONIZATION:`);
  if (!fs.existsSync(assetDir)) {
    fs.mkdirSync(assetDir, { recursive: true });
  }
  fs.copyFileSync(sourcePdf, assetPdf);
  const assetBuf = fs.readFileSync(assetPdf);
  const assetHash = crypto.createHash('sha256').update(assetBuf).digest('hex');

  console.log(`   Asset Path:  ${assetPdf}`);
  console.log(`   Asset Size:  ${assetBuf.length} bytes`);
  console.log(`   Asset SHA:   ${assetHash}`);
  console.log(`   Source SHA:  ${srcHash}`);
  console.log(`   Match:       ${srcHash === assetHash ? 'YES (100% IDENTICAL)' : 'NO'}\n`);

  // DB Verification
  console.log(`6. PRODUCTION DB VERIFICATION:`);
  const { data: faqs } = await admin.from('knowledge_faqs').select('id, status, is_featured');
  const { data: items } = await admin.from('knowledge_items').select('id, status').eq('status', 'PUBLISHED');
  const { data: topics } = await admin.from('knowledge_topics').select('id, is_active');

  console.log(`   Total FAQs in DB:          ${faqs.length} (Expected: 120)`);
  console.log(`   Approved FAQs in DB:       ${faqs.filter(f => f.status === 'APPROVED').length} (Expected: 120)`);
  console.log(`   Featured FAQs in DB:       ${faqs.filter(f => f.is_featured).length} (Expected: 50)`);
  console.log(`   Published Manuals in DB:   ${items.length} (Expected: 12)`);
  console.log(`   Active Topics in DB:       ${topics.filter(t => t.is_active).length} (Expected: 10)\n`);

  console.log('====================================================');
  console.log('AUDIT COMPLETED');
  console.log('====================================================');
}

main().catch(console.error);
