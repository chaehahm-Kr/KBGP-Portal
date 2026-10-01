const fs = require('fs');
const path = require('path');
const envFile = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = (match[2] || '').trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    env[match[1]] = value;
  }
});
const { createClient } = require('@supabase/supabase-js');
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  console.log('Running migration 0120...');

  const { data: existing } = await admin.from('email_templates').select('*').eq('key', 'portal_signup_request').maybeSingle();
  console.log('Existing portal_signup_request:', existing ? existing.description : 'NOT FOUND');

  const description = '회사 담당자 — 브랜드 파트너 포털 가입 안내 (Brand Portal Invitation)';
  const subject_template = '[K SELECT NETWORK] {{company_name}} 파트너 포털 가입 안내';
  const body_template = `안녕하세요, {{contact_name}}님.

{{company_name}}의 K SELECT NETWORK 파트너십 신청이 승인되었습니다.

아래 버튼을 통해 파트너 포털 가입을 진행해 주세요.
포털 가입 시 신청에 사용하신 이메일 주소와 신청 시 입력한 사업자등록번호가 필요합니다.

{{infoBox}}

{{ctaButton}}`;

  if (existing) {
    const { error: updErr } = await admin
      .from('email_templates')
      .update({
        description,
        subject_template,
        body_template,
        updated_at: new Date().toISOString(),
      })
      .eq('key', 'portal_signup_request');
    console.log('Updated portal_signup_request:', updErr || 'SUCCESS');
  } else {
    const { error: insErr } = await admin
      .from('email_templates')
      .insert({
        key: 'portal_signup_request',
        description,
        subject_template,
        body_template,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    console.log('Inserted portal_signup_request:', insErr || 'SUCCESS');
  }

  // Verify
  const { data: verified } = await admin.from('email_templates').select('*').eq('key', 'portal_signup_request').single();
  console.log('Verified portal_signup_request in DB:', {
    key: verified.key,
    description: verified.description,
    subject_template: verified.subject_template,
    body_template: verified.body_template
  });
}

main().catch(console.error);
