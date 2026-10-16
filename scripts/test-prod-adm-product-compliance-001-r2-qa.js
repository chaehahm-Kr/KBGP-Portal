// scripts/test-prod-adm-product-compliance-001-r2-qa.js
// Production Browser QA Matrix for ADM-PRODUCT-COMPLIANCE-001-R2
// Focus: Korean prefill for Compliance Brand Inquiry, all 3 entry shortcuts, section mapping, cancel safety, manual new case intact.

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
  console.log('ADM-PRODUCT-COMPLIANCE-001-R2 PRODUCTION BROWSER QA MATRIX');
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
    console.log(`✓ QA Admin User verified (${adminUser.email})`);
  }

  // Get initial inquiry count to assert no cases are created
  const { count: initialInquiryCount } = await client
    .from('partner_inquiries')
    .select('*', { count: 'exact', head: true });
  console.log(`Initial Partner Inquiries count in DB: ${initialInquiryCount}`);

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

    // Grab first product row information from the table
    const firstRow = page.locator('tbody tr').first();
    const productNameEl = firstRow.locator('td').nth(1).locator('div').first();
    const targetProductName = (await productNameEl.innerText()).trim();
    console.log(`   Inspecting target product: "${targetProductName}"`);

    // ==============================================================================
    // ENTRY POINT 1: Product List > Contact Shortcut
    // ==============================================================================
    console.log('\n3. Testing Entry Point 1: Product List > Contact...');
    const listContactLink = firstRow.locator('a:has-text("Contact ↗")').first();
    const listHref = await listContactLink.getAttribute('href');
    console.log(`   List Contact Link Href: ${listHref}`);
    results['List_Contact_Href_Has_NewCase_And_ProductId'] =
      listHref.includes('newCase=1') && listHref.includes('productId=');

    // Open link in the current page
    await page.goto(`${ADMIN_URL}${listHref}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(2000);

    // Assert New Case modal opened automatically
    const modal1 = page.locator('div[role="dialog"], div.fixed:has-text("새 케이스 등록")').first();
    const isModal1Open = await modal1.isVisible();
    results['Entry1_Auto_Opens_New_Case_Modal'] = isModal1Open;
    console.log(`   [Test 1] Modal auto-opened from list Contact: ${isModal1Open ? 'PASS' : 'FAIL'}`);

    // Verify Title format: [컴플라이언스] {Product Name} — 자료 요청
    const titleInput1 = modal1.locator('input[placeholder*="제목"]').first();
    const titleVal1 = await titleInput1.inputValue();
    console.log(`   Prefilled Title 1: "${titleVal1}"`);
    const hasCorrectTitle1 = titleVal1.startsWith('[컴플라이언스]') && titleVal1.includes('— 자료 요청');
    results['Entry1_Korean_Title_Prefilled'] = hasCorrectTitle1;

    // Verify Content format: Korean greeting, product name, SKU, brand, section
    const contentInput1 = modal1.locator('textarea[placeholder*="상세 내용"]').first();
    const contentVal1 = await contentInput1.inputValue();
    console.log(`   Prefilled Content 1:\n${contentVal1}\n`);
    const hasGreeting1 = contentVal1.includes('안녕하세요.') && contentVal1.includes('미국 시장 판매 및 수입 관련');
    const hasListSection1 = contentVal1.includes('확인 항목: 컴플라이언스 전반');
    const hasClosing1 = contentVal1.includes('회신 부탁드립니다.') && contentVal1.includes('감사합니다.');
    results['Entry1_Content_Has_Korean_Greeting_And_Closing'] = hasGreeting1 && hasClosing1;
    results['Entry1_List_Uses_General_Section_Label'] = hasListSection1;

    // Verify Category: product ("제품 등록 및 스펙 수정")
    const categorySelect1 = modal1.locator('select').nth(1); // 2nd select (Category)
    const categoryVal1 = await categorySelect1.inputValue();
    results['Entry1_Category_Is_Product'] = categoryVal1 === 'product';

    // Verify Email Send is NOT automatically checked
    const emailCheckbox1 = modal1.locator('input#newSendEmail');
    const isEmailChecked1 = await emailCheckbox1.isChecked();
    results['Entry1_Email_Send_Not_Auto_Checked'] = !isEmailChecked1;

    // Verify Action Required is NOT automatically checked
    const actionRequiredCheckbox1 = modal1.locator('input#newIsActionRequired');
    const isActionChecked1 = await actionRequiredCheckbox1.isChecked();
    results['Entry1_Action_Required_Not_Auto_Checked'] = !isActionChecked1;

    // Test text editability
    await titleInput1.fill(titleVal1 + ' [수정 테스트]');
    const editedTitle = await titleInput1.inputValue();
    results['Prefill_Title_Is_Editable'] = editedTitle.includes('[수정 테스트]');

    // Capture screenshot of prefilled New Case modal from Entry 1
    const modal1Screenshot = path.join(ARTIFACT_DIR, 'prod_adm_compliance_r2_entry1_prefill.png');
    await page.screenshot({ path: modal1Screenshot, fullPage: false });
    console.log(`   ✓ Saved screenshot: ${modal1Screenshot}`);

    // Click 취소 (Cancel) and verify modal closes and NO case is created
    const cancelBtn1 = modal1.locator('button:has-text("취소")').first();
    await cancelBtn1.click();
    await page.waitForTimeout(600);
    const isModal1Closed = !(await modal1.isVisible());
    results['Entry1_Cancel_Closes_Modal'] = isModal1Closed;
    console.log(`   [Test 2] Cancel cleanly closes modal: ${isModal1Closed ? 'PASS' : 'FAIL'}`);

    // ==============================================================================
    // ENTRY POINT 2 & 3: Review Checklist Header & Sidebar Shortcuts
    // ==============================================================================
    console.log('\n4. Navigating back to Compliance to test Entry Points 2 & 3...');
    await page.goto(`${ADMIN_URL}/admin/products/compliance`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(2000);

    // Open detail modal for the first product
    const reviewBtn = page.locator('tbody tr button:has-text("Review Checklist")').first();
    await reviewBtn.click();
    await page.waitForTimeout(1000);

    const compModal = page.locator('div[role="dialog"]').first();

    // Switch to Section 2: "Product Labeling"
    const s2Btn = compModal.locator('button:has-text("Product Labeling")').first();
    await s2Btn.click();
    await page.waitForTimeout(500);

    // Check Header "Contact Brand ↗" href
    const headerContactLink = compModal.locator('a:has-text("Contact Brand ↗")').first();
    const headerHref = await headerContactLink.getAttribute('href');
    console.log(`   Modal Header Contact Link Href: ${headerHref}`);
    results['Modal_Header_Href_Has_Section_2'] =
      headerHref.includes('newCase=1') && headerHref.includes('section=2');

    // Check Sidebar "Open Brand Inquiries ↗" href
    const sidebarContactLink = compModal.locator('a:has-text("Open Brand Inquiries ↗")').first();
    const sidebarHref = await sidebarContactLink.getAttribute('href');
    console.log(`   Modal Sidebar Contact Link Href: ${sidebarHref}`);
    results['Modal_Sidebar_Href_Has_Section_2'] =
      sidebarHref.includes('newCase=1') && sidebarHref.includes('section=2');

    // Switch to Section 7: "Import & Customs"
    const s7Btn = compModal.locator('button:has-text("Import & Customs")').first();
    await s7Btn.click();
    await page.waitForTimeout(500);

    const s7HeaderHref = await headerContactLink.getAttribute('href');
    console.log(`   Section 7 Header Contact Link Href: ${s7HeaderHref}`);
    results['Modal_Header_Href_Updates_To_Section_7'] = s7HeaderHref.includes('section=7');

    // Now click Header Contact Brand ↗ (Navigate to the generated URL)
    console.log('\n5. Testing Entry Point 2: Review Checklist Header > Contact Brand (Section 7)...');
    await page.goto(`${ADMIN_URL}${s7HeaderHref}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(2000);

    const modal2 = page.locator('div[role="dialog"], div.fixed:has-text("새 케이스 등록")').first();
    const isModal2Open = await modal2.isVisible();
    results['Entry2_Auto_Opens_New_Case_Modal'] = isModal2Open;

    const contentInput2 = modal2.locator('textarea[placeholder*="상세 내용"]').first();
    const contentVal2 = await contentInput2.inputValue();
    console.log(`   Prefilled Content 2 (Section 7):\n${contentVal2}\n`);
    const hasSection7Korean = contentVal2.includes('확인 항목: 수입 및 통관 정보');
    results['Entry2_Uses_Korean_Section_Label_Import_Customs'] = hasSection7Korean;

    // Capture screenshot of Section 7 prefill
    const modal2Screenshot = path.join(ARTIFACT_DIR, 'prod_adm_compliance_r2_entry2_section7_prefill.png');
    await page.screenshot({ path: modal2Screenshot, fullPage: false });
    console.log(`   ✓ Saved screenshot: ${modal2Screenshot}`);

    // Cancel modal 2
    const cancelBtn2 = modal2.locator('button:has-text("취소")').first();
    await cancelBtn2.click();
    await page.waitForTimeout(600);

    // ==============================================================================
    // ENTRY POINT 3: Test Section 2 ("제품 라벨링") Korean prefill
    // ==============================================================================
    console.log('\n6. Testing Entry Point 3: Section 2 ("제품 라벨링") prefill...');
    await page.goto(`${ADMIN_URL}${sidebarHref}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(2000);

    const modal3 = page.locator('div[role="dialog"], div.fixed:has-text("새 케이스 등록")').first();
    const contentInput3 = modal3.locator('textarea[placeholder*="상세 내용"]').first();
    const contentVal3 = await contentInput3.inputValue();
    const hasSection2Korean = contentVal3.includes('확인 항목: 제품 라벨링');
    results['Entry3_Uses_Korean_Section_Label_Product_Labeling'] = hasSection2Korean;
    console.log(`   [Test 3] Section 2 prefilled as "확인 항목: 제품 라벨링": ${hasSection2Korean ? 'PASS' : 'FAIL'}`);

    // Cancel modal 3
    const cancelBtn3 = modal3.locator('button:has-text("취소")').first();
    await cancelBtn3.click();
    await page.waitForTimeout(600);

    // ==============================================================================
    // 7. Test Manual New Case Workflow Intact
    // ==============================================================================
    console.log('\n7. Verifying Manual New Case Workflow Remains Intact...');
    const manualNewCaseBtn = page.locator('button:has-text("+ 새 케이스")').first();
    await manualNewCaseBtn.click();
    await page.waitForTimeout(600);

    const manualModal = page.locator('div[role="dialog"], div.fixed:has-text("새 케이스 등록")').first();
    const isManualModalOpen = await manualModal.isVisible();
    results['Manual_New_Case_Modal_Opens'] = isManualModalOpen;

    const manualTitleInput = manualModal.locator('input[placeholder*="제목"]').first();
    const manualTitleVal = await manualTitleInput.inputValue();
    const manualContentInput = manualModal.locator('textarea[placeholder*="상세 내용"]').first();
    const manualContentVal = await manualContentInput.inputValue();

    const isManualEmpty = manualTitleVal === '' && manualContentVal === '';
    results['Manual_New_Case_Opens_Empty_Without_Compliance_Prefill'] = isManualEmpty;
    console.log(`   [Test 4] Manual + 새 케이스 opens empty: ${isManualEmpty ? 'PASS' : 'FAIL'}`);

    const manualCancelBtn = manualModal.locator('button:has-text("취소")').first();
    await manualCancelBtn.click();
    await page.waitForTimeout(600);

    // ==============================================================================
    // 8. DB Audit: Verify No Cases Created During QA
    // ==============================================================================
    console.log('\n8. Auditing DB: Verifying no inquiry records were created...');
    const { count: finalInquiryCount } = await client
      .from('partner_inquiries')
      .select('*', { count: 'exact', head: true });
    console.log(`Final Partner Inquiries count in DB: ${finalInquiryCount}`);
    const noCasesCreated = finalInquiryCount === initialInquiryCount;
    results['No_Cases_Created_During_QA'] = noCasesCreated;
    console.log(`   [Test 5] Zero cases created during cancel/review QA: ${noCasesCreated ? 'PASS' : 'FAIL'}`);

    // ==============================================================================
    // 9. Regression Check: Product Catalog Intact
    // ==============================================================================
    console.log('\n9. Verifying Product Catalog (/admin/products) is Intact...');
    await page.goto(`${ADMIN_URL}/admin/products`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(2000);
    const catalogHeader = page.locator('h1:has-text("제품 통합 관리"), h1:has-text("제품 관리")').first();
    const isCatalogHeaderVisible = await catalogHeader.isVisible();
    results['Product_Catalog_Intact'] = isCatalogHeaderVisible;
    console.log(`   [Test 6] Product Catalog intact: ${isCatalogHeaderVisible ? 'PASS' : 'FAIL'}`);

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
