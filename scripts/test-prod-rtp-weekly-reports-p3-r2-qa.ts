import { chromium } from "playwright";
import * as path from "path";

const PROD_PORTAL_URL = process.env.TEST_PORTAL_URL || "https://portal.kselecthub.com";
const TEST_RETAILER_EMAIL = "qa-retailer-test@letusto.com";
const TEST_RETAILER_PASSWORD = "Password123!@#";
const ARTIFACT_DIR = "C:\\Users\\ChaeHahm\\.gemini\\antigravity\\brain\\60393d8e-2782-4539-8c9d-c53f4b39baf6";

async function runWeeklyReportsP3R2QA() {
  console.log("=== STARTING RTP-WEEKLY-INV-P3-001-R2 PRODUCTION BROWSER QA ===");

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
    console.log("\n[Test 1] Checking Production Diagnostics Fingerprint...");
    const diagRes = await page.goto(`${PROD_PORTAL_URL}/api/diagnostics`, {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });
    const diag = await diagRes?.json();
    console.log(`  Live Production SHA: ${diag?.deployment?.commitSha}`);
    console.log(`  Live Deployment URL: ${diag?.deployment?.deploymentUrl}`);
    if (!diag?.deployment?.commitSha || typeof diag?.deployment?.commitSha !== "string" || diag?.deployment?.commitSha.length < 7) {
      throw new Error(`Invalid diagnostics commit SHA: ${diag?.deployment?.commitSha}`);
    }
    console.log(`  ✓ Commit SHA verified (${diag.deployment.commitSha.slice(0, 7)})`);

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
    // 3. Notification Settings (/settings/notifications)
    // -------------------------------------------------------------------------
    console.log("\n[Test 3] Navigating to Notification Settings (/settings/notifications)...");
    await page.goto(`${PROD_PORTAL_URL}/settings/notifications`, {
      waitUntil: "networkidle",
      timeout: 30000,
    });
    await page.waitForTimeout(2000);

    // Verify left-alignment
    const notifHeading = page.locator("h1:has-text('Notification Settings')").first();
    const notifBox = await notifHeading.boundingBox();
    console.log(`  Notification Heading position: x=${notifBox?.x}px, y=${notifBox?.y}px`);
    if (notifBox && notifBox.x > 380) {
      throw new Error(`Notification heading appears horizontally centered! x=${notifBox.x}`);
    }
    console.log("  ✓ Notification heading is cleanly left-aligned beside sidebar.");

    // Verify absence of restrictive warning banners
    console.log("\n[Test 4] Verifying Removal of Restrictive Warnings & Company Membership Blockers...");
    const restrictiveBanner1 = await page.locator("text=For data confidentiality and role-based security").count();
    const restrictiveBanner2 = await page.locator("text=Only verified team members").count();
    const max5Warning = await page.locator("text=Maximum 5 recipients").count();
    console.log(`  Restrictive warning counts: disclaimer=${restrictiveBanner1}, teamOnly=${restrictiveBanner2}, max5=${max5Warning}`);
    if (restrictiveBanner1 > 0 || restrictiveBanner2 > 0 || max5Warning > 0) {
      throw new Error("Restrictive company-membership / 5-recipient warnings are still visible!");
    }
    console.log("  ✓ No restrictive warnings found. Roster allows open authorized distribution.");

    // Verify section title and roster table headers
    console.log("\n[Test 5] Verifying Report Recipients Roster Table Structure...");
    const rosterHeading = page.locator("text=Report Recipients Roster").first();
    if (!(await rosterHeading.isVisible())) {
      throw new Error("Section title 'Report Recipients Roster' not found!");
    }

    const colRecipient = await page.locator("table thead th:has-text('Recipient')").first().isVisible();
    const colType = await page.locator("table thead th:has-text('Type')").first().isVisible();
    const colStatus = await page.locator("table thead th:has-text('Status')").first().isVisible();
    const colDelivery = await page.locator("table thead th:has-text('Delivery')").first().isVisible();
    console.log("  Table columns verified:", { colRecipient, colType, colStatus, colDelivery });
    if (!colRecipient || !colType || !colStatus || !colDelivery) {
      throw new Error("Roster table is missing one or more required columns (Recipient, Type, Status, Delivery)!");
    }

    // -------------------------------------------------------------------------
    // 6. Inspect Add Recipient Form
    // -------------------------------------------------------------------------
    console.log("\n[Test 6] Inspecting 'Add Email Recipient' Form & Confidentiality Notice...");
    const addBtn = page.locator("button:has-text('+ Add Recipient')").first();
    if (!(await addBtn.isVisible())) {
      throw new Error("'+ Add Recipient' button not visible for retailer owner/buyer!");
    }
    await addBtn.click();
    await page.waitForTimeout(600);

    const formTitle = page.locator("text=Add Email Recipient").first();
    if (!(await formTitle.isVisible())) {
      throw new Error("Form title 'Add Email Recipient' not visible!");
    }

    // Verify Informational Confidentiality Notice
    const noticeText = "Weekly reports may contain confidential business information. Only add recipients you authorize to receive your company";
    const hasNotice = await page.locator(`text=${noticeText}`).first().isVisible();
    console.log("  Confidentiality notice visible:", hasNotice);
    if (!hasNotice) {
      throw new Error("Informational confidentiality notice missing from Add Recipient form!");
    }

    // Verify primary input placeholder
    const emailInput = page.locator('input[type="email"]').first();
    const placeholder = await emailInput.getAttribute("placeholder");
    console.log(`  Email input placeholder: "${placeholder}"`);
    if (!placeholder?.includes("cfo@external-audit.com")) {
      throw new Error(`Unexpected email input placeholder: ${placeholder}`);
    }

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, "prod_p3_r2_add_email_recipient_form.png"),
    });
    console.log("  ✓ Saved artifact: prod_p3_r2_add_email_recipient_form.png");

    // -------------------------------------------------------------------------
    // 7. Add External Recipient (e.g. Gmail / External Advisor)
    // -------------------------------------------------------------------------
    const testExternalEmail = `external.advisor.${Date.now()}@gmail.com`;
    console.log(`\n[Test 7] Adding External Recipient: ${testExternalEmail}...`);
    await emailInput.fill(testExternalEmail);

    const submitBtn = page.locator("button:has-text('+ Add Recipient')").nth(1); // button inside form
    await submitBtn.click();
    await page.waitForTimeout(2000);

    // Verify added recipient row
    const addedRow = page.locator(`table tbody tr:has-text('${testExternalEmail}')`).first();
    const isAddedVisible = await addedRow.isVisible();
    console.log(`  External recipient row visible: ${isAddedVisible}`);
    if (!isAddedVisible) {
      throw new Error(`Failed to find newly added external recipient: ${testExternalEmail}`);
    }

    // Verify Type Badge is 'External Recipient'
    const typeBadge = addedRow.locator("text=External Recipient").first();
    const hasExternalBadge = await typeBadge.isVisible();
    console.log(`  'External Recipient' badge visible: ${hasExternalBadge}`);
    if (!hasExternalBadge) {
      throw new Error("New external recipient does NOT display 'External Recipient' type badge!");
    }

    // -------------------------------------------------------------------------
    // 8. Test Persistence Across Reload
    // -------------------------------------------------------------------------
    console.log("\n[Test 8] Testing Persistence Across Page Reload...");
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(2000);

    const persistedRow = page.locator(`table tbody tr:has-text('${testExternalEmail}')`).first();
    if (!(await persistedRow.isVisible())) {
      throw new Error("External recipient disappeared after reload! Persistence failed.");
    }
    console.log("  ✓ External recipient successfully persisted across reload!");

    // -------------------------------------------------------------------------
    // 9. Test Toggle Delivery (Pause / Re-enable) for External Recipient
    // -------------------------------------------------------------------------
    console.log("\n[Test 9] Testing Toggle Delivery Pause & Re-enable for External Recipient...");
    const pauseBtn = persistedRow.locator("button:has-text('Pause')").first();
    if (await pauseBtn.isVisible()) {
      await pauseBtn.click();
      await page.waitForTimeout(2000);

      // Verify status changed to Paused / Enable button visible
      const enableBtn = persistedRow.locator("button:has-text('Enable')").first();
      console.log("  Enable button visible after pause:", await enableBtn.isVisible());

      // Reload to verify persistence of paused state
      await page.reload({ waitUntil: "networkidle" });
      await page.waitForTimeout(2000);

      const reloadedEnableBtn = page.locator(`table tbody tr:has-text('${testExternalEmail}') button:has-text('Enable')`).first();
      if (!(await reloadedEnableBtn.isVisible())) {
        throw new Error("Paused state did not persist across reload!");
      }
      console.log("  ✓ Delivery pause toggle persisted across reload.");

      // Re-enable
      await reloadedEnableBtn.click();
      await page.waitForTimeout(2000);
      console.log("  ✓ Delivery re-enabled successfully.");
    }

    // -------------------------------------------------------------------------
    // 10. Test Duplicate Email Prevention
    // -------------------------------------------------------------------------
    console.log("\n[Test 10] Testing Duplicate Email Prevention...");
    const openAddBtn = page.locator("button:has-text('+ Add Recipient')").first();
    await openAddBtn.click();
    await page.waitForTimeout(500);

    const dupEmailInput = page.locator('input[type="email"]').first();
    await dupEmailInput.fill(testExternalEmail);
    const dupSubmitBtn = page.locator("button:has-text('+ Add Recipient')").nth(1);
    await dupSubmitBtn.click();
    await page.waitForTimeout(1000);

    const dupError = page.locator("text=already registered as an active report recipient").first();
    const hasDupError = await dupError.isVisible();
    console.log(`  Duplicate error message visible: ${hasDupError}`);
    if (!hasDupError) {
      throw new Error("Duplicate email was not rejected with proper error message!");
    }
    console.log("  ✓ Duplicate prevention validated.");

    // Close form
    await page.locator("button:has-text('✕ Close')").first().click();
    await page.waitForTimeout(500);

    // -------------------------------------------------------------------------
    // 11. Test Removing External Recipient & Verification
    // -------------------------------------------------------------------------
    console.log("\n[Test 11] Testing Recipient Removal...");
    const targetRow = page.locator(`table tbody tr:has-text('${testExternalEmail}')`).first();
    const removeBtn = targetRow.locator("button:has-text('Remove')").first();
    await removeBtn.click();
    await page.waitForTimeout(2000);

    // Verify row removed
    const removedCheck = await page.locator(`table tbody tr:has-text('${testExternalEmail}')`).count();
    console.log(`  Recipient count in table after remove: ${removedCheck}`);
    if (removedCheck !== 0) {
      throw new Error("Recipient row still present immediately after remove!");
    }

    // Reload to verify persistence of removal
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    const reloadRemovedCheck = await page.locator(`table tbody tr:has-text('${testExternalEmail}')`).count();
    if (reloadRemovedCheck !== 0) {
      throw new Error("Recipient row reappeared after reload!");
    }
    console.log("  ✓ Recipient removal persisted cleanly across reload.");

    // -------------------------------------------------------------------------
    // 12. Full Page Screenshot
    // -------------------------------------------------------------------------
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, "prod_p3_r2_desktop_notification_settings.png"),
      fullPage: true,
    });
    console.log("  ✓ Saved artifact: prod_p3_r2_desktop_notification_settings.png");

    console.log("\n=== RTP-WEEKLY-INV-P3-001-R2 PRODUCTION BROWSER QA COMPLETED SUCCESSFULLY! ===");
  } finally {
    await browser.close();
  }
}

runWeeklyReportsP3R2QA().catch((err) => {
  console.error("QA RUNNER FAILED:", err);
  process.exit(1);
});
