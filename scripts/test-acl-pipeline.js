const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envText = fs.readFileSync(envPath, 'utf8');
  envText.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || '';
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
      process.env[key] = value.trim();
    }
  });
}

const supabaseUrl = 'https://shzfrppdobpmrstcjfqu.supabase.co';
const supabaseSecretKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
const admin = createClient(supabaseUrl, supabaseSecretKey);

const ACL_CATEGORIES = [
  { id: "application", labelKo: "입점 신청서" },
  { id: "brands", labelKo: "브랜드 관리" },
  { id: "products", labelKo: "제품 관리" },
  { id: "orders", labelKo: "주문 관리" },
  { id: "finance", labelKo: "정산 / 인보이스" },
  { id: "support", labelKo: "문의 지원" },
  { id: "company_info", labelKo: "회사 기본 정보" },
  { id: "bank_info", labelKo: "송금 계좌 정보" },
  { id: "agreements", labelKo: "계약 및 문서" },
];

const ROLE_PRESETS = {
  staff: {
    application: "read",
    brands: "write",
    products: "write",
    orders: "write",
    finance: "read",
    support: "write",
    company_info: "read",
    bank_info: "none",
    agreements: "read",
  }
};

function parseAclLevel(val) {
  if (!val) return "none";
  if (val === "none") return "none";
  if (val === "read") return "read";
  if (val === "write" || val === "edit") return "write";
  if (val === "manage" || val === "full" || val === "admin") return "manage";
  return "none";
}

function normalizePermissions(permissionsObj = {}, userRole) {
  let defaultPreset = ROLE_PRESETS.staff;
  const result = { ...defaultPreset };

  ACL_CATEGORIES.forEach((cat) => {
    if (permissionsObj[cat.id] !== undefined) {
      result[cat.id] = parseAclLevel(permissionsObj[cat.id]);
    }
  });

  return result;
}

async function testPipeline() {
  console.log("=== STEP 1: DB Lookup for support@letusto.com ===");
  const { data: user, error: uErr } = await admin
    .from("company_users")
    .select("id, email, company_role, permissions, company_id, status")
    .eq("email", "support@letusto.com")
    .single();

  if (uErr || !user) {
    console.error("DB User Error:", uErr);
    return;
  }

  console.log("User record from DB:", JSON.stringify(user, null, 2));

  console.log("\n=== STEP 2: Normalization ===");
  const normalized = normalizePermissions(user.permissions, user.company_role);
  console.log("Normalized ACL Matrix:", JSON.stringify(normalized, null, 2));

  console.log("\n=== STEP 3: Sidebar Item Locking Test ===");
  const menuItems = [
    { name: "대시보드", href: "/portal" },
    { name: "제품 관리", href: "/portal/products", category: "products" },
    { name: "주문 관리", category: "orders" },
    { name: "정산 관리", href: "/portal/finance", category: "finance" },
    { name: "문의 지원", href: "/portal/support", category: "support" },
  ];

  const settingsPages = [
    { name: "회사 정보", href: "/portal/company/info", category: "company_info" },
    { name: "브랜드 관리", href: "/portal/brands", category: "brands" },
    { name: "사용자 관리", href: "/portal/company/users", adminOnly: true },
    { name: "입점 신청 내역", href: "/portal/applications", category: "application" },
    { name: "My Account", href: "/portal/account" },
  ];

  const isCompanyAdmin = user.company_role === "company_admin";

  console.log("Main Menu items visibility:");
  menuItems.forEach(item => {
    const isLocked = item.category ? normalized[item.category] === "none" : false;
    console.log(`  - ${item.name} (${item.category || 'none'}): ${isLocked ? '🔒 LOCKED (none)' : '✅ VISIBLE'}`);
  });

  console.log("Settings Menu items visibility:");
  settingsPages.forEach(item => {
    if (item.adminOnly && !isCompanyAdmin) {
      console.log(`  - ${item.name}: 🚫 HIDDEN (Admin Only)`);
      return;
    }
    const isLocked = item.category ? normalized[item.category] === "none" : false;
    console.log(`  - ${item.name} (${item.category || 'none'}): ${isLocked ? '🔒 LOCKED (none)' : '✅ VISIBLE'}`);
  });
}

testPipeline().catch(console.error);
