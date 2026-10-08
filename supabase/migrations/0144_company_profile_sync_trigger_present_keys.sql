-- 0144_company_profile_sync_trigger_present_keys.sql — DATA-JSON-CLEAN-004
-- 0135 트리거는 intro JSON 에 회사 기본 정보 키가 없으면 칸을 빈 값으로 덮어쓴다.
-- DATA-JSON-CLEAN-004 코드는 칸에 직접 쓰고 intro JSON 에는 그 키를 넣지 않으므로,
-- 코드 배포 전에 트리거가 "JSON 에 있는 키만" 칸에 반영하도록 바꾼다.
-- (예전 코드나 알림 코드가 키가 든 JSON 을 쓰면 지금처럼 칸을 맞추고, 키가 없으면 칸을 건드리지 않는다.)
-- 연락처 트리거(sync_company_contacts)는 이미 contacts 키가 없으면 아무것도 하지 않으므로 그대로 둔다.
-- JSON 정리(0145) 때 두 트리거를 모두 지운다.

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

  if m ? 'description' then new.description := coalesce(m->>'description', ''); end if;
  if m ? 'website' then new.website := coalesce(m->>'website', ''); end if;
  if m ? 'admin_memo' then new.admin_memo := coalesce(m->>'admin_memo', ''); end if;
  if m ? 'logo_path' then new.logo_path := nullif(m->>'logo_path', ''); end if;
  if m ? 'address_1' or m ? 'address' then
    new.address_1 := coalesce(nullif(m->>'address_1', ''), m->>'address', '');
  end if;
  if m ? 'address_2' then new.address_2 := coalesce(m->>'address_2', ''); end if;
  if m ? 'city' then new.city := coalesce(m->>'city', ''); end if;
  if m ? 'state' then new.state := coalesce(m->>'state', ''); end if;
  if m ? 'zip_code' then new.zip_code := coalesce(m->>'zip_code', ''); end if;
  if m ? 'company_onboarding_confirmed_at' then
    new.company_onboarding_confirmed_at := case when m->>'company_onboarding_confirmed_at' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' then (m->>'company_onboarding_confirmed_at')::timestamptz end;
  end if;
  if m ? 'admin_profile_onboarding_confirmed_at' then
    new.admin_profile_onboarding_confirmed_at := case when m->>'admin_profile_onboarding_confirmed_at' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' then (m->>'admin_profile_onboarding_confirmed_at')::timestamptz end;
  end if;
  if m ? 'brand_onboarding_confirmed_at' then
    new.brand_onboarding_confirmed_at := case when m->>'brand_onboarding_confirmed_at' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' then (m->>'brand_onboarding_confirmed_at')::timestamptz end;
  end if;
  if m ? 'team_onboarding_skipped' then
    new.team_onboarding_skipped := coalesce(m->>'team_onboarding_skipped' = 'true', false);
  end if;
  new.profile_migrated_at := coalesce(new.profile_migrated_at, now());
  return new;
end;
$$;
