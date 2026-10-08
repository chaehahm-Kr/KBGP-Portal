-- 0148_partner_inquiry_admin_read_state.sql — ADM-INQ-UNREAD-001
-- Admin 사이드바 Partner Inquiries 배지를 "처리 대기 문의 수"에서 "Admin 이 안 읽은 문의 수"로 바꾼다.
-- 안 읽음 = Admin 이 한 번도 열지 않은 문의, 또는 마지막으로 연 뒤 파트너가 새 메시지를 보낸 문의.
-- 종료된(closed, resolved) 문의는 세지 않는다.
-- 기존 문의는 모두 지금 읽은 것으로 표시해 배지가 한꺼번에 쌓이지 않게 한다(0127 과 같은 방식).

alter table public.partner_inquiries
  add column if not exists admin_last_read_at timestamptz;

comment on column public.partner_inquiries.admin_last_read_at is
  'Admin 이 이 문의를 마지막으로 연 시각. 이후 파트너 메시지가 있으면 안 읽음.';

update public.partner_inquiries
set admin_last_read_at = now()
where admin_last_read_at is null;

create index if not exists idx_partner_inquiry_messages_inquiry_sender_created
  on public.partner_inquiry_messages (inquiry_id, sender_type, created_at desc);

create or replace function public.admin_unread_partner_inquiry_count()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case when public.auth_is_admin() then (
    select count(*)::integer
    from public.partner_inquiries pi
    where coalesce(pi.status, '') not in ('closed', 'resolved')
      and (
        pi.admin_last_read_at is null
        or exists (
          select 1 from public.partner_inquiry_messages m
          where m.inquiry_id = pi.id
            and m.sender_type = 'partner'
            and m.created_at > pi.admin_last_read_at
        )
      )
  ) else 0 end
$$;

revoke all on function public.admin_unread_partner_inquiry_count() from public;
grant execute on function public.admin_unread_partner_inquiry_count() to authenticated;
