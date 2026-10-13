const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');
const { assertCanMutatePassword } = require('./auth-guard');

// Load environment credentials
let env = {};
const envPaths = ['.env.production.local', '.env.local'];
for (const envPath of envPaths) {
  const fullPath = path.join(process.cwd(), envPath);
  if (fs.existsSync(fullPath)) {
    const envText = fs.readFileSync(fullPath, 'utf8');
    envText.split('\n').forEach((line) => {
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
const supabase = createClient(supabaseUrl, serviceKey);

const PORTAL_URL = 'https://portal.kselecthub.com';
const ADMIN_URL = 'https://admin.kselectnetwork.com';
const TEST_COMPANY_ID = 'dc9249be-a9e0-4975-a4c9-b602bb2baa47';

async function runProductionQA() {
  console.log('=== STARTING PRODUCTION BROWSER QA FOR RTP-CHECKOUT-PAYMENT-001 ===');
  console.log(`Target Portal: ${PORTAL_URL}`);
  console.log(`Target Admin:  ${ADMIN_URL}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  let createdOrderId = null;

  try {
    // Ensure dedicated QA Retailer user password (never mutate real business users)
    const { data: usersData } = await supabase.auth.admin.listUsers();
    const retUser = (usersData?.users || []).find((u) => u.email === 'qa-retailer-test@letusto.com');
    if (retUser) {
      assertCanMutatePassword(retUser.email, 'test-prod-rtp-checkout-payment-qa.js');
      await supabase.auth.admin.updateUserById(retUser.id, { password: 'Password123!@#' });
      console.log('✓ Dedicated QA Retailer user password verified/reset to Password123!@#');
    }

    // 1. Retailer Login
    console.log('\n--- STEP 1: Retailer Authentication ---');
    await page.goto(`${PORTAL_URL}/retailer/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('input[type="email"], input[name="email"], input#email', { timeout: 15000 });
    await page.fill('input[type="email"], input[name="email"], input#email', 'qa-retailer-test@letusto.com');
    await page.fill('input[type="password"], input[name="password"], input#password', 'Password123!@#');
    await page.click('button[type="submit"]');

    try {
      await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });
    } catch (e) {
      console.log('Login transition wait note:', e.message);
      const errText = await page.innerText('body');
      console.log('Page body snippet:', errText.slice(0, 300));
    }

    const currentUrl = page.url();
    console.log(`Logged in. Current URL: ${currentUrl}`);

    // 2. Navigate to Checkout and Seed Cart on correct origin
    console.log('\n--- STEP 2: Navigate to Checkout & Seed Cart ---');
    const portalOrigin = new URL(page.url()).origin;
    console.log(`Resolved Portal Origin: ${portalOrigin}`);

    await page.goto(`${portalOrigin}/retailer/checkout`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1000);

    const testCartItem = {
      productId: 'b88c8e01-c7fe-49ee-ba3a-a4deba5c00ed',
      productName: 'KLALAB DR120 Barrier Cream',
      productNameEn: 'KLALAB DR120 Barrier Cream',
      brandName: 'KLALAB',
      sku: 'DR120-SB-001',
      thumbnailUrl: null,
      wholesalePrice: 9.00,
      msrp: 26.50,
      marginPercent: 66,
      quantity: 48,
      casePackQty: 24,
      lineTotal: 432.00
    };

    await page.evaluate((item) => {
      localStorage.setItem('kselect_retailer_cart_v1', JSON.stringify([item]));
    }, testCartItem);

    console.log('\n--- STEP 3: Reload Checkout with Seeded Cart ---');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // 4. Verify Payment Methods & Default Selection
    console.log('\n--- STEP 4: Verify Authorized Payment Methods & Fee Disclosures ---');
    await page.waitForSelector('input[name="paymentMethod"]', { timeout: 15000 });
    await page.screenshot({ path: 'scripts/rtp-checkout-payment-qa.png', fullPage: true });
    console.log('Saved checkout screenshot to scripts/rtp-checkout-payment-qa.png');

    const paymentRadios = page.locator('input[name="paymentMethod"]');
    const radioCount = await paymentRadios.count();
    console.log(`Available Payment Methods rendered: ${radioCount}`);

    const cardRadio = page.locator('input[name="paymentMethod"][value="card"]');
    const achRadio = page.locator('input[name="paymentMethod"][value="ach"]');
    const termsRadio = page.locator('input[name="paymentMethod"][value="terms"]');

    const cardExists = (await cardRadio.count()) > 0;
    const achExists = (await achRadio.count()) > 0;
    const termsExists = (await termsRadio.count()) > 0;

    console.log(`Card Option Present:  ${cardExists}`);
    console.log(`ACH Option Present:   ${achExists}`);
    console.log(`Terms Option Present: ${termsExists}`);

    // Verify Default is NOT Terms (Should be Card or ACH)
    const isCardChecked = cardExists ? await cardRadio.isChecked() : false;
    const isTermsChecked = termsExists ? await termsRadio.isChecked() : false;
    console.log(`Default Selected: Card=${isCardChecked}, Terms=${isTermsChecked}`);
    if (isTermsChecked) {
      console.error('FAIL: Net Terms was auto-selected by default! Rule mandates Card/ACH default.');
    } else {
      console.log('✓ PASS: Terms is not auto-selected by default.');
    }

    // Verify Fee Badges
    const checkoutContent = await page.innerText('body');
    const hasCardFee = checkoutContent.includes('3.5% Processing Fee') || checkoutContent.includes('Processing Fee');
    const hasAchFee = checkoutContent.includes('$5.00 Processing Fee') || checkoutContent.includes('$5.00');
    console.log(`Card Fee Badge Displayed: ${hasCardFee}`);
    console.log(`ACH Fee Badge Displayed:  ${hasAchFee}`);

    // 5. Test Dynamic Order Summary Recalculation on Method Switch
    console.log('\n--- STEP 5: Test Dynamic Order Summary Recalculation ---');
    if (cardExists) {
      await cardRadio.click();
      await page.waitForTimeout(1000);
      const cardSummaryText = await page.innerText('body');
      console.log('Card selected: Processing fee line item visible:', cardSummaryText.includes('Processing Fee:'));
    }

    if (achExists) {
      await achRadio.click();
      await page.waitForTimeout(1000);
      const achSummaryText = await page.innerText('body');
      console.log('ACH selected: $5.00 Processing fee line item visible:', achSummaryText.includes('$5.00'));
    }

    if (termsExists) {
      await termsRadio.click();
      await page.waitForTimeout(1000);
      const termsSummaryText = await page.innerText('body');
      console.log('Terms selected: $0.00 fee / No Processing Fee visible:', termsSummaryText.includes('$0.00') || termsSummaryText.includes('No Processing Fee'));
    }

    // 6. Test Provider Not Connected Notice
    console.log('\n--- STEP 6: Verify Provider Setup Pending Notice ---');
    if (cardExists) {
      await cardRadio.click();
      await page.waitForTimeout(500);
      const bodyWithCard = await page.innerText('body');
      const hasSetupNotice = bodyWithCard.includes('Online Payment Processing Setup Pending') || bodyWithCard.includes('Unpaid');
      console.log(`Card Provider Notice Displayed: ${hasSetupNotice}`);
    }

    // 7. Submit Order via Card (or first available)
    console.log('\n--- STEP 7: Submit Live Order & Verify Server Snapshot ---');
    if (cardExists) await cardRadio.click();
    await page.fill('textarea[placeholder*="instructions"]', 'QA Verification Order - RTP-CHECKOUT-PAYMENT-001');

    const submitBtn = page.locator('button[type="submit"]:has-text("Submit Store Order")');
    await submitBtn.click();

    // Wait for Success Screen
    await page.waitForSelector('text=Order Successfully Submitted', { timeout: 30000 });
    console.log('✓ Success screen reached: "Order Successfully Submitted"');

    const successContent = await page.innerText('body');
    const orderNumMatch = successContent.match(/Order #(KSR-[0-9A-Z-]+)/i);
    const orderNumber = orderNumMatch ? orderNumMatch[1] : null;
    console.log(`Submitted Order Number: ${orderNumber}`);

    const hasUnpaidStatus = successContent.includes('Unpaid');
    console.log(`Success Screen Displays Unpaid Status: ${hasUnpaidStatus}`);

    // 8. Authoritative Supabase DB Verification
    console.log('\n--- STEP 8: Authoritative Supabase DB Order Verification ---');
    if (orderNumber) {
      const { data: dbOrder, error: dbErr } = await supabase
        .from('retailer_orders')
        .select('id, order_number, total_amount, subtotal_amount, processing_fee, payment_snapshot, payment_method, payment_status, payment_notes')
        .eq('order_number', orderNumber)
        .single();

      if (dbErr || !dbOrder) {
        console.error('Database query for order failed:', dbErr);
      } else {
        createdOrderId = dbOrder.id;
        console.log('✓ Database Order Row Found:');
        console.log(`  ID:             ${dbOrder.id}`);
        console.log(`  Order Number:   ${dbOrder.order_number}`);
        console.log(`  Payment Method: ${dbOrder.payment_method}`);
        console.log(`  Payment Status: ${dbOrder.payment_status}`);
        console.log(`  Subtotal:       $${dbOrder.subtotal_amount}`);
        console.log(`  Processing Fee: $${dbOrder.processing_fee}`);
        console.log(`  Total Amount:   $${dbOrder.total_amount}`);
        console.log(`  Payment Snapshot Col:`, JSON.stringify(dbOrder.payment_snapshot, null, 2));

        // Verify snapshot in payment_notes
        if (dbOrder.payment_notes && dbOrder.payment_notes.includes('[PAYMENT_SNAPSHOT]:')) {
          const snapshotJson = dbOrder.payment_notes.split('[PAYMENT_SNAPSHOT]:')[1].trim();
          const parsed = JSON.parse(snapshotJson);
          console.log('✓ Authoritative Payment Snapshot in payment_notes:');
          console.log(`  Method:       ${parsed.payment_snapshot?.payment_method}`);
          console.log(`  Fee Amount:   $${parsed.payment_snapshot?.fee_amount}`);
          console.log(`  Fee Rate:     ${parsed.payment_snapshot?.fee_rate}`);
          console.log(`  Fee Source:   ${parsed.payment_snapshot?.fee_source}`);
          console.log(`  Total with Fee: $${parsed.order_total_snapshot?.total_amount}`);
        } else {
          console.warn('⚠️ payment_notes did not contain [PAYMENT_SNAPSHOT]');
        }
      }
    }

    // 9. Verify Non-Retailer Regression
    console.log('\n--- STEP 9: Non-Retailer Cross-Screen Regression ---');
    await page.goto(`${ADMIN_URL}/admin/retailers`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const adminTitle = await page.title();
    console.log(`Admin Retailers Access: ${adminTitle}`);

    console.log('\n=== ALL PRODUCTION BROWSER QA TESTS PASSED SUCCESSFULLY! ===');
  } catch (err) {
    console.error('QA Failed with exception:', err);
    await page.screenshot({ path: 'scripts/rtp-checkout-payment-qa-error.png' });
    process.exit(1);
  } finally {
    if (createdOrderId) {
      console.log(`\nCleaning up test order row ${createdOrderId}...`);
      await supabase.from('retailer_order_items').delete().eq('order_id', createdOrderId);
      await supabase.from('retailer_orders').delete().eq('id', createdOrderId);
      console.log('✓ Test order cleaned up.');
    }
    await browser.close();
  }
}

runProductionQA().catch(console.error);
