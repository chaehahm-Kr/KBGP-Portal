// scripts/test-prod-adm-product-compliance-001-r1-qa.js
// Production Browser QA Matrix for ADM-PRODUCT-COMPLIANCE-001-R1
// Focus: Two-panel review layout, section switching, sequential buttons, enhanced classification badges, and Contact Brand shortcuts.

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
const ARTIFACT_DIR = path.resolve('C:/Users/ChaeHahm/.gemini/antigravity/brain/945ab025-0f8f-4fce-b0bc-56237108874e');
const ADMIN_URL = 'https://admin.kselectnetwork.com';
const TEST_EMAIL = 'qa-admin-test@letusto.com';
const TEST_PASSWORD = process.env.TEST_ADMIN_PASSWORD || 'Password123!@#';

// 300-second process timeout
const deadline = setTimeout(() => {
  console.error('[QA FATAL] 300s hard process timeout exceeded, forcing exit');
  process.exit(1);
}, 300000);

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

function isIncluded(targetSha, liveSha) {
  if (!liveSha) return false;
  if (liveSha.startsWith(targetSha)) return true;
  try {
    require('child_process').execSync(`git merge-base --is-ancestor ${targetSha} ${liveSha}`);
    return true;
  } catch {
    return false;
  }
}

async function waitForDeployment(targetSha) {
  console.log(`Polling ${ADMIN_URL}/api/diagnostics for commit prefix ${targetSha}...`);
  for (let i = 0; i < 60; i++) {
    const diag = await checkDiagnostics(`${ADMIN_URL}/api/diagnostics`);
    console.log(`  [Attempt ${i + 1}] Live SHA: ${diag.sha}`);
    if (diag.sha && isIncluded(targetSha, diag.sha)) {
      console.log(`✓ Deployment Ready: ${diag.sha}\n`);
      return diag.sha;
    }
    await new Promise((r) => setTimeout(r, 4000));
  }
  throw new Error(`Timeout waiting for Vercel deployment of ${targetSha}`);
}

