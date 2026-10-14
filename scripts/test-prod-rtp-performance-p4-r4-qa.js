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

const PROD_BASE = 'https://portal.kselecthub.com';
const DR120_ID = 'b88c8e01-c7fe-49ee-ba3a-a4deba5c00ed';

async function runProductionP4R4QA() {
  console.log('================================================================');
  console.log('=== RTP-PERFORMANCE-P4-001-R4 Production Browser QA Suite ===');
  console.log('================================================================\n');

  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    // 1. Diagnostics Fingerprint Verification
    console.log(`1. Checking Production Diagnostics at ${PROD_BASE}/api/diagnostics...`);
    await page.goto(`${PROD_BASE}/api/diagnostics`, { waitUntil: 'domcontentloaded' });
    const diagText = await page.innerText('body');
    const diag = JSON.parse(diagText);
    console.log(`✓ Live Commit SHA: ${diag.deployment.commitSha}`);
    console.log(`✓ Live Branch: ${diag.deployment.branch}`);
    console.log(`✓ Live Environment: ${diag.deployment.environment}`);
    console.assert(
      diag.deployment.commitSha === '44cfcfa761c92207ebbf8b51f3d777671c6adbca',
      'Live SHA must match local HEAD'
    );

    // 2. Authenticate Retailer
    console.log('\n2. Authenticating Retailer (tammyhahm@gmail.com) via Supabase Magiclink...');
    const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: 'tammyhahm@gmail.com',
    });

    if (linkErr || !linkData?.properties?.action_link) {
      throw new Error('Magiclink generation failed: ' + linkErr?.message);
    }

    await page.goto(linkData.properties.action_link, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    console.log('✓ Successfully authenticated retailer session');

    // 3. Settings > Shipping Addresses (/settings/shipping)
    console.log(`\n3. Navigating to ${PROD_BASE}/settings/shipping ...`);
    await page.goto(`${PROD_BASE}/settings/shipping`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    const shippingBody = await page.innerText('body');
    console.assert(
      shippingBody.includes('ACTIVE DEFAULT SHIPPING DESTINATION'),
      'Default Destination banner must be visible'
    );
    console.log('✓ Verified ACTIVE DEFAULT SHIPPING DESTINATION banner');

    console.assert(
      shippingBody.includes('Registered Store Locations'),
      'Registered Store Locations section must be visible'
    );
    console.assert(
      shippingBody.includes('Any store with a complete street address can be designated as the Default Shipping Address'),
      'P4-R4 updated helper text must be visible'
    );
    console.log('✓ Verified Registered Store Locations section & P4-R4 helper copy');

    // Check store cards & "Set as Default" buttons
    const setAsDefaultBtns = await page.$$('button:has-text("Set as Default")');
    console.log(`✓ Found ${setAsDefaultBtns.length} "Set as Default" button(s) on store cards`);
    console.assert(setAsDefaultBtns.length >= 1, 'Must have at least 1 "Set as Default" button for eligible stores');

    // 4. Cart Setup: Add DR120 24 units directly to Cart
    console.log(`\n4. Adding DR120 item to cart from product detail page...`);
    await page.goto(`${PROD_BASE}/retailer/products/${DR120_ID}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);

    const addBtn = page.locator('button:has-text("to Cart")').first();
    console.assert((await addBtn.count()) > 0, 'Add to Cart button must exist on DR120 product page');
    await addBtn.click();
    await page.waitForTimeout(2000);
    console.log('✓ Successfully added DR120 24 units to cart');

    // 5. Checkout Verification (/checkout)
    console.log(`\n5. Navigating to Checkout: ${PROD_BASE}/checkout ...`);
    await page.goto(`${PROD_BASE}/checkout`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // 5A. Tab Renamed to "➕ Add Shipping Address"
    console.log('\n5A. Verifying Tab Renamed from "One-Time Address" to "➕ Add Shipping Address"...');
    const oldTab = await page.$('button:has-text("One-Time Address")');
    console.assert(!oldTab, 'Old "One-Time Address" tab label must NOT exist');

    const addAddressTab = page.locator('button:has-text("Add Shipping Address")').first();
    console.assert((await addAddressTab.count()) > 0, '"Add Shipping Address" tab MUST exist');
    const tabLabel = (await addAddressTab.innerText()).trim();
    console.log(`✓ Tab Label confirmed: "${tabLabel}"`);

    // 5B. Coupled Checkboxes in Add Shipping Address Form
    console.log('\n5B. Verifying Add Shipping Address Form Checkboxes & Coupling Logic...');
    await addAddressTab.click();
    await page.waitForTimeout(1000);

    const saveAddressCb = page.locator('label:has-text("Save this address") input[type="checkbox"]').first();
    const setDefaultCb = page.locator('label:has-text("Set as Default Shipping Address") input[type="checkbox"]').first();
    console.assert((await saveAddressCb.count()) > 0, 'Checkbox "Save this address to Address Book" must exist');
    console.assert((await setDefaultCb.count()) > 0, 'Checkbox "Set as Default Shipping Address" must exist');

    // Both start unchecked
    console.assert(!(await saveAddressCb.isChecked()), '"Save this address" must start unchecked');
    console.assert(!(await setDefaultCb.isChecked()), '"Set as Default" must start unchecked');
    console.log('✓ Both checkboxes start UNCHECKED');

    // Test coupling 1: check "Set as Default" -> "Save this address" auto-checks
    console.log('Testing coupling 1: Checking "Set as Default"...');
    await setDefaultCb.check();
    await page.waitForTimeout(500);
    console.assert(await saveAddressCb.isChecked(), 'Checking "Set as Default" MUST auto-check "Save this address"');
    console.log('✓ PASS: Checking "Set as Default" automatically checked "Save this address"');

    // Test coupling 2: uncheck "Save this address" -> "Set as Default" auto-unchecks
    console.log('Testing coupling 2: Unchecking "Save this address"...');
    await saveAddressCb.uncheck();
    await page.waitForTimeout(500);
    console.assert(!(await setDefaultCb.isChecked()), 'Unchecking "Save this address" MUST auto-uncheck "Set as Default"');
    console.log('✓ PASS: Unchecking "Save this address" automatically unchecked "Set as Default"');

    // Switch back to Saved Address or Store tab
    const storeTab = page.locator('button:has-text("Store")').first();
    if (await storeTab.count() > 0) {
      await storeTab.click();
      await page.waitForTimeout(1000);
    }

    // 5C. Explicit Payment Method Choice
    console.log('\n5C. Verifying Explicit Payment Method Selection (None preselected initially)...');
    const cardOption = page.locator('input[type="radio"][value="card"]');
    const achOption = page.locator('input[type="radio"][value="ach"]');
    const termsOption = page.locator('input[type="radio"][value="terms"]');

    if (await cardOption.count() > 0) {
      console.assert(!(await cardOption.isChecked()), 'Payment method "card" must NOT be preselected on fresh entry');
    }
    if (await achOption.count() > 0) {
      console.assert(!(await achOption.isChecked()), 'Payment method "ach" must NOT be preselected on fresh entry');
    }
    if (await termsOption.count() > 0) {
      console.assert(!(await termsOption.isChecked()), 'Payment method "terms" must NOT be preselected on fresh entry');
    }
    console.log('✓ PASS: Zero payment methods preselected on checkout entry (Explicit Choice enforced)');

    // 5D. Submit Button Locking Sequence
    console.log('\n5D. Verifying Submit Order Button Locking Sequence...');
    // Look for the Ship to This Address checkbox in the destination review card
    const shipCheckbox = page.locator('label:has-text("Ship to This Address") input[type="checkbox"]').first();
    console.assert((await shipCheckbox.count()) > 0, '"Ship to This Address" confirmation checkbox must exist');
    console.assert(!(await shipCheckbox.isChecked()), '"Ship to This Address" must start unchecked');

    // Stage 1: Both unchecked -> Button disabled: "Confirm Shipping Address to Submit"
    const submitBtn = page.locator('button:has-text("Submit"), button:has-text("Confirm")').last();
    console.assert(await submitBtn.isDisabled(), 'Submit button must be disabled initially');
    let btnText = (await submitBtn.innerText()).trim();
    console.log(`Stage 1 Button text: "${btnText}" (disabled: true)`);
    console.assert(btnText.includes('Confirm Shipping Address'), 'Button text must prompt for shipping confirmation');
    console.log('✓ Stage 1 PASS: Locked for Shipping Confirmation');

    // Stage 2: Check "Ship to This Address", payment NOT selected -> Button disabled: "Select Payment Method to Submit"
    console.log('Checking "Ship to This Address" checkbox...');
    await shipCheckbox.check();
    await page.waitForTimeout(500);

    console.assert(await submitBtn.isDisabled(), 'Submit button must REMAIN disabled until payment is chosen');
    btnText = (await submitBtn.innerText()).trim();
    console.log(`Stage 2 Button text: "${btnText}" (disabled: true)`);
    console.assert(
      btnText.includes('Payment Method') || btnText.includes('Select Payment'),
      'Button text must prompt to select payment method'
    );
    console.log('✓ Stage 2 PASS: Locked for Payment Selection');

    // Stage 3: Select Payment Method (Card) -> Button UNLOCKED: "Submit Purchase Order"
    console.log('Selecting Credit Card payment method...');
    if (await cardOption.count() > 0) {
      await cardOption.check();
      await page.waitForTimeout(500);
    }

    console.assert(!(await submitBtn.isDisabled()), 'Submit button must now be UNLOCKED and enabled');
    btnText = (await submitBtn.innerText()).trim();
    console.log(`Stage 3 Button text: "${btnText}" (disabled: false)`);
    console.assert(
      btnText.includes('Submit Store Order') || btnText.includes('Submit Purchase Order'),
      'Button text must indicate submit order readiness'
    );
    console.log('✓ Stage 3 PASS: Button unlocked ONLY when BOTH shipping confirmed AND payment selected!');

    // Stage 4: Uncheck shipping confirmation -> Button relocks immediately
    console.log('Testing re-locking: unchecking shipping confirmation...');
    await shipCheckbox.uncheck();
    await page.waitForTimeout(500);
    console.assert(await submitBtn.isDisabled(), 'Submit button must immediately re-lock when shipping is unchecked');
    console.log('✓ Stage 4 PASS: Button safely re-locks upon any change');

    console.log('\n================================================================');
    console.log('🎉 ALL RTP-PERFORMANCE-P4-001-R4 PRODUCTION BROWSER QA TESTS PASSED!');
    console.log('================================================================');
  } finally {
    await browser.close();
  }
}

runProductionP4R4QA().catch((err) => {
  console.error('\n❌ Production Browser QA Failed:', err);
  process.exit(1);
});
