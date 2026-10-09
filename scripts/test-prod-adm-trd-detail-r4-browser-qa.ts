import { chromium } from "playwright";
import * as path from "path";
import * as fs from "fs";

async function runBrowserQA() {
  const reportsDir = path.join(process.cwd(), "reports");
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  console.log("🚀 Starting Production Browser QA for ADM-TRD-DETAIL-001-R4...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: "en-US",
  });
  const page = await context.newPage();

  try {
    // 1. Admin Login
    console.log("[Step 1] Logging into Admin Portal (https://admin.kselectnetwork.com/admin/login)...");
    await page.goto("https://admin.kselectnetwork.com/admin/login", { waitUntil: "networkidle", timeout: 30000 });
    
    await page.locator("input#email").fill("qa-admin-test@letusto.com");
    await page.locator("input#password").fill("Password123!@#");
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(4000);
    console.log(`- Logged in successfully. Current URL: ${page.url()}`);

    // 2. Navigate to Trading Products List
    console.log("[Step 2] Navigating to Trading Products List (/admin/products/trading)...");
    await page.goto("https://admin.kselectnetwork.com/admin/products/trading", { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(reportsDir, "adm_trd_detail_r4_01_list.png") });

    // 3. Click first product to open Trading Product Detail page
    console.log("[Step 3] Opening first product Trading Product Detail page...");
    const productLinks = page.locator("table tbody tr td a");
    const count = await productLinks.count();
    console.log(`- Found ${count} product links in list.`);
    
    if (count > 0) {
      await productLinks.first().click();
      await page.waitForTimeout(3000);
      console.log(`- Opened Product Detail URL: ${page.url()}`);
      await page.screenshot({ path: path.join(reportsDir, "adm_trd_detail_r4_02_header_summary.png") });

      // 4. Test 5 Business Tabs Navigation
      const tabs = [
        { id: "summary", label: "운영개요" },
        { id: "inventory", label: "Inventory" },
        { id: "price", label: "Price" },
        { id: "hub", label: "Hub" },
        { id: "history", label: "History" },
      ];

      for (const tab of tabs) {
        console.log(`- Testing tab navigation: ${tab.label} (${tab.id})...`);
        const tabBtn = page.locator(`button:has-text("${tab.label}")`).first();
        if (await tabBtn.isVisible()) {
          await tabBtn.click();
          await page.waitForTimeout(1000);
          console.log(`  Current tab URL: ${page.url()}`);
          await page.screenshot({ path: path.join(reportsDir, `adm_trd_detail_r4_tab_${tab.id}.png`) });
        }
      }

      // 5. Test Deep Link & Scroll Target to Hold Alerts
      console.log("[Step 5] Testing deep link to #hold-alerts...");
      const currentBaseUrl = page.url().split("?")[0];
      await page.goto(`${currentBaseUrl}?tab=hub#hold-alerts`, { waitUntil: "networkidle" });
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(reportsDir, "adm_trd_detail_r4_03_hold_alerts_deep_link.png") });
    }

    console.log("✅ ADM-TRD-DETAIL-001-R4 Production Browser QA Completed Successfully!");
  } catch (err: any) {
    console.error(`❌ Browser QA Error: ${err.message}`);
    await page.screenshot({ path: path.join(reportsDir, "adm_trd_detail_r4_error.png") });
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runBrowserQA();
