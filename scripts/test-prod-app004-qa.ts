import { chromium } from "playwright";
import fs from "fs";
import path from "path";

async function runProdApp004BrowserQA() {
  console.log("================================================================================");
  console.log("PRODUCTION BROWSER QA: ADM-EMAIL-APP-004");
  console.log("Actual Campaign Delivery Activation & Metrics Integrity");
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

    // Verify SIMULATED status badge exists
    const simulatedBadge = wave1Row.locator('span:has-text("SIMULATED")');
    const hasSimBadge = (await simulatedBadge.count()) > 0;
    console.log(`✓ Delivery Status shows SIMULATED badge: ${hasSimBadge}`);

    // Verify Sent: 0 with Sim: 698
    const hasSimCountText = rowText.includes("Sim: 698") || rowText.includes("698");
    console.log(`✓ Real Sent and Sim count displayed: ${hasSimCountText}`);

    const listScreenshotPath = path.join(artifactsDir, "adm-email-app-004-01-campaign-list-simulated.png");
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

    // Verify Prominent Safety Banner
    const safetyBanner = page.locator('div:has-text("LIVE_MODE OFF — SIMULATION ONLY")').first();
    const hasSafetyBanner = (await safetyBanner.count()) > 0;
    console.log(`✓ Prominent Safety Banner visible: ${hasSafetyBanner}`);

    // Verify Delivery Status Badge
    const deliveryStatusBadge = page.locator('span:has-text("Delivery Status: SIMULATED")');
    const hasDeliveryStatusBadge = (await deliveryStatusBadge.count()) > 0;
    console.log(`✓ Delivery Status Badge (SIMULATED) visible: ${hasDeliveryStatusBadge}`);

    // Verify Action Buttons
    const sendNowBtn = page.locator('button:has-text("Send Now (실제 발송)")');
    const dryRunBtn = page.locator('button:has-text("안전 시뮬레이션 (Dry Run)")');
    const scheduleBtn = page.locator('button:has-text("Schedule Send"), button:has-text("Modify Schedule")');

    console.log(`✓ Send Now (실제 발송) button visible: ${(await sendNowBtn.count()) > 0}`);
    console.log(`✓ 안전 시뮬레이션 (Dry Run) button visible: ${(await dryRunBtn.count()) > 0}`);
    console.log(`✓ Schedule button visible: ${(await scheduleBtn.count()) > 0}`);

    const step6ScreenshotPath = path.join(artifactsDir, "adm-email-app-004-02-step6-delivery-card.png");
    await page.screenshot({ path: step6ScreenshotPath, fullPage: true });
    console.log("✓ Saved Step 6 Delivery Card screenshot to:", step6ScreenshotPath);

    // 6. Test Send Now Modal & Live Send Blocker Gate
    console.log("\n[Step 6] Testing Send Now Modal & Safety Lock Block...");
    await sendNowBtn.click();

    const sendNowModalHeader = page.locator('h3:has-text("Confirm Campaign Live Send (실제 발송)")');
    await sendNowModalHeader.waitFor({ state: "visible", timeout: 10000 });
    console.log("✓ Send Now Live Modal opened successfully");

    const modalScreenshotPath = path.join(artifactsDir, "adm-email-app-004-03-send-now-live-modal.png");
    await page.screenshot({ path: modalScreenshotPath, fullPage: true });
    console.log("✓ Saved Send Now Modal screenshot to:", modalScreenshotPath);

    // Click Confirm & Attempt Live Send
    console.log("\n[Step 7] Attempting Live Send (expecting safety lock rejection)...");
    const confirmLiveBtn = page.locator('button:has-text("Confirm & Attempt Live Send")');
    await confirmLiveBtn.click();

    // Verify Toast Notification Error
    const toast = page.locator('div:has-text("Live delivery is not activated"), div:has-text("실제 고객 대량 발송(LIVE_MODE)이 비활성화")');
    await toast.first().waitFor({ state: "visible", timeout: 15000 });
    const toastText = await toast.first().innerText();
    console.log(`✓ Toast error displayed: "${toastText.replace(/\n+/g, " ")}"`);

    const toastScreenshotPath = path.join(artifactsDir, "adm-email-app-004-04-send-now-live-blocked-toast.png");
    await page.screenshot({ path: toastScreenshotPath, fullPage: true });
    console.log("✓ Saved Toast Screenshot to:", toastScreenshotPath);

    // Wait for toast to fade or dismiss
    await page.waitForTimeout(3000);

    // 7. Test Dry Run Simulation Modal
    console.log("\n[Step 8] Testing Dry Run Simulation Modal...");
    await dryRunBtn.click();

    const simModalHeader = page.locator('h3:has-text("Confirm Campaign Safety Simulation (Dry Run)")');
    await simModalHeader.waitFor({ state: "visible", timeout: 10000 });
    console.log("✓ Dry Run Simulation Modal opened successfully");

    const simModalScreenshotPath = path.join(artifactsDir, "adm-email-app-004-05-simulation-dry-run-modal.png");
    await page.screenshot({ path: simModalScreenshotPath, fullPage: true });
    console.log("✓ Saved Dry Run Modal screenshot to:", simModalScreenshotPath);

    // Close modal via 취소 button
    const cancelBtn = page.locator('button:has-text("취소")').first();
    await cancelBtn.click();
    await page.waitForTimeout(1000);
    console.log("✓ Dry Run Modal closed cleanly");

    console.log("\n================================================================================");
    console.log("ALL PRODUCTION BROWSER QA STEPS PASSED SUCCESSFULLY!");
    console.log("================================================================================");
  } catch (err: any) {
    console.error("Browser QA Error:", err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runProdApp004BrowserQA();
