import { chromium } from "playwright";
import * as fs from "fs";
import * as path from "path";

const TARGET_COMMIT = "7bacfaf20b365bbe884875decb16bb65fe1277f2";
const BASE_URL = "https://portal.kselecthub.com";

async function main() {
  console.log("=== RTP-PROD-DISC-001-R2 Production Browser QA ===");
  console.log(`Target Commit SHA: ${TARGET_COMMIT}`);

  // 1. Poll Vercel deployment
  console.log("\n[Step 1] Polling Vercel Production Deployment...");
  let currentSha = "";
  const maxAttempts = 30;
  for (let i = 1; i <= maxAttempts; i++) {
    try {
      const res = await fetch(`${BASE_URL}/api/diagnostics`, {
        headers: { "Cache-Control": "no-cache" },
      });
      if (res.ok) {
        const data = await res.json();
        currentSha = data.deployment?.commitSha || "";
        console.log(`Attempt ${i}/${maxAttempts}: Live SHA = ${currentSha}`);
        if (currentSha.startsWith(TARGET_COMMIT.substring(0, 7)) || currentSha === TARGET_COMMIT) {
          console.log(`>>> Production deployment is LIVE with commit ${currentSha}!`);
          break;
        }
      }
    } catch (e: any) {
      console.log(`Attempt ${i}/${maxAttempts}: Failed to fetch diagnostics (${e.message})`);
    }
    if (i < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 6000));
    }
  }

  const reportsDir = path.join(process.cwd(), "reports");
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  
  // Context 1: Desktop 1440x900
  console.log("\n[Step 2] Testing Desktop 1440x900 Viewport & 2nd Row Visibility...");
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: "en-US",
  });
  const page = await context.newPage();

  // Login
  await page.goto(`${BASE_URL}/login`, { waitUntil: "load", timeout: 30000 });
  await page.locator("input#email").fill("qa-retailer-test@letusto.com");
  await page.locator("input#password").fill("Password123!@#");
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 20000 });

  // Navigate to /products
  await page.goto(`${BASE_URL}/products`, { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.waitForTimeout(2500);

  // Measure heights and positions
  const measurements = await page.evaluate(() => {
    const grid = document.querySelector('[data-testid="products-grid"]');
    const cards = grid ? Array.from(grid.children) : [];
    const gridRect = grid?.getBoundingClientRect();

    let row1CardRect = null;
    let row2CardRect = null;
    let row2ImageRect = null;

    if (cards.length > 0) {
      row1CardRect = cards[0].getBoundingClientRect();
    }
    if (cards.length > 4) {
      row2CardRect = cards[4].getBoundingClientRect();
      const img = cards[4].querySelector("img, .aspect-\\[4\\/3\\]");
      row2ImageRect = img ? img.getBoundingClientRect() : null;
    }

    return {
      windowHeight: window.innerHeight,
      windowWidth: window.innerWidth,
      gridTop: gridRect ? Math.round(gridRect.top) : null,
      row1CardTop: row1CardRect ? Math.round(row1CardRect.top) : null,
      row1CardBottom: row1CardRect ? Math.round(row1CardRect.bottom) : null,
      row1CardHeight: row1CardRect ? Math.round(row1CardRect.height) : null,
      row2CardTop: row2CardRect ? Math.round(row2CardRect.top) : null,
      row2ImageTop: row2ImageRect ? Math.round(row2ImageRect.top) : null,
      row2ImageBottom: row2ImageRect ? Math.round(row2ImageRect.bottom) : null,
      isRow2ImageVisibleInFold: row2ImageRect ? row2ImageRect.top < window.innerHeight : false,
      totalCardsCount: cards.length,
    };
  });

  console.log("\n--- Above-the-Fold Geometry Report (1440x900) ---");
  console.log(`Viewport Height: ${measurements.windowHeight}px`);
  console.log(`Product Grid Top Y-Position: ${measurements.gridTop}px`);
  console.log(`Row 1 Card Height: ${measurements.row1CardHeight}px (Y: ${measurements.row1CardTop}px ~ ${measurements.row1CardBottom}px)`);
  console.log(`Row 2 Card Top Y-Position: ${measurements.row2CardTop}px`);
  console.log(`Row 2 Image Top: ${measurements.row2ImageTop}px, Bottom: ${measurements.row2ImageBottom}px`);
  console.log(`Row 2 Image Visible Above Fold (< 900px): ${measurements.isRow2ImageVisibleInFold ? "YES (PASS)" : "NO"}`);

  await page.screenshot({ path: path.join(reportsDir, "rtp_disc_r2_01_desktop_1440x900_above_fold.png") });

  // Context 2: Desktop 1920x1080
  console.log("\n[Step 3] Testing Desktop 1920x1080 Viewport...");
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(reportsDir, "rtp_disc_r2_02_desktop_1920x1080.png") });

  // Context 3: Density controls 4, 6, 8
  console.log("\n[Step 4] Testing Grid Density (4, 6, 8 columns)...");
  await page.locator('[data-testid="density-btn-6"]').click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(reportsDir, "rtp_disc_r2_03_density_6.png") });

  await page.locator('[data-testid="density-btn-8"]').click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(reportsDir, "rtp_disc_r2_04_density_8.png") });

  // Reload to test persistence
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  const persistedDensity = await page.locator('[data-testid="products-grid"]').getAttribute("data-density");
  console.log(`Persisted Density after reload: ${persistedDensity} columns`);
  await page.screenshot({ path: path.join(reportsDir, "rtp_disc_r2_05_density_persisted.png") });

  // Reset back to 4 columns
  await page.locator('[data-testid="density-btn-4"]').click();
  await page.waitForTimeout(600);

  // Context 4: Category Drilldown
  console.log("\n[Step 5] Testing Category Hierarchy Drilldown...");
  // Click first category button (SKINCARE if available)
  const catButtons = page.locator('button:has-text("SKINCARE"), button:has-text("MAKEUP")');
  if (await catButtons.count() > 0) {
    await catButtons.first().click();
    await page.waitForTimeout(1500);
    console.log(`Selected category: ${page.url()}`);
    await page.screenshot({ path: path.join(reportsDir, "rtp_disc_r2_06_category_drilldown.png") });
  }

  // Context 5: Purchasing Filters
  console.log("\n[Step 6] Testing Purchasing Filters (Margin, Stock, Price presets)...");
  // Click Margin 50%+
  const margin50Btn = page.locator('button:has-text("50%+")');
  if (await margin50Btn.count() > 0) {
    await margin50Btn.click();
    await page.waitForTimeout(1500);
  }

  // Click Custom Price
  const customPriceBtn = page.locator('button:has-text("Custom")');
  if (await customPriceBtn.count() > 0) {
    await customPriceBtn.click();
    await page.waitForTimeout(500);
    await page.locator('input[placeholder="Min"]').fill("15");
    await page.locator('input[placeholder="Max"]').fill("35");
    await page.locator('button:has-text("Apply")').click();
    await page.waitForTimeout(1500);
  }
  await page.screenshot({ path: path.join(reportsDir, "rtp_disc_r2_07_commercial_filters.png") });

  // Context 6: Tablet & Mobile
  console.log("\n[Step 7] Testing Responsive Viewports...");
  // Clear filters
  const resetBtn = page.locator('button:has-text("Reset Filters"), a:has-text("Reset Filters")');
  if (await resetBtn.count() > 0) {
    await resetBtn.first().click();
    await page.waitForTimeout(1500);
  }

  // Tablet 768x1024
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(reportsDir, "rtp_disc_r2_08_tablet_768px.png") });

  // Mobile 390x844
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(reportsDir, "rtp_disc_r2_09_mobile_390px.png") });

  // Context 7: Korean UI
  console.log("\n[Step 8] Testing Korean Language Toggle...");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => {
    document.cookie = "NEXT_LOCALE=ko; path=/; max-age=31536000";
    localStorage.setItem("kselect_locale", "ko");
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(reportsDir, "rtp_disc_r2_10_korean_ui.png") });

  // Reset cookie to en
  await page.evaluate(() => {
    document.cookie = "NEXT_LOCALE=en; path=/; max-age=31536000";
    localStorage.setItem("kselect_locale", "en");
  });

  await browser.close();
  console.log("\n=== RTP-PROD-DISC-001-R2 QA Completed Successfully! ===");
}

main().catch((err) => {
  console.error("QA Test Error:", err);
  process.exit(1);
});
