import { createAdminClient } from "@/lib/supabase/admin";
import { getBilingualError } from "@/lib/errors/bilingual-messages";

export function normalizeEmail(email: string): string {
  if (!email) return "";
  return email.trim().toLowerCase();
}

export type DuplicateCheckResult =
  | { status: "AVAILABLE" }
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

  // 2. Also check profiles / auth.users via RPC or profiles table to prevent Orphan auth users
  const { data: existingProfile } = await admin
    .from("profiles")
    .select("id")
    .eq("id", (
      // Subquery or fallback check if auth user exists
      await admin.from("company_users").select("id").eq("email", normalized).maybeSingle()
    )?.data?.id || "00000000-0000-0000-0000-000000000000")
    .maybeSingle();

  // Alternative: query auth.users by searching in company_users again with lower() or checking existing auth
  // Supabase Auth Admin listUsers or getUserByEmail
  try {
    // Admin client to verify if auth user with this email exists
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
        // Registered in Auth but not in company_users yet
        return {
          status: "EXISTS_OTHER_COMPANY",
          message: getBilingualError("EMAIL_ALREADY_IN_OTHER_COMPANY"),
        };
      }
    }
  } catch (err) {
    console.error("Error during auth.users lookup:", err);
  }

  return { status: "AVAILABLE" };
}
