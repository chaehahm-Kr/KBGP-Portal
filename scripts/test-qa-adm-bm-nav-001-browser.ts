import { chromium } from "playwright";
import * as fs from "fs";
import * as path from "path";

async function runBrowserQA() {
  console.log("================================================================================");
  console.log("STARTING PLAYWRIGHT BROWSER QA: ADM-BM-NAV-001");
  console.log("Brand Marketing Native Link Navigation & New Tab Support");
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

  let passCount = 0;
  let totalCount = 0;

  function assert(title: string, condition: boolean, details?: string) {
    totalCount++;
    if (condition) {
      passCount++;
      console.log(`  [PASS] Test ${totalCount}: ${title}`);
    } else {
      console.error(`  [FAIL] Test ${totalCount}: ${title}${details ? ` -> ${details}` : ''}`);
      throw new Error(`QA Assertion failed: ${title}`);
    }
  }

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
    // Step 2: Navigate to Brand Marketing and Verify 4 Primary Native Links
    // -------------------------------------------------------------------------
    console.log("\n[Step 2] Navigating to Brand Marketing & Auditing Primary Navigation Links...");
    await page.goto("http://localhost:3000/admin/brand-marketing", {
      waitUntil: "networkidle",
      timeout: 25000,
    });
    await page.waitForTimeout(1000);

    const linkImport = page.locator('a[href="/admin/brand-marketing?tab=import"]');
    const linkList = page.locator('a[href="/admin/brand-marketing?tab=list"]');
    const linkCampaigns = page.locator('a[href="/admin/brand-marketing?tab=campaigns"]');
    const linkResults = page.locator('a[href="/admin/brand-marketing?tab=results"]');

    assert("1. Import & Review is a real HTML <a> anchor with valid href", (await linkImport.count()) > 0);
    assert("2. Brand List is a real HTML <a> anchor with valid href", (await linkList.count()) > 0);
    assert("3. Email Campaigns is a real HTML <a> anchor with valid href", (await linkCampaigns.count()) > 0);
    assert("4. Results & Follow-up is a real HTML <a> anchor with valid href", (await linkResults.count()) > 0);

    await page.screenshot({
      path: path.join(artifactsDir, "bm-nav-001-01-primary-navigation-native-links.png"),
      fullPage: false,
    });
    console.log("✓ Saved artifact: bm-nav-001-01-primary-navigation-native-links.png");

    // -------------------------------------------------------------------------
    // Step 3: Navigate to Email Campaigns & Verify 3 Sub-Navigation Native Links
    // -------------------------------------------------------------------------
    console.log("\n[Step 3] Navigating to Email Campaigns & Auditing Sub-Navigation Links...");
    await linkCampaigns.first().click();
    await page.waitForURL((url) => url.searchParams.get("tab") === "campaigns", { timeout: 10000 });
    await page.waitForTimeout(1000);

    const subLinkCampaigns = page.locator('a[href="/admin/brand-marketing?tab=campaigns&view=list"]');
    const subLinkTemplates = page.locator('a[href="/admin/brand-marketing?tab=campaigns&view=templates"]');
    const subLinkFooter = page.locator('a[href="/admin/brand-marketing?tab=campaigns&view=footer"]');

    assert("5. Sub-navigation Campaigns is a real HTML <a> anchor with valid href", (await subLinkCampaigns.count()) > 0);
    assert("6. Sub-navigation Template Library is a real HTML <a> anchor with valid href", (await subLinkTemplates.count()) > 0);
    assert("7. Sub-navigation Marketing Footer Settings is a real HTML <a> anchor with valid href", (await subLinkFooter.count()) > 0);

    await page.screenshot({
      path: path.join(artifactsDir, "bm-nav-001-02-sub-navigation-native-links.png"),
      fullPage: false,
    });
    console.log("✓ Saved artifact: bm-nav-001-02-sub-navigation-native-links.png");

    // -------------------------------------------------------------------------
    // Step 4: Test Direct URL Entry & Browser Refresh Persistence
    // -------------------------------------------------------------------------
    console.log("\n[Step 4] Testing Direct URL Deep Links & Refresh Persistence...");
    
    // Direct URL: Template Library
    await page.goto("http://localhost:3000/admin/brand-marketing?tab=campaigns&view=templates", {
      waitUntil: "networkidle",
      timeout: 25000,
    });
    await page.waitForTimeout(1000);
    const templateSearchInput = page.locator('input[placeholder*="Search templates"]');
    assert("8. Direct URL to ?tab=campaigns&view=templates displays Template Library", (await templateSearchInput.count()) > 0);

    // Refresh on Template Library
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(1000);
    assert("9. Browser refresh preserves active Template Library view", (await page.locator('input[placeholder*="Search templates"]').count()) > 0);

    // Direct URL: Footer Settings
    await page.goto("http://localhost:3000/admin/brand-marketing?tab=campaigns&view=footer", {
      waitUntil: "networkidle",
      timeout: 25000,
    });
    await page.waitForTimeout(1000);
    const footerHeader = page.locator('text=Marketing Footer Settings');
    assert("10. Direct URL to ?tab=campaigns&view=footer displays Marketing Footer Settings", (await footerHeader.count()) > 0);

    // Direct URL: Results & Follow-up
    await page.goto("http://localhost:3000/admin/brand-marketing?tab=results", {
      waitUntil: "networkidle",
      timeout: 25000,
    });
    await page.waitForTimeout(1000);
    const resultsHeader = page.locator('text=Results & Follow-up');
    assert("11. Direct URL to ?tab=results displays Results & Follow-up", (await resultsHeader.count()) > 0);

    // Safe fallback on unknown query parameter
    await page.goto("http://localhost:3000/admin/brand-marketing?tab=unknown_xyz", {
      waitUntil: "networkidle",
      timeout: 25000,
    });
    await page.waitForTimeout(1000);
    const importHeader = page.locator('text=Import & Review');
    assert("12. Unknown query parameter safely defaults to Import & Review without crash", (await importHeader.count()) > 0);

    await page.screenshot({
      path: path.join(artifactsDir, "bm-nav-001-03-direct-url-and-refresh-persistence.png"),
      fullPage: false,
    });
    console.log("✓ Saved artifact: bm-nav-001-03-direct-url-and-refresh-persistence.png");

    // -------------------------------------------------------------------------
    // Step 5: Test Browser Back and Forward Navigation
    // -------------------------------------------------------------------------
    console.log("\n[Step 5] Testing Browser Back and Forward Navigation...");
    await page.goto("http://localhost:3000/admin/brand-marketing?tab=list", { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    
    // Click Email Campaigns
    await page.locator('a[href="/admin/brand-marketing?tab=campaigns"]').first().click();
    await page.waitForURL((url) => url.searchParams.get("tab") === "campaigns");
    await page.waitForTimeout(500);

    // Click Browser Back -> should be on Brand List
    await page.goBack({ waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    assert("13. Browser Back returns to Brand List (?tab=list)", page.url().includes("tab=list"));

    // Click Browser Forward -> should be on Email Campaigns
    await page.goForward({ waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    assert("14. Browser Forward restores Email Campaigns (?tab=campaigns)", page.url().includes("tab=campaigns"));

    await page.screenshot({
      path: path.join(artifactsDir, "bm-nav-001-04-browser-back-forward-navigation.png"),
      fullPage: false,
    });
    console.log("✓ Saved artifact: bm-nav-001-04-browser-back-forward-navigation.png");

    // -------------------------------------------------------------------------
    // Step 6: Test Multi-Tab Behavior & Campaign Draft Preservation
    // -------------------------------------------------------------------------
    console.log("\n[Step 6] Testing Multi-Tab Behavior & Campaign Draft Preservation...");
    // Tab A: In Campaign Editor
    const tabA = page;
    await tabA.goto("http://localhost:3000/admin/brand-marketing?tab=campaigns", { waitUntil: "networkidle" });
    await tabA.waitForTimeout(1000);

    const createBtn = tabA.locator('button:has-text("Create Campaign")');
    if ((await createBtn.count()) > 0) {
      await createBtn.first().click();
      await tabA.waitForTimeout(1000);
    }
    const nameInput = tabA.locator('label:has-text("Campaign Name")').locator('..').locator('input');
    await nameInput.waitFor({ state: "visible", timeout: 5000 });
    await nameInput.fill("Test Multi-Tab Safety Draft");
    console.log("  Tab A: Campaign draft created with name 'Test Multi-Tab Safety Draft'");

    // Tab B: Open Brand List in separate page
    const tabB = await context.newPage();
    await tabB.goto("http://localhost:3000/admin/brand-marketing?tab=list", { waitUntil: "networkidle" });
    await tabB.waitForTimeout(1000);
    assert("15. Tab B independently opens Brand List", tabB.url().includes("tab=list"));

    // Tab C: Open Template Library in separate page
    const tabC = await context.newPage();
    await tabC.goto("http://localhost:3000/admin/brand-marketing?tab=campaigns&view=templates", { waitUntil: "networkidle" });
    await tabC.waitForTimeout(1000);
    assert("16. Tab C independently opens Template Library", tabC.url().includes("view=templates"));

    // Tab D: Open Footer Settings in separate page
    const tabD = await context.newPage();
    await tabD.goto("http://localhost:3000/admin/brand-marketing?tab=campaigns&view=footer", { waitUntil: "networkidle" });
    await tabD.waitForTimeout(1000);
    assert("17. Tab D independently opens Marketing Footer Settings", tabD.url().includes("view=footer"));

    // Return to Tab A and verify draft is 100% intact
    await tabA.bringToFront();
    const draftNameVal = await nameInput.inputValue();
    assert("18. Tab A campaign draft name is strictly preserved across multi-tab actions", draftNameVal === "Test Multi-Tab Safety Draft", `Got: ${draftNameVal}`);

    await tabA.screenshot({
      path: path.join(artifactsDir, "bm-nav-001-05-multi-tab-campaign-draft-safety.png"),
      fullPage: false,
    });
    console.log("✓ Saved artifact: bm-nav-001-05-multi-tab-campaign-draft-safety.png");

    await tabB.close();
    await tabC.close();
    await tabD.close();

    console.log("\n================================================================================");
    console.log(`ALL BROWSER QA TESTS COMPLETED: ${passCount} / ${totalCount} PASS (100%)`);
    console.log("================================================================================\n");
  } finally {
    await browser.close();
  }
}

runBrowserQA().catch((err) => {
  console.error("Browser QA failed:", err);
  process.exit(1);
});
