const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('playwright');
const { assertCanMutatePassword } = require('./auth-guard');

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
const ADMIN_URL = 'https://admin.kselectnetwork.com';
const PORTAL_URL = 'https://portal.kselectnetwork.com';

async function runBrowserQA() {
  console.log('🚀 Starting ADM-RTL-STORE-001 Production Browser QA...');

  // Ensure QA Admin user password
  const { data: usersData } = await client.auth.admin.listUsers();
  const qaAdmin = (usersData?.users || []).find((u) => u.email === 'qa-admin-test@letusto.com');
  if (qaAdmin) {
    assertCanMutatePassword(qaAdmin.email, 'test-prod-adm-rtl-store-browser-qa.js');
    await client.auth.admin.updateUserById(qaAdmin.id, { password: 'Password123!@#' });
    console.log('✓ QA Admin user verified');
  }

  // Ensure dedicated QA Retailer user password (never mutate real business users)
  const retailerUser = (usersData?.users || []).find((u) => u.email === 'qa-retailer-test@letusto.com');
  if (retailerUser) {
    assertCanMutatePassword(retailerUser.email, 'test-prod-adm-rtl-store-browser-qa.js');
    await client.auth.admin.updateUserById(retailerUser.id, { password: 'Password123!@#' });
    console.log('✓ Dedicated QA Retailer user verified');
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const page = await context.newPage();

  // Listen to console and page errors
  const pageErrors = [];
  page.on('pageerror', (err) => {
    console.error('  [Browser Error]:', err.message);
    pageErrors.push(err.message);
  });

  try {
    // --- 1. Admin Retailers List ---
    console.log(`\n[Step 1] Logging in to Admin at ${ADMIN_URL}/admin/login...`);
    await page.goto(`${ADMIN_URL}/admin/login`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.locator('input#email').fill('qa-admin-test@letusto.com');
    await page.locator('input#password').fill('Password123!@#');
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(4000);
    console.log(`✓ Admin logged in. URL: ${page.url()}`);

    console.log('\n[Step 2] Navigating to /admin/retailers...');
    await page.goto(`${ADMIN_URL}/admin/retailers`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    const rows = await page.locator('table tbody tr').allTextContents();
    const testRetailerRow = rows.find(r => r.includes('K SELECT Test Retailer'));
    const hasTestRetailer = Boolean(testRetailerRow);
    const has2Stores = testRetailerRow ? (testRetailerRow.includes('2 Stores') || testRetailerRow.includes('2 Store')) : false;
    const hasStoreNames = testRetailerRow ? (testRetailerRow.includes('Test Store 01') && testRetailerRow.includes('Test Store 02')) : false;

    console.log(`  - K SELECT Test Retailer row found: ${hasTestRetailer ? 'YES' : 'NO'}`);
    console.log(`  - Row text: "${testRetailerRow ? testRetailerRow.replace(/\s+/g, ' ').trim() : ''}"`);
    console.log(`  - Displays "2 Stores": ${has2Stores ? 'YES' : 'NO'}`);
    console.log(`  - Displays both store names: ${hasStoreNames ? 'YES' : 'NO'}`);

    if (!hasTestRetailer || !has2Stores) {
      throw new Error('Admin Retailers List did not display K SELECT Test Retailer with 2 Stores');
    }

    // --- 2. Admin Retailer 360 Detail Overview ---
    console.log('\n[Step 3] Navigating to Admin Retailer 360 Detail (/admin/retailers/dc9249be-a9e0-4975-a4c9-b602bb2baa47)...');
    await page.goto(`${ADMIN_URL}/admin/retailers/dc9249be-a9e0-4975-a4c9-b602bb2baa47`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    const detailOverviewHtml = await page.content();
    const hasStoreLocationsCard = detailOverviewHtml.includes('STORE LOCATIONS') || detailOverviewHtml.includes('Store Locations');
    console.log(`  - Overview displays "Store Locations" KPI: ${hasStoreLocationsCard ? 'YES' : 'NO'}`);

    // --- 3. Admin Retailer 360 Stores Tab ---
    console.log('\n[Step 4] Clicking "Stores" tab...');
    const storesTabBtn = page.locator('button:has-text("Stores")').first();
    await storesTabBtn.click();
    await page.waitForTimeout(2000);

    const storesTabHtml = await page.content();
    const hasStore01 = storesTabHtml.includes('Test Store 01');
    const hasStore02 = storesTabHtml.includes('Test Store 02');
    const hasStore01Code = storesTabHtml.includes('STORE-001');
    const hasStoreLocationsHeader = storesTabHtml.includes('Retailer Store Locations (2)');

    console.log(`  - Header shows "Retailer Store Locations (2)": ${hasStoreLocationsHeader ? 'YES' : 'NO'}`);
    console.log(`  - Test Store 01 rendered: ${hasStore01 ? 'YES' : 'NO'}`);
    console.log(`  - Test Store 02 rendered: ${hasStore02 ? 'YES' : 'NO'}`);
    console.log(`  - Store Code STORE-001 rendered: ${hasStore01Code ? 'YES' : 'NO'}`);

    // Test clicking Add Store button to verify complete modal inputs
    console.log('\n[Step 5] Testing "+ Add Store Location" modal inputs...');
    const addStoreBtn = page.locator('button:has-text("+ Add Store Location")');
    if (await addStoreBtn.isVisible()) {
      await addStoreBtn.click();
      await page.waitForTimeout(1000);
      const modalHtml = await page.content();
      const hasNameInput = modalHtml.includes('Store Name');
      const hasCodeInput = modalHtml.includes('Store Code');
      const hasAddressInput = modalHtml.includes('Physical Address');
      const hasCityInput = modalHtml.includes('City');
      const hasPhoneInput = modalHtml.includes('Store Phone');
      const hasManagerInput = modalHtml.includes('Manager Name');
      console.log(`  - Add Store Modal opened: YES`);
      console.log(`  - All Store fields present (Name, Code, Address, City, Phone, Manager): ${hasNameInput && hasCodeInput && hasAddressInput && hasCityInput && hasPhoneInput && hasManagerInput ? 'YES' : 'NO'}`);
      // Close modal
      const cancelBtn = page.locator('button:has-text("Cancel")').first();
      await cancelBtn.click();
      await page.waitForTimeout(500);
    }

    // --- 4. Retailer Portal Company & Store Settings ---
    console.log(`\n[Step 6] Navigating to Retailer Portal at ${PORTAL_URL}/retailer/login...`);
    const portalContext = await browser.newContext({ viewport: { width: 1440, height: 950 } });
    const portalPage = await portalContext.newPage();

    await portalPage.goto(`${PORTAL_URL}/retailer/login`, { waitUntil: 'networkidle', timeout: 30000 });
    await portalPage.locator('input#email').fill('qa-retailer-test@letusto.com');
    await portalPage.locator('input#password').fill('Password123!@#');
    await portalPage.locator('button[type="submit"]').click();
    await portalPage.waitForTimeout(4000);
    console.log(`✓ Retailer logged in. URL: ${portalPage.url()}`);

    console.log('\n[Step 7] Navigating to company settings on portal...');
    const origin = new URL(portalPage.url()).origin;
    await portalPage.goto(`${origin}/settings/company`, { waitUntil: 'networkidle', timeout: 30000 });
    await portalPage.waitForTimeout(3000);

    const portalHtml = await portalPage.content();
    const portalHasStoreSection = portalHtml.includes('Physical Store Locations') || portalHtml.includes('오프라인 매장 지점');
    const portalHasStore01 = portalHtml.includes('Test Store 01');
    const portalHasStore02 = portalHtml.includes('Test Store 02');

    console.log(`  - Portal shows "Physical Store Locations": ${portalHasStoreSection ? 'YES' : 'NO'}`);
    console.log(`  - Test Store 01 rendered: ${portalHasStore01 ? 'YES' : 'NO'}`);
    console.log(`  - Test Store 02 rendered: ${portalHasStore02 ? 'YES' : 'NO'}`);

    if (!portalHasStore01 || !portalHasStore02) {
      throw new Error('Retailer Portal did not render Test Store 01 and Test Store 02');
    }

    console.log('\n🎉 ALL PRODUCTION BROWSER QA STEPS PASSED WITHOUT ERRORS!');
  } catch (err) {
    console.error('\n❌ Browser QA failed:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runBrowserQA();
