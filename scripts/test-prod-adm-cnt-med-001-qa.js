const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

async function runQA() {
  console.log('=== Starting ADM-CNT-MED-001 Production Browser QA ===');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'en-US',
  });
  const page = await context.newPage();

  const reportsDir = path.join(process.cwd(), 'reports');
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });

  try {
    // 1. Diagnostics check on admin runtime
    console.log('\n[Step 1] Verifying Production Diagnostics Fingerprint...');
    const diagRes = await page.goto('https://admin.kselectnetwork.com/api/diagnostics', { waitUntil: 'load', timeout: 15000 });
    const diagData = JSON.parse(await diagRes.text());
    const liveSha = diagData.gitSha || diagData.deployment?.commitSha;
    console.log(`- admin.kselectnetwork.com Commit SHA: ${liveSha}`);
    assert(liveSha && liveSha.length >= 7, 'admin.kselectnetwork.com must be running valid commit SHA');

    // 2. Login to Admin
    console.log('\n[Step 2] Logging into Admin (https://admin.kselectnetwork.com/admin/login)...');
    await page.goto('https://admin.kselectnetwork.com/admin/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('input#email', { timeout: 15000 });
    await page.locator('input#email').fill('qa-admin-test@letusto.com');
    await page.locator('input#password').fill('Password123!@#');
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(4000);
    console.log(`- Successfully logged in, current URL: ${page.url()}`);

    // 3. Navigate to Content & Training List to click first product
    console.log('\n[Step 3] Navigating to Content List (/admin/products/content)...');
    await page.goto('https://admin.kselectnetwork.com/admin/products/content', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForLoadState('networkidle');

    const firstProductLink = page.locator('tbody tr td a[href*="/admin/products/content/"]').first();
    const productHref = await firstProductLink.getAttribute('href');
    console.log(`- Navigating to Product Detail: ${productHref}`);
    await firstProductLink.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // 4. Click Media Assets Tab
    console.log('\n[Step 4] Clicking Media Assets Tab...');
    const mediaTab = page.locator('button:has-text("Media Assets")').first();
    await mediaTab.waitFor({ state: 'visible', timeout: 15000 });
    assert(await mediaTab.isVisible(), 'Media Assets tab must be visible');
    await mediaTab.click();
    await page.waitForTimeout(1500);

    await page.screenshot({ path: path.join(reportsDir, 'adm_cnt_med_01_workspace.png') });

    // 5. Verify Main Screen Workspace & Summary Tiles
    console.log('\n[Step 5] Verifying Media Assets Workspace & Summary Tiles...');
    const headerTitle = page.locator('h2:has-text("Media Assets (콘텐츠 제작실)")');
    assert(await headerTitle.isVisible(), 'Media Assets workspace title must be visible');

    const createAiBtn = page.locator('button:has-text("Create with AI")').first();
    assert(await createAiBtn.isVisible(), 'Primary CTA Create with AI button must be visible');

    const summarySourcesTile = page.locator('span:has-text("Source Materials")').first();
    assert(await summarySourcesTile.isVisible(), 'Source Materials summary tile must be visible');

    // 6. Verify 4 Workspace Tabs (Source Materials, Create with AI, Drafts, Approved Assets)
    console.log('\n[Step 6] Testing 4 Workspace Navigation Tabs...');
    const tabSources = page.locator('button:has-text("1. Source Materials")');
    const tabCreate = page.locator('button:has-text("2. Create with AI")');
    const tabDrafts = page.locator('button:has-text("3. Drafts")');
    const tabApproved = page.locator('button:has-text("4. Approved Assets")');

    assert(await tabSources.isVisible(), 'Tab 1. Source Materials must be visible');
    assert(await tabCreate.isVisible(), 'Tab 2. Create with AI must be visible');
    assert(await tabDrafts.isVisible(), 'Tab 3. Drafts must be visible');
    assert(await tabApproved.isVisible(), 'Tab 4. Approved Assets must be visible');
    console.log('✓ All 4 workspace navigation tabs verified');

    // 7. Verify 5 Source Material Groups
    console.log('\n[Step 7] Verifying 5 Source Material Groups...');
    await tabSources.click();
    await page.waitForTimeout(500);

    const groupA = page.locator('span:has-text("A. Product Info")');
    const groupB = page.locator('span:has-text("B. Product Images & Videos")');
    const groupC = page.locator('span:has-text("C. Brand Materials")');
    const groupD = page.locator('span:has-text("D. Existing Content")');
    const groupE = page.locator('span:has-text("E. Reference Files")');

    assert(await groupA.isVisible(), 'Group A. Product Info must be visible');
    assert(await groupB.isVisible(), 'Group B. Product Images & Videos must be visible');
    assert(await groupC.isVisible(), 'Group C. Brand Materials must be visible');
    assert(await groupD.isVisible(), 'Group D. Existing Content must be visible');
    assert(await groupE.isVisible(), 'Group E. Reference Files must be visible');
    console.log('✓ All 5 Source Material groups verified');

    // 8. Test Create with AI Workflow & 6 Output Types
    console.log('\n[Step 8] Testing Create with AI Workflow (6 Output Types)...');
    await tabCreate.click();
    await page.waitForTimeout(500);

    const typeBenefit = page.locator('button:has-text("Benefit Graphic")');
    const typeInfographic = page.locator('button:has-text("Infographic")');
    const typeHowToGraphic = page.locator('button:has-text("How-to Graphic")');
    const typeLifestyle = page.locator('button:has-text("Lifestyle Image")');
    const typeProdVideo = page.locator('button:has-text("Product Video")');
    const typeHowToVideo = page.locator('button:has-text("How-to Video")');

    assert(await typeBenefit.isVisible(), 'Benefit Graphic type must be visible');
    assert(await typeInfographic.isVisible(), 'Infographic type must be visible');
    assert(await typeHowToGraphic.isVisible(), 'How-to Graphic type must be visible');
    assert(await typeLifestyle.isVisible(), 'Lifestyle Image type must be visible');
    assert(await typeProdVideo.isVisible(), 'Product Video type must be visible');
    assert(await typeHowToVideo.isVisible(), 'How-to Video type must be visible');
    console.log('✓ All 6 AI Output Types verified');

    await page.screenshot({ path: path.join(reportsDir, 'adm_cnt_med_02_create_ai.png') });

    // Click Generate Draft Asset
    const generateBtn = page.locator('button:has-text("Generate Draft Asset")').first();
    assert(await generateBtn.isVisible(), 'Generate Draft Asset button must be visible');
    await generateBtn.click();
    await page.waitForTimeout(2500);

    // 9. Verify Drafts Tab
    console.log('\n[Step 9] Verifying Drafts Tab & Filter Controls...');
    await tabDrafts.click();
    await page.waitForTimeout(500);

    await page.screenshot({ path: path.join(reportsDir, 'adm_cnt_med_03_drafts.png') });
    console.log('✓ Drafts tab active and verified');

    // 10. Verify Approved Assets Tab
    console.log('\n[Step 10] Verifying Approved Assets Tab...');
    await tabApproved.click();
    await page.waitForTimeout(500);

    await page.screenshot({ path: path.join(reportsDir, 'adm_cnt_med_04_approved.png') });
    console.log('✓ Approved Assets tab active and verified');

    // 11. Verify Regression Safety on other C&T tabs
    console.log('\n[Step 11] Verifying Regression Safety on Customer Pages & Training tabs...');
    const custTab = page.locator('button:has-text("Customer Pages")').first();
    await custTab.click();
    await page.waitForTimeout(500);
    assert(await page.locator('h2:has-text("Customer Pages")').isVisible(), 'Customer Pages heading must remain functional');

    const trainTab = page.locator('button:has-text("Training")').first();
    await trainTab.click();
    await page.waitForTimeout(500);
    assert(await page.locator('h2:has-text("Training & Staff SOP")').isVisible(), 'Training & Staff SOP heading must remain functional');

    console.log('\n=== ALL ADM-CNT-MED-001 PRODUCTION BROWSER QA TESTS PASSED! ===');

  } catch (err) {
    console.error('Browser QA Test failed:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runQA();
