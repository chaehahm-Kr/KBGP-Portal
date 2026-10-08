-- 0140_brand_intro_json_cleanup.sql — DATA-JSON-CLEAN-001
-- 브랜드 intro 의 "__JSON_METADATA__:{description, trademarks}" 를 소개 문구(description)만 남긴
-- 일반 텍스트로 바꾼다. 상표권은 0138 에서 brands 칸으로 옮겼고 코드도 칸만 쓴다.
-- 되돌릴 수 있도록 바꾸기 전 원본을 brands_intro_json_backup 에 남긴다(같은 브랜드는 한 번만 백업).

create table if not exists public.brands_intro_json_backup (
  brand_id uuid primary key references public.brands(id) on delete cascade,
  intro text not null,
  backed_up_at timestamptz not null default now()
);

comment on table public.brands_intro_json_backup is
  'DATA-JSON-CLEAN-001: JSON 정리 전 brands.intro 원본 백업. 확인 후 별도 승인으로 삭제.';

alter table public.brands_intro_json_backup enable row level security;
alter table public.brands_intro_json_backup force row level security;

insert into public.brands_intro_json_backup (brand_id, intro)
select id, intro
from public.brands
where intro like '__JSON_METADATA__:%'
on conflict (brand_id) do nothing;

update public.brands b
set intro = nullif(btrim(substring(b.intro from length('__JSON_METADATA__:') + 1)::jsonb->>'description'), '')
where b.intro like '__JSON_METADATA__:%'
  and exists (select 1 from public.brands_intro_json_backup k where k.brand_id = b.id);
