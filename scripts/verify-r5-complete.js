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

async function verify() {
  console.log('=== 1. FETCH CURRENT DB STATE FOR TAMMY ===');
  const { data: userBefore, error: errBefore } = await admin
    .from('company_users')
    .select('*')
    .eq('email', 'tammyhahm77@gmail.com')
    .single();

  console.log('User Before:', {
    id: userBefore?.id,
    name: userBefore?.name,
    title: userBefore?.title,
    position: userBefore?.position,
    phone: userBefore?.phone,
    permissions: userBefore?.permissions
  });

  console.log('\n=== 2. APPLY TARGET TEST VALUES TO COMPANY_USERS (SIMULATING SAVE) ===');
  const updatePayload = {
    name: '박은애',
    title: '부부장',
    position: '해외영업사업팀',
    phone: '+82 10-3333-4444',
    permissions: {
      ...(userBefore?.permissions || {}),
      english_name: 'Tammy Hahm'
    }
  };

  const { data: userUpdated, error: updateErr } = await admin
    .from('company_users')
    .update(updatePayload)
    .eq('id', userBefore.id)
    .select('*')
    .single();

  console.log('User After Update:', {
    id: userUpdated?.id,
    name: userUpdated?.name,
    title: userUpdated?.title,
    position: userUpdated?.position,
    phone: userUpdated?.phone,
    permissions: userUpdated?.permissions
  }, 'Error:', updateErr);

  console.log('\n=== 3. SIMULATE getMyAccountData() LOADER QUERY ===');
  const { data: userById } = await admin
    .from('company_users')
    .select('id, company_id, name, email, company_role, status, title, position, phone, is_primary, permissions, created_at, joined_at')
    .eq('id', userBefore.id)
    .maybeSingle();

  const { data: comp } = await admin
    .from('companies')
    .select('name')
    .eq('id', userById.company_id)
    .maybeSingle();

  const englishName = (
    userById?.english_name ||
    userById?.permissions?.english_name ||
    ''
  ).trim();

  const loadedAccountData = {
    userId: userById.id,
    email: userById.email,
    name: userById.name || '',
    englishName: englishName,
    phone: userById.phone || '',
    title: userById.title || '',
    position: userById.position || '',
    companyRole: userById.company_role || 'company_staff',
    status: userById.status || 'active',
    isPrimary: userById.is_primary || false,
    companyId: userById.company_id || '',
    companyName: comp?.name || '소속 회사',
  };

  console.log('Loaded Account Data from getMyAccountData():', loadedAccountData);

  console.log('\n=== 4. VERIFY READ-BACK EXACT MATCH ===');
  const matchName = loadedAccountData.name === '박은애';
  const matchEnglishName = loadedAccountData.englishName === 'Tammy Hahm';
  const matchTitle = loadedAccountData.title === '부부장';
  const matchPosition = loadedAccountData.position === '해외영업사업팀';
  const matchPhone = loadedAccountData.phone === '+82 10-3333-4444';

  console.log('Name match:', matchName);
  console.log('English Name match:', matchEnglishName);
  console.log('Title match (부부장):', matchTitle);
  console.log('Position match (해외영업사업팀):', matchPosition);
  console.log('Phone match (+82 10-3333-4444):', matchPhone);

  if (matchName && matchEnglishName && matchTitle && matchPosition && matchPhone) {
    console.log('\n>>> SUCCESS: ALL TEST VALUES EXACTLY PERSISTED AND SURVIVE SERVER LOADER! <<<');
  } else {
    console.error('\n>>> ERROR: ONE OR MORE VALUES FAILED MATCH! <<<');
  }
}

verify().catch(console.error);
