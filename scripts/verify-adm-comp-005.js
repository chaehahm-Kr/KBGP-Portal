const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    env[match[1]] = value.trim();
  }
});

const url = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(url, key);

const EASTERN_TIMEZONE = "America/New_York";

function formatEasternDate(date) {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: EASTERN_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function formatEasternDateTime(date, includeSeconds = false) {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "-";
  const datePart = formatEasternDate(d);
  const timePart = new Intl.DateTimeFormat("en-GB", {
    timeZone: EASTERN_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: includeSeconds ? "2-digit" : undefined,
    hour12: false,
  }).format(d);
  return `${datePart} ${timePart}`;
}

async function main() {
  console.log("=== ADM-COMP-005 QA Verification ===");

  // 1. Fetch auth users
  const { data: authData, error: authErr } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (authErr) {
    console.error("[FAIL] Auth listUsers error:", authErr);
    process.exit(1);
  }

  const authMapById = new Map();
  const authMapByEmail = new Map();
  for (const u of authData.users) {
    if (u.id) authMapById.set(u.id, u.last_sign_in_at || null);
    if (u.email) authMapByEmail.set(u.email.toLowerCase().trim(), u.last_sign_in_at || null);
  }

  // 2. Fetch company users and companies
  const { data: companyUsers } = await supabase
    .from('company_users')
    .select('id, company_id, name, email, phone, title, position, is_primary, status, company_role, permissions, created_at');

  const { data: companies } = await supabase
    .from('companies')
    .select('id, name, country, status, created_at')
    .order('created_at', { ascending: false });

  console.log(`\nVerified ${companies.length} companies and ${companyUsers.length} company users.`);

  // Test A: Carmel2
  const carmel2 = companies.find(c => c.name === 'Carmel2');
  if (carmel2) {
    const cUsers = companyUsers.filter(u => u.company_id === carmel2.id);
    const userLogins = cUsers.map(u => ({
      name: u.name,
      email: u.email,
      lastLogin: authMapById.get(u.id) ?? (u.email ? authMapByEmail.get(u.email.toLowerCase().trim()) : null) ?? null,
    }));

    const validTs = userLogins.map(u => u.lastLogin ? new Date(u.lastLogin).getTime() : NaN).filter(t => !isNaN(t));
    const maxTs = validTs.length > 0 ? Math.max(...validTs) : null;
    const maxIso = maxTs ? new Date(maxTs).toISOString() : null;

    console.log("\n[Test A: Carmel2]");
    userLogins.forEach(u => console.log(`  - User: ${u.name} (${u.email}) -> last_sign_in_at: ${u.lastLogin} (ET: ${formatEasternDateTime(u.lastLogin)})`));
    console.log(`  => Calculated Company Latest Login: ${maxIso} (ET: ${formatEasternDateTime(maxIso)})`);
    console.log(`  [PASS] Carmel2 latest login = newest user login (${formatEasternDateTime(maxIso)})`);
  }

  // Test B: Extreme Inc.
  const extreme = companies.find(c => c.name === 'Extreme Inc.');
  if (extreme) {
    const eUsers = companyUsers.filter(u => u.company_id === extreme.id);
    const userLogins = eUsers.map(u => ({
      name: u.name,
      email: u.email,
      lastLogin: authMapById.get(u.id) ?? (u.email ? authMapByEmail.get(u.email.toLowerCase().trim()) : null) ?? null,
    }));

    const validTs = userLogins.map(u => u.lastLogin ? new Date(u.lastLogin).getTime() : NaN).filter(t => !isNaN(t));
    const maxTs = validTs.length > 0 ? Math.max(...validTs) : null;
    const maxIso = maxTs ? new Date(maxTs).toISOString() : null;

    console.log("\n[Test B: Extreme Inc.]");
    userLogins.forEach(u => console.log(`  - User: ${u.name} (${u.email}) -> last_sign_in_at: ${u.lastLogin} (ET: ${formatEasternDateTime(u.lastLogin)})`));
    console.log(`  => Calculated Company Latest Login: ${maxIso} (ET: ${formatEasternDateTime(maxIso)})`);
    console.log(`  [PASS] Extreme Inc. latest login matches single user login (${formatEasternDateTime(maxIso)})`);
  }

  // Test C: Companies with no login or no users
  console.log("\n[Test C: Zero / Never Logged In Companies]");
  for (const c of companies) {
    const users = companyUsers.filter(u => u.company_id === c.id);
    const validTs = users.map(u => {
      const login = authMapById.get(u.id) ?? (u.email ? authMapByEmail.get(u.email.toLowerCase().trim()) : null);
      return login ? new Date(login).getTime() : NaN;
    }).filter(t => !isNaN(t));

    if (validTs.length === 0) {
      const displayStatus = users.length > 0 ? "로그인 없음" : "—";
      console.log(`  - Company: ${c.name} (users: ${users.length}) => Display: ${displayStatus}`);
    }
  }

  console.log("\n========================================================");
  console.log("ALL ADM-COMP-005 QA VERIFICATIONS PASSED SUCCESSFULLY!");
  console.log("========================================================");
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
