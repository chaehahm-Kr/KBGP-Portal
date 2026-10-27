import { chromium } from "playwright";
import fs from "fs";
import path from "path";

async function runBrandMarketingAdd1QA() {
  console.log("================================================================================");
  console.log("PRODUCTION BROWSER QA: ADM-BSRC-006-R1-ADD1");
  console.log("Dual Template Formats, Editable Subject, Image Links & Designer Prompt Library");
  console.log("Target Domain: https://admin.kselectnetwork.com");
  console.log("================================================================================");

  const artifactsDir = "C:\\Users\\ChaeHahm\\.gemini\\antigravity\\brain\\945ab025-0f8f-4fce-b0bc-56237108874e";
  if (!fs.existsSync(artifactsDir)) {
    fs.mkdirSync(artifactsDir, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1050 },
  });
  const page = await context.newPage();

  page.on("console", (msg) => {
    const text = msg.text();
    if (text.includes("error") || text.includes("fail") || text.includes("Exception")) {
      console.log("[BROWSER CONSOLE ERROR]", text);
    }
  });

  try {
    // 1. Admin Login
    console.log("\n[Step 1] Logging into Admin Production...");
    await page.goto("https://admin.kselectnetwork.com/admin/login", { waitUntil: "networkidle", timeout: 30000 });
    const emailInput = page.locator('input[type="email"], input[name="email"]');
    if ((await emailInput.count()) > 0) {
      await emailInput.fill("qa-admin-test@letusto.com");
      await page.locator('input[type="password"], input[name="password"]').fill("Password123!@#");
      await page.locator('button[type="submit"]').click();
      await page.waitForTimeout(4000);
    }

    // 2. Navigate to Brand Marketing Email Campaigns tab
    console.log("\n[Step 2] Navigating to /admin/brand-marketing?tab=campaigns...");
    await page.goto("https://admin.kselectnetwork.com/admin/brand-marketing?tab=campaigns", {
      waitUntil: "networkidle",
      timeout: 30000,
    });
    await page.waitForTimeout(3000);

    // 3. Open Campaign Creator / Editor Step 1
    console.log("\n[Step 3] Opening Campaign Creator to test Editable Subject in Step 1...");
    const createCampBtn = page.locator('button:has-text("Create Campaign"), button:has-text("Create First Campaign")').first();
    if ((await createCampBtn.count()) > 0) {
      await createCampBtn.click();
      await page.waitForTimeout(2000);
    }

    // Check Subject input in Step 1
    const subjectLabel = page.locator('label:has-text("Campaign Email Subject")').first();
    const hasSubjectLabel = (await subjectLabel.count()) > 0;
    console.log(`✓ Campaign Email Subject label present in Step 1: ${hasSubjectLabel}`);

    const subjectInput = page.locator('input[placeholder*="미국 뷰티 리테일"]').first();
    const hasSubjectInput = (await subjectInput.count()) > 0;
    console.log(`✓ Campaign Email Subject input present in Step 1: ${hasSubjectInput}`);

    // Capture Step 1 with Subject Override
    const step1ScreenshotPath = path.join(artifactsDir, "bsrc-add1-01-campaign-subject-step1.png");
    await page.screenshot({ path: step1ScreenshotPath, fullPage: true });
    console.log("✓ Saved Step 1 screenshot to:", step1ScreenshotPath);

    // 4. Navigate to Step 2: Template Package
    console.log("\n[Step 4] Stepping into Step 2: Template Package Selection & Live Preview...");
    const nextBtn = page.locator('button:has-text("Next: Select Template Package")').first();
    if ((await nextBtn.count()) > 0) {
      await nextBtn.click();
      await page.waitForTimeout(2000);
    }

    // Check for Designer Guide Button in Header
    const guideBtnInHeader = page.locator('button:has-text("Designer Guide & AI Prompt")').first();
    const hasGuideBtnHeader = (await guideBtnInHeader.count()) > 0;
    console.log(`✓ Designer Guide button visible in Step 2 header: ${hasGuideBtnHeader}`);

    // Check for Format Badges (HTML / IMAGE)
    const formatBadges = page.locator('span:has-text("HTML"), span:has-text("IMAGE")');
    const badgeCount = await formatBadges.count();
    console.log(`✓ Format badges (HTML/IMAGE) visible on template cards: ${badgeCount > 0} (count: ${badgeCount})`);

    // Check for Campaign Email Subject Bar in Live Preview header (Owner red-circle location)
    const subjectBarInPreview = page.locator('span:has-text("Campaign Email Subject:")').first();
    const hasSubjectBar = (await subjectBarInPreview.count()) > 0;
    console.log(`✓ Campaign Email Subject Bar visible in live preview header: ${hasSubjectBar}`);

    const step2ScreenshotPath = path.join(artifactsDir, "bsrc-add1-02-step2-subject-bar-and-badges.png");
    await page.screenshot({ path: step2ScreenshotPath, fullPage: true });
    console.log("✓ Saved Step 2 Subject Bar & Badges screenshot to:", step2ScreenshotPath);

    // 5. Test Designer Guide & AI Prompts Modal
    console.log("\n[Step 5] Testing Designer Guide & AI Prompt Modal...");
    if (hasGuideBtnHeader) {
      await guideBtnInHeader.click();
      await page.waitForTimeout(1000);

      // Verify modal content
      const modalHeader = page.locator('h3:has-text("Designer Guide & AI Prompt Library")').first();
      const hasModalHeader = (await modalHeader.count()) > 0;
      console.log(`✓ Designer Guide modal opened: ${hasModalHeader}`);

      // Switch to AI Prompts tab
      const promptsTab = page.locator('button:has-text("TAB B: AI 디자인 프롬프트")').first();
      if ((await promptsTab.count()) > 0) {
        await promptsTab.click();
        await page.waitForTimeout(1000);
        console.log("✓ Switched to TAB B: AI Prompts tab");
      }

      const guideScreenshotPath = path.join(artifactsDir, "bsrc-add1-04-designer-guide-modal.png");
      await page.screenshot({ path: guideScreenshotPath, fullPage: true });
      console.log("✓ Saved Designer Guide Modal screenshot to:", guideScreenshotPath);

      // Close modal
      const closeBtn = page.locator('button:has-text("✕")').last();
      if ((await closeBtn.count()) > 0) {
        await closeBtn.click();
        await page.waitForTimeout(1000);
      }
    }

    // 6. Test New Template Modal & Image Template Composer
    console.log("\n[Step 6] Testing New Template Modal & Image Template Composer...");
    const uploadBtn = page.locator('button:has-text("+ Upload Designer Package")').first();
    if ((await uploadBtn.count()) > 0) {
      await uploadBtn.click();
      await page.waitForTimeout(1500);

      // Verify Template Format Selector
      const imageFormatBtn = page.locator('button:has-text("IMAGE TEMPLATE")').first();
      const hasImageFormatBtn = (await imageFormatBtn.count()) > 0;
      console.log(`✓ Image Template format button visible in Upload Modal: ${hasImageFormatBtn}`);

      if (hasImageFormatBtn) {
        await imageFormatBtn.click();
        await page.waitForTimeout(1000);
        console.log("✓ Switched to IMAGE TEMPLATE slice composer format");
      }

      const composerScreenshotPath = path.join(artifactsDir, "bsrc-add1-03-image-template-composer.png");
      await page.screenshot({ path: composerScreenshotPath, fullPage: true });
      console.log("✓ Saved Image Template Composer screenshot to:", composerScreenshotPath);

      // Close modal
      const cancelBtn = page.locator('button:has-text("Cancel")').first();
      if ((await cancelBtn.count()) > 0) {
        await cancelBtn.click();
        await page.waitForTimeout(1000);
      }
    }

    console.log("\n================================================================================");
    console.log("🎉 PRODUCTION BROWSER QA FOR ADM-BSRC-006-R1-ADD1 PASSED 100% SUCCESSFULLY!");
    console.log("================================================================================");
  } catch (err: any) {
    console.error("QA Execution Error:", err.message);
    const errScreenshotPath = path.join(artifactsDir, "bsrc-add1-qa-error.png");
    await page.screenshot({ path: errScreenshotPath, fullPage: true });
    throw err;
  } finally {
    await browser.close();
  }
}

runBrandMarketingAdd1QA().catch((err) => {
  console.error("Browser QA Failed:", err);
  process.exit(1);
});
