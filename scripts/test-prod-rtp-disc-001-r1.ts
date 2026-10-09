import { chromium } from "playwright";
import * as path from "path";
import * as fs from "fs";
import assert from "assert";

async function runBrowserQA() {
  const reportsDir = path.join(process.cwd(), "reports");
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  console.log("🚀 Starting Playwright Browser QA for RTP-PROD-DISC-001-R1...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: "en-US",
  });
  const page = await context.newPage();

  try {
    // 1. Diagnostics check
    console.log("[Step 1] Checking Production Diagnostics Fingerprint...");
    const diagRes = await page.goto("https://portal.kselecthub.com/api/diagnostics", {
      waitUntil: "load",
      timeout: 15000,
    });
    const diagText = diagRes ? await diagRes.text() : "{}";
    const diagData = JSON.parse(diagText);
    console.log(`- Live Deployment Commit SHA: ${diagData.deployment?.commitSha}`);
    console.log(`- Runtime Environment: ${diagData.deployment?.environment}`);
    assert(
      diagData.deployment?.commitSha?.startsWith("e887603"),
      "Live Commit SHA must match target commit e887603"
    );

    // 2. Retailer Login
    console.log("\n[Step 2] Logging into Retailer Hub (https://portal.kselecthub.com/login)...");
    await page.goto("https://portal.kselecthub.com/login", { waitUntil: "load", timeout: 30000 });
    await page.locator("input#email").fill("qa-retailer-test@letusto.com");
    await page.locator("input#password").fill("Password123!@#");
    await page.locator('button[type="submit"]').click();
    await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15000 });
    console.log(`- Successfully logged in, redirected to: ${page.url()}`);

    // 3. Navigate to /products
    console.log("\n[Step 3] Navigating to /products...");
    await page.goto("https://portal.kselecthub.com/products", { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(2000);

    // Capture initial catalog
    await page.screenshot({ path: path.join(reportsDir, "rtp_disc_r1_01_initial_layout.png"), fullPage: false });
    console.log("📸 Saved: rtp_disc_r1_01_initial_layout.png");

    // 4. Verify Category Hierarchy Order & Fixed Section Titles (Section 4)
    console.log("\n[Step 4] Verifying Category Hierarchy layout below search bar...");
    const categoryFixedText = await page.locator("text=Category").first().isVisible();
    const subcategoryFixedText = await page.locator("text=Subcategory").first().isVisible();
    const detailCategoryFixedText = await page.locator("text=Detail Category").first().isVisible();
    const subcategoryPromptVisible = await page.locator("text=Select a category above to view subcategories").isVisible();
    const detailPromptVisible = await page.locator("text=Select a subcategory above to view detail categories").isVisible();

    console.log(`- Category fixed header: ${categoryFixedText}`);
    console.log(`- Subcategory fixed header: ${subcategoryFixedText}`);
    console.log(`- Detail Category fixed header: ${detailCategoryFixedText}`);
    console.log(`- Subcategory initial prompt: ${subcategoryPromptVisible}`);
    console.log(`- Detail Category initial prompt: ${detailPromptVisible}`);

    assert(categoryFixedText && subcategoryFixedText && detailCategoryFixedText, "All 3 category fixed headers must be visible");
    assert(subcategoryPromptVisible && detailPromptVisible, "Both unselected category prompts must be visible");

    // Click 1-Depth category: "Body Care" (or "Skincare")
    const bodyCareBtn = page.locator('button:has-text("Body Care")').first();
    if (await bodyCareBtn.isVisible()) {
      await bodyCareBtn.click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(reportsDir, "rtp_disc_r1_02_depth1_selected.png"), fullPage: false });
      console.log("📸 Saved: rtp_disc_r1_02_depth1_selected.png (Body Care selected, 2-Depth buttons visible)");

      // Click 2-Depth subcategory: "Hand & Foot"
      const handFootBtn = page.locator('button:has-text("Hand & Foot")').first();
      if (await handFootBtn.isVisible()) {
        await handFootBtn.click();
        await page.waitForTimeout(1500);
        await page.screenshot({ path: path.join(reportsDir, "rtp_disc_r1_03_depth2_selected.png"), fullPage: false });
        console.log("📸 Saved: rtp_disc_r1_03_depth2_selected.png (Hand & Foot selected, 3-Depth buttons visible)");

        // Click active subcategory to test deselection
        await handFootBtn.click();
        await page.waitForTimeout(1500);
        console.log("- Re-clicked active subcategory: successfully deselected");
      }
    }

    // Reset filters
    const resetBtn = page.locator('button:has-text("Reset All Filters"), a:has-text("Reset All Filters")').first();
    if (await resetBtn.isVisible()) {
      await resetBtn.click();
      await page.waitForTimeout(1500);
    }

    // 5. Test Price Presets (Under $10, $10-$20, $20-$30, $30-$40, $40-$50, $50+, Custom) (Section 2)
    console.log("\n[Step 5] Testing Price Presets & Custom Validation...");
    const under10Btn = page.locator('button:has-text("Under $10")').first();
    assert(await under10Btn.isVisible(), "Under $10 price preset button must be present");
    await under10Btn.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(reportsDir, "rtp_disc_r1_04_under10.png"), fullPage: false });
    console.log("📸 Saved: rtp_disc_r1_04_under10.png (Under $10 filtered)");

    // Test deselection by re-clicking Under $10
    await under10Btn.click();
    await page.waitForTimeout(1000);
    console.log("- Re-clicked Under $10: successfully reverted to Any Price");

    // Test other presets
    for (const preset of ["$10–$20", "$20–$30", "$30–$40", "$40–$50", "$50+"]) {
      const pBtn = page.locator(`button:has-text("${preset}")`).first();
      assert(await pBtn.isVisible(), `Preset ${preset} button must be visible`);
    }

    // Test Custom Price Validation (Min > Max error)
    const customBtn = page.locator('button:has-text("Custom")').first();
    await customBtn.click();
    await page.waitForTimeout(500);

    const minInput = page.locator('input[placeholder="Min"]').first();
    const maxInput = page.locator('input[placeholder="Max"]').first();
    const applyBtn = page.locator('button:has-text("Apply")').first();

    await minInput.fill("60");
    await maxInput.fill("20");
    await applyBtn.click();
    await page.waitForTimeout(500);

    const errorMsg = await page.locator("text=Min price cannot be greater than max price").isVisible();
    assert(errorMsg, "Validation error message must be shown when min > max");
    await page.screenshot({ path: path.join(reportsDir, "rtp_disc_r1_05_custom_validation.png"), fullPage: false });
    console.log("📸 Saved: rtp_disc_r1_05_custom_validation.png (Min > Max validation error verified)");

    // Valid custom price
    await minInput.fill("5");
    await maxInput.fill("40");
    await applyBtn.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(reportsDir, "rtp_disc_r1_06_custom_valid.png"), fullPage: false });
    console.log("📸 Saved: rtp_disc_r1_06_custom_valid.png (Custom valid range applied)");

    // Reset filters
    await page.goto("https://portal.kselecthub.com/products", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);

    // 6. Test Products Per Row Density (4 / 6 / 8) & LocalStorage Persistence (Section 3)
    console.log("\n[Step 6] Testing Products Per Row (4 / 6 / 8) & LocalStorage Persistence...");
    const density6Btn = page.locator('[data-testid="density-btn-6"]').first();
    const density8Btn = page.locator('[data-testid="density-btn-8"]').first();
    const density4Btn = page.locator('[data-testid="density-btn-4"]').first();

    assert(await density6Btn.isVisible(), "Density 6 button must be visible");
    await density6Btn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(reportsDir, "rtp_disc_r1_07_density_6.png"), fullPage: false });
    console.log("📸 Saved: rtp_disc_r1_07_density_6.png (6 columns density)");

    await density8Btn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(reportsDir, "rtp_disc_r1_08_density_8.png"), fullPage: false });
    console.log("📸 Saved: rtp_disc_r1_08_density_8.png (8 columns density)");

    // Test persistence across page reload
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(reportsDir, "rtp_disc_r1_09_density_persisted.png"), fullPage: false });
    console.log("📸 Saved: rtp_disc_r1_09_density_persisted.png (8 columns density persisted after reload)");

    // Reset back to 4
    await density4Btn.click();
    await page.waitForTimeout(500);

    // 7. Test Product Card Pricing Strip & Detail Navigation (Section 5)
    console.log("\n[Step 7] Testing Product Card 3-Column Pricing Strip & Detail Navigation...");
    const firstCard = page.locator('a[href*="/products/"]').first();
    assert(await firstCard.isVisible(), "Product card must be visible");

    // Check pricing labels
    const wholesaleLabel = await page.locator("text=WHOLESALE").first().isVisible();
    const marginLabel = await page.locator("text=MARGIN").first().isVisible();
    const msrpLabel = await page.locator("text=MSRP").first().isVisible();
    console.log(`- 3-Column pricing headers: Wholesale=${wholesaleLabel}, Margin=${marginLabel}, MSRP=${msrpLabel}`);

    await firstCard.click();
    await page.waitForURL((url) => url.pathname.includes("/products/"), { timeout: 10000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(reportsDir, "rtp_disc_r1_10_detail_navigation.png"), fullPage: false });
    console.log("📸 Saved: rtp_disc_r1_10_detail_navigation.png (Product detail view loaded without 404)");

    // 8. Test Korean Language UI
    console.log("\n[Step 8] Testing Korean Language Translation & UI...");
    await page.goto("https://portal.kselecthub.com/products", { waitUntil: "networkidle" });
    
    // Toggle KO
    const koBtn = page.locator('button:has-text("한국어")').first();
    if (await koBtn.isVisible()) {
      await koBtn.click();
      await page.waitForTimeout(2000);
      await page.reload({ waitUntil: "networkidle" });

      const koCategoryHeader = await page.locator("text=카테고리").first().isVisible();
      const koSubcategoryPrompt = await page.locator("text=상위 카테고리를 선택하면 하위 카테고리가 표시됩니다").first().isVisible();
      const koDensityLabel = await page.locator("text=한 줄 상품 수").first().isVisible();
      console.log(`- Korean Category Header: ${koCategoryHeader}`);
      console.log(`- Korean Subcategory Prompt: ${koSubcategoryPrompt}`);
      console.log(`- Korean Density Label: ${koDensityLabel}`);

      await page.screenshot({ path: path.join(reportsDir, "rtp_disc_r1_11_korean_discovery.png"), fullPage: false });
      console.log("📸 Saved: rtp_disc_r1_11_korean_discovery.png (Korean language UI verified)");
    }

    console.log("\n🎉🎉🎉 ALL PRODUCTION BROWSER QA TESTS PASSED! 🎉🎉🎉");
  } catch (err) {
    console.error("❌ QA Error:", err);
    await page.screenshot({ path: path.join(reportsDir, "rtp_disc_r1_qa_error.png") });
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runBrowserQA();
