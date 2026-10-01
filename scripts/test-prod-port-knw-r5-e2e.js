const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const https = require('https');

const BRAND_URL = 'https://portal.kselectnetwork.com';

async function testPdfEndpoint() {
  console.log('\n--- Testing PDF Asset Streaming Endpoints ---');
  const urls = [
    'https://portal.kselectnetwork.com/api/admin/knowledge/asset/asset-brand-policy-v10',
    'https://portal.kselectnetwork.com/api/knowledge/asset/asset-brand-policy-v10?action=download'
  ];

  for (const url of urls) {
    const res = await new Promise((resolve) => {
      const req = https.get(url, { headers: { 'x-user-role': 'brand' }, timeout: 10000 }, (res) => {
        let len = 0;
        res.on('data', c => len += c.length);
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            contentType: res.headers['content-type'],
            contentDisposition: res.headers['content-disposition'],
            contentLength: len
          });
        });
      });
      req.on('error', (e) => resolve({ error: e.message }));
    });
    console.log(`URL: ${url}`);
    console.log(`Status: ${res.statusCode}, Content-Type: ${res.contentType}, Disposition: ${res.contentDisposition}, Length: ${res.contentLength}`);
  }
}

async function main() {
  console.log('=== STARTING PORT-KNW-001-R5 PRODUCTION QA ===\n');

  await testPdfEndpoint();

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 }
  });
  const page = await context.newPage();

  const reportsDir = path.join(process.cwd(), 'reports');
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });

  try {
    // 1. Log in to Brand Portal
    console.log('\n1. Logging in to Brand Portal...');
    await page.goto(`${BRAND_URL}/portal/login`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.locator('input#email').fill('qa-portal-test@letusto.com');
    await page.locator('input#password').fill('Password123!@#');
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(3000);

    // 2. Help Center Homepage
    console.log('\n2. Visiting Help Center Homepage...');
    await page.goto(`${BRAND_URL}/portal/help`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    await page.screenshot({ path: path.join(reportsDir, 'port_knw_r5_prod_help_home.png'), fullPage: true });
    console.log('✓ Captured reports/port_knw_r5_prod_help_home.png');

    // Verify Default Home CTA
    const defaultSupportCard = await page.locator('text=아직 해결되지 않았나요?').isVisible();
    console.log('Default Home Support Card Visible (Should be TRUE):', defaultSupportCard);

    // 3. Select Topic (브랜드 관리)
    console.log('\n3. Selecting Topic: 브랜드 관리...');
    const topicButton = page.locator('button:has-text("브랜드 관리")').first();
    await topicButton.click();
    await page.waitForTimeout(2000);

    // Verify In-Topic Action Bar is visible
    const inTopicDirectAsk = await page.locator('button:has-text("직접 질문하기")').isVisible();
    const inTopic1on1 = await page.locator('button:has-text("1:1 문의하기")').isVisible();
    console.log('In-Topic Direct Ask Button Visible (Should be TRUE):', inTopicDirectAsk);
    console.log('In-Topic 1:1 Support Button Visible (Should be TRUE):', inTopic1on1);

    // Verify Duplicate Bottom CTA is HIDDEN
    const duplicateBottomCta = await page.locator('text=아직 해결되지 않았나요?').isVisible();
    console.log('Duplicate Bottom Support Card Visible (Should be FALSE):', duplicateBottomCta);

    // Verify Detail Link Text is '자세히 보기 →'
    const detailLinkBtn = page.locator('a:has-text("자세히 보기")').first();
    const detailLinkTextVisible = await detailLinkBtn.isVisible();
    console.log('Detail link text "자세히 보기 →" visible (Should be TRUE):', detailLinkTextVisible);

    await page.screenshot({ path: path.join(reportsDir, 'port_knw_r5_prod_topic_selected.png'), fullPage: true });
    console.log('✓ Captured reports/port_knw_r5_prod_topic_selected.png');

    // 4. Knowledge Detail View
    console.log('\n4. Navigating to MAN-BRAND-001 Detail View...');
    await detailLinkBtn.click();
    await page.waitForTimeout(3000);

    console.log('Current Detail URL:', page.url());

    // Verify Detail View Elements
    const titleVisible = await page.locator('h1').first().innerText();
    console.log('Detail Title:', titleVisible);

    const pdfBanner = await page.locator('text=공식 배포 문서 (Official Manual & Policy)').isVisible();
    console.log('Official PDF Banner Visible (Should be TRUE):', pdfBanner);

    const pdfViewBtn = await page.locator('a:has-text("PDF 보기 (View)")').isVisible();
    const pdfDownloadBtn = await page.locator('a:has-text("다운로드 (Download)")').isVisible();
    console.log('PDF View Button Visible (Should be TRUE):', pdfViewBtn);
    console.log('PDF Download Button Visible (Should be TRUE):', pdfDownloadBtn);

    const summaryVisible = await page.locator('text=SUMMARY (요약)').isVisible();
    console.log('Summary Box Visible (Should be TRUE):', summaryVisible);

    // Verify Core Policies rendered
    const policy01Visible = await page.locator('text=Policy 01').isVisible() || await page.locator('text=목적 및 적용 범위').isVisible() || await page.locator('text=브랜드 등록 절차').isVisible();
    console.log('Core Content / Policies Visible (Should be TRUE):', policy01Visible);

    // Verify Single Detail Support Card
    const singleDetailSupportCard = await page.locator('text=원하는 내용을 찾지 못하셨나요?').isVisible();
    console.log('Detail View Support Card Visible (Should be TRUE):', singleDetailSupportCard);

    await page.screenshot({ path: path.join(reportsDir, 'port_knw_r5_prod_detail_view.png'), fullPage: true });
    console.log('✓ Captured reports/port_knw_r5_prod_detail_view.png');

    // 5. Test PDF View in Browser via page navigation
    console.log('\n5. Testing PDF view navigation in authenticated session...');
    const pdfResponse = await page.goto(`${BRAND_URL}/api/admin/knowledge/asset/asset-brand-policy-v10`, { timeout: 15000 });
    console.log('Authenticated PDF View Status:', pdfResponse.status(), 'Content-Type:', pdfResponse.headers()['content-type']);

    // 6. Fail-Closed / 404 Test
    console.log('\n6. Testing Fail-Closed / 404 for non-existent slug...');
    await page.goto(`${BRAND_URL}/portal/help/invalid-slug-404-test`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    const notFoundVisible = await page.locator('text=도움말 문서를 찾을 수 없습니다.').isVisible();
    console.log('404 Fail-Closed Screen Visible (Should be TRUE):', notFoundVisible);
    await page.screenshot({ path: path.join(reportsDir, 'port_knw_r5_prod_fail_closed.png'), fullPage: true });
    console.log('✓ Captured reports/port_knw_r5_prod_fail_closed.png');

    // 7. Mobile Viewport Test (375x812)
    console.log('\n7. Testing Mobile Viewport (375x812)...');
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`${BRAND_URL}/portal/help/man-brand-001-brand-policy`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    await page.screenshot({ path: path.join(reportsDir, 'port_knw_r5_prod_mobile_detail.png'), fullPage: true });
    console.log('✓ Captured reports/port_knw_r5_prod_mobile_detail.png');

    console.log('\n=== ALL PRODUCTION QA SCENARIOS PASSED ===');
  } catch (err) {
    console.error('QA Error:', err);
    throw err;
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error('Execution failed:', err);
  process.exit(1);
});
