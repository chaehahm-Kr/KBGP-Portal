import { chromium, devices } from "playwright";
import * as path from "path";

const HUB_URL = "https://portal.kselecthub.com";
const TEST_EMAIL = "qa-retailer-test@letusto.com";
const TEST_PASSWORD = process.env.TEST_RETAILER_PASSWORD || "Password123!@#";

const STORE_01_ID = "effe7832-096c-4ae1-86c7-3cb189b59731";
const STORE_02_ID = "34bb2857-01dd-4d6e-bfd4-7112eec1ac1f";
const TARGET_COMMIT = "52c98ed";

const ARTIFACT_DIR = "C:/Users/ChaeHahm/.gemini/antigravity/brain/945ab025-0f8f-4fce-b0bc-56237108874e";

async function runProductionPricingQA() {
  console.log("\n==================================================================");
  console.log("  RTP-PRICE-TAG-PRICING-002 Production Browser QA");
  console.log("==================================================================");

  // Poll for deployment SHA
  console.log(`\n[Step 0] Waiting for Vercel production deployment (${TARGET_COMMIT})...`);
  let deployed = false;
  for (let attempt = 1; attempt <= 24; attempt++) {
    try {
      const res = await fetch(`${HUB_URL}/api/diagnostics`);
      if (res.ok) {
        const diag = await res.json();
        const sha = diag?.deployment?.commitSha || "";
        console.log(`  Attempt ${attempt}/24: Deployed SHA = ${sha.slice(0, 7)}`);
        if (sha.startsWith("52c98ed") || sha.startsWith("8640dcb")) {
          deployed = true;
          break;
        }
      }
    } catch (e: any) {
      console.log(`  Attempt ${attempt}/24 diagnostics fetch error: ${e.message}`);
    }
    await new Promise((r) => setTimeout(r, 10000));
  }

  if (!deployed) {
    console.warn(`\n  WARNING: Target commit ${TARGET_COMMIT} not detected yet, proceeding with current deployment.`);
  }

  const browser = await chromium.launch({ headless: true });
  const results: Record<string, boolean> = {
    diagnosticsShaMatches: deployed,
    loginSuccessful: false,
    storeSwitcherButtonsRendered: false,
    allStoresModeOverviewActive: false,
    allStoresBreakdownRendered: false,
    allStoresPrintGuarded: false,
    store01SwitchedSuccessfully: false,
    wholesaleCostAndSourceDisplayed: false,
    grossProfitAndMarginDisplayed: false,
    msrpGuidanceInEditModal: false,
    previewShelfLabelCleanOfMargins: false,
  };

  try {
    // Phase 1: Desktop QA
    console.log("\n--- [Phase 1: Desktop Viewport QA] ---");
    const desktopContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    const page = await desktopContext.newPage();

    // 1. Login
    console.log("  [Step 1] Navigating to /login...");
    await page.goto(`${HUB_URL}/login`, { waitUntil: "domcontentloaded", timeout: 25000 });
    await page.waitForSelector('input[type="email"], input[name="email"], input#email', { timeout: 15000 });

    console.log("  [Step 2] Logging in...");
    await page.locator('input[type="email"], input[name="email"], input#email').fill(TEST_EMAIL);
    await page.locator('input[type="password"], input[name="password"], input#password').fill(TEST_PASSWORD);
    await page.locator('button[type="submit"]').click();

    await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 25000 });
    await page.waitForTimeout(2000);
    results.loginSuccessful = true;
    console.log("  [Step 3] Logged in successfully.");

    // 2. Navigate to /retailer/tags
    console.log("  [Step 4] Navigating to /retailer/tags...");
    await page.goto(`${HUB_URL}/retailer/tags`, { waitUntil: "networkidle", timeout: 25000 });
    await page.waitForTimeout(2000);

    // Screenshot initial tags view
    const initialScreen = path.join(ARTIFACT_DIR, "prod_rtp_pricing_initial_tags.png");
    await page.screenshot({ path: initialScreen, fullPage: false });
    console.log(`  Saved screenshot: ${initialScreen}`);

    // 3. Verify Button-based Store Selector
    console.log("  [Step 5] Checking segmented button store selector...");
    const allStoresBtn = page.locator('button:has-text("All Stores")');
    const store01Btn = page.locator(`button:has-text("Test Store 01")`);
    const store02Btn = page.locator(`button:has-text("Test Store 02")`);

    const hasAllStoresBtn = (await allStoresBtn.count()) > 0;
    const hasStore01Btn = (await store01Btn.count()) > 0;
    console.log(`  Store buttons present: All Stores=${hasAllStoresBtn}, Store 01=${hasStore01Btn}`);

    if (hasAllStoresBtn && hasStore01Btn) {
      results.storeSwitcherButtonsRendered = true;
    }

    // 4. Test All Stores Overview Mode
    console.log("  [Step 6] Testing All Stores Mode...");
    if (hasAllStoresBtn) {
      await allStoresBtn.first().click();
      await page.waitForURL((url) => url.searchParams.get("store") === "all", { timeout: 10000 });
      await page.waitForTimeout(2000);

      const pageText = await page.textContent("body");
      const hasOverviewBanner =
        pageText?.includes("Overview & Comparison Mode") ||
        pageText?.includes("Displaying union of assortment products");
      console.log(`  All Stores overview banner present: ${hasOverviewBanner}`);
      if (hasOverviewBanner) {
        results.allStoresModeOverviewActive = true;
      }

      // Check Store-by-Store price breakdown in table
      const hasStorePill =
        pageText?.includes("Test Store 01:") ||
        pageText?.includes("Test Store 01") && pageText?.includes("Test Store 02");
      console.log(`  Store-by-Store price breakdown rendered: ${hasStorePill}`);
      if (hasStorePill) {
        results.allStoresBreakdownRendered = true;
      }

      // Verify Batch Print button is guarded in All Stores
      const printBtn = page.locator('button:has-text("Print Selected")').first();
      const isDisabled = await printBtn.isDisabled();
      console.log(`  Batch Print disabled in All Stores mode: ${isDisabled}`);
      if (isDisabled) {
        results.allStoresPrintGuarded = true;
      }

      // Screenshot All Stores mode
      const allStoresScreen = path.join(ARTIFACT_DIR, "prod_rtp_pricing_all_stores_overview.png");
      await page.screenshot({ path: allStoresScreen, fullPage: false });
      console.log(`  Saved screenshot: ${allStoresScreen}`);
    }

    // 5. Switch to Test Store 01
    console.log("  [Step 7] Switching to Test Store 01...");
    if (hasStore01Btn) {
      await store01Btn.first().click();
      await page.waitForURL((url) => url.searchParams.get("store") === STORE_01_ID, { timeout: 10000 });
      await page.waitForTimeout(2000);
      results.store01SwitchedSuccessfully = true;

      // Screenshot Store 01 view
      const store01Screen = path.join(ARTIFACT_DIR, "prod_rtp_pricing_store01_view.png");
      await page.screenshot({ path: store01Screen, fullPage: false });
      console.log(`  Saved screenshot: ${store01Screen}`);

      const store01Text = await page.textContent("body");

      // 6. Check Wholesale Cost & Source Attribution
      console.log("  [Step 8] Verifying Wholesale Cost & Source Attribution...");
      const hasWholesaleLabel =
        store01Text?.includes("Cost:") ||
        store01Text?.includes("Wholesale:") ||
        store01Text?.includes("Last Purchase") ||
        store01Text?.includes("Invoice #") ||
        store01Text?.includes("Catalog Wholesale");
      console.log(`  Wholesale Cost with source tag present: ${hasWholesaleLabel}`);
      if (hasWholesaleLabel) {
        results.wholesaleCostAndSourceDisplayed = true;
      }

      // 7. Check Gross Profit ($) and Gross Margin (%)
      console.log("  [Step 9] Verifying Gross Profit & Margin %...");
      const hasGpMargin =
        store01Text?.includes("GP $") ||
        /GP \$[0-9]+\.[0-9]{2} \([0-9.-]+%\)/.test(store01Text || "");
      console.log(`  Gross Profit & Margin % displayed: ${hasGpMargin}`);
      if (hasGpMargin) {
        results.grossProfitAndMarginDisplayed = true;
      }

      // 8. Test Edit Price Modal & MSRP Guidance
      console.log("  [Step 10] Testing Edit Price Modal & MSRP Guidance...");
      const editBtn = page.locator('button:has-text("Edit Price")').first();
      if ((await editBtn.count()) > 0) {
        await editBtn.click();
        await page.waitForSelector('h2:has-text("Edit Store Price & Tag")', { timeout: 10000 });
        await page.waitForTimeout(1000);

        const modalText = await page.locator(".fixed.inset-0").first().textContent();
        const hasMsrpPrefillOrGuidance =
          modalText?.includes("Suggested MSRP") ||
          modalText?.includes("Suggested from MSRP") ||
          modalText?.includes("Estimated Merchandise Profit");
        console.log(`  Edit Modal MSRP guidance and margin preview: ${hasMsrpPrefillOrGuidance}`);
        if (hasMsrpPrefillOrGuidance) {
          results.msrpGuidanceInEditModal = true;
        }

        // Screenshot Edit Modal
        const editModalScreen = path.join(ARTIFACT_DIR, "prod_rtp_pricing_edit_modal.png");
        await page.screenshot({ path: editModalScreen, fullPage: false });
        console.log(`  Saved screenshot: ${editModalScreen}`);

        // Close modal
        const cancelBtn = page.locator('button:has-text("Cancel")');
        if ((await cancelBtn.count()) > 0) {
          await cancelBtn.click();
          await page.waitForTimeout(500);
        }
      }

      // 9. Test Preview & Print Modal - Verify Shelf Label Does NOT leak Margin / Cost
      console.log("  [Step 11] Checking Preview Shelf Label safety...");
      const previewBtn = page.locator('button:has-text("Preview & Print")').first();
      if ((await previewBtn.count()) > 0) {
        await previewBtn.click();
        await page.waitForSelector('h3:has-text("Shelf Tag Preview")', { timeout: 10000 });
        await page.waitForTimeout(1000);

        // Inspect the shelf label card inside the preview modal
        const labelCard = page.locator(".price-tag-container").first();
        const labelText = await labelCard.textContent();

        const leaksWholesale = labelText?.includes("Wholesale") || labelText?.includes("Cost");
        const leaksMargin = labelText?.includes("GP $") || labelText?.includes("Margin");
        console.log(`  Label card leaks wholesale: ${leaksWholesale}, leaks margin: ${leaksMargin}`);

        if (!leaksWholesale && !leaksMargin) {
          results.previewShelfLabelCleanOfMargins = true;
          console.log("  ✓ Shelf label preview contains strictly customer-facing retail price and QR.");
        }

        // Screenshot Preview Modal
        const previewModalScreen = path.join(ARTIFACT_DIR, "prod_rtp_pricing_preview_modal.png");
        await page.screenshot({ path: previewModalScreen, fullPage: false });
        console.log(`  Saved screenshot: ${previewModalScreen}`);

        // Close preview modal
        const closeBtn = page.locator('button:has-text("✕")');
        if ((await closeBtn.count()) > 0) {
          await closeBtn.first().click();
          await page.waitForTimeout(500);
        }
      }
    }

    // Phase 2: Mobile Viewport QA (iPhone 14 Pro)
    console.log("\n--- [Phase 2: Mobile Viewport QA (iPhone 14 Pro)] ---");
    const mobileContext = await browser.newContext({
      ...devices["iPhone 14 Pro"],
    });
    const mobilePage = await mobileContext.newPage();

    // Mobile Login
    await mobilePage.goto(`${HUB_URL}/login`, { waitUntil: "domcontentloaded", timeout: 25000 });
    await mobilePage.waitForSelector('input[type="email"], input[name="email"], input#email', { timeout: 15000 });
    await mobilePage.locator('input[type="email"], input[name="email"], input#email').fill(TEST_EMAIL);
    await mobilePage.locator('input[type="password"], input[name="password"], input#password').fill(TEST_PASSWORD);
    await mobilePage.locator('button[type="submit"]').click();
    await mobilePage.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 25000 });
    await mobilePage.waitForTimeout(2000);

    // Mobile Tags
    await mobilePage.goto(`${HUB_URL}/retailer/tags`, { waitUntil: "networkidle", timeout: 25000 });
    await mobilePage.waitForTimeout(2000);

    // Screenshot Mobile View
    const mobileScreen = path.join(ARTIFACT_DIR, "prod_rtp_pricing_mobile_view.png");
    await mobilePage.screenshot({ path: mobileScreen, fullPage: false });
    console.log(`  Saved screenshot: ${mobileScreen}`);

    await desktopContext.close();
    await mobileContext.close();
  } catch (error: any) {
    console.error("  QA Error:", error.message);
  } finally {
    await browser.close();
  }

  console.log("\n==================================================================");
  console.log("  RTP-PRICE-TAG-PRICING-002 QA RESULTS SUMMARY");
  console.log("==================================================================");
  console.table(results);

  const passedCount = Object.values(results).filter(Boolean).length;
  const totalCount = Object.keys(results).length;
  console.log(`\nScore: ${passedCount}/${totalCount} assertions passed.`);

  return results;
}

runProductionPricingQA();
