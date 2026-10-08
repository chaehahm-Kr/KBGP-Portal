const { chromium } = require('playwright');

async function runQA() {
  console.log('==============================================');
  console.log('Starting Full Production QA for RTP-AUTH-001');
  console.log('Platform: https://portal.kselecthub.com');
  console.log('==============================================\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  const results = [];

  try {
    // Step 1: Initial load of /login
    console.log('[Step 1] Navigating to https://portal.kselecthub.com/login...');
    await page.goto('https://portal.kselecthub.com/login', { waitUntil: 'networkidle' });
    const isLoginPage = page.url().includes('/login');
    console.log(` -> On Login Page: ${isLoginPage} (${page.url()})`);
    results.push({ step: '1. Navigate to Login', pass: isLoginPage });

    // Step 2: Login with valid credentials
    console.log('[Step 2] Performing login as tammyhahm@gmail.com...');
    await page.fill('input[type="email"]', 'tammyhahm@gmail.com');
    await page.fill('input[type="password"]', 'Password123!@#');
    await Promise.all([
      page.waitForNavigation({ timeout: 15000 }).catch(e => null),
      page.click('button[type="submit"]')
    ]);
    await page.waitForTimeout(2000);

    const onDashboard = page.url() === 'https://portal.kselecthub.com/' || page.url().startsWith('https://portal.kselecthub.com/?');
    const hasDashboardText = (await page.innerText('body')).includes('Tammy Chun') || (await page.innerText('body')).includes('Test Store 01');
    console.log(` -> On Dashboard: ${onDashboard}, User text found: ${hasDashboardText} (URL: ${page.url()})`);
    results.push({ step: '2. Login Authentication', pass: onDashboard && hasDashboardText });

    // Step 3: Hard Page Refresh (Session Persistence)
    console.log('[Step 3] Testing Page Refresh (F5 Session Persistence)...');
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    const reloadPersisted = page.url() === 'https://portal.kselecthub.com/' && (await page.innerText('body')).includes('Test Store 01');
    console.log(` -> Session Persisted on Reload: ${reloadPersisted}`);
    results.push({ step: '3. Refresh Session Persistence', pass: reloadPersisted });

    // Step 4: Navigation across core sections
    console.log('[Step 4] Testing Cross-Section Navigation...');
    const sections = ['/products', '/orders', '/support', '/stores'];
    let navPass = true;
    for (const path of sections) {
      await page.goto(`https://portal.kselecthub.com${path}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);
      const currentUrl = page.url();
      const stayAuthed = !currentUrl.includes('/login') && currentUrl.includes(path);
      console.log(`   - Navigated to ${path}: ${stayAuthed ? 'PASS' : 'FAIL'} (${currentUrl})`);
      if (!stayAuthed) navPass = false;
    }
    results.push({ step: '4. Cross-Section Navigation', pass: navPass });

    // Step 5: EN ↔ KO Language Switch without logout
    console.log('[Step 5] Testing Language Toggle (EN <-> KO)...');
    await page.goto('https://portal.kselecthub.com/', { waitUntil: 'networkidle' });
    // Look for language switch button/select
    const langBtn = await page.$('button:has-text("한국어"), button:has-text("EN"), [data-testid="lang-switch"]');
    if (langBtn) {
      await langBtn.click();
      await page.waitForTimeout(1000);
    }
    const stayAuthedAfterLang = !page.url().includes('/login');
    console.log(` -> Stayed Authenticated after language action: ${stayAuthedAfterLang} (${page.url()})`);
    results.push({ step: '5. Language Toggle Isolation', pass: stayAuthedAfterLang });

    // Step 6: Reload after Language Switch
    console.log('[Step 6] Testing Reload after Language Change...');
    await page.reload({ waitUntil: 'networkidle' });
    const reloadAfterLangPass = !page.url().includes('/login');
    console.log(` -> Stayed Authenticated after reload: ${reloadAfterLangPass}`);
    results.push({ step: '6. Reload after Language Change', pass: reloadAfterLangPass });

    // Step 7: Logout
    console.log('[Step 7] Testing Logout...');
    // Look for user menu or direct logout
    const userMenuBtn = await page.$('button:has-text("Tammy Chun"), [data-testid="user-menu-btn"]');
    if (userMenuBtn) {
      await userMenuBtn.click();
      await page.waitForTimeout(500);
    }
    const logoutBtn = await page.$('button:has-text("Logout"), button:has-text("Sign Out"), button:has-text("로그아웃")');
    if (logoutBtn) {
      await Promise.all([
        page.waitForNavigation({ timeout: 10000 }).catch(e => null),
        logoutBtn.click()
      ]);
      await page.waitForTimeout(1000);
    } else {
      // Direct form submit if found
      console.log('Logout button direct search or navigation...');
    }
    const onLoginAfterLogout = page.url().includes('/login');
    console.log(` -> Redirected to Login on Logout: ${onLoginAfterLogout} (${page.url()})`);
    results.push({ step: '7. Logout Flow', pass: onLoginAfterLogout });

    // Step 8: Re-login
    console.log('[Step 8] Testing Re-login...');
    await page.fill('input[type="email"]', 'tammyhahm@gmail.com');
    await page.fill('input[type="password"]', 'Password123!@#');
    await Promise.all([
      page.waitForNavigation({ timeout: 15000 }).catch(e => null),
      page.click('button[type="submit"]')
    ]);
    await page.waitForTimeout(2000);
    const reloginPass = page.url() === 'https://portal.kselecthub.com/' && (await page.innerText('body')).includes('Test Store 01');
    console.log(` -> Re-login Successful: ${reloginPass} (${page.url()})`);
    results.push({ step: '8. Re-login Verification', pass: reloginPass });

    // Step 9: Brand Portal Regression Check
    console.log('[Step 9] Checking Brand Portal Isolation (https://portal.kselectnetwork.com/portal/login)...');
    const brandPage = await context.newPage();
    await brandPage.goto('https://portal.kselectnetwork.com/portal/login', { waitUntil: 'networkidle' });
    const brandTitle = await brandPage.title();
    const brandBody = await brandPage.innerText('body');
    const brandPageLoaded = brandPage.url().includes('/portal/login') && (brandTitle.includes('K SELECT') || brandBody.includes('브랜드사'));
    console.log(` -> Brand Portal Login Page accessible: ${brandPageLoaded} (${brandPage.url()})`);
    results.push({ step: '9. Brand Portal Isolation / Zero Regression', pass: brandPageLoaded });
    await brandPage.close();

    console.log('\n==============================================');
    console.log('QA SUMMARY RESULTS:');
    results.forEach(r => console.log(` [${r.pass ? 'PASS' : 'FAIL'}] ${r.step}`));
    console.log('==============================================');

    const allPassed = results.every(r => r.pass);
    console.log(`OVERALL STATUS: ${allPassed ? 'ALL PASS' : 'SOME CHECKS FAILED'}`);

  } catch (err) {
    console.error('QA Error:', err);
  } finally {
    await browser.close();
  }
}

runQA();
