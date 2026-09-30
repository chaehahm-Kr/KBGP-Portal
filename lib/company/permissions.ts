import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireCompanyMembership, type CompanyMembership } from "./dal";
import {
  AclCategory,
  AclLevel,
  ACL_LEVEL_NUMERIC,
  ROLE_PRESETS,
  normalizePermissions,
} from "@/lib/permissions/brand-portal-acl";

export type { AclCategory, AclLevel } from "@/lib/permissions/brand-portal-acl";

/**
 * Resolves current user's full 9-category ACL matrix and company membership context.
 * Serves impersonating sessions via admin client to bypass RLS.
 */
export async function getPortalUserAcl(): Promise<{
  membership: CompanyMembership;
  permissions: Record<AclCategory, AclLevel>;
}> {
  const membership = await requireCompanyMembership();

  // Company Admin always has full 'manage' access to all categories for their own company
  if (membership.companyRole === "company_admin") {
    return {
      membership,
      permissions: { ...ROLE_PRESETS.admin },
    };
  }

  const supabase = createAdminClient();
  const { data: user } = await supabase
    .from("company_users")
    .select("permissions, company_role")
    .eq("id", membership.userId)
    .maybeSingle();

  const rawPermissions = (user?.permissions || {}) as Record<string, any>;
  const normalized = normalizePermissions(rawPermissions, user?.company_role || membership.companyRole);

  return {
    membership,
    permissions: normalized,
  };
}

/**
 * Check if the current logged-in portal user has at least `requiredLevel` for `category`.
 */
export async function hasPortalPermission(
  category: AclCategory,
  requiredLevel: AclLevel
): Promise<boolean> {
  try {
    const { permissions } = await getPortalUserAcl();
    const userLevel = permissions[category] || "none";
    return ACL_LEVEL_NUMERIC[userLevel] >= ACL_LEVEL_NUMERIC[requiredLevel];
  } catch (err) {
    console.warn(`[Permission Check] Failed to evaluate permission for category ${category}:`, err);
    return false;
  }
}

/**
 * Enforce minimum ACL level. Throws error if unauthorized.
 */
export async function requirePortalPermission(
  category: AclCategory,
  requiredLevel: AclLevel
): Promise<CompanyMembership> {
  const { membership, permissions } = await getPortalUserAcl();
  const userLevel = permissions[category] || "none";

  if (ACL_LEVEL_NUMERIC[userLevel] < ACL_LEVEL_NUMERIC[requiredLevel]) {
    throw new Error(
      `이 작업을 수행할 권한이 없습니다. (메뉴: ${category}, 필요 권한: ${requiredLevel}, 보유 권한: ${userLevel})`
    );
  }

  return membership;
}

// ==========================================
// Backward Compatibility Aliases
// ==========================================

export async function hasMenuPermission(
  category: any,
  required: "read" | "write"
): Promise<boolean> {
  const level: AclLevel = required === "write" ? "write" : "read";
  return hasPortalPermission(category as AclCategory, level);
}

export async function requireMenuPermission(
  category: any,
  required: "read" | "write"
): Promise<void> {
  const level: AclLevel = required === "write" ? "write" : "read";
  await requirePortalPermission(category as AclCategory, level);
}
