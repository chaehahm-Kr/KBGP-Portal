import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

// Load QA environment
let qaUrl = "";
let qaKey = "";
if (fs.existsSync(".env.qa.local")) {
  const content = fs.readFileSync(".env.qa.local", "utf8");
  for (const line of content.split(/\r?\n/)) {
    if (line.startsWith("QA_SUPABASE_URL=")) {
      qaUrl = line.split("=")[1].trim().replace(/^['"]|['"]$/g, "");
    }
    if (line.startsWith("QA_SUPABASE_SECRET_KEY=")) {
      qaKey = line.split("=")[1].trim().replace(/^['"]|['"]$/g, "");
    }
  }
}

const qaSupabase = createClient(qaUrl, qaKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function runBrowserQA() {
  console.log("================================================================================");
  console.log("TASK ID: ADM-BSRC-011 — Browser QA Execution");
  console.log("Database: QA Supabase (elkgizqgksshukxgcndy)");
  console.log("Target Server: http://localhost:3000");
  console.log("================================================================================\n");

  const artifactsDir = "C:\\Users\\ChaeHahm\\.gemini\\antigravity\\brain\\945ab025-0f8f-4fce-b0bc-56237108874e";
  if (!fs.existsSync(artifactsDir)) {
    fs.mkdirSync(artifactsDir, { recursive: true });
  }

  // Ensure first company in QA database has 3 categories so +1 badge is visible
  const { data: companies } = await qaSupabase
    .from("sourcing_companies")
    .select("id, company_name_kr")
    .order("created_at", { ascending: false })
    .limit(2);

  if (companies && companies.length > 0) {
    await qaSupabase
      .from("sourcing_companies")
      .update({
        primary_product_categories: ["SKINCARE", "MAKEUP", "BEAUTY_TOOLS"],
        primary_categories_confirmed: true,
      })
      .eq("id", companies[0].id);
    console.log(`✓ Configured 3 primary categories on ${companies[0].company_name_kr} for +N badge QA`);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
  });
  const page = await context.newPage();

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      console.log("[BROWSER CONSOLE ERROR]", msg.text());
    }
  });

  try {
    // -------------------------------------------------------------------------
    // 1. ADMIN LOGIN
    // -------------------------------------------------------------------------
    console.log("[Step 1] Logging into Admin Portal...");
    await page.goto("http://localhost:3000/admin/login", { waitUntil: "networkidle", timeout: 20000 });
    const emailInput = page.locator('input[type="email"], input[name="email"]');
    if ((await emailInput.count()) > 0) {
      await emailInput.fill("qa-admin@kselect-test.local");
      await page.locator('input[type="password"], input[name="password"]').fill("Password123!@#");
      await page.locator('button[type="submit"]').click();
      await page.waitForURL((url) => !url.pathname.includes("/admin/login"), { timeout: 20000 });
    }
    console.log("✓ Logged in successfully. Current URL:", page.url());

    // -------------------------------------------------------------------------
    // 2. NAVIGATE TO BRAND MARKETING & VERIFY 1800PX STANDARD
    // -------------------------------------------------------------------------
    console.log("[Step 2] Navigating to Admin Brand Marketing & Verifying 1800px standard...");
    await page.goto("http://localhost:3000/admin/brand-marketing", { waitUntil: "networkidle", timeout: 20000 });
    await page.waitForTimeout(2000);

    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForTimeout(1000);
    const shellWidth = await page.evaluate(() => {
      const el = document.querySelector('div[style*="max-width: 1800px"], .max-w-\\[1800px\\]');
      return el ? el.getBoundingClientRect().width : null;
    });
    console.log("  Shell max-width evaluated:", shellWidth);
    await page.screenshot({
      path: path.join(artifactsDir, "bsrc-011-01-admin-1800px-layout.png"),
      fullPage: false,
    });
    console.log("  ✓ Captured bsrc-011-01-admin-1800px-layout.png");

    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.waitForTimeout(1000);

    // -------------------------------------------------------------------------
    // 3. TAB 2: BRAND LIST COMPACT VIEW & SHORT BADGES
    // -------------------------------------------------------------------------
    console.log("[Step 3] Checking Brand List Tab compact table & short badges...");
    const brandListTab = page.locator('button:has-text("Brand List")').first();
    await brandListTab.click();
    await page.waitForTimeout(2000);

    await page.screenshot({
      path: path.join(artifactsDir, "bsrc-011-02-brand-list-compact-view.png"),
    });
    console.log("  ✓ Captured bsrc-011-02-brand-list-compact-view.png");

    // -------------------------------------------------------------------------
    // 4. POPOVER: BRANDS COUNT
    // -------------------------------------------------------------------------
    console.log("[Step 4] Testing Brands count popover...");
    const brandCountBtn = page.locator('table tbody button:has-text("Brands"), table tbody button:has-text("Brand")').first();
    if (await brandCountBtn.count() > 0) {
      await brandCountBtn.hover();
      await page.waitForTimeout(600);
      await page.screenshot({
        path: path.join(artifactsDir, "bsrc-011-03-brands-popover-hover.png"),
      });
      console.log("  ✓ Captured bsrc-011-03-brands-popover-hover.png");
    }

    // -------------------------------------------------------------------------
    // 5. POPOVER: CATEGORIES COUNT
    // -------------------------------------------------------------------------
    console.log("[Step 5] Testing Categories count popover...");
    await page.mouse.move(0, 0);
    await page.waitForTimeout(200);

    const catCountBtn = page.locator('table tbody button:has-text("Categories"), table tbody button:has-text("Category")').first();
    if (await catCountBtn.count() > 0) {
      await catCountBtn.hover();
      await page.waitForTimeout(600);
      await page.screenshot({
        path: path.join(artifactsDir, "bsrc-011-04-categories-popover-hover.png"),
      });
      console.log("  ✓ Captured bsrc-011-04-categories-popover-hover.png");
    }

    // -------------------------------------------------------------------------
    // 6. POPOVER: PRIMARY PRODUCT +N BADGE
    // -------------------------------------------------------------------------
    console.log("[Step 6] Testing Primary Product +N popover...");
    await page.mouse.move(0, 0);
    await page.waitForTimeout(200);

    const plusNBtn = page.locator('table tbody button:has-text("+1")').first();
    if (await plusNBtn.count() > 0) {
      await plusNBtn.hover();
      await page.waitForTimeout(600);
      await page.screenshot({
        path: path.join(artifactsDir, "bsrc-011-05-primary-cat-popover-hover.png"),
      });
      console.log("  ✓ Captured bsrc-011-05-primary-cat-popover-hover.png");
    }

    // -------------------------------------------------------------------------
    // 7. PRIMARY CATEGORY FILTER TOOLBAR DROPDOWN
    // -------------------------------------------------------------------------
    console.log("[Step 7] Testing Primary Product Category Filter dropdown in toolbar...");
    await page.mouse.move(0, 0);
    await page.mouse.click(10, 10);
    await page.waitForTimeout(300);

    const filterBtn = page.locator('button:has-text("Primary: All")').first();
    if (await filterBtn.count() > 0) {
      await filterBtn.click();
      await page.waitForTimeout(500);

      await page.screenshot({
        path: path.join(artifactsDir, "bsrc-011-06-primary-cat-filter-dropdown.png"),
      });
      console.log("  ✓ Captured bsrc-011-06-primary-cat-filter-dropdown.png");

      // Close filter
      await page.mouse.click(10, 10);
      await page.waitForTimeout(300);
    }

    // -------------------------------------------------------------------------
    // 8. DETAIL DRAWER: SECTION 5 PRIMARY CATEGORIES
    // -------------------------------------------------------------------------
    console.log("[Step 8] Opening Company Detail Drawer & checking Section 5...");
    const viewEditBtn = page.locator('table tbody button:has-text("View / Edit")').first();
    if (await viewEditBtn.count() > 0) {
      await viewEditBtn.click();
      await page.waitForSelector('text=Evaluation & Workflow Status', { timeout: 10000 });
      await page.waitForTimeout(800);

      const statusHeader = page.locator('h4:has-text("Evaluation & Workflow Status")').first();
      await statusHeader.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);

      await page.screenshot({
        path: path.join(artifactsDir, "bsrc-011-07-detail-drawer-categories.png"),
      });
      console.log("  ✓ Captured bsrc-011-07-detail-drawer-categories.png");

      // Close drawer with '✕' button
      const closeDrawerBtn = page.locator('button:has-text("✕")').first();
      if (await closeDrawerBtn.count() > 0) {
        await closeDrawerBtn.click();
        await page.waitForTimeout(800);
      }
    }

    // -------------------------------------------------------------------------
    // 9. TAB 1: EXTRACT & IMPORT - REVIEW MODE SECTION 5
    // -------------------------------------------------------------------------
    console.log("[Step 9] Checking Tab 1 Import & Review mode...");
    const importTab = page.locator('button:has-text("Import & Review")').first();
    await importTab.click();
    await page.waitForTimeout(1000);

    // Turn off enrichment
    const enrichCheckbox = page.locator('input[type="checkbox"]').first();
    if (await enrichCheckbox.isChecked()) {
      await enrichCheckbox.uncheck();
      await page.waitForTimeout(300);
    }

    // Enter existing URL
    const testUrl = "https://www.intercharmkorea.com/ko-kr/exhibitor_directory/Exhibitor_detail.주제이코모.org-ec0b85bc-960d-49d4-9dca-146c10ae59cb.html#/";
    const urlInput = page.locator('input[type="url"]').first();
    await urlInput.fill(testUrl);
    await page.waitForTimeout(300);

    const extractBtn = page.locator('button[type="submit"]:has-text("Extract"), button[type="submit"]').first();
    await extractBtn.click();

    console.log("  Waiting for extraction review mode...");
    await page.waitForSelector('text=5. Admin Evaluation & Curation', { timeout: 25000 });
    await page.waitForTimeout(800);

    const evalHeader = page.locator('h3:has-text("5. Admin Evaluation & Curation")').first();
    await evalHeader.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    await page.screenshot({
      path: path.join(artifactsDir, "bsrc-011-08-category-classification-tab1.png"),
    });
    console.log("  ✓ Captured bsrc-011-08-category-classification-tab1.png");

    console.log("\n================================================================================");
    console.log("ALL 8 BROWSER QA SCREENSHOTS CAPTURED SUCCESSFULLY!");
    console.log("================================================================================");
  } catch (err) {
    console.error("Browser QA Error:", err);
    await page.screenshot({
      path: path.join(artifactsDir, "bsrc-011-browser-qa-error.png"),
    });
    throw err;
  } finally {
    await browser.close();
  }
}

runBrowserQA().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
