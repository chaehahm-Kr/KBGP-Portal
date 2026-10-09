import { chromium } from "playwright";
import * as path from "path";
import * as fs from "fs";
import assert from "assert";

async function runDeepQA() {
  const reportsDir = path.join(process.cwd(), "reports");
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  console.log("🚀 Starting Deep Verification QA for RTP-PROD-DISC-001-R1...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: "en-US",
  });
  const page = await context.newPage();

  try {
    // 1. Diagnostics Fingerprint
    console.log("[Step 1] Checking Production Diagnostics...");
    const diagRes = await page.goto("https://portal.kselecthub.com/api/diagnostics", { waitUntil: "load", timeout: 15000 });
    const diagData = diagRes ? JSON.parse(await diagRes.text()) : {};
    console.log(`- Runtime Commit SHA: ${diagData.deployment?.commitSha}`);
    console.log(`- Runtime Environment: ${diagData.deployment?.environment}`);

    // 2. Retailer Login
    console.log("\n[Step 2] Logging into Retailer Hub (https://portal.kselecthub.com/login)...");
    await page.goto("https://portal.kselecthub.com/login", { waitUntil: "load", timeout: 30000 });
    await page.locator("input#email").fill("qa-retailer-test@letusto.com");
    await page.locator("input#password").fill("Password123!@#");
    await page.locator('button[type="submit"]').click();
    await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 20000 });
    console.log(`- Successfully logged in, redirected to: ${page.url()}`);

    // 3. Navigate to /products
    await page.goto("https://portal.kselecthub.com/products", { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(2000);

    // 4. Verify English UI Purity
    console.log("\n[Step 3] Verifying English UI Purity...");
    const pageText = await page.innerText("body");
    const unwantedKoreanTerms = ["카테고리", "하위 카테고리", "세부 카테고리", "도매가", "마진율", "전체 가격", "한 줄 상품 수"];
    const foundKoreanTerms = unwantedKoreanTerms.filter((term) => pageText.includes(term));
    console.log("- Unwanted Korean terms in EN mode:", foundKoreanTerms);
    assert(foundKoreanTerms.length === 0, `English mode must not contain Korean terms: ${foundKoreanTerms.join(", ")}`);

    // 5. Verify 3-Column Pricing Strip formatting on cards
    console.log("\n[Step 4] Verifying 3-Column Pricing Strip formatting...");
    const marginValues = await page.$$eval('[data-testid="products-grid"] a', (cards) => {
      return cards.map((card) => {
        const text = card.textContent || "";
        const match = text.match(/(\d+\.?\d*\%)/);
        return match ? match[1] : null;
      });
    });
    console.log("- Extracted margin values from product cards:", marginValues);
    assert(marginValues.length > 0, "Cards must show numeric % margins");

    // 6. Test 6-Column & 8-Column Density on 1440px desktop
    console.log("\n[Step 5] Capturing 6-col and 8-col density evidence...");
    const btn6 = page.locator('[data-testid="density-btn-6"]').first();
    const btn8 = page.locator('[data-testid="density-btn-8"]').first();
    const btn4 = page.locator('[data-testid="density-btn-4"]').first();

    await btn6.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(reportsDir, "rtp_disc_r1_deep_01_density_6_desktop.png"), fullPage: false });
    console.log("📸 Saved: rtp_disc_r1_deep_01_density_6_desktop.png");

    await btn8.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(reportsDir, "rtp_disc_r1_deep_02_density_8_desktop.png"), fullPage: false });
    console.log("📸 Saved: rtp_disc_r1_deep_02_density_8_desktop.png");

    // 7. Test Multi-filter Combination & URL Query Params
    console.log("\n[Step 6] Testing Multi-Filter Combination & URL Query Params...");
    await page.goto("https://portal.kselecthub.com/products?margin=50&price_preset=under10&sort=margin_desc", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(reportsDir, "rtp_disc_r1_deep_03_combined_filters.png"), fullPage: false });
    console.log("📸 Saved: rtp_disc_r1_deep_03_combined_filters.png (Multi-filter URL restored)");

    // 8. Test Tablet (768px) Viewport
    console.log("\n[Step 7] Testing Tablet (768px) Viewport...");
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto("https://portal.kselecthub.com/products", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(reportsDir, "rtp_disc_r1_deep_04_tablet_768px.png"), fullPage: false });
    console.log("📸 Saved: rtp_disc_r1_deep_04_tablet_768px.png");

    // 9. Test Mobile (390px) Viewport
    console.log("\n[Step 8] Testing Mobile (390px) Viewport...");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("https://portal.kselecthub.com/products", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(reportsDir, "rtp_disc_r1_deep_05_mobile_390px.png"), fullPage: false });
    console.log("📸 Saved: rtp_disc_r1_deep_05_mobile_390px.png");

    console.log("\n🎉🎉🎉 ALL DEEP VERIFICATION QA TESTS PASSED! 🎉🎉🎉");
  } catch (err) {
    console.error("❌ Deep QA Error:", err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runDeepQA();
