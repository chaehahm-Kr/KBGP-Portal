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
  "MAN-B-TASK-001_Task-Communication",
  "02_CLAUDE_PACKAGE",
  "02_SCREENSHOTS"
);

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const PORTAL_URL = "https://portal.kselectnetwork.com";
const ADMIN_URL = "https://admin.kselectnetwork.com";

async function main() {
  console.log("Preparing test data for TASK-001 screenshots...");
  
  // Verify/setup QA users
  const { data: users } = await client.auth.admin.listUsers();
  const portalUser = users.users.find((u) => u.email === "qa-portal-test@letusto.com");
  const adminUser = users.users.find((u) => u.email === "qa-admin-test@letusto.com");

  if (portalUser) {
    await client.auth.admin.updateUserById(portalUser.id, { password: "Password123!@#" });
  }
  if (adminUser) {
    await client.auth.admin.updateUserById(adminUser.id, { password: "Password123!@#" });
  }

  // Fetch or ensure test inquiries for portal company
  const { data: companyUser } = await client
    .from("company_users")
    .select("company_id")
    .eq("id", portalUser.id)
    .single();

  const companyId = companyUser?.company_id;
  console.log("Target company ID:", companyId);

  // Fetch inquiries for this company
  let { data: inqs } = await client
    .from("partner_inquiries")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  console.log("Found existing inquiries:", inqs?.length);

  // Ensure at least 3 distinct inquiries exist (one open/in_review, one action_required, one closed)
  let normalInq = inqs?.find((i) => i.status === "in_review" || i.status === "open");
  let actionInq = inqs?.find((i) => i.status === "action_required" || i.is_action_required);
  let closedInq = inqs?.find((i) => i.status === "closed" || i.status === "resolved");

  if (!normalInq) {
    const { data: created } = await client
      .from("partner_inquiries")
      .insert({
        company_id: companyId,
        created_by: portalUser.id,
        category: "product",
        title: "신규 라인업 전성분 영문 라벨 검토 요청",
        content: "2026 하반기 신규 비건 세럼 라인업의 전성분 영문 번역본 및 FDA 라벨 표기 적합성 검토를 요청드립니다.",
        case_number: "CASE-2026-0041",
        status: "in_review",
        is_action_required: false,
      })
      .select()
      .single();
    normalInq = created;

    // Add sample messages
    await client.from("partner_inquiry_messages").insert([
      {
        inquiry_id: normalInq.id,
        sender_type: "partner",
        sender_id: portalUser.id,
        sender_name: "주식회사 올리브코스메틱",
        content: "2026 하반기 신규 비건 세럼 라인업의 전성분 영문 번역본 및 FDA 라벨 표기 적합성 검토를 요청드립니다.",
        message_type: "message",
      },
      {
        inquiry_id: normalInq.id,
        sender_type: "admin",
        sender_id: adminUser?.id,
        sender_name: "K SELECT 규제준수팀 (Alex Kim)",
        content: "안녕하세요, K SELECT 규제준수팀입니다. 전달해주신 전성분표 접수되었으며 미국 OTC 및 FDA MoCRA 기준 검토 진행 중입니다.",
        message_type: "message",
      },
    ]);
  }

  if (!actionInq) {
    const { data: created } = await client
      .from("partner_inquiries")
      .insert({
        company_id: companyId,
        created_by: portalUser.id,
        category: "logistics",
        title: "출고 준비(Goods Ready) 패킹리스트 카톤 규격 보완 요청",
        content: "PO-2026-0008 출고 준비 등록 건에 대해 물류팀의 카톤 실측 CBM 확인 요청이 접수되었습니다.",
        case_number: "CASE-2026-0038",
        status: "action_required",
        is_action_required: true,
      })
      .select()
      .single();
    actionInq = created;

    await client.from("partner_inquiry_messages").insert([
      {
        inquiry_id: actionInq.id,
        sender_type: "admin",
        sender_id: adminUser?.id,
        sender_name: "K SELECT 물류운영팀 (David Lee)",
        content: "제출해주신 패킹리스트의 3번 팔레트 카톤 높이가 1.2m를 초과합니다. 재측정된 CBM 및 패킹리스트 수정본 첨부를 부탁드립니다.",
        message_type: "action_required",
        is_action_flag: true,
      },
    ]);
  }

  if (!closedInq) {
    const { data: created } = await client
      .from("partner_inquiries")
      .insert({
        company_id: companyId,
        created_by: portalUser.id,
        category: "settlement",
        title: "2026년 9월 2차 정산 세금계산서 발행 완료 안내",
        content: "9월 2차 정산 전표(AP-2026-0012) 승인 및 지급 완료 건입니다.",
        case_number: "CASE-2026-0029",
        status: "closed",
        is_action_required: false,
        satisfaction_score: 5,
        satisfaction_comment: "빠르고 정확한 정산 지원 감사드립니다.",
      })
      .select()
      .single();
    closedInq = created;

    await client.from("partner_inquiry_messages").insert([
      {
        inquiry_id: closedInq.id,
        sender_type: "admin",
        sender_id: adminUser?.id,
        sender_name: "K SELECT 정산팀",
        content: "정산 전표 입금이 정상 완료되어 케이스를 종결합니다.",
        message_type: "case_closed",
      },
    ]);
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

  // SCR-B-TASK-001: Support Center Main Hub & Case List
  console.log("Capturing SCR-B-TASK-001...");
  await portalPage.goto(`${PORTAL_URL}/portal/support`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await portalPage.waitForTimeout(2000);
  await portalPage.screenshot({ path: path.join(OUTPUT_DIR, "SCR-B-TASK-001.png") });

  // SCR-B-TASK-002: New 1:1 Inquiry Submission Modal
  console.log("Capturing SCR-B-TASK-002...");
  await portalPage.goto(`${PORTAL_URL}/portal/support?new=1`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await portalPage.waitForTimeout(2000);
  await portalPage.screenshot({ path: path.join(OUTPUT_DIR, "SCR-B-TASK-002.png") });

  // SCR-B-TASK-003: Threaded Conversation & Message Stream
  console.log("Capturing SCR-B-TASK-003...");
  const inq3Id = normalInq.case_number || normalInq.id;
  await portalPage.goto(`${PORTAL_URL}/portal/support?case=${inq3Id}`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await portalPage.waitForTimeout(2000);
  await portalPage.screenshot({ path: path.join(OUTPUT_DIR, "SCR-B-TASK-003.png") });

  // SCR-B-TASK-004: Action Required Alert & Supplement Reply Form
  console.log("Capturing SCR-B-TASK-004...");
  const inq4Id = actionInq.case_number || actionInq.id;
  await portalPage.goto(`${PORTAL_URL}/portal/support?case=${inq4Id}`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await portalPage.waitForTimeout(2000);
  await portalPage.screenshot({ path: path.join(OUTPUT_DIR, "SCR-B-TASK-004.png") });

  // SCR-B-TASK-005: Case Closed & CSAT Satisfaction Rating
  console.log("Capturing SCR-B-TASK-005...");
  const inq5Id = closedInq.case_number || closedInq.id;
  await portalPage.goto(`${PORTAL_URL}/portal/support?case=${inq5Id}`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await portalPage.waitForTimeout(2000);
  await portalPage.screenshot({ path: path.join(OUTPUT_DIR, "SCR-B-TASK-005.png") });

  // SCR-B-TASK-006: PO Change Request Deep Link Prefill
  console.log("Capturing SCR-B-TASK-006...");
  await portalPage.goto(
    `${PORTAL_URL}/portal/support?new=1&category=po_change&po_no=PO-2026-0008&order_date=2026-09-15`,
    { waitUntil: "domcontentloaded", timeout: 30000 }
  );
  await portalPage.waitForTimeout(2000);
  await portalPage.screenshot({ path: path.join(OUTPUT_DIR, "SCR-B-TASK-006.png") });

  // SCR-B-TASK-007: Settlement Inquiry Deep Link Prefill
  console.log("Capturing SCR-B-TASK-007...");
  await portalPage.goto(
    `${PORTAL_URL}/portal/support?new=1&category=settlement&ap_no=AP-2026-0012&invoice_total=48500`,
    { waitUntil: "domcontentloaded", timeout: 30000 }
  );
  await portalPage.waitForTimeout(2000);
  await portalPage.screenshot({ path: path.join(OUTPUT_DIR, "SCR-B-TASK-007.png") });

  // SCR-B-TASK-008: In-App Header Notification Feed
  console.log("Capturing SCR-B-TASK-008...");
  await portalPage.goto(`${PORTAL_URL}/portal/support`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await portalPage.waitForTimeout(2000);
  // Click the notification bell in header
  const bell = portalPage.locator("button:has(svg.lucide-bell), button[aria-label*='알림'], button[aria-label*='Notification']").first();
  if (await bell.isVisible()) {
    await bell.click();
    await portalPage.waitForTimeout(1000);
  }
  await portalPage.screenshot({ path: path.join(OUTPUT_DIR, "SCR-B-TASK-008.png") });

  // SCR-B-TASK-009: Viewer Role Read-Only Restriction
  console.log("Capturing SCR-B-TASK-009 (Viewer mode simulation)...");
  // Update company_user permission temporarily to viewer / support:read
  const originalPerms = companyUser?.permissions || {};
  await client.from("company_users").update({
    permissions: {
      role: "viewer",
      preset: "viewer",
      matrix: { support: "read", orders: "read", finance: "read", products: "read", brands: "read", company_info: "read" }
    }
  }).eq("id", portalUser.id);

  await portalPage.goto(`${PORTAL_URL}/portal/support`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await portalPage.waitForTimeout(2000);
  await portalPage.screenshot({ path: path.join(OUTPUT_DIR, "SCR-B-TASK-009.png") });

  // SCR-B-TASK-010: Access Denied View (support:none)
  console.log("Capturing SCR-B-TASK-010 (Access Denied mode simulation)...");
  await client.from("company_users").update({
    permissions: {
      role: "restricted",
      preset: "restricted",
      matrix: { support: "none" }
    }
  }).eq("id", portalUser.id);

  await portalPage.goto(`${PORTAL_URL}/portal/support`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await portalPage.waitForTimeout(2000);
  await portalPage.screenshot({ path: path.join(OUTPUT_DIR, "SCR-B-TASK-010.png") });

  // Restore user permissions to admin
  await client.from("company_users").update({
    permissions: {
      role: "admin",
      preset: "admin",
      matrix: { support: "manage", orders: "manage", finance: "manage", products: "manage", brands: "manage", company_info: "manage", bank_info: "manage", agreements: "manage", application: "manage" }
    }
  }).eq("id", portalUser.id);

  await portalContext.close();

  // Admin captures
  const adminContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    colorScheme: "light",
  });
  const adminPage = await adminContext.newPage();

  console.log("Logging in to Admin Console...");
  await adminPage.goto(`${ADMIN_URL}/admin/login`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await adminPage.locator("input#email, input[type='email']").fill("qa-admin-test@letusto.com");
  await adminPage.locator("input#password, input[type='password']").fill("Password123!@#");
  await adminPage.locator('button[type="submit"]').click();
  await adminPage.waitForTimeout(3000);

  // SCR-B-TASK-011: Admin Partner Inquiries Console
  console.log("Capturing SCR-B-TASK-011...");
  await adminPage.goto(`${ADMIN_URL}/admin/partner-inquiries`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await adminPage.waitForTimeout(2000);
  await adminPage.screenshot({ path: path.join(OUTPUT_DIR, "SCR-B-TASK-011.png") });

  // SCR-B-TASK-012: Admin Tasks Console
  console.log("Capturing SCR-B-TASK-012...");
  await adminPage.goto(`${ADMIN_URL}/admin/tasks`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await adminPage.waitForTimeout(2000);
  await adminPage.screenshot({ path: path.join(OUTPUT_DIR, "SCR-B-TASK-012.png") });

  await adminContext.close();
  await browser.close();

  console.log("All 12 screenshots captured successfully into:", OUTPUT_DIR);
}

main().catch(console.error);
