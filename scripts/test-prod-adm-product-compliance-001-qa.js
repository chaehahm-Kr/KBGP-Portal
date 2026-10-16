// scripts/test-prod-adm-product-compliance-001-qa.js
// Production Browser QA Matrix for ADM-PRODUCT-COMPLIANCE-001
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const https = require('https');
const { createClient } = require('@supabase/supabase-js');

let env = {};
if (fs.existsSync('.env.local')) {
  fs.readFileSync('.env.local', 'utf8').split('\n').forEach((l) => {
    const m = l.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (m) env[m[1]] = (m[2] || '').trim().replace(/^['"]|['"]$/g, '');
  });
}

const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY);
const ARTIFACT_DIR = path.resolve('C:/Users/ChaeHahm/.gemini/antigravity/brain/945ab025-0f8f-4fce-b0bc-56237108874e');
const ADMIN_URL = 'https://admin.kselectnetwork.com';
const TEST_EMAIL = 'qa-admin-test@letusto.com';
const TEST_PASSWORD = process.env.TEST_ADMIN_PASSWORD || 'Password123!@#';

// 120-second process timeout
const deadline = setTimeout(() => {
  console.error('[QA FATAL] 120s hard process timeout exceeded, forcing exit');
  process.exit(1);
}, 120000);

function checkDiagnostics(url) {
  return new Promise((resolve) => {
    const req = https.get(url, { timeout: 10000 }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          const j = JSON.parse(data);
          resolve({ ok: true, sha: j.deployment?.commitSha, status: res.statusCode });
        } catch {
          resolve({ ok: false, err: 'parse error', status: res.statusCode });
        }
      });
    });
    req.on('error', (err) => resolve({ ok: false, err: err.message }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, err: 'timeout' });
    });
  });
}

async function waitForDeployment(targetSha) {
  console.log(`Polling ${ADMIN_URL}/api/diagnostics for commit prefix ${targetSha}...`);
  for (let i = 0; i < 30; i++) {
    const diag = await checkDiagnostics(`${ADMIN_URL}/api/diagnostics`);
    console.log(`  [Attempt ${i + 1}] Live SHA: ${diag.sha}`);
    if (diag.sha && diag.sha.startsWith(targetSha)) {
      console.log(`✓ Deployment Ready: ${diag.sha}\n`);
      return diag.sha;
    }
    await new Promise((r) => setTimeout(r, 4000));
  }
  throw new Error(`Timeout waiting for Vercel deployment of ${targetSha}`);
}

