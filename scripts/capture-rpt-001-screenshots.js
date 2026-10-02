const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const OUTPUT_DIR = path.join(
  __dirname,
  "..",
  "Manuals",
  "MAN-B-RPT-001_Reports-Performance",
  "02_CLAUDE_PACKAGE",
  "02_SCREENSHOTS"
);

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const PORTAL_URL = "https://portal.kselectnetwork.com";
const ADMIN_URL = "https://admin.kselectnetwork.com";

async function main() {
  console.log("Starting production screenshot capture for MAN-B-RPT-001...");

  const browser = await chromium.launch({ headless: true });

  // ----------------------------------------------------
  // PORTAL SESSIONS & SCREENSHOTS (SCR-B-RPT-001 ~ 007)
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

  // 1. SCR-B-RPT-001: Operational Dashboard Overview
  console.log("Capturing SCR-B-RPT-001.png...");
  await portalPage.goto(`${PORTAL_URL}/portal`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await portalPage.waitForTimeout(2000);
  await portalPage.screenshot({ path: path.join(OUTPUT_DIR, "SCR-B-RPT-001.png") });

  // 2. SCR-B-RPT-002: Action Required Queue & Priority Badges
  console.log("Capturing SCR-B-RPT-002.png...");
  // Look for action required section or scroll to it
  const actionSection = portalPage.locator("text=Action Required, text=실행 필요, text=조치 필요").first();
  if (await actionSection.isVisible()) {
    await actionSection.scrollIntoViewIfNeeded();
    await portalPage.waitForTimeout(1000);
  } else {
    await portalPage.evaluate(() => window.scrollBy(0, 200));
    await portalPage.waitForTimeout(1000);
  }
  await portalPage.screenshot({ path: path.join(OUTPUT_DIR, "SCR-B-RPT-002.png") });

  // 3. SCR-B-RPT-003: PO Pipeline Performance Summary
  console.log("Capturing SCR-B-RPT-003.png...");
  await portalPage.goto(`${PORTAL_URL}/portal/orders/purchase-orders`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await portalPage.waitForTimeout(2000);
  await portalPage.screenshot({ path: path.join(OUTPUT_DIR, "SCR-B-RPT-003.png") });

  // 4. SCR-B-RPT-004: PO Filter Chips & Table Sorting
  console.log("Capturing SCR-B-RPT-004.png...");
  // Click on a filter chip if available
  const inProdChip = portalPage.locator("button:has-text('In Production'), button:has-text('생산 중')").first();
  if (await inProdChip.isVisible()) {
    await inProdChip.click();
    await portalPage.waitForTimeout(1000);
  }
  await portalPage.screenshot({ path: path.join(OUTPUT_DIR, "SCR-B-RPT-004.png") });

  // 5. SCR-B-RPT-005: Finance & Settlement Performance Summary
  console.log("Capturing SCR-B-RPT-005.png...");
  await portalPage.goto(`${PORTAL_URL}/portal/finance`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await portalPage.waitForTimeout(2000);
  await portalPage.screenshot({ path: path.join(OUTPUT_DIR, "SCR-B-RPT-005.png") });

  // 6. SCR-B-RPT-006: Product Catalog Completeness & Issue Alerts
  console.log("Capturing SCR-B-RPT-006.png...");
  await portalPage.goto(`${PORTAL_URL}/portal/products`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await portalPage.waitForTimeout(2000);
  await portalPage.screenshot({ path: path.join(OUTPUT_DIR, "SCR-B-RPT-006.png") });

  // 7. SCR-B-RPT-007: Support Case Resolution Tracking Cards
  console.log("Capturing SCR-B-RPT-007.png...");
  await portalPage.goto(`${PORTAL_URL}/portal/support`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await portalPage.waitForTimeout(2000);
  await portalPage.screenshot({ path: path.join(OUTPUT_DIR, "SCR-B-RPT-007.png") });

  await portalContext.close();

  // ----------------------------------------------------
  // ADMIN SESSIONS & SCREENSHOTS (SCR-B-RPT-008)
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

  // 8. SCR-B-RPT-008: Admin Purchasing Dashboard & Supplier Performance
  console.log("Capturing SCR-B-RPT-008.png...");
  await adminPage.goto(`${ADMIN_URL}/admin/purchasing/dashboard`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await adminPage.waitForTimeout(2000);
  await adminPage.screenshot({ path: path.join(OUTPUT_DIR, "SCR-B-RPT-008.png") });

  await adminContext.close();
  await browser.close();

  console.log("All 8 screenshots captured successfully!");
}

main().catch((err) => {
  console.error("Screenshot capture failed:", err);
  process.exit(1);
});
