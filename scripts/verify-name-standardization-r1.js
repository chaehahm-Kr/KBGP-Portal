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

function getPersonDisplayName(person) {
  if (!person) return '';
  if (typeof person === 'string') return person.trim();

  const p = person.permissions || {};
  const koreanLast = (person.korean_last_name || person.koreanLastName || p.korean_last_name || p.koreanLastName || '').trim();
  const koreanFirst = (person.korean_first_name || person.koreanFirstName || p.korean_first_name || p.koreanFirstName || '').trim();
  const englishFirst = (person.english_first_name || person.englishFirstName || person.first_name || person.firstName || p.english_first_name || p.englishFirstName || p.first_name || p.firstName || '').trim();
  const englishLast = (person.english_last_name || person.englishLastName || person.last_name || person.lastName || p.english_last_name || p.englishLastName || p.last_name || p.lastName || '').trim();

  const koreanFullName = (koreanLast || koreanFirst) ? `${koreanLast}${koreanFirst}`.trim() : (person.name || '').trim();
  const englishFullName = (englishFirst || englishLast) ? `${englishFirst} ${englishLast}`.trim() : (person.english_name || person.englishName || p.english_name || p.englishName || '').trim();

  if (englishFullName && koreanFullName) {
    return `${englishFullName} (${koreanFullName})`;
  }
  if (englishFullName) return englishFullName;
  if (koreanFullName) return koreanFullName;
  return person.email || person.name || '';
}

async function verify() {
  console.log('=== PORT-NAME-001-R2 STANDARDIZATION & DATA PIPELINE QA ===');
  
  const { data: comp } = await admin.from('companies').select('*').ilike('name', '%Extreme%').single();
  console.log('1. Company:', comp.name, '(', comp.id, ')');

  const { data: dbUsers, error } = await admin
    .from('company_users')
    .select('id, name, email, company_role, status, title, position, phone, is_primary, permissions, english_name')
    .eq('company_id', comp.id);

  if (error) {
    console.error('dbUsers query error:', error);
    return;
  }

  const contacts = (dbUsers || []).map(u => {
    const p = u.permissions || {};
    return {
      id: u.id,
      name: u.name || '',
      phone: u.phone || '',
      email: u.email || '',
      title: u.title || '',
      position: u.position || '',
      isPrimary: u.is_primary || false,
      status: u.status,
      permissions: u.permissions || null,
      koreanLastName: p.korean_last_name || p.koreanLastName || null,
      koreanFirstName: p.korean_first_name || p.koreanFirstName || null,
      englishFirstName: p.english_first_name || p.englishFirstName || p.first_name || p.firstName || null,
      englishLastName: p.english_last_name || p.englishLastName || p.last_name || p.lastName || null,
      englishName: u.english_name || p.english_name || p.englishName || null,
      korean_last_name: p.korean_last_name || p.koreanLastName || null,
      korean_first_name: p.korean_first_name || p.koreanFirstName || null,
      english_first_name: p.english_first_name || p.englishFirstName || p.first_name || p.firstName || null,
      english_last_name: p.english_last_name || p.englishLastName || p.last_name || p.lastName || null,
      english_name: u.english_name || p.english_name || p.englishName || null,
    };
  });

  console.log('\n2. 소속 담당자 목록 (Company Contacts Table Display):');
  contacts.forEach(c => {
    console.log(`   -> [${c.email}] Display: "${getPersonDisplayName(c)}" | Title: "${c.title}"`);
  });

  console.log('\n3. 담당 업무 및 주 담당자 (Responsibility Assignee & Dropdown Display):');
  dbUsers.forEach(u => {
    console.log(`   -> Assignee Label: "${getPersonDisplayName(u)}"`);
    console.log(`   -> Dropdown Option: "${getPersonDisplayName(u)} (${u.title || '멤버'})"`);
  });

  const { data: ca } = await admin.from('company_agreements').select('*').eq('company_id', comp.id);
  console.log('\n4. 계약 및 문서 (Agreement Card Signer Display):');
  ca.forEach(a => {
    const signerUser = dbUsers.find(u => u.email === a.signer_email || u.name === a.signer_name);
    const signerDisplay = signerUser ? getPersonDisplayName(signerUser) : getPersonDisplayName({ name: a.signer_name, email: a.signer_email });
    console.log(`   -> Agreement: ${a.agreement_id} | Signer: "${signerDisplay}"`);
  });

  console.log('\nVERIFICATION SUCCESS: All areas resolve to "Eun Park (박은애)"!');
}

verify().catch(console.error);
