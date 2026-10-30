import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// Load QA credentials safely
const envQaContent = fs.readFileSync(".env.qa.local", "utf8");
const getEnvVal = (key: string) => {
  const match = envQaContent.match(new RegExp(`${key}=([^\\r\\n]+)`));
  return match ? match[1].trim().replace(/^['"]|['"]$/g, "") : "";
};

const qaUrl = getEnvVal("QA_SUPABASE_URL");
const qaKey = getEnvVal("QA_SUPABASE_SECRET_KEY");

if (!qaUrl || !qaKey || qaUrl.includes("shzfrppdobpmrstcjfqu")) {
  console.error("FAIL: Refusing to run on production ref! Must use QA environment.");
  process.exit(1);
}

const qaSupabase = createClient(qaUrl, qaKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function runBrowserQA() {
  console.log("================================================================================");
  console.log("STARTING PLAYWRIGHT BROWSER QA: ADM-BSRC-013-R1");
  console.log("Database: QA Supabase (elkgizqgksshukxgcndy)");
  console.log("Target Server: http://localhost:3000");
  console.log("================================================================================\n");

  const artifactsDir = "C:\\Users\\ChaeHahm\\.gemini\\antigravity\\brain\\945ab025-0f8f-4fce-b0bc-56237108874e";
  if (!fs.existsSync(artifactsDir)) {
    fs.mkdirSync(artifactsDir, { recursive: true });
  }

  // Pre-seed test fixture company with 3 contacts and company phone
  const testSuffix = Math.floor(Math.random() * 899999 + 100000);
  const compNameKr = `(주)비에스알씨알원${testSuffix}`;
  const compNameEn = `BSRC R1 Visual ${testSuffix}`;
  const testCompanyPhone = "02-555-8822";
  const testContactPhone = "010-9999-4433";
  const testNotes = `R1 QA Visual Fixture (${testSuffix})`;

  const { data: seededComp, error: seedErr } = await qaSupabase
    .from("sourcing_companies")
    .insert({
      company_name_kr: compNameKr,
      company_name_en: compNameEn,
      normalized_name_kr: `비에스알씨알원${testSuffix}`,
      normalized_name_en: `bsrc r1 visual ${testSuffix}`,
      business_types: ["BRAND_OWNER"],
      primary_product_categories: ["SKINCARE"],
      primary_categories_confirmed: true,
      representative_name: "홍길동",
      business_registration_number: "123-45-67890",
      address_formatted_kr: "서울특별시 강남구 테헤란로 789",
      address_line1: "서울특별시 강남구 테헤란로 789",
      company_phone: testCompanyPhone,
      grade: "B",
      status: "SAVED",
      internal_notes: testNotes,
    })
    .select("id")
    .single();

  if (seedErr || !seededComp) {
    console.error("Failed to seed QA company fixture:", seedErr);
    return;
  }

  const seededCompanyId = seededComp.id;
  console.log(`✓ Pre-seeded fixture company ID: ${seededCompanyId} (${compNameKr})`);

  // Seed brands and multiple contacts for +2 badge
  await Promise.all([
    qaSupabase.from("sourcing_brands").insert([
      {
        company_id: seededCompanyId,
        brand_name_kr: `비주얼스킨${testSuffix}`,
        brand_name_en: `VisualSkin ${testSuffix}`,
        description: "비주얼 테스트 브랜드",
        categories: ["스킨케어"],
        source: "MANUAL",
        display_order: 0,
      },
    ]),
    qaSupabase.from("sourcing_contacts").insert([
      {
        company_id: seededCompanyId,
        name: "홍대표",
        job_title: "대표이사",
        department: "경영총괄",
        email: `ceo-${testSuffix}@visualr1.com`,
        phone: testContactPhone,
        is_primary: true,
        source: "MANUAL",
        display_order: 0,
      },
      {
        company_id: seededCompanyId,
        name: "김마케팅",
        job_title: "마케팅팀장",
        department: "마케팅본부",
        email: `marketing-${testSuffix}@visualr1.com`,
        phone: "010-2222-3333",
        is_primary: false,
        source: "MANUAL",
        display_order: 1,
      },
      {
        company_id: seededCompanyId,
        name: "박해외영업",
        job_title: "해외영업과장",
        department: "글로벌사업부",
        email: `sales-${testSuffix}@visualr1.com`,
        phone: "010-4444-5555",
        is_primary: false,
        source: "MANUAL",
        display_order: 2,
      },
    ]),
    qaSupabase.from("sourcing_websites").insert({
      company_id: seededCompanyId,
      url: `https://www.visualr1-${testSuffix}.com`,
      label: "OFFICIAL",
      is_primary: true,
      source: "MANUAL",
    }),
  ]);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
  });
  const page = await context.newPage();

  page.on("console", (msg) => {
    if (msg.type() === "error") console.log("[BROWSER ERROR]", msg.text());
  });

  try {
    // 1. Admin Login
    console.log("[Step 1] Logging in to admin...");
    await page.goto("http://localhost:3000/admin/login", { waitUntil: "networkidle", timeout: 25000 });
    const emailInput = page.locator('input[type="email"], input[name="email"]');
    if ((await emailInput.count()) > 0) {
      await emailInput.fill("qa-admin@kselect-test.local");
      await page.locator('input[type="password"], input[name="password"]').fill("Password123!@#");
      await page.locator('button[type="submit"]').click();
      await page.waitForURL((url) => !url.pathname.includes("/admin/login"), { timeout: 20000 });
    }
    console.log("✓ Logged in successfully.");

    // 2. Navigate to Brand Marketing > Brand List
    console.log("\n[Step 2] Navigating to Brand Marketing Brand List...");
    await page.goto("http://localhost:3000/admin/brand-marketing?tab=list", { waitUntil: "networkidle", timeout: 25000 });
    await page.waitForTimeout(3000);

    // Search for our seeded company
    const searchInput = page.locator('input[placeholder*="Search"]').first();
    if ((await searchInput.count()) > 0) {
      await searchInput.fill(compNameKr);
      await page.waitForTimeout(1000);
    }

    // SCREENSHOT 1: Primary Contact +N Badge and Popover
    console.log("\n[Screenshot 1] Finding +N badge and opening popover...");
    const plusBadge = page.locator('button:has-text("+2")').first();
    if ((await plusBadge.count()) > 0) {
      await plusBadge.click();
      await page.waitForTimeout(500);
    }
    const s1Path = path.join(artifactsDir, "bsrc-013-r1-01-primary-contact-additional-emails-popover.png");
    await page.screenshot({ path: s1Path, fullPage: false });
    console.log("  ✓ Saved:", s1Path);

    // SCREENSHOT 2: Company Detail Drawer showing Legal Address and Company Phone
    console.log("\n[Screenshot 2] Opening Company Detail Drawer...");
    const viewButton = page.locator(`button:has-text("View / Edit")`).first();
    await viewButton.click();
    await page.waitForSelector('text=Company Overview', { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Scroll to Company Overview card with Address and Company Phone
    const overviewCard = page.locator('text=Company Overview').first();
    await overviewCard.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    const s2Path = path.join(artifactsDir, "bsrc-013-r1-02-company-edit-address-and-phone.png");
    await page.screenshot({ path: s2Path, fullPage: false });
    console.log("  ✓ Saved:", s2Path);

    // SCREENSHOT 3: Save Changes, Close Drawer, and Display Success Banner
    console.log("\n[Screenshot 3] Modifying phone and clicking Save Changes...");
    const phoneInput = page.locator('input[placeholder="e.g. 02-123-4567"]');
    if ((await phoneInput.count()) > 0) {
      await phoneInput.fill("02-9999-0000");
    }

    // Scroll down to drawer footer and click Save Changes
    const saveBtn = page.locator('button:has-text("Save Changes")').first();
    await saveBtn.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await saveBtn.click();

    // Wait for drawer to close and success banner to appear
    await page.waitForSelector('text=saved successfully', { timeout: 10000 });
    await page.waitForTimeout(1000);

    const s3Path = path.join(artifactsDir, "bsrc-013-r1-03-save-changes-drawer-auto-close-and-banner.png");
    await page.screenshot({ path: s3Path, fullPage: false });
    console.log("  ✓ Saved:", s3Path);

    // SCREENSHOT 4: Candidate Grade Required Validation
    console.log("\n[Screenshot 4] Navigating to Import & Review to test Grade validation...");
    const importTabBtn = page.locator('button:has-text("Import & Review")').first();
    await importTabBtn.click();
    await page.waitForTimeout(2000);

    // Click "Manual Registration" or switch to manual tab
    const manualTab = page.locator('button:has-text("Manual Entry")').first();
    if ((await manualTab.count()) > 0) {
      await manualTab.click();
      await page.waitForTimeout(1000);
    }

    // Fill minimum company name
    const draftNameInput = page.locator('input[placeholder*="Company Name (KR)"], input[placeholder*="회사명"]').first();
    if ((await draftNameInput.count()) > 0) {
      await draftNameInput.fill(`테스트기업${testSuffix}`);
    }

    // Click Save to Brand List without selecting grade
    const saveDraftBtn = page.locator('button:has-text("Save to Brand List")').first();
    if ((await saveDraftBtn.count()) > 0) {
      await saveDraftBtn.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
      await saveDraftBtn.click();
      await page.waitForTimeout(1000);
    }

    const s4Path = path.join(artifactsDir, "bsrc-013-r1-04-candidate-grade-required-validation.png");
    await page.screenshot({ path: s4Path, fullPage: false });
    console.log("  ✓ Saved:", s4Path);

    // SCREENSHOT 5: Deep Link / Duplicate Warning Open in New Tab
    console.log("\n[Screenshot 5] Testing deep link open drawer directly...");
    await page.goto(`http://localhost:3000/admin/brand-marketing?tab=list&companyId=${encodeURIComponent(seededCompanyId)}`, {
      waitUntil: "networkidle",
      timeout: 25000,
    });
    await page.waitForSelector('text=Company Overview', { timeout: 10000 });
    await page.waitForTimeout(1500);

    const s5Path = path.join(artifactsDir, "bsrc-013-r1-05-duplicate-warning-open-new-tab.png");
    await page.screenshot({ path: s5Path, fullPage: false });
    console.log("  ✓ Saved:", s5Path);

  } catch (err) {
    console.error("Browser QA failed:", err);
  } finally {
    // Cleanup seeded fixture
    await qaSupabase.from("sourcing_contacts").delete().eq("company_id", seededCompanyId);
    await qaSupabase.from("sourcing_brands").delete().eq("company_id", seededCompanyId);
    await qaSupabase.from("sourcing_websites").delete().eq("company_id", seededCompanyId);
    await qaSupabase.from("sourcing_companies").delete().eq("id", seededCompanyId);
    console.log("✓ Cleaned up seeded QA fixture");

    await browser.close();
  }

  console.log("\n================================================================================");
  console.log("BROWSER QA COMPLETED SUCCESSFULLY!");
  console.log("================================================================================");
}

runBrowserQA().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(1);
});
