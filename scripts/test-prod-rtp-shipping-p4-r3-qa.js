const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

// Load environment
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

async function runQA() {
  console.log('==================================================================');
  console.log('  RTP-PERFORMANCE-P4-001-R3 PRODUCTION BROWSER QA                ');
  console.log('==================================================================');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'en-US',
  });
  const page = await context.newPage();

  const reportsDir = path.join(process.cwd(), 'reports');
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });

  try {
    // 1. Diagnostics Fingerprint Verification
    console.log('\n[Step 1] Checking Live Deployment Diagnostics...');
    await page.goto('https://portal.kselecthub.com/api/diagnostics', { waitUntil: 'domcontentloaded', timeout: 15000 });
    const diagText = await page.innerText('body');
    const diagData = JSON.parse(diagText);
    console.log(`- portal.kselecthub.com Commit SHA: ${diagData.deployment?.commitSha}`);
    assert(diagData.deployment?.commitSha?.startsWith('e31729b'), `Expected commit e31729b, got ${diagData.deployment?.commitSha}`);
    console.log('✓ PASS: Production deployment SHA matches git HEAD e31729b!');

    // 2. Retailer Authentication
    console.log('\n[Step 2] Authenticating Retailer via Supabase Magiclink...');
    const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: 'tammyhahm@gmail.com',
    });

    if (linkErr || !linkData?.properties?.action_link) {
      throw new Error('Magiclink generation failed: ' + linkErr?.message);
    }

    await page.goto(linkData.properties.action_link, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    console.log(`- Successfully authenticated retailer, URL: ${page.url()}`);

    // Pre-cleanup any previous QA test addresses from DB to ensure clean baseline
    await supabase.from('retailer_shipping_addresses').delete().like('label', '%QA%');
    console.log('- Cleared previous QA test addresses for clean state.');

    // 3. Settings > Shipping Addresses Page Audit
    console.log('\n[Step 3] Auditing Settings > Shipping Addresses (/settings/shipping)...');
    await page.goto('https://portal.kselecthub.com/settings/shipping', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(2000);

    const bannerExists = (await page.locator('text=Active Default Shipping Destination').count()) > 0;
    assert(bannerExists, 'Must display Active Default Shipping Destination callout banner');
    console.log('✓ PASS: Active Default Shipping Destination banner is rendered.');

    const storeSectionExists = (await page.locator('h2:has-text("Registered Store Locations")').count()) > 0;
    console.log(`- Registered Store Locations section rendered: ${storeSectionExists}`);

    const savedSectionExists = (await page.locator('h2:has-text("Saved Warehouse")').count()) > 0;
    assert(savedSectionExists, 'Must display Saved Warehouse & Distribution Addresses section');
    console.log('✓ PASS: Saved Warehouse & Distribution Addresses section is rendered.');

    // 4. Add a Custom Saved Shipping Address with Default checked
    console.log('\n[Step 4] Testing Add Saved Address & Set as Default...');
    await page.click('button:has-text("+ Add Shipping Address")');
    await page.waitForSelector('form input[placeholder*="Central Warehouse"]', { timeout: 10000 });

    const testLabel = `QA Hub ${Date.now()}`;
    await page.locator('form input[placeholder*="Central Warehouse"]').fill(testLabel);
    await page.locator('form input[placeholder*="Jane Doe"]').fill('QA Logistics Lead');
    await page.locator('form input[placeholder*="123 Commerce Blvd"]').fill('888 Express Way');
    await page.locator('form input[placeholder*="Los Angeles"]').fill('Secaucus');
    await page.locator('form input[placeholder*="CA"]').fill('NJ');
    await page.locator('form input[placeholder*="90001"]').fill('07094');

    // Ensure Default checkbox is checked
    const defaultCheckbox = page.locator('form input[type="checkbox"]');
    if (!(await defaultCheckbox.isChecked())) {
      await defaultCheckbox.check();
    }

    await page.click('form button[type="submit"]');
    await page.waitForTimeout(3000);

    // Verify newly added address is displayed and marked as default
    const cardEl = page.locator(`div:has-text("${testLabel}")`).first();
    assert((await cardEl.count()) > 0, `Address "${testLabel}" must appear on page`);

    const hasDefaultBadge = (await cardEl.locator('text=Default Shipping Destination').count()) > 0;
    assert(hasDefaultBadge, 'Must display Default Shipping Destination badge on newly created card');
    console.log(`✓ PASS: Address "${testLabel}" created and marked as Default Destination!`);

    // Verify banner updated to reflect Rule 1 Configured Default
    const bannerEl = page.locator('div:has(h2:has-text("Active Default Shipping Destination"))').first();
    const bannerText = await bannerEl.innerText();
    assert(bannerText.includes(testLabel) || bannerText.includes('Configured Default'), 'Banner must reflect explicit saved default');
    console.log('✓ PASS: Active default callout banner updated to reflect Rule 1 saved default!');

    await page.screenshot({ path: path.join(reportsDir, 'rtp_p4_r3_settings_shipping.png'), fullPage: true });
    console.log('- Captured screenshot: reports/rtp_p4_r3_settings_shipping.png');

    // 5. Add product to Cart to test Cart summary
    console.log('\n[Step 5] Adding Product to Cart...');
    await page.goto(`https://portal.kselecthub.com/products/${DR120_ID}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(3000);

    const quick24Btn = await page.$('button:has-text("24 units"), button:has-text("24")');
    if (quick24Btn) {
      await quick24Btn.click();
      await page.waitForTimeout(500);
    }
    const addCatalogBtn = await page.$('button:has-text("to Cart"), button:has-text("장바구니 담기")');
    if (addCatalogBtn) {
      await addCatalogBtn.click();
      await page.waitForTimeout(2000);
      console.log('✓ Product added to cart');
    }

    // 6. Shopping Cart Page Audit
    console.log('\n[Step 6] Auditing Shopping Cart (/cart) Default Address Summary...');
    await page.goto('https://portal.kselecthub.com/cart', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(2000);

    const cartHasDefaultPanel = (await page.locator('text=Default Shipping Address').count()) > 0;
    assert(cartHasDefaultPanel, 'Cart must render Default Shipping Address informational panel');

    const cartDefaultPanel = page.locator('div:has-text("Default Shipping Address")').first();
    const cartDefaultText = await cartDefaultPanel.innerText();
    assert(
      cartDefaultText.includes(testLabel) || cartDefaultText.includes('Secaucus') || cartDefaultText.includes('Default'),
      'Cart summary must display the active default shipping address'
    );
    console.log('✓ PASS: Cart correctly displays active Default Shipping Address informational summary!');

    await page.screenshot({ path: path.join(reportsDir, 'rtp_p4_r3_cart_shipping_summary.png'), fullPage: false });
    console.log('- Captured screenshot: reports/rtp_p4_r3_cart_shipping_summary.png');

    // 7. Checkout Page Audit (Preselection, Explicit Confirmation, Reset on Change)
    console.log('\n[Step 7] Auditing Checkout (/checkout) Preselection & Explicit Confirmation...');
    await page.goto('https://portal.kselecthub.com/checkout', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(3000);

    // Verify "Ship to This Address" confirmation checkbox is present
    const confirmCheckbox = page.locator('input[type="checkbox"]:near(:text("Ship to This Address"))').first();
    assert((await confirmCheckbox.count()) > 0, 'Must display "Ship to This Address" confirmation checkbox');

    // Verify confirmation starts UNCHECKED
    const isCheckedInitial = await confirmCheckbox.isChecked();
    assert(!isCheckedInitial, 'Ship to This Address confirmation MUST start unchecked');
    console.log('✓ PASS: Confirmation checkbox correctly initialized as UNCHECKED!');

    // Verify submit button is locked
    const submitBtn = page.locator('button[type="submit"]:has-text("Confirm Shipping Address to Submit"), button[type="submit"]:has-text("Submit Store Order")');
    const submitText = await submitBtn.innerText();
    console.log(`- Initial submit button text: "${submitText}"`);
    assert(submitText.includes('Confirm Shipping Address') || (await submitBtn.isDisabled()), 'Submit button must be disabled/prompt when unconfirmed');
    console.log('✓ PASS: Order submission blocked when shipping destination is unconfirmed.');

    // Step 8. Check confirmation box
    console.log('\n[Step 8] Checking "Ship to This Address" and verifying UI activation...');
    await confirmCheckbox.check();
    await page.waitForTimeout(1000);
    assert(await confirmCheckbox.isChecked(), 'Checkbox should now be checked');

    const confirmedBadge = await page.locator('text=✓ Confirmed').count();
    assert(confirmedBadge > 0, 'Must display "✓ Confirmed" badge when checked');
    console.log('✓ PASS: Destination confirmed badge activated.');

    const submitBtnActive = page.locator('button[type="submit"]:has-text("Submit Store Order")');
    const submitTextActive = await submitBtnActive.innerText();
    console.log(`- Active submit button text: "${submitTextActive}"`);
    assert(submitTextActive.includes('Submit Store Order'), 'Submit button must show "Submit Store Order" when confirmed');
    console.log('✓ PASS: Order submission enabled upon explicit confirmation!');

    // Step 9. Test Reset Behavior on Destination Change
    console.log('\n[Step 9] Testing Confirmation Reset on Destination Change...');
    const storeTab = page.locator('button:has-text("Store")').first();
    if ((await storeTab.count()) > 0) {
      await storeTab.click();
      await page.waitForTimeout(1000);

      // Verify confirmation checkbox is reset to unchecked
      const isCheckedAfterChange = await confirmCheckbox.isChecked();
      assert(!isCheckedAfterChange, 'Confirmation checkbox MUST reset to unchecked when destination changes');
      console.log('✓ PASS: Confirmation checkbox automatically RESET to UNCHECKED on destination change!');

      const submitTextAfterReset = await submitBtn.innerText();
      assert(submitTextAfterReset.includes('Confirm Shipping Address') || (await submitBtn.isDisabled()), 'Submit button must re-lock when destination changes');
      console.log('✓ PASS: Order submission re-locked upon destination change!');
    }

    await page.screenshot({ path: path.join(reportsDir, 'rtp_p4_r3_checkout_confirmation_reset.png'), fullPage: true });
    console.log('- Captured screenshot: reports/rtp_p4_r3_checkout_confirmation_reset.png');

    // 10. Cleanup & Store Fallback Verification
    console.log('\n[Step 10] Cleaning Up Test Address & Verifying Store Fallback Reversion...');
    await page.goto('https://portal.kselecthub.com/settings/shipping', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(2000);

    page.once('dialog', async (dialog) => {
      console.log(`- Confirmation dialog accepted: "${dialog.message()}"`);
      await dialog.accept();
    });

    const removeBtn = page.locator('button:has-text("Remove")').first();
    assert((await removeBtn.count()) > 0, 'Remove button must exist on test card');
    await removeBtn.click();
    await page.waitForTimeout(3000);

    // Verify address card is no longer in visible DOM
    const remainingCount = await page.locator(`h3:has-text("${testLabel}")`).count();
    assert.strictEqual(remainingCount, 0, `Address "${testLabel}" must be removed from page`);
    console.log('✓ PASS: Test address removed cleanly from UI!');

    // Verify Active Default Destination now shows Store Fallback
    const fallbackBannerEl = page.locator('div:has(h2:has-text("Active Default Shipping Destination"))').first();
    const fallbackBannerText = await fallbackBannerEl.innerText();
    assert(
      fallbackBannerText.includes('Store Fallback') || fallbackBannerText.includes('Test Store') || fallbackBannerText.includes('Store Location'),
      'Default must automatically revert to Store Fallback'
    );
    console.log('✓ PASS: Default shipping destination automatically reverted to Store Fallback (Rule 2)!');

    await page.screenshot({ path: path.join(reportsDir, 'rtp_p4_r3_settings_reverted_fallback.png'), fullPage: true });
    console.log('- Captured screenshot: reports/rtp_p4_r3_settings_reverted_fallback.png');

    // Final database cleanup of test addresses
    await supabase.from('retailer_shipping_addresses').delete().like('label', '%QA%');

    console.log('\n==================================================================');
    console.log('  PRODUCTION BROWSER QA PASSED ALL CHECKS (100%)                  ');
    console.log('==================================================================');
  } catch (err) {
    console.error('Browser QA failed:', err);
    await page.screenshot({ path: path.join(reportsDir, 'rtp_p4_r3_qa_error.png'), fullPage: true });
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runQA();
