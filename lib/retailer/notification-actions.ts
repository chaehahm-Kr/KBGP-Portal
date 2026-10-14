"use server";

import { verifyRetailerSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export interface WeeklyReportNotificationState {
  optIn: boolean;
  optedInAt: string | null;
  email: string | null;
  role: string;
}

/**
 * Fetch the authenticated retailer user's weekly report email opt-in preference
 * DEFAULT IS STRICTLY FALSE (OFF)
 */
export async function getWeeklyReportEmailOptInAction(): Promise<{
  success: boolean;
  data?: WeeklyReportNotificationState;
  error?: string;
}> {
  try {
    const session = await verifyRetailerSession();
    const adminClient = createAdminClient();

    const { data: cu, error } = await adminClient
      .from("company_users")
      .select("id, email, company_role, permissions, company_id")
      .eq("id", session.userId)
      .maybeSingle();

    if (error || !cu) {
      return { success: false, error: "User record not found." };
    }

    const { data: rur } = await adminClient
      .from("retailer_user_roles")
      .select("role")
      .eq("user_id", session.userId)
      .eq("company_id", cu.company_id)
      .maybeSingle();

    const role = (rur?.role || cu.company_role || "employee").toLowerCase();
    const permissions = cu.permissions && typeof cu.permissions === "object" ? cu.permissions : {};

    const optIn = permissions.weekly_report_email_opt_in === true;
    const optedInAt = permissions.weekly_report_opted_in_at || null;

    return {
      success: true,
      data: {
        optIn,
        optedInAt,
        email: cu.email || null,
        role,
      },
    };
  } catch (err: any) {
    console.error("Error in getWeeklyReportEmailOptInAction:", err);
    return { success: false, error: err.message || "Failed to load notification settings." };
  }
}

/**
 * Update the weekly report email opt-in preference for the authenticated retailer user
 * Scoped to authorized roles: owner, buyer, store_manager
 */
export async function updateWeeklyReportEmailOptInAction(optIn: boolean): Promise<{
  success: boolean;
  error?: string;
  optIn?: boolean;
}> {
  try {
    const session = await verifyRetailerSession();
    const adminClient = createAdminClient();

    const { data: cu, error } = await adminClient
      .from("company_users")
      .select("id, company_role, permissions, company_id")
      .eq("id", session.userId)
      .maybeSingle();

    if (error || !cu) {
      return { success: false, error: "User record not found." };
    }

    const { data: rur } = await adminClient
      .from("retailer_user_roles")
      .select("role")
      .eq("user_id", session.userId)
      .eq("company_id", cu.company_id)
      .maybeSingle();

    const role = (rur?.role || cu.company_role || "employee").toLowerCase();
    const allowedRoles = ["owner", "buyer", "store_manager"];
    if (!allowedRoles.includes(role)) {
      return {
        success: false,
        error: "Only store managers, buyers, and owners can update notification preferences.",
      };
    }

    const currentPermissions = cu.permissions && typeof cu.permissions === "object" ? cu.permissions : {};
    const updatedPermissions = {
      ...currentPermissions,
      weekly_report_email_opt_in: !!optIn,
      weekly_report_opted_in_at: optIn ? new Date().toISOString() : null,
    };

    const { error: updateError } = await adminClient
      .from("company_users")
      .update({ permissions: updatedPermissions })
      .eq("id", session.userId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    revalidatePath("/settings/notifications");
    revalidatePath("/retailer/settings/notifications");
    return { success: true, optIn: !!optIn };
  } catch (err: any) {
    console.error("Error in updateWeeklyReportEmailOptInAction:", err);
    return { success: false, error: err.message || "Failed to update notification settings." };
  }
}
