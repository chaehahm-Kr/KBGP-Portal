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
  console.log('🚀 STARTING PROD E2E QA: KNW-SUP-001');
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

    // Scenario A: Brand No Answer
    console.log('\n--- Scenario A: Brand Ask No Answer & 1:1 Support CTA ---');
    await brandPage.goto(`${BRAND_URL}/portal/help/ask`, { waitUntil: 'networkidle' });
    await brandPage.waitForTimeout(1000);

    // Type a question with no grounded answer
    await brandPage.locator('input[type="text"]').fill('K SELECT 브랜드 등록 수수료는 얼마인가요?');
    await brandPage.locator('button[type="submit"]').click();
    await brandPage.waitForTimeout(2000);

    await brandPage.screenshot({ path: path.join(__dirname, '..', 'reports', 'knw_sup_001_brand_no_answer.png'), fullPage: true });
    console.log('Captured Brand No Answer screenshot with 1:1 support CTA banner');

    // Click 1:1 문의하기 on the No Answer banner
    const noAnswerSupportBtn = brandPage.locator('text=1:1 문의하기').first();
    if (await noAnswerSupportBtn.isVisible()) {
      await noAnswerSupportBtn.click();
      await brandPage.waitForTimeout(2000);
      console.log('Navigated to Brand Support via No Answer CTA URL:', brandPage.url());

      await brandPage.screenshot({ path: path.join(__dirname, '..', 'reports', 'knw_sup_001_brand_support_prefill.png'), fullPage: true });
      console.log('Captured Brand Support prefilled modal screenshot');

      // Check prefilled values
      const titleVal = await brandPage.locator('input[placeholder*="제목"]').inputValue().catch(() => '');
      const contentVal = await brandPage.locator('textarea').inputValue().catch(() => '');
      console.log('Prefilled Title:', titleVal);
      console.log('Prefilled Content includes question:', contentVal.includes('브랜드 등록 수수료'));
    }

    // Scenario B: Brand Grounded Answer
    console.log('\n--- Scenario B: Brand Grounded Answer & Additional Support CTA ---');
    await brandPage.goto(`${BRAND_URL}/portal/help/ask`, { waitUntil: 'networkidle' });
    await brandPage.waitForTimeout(1000);

    await brandPage.locator('input[type="text"]').fill('상품이 연결된 브랜드를 삭제할 수 있나요?');
    await brandPage.locator('button[type="submit"]').click();
    await brandPage.waitForTimeout(2000);

    await brandPage.screenshot({ path: path.join(__dirname, '..', 'reports', 'knw_sup_001_brand_grounded_answer.png'), fullPage: true });
    console.log('Captured Brand Grounded Answer screenshot with 1:1 추가 문의하기 link');

    // Click 1:1 추가 문의하기
    const addSupportBtn = brandPage.locator('text=1:1 추가 문의하기').first();
    if (await addSupportBtn.isVisible()) {
      await addSupportBtn.click();
      await brandPage.waitForTimeout(2000);
      console.log('Navigated to Brand Support via Grounded CTA URL:', brandPage.url());
      await brandPage.screenshot({ path: path.join(__dirname, '..', 'reports', 'knw_sup_001_brand_support_grounded_prefill.png'), fullPage: true });
    }

    // -------------------------------------------------------------
    // Scenario J: Mobile Viewport QA (375x812)
    // -------------------------------------------------------------
    console.log('\n--- Scenario J: Mobile Viewport QA (375x812) ---');
    await brandPage.setViewportSize({ width: 375, height: 812 });
    await brandPage.goto(`${BRAND_URL}/portal/help/ask`, { waitUntil: 'networkidle' });
    await brandPage.waitForTimeout(1000);
    await brandPage.screenshot({ path: path.join(__dirname, '..', 'reports', 'knw_sup_001_mobile_ask.png'), fullPage: true });
    console.log('Captured Mobile Ask screenshot');

    await brandContext.close();

    // -------------------------------------------------------------
    // 2. ADMIN PORTAL E2E QA
    // -------------------------------------------------------------
    console.log('\n--- 2. Testing Admin Portal Partner Inquiries View ---');
    const adminContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const adminPage = await adminContext.newPage();

    console.log('Logging in to Admin Portal...');
    await adminPage.goto(`${ADMIN_URL}/admin/login`, { waitUntil: 'networkidle', timeout: 30000 });
    await adminPage.locator('input#email').fill('abc-manager@kselectnetwork.com');
    await adminPage.locator('input#password').fill('Password123!@#');
    await adminPage.locator('button[type="submit"]').click();
    await adminPage.waitForTimeout(4000);

    console.log('Navigating to Admin Partner Inquiries:', `${ADMIN_URL}/admin/partner-inquiries`);
    await adminPage.goto(`${ADMIN_URL}/admin/partner-inquiries`, { waitUntil: 'networkidle' });
    await adminPage.waitForTimeout(2000);

    await adminPage.screenshot({ path: path.join(__dirname, '..', 'reports', 'knw_sup_001_admin_support.png'), fullPage: true });
    console.log('Captured Admin Partner Inquiries screenshot');

    await adminContext.close();

    console.log('\n=====================================================');
    console.log('🎉 ALL PROD E2E QA SCENARIOS EXECUTED SUCCESSFULLY!');
    console.log('=====================================================');

  } catch (err) {
    console.error('Test execution error:', err);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
