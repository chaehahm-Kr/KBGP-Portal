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
    value = value.trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    env[match[1]] = value.trim();
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseSecretKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseSecretKey);

async function verifyFinFaqs() {
  console.log('====================================================');
  console.log('MAN-B-FIN-001 KNOWLEDGE CENTER FAQ VERIFICATION AUDIT');
  console.log('====================================================\n');

  // 1. Fetch all FAQs from Supabase
  const { data: allFaqs, error: faqsError } = await supabase
    .from('knowledge_faqs')
    .select('*')
    .order('created_at', { ascending: true });

  if (faqsError) {
    console.error('FAIL: Error fetching faqs:', faqsError);
    process.exit(1);
  }

  console.log(`Total FAQs in Supabase: ${allFaqs.length} (Expected: 90)`);
  if (allFaqs.length !== 90) {
    console.error(`FAIL: Expected 90 total FAQs in DB, found ${allFaqs.length}`);
    process.exit(1);
  }

  // 2. Filter FIN FAQs
  const finFaqs = allFaqs.filter(f => f.topic_id === 'topic-finance' || f.id.startsWith('faq-fin-'));
  console.log(`FIN FAQs Count: ${finFaqs.length} (Expected: 10)`);
  if (finFaqs.length !== 10) {
    console.error(`FAIL: Expected 10 FIN FAQs, found ${finFaqs.length}`);
    process.exit(1);
  }

  // 3. Verify FIN FAQs properties
  let featuredCount = 0;
  for (const faq of finFaqs) {
    console.log(`- [${faq.id}] ${faq.question_ko}`);
    console.log(`  Topic: ${faq.topic_id} | Knowledge: ${faq.source_knowledge_id} | Portal Scope: ${faq.portal_scope} | Order: ${faq.display_order} | Featured: ${faq.is_featured}`);

    if (faq.source_knowledge_id !== 'kno-finance-settlement-v10') {
      console.error(`FAIL: ${faq.id} source_knowledge_id is ${faq.source_knowledge_id}, expected kno-finance-settlement-v10`);
      process.exit(1);
    }
    if (faq.topic_id !== 'topic-finance') {
      console.error(`FAIL: ${faq.id} topic_id is ${faq.topic_id}, expected topic-finance`);
      process.exit(1);
    }
    if (faq.portal_scope !== 'BRAND') {
      console.error(`FAIL: ${faq.id} portal_scope is ${faq.portal_scope}, expected BRAND`);
      process.exit(1);
    }
    if (!faq.question_ko || !faq.question_en || !faq.answer_ko || !faq.answer_en) {
      console.error(`FAIL: ${faq.id} missing language content`);
      process.exit(1);
    }
    if (faq.is_featured) featuredCount++;
  }

  console.log(`\nFeatured FIN FAQs: ${featuredCount} (Expected: 4)`);
  if (featuredCount !== 4) {
    console.error(`FAIL: Expected 4 featured FIN FAQs, found ${featuredCount}`);
    process.exit(1);
  }

  // 4. Verify existing FAQ groups preservation
  const groupCounts = {};
  for (const f of allFaqs) {
    const prefix = f.id.split('-')[1]?.toUpperCase() || 'OTHER';
    groupCounts[prefix] = (groupCounts[prefix] || 0) + 1;
  }
  console.log('\nFAQ Distribution by Group:');
  console.table(groupCounts);

  const expectedCounts = {
    BRAND: 5,
    ONB: 9,
    PROD: 14,
    ORD: 12,
    REG: 12,
    RET: 11,
    LOG: 10,
    PERM: 7,
    FIN: 10
  };

  for (const [group, expected] of Object.entries(expectedCounts)) {
    const actual = groupCounts[group] || 0;
    if (actual !== expected) {
      console.error(`FAIL: Group ${group} expected ${expected}, got ${actual}`);
      process.exit(1);
    }
    console.log(`✓ Group ${group}: ${actual}/${expected} intact`);
  }

  // 5. Check Duplicate IDs and Question Titles across all 83 FAQs
  const idSet = new Set();
  const qSet = new Set();
  for (const f of allFaqs) {
    if (idSet.has(f.id)) {
      console.error(`FAIL: Duplicate FAQ ID: ${f.id}`);
      process.exit(1);
    }
    idSet.add(f.id);

    if (qSet.has(f.question_ko)) {
      console.error(`FAIL: Duplicate FAQ question_ko: ${f.question_ko}`);
      process.exit(1);
    }
    qSet.add(f.question_ko);
  }
  console.log('\n✓ Zero duplicate IDs or questions across all 90 FAQs');

  // 6. Test Keyword Search Discovery
  const searchTerms = [
    'Invoice',
    'Payment',
    'Settlement',
    'Balance Due',
    'Partial Payment',
    'Single Active Invoice',
    'Shortage',
    'Damage'
  ];

  console.log('\nTesting Keyword Search Discovery:');
  for (const term of searchTerms) {
    const matched = finFaqs.filter(f =>
      f.question_ko.toLowerCase().includes(term.toLowerCase()) ||
      f.answer_ko.toLowerCase().includes(term.toLowerCase()) ||
      f.question_en.toLowerCase().includes(term.toLowerCase()) ||
      f.answer_en.toLowerCase().includes(term.toLowerCase())
    );
    console.log(`- Query "${term}": Found ${matched.length} FIN FAQ(s) -> [${matched.map(m => m.id).join(', ')}]`);
    if (matched.length === 0) {
      console.error(`FAIL: Search term "${term}" did not match any FIN FAQ`);
      process.exit(1);
    }
  }

  console.log('\n====================================================');
  console.log('VERIFICATION COMPLETE: ALL 10 FIN FAQS 100% GROUNDED & VALIDATED');
  console.log('====================================================\n');
}

verifyFinFaqs().catch(err => {
  console.error('Verification script error:', err);
  process.exit(1);
});
