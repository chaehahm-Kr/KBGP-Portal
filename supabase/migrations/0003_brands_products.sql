-- 0003_brands_products.sql — 명세서 02. 브랜드·제품 등록 (이미지·인증서 업로드 포함)
--
-- 07_데이터모델.md의 Brand/Product/ProductImage/ProductCertificate를 만든다.
-- company_id를 각 테이블에 직접(비정규화) 들고 있는 이유: brands를 거쳐 join하지 않고도
-- RLS 정책에서 곧바로 auth_company_id()와 비교할 수 있게 해, 정책을 단순하고 빠르게 유지하기 위함.

create table public.brands (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  intro text,
  logo_path text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.brands is
  'Company에 속한 브랜드(07_데이터모델.md Brand). is_active=false는 논리 삭제 '
  '("더 이상 사용하지 않음") — 이미 신청서에 연결된 브랜드는 물리 삭제하지 않는다.';

-- 08_주요화면과AC.md 화면 6 AC: "브랜드명은 같은 회사 내에서 중복될 수 없다".
-- 비활성 처리된(is_active=false) 브랜드의 이름은 재사용 가능하도록 부분 유니크 인덱스로 제한한다.
create unique index brands_company_name_active_unique
  on public.brands (company_id, lower(name))
  where is_active;

alter table public.brands enable row level security;
alter table public.brands force row level security;

create policy "brands_select_own_or_admin"
  on public.brands for select
  to authenticated
  using (company_id = public.auth_company_id() or public.auth_is_admin());

create policy "brands_insert_own"
  on public.brands for insert
  to authenticated
  with check (company_id = public.auth_company_id());

create policy "brands_update_own"
  on public.brands for update
  to authenticated
  using (company_id = public.auth_company_id());

create table public.products (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  category text not null check (
    category in ('skincare', 'hair_scalp', 'beauty_tools', 'daily_care', 'wellness_patch')
  ),
  volume text,
  estimated_retail_price numeric,
  ingredients_text text,
  ingredients_file_path text,
  status text not null default 'registered' check (status in ('registered', 'selling', 'discontinued')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.products is
  'Brand에 속한 개별 제품(07_데이터모델.md Product). status는 제품 자체의 판매 상태이며, '
  '신청서 심사 상태(ApplicationProduct, 명세서 03)와는 완전히 별개다.';

alter table public.products enable row level security;
alter table public.products force row level security;

create policy "products_select_own_or_admin"
  on public.products for select
  to authenticated
  using (company_id = public.auth_company_id() or public.auth_is_admin());

create policy "products_insert_own"
  on public.products for insert
  to authenticated
  with check (company_id = public.auth_company_id());

create policy "products_update_own"
  on public.products for update
  to authenticated
  using (company_id = public.auth_company_id());

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  storage_path text not null,
  position smallint not null default 0,
  created_at timestamptz not null default now()
);

alter table public.product_images enable row level security;
alter table public.product_images force row level security;

create policy "product_images_select_own_or_admin"
  on public.product_images for select
  to authenticated
  using (company_id = public.auth_company_id() or public.auth_is_admin());

create policy "product_images_insert_own"
  on public.product_images for insert
  to authenticated
  with check (company_id = public.auth_company_id());

create policy "product_images_delete_own"
  on public.product_images for delete
  to authenticated
  using (company_id = public.auth_company_id());

create policy "product_images_update_own"
  on public.product_images for update
  to authenticated
  using (company_id = public.auth_company_id())
  with check (company_id = public.auth_company_id());

create table public.product_certificates (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  certificate_type text not null check (
    certificate_type in ('ingredient_certification', 'trademark', 'fda_registration', 'other')
  ),
  storage_path text not null,
  original_filename text,
  version integer not null default 1,
  is_current boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.product_certificates is
  '09_알림및문서관리규칙.md 버전 관리 규칙: 재업로드 시 기존 파일을 덮어쓰지 않고 새 버전을 '
  '추가한다(version 증가, 이전 행은 is_current=false로 남아 계속 열람 가능).';

alter table public.product_certificates enable row level security;
alter table public.product_certificates force row level security;

create policy "product_certificates_select_own_or_admin"
  on public.product_certificates for select
  to authenticated
  using (company_id = public.auth_company_id() or public.auth_is_admin());

create policy "product_certificates_insert_own"
  on public.product_certificates for insert
  to authenticated
  with check (company_id = public.auth_company_id());

create policy "product_certificates_update_own"
  on public.product_certificates for update
  to authenticated
  using (company_id = public.auth_company_id());

-- --------------------------------------------------------------------------
-- Storage: 제품 이미지·인증서·성분표·브랜드 로고를 담는 비공개 버킷 하나.
-- 10_보안과권한요구사항.md 4번: "업로드된 파일은 직접 URL로 접근할 수 없고, 반드시
-- 로그인+권한 확인을 거쳐야만 열람 가능". public 버킷이 아니라 private 버킷 + RLS로
-- 이를 강제한다. 경로 규칙: {company_id}/brands/{brand_id}/logo/...
--                         {company_id}/products/{product_id}/images|certificates|ingredients/...
-- storage.foldername(name)의 첫 번째 세그먼트가 항상 company_id이므로, 이 값을
-- auth_company_id()와 비교하는 것만으로 회사 간 격리가 성립한다.
-- --------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('company-uploads', 'company-uploads', false)
on conflict (id) do nothing;

create policy "company_uploads_select_own_or_admin"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'company-uploads'
    and (
      (storage.foldername(name))[1] = public.auth_company_id()::text
      or public.auth_is_admin()
    )
  );

create policy "company_uploads_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'company-uploads'
    and (storage.foldername(name))[1] = public.auth_company_id()::text
  );
