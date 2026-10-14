const { chromium } = require('playwright');

const ADMIN_URL = 'https://admin.kselectnetwork.com';

(async () => {
  console.log('=== STARTING PRODUCTION BROWSER QA: Order Processing R1 ===');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.on('console', msg => console.log(`[BROWSER CONSOLE ${msg.type()}]:`, msg.text()));
  page.on('pageerror', err => console.log('[BROWSER UNCAUGHT ERROR]:', err.message));

  try {
    // 1. Login to Admin
    console.log('[1/8] Logging in to Admin...');
    await page.goto(`${ADMIN_URL}/admin/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('input#email, input[type="email"]', { timeout: 15000 });
    await page.locator('input#email, input[type="email"]').fill('qa-admin-test@letusto.com');
    await page.locator('input#password, input[type="password"]').fill('Password123!@#');
    await page.locator('button[type="submit"]').click();
    await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 });
    console.log('Logged in. Current URL:', page.url());

    // 2. Navigate to Order Processing
    console.log('[2/8] Navigating to /admin/sales/orders...');
    await page.goto(`${ADMIN_URL}/admin/sales/orders`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    // Verify Title
    const titleText = await page.locator('h1').innerText();
    console.log('Page Header:', titleText);

    // 3. Test Date Filters: Always Visible & Presets
    console.log('[3/8] Testing Date Filters (Always Visible + Presets)...');
    const fromInput = page.locator('input[type="date"]').first();
    const toInput = page.locator('input[type="date"]').nth(1);

    const isFromVisible = await fromInput.isVisible();
    const isToVisible = await toInput.isVisible();
    console.log(`From Date Input Visible: ${isFromVisible}, To Date Input Visible: ${isToVisible}`);
    if (!isFromVisible || !isToVisible) throw new Error('From/To Date Inputs must be always visible');

    // Test "Today" Preset
    const todayBtn = page.locator('button:has-text("Today")').first();
    await todayBtn.click();
    await page.waitForTimeout(1000);
    const fromTodayVal = await fromInput.inputValue();
    const toTodayVal = await toInput.inputValue();
    console.log(`Today Preset populated From: ${fromTodayVal}, To: ${toTodayVal}`);
    if (!fromTodayVal || !toTodayVal || fromTodayVal !== toTodayVal) {
      throw new Error('Today preset did not populate matching From/To values');
    }

    // Test "7 Days" Preset
    const sevenDaysBtn = page.locator('button:has-text("7 Days")').first();
    await sevenDaysBtn.click();
    await page.waitForTimeout(1000);
    const from7Val = await fromInput.inputValue();
    const to7Val = await toInput.inputValue();
    console.log(`7 Days Preset populated From: ${from7Val}, To: ${to7Val}`);
    if (!from7Val || !to7Val) throw new Error('7 Days preset did not populate date values');

    // Test "All" Date Preset
    const allDateBtn = page.locator('div:has(> span:has-text("Date:")) button', { hasText: /^All$/ }).first();
    await allDateBtn.click();
    await page.waitForTimeout(500);
    const fromClearedVal = await fromInput.inputValue();
    const toClearedVal = await toInput.inputValue();
    console.log(`All Preset cleared From: "${fromClearedVal}", To: "${toClearedVal}"`);

    // 4. Test Status Multi-Select Chips
    console.log('[4/8] Testing Status Multi-Select Chips...');
    const allStatusesBtn = page.locator('button:has-text("All Statuses")');
    const submittedBtn = page.locator('button:has-text("Submitted")');
    const processingBtn = page.locator('button:has-text("Processing")');
    const shippedBtn = page.locator('button:has-text("Shipped")');

    if ((await allStatusesBtn.count()) === 0) throw new Error('All Statuses chip not found');
    if ((await submittedBtn.count()) === 0) throw new Error('Submitted chip not found');

    // Click "Submitted"
    await submittedBtn.click();
    await page.waitForTimeout(1500);
    console.log('Clicked Submitted. URL:', page.url());
    if (!page.url().includes('status=submitted')) throw new Error('URL does not include status=submitted');

    // Click "Processing" to multi-select
    await processingBtn.click();
    await page.waitForTimeout(1500);
    console.log('Clicked Processing. URL:', page.url());
    if (!page.url().includes('submitted') || !page.url().includes('processing')) {
      throw new Error('URL does not include both submitted and processing');
    }

    // Reset to All Statuses
    await allStatusesBtn.click();
    await page.waitForTimeout(1500);
    console.log('Reset to All Statuses. URL:', page.url());

    // 5. Test Days Open Column
    console.log('[5/8] Testing Days Open Column...');
    const daysOpenHeader = page.locator('th:has-text("Days Open")');
    if ((await daysOpenHeader.count()) === 0) throw new Error('Days Open column header not found');

    // Verify sort click on Days Open
    await daysOpenHeader.click();
    await page.waitForTimeout(1500);
    console.log('Clicked Days Open sort. URL:', page.url());
    if (!page.url().includes('sortBy=days_open')) throw new Error('URL does not include sortBy=days_open');

    // 6. Test Tracking & Cartons Direct Actions & Dispatch Evaluation
    console.log('[6/8] Testing Tracking & Cartons Actions...');
    const tableBody = await page.innerText('table');

    // Check KSR-2026-000002 has "— Not Shipped"
    const hasNotShipped = tableBody.includes('— Not Shipped');
    console.log('Found "— Not Shipped" for unconfirmed dispatch:', hasNotShipped);
    if (!hasNotShipped) throw new Error('Expected "— Not Shipped" for KSR-2026-000002');

    // Check KSR-2026-000023 has "⚠️ 1 Dispatch Missing Track" and "+ Add Track"
    const hasMissingTrackWarning = tableBody.includes('Missing Track');
    const addTrackBtn = page.locator('button:has-text("+ Add Track")').first();
    const hasAddTrackBtn = (await addTrackBtn.count()) > 0;
    console.log('Found Missing Track Warning:', hasMissingTrackWarning);
    console.log('Found "+ Add Track" button in Tracking column:', hasAddTrackBtn);

    if (!hasMissingTrackWarning || !hasAddTrackBtn) {
      throw new Error('Expected "+ Add Track" button and missing track warning in Tracking column');
    }

    // Test Clicking "+ Add Track" opens in-place EditTrackingModal
    console.log('Clicking "+ Add Track" to verify modal opening...');
    await addTrackBtn.click();
    await page.waitForTimeout(1000);

    const modalTitle = page.locator('h2:has-text("Edit Shipment Tracking & Packages")').first();
    const isModalVisible = await modalTitle.isVisible();
    console.log('Edit Tracking Modal opened in-place:', isModalVisible);
    if (!isModalVisible) throw new Error('EditTrackingModal failed to open');

    // Close Modal
    const cancelModalBtn = page.locator('.fixed.inset-0 button:has-text("Cancel")').first();
    await cancelModalBtn.click();
    await page.waitForTimeout(500);
    console.log('Closed EditTrackingModal cleanly.');

    // 7. Verify Action Column is Clean (No Add Track in Action column)
    console.log('[7/8] Verifying Rightmost Action Column cleanliness...');
    const actionTh = page.locator('th:has-text("Action")');
    if ((await actionTh.count()) === 0) throw new Error('Action column header not found');

    const actionButtons = await page.locator('tbody tr td:last-child').allInnerTexts();
    const hasAddTrackInActionCol = actionButtons.some(t => t.includes('Add Track'));
    console.log('Action column items sample:', actionButtons.slice(0, 5));
    console.log('Is "Add Track" in Action column?', hasAddTrackInActionCol);
    if (hasAddTrackInActionCol) throw new Error('Action column must NOT contain Add Track button');

    // 8. Test Completed KPI Counter & Filter Synchronization
    console.log('[8/8] Testing Completed KPI Counter & Filter...');
    const completedKpiCard = page.locator('button:has(span:has-text("Completed"))').first();
    const kpiText = await completedKpiCard.innerText();
    console.log('Completed KPI card text:', kpiText.replace(/\n/g, ' '));
    if (!kpiText.includes('6')) throw new Error(`Expected Completed KPI to show 6, got: ${kpiText}`);

    // Click Completed KPI tab
    await completedKpiCard.click();
    console.log('Clicked Completed KPI card. Waiting for filter transition...');

    // Wait for URL to update
    await page.waitForURL((url) => url.searchParams.get('quickFilter') === 'completed', { timeout: 10000 });
    console.log('URL updated to:', page.url());

    // Wait for table to finish updating and display exactly 6 rows
    await page.waitForFunction(() => {
      const rows = document.querySelectorAll('tbody tr');
      const isFiltering = document.body.innerText.includes('Updating queue...');
      return !isFiltering && rows.length === 6;
    }, { timeout: 15000 });

    const filteredRowsCount = await page.locator('tbody tr').count();
    console.log(`Completed filtered rows displayed: ${filteredRowsCount}`);
    if (filteredRowsCount !== 6) throw new Error(`Expected 6 rows in Completed filter, got: ${filteredRowsCount}`);

    // Save QA Screenshot
    await page.screenshot({ path: 'scripts/adm-order-processing-r1-browser-qa.png', fullPage: true });
    console.log('Saved QA Screenshot to scripts/adm-order-processing-r1-browser-qa.png');

    console.log('\n🎉 ALL 8 BROWSER QA TESTS PASSED ON PRODUCTION!');
    await browser.close();
    process.exit(0);
  } catch (err) {
    console.error('Browser QA Error:', err);
    try {
      await page.screenshot({ path: 'scripts/adm-order-processing-r1-error.png', fullPage: true });
    } catch (_) {}
    await browser.close();
    process.exit(1);
  }
})();
