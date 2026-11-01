import { chromium } from "playwright";
import { createServerClient } from "@supabase/ssr";
import * as path from "path";
import * as fs from "fs";

function getEnv() {
  const text = fs.readFileSync(".env.local", "utf8");
  const env: Record<string, string> = {};
  text.split("\n").forEach((line) => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let value = match[2] || "";
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
      env[match[1]] = value.trim();
    }
  });
  return env;
}

async function main() {
  const env = getEnv();
  const artifactsDir = "C:\\Users\\ChaeHahm\\.gemini\\antigravity\\brain\\60393d8e-2782-4539-8c9d-c53f4b39baf6";
  if (!fs.existsSync(artifactsDir)) {
    fs.mkdirSync(artifactsDir, { recursive: true });
  }

  console.log("1. Authenticating admin user via @supabase/ssr server client...");
  const serverClient = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );

  const { data: authData, error: authError } = await serverClient.auth.signInWithPassword({
    email: "qa-admin@kselect-test.local",
    password: "Password123!@#",
  });

  if (authError || !authData.session) {
    throw new Error(`Auth failed: ${authError?.message}`);
  }
  console.log("✓ Authenticated session obtained for", authData.user?.email);

  const projectRef = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
  const cookieValue = "base64-" + Buffer.from(JSON.stringify(authData.session)).toString("base64");

  console.log("2. Launching Playwright browser...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1800, height: 1200 },
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

  page.on("dialog", async (dialog) => {
    console.log(`[DIALOG] ${dialog.type()}: ${dialog.message()}`);
    await dialog.accept();
  });

  try {
    // 3. Navigate directly to /admin/brand-marketing?tab=campaigns
    console.log("3. Navigating to http://localhost:3000/admin/brand-marketing?tab=campaigns...");
    await page.goto("http://localhost:3000/admin/brand-marketing?tab=campaigns", { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(2000);

    // Click "+ Create Campaign"
    console.log("Opening Campaign Wizard...");
    const createCampBtn = page.locator('button:has-text("+ Create Campaign"), button:has-text("Create Campaign")').first();
    await createCampBtn.click();
    await page.waitForTimeout(1000);

    // Click "Next: Select Template Package →" to enter Step 2
    console.log("Entering Step 2: Template Package Selection...");
    const nextBtn = page.locator('button:has-text("Next: Select Template Package"), button:has-text("Step 2")').first();
    await nextBtn.click();
    await page.waitForTimeout(1500);

    // Verify TemplatePickerTable is visible
    const table = page.locator("table").first();
    await table.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    // SCREENSHOT 1: Template Management Table View
    console.log("Capturing Screenshot 1: TemplatePickerTable View...");
    const s1Path = path.join(artifactsDir, "adm-email-tpl-001-table-view.png");
    await page.screenshot({ path: s1Path, fullPage: false });
    console.log("✓ Saved Screenshot 1:", s1Path);

    // Click on the first row to ensure it is selected
    const firstRow = page.locator("tbody tr").first();
    if ((await firstRow.count()) > 0) {
      await firstRow.click();
      await page.waitForTimeout(1000);
    }

    // Scroll down to live preview panel
    console.log("Scrolling down to live preview pane...");
    const previewHeader = page.locator("text=Live Send-Ready Visual Preview").first();
    if ((await previewHeader.count()) > 0) {
      await previewHeader.scrollIntoViewIfNeeded();
      await page.waitForTimeout(1000);
    } else {
      await page.evaluate(() => window.scrollTo(0, 900));
      await page.waitForTimeout(1000);
    }

    // SCREENSHOT 2: Desktop Preview (600px)
    console.log("Capturing Screenshot 2: Desktop Preview (600px)...");
    const s2Path = path.join(artifactsDir, "adm-email-tpl-001-desktop-preview.png");
    await page.screenshot({ path: s2Path, fullPage: false });
    console.log("✓ Saved Screenshot 2:", s2Path);

    // Click Mobile (375px) toggle button
    console.log("Switching to Mobile (375px) preview...");
    const mobileBtn = page.locator('button:has-text("Mobile (375px)")').first();
    if ((await mobileBtn.count()) > 0) {
      await mobileBtn.click();
      await page.waitForTimeout(1000);
    }

    // SCREENSHOT 3: Mobile Preview (375px)
    console.log("Capturing Screenshot 3: Mobile Preview (375px)...");
    const s3Path = path.join(artifactsDir, "adm-email-tpl-001-mobile-preview.png");
    await page.screenshot({ path: s3Path, fullPage: false });
    console.log("✓ Saved Screenshot 3:", s3Path);

    console.log("===============================================================");
    console.log("QA VERIFICATION COMPLETE: ALL 3 SCREENSHOTS CAPTURED!");
    console.log("===============================================================");
  } catch (err) {
    console.error("QA Test Error:", err);
    const errPath = path.join(artifactsDir, "adm-email-tpl-001-qa-error.png");
    await page.screenshot({ path: errPath });
    console.log("Saved error screenshot:", errPath);
  } finally {
    await browser.close();
  }
}

main();
