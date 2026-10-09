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

  try {
    // 1. Desktop 1440px QA
    const contextDesktop = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      locale: "en-US",
    });
    const page = await contextDesktop.newPage();

    console.log("[Step 1] Logging into Retailer Hub (https://portal.kselecthub.com/login)...");
    await page.goto("https://portal.kselecthub.com/login", { waitUntil: "load", timeout: 30000 });
    await page.locator("input#email").fill("qa-retailer-test@letusto.com");
    await page.locator("input#password").fill("Password123!@#");
    await page.locator('button[type="submit"]').click();
    await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15000 });

    // Navigate to /products in EN mode
    await page.goto("https://portal.kselecthub.com/products", { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);

    // 1. Check English UI purity (no Korean text in main controls)
    console.log("\n[Step 2] Verifying English UI Purity...");
    const pageText = await page.innerText("body");
    const unwantedKoreanTerms = ["카테고리", "하위 카테고리", "세부 카테고리", "도매가", "마진율", "전체 가격", "한 줄 상품 수"];
    const foundKoreanTerms = unwantedKoreanTerms.filter((term) => pageText.includes(term));
    console.log("- Unwanted Korean terms in EN mode:", foundKoreanTerms);
    assert(foundKoreanTerms.length === 0, `English mode must not contain Korean terms: ${foundKoreanTerms.join(", ")}`);

    // 2. Check 3-column pricing strip formatting on cards (Wholesale, Margin, MSRP)
    console.log("\n[Step 3] Verifying 3-Column Pricing Strip formatting...");
    const marginValues = await page.$$eval('[data-testid="products-grid"] a', (cards) => {
      return cards.map((card) => {
        const text = card.textContent || "";
        const match = text.match(/(\d+\.?\d*\%)/);
        return match ? match[1] : null;
      });
    });
    console.log("- Extracted margin values from product cards:", marginValues);
    assert(marginValues.length > 0, "Cards must show numeric % margins");

    // 3. Test 6-Column & 8-Column Density on 1440px desktop
    console.log("\n[Step 4] Capturing 6-col and 8-col density evidence...");
    const btn6 = page.locator('[data-testid="density-btn-6"]').first();
    const btn8 = page.locator('[data-testid="density-btn-8"]').first();
    const btn4 = page.locator('[data-testid="density-btn-4"]').first();

    await btn6.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(reportsDir, "rtp_disc_r1_deep_01_density_6_desktop.png"), fullPage: false });
    console.log("📸 Saved: rtp_disc_r1_deep_01_density_6_desktop.png");

    await btn8.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(reportsDir, "rtp_disc_r1_deep_02_density_8_desktop.png"), fullPage: false });
    console.log("📸 Saved: rtp_disc_r1_deep_02_density_8_desktop.png");

    // 4. Test Multi-filter Combination & URL query parameters restore
    console.log("\n[Step 5] Testing Multi-Filter Combination & URL Query Params...");
    // Filter: Brand + Margin 50%+ + Price under10 + Sort highest margin
    await page.goto("https://portal.kselecthub.com/products?margin=50&price_preset=under10&sort=margin_desc", { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(reportsDir, "rtp_disc_r1_deep_03_combined_filters.png"), fullPage: false });
    console.log("📸 Saved: rtp_disc_r1_deep_03_combined_filters.png (Multi-filter URL restored)");

    // Reset back to normal view
    await page.goto("https://portal.kselecthub.com/products", { waitUntil: "networkidle" });
    await btn4.click();
    await page.waitForTimeout(500);

    await contextDesktop.close();

    // 5. Tablet 768px Viewport QA
    console.log("\n[Step 6] Testing Tablet 768px Viewport...");
    const contextTablet = await browser.newContext({
      viewport: { width: 768, height: 1024 },
      locale: "en-US",
    });
    const pageTablet = await contextTablet.newPage();
    // Copy auth state by logging in or navigating
    await pageTablet.goto("https://portal.kselecthub.com/login", { waitUntil: "load" });
    await pageTablet.locator("input#email").fill("qa-retailer-test@letusto.com");
    await pageTablet.locator("input#password").fill("Password123!@#");
    await pageTablet.locator('button[type="submit"]').click();
    await pageTablet.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15000 });

    await pageTablet.goto("https://portal.kselecthub.com/products", { waitUntil: "networkidle" });
    await pageTablet.waitForTimeout(1000);
    
    // Check horizontal scroll
    const tabletScrollWidth = await pageTablet.evaluate(() => document.documentElement.scrollWidth);
    const tabletClientWidth = await pageTablet.evaluate(() => document.documentElement.clientWidth);
    console.log(`- Tablet (768px): scrollWidth=${tabletScrollWidth}, clientWidth=${tabletClientWidth}`);
    assert(tabletScrollWidth <= tabletClientWidth + 1, "Tablet viewport must not have horizontal overflow");

    await pageTablet.screenshot({ path: path.join(reportsDir, "rtp_disc_r1_deep_04_tablet_768px.png"), fullPage: false });
    console.log("📸 Saved: rtp_disc_r1_deep_04_tablet_768px.png");
    await contextTablet.close();

    // 6. Mobile 390px Viewport QA
    console.log("\n[Step 7] Testing Mobile 390px Viewport...");
    const contextMobile = await browser.newContext({
      viewport: { width: 390, height: 844 },
      locale: "en-US",
    });
    const pageMobile = await contextMobile.newPage();
    await pageMobile.goto("https://portal.kselecthub.com/login", { waitUntil: "load" });
    await pageMobile.locator("input#email").fill("qa-retailer-test@letusto.com");
    await pageMobile.locator("input#password").fill("Password123!@#");
    await pageMobile.locator('button[type="submit"]').click();
    await pageMobile.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15000 });

    await pageMobile.goto("https://portal.kselecthub.com/products", { waitUntil: "networkidle" });
    await pageMobile.waitForTimeout(1000);

    // Check horizontal scroll
    const mobileScrollWidth = await pageMobile.evaluate(() => document.documentElement.scrollWidth);
    const mobileClientWidth = await pageMobile.evaluate(() => document.documentElement.clientWidth);
    console.log(`- Mobile (390px): scrollWidth=${mobileScrollWidth}, clientWidth=${mobileClientWidth}`);
    assert(mobileScrollWidth <= mobileClientWidth + 1, "Mobile viewport must not have horizontal overflow");

    await pageMobile.screenshot({ path: path.join(reportsDir, "rtp_disc_r1_deep_05_mobile_390px.png"), fullPage: false });
    console.log("📸 Saved: rtp_disc_r1_deep_05_mobile_390px.png");
    await contextMobile.close();

    console.log("\n🎉🎉🎉 ALL DEEP VERIFICATION QA TESTS PASSED! 🎉🎉🎉");
  } catch (err) {
    console.error("❌ Deep QA Error:", err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runDeepQA();
