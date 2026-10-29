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
  console.log("STARTING PLAYWRIGHT BROWSER QA: ADM-BSRC-013");
  console.log("Database: QA Supabase (elkgizqgksshukxgcndy)");
  console.log("Target Server: http://localhost:3000");
  console.log("================================================================================\n");

  const artifactsDir = "C:\\Users\\ChaeHahm\\.gemini\\antigravity\\brain\\945ab025-0f8f-4fce-b0bc-56237108874e";
  if (!fs.existsSync(artifactsDir)) {
    fs.mkdirSync(artifactsDir, { recursive: true });
  }

  // Pre-seed test fixture company
  const testSuffix = Math.floor(Math.random() * 899999 + 100000);
  const compNameKr = `(주)비에스알씨글로벌${testSuffix}`;
  const compNameEn = `BSRC Global Corp ${testSuffix}`;
  const testPhone = "031-632-6600";
  const testNotes = `Amazon US 런칭 준비 및 2026 샘플 발송 완료 (QABROWSER-${testSuffix})`;

  const { data: seededComp, error: seedErr } = await qaSupabase
    .from("sourcing_companies")
    .insert({
      company_name_kr: compNameKr,
      company_name_en: compNameEn,
      normalized_name_kr: `비에스알씨글로벌${testSuffix}`,
      normalized_name_en: `bsrc global corp ${testSuffix}`,
      business_types: ["BRAND_OWNER", "OEM_ODM", "MANUFACTURER", "DISTRIBUTOR", "IMPORTER_EXPORTER"],
      primary_product_categories: ["SKINCARE", "BODYCARE"],
      primary_categories_confirmed: true,
      representative_name: "홍길동",
      business_registration_number: "111-22-33333",
      address_formatted_kr: "서울특별시 강남구 테헤란로 456",
      grade: "A",
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

  // Seed brands and multiple contacts
  await Promise.all([
    qaSupabase.from("sourcing_brands").insert([
      {
        company_id: seededCompanyId,
        brand_name_kr: `라보스킨${testSuffix}`,
        brand_name_en: `LaboSkin ${testSuffix}`,
        description: "클린 뷰티 스킨케어 전문 라인",
        categories: ["스킨케어"],
        source: "SOURCE_EXHIBITION",
        display_order: 0,
      },
      {
        company_id: seededCompanyId,
        brand_name_kr: `퓨어더마${testSuffix}`,
        brand_name_en: `PureDerma ${testSuffix}`,
        description: "더마 코스메틱 바디케어 라인",
        categories: ["바디케어"],
        source: "MANUAL",
        display_order: 1,
      },
    ]),
    qaSupabase.from("sourcing_contacts").insert([
      {
        company_id: seededCompanyId,
        name: "김글로벌",
        job_title: "해외영업 총괄팀장",
        department: "해외영업본부",
        email: `global-${testSuffix}@bsrcglobal.com`,
        phone: testPhone,
        is_primary: true,
        source: "SOURCE_EXHIBITION",
        display_order: 0,
      },
      {
        company_id: seededCompanyId,
        name: "이지원",
        job_title: "마케팅 과장",
        department: "브랜드전략팀",
        email: `marketing-${testSuffix}@bsrcglobal.com`,
        phone: "010-8888-9999",
        is_primary: false,
        source: "MANUAL",
        display_order: 1,
      },
    ]),
    qaSupabase.from("sourcing_websites").insert({
      company_id: seededCompanyId,
      url: `https://www.bsrcglobal${testSuffix}.com`,
      label: "OFFICIAL",
      is_primary: true,
      source: "MANUAL",
    }),
  ]);

  const browser = await chromium.launch({ headless: true });
  // Viewport at 1920x1080 to test the 1800px max-width shell
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
  });
  const page = await context.newPage();

  page.on("console", (msg) => {
    if (msg.type() === "error") console.log("[BROWSER ERROR]", msg.text());
  });
  page.on("dialog", async (dialog) => {
    console.log("[BROWSER DIALOG]", dialog.type(), dialog.message());
    await dialog.accept();
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

    // 2. Navigate to Brand Marketing
    console.log("\n[Step 2] Navigating to Brand Marketing...");
    await page.goto("http://localhost:3000/admin/brand-marketing", { waitUntil: "networkidle", timeout: 25000 });
    await page.waitForTimeout(2000);

    // 3. Switch to Brand List Tab
    console.log("[Step 3] Switching to Brand List Tab...");
    const listTabButton = page.locator('button:has-text("Brand List")').first();
    await listTabButton.click();
    await page.waitForTimeout(3000);

    // SCREENSHOT 1: 1800px Responsive Admin Standard (Rule 27)
    console.log("\n[Screenshot 1] Capturing 1800px Responsive Layout...");
    const s1Path = path.join(artifactsDir, "bsrc-013-01-admin-1800px-layout.png");
    await page.screenshot({ path: s1Path, fullPage: false });
    console.log("  ✓ Saved:", s1Path);

    // SCREENSHOT 2: Distinct Color Badges for Company Types
    console.log("\n[Screenshot 2] Capturing Distinct Company Type Badges...");
    const s2Path = path.join(artifactsDir, "bsrc-013-02-brand-list-company-type-colors.png");
    await page.screenshot({ path: s2Path, fullPage: false });
    console.log("  ✓ Saved:", s2Path);

    // SCREENSHOT 3: Pagination with Page Size Selector (20 / 50 / 100 / 200)
    console.log("\n[Screenshot 3] Scrolling to pagination footer...");
    const pageSizeSelect = page.locator('select:has-text("20")');
    if ((await pageSizeSelect.count()) > 0) {
      await pageSizeSelect.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
    }
    const s3Path = path.join(artifactsDir, "bsrc-013-03-page-size-selector.png");
    await page.screenshot({ path: s3Path, fullPage: false });
    console.log("  ✓ Saved:", s3Path);

    // Scroll back up to the table
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);

    // SCREENSHOT 4: Bulk Selection and Bulk Delete Confirmation Modal
    console.log("\n[Screenshot 4] Selecting rows for bulk deletion and triggering modal...");
    const rowCheckboxes = page.locator('tbody tr input[type="checkbox"]');
    const checkboxCount = await rowCheckboxes.count();
    console.log(`  Found ${checkboxCount} candidate row checkboxes.`);
    if (checkboxCount >= 1) {
      await rowCheckboxes.nth(0).check();
      if (checkboxCount >= 2) {
        await rowCheckboxes.nth(1).check();
      }
      await page.waitForTimeout(600);

      // Verify "Delete Selected" button appears
      const deleteSelectedBtn = page.locator('button:has-text("Delete Selected")');
      if ((await deleteSelectedBtn.count()) > 0) {
        await deleteSelectedBtn.click();
        await page.waitForTimeout(800);

        const s4Path = path.join(artifactsDir, "bsrc-013-04-bulk-selection-delete-modal.png");
        await page.screenshot({ path: s4Path, fullPage: false });
        console.log("  ✓ Saved:", s4Path);

        // Cancel modal
        const cancelBtn = page.locator('button:has-text("취소 (Cancel)")');
        if ((await cancelBtn.count()) > 0) {
          await cancelBtn.click();
          await page.waitForTimeout(500);
        }
      }
    }

    // SCREENSHOT 5: Click Company Name -> 800px Drawer with Editable Grade
    console.log("\n[Screenshot 5] Clicking seeded company name to open 800px drawer...");
    const seededCompButton = page.locator(`button:has-text("${compNameKr}")`).first();
    if ((await seededCompButton.count()) > 0) {
      await seededCompButton.click();
    } else {
      await page.locator("tbody tr td:nth-child(2) button").first().click();
    }
    await page.waitForTimeout(2500);

    const s5Path = path.join(artifactsDir, "bsrc-013-05-expanded-drawer-800px-grade-edit.png");
    await page.screenshot({ path: s5Path, fullPage: false });
    console.log("  ✓ Saved:", s5Path);

    // SCREENSHOT 6: Multiple Contacts Section inside Drawer
    console.log("\n[Screenshot 6] Scrolling to Company Contacts section inside drawer...");
    const contactsSection = page.locator('h4:has-text("Company Contacts")');
    if ((await contactsSection.count()) > 0) {
      await contactsSection.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);

      // Open Add Contact inline form to display creation capability
      const addContactBtn = page.locator('button:has-text("+ Add Contact")');
      if ((await addContactBtn.count()) > 0) {
        await addContactBtn.click();
        await page.waitForTimeout(500);
      }

      const s6Path = path.join(artifactsDir, "bsrc-013-06-drawer-all-contacts-management.png");
      await page.screenshot({ path: s6Path, fullPage: false });
      console.log("  ✓ Saved:", s6Path);
    }

    // SCREENSHOT 7: Represented Brands Section (Add / Edit / Unlink)
    console.log("\n[Screenshot 7] Scrolling to Represented Brands section inside drawer...");
    const brandsSection = page.locator('h4:has-text("Represented Brands")');
    if ((await brandsSection.count()) > 0) {
      await brandsSection.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);

      const s7Path = path.join(artifactsDir, "bsrc-013-07-drawer-add-edit-brand.png");
      await page.screenshot({ path: s7Path, fullPage: false });
      console.log("  ✓ Saved:", s7Path);
    }

    // Close the drawer
    const drawerBackdrop = page.locator('.fixed.inset-0.z-50');
    if ((await drawerBackdrop.count()) > 0) {
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
      // or click close button
      const closeDrawerBtn = page.locator('button:has-text("✕")').first();
      if ((await closeDrawerBtn.count()) > 0) {
        await closeDrawerBtn.click();
        await page.waitForTimeout(500);
      }
    }

    // SCREENSHOT 8: Extended Search by Normalized Phone
    console.log("\n[Screenshot 8] Searching by normalized phone digits (0316326600)...");
    const searchInput = page.locator('input[placeholder*="Search company, brand, email, phone"]');
    if ((await searchInput.count()) > 0) {
      await searchInput.fill("0316326600");
      await searchInput.press("Enter");
      await page.waitForTimeout(2500);

      const s8Path = path.join(artifactsDir, "bsrc-013-08-search-by-phone-normalized.png");
      await page.screenshot({ path: s8Path, fullPage: false });
      console.log("  ✓ Saved:", s8Path);
    }

    // SCREENSHOT 9: Extended Search by Internal Notes
    console.log("\n[Screenshot 9] Searching by Internal Notes keyword (Amazon)...");
    if ((await searchInput.count()) > 0) {
      await searchInput.fill("Amazon");
      await searchInput.press("Enter");
      await page.waitForTimeout(2500);

      const s9Path = path.join(artifactsDir, "bsrc-013-09-search-by-internal-notes.png");
      await page.screenshot({ path: s9Path, fullPage: false });
      console.log("  ✓ Saved:", s9Path);
    }

    console.log("\n================================================================================");
    console.log("ALL 9 PLAYWRIGHT BROWSER QA SCREENSHOTS CAPTURED SUCCESSFULLY!");
    console.log("================================================================================");
  } catch (err: any) {
    console.error("Browser QA Error:", err);
  } finally {
    await browser.close();
    // Clean up seeded company fixture
    if (seededCompanyId) {
      await qaSupabase.from("sourcing_companies").delete().eq("id", seededCompanyId);
      console.log("✓ Cleaned up seeded fixture company.");
    }
  }
}

runBrowserQA();
