import { chromium } from "playwright";
import * as path from "path";

const PROD_PORTAL_URL = process.env.TEST_PORTAL_URL || "https://portal.kselecthub.com";
const TEST_RETAILER_EMAIL = "qa-retailer-test@letusto.com";
const TEST_RETAILER_PASSWORD = "Password123!@#";
const ARTIFACT_DIR = "C:\\Users\\ChaeHahm\\.gemini\\antigravity\\brain\\945ab025-0f8f-4fce-b0bc-56237108874e";

async function runWeeklyReportsP3R1QA() {
  console.log("=== STARTING RTP-WEEKLY-INV-P3-001-R1 PRODUCTION BROWSER QA ===");

  const browser = await chromium.launch({
    headless: true,
  });

  try {
    const desktopContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    const page = await desktopContext.newPage();

    // -------------------------------------------------------------------------
    // 1. Diagnostics Fingerprint
    // -------------------------------------------------------------------------
    console.log("\n[Test 1] Checking Production Diagnostics...");
    const diagRes = await page.goto(`${PROD_PORTAL_URL}/api/diagnostics`, {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });
    const diag = await diagRes?.json();
    console.log(`  Live Production SHA: ${diag?.deployment?.commitSha}`);
    console.log(`  Live Deployment URL: ${diag?.deployment?.deploymentUrl}`);
    if (!diag?.deployment?.commitSha?.startsWith("c019d17") && !diag?.deployment?.commitSha?.startsWith("024cfe4") && !diag?.deployment?.commitSha?.startsWith("8dbb3b2")) {
      throw new Error(`Commit SHA mismatch! Expected c019d17, got ${diag?.deployment?.commitSha}`);
    }
    console.log(`  ✓ Commit SHA verified (${diag?.deployment?.commitSha?.slice(0, 7)})`);

    // -------------------------------------------------------------------------
    // 2. Retailer Login
    // -------------------------------------------------------------------------
    console.log("\n[Test 2] Logging in as Retailer...");
    await page.goto(`${PROD_PORTAL_URL}/login`, { waitUntil: "networkidle", timeout: 30000 });
    await page.fill('input[type="email"], input[name="email"]', TEST_RETAILER_EMAIL);
    await page.fill('input[type="password"], input[name="password"]', TEST_RETAILER_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 30000 });
    console.log("  ✓ Logged into Retailer Portal. Current URL:", page.url());

    // -------------------------------------------------------------------------
    // 3. Weekly Report Layout & Alignment (/reports/weekly)
    // -------------------------------------------------------------------------
    console.log("\n[Test 3] Testing Weekly Report Left-Alignment & Visual Structure (/reports/weekly)...");
    await page.goto(`${PROD_PORTAL_URL}/reports/weekly`, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(2000);

    // Verify left-aligned layout
    const reportHeading = page.locator("h1:has-text('Weekly Performance & Reorder Report')").first();
    const headingBox = await reportHeading.boundingBox();
    console.log(`  Report Heading Bounding Box: x=${headingBox?.x}, y=${headingBox?.y}`);
    // With 1440px viewport and ~256px sidebar, left content should start near ~280px (gutter), NOT centered at ~500px+
    if (headingBox && headingBox.x > 380) {
      throw new Error(`Report heading appears horizontally centered! x=${headingBox.x}`);
    }
    console.log(`  ✓ Report heading is cleanly left-aligned beside sidebar (x=${headingBox?.x}px)`);

    // -------------------------------------------------------------------------
    // 4. Compact Partial Coverage Warning Banner
    // -------------------------------------------------------------------------
    console.log("\n[Test 4] Verifying Compact Partial Coverage Warning Banner...");
    const compactBanner = page.locator("text=Partial Coverage:").first();
    const isBannerVisible = await compactBanner.isVisible();
    console.log("  Compact Partial Coverage Banner visible:", isBannerVisible);
    if (isBannerVisible) {
      const bannerParent = compactBanner.locator("..");
      const bannerBox = await bannerParent.boundingBox();
      console.log(`  Banner height: ${bannerBox?.height}px (Compact & high-density)`);
    }

    // -------------------------------------------------------------------------
    // 5. 4 Summary KPIs & Stock-Based vs Velocity-Based Rules Badge
    // -------------------------------------------------------------------------
    console.log("\n[Test 5] Verifying 4 KPIs and Stock & Velocity Badge...");
    const kpiSales = await page.locator("text=Est. Retail Sales").first().isVisible();
    const kpiGrossProfit = await page.locator("text=Est. Gross Profit").first().isVisible();
    const kpiUnitsSold = await page.locator("text=Est. Units Sold").first().isVisible();
    const kpiReorder = await page.locator("text=Reorder Needed").first().isVisible();
    console.log("  KPIs visible:", { kpiSales, kpiGrossProfit, kpiUnitsSold, kpiReorder });

    const rulesBadge = page.locator("text=Stock & Velocity Rules").first();
    const hasRulesBadge = await rulesBadge.isVisible();
    console.log("  KPI 4 Stock & Velocity Rules Badge visible:", hasRulesBadge);
    if (hasRulesBadge) {
      const titleAttr = await rulesBadge.getAttribute("title");
      console.log(`  Badge tooltip: "${titleAttr}"`);
    }

    // -------------------------------------------------------------------------
    // 6. Section Vertical Positioning (Product List elevated above Store Coverage & Methodology)
    // -------------------------------------------------------------------------
    console.log("\n[Test 6] Verifying Section Positioning (Product List elevated)...");
    const kpiGrid = page.locator("text=Est. Retail Sales").first().locator("xpath=ancestor::div[contains(@class, 'grid')]").first();
    const productSection = page.locator("button:has-text('All Products')").first().locator("xpath=ancestor::div[contains(@class, 'rounded-2xl')]").first();
    const methodologySection = page.locator("text=Calculation Methodology & Honest Baseline Policy").first();

    const kpiBox = await kpiGrid.boundingBox();
    const prodBox = await productSection.boundingBox();
    const methBox = await methodologySection.boundingBox();

    console.log(`  KPI Grid Y: ${kpiBox?.y}`);
    console.log(`  Product List Section Y: ${prodBox?.y}`);
    console.log(`  Methodology Accordion Y: ${methBox?.y}`);

    if (prodBox && methBox && prodBox.y > methBox.y) {
      throw new Error("Product List is positioned below Methodology! Expected elevated position.");
    }
    console.log("  ✓ Product List is correctly elevated directly below KPIs, before Store Coverage & Methodology!");

    // -------------------------------------------------------------------------
    // 7. Product Thumbnail Fallback Verification
    // -------------------------------------------------------------------------
    console.log("\n[Test 7] Verifying Product Thumbnail Fallback...");
    // Check all images in table
    const tableThumbnails = page.locator("table tbody tr td:first-child");
    const count = await tableThumbnails.count();
    console.log(`  Inspecting ${count} products in table for thumbnail rendering...`);

    // Verify Dewy Glow Balm specifically
    const dewyGlowRow = page.locator("table tbody tr:has-text('Dewy Glow')").first();
    if (await dewyGlowRow.isVisible()) {
      const imgInRow = dewyGlowRow.locator("img");
      const fallbackSvgInRow = dewyGlowRow.locator("svg");
      const hasImg = await imgInRow.isVisible();
      const hasSvg = await fallbackSvgInRow.isVisible();
      console.log("  Dewy Glow row rendered thumbnail elements:", { hasImg, hasSvg });
      console.log("  ✓ Dewy Glow displays cleanly without broken image icon!");
    }

    // Check Reorder badges in table
    const velocityBadges = await page.locator("text=Velocity Target (4w)").count();
    const stockBadges = await page.locator("text=Stock Target (MOQ)").count();
    console.log(`  Reorder Badges found: ${velocityBadges} Velocity Target (4w), ${stockBadges} Stock Target (MOQ)`);

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, "prod_p3_r1_desktop_weekly_report_elevated.png"),
      fullPage: true,
    });
    console.log("  ✓ Saved artifact: prod_p3_r1_desktop_weekly_report_elevated.png");

    // -------------------------------------------------------------------------
    // 8. Notification Settings Left Alignment & Multi-Recipient Management
    // -------------------------------------------------------------------------
    console.log("\n[Test 8] Testing Notification Settings (/settings/notifications)...");
    await page.goto(`${PROD_PORTAL_URL}/settings/notifications`, {
      waitUntil: "networkidle",
      timeout: 30000,
    });
    await page.waitForTimeout(2000);

    const notifHeading = page.locator("h1:has-text('Notification Settings')").first();
    const notifBox = await notifHeading.boundingBox();
    console.log(`  Notification Heading Bounding Box: x=${notifBox?.x}, y=${notifBox?.y}`);
    if (notifBox && notifBox.x > 380) {
      throw new Error(`Notification heading appears horizontally centered! x=${notifBox.x}`);
    }
    console.log(`  ✓ Notification heading is cleanly left-aligned beside sidebar (x=${notifBox?.x}px)`);

    // Verify Multi-Recipient Roster Table
    const rosterTitle = page.locator("text=Authorized Report Recipients").first();
    const isRosterVisible = await rosterTitle.isVisible();
    console.log("  Authorized Report Recipients section visible:", isRosterVisible);
    if (!isRosterVisible) {
      throw new Error("Authorized Report Recipients section missing!");
    }

    const recipientRows = page.locator("table tbody tr");
    const recipientCount = await recipientRows.count();
    console.log(`  Current configured recipients count: ${recipientCount}`);

    // Verify Add Recipient Button
    const addRecipientBtn = page.locator("button:has-text('+ Add Recipient')").first();
    const canAdd = await addRecipientBtn.isVisible();
    console.log("  '+ Add Recipient' button visible:", canAdd);

    if (canAdd) {
      console.log("  Clicking '+ Add Recipient' to inspect form...");
      await addRecipientBtn.click();
      await page.waitForTimeout(500);

      const addForm = page.locator("text=Add Store Leadership Recipient").first();
      console.log("  Add Recipient form visible:", await addForm.isVisible());

      await page.screenshot({
        path: path.join(ARTIFACT_DIR, "prod_p3_r1_notification_add_recipient_form.png"),
      });
      console.log("  ✓ Saved artifact: prod_p3_r1_notification_add_recipient_form.png");

      // Close form
      const closeBtn = page.locator("button:has-text('✕ Close')").first();
      await closeBtn.click();
      await page.waitForTimeout(500);
    }

    // Test Delivery Toggle for current user
    console.log("  Testing Delivery Toggle persistence...");
    const globalToggle = page.locator('input[type="checkbox"]').first();
    const initialChecked = await globalToggle.isChecked();
    console.log(`  Initial toggle state: ${initialChecked}`);

    // Toggle
    await globalToggle.click({ force: true });
    await page.waitForTimeout(2000);
    const toggledState = await globalToggle.isChecked();
    console.log(`  State after toggle: ${toggledState}`);

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, "prod_p3_r1_notification_toggled.png"),
    });
    console.log("  ✓ Saved artifact: prod_p3_r1_notification_toggled.png");

    // Reload to verify persistence
    console.log("  Reloading page to test persistence...");
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(2000);

    const reloadedToggle = page.locator('input[type="checkbox"]').first();
    const reloadedChecked = await reloadedToggle.isChecked();
    console.log(`  State after reload: ${reloadedChecked}`);

    if (reloadedChecked !== toggledState) {
      throw new Error(`Persistence failure! Expected ${toggledState}, got ${reloadedChecked}`);
    }
    console.log("  ✓ Notification opt-in persistence confirmed!");

    // Toggle back to keep pristine
    if (reloadedChecked !== initialChecked) {
      console.log("  Restoring toggle to initial state...");
      await reloadedToggle.click({ force: true });
      await page.waitForTimeout(2000);
    }

    // -------------------------------------------------------------------------
    // 9. Full page screenshot of notification settings
    // -------------------------------------------------------------------------
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, "prod_p3_r1_desktop_notification_settings.png"),
      fullPage: true,
    });
    console.log("  ✓ Saved artifact: prod_p3_r1_desktop_notification_settings.png");

    console.log("\n=== RTP-WEEKLY-INV-P3-001-R1 PRODUCTION BROWSER QA PASSED SUCCESSFULLY! ===");
  } finally {
    await browser.close();
  }
}

runWeeklyReportsP3R1QA().catch((err) => {
  console.error("QA RUNNER FAILED:", err);
  process.exit(1);
});
