-- 09_알림및문서관리규칙.md 이벤트 "초대 만료 임박 | 초대한 Company Admin | 인앱".
-- 아직 인앱 알림함이 없어(명세서 09 범위) 담당자 배정 해제 알림과 같은 방식으로
-- 이메일로 대체한다. invite-actions.ts의 초대 링크 만료 기준(7일)에 맞춰, 만료
-- 24시간 전 구간에 들어오면 초대한 사람에게 한 번만 알린다.
alter table public.company_users
  add column expiry_notified_at timestamptz;

insert into public.email_templates (key, description, subject_template, body_template) values
('invite_expiring_soon',
 '초대한 Company Admin — 초대 만료 임박(참고용, 인앱 알림함이 생기기 전까지 이메일로 대체)',
 '[K Select Network] {{inviteeName}}님 초대가 곧 만료됩니다',
 '{{inviteeName}}({{inviteeEmail}})님께 보낸 초대가 24시간 내에 만료됩니다. 계속 진행하시려면 소속 사용자 관리 화면에서 재초대해주세요.');
