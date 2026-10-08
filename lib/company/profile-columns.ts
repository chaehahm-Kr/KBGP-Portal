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

export const COMPANY_META_PREFIX = "__COMPANY_METADATA__:";

/**
 * DATA-JSON-CLEAN-004: companies 칸/company_contacts 로 옮긴 intro JSON 키.
 * type/types/status 와 notifications 는 아직 intro JSON 에 남는다.
 */
export const COMPANY_PROFILE_JSON_KEYS = [
  "description",
  "address",
  "address_1",
  "address_2",
  "city",
  "state",
  "zip_code",
  "website",
  "admin_memo",
  "logo_path",
  "contacts",
  "company_onboarding_confirmed_at",
  "admin_profile_onboarding_confirmed_at",
  "brand_onboarding_confirmed_at",
  "team_onboarding_skipped",
] as const;

/** intro 의 "__COMPANY_METADATA__:" JSON 을 읽는다. 없거나 깨졌으면 빈 객체. */
export function parseCompanyIntroJson(intro: unknown): Record<string, any> {
  if (typeof intro !== "string" || !intro.startsWith(COMPANY_META_PREFIX)) return {};
  try {
    const parsed = JSON.parse(intro.substring(COMPANY_META_PREFIX.length));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * 회사 행에서 예전 intro JSON 과 같은 모양의 메타데이터를 만든다.
 * profile_migrated_at 이 있으면 회사 기본 정보 칸과 company_contacts(함께 조회했을 때)를 쓰고,
 * 없으면 intro JSON 그대로다. 행을 조회할 때 select 에 COMPANY_PROFILE_SELECT 를 덧붙여야 한다.
 */
export function companyMetaFromRow(row: any): Record<string, any> {
  const json = parseCompanyIntroJson(row?.intro);
  if (!row?.profile_migrated_at) return json;

  const addr1 = row.address_1 || "";
  const addr2 = row.address_2 || "";
  const city = row.city || "";
  const state = row.state || "";
  const zip = row.zip_code || "";
  const address = addr1
    ? `${addr1}${addr2 ? " " + addr2 : ""}${city ? ", " + city : ""}${state ? ", " + state : ""}${zip ? " (" + zip + ")" : ""}`
    : "";

  const contacts = Array.isArray(row.company_contacts)
    ? [...row.company_contacts]
        .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        .map((c: any) => ({
          id: c.id,
          name: c.name || "",
          englishName: c.english_name || "",
          koreanLastName: c.korean_last_name || "",
          koreanFirstName: c.korean_first_name || "",
          englishFirstName: c.english_first_name || "",
          englishLastName: c.english_last_name || "",
          phone: c.phone || "",
          email: c.email || "",
          title: c.title || "",
          position: c.position || "",
          isPrimary: Boolean(c.is_primary),
        }))
    : json.contacts;

  return {
    ...json,
    description: row.description ?? "",
    website: row.website ?? "",
    admin_memo: row.admin_memo ?? "",
    logo_path: row.logo_path || null,
    address,
    address_1: addr1,
    address_2: addr2,
    city,
    state,
    zip_code: zip,
    contacts: contacts ?? [],
    company_onboarding_confirmed_at: row.company_onboarding_confirmed_at || null,
    admin_profile_onboarding_confirmed_at: row.admin_profile_onboarding_confirmed_at || null,
    brand_onboarding_confirmed_at: row.brand_onboarding_confirmed_at || null,
    team_onboarding_skipped: Boolean(row.team_onboarding_skipped),
  };
}
