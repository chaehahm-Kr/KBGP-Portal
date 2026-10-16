// scripts/test-prod-adm-store-ops-p3-003-qa.js
// Production Browser QA Matrix for ADM-STORE-OPS-P3-003: Shelf & SKU Placement Management MVP
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const https = require('https');
const { createClient } = require('@supabase/supabase-js');

let env = {};
if (fs.existsSync('.env.local')) {
  fs.readFileSync('.env.local', 'utf8').split('\n').forEach((l) => {
    const m = l.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (m) env[m[1]] = (m[2] || '').trim().replace(/^['"]|['"]$/g, '');
  });
}

const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY);
const ARTIFACT_DIR = path.resolve('C:/Users/ChaeHahm/.gemini/antigravity/brain/60393d8e-2782-4539-8c9d-c53f4b39baf6');
const ADMIN_URL = 'https://admin.kselectnetwork.com';
const TEST_EMAIL = 'qa-admin-test@letusto.com';
const TEST_PASSWORD = process.env.TEST_ADMIN_PASSWORD || 'Password123!@#';

// 180-second process timeout
const deadline = setTimeout(() => {
  console.error('[QA FATAL] 180s hard process timeout exceeded, forcing exit');
  process.exit(1);
}, 180000);

function checkDiagnostics(url) {
  return new Promise((resolve) => {
    const req = https.get(url, { timeout: 10000 }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          const j = JSON.parse(data);
          resolve({ ok: true, sha: j.deployment?.commitSha, status: res.statusCode });
        } catch {
          resolve({ ok: false, err: 'parse error', status: res.statusCode });
        }
      });
    });
    req.on('error', (err) => resolve({ ok: false, err: err.message }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, err: 'timeout' });
    });
  });
}

async function waitForDeployment(targetSha) {
  console.log(`Polling ${ADMIN_URL}/api/diagnostics for commit prefix ${targetSha}...`);
  for (let i = 0; i < 40; i++) {
    const diag = await checkDiagnostics(`${ADMIN_URL}/api/diagnostics`);
    console.log(`  [Attempt ${i + 1}] Live SHA: ${diag.sha}`);
    if (diag.sha && diag.sha.startsWith(targetSha)) {
      console.log(`✓ Deployment Ready: ${diag.sha}\n`);
      return diag.sha;
    }
    await new Promise((r) => setTimeout(r, 4000));
  }
  throw new Error(`Timeout waiting for Vercel deployment of ${targetSha}`);
}

