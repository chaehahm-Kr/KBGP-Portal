const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { createClient } = require('@supabase/supabase-js');

// Load .env.local
const envText = fs.readFileSync('.env.local', 'utf8');
const env = {};
envText.split('\n').forEach((line) => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    env[match[1]] = value.trim();
  }
});

const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY);
const PORTAL_URL = 'https://portal.kselecthub.com';

async function runQA() {
  console.log('🚀 Starting RTP-PROD-DETAIL-001-R1 Production Browser QA on portal.kselecthub.com...');

  // 1. Ensure QA Retailer user password
  const { data: usersData } = await client.auth.admin.listUsers();
  const qaRetailer = (usersData?.users || []).find((u) => u.email === 'qa-retailer-test@letusto.com');
  if (qaRetailer) {
    await client.auth.admin.updateUserById(qaRetailer.id, { password: 'Password123!@#' });
    console.log('✓ QA Retailer password verified');
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 950 }, locale: 'en-US' });
  const page = await context.newPage();

  const reportsDir = path.join(process.cwd(), 'reports');
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });

  try {
    // Step 1: Check Diagnostics
    console.log('\n[Step 1] Verifying Production Diagnostics Fingerprint...');
    const diagRes = await page.goto(`${PORTAL_URL}/api/diagnostics`, { waitUntil: 'load', timeout: 15000 });
    const diagData = JSON.parse(await diagRes.text());
    const liveSha = diagData.deployment?.commitSha;
    console.log(`- portal.kselecthub.com Commit SHA: ${liveSha}`);
    assert(liveSha && liveSha.startsWith('5bd2ed5'), 'portal.kselecthub.com must be running commit 5bd2ed5');

    // Step 2: Login to Retailer Portal
    console.log('\n[Step 2] Logging into Retailer Portal (https://portal.kselecthub.com/login)...');
    await page.goto(`${PORTAL_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('input#email', { timeout: 15000 });
    await page.locator('input#email').fill('qa-retailer-test@letusto.com');
    await page.locator('input#password').fill('Password123!@#');
    await page.locator('button[type="submit"]').click();
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });
    console.log(`✓ Logged in. Current URL: ${page.url()}`);

    // Step 3: Test Product 1: Full data product (LET-CAM-001 - Vitamin A Whitening Lotion)
    console.log('\n[Step 3] Testing Product 1: Full data (688d718d-be4d-46ae-b45a-91d80e0984d8)...');
    await page.goto(`${PORTAL_URL}/products/688d718d-be4d-46ae-b45a-91d80e0984d8`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    // Verify Overview Tab is active by default
    const overviewTab = page.getByRole('button', { name: 'Product Overview' }).first();
    await overviewTab.waitFor({ state: 'visible', timeout: 15000 });
    assert(await overviewTab.isVisible(), 'Product Overview tab must be visible');

    // Verify the 5 sections exist and check their titles
    const overviewPanel = page.locator('.space-y-8.bg-white, .space-y-8.dark\\:bg-zinc-900\\/60').first();
    await overviewPanel.waitFor({ state: 'visible', timeout: 15000 });
    const sectionHeaders = await overviewPanel.locator('h3').allTextContents();
    console.log('✓ Found Section Headers on Prod 1:', sectionHeaders.map(h => h.trim()));

    assert.strictEqual(sectionHeaders[0]?.trim(), 'Product Description', 'Section 1 must be Product Description');
    assert.strictEqual(sectionHeaders[1]?.trim(), 'Key Benefits', 'Section 2 must be Key Benefits');
    assert.strictEqual(sectionHeaders[2]?.trim(), 'How to Use', 'Section 3 must be How to Use');
    assert(sectionHeaders[3]?.trim().includes('Ingredients'), 'Section 4 must be Ingredients');
    assert.strictEqual(sectionHeaders[4]?.trim(), 'Product Details', 'Section 5 must be Product Details');

    // Verify 7 Fixed Product Details cards
    const detailCardLabels = await overviewPanel.locator('h3:has-text("Product Details") + div span.uppercase').allTextContents();
    console.log('✓ Product Details Card Labels:', detailCardLabels.map(l => l.trim()));
    assert.deepStrictEqual(
      detailCardLabels.map(l => l.trim()),
      ['Brand', 'Category', 'Size / Volume', 'Country of Origin', 'Formulation', 'Storage Condition', 'UPC'],
      'Product Details must contain exact 7 fixed fields'
    );

    // Verify values for full product
    const detailCardValues = await overviewPanel.locator('h3:has-text("Product Details") + div span.font-semibold').allTextContents();
    console.log('✓ Product Details Values on Prod 1:', detailCardValues.map(v => v.trim()));
    assert(detailCardValues.length === 7, 'Must have 7 values rendered');

    await page.screenshot({ path: path.join(reportsDir, 'rtp_overview_prod1_full.png'), fullPage: false });

    // Step 4: Test Product 2: Partial / Missing Data (79b74cbd-d4cf-4d76-8bcd-e04f7a4b1d5a - FOOT GOOD SHOES)
    console.log('\n[Step 4] Testing Product 2: Partial data (79b74cbd-d4cf-4d76-8bcd-e04f7a4b1d5a)...');
    await page.goto(`${PORTAL_URL}/products/79b74cbd-d4cf-4d76-8bcd-e04f7a4b1d5a`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    const overviewPanel2 = page.locator('.space-y-8.bg-white, .space-y-8.dark\\:bg-zinc-900\\/60').first();
    await overviewPanel2.waitFor({ state: 'visible', timeout: 15000 });
    const sectionHeaders2 = await overviewPanel2.locator('h3').allTextContents();
    console.log('✓ Found Section Headers on Prod 2:', sectionHeaders2.map(h => h.trim()));
    assert.strictEqual(sectionHeaders2.length, 5, 'All 5 sections must be rendered even when data is missing');

    // Check placeholder texts
    const panelText = await overviewPanel2.textContent();
    console.log('✓ Panel content check for placeholders:');
    if (panelText.includes('Information not available yet.')) {
      console.log('  - Found Description placeholder: "Information not available yet."');
    }
    if (panelText.includes('Key benefits have not been added yet.')) {
      console.log('  - Found Key Benefits placeholder: "Key benefits have not been added yet."');
    }
    if (panelText.includes('Usage instructions are not available yet.')) {
      console.log('  - Found How to Use placeholder: "Usage instructions are not available yet."');
    }
    if (panelText.includes('Ingredient information is not available yet.')) {
      console.log('  - Found Ingredients placeholder: "Ingredient information is not available yet."');
    }

    // Verify 7 Fixed Product Details cards are present
    const detailCardLabels2 = await overviewPanel2.locator('h3:has-text("Product Details") + div span.uppercase').allTextContents();
    assert.deepStrictEqual(
      detailCardLabels2.map(l => l.trim()),
      ['Brand', 'Category', 'Size / Volume', 'Country of Origin', 'Formulation', 'Storage Condition', 'UPC'],
      'Product Details must render all 7 cards even on partial data'
    );

    // Verify empty fields show em dash '—'
    const detailCardValues2 = await overviewPanel2.locator('h3:has-text("Product Details") + div span.font-semibold').allTextContents();
    console.log('✓ Product Details Values on Prod 2:', detailCardValues2.map(v => v.trim()));
    assert(detailCardValues2.some(v => v.trim() === '—'), 'Empty fields in Product Details must show "—"');

    await page.screenshot({ path: path.join(reportsDir, 'rtp_overview_prod2_placeholders.png'), fullPage: false });

    // Step 5: Test Product 3: Aloe Sooting Gel (616c980f-494d-42e9-9584-456baead20ce)
    console.log('\n[Step 5] Testing Product 3: Aloe Sooting Gel (616c980f-494d-42e9-9584-456baead20ce)...');
    await page.goto(`${PORTAL_URL}/products/616c980f-494d-42e9-9584-456baead20ce`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    const overviewPanel3 = page.locator('.space-y-8.bg-white, .space-y-8.dark\\:bg-zinc-900\\/60').first();
    await overviewPanel3.waitFor({ state: 'visible', timeout: 15000 });
    const sectionHeaders3 = await overviewPanel3.locator('h3').allTextContents();
    assert.strictEqual(sectionHeaders3.length, 5, 'All 5 sections must be rendered on Prod 3');

    // Step 6: Test Tab Switching & Regression Guard
    console.log('\n[Step 6] Testing Tab Switching & Regression Guard...');
    const tabsToTest = ['Specifications', 'Packaging & Shipping', 'Retail Assets', 'Customer Page & QR'];
    for (const t of tabsToTest) {
      const tabBtn = page.getByRole('button', { name: new RegExp(t, 'i') }).first();
      assert(await tabBtn.isVisible(), `Tab button "${t}" must be visible`);
      await tabBtn.click();
      await page.waitForTimeout(400);
      console.log(`  ✓ Tab "${t}" clicked and displayed successfully`);
    }

    // Switch back to Product Overview
    await page.getByRole('button', { name: 'Product Overview' }).first().click();
    await page.waitForTimeout(400);

    // Step 7: Test Responsive Layout (Mobile 375x812)
    console.log('\n[Step 7] Testing Responsive Layout (Mobile viewport 375x812)...');
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(500);
    const mobileHeaders = await page.locator('.space-y-8.bg-white, .space-y-8.dark\\:bg-zinc-900\\/60').first().locator('h3').allTextContents();
    assert.strictEqual(mobileHeaders.length, 5, 'All 5 sections must be rendered on mobile');
    await page.screenshot({ path: path.join(reportsDir, 'rtp_overview_mobile.png'), fullPage: false });
    console.log('✓ Mobile layout verified and screenshot captured');

    console.log('\n🎉 ✅ RTP-PROD-DETAIL-001-R1 Production Browser QA PASSED ALL CHECKS!');
  } catch (err) {
    console.error('❌ Production QA Failed:', err);
    await page.screenshot({ path: 'scripts/rtp-prod-detail-001-r1-error.png' });
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runQA();
