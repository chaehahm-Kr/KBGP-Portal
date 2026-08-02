import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireCompanyMembership } from "./dal";

export type PermissionLevel = "none" | "read" | "write";

export interface CompanyUserPermissions {
  application?: PermissionLevel;
  brands?: PermissionLevel;
  products?: PermissionLevel;
  company_info?: PermissionLevel;
}

/**
 * Checks if the current user has the required permission level for a given category.
 * company_admin always has full access (write).
 */
export async function hasMenuPermission(
  category: keyof CompanyUserPermissions,
  required: "read" | "write"
): Promise<boolean> {
  const membership = await requireCompanyMembership();
  
  // 1. company_admin always has full access
  if (membership.companyRole === "company_admin") {
    return true;
  }

  // 2. Query company_users permissions column for company_staff
  const supabase = await createClient();
  const { data: user } = await supabase
    .from("company_users")
    .select("permissions")
    .eq("id", membership.userId)
    .single();

  if (!user) {
    return false;
  }

  const permissions = (user.permissions || {}) as CompanyUserPermissions;
  const level = permissions[category] || "none";

  if (required === "write") {
    return level === "write";
  }

  if (required === "read") {
    return level === "read" || level === "write";
  }

  return false;
}

/**
 * Ensures the user has the required permission level, otherwise throws an error or redirects.
 */
export async function requireMenuPermission(
  category: keyof CompanyUserPermissions,
  required: "read" | "write"
): Promise<void> {
  const allowed = await hasMenuPermission(category, required);
  if (!allowed) {
    throw new Error(`이 작업을 수행할 권한이 없습니다. (카테고리: ${category}, 요구권한: ${required})`);
  }
}
