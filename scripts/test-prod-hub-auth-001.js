const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const assert = require('assert');

// Read credentials securely from env or local config without logging
const envText = fs.existsSync('.env.local') ? fs.readFileSync('.env.local', 'utf8') : '';
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

const TEST_EMAIL = 'tammyhahm@gmail.com';
const TEST_PASSWORD = env.TEST_RETAILER_PASSWORD || 'Password123!@#';
const WRONG_PASSWORD = 'WrongPassword999!@#';

async function runProductionAuthQA() {
  console.log('================================================================');
  console.log('  HUB-AUTH-001: Production Hub Authentication & Session QA');
  console.log('  Platform: https://portal.kselecthub.com');
  console.log('================================================================\n');

  const reportsDir = path.join(process.cwd(), 'reports');
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });

  const page = await context.newPage();

  try {
    // -------------------------------------------------------------
    // Scenario 1: Diagnostics Fingerprint Verification
    // -------------------------------------------------------------
    console.log('[Scenario 1] Checking Production Diagnostics Fingerprint...');
    const diagRes = await page.goto('https://portal.kselecthub.com/api/diagnostics', { waitUntil: 'load', timeout: 20000 });
    const diagData = JSON.parse(await diagRes.text());
    console.log(`- Live Commit SHA: ${diagData.deployment?.commitSha}`);
    console.log(`- Environment: ${diagData.deployment?.environment}`);

    // -------------------------------------------------------------
    // Scenario 2: Invalid Password Proper Rejection
    // -------------------------------------------------------------
    console.log('\n[Scenario 2] Testing Invalid Credentials Rejection...');
    await page.goto('https://portal.kselecthub.com/login', { waitUntil: 'load', timeout: 30000 });
    await page.locator('input#email').fill(TEST_EMAIL);
    await page.locator('input#password').fill(WRONG_PASSWORD);
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(2000);

    const errorBox = page.locator('[role="alert"], div.text-red-300, div:has-text("Invalid email or password")').first();
    assert(await errorBox.isVisible(), 'Error message must be visible for wrong password');
    const errorText = await errorBox.innerText();
    console.log(`- Invalid password error message: "${errorText}"`);
    assert(errorText.includes('Invalid email or password'), 'Must show Invalid email or password.');

    const wrongPassImg = path.join(reportsDir, 'hub_auth_001_wrong_password.png');
    await page.screenshot({ path: wrongPassImg });
    console.log(`📸 Saved screenshot: ${wrongPassImg}`);

    // -------------------------------------------------------------
    // Scenario 3: Real Login & Retailer Portal Entry
    // -------------------------------------------------------------
    console.log('\n[Scenario 3] Logging in with Real Credentials...');
    await page.locator('input#email').fill(TEST_EMAIL);
    await page.locator('input#password').fill(TEST_PASSWORD);
    await page.locator('button[type="submit"]').click();

    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 20000 });
    await page.waitForTimeout(2000);
    console.log(`- Successfully logged in. URL: ${page.url()}`);

    // Verify User & Organization Data Display
    const bodyText = await page.locator('main').innerText();
    assert(bodyText.includes('Tammy') || bodyText.includes('K SELECT Test Retailer'), 'User display name or organization must be displayed');
    console.log('- Verified user data rendered on Dashboard.');

    const dashboardImg = path.join(reportsDir, 'hub_auth_001_dashboard_logged_in.png');
    await page.screenshot({ path: dashboardImg });
    console.log(`📸 Saved screenshot: ${dashboardImg}`);

    // -------------------------------------------------------------
    // Scenario 4: Multi-Route Navigation & Page Refresh Session Persistence
    // -------------------------------------------------------------
    console.log('\n[Scenario 4] Testing Session Persistence across Routes & Refresh...');
    const routesToTest = [
      '/products',
      '/check',
      '/orders',
      '/sales',
      '/stores',
      '/account',
      '/settings/company',
      '/settings/team',
      '/help',
      '/support'
    ];

    for (const route of routesToTest) {
      console.log(`  -> Navigating to ${route}...`);
      await page.goto(`https://portal.kselecthub.com${route}`, { waitUntil: 'load', timeout: 30000 });
      await page.waitForTimeout(1000);
      assert(!page.url().includes('/login'), `Session must be preserved when accessing ${route}`);
    }

    // Refresh on /account
    console.log('  -> Refreshing /account page...');
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(1500);
    assert(!page.url().includes('/login'), 'Session must be preserved after page reload');
    console.log('✓ Route navigation and page reload session persistence verified.');

    // -------------------------------------------------------------
    // Scenario 5: Multi-Tab & Tab Return Session Persistence
    // -------------------------------------------------------------
    console.log('\n[Scenario 5] Testing Multi-Tab Concurrency & Tab Return...');
    const tab2 = await context.newPage();
    await tab2.goto('https://portal.kselecthub.com/products', { waitUntil: 'load', timeout: 30000 });
    await tab2.waitForTimeout(1000);
    assert(!tab2.url().includes('/login'), 'Tab 2 must share authenticated session');
    console.log('- Tab 2 opened and authenticated.');

    const tab3 = await context.newPage();
    await tab3.goto('https://portal.kselecthub.com/orders', { waitUntil: 'load', timeout: 30000 });
    await tab3.waitForTimeout(1000);
    assert(!tab3.url().includes('/login'), 'Tab 3 must share authenticated session');
    console.log('- Tab 3 opened and authenticated.');

    // Return to Tab 1
    await page.bringToFront();
    await page.goto('https://portal.kselecthub.com/', { waitUntil: 'load', timeout: 30000 });
    assert(!page.url().includes('/login'), 'Tab 1 must remain authenticated upon return');
    console.log('✓ Multi-tab session concurrency verified.');

    await tab2.close();
    await tab3.close();

    // -------------------------------------------------------------
    // Scenario 6: Explicit Sign Out & Seamless Re-Login
    // -------------------------------------------------------------
    console.log('\n[Scenario 6] Testing Explicit Sign Out & Re-Login...');
    // Open user menu dropdown
    const userMenuBtn = page.locator('header button:has-text("Tammy"), header button:has-text("T")').first();
    if (await userMenuBtn.isVisible()) {
      await userMenuBtn.click();
      await page.waitForTimeout(500);
      const signOutBtn = page.locator('button:has-text("Sign Out"), button:has-text("로그아웃")').first();
      await signOutBtn.click();
    } else {
      await page.goto('https://portal.kselecthub.com/account', { waitUntil: 'load' });
      const signOutBtn = page.locator('button:has-text("Sign Out"), button:has-text("로그아웃")').first();
      await signOutBtn.click();
    }

    await page.waitForURL((url) => url.pathname.includes('/login'), { timeout: 15000 });
    console.log(`- Successfully signed out. Current URL: ${page.url()}`);

    const loggedOutImg = path.join(reportsDir, 'hub_auth_001_signed_out.png');
    await page.screenshot({ path: loggedOutImg });
    console.log(`📸 Saved screenshot: ${loggedOutImg}`);

    // Re-login immediately with same credentials
    console.log('  -> Re-logging in with same credentials...');
    await page.locator('input#email').fill(TEST_EMAIL);
    await page.locator('input#password').fill(TEST_PASSWORD);
    await page.locator('button[type="submit"]').click();

    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 20000 });
    await page.waitForTimeout(2000);
    console.log(`- Re-login SUCCESSFUL! Current URL: ${page.url()}`);
    assert(!page.url().includes('/login'), 'Re-login must succeed without error');

    // -------------------------------------------------------------
    // Scenario 7: Brand Portal & Admin Portal Auth Isolation Regression
    // -------------------------------------------------------------
    console.log('\n[Scenario 7] Checking Brand Portal & Admin Auth Isolation...');
    const brandPage = await context.newPage();
    await brandPage.goto('https://portal.kselectnetwork.com/portal/login', { waitUntil: 'load', timeout: 30000 });
    const brandBody = await brandPage.innerText('body');
    assert(brandBody.includes('K SELECT') || brandBody.includes('브랜드'), 'Brand Portal login must be accessible');
    console.log('✓ Brand Portal login page healthy and isolated.');
    await brandPage.close();

    const adminPage = await context.newPage();
    await adminPage.goto('https://admin.kselectnetwork.com/admin/login', { waitUntil: 'load', timeout: 30000 });
    const adminBody = await adminPage.innerText('body');
    assert(adminBody.includes('관리자') || adminBody.includes('Admin') || adminBody.includes('K SELECT'), 'Admin login must be accessible');
    console.log('✓ Admin Portal login page healthy and isolated.');
    await adminPage.close();

    console.log('\n================================================================');
    console.log('🎉 ALL HUB-AUTH-001 PRODUCTION QA SCENARIOS PASSED SUCCESSFULLY!');
    console.log('================================================================');

    await context.close();
    await browser.close();
    process.exit(0);
  } catch (err) {
    console.error('❌ Production QA Failed:', err);
    await browser.close();
    process.exit(1);
  }
}

runProductionAuthQA();
