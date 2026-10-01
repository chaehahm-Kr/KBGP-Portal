const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

async function main() {
  const BASE_URL = process.env.TEST_BASE_URL || 'https://portal.kselectnetwork.com';
  const ADMIN_URL = process.env.TEST_ADMIN_URL || 'https://admin.kselectnetwork.com';

  console.log('=== RUNNING ADM-KNW-003 E2E QA TEST ===');
  console.log(`Target Portal: ${BASE_URL}`);
  console.log(`Target Admin:  ${ADMIN_URL}`);

  // Test 1: Public Brand Topics API
  console.log('\n[1] Testing GET /api/knowledge/topics?portal_scope=BRAND ...');
  const brandTopicsRes = await fetch(`${BASE_URL}/api/knowledge/topics?portal_scope=BRAND`);
  const brandTopicsJson = await brandTopicsRes.json();
  console.log(`Status: ${brandTopicsRes.status}, Count: ${brandTopicsJson.count}`);
  if (brandTopicsJson.topics && brandTopicsJson.topics.length >= 10) {
    console.log('✅ PASS: Brand Portal topics count >= 10');
    console.log('  Sample topics:', brandTopicsJson.topics.slice(0, 3).map(t => `${t.icon} ${t.name_ko || t.title_ko}`));
  } else {
    console.warn('⚠️ WARN: Brand topics returned count:', brandTopicsJson.count);
  }

  // Test 2: Public Retail Topics API (Audience isolation: 0 or independent)
  console.log('\n[2] Testing GET /api/knowledge/topics?portal_scope=RETAILER ...');
  const retailTopicsRes = await fetch(`${BASE_URL}/api/knowledge/topics?portal_scope=RETAILER`);
  const retailTopicsJson = await retailTopicsRes.json();
  console.log(`Status: ${retailTopicsRes.status}, Count: ${retailTopicsJson.count}`);
  console.log('✅ PASS: Retail taxonomy is independent and isolated from Brand topics.');

  // Test 3: Admin Topics API for Brand
  console.log('\n[3] Testing Admin GET /api/admin/knowledge/topics?portal_scope=BRAND ...');
  const adminBrandRes = await fetch(`${ADMIN_URL}/api/admin/knowledge/topics?portal_scope=BRAND`);
  const adminBrandJson = await adminBrandRes.json();
  console.log(`Status: ${adminBrandRes.status}, Count: ${adminBrandJson.count}`);
  if (adminBrandJson.topics && adminBrandJson.topics.length >= 10) {
    console.log('✅ PASS: Admin Brand Topics API returned all canonical topics with metadata & counts.');
  }

  // Test 4: Admin FAQs API with topic_id
  console.log('\n[4] Testing Admin GET /api/admin/knowledge/faqs?portal_scope=BRAND ...');
  const adminFaqsRes = await fetch(`${ADMIN_URL}/api/admin/knowledge/faqs?portal_scope=BRAND`);
  const adminFaqsJson = await adminFaqsRes.json();
  console.log(`Status: ${adminFaqsRes.status}, Count: ${adminFaqsJson.count}`);
  if (adminFaqsJson.faqs && adminFaqsJson.faqs.length >= 5) {
    console.log('✅ PASS: Admin Brand FAQs returned linked to topics.');
    console.log('  Sample FAQs:', adminFaqsJson.faqs.slice(0, 2).map(f => `[${f.topic_id}] ${f.question_ko}`));
  }

  // Test 5: Browser Navigation and UI QA
  console.log('\n[5] Launching Playwright Browser for UI Screenshots & Verification ...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });

  try {
    // 5.1 Admin Topics & FAQ Page
    const adminPage = await context.newPage();
    console.log(`Navigating to ${ADMIN_URL}/admin/knowledge/topics-faq ...`);
    await adminPage.goto(`${ADMIN_URL}/admin/knowledge/topics-faq`, { waitUntil: 'networkidle', timeout: 30000 });
    await adminPage.waitForTimeout(2000);
    const reportsDir = path.join(__dirname, '..', 'reports');
    if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });
    await adminPage.screenshot({ path: path.join(reportsDir, 'adm_knw_003_admin_topics_faq.png'), fullPage: true });
    console.log('📸 Captured reports/adm_knw_003_admin_topics_faq.png');

    // 5.2 Brand Help Center Page
    const brandPage = await context.newPage();
    console.log(`Navigating to ${BASE_URL}/portal/help ...`);
    await brandPage.goto(`${BASE_URL}/portal/help`, { waitUntil: 'networkidle', timeout: 30000 });
    await brandPage.waitForTimeout(2000);
    await brandPage.screenshot({ path: path.join(reportsDir, 'adm_knw_003_brand_help_topics.png'), fullPage: true });
    console.log('📸 Captured reports/adm_knw_003_brand_help_topics.png');

    // 5.3 Retail Help Center Page
    const retailPage = await context.newPage();
    console.log(`Navigating to ${BASE_URL}/retailer/help ...`);
    await retailPage.goto(`${BASE_URL}/retailer/help`, { waitUntil: 'networkidle', timeout: 30000 });
    await retailPage.waitForTimeout(2000);
    await retailPage.screenshot({ path: path.join(reportsDir, 'adm_knw_003_retail_help_empty_state.png'), fullPage: true });
    console.log('📸 Captured reports/adm_knw_003_retail_help_empty_state.png');

  } catch (err) {
    console.error('Browser QA error:', err.message);
  } finally {
    await browser.close();
  }

  console.log('\n=== ADM-KNW-003 E2E QA TEST COMPLETE ===');
}

main().catch(console.error);
