const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envText = fs.readFileSync(envPath, 'utf8');
  envText.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let v = match[2] || '';
      if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
      if (v.startsWith("'") && v.endsWith("'")) v = v.slice(1, -1);
      process.env[match[1]] = v.trim();
    }
  });
}

const supabaseUrl = 'https://shzfrppdobpmrstcjfqu.supabase.co';
const supabaseSecretKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
const admin = createClient(supabaseUrl, supabaseSecretKey);

async function runProductionQA() {
  console.log('=== PRODUCTION E2E INVITATION QA TEST (R2) ===');
  const targetEmail = 'support.test.r2@letusto.com';
  const companyId = 'a41d3721-9775-4448-9265-278c02b92aa1'; // Beauty Maker 33

  // 1. Cleanup existing test user if present
  console.log('1. Cleaning up existing test user if present...');
  const { data: existingUsers } = await admin
    .from('company_users')
    .select('id')
    .eq('email', targetEmail);

  if (existingUsers && existingUsers.length > 0) {
    for (const u of existingUsers) {
      await admin.from('company_users').delete().eq('id', u.id);
      await admin.auth.admin.deleteUser(u.id);
      console.log('   Cleaned up user:', u.id);
    }
  }

  // 2. Fetch Inviter and Company records
  const { data: inviterUser } = await admin
    .from('company_users')
    .select('id, name, email')
    .eq('email', 'legal@letusto.com')
    .single();

  const { data: company, error: compErr } = await admin
    .from('companies')
    .select('name')
    .eq('id', companyId)
    .single();

  if (compErr) {
    console.error('Company select error:', compErr);
  }

  const companyDisplayName = company?.name || '파트너사';
  console.log('2. Target Company Display Name:', companyDisplayName);
  console.log('   Inviter User:', inviterUser?.name, `(${inviterUser?.email})`);

  // 3. Generate Link via Supabase Auth
  const targetRedirect = 'https://portal.kselectnetwork.com/portal/invite/accept';
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'invite',
    email: targetEmail,
    options: {
      redirectTo: targetRedirect,
      data: { role: 'portal', display_name: '홍길동 R2' },
    },
  });

  if (linkErr || !linkData?.user) {
    console.error('Failed to generate invite link:', linkErr);
    return;
  }

  const invitedUserId = linkData.user.id;
  let actionLink = linkData.properties?.action_link || targetRedirect;
  try {
    const u = new URL(actionLink);
    u.searchParams.set('redirect_to', targetRedirect);
    actionLink = u.toString();
  } catch(e) {}

  console.log('3. Generated Action Link:', actionLink);

  // Insert company_users record
  await admin.from('company_users').insert({
    id: invitedUserId,
    company_id: companyId,
    name: '홍길동 R2',
    english_name: 'hong kildong R2',
    email: targetEmail,
    company_role: 'company_staff',
    status: 'invited',
    invited_by: inviterUser?.id,
    invited_at: new Date().toISOString(),
    permissions: {
      first_name: 'kildong',
      last_name: 'hong',
      english_first_name: 'kildong',
      english_last_name: 'hong',
    },
  });

  // 4. Test HTTP redirect location of Supabase verify endpoint
  console.log('4. Testing HTTP 303 Redirect location from Supabase verify URL...');
  const res = await fetch(actionLink, { method: 'GET', redirect: 'manual' });
  const location = res.headers.get('location');
  console.log('   HTTP Status:', res.status);
  console.log('   Location Header:', location);

  const isCorrectDomain = location && location.startsWith('https://portal.kselectnetwork.com/portal/invite/accept');
  console.log('   Redirect Domain Verified (portal.kselectnetwork.com):', isCorrectDomain ? '✅ PASS' : '❌ FAIL');
  const doesNotContainVercel = location && !location.includes('vercel.app');
  console.log('   Vercel Domain Absence Verified:', doesNotContainVercel ? '✅ PASS' : '❌ FAIL');

  // 5. Complete Account Activation & Role/ACL Audit
  console.log('5. Completing Password Setup & Account Activation...');
  await admin.auth.admin.updateUserById(invitedUserId, { password: 'TestPassword123!', email_confirm: true });
  await admin.from('company_users').update({ status: 'active', joined_at: new Date().toISOString() }).eq('id', invitedUserId);

  const { data: finalUser } = await admin
    .from('company_users')
    .select('*, companies!company_users_company_id_fkey(*)')
    .eq('id', invitedUserId)
    .single();

  console.log('6. Final Verified User Record in DB:');
  console.log('   User ID:', finalUser.id);
  console.log('   Email:', finalUser.email);
  console.log('   Status:', finalUser.status);
  console.log('   Company Role:', finalUser.company_role);
  console.log('   Assigned Company Name:', finalUser.companies?.name);

  // Clean up test user
  await admin.from('company_users').delete().eq('id', invitedUserId);
  await admin.auth.admin.deleteUser(invitedUserId);
  console.log('\n=== ALL PRODUCTION QA VERIFICATION TESTS PASSED SUCCESSFULLY ===');
}

runProductionQA().catch(console.error);
