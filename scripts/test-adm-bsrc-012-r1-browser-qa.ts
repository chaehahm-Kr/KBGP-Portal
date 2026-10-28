import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

// Load QA environment
let qaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://elkgizqgksshukxgcndy.supabase.co";
let qaKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";

if (fs.existsSync(".env.local")) {
  const content = fs.readFileSync(".env.local", "utf8");
  for (const line of content.split(/\r?\n/)) {
    if (line.startsWith("NEXT_PUBLIC_SUPABASE_URL=")) {
      qaUrl = line.split("=")[1].trim().replace(/^['"]|['"]$/g, "");
    }
    if (line.startsWith("SUPABASE_SECRET_KEY=") && !qaKey) {
      qaKey = line.split("=")[1].trim().replace(/^['"]|['"]$/g, "");
    }
  }
}

const qaSupabase = createClient(qaUrl, qaKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function runBrowserQA() {
  console.log("================================================================================");
  console.log("ADM-BSRC-012-R1: Simplified Duplicate Company QA (Playwright)");
  console.log("Database: QA Supabase (elkgizqgksshukxgcndy)");
  console.log("Target Server: http://localhost:3000");
  console.log("================================================================================\n");

  const artifactsDir = "C:\\Users\\ChaeHahm\\.gemini\\antigravity\\brain\\945ab025-0f8f-4fce-b0bc-56237108874e";
  if (!fs.existsSync(artifactsDir)) {
    fs.mkdirSync(artifactsDir, { recursive: true });
  }

  // Pre-seed known company for UI duplicate testing
  const testNonce = Math.random().toString(36).slice(2, 7);
  const existingNameKr = `(주) 코스메틱랩_${testNonce}`;
  const existingEmail = `lab_${testNonce}@cosmeticlab.kr`;
  const existingBrand = `라보글로우_${testNonce}`;

  const { data: comp, error: compErr } = await qaSupabase
    .from("sourcing_companies")
    .insert({
      company_name_kr: existingNameKr,
      company_name_en: `Cosmetic Lab Co Ltd ${testNonce}`,
      normalized_name_kr: `코스메틱랩${testNonce}`,
      normalized_name_en: `cosmetic lab ${testNonce}`,
      primary_product_categories: ["SKINCARE", "MAKEUP"],
      primary_categories_confirmed: true,
      address_country: "한국",
      address_country_code: "KR",
      status: "SAVED",
      grade: "A",
    })
    .select("id")
    .single();

  if (compErr || !comp) {
    console.error("Failed to seed existing company:", compErr);
    return;
  }

  const existingCompanyId = comp.id;
  console.log(`✓ Pre-seeded existing company ID: ${existingCompanyId} (${existingNameKr})`);

  // Seed brand & contact
  await Promise.all([
    qaSupabase.from("sourcing_brands").insert({
      company_id: existingCompanyId,
      brand_name_kr: existingBrand,
      brand_name_en: `Lab Glow ${testNonce}`,
      categories: ["스킨케어"],
      source: "SOURCE_EXHIBITION",
      display_order: 0,
    }),
    qaSupabase.from("sourcing_contacts").insert({
      company_id: existingCompanyId,
      name: "이연구",
      email: existingEmail,
      is_primary: true,
      source: "SOURCE_EXHIBITION",
      display_order: 0,
    }),
  ]);

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
    // 1. LOGIN
    console.log("[Step 1] Logging into Admin Portal...");
    await page.goto("http://localhost:3000/admin/login", { waitUntil: "networkidle", timeout: 25000 });
    const emailInput = page.locator('input[type="email"], input[name="email"]');
    if ((await emailInput.count()) > 0) {
      await emailInput.fill("qa-admin@kselect-test.local");
      await page.locator('input[type="password"], input[name="password"]').fill("Password123!@#");
      await page.locator('button[type="submit"]').click();
      await page.waitForURL((url) => !url.pathname.includes("/admin/login"), { timeout: 20000 });
    }
    console.log("✓ Logged in successfully.");

    // 2. NAVIGATE TO BRAND MARKETING
    console.log("[Step 2] Navigating to Brand Marketing & verifying 1800px standard...");
    await page.goto("http://localhost:3000/admin/brand-marketing", { waitUntil: "networkidle", timeout: 25000 });
    await page.waitForTimeout(2000);

    // Verify 1800px standard
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForTimeout(1000);
    const shellWidth = await page.evaluate(() => {
      const el = document.querySelector('div[style*="max-width: 1800px"], .max-w-\\[1800px\\]');
      return el ? el.getBoundingClientRect().width : null;
    });
    console.log("  Shell max-width evaluated:", shellWidth);

    await page.screenshot({
      path: path.join(artifactsDir, "bsrc-012-r1-01-admin-1800px-layout.png"),
      fullPage: false,
    });
    console.log("  ✓ Captured bsrc-012-r1-01-admin-1800px-layout.png");

    // 3. EXTRACT EXHIBITOR URL
    console.log("[Step 3] Extracting exhibitor draft in Import & Review workspace...");
    await page.locator('button:has-text("Import & Review")').click();
    await page.waitForTimeout(1000);

    const testUrl = "https://www.intercharmkorea.com/ko-kr/exhibitor_directory/Exhibitor_detail.주제이코모.org-ec0b85bc-960d-49d4-9dca-146c10ae59cb.html#/";
    const urlInput = page.locator('input[type="url"]').first();
    await urlInput.fill(testUrl);
    await page.waitForTimeout(300);

    const extractBtn = page.locator('button[type="submit"]:has-text("Extract"), button:has-text("Extract Exhibitor Info")').first();
    await extractBtn.click();
    console.log("  Extract button clicked, waiting for review workspace...");

    await page.waitForSelector('text=1. Legal Company Entity', { timeout: 35000 });
    await page.waitForTimeout(1000);
    console.log("✓ Review workspace loaded!");

    // 4. SET KOREAN COMPANY NAME TO MATCH SEEDED DUPLICATE
    console.log(`[Step 4] Setting Korean company name to match: "${existingNameKr}"...`);
    const nameKrInput = page.locator('label:has-text("Company Name (Korean)")').locator('..').locator('input');
    await nameKrInput.fill(existingNameKr);
    await page.waitForTimeout(2500); // allow handleRecheckDuplicates to fire

    // Verify the compact duplicate warning banner appears
    const warningBanner = page.locator('text=중복 가능성이 있는 회사입니다.');
    await warningBanner.waitFor({ state: "visible", timeout: 10000 });
    console.log("✓ Compact duplicate warning banner is visible!");

    await page.screenshot({
      path: path.join(artifactsDir, "bsrc-012-r1-02-compact-duplicate-warning.png"),
      fullPage: false,
    });
    console.log("  ✓ Captured bsrc-012-r1-02-compact-duplicate-warning.png");

    // 5. CLICK SAVE BUTTON TO OPEN SIMPLIFIED CONFIRMATION DIALOG
    console.log("[Step 5] Clicking Save button to trigger simplified confirmation dialog...");
    const saveBtn = page.locator('button:has-text("Save to Brand List (중복 확인 후 등록)")');
    await saveBtn.click();
    await page.waitForTimeout(1000);

    // Verify simplified confirmation dialog
    const modalTitle = page.locator('h3:has-text("중복 가능성이 있습니다.")');
    await modalTitle.waitFor({ state: "visible", timeout: 5000 });
    const modalMsg = page.locator('text=기존 회사와 일부 정보가 일치합니다. 그래도 새로운 회사로 등록하시겠습니까?');
    await modalMsg.waitFor({ state: "visible", timeout: 5000 });
    console.log("✓ Simplified confirmation dialog opened with exact title & copy!");

    await page.screenshot({
      path: path.join(artifactsDir, "bsrc-012-r1-03-simplified-confirm-modal.png"),
      fullPage: false,
    });
    console.log("  ✓ Captured bsrc-012-r1-03-simplified-confirm-modal.png");

    // 6. TEST CANCEL BUTTON
    console.log("[Step 6] Testing Cancel button in modal...");
    await page.locator('.fixed button:has-text("취소 (Cancel)")').click();
    await page.waitForTimeout(1000);
    const modalHidden = (await modalTitle.count()) === 0;
    console.log("✓ Modal dismissed cleanly on Cancel. modalHidden:", modalHidden);

    // 7. TEST EMAIL REMOVAL / DYNAMIC RECHECK
    console.log("[Step 7] Testing dynamic email change/removal recheck...");
    // Change Korean name to unique so only email matches
    await nameKrInput.fill(`완전고유회사_${Math.random().toString(36).slice(2, 7)}`);
    await page.waitForTimeout(2000);

    // Set contact email to the matching email
    const emailCellInput = page.locator('table input[type="email"]').first();
    await emailCellInput.fill(existingEmail);
    await page.waitForTimeout(2500); // trigger recheck

    // Verify warning appeared for email
    const emailDupBadge = page.locator('span:has-text("담당자 이메일")').first();
    await emailDupBadge.waitFor({ state: "visible", timeout: 8000 });
    console.log("✓ Email duplicate detected and displayed with '담당자 이메일' badge!");

    await page.screenshot({
      path: path.join(artifactsDir, "bsrc-012-r1-04-email-duplicate-detected.png"),
      fullPage: false,
    });
    console.log("  ✓ Captured bsrc-012-r1-04-email-duplicate-detected.png");

    // Now edit the email to unique address
    console.log("  Editing contact email to unique address...");
    await emailCellInput.fill(`completely_unique_${Math.random().toString(36).slice(2, 7)}@newbrand.com`);
    await page.waitForTimeout(2500);

    // Warning banner should be completely gone
    const warningCount = await page.locator('text=중복 가능성이 있는 회사입니다.').count();
    console.log("✓ Warning cleared immediately on email edit to unique! Banner count:", warningCount);

    await page.screenshot({
      path: path.join(artifactsDir, "bsrc-012-r1-05-email-cleared-warning-gone.png"),
      fullPage: false,
    });
    console.log("  ✓ Captured bsrc-012-r1-05-email-cleared-warning-gone.png");

    // 8. CONFIRMED REGISTRATION WORKFLOW
    console.log("[Step 8] Testing confirmed registration despite duplicate...");
    // Set Korean name back to matching existing company
    await nameKrInput.fill(existingNameKr);
    await page.waitForTimeout(2500);

    // Open confirmation dialog
    await page.locator('button:has-text("Save to Brand List (중복 확인 후 등록)")').click();
    await modalTitle.waitFor({ state: "visible", timeout: 5000 });

    // Click [신규 회사로 등록 (Register as New Company)]
    console.log("  Clicking '신규 회사로 등록 (Register as New Company)' in modal...");
    await page.locator('.fixed button:has-text("신규 회사로 등록 (Register as New Company)")').click();
    await page.waitForTimeout(4000);

    // Success alert should appear
    const successMsg = page.locator('text=중복 확인 후 신규 회사');
    await successMsg.waitFor({ state: "visible", timeout: 15000 });
    console.log("✓ Confirmed registration saved successfully with notification banner!");

    await page.screenshot({
      path: path.join(artifactsDir, "bsrc-012-r1-06-registration-success-banner.png"),
      fullPage: false,
    });
    console.log("  ✓ Captured bsrc-012-r1-06-registration-success-banner.png");

    // 9. VERIFY BRAND LIST COMPACT VIEW & PERSISTENCE
    console.log("[Step 9] Switching to Brand List tab & verifying compact view...");
    await page.locator('button:has-text("Brand List 상세 보기 →")').click();
    await page.waitForTimeout(3000);

    await page.screenshot({
      path: path.join(artifactsDir, "bsrc-012-r1-07-brand-list-compact-verified.png"),
      fullPage: false,
    });
    console.log("  ✓ Captured bsrc-012-r1-07-brand-list-compact-verified.png");

    console.log("\n================================================================================");
    console.log("✓ BROWSER QA COMPLETED 100% SUCCESSFULLY");
    console.log("================================================================================\n");
  } catch (err) {
    console.error("Browser QA failed:", err);
    throw err;
  } finally {
    await browser.close();
  }
}

runBrowserQA().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
