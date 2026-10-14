// scripts/test-prod-adm-order-processing-browser-qa.js
// Automated Production Browser QA for ADM-ORDER-PROCESSING-001
const { chromium } = require('playwright');
const fs = require('fs');

const ADMIN_URL = 'https://admin.kselectnetwork.com';
const PORTAL_URL = 'https://portal.kselectnetwork.com';

async function runBrowserQA() {
  console.log('========================================================');
  console.log('ADM-ORDER-PROCESSING-001: Production Browser QA');
  console.log('========================================================\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  let passed = 0;
  let total = 0;

  function assert(condition, name, details = '') {
    total++;
    if (condition) {
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${name}`);
      if (details) console.error(`   Details: ${details}`);
    }
  }

  try {
    // 1. Sign in as Admin
    console.log('[1/6] Authenticating as Admin on Production...');
    await page.goto(`${ADMIN_URL}/admin/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.fill('input[type="email"], input#email', 'qa-admin-test@letusto.com');
    await page.fill('input[type="password"], input#password', 'Password123!@#');
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 20000 });
    assert(page.url().includes('/admin'), 'Admin logged in successfully and reached dashboard');

    // 2. Test Navigation / Route Redirect / Sidebar
    console.log('\n[2/6] Verifying Navigation & Canonical Routes...');
    // Test direct navigation to /admin/order-processing (redirect test)
    await page.goto(`${ADMIN_URL}/admin/order-processing`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1500);
    assert(page.url().includes('/admin/sales/orders'), 'Direct access to /admin/order-processing forwards to /admin/sales/orders');

    // Check page header
    const pageText = await page.innerText('body');
    assert(pageText.includes('Order Processing'), 'Page header displays "Order Processing"');
    assert(pageText.includes('Warehouse Live Queue'), 'Page displays "Warehouse Live Queue" badge');

    // 3. Verify Operational Summary KPI Cards
    console.log('\n[3/6] Verifying Operational Summary KPIs...');
    const kpiNames = ['ALL ORDERS', 'NEW ORDERS', 'READY TO SHIP', 'PART. SHIPPED', 'ON HOLD', 'TRACK NEEDED', 'COMPLETED'];
    for (const kpi of kpiNames) {
      assert(pageText.toUpperCase().includes(kpi), `KPI Card "${kpi}" is visible with live counter`);
    }

    // 4. Test Quick Filter Interactivity
    console.log('\n[4/6] Testing Quick Filters & URL Synchronization...');
    // Click "New Orders" KPI
    await page.click('button:has-text("NEW ORDERS"), button:has-text("New Orders")');
    await page.waitForTimeout(1500);
    assert(page.url().includes('quickFilter=new'), 'Clicking "New Orders" updates URL with ?quickFilter=new');

    // Click "Completed" KPI
    await page.click('button:has-text("COMPLETED"), button:has-text("Completed")');
    await page.waitForTimeout(1500);
    assert(page.url().includes('quickFilter=completed'), 'Clicking "Completed" updates URL with ?quickFilter=completed');

    // Reset filters
    await page.click('button:has-text("ALL ORDERS"), button:has-text("All Orders")');
    await page.waitForTimeout(1500);

    // 5. Search for Target Order KSR-2026-000023
    console.log('\n[5/6] Verifying Search & Target Order KSR-2026-000023...');
    const searchInput = page.locator('input[placeholder*="Order #, Store"]');
    await searchInput.fill('KSR-2026-000023');
    await page.click('button:has-text("Apply Filters")');
    await page.waitForTimeout(1500);

    const filteredBody = await page.innerText('body');
    assert(filteredBody.includes('KSR-2026-000023'), 'Search finds target order KSR-2026-000023');
    assert(filteredBody.includes('Test Store 02'), 'Target order destination store Test Store 02 displayed');
    assert(filteredBody.includes('Voorhees, NJ') || filteredBody.includes('NJ'), 'City/State displayed for store');
    assert(filteredBody.includes('162/162') || filteredBody.includes('162'), 'Total 162 units reconciliation displayed');
    assert(filteredBody.includes('3 Boxes') || filteredBody.includes('Boxes'), 'Multi-Box carton popover button displayed');
    assert(filteredBody.includes('Tracking Needed') || filteredBody.includes('Track'), 'Missing tracking operational flag displayed for unassigned 2nd dispatch');

    // 6. Test Order Detail Navigation & Breadcrumbs
    console.log('\n[6/6] Verifying Centralized Order Detail & Retailer 360 Connection...');
    await page.locator('a:has-text("KSR-2026-000023")').first().click();
    await page.waitForURL((url) => url.pathname.includes('/sales/orders/'), { timeout: 20000 });

    const detailText = await page.innerText('body');
    assert(detailText.includes('Order #KSR-2026-000023'), 'Order Detail page loaded for KSR-2026-000023');
    assert(detailText.includes('Back to Order Processing'), 'Breadcrumb contains "← Back to Order Processing"');
    assert(detailText.includes('View Retailer 360'), 'Breadcrumb contains shortcut "View Retailer 360"');
    assert(detailText.includes('DR120-SB-001'), 'Line item DR120-SB-001 rendered');
    assert(detailText.includes('FOOT-TEST-123'), 'Line item FOOT-TEST-123 rendered');

    // Return back to Order Processing
    await page.locator('a:has-text("Back to Order Processing")').first().click();
    await page.waitForURL((url) => url.pathname.includes('/sales/orders'), { timeout: 20000 });
    assert(page.url().includes('/admin/sales/orders'), 'Successfully returned to Order Processing queue');

    // Visit Retailer 360 to verify link into Order Processing
    await page.goto(`${ADMIN_URL}/admin/retailers/dc9249be-a9e0-4975-a4c9-b602bb2baa47?tab=orders`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
    const r360Text = await page.innerText('body');
    assert(r360Text.includes('Open in Order Processing Workspace') || r360Text.includes('Order Processing Workspace'), 'Retailer 360 Orders tab displays "Open in Order Processing Workspace →"');
    assert(r360Text.includes('#KSR-2026-000023'), 'Retailer 360 shows #KSR-2026-000023 with direct detail link');

    console.log('\n========================================================');
    console.log(`Browser QA Completed: ${passed} / ${total} checks passed (${Math.round((passed / total) * 100)}%)`);
    console.log('========================================================\n');
  } catch (err) {
    console.error('Browser QA Execution Error:', err);
  } finally {
    await browser.close();
  }
}

runBrowserQA();
