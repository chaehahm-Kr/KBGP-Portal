const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { chromium } = require('playwright');

async function runQa() {
  console.log('================================================================');
  console.log('STARTING PRODUCTION BROWSER QA FOR RTP-DASH-001');
  console.log('================================================================');

  const reportsDir = path.join(process.cwd(), 'reports');
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  
  // Desktop test context
  const desktopContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await desktopContext.newPage();

  try {
    // 1. Diagnostics Fingerprint
    console.log('\n[Step 1] Checking Production Diagnostics Fingerprint...');
    const diagRes = await page.goto('https://portal.kselecthub.com/api/diagnostics', { waitUntil: 'load', timeout: 15000 });
    const diagData = JSON.parse(await diagRes.text());
    console.log(`- Live Deployment Commit SHA: ${diagData.deployment?.commitSha}`);
    console.log(`- Runtime Environment: ${diagData.deployment?.environment}`);
    assert(diagData.deployment?.commitSha?.startsWith('7d456ba'), 'Commit SHA must match 7d456ba');

    // 2. Retailer Login
    console.log('\n[Step 2] Logging into Retailer Portal (https://portal.kselecthub.com/login)...');
    await page.goto('https://portal.kselecthub.com/login', { waitUntil: 'load', timeout: 30000 });
    await page.locator('input#email').fill('tammyhahm@gmail.com');
    await page.locator('input#password').fill('Password123!@#');
    await page.locator('button[type="submit"]').click();
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });
    console.log(`- Successfully logged in, current URL: ${page.url()}`);

    // Wait for Dashboard to render
    await page.waitForTimeout(1500);

    // 3. Validate Compact Welcome Area
    console.log('\n[Step 3] Validating Compact Welcome Area...');
    const welcomeHeader = page.locator('h1:has-text("Welcome")');
    assert(await welcomeHeader.isVisible(), 'Welcome heading must be visible');
    const welcomeText = await welcomeHeader.innerText();
    console.log(`- Welcome Heading: "${welcomeText}"`);

    const verifiedBadge = page.locator('div:has-text("Verified Wholesale Partner")').first();
    assert(await verifiedBadge.isVisible(), 'Verified Wholesale Partner badge must be visible');

    // Check integrated metadata line (Company, Role, Stores)
    const metaBlock = page.locator('div:has-text("K SELECT Test Retailer")').first();
    assert(await metaBlock.isVisible(), 'Integrated company info must be visible inside Welcome area');
    const metaText = await metaBlock.innerText();
    console.log(`- Integrated Meta Block: "${metaText.replace(/\n/g, ' ')}"`);

    // Verify old 3 separate big cards are removed
    const oldOrgCard = await page.locator('div.uppercase:has-text("Retail Organization")').count();
    const oldRoleCard = await page.locator('div.uppercase:has-text("User Role")').count();
    console.log(`- Old separate cards count: Retail Org (${oldOrgCard}), User Role (${oldRoleCard})`);
    assert.strictEqual(oldOrgCard, 0, 'Old Retail Organization standalone card must be removed');
    assert.strictEqual(oldRoleCard, 0, 'Old User Role standalone card must be removed');

    const welcomeImg = path.join(reportsDir, 'rtp_dash_001_welcome_compact.png');
    await page.screenshot({ path: welcomeImg, fullPage: false });
    console.log(`✓ Saved screenshot: ${welcomeImg}`);

    // 4. Validate Action Required Section
    console.log('\n[Step 4] Validating "Action Required" Section...');
    const actionRequiredHeader = page.locator('h2:has-text("Action Required")');
    assert(await actionRequiredHeader.isVisible(), 'Action Required header must be visible');

    // Check if actions or all-caught-up banner is rendered
    const allCaughtUp = page.locator('div:has-text("You\'re all caught up")');
    const actionCards = page.locator('a[href="/check"], a[href="/sales"], a[href="/orders"], a[href="/support"]').filter({ has: page.locator('p.font-bold') });
    
    if (await allCaughtUp.isVisible()) {
      console.log('✓ All-caught-up banner displayed ("You\'re all caught up.")');
    } else {
      const count = await actionCards.count();
      console.log(`✓ Action Required cards active count: ${count}`);
      assert(count > 0, 'Action Required should show actionable items when tasks exist');
    }

    // 5. Validate 30-Day Demand & Sales Summary
    console.log('\n[Step 5] Validating 30-Day Demand & Sales Summary...');
    const demandSummaryHeader = page.locator('h2:has-text("30-Day Demand & Sales Summary")');
    assert(await demandSummaryHeader.isVisible(), '30-Day Demand & Sales Summary must be visible');

    const unitsMoved = page.locator('span:has-text("Est. Units Moved")');
    const retailValue = page.locator('span:has-text("Est. Retail Value")');
    const grossProfit = page.locator('span:has-text("Est. Gross Profit")');
    const reorderAlerts = page.locator('span:has-text("Reorder Alerts")').first();

    assert(await unitsMoved.isVisible(), 'Est. Units Moved metric card must be visible');
    assert(await retailValue.isVisible(), 'Est. Retail Value metric card must be visible');
    assert(await grossProfit.isVisible(), 'Est. Gross Profit metric card must be visible');
    assert(await reorderAlerts.isVisible(), 'Reorder Alerts metric card must be visible');

    const demandImg = path.join(reportsDir, 'rtp_dash_001_demand_summary.png');
    await page.screenshot({ path: demandImg, fullPage: false });
    console.log(`✓ Saved screenshot: ${demandImg}`);

    // 6. Validate Quick Actions Refinement
    console.log('\n[Step 6] Validating Refined Quick Actions (6 Cards)...');
    const quickActionsSection = page.locator('div').filter({ has: page.locator('h2', { hasText: 'Retailer Quick Actions' }) }).first();
    assert(await quickActionsSection.isVisible(), 'Retailer Quick Actions section must be visible');

    const expectedCards = [
      { title: 'Browse Products', href: '/products' },
      { title: 'Weekly Check', href: '/check' },
      { title: 'Orders & Reorder', href: '/orders' },
      { title: 'Sales & Reorder Analytics', href: '/sales' },
      { title: 'Training & Guides', href: '/training' },
      { title: 'Company & Store Settings', href: '/stores' },
    ];

    for (const card of expectedCards) {
      const cardLocator = quickActionsSection.locator(`a[href="${card.href}"]`).filter({ hasText: card.title });
      const isVisible = await cardLocator.first().isVisible();
      console.log(`  ✓ Quick Action: "${card.title}" (${card.href}) -> Visible: ${isVisible}`);
      assert(isVisible, `Quick action card "${card.title}" must be visible`);
    }

    const quickActionsImg = path.join(reportsDir, 'rtp_dash_001_quick_actions.png');
    await page.screenshot({ path: quickActionsImg, fullPage: false });
    console.log(`✓ Saved screenshot: ${quickActionsImg}`);

    // 7. Audit English Mode for Korean Leakage
    console.log('\n[Step 7] Auditing English Mode for Korean Leakage...');
    const bodyTextEn = await page.locator('main').innerText();
    const koreanRegex = /[\uac00-\ud7a3]/g;
    const koreanMatches = bodyTextEn.match(koreanRegex) || [];
    console.log(`- Korean characters detected on English dashboard: ${koreanMatches.length}`);
    if (koreanMatches.length > 0) {
      console.warn(`⚠️ Warning: Found Korean text in English mode: ${koreanMatches.slice(0, 10).join('')}`);
    }
    assert.strictEqual(koreanMatches.length, 0, 'English mode must have 0 Korean characters');

    // 8. Test Korean Mode Switcher
    console.log('\n[Step 8] Testing Korean Mode Switcher and Translations...');
    const koBtn = page.locator('header button:has-text("한국어")').first();
    if (await koBtn.isVisible()) {
      await koBtn.click();
      await page.waitForTimeout(1000);
      await page.reload({ waitUntil: 'load' });
      await page.waitForTimeout(1000);
      console.log('- Switched to Korean locale & reloaded page');

      // Verify Korean translations on Dashboard
      const koWelcome = page.locator('h1:has-text("환영합니다")');
      assert(await koWelcome.isVisible(), 'Korean Welcome header must be visible');

        const koActionRequired = page.locator('h2:has-text("확인 필요 업무")');
        assert(await koActionRequired.isVisible(), 'Korean Action Required header must be visible');

        const koQuickSection = page.locator('div').filter({ has: page.locator('h2', { hasText: '리테일러 주요 바로가기' }) }).first();
        assert(await koQuickSection.isVisible(), 'Korean quick actions section must be visible');

        const koBrowseProducts = koQuickSection.locator('a[href="/products"]').filter({ hasText: '제품 둘러보기' });
        assert(await koBrowseProducts.first().isVisible(), 'Korean "제품 둘러보기" quick action must be visible');

        const koWeeklyCheck = koQuickSection.locator('a[href="/check"]').filter({ hasText: '주간 재고 점검' });
        assert(await koWeeklyCheck.first().isVisible(), 'Korean "주간 재고 점검" quick action must be visible');

        const koOrders = koQuickSection.locator('a[href="/orders"]').filter({ hasText: '주문 및 재발주' });
        assert(await koOrders.first().isVisible(), 'Korean "주문 및 재발주" quick action must be visible');

        const koSales = koQuickSection.locator('a[href="/sales"]').filter({ hasText: '매출 및 재발주 분석' });
        assert(await koSales.first().isVisible(), 'Korean "매출 및 재발주 분석" quick action must be visible');

        const koTraining = koQuickSection.locator('a[href="/training"]').filter({ hasText: '제품 교육 및 가이드' });
        assert(await koTraining.first().isVisible(), 'Korean "제품 교육 및 가이드" quick action must be visible');

        const koStores = koQuickSection.locator('a[href="/stores"]').filter({ hasText: '기업 및 매장 설정' });
        assert(await koStores.first().isVisible(), 'Korean "기업 및 매장 설정" quick action must be visible');

        const koDashboardImg = path.join(reportsDir, 'rtp_dash_001_korean_dashboard.png');
        await page.screenshot({ path: koDashboardImg, fullPage: true });
        console.log(`✓ Saved screenshot: ${koDashboardImg}`);

        // Switch back to English
        const enBtn = page.locator('header button:has-text("EN")').first();
        if (await enBtn.isVisible()) {
          await enBtn.click();
          await page.waitForTimeout(1000);
          await page.reload({ waitUntil: 'load' });
          console.log('- Switched back to English locale');
        }
    }

    // 9. Mobile Viewport Validation (390x844)
    console.log('\n[Step 9] Validating Mobile Viewport (390x844)...');
    const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)' });
    const mobilePage = await mobileContext.newPage();

    await mobilePage.goto('https://portal.kselecthub.com/login', { waitUntil: 'load', timeout: 30000 });
    await mobilePage.locator('input#email').fill('tammyhahm@gmail.com');
    await mobilePage.locator('input#password').fill('Password123!@#');
    await mobilePage.locator('button[type="submit"]').click();
    await mobilePage.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });
    await mobilePage.waitForTimeout(1500);

    const mobileDashboardImg = path.join(reportsDir, 'rtp_dash_001_mobile_dashboard.png');
    await mobilePage.screenshot({ path: mobileDashboardImg, fullPage: true });
    console.log(`✓ Saved screenshot: ${mobileDashboardImg}`);

    console.log('\n================================================================');
    console.log('🎉 ALL PRODUCTION QA TESTS PASSED SUCCESSFULLY FOR RTP-DASH-001');
    console.log('================================================================');

    await desktopContext.close();
    await mobileContext.close();
    await browser.close();
    process.exit(0);
  } catch (err) {
    console.error('❌ Production QA Failed:', err);
    await browser.close();
    process.exit(1);
  }
}

runQa();
