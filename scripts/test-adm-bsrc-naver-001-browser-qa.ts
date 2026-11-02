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

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || "https://elkgizqgksshukxgcndy.supabase.co";
const anonKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function runBrowserQa() {
  console.log("================================================================================");
  console.log("ADM-BSRC-NAVER-001: COMPREHENSIVE BROWSER QA SUITE");
  console.log("Standards: DEPLOY-STD-001, CONCURRENT-DEV-001, AGENTS.md Rule 27");
  console.log("Target Server: http://localhost:3009");
  console.log("Supabase Project:", supabaseUrl);
  console.log("================================================================================\n");

  const artifactDir = "C:\\Users\\ChaeHahm\\.gemini\\antigravity\\brain\\730f6e70-61e4-47de-8a28-291a9d425b30";
  if (!fs.existsSync(artifactDir)) {
    fs.mkdirSync(artifactDir, { recursive: true });
  }

  // 1. Authenticate via @supabase/ssr server client
  console.log("[Step 1] Authenticating admin user via @supabase/ssr server client...");
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
    viewport: { width: 1920, height: 1080 },
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
  page.on("dialog", async (dialog) => {
    console.log("[BROWSER DIALOG]", dialog.type(), dialog.message());
    await dialog.accept();
  });

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${msg}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${msg}`);
      failed++;
    }
  }

  try {
    // --------------------------------------------------------------------------
    // Step 2: Navigate directly to Brand Marketing Import & Review
    // --------------------------------------------------------------------------
    console.log("\n[Step 2] Navigating to http://localhost:3009/admin/brand-marketing?tab=import...");
    await page.goto("http://localhost:3009/admin/brand-marketing?tab=import", {
      waitUntil: "networkidle",
      timeout: 25000,
    });
    await page.waitForTimeout(2000);

    console.log("✓ Current Page URL:", page.url());

    // Verify Rule 27 layout (1800px shell)
    const shellWidth = await page.evaluate(() => {
      const el = document.querySelector('div[style*="max-width: 1800px"], .max-w-\\[1800px\\], div[class*="1800"]');
      return el ? (el as HTMLElement).offsetWidth : 0;
    });
    console.log(`Shell width on 1920px screen: ${shellWidth}px (Target <= 1800px)`);
    assert(shellWidth <= 1800 && shellWidth > 1200, "Rule 27 1800px max-width shell strictly adhered to");

    // --------------------------------------------------------------------------
    // Step 3: Verify Default Source: InterCHARM
    // --------------------------------------------------------------------------
    console.log("\n[Step 3] Verifying InterCHARM default source controls...");
    const urlInput = page.locator('input[placeholder*="intercharmkorea"]');
    const enrichToggle = page.locator('text=Official Website Enrichment');
    const extractBtn = page.locator('button:has-text("Extract Exhibitor Info")');

    assert((await urlInput.count()) > 0, "InterCHARM URL input visible by default");
    assert((await enrichToggle.count()) > 0, "Official Website Enrichment toggle visible");
    assert((await extractBtn.count()) > 0, "Extract Exhibitor Info button visible");

    const s1Path = path.join(artifactDir, "qa_adm_bsrc_naver_001_01_intercharm_default.png");
    await page.screenshot({ path: s1Path, fullPage: false });
    console.log("  📸 Screenshot 1 saved:", s1Path);

    // --------------------------------------------------------------------------
    // Step 4: Switch Source to Naver Smart Store
    // --------------------------------------------------------------------------
    console.log("\n[Step 4] Switching Source to Naver Smart Store...");
    const naverSourceBtn = page.locator('button:has-text("Naver Smart Store")').first();
    assert((await naverSourceBtn.count()) > 0, "Naver Smart Store source button present");
    await naverSourceBtn.click();
    await page.waitForTimeout(1000);

    // Verify UI switched: Exhibition URL & Enrichment hidden, Naver controls shown
    const naverStoreUrlInput = page.locator('input[placeholder*="smartstore.naver.com"]');
    const naverTextArea = page.locator('textarea[placeholder*="상호명"]');
    const parseSellerBtn = page.locator('button:has-text("Parse Seller Info")');
    const quickSampleBtn = page.locator('button:has-text("Quick Sample")');

    assert((await urlInput.count()) === 0, "Exhibition URL input hidden for Naver");
    assert((await enrichToggle.count()) === 0, "Enrichment toggle hidden for Naver");
    assert((await extractBtn.count()) === 0, "Extract Exhibitor Info button hidden for Naver");
    assert((await naverStoreUrlInput.count()) > 0, "Naver Store URL input visible");
    assert((await naverTextArea.count()) > 0, "판매자 정보 붙여넣기 text area visible");
    assert((await parseSellerBtn.count()) > 0, "Parse Seller Info button visible");
    assert(await parseSellerBtn.isDisabled(), "Parse Seller Info button initially disabled when empty");

    const s2Path = path.join(artifactDir, "qa_adm_bsrc_naver_001_02_naver_smartstore_mode.png");
    await page.screenshot({ path: s2Path, fullPage: false });
    console.log("  📸 Screenshot 2 saved:", s2Path);

    // --------------------------------------------------------------------------
    // Step 5: Click Quick Sample (WIZARD JOSEON)
    // --------------------------------------------------------------------------
    console.log("\n[Step 5] Clicking Quick Sample (WIZARD JOSEON)...");
    await quickSampleBtn.click();
    await page.waitForTimeout(800);

    assert(await parseSellerBtn.isEnabled(), "Parse Seller Info button enabled after text is filled");
    const s3Path = path.join(artifactDir, "qa_adm_bsrc_naver_001_03_quick_sample_loaded.png");
    await page.screenshot({ path: s3Path, fullPage: false });
    console.log("  📸 Screenshot 3 saved:", s3Path);

    // --------------------------------------------------------------------------
    // Step 6: Parse Seller Info & Inspect Review Workspace
    // --------------------------------------------------------------------------
    console.log("\n[Step 6] Clicking Parse Seller Info...");
    await parseSellerBtn.click();
    await page.waitForSelector('text=Company Name (Korean)', { timeout: 15000 });

    const compName = await page.locator('label:has-text("Company Name (Korean)") + input').inputValue();
    const rep = await page.locator('label:has-text("Representative / CEO") + input').inputValue();
    const brn = await page.locator('label:has-text("Business Registration No.") + input').inputValue();

    assert(compName.includes("앨리스루움"), `Legal Company Name parsed: "${compName}"`);
    assert(rep.includes("함채형"), `Representative Name parsed: "${rep}"`);
    assert(brn.includes("123-45-67890"), `Business Registration Number parsed: "${brn}"`);

    const s4Path = path.join(artifactDir, "qa_adm_bsrc_naver_001_04_review_workspace_parsed.png");
    await page.screenshot({ path: s4Path, fullPage: false });
    console.log("  📸 Screenshot 4 saved:", s4Path);

    // --------------------------------------------------------------------------
    // Step 7: Manual Evaluation (Grade B) & Save Candidate
    // --------------------------------------------------------------------------
    console.log("\n[Step 7] Setting Evaluation Grade to B and saving candidate...");
    const gradeBBtn = page.locator('div:has(> label:has-text("Candidate Grade")) button:has-text("B")');
    assert((await gradeBBtn.count()) > 0, "Grade B selection button found");
    await gradeBBtn.click();
    await page.waitForTimeout(500);

    const saveBtn = page.locator('button:has-text("Save to Brand List")').first();
    assert((await saveBtn.count()) > 0, "Save to Brand List button available");
    await saveBtn.click();
    await page.waitForTimeout(1000);

    // If duplicate confirmation modal appears (e.g. from prior test run), confirm via modal action
    const modalConfirmBtn = page.locator('.fixed.z-\\[70\\] button:has-text("신규 회사로 등록")');
    if ((await modalConfirmBtn.count()) > 0 && (await modalConfirmBtn.isVisible())) {
      console.log("Duplicate confirmation modal opened, confirming save via modal button...");
      await modalConfirmBtn.click();
    }

    // Verify Success Message Banner
    await page.waitForSelector('text=Brand List 상세 보기', { timeout: 15000 });
    const successBanner = page.locator('text=Brand List 상세 보기');
    assert((await successBanner.count()) > 0, "Candidate successfully saved to Brand List");

    const s5Path = path.join(artifactDir, "qa_adm_bsrc_naver_001_05_saved_to_brand_list.png");
    await page.screenshot({ path: s5Path, fullPage: false });
    console.log("  📸 Screenshot 5 saved:", s5Path);

    // --------------------------------------------------------------------------
    // Step 8: Duplicate Detection Verification
    // --------------------------------------------------------------------------
    console.log("\n[Step 8] Testing Duplicate Detection on re-parse...");
    await naverSourceBtn.click();
    await page.waitForTimeout(500);
    await quickSampleBtn.click();
    await page.waitForTimeout(500);
    await parseSellerBtn.click();

    await page.waitForSelector('text=중복 가능성이 있는 회사입니다', { timeout: 15000 });
    const dupWarning = page.locator('text=중복 가능성이 있는 회사입니다');
    assert((await dupWarning.count()) > 0, "Duplicate detection triggered for already-saved company");

    const matchedField = page.locator('text=사업자등록번호');
    assert((await matchedField.count()) > 0, "Matched field clearly displays '사업자등록번호' as primary key");

    const s6Path = path.join(artifactDir, "qa_adm_bsrc_naver_001_06_duplicate_detected.png");
    await page.screenshot({ path: s6Path, fullPage: false });
    console.log("  📸 Screenshot 6 saved:", s6Path);

    // --------------------------------------------------------------------------
    // Step 9: Reversion / Preservation of InterCHARM Source
    // --------------------------------------------------------------------------
    console.log("\n[Step 9] Switching back to InterCHARM to verify no regression...");
    const intercharmBtn = page.locator('button:has-text("InterCHARM")').first();
    await intercharmBtn.click();
    await page.waitForSelector('button:has-text("Extract Exhibitor Info")', { timeout: 10000 });

    const restoredUrlInput = page.locator('input[placeholder*="intercharmkorea"]');
    const restoredEnrichToggle = page.locator('text=Official Website Enrichment');
    const restoredExtractBtn = page.locator('button:has-text("Extract Exhibitor Info")');

    assert((await restoredUrlInput.count()) > 0, "InterCHARM URL input cleanly restored");
    assert((await restoredEnrichToggle.count()) > 0, "Official Website Enrichment toggle restored");
    assert((await restoredExtractBtn.count()) > 0, "Extract Exhibitor Info button restored");

    const s7Path = path.join(artifactDir, "qa_adm_bsrc_naver_001_07_intercharm_preserved.png");
    await page.screenshot({ path: s7Path, fullPage: false });
    console.log("  📸 Screenshot 7 saved:", s7Path);

    console.log("\n================================================================================");
    console.log(`BROWSER QA COMPLETE: ${passed} Passed, ${failed} Failed`);
    console.log("================================================================================");

  } catch (err: any) {
    console.error("Browser QA encountered error:", err.message);
    const errPath = path.join(artifactDir, "qa_adm_bsrc_naver_001_error.png");
    await page.screenshot({ path: errPath });
    console.log("Saved error screenshot:", errPath);
  } finally {
    await browser.close();
  }
}

runBrowserQa();
