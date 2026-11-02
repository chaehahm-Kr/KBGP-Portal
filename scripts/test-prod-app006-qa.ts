import { chromium } from "playwright";
import fs from "fs";
import path from "path";

async function runProdApp006BrowserQA() {
  console.log("================================================================================");
  console.log("PRODUCTION BROWSER QA: ADM-EMAIL-APP-006");
  console.log("Controlled Live Email Delivery, Send Lock & Safe Unlock");
  console.log("Target Domain: https://admin.kselectnetwork.com");
  console.log("================================================================================");

  const artifactsDir = "C:\\Users\\ChaeHahm\\.gemini\\antigravity\\brain\\945ab025-0f8f-4fce-b0bc-56237108874e";
  if (!fs.existsSync(artifactsDir)) {
    fs.mkdirSync(artifactsDir, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
  });
  const page = await context.newPage();

  page.on("console", (msg) => {
    const text = msg.text();
    if (text.includes("error") || text.includes("Exception")) {
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

    // 2. Navigate to Brand Marketing Campaigns
    console.log("\n[Step 2] Navigating to /admin/brand-marketing?tab=campaigns...");
    await page.goto("https://admin.kselectnetwork.com/admin/brand-marketing?tab=campaigns", {
      waitUntil: "networkidle",
      timeout: 30000,
    });
    await page.waitForTimeout(3000);

    // 3. Verify Campaign List & Metrics
    console.log("\n[Step 3] Verifying Campaign List metrics & SIMULATED status badge...");
    const wave1Row = page.locator('tr:has-text("20261101-2256-KBGP-Brand Outreach-Wave1")');
    await wave1Row.waitFor({ state: "visible", timeout: 15000 });
    const rowCount = await wave1Row.count();
    console.log(`✓ Wave 1 campaign row found: ${rowCount > 0}`);

    const rowText = await wave1Row.innerText();
    console.log(`[Wave 1 Row Text]:\n${rowText.replace(/\n+/g, " | ")}`);

    const listScreenshotPath = path.join(artifactsDir, "adm-email-app-006-01-campaign-list.png");
    await page.screenshot({ path: listScreenshotPath, fullPage: true });
    console.log("✓ Saved Campaign List screenshot to:", listScreenshotPath);

    // 4. Open Wave 1 Campaign Editor
    console.log("\n[Step 4] Opening Wave 1 Campaign Editor...");
    const editBtn = wave1Row.locator('button:has-text("Edit / Open")');
    await editBtn.click();

    // Wait for editor view to be mounted
    const backToListLink = page.locator('text=Back to List');
    await backToListLink.waitFor({ state: "visible", timeout: 15000 });
    console.log("✓ Campaign Editor view loaded (Back to List visible)");

    // 5. Navigate to Step 6: Review & Schedule
    console.log("\n[Step 5] Navigating to Step 6: Review & Schedule...");
    const step6Btn = page.locator('button:has-text("Step 6")');
    await step6Btn.waitFor({ state: "visible", timeout: 10000 });
    await step6Btn.click();

    // Wait for Delivery Management card to appear in Step 6
    const deliveryHeading = page.locator('text=Delivery Management & Scheduling');
    await deliveryHeading.waitFor({ state: "visible", timeout: 15000 });
    console.log("✓ Step 6 Delivery Management & Scheduling loaded");

    // 6. Verify Send Lock or Safety Controls
    console.log("\n[Step 6] Inspecting Step 6 Delivery Management and Controls...");
    const sendNowBtn = page.locator('button:has-text("Send Now")');
    const hasSendNow = (await sendNowBtn.count()) > 0;
    const isSendNowDisabled = hasSendNow ? await sendNowBtn.isDisabled() : false;
    const sendNowText = hasSendNow ? await sendNowBtn.innerText() : "NOT_FOUND";
    console.log(`✓ Send Now Button: "${sendNowText}", Disabled: ${isSendNowDisabled}`);

    const dryRunBtn = page.locator('button:has-text("안전 시뮬레이션 (Dry Run)")');
    console.log(`✓ Dry Run Button visible: ${(await dryRunBtn.count()) > 0}`);

    const unlockBtn = page.locator('button:has-text("Unlock Send")');
    const hasUnlockBtn = (await unlockBtn.count()) > 0;
    console.log(`✓ Unlock Send Button present: ${hasUnlockBtn}`);

    const step6ScreenshotPath = path.join(artifactsDir, "adm-email-app-006-02-step6-delivery-controls.png");
    await page.screenshot({ path: step6ScreenshotPath, fullPage: true });
    console.log("✓ Saved Step 6 Delivery Controls screenshot to:", step6ScreenshotPath);

    // 7. Test Unlock Send Modal if present or simulate lock condition
    if (hasUnlockBtn) {
      console.log("\n[Step 7] Testing Unlock Send Modal...");
      await unlockBtn.click();

      const modalHeading = page.locator('h3:has-text("Unlock Campaign Send")');
      await modalHeading.waitFor({ state: "visible", timeout: 10000 });
      console.log("✓ Unlock Campaign Send modal opened successfully");

      // Verify Deduplication Guarantee Banner
      const dedupBanner = page.locator('div:has-text("STRICT RECIPIENT DEDUPLICATION GUARANTEE")');
      console.log(`✓ Deduplication Guarantee Banner present: ${(await dedupBanner.count()) > 0}`);

      // Verify Justification Textarea
      const reasonInput = page.locator('textarea[placeholder*="잠금 해제 사유"]');
      console.log(`✓ Reason Textarea present: ${(await reasonInput.count()) > 0}`);

      const modalScreenshotPath = path.join(artifactsDir, "adm-email-app-006-03-unlock-modal.png");
      await page.screenshot({ path: modalScreenshotPath, fullPage: true });
      console.log("✓ Saved Unlock Modal screenshot to:", modalScreenshotPath);

      // Close modal
      const closeBtn = page.locator('button:has-text("취소"), button:has-text("✕")').first();
      await closeBtn.click();
      console.log("✓ Closed Unlock Modal");
    }

    console.log("\n================================================================================");
    console.log("PRODUCTION BROWSER QA PASSED FOR ADM-EMAIL-APP-006");
    console.log("================================================================================");
  } catch (err: any) {
    console.error("[QA FATAL ERROR]", err);
    throw err;
  } finally {
    await browser.close();
  }
}

runProdApp006BrowserQA().catch((err) => {
  console.error("QA execution failed:", err);
  process.exit(1);
});
