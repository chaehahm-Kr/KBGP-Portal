// scripts/test-prod-adm-dashboard-v2-p2-r2-qa.js
// Production Browser QA for ADM-DASHBOARD-V2-P2-001-R2
// Tests tracking reconciliation and UI refinements on https://admin.kselectnetwork.com

const { chromium } = require("playwright");

async function runQA() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log("=== STARTING QA: ADM-DASHBOARD-V2-P2-001-R2 ===");

  try {
    // 1. Login to Admin
    console.log("1. Navigating to Admin Login...");
    await page.goto("https://admin.kselectnetwork.com/admin/login", { waitUntil: "networkidle", timeout: 30000 });

    const emailInput = await page.$('input[type="email"]');
    if (emailInput) {
      console.log("Filling credentials...");
      await page.fill('input[type="email"]', "admin@letusto.com");
      await page.fill('input[type="password"]', "Admin1234!");
      await page.click('button[type="submit"]');
      await page.waitForNavigation({ waitUntil: "networkidle", timeout: 30000 });
    }

    console.log("Logged in. Navigating to /admin...");
    await page.goto("https://admin.kselectnetwork.com/admin", { waitUntil: "networkidle", timeout: 30000 });

    // 2. Data Freshness and Title
    const title = await page.textContent("h1");
    console.log(`Page title: "${title.trim()}"`);
    if (!title.includes("통합 운영 대시보드")) {
      throw new Error("Page title does not match 통합 운영 대시보드");
    }

    // 3. Objective A: Tracking KPI Verification
    console.log("2. Verifying Objective A: Tracking KPI Reconciliation...");
    const trackingKpiText = await page.locator("text=송장 미등록").locator("..").textContent();
    console.log(`Dashboard Tracking KPI card text: "${trackingKpiText.replace(/\s+/g, ' ').trim()}"`);
    if (!trackingKpiText.includes("0건")) {
      throw new Error(`Expected 0건 for 송장 미등록 on Dashboard, but got: ${trackingKpiText}`);
    }

    // Check Order Processing page for Tracking Needed
    console.log("Navigating to /admin/sales/orders to verify cross-screen reconciliation...");
    await page.goto("https://admin.kselectnetwork.com/admin/sales/orders", { waitUntil: "networkidle", timeout: 30000 });
    const trackNeededTab = await page.locator("text=TRACK NEEDED: 0").first();
    const isTrackNeededZero = await trackNeededTab.isVisible();
    console.log(`Order Processing TRACK NEEDED: 0 visible: ${isTrackNeededZero}`);
    if (!isTrackNeededZero) {
      throw new Error("Expected TRACK NEEDED: 0 on Order Processing page");
    }
    console.log("✓ Objective A PASS: Dashboard (0건) and Order Processing (0) in 100% agreement.");

    // Return to /admin
    await page.goto("https://admin.kselectnetwork.com/admin", { waitUntil: "networkidle", timeout: 30000 });

    // 4. Objective B: Brand Action Queue
    console.log("3. Verifying Objective B: Brand Action Queue...");
    const brandActionQueue = page.locator("text=브랜드 조치 과제").locator("..");
    const brandActionQueueText = await brandActionQueue.textContent();
    console.log(`Brand Action Queue header: ${brandActionQueueText.trim()}`);

    // Verify Admin Action Required & Waiting for Brand tags
    const adminActionTag = page.locator("text=Admin Action Required").first();
    const hasAdminActionTag = await adminActionTag.isVisible();
    console.log(`Admin Action Required tag visible: ${hasAdminActionTag}`);

    const waitingForBrandTag = page.locator("text=Waiting for Brand").first();
    const hasWaitingTag = await waitingForBrandTag.isVisible();
    console.log(`Waiting for Brand tag visible: ${hasWaitingTag}`);

    // 5. Objective B: KPI Semantic Colors
    console.log("4. Verifying KPI Semantic Colors...");
    const newOrdersCard = page.locator("text=신규 접수").locator("..");
    const newOrdersClass = await newOrdersCard.getAttribute("class");
    console.log(`신규 접수 card classes: ${newOrdersClass}`);
    if (!newOrdersClass.includes("bg-blue-50")) {
      throw new Error("신규 접수 card should use subtle blue accent, not amber");
    }

    const trackingCard = page.locator("text=송장 미등록").locator("..");
    const trackingClass = await trackingCard.getAttribute("class");
    console.log(`송장 미등록 card classes: ${trackingClass}`);
    if (!trackingClass.includes("bg-zinc-50")) {
      throw new Error("송장 미등록 card should use calm neutral zinc when count is 0");
    }

    // 6. Objective B: Recent Activity Tables Alignment
    console.log("5. Verifying Recent Activity Tables Alignment...");
    // Orders table
    const ordersTable = page.locator("table").first();
    const ordersHeader = await ordersTable.locator("thead tr").textContent();
    console.log(`Orders Table Headers: "${ordersHeader.replace(/\s+/g, ' ').trim()}"`);
    if (!ordersHeader.includes("주문번호") || !ordersHeader.includes("접수일")) {
      throw new Error("Orders table missing expected headers");
    }

    // Applications table
    const appsTable = page.locator("table").nth(1);
    const appsHeader = await appsTable.locator("thead tr").textContent();
    console.log(`Applications Table Headers: "${appsHeader.replace(/\s+/g, ' ').trim()}"`);
    if (!appsHeader.includes("신청번호") || !appsHeader.includes("접수일") || !appsHeader.includes("심사")) {
      throw new Error("Applications table missing expected headers");
    }

    // Verify first application number is clickable link
    const firstAppNum = appsTable.locator("tbody tr td a").first();
    const firstAppNumHref = await firstAppNum.getAttribute("href");
    console.log(`First application number link href: ${firstAppNumHref}`);
    if (!firstAppNumHref || !firstAppNumHref.includes("/admin/applications/")) {
      throw new Error(`Expected application number to link to /admin/applications/... but got ${firstAppNumHref}`);
    }

    // Check application status badge
    const firstAppBadge = appsTable.locator("tbody tr td span").first();
    const firstAppBadgeClass = await firstAppBadge.getAttribute("class");
    console.log(`First application badge classes: ${firstAppBadgeClass}`);

    console.log("=== ALL BROWSER QA CHECKS PASSED SUCCESSFULLY! ===");
  } catch (err) {
    console.error("QA FAILED with error:", err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runQA();
