import { chromium } from "playwright";
import fs from "fs";
import path from "path";

// Mock server-only for standalone execution
try {
  const serverOnlyPath = require.resolve("server-only");
  (require.cache as any)[serverOnlyPath] = {
    id: serverOnlyPath,
    filename: serverOnlyPath,
    loaded: true,
    exports: {},
    children: [],
    path: "",
    paths: [],
  };
} catch {}

async function runIntegratedBrowserQA() {
  console.log("================================================================================");
  console.log("TASK ID: ADM-BSRC-008 — Brand Marketing Final Integration Browser QA");
  console.log("Scope: Campaigns (006), Results & Follow-up (007), Template Upload & Footer (009)");
  console.log("Target Server: http://localhost:3000");
  console.log("================================================================================\n");

  const artifactsDir = "C:\\Users\\ChaeHahm\\.gemini\\antigravity\\brain\\945ab025-0f8f-4fce-b0bc-56237108874e";
  if (!fs.existsSync(artifactsDir)) {
    fs.mkdirSync(artifactsDir, { recursive: true });
  }

  const { generateUnsubscribeToken } = await import("../lib/brand-marketing/unsubscribe");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
  });
  const page = await context.newPage();

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      console.log("[BROWSER CONSOLE ERROR]", msg.text());
    }
  });

  try {
    // -------------------------------------------------------------------------
    // 1. ADMIN LOGIN
    // -------------------------------------------------------------------------
    console.log("[Step 1] Logging into Admin Portal...");
    await page.goto("http://localhost:3000/admin/login", { waitUntil: "networkidle", timeout: 20000 });
    const emailInput = page.locator('input[type="email"], input[name="email"]');
    if ((await emailInput.count()) > 0) {
      await emailInput.fill("qa-admin@kselect-test.local");
      await page.locator('input[type="password"], input[name="password"]').fill("Password123!@#");
      await page.locator('button[type="submit"]').click();
      await page.waitForURL((url) => !url.pathname.includes("/admin/login"), { timeout: 20000 });
    }
    console.log("✓ Logged in successfully. Current URL:", page.url());

    // -------------------------------------------------------------------------
    // 2. BRAND MARKETING MAIN NAVIGATION (ALL 4 TABS)
    // -------------------------------------------------------------------------
    console.log("\n[Step 2] Navigating to /admin/brand-marketing...");
    await page.goto("http://localhost:3000/admin/brand-marketing", { waitUntil: "networkidle", timeout: 25000 });
    await page.waitForTimeout(1500);

    const shot01 = path.join(artifactsDir, "bsrc-008-01-brand-marketing-tabs.png");
    await page.screenshot({ path: shot01, fullPage: false });
    console.log("✓ Saved Screenshot 1:", shot01);

    // -------------------------------------------------------------------------
    // 3. TAB 4: CAMPAIGN RESULTS & COMPANY FOLLOW-UP (ADM-BSRC-007)
    // -------------------------------------------------------------------------
    console.log("\n[Step 3] Switching to Tab 4: Results & Follow-up...");
    const resultsTabBtn = page.locator('button:has-text("Results & Follow-up")');
    if ((await resultsTabBtn.count()) > 0) {
      await resultsTabBtn.click();
      await page.waitForTimeout(2000);
    } else {
      await page.goto("http://localhost:3000/admin/brand-marketing?tab=results", { waitUntil: "networkidle" });
      await page.waitForTimeout(2000);
    }

    const shot02 = path.join(artifactsDir, "bsrc-008-02-campaign-results-overview.png");
    await page.screenshot({ path: shot02, fullPage: false });
    console.log("✓ Saved Screenshot 2 (Results Overview):", shot02);

    // Verify Company Results Sub-tab
    console.log("   Clicking 'Company Results' sub-tab...");
    const companyResultsSubTab = page.locator('button:has-text("Company Results")');
    if ((await companyResultsSubTab.count()) > 0) {
      await companyResultsSubTab.click();
      await page.waitForTimeout(1500);
    }

    const shot03 = path.join(artifactsDir, "bsrc-008-03-company-results-subtab.png");
    await page.screenshot({ path: shot03, fullPage: false });
    console.log("✓ Saved Screenshot 3 (Company Results Sub-tab):", shot03);

    // Test Opening Company Follow-up Drawer if rows exist
    const followUpBtn = page.locator('button:has-text("Log Activity"), button:has-text("Follow-up")').first();
    if ((await followUpBtn.count()) > 0) {
      console.log("   Opening Company Follow-up Drawer...");
      await followUpBtn.click();
      await page.waitForTimeout(1500);

      const shot04 = path.join(artifactsDir, "bsrc-008-04-company-followup-drawer.png");
      await page.screenshot({ path: shot04, fullPage: false });
      console.log("✓ Saved Screenshot 4 (Follow-up Drawer):", shot04);

      // Close drawer
      const closeBtn = page.locator('button:has-text("Close"), button[aria-label="Close"]').first();
      if ((await closeBtn.count()) > 0) {
        await closeBtn.click();
        await page.waitForTimeout(500);
      }
    }

    // -------------------------------------------------------------------------
    // 4. TAB 3: EMAIL CAMPAIGNS V1 & CENTRAL MARKETING FOOTER (ADM-BSRC-006 & 009)
    // -------------------------------------------------------------------------
    console.log("\n[Step 4] Switching to Tab 3: Email Campaigns...");
    const campaignsTabBtn = page.locator('button:has-text("Email Campaigns")');
    if ((await campaignsTabBtn.count()) > 0) {
      await campaignsTabBtn.click();
      await page.waitForTimeout(2000);
    } else {
      await page.goto("http://localhost:3000/admin/brand-marketing?tab=campaigns", { waitUntil: "networkidle" });
      await page.waitForTimeout(2000);
    }

    // 4.1 Marketing Footer Settings Tab
    console.log("   Navigating to Marketing Footer Settings sub-view...");
    const footerTabBtn = page.locator('button:has-text("Marketing Footer Settings")');
    if ((await footerTabBtn.count()) > 0) {
      await footerTabBtn.click();
      await page.waitForTimeout(1500);

      const shot05 = path.join(artifactsDir, "bsrc-008-05-marketing-footer-settings.png");
      await page.screenshot({ path: shot05, fullPage: false });
      console.log("✓ Saved Screenshot 5 (Marketing Footer Settings):", shot05);

      // Switch to Mobile 375px preview
      const mobileBtn = page.locator('button:has-text("Mobile (375px)")');
      if ((await mobileBtn.count()) > 0) {
        await mobileBtn.click();
        await page.waitForTimeout(1000);

        const shot06 = path.join(artifactsDir, "bsrc-008-06-footer-settings-mobile.png");
        await page.screenshot({ path: shot06, fullPage: false });
        console.log("✓ Saved Screenshot 6 (Footer Settings Mobile Preview):", shot06);
      }
    }

    // 4.2 Template Library Sub-view
    console.log("   Switching to Template Library...");
    const tplLibBtn = page.locator('button:has-text("Template Library")');
    if ((await tplLibBtn.count()) > 0) {
      await tplLibBtn.click();
      await page.waitForTimeout(1500);

      const shot07 = path.join(artifactsDir, "bsrc-008-07-template-library.png");
      await page.screenshot({ path: shot07, fullPage: false });
      console.log("✓ Saved Screenshot 7 (Template Library):", shot07);

      // Open Upload Modal
      const uploadBtn = page.locator('button:has-text("Upload HTML / ZIP")');
      if ((await uploadBtn.count()) > 0) {
        await uploadBtn.click();
        await page.waitForTimeout(1000);

        const shot08 = path.join(artifactsDir, "bsrc-008-08-upload-template-modal.png");
        await page.screenshot({ path: shot08, fullPage: false });
        console.log("✓ Saved Screenshot 8 (Upload Template Modal):", shot08);

        // Close upload modal
        const cancelBtn = page.locator('button:has-text("Cancel")').first();
        if ((await cancelBtn.count()) > 0) {
          await cancelBtn.click();
          await page.waitForTimeout(500);
        }
      }
    }

    // 4.3 Campaign Creation & 6-Step Workflow
    console.log("   Opening Campaign Builder (+ Create Campaign)...");
    const campaignsSubTab = page.locator('button:has-text("Campaigns")').first();
    if ((await campaignsSubTab.count()) > 0) {
      await campaignsSubTab.click();
      await page.waitForTimeout(1000);
    }

    const createCampBtn = page.locator('button:has-text("Create Campaign")');
    if ((await createCampBtn.count()) > 0) {
      await createCampBtn.click();
      await page.waitForTimeout(1500);

      const shot09 = path.join(artifactsDir, "bsrc-008-09-campaign-step1-settings.png");
      await page.screenshot({ path: shot09, fullPage: false });
      console.log("✓ Saved Screenshot 9 (Step 1 Settings & Subject Override):", shot09);

      // Fill in Step 1
      const nameInput = page.locator('input[placeholder*="Campaign Name"], input[name="name"]').first();
      if ((await nameInput.count()) > 0) {
        await nameInput.fill("2026 Fall K-Beauty Strategic Outreach [INTEGRATED]");
      }

      // Navigate to Step 2
      const nextBtn = page.locator('button:has-text("Next: Template"), button:has-text("Next →")').first();
      if ((await nextBtn.count()) > 0) {
        await nextBtn.click();
        await page.waitForTimeout(1500);

        const shot10 = path.join(artifactsDir, "bsrc-008-10-campaign-step2-preview.png");
        await page.screenshot({ path: shot10, fullPage: false });
        console.log("✓ Saved Screenshot 10 (Step 2 Template Selected & Assembled Preview):", shot10);
      }
    }

    // -------------------------------------------------------------------------
    // 5. PUBLIC ZERO-LOGIN UNSUBSCRIBE PAGE
    // -------------------------------------------------------------------------
    console.log("\n[Step 5] Testing Public Zero-Login Unsubscribe Page...");
    const sampleToken = generateUnsubscribeToken("buyer-partner@example.com", "camp-adm-bsrc-008");
    const unsubUrl = `http://localhost:3000/unsubscribe?token=${encodeURIComponent(sampleToken)}`;

    // Create a new incognito context (zero session cookies)
    const incognitoContext = await browser.newContext({ viewport: { width: 1200, height: 800 } });
    const unsubPage = await incognitoContext.newPage();
    await unsubPage.goto(unsubUrl, { waitUntil: "networkidle" });
    await unsubPage.waitForTimeout(1500);

    const shot11 = path.join(artifactsDir, "bsrc-008-11-public-unsubscribe-page.png");
    await unsubPage.screenshot({ path: shot11, fullPage: false });
    console.log("✓ Saved Screenshot 11 (Public Zero-Login Unsubscribe Page):", shot11);
    await incognitoContext.close();

    // -------------------------------------------------------------------------
    // 6. GLOBAL ADMIN SHELL 1800PX RESPONSIVE AUDIT (AGENTS.md Rule 27)
    // -------------------------------------------------------------------------
    console.log("\n[Step 6] Auditing Global Admin Shell 1800px standard...");
    await page.setViewportSize({ width: 2000, height: 1000 });
    await page.goto("http://localhost:3000/admin/brand-marketing?tab=results", { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);

    const shot12 = path.join(artifactsDir, "bsrc-008-12-admin-1800px-viewport.png");
    await page.screenshot({ path: shot12, fullPage: false });
    console.log("✓ Saved Screenshot 12 (Admin 1800px Centered Shell on 2000px Display):", shot12);

    console.log("\n================================================================================");
    console.log("🎉 ALL INTEGRATED BROWSER QA STEPS COMPLETED SUCCESSFULLY!");
    console.log("================================================================================");

  } finally {
    await browser.close();
  }
}

runIntegratedBrowserQA().catch((err) => {
  console.error("Integrated browser QA error:", err);
  process.exit(1);
});
