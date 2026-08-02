-- 마케팅 사이트(kselectnetwork.com)의 "신청서 접수" 폼에서 들어오는 익명 문의를
-- 담는 테이블. 아직 계정이 없는 상태의 1차 접수이므로 companies/company_users와는
-- 완전히 분리한다 — Letusto가 "이 회사와 거래하겠다"고 판단해 전환(convert)하기
-- 전까지는 포털 로그인 권한이 전혀 생기지 않는다(사용자 요청: "우리가 거래 할
-- 사람들에게만 포털을 제공").
--
-- products는 정규화된 Product 테이블과 구조가 다르다(성분표·인증서 없이 이름·
-- 카테고리·가격 정도의 간단한 정보) — 전환 시에도 이 값을 그대로 Product로
-- 옮기지 않는다. 전환은 회사 계정만 만들고, 실제 브랜드·제품 등록은 회사가
-- 로그인해서 직접 한다(명세서 02 화면을 그대로 재사용).
create table public.inquiries (
  id uuid primary key default gen_random_uuid(),
  inquiry_number text not null unique,
  company_name text not null,
  business_registration_number text not null,
  company_address text not null,
  brand_name text,
  homepage text,
  contact_name text not null,
  contact_title text,
  contact_email text not null,
  contact_phone text not null,
  products jsonb not null default '[]'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'converted', 'declined')),
  converted_company_id uuid references public.companies (id),
  reviewed_by uuid references public.staff_members (id),
  reviewed_at timestamptz,
  decline_reason text,
  received_at timestamptz not null default now()
);

comment on table public.inquiries is
  '마케팅 사이트 신청서 접수(전환 전 리드). lib/inquiries 참고. company_name 등은
  나중에 실제 companies 테이블 값과 달라질 수 있다(접수 시점 스냅샷이므로 그대로 둔다).';

alter table public.inquiries enable row level security;
alter table public.inquiries force row level security;

create policy "inquiries_select_admin"
  on public.inquiries for select
  to authenticated
  using (public.auth_is_admin());

-- INSERT/UPDATE는 전부 app/api/inquiries(마케팅 사이트에서만 공유 시크릿으로 호출)와
-- 관리자 전환/거절 서버 액션이 admin 클라이언트로 수행한다 — RLS 정책을 열어주지 않는다
-- (login_attempts와 동일한 패턴: 일반 세션은 이 테이블에 아무 권한도 없다).

create table public.inquiry_attachments (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references public.inquiries (id) on delete cascade,
  product_index int not null,
  original_name text not null,
  storage_path text not null,
  size_bytes bigint not null,
  content_type text not null
);

alter table public.inquiry_attachments enable row level security;
alter table public.inquiry_attachments force row level security;

create policy "inquiry_attachments_select_admin"
  on public.inquiry_attachments for select
  to authenticated
  using (public.auth_is_admin());

insert into storage.buckets (id, name, public)
values ('inquiry-uploads', 'inquiry-uploads', false)
on conflict (id) do nothing;

create policy "inquiry_uploads_select_admin"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'inquiry-uploads' and public.auth_is_admin());

-- 접수 확인(신청자)·신규 접수 알림(내부) 이메일 템플릿. 명세서08에서 만든
-- email_templates 시스템을 그대로 재사용한다.
insert into public.email_templates (key, description, subject_template, body_template) values
('inquiry_received_applicant',
 '신청자 — 마케팅 사이트 신청서 접수 확인',
 '[K Select Network] {{inquiryNumber}} 신청이 접수되었습니다',
 '{{companyName}}님, 신청서가 정상적으로 접수되었습니다(접수번호 {{inquiryNumber}}). 검토 후 담당자가 직접 연락드리겠습니다.'),
('inquiry_received_internal',
 '내부 직원 전체 — 마케팅 사이트 신규 문의 접수',
 '[신규 문의] {{inquiryNumber}} — {{companyName}}, 제품 {{productCount}}건',
 '{{inquiryNumber}} 신규 문의 접수 — {{companyName}}, 제품 {{productCount}}건. 확인: {{link}}');
