const fs = require('fs');
const path = require('path');
const { getStoreKnowledgeItems, getStoreAssetById } = require('../lib/knowledge/store');
const { processAskQuestion } = require('../lib/knowledge/ask-engine');
const { isEligibleForAudience } = require('../lib/knowledge/distribution');
const { matchTopicForKnowledge, CANONICAL_BRAND_TOPICS } = require('../lib/knowledge/topics');

async function main() {
  console.log('=== TEST 1: Knowledge Store Integrity ===');
  const allItems = await getStoreKnowledgeItems();
  console.log(`Total Knowledge Items: ${allItems.length}`);
  
  const onbItem = allItems.find(i => i.id === 'kno-onboarding-guide-v10');
  if (!onbItem) {
    throw new Error('FAILED: kno-onboarding-guide-v10 not found in store!');
  }
  console.log('Found Onboarding Knowledge Item:');
  console.log(`- ID: ${onbItem.id}`);
  console.log(`- Title: ${onbItem.title}`);
  console.log(`- Status: ${onbItem.status}`);
  console.log(`- Audience: ${JSON.stringify(onbItem.audience)}`);
  console.log(`- Document URL: ${onbItem.document_url}`);
  console.log(`- Document Name: ${onbItem.document_name}`);

  console.log('\n=== TEST 2: Asset Record & Physical File Verification ===');
  const asset = await getStoreAssetById('asset-onboarding-guide-v10');
  if (!asset) {
    throw new Error('FAILED: asset-onboarding-guide-v10 not found in store!');
  }
  console.log('Asset record found:', asset);
  
  const privateAssetPath = path.join(process.cwd(), 'private_assets', 'manuals', asset.file_name);
  if (!fs.existsSync(privateAssetPath)) {
    throw new Error(`FAILED: Private asset file does not exist at ${privateAssetPath}`);
  }
  const assetStats = fs.statSync(privateAssetPath);
  console.log(`Private asset file verified: ${privateAssetPath} (${assetStats.size} bytes)`);

  const publishedPath = path.join(process.cwd(), 'Manuals', 'MAN-B-ONB-001_Onboarding', '03_PUBLISHED', 'MAN-B-ONB-001_Onboarding_Guide_v1.0.pdf');
  if (!fs.existsSync(publishedPath)) {
    throw new Error(`FAILED: Published manual file does not exist at ${publishedPath}`);
  }
  console.log(`Published manual file verified: ${publishedPath}`);

  console.log('\n=== TEST 3: Topic Mapping Verification ===');
  const matchedTopic = matchTopicForKnowledge(onbItem, CANONICAL_BRAND_TOPICS);
  console.log(`Matched Primary Topic for MAN-B-ONB-001: [${matchedTopic.id}] "${matchedTopic.title_ko}"`);
  if (matchedTopic.id !== 'topic-start') {
    throw new Error(`FAILED: Expected topic-start, got ${matchedTopic.id}`);
  }

  console.log('\n=== TEST 4: Audience Isolation Verification ===');
  const isBrandEligible = isEligibleForAudience(onbItem, 'BRAND');
  const isInternalEligible = isEligibleForAudience(onbItem, 'INTERNAL');
  const isRetailerEligible = isEligibleForAudience(onbItem, 'RETAILER');
  
  console.log(`- BRAND Audience Eligible: ${isBrandEligible} (Expected: true)`);
  console.log(`- INTERNAL Audience Eligible: ${isInternalEligible} (Expected: true)`);
  console.log(`- RETAILER Audience Eligible: ${isRetailerEligible} (Expected: false)`);

  if (!isBrandEligible || !isInternalEligible || isRetailerEligible) {
    throw new Error('FAILED: Audience isolation logic violated!');
  }

  console.log('\n=== TEST 5: Ask K SELECT Grounded Matching Test ===');
  const testQuestions = [
    '처음 가입했는데 무엇부터 해야 하나요?',
    '온보딩은 어떻게 진행하나요?',
    '회사 정보는 어디에서 입력하나요?',
    '관리자 영문 이름은 어떻게 등록하나요?',
    '팀원 초대는 필수인가요?',
    '담당 업무는 어떻게 지정하나요?',
    '상품을 몇 개 등록해야 하나요?',
    '계약은 언제 체결하나요?',
    '온보딩 완료 조건은 무엇인가요?'
  ];

  for (const q of testQuestions) {
    console.log(`\n--- Question: "${q}" ---`);
    const res = await processAskQuestion({
      question: q,
      audience: 'BRAND',
      userContext: { userId: 'test-brand-user', role: 'brand' },
      currentRoute: '/portal/help'
    });

    console.log(`Direct Answer: ${res.directAnswer.substring(0, 100)}...`);
    console.log(`Sources Count: ${res.sources.length} | Top Source: ${res.sources[0]?.title} (${res.sources[0]?.id})`);
    console.log(`Actions Count: ${res.actions.length} | Primary Action: ${res.actions[0]?.label} (${res.actions[0]?.url})`);
    console.log(`Related Manuals (PDF): ${res.relatedManuals?.length || 0} (${res.relatedManuals?.[0]?.title})`);
    console.log(`Is Unknown Fallback: ${res.isUnknown}`);

    if (res.isUnknown) {
      throw new Error(`FAILED: Question "${q}" produced unknown fallback!`);
    }
    if (res.sources[0]?.id !== 'kno-onboarding-guide-v10') {
      throw new Error(`FAILED: Question "${q}" cited wrong source: ${res.sources[0]?.id}`);
    }
  }

  console.log('\n=== TEST 6: Regression Check on MAN-B-BRAND-001 ===');
  const brandRes = await processAskQuestion({
    question: '상표권 없어도 브랜드 등록이 가능한가요?',
    audience: 'BRAND',
    userContext: { userId: 'test-brand-user', role: 'brand' },
    currentRoute: '/portal/help'
  });
  console.log(`Brand Question Top Source: ${brandRes.sources[0]?.title} (${brandRes.sources[0]?.id})`);
  if (brandRes.sources[0]?.id !== 'kno-brand-policy-v10') {
    throw new Error('FAILED: Brand Policy regression detected!');
  }

  console.log('\n=== ALL INTEGRATION TESTS PASSED PERFECTLY ===');
}

main().catch(err => {
  console.error('Test Execution Error:', err);
  process.exit(1);
});
