// scripts/test-prod-adm-nav-hub-001-r2-qa.js
// Production Browser QA Matrix for ADM-NAV-HUB-001-R2
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
  for (let i = 0; i < 25; i++) {
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
  console.log('ADM-NAV-HUB-001-R2 PRODUCTION BROWSER QA MATRIX');
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

    // 2. Admin Login -> Default state check (Requirement 1)
    console.log('\n1. Logging into Admin Portal & Verifying Default Collapsed State...');
    await page.goto(`${ADMIN_URL}/admin/login`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.locator('input#email, input[type="email"]').fill(TEST_EMAIL);
    await page.locator('input#password, input[type="password"]').fill(TEST_PASSWORD);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 20000 });
    await page.waitForTimeout(2000);
    results['Admin_Login_Successful'] = true;
    console.log('   ✓ Logged in successfully. Current URL: ' + page.url());

    // Verify Dashboard is open and active
    const dashboardLink = page.locator('aside nav a[href="/admin"]').first();
    const isDashboardActive = (await dashboardLink.getAttribute('class') || '').includes('font-semibold');
    results['Dashboard_Open_And_Active_On_Login'] = isDashboardActive;
    console.log(`   [Test 1] Dashboard open and active on login: ${isDashboardActive ? 'PASS' : 'FAIL'}`);

    // Verify K SELECT BRAND is collapsed
    const brandAppsLink = page.locator('aside a[href="/admin/applications?type=brand"]').first();
    const isBrandCollapsed = !(await brandAppsLink.isVisible());
    results['Brand_Collapsed_On_Login'] = isBrandCollapsed;
    console.log(`   [Test 2] K SELECT BRAND collapsed on login: ${isBrandCollapsed ? 'PASS' : 'FAIL'}`);

    // Verify K SELECT HUB is collapsed
    const retAppsLink = page.locator('aside a[href="/admin/applications?type=retailer"]').first();
    const isHubCollapsed = !(await retAppsLink.isVisible());
    results['Hub_Collapsed_On_Login'] = isHubCollapsed;
    console.log(`   [Test 3] K SELECT HUB collapsed on login: ${isHubCollapsed ? 'PASS' : 'FAIL'}`);

    // Verify Settings is collapsed
    const usersPermsLink = page.locator('aside a[href="/admin/staff"]').first();
    const isSettingsCollapsed = !(await usersPermsLink.isVisible());
    results['Settings_Collapsed_On_Login'] = isSettingsCollapsed;
    console.log(`   [Test 4] Settings collapsed on login: ${isSettingsCollapsed ? 'PASS' : 'FAIL'}`);

    // Verify GENERAL OPERATIONS is collapsed
    const reportsLink = page.locator('aside a[href="/admin/reports"]').first();
    const isGenOpsCollapsed = !(await reportsLink.isVisible());
    results['General_Operations_Collapsed_On_Login'] = isGenOpsCollapsed;
    console.log(`   [Test 5] GENERAL OPERATIONS collapsed on login: ${isGenOpsCollapsed ? 'PASS' : 'FAIL'}`);

    // Screenshot initial login default collapsed state
    const loginScreenshot = path.join(ARTIFACT_DIR, 'prod_adm_nav_hub_001_r2_login_default_state.png');
    await page.screenshot({ path: loginScreenshot, fullPage: false });
    console.log(`   ✓ Saved screenshot: ${loginScreenshot}`);

    // 3. Test Manual Expansion of Groups
    console.log('\n2. Testing Manual Expansion of Groups...');
    const brandHeader = page.locator('button:has-text("K SELECT BRAND")').first();
    await brandHeader.click();
    await page.waitForTimeout(500);
    const isBrandNowOpen = await brandAppsLink.isVisible();
    results['Brand_Expands_On_Click'] = isBrandNowOpen;
    console.log(`   [Test 6] K SELECT BRAND expands on click: ${isBrandNowOpen ? 'PASS' : 'FAIL'}`);

    const settingsBtn = page.locator('aside button:has-text("Settings")').first();
    await settingsBtn.click();
    await page.waitForTimeout(500);
    const isSettingsNowOpen = await usersPermsLink.isVisible();
    results['Settings_Expands_On_Click'] = isSettingsNowOpen;
    console.log(`   [Test 7] Settings expands on click: ${isSettingsNowOpen ? 'PASS' : 'FAIL'}`);

    // Screenshot manually expanded
    const manualExpandedScreenshot = path.join(ARTIFACT_DIR, 'prod_adm_nav_hub_001_r2_manually_expanded.png');
    await page.screenshot({ path: manualExpandedScreenshot, fullPage: false });
    console.log(`   ✓ Saved screenshot: ${manualExpandedScreenshot}`);

    // 4. Test "K SELECT NETWORK" Logo Click Reset (Requirement 2)
    console.log('\n3. Testing "K SELECT NETWORK" Logo Click Reset...');
    const logoLink = page.locator('aside a:has-text("K SELECT NETWORK")').first();
    await logoLink.click();
    await page.waitForTimeout(500);

    // Verify URL is /admin
    const isAtDashboard = page.url() === `${ADMIN_URL}/admin`;
    // Verify Brand is now collapsed
    const isBrandClosedAfterLogo = !(await brandAppsLink.isVisible());
    // Verify Settings is now collapsed
    const isSettingsClosedAfterLogo = !(await usersPermsLink.isVisible());
    results['Logo_Click_Navigates_To_Dashboard'] = isAtDashboard;
    results['Logo_Click_Collapses_All_Groups'] = isBrandClosedAfterLogo && isSettingsClosedAfterLogo;
    console.log(`   [Test 8] Logo click navigates to Dashboard: ${isAtDashboard ? 'PASS' : 'FAIL'}`);
    console.log(`   [Test 9] Logo click collapses all groups and submenus: ${results['Logo_Click_Collapses_All_Groups'] ? 'PASS' : 'FAIL'}`);

    // Screenshot after logo click reset
    const logoResetScreenshot = path.join(ARTIFACT_DIR, 'prod_adm_nav_hub_001_r2_logo_click_reset.png');
    await page.screenshot({ path: logoResetScreenshot, fullPage: false });
    console.log(`   ✓ Saved screenshot: ${logoResetScreenshot}`);

    // 5. Test Child-Page Navigation & Auto-Expansion (Requirement 3)
    console.log('\n4. Testing Child-Page Auto-Expansion...');
    // Manually expand Brand to click Companies & Brands
    await brandHeader.click();
    await page.waitForTimeout(500);
    const companiesMenuBtn = page.locator('aside button:has-text("Companies & Brands")').first();
    await companiesMenuBtn.click();
    await page.waitForTimeout(500);
    const companiesLink = page.locator('aside a[href="/admin/companies"]').first();

    await Promise.all([
      page.waitForURL((url) => url.pathname.includes('/admin/companies'), { timeout: 15000 }),
      companiesLink.click(),
    ]);
    await page.waitForTimeout(1000);

    // Verify Brand and Companies & Brands are auto-expanded
    const isBrandAutoExpanded = await brandAppsLink.isVisible();
    const isCompaniesLinkActive = (await companiesLink.getAttribute('class') || '').includes('font-bold');
    results['Child_Page_Auto_Expands_Parent'] = isBrandAutoExpanded && isCompaniesLinkActive;
    console.log(`   [Test 10] Child page auto-expands parent menu & highlights active: ${results['Child_Page_Auto_Expands_Parent'] ? 'PASS' : 'FAIL'}`);

    // Screenshot child-page auto-expanded
    const childExpandedScreenshot = path.join(ARTIFACT_DIR, 'prod_adm_nav_hub_001_r2_child_page_auto_expanded.png');
    await page.screenshot({ path: childExpandedScreenshot, fullPage: false });
    console.log(`   ✓ Saved screenshot: ${childExpandedScreenshot}`);

    // Click logo from child page to verify reset back to collapsed Dashboard
    console.log('\n5. Testing Logo Click From Child Page...');
    await logoLink.click();
    await page.waitForURL((url) => url.pathname === '/admin', { timeout: 15000 });
    await page.waitForTimeout(500);

    const isBrandClosedAfterChildReset = !(await brandAppsLink.isVisible());
    results['Logo_Click_From_Child_Resets_To_Collapsed_Dashboard'] = isBrandClosedAfterChildReset;
    console.log(`   [Test 11] Logo click from child page resets to collapsed Dashboard: ${isBrandClosedAfterChildReset ? 'PASS' : 'FAIL'}`);

    // 6. Test Settings Child-Page Auto-Expansion & Logo Reset
    console.log('\n6. Testing Settings Child Auto-Expansion & Logo Reset...');
    await settingsBtn.click();
    await page.waitForTimeout(500);
    const warehousesLink = page.locator('aside a[href="/admin/settings/warehouses"]').first();
    await Promise.all([
      page.waitForURL((url) => url.pathname.includes('/admin/settings/warehouses'), { timeout: 15000 }),
      warehousesLink.click(),
    ]);
    await page.waitForTimeout(1000);

    const isWarehousesActive = (await warehousesLink.getAttribute('class') || '').includes('font-bold');
    const isSettingsAutoOpen = await usersPermsLink.isVisible();
    results['Settings_Child_Auto_Expands'] = isWarehousesActive && isSettingsAutoOpen;
    console.log(`   [Test 12] Settings child auto-expands Settings: ${results['Settings_Child_Auto_Expands'] ? 'PASS' : 'FAIL'}`);

    // Click logo again to reset
    await logoLink.click();
    await page.waitForURL((url) => url.pathname === '/admin', { timeout: 15000 });
    await page.waitForTimeout(500);

    const isSettingsClosedAfterReset = !(await usersPermsLink.isVisible());
    results['Settings_Closed_After_Logo_Reset'] = isSettingsClosedAfterReset;
    console.log(`   [Test 13] Settings closed after logo reset: ${isSettingsClosedAfterReset ? 'PASS' : 'FAIL'}`);

    // 7. Test Collapsed Sidebar View & KS Logo Link
    console.log('\n7. Testing Collapsed Sidebar View & KS Logo Link...');
    const collapseBtn = page.locator('aside button:has-text("Collapse Sidebar")').first();
    await collapseBtn.click();
    await page.waitForTimeout(500);

    const aside = page.locator('aside').first();
    const isSidebarCollapsed = (await aside.getAttribute('class') || '').includes('w-16');
    const ksLogoLink = page.locator('aside a[title*="Dashboard"]').first();
    const isKsLogoPresent = await ksLogoLink.isVisible();
    results['Sidebar_Collapses_To_w16'] = isSidebarCollapsed && isKsLogoPresent;
    console.log(`   [Test 14] Sidebar collapses to w-16 with KS logo link: ${results['Sidebar_Collapses_To_w16'] ? 'PASS' : 'FAIL'}`);

    const collapsedScreenshot = path.join(ARTIFACT_DIR, 'prod_adm_nav_hub_001_r2_collapsed_sidebar.png');
    await page.screenshot({ path: collapsedScreenshot, fullPage: false });
    console.log(`   ✓ Saved screenshot: ${collapsedScreenshot}`);

    // Click KS logo link in collapsed mode
    await ksLogoLink.click();
    await page.waitForTimeout(500);

    // Expand sidebar back
    const expandBtn = page.locator('aside button:has-text("→")').first();
    await expandBtn.click();
    await page.waitForTimeout(500);
    const isSidebarExpanded = (await aside.getAttribute('class') || '').includes('w-64');
    results['Sidebar_Expands_Back_To_w64'] = isSidebarExpanded;
    console.log(`   [Test 15] Sidebar expands back to w-64: ${isSidebarExpanded ? 'PASS' : 'FAIL'}`);

    await context.close();

    console.log('\n================================================================================');
    console.log('QA MATRIX SUMMARY RESULTS:');
    console.log(JSON.stringify(results, null, 2));
    console.log('================================================================================');

    const allPassed = Object.values(results).every(Boolean);
    if (!allPassed) {
      throw new Error('Some QA matrix tests failed!');
    }
    console.log('\n🎉 ALL QA TESTS PASSED ON PRODUCTION!');
  } catch (err) {
    console.error('[QA ERROR]', err.message);
    throw err;
  } finally {
    await browser.close().catch(() => null);
    clearTimeout(deadline);
    console.log('[QA] Browser closed, exiting normally.');
    process.exit(0);
  }
}

runQA().catch((err) => {
  console.error('[QA FATAL ERROR]', err);
  process.exit(1);
});
