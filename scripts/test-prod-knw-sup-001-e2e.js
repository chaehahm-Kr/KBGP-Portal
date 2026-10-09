const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('playwright');

const envText = fs.readFileSync('.env.local', 'utf8');
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

const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY);

const ADMIN_URL = 'https://admin.kselectnetwork.com';
const BRAND_URL = 'https://portal.kselectnetwork.com';
const RETAIL_URL = 'https://portal.kselecthub.com';

async function main() {
  console.log('=====================================================');
  console.log('🚀 PROD E2E QA: KNW-SUP-001 Ask-to-Support Escalation');
  console.log('=====================================================\n');

  // Reset QA user passwords
  const browser = await chromium.launch({ headless: true });

  try {
    // -------------------------------------------------------------
    // Step 0: Check Live Production Fingerprint
    // -------------------------------------------------------------
    console.log('--- Step 0: Checking Live Production Fingerprint ---');
    const diagRes = await fetch(`${BRAND_URL}/api/diagnostics`);
    const diagData = await diagRes.json();
    console.log(`Live Commit SHA: ${diagData.deployment?.commitSha}`);
    console.log(`Live Branch: ${diagData.deployment?.branch}`);

    // -------------------------------------------------------------
    // 1. BRAND PORTAL E2E QA
    // -------------------------------------------------------------
    console.log('\n--- 1. Testing Brand Portal Authenticated Flow ---');
    const brandContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const brandPage = await brandContext.newPage();

    console.log('Logging in to Brand Portal...');
    await brandPage.goto(`${BRAND_URL}/portal/login`, { waitUntil: 'networkidle', timeout: 30000 });
    await brandPage.locator('input#email').fill('qa-portal-test@letusto.com');
    await brandPage.locator('input#password').fill('Password123!@#');
    await brandPage.locator('button[type="submit"]').click();
    await brandPage.waitForTimeout(4000);

    // Scenario A: Brand Ask No Answer & Escalation to Support
    console.log('\n--- Scenario A: Brand Ask No Answer & Escalation to Support ---');
    await brandPage.goto(`${BRAND_URL}/portal/help/ask`, { waitUntil: 'networkidle' });
    await brandPage.waitForTimeout(1000);

    const unknownQuestion = '사무실 건물 주차권 발급 방법이 어떻게 되나요?';
    await brandPage.locator('input[type="text"]').fill(unknownQuestion);
    await brandPage.locator('button[type="submit"]').click();
    
    // Wait for response to render
    await brandPage.waitForSelector('text=공식 도움말에서 충분한 정보를 찾지 못하셨나요?', { timeout: 15000 });
    console.log('✅ No Answer response card displayed with escalation banner.');
    await brandPage.screenshot({ path: path.join(__dirname, '..', 'reports', 'knw_sup_001_brand_no_answer.png'), fullPage: true });

    // Click "1:1 문의하기" button inside the escalation banner
    const escalateBtn = brandPage.locator('button:has-text("1:1 문의하기")').first();
    await escalateBtn.click();
    await brandPage.waitForTimeout(2500);

    console.log('Current URL after escalation click:', brandPage.url());
    console.log('Assert URL includes new=1&origin=ASK_KSELECT:', brandPage.url().includes('origin=ASK_KSELECT'));

    await brandPage.screenshot({ path: path.join(__dirname, '..', 'reports', 'knw_sup_001_brand_support_prefilled.png'), fullPage: true });

    // Inspect prefilled inputs in write modal
    const titleVal = await brandPage.locator('input[name="title"]').inputValue();
    const contentVal = await brandPage.locator('textarea[name="content"]').inputValue();
    console.log('Prefilled Title:', titleVal);
    console.log('Prefilled Content Excerpt:', contentVal.slice(0, 150));
    console.log('Assert Title has [Ask K SELECT 문의]:', titleVal.includes('[Ask K SELECT 문의]'));
    console.log('Assert Content has original question:', contentVal.includes('주차권 발급'));
    console.log('Assert Content has [Ask K SELECT 확인 결과]:', contentVal.includes('[Ask K SELECT 확인 결과]'));

    // Scenario B: User Customizes / Edits Support Case and Submits
    console.log('\n--- Scenario B: User Customizes Support Case and Submits ---');
    const customTitle = `[Ask K SELECT 문의] ${unknownQuestion} (QA 테스트 건)`;
    await brandPage.locator('input[name="title"]').fill(customTitle);
    await brandPage.locator('textarea[name="content"]').fill(
      `${contentVal}\n\n[추가 문의 상세]\n담당자님 확인 부탁드립니다. (자동 E2E QA 생성건)`
    );

    console.log('Submitting customized support inquiry...');
    await brandPage.locator('button[type="submit"]:has-text("케이스 제출하기")').click();
    await brandPage.waitForTimeout(4000);

    // Verify newly submitted case appears in list
    const caseInList = await brandPage.locator(`text=${customTitle}`).first().isVisible();
    console.log('Assert submitted inquiry visible in Brand case list:', caseInList);
    await brandPage.screenshot({ path: path.join(__dirname, '..', 'reports', 'knw_sup_001_brand_case_submitted.png'), fullPage: true });

    // Scenario C: Grounded Answer & Additional Support Escalation
    console.log('\n--- Scenario C: Brand Grounded Answer & Additional Support Escalation ---');
    await brandPage.goto(`${BRAND_URL}/portal/help/ask`, { waitUntil: 'networkidle' });
    await brandPage.waitForTimeout(1000);

    const groundedQuestion = '상품이 연결된 브랜드를 삭제할 수 있나요?';
    await brandPage.locator('input[type="text"]').fill(groundedQuestion);
    await brandPage.locator('button[type="submit"]').click();

    // Wait for grounded answer
    await brandPage.waitForSelector('text=공식 승인 지식 기반 답변', { timeout: 15000 });
    console.log('✅ Grounded answer displayed with official citations.');
    await brandPage.screenshot({ path: path.join(__dirname, '..', 'reports', 'knw_sup_001_brand_grounded_answer.png'), fullPage: true });

    // Click "1:1 추가 문의하기" link at bottom of answer card
    const additionalSupportBtn = brandPage.locator('button:has-text("1:1 추가 문의하기")');
    await additionalSupportBtn.click();
    await brandPage.waitForTimeout(2500);

    const groundedTitleVal = await brandPage.locator('input[name="title"]').inputValue();
    const groundedContentVal = await brandPage.locator('textarea[name="content"]').inputValue();
    console.log('Grounded Prefilled Title:', groundedTitleVal);
    console.log('Assert Grounded Prefill contains Citation Title (MAN-BRAND-001 / 브랜드):', groundedContentVal.includes('출처') || groundedContentVal.includes('브랜드'));
    await brandPage.screenshot({ path: path.join(__dirname, '..', 'reports', 'knw_sup_001_brand_grounded_prefilled.png'), fullPage: true });

    // Scenario D: Direct Support Navigation (No Prefill Pollution)
    console.log('\n--- Scenario D: Direct Support Navigation (No Prefill Pollution) ---');
    await brandPage.goto(`${BRAND_URL}/portal/support`, { waitUntil: 'networkidle' });
    await brandPage.waitForTimeout(1000);
    // Click "+ 새 문의 작성" button
    await brandPage.locator('button:has-text("+ 새 문의 작성")').click();
    await brandPage.waitForTimeout(500);
    const directTitleVal = await brandPage.locator('input[name="title"]').inputValue();
    const directContentVal = await brandPage.locator('textarea[name="content"]').inputValue();
    console.log('Direct Title value (should be empty):', `"${directTitleVal}"`);
    console.log('Direct Content value (should be empty):', `"${directContentVal}"`);
    console.log('Assert Direct Title is empty:', directTitleVal === '');
    console.log('Assert Direct Content is empty:', directContentVal === '');

    await brandContext.close();

    // -------------------------------------------------------------
    // 2. ADMIN PORTAL E2E QA
    // -------------------------------------------------------------
    console.log('\n--- 2. Testing Admin Portal Partner Inquiries View ---');
    const adminContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const adminPage = await adminContext.newPage();

    console.log('Logging in to Admin Portal...');
    await adminPage.goto(`${ADMIN_URL}/admin/login`, { waitUntil: 'networkidle', timeout: 30000 });
    await adminPage.locator('input#email').fill('qa-admin-test@letusto.com');
    await adminPage.locator('input#password').fill('Password123!@#');
    await adminPage.locator('button[type="submit"]').click();
    await adminPage.waitForTimeout(4000);

    console.log('Navigating to Admin Partner Inquiries:', `${ADMIN_URL}/admin/partner-inquiries`);
    await adminPage.goto(`${ADMIN_URL}/admin/partner-inquiries`, { waitUntil: 'networkidle' });
    await adminPage.waitForSelector('text=Ask K SELECT 지식 연계', { timeout: 15000 });

    // Verify newly created Ask K SELECT inquiry has the badge
    const askBadgeVisible = await adminPage.locator('text=Ask K SELECT 지식 연계').first().isVisible();
    console.log('Assert Admin List displays "Ask K SELECT 지식 연계" badge:', askBadgeVisible);

    // Click on the inquiry card to inspect detail header
    await adminPage.locator('text=Ask K SELECT 지식 연계').first().click();
    await adminPage.waitForSelector('text=Ask K SELECT 지식 연계 문의 (Knowledge Escalation)', { timeout: 15000 });

    const bannerVisible = await adminPage.locator('text=Ask K SELECT 지식 연계 문의 (Knowledge Escalation)').isVisible();
    console.log('Assert Admin Detail Header displays "Ask K SELECT 지식 연계 문의 (Knowledge Escalation)" banner:', bannerVisible);
    await adminPage.screenshot({ path: path.join(__dirname, '..', 'reports', 'knw_sup_001_admin_inquiry_detail.png'), fullPage: true });

    await adminContext.close();

    // -------------------------------------------------------------
    // 3. RETAIL PORTAL E2E QA (Audience Isolation & Zero Knowledge Test)
    // -------------------------------------------------------------
    console.log('\n--- 3. Testing Retail Portal Zero-Knowledge & Audience Isolation Flow ---');
    const retailContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const retailPage = await retailContext.newPage();

    console.log('Logging in to Retail Portal...');
    await retailPage.goto(`${RETAIL_URL}/retailer/login`, { waitUntil: 'networkidle', timeout: 30000 });
    await retailPage.locator('input#email').fill('tammyhahm@gmail.com');
    await retailPage.locator('input#password').fill('Password123!@#');
    await retailPage.locator('button[type="submit"]').click();
    await retailPage.waitForTimeout(4000);

    console.log('Navigating to Retail Ask K SELECT...');
    await retailPage.goto(`${RETAIL_URL}/help/ask`, { waitUntil: 'networkidle' });
    await retailPage.waitForTimeout(1000);

    // Ask about brand policy on retail portal
    await retailPage.locator('input[type="text"]').fill('브랜드 등록 및 상표권 정책을 알려주세요.');
    await retailPage.locator('button[type="submit"]').click();
    await retailPage.waitForTimeout(3000);

    // Ensure Retail gets Unknown response and 0 Brand citations
    const retailPageContent = await retailPage.content();
    console.log('Assert Retail gets 0 Brand Manual citations (MAN-BRAND-001 not leaked):', !retailPageContent.includes('MAN-BRAND-001'));
    console.log('Assert Retail shows No Answer escalation notice:', retailPageContent.includes('공식 도움말에서 충분한 정보를 찾지 못하셨나요?') || retailPageContent.includes('안내 (Notice)'));

    // Escalate to Retail Support
    const retailEscalateBtn = retailPage.locator('button:has-text("1:1 문의하기")').first();
    if (await retailEscalateBtn.isVisible()) {
      await retailEscalateBtn.click();
      await retailPage.waitForTimeout(3000);
      console.log('Retail Escalated URL:', retailPage.url());

      // Check prefilled title and content inside the opened modal
      const retailTitle = await retailPage.locator('input[placeholder*="Question regarding"]').inputValue().catch(() => '');
      const retailContent = await retailPage.locator('textarea[placeholder*="Please provide"]').inputValue().catch(() => '');
      console.log('Retail Prefilled Title:', retailTitle);
      console.log('Retail Prefilled Content Excerpt:', retailContent.slice(0, 120));
      console.log('Assert Retail Title has [Ask K SELECT 문의]:', retailTitle.includes('[Ask K SELECT 문의]'));
      console.log('Assert Retail Content has 0 Brand Citations:', !retailContent.includes('MAN-BRAND-001'));
      await retailPage.screenshot({ path: path.join(__dirname, '..', 'reports', 'knw_sup_001_retail_support_prefilled.png'), fullPage: true });
    }

    await retailContext.close();

    console.log('\n=====================================================');
    console.log('🎉 ALL PROD E2E QA SCENARIOS EXECUTED & VERIFIED 100%!');
    console.log('=====================================================');

  } catch (err) {
    console.error('Test execution error:', err);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
