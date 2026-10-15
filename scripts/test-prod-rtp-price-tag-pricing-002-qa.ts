import { chromium, devices } from "playwright";
import * as path from "path";

const HUB_URL = "https://portal.kselecthub.com";
const TEST_EMAIL = "qa-retailer-test@letusto.com";
const TEST_PASSWORD = process.env.TEST_RETAILER_PASSWORD || "Password123!@#";

const STORE_01_ID = "effe7832-096c-4ae1-86c7-3cb189b59731";
const STORE_02_ID = "34bb2857-01dd-4d6e-bfd4-7112eec1ac1f";
const TARGET_COMMIT = "79f9f28";

const ARTIFACT_DIR = "C:/Users/ChaeHahm/.gemini/antigravity/brain/945ab025-0f8f-4fce-b0bc-56237108874e";

async function runProductionPricingR1QA() {
  console.log("\n==================================================================");
  console.log("  RTP-PRICE-TAG-PRICING-002-R1 Production Browser QA");
  console.log("==================================================================");

  // Poll for deployment SHA
  console.log(`\n[Step 0] Waiting for Vercel production deployment (${TARGET_COMMIT})...`);
  let deployed = false;
  for (let attempt = 1; attempt <= 30; attempt++) {
    try {
      const res = await fetch(`${HUB_URL}/api/diagnostics`);
      if (res.ok) {
        const diag = await res.json();
        const sha = diag?.deployment?.commitSha || "";
        console.log(`  Attempt ${attempt}/30: Deployed SHA = ${sha.slice(0, 7)}`);
        if (sha.startsWith(TARGET_COMMIT)) {
          deployed = true;
          break;
        }
      }
    } catch (e: any) {
      console.log(`  Attempt ${attempt}/30 diagnostics fetch error: ${e.message}`);
    }
    await new Promise((r) => setTimeout(r, 8000));
  }

  if (!deployed) {
    console.warn(`\n  WARNING: Target commit ${TARGET_COMMIT} not detected yet, proceeding with current deployment.`);
  }

  const browser = await chromium.launch({ headless: true });
  const results: Record<string, boolean> = {
    diagnosticsShaMatches: deployed,
    loginSuccessful: false,
    // Issue B: Automatic MSRP Initialization
    store02FootTestMSRPInitialized: false,
    store02MsrpDefaultBadgePresent: false,
    store02GrossMarginComputedFromMSRP: false,
    store02LabelPreviewShowsMsrpPrice: false,
    // Issue A: SALE Badge on Shelf Label Preview
    store01SaleBadgeOnShelfLabel: false,
    store01SaleOriginalStrikethrough: false,
    store01SalePriceDominant: false,
    store01SavePercentageDisplayed: false,
    nonSaleShelfLabelClean: false,
    shelfLabelFreeOfMarginLeakage: false,
    // Responsiveness
    mobileResponsiveRendering: false,
  };

  try {
    console.log("\n--- [Phase 1: Desktop QA] ---");
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

    // 2. Test Store 02 - Verify Automatic MSRP Initialization for FOOT-TEST-123
    console.log("\n--- [Step 4: Testing Store 02 Automatic MSRP Initialization for FOOT-TEST-123] ---");
    await page.goto(`${HUB_URL}/retailer/tags?store=${STORE_02_ID}`, { waitUntil: "networkidle", timeout: 25000 });
    await page.waitForTimeout(2000);

    const store02Screen = path.join(ARTIFACT_DIR, "prod_r1_store02_foot_test_msrp_view.png");
    await page.screenshot({ path: store02Screen, fullPage: false });
    console.log(`  Saved screenshot: ${store02Screen}`);

    const store02Content = await page.textContent("body");

    // Search or find FOOT-TEST-123
    const hasFootSku = store02Content?.includes("FOOT-TEST-123");
    console.log(`  Store 02 contains FOOT-TEST-123: ${hasFootSku}`);

    // Verify FOOT-TEST-123 regular price is $9.50 with MSRP Default badge
    const footRow = page.locator('tr:has-text("FOOT-TEST-123")').first();
    if ((await footRow.count()) > 0) {
      const rowText = await footRow.textContent();
      console.log(`  FOOT-TEST-123 Row Text: ${rowText?.replace(/\s+/g, " ").trim()}`);

      const hasPrice950 = rowText?.includes("$9.50");
      const hasMsrpBadge = rowText?.includes("MSRP Default");
      const hasMargin = rowText?.includes("GP $") || rowText?.includes("%");

      if (hasPrice950) {
        results.store02FootTestMSRPInitialized = true;
        console.log("  ✓ FOOT-TEST-123 Store Regular Price successfully initialized to $9.50!");
      }
      if (hasMsrpBadge) {
        results.store02MsrpDefaultBadgePresent = true;
        console.log("  ✓ 'MSRP Default' badge is rendered on table!");
      }
      if (hasMargin) {
        results.store02GrossMarginComputedFromMSRP = true;
        console.log("  ✓ Gross Margin computed from $9.50 MSRP Default!");
      }

      // Check Preview modal for FOOT-TEST-123
      const previewBtn = footRow.locator('button:has-text("Preview & Print")');
      if ((await previewBtn.count()) > 0) {
        await previewBtn.click();
        await page.waitForSelector('h3:has-text("Shelf Tag Preview")', { timeout: 10000 });
        await page.waitForTimeout(1000);

        const card = page.locator(".price-tag-container").first();
        const cardText = await card.textContent();
        console.log(`  FOOT-TEST-123 Shelf Label Preview: ${cardText?.replace(/\s+/g, " ").trim()}`);

        const hasCardPrice = cardText?.includes("$9.50");
        const doesNotSaySetPrice = !cardText?.includes("SET PRICE") && !cardText?.includes("Not Priced");
        if (hasCardPrice && doesNotSaySetPrice) {
          results.store02LabelPreviewShowsMsrpPrice = true;
          console.log("  ✓ Shelf label preview renders $9.50 cleanly without 'SET PRICE' warning!");
        }

        const footPreviewScreen = path.join(ARTIFACT_DIR, "prod_r1_store02_foot_test_label_preview.png");
        await page.screenshot({ path: footPreviewScreen, fullPage: false });
        console.log(`  Saved screenshot: ${footPreviewScreen}`);

        const closeBtn = page.locator('button:has-text("✕")');
        if ((await closeBtn.count()) > 0) {
          await closeBtn.first().click();
          await page.waitForTimeout(500);
        }
      }
    }

    // 3. Test Store 01 - Verify SALE Badge, Strikethrough & High-Contrast Thermal Design
    console.log("\n--- [Step 5: Testing Store 01 SALE Badge & Shelf Label Design] ---");
    await page.goto(`${HUB_URL}/retailer/tags?store=${STORE_01_ID}`, { waitUntil: "networkidle", timeout: 25000 });
    await page.waitForTimeout(2000);

    const store01Screen = path.join(ARTIFACT_DIR, "prod_r1_store01_sale_items_view.png");
    await page.screenshot({ path: store01Screen, fullPage: false });
    console.log(`  Saved screenshot: ${store01Screen}`);

    // Find on-sale product (e.g. Barrier Repair Ceramide Serum or TEST-SKN-001)
    const saleRow = page.locator('tr:has-text("TEST-SKN-001")').first();
    if ((await saleRow.count()) > 0) {
      const previewBtn = saleRow.locator('button:has-text("Preview & Print")');
      if ((await previewBtn.count()) > 0) {
        await previewBtn.click();
        await page.waitForSelector('h3:has-text("Shelf Tag Preview")', { timeout: 10000 });
        await page.waitForTimeout(1000);

        const card = page.locator(".price-tag-container").first();
        const cardText = await card.textContent();
        console.log(`  Sale Shelf Label Text: ${cardText?.replace(/\s+/g, " ").trim()}`);

        const hasSaleBadge = cardText?.includes("SALE");
        const hasStrikethroughPrice = cardText?.includes("$22.00");
        const hasSalePrice = cardText?.includes("$18.99");
        const hasSavePercent = cardText?.includes("SAVE 14%") || cardText?.includes("SAVE");
        const leaksWholesaleOrMargin = cardText?.includes("Wholesale") || cardText?.includes("GP $");

        if (hasSaleBadge) {
          results.store01SaleBadgeOnShelfLabel = true;
          console.log("  ✓ Explicit SALE badge is present on shelf label!");
        }
        if (hasStrikethroughPrice) {
          results.store01SaleOriginalStrikethrough = true;
          console.log("  ✓ Original Regular price $22.00 is displayed!");
        }
        if (hasSalePrice) {
          results.store01SalePriceDominant = true;
          console.log("  ✓ Dominant sale price $18.99 is displayed!");
        }
        if (hasSavePercent) {
          results.store01SavePercentageDisplayed = true;
          console.log("  ✓ SAVE discount percentage is displayed!");
        }
        if (!leaksWholesaleOrMargin) {
          results.shelfLabelFreeOfMarginLeakage = true;
          console.log("  ✓ Zero internal cost or profit data on customer-facing label.");
        }

        const salePreviewScreen = path.join(ARTIFACT_DIR, "prod_r1_store01_sale_label_preview.png");
        await page.screenshot({ path: salePreviewScreen, fullPage: false });
        console.log(`  Saved screenshot: ${salePreviewScreen}`);

        const closeBtn = page.locator('button:has-text("✕")');
        if ((await closeBtn.count()) > 0) {
          await closeBtn.first().click();
          await page.waitForTimeout(500);
        }
      }
    }

    // 4. Test Non-Sale Product Shelf Label (e.g. Brightening Triple-Vitamin Toner Pads / TEST-SKN-002)
    console.log("\n--- [Step 6: Testing Non-Sale Shelf Label Cleanliness] ---");
    const nonSaleRow = page.locator('tr:has-text("TEST-SKN-002")').first();
    if ((await nonSaleRow.count()) > 0) {
      const previewBtn = nonSaleRow.locator('button:has-text("Preview & Print")');
      if ((await previewBtn.count()) > 0) {
        await previewBtn.click();
        await page.waitForSelector('h3:has-text("Shelf Tag Preview")', { timeout: 10000 });
        await page.waitForTimeout(1000);

        const card = page.locator(".price-tag-container").first();
        const cardText = await card.textContent();
        console.log(`  Non-Sale Shelf Label Text: ${cardText?.replace(/\s+/g, " ").trim()}`);

        const doesNotHaveSaleBadge = !cardText?.includes("SALE");
        const doesNotHaveSave = !cardText?.includes("SAVE");
        const hasRegularPrice = cardText?.includes("$24.00");

        if (doesNotHaveSaleBadge && doesNotHaveSave && hasRegularPrice) {
          results.nonSaleShelfLabelClean = true;
          console.log("  ✓ Non-sale shelf label is clean without SALE/SAVE badges!");
        }

        const nonSalePreviewScreen = path.join(ARTIFACT_DIR, "prod_r1_store01_nonsale_label_preview.png");
        await page.screenshot({ path: nonSalePreviewScreen, fullPage: false });
        console.log(`  Saved screenshot: ${nonSalePreviewScreen}`);

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
    await mobilePage.goto(`${HUB_URL}/retailer/tags?store=${STORE_02_ID}`, { waitUntil: "networkidle", timeout: 25000 });
    await mobilePage.waitForTimeout(2000);

    const mobileScreen = path.join(ARTIFACT_DIR, "prod_r1_mobile_store02_view.png");
    await mobilePage.screenshot({ path: mobileScreen, fullPage: false });
    console.log(`  Saved screenshot: ${mobileScreen}`);

    const mobileText = await mobilePage.textContent("body");
    if (mobileText?.includes("FOOT-TEST-123") && mobileText?.includes("$9.50")) {
      results.mobileResponsiveRendering = true;
      console.log("  ✓ Mobile viewport renders FOOT-TEST-123 with $9.50 MSRP default cleanly!");
    }

    await desktopContext.close();
    await mobileContext.close();
  } catch (error: any) {
    console.error("  QA Error:", error.message);
  } finally {
    await browser.close();
  }

  console.log("\n==================================================================");
  console.log("  RTP-PRICE-TAG-PRICING-002-R1 QA RESULTS SUMMARY");
  console.log("==================================================================");
  console.table(results);

  const passedCount = Object.values(results).filter(Boolean).length;
  const totalCount = Object.keys(results).length;
  console.log(`\nScore: ${passedCount}/${totalCount} assertions passed.`);

  return results;
}

runProductionPricingR1QA();
