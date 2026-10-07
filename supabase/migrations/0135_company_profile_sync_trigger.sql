-- 0135_company_profile_sync_trigger.sql — DATA-JSON-MIG-003
-- 전환 기간 이중 쓰기: companies.intro 의 __COMPANY_METADATA__ JSON 이 쓰일 때마다
-- 0134 의 회사 기본 정보 칸과 company_contacts 를 같은 값으로 맞춘다.
-- intro 를 쓰는 코드가 16곳이라 코드마다 넣는 대신 DB 에서 한 번에 처리한다.
-- JSON 제거 단계에서 쓰기 코드를 칸 직접 쓰기로 바꾼 뒤 이 트리거를 제거한다.
-- JSON 파싱에 실패해도 원래 저장은 막지 않는다(동기화만 건너뜀).

create or replace function public.sync_company_profile_columns()
returns trigger
language plpgsql
as $$
declare
  m jsonb;
begin
  if new.intro is null or new.intro not like '__COMPANY_METADATA__:%' then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.intro is not distinct from old.intro then
    return new;
  end if;

  begin
    m := substring(new.intro from length('__COMPANY_METADATA__:') + 1)::jsonb;
  exception when others then
    return new;
  end;

  new.description := coalesce(m->>'description', '');
  new.website := coalesce(m->>'website', '');
  new.admin_memo := coalesce(m->>'admin_memo', '');
  new.logo_path := nullif(m->>'logo_path', '');
  new.address_1 := coalesce(nullif(m->>'address_1', ''), m->>'address', '');
  new.address_2 := coalesce(m->>'address_2', '');
  new.city := coalesce(m->>'city', '');
  new.state := coalesce(m->>'state', '');
  new.zip_code := coalesce(m->>'zip_code', '');
  new.company_onboarding_confirmed_at := case when m->>'company_onboarding_confirmed_at' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' then (m->>'company_onboarding_confirmed_at')::timestamptz end;
  new.admin_profile_onboarding_confirmed_at := case when m->>'admin_profile_onboarding_confirmed_at' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' then (m->>'admin_profile_onboarding_confirmed_at')::timestamptz end;
  new.brand_onboarding_confirmed_at := case when m->>'brand_onboarding_confirmed_at' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' then (m->>'brand_onboarding_confirmed_at')::timestamptz end;
  new.team_onboarding_skipped := coalesce(m->>'team_onboarding_skipped' = 'true', false);
  new.profile_migrated_at := coalesce(new.profile_migrated_at, now());
  return new;
end;
$$;

create or replace function public.sync_company_contacts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  m jsonb;
  old_contacts jsonb;
begin
  if new.intro is null or new.intro not like '__COMPANY_METADATA__:%' then
    return null;
  end if;

  begin
    m := substring(new.intro from length('__COMPANY_METADATA__:') + 1)::jsonb;
  exception when others then
    return null;
  end;

  if jsonb_typeof(m->'contacts') is distinct from 'array' then
    return null;
  end if;

  if tg_op = 'UPDATE' and old.intro like '__COMPANY_METADATA__:%' then
    begin
      old_contacts := substring(old.intro from length('__COMPANY_METADATA__:') + 1)::jsonb->'contacts';
    exception when others then
      old_contacts := null;
    end;
    if old_contacts is not distinct from m->'contacts'
       and exists (select 1 from public.company_contacts where company_id = new.id) then
      return null;
    end if;
  end if;

  delete from public.company_contacts where company_id = new.id;

  -- JSON 의 연락처 id 가 중복이면 새 id 로 다시 넣는다(저장 자체는 실패시키지 않는다)
  begin
    insert into public.company_contacts (
      id, company_id, name, english_name, korean_last_name, korean_first_name,
      english_first_name, english_last_name, phone, email, title, position, is_primary, sort_order
    )
    select
      case
        when (x.c->>'id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          and not exists (select 1 from public.company_contacts o where o.id = (x.c->>'id')::uuid)
          then (x.c->>'id')::uuid
        else gen_random_uuid()
      end,
      new.id,
      coalesce(x.c->>'name', ''),
      coalesce(x.c->>'englishName', x.c->>'english_name', ''),
      coalesce(x.c->>'koreanLastName', x.c->>'korean_last_name', ''),
      coalesce(x.c->>'koreanFirstName', x.c->>'korean_first_name', ''),
      coalesce(x.c->>'englishFirstName', x.c->>'english_first_name', ''),
      coalesce(x.c->>'englishLastName', x.c->>'english_last_name', ''),
      coalesce(x.c->>'phone', ''),
      coalesce(x.c->>'email', ''),
      coalesce(x.c->>'title', ''),
      coalesce(x.c->>'position', ''),
      coalesce(x.c->>'isPrimary' = 'true', false),
      (x.ord - 1)::integer
    from jsonb_array_elements(m->'contacts') with ordinality as x(c, ord)
    where jsonb_typeof(x.c) = 'object';
  exception when unique_violation then
    insert into public.company_contacts (
      id, company_id, name, english_name, korean_last_name, korean_first_name,
      english_first_name, english_last_name, phone, email, title, position, is_primary, sort_order
    )
    select
      gen_random_uuid(),
      new.id,
      coalesce(x.c->>'name', ''),
      coalesce(x.c->>'englishName', x.c->>'english_name', ''),
      coalesce(x.c->>'koreanLastName', x.c->>'korean_last_name', ''),
      coalesce(x.c->>'koreanFirstName', x.c->>'korean_first_name', ''),
      coalesce(x.c->>'englishFirstName', x.c->>'english_first_name', ''),
      coalesce(x.c->>'englishLastName', x.c->>'english_last_name', ''),
      coalesce(x.c->>'phone', ''),
      coalesce(x.c->>'email', ''),
      coalesce(x.c->>'title', ''),
      coalesce(x.c->>'position', ''),
      coalesce(x.c->>'isPrimary' = 'true', false),
      (x.ord - 1)::integer
    from jsonb_array_elements(m->'contacts') with ordinality as x(c, ord)
    where jsonb_typeof(x.c) = 'object';
  end;

  return null;
end;
$$;

drop trigger if exists trg_companies_sync_profile_columns on public.companies;
create trigger trg_companies_sync_profile_columns
  before insert or update of intro on public.companies
  for each row execute function public.sync_company_profile_columns();

drop trigger if exists trg_companies_sync_contacts on public.companies;
create trigger trg_companies_sync_contacts
  after insert or update of intro on public.companies
  for each row execute function public.sync_company_contacts();
