import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ACL_CATEGORIES,
  normalizePermissions,
  type AclCategory,
  type AclLevel,
  type BrandPortalRole,
} from "@/lib/permissions/brand-portal-acl";

/**
 * DATA-JSON-MIG-002: company_user_permissions 테이블 읽기/쓰기.
 * 전환 기간에는 company_users.permissions JSON 과 이중으로 쓰고, 읽을 때는 테이블을 먼저 본다.
 * 테이블에 쓰기 RLS 정책이 없으므로 반드시 service role(admin) 클라이언트로 호출한다.
 */

const TABLE = "company_user_permissions";
const ACL_COLUMNS = ACL_CATEGORIES.map((c) => c.id);

// 0133 마이그레이션의 preset 해석과 같다.
function resolvePresetName(json: Record<string, any>, companyRole?: string | null): BrandPortalRole {
  const key = json?.preset || json?.role || companyRole;
  if (key === "company_admin" || key === "admin") return "admin";
  if (key === "restricted" || key === "company_restricted") return "restricted";
  if (key === "staff" || key === "company_staff") return "staff";
  if (key === "manager" || key === "company_manager") return "manager";
  return "viewer";
}

/** 테이블 행을 읽는다. 행이 없거나 조회에 실패하면 null(호출자는 JSON 으로 대체). */
export async function readCompanyUserAclRow(
  admin: SupabaseClient,
  userId: string
): Promise<Record<AclCategory, AclLevel> | null> {
  const { data, error } = await admin
    .from(TABLE)
    .select(ACL_COLUMNS.join(", "))
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.warn("[permission-store] read failed, falling back to JSON:", error.message);
    return null;
  }
  if (!data) return null;

  const row = data as unknown as Record<string, string>;
  const result = {} as Record<AclCategory, AclLevel>;
  for (const col of ACL_COLUMNS) {
    result[col] = (row[col] as AclLevel) || "none";
  }
  return result;
}

/**
 * company_users.permissions JSON 을 쓴 직후 호출해 테이블을 같은 값으로 맞춘다.
 * 테이블 쓰기에 실패하면 오래된 행이 읽히지 않도록 행을 지워 JSON 으로 대체되게 한다.
 */
export async function syncCompanyUserAclRow(
  admin: SupabaseClient,
  params: {
    userId: string;
    companyId: string;
    permissionsJson: Record<string, any> | null | undefined;
    companyRole?: string | null;
    updatedBy?: string | null;
  }
): Promise<void> {
  const json = params.permissionsJson && typeof params.permissionsJson === "object" ? params.permissionsJson : {};
  const levels = normalizePermissions(json, params.companyRole || undefined);

  const { error } = await admin.from(TABLE).upsert(
    {
      user_id: params.userId,
      company_id: params.companyId,
      preset: resolvePresetName(json, params.companyRole),
      ...levels,
      updated_at: new Date().toISOString(),
      updated_by: params.updatedBy ?? null,
    },
    { onConflict: "user_id" }
  );

  if (error) {
    console.error("[permission-store] upsert failed, removing stale row:", error.message);
    await admin.from(TABLE).delete().eq("user_id", params.userId);
  }
}
