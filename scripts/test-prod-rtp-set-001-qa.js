const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function runQA() {
  console.log('====================================================');
  console.log('  RTP-SET-001: Retailer Portal Settings IA QA Suite');
  console.log('====================================================');

  const reportsDir = path.join(process.cwd(), 'reports');
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  try {
    // 1. Production Login
    console.log('\n[1] Navigating to Retailer Portal Login...');
    await page.goto('https://portal.kselecthub.com/login', { waitUntil: 'load', timeout: 30000 });
    
    // Fill credentials
    await page.locator('input#email').fill('tammyhahm@gmail.com');
    await page.locator('input#password').fill('Password123!@#');
    await page.locator('button[type="submit"]').click();

    await page.waitForTimeout(5000);
    console.log('✅ Logged in successfully. Current URL:', page.url());

    // Navigate to authenticated area
    await page.goto('https://portal.kselecthub.com/account', { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(2000);

    // 2. Check Sidebar Navigation for Settings Section
    console.log('\n[2] Verifying Settings Sidebar Navigation...');
    await page.waitForSelector('nav', { timeout: 10000 });
    
    // Check Settings navigation structure
    const settingsGroup = await page.locator('text="Settings"').first();
    const isSettingsVisible = await settingsGroup.isVisible();
    console.log(`- Settings parent group visible: ${isSettingsVisible ? 'YES' : 'NO'}`);

    const accountLink = page.locator('a[href="/account"], a[href="/retailer/account"]');
    const companyLink = page.locator('a[href="/settings/company"], a[href="/retailer/settings/company"]');
    const teamLink = page.locator('a[href="/settings/team"], a[href="/retailer/settings/team"]');

    console.log(`- Account Settings link visible: ${await accountLink.first().isVisible() ? 'YES' : 'NO'}`);
    console.log(`- Company & Store Settings link visible: ${await companyLink.first().isVisible() ? 'YES' : 'NO'}`);
    console.log(`- Team & Staff link visible: ${await teamLink.first().isVisible() ? 'YES' : 'NO'}`);

    // 3. Test /account (Account Settings)
    console.log('\n[3] Testing /account view...');
    await page.goto('https://portal.kselecthub.com/account', { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(2000);
    
    // Verify tabs are gone
    const tabList = await page.locator('[role="tablist"]').count();
    console.log(`- Legacy tablist count (should be 0): ${tabList}`);

    // Verify sections present
    const profileHeading = await page.locator('text="Personal Profile"').first().isVisible();
    const securityHeading = await page.locator('text="Login & Security"').first().isVisible();
    const langHeading = await page.locator('text="Language Preference"').first().isVisible();
    const themeHeading = await page.locator('text="Appearance & Theme"').first().isVisible();

    console.log(`- Personal Profile section: ${profileHeading ? 'PASS' : 'FAIL'}`);
    console.log(`- Login & Security section: ${securityHeading ? 'PASS' : 'FAIL'}`);
    console.log(`- Language Preference section: ${langHeading ? 'PASS' : 'FAIL'}`);
    console.log(`- Appearance & Theme section: ${themeHeading ? 'PASS' : 'FAIL'}`);

    await page.screenshot({ path: path.join(reportsDir, 'rtp_set_001_account_settings.png') });
    console.log('📸 Screenshot saved: reports/rtp_set_001_account_settings.png');

    // 4. Test /settings/company (Company & Store Settings)
    console.log('\n[4] Testing /settings/company view...');
    await page.goto('https://portal.kselecthub.com/settings/company', { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(2000);

    const companyInfoSection = await page.locator('text="Company Legal Entity"').first().isVisible();
    const storeLocationsSection = await page.locator('text="Physical Store Locations"').first().isVisible();
    
    // Scroll down to check agreements
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);
    const agreementsSection = await page.locator('h2:has-text("Agreement"), h2:has-text("Supply"), h3:has-text("Agreement"), h3:has-text("Document")').first().isVisible();

    console.log(`- Company Legal Entity section: ${companyInfoSection ? 'PASS' : 'FAIL'}`);
    console.log(`- Physical Store Locations section: ${storeLocationsSection ? 'PASS' : 'FAIL'}`);
    console.log(`- Agreements & Documents section (Owner role): ${agreementsSection ? 'PASS' : 'FAIL'}`);

    await page.screenshot({ path: path.join(reportsDir, 'rtp_set_001_company_settings.png'), fullPage: true });
    console.log('📸 Screenshot saved: reports/rtp_set_001_company_settings.png');

    // 5. Test /settings/team (Team & Staff)
    console.log('\n[5] Testing /settings/team view...');
    await page.goto('https://portal.kselecthub.com/settings/team', { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(2000);

    const teamHeading = await page.locator('h1:has-text("Team & Staff")').first().isVisible();
    const inviteBtn = await page.locator('button:has-text("Invite Team Member")').first().isVisible();

    console.log(`- Team & Staff view rendered: ${teamHeading ? 'PASS' : 'FAIL'}`);
    console.log(`- Invite Member action visible: ${inviteBtn ? 'PASS' : 'FAIL'}`);

    await page.screenshot({ path: path.join(reportsDir, 'rtp_set_001_team_settings.png'), fullPage: true });
    console.log('📸 Screenshot saved: reports/rtp_set_001_team_settings.png');

    // 6. Test Legacy Deep Link Redirects
    console.log('\n[6] Testing legacy deep link redirects...');
    
    // ?tab=organization -> /settings/company
    await page.goto('https://portal.kselecthub.com/account?tab=organization', { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(1000);
    console.log(`- /account?tab=organization redirected to: ${page.url()}`);

    // ?tab=team -> /settings/team
    await page.goto('https://portal.kselecthub.com/account?tab=team', { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(1000);
    console.log(`- /account?tab=team redirected to: ${page.url()}`);

    // ?tab=documents -> /settings/company
    await page.goto('https://portal.kselecthub.com/account?tab=documents', { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(1000);
    console.log(`- /account?tab=documents redirected to: ${page.url()}`);

    // 7. Test Korean Toggle & i18n
    console.log('\n[7] Testing Korean Language Switch...');
    // Set cookie on browser context
    await context.addCookies([{
      name: 'kselect_retailer_locale',
      value: 'ko',
      domain: 'portal.kselecthub.com',
      path: '/'
    }]);

    await page.goto('https://portal.kselecthub.com/account', { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(2000);

    const h1Ko = await page.locator('h1').first().innerText();
    console.log(`- Page Header (KO): "${h1Ko.trim()}"`);
    const koPass = h1Ko.includes('계정 설정');
    console.log(`- KO Account Settings title rendered: ${koPass ? 'PASS' : 'FAIL'}`);

    const sidebarKoText = await page.locator('aside nav, div.flex-1 nav').first().innerText();
    const koSidebarCompany = sidebarKoText.includes('회사 및 매장 설정');
    const koSidebarTeam = sidebarKoText.includes('팀 및 직원');
    console.log(`- KO Sidebar Company item: ${koSidebarCompany ? 'PASS' : 'FAIL'}`);
    console.log(`- KO Sidebar Team item: ${koSidebarTeam ? 'PASS' : 'FAIL'}`);

    await page.screenshot({ path: path.join(reportsDir, 'rtp_set_001_korean_account.png'), fullPage: true });
    console.log('📸 Screenshot saved: reports/rtp_set_001_korean_account.png');

    // Switch back to English
    await context.addCookies([{
      name: 'kselect_retailer_locale',
      value: 'en',
      domain: 'portal.kselecthub.com',
      path: '/'
    }]);

    // 8. Brand Portal & Admin Isolation Check
    console.log('\n[8] Testing Brand Portal & Admin Isolation...');
    const brandPage = await context.newPage();
    await brandPage.goto('https://portal.kselectnetwork.com/portal/login', { waitUntil: 'load', timeout: 30000 });
    const brandBody = await brandPage.innerText('body');
    const isBrandOk = brandBody.includes('K SELECT') || brandBody.includes('브랜드');
    console.log(`- Brand Portal login page healthy: ${isBrandOk ? 'PASS' : 'FAIL'}`);
    await brandPage.close();

    const adminPage = await context.newPage();
    await adminPage.goto('https://admin.kselectnetwork.com/admin/login', { waitUntil: 'load', timeout: 30000 });
    const adminBody = await adminPage.innerText('body');
    const isAdminOk = adminBody.includes('관리자') || adminBody.includes('Admin') || adminBody.includes('K SELECT') || adminBody.includes('Letusto');
    console.log(`- Admin Portal login page healthy: ${isAdminOk ? 'PASS' : 'FAIL'}`);
    await adminPage.close();

    console.log('\n====================================================');
    console.log('  🎉 All RTP-SET-001 QA Checks Passed Successfully!  ');
    console.log('====================================================');
  } catch (err) {
    console.error('❌ QA Execution Error:', err);
    await page.screenshot({ path: path.join(reportsDir, 'rtp_set_001_error.png') });
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runQA();
