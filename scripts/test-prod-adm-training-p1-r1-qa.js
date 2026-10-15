const { chromium } = require('playwright');
const fs = require('fs');

async function runQA() {
  console.log('=== ADM-TRAINING-P1-001-R1 AUTOMATED PRODUCTION BROWSER QA ===\n');
  fs.mkdirSync('reports', { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const BASE_URL = 'https://admin.kselectnetwork.com';

  // 1. Authenticate as Admin
  console.log('[1/5] Authenticating as Admin...');
  await page.goto(`${BASE_URL}/admin/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.fill('input[type="email"], input#email', 'abc-manager@kselectnetwork.com');
  await page.fill('input[type="password"], input#password', 'Admin2026!@#');
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 20000 });
  console.log('✓ Admin authenticated.\n');

  // 2. Content & Training List View
  console.log('[2/5] Checking Content & Training List...');
  await page.goto(`${BASE_URL}/admin/products/content`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);

  // Locate DR120 in the list
  const dr120Row = page.locator('tr:has-text("DR120"), div:has-text("DR120")').first();
  await page.screenshot({ path: 'reports/adm_training_content_list.png' });

  // 3. Navigate to DR120 Content Detail Page
  console.log('[3/5] Navigating to DR120 Content & Training Detail Page...');
  await page.goto(`${BASE_URL}/admin/products/content/b88c8e01-c7fe-49ee-ba3a-a4deba5c00ed`, {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  await page.waitForTimeout(3000);

  // Click on Training Tab
  const trainingTab = page.locator('button:has-text("Training")').first();
  await trainingTab.click();
  await page.waitForTimeout(2000);

  // Verify Training Tab Badge displays DRAFT (not MISSING)
  const trainingTabBadgeText = await trainingTab.innerText();
  console.log(`- Training Tab Label & Badge: "${trainingTabBadgeText.replace(/\n+/g, ' ').trim()}"`);
  const hasDraftBadge = trainingTabBadgeText.toUpperCase().includes('DRAFT');
  console.log(`- Distinguishes DRAFT from MISSING: ${hasDraftBadge ? 'PASS ✓' : 'FAIL ✗'}`);

  await page.screenshot({ path: 'reports/adm_training_dr120_studio.png' });

  // 4. Source Readiness & Factual Claim Verification Card
  console.log('\n[4/5] Testing Source Readiness & Claim Attribution Breakdown...');
  const breakdownBtn = page.locator('button:has-text("Review Breakdown & Sources"), button:has-text("View Breakdown")').first();
  const breakdownExists = await breakdownBtn.isVisible();
  console.log(`- Breakdown button visible: ${breakdownExists}`);

  if (breakdownExists) {
    await breakdownBtn.click();
    await page.waitForTimeout(1000);

    // Click Tab 2: Claim Attribution
    const claimTab = page.locator('button:has-text("Claim Attribution")').first();
    if (await claimTab.isVisible()) {
      await claimTab.click();
      await page.waitForTimeout(1000);
      console.log('✓ Switched to Claim Attribution & Factual Backing tab.');
    }
    await page.screenshot({ path: 'reports/adm_training_claims_breakdown.png' });
  }

  // 5. Training Content Editor: 3 Groups & Validation Modal
  console.log('\n[5/5] Testing Editor 3 Groups & Publish Validation Safety...');
  const group1 = await page.locator('text=Group 1: Product Basics').isVisible();
  const group2 = await page.locator('text=Group 2: Selling Guide').isVisible();
  const group3 = await page.locator('text=Group 3: Handling & Safety').isVisible();
  console.log(`- Group 1 (Product Basics) visible: ${group1}`);
  console.log(`- Group 2 (Selling Guide) visible: ${group2}`);
  console.log(`- Group 3 (Handling & Safety) visible: ${group3}`);

  // Test Publish Modal Safety
  const publishBtn = page.locator('button:has-text("Publish to Network")').first();
  if (await publishBtn.isVisible()) {
    await publishBtn.click();
    await page.waitForTimeout(1000);

    const modalVisible = await page.locator('text=Approve & Publish Training Module').isVisible();
    const hasClaimCheck = await page.locator('text=Factual Claim Verification').isVisible();
    console.log(`- Publish Modal opened safely: ${modalVisible}`);
    console.log(`- Factual Claim Verification in checklist: ${hasClaimCheck}`);

    await page.screenshot({ path: 'reports/adm_training_publish_modal.png' });

    // Close Modal safely (DO NOT publish)
    const closeBtn = page.locator('button:has-text("✕"), button:has-text("Cancel")').first();
    await closeBtn.click();
    await page.waitForTimeout(500);
    console.log('✓ Publish modal closed safely without accidental publication.');
  }

  await browser.close();
  console.log('\n=== QA SUITE EXECUTED SUCCESSFULLY ===');
}

runQA().catch((err) => {
  console.error('QA failed with error:', err);
  process.exit(1);
});
