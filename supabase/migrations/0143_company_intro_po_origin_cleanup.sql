-- 0143_company_intro_po_origin_cleanup.sql — DATA-JSON-CLEAN-003
-- companies.intro 메타데이터 JSON 에서 po_requests, shipping_origins 키를 지운다.
-- PO 요청(0136)과 출고지(0137)는 테이블이 유일한 저장소이고, 코드도 JSON 을 더 이상 읽거나 쓰지 않는다(881e1e7).
-- 되돌릴 수 있도록 지우기 전 intro 원본 전체를 companies_intro_json_backup 에 남긴다
-- (이후 3a 정리 때도 같은 백업을 쓴다. 같은 회사는 처음 한 번만 백업).
-- intro 를 바꾸면 0135 트리거가 회사 기본 정보 칸을 다시 맞추지만 값은 그대로다.

create table if not exists public.companies_intro_json_backup (
  company_id uuid primary key references public.companies(id) on delete cascade,
  intro text not null,
  backed_up_at timestamptz not null default now()
);

comment on table public.companies_intro_json_backup is
  'DATA-JSON-CLEAN-003: JSON 정리 전 companies.intro 원본 백업. 확인 후 별도 승인으로 삭제.';

alter table public.companies_intro_json_backup enable row level security;
alter table public.companies_intro_json_backup force row level security;

insert into public.companies_intro_json_backup (company_id, intro)
select id, intro
from public.companies
where intro like '__COMPANY_METADATA__:%'
on conflict (company_id) do nothing;

update public.companies c
set intro = '__COMPANY_METADATA__:' || ((substring(c.intro from length('__COMPANY_METADATA__:') + 1)::jsonb - 'po_requests' - 'shipping_origins')::text)
where c.intro like '__COMPANY_METADATA__:%'
  and substring(c.intro from length('__COMPANY_METADATA__:') + 1)::jsonb ?| array['po_requests', 'shipping_origins']
  and exists (select 1 from public.companies_intro_json_backup b where b.company_id = c.id);
