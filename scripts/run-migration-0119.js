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

async function applyMigration() {
  const sql = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'migrations', '0119_brand_application_email_templates.sql'), 'utf8');
  console.log('Applying migration 0119...');

  // Update inquiry_received_applicant
  const { error: err1 } = await admin.from('email_templates').update({
    subject_template: '[K SELECT NETWORK] {{applicationNumber}} 파트너 신청이 접수되었습니다',
    body_template: `신청이 정상적으로 접수되었습니다.

안녕하세요, {{contactName}}님.
K SELECT NETWORK의 K-Beauty Growth Program에 신청해 주셔서 감사합니다.
제출해 주신 신청서는 아래 접수번호로 정상 등록되었습니다.

{{infoBox}}

제출하신 브랜드와 상품 정보를 검토한 후, 담당자가 영업일 기준 2일 이내에 이메일 또는 전화로 연락드리겠습니다.`,
    updated_at: new Date().toISOString()
  }).eq('key', 'inquiry_received_applicant');

  console.log('Update inquiry_received_applicant error:', err1);

  // Update application_submitted_company
  const { error: err2 } = await admin.from('email_templates').update({
    subject_template: '[K SELECT NETWORK] {{applicationNumber}} 파트너 신청이 접수되었습니다',
    body_template: `신청이 정상적으로 접수되었습니다.

안녕하세요, {{contactName}}님.
K SELECT NETWORK의 K-Beauty Growth Program에 신청해 주셔서 감사합니다.
제출해 주신 신청서는 아래 접수번호로 정상 등록되었습니다.

{{infoBox}}

제출하신 브랜드와 상품 정보를 검토한 후, 담당자가 영업일 기준 2일 이내에 이메일 또는 전화로 연락드리겠습니다.`,
    updated_at: new Date().toISOString()
  }).eq('key', 'application_submitted_company');

  console.log('Update application_submitted_company error:', err2);

  // Upsert brand_application_rejected
  const { error: err3 } = await admin.from('email_templates').upsert({
    key: 'brand_application_rejected',
    description: '신청자 — 브랜드 파트너십 신청 검토 결과 안내 (Brand Application Rejected)',
    subject_template: 'K SELECT NETWORK 파트너십 신청 검토 결과 안내',
    body_template: `신청 검토 결과를 안내해 드립니다.

안녕하세요, {{contact_name}}님.

K SELECT NETWORK K-Beauty Growth Program에 관심을 가지고 신청해 주셔서 진심으로 감사드립니다.

보내주신 회사 및 상품 정보를 검토한 결과, 현재 단계에서는 파트너 프로그램 진행을 함께하지 못하게 되었습니다.

이번 결정은 브랜드나 제품의 전반적인 가치를 평가하는 의미라기보다, 현재 프로그램의 운영 방향, 시장 적합성 및 상품 구성 등을 종합적으로 고려한 결과입니다.{{applicant_message}}

향후 적합한 협업 기회가 생길 경우 다시 함께 검토할 수 있기를 바랍니다.

K SELECT NETWORK에 보내주신 관심과 시간을 다시 한번 감사드립니다.

K SELECT NETWORK Team`,
    updated_at: new Date().toISOString()
  }, { onConflict: 'key' });

  console.log('Upsert brand_application_rejected error:', err3);
}

applyMigration();
