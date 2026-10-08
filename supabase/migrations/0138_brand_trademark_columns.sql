-- 0138_brand_trademark_columns.sql — DATA-JSON-MIG-006
-- 브랜드 상표권(한국/미국 등록 여부·번호·증빙 파일 경로)을 brands.intro 의
-- "__JSON_METADATA__:" JSON(trademarks)에서 0015 의 brands 칸으로 옮긴다.
-- 0015 는 운영 DB에 적용되지 않았고 IF NOT EXISTS 가 없어 재실행할 수 없으므로 여기서 다시 만든다.
--
-- 코드(lib/brand/actions.ts, 브랜드 화면들)는 이미 칸을 조회하고, 칸에 먼저 쓰고 칸이 없을 때만
-- JSON 에 쓴다. 칸이 생기면 코드 변경 없이 칸을 쓰므로, 같은 실행에서 JSON 값을 칸으로 복사한다.
-- intro JSON 원본(설명 + trademarks)은 지우지 않는다. 재실행 안전(상표권 칸이 아직 비어 있는 브랜드에만 복사해, 나중에 칸에서 고친 값을 덮어쓰지 않는다).

alter table public.brands
  add column if not exists has_kr_trademark boolean not null default false,
  add column if not exists kr_trademark_number text,
  add column if not exists kr_trademark_path text,
  add column if not exists has_us_trademark boolean not null default false,
  add column if not exists us_trademark_number text,
  add column if not exists us_trademark_path text;

comment on column public.brands.has_kr_trademark is '대한민국 특허청 상표권 등록 여부';
comment on column public.brands.kr_trademark_number is '대한민국 특허청 상표권 등록 번호';
comment on column public.brands.kr_trademark_path is '대한민국 특허청 상표권 증빙 파일 경로';
comment on column public.brands.has_us_trademark is '미국 USPTO 상표권 등록 여부';
comment on column public.brands.us_trademark_number is '미국 USPTO 상표권 등록 번호';
comment on column public.brands.us_trademark_path is '미국 USPTO 상표권 증빙 파일 경로';

with meta as (
  select id, substring(intro from length('__JSON_METADATA__:') + 1)::jsonb->'trademarks' as t
  from public.brands
  where intro like '__JSON_METADATA__:%'
)
update public.brands b
set
  has_kr_trademark = coalesce(meta.t->>'has_kr_trademark' = 'true', false),
  kr_trademark_number = nullif(meta.t->>'kr_trademark_number', ''),
  kr_trademark_path = nullif(meta.t->>'kr_trademark_path', ''),
  has_us_trademark = coalesce(meta.t->>'has_us_trademark' = 'true', false),
  us_trademark_number = nullif(meta.t->>'us_trademark_number', ''),
  us_trademark_path = nullif(meta.t->>'us_trademark_path', '')
from meta
where b.id = meta.id
  and jsonb_typeof(meta.t) = 'object'
  and not b.has_kr_trademark and not b.has_us_trademark
  and b.kr_trademark_number is null and b.kr_trademark_path is null
  and b.us_trademark_number is null and b.us_trademark_path is null;
