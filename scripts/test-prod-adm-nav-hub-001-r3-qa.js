// scripts/test-prod-adm-nav-hub-001-r3-qa.js
// Production Browser QA Matrix for ADM-NAV-HUB-001-R3: Default Expand K SELECT BRAND and K SELECT HUB
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
const ARTIFACT_DIR = path.resolve('C:/Users/ChaeHahm/.gemini/antigravity/brain/730f6e70-61e4-47de-8a28-291a9d425b30');
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
  console.log('ADM-NAV-HUB-001-R3 PRODUCTION BROWSER QA MATRIX');
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
    console.log('\n1. Logging into Admin Portal & Verifying Default State on Dashboard...');
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

    // Verify K SELECT BRAND is EXPANDED (depth 1 items visible)
    const brandAppsLink = page.locator('aside a[href="/admin/applications?type=brand"]').first();
    const isBrandExpanded = await brandAppsLink.isVisible();
    results['Brand_Expanded_On_Login'] = isBrandExpanded;
    console.log(`   [Test 2] K SELECT BRAND expanded on login: ${isBrandExpanded ? 'PASS' : 'FAIL'}`);

    // Verify Brand nested submenus are COLLAPSED (depth 2 items not visible)
    const companiesSubLink = page.locator('aside a[href="/admin/companies"]').first();
    const isBrandSubmenuCollapsed = !(await companiesSubLink.isVisible());
    results['Brand_Submenus_Collapsed_On_Login'] = isBrandSubmenuCollapsed;
    console.log(`   [Test 3] Brand nested submenus collapsed on login: ${isBrandSubmenuCollapsed ? 'PASS' : 'FAIL'}`);

    // Verify K SELECT HUB is EXPANDED (depth 1 items visible)
    const retAppsLink = page.locator('aside a[href="/admin/applications?type=retailer"]').first();
    const isHubExpanded = await retAppsLink.isVisible();
    results['Hub_Expanded_On_Login'] = isHubExpanded;
    console.log(`   [Test 4] K SELECT HUB expanded on login: ${isHubExpanded ? 'PASS' : 'FAIL'}`);

    // Verify Hub nested submenus are COLLAPSED (depth 2 items not visible)
    const retailersSubLink = page.locator('aside a[href="/admin/retailers"]').first();
    const isHubSubmenuCollapsed = !(await retailersSubLink.isVisible());
    results['Hub_Submenus_Collapsed_On_Login'] = isHubSubmenuCollapsed;
    console.log(`   [Test 5] Hub nested submenus collapsed on login: ${isHubSubmenuCollapsed ? 'PASS' : 'FAIL'}`);

    // Verify Settings is COLLAPSED (depth 2 items not visible)
    const staffSubLink = page.locator('aside a[href="/admin/staff"]').first();
    const isSettingsCollapsed = !(await staffSubLink.isVisible());
    results['Settings_Collapsed_On_Login'] = isSettingsCollapsed;
    console.log(`   [Test 6] Settings collapsed on login: ${isSettingsCollapsed ? 'PASS' : 'FAIL'}`);

    // Verify GENERAL OPERATIONS is COLLAPSED (items not visible)
    const reportsLink = page.locator('aside a[href="/admin/reports"]').first();
    const isGenOpsCollapsed = !(await reportsLink.isVisible());
    results['General_Operations_Collapsed_On_Login'] = isGenOpsCollapsed;
    console.log(`   [Test 7] GENERAL OPERATIONS collapsed on login: ${isGenOpsCollapsed ? 'PASS' : 'FAIL'}`);

    // Screenshot initial login default expanded state
    const loginScreenshot = path.join(ARTIFACT_DIR, 'prod_adm_nav_hub_001_r3_login_default_state.png');
    await page.screenshot({ path: loginScreenshot, fullPage: false });
    console.log(`   ✓ Saved screenshot: ${loginScreenshot}`);

    // 3. Test Manual Expansion of Submenus and Child Route Navigation
    console.log('\n2. Testing Manual Expansion and Navigation to Child Route...');
    // Click "Retail Network" parent menu under HUB
    const retailNetworkButton = page.locator('button:has-text("Retail Network")').first();
    await retailNetworkButton.click();
    await page.waitForTimeout(500);
    const isRetailersVisibleAfterClick = await retailersSubLink.isVisible();
    results['Retail_Network_Submenu_Expands_On_Click'] = isRetailersVisibleAfterClick;
    console.log(`   [Test 8] Retail Network submenu expands on click: ${isRetailersVisibleAfterClick ? 'PASS' : 'FAIL'}`);

    // Click "Settings" parent menu
    const settingsButton = page.locator('button:has-text("Settings")').first();
    await settingsButton.click();
    await page.waitForTimeout(500);
    const isStaffVisibleAfterClick = await staffSubLink.isVisible();
    results['Settings_Submenu_Expands_On_Click'] = isStaffVisibleAfterClick;
    console.log(`   [Test 9] Settings menu expands on click: ${isStaffVisibleAfterClick ? 'PASS' : 'FAIL'}`);

    // Click "GENERAL OPERATIONS" section header
    const genOpsHeader = page.locator('button:has-text("GENERAL OPERATIONS")').first();
    await genOpsHeader.click();
    await page.waitForTimeout(500);
    const isGenOpsVisibleAfterClick = await reportsLink.isVisible();
    results['General_Operations_Expands_On_Click'] = isGenOpsVisibleAfterClick;
    console.log(`   [Test 10] GENERAL OPERATIONS expands on click: ${isGenOpsVisibleAfterClick ? 'PASS' : 'FAIL'}`);

    // Navigate to /admin/retailers
    await retailersSubLink.click();
    await page.waitForURL((url) => url.pathname.includes('/admin/retailers'), { timeout: 15000 });
    await page.waitForTimeout(1000);
    results['Navigated_To_Retailers'] = true;
    console.log('   ✓ Navigated to /admin/retailers');

    // Screenshot child route expanded state
    const childRouteScreenshot = path.join(ARTIFACT_DIR, 'prod_adm_nav_hub_001_r3_child_route_expanded.png');
    await page.screenshot({ path: childRouteScreenshot, fullPage: false });
    console.log(`   ✓ Saved screenshot: ${childRouteScreenshot}`);

    // 4. Test K SELECT NETWORK Logo Click (Requirement 2)
    console.log('\n3. Testing K SELECT NETWORK Logo Click...');
    const logoLink = page.locator('aside a[title*="K SELECT NETWORK ADMIN"]').first();
    await logoLink.click();
    await page.waitForURL((url) => url.pathname === '/admin', { timeout: 15000 });
    await page.waitForTimeout(1000);

    // Verify reset to default state:
    // Dashboard active
    const isDashActiveAfterLogo = (await dashboardLink.getAttribute('class') || '').includes('font-semibold');
    results['Dashboard_Active_After_Logo_Click'] = isDashActiveAfterLogo;
    console.log(`   [Test 11] Dashboard active after logo click: ${isDashActiveAfterLogo ? 'PASS' : 'FAIL'}`);

    // Brand expanded
    const isBrandExpAfterLogo = await brandAppsLink.isVisible();
    results['Brand_Expanded_After_Logo_Click'] = isBrandExpAfterLogo;
    console.log(`   [Test 12] Brand expanded after logo click: ${isBrandExpAfterLogo ? 'PASS' : 'FAIL'}`);

    // Hub expanded
    const isHubExpAfterLogo = await retAppsLink.isVisible();
    results['Hub_Expanded_After_Logo_Click'] = isHubExpAfterLogo;
    console.log(`   [Test 13] Hub expanded after logo click: ${isHubExpAfterLogo ? 'PASS' : 'FAIL'}`);

    // Settings collapsed
    const isSettingsColAfterLogo = !(await staffSubLink.isVisible());
    results['Settings_Collapsed_After_Logo_Click'] = isSettingsColAfterLogo;
    console.log(`   [Test 14] Settings collapsed after logo click: ${isSettingsColAfterLogo ? 'PASS' : 'FAIL'}`);

    // General Ops collapsed
    const isGenOpsColAfterLogo = !(await reportsLink.isVisible());
    results['General_Operations_Collapsed_After_Logo_Click'] = isGenOpsColAfterLogo;
    console.log(`   [Test 15] GENERAL OPERATIONS collapsed after logo click: ${isGenOpsColAfterLogo ? 'PASS' : 'FAIL'}`);

    // Nested submenus collapsed
    const isRetailersColAfterLogo = !(await retailersSubLink.isVisible());
    results['Hub_Submenus_Collapsed_After_Logo_Click'] = isRetailersColAfterLogo;
    console.log(`   [Test 16] Hub nested submenus collapsed after logo click: ${isRetailersColAfterLogo ? 'PASS' : 'FAIL'}`);

    // Screenshot after logo click
    const logoClickScreenshot = path.join(ARTIFACT_DIR, 'prod_adm_nav_hub_001_r3_logo_click_restored_default.png');
    await page.screenshot({ path: logoClickScreenshot, fullPage: false });
    console.log(`   ✓ Saved screenshot: ${logoClickScreenshot}`);

    // 5. Test Collapsed Sidebar Logo Click (KS logo)
    console.log('\n4. Testing Collapsed Sidebar KS Logo Click...');
    const collapseToggleBtn = page.locator('aside button:has-text("Collapse Sidebar"), aside button:has-text("←")').last();
    await collapseToggleBtn.click();
    await page.waitForTimeout(500);

    // Click KS logo while collapsed
    const ksLogoLink = page.locator('aside a[title*="K SELECT NETWORK ADMIN"]').first();
    await ksLogoLink.click();
    await page.waitForURL((url) => url.pathname === '/admin', { timeout: 15000 });
    await page.waitForTimeout(500);

    // Expand sidebar back
    const expandToggleBtn = page.locator('aside button:has-text("→")').last();
    await expandToggleBtn.click();
    await page.waitForTimeout(500);

    const isBrandExpAfterKsLogo = await brandAppsLink.isVisible();
    const isHubExpAfterKsLogo = await retAppsLink.isVisible();
    const isSettingsColAfterKsLogo = !(await staffSubLink.isVisible());
    const isGenOpsColAfterKsLogo = !(await reportsLink.isVisible());
    const isSubmenusColAfterKsLogo = !(await retailersSubLink.isVisible());

    results['KS_Logo_Click_Default_State_Restored'] =
      isBrandExpAfterKsLogo && isHubExpAfterKsLogo && isSettingsColAfterKsLogo && isGenOpsColAfterKsLogo && isSubmenusColAfterKsLogo;
    console.log(`   [Test 17] KS Logo Click Restores Default State: ${results['KS_Logo_Click_Default_State_Restored'] ? 'PASS' : 'FAIL'}`);

    // Screenshot collapsed logo test restored
    const ksLogoScreenshot = path.join(ARTIFACT_DIR, 'prod_adm_nav_hub_001_r3_collapsed_logo_click_restored_default.png');
    await page.screenshot({ path: ksLogoScreenshot, fullPage: false });
    console.log(`   ✓ Saved screenshot: ${ksLogoScreenshot}`);

    console.log('\n================================================================================');
    console.log('SUMMARY OF RESULTS:');
    console.log(JSON.stringify(results, null, 2));
    console.log('================================================================================\n');

    const allPassed = Object.values(results).every(Boolean);
    if (!allPassed) {
      console.error('❌ SOME TESTS FAILED IN THE MATRIX');
      process.exit(1);
    } else {
      console.log('🎉 ALL MATRIX TESTS PASSED PERFECTLY!');
    }
  } finally {
    clearTimeout(deadline);
    await browser.close();
  }
}

runQA().catch((err) => {
  console.error('[QA RUNNER ERROR]', err);
  process.exit(1);
});
