import { chromium } from "playwright";
import * as fs from "fs";
import * as path from "path";

async function runBrowserQA() {
  console.log("================================================================================");
  console.log("STARTING PLAYWRIGHT BROWSER QA: ADM-BSRC-009-R8");
  console.log("Recipient Selection Count Reconciliation & Manage Selected Recipients Modal UX");
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
      await nameInput.fill(`[QA-R8] Recipient Count & Modal UX ${Date.now()}`);
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
    // SCREENSHOT 1: Recipient Count Before Deselection
    // -------------------------------------------------------------------------
    console.log("\n[Scenario 1] Selecting visible candidates to establish initial baseline...");
    // Check Header Select All
    const selectAllCheckbox = page.locator('thead input[type="checkbox"]').first();
    if ((await selectAllCheckbox.count()) > 0) {
      await selectAllCheckbox.click();
      await page.waitForTimeout(1000);
    }

    const s1Path = path.join(artifactsDir, "bsrc-009-r8-01-recipient-count-before-deselection.png");
    await page.screenshot({ path: s1Path, fullPage: false });
    console.log("  ✓ Saved Screenshot 1:", s1Path);

    // -------------------------------------------------------------------------
    // SCREENSHOT 2: Recipient Count After Deselection
    // -------------------------------------------------------------------------
    console.log("\n[Scenario 2] Deselecting one selectable company row to verify immediate count update...");
    const rowCheckboxes = page.locator('tbody input[type="checkbox"]:not([disabled])');
    const rowCount = await rowCheckboxes.count();
    if (rowCount > 0) {
      console.log(`Unchecking first selectable row (total selectable rows: ${rowCount})...`);
      await rowCheckboxes.first().click();
      await page.waitForTimeout(1000);
    }

    const s2Path = path.join(artifactsDir, "bsrc-009-r8-02-recipient-count-after-deselection.png");
    await page.screenshot({ path: s2Path, fullPage: false });
    console.log("  ✓ Saved Screenshot 2:", s2Path);

    // -------------------------------------------------------------------------
    // SCREENSHOT 3: Expanded 1500px Modal & Readability
    // -------------------------------------------------------------------------
    console.log("\n[Scenario 3] Opening Manage Selected Recipients Modal (1500px max width)...");
    const manageModalBtn = page.locator('button:has-text("선택 목록 관리")').first();
    await manageModalBtn.click();
    await page.waitForTimeout(1500);

    const s3Path = path.join(artifactsDir, "bsrc-009-r8-03-expanded-1500px-modal-readability.png");
    await page.screenshot({ path: s3Path, fullPage: false });
    console.log("  ✓ Saved Screenshot 3:", s3Path);

    // -------------------------------------------------------------------------
    // SCREENSHOT 4: Opaque Sticky Table Header Scrolling (No Bleed-Through)
    // -------------------------------------------------------------------------
    console.log("\n[Scenario 4] Scrolling modal table vertically to verify opaque sticky header...");
    const modalTableContainer = page.locator('div:has(> table):has(thead.sticky)').first();
    if ((await modalTableContainer.count()) > 0) {
      await modalTableContainer.evaluate((el) => {
        el.scrollTop = 350;
      });
      await page.waitForTimeout(800);
    }

    const s4Path = path.join(artifactsDir, "bsrc-009-r8-04-opaque-sticky-table-header-scroll.png");
    await page.screenshot({ path: s4Path, fullPage: false });
    console.log("  ✓ Saved Screenshot 4:", s4Path);

    // -------------------------------------------------------------------------
    // SCREENSHOT 5: Modal Column Sorting (Interactive 3-state sort)
    // -------------------------------------------------------------------------
    console.log("\n[Scenario 5] Clicking modal column header '기업명 / 브랜드' to sort ascending...");
    const companyHeader = page.locator('th:has-text("기업명 / 브랜드")').first();
    await companyHeader.click();
    await page.waitForTimeout(800);

    const s5Path = path.join(artifactsDir, "bsrc-009-r8-05-modal-sorting-states.png");
    await page.screenshot({ path: s5Path, fullPage: false });
    console.log("  ✓ Saved Screenshot 5:", s5Path);

    console.log("\n================================================================================");
    console.log("PLAYWRIGHT BROWSER QA COMPLETED SUCCESSFULLY: 5 / 5 SCREENSHOTS CAPTURED");
    console.log("================================================================================\n");
  } catch (err: any) {
    console.error("[PLAYWRIGHT QA ERROR]", err);
    throw err;
  } finally {
    await browser.close();
  }
}

runBrowserQA().catch((err) => {
  console.error("Browser QA failed:", err);
  process.exit(1);
});
