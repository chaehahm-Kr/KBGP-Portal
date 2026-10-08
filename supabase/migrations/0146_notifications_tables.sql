-- 0146_notifications_tables.sql — DATA-JSON-MIG-007 (3d)
-- PO 알림을 companies.intro JSON(notifications 배열)에서 notifications 테이블로 옮기고,
-- 사용자별 읽음 기록을 company_users.permissions JSON(read_notification_ids)에서
-- notification_reads 테이블로 옮긴다.
--
-- 0020/0093 의 notifications 는 운영 DB에 없다. 0093 설계를 따르되:
--  * notifications_insert_policy(WITH CHECK (true))는 로그인한 누구나 아무 사용자에게 알림을 넣을 수 있어 두지 않는다.
--  * 쓰기(생성·읽음 처리)는 모두 서버(service role)에서 하므로 쓰기 정책을 두지 않고 읽기만 허용한다.
-- 알림 행은 회사 전체(company_id) 또는 특정 사용자(user_id) 대상이다. 회사 전체 알림의 읽음 여부는
-- 사용자마다 다르므로 notification_reads(user_id, item_id)로 기록한다. item_id 는 알림 id 또는
-- 포털 알림 목록에 함께 나오는 문의 메시지 id 다.
-- 확인 시점에 companies.intro JSON 에 notifications 키는 없었다(옮길 알림 0건). 재실행 안전.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  company_id uuid references public.companies(id) on delete cascade,
  sender_id uuid references auth.users(id) on delete set null,
  type varchar(50) not null default 'GENERAL',
  title varchar(200) not null,
  content text not null,
  link_url varchar(255),
  is_read boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint notifications_target_check check (user_id is not null or company_id is not null)
);

-- 0020 형태(user_id 필수, company_id/type/metadata 없음)로 이미 있는 경우도 같은 모양으로 맞춘다
alter table public.notifications
  add column if not exists company_id uuid references public.companies(id) on delete cascade,
  add column if not exists type varchar(50) not null default 'GENERAL',
  add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.notifications alter column user_id drop not null;
alter table public.notifications alter column title type varchar(200);

create index if not exists idx_notifications_user_id on public.notifications(user_id);
create index if not exists idx_notifications_company_id on public.notifications(company_id);
create index if not exists idx_notifications_type on public.notifications(type);
create index if not exists idx_notifications_created_at on public.notifications(created_at desc);

comment on table public.notifications is '사용자(user_id) 또는 회사 전체(company_id) 대상 알림. 쓰기는 서버(service role)만.';

alter table public.notifications enable row level security;
alter table public.notifications force row level security;

drop policy if exists "notifications_select_own" on public.notifications;
drop policy if exists "notifications_update_own" on public.notifications;
drop policy if exists "notifications_delete_own" on public.notifications;
drop policy if exists "notifications_insert_policy" on public.notifications;
drop policy if exists "notifications_update_policy" on public.notifications;
drop policy if exists "notifications_delete_policy" on public.notifications;
drop policy if exists "notifications_select_policy" on public.notifications;
create policy "notifications_select_policy" on public.notifications
  for select to authenticated
  using (
    user_id = auth.uid()
    or (company_id is not null and company_id = public.auth_company_id())
    or public.auth_is_admin()
  );

create table if not exists public.notification_reads (
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id text not null,
  read_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

comment on table public.notification_reads is '사용자별 알림 읽음 기록(item_id = notifications.id 또는 문의 메시지 id). 쓰기는 서버만.';

alter table public.notification_reads enable row level security;
alter table public.notification_reads force row level security;

drop policy if exists "notification_reads_select_own" on public.notification_reads;
create policy "notification_reads_select_own" on public.notification_reads
  for select to authenticated
  using (user_id = auth.uid());

-- 읽음 기록 복사: company_users.permissions.read_notification_ids → notification_reads
insert into public.notification_reads (user_id, item_id)
select cu.id, r.item_id
from public.company_users cu
cross join lateral jsonb_array_elements_text(
  case when jsonb_typeof(cu.permissions->'read_notification_ids') = 'array' then cu.permissions->'read_notification_ids' else '[]'::jsonb end
) as r(item_id)
where exists (select 1 from auth.users u where u.id = cu.id)
on conflict (user_id, item_id) do nothing;

-- 복사가 끝난 사용자의 JSON 에서 read_notification_ids 를 지운다
update public.company_users cu
set permissions = cu.permissions - 'read_notification_ids'
where jsonb_typeof(cu.permissions) = 'object'
  and cu.permissions ? 'read_notification_ids'
  and exists (select 1 from auth.users u where u.id = cu.id);
