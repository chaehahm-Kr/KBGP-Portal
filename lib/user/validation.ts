import { createAdminClient } from "@/lib/supabase/admin";
import { getBilingualError } from "@/lib/errors/bilingual-messages";

export function normalizeEmail(email: string): string {
  if (!email) return "";
  return email.trim().toLowerCase();
}

export type DuplicateCheckResult =
  | { status: "AVAILABLE" }
  | { status: "REUSE_AUTH_USER"; authUserId: string }
  | { status: "EXISTS_SAME_COMPANY"; message: string }
  | { status: "EXISTS_OTHER_COMPANY"; message: string };

/**
 * System-wide Email Duplicate Validation (One Email = One User = One Company)
 * Checks both `company_users` and `auth.users` tables.
 */
export async function checkUserEmailDuplicate(
  email: string,
  targetCompanyId?: string
): Promise<DuplicateCheckResult> {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    return {
      status: "EXISTS_SAME_COMPANY",
      message: getBilingualError("INVALID_EMAIL"),
    };
  }

  const admin = createAdminClient();

  // 1. Check company_users table
  const { data: existingCompanyUser } = await admin
    .from("company_users")
    .select("company_id")
    .eq("email", normalized)
    .maybeSingle();

  if (existingCompanyUser) {
    if (targetCompanyId && existingCompanyUser.company_id === targetCompanyId) {
      return {
        status: "EXISTS_SAME_COMPANY",
        message: getBilingualError("USER_ALREADY_IN_COMPANY"),
      };
    } else {
      return {
        status: "EXISTS_OTHER_COMPANY",
        message: getBilingualError("EMAIL_ALREADY_IN_OTHER_COMPANY"),
      };
    }
  }

  // 2. Check auth.users table to prevent orphan records or support safe re-invitation
  try {
    const { data: authUsers } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 50,
    });
    
    const existingAuthUser = authUsers?.users?.find(
      (u) => normalizeEmail(u.email || "") === normalized
    );

    if (existingAuthUser) {
      // Find if this auth user belongs to any company
      const { data: cUser } = await admin
        .from("company_users")
        .select("company_id")
        .eq("id", existingAuthUser.id)
        .maybeSingle();

      if (cUser) {
        if (targetCompanyId && cUser.company_id === targetCompanyId) {
          return {
            status: "EXISTS_SAME_COMPANY",
            message: getBilingualError("USER_ALREADY_IN_COMPANY"),
          };
        } else {
          return {
            status: "EXISTS_OTHER_COMPANY",
            message: getBilingualError("EMAIL_ALREADY_IN_OTHER_COMPANY"),
          };
        }
      } else {
        // Registered in Auth but not in company_users currently (Cancelled/Removed/Expired invite)
        // Safe to reuse existing Auth identity for re-invitation
        return {
          status: "REUSE_AUTH_USER",
          authUserId: existingAuthUser.id,
        };
      }
    }
  } catch (err) {
    console.error("Error during auth.users lookup:", err);
  }

  return { status: "AVAILABLE" };
}
