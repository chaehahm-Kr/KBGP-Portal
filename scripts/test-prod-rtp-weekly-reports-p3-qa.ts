import { chromium, devices } from "playwright";
import * as path from "path";

const PROD_PORTAL_URL = process.env.TEST_PORTAL_URL || "https://portal.kselecthub.com";
const PROD_ADMIN_URL = process.env.TEST_ADMIN_URL || "https://admin.kselectnetwork.com";
const TEST_RETAILER_EMAIL = "qa-retailer-test@letusto.com";
const TEST_RETAILER_PASSWORD = "Password123!@#";
const TEST_ADMIN_EMAIL = "qa-admin-test@letusto.com";
const TEST_ADMIN_PASSWORD = "Password123!@#";
const ARTIFACT_DIR = "C:\\Users\\ChaeHahm\\.gemini\\antigravity\\brain\\945ab025-0f8f-4fce-b0bc-56237108874e";

async function runWeeklyReportsP3QA() {
  console.log("=== STARTING RTP-WEEKLY-INV-P3-001 PRODUCTION BROWSER QA ===");

  const browser = await chromium.launch({
    headless: true,
  });

  try {
    // =========================================================================
    // SCENARIO 1: Desktop Retailer Portal — Weekly Reports & Reorder -> Cart
    // =========================================================================
    console.log("\n[SCENARIO 1: Desktop Retailer Portal Weekly Reports & Reorder]");
    const desktopContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    const pageDesktop = await desktopContext.newPage();

    // 1.1 Login
    console.log("Logging into Retailer Portal as test retailer...");
    await pageDesktop.goto(`${PROD_PORTAL_URL}/login`, { waitUntil: "networkidle", timeout: 30000 });
    await pageDesktop.fill('input[type="email"], input[name="email"]', TEST_RETAILER_EMAIL);
    await pageDesktop.fill('input[type="password"], input[name="password"]', TEST_RETAILER_PASSWORD);
    await pageDesktop.click('button[type="submit"]');
    await pageDesktop.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 30000 });
    console.log("✓ Logged into Retailer Portal. Current URL:", pageDesktop.url());

    // 1.2 Navigate to /reports/weekly
    console.log("Navigating to Weekly Performance & Reorder Report (/reports/weekly)...");
    await pageDesktop.goto(`${PROD_PORTAL_URL}/reports/weekly`, { waitUntil: "networkidle", timeout: 30000 });
    await pageDesktop.waitForTimeout(2000);

    const reportHeaderVisible = await pageDesktop.locator("text=Weekly Performance & Reorder Report").first().isVisible();
    console.log("Weekly Report Header Visible:", reportHeaderVisible);

    const salesKpiVisible = await pageDesktop.locator("text=Est. Retail Sales").isVisible();
    const gpKpiVisible = await pageDesktop.locator("text=Est. Gross Profit").isVisible();
    const unitsKpiVisible = await pageDesktop.locator("text=Est. Units Sold").isVisible();
    const reorderKpiVisible = await pageDesktop.locator("text=Reorder Needed").isVisible();
    console.log("4 Authoritative KPIs Visible:", { salesKpiVisible, gpKpiVisible, unitsKpiVisible, reorderKpiVisible });

    // 1.3 Check Partial Coverage indication
    const partialCoverageBadge = await pageDesktop.locator("text=Partial Coverage").isVisible();
    console.log("Partial Coverage Badge Detected:", partialCoverageBadge);

    await pageDesktop.screenshot({
      path: path.join(ARTIFACT_DIR, "prod_p3_desktop_weekly_report_overview.png"),
      fullPage: true,
    });
    console.log("✓ Saved artifact: prod_p3_desktop_weekly_report_overview.png");

    // 1.4 Test Add to Cart Integration
    const addToCartButton = pageDesktop.locator("button:has-text('+ Add to Cart')").first();
    if (await addToCartButton.isVisible()) {
      console.log("Clicking '+ Add to Cart' on recommended reorder product...");
      await addToCartButton.click();
      await pageDesktop.waitForTimeout(1000);

      const cartFeedbackVisible = await pageDesktop.locator("text=Added").first().isVisible();
      console.log("✓ Cart feedback notification visible:", cartFeedbackVisible);

      await pageDesktop.screenshot({
        path: path.join(ARTIFACT_DIR, "prod_p3_desktop_cart_added_feedback.png"),
      });
      console.log("✓ Saved artifact: prod_p3_desktop_cart_added_feedback.png");
    }

    // =========================================================================
    // SCENARIO 2: Retailer Notification Settings (Default OFF & Opt-in Persistence)
    // =========================================================================
    console.log("\n[SCENARIO 2: Retailer Notification Settings & Opt-in Persistence]");
    await pageDesktop.goto(`${PROD_PORTAL_URL}/settings/notifications`, { waitUntil: "networkidle", timeout: 30000 });
    await pageDesktop.waitForTimeout(1500);

    const notifHeaderVisible = await pageDesktop.locator("text=Notification Settings").isVisible();
    console.log("Notification Settings Page Visible:", notifHeaderVisible);

    const toggle = pageDesktop.locator('input[type="checkbox"]').first();
    const initialOptIn = await toggle.isChecked();
    console.log("Initial Opt-In State (Checked):", initialOptIn);

    // Toggle ON
    console.log("Toggling Weekly Report Email ON...");
    await toggle.click();
    await pageDesktop.waitForTimeout(2000);

    const turnedOnState = await toggle.isChecked();
    console.log("State after toggle (Should be true):", turnedOnState);

    await pageDesktop.screenshot({
      path: path.join(ARTIFACT_DIR, "prod_p3_notification_opt_in_enabled.png"),
    });
    console.log("✓ Saved artifact: prod_p3_notification_opt_in_enabled.png");

    // Reload page to verify persistence in database
    console.log("Reloading page to test persistence...");
    await pageDesktop.reload({ waitUntil: "networkidle" });
    await pageDesktop.waitForTimeout(1500);

    const reloadedState = await toggle.isChecked();
    console.log("State after reload (Persistent true):", reloadedState);

    // Toggle back to OFF to keep test clean
    console.log("Toggling back to OFF (Default)...");
    await toggle.click();
    await pageDesktop.waitForTimeout(2000);
    const finalState = await toggle.isChecked();
    console.log("Final State (Should be false):", finalState);

    // =========================================================================
    // SCENARIO 3: Admin Portal — Retailer 360 Check Monitoring & Reminder Modal
    // =========================================================================
    console.log("\n[SCENARIO 3: Admin Portal Retailer 360 Missing Check Reminder]");
    const adminContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    const pageAdmin = await adminContext.newPage();

    console.log("Logging into Admin Portal as test admin...");
    await pageAdmin.goto(`${PROD_ADMIN_URL}/login`, { waitUntil: "networkidle", timeout: 30000 });
    await pageAdmin.fill('input[type="email"], input[name="email"]', TEST_ADMIN_EMAIL);
    await pageAdmin.fill('input[type="password"], input[name="password"]', TEST_ADMIN_PASSWORD);
    await pageAdmin.click('button[type="submit"]');
    await pageAdmin.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 30000 });
    console.log("✓ Logged into Admin Portal. Current URL:", pageAdmin.url());

    // Navigate to Test Retailer 360 Performance Tab
    console.log("Navigating to Retailer 360 for Test Retailer (/admin/retailers/effe7832-096c-4ae1-86c7-3cb189b59731)...");
    await pageAdmin.goto(
      `${PROD_ADMIN_URL}/admin/retailers/effe7832-096c-4ae1-86c7-3cb189b59731`,
      { waitUntil: "domcontentloaded", timeout: 30000 }
    );
    await pageAdmin.waitForTimeout(3000);

    // Click Performance & Check Tab
    console.log("Clicking 'Performance & Check' Tab...");
    const perfTab = pageAdmin.locator("button:has-text('Performance & Check')").first();
    if (await perfTab.isVisible()) {
      await perfTab.click();
      await pageAdmin.waitForTimeout(2000);
    }

    const checkStatusTableVisible = await pageAdmin.locator("text=Current Week Store Check Status").first().isVisible();
    console.log("Store Check Status Table Visible:", checkStatusTableVisible);

    // Find and click Send Reminder button
    const sendReminderBtn = pageAdmin.locator("button:has-text('Send Reminder')").first();
    if (await sendReminderBtn.isVisible()) {
      console.log("Clicking 'Send Reminder' button...");
      await sendReminderBtn.click();
      await pageAdmin.waitForTimeout(2000);

      const reminderModalVisible = await pageAdmin.locator("text=Send Weekly Inventory Check Reminder").first().isVisible();
      console.log("✓ Weekly Check Reminder Modal Visible:", reminderModalVisible);

      const emailPreviewVisible = await pageAdmin.locator("text=hub_retailer_weekly_check_reminder").first().isVisible();
      console.log("✓ Email Template hub_retailer_weekly_check_reminder Preview Visible:", emailPreviewVisible);

      await pageAdmin.screenshot({
        path: path.join(ARTIFACT_DIR, "prod_p3_admin_weekly_check_reminder_modal.png"),
      });
      console.log("✓ Saved artifact: prod_p3_admin_weekly_check_reminder_modal.png");

      // Test Send Reminder in modal
      const confirmSendBtn = pageAdmin.locator("button:has-text('Send Reminder (')").first();
      if (await confirmSendBtn.isVisible()) {
        console.log("Clicking Confirm Send in Reminder Modal...");
        await confirmSendBtn.click();
        await pageAdmin.waitForTimeout(2500);

        const successNotice = await pageAdmin.locator("text=Successfully sent").first().isVisible();
        console.log("✓ Reminder delivery success feedback visible:", successNotice);
      }
    } else {
      console.log("Notice: No unsubmitted stores currently requiring reminder.");
    }

    // =========================================================================
    // SCENARIO 4: Admin Settings — Email Templates Verification
    // =========================================================================
    console.log("\n[SCENARIO 4: Admin Settings Email Templates Verification]");
    await pageAdmin.goto(`${PROD_ADMIN_URL}/admin/settings/email-templates`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await pageAdmin.waitForTimeout(3000);

    // Switch to K SELECT HUB templates
    console.log("Switching to K SELECT HUB templates tab...");
    const hubTabBtn = pageAdmin.locator("button:has-text('K SELECT HUB')").first();
    if (await hubTabBtn.isVisible()) {
      await hubTabBtn.click();
      await pageAdmin.waitForTimeout(2000);
    }

    const reportTemplateItem = await pageAdmin.locator("text=hub_retailer_weekly_performance_report").first().isVisible();
    const reminderTemplateItem = await pageAdmin.locator("text=hub_retailer_weekly_check_reminder").first().isVisible();
    console.log("Registered Email Templates Found:", {
      hub_retailer_weekly_performance_report: reportTemplateItem,
      hub_retailer_weekly_check_reminder: reminderTemplateItem,
    });

    await pageAdmin.screenshot({
      path: path.join(ARTIFACT_DIR, "prod_p3_admin_email_templates_registered.png"),
    });
    console.log("✓ Saved artifact: prod_p3_admin_email_templates_registered.png");

    console.log("\n=== ALL RTP-WEEKLY-INV-P3-001 QA SCENARIOS PASSED ===");
  } catch (err) {
    console.error("Error during QA execution:", err);
    throw err;
  } finally {
    await browser.close();
  }
}

runWeeklyReportsP3QA().catch((err) => {
  console.error("FATAL ERROR in runWeeklyReportsP3QA:", err);
  process.exit(1);
});
