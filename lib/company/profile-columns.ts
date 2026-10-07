/**
 * DATA-JSON-MIG-003: companies 의 회사 기본 정보 칸(0134)과 연락처 테이블.
 * parseCompanyMetadata 에 넘기는 회사 행을 조회할 때 select 에 덧붙인다.
 * profile_migrated_at 이 있으면 이 칸들이 정본이고, 없으면 intro JSON 을 쓴다.
 */
export const COMPANY_PROFILE_SELECT =
  "description, website, admin_memo, logo_path, address_1, address_2, city, state, zip_code, " +
  "company_onboarding_confirmed_at, admin_profile_onboarding_confirmed_at, brand_onboarding_confirmed_at, " +
  "team_onboarding_skipped, profile_migrated_at, " +
  "company_contacts(id, name, english_name, korean_last_name, korean_first_name, english_first_name, english_last_name, phone, email, title, position, is_primary, sort_order)";
