"use server";

import { verifyRetailerSession } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicEnv } from "@/lib/env/public";
import { passwordSchemaEn } from "@/lib/auth/password";

export interface ChangePasswordState {
  success: boolean;
  message?: string;
  error?: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

/**
 * RTP-AUTH-002: Retailer Self-Service Password Change
 * 
 * Verifies caller session, securely re-authenticates current password,
 * validates new password against complexity policies, and updates password in Supabase Auth.
 * 
 * Security:
 * - Operates only for authenticated retailer sessions
 * - Verified email derived strictly from server-side session (never trusted from client input)
 * - Strict current password verification before updating
 * - Passwords never logged, never stored in application database, never cached in memory
 */
export async function changeRetailerPasswordAction(
  input: ChangePasswordInput
): Promise<ChangePasswordState> {
  try {
    // 1. Authenticate caller session
    const session = await verifyRetailerSession();
    if (!session || !session.userId || !session.email) {
      return {
        success: false,
        error: "Your session has expired or is invalid. Please log in again.",
      };
    }

    const { currentPassword, newPassword, confirmPassword } = input;

    // 2. Validate field presence
    if (!currentPassword || typeof currentPassword !== "string" || !currentPassword.trim()) {
      return {
        success: false,
        error: "Please enter your current password.",
      };
    }

    if (!newPassword || typeof newPassword !== "string" || !newPassword.trim()) {
      return {
        success: false,
        error: "Please enter a new password.",
      };
    }

    if (!confirmPassword || typeof confirmPassword !== "string") {
      return {
        success: false,
        error: "Please confirm your new password.",
      };
    }

    // 3. Validate matching passwords
    if (newPassword !== confirmPassword) {
      return {
        success: false,
        error: "New password and confirmation password do not match.",
      };
    }

    // 4. Validate same password prevention
    if (newPassword === currentPassword) {
      return {
        success: false,
        error: "New password must be different from your current password.",
      };
    }

    // 5. Validate complexity rules (min 8 chars, letter + number)
    const parsed = passwordSchemaEn.safeParse(newPassword);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Password must be at least 8 characters long and contain both letters and numbers.",
      };
    }

    // 6. Current Password Re-Authentication
    // Use an isolated client with disabled session persistence to test credentials securely
    const { createClient: createSupabaseClient } = await import("@supabase/supabase-js");
    const testAuthClient = createSupabaseClient(
      publicEnv.NEXT_PUBLIC_SUPABASE_URL,
      publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    const { data: authData, error: authError } = await testAuthClient.auth.signInWithPassword({
      email: session.email,
      password: currentPassword,
    });

    if (authError || !authData.user) {
      return {
        success: false,
        error: "The current password you entered is incorrect.",
      };
    }

    // 7. Update Password in Supabase Auth
    // Use the active session client to update password and refresh session cookies
    const supabase = await createClient();
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      // If cookie-client update encountered an issue, fallback to admin client updateUserById for resilience
      const adminClient = createAdminClient();
      const { error: adminUpdateError } = await adminClient.auth.admin.updateUserById(
        session.userId,
        { password: newPassword }
      );

      if (adminUpdateError) {
        const msg = (adminUpdateError.message || updateError.message || "").toLowerCase();
        if (msg.includes("different") || msg.includes("same") || msg.includes("old password")) {
          return {
            success: false,
            error: "New password must be different from your current password.",
          };
        }
        return {
          success: false,
          error: "Failed to update password. Please check your password requirements and try again.",
        };
      }
    }

    return {
      success: true,
      message: "Your password has been updated successfully.",
    };
  } catch (err: any) {
    if (err?.digest?.includes("NEXT_REDIRECT")) {
      throw err;
    }
    console.error("[changeRetailerPasswordAction] Unhandled error during password update:", err?.message || err);
    return {
      success: false,
      error: "An unexpected error occurred while updating your password. Please try again.",
    };
  }
}
