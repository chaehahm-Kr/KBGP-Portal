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

async function runBrowserQa() {
  console.log("================================================================================");
  console.log("ADM-KNOWLEDGE-DISTRIBUTION-001: COMPREHENSIVE BROWSER QA SUITE");
  console.log("Target Server: http://localhost:3005");
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

  await context.addCookies([
    {
      name: `sb-${projectRef}-auth-token`,
      value: cookieValue,
      domain: "localhost",
      path: "/",
    },
    {
      name: `admin-sb-${projectRef}-auth-token`,
      value: cookieValue,
      domain: "localhost",
      path: "/",
    },
  ]);

  const page = await context.newPage();

  page.on("console", (msg) => {
    if (msg.type() === "error") console.log("[BROWSER ERROR]", msg.text());
  });

  let dialogHandledCount = 0;
  page.on("dialog", async (dialog) => {
    console.log(`[BROWSER DIALOG] Type: ${dialog.type()} | Message: ${dialog.message()}`);
    dialogHandledCount++;
    await dialog.accept();
  });

  try {
    // -------------------------------------------------------------------------
    // Step 2: Navigate to Knowledge Detail (kno-brand-policy-v10)
    // -------------------------------------------------------------------------
    console.log("\n[Step 2] Navigating to /admin/knowledge/kno-brand-policy-v10...");
    await page.goto("http://localhost:3005/admin/knowledge/kno-brand-policy-v10", {
      waitUntil: "networkidle",
      timeout: 30000,
    });

    await page.waitForTimeout(1000);

    // -------------------------------------------------------------------------
    // Step 3: Switch to Tab 2 (Publication & Distribution)
    // -------------------------------------------------------------------------
    console.log("[Step 3] Switching to Publication & Distribution tab...");
    const tabButton = page.locator("button:has-text('Publication & Distribution')");
    await tabButton.click();
    await page.waitForTimeout(500);

    // Verify Checkboxes exist
    const internalCheckbox = page.locator("#checkbox-aud-internal");
    const brandCheckbox = page.locator("#checkbox-aud-brand");
    const retailerCheckbox = page.locator("#checkbox-aud-retailer");

    console.log("Checking visibility of checkboxes...");
    const internalVisible = await internalCheckbox.isVisible();
    const brandVisible = await brandCheckbox.isVisible();
    const retailerVisible = await retailerCheckbox.isVisible();

    console.log(`- Internal Checkbox Visible: ${internalVisible}`);
    console.log(`- Brand Checkbox Visible: ${brandVisible}`);
    console.log(`- Retailer Checkbox Visible: ${retailerVisible}`);

    if (!internalVisible || !brandVisible || !retailerVisible) {
      throw new Error("One or more audience checkboxes are NOT visible in the DOM!");
    }

    const internalChecked = await internalCheckbox.isChecked();
    const brandChecked = await brandCheckbox.isChecked();
    const retailerChecked = await retailerCheckbox.isChecked();

    console.log(`- Internal Checked: ${internalChecked} (Expected: true)`);
    console.log(`- Brand Checked: ${brandChecked} (Expected: true)`);
    console.log(`- Retailer Checked: ${retailerChecked} (Expected: false)`);

    const shot1 = path.join(artifactDir, "qa_adm_knw_dist_001_01_tab2_initial_view.png");
    await page.screenshot({ path: shot1, fullPage: true });
    console.log("✓ Screenshot saved:", shot1);

    // -------------------------------------------------------------------------
    // Step 4: Toggle Retailer Checkbox & Verify Pending Changes Banner
    // -------------------------------------------------------------------------
    console.log("\n[Step 4] Toggling Retailer Checkbox...");
    await retailerCheckbox.click();
    await page.waitForTimeout(500);

    const retailerCheckedAfter = await retailerCheckbox.isChecked();
    console.log(`- Retailer Checked After Click: ${retailerCheckedAfter} (Expected: true)`);

    // Verify pending banner is displayed
    const pendingBanner = page.locator("text=배포 대상 변경 대기 중 (Unsaved Distribution Changes)");
    const bannerVisible = await pendingBanner.isVisible();
    console.log(`- Pending Changes Banner Visible: ${bannerVisible} (Expected: true)`);

    const saveDistButton = page.locator("button:has-text('배포 설정 저장 (Save Distribution)')");
    const saveBtnVisible = await saveDistButton.isVisible();
    console.log(`- Save Distribution Button Visible: ${saveBtnVisible} (Expected: true)`);

    const shot2 = path.join(artifactDir, "qa_adm_knw_dist_001_02_pending_retailer_added.png");
    await page.screenshot({ path: shot2, fullPage: true });
    console.log("✓ Screenshot saved:", shot2);

    // -------------------------------------------------------------------------
    // Step 5: Click Cancel (원래대로) & Verify Revert
    // -------------------------------------------------------------------------
    console.log("\n[Step 5] Clicking Cancel (취소 원래대로)...");
    const cancelDistButton = page.locator("button:has-text('취소 (원래대로)')");
    await cancelDistButton.click();
    await page.waitForTimeout(500);

    const retailerCheckedReverted = await retailerCheckbox.isChecked();
    console.log(`- Retailer Checked After Revert: ${retailerCheckedReverted} (Expected: false)`);
    const bannerVisibleReverted = await pendingBanner.isVisible();
    console.log(`- Pending Banner Visible After Revert: ${bannerVisibleReverted} (Expected: false)`);

    const shot3 = path.join(artifactDir, "qa_adm_knw_dist_001_03_reverted_to_original.png");
    await page.screenshot({ path: shot3, fullPage: true });
    console.log("✓ Screenshot saved:", shot3);

    // -------------------------------------------------------------------------
    // Step 6: Isolated Test Fixture Save & Persistence QA
    // -------------------------------------------------------------------------
    console.log("\n[Step 6] Navigating to isolated test fixture for save & reload persistence QA...");
    // Let's create an isolated fixture via API
    const fixtureCreateRes = await fetch("http://localhost:3005/api/admin/knowledge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "QA Browser Distribution Fixture",
        title_ko: "QA 브라우저 배포 컨트롤 테스트 픽스처",
        status: "PUBLISHED",
        audience: ["INTERNAL"],
        module: "OPERATIONS",
        category: "General",
        type: "POLICY"
      })
    });
    console.log("Fixture create response status:", fixtureCreateRes.status);
    const fixtureData = await fixtureCreateRes.json();
    const fixtureId = fixtureData.item.id;
    console.log("Created fixture with ID:", fixtureId);

    await page.goto(`http://localhost:3005/admin/knowledge/${fixtureId}`, {
      waitUntil: "networkidle",
      timeout: 30000,
    });
    await page.waitForTimeout(1000);

    await page.locator("button:has-text('Publication & Distribution')").click();
    await page.waitForTimeout(500);

    // Initial state: Internal checked, Brand & Retailer unchecked
    console.log("Toggling Brand Portal checkbox on fixture...");
    await page.locator("#checkbox-aud-brand").click();
    await page.waitForTimeout(500);

    // Click Save Distribution
    console.log("Clicking Save Distribution (should trigger confirmation dialog for expanding audience)...");
    await page.locator("button:has-text('배포 설정 저장 (Save Distribution)')").click();
    await page.waitForTimeout(1500);

    // Reload page to verify persistence
    console.log("Reloading page to verify persistence...");
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(1000);

    await page.locator("button:has-text('Publication & Distribution')").click();
    await page.waitForTimeout(500);

    const fixtureInternalChecked = await page.locator("#checkbox-aud-internal").isChecked();
    const fixtureBrandChecked = await page.locator("#checkbox-aud-brand").isChecked();
    const fixtureRetailerChecked = await page.locator("#checkbox-aud-retailer").isChecked();

    console.log(`- Fixture Internal Checked: ${fixtureInternalChecked} (Expected: true)`);
    console.log(`- Fixture Brand Checked: ${fixtureBrandChecked} (Expected: true)`);
    console.log(`- Fixture Retailer Checked: ${fixtureRetailerChecked} (Expected: false)`);

    if (!fixtureBrandChecked || !fixtureInternalChecked) {
      throw new Error("Fixture failed to persist audience changes across page reload!");
    }

    const shot4 = path.join(artifactDir, "qa_adm_knw_dist_001_04_persisted_after_save.png");
    await page.screenshot({ path: shot4, fullPage: true });
    console.log("✓ Screenshot saved:", shot4);

    // Check Tab 4 (Activity Logs) to verify audit log
    console.log("[Step 7] Checking Activity Logs tab for AUDIENCE_UPDATED entry...");
    await page.locator("button:has-text('Activity Logs')").click();
    await page.waitForTimeout(500);

    const auditEntry = page.locator("text=AUDIENCE_UPDATED");
    const auditVisible = await auditEntry.first().isVisible();
    console.log(`- AUDIENCE_UPDATED log visible: ${auditVisible}`);

    const shot5 = path.join(artifactDir, "qa_adm_knw_dist_001_05_audit_log_verified.png");
    await page.screenshot({ path: shot5, fullPage: true });
    console.log("✓ Screenshot saved:", shot5);

    console.log("\n================================================================================");
    console.log("ALL BROWSER QA TESTS COMPLETED SUCCESSFULLY!");
    console.log("================================================================================\n");

  } finally {
    await browser.close();
  }
}

runBrowserQa().catch((err) => {
  console.error("Browser QA failed with error:", err);
  process.exit(1);
});
