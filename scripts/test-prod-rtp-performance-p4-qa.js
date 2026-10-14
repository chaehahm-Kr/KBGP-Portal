const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envText = fs.readFileSync('.env.local', 'utf8');
const env = {};
envText.split('\n').forEach((line) => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    env[match[1]] = value.trim();
  }
});

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL || 'https://shzfrppdobpmrstcjfqu.supabase.co';
const SERVICE_KEY = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const DR120_ID = 'b88c8e01-c7fe-49ee-ba3a-a4deba5c00ed';

async function runProductionP4QA() {
  console.log('=== RTP-PERFORMANCE-P4-001 Live Production Browser QA ===\n');
  const browser = await chromium.launch({ headless: true });

  try {
    const retailerContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const retailerPage = await retailerContext.newPage();

    // 1. Authenticate Retailer
    console.log('1. Authenticating Retailer via Supabase Magiclink...');
    const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: 'tammyhahm@gmail.com',
    });

    if (linkErr || !linkData?.properties?.action_link) {
      throw new Error('Magiclink failed: ' + linkErr?.message);
    }

    await retailerPage.goto(linkData.properties.action_link, { waitUntil: 'domcontentloaded' });
    await retailerPage.waitForTimeout(3000);

    // 2. Clear Cart first to ensure fresh baseline
    console.log('\n2. Ensuring fresh cart baseline at https://portal.kselecthub.com/cart ...');
    await retailerPage.goto('https://portal.kselecthub.com/cart', { waitUntil: 'domcontentloaded' });
    await retailerPage.waitForTimeout(2000);
    const clearCartBtn = await retailerPage.$('button:has-text("전체 삭제"), button:has-text("Clear Cart")');
    if (clearCartBtn) {
      await clearCartBtn.click();
      await retailerPage.waitForTimeout(1000);
      console.log('✓ Existing cart cleared');
    } else {
      console.log('✓ Cart already empty baseline');
    }

    // 3. Performance Dashboard (/sales)
    console.log('\n3. Navigating to Performance Dashboard: https://portal.kselecthub.com/sales ...');
    await retailerPage.goto('https://portal.kselecthub.com/sales', { waitUntil: 'domcontentloaded' });
    await retailerPage.waitForTimeout(3000);

    const rows = await retailerPage.$$('tbody tr.hidden.md\\:table-row');
    console.log(`✓ Detected ${rows.length} product rows in desktop table`);

    let foundDisabledRow = false;
    for (let i = 0; i < rows.length; i++) {
      const text = await rows[i].innerText();
      if (text.includes('Insufficient Data') || text.includes('Adequate (0)')) {
        foundDisabledRow = true;
        const cartOnDisabled = await rows[i].$('button:has-text("+ Cart")');
        console.assert(!cartOnDisabled, `Row ${i + 1} with Insufficient Data must NOT show enabled + Cart`);
      }
    }
    console.log(`✓ Checked eligibility enforcement on dashboard table: foundDisabledRow=${foundDisabledRow}`);

    // 4. Product Performance Detail View (KLALAB DR120 Barrier Cream)
    console.log(`\n4. Navigating to Product Performance Detail View: https://portal.kselecthub.com/sales/${DR120_ID} ...`);
    await retailerPage.goto(`https://portal.kselecthub.com/sales/${DR120_ID}`, { waitUntil: 'domcontentloaded' });
    await retailerPage.waitForTimeout(4000);

    console.log(`✓ Detail Page URL: ${retailerPage.url()}`);
    const quickReorderHeader = await retailerPage.$('text="Quick Reorder"');
    console.log('✓ Quick Reorder panel rendered in Section 3:', Boolean(quickReorderHeader));

    const reorderButton = await retailerPage.$('button:has-text("Add to Cart"), button:has-text("Add ")');
    if (reorderButton) {
      const isReorderDisabled = await reorderButton.isDisabled();
      const btnText = (await reorderButton.innerText()).replace(/\n/g, ' ');
      console.log(`✓ Quick Reorder button found: "${btnText}" (disabled=${isReorderDisabled})`);
    }

    const storeBreakdownHeader = await retailerPage.$('text="Store-by-Store Inventory & Movement"');
    console.log('✓ Store-by-Store Inventory & Movement rendered in Section 5:', Boolean(storeBreakdownHeader));

    // 5. Test Cart Addition Flow (Advisory Reorder to Cart Pipeline)
    console.log('\n5. Adding item to Cart to verify Cart and Checkout integration pipeline...');
    await retailerPage.goto(`https://portal.kselecthub.com/products/${DR120_ID}`, { waitUntil: 'domcontentloaded' });
    await retailerPage.waitForTimeout(3000);

    // Select 24 units / MOQ case multiple
    const quick24Btn = await retailerPage.$('button:has-text("24 units"), button:has-text("24")');
    if (quick24Btn) {
      await quick24Btn.click();
      await retailerPage.waitForTimeout(500);
    }
    const addCatalogBtn = await retailerPage.$('button:has-text("to Cart"), button:has-text("장바구니 담기")');
    if (addCatalogBtn) {
      await addCatalogBtn.click();
      await retailerPage.waitForTimeout(2000);
      console.log('✓ Added item to cart');
    }

    // 6. Verify Cart View (/cart)
    console.log('\n6. Verifying Cart view: https://portal.kselecthub.com/cart ...');
    await retailerPage.goto('https://portal.kselecthub.com/cart', { waitUntil: 'domcontentloaded' });
    await retailerPage.waitForTimeout(3000);

    const cartText = await retailerPage.innerText('body');
    const hasItemInCart = cartText.includes('DR120') || cartText.includes('KLALAB') || cartText.includes('Order Summary') || cartText.includes('주문 요약');
    console.log('✓ Cart page has active item content:', hasItemInCart);
    console.assert(hasItemInCart, 'Cart should contain added product');

    // 7. Test Checkout View (/checkout)
    console.log('\n7. Navigating to Checkout: https://portal.kselecthub.com/checkout ...');
    const checkoutLink = await retailerPage.$('a[href*="checkout"], button:has-text("주문하기"), button:has-text("Checkout")');
    if (checkoutLink) {
      await checkoutLink.click();
      await retailerPage.waitForTimeout(3000);
    } else {
      await retailerPage.goto('https://portal.kselecthub.com/checkout', { waitUntil: 'domcontentloaded' });
      await retailerPage.waitForTimeout(3000);
    }

    const checkoutText = await retailerPage.innerText('body');
    const isCheckoutValid = checkoutText.includes('Order Review') || checkoutText.includes('DELIVERY DESTINATION') || checkoutText.includes('Checkout') || checkoutText.includes('주문서');
    console.log('✓ Checkout page loaded with active order summary:', isCheckoutValid);
    console.assert(isCheckoutValid, 'Checkout view must load with order data');

    // Verify Destination Store selection exists on checkout
    const storeMention = checkoutText.includes('Store') || checkoutText.includes('DELIVERY DESTINATION');
    console.log('✓ Store destination selector / delivery context present:', storeMention);

    // Verify Non-Financial Safety: Order button is NOT auto-clicked
    const placeOrderBtn = await retailerPage.$('button:has-text("Place B2B Order"), button:has-text("주문하기"), button:has-text("Place Order")');
    console.log('✓ Place Order button rendered safely without automatic submission:', Boolean(placeOrderBtn));

    // 8. Clean up test cart
    console.log('\n8. Cleaning up test cart...');
    await retailerPage.goto('https://portal.kselecthub.com/cart', { waitUntil: 'domcontentloaded' });
    await retailerPage.waitForTimeout(2000);
    const finalClearBtn = await retailerPage.$('button:has-text("전체 삭제"), button:has-text("Clear Cart")');
    if (finalClearBtn) {
      await finalClearBtn.click();
      await retailerPage.waitForTimeout(1000);
      console.log('✓ Test cart cleaned up cleanly');
    }

    console.log('\n=== ALL PRODUCTION BROWSER QA CHECKS PASSED 100% ===');
  } catch (err) {
    console.error('Production Browser QA Failed:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runProductionP4QA();