async function runQA() {
  console.log('================================================================================');
  console.log('ADM-PRODUCT-COMPLIANCE-001-R1 PRODUCTION BROWSER QA MATRIX');
  console.log('Target: ' + ADMIN_URL);
  console.log('================================================================================\n');

  // Obtain current git commit SHA prefix (208c40a)
  const targetSha = process.env.TARGET_SHA || '208c40a';
  console.log(`Target Feature SHA: ${targetSha}`);

  const liveSha = await waitForDeployment(targetSha);

  // Verify Admin QA user credentials
  const { data: users } = await client.auth.admin.listUsers();
  const adminUser = users?.users?.find((u) => u.email === TEST_EMAIL);
  if (adminUser) {
    await client.auth.admin.updateUserById(adminUser.id, { password: TEST_PASSWORD });
    console.log(`✓ QA Admin User verified (${adminUser.email})`);
  }

  const browser = await chromium.launch({ headless: true });
  const results = {};

  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();

    // 1. Diagnostics verification
    results['Diagnostics_Live_SHA_Matches'] = isIncluded(targetSha, liveSha);

    // 2. Admin Login
    console.log('\n1. Logging into Admin Portal...');
    await page.goto(`${ADMIN_URL}/admin/login`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.locator('input#email, input[type="email"]').fill(TEST_EMAIL);
    await page.locator('input#password, input[type="password"]').fill(TEST_PASSWORD);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 20000 });
    await page.waitForTimeout(2000);
    results['Admin_Login_Successful'] = true;
    console.log('   ✓ Logged in successfully. Current URL: ' + page.url());

    // 3. Navigate to Compliance page
    console.log('\n2. Navigating to /admin/products/compliance...');
    await page.goto(`${ADMIN_URL}/admin/products/compliance`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(2000);
    results['Navigates_To_Dedicated_Compliance_Page'] = page.url().includes('/admin/products/compliance');
    console.log(`   ✓ Navigated to /admin/products/compliance: PASS`);

    // 4. Verify Brand Inquiries Shortcut in Header
    console.log('\n3. Verifying Brand Inquiries Top-level Shortcut...');
    const brandInquiriesHeaderBtn = page.locator('a[href="/admin/partner-inquiries?type=brand"]:has-text("Brand Inquiries")').first();
    const hasHeaderShortcut = await brandInquiriesHeaderBtn.isVisible();
    results['Header_Brand_Inquiries_Shortcut_Present'] = hasHeaderShortcut;
    console.log(`   [Test 1] Header shortcut to Brand Inquiries present: ${hasHeaderShortcut ? 'PASS' : 'FAIL'}`);

    // 5. Verify Table Contact Shortcut
    console.log('\n4. Verifying Table Row Contact Shortcut...');
    const tableContactBtn = page.locator('tbody tr a[href="/admin/partner-inquiries?type=brand"]:has-text("Contact")').first();
    const hasTableContact = await tableContactBtn.isVisible();
    results['Table_Row_Contact_Shortcut_Present'] = hasTableContact;
    console.log(`   [Test 2] Table row Contact shortcut present: ${hasTableContact ? 'PASS' : 'FAIL'}`);

    // 6. Test Two-Panel Modal Layout
    console.log('\n5. Testing Two-Panel Modal & Classification Badges...');
    const reviewChecklistBtn = page.locator('button:has-text("Review Checklist")').first();
    await reviewChecklistBtn.click();
    await page.waitForTimeout(1000);

    const modalDialog = page.locator('div[role="dialog"]');
    const isModalOpen = await modalDialog.isVisible();
    results['Detail_Modal_Opens'] = isModalOpen;
    console.log(`   [Test 3] Detail Modal opened: ${isModalOpen ? 'PASS' : 'FAIL'}`);

    // Verify Modal Header "Contact Brand" shortcut
    const modalContactBrandBtn = modalDialog.locator('a[href="/admin/partner-inquiries?type=brand"]:has-text("Contact Brand")').first();
    const hasModalContact = await modalContactBrandBtn.isVisible();
    results['Modal_Contact_Brand_Shortcut_Present'] = hasModalContact;
    console.log(`   [Test 4] Modal header Contact Brand shortcut present: ${hasModalContact ? 'PASS' : 'FAIL'}`);

    // Verify Left Navigation Panel contains all 7 section buttons
    const s1Btn = modalDialog.locator('button:has-text("Product Classification")').first();
    const s2Btn = modalDialog.locator('button:has-text("Product Labeling")').first();
    const s3Btn = modalDialog.locator('button:has-text("FDA Related")').first();
    const s4Btn = modalDialog.locator('button:has-text("MoCRA")').first();
    const s5Btn = modalDialog.locator('button:has-text("OTC / Drug Facts")').first();
    const s6Btn = modalDialog.locator('button:has-text("Certifications & Testing")').first();
    const s7Btn = modalDialog.locator('button:has-text("Import & Customs")').first();

    const allButtonsPresent =
      (await s1Btn.isVisible()) &&
      (await s2Btn.isVisible()) &&
      (await s3Btn.isVisible()) &&
      (await s4Btn.isVisible()) &&
      (await s5Btn.isVisible()) &&
      (await s6Btn.isVisible()) &&
      (await s7Btn.isVisible());

    results['Left_Panel_All_7_Sections_Present'] = allButtonsPresent;
    console.log(`   [Test 5] Left panel lists all 7 sections: ${allButtonsPresent ? 'PASS' : 'FAIL'}`);

    // Verify Left Panel Brand Inquiry notice
    const leftInquiryPrompt = modalDialog.locator('text=Contact Brand Shortcut').first();
    const hasLeftInquiryPrompt = await leftInquiryPrompt.isVisible();
    results['Left_Panel_Brand_Inquiry_Card_Present'] = hasLeftInquiryPrompt;
    console.log(`   [Test 6] Left panel Brand Inquiry context prompt present: ${hasLeftInquiryPrompt ? 'PASS' : 'FAIL'}`);

    // Verify Right Panel initially shows Section 1
    const s1RightHeader = modalDialog.locator('h3:has-text("Product Classification")').first();
    const isS1Active = await s1RightHeader.isVisible();
    results['Right_Panel_Initial_Section_1_Active'] = isS1Active;
    console.log(`   [Test 7] Right panel initial active section is Section 1: ${isS1Active ? 'PASS' : 'FAIL'}`);

    // Capture initial two-panel modal screenshot
    const modalScreenshot = path.join(ARTIFACT_DIR, 'prod_adm_compliance_r1_two_panel_modal.png');
    await page.screenshot({ path: modalScreenshot, fullPage: false });
    console.log(`   ✓ Saved screenshot: ${modalScreenshot}`);

    // 7. Test Section Switching via Left Panel
    console.log('\n6. Testing Section Switching (Section 1 -> Section 2)...');
    await s2Btn.click();
    await page.waitForTimeout(400);

    const s2RightHeader = modalDialog.locator('h3:has-text("Product Labeling")').first();
    const isS2Active = await s2RightHeader.isVisible();
    results['Left_Panel_Click_Switches_Section'] = isS2Active;
    console.log(`   [Test 8] Clicking Section 2 switches right panel to Section 2: ${isS2Active ? 'PASS' : 'FAIL'}`);

    // 8. Test Sequential Navigation (Next Section / Previous Section)
    console.log('\n7. Testing Sequential Navigation Buttons...');
    const nextBtn = modalDialog.locator('button:has-text("Next Section →")').first();
    await nextBtn.click();
    await page.waitForTimeout(400);

    const s3RightHeader = modalDialog.locator('h3:has-text("FDA Related")').first();
    const isS3Active = await s3RightHeader.isVisible();
    results['Next_Section_Button_Switches_To_Section_3'] = isS3Active;
    console.log(`   [Test 9] Next Section button switches to Section 3: ${isS3Active ? 'PASS' : 'FAIL'}`);

    const prevBtn = modalDialog.locator('button:has-text("← Previous Section")').first();
    await prevBtn.click();
    await page.waitForTimeout(400);

    const isBackToS2 = await s2RightHeader.isVisible();
    results['Previous_Section_Button_Returns_To_Section_2'] = isBackToS2;
    console.log(`   [Test 10] Previous Section button returns to Section 2: ${isBackToS2 ? 'PASS' : 'FAIL'}`);

    // Switch to Section 7 to test Regulatory Guidance badge
    console.log('\n8. Verifying Distinct Information Classification Badges...');
    await s7Btn.click();
    await page.waitForTimeout(400);

    const regGuidanceBadges = await modalDialog.locator('text=Regulatory Guidance').count();
    const hasRegGuidance = regGuidanceBadges >= 1;
    results['Regulatory_Guidance_Badge_Present'] = hasRegGuidance;
    console.log(`   [Test 11] "Regulatory Guidance" badge distinct & present in Section 7: ${hasRegGuidance ? 'PASS' : 'FAIL'}`);

    const existingDataBadges = await modalDialog.locator('text=Existing Product Data').count();
    const hasExistingData = existingDataBadges >= 1;
    results['Existing_Product_Data_Badge_Present'] = hasExistingData;
    console.log(`   [Test 12] "Existing Product Data" badge present: ${hasExistingData ? 'PASS' : 'FAIL'}`);

    // Capture Section 7 screenshot
    const section7Screenshot = path.join(ARTIFACT_DIR, 'prod_adm_compliance_r1_section7_guidance.png');
    await page.screenshot({ path: section7Screenshot, fullPage: false });
    console.log(`   ✓ Saved screenshot: ${section7Screenshot}`);

    // 9. Regulatory Safety Notice Present
    const safetyNotice = modalDialog.locator('text=Regulatory Safety Notice').first();
    const hasSafetyNotice = await safetyNotice.isVisible();
    results['Regulatory_Safety_Notice_Present'] = hasSafetyNotice;
    console.log(`   [Test 13] Regulatory safety notice present in right panel: ${hasSafetyNotice ? 'PASS' : 'FAIL'}`);

    // Close Modal
    const closeBtn = modalDialog.locator('button:has-text("✕")').first();
    await closeBtn.click();
    await page.waitForTimeout(500);
    const isModalClosed = !(await modalDialog.isVisible());
    results['Modal_Closes_Cleanly'] = isModalClosed;
    console.log(`   [Test 14] Modal closes cleanly: ${isModalClosed ? 'PASS' : 'FAIL'}`);

    // 10. Test Brand Inquiries Route Navigation
    console.log('\n9. Testing Brand Inquiries Shortcut Navigation...');
    await brandInquiriesHeaderBtn.click();
    await page.waitForURL((url) => url.pathname.includes('/admin/partner-inquiries'), { timeout: 15000 });
    await page.waitForTimeout(1500);
    const isInquiriesPage = page.url().includes('/admin/partner-inquiries');
    results['Brand_Inquiries_Navigation_Successful'] = isInquiriesPage;
    console.log(`   [Test 15] Navigated to Brand Inquiries page: ${isInquiriesPage ? 'PASS' : 'FAIL'}`);

    // 11. Regression Check: Product Catalog intact
    console.log('\n10. Verifying Product Catalog (/admin/products) is Intact & Unaffected...');
    await page.goto(`${ADMIN_URL}/admin/products`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(2000);
    const catalogHeader = page.locator('h1:has-text("제품 통합 관리"), h1:has-text("제품 관리")').first();
    const isCatalogHeaderVisible = await catalogHeader.isVisible();
    results['Product_Catalog_Intact'] = isCatalogHeaderVisible;
    console.log(`   [Test 16] Product Catalog is intact & accessible: ${isCatalogHeaderVisible ? 'PASS' : 'FAIL'}`);

  } catch (err) {
    console.error('[QA ERROR]:', err);
    throw err;
  } finally {
    await browser.close();
    clearTimeout(deadline);
  }

  console.log('\n================================================================================');
  console.log('QA MATRIX SUMMARY RESULTS:');
  console.log(JSON.stringify(results, null, 2));
  console.log('================================================================================\n');

  const failedTests = Object.entries(results).filter(([, passed]) => !passed);
  if (failedTests.length > 0) {
    console.error(`❌ FAILED ${failedTests.length} TESTS:`, failedTests);
    process.exit(1);
  } else {
    console.log('🎉 ALL QA TESTS PASSED ON PRODUCTION!');
    process.exit(0);
  }
}

runQA().catch((err) => {
  console.error('[QA SCRIPT ERROR]:', err);
  process.exit(1);
});
