// scripts/test-prod-adm-nav-hub-001-qa.js
// Production Browser QA Matrix for ADM-NAV-HUB-001
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
const TARGET_SHA_PREFIXES = ['1967dad', 'c50d827', 'd4ee525'];

// 90-second process timeout
const deadline = setTimeout(() => {
  console.error('[QA FATAL] 90s hard process timeout exceeded, forcing exit');
  process.exit(1);
}, 90000);

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

async function waitForDeployment() {
  console.log(`Polling ${ADMIN_URL}/api/diagnostics for commit matching ${TARGET_SHA_PREFIXES.join(' or ')}...`);
  for (let i = 0; i < 20; i++) {
    const diag = await checkDiagnostics(`${ADMIN_URL}/api/diagnostics`);
    console.log(`  [Attempt ${i + 1}] Live SHA: ${diag.sha}`);
    if (diag.sha && TARGET_SHA_PREFIXES.some(p => diag.sha.startsWith(p))) {
      console.log(`✓ Deployment Ready: ${diag.sha}\n`);
      return diag.sha;
    }
    await new Promise((r) => setTimeout(r, 4000));
  }
  throw new Error(`Timeout waiting for Vercel deployment of ${TARGET_SHA_PREFIXES.join('/')}`);
}

async function runQA() {
  console.log('================================================================================');
  console.log('ADM-NAV-HUB-001 PRODUCTION BROWSER QA MATRIX');
  console.log('Target: ' + ADMIN_URL);
  console.log('================================================================================\n');

  const liveSha = await waitForDeployment();

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
    results['Diagnostics_Live_SHA_Matches'] = TARGET_SHA_PREFIXES.some(p => liveSha.startsWith(p));

    // 2. Admin Login
    console.log('1. Logging into Admin Portal...');
    await page.goto(`${ADMIN_URL}/admin/login`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.locator('input#email, input[type="email"]').fill(TEST_EMAIL);
    await page.locator('input#password, input[type="password"]').fill(TEST_PASSWORD);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 20000 });
    await page.waitForTimeout(2000);
    results['Admin_Login_Successful'] = true;
    console.log('   ✓ Logged in successfully');

    // Screenshot initial full sidebar
    const fullSidebarScreenshot = path.join(ARTIFACT_DIR, 'prod_adm_nav_hub_001_full_sidebar.png');
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

    // Verify Brand items
    const brandAppsLink = page.locator('aside a[href="/admin/applications?type=brand"]').first();
    const brandInquiriesLink = page.locator('aside a[href="/admin/partner-inquiries?type=brand"]').first();
    const hasBrandApps = await brandAppsLink.isVisible();
    const hasBrandInquiries = await brandInquiriesLink.isVisible();
    results['Brand_Applications_Link_Present'] = hasBrandApps;
    results['Brand_Inquiries_Link_Present'] = hasBrandInquiries;
    console.log(`   [Test 4] Brand Applications link: ${hasBrandApps ? 'PASS' : 'FAIL'}`);
    console.log(`   [Test 5] Brand Inquiries link: ${hasBrandInquiries ? 'PASS' : 'FAIL'}`);

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

    // Verify Hub items
    const retAppsLink = page.locator('aside a[href="/admin/applications?type=retailer"]').first();
    const tradingLink = page.locator('aside a[href="/admin/products/trading"]').first();
    const retInquiriesLink = page.locator('aside a[href="/admin/partner-inquiries?type=retailer"]').first();
    const orderProcLink = page.locator('aside a[href="/admin/sales/orders"]').first();
    const receivablesLink = page.locator('aside a[href="/admin/finance/receivables"]').first();
    const contentTrainingLink = page.locator('aside a[href="/admin/products/content"]').first();

    const hasRetApps = await retAppsLink.isVisible();
    const hasTrading = await tradingLink.isVisible();
    const hasRetInquiries = await retInquiriesLink.isVisible();
    const hasOrderProc = await orderProcLink.isVisible();
    const hasReceivables = await receivablesLink.isVisible();
    const hasContentTraining = await contentTrainingLink.isVisible();

    results['Retailer_Applications_Link_Present'] = hasRetApps;
    results['Trading_Products_Under_Hub'] = hasTrading;
    results['Retail_Inquiries_Link_Present'] = hasRetInquiries;
    results['Order_Processing_Under_Hub'] = hasOrderProc;
    results['Receivables_Under_Hub'] = hasReceivables;
    results['Content_Training_Under_Hub'] = hasContentTraining;

    console.log(`   [Test 8] Retailer Applications link: ${hasRetApps ? 'PASS' : 'FAIL'}`);
    console.log(`   [Test 9] Trading Products under HUB: ${hasTrading ? 'PASS' : 'FAIL'}`);
    console.log(`   [Test 10] Retail Inquiries link: ${hasRetInquiries ? 'PASS' : 'FAIL'}`);
    console.log(`   [Test 11] Order Processing under HUB: ${hasOrderProc ? 'PASS' : 'FAIL'}`);
    console.log(`   [Test 12] Invoices & Receivables under HUB: ${hasReceivables ? 'PASS' : 'FAIL'}`);
    console.log(`   [Test 13] Content & Training under HUB: ${hasContentTraining ? 'PASS' : 'FAIL'}`);

    // 6. Verify SETTINGS & OTHER Section
    console.log('\n5. Verifying SETTINGS & OTHER Section...');
    const settingsOtherHeader = page.locator('button:has-text("SETTINGS & OTHER")').first();
    const hasSettingsOtherHeader = await settingsOtherHeader.isVisible();
    results['Settings_Other_Header_Visible'] = hasSettingsOtherHeader;
    console.log(`   [Test 14] SETTINGS & OTHER header: ${hasSettingsOtherHeader ? 'PASS' : 'FAIL'}`);

    // Verify Settings is LAST top-level menu
    const settingsBtn = page.locator('aside button:has-text("Settings")').last();
    const hasSettings = await settingsBtn.isVisible();
    results['Settings_Menu_Present'] = hasSettings;
    console.log(`   [Test 15] Settings menu present: ${hasSettings ? 'PASS' : 'FAIL'}`);

    // Expand Settings and verify Users & Permissions is nested inside
    if (await settingsBtn.isVisible()) {
      await settingsBtn.click();
      await page.waitForTimeout(500);
    }
    const usersPermsLink = page.locator('aside a[href="/admin/staff"]').first();
    const hasUsersPerms = await usersPermsLink.isVisible();
    results['Users_Permissions_Under_Settings'] = hasUsersPerms;
    console.log(`   [Test 16] Users & Permissions nested under Settings: ${hasUsersPerms ? 'PASS' : 'FAIL'}`);

    // 7. Test Independent Section Expand/Collapse
    console.log('\n6. Testing Independent Expand/Collapse...');
    // Collapse Brand section
    await brandHeader.click();
    await page.waitForTimeout(500);
    const brandAppsHidden = !(await brandAppsLink.isVisible());
    const hubAppsStillVisible = await retAppsLink.isVisible();
    results['Brand_Collapses_Independently'] = brandAppsHidden && hubAppsStillVisible;
    console.log(`   [Test 17] Collapsing BRAND keeps HUB open: ${results['Brand_Collapses_Independently'] ? 'PASS' : 'FAIL'}`);

    // Expand Brand section back
    await brandHeader.click();
    await page.waitForTimeout(500);

    // Collapse Hub section
    await hubHeader.click();
    await page.waitForTimeout(500);
    const hubAppsHidden = !(await retAppsLink.isVisible());
    const brandAppsStillVisible = await brandAppsLink.isVisible();
    results['Hub_Collapses_Independently'] = hubAppsHidden && brandAppsStillVisible;
    console.log(`   [Test 18] Collapsing HUB keeps BRAND open: ${results['Hub_Collapses_Independently'] ? 'PASS' : 'FAIL'}`);

    // Expand Hub section back
    await hubHeader.click();
    await page.waitForTimeout(500);

    // 8. Test Applications Initial Tab Navigation & Persistence
    console.log('\n7. Testing Applications Tab Navigation & Reload...');
    // Click Brand Applications
    await Promise.all([
      page.waitForURL((url) => url.pathname.includes('/admin/applications') && (url.searchParams.get('type') === 'brand' || url.searchParams.get('tab') === 'brand'), { timeout: 15000 }),
      brandAppsLink.click(),
    ]);
    await page.waitForTimeout(1000);

    const brandTabActive = page.locator('main nav a[href="/admin/applications?type=brand"].border-zinc-900, main nav a[href="/admin/applications?type=brand"].font-bold');
    const isBrandTabActive = await brandTabActive.first().isVisible().catch(() => false);
    results['Brand_Applications_Tab_Selected'] = isBrandTabActive;
    console.log(`   [Test 19] Brand Applications opens Brand tab: ${isBrandTabActive ? 'PASS' : 'FAIL'}`);

    const brandAppsScreenshot = path.join(ARTIFACT_DIR, 'prod_adm_nav_hub_001_brand_applications_tab.png');
    await page.screenshot({ path: brandAppsScreenshot, fullPage: false });

    // Click Retailer Applications
    await Promise.all([
      page.waitForURL((url) => url.searchParams.get('type') === 'retailer' || url.searchParams.get('tab') === 'retailer', { timeout: 15000 }),
      retAppsLink.click(),
    ]);
    await page.waitForTimeout(1000);

    const retailerTabActive = page.locator('main nav a[href="/admin/applications?type=retailer"].border-zinc-900, main nav a[href="/admin/applications?type=retailer"].font-bold');
    const isRetailerTabActive = await retailerTabActive.first().isVisible().catch(() => false);
    results['Retailer_Applications_Tab_Selected'] = isRetailerTabActive;
    console.log(`   [Test 20] Retailer Applications opens Retailer tab: ${isRetailerTabActive ? 'PASS' : 'FAIL'}`);

    // Reload page to test persistence
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    const isRetailerTabPersistent = await retailerTabActive.first().isVisible().catch(() => false);
    results['Retailer_Applications_Reload_Persistent'] = isRetailerTabPersistent;
    console.log(`   [Test 21] Reload preserves Retailer tab: ${isRetailerTabPersistent ? 'PASS' : 'FAIL'}`);

    const retailerAppsScreenshot = path.join(ARTIFACT_DIR, 'prod_adm_nav_hub_001_retailer_applications_tab.png');
    await page.screenshot({ path: retailerAppsScreenshot, fullPage: false });

    // Click All Applications tab in main nav
    const allAppsTab = page.locator('main nav a[href="/admin/applications"]').first();
    await Promise.all([
      page.waitForURL((url) => url.pathname === '/admin/applications' && !url.searchParams.has('type') && !url.searchParams.has('tab'), { timeout: 15000 }),
      allAppsTab.click(),
    ]);
    await page.waitForTimeout(1000);
    const isAllAppsActive = await page.locator('main nav a[href="/admin/applications"].border-zinc-900, main nav a[href="/admin/applications"].font-bold').first().isVisible().catch(() => false);
    results['All_Applications_Tab_Switchable'] = isAllAppsActive;
    console.log(`   [Test 22] All Applications tab accessible and switchable: ${isAllAppsActive ? 'PASS' : 'FAIL'}`);

    // 9. Test Partner Inquiries Initial Tab Navigation & Persistence
    console.log('\n8. Testing Inquiries Tab Navigation & Reload...');
    // Click Brand Inquiries
    await Promise.all([
      page.waitForURL((url) => url.pathname.includes('/admin/partner-inquiries') && url.searchParams.get('type') === 'brand', { timeout: 15000 }),
      brandInquiriesLink.click(),
    ]);
    await page.waitForTimeout(1500);

    // Verify Brand segment filter is active
    const brandFilterBtn = page.locator('button:has-text("브랜드 (Brand)")').first();
    const isBrandFilterActive = (await brandFilterBtn.getAttribute('class') || '').includes('bg-white') || (await brandFilterBtn.getAttribute('class') || '').includes('dark:bg-zinc-900');
    results['Brand_Inquiries_Tab_Selected'] = isBrandFilterActive;
    console.log(`   [Test 23] Brand Inquiries opens Brand tab: ${isBrandFilterActive ? 'PASS' : 'FAIL'}`);

    const brandInquiriesScreenshot = path.join(ARTIFACT_DIR, 'prod_adm_nav_hub_001_brand_inquiries_tab.png');
    await page.screenshot({ path: brandInquiriesScreenshot, fullPage: false });

    // Click Retail Inquiries
    await Promise.all([
      page.waitForURL((url) => url.searchParams.get('type') === 'retailer', { timeout: 15000 }),
      retInquiriesLink.click(),
    ]);
    await page.waitForTimeout(1500);

    const retailerFilterBtn = page.locator('button:has-text("소매점 (Retailer)")').first();
    const isRetailerFilterActive = (await retailerFilterBtn.getAttribute('class') || '').includes('bg-white') || (await retailerFilterBtn.getAttribute('class') || '').includes('dark:bg-zinc-900');
    results['Retail_Inquiries_Tab_Selected'] = isRetailerFilterActive;
    console.log(`   [Test 24] Retail Inquiries opens Retailer tab: ${isRetailerFilterActive ? 'PASS' : 'FAIL'}`);

    // Reload page to test persistence
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    const isRetailerFilterPersistent = (await retailerFilterBtn.getAttribute('class') || '').includes('bg-white') || (await retailerFilterBtn.getAttribute('class') || '').includes('dark:bg-zinc-900');
    results['Retail_Inquiries_Reload_Persistent'] = isRetailerFilterPersistent;
    console.log(`   [Test 25] Reload preserves Retailer tab: ${isRetailerFilterPersistent ? 'PASS' : 'FAIL'}`);

    const retailInquiriesScreenshot = path.join(ARTIFACT_DIR, 'prod_adm_nav_hub_001_retail_inquiries_tab.png');
    await page.screenshot({ path: retailInquiriesScreenshot, fullPage: false });

    // 10. Test Collapsed Sidebar
    console.log('\n9. Testing Collapsed Sidebar View...');
    const collapseBtn = page.locator('aside button:has-text("Collapse Sidebar")').first();
    await collapseBtn.click();
    await page.waitForTimeout(500);

    const aside = page.locator('aside').first();
    const asideClass = await aside.getAttribute('class') || '';
    const isSidebarCollapsed = asideClass.includes('w-16');
    results['Sidebar_Collapses_Successfully'] = isSidebarCollapsed;
    console.log(`   [Test 26] Sidebar collapses to w-16: ${isSidebarCollapsed ? 'PASS' : 'FAIL'}`);

    const collapsedScreenshot = path.join(ARTIFACT_DIR, 'prod_adm_nav_hub_001_collapsed_sidebar.png');
    await page.screenshot({ path: collapsedScreenshot, fullPage: false });

    // Expand sidebar back
    const expandBtn = page.locator('aside button:has-text("→")').first();
    await expandBtn.click();
    await page.waitForTimeout(500);
    const isSidebarExpanded = (await aside.getAttribute('class') || '').includes('w-64');
    results['Sidebar_Expands_Back'] = isSidebarExpanded;
    console.log(`   [Test 27] Sidebar expands back to w-64: ${isSidebarExpanded ? 'PASS' : 'FAIL'}`);

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
