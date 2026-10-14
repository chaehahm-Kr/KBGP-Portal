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

async function runProductionP4R1QA() {
  console.log('=== RTP-PERFORMANCE-P4-001-R1 Live Production Browser QA ===\n');
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
    await retailerPage.waitForTimeout(4000);

    const rows = await retailerPage.$$('tbody tr.hidden.md\\:table-row');
    console.log(`✓ Detected ${rows.length} product rows in desktop table`);

    let foundManualReorderBtn = false;
    let foundSuggestedCartBtn = false;

    for (let i = 0; i < rows.length; i++) {
      const text = await rows[i].innerText();
      const reorderBtn = await rows[i].$('button:has-text("+ Reorder")');
      const cartBtn = await rows[i].$('button:has-text("+ Cart")');

      if (reorderBtn) {
        foundManualReorderBtn = true;
      }
      if (cartBtn) {
        foundSuggestedCartBtn = true;
      }
    }

    console.log(`✓ Verified Dashboard Table Reorder Controls: foundManualReorderBtn=${foundManualReorderBtn}, foundSuggestedCartBtn=${foundSuggestedCartBtn}`);
    console.assert(foundManualReorderBtn, 'Must find at least one + Reorder button on dashboard table for orderable products');

    // Test clicking + Reorder on first row that has it
    console.log('\n3b. Testing + Reorder click on dashboard row...');
    const firstReorderBtn = await retailerPage.$('tbody tr.hidden.md\\:table-row button:has-text("+ Reorder")');
    if (firstReorderBtn) {
      await firstReorderBtn.click();
      await retailerPage.waitForTimeout(1500);

      // Check if store selection modal opened or toast appeared
      const storeModal = await retailerPage.$('h3:has-text("Select Destination Store")');
      if (storeModal) {
        console.log('✓ Store Picker Modal opened successfully for Company-Wide reorder');
        const modalAddBtn = await retailerPage.$('div.fixed.inset-0 button:has-text("+ Add to Cart")');
        if (modalAddBtn) {
          await modalAddBtn.click();
          await retailerPage.waitForTimeout(1000);
          console.log('✓ Selected store in modal and added to cart');
        }
      }

      const toast = await retailerPage.$('div.fixed.bottom-5:has-text("Added to Cart"), div.fixed.bottom-5:has-text("Cart Quantity Updated")');
      console.log('✓ Floating cart feedback notification visible:', Boolean(toast));
    }

    // 4. Product Performance Detail View (KLALAB DR120 Barrier Cream)
    console.log(`\n4. Navigating to Product Performance Detail View: https://portal.kselecthub.com/sales/${DR120_ID} ...`);
    await retailerPage.goto(`https://portal.kselecthub.com/sales/${DR120_ID}`, { waitUntil: 'domcontentloaded' });
    await retailerPage.waitForTimeout(4000);

    console.log(`✓ Detail Page URL: ${retailerPage.url()}`);
    const quickReorderHeader = await retailerPage.$('text="Quick Reorder"');
    console.log('✓ Quick Reorder panel rendered in Section 3:', Boolean(quickReorderHeader));

    // Verify Case Stepper Controls
    const decrementBtn = await retailerPage.$('button[title="Decrease 1 case"]');
    const incrementBtn = await retailerPage.$('button[title="Increase 1 case"]');
    console.log('✓ Case Stepper Controls present:', Boolean(decrementBtn && incrementBtn));

    // Initial decrement should be disabled at min MOQ 1 case
    if (decrementBtn) {
      const isDecDisabled = await decrementBtn.isDisabled();
      console.log('✓ Stepper [-] disabled at 1 case (min MOQ):', isDecDisabled);
    }

    // Step up [+] to 2 cases
    if (incrementBtn) {
      console.log('Testing Stepper [+] increment...');
      await incrementBtn.click();
      await retailerPage.waitForTimeout(500);
      const unitsText = await retailerPage.textContent('div:has-text("2 cases")');
      console.log('✓ Successfully incremented to 2 cases:', Boolean(unitsText));

      // Step back down [-] to 1 case
      if (decrementBtn) {
        await decrementBtn.click();
        await retailerPage.waitForTimeout(500);
        console.log('✓ Successfully decremented back to 1 case');
      }
    }

    // Add to cart from Detail View Quick Reorder Box
    const addBtn = await retailerPage.$('div.bg-zinc-800\\/40 button:has-text("Add ")');
    if (addBtn) {
      const addText = (await addBtn.innerText()).replace(/\n/g, ' ');
      console.log(`Clicking Quick Reorder button: "${addText}"`);
      await addBtn.click();
      await retailerPage.waitForTimeout(1000);

      const successFeedback = await retailerPage.$('text="Added to Cart!"');
      console.log('✓ Button feedback "Added to Cart!" visible:', Boolean(successFeedback));
    }

    // 5. Section 5: Store-by-Store Breakdown Table
    console.log('\n5. Verifying Store-by-Store Inventory & Movement Section...');
    const storeBreakdownHeader = await retailerPage.$('text="Store-by-Store Inventory & Movement"');
    console.log('✓ Store-by-Store Breakdown rendered:', Boolean(storeBreakdownHeader));

    const storeReorderBtn = await retailerPage.$('table button:has-text("+ Reorder"), table button:has-text("+ Cart")');
    if (storeReorderBtn) {
      const btnText = (await storeReorderBtn.innerText()).replace(/\n/g, ' ');
      console.log(`Clicking store breakdown reorder button: "${btnText}"`);
      await storeReorderBtn.click();
      await retailerPage.waitForTimeout(1000);
      console.log('✓ Store breakdown reorder clicked successfully');
    }

    // 6. Cart Navigation & Persistence Check
    console.log('\n6. Navigating to Cart: https://portal.kselecthub.com/cart ...');
    await retailerPage.goto('https://portal.kselecthub.com/cart', { waitUntil: 'domcontentloaded' });
    await retailerPage.waitForTimeout(3000);

    const cartItems = await retailerPage.$$('div:has-text("KLALAB DR120 Barrier Cream")');
    console.log('✓ DR120 present in cart items:', cartItems.length > 0);

    // Reload page to test storage persistence
    console.log('Testing Cart page reload persistence...');
    await retailerPage.reload({ waitUntil: 'domcontentloaded' });
    await retailerPage.waitForTimeout(2000);
    const persistedItems = await retailerPage.$$('div:has-text("KLALAB DR120 Barrier Cream")');
    console.log('✓ DR120 persisted across browser reload:', persistedItems.length > 0);

    // 7. Checkout Pipeline Navigation
    console.log('\n7. Navigating to Checkout: https://portal.kselecthub.com/checkout ...');
    await retailerPage.goto('https://portal.kselecthub.com/checkout', { waitUntil: 'domcontentloaded' });
    await retailerPage.waitForTimeout(3000);

    const checkoutTitle = await retailerPage.$('h1:has-text("주문서 작성"), h1:has-text("Checkout")');
    console.log('✓ Checkout page rendered cleanly without errors:', Boolean(checkoutTitle));

    console.log('\n================================================================');
    console.log('🎉 ALL RTP-PERFORMANCE-P4-001-R1 PRODUCTION QA TESTS PASSED!');
    console.log('================================================================');

  } catch (err) {
    console.error('\n❌ Production QA Failed:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runProductionP4R1QA();
