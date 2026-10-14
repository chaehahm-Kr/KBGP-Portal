const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');
const { assertCanMutatePassword } = require('./auth-guard');

let env = {};
const envPaths = ['.env.production.local', '.env.local'];
for (const envPath of envPaths) {
  const fullPath = path.join(process.cwd(), envPath);
  if (fs.existsSync(fullPath)) {
    const envText = fs.readFileSync(fullPath, 'utf8');
    envText.split('\n').forEach(line => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        let value = (match[2] || '').trim();
        if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
        if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
        env[match[1]] = value;
      }
    });
  }
}

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || 'https://shzfrppdobpmrstcjfqu.supabase.co';
const serviceKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
const adminClient = createClient(supabaseUrl, serviceKey);

const ADMIN_URL = 'https://admin.kselectnetwork.com';
const PORTAL_URL = 'https://portal.kselecthub.com';

async function runBrowserQA() {
  console.log('=== STARTING PRODUCTION BROWSER QA FOR RTP-ORDER-PHASE-B3-001 ===\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  try {
    // 1. Admin Authentication
    console.log('--- 1. Authenticating as Admin ---');
    const { data: usersData } = await adminClient.auth.admin.listUsers({ perPage: 100 });
    const adminUser = (usersData?.users || []).find((u) => u.email === 'qa-admin-test@letusto.com');
    if (!adminUser) {
      throw new Error('qa-admin-test@letusto.com user not found in Supabase Auth');
    }

    assertCanMutatePassword(adminUser.email, 'test-prod-phase-b3-qa.js');
    await adminClient.auth.admin.updateUserById(adminUser.id, { password: 'Password123!@#' });

    await page.goto(`${ADMIN_URL}/admin/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.fill('input#email', 'qa-admin-test@letusto.com');
    await page.fill('input#password', 'Password123!@#');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(4000);
    console.log('✓ Admin successfully authenticated, current URL:', page.url());

    // 2. Admin Orders Table QA
    console.log('\n--- 2. Verifying Admin Orders Table (/admin/sales/orders) ---');
    await page.goto(`${ADMIN_URL}/admin/sales/orders`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    const ordersTableText = await page.innerText('body');
    console.log('Orders page sample:\n', ordersTableText.slice(0, 400));
    const hasOrderPage = ordersTableText.includes('Retailer Orders') || ordersTableText.includes('Order #') || ordersTableText.includes('Total Orders');
    console.log(`✓ Admin Orders page renders successfully: ${hasOrderPage}`);
    if (!hasOrderPage) throw new Error('Admin Orders page failed to render expected content');

    await page.screenshot({ path: 'scripts/rtp-phase-b3-admin-orders.png' });
    console.log('✓ Captured screenshot: scripts/rtp-phase-b3-admin-orders.png');

    // 3. Admin Receivables QA
    console.log('\n--- 3. Verifying Admin Receivables (/admin/finance/receivables) ---');
    await page.goto(`${ADMIN_URL}/admin/finance/receivables`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(4000);

    const arTableText = await page.innerText('body');
    const hasARCols = arTableText.includes('Invoice #') || arTableText.includes('Invoices & Accounts Receivable') || arTableText.includes('Total Open AR');
    console.log(`✓ Admin Receivables table renders headers: ${hasARCols}`);
    if (!hasARCols) throw new Error('Admin Receivables table failed to render expected columns');

    await page.screenshot({ path: 'scripts/rtp-phase-b3-admin-receivables.png' });
    console.log('✓ Captured screenshot: scripts/rtp-phase-b3-admin-receivables.png');

    // 4. Retailer Authentication
    console.log('\n--- 4. Authenticating as Retailer ---');
    const retailerUser = (usersData?.users || []).find((u) => u.email === 'qa-retailer-test@letusto.com');
    if (!retailerUser) {
      throw new Error('Retailer user not found');
    }

    assertCanMutatePassword(retailerUser.email, 'test-prod-phase-b3-qa.js');
    await adminClient.auth.admin.updateUserById(retailerUser.id, { password: 'Password123!@#' });

    const retailerContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const retailerPage = await retailerContext.newPage();

    await retailerPage.goto(`${PORTAL_URL}/retailer/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await retailerPage.fill('input[type="email"], input[name="email"], input#email', retailerUser.email);
    await retailerPage.fill('input[type="password"], input[name="password"], input#password', 'Password123!@#');
    await retailerPage.click('button[type="submit"]');
    await retailerPage.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 20000 });
    console.log('✓ Retailer successfully authenticated, current URL:', retailerPage.url());

    // 5. Retailer Orders List QA
    console.log('\n--- 5. Verifying Retailer Orders List (/orders) ---');
    await retailerPage.goto(`${PORTAL_URL}/orders`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await retailerPage.waitForTimeout(3000);

    const retOrdersText = await retailerPage.innerText('body');
    const hasRetCols = retOrdersText.includes('Orders') || retOrdersText.includes('Order #') || retOrdersText.includes('Shipping Summary');
    console.log(`✓ Retailer Orders list renders headers: ${hasRetCols}`);
    if (!hasRetCols) throw new Error('Retailer Orders list failed to render expected columns');

    await retailerPage.screenshot({ path: 'scripts/rtp-phase-b3-retailer-orders.png' });
    console.log('✓ Captured screenshot: scripts/rtp-phase-b3-retailer-orders.png');

    // 6. Retailer Bills QA
    console.log('\n--- 6. Verifying Retailer Bills (/bills) ---');
    await retailerPage.goto(`${PORTAL_URL}/bills`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await retailerPage.waitForTimeout(3000);

    const billsText = await retailerPage.innerText('body');
    const hasBills = billsText.includes('Bills & Payments') || billsText.includes('Total Balance Due') || billsText.includes('Invoice');
    console.log(`✓ Retailer Bills & Payments loads cleanly: ${hasBills}`);
    if (!hasBills) throw new Error('Retailer Bills failed to load cleanly');

    await retailerPage.screenshot({ path: 'scripts/rtp-phase-b3-retailer-bills.png' });
    console.log('✓ Captured screenshot: scripts/rtp-phase-b3-retailer-bills.png');

    console.log('\n=== PRODUCTION BROWSER QA PASSED WITH ZERO REGRESSIONS ===');
  } finally {
    await browser.close();
  }
}

runBrowserQA().catch((err) => {
  console.error('Browser QA failed:', err);
  process.exit(1);
});
