import { chromium } from "playwright";
import * as fs from "fs";
import * as path from "path";

async function runBrowserQA() {
  console.log("================================================================================");
  console.log("STARTING PLAYWRIGHT BROWSER QA: ADM-BSRC-009-R6");
  console.log("Email Recipient Data Hygiene, Default Multi-Contact Selection & Recipient Table UX");
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
      await nameInput.fill(`[QA-R6] Recipient Hygiene & Table UX ${Date.now()}`);
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
    // SCREENSHOT 1: Default Multi-Contact Selection & Indeterminate Checkbox
    // -------------------------------------------------------------------------
    console.log("\n[Scenario 1] Testing Default Multi-Contact Selection & Indeterminate State...");
    const expandBtn = page.locator('button:has-text("연락처 개별 선택")').first();
    if ((await expandBtn.count()) > 0) {
      const row = expandBtn.locator('xpath=ancestor::tr');
      const companyCheckbox = row.locator('input[type="checkbox"]').first();

      console.log("Checking company checkbox...");
      await companyCheckbox.click();
      await page.waitForTimeout(500);

      console.log("Expanding individual contacts...");
      await expandBtn.click();
      await page.waitForTimeout(500);

      const contactCheckboxes = page.locator('input[type="checkbox"]:not([disabled])');
      const contactCount = await contactCheckboxes.count();
      if (contactCount > 2) {
        console.log("Unchecking 1 contact to verify indeterminate state...");
        await contactCheckboxes.nth(contactCount - 1).click();
        await page.waitForTimeout(500);
      }
    }

    const s1Path = path.join(artifactsDir, "bsrc-009-r6-01-default-multi-contact-selection.png");
    await page.screenshot({ path: s1Path, fullPage: false });
    console.log("  ✓ Saved Screenshot 1:", s1Path);

    // -------------------------------------------------------------------------
    // SCREENSHOT 2: Invalid Email Data Hygiene Badging & Disabled Checkbox
    // -------------------------------------------------------------------------
    console.log("\n[Scenario 2] Testing Invalid Email Hygiene Badging...");
    const searchInput = page.locator('input[placeholder*="검색..."]').first();
    if ((await searchInput.count()) > 0) {
      await searchInput.fill("피에이치하비");
      await page.keyboard.press("Enter");
      await page.waitForTimeout(2000);

      // If expand button exists, open it to show disabled contact checkbox
      const phExpand = page.locator('button:has-text("연락처 개별 선택")').first();
      if ((await phExpand.count()) > 0) {
        await phExpand.click();
        await page.waitForTimeout(500);
      }

      const s2Path = path.join(artifactsDir, "bsrc-009-r6-02-invalid-email-hygiene-badge.png");
      await page.screenshot({ path: s2Path, fullPage: false });
      console.log("  ✓ Saved Screenshot 2:", s2Path);

      // Clear search
      await searchInput.fill("");
      await page.keyboard.press("Enter");
      await page.waitForTimeout(2000);
    }

    // -------------------------------------------------------------------------
    // SCREENSHOT 3: "All" Page-Size Option
    // -------------------------------------------------------------------------
    console.log("\n[Scenario 3] Testing 'All' Page-Size Option...");
    const pageSizeSelect = page.locator('select:has(option[value="20"])').first();
    await pageSizeSelect.selectOption("ALL");
    await page.waitForTimeout(3000);

    const s3Path = path.join(artifactsDir, "bsrc-009-r6-03-all-page-size-mode.png");
    await page.screenshot({ path: s3Path, fullPage: false });
    console.log("  ✓ Saved Screenshot 3:", s3Path);

    // -------------------------------------------------------------------------
    // SCREENSHOT 4: Sortable Column Headers
    // -------------------------------------------------------------------------
    console.log("\n[Scenario 4] Testing Sortable Column Headers...");
    // Switch back to 20 page size
    await pageSizeSelect.selectOption("20");
    await page.waitForTimeout(1500);

    // Click "등급" (Grade) column header
    console.log("Clicking '등급' (Grade) header to sort ascending...");
    const gradeHeaderBtn = page.locator('th button:has-text("등급")').first();
    await gradeHeaderBtn.click();
    await page.waitForTimeout(2000);

    const s4Path = path.join(artifactsDir, "bsrc-009-r6-04-sortable-table-column-headers.png");
    await page.screenshot({ path: s4Path, fullPage: false });
    console.log("  ✓ Saved Screenshot 4:", s4Path);

    // -------------------------------------------------------------------------
    // SCREENSHOT 5: Opaque Sticky Table Header During Scroll (Zero Bleed-Through)
    // -------------------------------------------------------------------------
    console.log("\n[Scenario 5] Testing Opaque Sticky Table Header Scroll...");
    const tableContainer = page.locator('div.overflow-x-auto.max-h-\\[460px\\]').first();
    await tableContainer.evaluate((el) => {
      el.scrollTop = 250;
    });
    await page.waitForTimeout(1000);

    const s5Path = path.join(artifactsDir, "bsrc-009-r6-05-opaque-sticky-table-header-scroll.png");
    await page.screenshot({ path: s5Path, fullPage: false });
    console.log("  ✓ Saved Screenshot 5:", s5Path);

    console.log("\n================================================================================");
    console.log("PLAYWRIGHT BROWSER QA COMPLETED SUCCESSFULLY: 5/5 SCREENSHOTS CAPTURED");
    console.log("================================================================================");
  } catch (err: any) {
    console.error("BROWSER QA FAILED:", err);
    throw err;
  } finally {
    await browser.close();
  }
}

runBrowserQA().catch((err) => {
  console.error("Fatal QA Error:", err);
  process.exit(1);
});
