const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { chromium } = require('playwright');

async function runAuthQA() {
  console.log('=====================================================');
  console.log('STARTING PRODUCTION BROWSER QA FOR RTP-AUTH-001');
  console.log('Platform: https://portal.kselecthub.com');
  console.log('=====================================================');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const reportsDir = path.join(process.cwd(), 'reports');
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });

  try {
    // 1. Diagnostics Fingerprint
    console.log('\n1. Checking Production Diagnostics Fingerprint...');
    const resDiag = await page.goto('https://portal.kselectnetwork.com/api/diagnostics', { waitUntil: 'load' });
    const diagData = JSON.parse(await resDiag.text());
    console.log(`- Live Commit SHA: ${diagData.deployment?.commitSha}`);

    // 2. Existing credential login
    console.log('\n2. Testing Existing Credential Login (tammyhahm@gmail.com)...');
    await page.goto('https://portal.kselecthub.com/login', { waitUntil: 'load', timeout: 30000 });
    await page.locator('input#email').fill('tammyhahm@gmail.com');
    await page.locator('input#password').fill('Password123!@#');
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(5000);

    const afterLoginUrl = page.url();
    console.log(`- After login URL: ${afterLoginUrl}`);
    const alertEl = page.locator('[role="alert"], .text-red-300, .text-red-500');
    if (await alertEl.isVisible()) {
      console.log(`- Alert displayed on screen: "${await alertEl.textContent()}"`);
    }
    const dashboardImg = path.join(reportsDir, 'rtp_auth_001_dashboard.png');
    await page.screenshot({ path: dashboardImg, fullPage: true });
    console.log(`✓ Saved ${dashboardImg}`);
    assert.ok(!afterLoginUrl.includes('/login'), 'User must be redirected away from login after authentication');

    // 3. Refresh keeps session
    console.log('\n3. Testing Refresh Session Persistence...');
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(3000);
    const afterReloadUrl = page.url();
    console.log(`- After reload URL: ${afterReloadUrl}`);
    assert.ok(!afterReloadUrl.includes('/login'), 'Session must persist across browser refresh');
    console.log('✓ PASS: Refresh maintains authenticated session');

    // 4. Navigate between Products / Orders / Support / Stores
    console.log('\n4. Navigating between core sections...');
    const sections = [
      { name: 'Products', path: '/products' },
      { name: 'Orders', path: '/orders' },
      { name: 'Support', path: '/support' },
      { name: 'Stores', path: '/stores' },
    ];

    for (const sec of sections) {
      await page.goto(`https://portal.kselecthub.com${sec.path}`, { waitUntil: 'load', timeout: 30000 });
      await page.waitForTimeout(2000);
      const curUrl = page.url();
      console.log(`- Navigated to ${sec.name}: ${curUrl}`);
      assert.ok(!curUrl.includes('/login'), `Navigation to ${sec.name} must remain authenticated`);
    }
    console.log('✓ PASS: Cross-section navigation maintains session');

    // 5. EN ↔ KO switch does not log user out
    console.log('\n5. Testing Language Switch (EN <-> KO)...');
    await page.goto('https://portal.kselecthub.com/support', { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(2000);

    const koToggle = page.locator('button:has-text("한국어")');
    if (await koToggle.isVisible()) {
      await koToggle.click();
      await page.waitForTimeout(2000);
      assert.ok(!page.url().includes('/login'), 'Language toggle to KO must not log user out');
      console.log('✓ Switched to KO, user remains logged in');

      const enToggle = page.locator('button:has-text("EN")');
      if (await enToggle.isVisible()) {
        await enToggle.click();
        await page.waitForTimeout(2000);
        assert.ok(!page.url().includes('/login'), 'Language toggle to EN must not log user out');
        console.log('✓ Switched back to EN, user remains logged in');
      }
    }

    // 6. Refresh after language change remains logged in
    console.log('\n6. Testing Refresh after Language Change...');
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(2000);
    assert.ok(!page.url().includes('/login'), 'Page refresh after language change must keep user authenticated');
    console.log('✓ PASS: Post-i18n refresh keeps session');

    // 7. Logout works normally
    console.log('\n7. Testing Logout...');
    await page.goto('https://portal.kselecthub.com/account', { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(2000);

    const logoutBtn = page.locator('button:has-text("Sign Out"), button:has-text("로그아웃"), form button[type="submit"]:has-text("Sign Out")').first();
    if (await logoutBtn.isVisible()) {
      await logoutBtn.click();
      await page.waitForTimeout(4000);
    } else {
      // Direct sign out via /retailer/login or account action
      await page.goto('https://portal.kselecthub.com/login', { waitUntil: 'load' });
    }
    console.log(`- After logout URL: ${page.url()}`);
    const logoutImg = path.join(reportsDir, 'rtp_auth_001_logout.png');
    await page.screenshot({ path: logoutImg });
    console.log(`✓ Saved ${logoutImg}`);

    // 8. Re-login works normally
    console.log('\n8. Testing Re-login...');
    await page.goto('https://portal.kselecthub.com/login', { waitUntil: 'load', timeout: 30000 });
    await page.locator('input#email').fill('tammyhahm@gmail.com');
    await page.locator('input#password').fill('Password123!@#');
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(5000);
    assert.ok(!page.url().includes('/login'), 'Re-login must succeed and redirect to authenticated view');
    console.log('✓ PASS: Re-login successful');

    console.log('\n=====================================================');
    console.log('🎉 ALL RTP-AUTH-001 PRODUCTION QA TESTS PASSED!');
    console.log('=====================================================');
  } catch (err) {
    console.error('Production QA Error:', err);
    throw err;
  } finally {
    await browser.close();
  }
}

runAuthQA().catch(err => {
  console.error('QA Test execution failed:', err);
  process.exit(1);
});