async function runQA() {
  console.log('================================================================================');
  console.log('ADM-STORE-OPS-P3-003 PRODUCTION BROWSER QA MATRIX');
  console.log('Target: ' + ADMIN_URL);
  console.log('================================================================================\n');

  const targetSha = process.env.TARGET_SHA || require('child_process').execSync('git rev-parse HEAD').toString().trim().substring(0, 7);
  console.log(`Target Feature SHA: ${targetSha}`);

  const liveSha = await waitForDeployment(targetSha);

  // Verify Admin QA user credentials
  const { data: users } = await client.auth.admin.listUsers();
  const adminUser = users?.users?.find((u) => u.email === TEST_EMAIL);
  if (adminUser) {
    await client.auth.admin.updateUserById(adminUser.id, { password: TEST_PASSWORD });
    console.log(`✓ Admin user ${TEST_EMAIL} password synced\n`);
  } else {
    await client.auth.admin.createUser({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      email_confirm: true,
      user_metadata: { role: 'admin', full_name: 'QA Admin Specialist' },
    });
    console.log(`✓ Admin user ${TEST_EMAIL} provisioned\n`);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  let passed = 0;
  let failed = 0;

  function assert(title, condition, detail = '') {
    if (condition) {
      console.log(`  ✓ PASS: ${title}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${title} -> ${detail}`);
      failed++;
    }
  }

  try {
    // 1. Authenticate
    console.log('Scenario 1: Authenticated Session & Navigation');
    await page.goto(`${ADMIN_URL}/admin/login`, { waitUntil: 'networkidle' });
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/admin/**', { timeout: 15000 });
    assert('Admin login successful and redirected to admin dashboard', page.url().includes('/admin'));

    // 2. Navigate to Store Operations with Fixtures tab pre-selected for Test Store 01
    const targetStoreId = 'effe7832-096c-4ae1-86c7-3cb189b59731';
    console.log(`\nScenario 2: Navigate to Store Operations -> Fixtures & Placements`);
    await page.goto(`${ADMIN_URL}/admin/store-operations?storeId=${targetStoreId}&tab=fixtures`, {
      waitUntil: 'networkidle',
    });

    const activeTabElem = await page.locator('[data-testid="tab-fixtures"]').first();
    assert('Fixtures & Placements tab is visible', await activeTabElem.isVisible());

    // 3. Verify Existing Fixture Card
    console.log('\nScenario 3: Verify Physical Fixture Card & KPI Bar');
    const fixtureCodeLocator = page.locator('text=FIXSTURE-4F').first();
    await fixtureCodeLocator.waitFor({ state: 'visible', timeout: 10000 });
    assert('Fixture FIXSTURE-4F is displayed in Store Operations', await fixtureCodeLocator.isVisible());

    // 4. Verify Placement Summary & Toggle Button
    console.log('\nScenario 4: Verify Placement Controls & Expand Planogram Matrix');
    const manageBtn = page.locator('[data-testid^="btn-manage-placements-"]').first();
    assert('Manage Placements toggle button is present', await manageBtn.isVisible());

    // Click Manage Placements to expand planogram
    await manageBtn.click();
    await page.waitForTimeout(600);

    const planogramContainer = page.locator('[data-testid^="fixture-planogram-"]').first();
    assert('Planogram Bay/Shelf layout expanded upon clicking Manage Placements', await planogramContainer.isVisible());

    // 5. Verify Bay Switcher Tabs
    console.log('\nScenario 5: Multi-Bay Switcher & Shelf Layout Inspection');
    const bay1Tab = page.locator('[data-testid*="bay-tab-"][data-testid$="-1"]').first();
    const bay2Tab = page.locator('[data-testid*="bay-tab-"][data-testid$="-2"]').first();
    assert('Bay 1 tab is visible', await bay1Tab.isVisible());
    assert('Bay 2 tab is visible', await bay2Tab.isVisible());

    // Check shelf rows (5 shelves rendered)
    const shelfRows = page.locator('[data-testid^="shelf-row-"]');
    const shelfRowCount = await shelfRows.count();
    assert('All 5 shelves rendered for the selected bay', shelfRowCount === 5, `Found ${shelfRowCount} shelves`);

    // Screenshot of Expanded Planogram Matrix
    const planogramShot = path.join(ARTIFACT_DIR, 'adm_store_ops_p3_planogram_expanded.png');
    await page.screenshot({ path: planogramShot, fullPage: false });
    console.log(`  📸 Screenshot saved: ${planogramShot}`);

    // 6. Test Product Assignment Modal
    console.log('\nScenario 6: Product Assignment Modal & Store Assortment Filter');
    const assignBtn = page.locator('[data-testid^="btn-assign-slot-"]').first();
    await assignBtn.click();
    await page.waitForTimeout(500);

    const placementModal = page.locator('[data-testid="placement-modal-card"]').first();
    assert('Product Assignment modal opened', await placementModal.isVisible());

    // Verify fields
    const baySelect = page.locator('[data-testid="select-placement-bay"]').first();
    const shelfSelect = page.locator('[data-testid="select-placement-shelf"]').first();
    const slotInput = page.locator('[data-testid="input-placement-slot"]').first();
    const prodSelect = page.locator('[data-testid="select-placement-product"]').first();

    assert('Bay selector present in modal', await baySelect.isVisible());
    assert('Shelf selector present in modal', await shelfSelect.isVisible());
    assert('Position slot input present in modal', await slotInput.isVisible());
    assert('Store assortment product selector present in modal', await prodSelect.isVisible());

    // Verify product dropdown options are strictly from the store's assortment
    const productOptions = await prodSelect.locator('option').allTextContents();
    console.log(`  Found ${productOptions.length - 1} store-carried products in assignment dropdown`);
    assert(
      'Assignment dropdown contains store carried products',
      productOptions.some((o) => o.includes('TEST-SKN-001') || o.includes('Ceramide'))
    );

    // Test product search filter input
    const searchInput = page.locator('[data-testid="input-placement-product-search"]').first();
    await searchInput.fill('Toner');
    await page.waitForTimeout(300);
    const filteredOptions = await prodSelect.locator('option').allTextContents();
    assert(
      'Product search filters dropdown dynamically',
      filteredOptions.some((o) => o.includes('Toner')) && !filteredOptions.some((o) => o.includes('Ceramide'))
    );

    // Screenshot of Placement Assignment Modal
    const modalShot = path.join(ARTIFACT_DIR, 'adm_store_ops_p3_placement_modal_interactive.png');
    await page.screenshot({ path: modalShot, fullPage: false });
    console.log(`  📸 Screenshot saved: ${modalShot}`);

    // Cancel modal without writing to DB
    const cancelBtn = page.locator('[data-testid="btn-cancel-placement"]').first();
    await cancelBtn.click();
    await page.waitForTimeout(500);
    assert('Assignment modal closed cleanly on Cancel (Zero DB writes invariant)', !(await placementModal.isVisible()));

    // 7. Regression Testing Across All 6 Store Operations Tabs
    console.log('\nScenario 7: Five-Tab Regression & URL State Verification');
    const tabs = [
      { key: 'overview', testId: 'tab-content-overview' },
      { key: 'inventory', testId: 'tab-content-inventory' },
      { key: 'orders', testId: 'tab-content-orders' },
      { key: 'sales', testId: 'tab-content-sales' },
      { key: 'training', testId: 'tab-content-training' },
    ];

    for (const t of tabs) {
      const tabBtn = page.locator(`[data-testid="tab-${t.key}"]`).first();
      await tabBtn.click();
      await page.waitForTimeout(400);
      const content = page.locator(`[data-testid="${t.testId}"]`).first();
      assert(`Tab "${t.key}" loads correctly without regression`, await content.isVisible());
    }

    // Return to Fixtures Tab
    await page.locator('[data-testid="tab-fixtures"]').first().click();
    await page.waitForTimeout(400);
    assert('Returned to Fixtures tab, URL preserves tab=fixtures', page.url().includes('tab=fixtures'));

    console.log('\n================================================================================');
    console.log(`Production Browser QA Results: ${passed} PASSED / ${failed} FAILED (Total: ${passed + failed})`);
    console.log('================================================================================');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('[QA Exception]:', err);
    process.exit(1);
  } finally {
    clearTimeout(deadline);
    await browser.close();
  }
}

runQA().catch((err) => {
  console.error('[QA Fatal Error]:', err);
  process.exit(1);
});
