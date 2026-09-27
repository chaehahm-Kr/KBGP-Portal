-- 0117: ADM-EMAIL-003-R1 Agreement Completion Email Recipient Role Fix
-- Updates greeting in brand_agreement_completed and hub_retailer_agreement_completed to {{recipient_name}}

INSERT INTO public.email_templates (key, description, subject_template, body_template, updated_at)
VALUES 
(
  'brand_agreement_completed',
  '브랜드사 담당자 — 계약 체결 완료 (Brand Agreement Completed)',
  '[K SELECT NETWORK] {{company_name}} 계약 체결이 완료되었습니다',
  '전자 기본계약 체결이 완료되었습니다.

안녕하세요, {{recipient_name}}님.

{{company_name}}의 K SELECT NETWORK 브랜드 공급 및 유통 기본계약(Version {{agreement_version}}) 체결이 완료되었습니다.

체결된 최종 계약서 사본이 본 메일에 첨부되어 있으며, 브랜드사 포털에서도 언제든지 확인 및 다운로드하실 수 있습니다.

{{infoBox}}

{{ctaButton}}

본 계약서는 양사의 전자서명 및 타임스탬프를 통해 법적 효력을 갖는 공식 문서로 안전하게 보관됩니다.',
  now()
),
(
  'hub_retailer_agreement_completed',
  'Retailer Partner — Retailer Agreement Completed',
  '[K SELECT HUB] Your Retailer Agreement Has Been Completed',
  'Your Retailer Agreement has been successfully executed.

Hello {{recipient_name}},

The K SELECT Retailer Operating Agreement (Version {{agreement_version}}) for {{company_name}} has been successfully executed.

Your official executed agreement is attached to this email and is also permanently preserved in your Retailer Portal for secure access.

{{infoBox}}

{{ctaButton}}

If you have any questions regarding your agreement or next onboarding steps, our team is here to assist you at {{supportEmail}}.',
  now()
)
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  subject_template = EXCLUDED.subject_template,
  body_template = EXCLUDED.body_template,
  updated_at = now();
