import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { COMPANY_META_PREFIX, COMPANY_PROFILE_JSON_KEYS, parseCompanyIntroJson } from "./profile-columns";

/**
 * DATA-JSON-CLEAN-004: 회사 메타데이터 쓰기.
 * 회사 기본 정보는 companies 칸, 연락처는 company_contacts 에 쓰고, intro JSON 에는 나머지
 * (type/types/status/notifications 등)만 남긴다. 메타데이터 객체에 들어 있는 키만 칸에 반영한다(부분 갱신).
 */

const PROFILE_KEYS = new Set<string>(COMPANY_PROFILE_JSON_KEYS);

function isoOrNull(v: unknown): string | null {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(v)) return null;
  return v;
}

export function splitCompanyMeta(meta: Record<string, any>): {
  columns: Record<string, any>;
  contacts: any[] | undefined;
  rest: Record<string, any>;
} {
  const columns: Record<string, any> = {};
  const rest: Record<string, any> = {};
  for (const [key, value] of Object.entries(meta || {})) {
    if (!PROFILE_KEYS.has(key)) rest[key] = value;
  }

  const has = (k: string) => meta && Object.prototype.hasOwnProperty.call(meta, k);
  if (has("description")) columns.description = meta.description ?? "";
  if (has("website")) columns.website = meta.website ?? "";
  if (has("admin_memo")) columns.admin_memo = meta.admin_memo ?? "";
  if (has("logo_path")) columns.logo_path = meta.logo_path || null;
  if (has("address_1") || has("address")) columns.address_1 = meta.address_1 || meta.address || "";
  if (has("address_2")) columns.address_2 = meta.address_2 ?? "";
  if (has("city")) columns.city = meta.city ?? "";
  if (has("state")) columns.state = meta.state ?? "";
  if (has("zip_code")) columns.zip_code = meta.zip_code ?? "";
  for (const k of ["company_onboarding_confirmed_at", "admin_profile_onboarding_confirmed_at", "brand_onboarding_confirmed_at"]) {
    if (has(k)) columns[k] = isoOrNull(meta[k]);
  }
  if (has("team_onboarding_skipped")) columns.team_onboarding_skipped = meta.team_onboarding_skipped === true;

  return { columns, contacts: Array.isArray(meta?.contacts) ? meta.contacts : undefined, rest };
}

/** intro 에 저장할 문자열(회사 기본 정보 키를 뺀 나머지 JSON). */
export function companyIntroFromMeta(meta: Record<string, any>): string {
  return `${COMPANY_META_PREFIX}${JSON.stringify(splitCompanyMeta(meta).rest)}`;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 회사 연락처를 통째로 바꾼다(배열 순서 = sort_order). */
export async function replaceCompanyContacts(admin: SupabaseClient, companyId: string, contacts: any[]): Promise<void> {
  const rows = contacts
    .filter((c) => c && typeof c === "object")
    .map((c, i) => ({
      id: typeof c.id === "string" && UUID_RE.test(c.id) ? c.id : crypto.randomUUID(),
      company_id: companyId,
      name: c.name || "",
      english_name: c.englishName || c.english_name || "",
      korean_last_name: c.koreanLastName || c.korean_last_name || "",
      korean_first_name: c.koreanFirstName || c.korean_first_name || "",
      english_first_name: c.englishFirstName || c.english_first_name || "",
      english_last_name: c.englishLastName || c.english_last_name || "",
      phone: c.phone || "",
      email: c.email || "",
      title: c.title || "",
      position: c.position || "",
      is_primary: c.isPrimary === true || c.is_primary === true,
      sort_order: i,
    }));

  const { error: delError } = await admin.from("company_contacts").delete().eq("company_id", companyId);
  if (delError) throw new Error(`회사 연락처 저장 실패: ${delError.message}`);
  if (rows.length === 0) return;
  const { error } = await admin.from("company_contacts").insert(rows);
  if (error) throw new Error(`회사 연락처 저장 실패: ${error.message}`);
}

/**
 * 메타데이터 객체를 칸/연락처/intro 나머지로 나눠 저장한다.
 * extra 는 같은 update 에 함께 넣을 companies 칸(name, status, updated_at 등).
 */
export async function saveCompanyMeta(
  admin: SupabaseClient,
  companyId: string,
  meta: Record<string, any>,
  extra: Record<string, any> = {}
): Promise<{ error: { message: string; code?: string } | null }> {
  const { columns, contacts, rest } = splitCompanyMeta(meta);
  const { error } = await admin
    .from("companies")
    .update({
      ...extra,
      ...columns,
      profile_migrated_at: new Date().toISOString(),
      intro: `${COMPANY_META_PREFIX}${JSON.stringify(rest)}`,
    })
    .eq("id", companyId);
  if (error) return { error };
  if (contacts) await replaceCompanyContacts(admin, companyId, contacts);
  return { error: null };
}

/** 새 회사 insert 용: insert payload 에 넣을 칸과 intro, 그리고 insert 후 저장할 연락처. */
export function companyInsertFieldsFromMeta(meta: Record<string, any>): {
  fields: Record<string, any>;
  contacts: any[] | undefined;
} {
  const { columns, contacts, rest } = splitCompanyMeta(meta);
  return {
    fields: {
      ...columns,
      profile_migrated_at: new Date().toISOString(),
      intro: `${COMPANY_META_PREFIX}${JSON.stringify(rest)}`,
    },
    contacts,
  };
}

/**
 * 부분 갱신의 바탕: intro JSON 에서 회사 기본 정보 키를 뺀 나머지.
 * intro 가 JSON 이 아닌 예전 일반 텍스트면 그 글을 소개(description)로 옮긴다.
 */
export function companyIntroRest(intro: unknown): Record<string, any> {
  if (typeof intro === "string" && intro.trim() && !intro.startsWith(COMPANY_META_PREFIX)) {
    return { description: intro };
  }
  return splitCompanyMeta(parseCompanyIntroJson(intro)).rest;
}
