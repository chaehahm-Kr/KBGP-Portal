const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const VIEWPORTS = [
  { name: '1366x768', width: 1366, height: 768 },
  { name: '1440x900', width: 1440, height: 900 },
  { name: '1536x864', width: 1536, height: 864 },
  { name: '1920x1080', width: 1920, height: 1080 },
];

const MOBILE_VIEWPORT = { name: '390x844_mobile', width: 390, height: 844 };

async function runQA() {
  console.log('=== RTP-ORDERS-LIST-UX-001 AUTOMATED PRODUCTION BROWSER QA ===\n');

  const browser = await chromium.launch({ headless: true });
  fs.mkdirSync('reports', { recursive: true });

  const BASE_URL = 'https://portal.kselectnetwork.com';

  // 1. Log in once to establish session
  console.log('[1/4] Authenticating as Retailer...');
  const authContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const authPage = await authContext.newPage();
  await authPage.goto(`${BASE_URL}/retailer/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await authPage.fill('input[type="email"], input#email', 'qa-retailer-test@letusto.com');
  await authPage.fill('input[type="password"], input#password', 'Password123!@#');
  await authPage.click('button[type="submit"]');
  await authPage.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 20000 });

  const storageState = await authContext.storageState();
  await authContext.close();
  console.log('✓ Retailer session saved.\n');

  // 2. Test Desktop Viewports
  console.log('[2/4] Testing Desktop Viewports (1366px, 1440px, 1536px, 1920px)...');
  const desktopResults = [];

  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, storageState });
    const page = await context.newPage();

    await page.goto(`${BASE_URL}/retailer/orders`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Verify document overflow
    const docOverflow = await page.evaluate(() => {
      const doc = document.documentElement;
      return {
        clientWidth: doc.clientWidth,
        scrollWidth: doc.scrollWidth,
        hasHorizontalScroll: doc.scrollWidth > doc.clientWidth,
      };
    });

    // Verify table wrapper overflow
    const tableWrapperOverflow = await page.evaluate(() => {
      const wrapper = document.querySelector('.overflow-x-auto');
      if (!wrapper) return { error: 'No table wrapper found' };
      return {
        clientWidth: wrapper.clientWidth,
        scrollWidth: wrapper.scrollWidth,
        hasHorizontalScroll: wrapper.scrollWidth > wrapper.clientWidth,
      };
    });

    // Verify single-line Order #
    const orderNumberWrapping = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('tbody tr td:first-child a'));
      return links.map(el => {
        const text = el.innerText.trim();
        const clientHeight = el.clientHeight;
        // In text-xs (12px), single line line-height is ~16-20px. 2+ lines would be >= 30px
        return { text, clientHeight, isSingleLine: clientHeight < 25 };
      });
    });

    // Verify single-line Destination
    const destinationWrapping = await page.evaluate(() => {
      const dests = Array.from(document.querySelectorAll('tbody tr td:nth-child(3) span.truncate'));
      return dests.map(el => {
        const text = el.innerText.trim();
        const clientHeight = el.clientHeight;
        return { text, clientHeight, isSingleLine: clientHeight < 25 };
      });
    });

    // Verify total visible orders
    const rowsCount = await page.locator('tbody tr').count();

    // Verify Actions column visibility
    const actionsVisible = await page.evaluate(() => {
      const actionLinks = Array.from(document.querySelectorAll('tbody tr td:last-child a'));
      if (actionLinks.length === 0) return false;
      const rect = actionLinks[0].getBoundingClientRect();
      return rect.right <= window.innerWidth && rect.width > 0;
    });

    // Verify Tracking label
    const trackingLabels = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('tbody tr td:nth-child(7) button'));
      return btns.map(b => b.innerText.replace(/\n+/g, ' ').trim());
    });

    // Screenshot
    const screenshotPath = `reports/orders_desktop_${vp.name}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: false });

    const passed = !docOverflow.hasHorizontalScroll &&
                   !tableWrapperOverflow.hasHorizontalScroll &&
                   orderNumberWrapping.every(o => o.isSingleLine) &&
                   destinationWrapping.every(d => d.isSingleLine) &&
                   actionsVisible;

    desktopResults.push({
      viewport: vp.name,
      width: vp.width,
      docOverflow,
      tableWrapperOverflow,
      rowsCount,
      actionsVisible,
      trackingLabels: trackingLabels.slice(0, 3),
      passed,
      screenshot: screenshotPath,
    });

    console.log(`- [${vp.name}] Doc Scroll: ${docOverflow.scrollWidth}px / ${docOverflow.clientWidth}px (HasScroll: ${docOverflow.hasHorizontalScroll})`);
    console.log(`             Table Scroll: ${tableWrapperOverflow.scrollWidth}px / ${tableWrapperOverflow.clientWidth}px (HasScroll: ${tableWrapperOverflow.hasHorizontalScroll})`);
    console.log(`             Rows: ${rowsCount} | Actions Visible: ${actionsVisible} | Single-Line Order#: ${orderNumberWrapping.every(o => o.isSingleLine)}`);
    console.log(`             Tracking: ${JSON.stringify(trackingLabels.slice(0, 2))} | Result: ${passed ? 'PASS ✓' : 'FAIL ✗'}\n`);

    await context.close();
  }

  // 3. Test Interactive Features (Tracking Popover, Search & Filter)
  console.log('[3/4] Testing Interactive Features (Tracking Popover & Search/Filters)...');
  const interactiveContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, storageState });
  const interactivePage = await interactiveContext.newPage();
  await interactivePage.goto(`${BASE_URL}/retailer/orders`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await interactivePage.waitForTimeout(2500);

  // Click Tracking button for KSR-2026-000023
  const targetRow = interactivePage.locator('tr:has-text("KSR-2026-000023")');
  const trackBtn = targetRow.locator('button:has-text("Track")');
  await trackBtn.click();
  await interactivePage.waitForTimeout(500);

  const popover = interactivePage.locator('[aria-label="Tracking Information"]');
  const popoverVisible = await popover.isVisible();
  const popoverText = popoverVisible ? await popover.innerText() : '';
  console.log(`- Popover Visible: ${popoverVisible} | Text: ${popoverText.slice(0, 100).replace(/\n+/g, ' ')}...`);
  await interactivePage.screenshot({ path: 'reports/orders_tracking_popover_open.png' });

  // Close Popover
  await interactivePage.keyboard.press('Escape');
  await interactivePage.waitForTimeout(500);

  // Filter Search test
  await interactivePage.fill('input[placeholder*="Search Order"]', '000023');
  await interactivePage.keyboard.press('Enter');
  await interactivePage.waitForTimeout(2000);
  const filteredCount = await interactivePage.locator('tbody tr').count();
  console.log(`- Filter by "000023": Found ${filteredCount} order(s) (Expected 1)`);

  // Reset Filters
  await interactivePage.click('button:has-text("Reset")');
  await interactivePage.waitForTimeout(2000);
  const resetCount = await interactivePage.locator('tbody tr').count();
  console.log(`- Reset filters: Found ${resetCount} order(s) (Expected 9)`);
  await interactiveContext.close();

  // 4. Test Mobile Usability (390x844)
  console.log('\n[4/4] Testing Mobile Usability (390px)...');
  const mobileContext = await browser.newContext({ viewport: { width: MOBILE_VIEWPORT.width, height: MOBILE_VIEWPORT.height }, storageState });
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto(`${BASE_URL}/retailer/orders`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await mobilePage.waitForTimeout(2500);

  const mobileCardsCount = await mobilePage.locator('.md\\:hidden > div.rounded-2xl').count();
  const mobileDocOverflow = await mobilePage.evaluate(() => {
    const doc = document.documentElement;
    return {
      clientWidth: doc.clientWidth,
      scrollWidth: doc.scrollWidth,
      hasHorizontalScroll: doc.scrollWidth > doc.clientWidth,
    };
  });

  await mobilePage.screenshot({ path: 'reports/orders_mobile_390px.png', fullPage: true });
  console.log(`- Mobile Cards Count: ${mobileCardsCount} (Expected 9)`);
  console.log(`- Mobile Doc Scroll: ${mobileDocOverflow.scrollWidth}px / ${mobileDocOverflow.clientWidth}px (HasScroll: ${mobileDocOverflow.hasHorizontalScroll})`);
  console.log(`- Mobile Usability Result: ${mobileCardsCount === 9 && !mobileDocOverflow.hasHorizontalScroll ? 'PASS ✓' : 'FAIL ✗'}`);

  await mobileContext.close();
  await browser.close();

  const allPassed = desktopResults.every(r => r.passed) && mobileCardsCount === 9 && !mobileDocOverflow.hasHorizontalScroll;
  console.log(`\n=== QA SUITE RESULT: ${allPassed ? 'ALL TESTS PASSED ✓' : 'FAILURES DETECTED ✗'} ===`);
  return allPassed;
}

runQA().catch((err) => {
  console.error('QA script fatal error:', err);
  process.exit(1);
});
