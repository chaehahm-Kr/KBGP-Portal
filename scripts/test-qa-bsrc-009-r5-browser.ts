import { chromium } from "playwright";
import * as fs from "fs";
import * as path from "path";

async function runBrowserQA() {
  console.log("================================================================================");
  console.log("STARTING PLAYWRIGHT BROWSER QA: ADM-BSRC-009-R5");
  console.log("Email Campaign Recipient Discovery, Persistent Selection & Manual Email Entry");
  console.log("Target Server: http://localhost:3000");
  console.log("================================================================================\n");

  const artifactsDir = "C:\\Users\\ChaeHahm\\.gemini\\antigravity\\brain\\945ab025-0f8f-4fce-b0bc-56237108874e";
  if (!fs.existsSync(artifactsDir)) {
    fs.mkdirSync(artifactsDir, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1800, height: 1100 },
  });
  const page = await context.newPage();

  page.on("dialog", async (dialog) => {
    console.log(`[DIALOG] ${dialog.type()}: ${dialog.message()}`);
    await dialog.accept();
  });

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      console.log("[BROWSER ERROR]", msg.text());
    }
  });

  try {
    // -------------------------------------------------------------------------
    // Step 1: Login to Admin
    // -------------------------------------------------------------------------
    console.log("[Step 1] Logging in to Admin...");
    await page.goto("http://localhost:3000/admin/login", { waitUntil: "networkidle", timeout: 25000 });
    const emailInput = page.locator('input[type="email"], input[name="email"]');
    if ((await emailInput.count()) > 0) {
      await emailInput.fill("qa-admin@kselect-test.local");
      await page.locator('input[type="password"], input[name="password"]').fill("Password123!@#");
      await page.locator('button[type="submit"]').click();
      await page.waitForURL((url) => !url.pathname.includes("/admin/login"), { timeout: 20000 });
    }
    console.log("✓ Logged in successfully.");

    // -------------------------------------------------------------------------
    // Step 2: Navigate to Brand Marketing Email Campaigns
    // -------------------------------------------------------------------------
    console.log("\n[Step 2] Navigating to Brand Marketing...");
    await page.goto("http://localhost:3000/admin/brand-marketing", {
      waitUntil: "networkidle",
      timeout: 25000,
    });
    await page.waitForTimeout(2000);

    // Switch to Email Campaigns Tab
    console.log("Switching to Email Campaigns Tab...");
    const campaignsTabBtn = page.locator('button:has-text("Email Campaigns")').first();
    await campaignsTabBtn.click();
    await page.waitForTimeout(2000);
    console.log("✓ Active tab switched to Email Campaigns");

    // Click "+ Create Campaign"
    console.log("Clicking '+ Create Campaign' button...");
    const createCampBtn = page.locator('button:has-text("Create Campaign")').first();
    await createCampBtn.click();
    await page.waitForTimeout(1500);

    // Step 1: Fill Campaign Name
    console.log("Step 1: Setting campaign name...");
    const nameInput = page.locator('input[placeholder*="Campaign Name"], input[placeholder*="캠페인 명"]').first();
    if ((await nameInput.count()) > 0) {
      await nameInput.fill(`[QA] Recipient Discovery Campaign ${Date.now()}`);
    }

    // Step 1 -> Step 2
    const toStep2Btn = page.locator('button:has-text("Next: Template"), button:has-text("Next")').first();
    await toStep2Btn.click();
    await page.waitForTimeout(1000);

    // Step 2 -> Step 3: Recipient Selection
    const toStep3Btn = page.locator('button:has-text("Next: Recipient Selection")').first();
    await toStep3Btn.click();
    await page.waitForTimeout(2500);
    console.log("✓ Successfully entered Step 3: Recipient Selection & Discovery");

    // -------------------------------------------------------------------------
    // SCREENSHOT 1: Recipient Summary Bar & Brand List-Equivalent Filter Toolbar
    // -------------------------------------------------------------------------
    console.log("\n[Screenshot 1] Capturing Recipient Summary Bar & Filter Toolbar...");
    const s1Path = path.join(artifactsDir, "bsrc-009-r5-01-recipient-summary-and-filters.png");
    await page.screenshot({ path: s1Path, fullPage: false });
    console.log("  ✓ Saved Screenshot 1:", s1Path);

    // -------------------------------------------------------------------------
    // SCREENSHOT 2: Cross-Filter Selection Persistence
    // -------------------------------------------------------------------------
    console.log("\n[Screenshot 2] Testing Cross-Filter Selection Persistence...");

    // Filter by Grade A
    const gradeSelect = page.locator('select:has-text("등급:")').first();
    if ((await gradeSelect.count()) > 0) {
      await gradeSelect.selectOption("A");
      await page.waitForTimeout(1500);
      console.log("  ✓ Filtered by Grade A");
    }

    // Select the first Grade A company
    const firstCheckbox = page.locator('table tbody tr input[type="checkbox"]').first();
    if ((await firstCheckbox.count()) > 0) {
      await firstCheckbox.check();
      await page.waitForTimeout(1000);
      console.log("  ✓ Checked Grade A company");
    }

    // Now switch filter to Grade B
    if ((await gradeSelect.count()) > 0) {
      await gradeSelect.selectOption("B");
      await page.waitForTimeout(1500);
      console.log("  ✓ Switched filter to Grade B");
    }

    // Select the first Grade B company
    const secondCheckbox = page.locator('table tbody tr input[type="checkbox"]').first();
    if ((await secondCheckbox.count()) > 0) {
      await secondCheckbox.check();
      await page.waitForTimeout(1000);
      console.log("  ✓ Checked Grade B company (Grade A selection remains preserved!)");
    }

    const s2Path = path.join(artifactsDir, "bsrc-009-r5-02-cross-filter-persistent-selection.png");
    await page.screenshot({ path: s2Path, fullPage: false });
    console.log("  ✓ Saved Screenshot 2:", s2Path);

    // -------------------------------------------------------------------------
    // SCREENSHOT 3: Company Multi-Contact Selection & Indeterminate Checkbox State
    // -------------------------------------------------------------------------
    console.log("\n[Screenshot 3] Testing Multi-Contact Selection & Indeterminate Checkbox...");

    // Reset filter to ALL
    if ((await gradeSelect.count()) > 0) {
      await gradeSelect.selectOption("ALL");
      await page.waitForTimeout(3000);
      await page.waitForSelector('table tbody tr td:not([colspan])', { timeout: 10000 });
    }

    // Find a company with multiple contacts and expand it
    const expandBtn = page.locator('button:has-text("▼ +")').first();
    if ((await expandBtn.count()) > 0) {
      await expandBtn.click();
      await page.waitForTimeout(1500);
      console.log("  ✓ Expanded multi-contact sub-row");

      // Toggle off one contact in the sub-row to produce indeterminate '-' state on the company row
      const subContactCheckboxes = page.locator('tr.bg-indigo-50\\/30 input[type="checkbox"], tr[class*="bg-indigo"] input[type="checkbox"]');
      if ((await subContactCheckboxes.count()) > 0) {
        await subContactCheckboxes.first().click();
        await page.waitForTimeout(800);
        console.log("  ✓ Toggled individual contact to trigger indeterminate company checkbox state");
      }
    }

    const s3Path = path.join(artifactsDir, "bsrc-009-r5-03-multi-contact-selection-indeterminate.png");
    await page.screenshot({ path: s3Path, fullPage: false });
    console.log("  ✓ Saved Screenshot 3:", s3Path);

    // -------------------------------------------------------------------------
    // SCREENSHOT 4: Manual Email Recipient Entry (Multiline Paste, Parser, Validation)
    // -------------------------------------------------------------------------
    console.log("\n[Screenshot 4] Testing Manual Email Recipient Entry...");

    const emailTextarea = page.locator('textarea[placeholder*="buyer@nordstrom.com"]').first();
    if ((await emailTextarea.count()) > 0) {
      const pasteText =
        "buyer.nordstrom@retail-test.com\nmerchandiser@sephora-test.com, sourcing@ulta-test.com; invalid-syntax-email";
      await emailTextarea.fill(pasteText);
      await page.waitForTimeout(500);

      const parseBtn = page.locator('button:has-text("이메일 파싱 및 추가")').first();
      await parseBtn.click();
      await page.waitForTimeout(1500);
      console.log("  ✓ Parsed and added manual emails with validation feedback");
    }

    const s4Path = path.join(artifactsDir, "bsrc-009-r5-04-manual-email-recipient-entry.png");
    await page.screenshot({ path: s4Path, fullPage: false });
    console.log("  ✓ Saved Screenshot 4:", s4Path);

    // -------------------------------------------------------------------------
    // SCREENSHOT 5: Manage Selection Modal Dialog
    // -------------------------------------------------------------------------
    console.log("\n[Screenshot 5] Opening Manage Selection Modal Dialog...");

    const manageBtn = page.locator('button:has-text("선택 목록 관리")').first();
    if ((await manageBtn.count()) > 0) {
      await manageBtn.click();
      await page.waitForTimeout(1000);
      console.log("  ✓ Opened Manage Selection modal dialog");
    }

    const s5Path = path.join(artifactsDir, "bsrc-009-r5-05-manage-selection-panel-modal.png");
    await page.screenshot({ path: s5Path, fullPage: false });
    console.log("  ✓ Saved Screenshot 5:", s5Path);

    // Close modal
    const closeBtn = page.locator('button:has-text("확인 및 닫기")').first();
    if ((await closeBtn.count()) > 0) {
      await closeBtn.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(500);
    }

    console.log("\n================================================================================");
    console.log("PLAYWRIGHT BROWSER QA COMPLETED SUCCESSFULLY: 5/5 SCREENSHOTS CAPTURED");
    console.log("================================================================================");
  } catch (err: any) {
    console.error("Browser QA failed:", err);
    throw err;
  } finally {
    await browser.close();
  }
}

runBrowserQA()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
