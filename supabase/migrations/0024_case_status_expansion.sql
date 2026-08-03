-- ========================================================================
-- 0024: Case-based Support System - Status Expansion & Case Number
-- ========================================================================
-- 1) partner_inquiries 테이블 상태 모델 확장
-- 2) 케이스 번호(case_number) 자동 생성 시퀀스 추가
-- 3) 케이스 종료/재오픈/만족도 컬럼 추가
-- 4) partner_inquiry_messages 메시지 타입 컬럼 추가
-- ========================================================================

-- 케이스 번호 자동증가 시퀀스
create sequence if not exists partner_case_seq start 1;

-- partner_inquiries 컬럼 추가
alter table public.partner_inquiries
  add column if not exists case_number varchar(20),
  add column if not exists closed_at timestamptz,
  add column if not exists closed_by uuid,
  add column if not exists reopen_count int default 0,
  add column if not exists satisfaction_score int check (satisfaction_score between 1 and 5),
  add column if not exists satisfaction_comment text,
  add column if not exists satisfaction_at timestamptz;

-- 기존 status 값 마이그레이션: pending → open, replied → in_review
update public.partner_inquiries
  set status = case
    when status = 'pending' then 'open'
    when status = 'replied' then 'in_review'
    else status
  end
  where status in ('pending', 'replied');

-- 기존 is_action_required = true 인 것들은 action_required 상태로 변경
update public.partner_inquiries
  set status = 'action_required'
  where is_action_required = true and status not in ('resolved', 'closed');

-- 케이스 번호 기존 데이터에 부여
update public.partner_inquiries
  set case_number = 'CASE-' || lpad(nextval('partner_case_seq')::text, 4, '0')
  where case_number is null;

-- 트리거: 신규 문의 insert 시 case_number 자동 생성
create or replace function public.set_case_number()
returns trigger language plpgsql as $$
begin
  if new.case_number is null then
    new.case_number := 'CASE-' || lpad(nextval('partner_case_seq')::text, 4, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_case_number on public.partner_inquiries;
create trigger trg_set_case_number
  before insert on public.partner_inquiries
  for each row execute function public.set_case_number();

-- partner_inquiry_messages 메시지 타입 컬럼 추가
alter table public.partner_inquiry_messages
  add column if not exists message_type varchar(30) default 'message',
  add column if not exists is_action_flag boolean default false;

-- message_type 체크 제약
-- message | status_change | action_required | action_resolved | case_closed | case_reopened | satisfaction
alter table public.partner_inquiry_messages
  drop constraint if exists chk_message_type;
alter table public.partner_inquiry_messages
  add constraint chk_message_type
    check (message_type in (
      'message',
      'status_change',
      'action_required',
      'action_resolved',
      'case_closed',
      'case_reopened',
      'satisfaction'
    ));
