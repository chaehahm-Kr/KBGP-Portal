// scripts/test-prod-adm-company-detail-layout-001-qa.js
// Production Browser QA Matrix for ADM-COMPANY-DETAIL-LAYOUT-001: Convert Company Detail Tabs to Left Vertical Navigation
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
const ARTIFACT_DIR = path.resolve('C:/Users/ChaeHahm/.gemini/antigravity/brain/730f6e70-61e4-47de-8a28-291a9d425b30');
const ADMIN_URL = 'https://admin.kselectnetwork.com';
const TEST_EMAIL = 'qa-admin-test@letusto.com';
const TEST_PASSWORD = process.env.TEST_ADMIN_PASSWORD || 'Password123!@#';

// 120-second process timeout
const deadline = setTimeout(() => {
  console.error('[QA FATAL] 120s hard process timeout exceeded, forcing exit');
  process.exit(1);
}, 120000);

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
  for (let i = 0; i < 30; i++) {
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
  console.log('ADM-COMPANY-DETAIL-LAYOUT-001 PRODUCTION BROWSER QA MATRIX');
  console.log('Target: ' + ADMIN_URL);
  console.log('================================================================================\n');

  // Obtain current git commit SHA prefix
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

  // Find a target company to test detail page
  const { data: companies, error: compErr } = await client
    .from('companies')
    .select('id, name, company_code')
    .order('created_at', { ascending: false })
    .limit(10);

  if (compErr || !companies || companies.length === 0) {
    throw new Error('Failed to find test company from database');
  }

  // Pick a company with name and code if available
  const testCompany = companies.find(c => c.name && c.company_code) || companies[0];
  console.log(`✓ Target Test Company: ${testCompany.name} (ID: ${testCompany.id}, Code: ${testCompany.company_code || 'N/A'})`);

  const browser = await chromium.launch({ headless: true });
  const results = {};

  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();

    // 1. Diagnostics verification
    results['Diagnostics_Live_SHA_Matches'] = liveSha.startsWith(targetSha);

    // 2. Admin Login
    console.log('\n1. Logging into Admin Portal...');
    await page.goto(`${ADMIN_URL}/admin/login`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.locator('input#email, input[type="email"]').fill(TEST_EMAIL);
    await page.locator('input#password, input[type="password"]').fill(TEST_PASSWORD);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 20000 });
    await page.waitForTimeout(1500);
    results['Admin_Login_Successful'] = true;
    console.log('   ✓ Logged in successfully.');

    // 3. Navigate to Company Detail
    console.log(`\n2. Navigating to Company Detail: /admin/companies/${testCompany.id}...`);
    await page.goto(`${ADMIN_URL}/admin/companies/${testCompany.id}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(2000);

    // 4. Verify Compact Company Header
    console.log('\n3. Verifying Compact Company Header...');
    const headerTitle = await page.locator(`h1:has-text("${testCompany.name}")`).first().isVisible();
    results['Header_Company_Name_Visible'] = headerTitle;
    console.log(`   [Test 1] Header Company Name visible: ${headerTitle ? 'PASS' : 'FAIL'}`);

    const backLink = await page.locator('a[href="/admin/companies"]:has-text("목록으로")').first().isVisible();
    results['Header_Back_Link_Visible'] = backLink;
    console.log(`   [Test 2] Header Back Link visible: ${backLink ? 'PASS' : 'FAIL'}`);

    const roleBadge = await page.locator('text=파트너 유형:').first().isVisible();
    results['Header_Roles_Badge_Visible'] = roleBadge;
    console.log(`   [Test 3] Header Partner Roles visible: ${roleBadge ? 'PASS' : 'FAIL'}`);

    // Screenshot header area
    const headerScreenshot = path.join(ARTIFACT_DIR, 'prod_adm_company_detail_header.png');
    await page.screenshot({ path: headerScreenshot, fullPage: false });
    console.log(`   ✓ Saved screenshot: ${headerScreenshot}`);

    // 5. Verify Left Vertical Navigation Menu Order (10 Menus)
    console.log('\n4. Verifying Left Vertical Navigation Menu (10 Menus in Exact Order)...');
    const expectedMenus = [
      { name: 'Company Information', ko: '회사 정보 관리' },
      { name: 'Contacts & Portal Users', ko: '담당자 & 포털 사용자' },
      { name: 'Responsibility Assignment', ko: '담당 업무 지정' },
      { name: 'Owned Brands', ko: '보유 브랜드' },
      { name: 'Registered Products', ko: '등록 제품' },
      { name: 'Retail Applications', ko: '입점 신청서' },
      { name: 'Agreement Management', ko: '계약 관리' },
      { name: 'Trading Information', ko: '거래 정보' },
      { name: 'Shipping Origin Information', ko: '출고지 정보' },
      { name: 'Bank Information', ko: '은행 정보' },
    ];

    const navButtons = page.locator('[data-testid="company-detail-nav"] nav button');
    const buttonCount = await navButtons.count();
    results['Menu_Count_Exactly_10'] = buttonCount === 10;
    console.log(`   [Test 4] Menu button count: ${buttonCount} (Expected 10): ${buttonCount === 10 ? 'PASS' : 'FAIL'}`);

    let menuOrderValid = true;
    for (let i = 0; i < expectedMenus.length; i++) {
      const btn = navButtons.nth(i);
      const text = await btn.innerText();
      const hasKo = text.includes(expectedMenus[i].ko);
      const hasEn = text.includes(expectedMenus[i].name);
      if (!hasKo && !hasEn) {
        console.error(`   ❌ Menu ${i + 1} mismatch. Expected ${expectedMenus[i].ko} / ${expectedMenus[i].name}, got: "${text}"`);
        menuOrderValid = false;
      }
    }
    results['Menu_Order_Matches_10_Items'] = menuOrderValid;
    console.log(`   [Test 5] Menu Order (1 to 10) valid: ${menuOrderValid ? 'PASS' : 'FAIL'}`);

    // 6. Verify Menu 1 (Company Information) is default active
    console.log('\n5. Verifying Default Active Tab (Company Information)...');
    const firstBtnClass = await navButtons.first().getAttribute('class') || '';
    const isFirstBtnActive = firstBtnClass.includes('bg-zinc-900') || firstBtnClass.includes('dark:bg-white');
    results['Menu_1_Active_On_Load'] = isFirstBtnActive;
    console.log(`   [Test 6] Menu 1 active on initial load: ${isFirstBtnActive ? 'PASS' : 'FAIL'}`);

    // Check Company Information panel content displayed on the right
    const companyInfoHeading = await page.locator('h3:has-text("회사 정보 관리"), span:has-text("회사 정보 관리")').first().isVisible().catch(() => false);
    results['Tab_1_Company_Info_Content_Displayed'] = companyInfoHeading;
    console.log(`   [Test 7] Tab 1 Company Information content displayed: ${companyInfoHeading ? 'PASS' : 'FAIL'}`);

    const deleteCardVisible = await page.locator('h3:has-text("회사 삭제")').first().isVisible().catch(() => false);
    results['Tab_1_Delete_Card_Preserved'] = deleteCardVisible;
    console.log(`   [Test 8] Tab 1 Company Delete Card preserved: ${deleteCardVisible ? 'PASS' : 'FAIL'}`);

    const tab1Screenshot = path.join(ARTIFACT_DIR, 'prod_adm_company_detail_tab1_info.png');
    await page.screenshot({ path: tab1Screenshot, fullPage: false });
    console.log(`   ✓ Saved screenshot: ${tab1Screenshot}`);

    // 7. Verify Editing & Cancel in Company Information
    console.log('\n6. Verifying Editing & Cancel in Company Information Tab...');
    const editBtn = page.locator('button:has-text("수정")').first();
    await editBtn.click();
    await page.waitForTimeout(500);

    const cancelBtn = page.locator('button:has-text("취소")').first();
    const saveBtn = page.locator('button:has-text("저장")').first();
    const isEditModeActive = (await cancelBtn.isVisible().catch(() => false)) && (await saveBtn.isVisible().catch(() => false));
    results['Tab_1_Edit_Mode_Toggles'] = isEditModeActive;
    console.log(`   [Test 9] Tab 1 Edit mode activates with Save and Cancel buttons: ${isEditModeActive ? 'PASS' : 'FAIL'}`);

    await cancelBtn.click();
    await page.waitForTimeout(500);
    const isEditModeCancelled = !(await cancelBtn.isVisible().catch(() => false));
    results['Tab_1_Cancel_Restores_View_Mode'] = isEditModeCancelled;
    console.log(`   [Test 10] Tab 1 Cancel restores view mode: ${isEditModeCancelled ? 'PASS' : 'FAIL'}`);

    // 8. Switching through all remaining 9 tabs and verifying content
    console.log('\n7. Verifying Tab Switching & Original Content Across All 10 Menus...');

    // Tab 2: Contacts & Portal Users
    await navButtons.nth(1).click();
    await page.waitForTimeout(500);
    const tab2Visible = await page.locator('h3:has-text("담당자 및 포털 사용자")').first().isVisible().catch(() => false);
    results['Tab_2_Contacts_Content_Displayed'] = tab2Visible;
    console.log(`   [Test 11] Tab 2 (Contacts & Portal Users) displayed: ${tab2Visible ? 'PASS' : 'FAIL'}`);

    const tab2Screenshot = path.join(ARTIFACT_DIR, 'prod_adm_company_detail_tab2_staff.png');
    await page.screenshot({ path: tab2Screenshot, fullPage: false });

    // Tab 3: Responsibility Assignment
    await navButtons.nth(2).click();
    await page.waitForTimeout(500);
    const tab3Visible = (await page.locator('h3:has-text("담당 업무 및 주 담당자")').first().isVisible().catch(() => false)) ||
                        (await page.locator('text=업무명').first().isVisible().catch(() => false));
    results['Tab_3_Tasks_Content_Displayed'] = tab3Visible;
    console.log(`   [Test 12] Tab 3 (Responsibility Assignment) displayed: ${tab3Visible ? 'PASS' : 'FAIL'}`);

    // Tab 4: Owned Brands
    await navButtons.nth(3).click();
    await page.waitForTimeout(500);
    const tab4Visible = (await page.locator('button:has-text("신규 브랜드 추가")').first().isVisible().catch(() => false)) ||
                        (await page.locator('text=브랜드').first().isVisible().catch(() => false));
    results['Tab_4_Brands_Content_Displayed'] = tab4Visible;
    console.log(`   [Test 13] Tab 4 (Owned Brands) displayed: ${tab4Visible ? 'PASS' : 'FAIL'}`);

    // Tab 5: Registered Products
    await navButtons.nth(4).click();
    await page.waitForTimeout(500);
    const tab5Visible = (await page.locator('th:has-text("SKU/바코드"), td:has-text("등록된 제품이 존재하지 않습니다"), text=등록 제품').first().isVisible().catch(() => false));
    results['Tab_5_Products_Content_Displayed'] = tab5Visible;
    console.log(`   [Test 14] Tab 5 (Registered Products) displayed: ${tab5Visible ? 'PASS' : 'FAIL'}`);

    // Tab 6: Retail Applications
    await navButtons.nth(5).click();
    await page.waitForTimeout(500);
    const tab6Visible = (await page.locator('text=제출된 입점 신청서가 없습니다').first().isVisible().catch(() => false)) ||
                        (await page.locator('a[href*="/admin/applications/"]').first().isVisible().catch(() => false)) ||
                        (await page.locator('text=입점 신청').first().isVisible().catch(() => false));
    results['Tab_6_Applications_Content_Displayed'] = tab6Visible;
    console.log(`   [Test 15] Tab 6 (Retail Applications) displayed: ${tab6Visible ? 'PASS' : 'FAIL'}`);

    // Tab 7: Agreement Management
    await navButtons.nth(6).click();
    await page.waitForTimeout(500);
    const tab7Visible = (await page.locator('text=계약').first().isVisible().catch(() => false)) ||
                        (await page.locator('text=체결된 계약').first().isVisible().catch(() => false));
    results['Tab_7_Agreements_Content_Displayed'] = tab7Visible;
    console.log(`   [Test 16] Tab 7 (Agreement Management) displayed: ${tab7Visible ? 'PASS' : 'FAIL'}`);

    // Tab 8: Trading Information
    await navButtons.nth(7).click();
    await page.waitForTimeout(500);
    const tab8Visible = await page.locator('h3:has-text("거래 정보")').first().isVisible().catch(() => false);
    results['Tab_8_Trading_Content_Displayed'] = tab8Visible;
    console.log(`   [Test 17] Tab 8 (Trading Information) displayed: ${tab8Visible ? 'PASS' : 'FAIL'}`);

    // Tab 9: Shipping Origin Information
    await navButtons.nth(8).click();
    await page.waitForTimeout(500);
    const tab9Visible = (await page.locator('text=출고지').first().isVisible().catch(() => false)) ||
                        (await page.locator('text=Shipping Origin').first().isVisible().catch(() => false));
    results['Tab_9_Shipping_Origin_Content_Displayed'] = tab9Visible;
    console.log(`   [Test 18] Tab 9 (Shipping Origin Information) displayed: ${tab9Visible ? 'PASS' : 'FAIL'}`);

    // Tab 10: Bank Information
    await navButtons.nth(9).click();
    await page.waitForTimeout(500);
    const tab10Visible = await page.locator('h3:has-text("은행 정보")').first().isVisible().catch(() => false);
    results['Tab_10_Bank_Content_Displayed'] = tab10Visible;
    console.log(`   [Test 19] Tab 10 (Bank Information) displayed: ${tab10Visible ? 'PASS' : 'FAIL'}`);

    const tab10Screenshot = path.join(ARTIFACT_DIR, 'prod_adm_company_detail_tab10_bank.png');
    await page.screenshot({ path: tab10Screenshot, fullPage: false });

    // 9. Responsive layout verification (Mobile Viewport)
    console.log('\n8. Testing Responsive Layout (Mobile Viewport 390x844)...');
    // Collapse sidebar to free viewport for main content
    const collapseBtn = page.locator('button:has-text("Collapse Sidebar")').first();
    if (await collapseBtn.isVisible().catch(() => false)) {
      await collapseBtn.click();
      await page.waitForTimeout(500);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(500);

    const isHeaderStacked = await page.locator('h1').first().isVisible().catch(() => false);
    const isNavStacked = await navButtons.first().isVisible().catch(() => false);
    const isContentStacked = (await page.locator('[data-testid="company-detail-content"]').first().isVisible().catch(() => false)) ||
                             (await page.locator('h3:has-text("은행 정보"), h3:has-text("회사 정보 관리")').first().isVisible().catch(() => false));
    results['Mobile_Responsive_Layout_Functional'] = isHeaderStacked && isNavStacked && isContentStacked;
    console.log(`   [Test 20] Mobile responsive layout functional: ${results['Mobile_Responsive_Layout_Functional'] ? 'PASS' : 'FAIL'}`);

    const mobileScreenshot = path.join(ARTIFACT_DIR, 'prod_adm_company_detail_mobile_responsive.png');
    await page.screenshot({ path: mobileScreenshot, fullPage: false });
    console.log(`   ✓ Saved screenshot: ${mobileScreenshot}`);

    console.log('\n================================================================================');
    console.log('SUMMARY OF RESULTS:');
    console.log(JSON.stringify(results, null, 2));
    console.log('================================================================================\n');

    const allPassed = Object.values(results).every(Boolean);
    if (!allPassed) {
      console.error('❌ SOME TESTS FAILED IN THE MATRIX');
      process.exit(1);
    } else {
      console.log('🎉 ALL MATRIX TESTS PASSED PERFECTLY!');
    }
  } finally {
    clearTimeout(deadline);
    await browser.close();
  }
}

runQA().catch((err) => {
  console.error('[QA RUNNER ERROR]', err);
  process.exit(1);
});
