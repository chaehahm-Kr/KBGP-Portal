const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const OUTPUT_DIR = path.join(
  __dirname,
  "..",
  "Manuals",
  "MAN-B-INT-001_Intelligence",
  "02_CLAUDE_PACKAGE",
  "02_SCREENSHOTS"
);

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const PORTAL_URL = "https://portal.kselectnetwork.com";
const ADMIN_URL = "https://admin.kselectnetwork.com";

async function main() {
  console.log("Starting production screenshot capture for MAN-B-INT-001...");

  const browser = await chromium.launch({ headless: true });

  // ----------------------------------------------------
  // PORTAL SESSIONS & SCREENSHOTS (SCR-B-INT-001 & 002)
  // ----------------------------------------------------
  const portalContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    colorScheme: "light",
  });
  const portalPage = await portalContext.newPage();

  console.log("Logging into Brand Portal...");
  await portalPage.goto(`${PORTAL_URL}/portal/login`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await portalPage.locator("input#email, input[type='email']").fill("qa-portal-test@letusto.com");
  await portalPage.locator("input#password, input[type='password']").fill("Password123!@#");
  await portalPage.locator('button[type="submit"]').click();
  await portalPage.waitForTimeout(3000);

  // 1. SCR-B-INT-001: Grounded Knowledge Assistant Main View
  console.log("Capturing SCR-B-INT-001.png...");
  await portalPage.goto(`${PORTAL_URL}/portal/help/ask`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await portalPage.waitForTimeout(2000);
  await portalPage.screenshot({ path: path.join(OUTPUT_DIR, "SCR-B-INT-001.png") });

  // 2. SCR-B-INT-002: Grounded Knowledge Assistant Q&A Result & Official Citations
  console.log("Capturing SCR-B-INT-002.png...");
  const questionInput = portalPage.locator("input[placeholder*='질문'], textarea[placeholder*='질문'], input[type='text']").first();
  if (await questionInput.isVisible()) {
    await questionInput.fill("브랜드 등록 전제조건과 상표권 정책이 어떻게 되나요?");
    const submitBtn = portalPage.locator("button:has-text('질문하기'), button:has-text('Ask'), button[type='submit']").first();
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
      await portalPage.waitForTimeout(3000);
    }
  }
  await portalPage.screenshot({ path: path.join(OUTPUT_DIR, "SCR-B-INT-002.png") });

  await portalContext.close();

  // ----------------------------------------------------
  // ADMIN SESSIONS & SCREENSHOTS (SCR-B-INT-003 ~ 011)
  // ----------------------------------------------------
  const adminContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    colorScheme: "light",
  });
  const adminPage = await adminContext.newPage();

  console.log("Logging into Admin Console...");
  await adminPage.goto(`${ADMIN_URL}/admin/login`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await adminPage.locator("input#email, input[type='email']").fill("qa-admin-test@letusto.com");
  await adminPage.locator("input#password, input[type='password']").fill("Password123!@#");
  await adminPage.locator('button[type="submit"]').click();
  await adminPage.waitForTimeout(3000);

  // 3. SCR-B-INT-003: Admin Insights System Overview Dashboard
  console.log("Capturing SCR-B-INT-003.png...");
  await adminPage.goto(`${ADMIN_URL}/admin/insights`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await adminPage.waitForTimeout(2000);
  await adminPage.screenshot({ path: path.join(OUTPUT_DIR, "SCR-B-INT-003.png") });

  // 4. SCR-B-INT-004: Auto-Engine Moderation & Review Queue
  console.log("Capturing SCR-B-INT-004.png...");
  await adminPage.goto(`${ADMIN_URL}/admin/insights/queue`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await adminPage.waitForTimeout(2000);
  await adminPage.screenshot({ path: path.join(OUTPUT_DIR, "SCR-B-INT-004.png") });

  // 5. SCR-B-INT-005: Claim Risk Audit Panel & Fact-Check Summary
  console.log("Capturing SCR-B-INT-005.png...");
  await adminPage.goto(`${ADMIN_URL}/admin/insights/4ca00b0f-09d1-4b5e-9edf-c59e2da82114`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await adminPage.waitForTimeout(2000);
  // Scroll slightly to ensure Claim Risk Audit Summary is well framed
  await adminPage.evaluate(() => window.scrollBy(0, 300));
  await adminPage.waitForTimeout(1000);
  await adminPage.screenshot({ path: path.join(OUTPUT_DIR, "SCR-B-INT-005.png") });

  // 6. SCR-B-INT-006: Admin Insights All Articles Library
  console.log("Capturing SCR-B-INT-006.png...");
  await adminPage.goto(`${ADMIN_URL}/admin/insights/all`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await adminPage.waitForTimeout(2000);
  await adminPage.screenshot({ path: path.join(OUTPUT_DIR, "SCR-B-INT-006.png") });

  // 7. SCR-B-INT-007: Article Editor Detail View
  console.log("Capturing SCR-B-INT-007.png...");
  await adminPage.goto(`${ADMIN_URL}/admin/insights/4ca00b0f-09d1-4b5e-9edf-c59e2da82114`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await adminPage.evaluate(() => window.scrollTo(0, 0));
  await adminPage.waitForTimeout(2000);
  await adminPage.screenshot({ path: path.join(OUTPUT_DIR, "SCR-B-INT-007.png") });

  // 8. SCR-B-INT-008: Automation Runs Execution Log
  console.log("Capturing SCR-B-INT-008.png...");
  await adminPage.goto(`${ADMIN_URL}/admin/insights/automation-runs`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await adminPage.waitForTimeout(2000);
  await adminPage.screenshot({ path: path.join(OUTPUT_DIR, "SCR-B-INT-008.png") });

  // 9. SCR-B-INT-009: Master Editorial Rules & Daily Quota Configuration
  console.log("Capturing SCR-B-INT-009.png...");
  await adminPage.goto(`${ADMIN_URL}/admin/insights/rules`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await adminPage.waitForTimeout(2000);
  await adminPage.screenshot({ path: path.join(OUTPUT_DIR, "SCR-B-INT-009.png") });

  // 10. SCR-B-INT-010: Categories & Author Profiles Management
  console.log("Capturing SCR-B-INT-010.png...");
  await adminPage.goto(`${ADMIN_URL}/admin/insights/categories`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await adminPage.waitForTimeout(2000);
  await adminPage.screenshot({ path: path.join(OUTPUT_DIR, "SCR-B-INT-010.png") });

  // 11. SCR-B-INT-011: Reader Helpfulness Feedback Analytics Panel
  console.log("Capturing SCR-B-INT-011.png...");
  await adminPage.goto(`${ADMIN_URL}/admin/insights/ca6626db-3d2d-4dbf-aaae-bd9e04c4dad7`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await adminPage.evaluate(() => window.scrollBy(0, 600));
  await adminPage.waitForTimeout(2000);
  await adminPage.screenshot({ path: path.join(OUTPUT_DIR, "SCR-B-INT-011.png") });

  await adminContext.close();
  await browser.close();

  console.log("Successfully captured all 11 production screenshots!");
}

main().catch(console.error);
