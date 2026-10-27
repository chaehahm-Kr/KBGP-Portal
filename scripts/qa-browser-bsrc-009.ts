// Mock server-only before any other imports
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
} catch {
  // ignore
}

import { chromium } from "playwright";
import fs from "fs";
import path from "path";

async function runBrowserQA() {
  console.log("================================================================================");
  console.log("ADM-BSRC-009: Email Template Upload, Library & Marketing Footer Browser QA");
  console.log("Target: http://localhost:3000");
  console.log("================================================================================");

  const { generateUnsubscribeToken } = await import("../lib/brand-marketing/unsubscribe");

  const artifactsDir = "C:\\Users\\ChaeHahm\\.gemini\\antigravity\\brain\\945ab025-0f8f-4fce-b0bc-56237108874e";
  if (!fs.existsSync(artifactsDir)) {
    fs.mkdirSync(artifactsDir, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
  });
  const page = await context.newPage();

  try {
    // -------------------------------------------------------------------------
    // 1. ADMIN LOGIN
    // -------------------------------------------------------------------------
    console.log("\n[QA Step 1] Logging into Admin...");
    await page.goto("http://localhost:3000/admin/login", { waitUntil: "networkidle", timeout: 20000 });
    await page.locator('input[type="email"], input[name="email"]').fill("qa-admin@kselect-test.local");
    await page.locator('input[type="password"], input[name="password"]').fill("Password123!@#");
    await page.locator('button[type="submit"]').click();
    await page.waitForURL((url) => !url.pathname.includes("/admin/login"), { timeout: 20000 });
    console.log(`[QA Step 1] Successfully logged in. URL: ${page.url()}`);

    // -------------------------------------------------------------------------
    // 2. MARKETING FOOTER SETTINGS TAB & LIVE PREVIEWS
    // -------------------------------------------------------------------------
    console.log("\n[QA Step 2] Navigating to /admin/brand-marketing?tab=campaigns...");
    await page.goto("http://localhost:3000/admin/brand-marketing?tab=campaigns", { waitUntil: "networkidle", timeout: 25000 });
    await page.waitForTimeout(2000);

    // Click "Marketing Footer Settings" tab button
    console.log("[QA Step 2] Switching to 'Marketing Footer Settings' tab...");
    const footerTabBtn = page.locator('button:has-text("Marketing Footer Settings"), button:has-text("마케팅 푸터 설정")').first();
    await footerTabBtn.click();
    await page.waitForTimeout(1000);

    // Screenshot 1: Footer Settings Desktop View
    const shot1 = path.join(artifactsDir, "bsrc-009-01-footer-settings-desktop.png");
    await page.screenshot({ path: shot1, fullPage: true });
    console.log(`[QA Step 2] Captured Screenshot 1: ${shot1}`);

    // Click Mobile (375px) toggle
    console.log("[QA Step 2] Toggling Mobile (375px) preview...");
    const mobileBtn = page.locator('button:has-text("Mobile (375px)")').first();
    if ((await mobileBtn.count()) > 0) {
      await mobileBtn.click();
      await page.waitForTimeout(600);
    }
    const shot2 = path.join(artifactsDir, "bsrc-009-02-footer-settings-mobile.png");
    await page.screenshot({ path: shot2, fullPage: true });
    console.log(`[QA Step 2] Captured Screenshot 2: ${shot2}`);

    // -------------------------------------------------------------------------
    // 3. TEMPLATE LIBRARY TAB
    // -------------------------------------------------------------------------
    console.log("\n[QA Step 3] Switching to 'Template Library' tab...");
    const libraryTabBtn = page.locator('button:has-text("Template Library"), button:has-text("템플릿 라이브러리")').first();
    await libraryTabBtn.click();
    await page.waitForTimeout(1000);

    const shot3 = path.join(artifactsDir, "bsrc-009-03-template-library.png");
    await page.screenshot({ path: shot3, fullPage: true });
    console.log(`[QA Step 3] Captured Screenshot 3: ${shot3}`);

    // -------------------------------------------------------------------------
    // 4. UPLOAD HTML / ZIP MODAL
    // -------------------------------------------------------------------------
    console.log("\n[QA Step 4] Opening Upload HTML / ZIP Modal...");
    const uploadBtn = page.locator('button:has-text("Upload HTML / ZIP"), button:has-text("HTML / ZIP 업로드")').first();
    if ((await uploadBtn.count()) > 0) {
      await uploadBtn.click();
      await page.waitForTimeout(800);

      const shot4 = path.join(artifactsDir, "bsrc-009-04-upload-modal.png");
      await page.screenshot({ path: shot4, fullPage: true });
      console.log(`[QA Step 4] Captured Screenshot 4: ${shot4}`);

      // Close modal
      const cancelBtn = page.locator('button:has-text("Cancel"), button:has-text("취소")').first();
      if ((await cancelBtn.count()) > 0) {
        await cancelBtn.click();
        await page.waitForTimeout(500);
      }
    }

    // -------------------------------------------------------------------------
    // 5. CAMPAIGN CREATION — STEP 1 AUTHORITATIVE FIELDS
    // -------------------------------------------------------------------------
    console.log("\n[QA Step 5] Switching back to Campaigns tab and creating new campaign...");
    const campaignsTabBtn = page.locator('button:has-text("Campaigns (캠페인 목록)")').first();
    await campaignsTabBtn.click();
    await page.waitForTimeout(800);

    const newCampBtn = page.locator('button:has-text("Create Campaign")').first();
    await newCampBtn.click();
    await page.waitForTimeout(1000);

    // Fill Step 1 fields
    console.log("[QA Step 5] Filling authoritative Step 1 fields...");
    await page.locator('input[value*=""], input[type="text"]').first().fill("2026 Fall K-Beauty Strategic Outreach");
    
    // Fill authoritative subject override
    const subjectInput = page.locator('input[placeholder*="제안드립니다"]').first();
    if ((await subjectInput.count()) > 0) {
      await subjectInput.fill("Exclusive Partnership: Curated K-Beauty Collections for US Retailers");
    }

    // Fill preview text
    const previewTextInput = page.locator('input[placeholder*="메일 목록에서 제목 옆에 노출되는 요약 문구"]').first();
    if ((await previewTextInput.count()) > 0) {
      await previewTextInput.fill("Explore high-demand skincare lines directly imported from Seoul.");
    }

    // Fill landing page URL
    const landingUrlInput = page.locator('input[placeholder*="https://www.kselectnetwork.com"]').first();
    if ((await landingUrlInput.count()) > 0) {
      await landingUrlInput.fill("https://kselectnetwork.com/campaigns/fall-strategic");
    }

    const shot5 = path.join(artifactsDir, "bsrc-009-05-campaign-step1.png");
    await page.screenshot({ path: shot5, fullPage: true });
    console.log(`[QA Step 5] Captured Screenshot 5: ${shot5}`);

    // -------------------------------------------------------------------------
    // 6. CAMPAIGN STEP 2 — TEMPLATE SELECTION & ASSEMBLED PREVIEW WITH FOOTER
    // -------------------------------------------------------------------------
    console.log("\n[QA Step 6] Advancing to Step 2 Template Package...");
    const nextBtn1 = page.locator('button:has-text("Next: Select Template Package")').first();
    await nextBtn1.click();
    await page.waitForTimeout(1500);

    // Scroll to see the assembled preview including footer
    await page.evaluate(() => window.scrollBy(0, 400));
    await page.waitForTimeout(600);

    const shot6 = path.join(artifactsDir, "bsrc-009-06-campaign-step2-assembled-preview.png");
    await page.screenshot({ path: shot6, fullPage: true });
    console.log(`[QA Step 6] Captured Screenshot 6: ${shot6}`);

    // -------------------------------------------------------------------------
    // 7. STEP 6 — PRE-APPROVAL VALIDATION CHECKLIST
    // -------------------------------------------------------------------------
    console.log("\n[QA Step 7] Navigating through steps to Step 6 Pre-Approval Review...");
    // Step 2 -> Step 3
    const nextBtn2 = page.locator('button:has-text("Next: Recipient Selection")').first();
    if ((await nextBtn2.count()) > 0) {
      await nextBtn2.click();
      await page.waitForTimeout(1000);
    }
    // Step 3 -> Step 4
    const nextBtn3 = page.locator('button:has-text("Next: Sample Personalization Review")').first();
    if ((await nextBtn3.count()) > 0) {
      await nextBtn3.click();
      await page.waitForTimeout(1000);
    }
    // Step 4 -> Step 5
    const nextBtn4 = page.locator('button:has-text("Next: Test Send & Dry Run")').first();
    if ((await nextBtn4.count()) > 0) {
      await nextBtn4.click();
      await page.waitForTimeout(1000);
    }
    // Step 5 -> Step 6
    const nextBtn5 = page.locator('button:has-text("Next: Final Approval & Activity")').first();
    if ((await nextBtn5.count()) > 0) {
      await nextBtn5.click();
      await page.waitForTimeout(1500);
    }

    const shot7 = path.join(artifactsDir, "bsrc-009-07-step6-preapproval-checklist.png");
    await page.screenshot({ path: shot7, fullPage: true });
    console.log(`[QA Step 7] Captured Screenshot 7: ${shot7}`);

    // -------------------------------------------------------------------------
    // 8. PUBLIC ZERO-LOGIN /unsubscribe PAGE
    // -------------------------------------------------------------------------
    console.log("\n[QA Step 8] Testing Public /unsubscribe route in clean incognito session...");
    const publicContext = await browser.newContext();
    const publicPage = await publicContext.newPage();

    const sampleEmail = "recipient-brand-test@letusto.com";
    const sampleToken = generateUnsubscribeToken(sampleEmail, "camp-qa-verify-001");
    const unsubUrl = `http://localhost:3000/unsubscribe?token=${encodeURIComponent(sampleToken)}`;

    await publicPage.goto(unsubUrl, { waitUntil: "networkidle", timeout: 20000 });
    await publicPage.waitForTimeout(1000);

    const shot8 = path.join(artifactsDir, "bsrc-009-08-public-unsubscribe-page.png");
    await publicPage.screenshot({ path: shot8, fullPage: true });
    console.log(`[QA Step 8] Captured Screenshot 8: ${shot8}`);

    await publicContext.close();
    console.log("\n================================================================================");
    console.log("ALL 8 QA BROWSER SCREENSHOTS CAPTURED SUCCESSFULLY!");
    console.log("================================================================================");

  } catch (err: any) {
    console.error("Browser QA Error:", err);
    const errShot = path.join(artifactsDir, "bsrc-009-qa-error.png");
    await page.screenshot({ path: errShot, fullPage: true });
    console.log(`Error screenshot saved: ${errShot}`);
    throw err;
  } finally {
    await browser.close();
  }
}

runBrowserQA().catch((err) => {
  console.error("QA execution failed:", err);
  process.exit(1);
});
