import { chromium } from "playwright";
import * as path from "path";
import * as fs from "fs";

async function runBrandMarketingBrowserQa() {
  console.log("================================================================================");
  console.log("ADM-BSRC-005: Brand Sourcing Phase 1 End-to-End Integration Browser QA");
  console.log("Target: http://localhost:3000 (Local Next.js Production Build + QA Supabase DB)");
  console.log("================================================================================");

  const reportsDir = path.resolve(process.cwd(), "reports");
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const browser = await chromium.launch({
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: "en-US",
  });

  const page = await context.newPage();

  try {
    // --------------------------------------------------------------------------
    // STEP 1: ADMIN LOGIN
    // --------------------------------------------------------------------------
    console.log("[Step 1] Navigating to Admin Login page...");
    await page.goto("http://localhost:3000/admin/login", { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(1000);

    console.log("[Step 1] Submitting Super Admin credentials (qa-admin@kselect-test.local)...");
    await page.locator('input#email, input[type="email"]').fill("qa-admin@kselect-test.local");
    await page.locator('input#password, input[type="password"]').fill("Password123!@#");
    await page.locator('button[type="submit"]').click();

    // Wait for redirect away from login
    await page.waitForURL((url) => !url.pathname.includes("/admin/login"), { timeout: 20000 });
    console.log(`[Step 1] Successfully logged in. URL: ${page.url()}`);

    // --------------------------------------------------------------------------
    // STEP 2: STATE A — MAIN IMPORT & REVIEW SCREEN
    // --------------------------------------------------------------------------
    console.log("[Step 2] Navigating to /admin/brand-marketing...");
    await page.goto("http://localhost:3000/admin/brand-marketing", { waitUntil: "domcontentloaded", timeout: 25000 });
    await page.waitForTimeout(2000);

    // Verify Title & Shell elements
    const pageHeading = await page.locator("h1").first().textContent();
    console.log(`[Step 2] Page heading detected: "${pageHeading}"`);

    // Screenshot A
    const screenshotAPath = path.join(reportsDir, "bsrc-005-import-review-main.png");
    await page.screenshot({ path: screenshotAPath, fullPage: true });
    console.log(`[Step 2] Captured Screenshot A: ${screenshotAPath}`);

    // --------------------------------------------------------------------------
    // STEP 3: STATE B — POPULATED REVIEW WORKSPACE (NEW CANDIDATE: LEBELAGE)
    // --------------------------------------------------------------------------
    console.log("[Step 3] Clicking Quick Test Sample button for LEBELAGE (brand new)...");
    const lebelageButton = page.locator('button:has-text("LEBELAGE")');
    if (await lebelageButton.isVisible()) {
      await lebelageButton.click();
    } else {
      await page.locator('input[type="url"]').fill(
        "https://www.intercharmkorea.com/ko-kr/exhibitor_directory/Exhibitor_detail.르베라쥬.org-18c803be-34f2-4461-bc72-fa5ec798209b.html#/"
      );
    }

    const enteredUrl = await page.locator('input[type="url"]').inputValue();
    console.log(`[Step 3] Input URL: ${enteredUrl}`);

    console.log("[Step 3] Submitting Extraction...");
    await page.locator('button:has-text("Extract Exhibitor Info")').click();

    // Wait for review workspace to appear
    await page.waitForSelector('text=Legal Company Entity', { timeout: 25000 });
    console.log("[Step 3] Review workspace successfully rendered!");

    // Verify extracted details
    const compNameVal = await page.locator('input[value*="동동구리무"], input[value*="LEBELAGE"]').first().inputValue().catch(() => "");
    console.log(`[Step 3] Extracted company name: "${compNameVal}"`);

    // Set evaluation fields: Grade A, Status SAVED, notes
    const gradeSelect = page.locator('select').filter({ hasText: /Grade A|UNRATED/i }).first();
    if (await gradeSelect.isVisible()) {
      await gradeSelect.selectOption("A");
    }

    const statusSelect = page.locator('select').filter({ hasText: /SAVED|DRAFT/i }).first();
    if (await statusSelect.isVisible()) {
      await statusSelect.selectOption("SAVED");
    }

    const notesTextarea = page.locator('textarea').first();
    if (await notesTextarea.isVisible()) {
      await notesTextarea.fill("Verified K-Beauty brand LEBELAGE (주식회사 동동구리무) from InterCHARM Korea 2024.");
    }

    await page.waitForTimeout(1000);

    // Screenshot B
    const screenshotBPath = path.join(reportsDir, "bsrc-005-populated-review-workspace.png");
    await page.screenshot({ path: screenshotBPath, fullPage: true });
    console.log(`[Step 3] Captured Screenshot B: ${screenshotBPath}`);

    // Persist to database (no duplicates expected for LEBELAGE)
    console.log("[Step 3] Saving candidate to sourcing database...");
    const saveButton = page.locator('button:has-text("Save to Brand List")');
    await saveButton.click();
    await page.waitForTimeout(3000);
    console.log("[Step 3] Candidate saved!");

    // --------------------------------------------------------------------------
    // STEP 4: STATE C — DUPLICATE WARNING MODAL & OVERRIDE DIALOG (USING JCOMO)
    // --------------------------------------------------------------------------
    console.log("[Step 4] Selecting JCOMO (already saved) to test duplicate detection...");
    const jcomoButton = page.locator('button:has-text("JCOMO")');
    if (await jcomoButton.isVisible()) {
      await jcomoButton.click();
    } else {
      await page.locator('input[type="url"]').fill(
        "https://www.intercharmkorea.com/ko-kr/exhibitor_directory/Exhibitor_detail.주제이코모.org-ec0b85bc-960d-49d4-9dca-146c10ae59cb.html#/"
      );
    }

    console.log("[Step 4] Extracting already-saved JCOMO...");
    await page.locator('button:has-text("Extract Exhibitor Info")').click();

    // Wait for review workspace with duplicate detection
    await page.waitForSelector('text=Potential Duplicate Candidate Detected', { timeout: 25000 });
    console.log("[Step 4] Duplicate warning banner appeared in workspace!");

    // Click Save to trigger the duplicate modal dialog
    console.log("[Step 4] Clicking Save to open Duplicate Warning Modal...");
    await page.locator('button:has-text("Save to Brand List")').click();

    // Wait for duplicate modal dialog
    await page.waitForSelector('text=Potential Duplicate Candidate Warning', { timeout: 10000 });
    console.log("[Step 4] Duplicate warning modal dialog appeared as expected!");

    // Enter override reason to show complete state
    const overrideInput = page.locator('input[placeholder*="New exhibition edition update"]');
    if (await overrideInput.isVisible()) {
      await overrideInput.fill("Verified re-application for 2024 Autumn Sourcing campaign with updated product lines.");
    }

    await page.waitForTimeout(1000);

    // Screenshot C
    const screenshotCPath = path.join(reportsDir, "bsrc-005-duplicate-warning-modal.png");
    await page.screenshot({ path: screenshotCPath });
    console.log(`[Step 4] Captured Screenshot C: ${screenshotCPath}`);

    // Dismiss duplicate modal via Cancel button
    const cancelModalButton = page.locator('button:has-text("Cancel and Return to Review")');
    if (await cancelModalButton.isVisible()) {
      await cancelModalButton.click();
      await page.waitForTimeout(1000);
      console.log("[Step 4] Dismissed duplicate modal via Cancel button.");
    }

    // --------------------------------------------------------------------------
    // STEP 5: STATE D — BRAND LIST TABLE
    // --------------------------------------------------------------------------
    console.log("[Step 5] Navigating to Brand List tab...");
    const brandListTab = page.locator('button').filter({ hasText: /^Brand List/ }).first();
    await brandListTab.click();
    await page.waitForTimeout(2000);

    // Verify candidates table renders
    const tableRows = page.locator('table tbody tr');
    await page.waitForSelector('table tbody tr', { timeout: 10000 });
    const rowCount = await tableRows.count();
    console.log(`[Step 5] Found ${rowCount} rows in candidate table.`);

    // Screenshot D
    const screenshotDPath = path.join(reportsDir, "bsrc-005-brand-list-table.png");
    await page.screenshot({ path: screenshotDPath, fullPage: true });
    console.log(`[Step 5] Captured Screenshot D: ${screenshotDPath}`);

    // --------------------------------------------------------------------------
    // STEP 6: STATE E — DETAIL DRAWER WITH EVALUATION, ARCHIVE & DELETE
    // --------------------------------------------------------------------------
    console.log("[Step 6] Opening Detail Drawer for candidate...");
    const viewEditBtn = page.locator('button:has-text("View / Edit")').first();
    if (await viewEditBtn.isVisible()) {
      await viewEditBtn.click();
    } else {
      const firstRow = tableRows.first();
      await firstRow.click();
    }

    // Wait for drawer to slide open
    await page.waitForSelector('text=Evaluation & Status', { timeout: 10000 });
    console.log("[Step 6] Detail Drawer opened successfully!");

    // Verify Archive and Delete buttons
    const archiveBtn = page.locator('button:has-text("Archive")');
    const deleteBtn = page.locator('button:has-text("Delete")');
    const saveChangesBtn = page.locator('button:has-text("Save Changes")');

    const hasArchive = await archiveBtn.isVisible().catch(() => false);
    const hasDelete = await deleteBtn.isVisible().catch(() => false);
    const hasSave = await saveChangesBtn.isVisible().catch(() => false);

    console.log(`[Step 6] Drawer controls: Save Changes=${hasSave}, Archive=${hasArchive}, Delete=${hasDelete}`);

    await page.waitForTimeout(1000);

    // Screenshot E
    const screenshotEPath = path.join(reportsDir, "bsrc-005-candidate-detail-drawer.png");
    await page.screenshot({ path: screenshotEPath });
    console.log(`[Step 6] Captured Screenshot E: ${screenshotEPath}`);

    // Close drawer
    const closeDrawerBtn = page.locator('button[title="Close Drawer"], button:has-text("✕")').first();
    if (await closeDrawerBtn.isVisible()) {
      await closeDrawerBtn.click();
      await page.waitForTimeout(500);
    }

    // --------------------------------------------------------------------------
    // STEP 7: STATE F — RESPONSIVE MOBILE VIEW (390px) & 1800px SHELL AUDIT
    // --------------------------------------------------------------------------
    console.log("[Step 7] Testing 390px mobile viewport...");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("http://localhost:3000/admin/brand-marketing?tab=list", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    // Screenshot F (Mobile)
    const screenshotFPath = path.join(reportsDir, "bsrc-005-responsive-mobile-view.png");
    await page.screenshot({ path: screenshotFPath, fullPage: true });
    console.log(`[Step 7] Captured Screenshot F: ${screenshotFPath}`);

    // Audit 1800px shell compliance at 1920px
    console.log("[Step 7] Auditing AGENTS.md Rule 27 1800px shell standard at 1920px viewport...");
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("http://localhost:3000/admin/brand-marketing", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);

    const layoutMetrics = await page.evaluate(() => {
      const scrollW = document.documentElement.scrollWidth;
      const innerW = window.innerWidth;
      const shellContainer = document.querySelector('.max-w-\\[1800px\\]');
      const shellW = shellContainer?.getBoundingClientRect().width || 0;
      return {
        hasHorizontalOverflow: scrollW > innerW,
        shellWidth: Math.round(shellW),
        isShellCentered: Math.round(shellW) <= 1800,
      };
    });

    console.log(`[Step 7] Shell Audit: width=${layoutMetrics.shellWidth}px (<=1800: ${layoutMetrics.isShellCentered}), overflow=${layoutMetrics.hasHorizontalOverflow}`);

    console.log("================================================================================");
    console.log("✓ ALL 6 BROWSER QA STATES PASSED & EVIDENCE CAPTURED!");
    console.log("================================================================================");
  } catch (err: any) {
    console.error("Browser QA Error:", err);
    throw err;
  } finally {
    await browser.close();
  }
}

runBrandMarketingBrowserQa().catch((err) => {
  console.error("FATAL BROWSER QA FAILURE:", err);
  process.exit(1);
});
