const fs = require('fs');
const path = require('path');
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

async function verifyRptFaqs() {
  console.log('================================================================');
  console.log('VERIFY MAN-B-RPT-001 KNOWLEDGE CENTER FAQS PRODUCTION PUBLISH');
  console.log('================================================================\n');

  // 1. Fetch all FAQs from DB
  const { data: allFaqs, error: faqsErr } = await admin
    .from('knowledge_faqs')
    .select('*')
    .order('id');

  if (faqsErr || !allFaqs) throw new Error(`Failed to fetch FAQs: ${JSON.stringify(faqsErr)}`);

  console.log(`[1] Total FAQs in DB: ${allFaqs.length} (Expected: 110)`);
  if (allFaqs.length !== 110) throw new Error(`Total FAQ count mismatch: expected 110, got ${allFaqs.length}`);

  // 2. Fetch RPT FAQs
  const rptFaqs = allFaqs.filter(f => f.source_knowledge_id === 'kno-reports-performance-v10');
  console.log(`\n[2] RPT FAQs Count: ${rptFaqs.length} (Expected: 10)`);
  if (rptFaqs.length !== 10) throw new Error(`RPT FAQ count mismatch: expected 10, got ${rptFaqs.length}`);

  const expectedIds = [
    'faq-rpt-01', 'faq-rpt-02', 'faq-rpt-03', 'faq-rpt-04', 'faq-rpt-05',
    'faq-rpt-06', 'faq-rpt-07', 'faq-rpt-08', 'faq-rpt-09', 'faq-rpt-10'
  ];

  const actualIds = rptFaqs.map(f => f.id).sort();
  console.log(`  RPT FAQ IDs: ${actualIds.join(', ')}`);
  if (JSON.stringify(actualIds) !== JSON.stringify(expectedIds)) {
    throw new Error(`RPT FAQ IDs mismatch! Expected: ${expectedIds.join(', ')}, Actual: ${actualIds.join(', ')}`);
  }

  // 3. Check Featured FAQs
  const featuredRpt = rptFaqs.filter(f => f.is_featured);
  console.log(`\n[3] Featured RPT FAQs (${featuredRpt.length}):`);
  featuredRpt.forEach(f => {
    console.log(`  - [★ ${f.id}] ${f.question_ko}`);
  });
  if (featuredRpt.length !== 4) throw new Error(`Expected 4 featured FAQs, got ${featuredRpt.length}`);

  // 4. Verify Scope, Topic, and Status
  console.log('\n[4] Scope, Topic & Status Verification:');
  rptFaqs.forEach(f => {
    if (f.portal_scope !== 'BRAND') throw new Error(`${f.id} invalid portal_scope: ${f.portal_scope}`);
    if (f.topic_id !== 'topic-start') throw new Error(`${f.id} invalid topic_id: ${f.topic_id}`);
    if (f.status !== 'APPROVED') throw new Error(`${f.id} invalid status: ${f.status}`);
  });
  console.log('  All 10 FAQs verified: portal_scope = BRAND, topic_id = topic-start, status = APPROVED ✓');

  // 5. Duplicate Check
  console.log('\n[5] Duplicate Verification:');
  const allIds = allFaqs.map(f => f.id);
  const dupIds = allIds.filter((id, idx) => allIds.indexOf(id) !== idx);
  console.log(`  Duplicate FAQ IDs: ${dupIds.length} (${dupIds.join(', ') || 'None'})`);
  if (dupIds.length > 0) throw new Error('Duplicate FAQ IDs detected!');

  const allQuestions = allFaqs.map(f => f.question_ko);
  const dupQuestions = allQuestions.filter((q, idx) => allQuestions.indexOf(q) !== idx);
  console.log(`  Duplicate FAQ Questions: ${dupQuestions.length} (${dupQuestions.join(', ') || 'None'})`);
  if (dupQuestions.length > 0) throw new Error('Duplicate FAQ Questions detected!');

  // 6. Keyword Discovery in Korean & English
  console.log('\n[6] Keyword Discovery:');
  const testKeywords = [
    'Reports',
    'Performance',
    'Action Required',
    'PO Pipeline',
    'Finance',
    'Cash Flow',
    'Product Completeness',
    'Support',
    'Purchasing Dashboard',
    '대시보드',
    '실행 필요',
    '정산',
    '완성도'
  ];

  testKeywords.forEach(kw => {
    const hits = rptFaqs.filter(f =>
      f.question_ko.toLowerCase().includes(kw.toLowerCase()) ||
      f.question_en.toLowerCase().includes(kw.toLowerCase()) ||
      f.answer_ko.toLowerCase().includes(kw.toLowerCase()) ||
      f.answer_en.toLowerCase().includes(kw.toLowerCase())
    );
    console.log(`  Keyword [${kw.padEnd(20)}]: ${hits.length} RPT FAQ hits`);
  });

  // 7. Unsupported Claims Audit
  console.log('\n[7] Unsupported Claims Audit:');
  const forbiddenPatterns = [
    /100%\s*(정확|보장|일치)/i,
    /완벽한\s*실시간/i,
    /무조건/i,
    /항상\s*보장/i,
    /real-time\s*guarantee/i,
    /100%\s*accurate/i
  ];

  let claimViolations = 0;
  rptFaqs.forEach(f => {
    forbiddenPatterns.forEach(pat => {
      if (pat.test(f.question_ko) || pat.test(f.question_en) || pat.test(f.answer_ko) || pat.test(f.answer_en)) {
        console.error(`  Violation in ${f.id} for pattern ${pat}`);
        claimViolations++;
      }
    });
  });
  console.log(`  Unsupported Claim Violations: ${claimViolations} (PASS)`);
  if (claimViolations > 0) throw new Error('Unsupported absolute claims found!');

  // 8. Knowledge Items Regression Check
  console.log('\n[8] Knowledge Items Regression Check:');
  const { data: knoItems } = await admin
    .from('knowledge_items')
    .select('id, title_ko, status')
    .eq('status', 'PUBLISHED')
    .order('id');

  console.log(`  Total Published Knowledge Items: ${knoItems.length} (Expected: 11)`);
  knoItems.forEach(ki => {
    console.log(`  - [${ki.id}] ${ki.title_ko}`);
  });
  if (knoItems.length !== 11) throw new Error(`Knowledge items count mismatch: expected 11, got ${knoItems.length}`);

  // 9. Existing FAQs Regression Check
  console.log('\n[9] Existing FAQs Breakdown by Source:');
  const sourceBreakdown = {};
  allFaqs.forEach(f => {
    sourceBreakdown[f.source_knowledge_id] = (sourceBreakdown[f.source_knowledge_id] || 0) + 1;
  });
  console.log(sourceBreakdown);

  console.log('\n================================================================');
  console.log('ALL RPT FAQ VERIFICATIONS PASSED PERFECTLY!');
  console.log('================================================================');
}

verifyRptFaqs().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
