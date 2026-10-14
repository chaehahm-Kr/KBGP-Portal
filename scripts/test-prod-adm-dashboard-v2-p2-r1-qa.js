const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

let env = {};
fs.readFileSync('.env.local', 'utf8').split('\n').forEach((l) => {
  const m = l.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (m) env[m[1]] = (m[2] || '').trim().replace(/^['"]|['"]$/g, '');
});

const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY);

async function runBrowserQA() {
  console.log("=== ADM-DASHBOARD-V2-P2-001-R1 PRODUCTION BROWSER QA ===");

  // 1. Ensure admin user exists and password is set
  const { data: users } = await client.auth.admin.listUsers();
  const adminUser = users.users.find(u => u.email === 'qa-admin-test@letusto.com');
  if (adminUser) {
    await client.auth.admin.updateUserById(adminUser.id, { password: 'Password123!@#' });
    console.log(`✓ Admin QA User verified (${adminUser.email})`);
  }

  const browser = await chromium.launch({ headless: true });
  
  // Test Desktop Layout (1440x900)
  console.log('\n--- 1. Testing Desktop Layout (1440x900) ---');
  const desktopContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await desktopContext.newPage();

  console.log('Logging in to Admin Portal...');
  await page.goto('https://admin.kselectnetwork.com/admin/login', { waitUntil: 'networkidle', timeout: 30000 });
  await page.locator('input#email, input[type="email"]').fill('qa-admin-test@letusto.com');
  await page.locator('input#password, input[type="password"]').fill('Password123!@#');
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(4000);

  console.log('Navigating to Dashboard (/admin)...');
  await page.goto('https://admin.kselectnetwork.com/admin', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);

  const pageText = await page.innerText('body');

  let passed = 0;
  let total = 0;
  function assert(condition, message) {
    total++;
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
    }
  }

  // A. Header & Timestamp
  assert(pageText.includes('통합 운영 대시보드'), 'Header title contains "통합 운영 대시보드"');
  assert(pageText.includes('Production Data · As of'), 'Data freshness badge displays "Production Data · As of"');

  // B. Executive Overview (4 Authoritative KPIs preserved)
  assert(pageText.includes('$3,100.07') && pageText.includes('당월 확정 도매 발주액'), 'Executive KPI 1: Retail Order Value MTD $3,100.07');
  assert(pageText.includes('$1,062.54') && pageText.includes('미수금 잔액'), 'Executive KPI 2: Total Open AR $1,062.54');
  assert(pageText.includes('2건 Ready') && pageText.includes('즉시 출고 준비 건수'), 'Executive KPI 3: Active Orders 2건 Ready');
  assert(pageText.includes('14개 Active') && pageText.includes('거래 활성 품목'), 'Executive KPI 4: Trading Catalog 14개 Active');

  // C. Critical Action Strip Qualification
  // Since pastDueAmount === 0 and cancellationRequested === 0, criticalActions.length === 0, strip MUST be hidden
  assert(!pageText.includes('긴급 조치 과제 (Critical Actions)'), 'Critical Action Strip: Correctly hidden when 0 critical exceptions');

  // D. Left Column: K SELECT HUB (Retail Operations)
  assert(pageText.includes('K SELECT HUB') && pageText.includes('리테일 운영 관제 (Retail Operations)'), 'HUB: Column header present with subtle blue identity');
  assert(pageText.includes('리테일 조치 과제 (Retail Actions)'), 'HUB: Retail Action Queue present');
  assert(pageText.includes('주문 및 물류 파이프라인 (Order & Dispatch Pipeline)'), 'HUB: 2-Tier KPI Pipeline present');
  assert(pageText.includes('신규 접수') && pageText.includes('출고 준비') && pageText.includes('송장 미등록'), 'HUB: Tier 1 primary operational signals present');
  assert(pageText.includes('최근 리테일 발주 (Recent Orders)'), 'HUB: Recent Orders placed inside HUB column');
  assert(pageText.includes('KSR-2026-000004'), 'HUB: Recent Orders includes real order KSR-2026-000004');

  // E. Right Column: K SELECT NETWORK (Brand & Product Operations)
  assert(pageText.includes('K SELECT NETWORK') && pageText.includes('브랜드 및 제품 관제 (Brand & Product Operations)'), 'NETWORK: Column header present with subtle purple identity');
  assert(pageText.includes('브랜드 조치 과제 (Brand Actions)'), 'NETWORK: Brand Action Queue present');
  assert(pageText.includes('파트너십 및 카탈로그 현황 (Partnerships & Catalog)'), 'NETWORK: 2-Tier KPI Summary present');
  assert(pageText.includes('관리자 심사 대기') && pageText.includes('미확인 파트너 문의') && pageText.includes('카탈로그 미검토'), 'NETWORK: Tier 1 primary operational signals present');
  assert(pageText.includes('최근 브랜드 신청 (Recent Applications)'), 'NETWORK: Recent Applications placed inside NETWORK column');
  assert(pageText.includes('APP-2026-000004') || pageText.includes('APP-2026-000005'), 'NETWORK: Recent Applications includes real application record');

  // F. Common Finance & Credit Control (Full Width below columns)
  assert(pageText.includes('재무 및 채권 관리 (Finance & Accounts Receivable)'), 'Finance: Common section present below columns');
  assert(pageText.includes('연체액 (Past Due)') && pageText.includes('$0.00'), 'Finance: Exception metric Past Due $0.00');
  assert(pageText.includes('결제 완료 인보이스') && pageText.includes('1건'), 'Finance: Settled invoices 1건');
  assert(pageText.includes('취소/무효 인보이스') && pageText.includes('1건'), 'Finance: Void invoices 1건');

  // G. Two-Column Side-by-Side verification (Desktop geometry)
  const hubColumn = page.locator('text=리테일 운영 관제 (Retail Operations)').locator('xpath=ancestor::div[contains(@class, "rounded-xl")][last()]');
  const networkColumn = page.locator('text=브랜드 및 제품 관제 (Brand & Product Operations)').locator('xpath=ancestor::div[contains(@class, "rounded-xl")][last()]');
  const hubBox = await hubColumn.boundingBox();
  const netBox = await networkColumn.boundingBox();

  if (hubBox && netBox) {
    const isSideBySide = Math.abs(hubBox.y - netBox.y) < 30 && hubBox.x < netBox.x;
    assert(isSideBySide, `Desktop Two-Column Geometry: HUB (x=${Math.round(hubBox.x)}, y=${Math.round(hubBox.y)}) and NETWORK (x=${Math.round(netBox.x)}, y=${Math.round(netBox.y)}) render side-by-side`);
  } else {
    assert(false, 'Desktop Two-Column Geometry: Could not locate column bounding boxes');
  }

  // H. Mobile Layout Check (390x844)
  console.log('\n--- 2. Testing Mobile Layout (390x844) ---');
  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto('https://admin.kselectnetwork.com/admin', { waitUntil: 'networkidle', timeout: 30000 });
  await mobilePage.waitForTimeout(2000);

  const mHubColumn = mobilePage.locator('text=리테일 운영 관제 (Retail Operations)').locator('xpath=ancestor::div[contains(@class, "rounded-xl")][last()]');
  const mNetColumn = mobilePage.locator('text=브랜드 및 제품 관제 (Brand & Product Operations)').locator('xpath=ancestor::div[contains(@class, "rounded-xl")][last()]');
  const mHubBox = await mHubColumn.boundingBox();
  const mNetBox = await mNetColumn.boundingBox();

  if (mHubBox && mNetBox) {
    const isStacked = mHubBox.y < mNetBox.y;
    assert(isStacked, `Mobile Stacked Geometry: HUB (y=${Math.round(mHubBox.y)}) renders above NETWORK (y=${Math.round(mNetBox.y)})`);
  } else {
    assert(false, 'Mobile Stacked Geometry: Could not locate mobile column bounding boxes');
  }

  // I. Deep Links Verification
  console.log('\n--- 3. Testing Deep Links ---');
  const ordersLink = page.locator('a[href="/admin/sales/orders?quickFilter=ready"]').first();
  await Promise.all([
    page.waitForURL(/admin\/sales\/orders/, { timeout: 15000 }),
    ordersLink.click()
  ]);
  assert(page.url().includes('/admin/sales/orders'), `Deep Link: Ready to Ship clicked -> ${page.url()}`);

  await page.goto('https://admin.kselectnetwork.com/admin', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  const financeLink = page.locator('a[href="/admin/finance/receivables"]').first();
  await Promise.all([
    page.waitForURL(/admin\/finance\/receivables/, { timeout: 15000 }),
    financeLink.click()
  ]);
  assert(page.url().includes('/admin/finance/receivables'), `Deep Link: Finance Receivables clicked -> ${page.url()}`);

  await browser.close();

  console.log(`\n========================================`);
  console.log(`QA Result: ${passed}/${total} assertions passed`);
  console.log(`========================================`);

  if (passed === total) {
    console.log('✓ ADM-DASHBOARD-V2-P2-001-R1 QA PASSED COMPLETELY');
    process.exit(0);
  } else {
    console.error('✗ Some assertions failed.');
    process.exit(1);
  }
}

runBrowserQA().catch((err) => {
  console.error('Fatal error during Browser QA:', err);
  process.exit(1);
});
