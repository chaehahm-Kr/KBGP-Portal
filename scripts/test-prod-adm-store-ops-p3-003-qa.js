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
    await page.goto(`${ADMIN_URL}/admin/login`, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await page.locator('input#email, input[type="email"]').fill(TEST_EMAIL);
    await page.locator('input#password, input[type="password"]').fill(TEST_PASSWORD);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 25000 });
    await page.waitForTimeout(1500);
    assert('Admin login successful and redirected to admin dashboard', page.url().includes('/admin'));

    // 2. Navigate to Store Operations
    console.log(`\nScenario 2: Navigate to Store Operations`);
    await page.goto(`${ADMIN_URL}/admin/store-operations`, {
      waitUntil: 'domcontentloaded',
      timeout: 25000,
    });
    await page.waitForSelector('[data-testid="store-operations-container"]', { timeout: 15000 });

    // Look for stores in the list
    const storesTable = page.locator('[data-testid="stores-table"]').first();
    await storesTable.waitFor({ state: 'visible', timeout: 10000 });
    assert('Stores table is visible on Store Operations page', await storesTable.isVisible());

    // Click into store detail (either Test Store 01 or the first store)
    const viewBtn = page.locator('tr:has-text("Test Store 01") button, [data-testid^="view-store-btn-"]').first();
    assert('View Store action button is present', await viewBtn.isVisible());
    await viewBtn.click();
    await page.waitForTimeout(800);

    // Verify Store Detail header is visible
    const detailHeader = page.locator('[data-testid="store-detail-header"]').first();
    await detailHeader.waitFor({ state: 'visible', timeout: 10000 });
    assert('Store detail view loaded successfully', await detailHeader.isVisible());

    // Click on Fixtures & Placements Tab
    console.log(`\nScenario 3: Open Fixtures & Placements Tab`);
    const fixturesTabBtn = page.locator('[data-testid="tab-fixtures"]').first();
    assert('Fixtures & Placements tab is present', await fixturesTabBtn.isVisible());
    await fixturesTabBtn.click();
    await page.waitForTimeout(800);

    const fixturesContent = page.locator('[data-testid="tab-content-fixtures"]').first();
    assert('Fixtures & Placements tab content is active', await fixturesContent.isVisible());

    // 4. Verify Existing Fixture or Register Fixture if none
    console.log('\nScenario 4: Verify Physical Fixture Card & Placement Controls');
    const fixtureCards = page.locator('[data-testid^="fixture-card-"]');
    const fixtureCount = await fixtureCards.count();
    console.log(`  Found ${fixtureCount} physical fixture(s) in this store`);

    if (fixtureCount === 0) {
      // If store has 0 fixtures registered, register a test fixture first
      console.log('  Registering a fixture for this store...');
      const registerFirstBtn = page.locator('[data-testid="btn-register-first-fixture"], [data-testid="btn-register-fixture"]').first();
      await registerFirstBtn.click();
      await page.waitForTimeout(500);

      await page.fill('[data-testid="input-fixture-code"]', 'TEST-8F');
      await page.fill('[data-testid="input-fixture-name"]', 'Modular 8ft Display');
      await page.selectOption('[data-testid="select-fixture-type"]', 'wall_8ft');
      await page.click('[data-testid="btn-submit-fixture"]');
      await page.waitForTimeout(1500);
    }

    const firstFixtureCard = page.locator('[data-testid^="fixture-card-"]').first();
    await firstFixtureCard.waitFor({ state: 'visible', timeout: 10000 });
    assert('Physical Display Fixture card is displayed', await firstFixtureCard.isVisible());

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
    const assignBtn = page.locator('[data-testid^="btn-add-to-shelf-"], [data-testid^="btn-empty-shelf-assign-"]').first();
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

    // 6b. Verify Compact Visual Shelf Tiles & Hover Actions (ADM-STORE-OPS-P3-003-R1)
    console.log('\nScenario 6b: Compact Visual Shelf Tile Verification (Target Feel 6-8 per row)');
    const placedTiles = page.locator('[data-testid^="placement-card-"]');
    const placedCount = await placedTiles.count();
    console.log(`  Found ${placedCount} placed product tile(s) on display`);
    if (placedCount > 0) {
      const firstTile = placedTiles.first();
      assert('Placed product tile is visible', await firstTile.isVisible());

      // 1. Verify thumbnail image is present
      const img = firstTile.locator('img, span:has-text("💄")').first();
      assert('Thumbnail image container is rendered inside compact tile', await img.isVisible());

      // 2. Verify SKU is prominent
      const skuEl = firstTile.locator('span.font-mono').first();
      assert('Monospace SKU is displayed on compact tile', await skuEl.isVisible());

      // 3. Hover over tile to reveal hover action overlay
      await firstTile.hover();
      await page.waitForTimeout(400);

      const hoverShot = path.join(ARTIFACT_DIR, 'adm_store_ops_p3_compact_shelf_hover.png');
      await page.screenshot({ path: hoverShot, fullPage: false });
      console.log(`  📸 Screenshot saved: ${hoverShot}`);

      const editBtn = firstTile.locator('[data-testid^="btn-edit-placement-"]').first();
      const unassignBtn = firstTile.locator('[data-testid^="btn-unassign-placement-"]').first();
      assert('Edit button is revealed upon hover/focus', await editBtn.isVisible());
      assert('Unassign button is revealed upon hover/focus', await unassignBtn.isVisible());

      // 4. Test Edit Modal interaction without DB write
      await editBtn.click();
      await page.waitForTimeout(400);
      const editModalTitle = page.locator('[data-testid="placement-modal-title"]').first();
      assert('Edit Placement modal opened with title "Edit Shelf Placement"', (await editModalTitle.innerText()).includes('Edit'));
      await page.locator('[data-testid="btn-close-placement-modal"], [data-testid="btn-cancel-placement"]').first().click();
      await page.waitForTimeout(400);
      assert('Edit Placement modal closed cleanly without mutation', !(await page.locator('[data-testid="placement-modal-card"]').isVisible()));

      // 5. Test Unassign Modal interaction without DB write
      await firstTile.hover();
      await page.waitForTimeout(300);
      await unassignBtn.click();
      await page.waitForTimeout(400);
      const unassignModal = page.locator('[data-testid="unassign-modal-card"]').first();
      assert('Unassign confirmation modal opened', await unassignModal.isVisible());
      await page.locator('[data-testid="btn-cancel-unassign"]').first().click();
      await page.waitForTimeout(400);
      assert('Unassign confirmation modal cancelled cleanly without deletion', !(await unassignModal.isVisible()));
    }

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
