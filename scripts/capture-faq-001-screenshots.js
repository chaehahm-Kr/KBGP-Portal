const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");
const { createClient } = require("@supabase/supabase-js");

const envText = fs.readFileSync(".env.local", "utf8");
const env = {};
envText.split("\n").forEach((l) => {
  const m = l.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (m) {
    let v = m[2] || "";
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    if (v.startsWith("'") && v.endsWith("'")) v = v.slice(1, -1);
    env[m[1]] = v.trim();
  }
});

const client = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY
);

const OUTPUT_DIR = path.join(
  __dirname,
  "..",
  "Manuals",
  "MAN-B-FAQ-001_Knowledge-FAQ",
  "02_CLAUDE_PACKAGE",
  "02_SCREENSHOTS"
);

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const PORTAL_URL = "https://portal.kselectnetwork.com";
const ADMIN_URL = PORTAL_URL;

async function main() {
  console.log("Preparing QA user credentials for FAQ-001 screenshots...");
  const { data: users } = await client.auth.admin.listUsers();
  const portalUser = users.users.find((u) => u.email === "qa-portal-test@letusto.com");
  const adminUser = users.users.find((u) => u.email === "qa-admin-test@letusto.com");

  if (portalUser) {
    await client.auth.admin.updateUserById(portalUser.id, { password: "Password123!@#" });
  }
  if (adminUser) {
    await client.auth.admin.updateUserById(adminUser.id, { password: "Password123!@#" });
  }

  const browser = await chromium.launch({ headless: true });
  const portalContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    colorScheme: "light",
  });
  const portalPage = await portalContext.newPage();

  console.log("Logging in to Brand Portal...");
  await portalPage.goto(`${PORTAL_URL}/portal/login`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await portalPage.locator("input#email, input[type='email']").fill("qa-portal-test@letusto.com");
  await portalPage.locator("input#password, input[type='password']").fill("Password123!@#");
  await portalPage.locator('button[type="submit"]').click();
  await portalPage.waitForTimeout(3000);

  // SCR-B-FAQ-001: Help Center Main Hero & Search Hub
  console.log("Capturing SCR-B-FAQ-001 (Help Center Main Hero)...");
  await portalPage.goto(`${PORTAL_URL}/portal/help`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await portalPage.waitForTimeout(2500);
  await portalPage.screenshot({
    path: path.join(OUTPUT_DIR, "SCR-B-FAQ-001.png")
  });

  // SCR-B-FAQ-002: Topic Navigation Grid & Featured FAQs
  console.log("Capturing SCR-B-FAQ-002 (Topic Grid & Featured FAQs)...");
  const topicSection = portalPage.locator('div, section').filter({ hasText: /주제별|토픽|카테고리/ }).first();
  if (await topicSection.count() > 0) {
    await topicSection.scrollIntoViewIfNeeded();
  } else {
    await portalPage.evaluate(() => {
      window.scrollTo(0, 500);
      const m = document.querySelector('main');
      if (m) m.scrollTop = 500;
    });
  }
  await portalPage.waitForTimeout(1500);
  await portalPage.screenshot({
    path: path.join(OUTPUT_DIR, "SCR-B-FAQ-002.png")
  });

  // SCR-B-FAQ-003: Topic Selected & FAQ Accordion Expanded
  console.log("Capturing SCR-B-FAQ-003 (Topic Selected & Accordion)...");
  await portalPage.evaluate(() => window.scrollTo(0, 0));
  await portalPage.waitForTimeout(500);
  const ordersCard = portalPage.locator('button, div').filter({ hasText: /발주 요청 & 오더|topic-orders|주문/ }).first();
  if (await ordersCard.count() > 0) {
    await ordersCard.click();
    await portalPage.waitForTimeout(1500);
  }
  const faqItem = portalPage.locator('button, div').filter({ hasText: /발주|PO|납기/ }).nth(1);
  if (await faqItem.count() > 0) {
    await faqItem.click();
    await portalPage.waitForTimeout(1000);
  }
  await portalPage.screenshot({
    path: path.join(OUTPUT_DIR, "SCR-B-FAQ-003.png")
  });

  // SCR-B-FAQ-004: Grounded Ask K SELECT Direct Answer View
  console.log("Capturing SCR-B-FAQ-004 (Ask K SELECT Direct Answer)...");
  await portalPage.goto(`${PORTAL_URL}/portal/help/ask?q=${encodeURIComponent("발주서 승인 후 절차가 어떻게 되나요?")}`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await portalPage.waitForTimeout(3000);
  await portalPage.screenshot({
    path: path.join(OUTPUT_DIR, "SCR-B-FAQ-004.png")
  });

  // SCR-B-FAQ-005: Grounded Search Citations & Source Links
  console.log("Capturing SCR-B-FAQ-005 (Citations & Source Links)...");
  await portalPage.evaluate(() => window.scrollBy(0, 280));
  await portalPage.waitForTimeout(1000);
  await portalPage.screenshot({
    path: path.join(OUTPUT_DIR, "SCR-B-FAQ-005.png")
  });

  // SCR-B-FAQ-006: Knowledge Manual Detail & Related FAQs View
  console.log("Capturing SCR-B-FAQ-006 (Manual Detail & Related FAQs)...");
  await portalPage.goto(`${PORTAL_URL}/portal/help/kno-order-management-v10`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await portalPage.waitForTimeout(2500);
  await portalPage.evaluate(() => window.scrollBy(0, 300));
  await portalPage.waitForTimeout(1000);
  await portalPage.screenshot({
    path: path.join(OUTPUT_DIR, "SCR-B-FAQ-006.png")
  });

  // SCR-B-FAQ-007: Support Escalation Handoff with Pre-filled Question
  console.log("Capturing SCR-B-FAQ-007 (Support Handoff Inflow)...");
  await portalPage.evaluate(() => {
    sessionStorage.setItem("kselect_support_handoff", JSON.stringify({
      origin: "HELP_CENTER_ASK",
      question: "발주 수량 변경 및 납기 연장 요청",
      askResult: "GROUNDED_ANSWER",
      suggestedAnswer: "운영팀 협의가 필요한 사안입니다.",
      sources: [{ id: "kno-order-management-v10", title: "발주 관리 매뉴얼", version: "v1.0" }],
      timestamp: new Date().toISOString()
    }));
  });
  await portalPage.goto(`${PORTAL_URL}/portal/support?new=1&category=po_change`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await portalPage.waitForTimeout(2500);
  await portalPage.screenshot({
    path: path.join(OUTPUT_DIR, "SCR-B-FAQ-007.png")
  });

  // SCR-B-FAQ-008: Mobile Responsive Viewport of Help Center (375x812)
  console.log("Capturing SCR-B-FAQ-008 (Mobile Viewport Help Center)...");
  const mobileContext = await browser.newContext({
    viewport: { width: 375, height: 812 },
    deviceScaleFactor: 2,
    colorScheme: "light"
  });
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto(`${PORTAL_URL}/portal/login`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await mobilePage.locator("input#email, input[type='email']").fill("qa-portal-test@letusto.com");
  await mobilePage.locator("input#password, input[type='password']").fill("Password123!@#");
  await mobilePage.locator('button[type="submit"]').click();
  await mobilePage.waitForTimeout(3000);
  await mobilePage.goto(`${PORTAL_URL}/portal/help`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await mobilePage.waitForTimeout(2500);
  await mobilePage.screenshot({
    path: path.join(OUTPUT_DIR, "SCR-B-FAQ-008.png")
  });
  await mobileContext.close();

  // Log in to Admin Console
  const adminContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    colorScheme: "light"
  });
  const adminPage = await adminContext.newPage();

  console.log("Logging in to Admin Console...");
  await adminPage.goto(`${ADMIN_URL}/admin/login`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await adminPage.locator("input#email, input[type='email']").fill("qa-admin-test@letusto.com");
  await adminPage.locator("input#password, input[type='password']").fill("Password123!@#");
  await adminPage.locator('button[type="submit"]').click();
  await adminPage.waitForTimeout(3000);

  // SCR-B-FAQ-009: Admin FAQ Candidate Review & Publishing Console
  console.log("Capturing SCR-B-FAQ-009 (Admin FAQ Topics Console)...");
  await adminPage.goto(`${ADMIN_URL}/admin/knowledge/topics-faq`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await adminPage.waitForTimeout(3000);
  await adminPage.screenshot({
    path: path.join(OUTPUT_DIR, "SCR-B-FAQ-009.png")
  });

  // SCR-B-FAQ-010: Admin Knowledge Library Management Console
  console.log("Capturing SCR-B-FAQ-010 (Admin Knowledge Library)...");
  await adminPage.goto(`${ADMIN_URL}/admin/knowledge/library`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await adminPage.waitForTimeout(3000);
  await adminPage.screenshot({
    path: path.join(OUTPUT_DIR, "SCR-B-FAQ-010.png")
  });

  await adminContext.close();
  await portalContext.close();
  await browser.close();
  console.log("All 10 FAQ screenshots captured successfully into:", OUTPUT_DIR);
}

main().catch(err => {
  console.error("Error capturing FAQ screenshots:", err);
  process.exit(1);
});
