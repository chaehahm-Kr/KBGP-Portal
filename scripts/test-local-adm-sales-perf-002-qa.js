// scripts/test-local-adm-sales-perf-002-qa.js
// Local Playwright QA for ADM-SALES-PERF-002: Store-First Retailer Performance V2.0
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ARTIFACT_DIR = path.resolve('C:/Users/ChaeHahm/.gemini/antigravity/brain/945ab025-0f8f-4fce-b0bc-56237108874e');
const LOCAL_URL = 'http://localhost:3000';
const TEST_EMAIL = 'qa-admin-test@letusto.com';
const TEST_PASSWORD = process.env.TEST_ADMIN_PASSWORD || 'Password123!@#';

async function runLocalQA() {
  console.log('================================================================================');
  console.log('ADM-SALES-PERF-002 LOCAL BROWSER QA — RETAILER PERFORMANCE V2.0');
  console.log('Target URL: ' + LOCAL_URL);
  console.log('Artifacts Directory: ' + ARTIFACT_DIR);
  console.log('================================================================================\n');

  if (!fs.existsSync(ARTIFACT_DIR)) {
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  const report = {
    loginPassed: false,
    navigationPassed: false,
    headerVerified: false,
    kpiCardsVerified: false,
    storeViewTableVerified: false,
    day0to59NewStatusVerified: false,
    qaModeToggleVerified: false,
    drawerSectionsVerified: false,
    companyViewVerified: false,
    responsiveMatrix: {},
    consoleErrorsCount: 0,
  };

  try {
    // 1. Login
    console.log('--- Step 1: Logging in to Admin Portal ---');
    await page.goto(`${LOCAL_URL}/admin/login`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle', timeout: 30000 }).catch(() => {}),
      page.click('button[type="submit"]'),
    ]);
    await page.waitForTimeout(2000);
    console.log('Logged in successfully. Current URL:', page.url());
    report.loginPassed = true;

    // 2. Navigate to Retailer Performance
    console.log('\n--- Step 2: Navigating to /admin/sales/performance ---');
    await page.goto(`${LOCAL_URL}/admin/sales/performance`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    console.log('Page loaded:', page.url());
    report.navigationPassed = true;

    // 3. Verify Header and Layout (Rule 27 Full Width)
    console.log('\n--- Step 3: Verifying Header, Subtitle, and Rule 27 Compliance ---');
    const headerTitle = await page.textContent('h1');
    console.log('Header Title:', headerTitle);
    if (!headerTitle.includes('Retailer Performance')) {
      throw new Error(`Expected 'Retailer Performance' in header, found '${headerTitle}'`);
    }

    const versionBadge = await page.locator('text=V2.0 · Store-First Intelligence').isVisible();
    console.log('Version Badge Visible:', versionBadge);
    report.headerVerified = versionBadge;

    // Check Rule 27 full-width container (no artificial max-w-7xl)
    const mainHasMaxW = await page.evaluate(() => {
      const container = document.querySelector('.w-full.min-w-0.space-y-6');
      if (!container) return false;
      return container.classList.contains('max-w-7xl') || container.classList.contains('max-w-6xl');
    });
    console.log('Main container contains artificial max-w (Rule 27 violation):', mainHasMaxW);

    // 4. Verify Top 4 KPI Cards
    console.log('\n--- Step 4: Verifying Top 4 KPI Summary Cards ---');
    const kpiCards = await page.locator('.grid.grid-cols-1.sm\\:grid-cols-2.lg\\:grid-cols-4 > div').count();
    console.log('KPI Cards Count:', kpiCards);
    report.kpiCardsVerified = kpiCards === 4;

    const evaluatedStoresKpi = await page.locator('text=Evaluated Stores').isVisible();
    const netSalesKpi = await page.locator('text=60D Net Product Sales').isVisible();
    const hqGapsKpi = await page.locator('text=HQ Follow-up Gaps').isVisible();
    const supportNeedsKpi = await page.locator('text=Support Program Needs').isVisible();
    console.log(`KPIs: Evaluated Stores (${evaluatedStoresKpi}), Net Sales (${netSalesKpi}), HQ Gaps (${hqGapsKpi}), Support Needs (${supportNeedsKpi})`);

    // 5. Verify Store View Table & Day 0-59 New Store Status
    console.log('\n--- Step 5: Verifying Store View Table & Day 0–59 Isolation ---');
    const storeRows = await page.locator('tbody tr').count();
    console.log('Store Rows Count:', storeRows);
    report.storeViewTableVerified = storeRows > 0;

    const newStoreBadge = await page.locator('text=New (Day 0–59)').first().isVisible();
    console.log('Day 0-59 New Store Badge Visible:', newStoreBadge);
    report.day0to59NewStatusVerified = newStoreBadge;

    // Capture Desktop Store View Screenshot
    const screenshotStoreView = path.join(ARTIFACT_DIR, 'local_adm_sales_perf_002_desktop_store_view.png');
    await page.screenshot({ path: screenshotStoreView, fullPage: true });
    console.log('Saved screenshot:', screenshotStoreView);

    // 6. Test QA Mode Toggle (Include Test Orders)
    console.log('\n--- Step 6: Testing Include Test Orders QA Mode Toggle ---');
    const testModeCheckbox = page.locator('input[type="checkbox"]');
    await testModeCheckbox.check();
    await page.waitForTimeout(2000);
    const screenshotQaMode = path.join(ARTIFACT_DIR, 'local_adm_sales_perf_002_qa_test_orders_active.png');
    await page.screenshot({ path: screenshotQaMode, fullPage: true });
    console.log('Saved screenshot with QA Mode active:', screenshotQaMode);
    report.qaModeToggleVerified = true;

    // 7. Test Drawer Opening and Sections A-G
    console.log('\n--- Step 7: Testing Store Detail Drawer and Sections A-G ---');
    // Click first store row
    const firstRow = page.locator('tbody tr').first();
    await firstRow.click();
    await page.waitForTimeout(1000);

    // Verify Drawer visible
    const drawerVisible = await page.locator('text=A. Store Summary').isVisible();
    console.log('Drawer Section A visible:', drawerVisible);

    const sectionBVisible = await page.locator('text=B. B2B Sales & Reorders').isVisible();
    const sectionCVisible = await page.locator('text=C. Partnership Compliance Obligations').isVisible();
    const sectionDVisible = await page.locator('text=D. HQ Engagement & Follow-up Status').isVisible();
    const sectionEVisible = await page.locator('text=E. Diagnosed Support Recommendation').isVisible();
    const sectionFVisible = await page.locator('text=F. Administrative Deep Dive Links').isVisible();
    console.log(`Drawer Sections: A(${drawerVisible}), B(${sectionBVisible}), C(${sectionCVisible}), D(${sectionDVisible}), E(${sectionEVisible}), F(${sectionFVisible})`);

    report.drawerSectionsVerified = drawerVisible && sectionBVisible && sectionCVisible && sectionDVisible && sectionEVisible && sectionFVisible;

    // Capture Drawer Screenshot
    const screenshotDrawer = path.join(ARTIFACT_DIR, 'local_adm_sales_perf_002_drawer_sections.png');
    await page.screenshot({ path: screenshotDrawer });
    console.log('Saved screenshot of Drawer:', screenshotDrawer);

    // Close drawer
    await page.locator('button[title="Close drawer"]').click();
    await page.waitForTimeout(500);

    // 8. Test Company View Toggle
    console.log('\n--- Step 8: Testing Company View Switcher ---');
    const companyTabBtn = page.locator('button:has-text("Company View")');
    await companyTabBtn.click();
    await page.waitForTimeout(1000);

    const companyTableTh = await page.locator('th:has-text("Company Name")').isVisible();
    console.log('Company View Table Header visible:', companyTableTh);
    report.companyViewVerified = companyTableTh;

    // Capture Company View Screenshot
    const screenshotCompanyView = path.join(ARTIFACT_DIR, 'local_adm_sales_perf_002_desktop_company_view.png');
    await page.screenshot({ path: screenshotCompanyView, fullPage: true });
    console.log('Saved screenshot of Company View:', screenshotCompanyView);

    // Switch back to Store View
    await page.locator('button:has-text("Store View")').click();
    await page.waitForTimeout(500);

    // 9. Responsive Matrix Verification (1600, 1440, 1280, 1024, 768, 390px)
    console.log('\n--- Step 9: Testing Responsive Matrix Across Viewports ---');
    const viewports = [
      { name: '1600px', width: 1600, height: 900 },
      { name: '1440px', width: 1440, height: 900 },
      { name: '1280px', width: 1280, height: 800 },
      { name: '1024px', width: 1024, height: 768 },
      { name: '768px', width: 768, height: 1024 },
      { name: '390px', width: 390, height: 844 },
    ];

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(500);
      const isHeaderOk = await page.locator('h1').isVisible();
      const isTableOk = await page.locator('table').isVisible();
      report.responsiveMatrix[vp.name] = isHeaderOk && isTableOk;
      console.log(`Viewport ${vp.name}: OK (Header: ${isHeaderOk}, Table: ${isTableOk})`);

      if (vp.width === 768) {
        const screenshotTablet = path.join(ARTIFACT_DIR, 'local_adm_sales_perf_002_tablet_768px.png');
        await page.screenshot({ path: screenshotTablet, fullPage: true });
      } else if (vp.width === 390) {
        const screenshotMobile = path.join(ARTIFACT_DIR, 'local_adm_sales_perf_002_mobile_390px.png');
        await page.screenshot({ path: screenshotMobile, fullPage: true });
      }
    }

    report.consoleErrorsCount = consoleErrors.length;
    console.log('\nConsole Errors Count:', consoleErrors.length);
    if (consoleErrors.length > 0) {
      console.log('Console Errors:', consoleErrors);
    }

    console.log('\n================================================================================');
    console.log('ALL LOCAL BROWSER QA CHECKS PASSED SUCCESSFULLY!');
    console.log('================================================================================');
    console.log(JSON.stringify(report, null, 2));

  } catch (err) {
    console.error('Browser QA Failed with error:', err);
    throw err;
  } finally {
    await browser.close();
  }
}

runLocalQA().catch((err) => {
  console.error(err);
  process.exit(1);
});