async function runQA() {
  console.log('================================================================================');
  console.log('ADM-PRODUCT-COMPLIANCE-001 PRODUCTION BROWSER QA MATRIX');
  console.log('Target: ' + ADMIN_URL);
  console.log('================================================================================\n');

  // Obtain current git commit SHA prefix
  const targetSha = process.env.TARGET_SHA || require('child_process').execSync('git rev-parse HEAD').toString().trim().substring(0, 7);
  console.log(`Target Feature SHA: ${targetSha}`);

  const liveSha = await waitForDeployment(targetSha);

  // Verify Admin QA user credentials
  const { data: users } = await client.auth.admin.listUsers();
  const adminUser = users?.users?.find((u) => u.email === TEST_EMAIL);
  if (adminUser) {
    await client.auth.admin.updateUserById(adminUser.id, { password: TEST_PASSWORD });
    console.log(`✓ QA Admin User verified (${adminUser.email})`);
  }

  const browser = await chromium.launch({ headless: true });
  const results = {};

  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();

    // 1. Diagnostics verification
    results['Diagnostics_Live_SHA_Matches'] = liveSha.startsWith(targetSha);

    // 2. Admin Login
    console.log('\n1. Logging into Admin Portal...');
    await page.goto(`${ADMIN_URL}/admin/login`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.locator('input#email, input[type="email"]').fill(TEST_EMAIL);
    await page.locator('input#password, input[type="password"]').fill(TEST_PASSWORD);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 20000 });
    await page.waitForTimeout(2000);
    results['Admin_Login_Successful'] = true;
    console.log('   ✓ Logged in successfully. Current URL: ' + page.url());

    // 3. Navigate to Compliance via Sidebar
    console.log('\n2. Testing Sidebar Navigation to Compliance...');
    const prodBtn = page.locator('aside button:has-text("Products")').first();
    if (!(await prodBtn.isVisible())) {
      const brandBtn = page.locator('aside button:has-text("K SELECT BRAND")').first();
      await brandBtn.click();
      await page.waitForTimeout(500);
    }

    // Click Products menu item to expand subItems
    await prodBtn.click();
    await page.waitForTimeout(600);

    // Find and click Compliance link
    const complianceLink = page.locator('aside a[href="/admin/products/compliance"]').first();
    const hasComplianceLink = await complianceLink.isVisible();
    results['Sidebar_Has_Compliance_Link'] = hasComplianceLink;
    console.log(`   [Test 1] Sidebar has /admin/products/compliance link: ${hasComplianceLink ? 'PASS' : 'FAIL'}`);

    await complianceLink.click();
    await page.waitForURL((url) => url.pathname === '/admin/products/compliance', { timeout: 15000 });
    await page.waitForTimeout(1500);
    results['Navigates_To_Dedicated_Compliance_Page'] = page.url().includes('/admin/products/compliance');
    console.log(`   [Test 2] Navigated to /admin/products/compliance: PASS`);

    // 4. Verify Page Title & Subtitle
    console.log('\n3. Verifying Page Title, Subtitle & Overview Metrics...');
    const pageTitle = page.locator('h1:has-text("Product Compliance")').first();
    const hasTitle = await pageTitle.isVisible();
    results['Page_Title_Is_Product_Compliance'] = hasTitle;
    console.log(`   [Test 3] Page Title is "Product Compliance": ${hasTitle ? 'PASS' : 'FAIL'}`);

    const subtitle = page.locator('text=US Import & Market Readiness').first();
    const hasSubtitle = await subtitle.isVisible();
    results['Subtitle_Present'] = hasSubtitle;
    console.log(`   [Test 4] Subtitle "US Import & Market Readiness" present: ${hasSubtitle ? 'PASS' : 'FAIL'}`);

    // Verify Overview cards
    const totalProdsCard = page.locator('text=Total Products').first();
    const hasTotalProds = await totalProdsCard.isVisible();
    results['Total_Products_Card_Present'] = hasTotalProds;

    const notYetTrackedBadges = await page.locator('text=Not Yet Tracked').count();
    const hasNotYetTracked = notYetTrackedBadges >= 3;
    results['Review_Metrics_Display_Not_Yet_Tracked'] = hasNotYetTracked;
    console.log(`   [Test 5] Summary review metrics show "Not Yet Tracked": ${hasNotYetTracked ? 'PASS' : 'FAIL'}`);

    // Screenshot Overview and Table
    const overviewScreenshot = path.join(ARTIFACT_DIR, 'prod_adm_compliance_overview_table.png');
    await page.screenshot({ path: overviewScreenshot, fullPage: false });
    console.log(`   ✓ Saved screenshot: ${overviewScreenshot}`);

    // 5. Verify Table Columns & Product Data
    console.log('\n4. Verifying Table Columns & Regulatory Status Display...');
    const tableHeaders = await page.locator('thead th').allTextContents();
    const headersText = tableHeaders.join(' | ');
    console.log(`   Table Headers: ${headersText}`);

    const hasAllHeaders =
      headersText.includes('Image') &&
      headersText.includes('Product Name / SKU') &&
      headersText.includes('Brand / Company') &&
      headersText.includes('FDA Status') &&
      headersText.includes('MoCRA Status') &&
      headersText.includes('OTC Status') &&
      headersText.includes('Drug Facts') &&
      headersText.includes('Label Review') &&
      headersText.includes('Import Ready') &&
      headersText.includes('Actions');

    results['Table_Headers_Complete'] = hasAllHeaders;
    console.log(`   [Test 6] Table headers complete: ${hasAllHeaders ? 'PASS' : 'FAIL'}`);

    // Verify "Data Not Available" badge exists for unpopulated fields
    const dataNotAvailableCount = await page.locator('text=Data Not Available').count();
    const hasDataNotAvailable = dataNotAvailableCount > 0;
    results['Missing_Data_Displays_Data_Not_Available'] = hasDataNotAvailable;
    console.log(`   [Test 7] Missing data rendered as "Data Not Available": ${hasDataNotAvailable ? 'PASS' : 'FAIL'}`);

    // 6. Test Search & Filters
    console.log('\n5. Testing Search and Filter Functionality...');
    const searchInput = page.locator('input[placeholder*="Search product name"]').first();
    await searchInput.fill('FOOT-TEST');
    await page.waitForTimeout(600);
    const searchRowCount = await page.locator('tbody tr').count();
    console.log(`   Search for 'FOOT-TEST' returned ${searchRowCount} row(s)`);
    results['Search_Filters_Products'] = searchRowCount > 0;

    // Reset search
    await searchInput.fill('');
    await page.waitForTimeout(600);

    // Test Advanced Filters Toggle
    const advToggleBtn = page.locator('button:has-text("Advanced Filters")').first();
    await advToggleBtn.click();
    await page.waitForTimeout(400);

    // Verify Planned Filters are disabled and labeled Planned
    const plannedBadges = await page.locator('span:has-text("Planned")').count();
    results['Planned_Filters_Clearly_Marked'] = plannedBadges >= 2;
    console.log(`   [Test 8] Planned filters clearly labeled with Planned tag: ${plannedBadges >= 2 ? 'PASS' : 'FAIL'}`);

    // Screenshot Filter Active
    const filterScreenshot = path.join(ARTIFACT_DIR, 'prod_adm_compliance_filter_active.png');
    await page.screenshot({ path: filterScreenshot, fullPage: false });
    console.log(`   ✓ Saved screenshot: ${filterScreenshot}`);

    // 7. Test Compliance Detail Checklist Modal
    console.log('\n6. Testing Product Compliance Detail Checklist Modal...');
    const reviewChecklistBtn = page.locator('button:has-text("Review Checklist")').first();
    await reviewChecklistBtn.click();
    await page.waitForTimeout(1000);

    const modalDialog = page.locator('div[role="dialog"]');
    const isModalOpen = await modalDialog.isVisible();
    results['Detail_Modal_Opens'] = isModalOpen;
    console.log(`   [Test 9] Detail Modal opened: ${isModalOpen ? 'PASS' : 'FAIL'}`);

    // Verify all 7 sections
    const s1 = await page.locator('text=Product Classification').first().isVisible();
    const s2 = await page.locator('text=Product Labeling').first().isVisible();
    const s3 = await page.locator('text=FDA Related').first().isVisible();
    const s4 = await page.locator('text=MoCRA').first().isVisible();
    const s5 = await page.locator('text=OTC / Drug Facts').first().isVisible();
    const s6 = await page.locator('text=Certifications & Testing').first().isVisible();
    const s7 = await page.locator('text=Import & Customs').first().isVisible();

    const allSevenPresent = s1 && s2 && s3 && s4 && s5 && s6 && s7;
    results['All_Seven_Checklist_Sections_Present'] = allSevenPresent;
    console.log(`   [Test 10] All 7 checklist sections present: ${allSevenPresent ? 'PASS' : 'FAIL'}`);

    // Verify Regulatory Safety Disclaimer Notice
    const safetyNotice = page.locator('text=Regulatory Safety Notice').first();
    const hasSafetyNotice = await safetyNotice.isVisible();
    results['Safety_Notice_Present'] = hasSafetyNotice;
    console.log(`   [Test 11] Regulatory safety disclaimer present: ${hasSafetyNotice ? 'PASS' : 'FAIL'}`);

    // Verify Distinction Badges inside modal
    const existingBadges = await modalDialog.locator('text=Existing Data').count();
    const notAvailBadges = await modalDialog.locator('text=Data Not Available').count();
    const plannedModalBadges = await modalDialog.locator('text=Planned').count();
    const hasDistinctionBadges = existingBadges > 0 && (notAvailBadges > 0 || plannedModalBadges > 0);
    results['Checklist_Item_Distinction_Badges_Present'] = hasDistinctionBadges;
    console.log(`   [Test 12] Distinction badges (Existing Data, Data Not Available, Planned) present: ${hasDistinctionBadges ? 'PASS' : 'FAIL'}`);

    // Screenshot Detail Modal
    const modalScreenshot = path.join(ARTIFACT_DIR, 'prod_adm_compliance_detail_modal.png');
    await page.screenshot({ path: modalScreenshot, fullPage: false });
    console.log(`   ✓ Saved screenshot: ${modalScreenshot}`);

    // Close modal
    const closeBtn = modalDialog.locator('button:has-text("Close"), button:has-text("✕")').first();
    await closeBtn.click();
    await page.waitForTimeout(500);
    const isModalClosed = !(await modalDialog.isVisible());
    results['Detail_Modal_Closes'] = isModalClosed;
    console.log(`   [Test 13] Modal closes cleanly: ${isModalClosed ? 'PASS' : 'FAIL'}`);

    // 8. Regression Check: Product Catalog intact
    console.log('\n7. Verifying Product Catalog (/admin/products) is Intact & Unaffected...');
    await page.goto(`${ADMIN_URL}/admin/products`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(2000);
    const catalogHeader = page.locator('h1:has-text("제품 통합 관리"), h1:has-text("제품 관리")').first();
    const isCatalogHeaderVisible = await catalogHeader.isVisible();
    results['Product_Catalog_Intact'] = isCatalogHeaderVisible;
    console.log(`   [Test 14] Product Catalog is intact & accessible: ${isCatalogHeaderVisible ? 'PASS' : 'FAIL'}`);

    // Screenshot Catalog Intact
    const catalogScreenshot = path.join(ARTIFACT_DIR, 'prod_adm_compliance_catalog_intact.png');
    await page.screenshot({ path: catalogScreenshot, fullPage: false });
    console.log(`   ✓ Saved screenshot: ${catalogScreenshot}`);

  } catch (err) {
    console.error('[QA ERROR]:', err);
    throw err;
  } finally {
    await browser.close();
    clearTimeout(deadline);
  }

  console.log('\n================================================================================');
  console.log('QA MATRIX SUMMARY RESULTS:');
  console.log(JSON.stringify(results, null, 2));
  console.log('================================================================================\n');

  const failedTests = Object.entries(results).filter(([, passed]) => !passed);
  if (failedTests.length > 0) {
    console.error(`❌ FAILED ${failedTests.length} TESTS:`, failedTests);
    process.exit(1);
  } else {
    console.log('🎉 ALL QA TESTS PASSED ON PRODUCTION!');
    process.exit(0);
  }
}

runQA().catch((err) => {
  console.error('[QA SCRIPT ERROR]:', err);
  process.exit(1);
});
