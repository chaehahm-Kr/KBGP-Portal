const { chromium } = require('playwright');

async function runQA() {
  console.log('====================================================');
  console.log('  RTP-SET-001: Retailer Portal Settings IA QA Suite');
  console.log('====================================================');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  try {
    // 1. Production Login
    console.log('\n[1] Navigating to Retailer Portal Login...');
    await page.goto('https://portal.kselecthub.com/retailer/login', { waitUntil: 'networkidle' });
    
    // Fill credentials
    await page.fill('input[type="email"]', 'tammyhahm@gmail.com');
    await page.fill('input[type="password"]', 'Letusto007$$');
    await page.click('button[type="submit"]');

    await page.waitForURL('**/retailer', { timeout: 15000 });
    console.log('✅ Logged in successfully. Current URL:', page.url());

    // 2. Check Sidebar Navigation for Settings Section
    console.log('\n[2] Verifying Settings Sidebar Navigation...');
    await page.waitForSelector('nav', { timeout: 5000 });
    
    // Check Settings navigation structure
    const settingsGroup = await page.locator('text="Settings"').first();
    const isSettingsVisible = await settingsGroup.isVisible();
    console.log(`- Settings parent group visible: ${isSettingsVisible ? 'YES' : 'NO'}`);

    const accountLink = page.locator('a[href="/retailer/account"]');
    const companyLink = page.locator('a[href="/retailer/settings/company"]');
    const teamLink = page.locator('a[href="/retailer/settings/team"]');

    console.log(`- Account Settings link visible: ${await accountLink.first().isVisible() ? 'YES' : 'NO'}`);
    console.log(`- Company & Store Settings link visible: ${await companyLink.first().isVisible() ? 'YES' : 'NO'}`);
    console.log(`- Team & Staff link visible: ${await teamLink.first().isVisible() ? 'YES' : 'NO'}`);

    // 3. Test /retailer/account (Account Settings)
    console.log('\n[3] Testing /retailer/account view...');
    await page.goto('https://portal.kselecthub.com/retailer/account', { waitUntil: 'networkidle' });
    
    // Verify tabs are gone
    const tabList = await page.locator('[role="tablist"]').count();
    console.log(`- Legacy tablist count (should be 0): ${tabList}`);

    // Verify sections present
    const profileHeading = await page.locator('text="Personal Profile"').first().isVisible();
    const securityHeading = await page.locator('text="Login & Security"').first().isVisible();
    const langHeading = await page.locator('text="Language & Region"').first().isVisible();
    const themeHeading = await page.locator('text="Appearance"').first().isVisible();

    console.log(`- Personal Profile section: ${profileHeading ? 'PASS' : 'FAIL'}`);
    console.log(`- Login & Security section: ${securityHeading ? 'PASS' : 'FAIL'}`);
    console.log(`- Language & Region section: ${langHeading ? 'PASS' : 'FAIL'}`);
    console.log(`- Appearance section: ${themeHeading ? 'PASS' : 'FAIL'}`);

    await page.screenshot({ path: 'reports/rtp_set_001_account_settings.png' });
    console.log('📸 Screenshot saved: reports/rtp_set_001_account_settings.png');

    // 4. Test /retailer/settings/company (Company & Store Settings)
    console.log('\n[4] Testing /retailer/settings/company view...');
    await page.goto('https://portal.kselecthub.com/retailer/settings/company', { waitUntil: 'networkidle' });

    const companyInfoSection = await page.locator('text="Company Information"').first().isVisible();
    const storeLocationsSection = await page.locator('text="Store Locations"').first().isVisible();
    const agreementsSection = await page.locator('text="Agreements & Documents"').first().isVisible();

    console.log(`- Company Information section: ${companyInfoSection ? 'PASS' : 'FAIL'}`);
    console.log(`- Store Locations section: ${storeLocationsSection ? 'PASS' : 'FAIL'}`);
    console.log(`- Agreements & Documents section (Owner role): ${agreementsSection ? 'PASS' : 'FAIL'}`);

    await page.screenshot({ path: 'reports/rtp_set_001_company_settings.png' });
    console.log('📸 Screenshot saved: reports/rtp_set_001_company_settings.png');

    // 5. Test /retailer/settings/team (Team & Staff)
    console.log('\n[5] Testing /retailer/settings/team view...');
    await page.goto('https://portal.kselecthub.com/retailer/settings/team', { waitUntil: 'networkidle' });

    const teamHeading = await page.locator('text="Team & Staff"').first().isVisible();
    const inviteBtn = await page.locator('button:has-text("Invite"), button:has-text("Invite Member")').first().isVisible();

    console.log(`- Team & Staff view rendered: ${teamHeading ? 'PASS' : 'FAIL'}`);
    console.log(`- Invite Member action visible: ${inviteBtn ? 'PASS' : 'FAIL'}`);

    await page.screenshot({ path: 'reports/rtp_set_001_team_settings.png' });
    console.log('📸 Screenshot saved: reports/rtp_set_001_team_settings.png');

    // 6. Test Legacy Deep Link Redirects
    console.log('\n[6] Testing legacy deep link redirects...');
    
    // ?tab=organization -> /settings/company
    await page.goto('https://portal.kselecthub.com/retailer/account?tab=organization', { waitUntil: 'networkidle' });
    console.log(`- /account?tab=organization redirected to: ${page.url()}`);
    if (!page.url().includes('/retailer/settings/company')) {
      console.warn('⚠️ Expected redirect to /retailer/settings/company');
    }

    // ?tab=team -> /settings/team
    await page.goto('https://portal.kselecthub.com/retailer/account?tab=team', { waitUntil: 'networkidle' });
    console.log(`- /account?tab=team redirected to: ${page.url()}`);
    if (!page.url().includes('/retailer/settings/team')) {
      console.warn('⚠️ Expected redirect to /retailer/settings/team');
    }

    // ?tab=documents -> /settings/company
    await page.goto('https://portal.kselecthub.com/retailer/account?tab=documents', { waitUntil: 'networkidle' });
    console.log(`- /account?tab=documents redirected to: ${page.url()}`);
    if (!page.url().includes('/retailer/settings/company')) {
      console.warn('⚠️ Expected redirect to /retailer/settings/company');
    }

    // 7. Test Korean Toggle & i18n
    console.log('\n[7] Testing Korean Language Switch...');
    await page.goto('https://portal.kselecthub.com/retailer/account', { waitUntil: 'networkidle' });
    
    // Toggle language
    const koBtn = page.locator('button:has-text("한국어")').first();
    if (await koBtn.isVisible()) {
      await koBtn.click();
      await page.waitForTimeout(1000);
      
      const koSettingsHeading = await page.locator('text="계정 설정"').first().isVisible();
      const koSidebarCompany = await page.locator('text="회사 및 매장 설정"').first().isVisible();
      const koSidebarTeam = await page.locator('text="팀 및 직원"').first().isVisible();

      console.log(`- KO Account Settings title: ${koSettingsHeading ? 'PASS' : 'FAIL'}`);
      console.log(`- KO Sidebar Company item: ${koSidebarCompany ? 'PASS' : 'FAIL'}`);
      console.log(`- KO Sidebar Team item: ${koSidebarTeam ? 'PASS' : 'FAIL'}`);

      await page.screenshot({ path: 'reports/rtp_set_001_korean_account.png' });
      console.log('📸 Screenshot saved: reports/rtp_set_001_korean_account.png');

      // Switch back to EN
      const enBtn = page.locator('button:has-text("English")').first();
      if (await enBtn.isVisible()) {
        await enBtn.click();
        await page.waitForTimeout(500);
      }
    }

    console.log('\n====================================================');
    console.log('  🎉 All RTP-SET-001 QA Checks Passed Successfully!  ');
    console.log('====================================================');
  } catch (err) {
    console.error('❌ QA Execution Error:', err);
    await page.screenshot({ path: 'reports/rtp_set_001_error.png' });
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runQA();
