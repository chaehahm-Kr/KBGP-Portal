const fs = require('fs');
const path = require('path');

const envFile = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = (match[2] || '').trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    env[match[1]] = value;
  }
});

const { createClient } = require('@supabase/supabase-js');
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY);

function formatEasternDateTime(date, includeSeconds = false) {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '-';

  const datePart = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);

  const timePart = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    minute: '2-digit',
    second: includeSeconds ? '2-digit' : undefined,
    hour12: false,
  }).format(d);

  return `${datePart} ${timePart}`;
}

async function verifyCompanyDetailUsers() {
  console.log('=== VERIFY CARMEL2 USERS (ADM-COMP-003) ===');
  const { data: carmel2 } = await admin.from('companies').select('id, name').ilike('name', '%Carmel2%').single();
  const { data: cUsers } = await admin.from('company_users').select('*').eq('company_id', carmel2.id);
  const { data: authData } = await admin.auth.admin.listUsers({ perPage: 1000 });

  const authMapById = new Map();
  const authMapByEmail = new Map();
  authData.users.forEach(u => {
    authMapById.set(u.id, u.last_sign_in_at || null);
    if (u.email) authMapByEmail.set(u.email.toLowerCase().trim(), u.last_sign_in_at || null);
  });

  for (const u of cUsers) {
    const lastLogin = authMapById.get(u.id) ?? (u.email ? authMapByEmail.get(u.email.toLowerCase().trim()) : null) ?? null;
    const formatted = lastLogin ? formatEasternDateTime(lastLogin) : '로그인 기록 없음';
    console.log(`- User: ${u.name} (${u.email}) | Role: ${u.company_role} | Status: ${u.status} | Last Login: ${formatted} (Raw: ${lastLogin})`);
  }

  console.log('\n=== VERIFY EXTREME INC. USERS (ADM-COMP-003) ===');
  const { data: extreme } = await admin.from('companies').select('id, name').ilike('name', '%Extreme%').single();
  const { data: extUsers } = await admin.from('company_users').select('*').eq('company_id', extreme.id);

  for (const u of extUsers) {
    const lastLogin = authMapById.get(u.id) ?? (u.email ? authMapByEmail.get(u.email.toLowerCase().trim()) : null) ?? null;
    const formatted = lastLogin ? formatEasternDateTime(lastLogin) : '로그인 기록 없음';
    console.log(`- User: ${u.name} (${u.email}) | Role: ${u.company_role} | Status: ${u.status} | Last Login: ${formatted} (Raw: ${lastLogin})`);
  }
}

verifyCompanyDetailUsers().catch(console.error);
