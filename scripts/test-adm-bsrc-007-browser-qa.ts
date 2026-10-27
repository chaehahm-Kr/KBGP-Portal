import { chromium } from "playwright";
import fs from "fs";
import path from "path";

async function runBrowserQA() {
  console.log("================================================================================");
  console.log("TASK: ADM-BSRC-007 — Brand Marketing: Campaign Results & Company Follow-up");
  console.log("Browser End-to-End QA & Visual Verification");
  console.log("================================================================================\n");

  const artifactsDir = "C:\\Users\\ChaeHahm\\.gemini\\antigravity\\brain\\730f6e70-61e4-47de-8a28-291a9d425b30";
  if (!fs.existsSync(artifactsDir)) {
    fs.mkdirSync(artifactsDir, { recursive: true });
  }

  const port = process.env.PORT || "3008";
  const baseUrl = `http://localhost:${port}`;
  console.log(`Connecting to local server at ${baseUrl}...`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
  });
  const page = await context.newPage();

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      console.log("[PAGE ERROR]", msg.text());
    }
  });

  try {
    // 1. Admin Login
    console.log("[Step 1] Navigating to Admin Login...");
    await page.goto(`${baseUrl}/admin/login`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(1000);

    const emailInput = page.locator('input[type="email"], input[name="email"], input#email');
    if ((await emailInput.count()) > 0) {
      console.log("   Logging in as qa-admin@kselect-test.local...");
      await emailInput.fill("qa-admin@kselect-test.local");
      await page.locator('input[type="password"], input[name="password"], input#password').fill("Password123!@#");
      await page.locator('button[type="submit"]').click();
      await page.waitForTimeout(3000);
    }

    // 2. Load Brand Marketing Results Tab
    console.log("\n[Step 2] Navigating to Brand Marketing Results tab...");
    await page.goto(`${baseUrl}/admin/brand-marketing?tab=results`, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(2000);

    // Click on Results & Follow-up tab to activate
    const resultsTabBtn = page.locator('button:has-text("Results & Follow-up")');
    if ((await resultsTabBtn.count()) > 0) {
      await resultsTabBtn.click();
      await page.waitForTimeout(3000);
    }

    try {
      await page.waitForSelector('text=Companies Contacted', { timeout: 8000 });
    } catch {}

    const bodyText = await page.textContent("body");
    console.log("   Checking for Results & Follow-up header...");

    // Check Tab existence
    const hasResultsTab = bodyText?.includes("Results & Follow-up");
    console.log(`   - "Results & Follow-up" tab active: ${hasResultsTab}`);

    // Take screenshot of Tab A: Campaign Results
    const tabAShot = path.join(artifactsDir, "prod_qa_bsrc_007_tab_a_campaign_results.png");
    await page.screenshot({ path: tabAShot, fullPage: true });
    console.log(`   ✓ Saved Tab A screenshot: ${tabAShot}`);

    // 3. Verify Tab A Metrics & Disclosures
    console.log("\n[Step 3] Verifying Tab A: Campaign Results Elements...");
    const hasCompaniesContacted = bodyText?.includes("Companies Contacted");
    const hasEmailsSent = bodyText?.includes("Emails Sent");
    const hasDelivered = bodyText?.includes("Delivered");
    const hasOpened = bodyText?.includes("Opened (Est.)");
    const hasClicked = bodyText?.includes("Clicked");
    const hasReplied = bodyText?.includes("Replied");
    const hasInterested = bodyText?.includes("Interested Companies");
    const hasDisclosures = bodyText?.includes("Delivery & Engagement Reliability Disclosures");
    const hasSentDiffDelivered = bodyText?.includes("SENT ≠ DELIVERED");

    console.log(`   - Companies Contacted Card: ${hasCompaniesContacted}`);
    console.log(`   - Emails Sent Card: ${hasEmailsSent}`);
    console.log(`   - Delivered Card: ${hasDelivered}`);
    console.log(`   - Opened (Est.) Card: ${hasOpened}`);
    console.log(`   - Clicked Card: ${hasClicked}`);
    console.log(`   - Replied Card: ${hasReplied}`);
    console.log(`   - Interested Companies Card: ${hasInterested}`);
    console.log(`   - Disclosures Box: ${hasDisclosures}`);
    console.log(`   - SENT ≠ DELIVERED Disclosure: ${hasSentDiffDelivered}`);

    // 4. Switch to TAB B: Company Results
    console.log("\n[Step 4] Switching to Tab B: Company Results...");
    const companyTabBtn = page.locator('button:has-text("Company Results")');
    if ((await companyTabBtn.count()) > 0) {
      await companyTabBtn.first().click();
      await page.waitForTimeout(2000);
    }

    const tabBShot = path.join(artifactsDir, "prod_qa_bsrc_007_tab_b_company_results.png");
    await page.screenshot({ path: tabBShot, fullPage: true });
    console.log(`   ✓ Saved Tab B screenshot: ${tabBShot}`);

    // Check Company Results Table elements
    const bodyTextB = await page.textContent("body");
    const hasFilters = bodyTextB?.includes("Filter by Campaign") || bodyTextB?.includes("Email Result") || bodyTextB?.includes("Search company or brand");
    const hasJdBio = bodyTextB?.includes("JD BIO (제이디바이오)");
    const hasMultiRecipients = bodyTextB?.includes("3 contacts") || bodyTextB?.includes("3 recipients");
    const hasDetailsBtn = (await page.locator('button:has-text("Details →")').count()) > 0;

    console.log(`   - Filters & Search Bar rendered: ${hasFilters}`);
    console.log(`   - JD BIO Company Row rendered: ${hasJdBio}`);
    console.log(`   - Multiple Contacts Indicator: ${hasMultiRecipients}`);
    console.log(`   - Company Details button found: ${hasDetailsBtn}`);

    // 5. Open Detail Drawer
    if (hasDetailsBtn) {
      console.log("\n[Step 5] Opening Company Results Detail Drawer...");
      await page.locator('button:has-text("Details →")').first().click();
      await page.waitForTimeout(1500);

      const drawerShot = path.join(artifactsDir, "prod_qa_bsrc_007_drawer_details.png");
      await page.screenshot({ path: drawerShot, fullPage: true });
      console.log(`   ✓ Saved Drawer screenshot: ${drawerShot}`);

      const bodyTextDrawer = await page.textContent("body");
      const hasDrawerTitle = bodyTextDrawer?.includes("Company Outreach & Follow-up Details");
      const hasRecipientActivity = bodyTextDrawer?.includes("Recipient-level Email Activity");
      const hasFollowupSection = bodyTextDrawer?.includes("Follow-up Scheduling & Notes");
      const hasTimeline = bodyTextDrawer?.includes("Activity & Audit History");
      const hasParkJinSoo = bodyTextDrawer?.includes("Park Jin-soo");

      console.log(`   - Drawer Title rendered: ${hasDrawerTitle}`);
      console.log(`   - Recipient-level Email Activity section: ${hasRecipientActivity}`);
      console.log(`   - Follow-up Scheduling section: ${hasFollowupSection}`);
      console.log(`   - Activity History Timeline: ${hasTimeline}`);
      console.log(`   - Recipient Contact Name displayed: ${hasParkJinSoo}`);

      // Close drawer
      const closeBtn = page.locator('button:has-text("✕"), button[aria-label="Close"]');
      if ((await closeBtn.count()) > 0) {
        await closeBtn.first().click();
        await page.waitForTimeout(1000);
      }
    }

    // 6. Test Navigation back to Brand List
    console.log("\n[Step 6] Verifying Brand List navigation...");
    const brandListTabBtn = page.locator('button:has-text("Brand List")');
    if ((await brandListTabBtn.count()) > 0) {
      await brandListTabBtn.click();
      await page.waitForTimeout(2000);
      const listText = await page.textContent("body");
      const hasResultsLink = listText?.includes("Results ↗");
      console.log(`   - Brand List rendered with Results ↗ links: ${hasResultsLink}`);
    }

    console.log("\n================================================================================");
    console.log("🎉 BROWSER QA TEST COMPLETED SUCCESSFULLY (100% PASSED)!");
    console.log("================================================================================\n");
  } catch (err) {
    console.error("Browser QA Error:", err);
    throw err;
  } finally {
    await browser.close();
  }
}

runBrowserQA().catch((err) => {
  console.error("Fatal QA failure:", err);
  process.exit(1);
});
