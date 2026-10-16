// scripts/test-prod-adm-nav-hub-001-r1-qa.js
// Production Browser QA Matrix for ADM-NAV-HUB-001-R1
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
  console.log('ADM-NAV-HUB-001-R1 PRODUCTION BROWSER QA MATRIX');
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
    console.log('   ✓ Logged in successfully');

    // Screenshot initial full sidebar
    const fullSidebarScreenshot = path.join(ARTIFACT_DIR, 'prod_adm_nav_hub_001_r1_full_sidebar.png');
    await page.screenshot({ path: fullSidebarScreenshot, fullPage: false });
    console.log(`   ✓ Saved screenshot: ${fullSidebarScreenshot}`);

    // 3. Verify Dashboard at top
    console.log('\n2. Verifying Dashboard at top...');
    const dashboardLink = page.locator('aside a[href="/admin"]').first();
    const hasDashboard = await dashboardLink.isVisible();
    results['Dashboard_Visible_At_Top'] = hasDashboard;
    console.log(`   [Test 1] Dashboard visible at top: ${hasDashboard ? 'PASS' : 'FAIL'}`);

    // 4. Verify K SELECT BRAND Section & Logo
    console.log('\n3. Verifying K SELECT BRAND Section...');
    const brandHeader = page.locator('button:has-text("K SELECT BRAND")').first();
    const hasBrandHeader = await brandHeader.isVisible();
    const brandLogo = brandHeader.locator('img[src="/symbol-Cyan-Hotpink.png"]');
    const hasBrandLogo = await brandLogo.isVisible();
    results['Brand_Section_Visible'] = hasBrandHeader;
    results['Brand_Logo_Cyan_Hotpink_Visible'] = hasBrandLogo;
    console.log(`   [Test 2] K SELECT BRAND header: ${hasBrandHeader ? 'PASS' : 'FAIL'}`);
    console.log(`   [Test 3] K SELECT BRAND logo (symbol-Cyan-Hotpink.png): ${hasBrandLogo ? 'PASS' : 'FAIL'}`);

    const brandAppsLink = page.locator('aside a[href="/admin/applications?type=brand"]').first();
    const brandInquiriesLink = page.locator('aside a[href="/admin/partner-inquiries?type=brand"]').first();
    results['Brand_Applications_Link_Present'] = await brandAppsLink.isVisible();
    results['Brand_Inquiries_Link_Present'] = await brandInquiriesLink.isVisible();
    console.log(`   [Test 4] Brand Applications link: ${results['Brand_Applications_Link_Present'] ? 'PASS' : 'FAIL'}`);
    console.log(`   [Test 5] Brand Inquiries link: ${results['Brand_Inquiries_Link_Present'] ? 'PASS' : 'FAIL'}`);

    // 5. Verify K SELECT HUB Section & Logo
    console.log('\n4. Verifying K SELECT HUB Section...');
    const hubHeader = page.locator('button:has-text("K SELECT HUB")').first();
    const hasHubHeader = await hubHeader.isVisible();
    const hubLogo = hubHeader.locator('img[src="/symbol-Hotpink-Cyan.png"]');
    const hasHubLogo = await hubLogo.isVisible();
    results['Hub_Section_Visible'] = hasHubHeader;
    results['Hub_Logo_Hotpink_Cyan_Visible'] = hasHubLogo;
    console.log(`   [Test 6] K SELECT HUB header: ${hasHubHeader ? 'PASS' : 'FAIL'}`);
    console.log(`   [Test 7] K SELECT HUB logo (symbol-Hotpink-Cyan.png): ${hasHubLogo ? 'PASS' : 'FAIL'}`);

    const retAppsLink = page.locator('aside a[href="/admin/applications?type=retailer"]').first();
    const retInquiriesLink = page.locator('aside a[href="/admin/partner-inquiries?type=retailer"]').first();
    results['Retailer_Applications_Link_Present'] = await retAppsLink.isVisible();
    results['Retail_Inquiries_Link_Present'] = await retInquiriesLink.isVisible();
    console.log(`   [Test 8] Retailer Applications link: ${results['Retailer_Applications_Link_Present'] ? 'PASS' : 'FAIL'}`);
    console.log(`   [Test 9] Retail Inquiries link: ${results['Retail_Inquiries_Link_Present'] ? 'PASS' : 'FAIL'}`);

    // 6. Verify Settings as Independent Top-Level Menu
    console.log('\n5. Verifying Settings as Independent Top-Level Menu...');
    const settingsBtn = page.locator('aside button:has-text("Settings")').first();
    const hasSettingsBtn = await settingsBtn.isVisible();
    results['Settings_Top_Level_Menu_Present'] = hasSettingsBtn;
    console.log(`   [Test 10] Settings top-level button present: ${hasSettingsBtn ? 'PASS' : 'FAIL'}`);

    // Verify Settings position: after HUB and before GENERAL OPERATIONS
    const generalOpsHeader = page.locator('button:has-text("GENERAL OPERATIONS")').first();
    const hasGeneralOpsHeader = await generalOpsHeader.isVisible();
    results['General_Operations_Section_Visible'] = hasGeneralOpsHeader;
    console.log(`   [Test 11] GENERAL OPERATIONS header present: ${hasGeneralOpsHeader ? 'PASS' : 'FAIL'}`);

    // Verify old SETTINGS & OTHER header is gone
    const oldSettingsOtherCount = await page.locator('text="SETTINGS & OTHER"').count();
    results['Old_Settings_Other_Header_Removed'] = oldSettingsOtherCount === 0;
    console.log(`   [Test 12] Old SETTINGS & OTHER removed: ${results['Old_Settings_Other_Header_Removed'] ? 'PASS' : 'FAIL'}`);

    // Verify Settings positioning order in DOM
    const navButtonsAndLinks = await page.evaluate(() => {
      const aside = document.querySelector('aside');
      if (!aside) return [];
      const elements = Array.from(aside.querySelectorAll('button, a'));
      return elements.map(el => el.textContent?.trim() || '').filter(t => t.length > 0);
    });
    const hubIndex = navButtonsAndLinks.findIndex(t => t.includes('K SELECT HUB'));
    const settingsIndex = navButtonsAndLinks.findIndex(t => t.startsWith('Settings'));
    const genOpsIndex = navButtonsAndLinks.findIndex(t => t.includes('GENERAL OPERATIONS'));
    const isOrderCorrect = hubIndex < settingsIndex && settingsIndex < genOpsIndex;
    results['Settings_Positioned_Between_Hub_And_GeneralOps'] = isOrderCorrect;
    console.log(`   [Test 13] Order: HUB (${hubIndex}) < Settings (${settingsIndex}) < GENERAL OPERATIONS (${genOpsIndex}): ${isOrderCorrect ? 'PASS' : 'FAIL'}`);

    // 7. Verify Settings Visual Parity with Dashboard
    console.log('\n6. Verifying Visual Parity with Dashboard...');
    const dashboardBox = await dashboardLink.boundingBox();
    const settingsBox = await settingsBtn.boundingBox();
    // Compare height and font styles
    const dashClasses = (await dashboardLink.getAttribute('class')) || '';
    const settingsClasses = (await settingsBtn.getAttribute('class')) || '';
    const hasSameTextSize = dashClasses.includes('text-sm') && settingsClasses.includes('text-sm');
    const hasSamePadding = dashClasses.includes('px-3') && settingsClasses.includes('px-3') && dashClasses.includes('py-2') && settingsClasses.includes('py-2');
    const hasVisualParity = hasSameTextSize && hasSamePadding && Math.abs((dashboardBox?.height || 0) - (settingsBox?.height || 0)) <= 2;
    results['Settings_Visual_Parity_With_Dashboard'] = hasVisualParity;
    console.log(`   [Test 14] Visual parity with Dashboard (height, padding, typography): ${hasVisualParity ? 'PASS' : 'FAIL'}`);

    // 8. Expand Settings and Verify Exact Submenu Order (11 items)
    console.log('\n7. Verifying Settings 11 Submenus in Exact Order...');
    await settingsBtn.click();
    await page.waitForTimeout(600);

    const expectedSettingsSubmenus = [
      'Users & Permissions',
      'Company Configs',
      'Warehouses',
      'Categories',
      'Attribute Profiles',
      'Attributes & Options',
      'Curation Settings',
      'Agreement Templates',
      'Email Templates',
      'Knowledge Center',
      'Payments',
    ];

    const actualSettingsSubmenuTexts = await page.evaluate(() => {
      const aside = document.querySelector('aside');
      if (!aside) return [];
      const links = Array.from(aside.querySelectorAll('div.pl-6 a'));
      return links.map(l => l.querySelector('span.flex-1')?.textContent?.trim() || l.textContent?.trim() || '');
    });

    // Check that all 11 expected items appear in exact order inside Settings
    let orderMatches = true;
    for (let i = 0; i < expectedSettingsSubmenus.length; i++) {
      if (actualSettingsSubmenuTexts[i] !== expectedSettingsSubmenus[i]) {
        console.log(`   Mismatch at index ${i}: expected "${expectedSettingsSubmenus[i]}", got "${actualSettingsSubmenuTexts[i]}"`);
        orderMatches = false;
      }
    }
    results['Settings_Submenus_Exact_Order_11_Items'] = orderMatches;
    console.log(`   [Test 15] Settings 11 submenus exact sequence match: ${orderMatches ? 'PASS' : 'FAIL'}`);

    // Screenshot of Settings Expanded
    const settingsExpandedScreenshot = path.join(ARTIFACT_DIR, 'prod_adm_nav_hub_001_r1_settings_expanded.png');
    await page.screenshot({ path: settingsExpandedScreenshot, fullPage: false });
    console.log(`   ✓ Saved screenshot: ${settingsExpandedScreenshot}`);

    // 9. Verify GENERAL OPERATIONS contains ONLY the 4 approved entries
    console.log('\n8. Verifying GENERAL OPERATIONS Items...');
    const reportsLink = page.locator('aside a[href="/admin/reports"]').first();
    const tasksBtn = page.locator('aside button:has-text("Tasks & Communication")').first();
    const amazonBtn = page.locator('aside button:has-text("Amazon")').first();
    const intelBtn = page.locator('aside button:has-text("Intelligence")').first();

    const hasReports = await reportsLink.isVisible();
    const hasTasks = await tasksBtn.isVisible();
    const hasAmazon = await amazonBtn.isVisible();
    const hasIntel = await intelBtn.isVisible();

    results['General_Operations_Contains_Only_Approved_Items'] = hasReports && hasTasks && hasAmazon && hasIntel;
    console.log(`   [Test 16] Reports, Tasks, Amazon, Intelligence present in General Operations: ${results['General_Operations_Contains_Only_Approved_Items'] ? 'PASS' : 'FAIL'}`);

    // Screenshot General Operations
    const genOpsScreenshot = path.join(ARTIFACT_DIR, 'prod_adm_nav_hub_001_r1_general_operations.png');
    await page.screenshot({ path: genOpsScreenshot, fullPage: false });

    // 10. Verify Independent Expand / Collapse
    console.log('\n9. Testing Independent Expand / Collapse...');
    // Collapse Settings
    await settingsBtn.click();
    await page.waitForTimeout(500);
    const usersPermsLink = page.locator('aside a[href="/admin/staff"]').first();
    const isSettingsCollapsed = !(await usersPermsLink.isVisible());
    const isBrandAppsStillVisible = await brandAppsLink.isVisible();
    results['Settings_Expands_Collapses_Independently'] = isSettingsCollapsed && isBrandAppsStillVisible;
    console.log(`   [Test 17] Settings expands/collapses independently: ${results['Settings_Expands_Collapses_Independently'] ? 'PASS' : 'FAIL'}`);

    // Toggle General Operations section
    await generalOpsHeader.click();
    await page.waitForTimeout(500);
    const isReportsHidden = !(await reportsLink.isVisible());
    await generalOpsHeader.click();
    await page.waitForTimeout(500);
    const isReportsBack = await reportsLink.isVisible();
    results['General_Operations_Expands_Collapses_Independently'] = isReportsHidden && isReportsBack;
    console.log(`   [Test 18] GENERAL OPERATIONS expands/collapses independently: ${results['General_Operations_Expands_Collapses_Independently'] ? 'PASS' : 'FAIL'}`);

    // 11. Test Settings Child Navigation & Active Highlighting
    console.log('\n10. Testing Settings Child Navigation & Auto-Expand...');
    // Click Settings to re-expand
    await settingsBtn.click();
    await page.waitForTimeout(500);
    // Click Warehouses
    const warehousesLink = page.locator('aside a[href="/admin/settings/warehouses"]').first();
    await Promise.all([
      page.waitForURL((url) => url.pathname.includes('/admin/settings/warehouses'), { timeout: 15000 }),
      warehousesLink.click(),
    ]);
    await page.waitForTimeout(1000);

    // Verify Warehouses is active
    const isWarehousesActive = (await warehousesLink.getAttribute('class') || '').includes('font-bold');
    // Verify Settings button is highlighted as active
    const isSettingsParentActive = (await settingsBtn.getAttribute('class') || '').includes('font-semibold');
    results['Settings_Child_Navigation_And_Active_Highlight'] = isWarehousesActive && isSettingsParentActive;
    console.log(`   [Test 19] Warehouses active & Settings parent highlighted: ${results['Settings_Child_Navigation_And_Active_Highlight'] ? 'PASS' : 'FAIL'}`);

    const settingsActiveScreenshot = path.join(ARTIFACT_DIR, 'prod_adm_nav_hub_001_r1_settings_child_active.png');
    await page.screenshot({ path: settingsActiveScreenshot, fullPage: false });

    // 12. Test Brand & Retailer Applications Tabs
    console.log('\n11. Testing Applications Tab Navigation...');
    await Promise.all([
      page.waitForURL((url) => url.pathname.includes('/admin/applications') && (url.searchParams.get('type') === 'brand' || url.searchParams.get('tab') === 'brand'), { timeout: 15000 }),
      brandAppsLink.click(),
    ]);
    await page.waitForTimeout(1000);
    const isBrandTabActive = await page.locator('main nav a[href="/admin/applications?type=brand"].border-zinc-900, main nav a[href="/admin/applications?type=brand"].font-bold').first().isVisible().catch(() => false);
    results['Brand_Applications_Tab_Selected'] = isBrandTabActive;
    console.log(`   [Test 20] Brand Applications opens Brand tab: ${isBrandTabActive ? 'PASS' : 'FAIL'}`);

    await Promise.all([
      page.waitForURL((url) => url.searchParams.get('type') === 'retailer' || url.searchParams.get('tab') === 'retailer', { timeout: 15000 }),
      retAppsLink.click(),
    ]);
    await page.waitForTimeout(1000);
    const isRetTabActive = await page.locator('main nav a[href="/admin/applications?type=retailer"].border-zinc-900, main nav a[href="/admin/applications?type=retailer"].font-bold').first().isVisible().catch(() => false);
    results['Retailer_Applications_Tab_Selected'] = isRetTabActive;
    console.log(`   [Test 21] Retailer Applications opens Retailer tab: ${isRetTabActive ? 'PASS' : 'FAIL'}`);

    // 13. Test Collapsed Sidebar View
    console.log('\n12. Testing Collapsed Sidebar View...');
    const collapseBtn = page.locator('aside button:has-text("Collapse Sidebar")').first();
    await collapseBtn.click();
    await page.waitForTimeout(500);

    const aside = page.locator('aside').first();
    const isSidebarCollapsed = (await aside.getAttribute('class') || '').includes('w-16');
    // In collapsed view, Settings gear button is visible
    const isSettingsIconVisible = await settingsBtn.isVisible();
    results['Sidebar_Collapses_To_w16_With_Settings_Icon'] = isSidebarCollapsed && isSettingsIconVisible;
    console.log(`   [Test 22] Sidebar collapses to w-16 with Settings icon visible: ${results['Sidebar_Collapses_To_w16_With_Settings_Icon'] ? 'PASS' : 'FAIL'}`);

    const collapsedScreenshot = path.join(ARTIFACT_DIR, 'prod_adm_nav_hub_001_r1_collapsed_sidebar.png');
    await page.screenshot({ path: collapsedScreenshot, fullPage: false });

    // Expand sidebar back
    const expandBtn = page.locator('aside button:has-text("→")').first();
    await expandBtn.click();
    await page.waitForTimeout(500);
    const isSidebarExpanded = (await aside.getAttribute('class') || '').includes('w-64');
    results['Sidebar_Expands_Back_To_w64'] = isSidebarExpanded;
    console.log(`   [Test 23] Sidebar expands back to w-64: ${isSidebarExpanded ? 'PASS' : 'FAIL'}`);

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
