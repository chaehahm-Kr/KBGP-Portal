// scripts/test-prod-adm-store-ops-p3-qa.js
// Production Browser QA Matrix for ADM-STORE-OPS-P3-002: Fixtures & Placements Management MVP
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
  console.log('ADM-STORE-OPS-P3-002 PRODUCTION BROWSER QA MATRIX');
  console.log('Target: ' + ADMIN_URL);
  console.log('================================================================================\n');

  const targetSha = process.env.TARGET_SHA || require('child_process').execSync('git rev-parse HEAD').toString().trim().substring(0, 7);
  console.log(`Target Feature SHA: ${targetSha}`);

  const liveSha = await waitForDeployment(targetSha);

  // Ensure artifacts directory exists
  if (!fs.existsSync(ARTIFACT_DIR)) {
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  }

  // Verify Admin QA user credentials
  const { data: users } = await client.auth.admin.listUsers();
  const adminUser = users?.users?.find((u) => u.email === TEST_EMAIL);
  if (adminUser) {
    console.log(`✓ QA Admin User verified (${adminUser.email})`);
  }

  const browser = await chromium.launch({ headless: true });
  const results = {};

  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();

    page.on('console', (msg) => {
      if (msg.type() === 'error') console.log(`[Browser Error]: ${msg.text()}`);
    });

    // 1. Diagnostics verification
    results['Diagnostics_Live_SHA_Matches'] = liveSha.startsWith(targetSha);

    // 2. Admin Login
    console.log('\n1. Logging into Admin Portal...');
    await page.goto(`${ADMIN_URL}/admin/login`, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await page.locator('input#email, input[type="email"]').fill(TEST_EMAIL);
    await page.locator('input#password, input[type="password"]').fill(TEST_PASSWORD);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 25000 });
    await page.waitForTimeout(1500);
    results['Admin_Login_Successful'] = true;
    console.log('✓ Logged in successfully');

    // 3. Navigate to Store Operations
    console.log('\n2. Navigating to Store Operations...');
    await page.goto(`${ADMIN_URL}/admin/store-operations`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForSelector('[data-testid="store-operations-container"]', { timeout: 25000 });
    console.log('✓ Store Operations list loaded');

    // 4. Select Test Store 01
    console.log('\n3. Opening Test Store 01 Detail...');
    const store01Btn = page.locator('tr:has-text("Test Store 01") button:has-text("View Details"), [data-testid^="view-store-btn-"]').first();
    await store01Btn.click();
    await page.waitForTimeout(1500);
    console.log('✓ Test Store 01 selected');

    // 5. Switch to Fixtures Tab (Tab 6)
    console.log('\n4. Switching to Fixtures & Placements Tab...');
    const fixturesTabBtn = page.locator('button:has-text("Fixtures & Placements")').first();
    await fixturesTabBtn.click();
    await page.waitForTimeout(1500);

    const isTabActive = await page.locator('[data-testid="tab-content-fixtures"]').isVisible();
    results['Fixtures_Tab_Content_Visible'] = isTabActive;
    console.log(`✓ Fixtures Tab visible: ${isTabActive}`);

    // Verify Title & Active Phase Badge
    const titleText = await page.locator('[data-testid="fixtures-tab-title"]').innerText();
    results['Fixtures_Tab_Title_Valid'] = titleText.includes('Physical Fixtures');
    console.log(`✓ Fixtures Tab Title: "${titleText}"`);

    // Verify Register Button
    const regBtnVisible = await page.locator('[data-testid="btn-register-fixture"]').isVisible();
    results['Register_Fixture_Button_Visible'] = regBtnVisible;
    console.log(`✓ Top [+ Register Fixture] button visible: ${regBtnVisible}`);

    // Since DB has 0 fixtures, Empty State should be visible
    console.log('\n5. Verifying Empty State...');
    const emptyStateVisible = await page.locator('[data-testid="fixtures-empty-state"]').isVisible();
    const emptyStateTitle = await page.locator('[data-testid="fixtures-empty-state-title"]').innerText();
    results['Empty_State_Visible'] = emptyStateVisible;
    results['Empty_State_Title_Matches'] = emptyStateTitle.includes('No fixtures registered for this store.');
    console.log(`✓ Empty State visible: ${emptyStateVisible}, Title: "${emptyStateTitle}"`);

    // Take Screenshot 1: Tab 6 Empty State
    const screenshot1Path = path.join(ARTIFACT_DIR, 'adm_store_ops_p3_fixtures_empty_state.png');
    await page.screenshot({ path: screenshot1Path, fullPage: false });
    console.log(`✓ Screenshot 1 saved to: ${screenshot1Path}`);

    // 6. Test Opening Registration Modal
    console.log('\n6. Opening Fixture Registration Modal...');
    const regFirstBtn = page.locator('[data-testid="btn-register-first-fixture"]').first();
    await regFirstBtn.click();
    await page.waitForTimeout(1000);

    const isModalOpen = await page.locator('[data-testid="fixture-modal-backdrop"]').isVisible();
    const modalTitle = await page.locator('[data-testid="fixture-modal-title"]').innerText();
    results['Modal_Opens_Successfully'] = isModalOpen;
    results['Modal_Title_Valid'] = modalTitle.includes('Register New Display Fixture');
    console.log(`✓ Modal Open: ${isModalOpen}, Title: "${modalTitle}"`);

    // Verify all form fields inside modal
    const codeInput = await page.locator('[data-testid="input-fixture-code"]').isVisible();
    const nameInput = await page.locator('[data-testid="input-fixture-name"]').isVisible();
    const typeSelect = await page.locator('[data-testid="select-fixture-type"]').isVisible();
    const bayInput = await page.locator('[data-testid="input-bay-count"]').isVisible();
    const shelfInput = await page.locator('[data-testid="input-shelf-count"]').isVisible();
    const headerCheck = await page.locator('[data-testid="checkbox-header-signage"]').isVisible();
    const locationInput = await page.locator('[data-testid="input-store-location"]').isVisible();
    const opStatusSelect = await page.locator('[data-testid="select-operational-status"]').isVisible();
    const instStatusSelect = await page.locator('[data-testid="select-installation-status"]').isVisible();
    const submitBtn = await page.locator('[data-testid="btn-submit-fixture"]').isVisible();

    results['Form_Fields_Verified'] = codeInput && nameInput && typeSelect && bayInput && shelfInput && headerCheck && locationInput && opStatusSelect && instStatusSelect && submitBtn;
    console.log(`✓ Form Fields Verified: ${results['Form_Fields_Verified']}`);

    // Fill sample values in form to verify responsive inputs (WITHOUT submitting to keep zero mock data)
    await page.locator('[data-testid="input-fixture-code"]').fill('TEST-W01');
    await page.locator('[data-testid="input-fixture-name"]').fill('Main Entrance 8ft Wall');
    await page.locator('[data-testid="select-fixture-type"]').selectOption('wall_8ft');
    await page.waitForTimeout(500);

    // Verify bay count updated to 2 automatically
    const bayVal = await page.locator('[data-testid="input-bay-count"]').inputValue();
    results['Type_Preset_Auto_Bays'] = (bayVal === '2');
    console.log(`✓ Bay count auto-synced to 2 on 8ft wall preset: ${bayVal === '2'}`);

    // Take Screenshot 2: Modal Filled
    const screenshot2Path = path.join(ARTIFACT_DIR, 'adm_store_ops_p3_fixture_modal_interactive.png');
    await page.screenshot({ path: screenshot2Path, fullPage: false });
    console.log(`✓ Screenshot 2 saved to: ${screenshot2Path}`);

    // Close Modal via Cancel button
    console.log('\n7. Testing Modal Cancel...');
    await page.locator('[data-testid="btn-cancel-fixture"]').click();
    await page.waitForTimeout(600);
    const isModalClosed = !(await page.locator('[data-testid="fixture-modal-backdrop"]').isVisible());
    results['Modal_Closes_On_Cancel'] = isModalClosed;
    console.log(`✓ Modal closed successfully: ${isModalClosed}`);

    // 8. Regression: Test other tabs
    console.log('\n8. Regression Testing Other Tabs...');
    await page.locator('[data-testid="tab-overview"]').click();
    await page.waitForTimeout(1000);
    results['Tab_Overview_Working'] = await page.locator('[data-testid="tab-content-overview"]').isVisible();

    await page.locator('[data-testid="tab-inventory"]').click();
    await page.waitForTimeout(1000);
    results['Tab_Inventory_Working'] = await page.locator('[data-testid="tab-content-inventory"]').isVisible();

    await page.locator('[data-testid="tab-orders"]').click();
    await page.waitForTimeout(1000);
    results['Tab_Orders_Working'] = await page.locator('[data-testid="tab-content-orders"]').isVisible();

    await page.locator('[data-testid="tab-sales"]').click();
    await page.waitForTimeout(1000);
    results['Tab_Sales_Working'] = await page.locator('[data-testid="tab-content-sales"]').isVisible();

    await page.locator('[data-testid="tab-training"]').click();
    await page.waitForTimeout(1000);
    results['Tab_Training_Working'] = await page.locator('[data-testid="tab-content-training"]').isVisible();

    // Return to Fixtures Tab
    await page.locator('[data-testid="tab-fixtures"]').click();
    await page.waitForTimeout(1000);
    results['Return_To_Fixtures_Working'] = await page.locator('[data-testid="tab-content-fixtures"]').isVisible();
    results['URL_Has_Tab_Fixtures'] = page.url().includes('tab=fixtures');
    console.log(`✓ Regression tests passed across all 6 tabs`);

    console.log('\n================================================================================');
    console.log('QA RESULTS MATRIX:');
    console.table(results);
    console.log('================================================================================');

    const allPassed = Object.values(results).every(Boolean);
    if (!allPassed) {
      console.error('❌ One or more QA checks failed!');
      process.exit(1);
    } else {
      console.log('🎉 ALL QA MATRIX CHECKS PASSED PERFECTLY!');
    }
  } finally {
    clearTimeout(deadline);
    await browser.close();
  }
}

runQA().catch((err) => {
  console.error('[QA Fatal Error]:', err);
  process.exit(1);
});
