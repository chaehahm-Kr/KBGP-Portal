const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('playwright');
const { assertCanMutatePassword } = require('./auth-guard');

const envText = fs.readFileSync('.env.local', 'utf8');
const env = {};
envText.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = (match[2] || '').trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    env[match[1]] = value;
  }
});

const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY);

async function runQA() {
  console.log('================================================================');
  console.log('  ADM-PROD-STATUS-001 Comprehensive Production Browser QA');
  console.log('================================================================\n');

  const reportsDir = path.join(process.cwd(), 'reports');
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });

  const DR120_ID = 'b88c8e01-c7fe-49ee-ba3a-a4deba5c00ed';

  // 1. Prepare credentials
  console.log('[1/7] Preparing QA credentials...');
  const { data: users } = await client.auth.admin.listUsers();
  const adminUser = users.users.find(u => u.email === 'qa-admin-test@letusto.com');
  if (adminUser) {
    await client.auth.admin.updateUserById(adminUser.id, { password: 'Password123!@#' });
    console.log('✓ Admin QA user (qa-admin-test@letusto.com) synced');
  }

  // Find brand user for DR120
  const { data: dr120Prod } = await client.from('products').select('company_id').eq('id', DR120_ID).single();
  const { data: cuList } = await client.from('company_users').select('id, email').eq('company_id', dr120Prod.company_id);
  let brandEmail = null;
  for (const cu of cuList || []) {
    const authU = users.users.find(u => u.id === cu.id || u.email === cu.email);
    if (authU) {
      brandEmail = authU.email;
      assertCanMutatePassword(brandEmail, 'test-prod-status-qa-e2e.js');
      await client.auth.admin.updateUserById(authU.id, { password: 'Password123!@#' });
      console.log(`✓ Brand QA user (${brandEmail}) synced`);
      break;
    }
  }

  const browser = await chromium.launch({ headless: true });
  const adminContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const adminPage = await adminContext.newPage();

  // 2. Admin Login
  console.log('\n[2/7] Logging into Admin Portal (admin.kselectnetwork.com)...');
  await adminPage.goto('https://admin.kselectnetwork.com/admin/login', { waitUntil: 'networkidle' });
  await adminPage.locator('input#email, input[type="email"]').fill('qa-admin-test@letusto.com');
  await adminPage.locator('input#password, input[type="password"]').fill('Password123!@#');
  await adminPage.locator('button[type="submit"]').click();
  await adminPage.waitForTimeout(3000);

  // 3. Admin Product Detail (DR120)
  console.log('\n[3/7] Testing Admin Product Detail for DR120...');
  await adminPage.goto(`https://admin.kselectnetwork.com/admin/products/${DR120_ID}`, { waitUntil: 'networkidle' });
  await adminPage.waitForTimeout(2000);

  // Check trading_status select in Admin Detail
  const tradingSelect = adminPage.locator('select').filter({ has: adminPage.locator('option[value="inactive"]') }).first();
  const currentVal = await tradingSelect.inputValue();
  console.log(`Admin Detail Operational Status select value: "${currentVal}"`);

  if (currentVal !== 'inactive') {
    console.log('Changing Operational Status to inactive and saving...');
    await tradingSelect.selectOption('inactive');
    await adminPage.waitForTimeout(500);

    // Click Save Button
    const saveBtn = adminPage.locator('button:has-text("변경사항 저장"), button:has-text("저장")').first();
    await saveBtn.click();
    await adminPage.waitForTimeout(3000);
    console.log('✓ Saved Admin Overrides');

    // Reload to verify persistence
    await adminPage.reload({ waitUntil: 'networkidle' });
    await adminPage.waitForTimeout(2000);
    const reloadedVal = await tradingSelect.inputValue();
    console.log(`Admin Detail after reload value: "${reloadedVal}"`);
  }

  await adminPage.screenshot({ path: path.join(reportsDir, 'adm_prod_status_admin_detail.png'), fullPage: false });
  console.log('✓ Admin Product Detail screenshot saved');

  // 4. Admin Product List
  console.log('\n[4/7] Testing Admin Product List (/admin/products)...');
  await adminPage.goto('https://admin.kselectnetwork.com/admin/products', { waitUntil: 'networkidle' });
  await adminPage.waitForTimeout(2000);

  // Search DR120
  const searchInput = adminPage.locator('input[placeholder*="검색"]').first();
  await searchInput.fill('DR120');
  await adminPage.waitForTimeout(1000);

  const dr120Row = adminPage.locator('tr:has-text("DR120")').first();
  const dr120RowText = await dr120Row.innerText();
  console.log('Admin List DR120 row text:', dr120RowText.replace(/\n+/g, ' | '));

  const hasInactiveInRow = dr120RowText.includes('운영 중지');
  console.log('✓ Admin List DR120 shows "운영 중지":', hasInactiveInRow);

  // Test filters
  const filterInactiveBtn = adminPage.locator('button:has-text("운영 중지")').first();
  await filterInactiveBtn.click();
  await adminPage.waitForTimeout(1000);
  const visibleInFilter = await adminPage.locator('tr:has-text("DR120")').count();
  console.log('✓ DR120 visible under "운영 중지" filter:', visibleInFilter > 0);

  const filterActiveBtn = adminPage.locator('button:has-text("운영 중")').first();
  await filterActiveBtn.click();
  await adminPage.waitForTimeout(1000);
  const hiddenInActiveFilter = await adminPage.locator('tr:has-text("DR120")').count();
  console.log('✓ DR120 hidden under "운영 중" filter:', hiddenInActiveFilter === 0);

  // Reset filter to All
  await adminPage.locator('button:has-text("All")').last().click();
  await searchInput.fill('DR120');
  await adminPage.waitForTimeout(1000);
  await adminPage.screenshot({ path: path.join(reportsDir, 'adm_prod_status_admin_list.png'), fullPage: false });

  // 5. Admin Trading Product List
  console.log('\n[5/7] Testing Admin Trading Products (/admin/products/trading)...');
  await adminPage.goto('https://admin.kselectnetwork.com/admin/products/trading', { waitUntil: 'networkidle' });
  await adminPage.waitForTimeout(2000);
  await adminPage.screenshot({ path: path.join(reportsDir, 'adm_prod_status_trading_list.png'), fullPage: false });
  console.log('✓ Admin Trading Products screenshot saved');

  // 6. Brand Portal QA
  console.log('\n[6/7] Testing Brand Portal (portal.kselectnetwork.com)...');
  const portalContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const portalPage = await portalContext.newPage();

  if (brandEmail) {
    console.log(`Logging in to Brand Portal as ${brandEmail}...`);
    await portalPage.goto('https://portal.kselectnetwork.com/portal/login', { waitUntil: 'networkidle' });
    await portalPage.locator('input#email, input[type="email"]').fill(brandEmail);
    await portalPage.locator('input#password, input[type="password"]').fill('Password123!@#');
    await portalPage.locator('button[type="submit"]').click();
    await portalPage.waitForTimeout(3000);

    // Brand Portal Product List
    console.log('Navigating to Brand Portal Products (/portal/products)...');
    await portalPage.goto('https://portal.kselectnetwork.com/portal/products', { waitUntil: 'networkidle' });
    await portalPage.waitForTimeout(2000);

    // Verify headers
    const thText = await portalPage.locator('thead').innerText();
    console.log('Portal Products Table Headers:', thText.replace(/\n+/g, ' | '));

    const hasOperationalHeader = thText.includes('운영 상태');
    const hasSalesHeader = thText.includes('판매 상태');
    console.log('✓ Portal has "운영 상태" column header:', hasOperationalHeader);
    console.log('✓ Portal does NOT have "판매 상태" header:', !hasSalesHeader);

    // Search DR120 in Portal
    const portalSearch = portalPage.locator('input[placeholder*="검색"]').first();
    if (await portalSearch.count() > 0) {
      await portalSearch.fill('DR120');
      await portalPage.waitForTimeout(1000);
    }

    const portalDr120Row = portalPage.locator('tr:has-text("DR120")').first();
    if (await portalDr120Row.count() > 0) {
      const portalRowText = await portalDr120Row.innerText();
      console.log('Portal DR120 row text:', portalRowText.replace(/\n+/g, ' | '));
      const showsInactive = portalRowText.includes('운영 중지');
      const showsPreparing = portalRowText.includes('판매 준비');
      console.log('✓ Portal DR120 row shows "운영 중지":', showsInactive);
      console.log('✓ Portal DR120 row does NOT show "판매 준비":', !showsPreparing);
    }

    await portalPage.screenshot({ path: path.join(reportsDir, 'adm_prod_status_portal_list.png'), fullPage: false });

    // Brand Portal Product Detail
    console.log(`Navigating to Brand Portal Product Detail (/portal/products/${DR120_ID})...`);
    await portalPage.goto(`https://portal.kselectnetwork.com/portal/products/${DR120_ID}`, { waitUntil: 'networkidle' });
    await portalPage.waitForTimeout(2000);

    const detailHeaderBadges = await portalPage.locator('.flex.flex-wrap.items-center.gap-2, div:has-text("운영 상태:")').first().innerText();
    console.log('Portal Detail Status area text:', detailHeaderBadges.replace(/\n+/g, ' | '));

    const detailShowsOperational = detailHeaderBadges.includes('운영 상태:') && detailHeaderBadges.includes('운영 중지');
    const detailShowsSales = detailHeaderBadges.includes('판매 상태');
    console.log('✓ Portal Detail shows "운영 상태: 운영 중지":', detailShowsOperational);
    console.log('✓ Portal Detail does NOT show "판매 상태":', !detailShowsSales);

    await portalPage.screenshot({ path: path.join(reportsDir, 'adm_prod_status_portal_detail.png'), fullPage: false });
  } else {
    console.log('No brand email found to test portal login');
  }

  // 7. Verify cross-product DB consistency
  console.log('\n[7/7] Cross-product DB audit...');
  const { data: dbDr120 } = await client
    .from('products')
    .select('id, name, selection_status, trading_status, retailer_visibility, sales_status')
    .eq('id', DR120_ID)
    .single();

  console.log('Current DB state for DR120:', dbDr120);

  await browser.close();
  console.log('\n================================================================');
  console.log('  QA Execution COMPLETE');
  console.log('================================================================');
}

runQA().catch(err => {
  console.error('QA script error:', err);
  process.exit(1);
});
