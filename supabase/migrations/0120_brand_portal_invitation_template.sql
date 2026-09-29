-- Migration: 0120_brand_portal_invitation_template.sql
-- Description: Update portal_signup_request template with Application Summary, clear Korean copy, and BRN privacy rules.

UPDATE public.email_templates
SET
  description = '회사 담당자 — 브랜드 파트너 포털 가입 안내 (Brand Portal Invitation)',
  subject_template = '[K SELECT NETWORK] {{company_name}} 파트너 포털 가입 안내',
  body_template = '안녕하세요, {{contact_name}}님.

{{company_name}}의 K SELECT NETWORK 파트너십 신청이 승인되었습니다.

아래 버튼을 통해 파트너 포털 가입을 진행해 주세요.
포털 가입 시 신청에 사용하신 이메일 주소와 신청 시 입력한 사업자등록번호가 필요합니다.

{{infoBox}}

{{ctaButton}}',
  updated_at = NOW()
WHERE key = 'portal_signup_request';

-- Insert if not exists
INSERT INTO public.email_templates (key, description, subject_template, body_template, updated_at)
SELECT
  'portal_signup_request',
  '회사 담당자 — 브랜드 파트너 포털 가입 안내 (Brand Portal Invitation)',
  '[K SELECT NETWORK] {{company_name}} 파트너 포털 가입 안내',
  '안녕하세요, {{contact_name}}님.

{{company_name}}의 K SELECT NETWORK 파트너십 신청이 승인되었습니다.

아래 버튼을 통해 파트너 포털 가입을 진행해 주세요.
포털 가입 시 신청에 사용하신 이메일 주소와 신청 시 입력한 사업자등록번호가 필요합니다.

{{infoBox}}

{{ctaButton}}',
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM public.email_templates WHERE key = 'portal_signup_request'
);
