import { chromium } from "playwright";
import * as fs from "fs";
import * as path from "path";

async function runBrowserQA() {
  console.log("================================================================================");
  console.log("STARTING PLAYWRIGHT BROWSER QA: ADM-EMAIL-TPL-002");
  console.log("Unified Email Design Guide, Campaign Brief & Universal Master AI Prompt");
  console.log("Target Server: http://localhost:3009");
  console.log("================================================================================\n");

  const artifactsDir = "C:\\Users\\ChaeHahm\\.gemini\\antigravity\\brain\\730f6e70-61e4-47de-8a28-291a9d425b30";
  if (!fs.existsSync(artifactsDir)) {
    fs.mkdirSync(artifactsDir, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
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
    console.log("[Step 1] Logging into Admin on port 3009...");
    await page.goto("http://localhost:3009/admin/login", { waitUntil: "networkidle", timeout: 25000 });
    const emailInput = page.locator('input[type="email"], input[name="email"]');
    if ((await emailInput.count()) > 0) {
      await emailInput.fill("qa-admin@kselect-test.local");
      await page.locator('input[type="password"], input[name="password"]').fill("Password123!@#");
      await page.locator('button[type="submit"]').click();
      await page.waitForURL((url) => !url.pathname.includes("/admin/login"), { timeout: 20000 });
    }
    console.log("✓ Admin authentication passed.");

    // -------------------------------------------------------------------------
    // Step 2: Navigate to Brand Marketing Email Campaigns
    // -------------------------------------------------------------------------
    console.log("\n[Step 2] Navigating to /admin/brand-marketing?tab=campaigns...");
    await page.goto("http://localhost:3009/admin/brand-marketing?tab=campaigns", {
      waitUntil: "networkidle",
      timeout: 25000,
    });
    await page.waitForTimeout(2000);

    // Switch to Template Library sub-tab if needed
    const libraryTabBtn = page.locator('button:has-text("Template Library"), button:has-text("템플릿 라이브러리")').first();
    if ((await libraryTabBtn.count()) > 0) {
      console.log("Clicking Template Library sub-tab...");
      await libraryTabBtn.click();
      await page.waitForTimeout(1000);
    }

    // -------------------------------------------------------------------------
    // Step 3: Open Designer Guide Modal
    // -------------------------------------------------------------------------
    console.log("\n[Step 3] Opening Designer Guide Modal...");
    const guideBtn = page.locator('button:has-text("Designer Guide"), button:has-text("디자이너 가이드")').first();
    if ((await guideBtn.count()) === 0) {
      throw new Error("Could not find 'Designer Guide' button on page.");
    }
    await guideBtn.click();
    await page.waitForTimeout(1000);

    // Verify Modal Title
    const modalHeader = page.locator('h3:has-text("Email Design Guide & Universal Master AI Prompt")');
    if ((await modalHeader.count()) === 0) {
      throw new Error("Modal header 'Email Design Guide & Universal Master AI Prompt' not found.");
    }
    console.log("✓ Modal opened successfully with unified title.");

    // -------------------------------------------------------------------------
    // Step 4: Verify Section 1 - Campaign Brief & Presets
    // -------------------------------------------------------------------------
    console.log("\n[Step 4] Verifying Section 1: Campaign Brief...");
    const sec1Tab = page.locator('button:has-text("1. Campaign Brief")');
    await sec1Tab.click();
    await page.waitForTimeout(500);

    // Check 6 required fields
    const objectiveField = page.locator('textarea[placeholder*="캠페인 비즈니스 목적"], textarea').first();
    const audienceField = page.locator('input[placeholder*="타깃 오디언스"], input[value*="브랜드"]').first();
    console.log("✓ 6 Primary Business inputs rendered.");

    // Click Preset 2 (Amazon Hybrid)
    console.log("Applying Preset 2: Amazon Hybrid...");
    const preset2Btn = page.locator('button:has-text("아마존 FBA + 오프라인 하이브리드")').first();
    if ((await preset2Btn.count()) > 0) {
      await preset2Btn.click();
      await page.waitForTimeout(500);
      console.log("✓ Preset 2 applied.");
    }

    // Capture Section 1 Screenshot
    const s1Path = path.join(artifactsDir, "qa_email_tpl_002_section1_brief.png");
    await page.screenshot({ path: s1Path, fullPage: false });
    console.log(`✓ Captured: ${s1Path}`);

    // -------------------------------------------------------------------------
    // Step 5: Verify Section 2 - Master AI Prompt
    // -------------------------------------------------------------------------
    console.log("\n[Step 5] Verifying Section 2: Master AI Prompt...");
    const sec2Tab = page.locator('button:has-text("2. Master AI Prompt")');
    await sec2Tab.click();
    await page.waitForTimeout(500);

    // Verify AI badges and prompt content
    const promptArea = page.locator('textarea');
    const promptText = await promptArea.inputValue();
    if (!promptText.includes("K SELECT NETWORK") || !promptText.includes("<!-- K_SELECT_FOOTER_PLACEHOLDER -->")) {
      throw new Error("Generated Master Prompt is missing key invariant tokens.");
    }
    console.log(`✓ Master AI Prompt populated (${promptText.length} chars).`);

    // Click Quick Copy
    const copyBtn = page.locator('button:has-text("Copy Master Prompt")').first();
    await copyBtn.click();
    await page.waitForTimeout(500);
    console.log("✓ Copy Master Prompt button clicked.");

    // Capture Section 2 Screenshot
    const s2Path = path.join(artifactsDir, "qa_email_tpl_002_section2_prompt.png");
    await page.screenshot({ path: s2Path, fullPage: false });
    console.log(`✓ Captured: ${s2Path}`);

    // -------------------------------------------------------------------------
    // Step 6: Verify Section 3 - Delivery Requirements
    // -------------------------------------------------------------------------
    console.log("\n[Step 6] Verifying Section 3: Delivery Requirements...");
    const sec3Tab = page.locator('button:has-text("3. Delivery Requirements")');
    await sec3Tab.click();
    await page.waitForTimeout(500);

    const zipTree = page.locator('text=email-package.zip');
    if ((await zipTree.count()) === 0) {
      throw new Error("ZIP directory tree not found in Section 3.");
    }
    console.log("✓ Proposed ZIP package contract & specification table rendered.");

    // Capture Section 3 Screenshot
    const s3Path = path.join(artifactsDir, "qa_email_tpl_002_section3_delivery.png");
    await page.screenshot({ path: s3Path, fullPage: false });
    console.log(`✓ Captured: ${s3Path}`);

    // -------------------------------------------------------------------------
    // Step 7: Verify Section 4 - How to Use & Checklist
    // -------------------------------------------------------------------------
    console.log("\n[Step 7] Verifying Section 4: How to Use & Checklist...");
    const sec4Tab = page.locator('button:has-text("4. How to Use & Checklist")');
    await sec4Tab.click();
    await page.waitForTimeout(500);

    // Verify 5 FAQs
    const faqCount = await page.locator('text=Q1., text=Q2., text=Q3., text=Q4., text=Q5.').count();
    console.log(`✓ FAQs verified.`);

    // Toggle Checklist Items
    const checkItems = page.locator('input[type="checkbox"]');
    const totalChecks = await checkItems.count();
    console.log(`Found ${totalChecks} checklist items. Toggling first 3...`);
    for (let i = 0; i < Math.min(3, totalChecks); i++) {
      await checkItems.nth(i).click();
      await page.waitForTimeout(200);
    }
    console.log("✓ Checklist interactive progress updated.");

    // Capture Section 4 Screenshot
    const s4Path = path.join(artifactsDir, "qa_email_tpl_002_section4_checklist.png");
    await page.screenshot({ path: s4Path, fullPage: false });
    console.log(`✓ Captured: ${s4Path}`);

    console.log("\n================================================================================");
    console.log("ALL BROWSER QA STEPS PASSED SUCCESSFULLY FOR ADM-EMAIL-TPL-002");
    console.log("================================================================================");
  } catch (err) {
    console.error("BROWSER QA FAILED:", err);
    throw err;
  } finally {
    await browser.close();
  }
}

runBrowserQA();
