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

async function main() {
  console.log('====================================================');
  console.log('MAN-B-REG-001 REGULATORY FAQS VERIFICATION QA');
  console.log('====================================================');

  // 1. Fetch all FAQs
  const { data: allFaqs, error } = await admin
    .from('knowledge_faqs')
    .select('*')
    .order('display_order', { ascending: true });

  if (error) {
    console.error('Error fetching FAQs:', error);
    process.exit(1);
  }

  console.log(`Total FAQs in DB: ${allFaqs.length}`);

  const brandFaqs = allFaqs.filter(f => f.id.startsWith('faq-brand-'));
  const onbFaqs = allFaqs.filter(f => f.id.startsWith('faq-onb-'));
  const prodFaqs = allFaqs.filter(f => f.id.startsWith('faq-prod-'));
  const ordFaqs = allFaqs.filter(f => f.id.startsWith('faq-ord-'));
  const regFaqs = allFaqs.filter(f => f.id.startsWith('faq-reg-'));

  console.log(`- BRAND FAQs (MAN-BRAND-001): ${brandFaqs.length} / 10`);
  console.log(`- ONB FAQs (MAN-B-ONB-001): ${onbFaqs.length} / 4`);
  console.log(`- PROD FAQs (MAN-B-PROD-001): ${prodFaqs.length} / 14`);
  console.log(`- ORD FAQs (MAN-B-ORD-001): ${ordFaqs.length} / 12`);
  console.log(`- REG FAQs (MAN-B-REG-001): ${regFaqs.length} / 12`);

  if (allFaqs.length !== 52) {
    console.error(`FAIL: Total count expected 52, found ${allFaqs.length}`);
    process.exit(1);
  }

  if (regFaqs.length !== 12) {
    console.error(`FAIL: Expected 12 REG FAQs, found ${regFaqs.length}`);
    process.exit(1);
  }

  // 2. Validate REG FAQs Fields & Boundaries
  console.log('\n--- REG FAQs Integrity Audit ---');
  let passAudit = true;
  regFaqs.forEach(faq => {
    const hasSource = faq.source_knowledge_id === 'kno-regulatory-compliance-v11';
    const hasTopic = faq.topic_id === 'topic-regulatory';
    const hasKo = faq.question_ko && faq.answer_ko;
    const hasEn = faq.question_en && faq.answer_en;
    const isApproved = faq.status === 'APPROVED';
    const hasAudience = Array.isArray(faq.audience) && faq.audience.length > 0;

    if (!hasSource || !hasTopic || !hasKo || !hasEn || !isApproved || !hasAudience) {
      console.error(`FAIL in FAQ ${faq.id}: source=${hasSource}, topic=${hasTopic}, ko=${!!hasKo}, en=${!!hasEn}, status=${isApproved}`);
      passAudit = false;
    } else {
      console.log(`[PASS] ${faq.id}: ${faq.question_ko.slice(0, 45)}... (Featured: ${faq.is_featured})`);
    }
  });

  if (!passAudit) {
    console.error('FAIL: REG FAQ Integrity Audit Failed');
    process.exit(1);
  }

  // 3. Search Keywords Test
  console.log('\n--- Search Keywords Discovery Test ---');
  const searchKeywords = [
    'Regulatory',
    'Compliance',
    'Certification',
    'Trademark',
    'KIPO',
    'USPTO',
    'Ingredients',
    'INCI',
    'FDA',
    'Certificate',
    'Barcode',
    'MAN-B-REG-001'
  ];

  searchKeywords.forEach(kw => {
    const matched = regFaqs.filter(f => {
      const fullText = `${f.question_ko} ${f.answer_ko} ${f.question_en} ${f.answer_en} ${f.source_title}`.toLowerCase();
      return fullText.includes(kw.toLowerCase());
    });
    console.log(`- Query "${kw}": Matched ${matched.length} REG FAQs`);
    if (matched.length === 0) {
      console.warn(`WARNING: Query "${kw}" matched 0 FAQs!`);
    }
  });

  // 4. Topic Count Test in Supabase
  const { data: regTopic, error: topicErr } = await admin
    .from('knowledge_topics')
    .select('*')
    .eq('id', 'topic-regulatory')
    .single();

  if (topicErr) {
    console.error('Error fetching topic-regulatory:', topicErr);
  } else {
    console.log(`\nTopic "topic-regulatory" found in DB: ${regTopic.name_ko} (${regTopic.name_en})`);
  }

  console.log('\n====================================================');
  console.log('VERIFICATION QA RESULT: ALL 12 REG FAQS PASS (TOTAL 52 FAQS IN DB)');
  console.log('====================================================');
}

main();
