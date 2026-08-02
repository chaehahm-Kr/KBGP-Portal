-- 0016_system_settings.sql — 회사 유형 및 파트너 상태 동적 설정을 위한 Key-Value 테이블 정의
--

create table public.system_settings (
  key text primary key,
  value jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.system_settings is
  '어드민 설정 관리자용 Key-Value JSONB 저장소. 회사 유형, 파트너 상태, 전역 시스템 설정 보관용.';

alter table public.system_settings enable row level security;
alter table public.system_settings force row level security;

create policy "system_settings_select_all"
  on public.system_settings for select
  to authenticated
  using (true);

create policy "system_settings_write_admin"
  on public.system_settings for all
  to authenticated
  using (public.auth_is_admin());
