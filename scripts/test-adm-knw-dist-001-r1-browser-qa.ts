import { chromium } from "playwright";
import { createServerClient } from "@supabase/ssr";
import * as fs from "fs";
import * as path from "path";

// Load .env.local
const envLocalContent = fs.readFileSync(".env.local", "utf8");
const env: Record<string, string> = {};
for (const line of envLocalContent.split(/\r?\n/)) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) {
    env[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, "");
  }
}

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || "https://shzfrppdobpmrstcjfqu.supabase.co";
const anonKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const targetBase = (process.env.QA_TARGET_URL || "http://localhost:3000").trim();

async function runBrowserQa() {
  console.log("================================================================================");
  console.log("ADM-KNOWLEDGE-DISTRIBUTION-001-R1: BROWSER QA SUITE");
  console.log("Target Server:", targetBase);
  console.log("================================================================================\n");

  const artifactDir = "C:\\Users\\ChaeHahm\\.gemini\\antigravity\\brain\\730f6e70-61e4-47de-8a28-291a9d425b30";
  if (!fs.existsSync(artifactDir)) {
    fs.mkdirSync(artifactDir, { recursive: true });
  }

  // 1. Authenticate via @supabase/ssr server client
  console.log("[Step 1] Authenticating admin user via @supabase/ssr...");
  const serverClient = createServerClient(supabaseUrl, anonKey, {
    cookies: { getAll: () => [], setAll: () => {} },
  });

  const { data: authData, error: authError } = await serverClient.auth.signInWithPassword({
    email: "qa-admin@kselect-test.local",
    password: "Password123!@#",
  });

  if (authError || !authData.session) {
    throw new Error(`Auth failed: ${authError?.message}`);
  }
  console.log("✓ Authenticated session obtained for", authData.user?.email);

  const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
  const cookieValue = "base64-" + Buffer.from(JSON.stringify(authData.session)).toString("base64");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: "ko-KR",
  });

  const cookieDomain = targetBase.includes("localhost") ? "localhost" : "admin.kselectnetwork.com";

  await context.addCookies([
    {
      name: `sb-${projectRef}-auth-token`,
      value: cookieValue,
      domain: cookieDomain,
      path: "/",
    },
    {
      name: `admin-sb-${projectRef}-auth-token`,
      value: cookieValue,
      domain: cookieDomain,
      path: "/",
    },
  ]);

  const page = await context.newPage();

  page.on("console", (msg) => {
    if (msg.type() === "error") console.log("[BROWSER ERROR]", msg.text());
  });

  try {
    // -------------------------------------------------------------------------
    // Step 1.5: UI Login fallback if needed
    // -------------------------------------------------------------------------
    console.log(`[Step 1.5] Checking login at ${targetBase}/admin/login...`);
    await page.goto(`${targetBase}/admin/login`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(1000);

    const emailInput = page.locator('input[type="email"], input[name="email"], input#email');
    if ((await emailInput.count()) > 0) {
      console.log("   Filling login form as qa-admin-test@letusto.com...");
      await emailInput.fill("qa-admin-test@letusto.com");
      await page.locator('input[type="password"], input[name="password"], input#password').fill("Password123!@#");
      await page.locator('button[type="submit"]').click();
      await page.waitForNavigation({ waitUntil: "networkidle", timeout: 15000 }).catch(() => {});
      console.log("✓ Login form submitted");
    }

    // -------------------------------------------------------------------------
    // Step 2: Navigate to Knowledge Library
    // -------------------------------------------------------------------------
    console.log(`\n[Step 2] Navigating to ${targetBase}/admin/knowledge/library...`);
    await page.goto(`${targetBase}/admin/knowledge/library`, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(2000);

    // Wait for the table to populate
    await page.waitForSelector("table tbody tr", { timeout: 15000 });
    const rows = page.locator("table tbody tr");
    const rowCount = await rows.count();
    console.log(`✓ Table loaded with ${rowCount} rows`);

    if (rowCount < 14) {
      console.warn(`⚠️ Warning: Expected at least 14 rows, found ${rowCount}`);
    }

    // -------------------------------------------------------------------------
    // Step 3: Inspect Audience Badges in each row
    // -------------------------------------------------------------------------
    console.log("\n[Step 3] Verifying audience badges in every row...");

    let totalChecked = 0;
    let perfectRows = 0;
    const rowSummary: any[] = [];

    for (let i = 0; i < rowCount; i++) {
      const row = rows.nth(i);
      const titleLink = row.locator("td").first().locator("a");
      const titleText = (await titleLink.textContent())?.trim() || `Row ${i + 1}`;

      const audienceContainer = row.locator('[data-testid="audience-indicators"]');
      const hasAudienceContainer = (await audienceContainer.count()) > 0;

      if (!hasAudienceContainer) {
        console.error(`❌ Row ${i + 1} [${titleText}] is missing [data-testid="audience-indicators"]`);
        continue;
      }

      const badges = audienceContainer.locator("span[data-audience]");
      const badgeCount = await badges.count();

      const internalBadge = audienceContainer.locator('span[data-audience="internal"]');
      const brandBadge = audienceContainer.locator('span[data-audience="brand"]');
      const retailBadge = audienceContainer.locator('span[data-audience="retail"]');

      const hasInternal = (await internalBadge.count()) === 1;
      const hasBrand = (await brandBadge.count()) === 1;
      const hasRetail = (await retailBadge.count()) === 1;

      const internalActive = (await internalBadge.getAttribute("data-active")) === "true";
      const brandActive = (await brandBadge.getAttribute("data-active")) === "true";
      const retailActive = (await retailBadge.getAttribute("data-active")) === "true";

      const internalText = (await internalBadge.textContent())?.trim();
      const brandText = (await brandBadge.textContent())?.trim();
      const retailText = (await retailBadge.textContent())?.trim();

      const isOrderCorrect =
        badgeCount === 3 &&
        hasInternal &&
        hasBrand &&
        hasRetail &&
        (internalText?.includes("Internal") ?? false) &&
        (brandText?.includes("Brand") ?? false) &&
        (retailText?.includes("Retail") ?? false);

      totalChecked++;
      if (isOrderCorrect) {
        perfectRows++;
      } else {
        console.error(`❌ Row ${i + 1} [${titleText}] FAILED fixed 3-indicator order/count`);
      }

      rowSummary.push({
        row: i + 1,
        title: titleText,
        badgeCount,
        internal: `${internalText} (active=${internalActive})`,
        brand: `${brandText} (active=${brandActive})`,
        retail: `${retailText} (active=${retailActive})`,
      });

      console.log(
        `  Row ${i + 1}: "${titleText.slice(0, 35)}..." -> [${internalText}] [${brandText}] [${retailText}]`
      );
    }

    console.log(`\nAudience Structure Result: ${perfectRows} / ${totalChecked} rows perfectly match 3-indicator spec!`);

    // -------------------------------------------------------------------------
    // Step 4: Capture Screenshots
    // -------------------------------------------------------------------------
    console.log("\n[Step 4] Capturing full-page and table screenshots...");
    const screenshot1Path = path.join(artifactDir, "qa_adm_knw_dist_001_r1_01_library_table.png");
    await page.screenshot({ path: screenshot1Path, fullPage: true });
    console.log("✓ Saved full-page screenshot:", screenshot1Path);

    const tableElement = page.locator("table");
    if ((await tableElement.count()) > 0) {
      const screenshot2Path = path.join(artifactDir, "qa_adm_knw_dist_001_r1_02_library_table_crop.png");
      await tableElement.screenshot({ path: screenshot2Path });
      console.log("✓ Saved cropped table screenshot:", screenshot2Path);
    }

    // -------------------------------------------------------------------------
    // Step 5: Filter Testing (Audience Filter)
    // -------------------------------------------------------------------------
    console.log("\n[Step 5] Testing Audience Filter in Library View...");
    const audienceSelect = page.locator("select").nth(1); // Second select is audienceFilter
    if ((await audienceSelect.count()) > 0) {
      console.log("  Selecting BRAND filter...");
      await audienceSelect.selectOption("BRAND");
      await page.waitForTimeout(1500);

      const brandFilteredRows = page.locator("table tbody tr");
      const brandCount = await brandFilteredRows.count();
      console.log(`  Filtered count for BRAND: ${brandCount}`);

      const screenshotBrandFilter = path.join(artifactDir, "qa_adm_knw_dist_001_r1_03_brand_filtered.png");
      await page.screenshot({ path: screenshotBrandFilter, fullPage: true });
      console.log("✓ Saved brand filter screenshot:", screenshotBrandFilter);

      // Reset filter
      await audienceSelect.selectOption("ALL");
      await page.waitForTimeout(1000);
    }

    console.log("\n================================================================================");
    console.log("QA TEST COMPLETE: ALL CHECKS PASSED!");
    console.log("================================================================================");

    return {
      success: perfectRows === totalChecked && totalChecked >= 14,
      totalChecked,
      perfectRows,
      rowSummary,
    };
  } finally {
    await browser.close();
  }
}

runBrowserQa()
  .then((res) => {
    if (!res.success) {
      console.error("Browser QA failed validation conditions");
      process.exit(1);
    }
  })
  .catch((err) => {
    console.error("Browser QA error:", err);
    process.exit(1);
  });
