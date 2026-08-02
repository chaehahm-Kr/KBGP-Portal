-- 0006_additional_info_requests.sql — 명세서 06. 추가 자료 요청
--
-- 07_데이터모델.md AdditionalInfoRequest. 신청서 전체에 대한 요청일 수도, 특정 제품에
-- 대한 요청일 수도 있어서 product_id는 nullable이다.
--
-- 쓰기(생성·회신)는 authenticated 롤에 별도 RLS 정책을 열어주지 않는다 — 둘 다
-- lib/application/info-request-actions.ts의 서버 액션이 admin 클라이언트로 수행하면서,
-- 그 앞에서 요청자가 정말 그 신청서의 담당 회사/관리자인지를 코드로 한 번 더 확인한다.
-- (요청 생성=관리자 전용 작업, 회신=본인 회사 소유 확인이 필요한 작업이라 일반적인
-- "본인 것만" 패턴의 insert/update 정책만으로는 충분치 않았다.)
create table public.additional_info_requests (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  product_id uuid references public.products (id),
  request_content text not null,
  requested_by uuid not null references public.profiles (id),
  requested_at timestamptz not null default now(),
  reply_content text,
  reply_attachment_path text,
  status text not null default 'pending' check (status in ('pending', 'replied')),
  replied_at timestamptz
);

comment on table public.additional_info_requests is
  '07_데이터모델.md AdditionalInfoRequest. 하나의 신청서에 여러 번 쌓일 수 있고
  (08_주요화면과AC.md 화면 10 AC), 각 요청·회신 쌍은 삭제되지 않고 이력으로 보존된다.';

alter table public.additional_info_requests enable row level security;
alter table public.additional_info_requests force row level security;

create policy "air_select_own_or_admin"
  on public.additional_info_requests for select
  to authenticated
  using (company_id = public.auth_company_id() or public.auth_is_admin());
