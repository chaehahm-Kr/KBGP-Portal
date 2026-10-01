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
  console.log("=== Inspecting Company and User Logins ===");

  // 1. Fetch all auth users
  const { data: authData, error: authErr } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (authErr) {
    console.error("Auth listUsers error:", authErr);
    return;
  }
  const authMapById = new Map();
  const authMapByEmail = new Map();
  for (const u of authData.users) {
    if (u.id) authMapById.set(u.id, u.last_sign_in_at || null);
    if (u.email) authMapByEmail.set(u.email.toLowerCase().trim(), u.last_sign_in_at || null);
  }
  console.log(`Fetched ${authData.users.length} auth users.`);

  // 2. Fetch all company users
  const { data: companyUsers } = await supabase
    .from('company_users')
    .select('id, company_id, name, email, phone, title, position, is_primary, status, company_role, permissions, created_at');

  // 3. Fetch all companies
  const { data: companies } = await supabase
    .from('companies')
    .select('id, name, country, status, created_at')
    .order('created_at', { ascending: false });

  console.log(`\nFound ${companies?.length} companies, ${companyUsers?.length} company_users.\n`);

  for (const comp of companies || []) {
    const users = (companyUsers || []).filter(u => u.company_id === comp.id);
    const userLogins = users.map(u => {
      const login = authMapById.get(u.id) ?? (u.email ? authMapByEmail.get(u.email.toLowerCase().trim()) : null) ?? null;
      return {
        name: u.name,
        email: u.email,
        rawLogin: login,
        easternLogin: login ? formatEasternDateTime(login) : "로그인 없음",
      };
    });

    // Calculate MAX login
    const validTimestamps = userLogins
      .filter(u => u.rawLogin)
      .map(u => new Date(u.rawLogin).getTime())
      .filter(t => !isNaN(t));

    const maxTimestamp = validTimestamps.length > 0 ? Math.max(...validTimestamps) : null;
    const maxLoginIso = maxTimestamp ? new Date(maxTimestamp).toISOString() : null;
    const maxEastern = maxLoginIso ? formatEasternDateTime(maxLoginIso) : (users.length > 0 ? "로그인 없음" : "—");

    console.log(`Company: ${comp.name} (${comp.id})`);
    console.log(`  Users count: ${users.length}`);
    users.forEach((u, i) => {
      console.log(`    User ${i+1}: ${u.name} <${u.email}> | raw: ${userLogins[i].rawLogin} | ET: ${userLogins[i].easternLogin}`);
    });
    console.log(`  => MAX Company Latest Login: raw=${maxLoginIso} | ET=${maxEastern}`);
    console.log(`--------------------------------------------------------------------------------`);
  }
}

main().catch(console.error);
