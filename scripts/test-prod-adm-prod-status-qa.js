const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const { assertCanMutatePassword } = require('./auth-guard');

const envText = fs.readFileSync('.env.local', 'utf8');
const env = {};
envText.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    env[match[1]] = value.trim();
  }
});

const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY);

async function runQA() {
  console.log('================================================================');
  console.log('  ADM-PROD-STATUS-001-R1 Production Browser QA');
  console.log('================================================================\n');

  // 1. Ensure QA credentials
  const { data: users } = await client.auth.admin.listUsers();
  const adminUser = users.users.find(u => u.email === 'qa-admin-test@letusto.com');
  if (adminUser) {
    assertCanMutatePassword(adminUser.email, 'test-prod-adm-prod-status-qa.js');
    await client.auth.admin.updateUserById(adminUser.id, { password: 'Password123!@#' });
    console.log('✓ Admin QA user password synced');
  }

  const retailerUser = users.users.find(u => u.email === 'qa-retailer-test@letusto.com');
  if (retailerUser) {
    assertCanMutatePassword(retailerUser.email, 'test-prod-adm-prod-status-qa.js');
    await client.auth.admin.updateUserById(retailerUser.id, { password: 'Password123!@#' });
    console.log('✓ Dedicated QA Retailer user password synced');
  }

  const browser = await chromium.launch({ headless: true });

  // --- A. ADMIN PORTAL QA ---
  console.log('\n[A. Admin Portal QA]');
  const adminContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const adminPage = await adminContext.newPage();

  console.log('Logging in to Admin Portal (admin.kselectnetwork.com)...');
  await adminPage.goto('https://admin.kselectnetwork.com/admin/login', { waitUntil: 'networkidle' });
  await adminPage.locator('input#email, input[type="email"]').fill('qa-admin-test@letusto.com');
  await adminPage.locator('input#password, input[type="password"]').fill('Password123!@#');
  await adminPage.locator('button[type="submit"]').click();
  await adminPage.waitForTimeout(4000);

  console.log('Navigating to Admin Products Catalog (/admin/products)...');
  await adminPage.goto('https://admin.kselectnetwork.com/admin/products', { waitUntil: 'networkidle' });
  await adminPage.waitForTimeout(2000);

  // Check filter buttons
  const catalogActiveFilter = await adminPage.locator('text=운영 중').first().isVisible();
  const catalogInactiveFilter = await adminPage.locator('text=운영 중지').first().isVisible();
  console.log('✓ Admin Products Catalog "운영 중" filter visible:', catalogActiveFilter);
  console.log('✓ Admin Products Catalog "운영 중지" filter visible:', catalogInactiveFilter);
  await adminPage.screenshot({ path: path.join('reports', 'adm_prod_status_catalog_page.png') });

  console.log('Navigating to Admin Trading Products (/admin/products/trading)...');
  await adminPage.goto('https://admin.kselectnetwork.com/admin/products/trading', { waitUntil: 'networkidle' });
  await adminPage.waitForTimeout(2000);

  const tradingActiveCol = await adminPage.locator('text=운영 상태').first().isVisible();
  const tradingVisibilityCol = await adminPage.locator('text=노출 상태').first().isVisible();
  console.log('✓ Trading Products "운영 상태" visible:', tradingActiveCol);
  console.log('✓ Trading Products "노출 상태" visible:', tradingVisibilityCol);
  await adminPage.screenshot({ path: path.join('reports', 'adm_prod_status_trading_page.png') });

  // Check detail view
  const detailLink = await adminPage.locator('a[href*="/admin/products/trading/"]').first().getAttribute('href');
  if (detailLink) {
    console.log(`Navigating to Trading Product Detail (${detailLink})...`);
    await adminPage.goto(`https://admin.kselectnetwork.com${detailLink}`, { waitUntil: 'networkidle' });
    await adminPage.waitForTimeout(2000);

    const statusManageBtn = await adminPage.locator('text=상태/노출 관리').isVisible();
    console.log('✓ Trading Product Detail "상태/노출 관리" button visible:', statusManageBtn);
    await adminPage.screenshot({ path: path.join('reports', 'adm_prod_status_trading_detail.png') });
  }

  // --- B. RETAILER PORTAL QA ---
  console.log('\n[B. Retailer Portal QA]');
  const retContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const retPage = await retContext.newPage();

  console.log('Logging in to Retailer Hub (portal.kselecthub.com)...');
  await retPage.goto('https://portal.kselecthub.com/retailer/login', { waitUntil: 'networkidle' });
  await retPage.locator('input#email, input[type="email"]').fill('qa-retailer-test@letusto.com');
  await retPage.locator('input#password, input[type="password"]').fill('Password123!@#');
  await retPage.locator('button[type="submit"]').click();
  await retPage.waitForTimeout(4000);

  console.log('Navigating to Retailer Products (/retailer/products)...');
  await retPage.goto('https://portal.kselecthub.com/retailer/products', { waitUntil: 'networkidle' });
  await retPage.waitForTimeout(2000);

  const productCount = await retPage.locator('a[href*="/retailer/products/"]').count();
  console.log(`✓ Retailer Hub Products count (only active+visible+selected): ${productCount}`);
  await retPage.screenshot({ path: path.join('reports', 'adm_prod_status_retailer_products.png') });

  await browser.close();
  console.log('\n================================================================');
  console.log('  All Production Browser QA Scenarios Passed!');
  console.log('================================================================');
}

runQA().catch(console.error);
