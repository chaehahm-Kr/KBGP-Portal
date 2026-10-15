// scripts/test-prod-adm-training-p2-001-qa.js
// ADM-TRAINING-P2-001: Verified Training Completion, Store Coverage & Retailer Training Analytics
// Production Browser QA Matrix

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

let env = {};
if (fs.existsSync('.env.local')) {
  fs.readFileSync('.env.local', 'utf8').split('\n').forEach((l) => {
    const m = l.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (m) env[m[1]] = (m[2] || '').trim().replace(/^['"]|['"]$/g, '');
  });
}

const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY);
const ARTIFACT_DIR = path.resolve('C:/Users/ChaeHahm/.gemini/antigravity/brain/945ab025-0f8f-4fce-b0bc-56237108874e');
const ADMIN_URL = 'https://admin.kselectnetwork.com';
const TEST_COMPANY_ID = 'dc9249be-a9e0-4975-a4c9-b602bb2baa47';

async function runQA() {
  console.log('================================================================================');
  console.log('ADM-TRAINING-P2-001 PRODUCTION BROWSER QA MATRIX');
  console.log('Target: ' + ADMIN_URL);
  console.log('================================================================================\n');

  // Verify/reset QA admin credentials
  const { data: users } = await client.auth.admin.listUsers();
  const adminUser = users?.users?.find((u) => u.email === 'qa-admin-test@letusto.com');
  if (adminUser) {
    await client.auth.admin.updateUserById(adminUser.id, { password: 'Password123!@#' });
    console.log(`✓ Admin QA User verified (${adminUser.email})`);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();

  const results = {};

  try {
    // 1. Login to Admin Portal
    console.log('1. Logging in to Admin Portal...');
    await page.goto(`${ADMIN_URL}/admin/login`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.locator('input#email, input[type="email"]').fill('qa-admin-test@letusto.com');
    await page.locator('input#password, input[type="password"]').fill('Password123!@#');
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(3000);

    // 2. Retailers List Verification (Column 11 Coverage)
    console.log('2. Navigating to Retailers List (/admin/retailers)...');
    await page.goto(`${ADMIN_URL}/admin/retailers`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(3000);

    const retailerRow = page.locator('tr:has-text("dc9249be"), tr:has(a[href*="' + TEST_COMPANY_ID + '"])').first();
    const isRetailerVisible = await retailerRow.isVisible();
    results['Retailers_List_Loaded'] = isRetailerVisible;
    console.log(`[Test 1] Retailers List loaded target retailer: ${isRetailerVisible ? 'PASS' : 'FAIL'}`);

    // Check Column 11 Training Coverage in Retailers List
    const trainingCol = retailerRow.locator('td').nth(10); // 0-indexed 10 = Column 11
    const trainingText = await trainingCol.innerText();
    const hasCoverageFormat = trainingText.includes('%') || trainingText.includes('N/A') || trainingText.includes('Not Tracked') || trainingText.includes('Needs Review');
    results['Retailer_List_Column_11_Training_Metric'] = hasCoverageFormat;
    console.log(`[Test 2] Retailer List Column 11 Coverage Metric ("${trainingText.replace(/\n/g, ' ')}"): ${hasCoverageFormat ? 'PASS' : 'FAIL'}`);

    const trainingLink = trainingCol.locator('a[href*="tab=training"]');
    const hasTrainingLink = (await trainingLink.count()) > 0;
    results['Retailer_List_Training_Link_Present'] = hasTrainingLink;
    console.log(`[Test 3] Column 11 Links to tab=training: ${hasTrainingLink ? 'PASS' : 'FAIL'}`);

    const listScreenshot = path.join(ARTIFACT_DIR, 'prod_adm_training_p2_retailers_list.png');
    await page.screenshot({ path: listScreenshot, fullPage: false });
    console.log(`✓ Saved screenshot: ${listScreenshot}`);

    // 3. Navigate to Retailer 360 Training Tab
    console.log('3. Navigating to Retailer 360 Training Tab...');
    await page.goto(`${ADMIN_URL}/admin/retailers/${TEST_COMPANY_ID}?tab=training`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(3000);

    // Verify Tab 7 "Training" is active
    const activeTab = page.locator('button:has-text("Training")').first();
    const isTrainingTabVisible = await activeTab.isVisible();
    results['Training_Tab_Active'] = isTrainingTabVisible;
    console.log(`[Test 4] Training Tab visible in Retailer 360: ${isTrainingTabVisible ? 'PASS' : 'FAIL'}`);

    // Verify Header & Methodology Explainer
    const headerTitle = page.locator('h3:has-text("Product Training Completion & Store Coverage")');
    const isHeaderVisible = await headerTitle.isVisible();
    results['Training_Header_Title_Visible'] = isHeaderVisible;
    console.log(`[Test 5] Header Title Visible: ${isHeaderVisible ? 'PASS' : 'FAIL'}`);

    const serverVerifiedPill = page.locator('text=Server-Verified Quiz Passes Only').first();
    const isPillVisible = await serverVerifiedPill.isVisible();
    results['Server_Verified_Pill_Visible'] = isPillVisible;
    console.log(`[Test 6] "Server-Verified Quiz Passes Only" Pill Visible: ${isPillVisible ? 'PASS' : 'FAIL'}`);

    const methodologyBanner = page.locator('text=Coverage Methodology:').first();
    const isMethodologyVisible = await methodologyBanner.isVisible();
    results['Methodology_Banner_Visible'] = isMethodologyVisible;
    console.log(`[Test 7] Coverage Methodology Banner Visible: ${isMethodologyVisible ? 'PASS' : 'FAIL'}`);

    // 4. Verify 4 Summary KPI Cards
    console.log('4. Verifying 4 KPI Cards...');
    const kpi1 = page.locator('span:text-is("Training Coverage (%)")');
    const kpi2 = page.locator('span:text-is("Covered Store/Product Pairs")');
    const kpi3 = page.locator('span:text-is("Employees with Verified Passes")');
    const kpi4 = page.locator('span:text-is("Training Gaps")');

    const kpi1Ok = await kpi1.isVisible();
    const kpi2Ok = await kpi2.isVisible();
    const kpi3Ok = await kpi3.isVisible();
    const kpi4Ok = await kpi4.isVisible();

    results['KPI_1_Training_Coverage'] = kpi1Ok;
    results['KPI_2_Covered_Pairs'] = kpi2Ok;
    results['KPI_3_Employees_Trained'] = kpi3Ok;
    results['KPI_4_Training_Gaps'] = kpi4Ok;

    console.log(`[Test 8] 4 Summary KPI Cards: KPI1=${kpi1Ok}, KPI2=${kpi2Ok}, KPI3=${kpi3Ok}, KPI4=${kpi4Ok}`);

    const overviewScreenshot = path.join(ARTIFACT_DIR, 'prod_adm_training_p2_overview_kpis.png');
    await page.screenshot({ path: overviewScreenshot, fullPage: false });
    console.log(`✓ Saved screenshot: ${overviewScreenshot}`);

    // 5. Test SubTab 1: Store Coverage & Expandable Drill-Down
    console.log('5. Testing SubTab 1: Store Coverage & Drill-Down...');
    const storeSubTabBtn = page.getByRole('button', { name: /Store Coverage/ });
    await storeSubTabBtn.click();
    await page.waitForTimeout(1000);

    const storeRows = page.locator('tbody tr:has-text("🏪")');
    const storeRowCount = await storeRows.count();
    results['Store_Coverage_Rows_Present'] = storeRowCount > 0;
    console.log(`[Test 9] Store Coverage rows present: count=${storeRowCount} (${storeRowCount > 0 ? 'PASS' : 'FAIL'})`);

    // Target the expand button directly inside the first store row
    const firstStoreRow = storeRows.first();
    const expandBtn = firstStoreRow.locator('button').last();
    const hasExpandBtn = await expandBtn.isVisible();
    results['Store_Expand_Button_Present'] = hasExpandBtn;
    console.log(`[Test 10] Store Drill-Down Expand Button Present: ${hasExpandBtn ? 'PASS' : 'FAIL'}`);

    if (hasExpandBtn) {
      await expandBtn.scrollIntoViewIfNeeded();
      await expandBtn.click();
      await page.waitForTimeout(1000);

      const drilldownSection = page.locator('h5:has-text("Product Coverage Drill-Down")');
      const isDrilldownOpen = await drilldownSection.isVisible();
      results['Store_Drilldown_Opened'] = isDrilldownOpen;
      console.log(`[Test 11] Store Drilldown Table Opened: ${isDrilldownOpen ? 'PASS' : 'FAIL'}`);

      // Test store product filter buttons inside drilldown
      const coveredFilterBtn = page.locator('button:has-text("Covered (")').first();
      if (await coveredFilterBtn.isVisible()) {
        await coveredFilterBtn.click();
        await page.waitForTimeout(500);
      }
      const allFilterBtn = page.locator('button:has-text("All (")').first();
      if (await allFilterBtn.isVisible()) {
        await allFilterBtn.click();
        await page.waitForTimeout(500);
      }

      const storeDrilldownScreenshot = path.join(ARTIFACT_DIR, 'prod_adm_training_p2_store_drilldown.png');
      await page.screenshot({ path: storeDrilldownScreenshot, fullPage: true });
      console.log(`✓ Saved screenshot: ${storeDrilldownScreenshot}`);
    }

    // 6. Test SubTab 2: Employee Completion & Detail Modal
    console.log('6. Testing SubTab 2: Employee Completion & Detail Modal...');
    const empSubTabBtn = page.getByRole('button', { name: /Employee Completion/ });
    await empSubTabBtn.click();
    await page.waitForTimeout(1000);

    const empRows = page.locator('tbody tr:has-text("👤")');
    const empCount = await empRows.count();
    results['Employee_Rows_Present'] = empCount > 0;
    console.log(`[Test 12] Employee rows present: count=${empCount} (${empCount > 0 ? 'PASS' : 'FAIL'})`);

    const viewDetailBtn = page.locator('button:has-text("View Detail →")').first();
    const hasViewDetailBtn = await viewDetailBtn.isVisible();
    results['Employee_View_Detail_Button_Present'] = hasViewDetailBtn;
    console.log(`[Test 13] View Detail button present: ${hasViewDetailBtn ? 'PASS' : 'FAIL'}`);

    if (hasViewDetailBtn) {
      await viewDetailBtn.click();
      await page.waitForTimeout(1000);

      const modalTitle = page.locator('h3:has-text("Staff Training Record:")');
      const isModalOpen = await modalTitle.isVisible();
      results['Employee_Modal_Opens'] = isModalOpen;
      console.log(`[Test 14] Employee Training Record Modal Opens: ${isModalOpen ? 'PASS' : 'FAIL'}`);

      // Verify store attribution note
      const storeAttribution = page.locator('text=Relevant Store Coverage:');
      const hasStoreAttribution = await storeAttribution.isVisible();
      results['Modal_Store_Attribution_Visible'] = hasStoreAttribution;
      console.log(`[Test 15] Store Attribution Note Visible in Modal: ${hasStoreAttribution ? 'PASS' : 'FAIL'}`);

      // Verify strict security callout (no answer keys exposed)
      const securityNote = page.locator('text=Strict Security: Knowledge assessment quiz questions and answer keys are protected server-side and never exposed to reporting clients.');
      const hasSecurityNote = await securityNote.isVisible();
      results['Modal_Answer_Key_Security_Notice'] = hasSecurityNote;
      console.log(`[Test 16] Answer Key Protection Notice in Modal: ${hasSecurityNote ? 'PASS' : 'FAIL'}`);

      const employeeModalScreenshot = path.join(ARTIFACT_DIR, 'prod_adm_training_p2_employee_modal.png');
      await page.screenshot({ path: employeeModalScreenshot, fullPage: false });
      console.log(`✓ Saved screenshot: ${employeeModalScreenshot}`);

      // Close modal
      const closeBtn = page.locator('button:has-text("Close")').last();
      await closeBtn.click();
      await page.waitForTimeout(500);
      const isModalClosed = !(await modalTitle.isVisible());
      results['Employee_Modal_Closes'] = isModalClosed;
      console.log(`[Test 17] Employee Modal Closes: ${isModalClosed ? 'PASS' : 'FAIL'}`);
    }

    // 7. Test SubTab 3: Product Training Gaps
    console.log('7. Testing SubTab 3: Product Training Gaps...');
    const gapsSubTabBtn = page.getByRole('button', { name: /Product Training Gaps/ });
    await gapsSubTabBtn.click();
    await page.waitForTimeout(1000);

    const gapsHeader = page.locator('h4:has-text("Product Training Gap Analysis")');
    const isGapsHeaderVisible = await gapsHeader.isVisible();
    results['Product_Gaps_Header_Visible'] = isGapsHeaderVisible;
    console.log(`[Test 18] Product Training Gaps Header Visible: ${isGapsHeaderVisible ? 'PASS' : 'FAIL'}`);

    // Test gap filter buttons
    const needsTrainingFilter = page.locator('button:has-text("Needs Training (")');
    if (await needsTrainingFilter.isVisible()) {
      await needsTrainingFilter.click();
      await page.waitForTimeout(500);
    }
    const allGapsFilter = page.locator('button:has-text("All Products (")').first();
    if (await allGapsFilter.isVisible()) {
      await allGapsFilter.click();
      await page.waitForTimeout(500);
    }

    const gapsScreenshot = path.join(ARTIFACT_DIR, 'prod_adm_training_p2_product_gaps.png');
    await page.screenshot({ path: gapsScreenshot, fullPage: true });
    console.log(`✓ Saved screenshot: ${gapsScreenshot}`);

    // 8. Verify Versioning & Retraining Policy callout
    console.log('8. Verifying Versioning & Retraining Policy...');
    const policyHeader = page.locator('text=Training Versioning & Retraining Policy');
    const isPolicyVisible = await policyHeader.isVisible();
    const policyText = page.locator('text=NEEDS OWNER DECISION');
    const hasOwnerDecisionNotice = await policyText.isVisible();
    results['Versioning_Policy_Visible'] = isPolicyVisible;
    results['Needs_Owner_Decision_Notice_Visible'] = hasOwnerDecisionNotice;
    console.log(`[Test 19] Versioning Policy Banner: ${isPolicyVisible ? 'PASS' : 'FAIL'}, Needs Owner Decision Notice: ${hasOwnerDecisionNotice ? 'PASS' : 'FAIL'}`);

    // 9. Test Reload Persistence
    console.log('9. Testing Reload Persistence...');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    const trainingHeaderAfterReload = page.locator('h3:has-text("Product Training Completion & Store Coverage")');
    const isPersisted = await trainingHeaderAfterReload.isVisible();
    results['Reload_Persistence'] = isPersisted;
    console.log(`[Test 20] Reload Persistence (?tab=training remains active): ${isPersisted ? 'PASS' : 'FAIL'}`);

    // Final QA summary
    console.log('\n================================================================================');
    console.log('PROD QA RESULTS MATRIX:');
    let allPass = true;
    for (const [test, pass] of Object.entries(results)) {
      console.log(`- ${test}: ${pass ? 'PASS' : 'FAIL'}`);
      if (!pass) allPass = false;
    }
    console.log(`\nOVERALL PRODUCTION QA: ${allPass ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`);
    console.log('================================================================================');
  } catch (err) {
    console.error('QA Execution Error:', err);
    throw err;
  } finally {
    await browser.close();
  }
}

runQA().catch((err) => {
  console.error(err);
  process.exit(1);
});
