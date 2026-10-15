"use server";

import { verifyRetailerSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export interface WeeklyReportRecipientItem {
  id: string;
  email: string;
  name: string;
  role: string;
  isEligibleRole: boolean;
  status: "active" | "pending_verification" | "disabled";
  optIn: boolean;
  optedInAt: string | null;
  isCurrentUser: boolean;
  isExternal?: boolean;
}

export interface WeeklyReportNotificationState {
  optIn: boolean;
  optedInAt: string | null;
  email: string | null;
  role: string;
  canManageRecipients: boolean;
  companyId: string;
  companyName: string;
  recipients: WeeklyReportRecipientItem[];
  eligibleTeamMembers: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    status: string;
  }>;
}

/**
 * Fetch the authenticated retailer user's weekly report email opt-in preference
 * and all authorized company report recipients.
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
      .select("id, email, name, company_role, permissions, company_id")
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
    const canManageRecipients = ["owner", "buyer"].includes(role);
    const permissions = cu.permissions && typeof cu.permissions === "object" ? cu.permissions : {};

    const optIn = permissions.weekly_report_email_opt_in === true;
    const optedInAt = permissions.weekly_report_opted_in_at || null;

    // Fetch company name
    const { data: comp } = await adminClient
      .from("companies")
      .select("id, name")
      .eq("id", cu.company_id)
      .maybeSingle();

    const companyName = comp?.name || "Your Company";

    // Fetch all team members for this company
    const { data: teamMembers } = await adminClient
      .from("company_users")
      .select("id, email, name, status, company_role, permissions")
      .eq("company_id", cu.company_id);

    const { data: teamRoles } = await adminClient
      .from("retailer_user_roles")
      .select("user_id, role")
      .eq("company_id", cu.company_id);

    const roleMap = new Map<string, string>();
    for (const r of teamRoles || []) {
      if (r.user_id && r.role) {
        roleMap.set(r.user_id, r.role.toLowerCase());
      }
    }

    const allowedRoles = ["owner", "buyer", "store_manager"];
    const eligibleTeamMembers: Array<{
      id: string;
      name: string;
      email: string;
      role: string;
      status: string;
    }> = [];

    const recipientsMap = new Map<string, WeeklyReportRecipientItem>();

    for (const m of teamMembers || []) {
      const mRole = (roleMap.get(m.id) || m.company_role || "employee").toLowerCase();
      const isEligible = allowedRoles.includes(mRole);
      const mPerms = (m.permissions && typeof m.permissions === "object" ? m.permissions : {}) as Record<string, any>;
      const mOptIn = mPerms.weekly_report_email_opt_in === true;
      const mOptedInAt = mPerms.weekly_report_opted_in_at || null;

      if (isEligible) {
        eligibleTeamMembers.push({
          id: m.id,
          name: m.name || m.email?.split("@")[0] || "Team Member",
          email: m.email || "",
          role: mRole,
          status: m.status || "active",
        });
      }

      // If member is active in recipients or is the current user
      if (mOptIn || m.id === session.userId) {
        let recipientStatus: "active" | "pending_verification" | "disabled" = "disabled";
        if (m.status !== "active") {
          recipientStatus = "pending_verification";
        } else if (mOptIn) {
          recipientStatus = "active";
        }

        recipientsMap.set(m.id, {
          id: m.id,
          email: m.email || "",
          name: m.name || m.email?.split("@")[0] || "Team Member",
          role: mRole,
          isEligibleRole: isEligible,
          status: recipientStatus,
          optIn: mOptIn,
          optedInAt: mOptedInAt,
          isCurrentUser: m.id === session.userId,
        });
      }
    }

    const recipients = Array.from(recipientsMap.values());

    return {
      success: true,
      data: {
        optIn,
        optedInAt,
        email: cu.email || null,
        role,
        canManageRecipients,
        companyId: cu.company_id,
        companyName,
        recipients,
        eligibleTeamMembers,
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

/**
 * Add or enable an authorized team member as a weekly report recipient.
 * Scoped to Retailer Owner and Buyer roles with strict tenant isolation.
 */
export async function addWeeklyReportRecipientAction(input: {
  userId?: string;
  email?: string;
}): Promise<{
  success: boolean;
  error?: string;
  recipient?: WeeklyReportRecipientItem;
}> {
  try {
    const session = await verifyRetailerSession();
    const adminClient = createAdminClient();

    // 1. Verify caller authorization
    const { data: cu } = await adminClient
      .from("company_users")
      .select("id, company_role, company_id")
      .eq("id", session.userId)
      .maybeSingle();

    if (!cu) return { success: false, error: "User record not found." };

    const { data: rur } = await adminClient
      .from("retailer_user_roles")
      .select("role")
      .eq("user_id", session.userId)
      .eq("company_id", cu.company_id)
      .maybeSingle();

    const callerRole = (rur?.role || cu.company_role || "employee").toLowerCase();
    if (!["owner", "buyer"].includes(callerRole)) {
      return { success: false, error: "Only store owners and buyers can manage company report recipients." };
    }

    // 2. Identify target user within current tenant
    let targetMember: any = null;
    if (input.userId) {
      const { data } = await adminClient
        .from("company_users")
        .select("id, email, name, status, company_role, permissions, company_id")
        .eq("id", input.userId)
        .eq("company_id", cu.company_id) // Strict tenant boundary
        .maybeSingle();
      targetMember = data;
    } else if (input.email) {
      const cleanEmail = input.email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        return { success: false, error: "Please enter a valid email address." };
      }
      const { data } = await adminClient
        .from("company_users")
        .select("id, email, name, status, company_role, permissions, company_id")
        .eq("company_id", cu.company_id)
        .ilike("email", cleanEmail)
        .maybeSingle();
      targetMember = data;

      if (!targetMember) {
        return {
          success: false,
          error: "For data confidentiality and role-based security, report recipients must be verified team members of your store organization (Owner, Buyer, or Store Manager). Please invite this user under Settings > Team first.",
        };
      }
    }

    if (!targetMember) {
      return { success: false, error: "Team member not found in your organization." };
    }

    // 3. Verify target member role eligibility
    const { data: targetRur } = await adminClient
      .from("retailer_user_roles")
      .select("role")
      .eq("user_id", targetMember.id)
      .eq("company_id", cu.company_id)
      .maybeSingle();

    const targetRole = (targetRur?.role || targetMember.company_role || "employee").toLowerCase();
    const allowedRoles = ["owner", "buyer", "store_manager"];
    if (!allowedRoles.includes(targetRole)) {
      return {
        success: false,
        error: "Weekly reports contain sensitive store wholesale margins and replenishment analytics. Recipients must have an Owner, Buyer, or Store Manager role.",
      };
    }

    // Respect individual unsubscribe choice
    const currentPerms = (targetMember.permissions && typeof targetMember.permissions === "object" ? targetMember.permissions : {}) as Record<string, any>;
    if (currentPerms.weekly_report_unsubscribed === true) {
      return {
        success: false,
        error: "This team member has explicitly opted out / unsubscribed from weekly reports. Individual unsubscribe choices must be respected.",
      };
    }

    // Update permissions
    const updatedPerms = {
      ...currentPerms,
      weekly_report_email_opt_in: true,
      weekly_report_opted_in_at: new Date().toISOString(),
      weekly_report_granted_by: session.userId,
    };

    const { error: updErr } = await adminClient
      .from("company_users")
      .update({ permissions: updatedPerms })
      .eq("id", targetMember.id);

    if (updErr) {
      return { success: false, error: updErr.message };
    }

    revalidatePath("/settings/notifications");
    revalidatePath("/retailer/settings/notifications");

    return {
      success: true,
      recipient: {
        id: targetMember.id,
        email: targetMember.email,
        name: targetMember.name || targetMember.email.split("@")[0],
        role: targetRole,
        isEligibleRole: true,
        status: targetMember.status === "active" ? "active" : "pending_verification",
        optIn: true,
        optedInAt: new Date().toISOString(),
        isCurrentUser: targetMember.id === session.userId,
      },
    };
  } catch (err: any) {
    console.error("Error in addWeeklyReportRecipientAction:", err);
    return { success: false, error: err.message || "Failed to add report recipient." };
  }
}

/**
 * Toggle delivery status for an existing recipient.
 * Scoped to Owner / Buyer or individual recipient self-service.
 */
export async function toggleRecipientDeliveryAction(
  targetUserId: string,
  enable: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await verifyRetailerSession();
    const adminClient = createAdminClient();

    const { data: cu } = await adminClient
      .from("company_users")
      .select("id, company_role, company_id")
      .eq("id", session.userId)
      .maybeSingle();

    if (!cu) return { success: false, error: "User record not found." };

    const { data: rur } = await adminClient
      .from("retailer_user_roles")
      .select("role")
      .eq("user_id", session.userId)
      .eq("company_id", cu.company_id)
      .maybeSingle();

    const callerRole = (rur?.role || cu.company_role || "employee").toLowerCase();
    const isSelf = targetUserId === session.userId;

    if (!isSelf && !["owner", "buyer"].includes(callerRole)) {
      return { success: false, error: "Only store owners and buyers can update team recipient delivery." };
    }

    // Verify target belongs to the same tenant company
    const { data: targetUser } = await adminClient
      .from("company_users")
      .select("id, permissions, company_id")
      .eq("id", targetUserId)
      .eq("company_id", cu.company_id)
      .maybeSingle();

    if (!targetUser) return { success: false, error: "Target recipient not found in your company." };

    const currentPerms = (targetUser.permissions && typeof targetUser.permissions === "object" ? targetUser.permissions : {}) as Record<string, any>;
    const updatedPerms = {
      ...currentPerms,
      weekly_report_email_opt_in: !!enable,
      weekly_report_opted_in_at: enable ? new Date().toISOString() : null,
      weekly_report_unsubscribed: !enable ? true : false,
    };

    const { error: updErr } = await adminClient
      .from("company_users")
      .update({ permissions: updatedPerms })
      .eq("id", targetUserId);

    if (updErr) return { success: false, error: updErr.message };

    revalidatePath("/settings/notifications");
    revalidatePath("/retailer/settings/notifications");
    return { success: true };
  } catch (err: any) {
    console.error("Error in toggleRecipientDeliveryAction:", err);
    return { success: false, error: err.message || "Failed to update recipient delivery." };
  }
}

/**
 * Remove an authorized recipient from weekly report delivery.
 * Sets delivery status to disabled and unsubscribed.
 */
export async function removeWeeklyReportRecipientAction(
  targetUserId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await verifyRetailerSession();
    const adminClient = createAdminClient();

    const { data: cu } = await adminClient
      .from("company_users")
      .select("id, company_role, company_id")
      .eq("id", session.userId)
      .maybeSingle();

    if (!cu) return { success: false, error: "User record not found." };

    const { data: rur } = await adminClient
      .from("retailer_user_roles")
      .select("role")
      .eq("user_id", session.userId)
      .eq("company_id", cu.company_id)
      .maybeSingle();

    const callerRole = (rur?.role || cu.company_role || "employee").toLowerCase();
    const isSelf = targetUserId === session.userId;

    if (!isSelf && !["owner", "buyer"].includes(callerRole)) {
      return { success: false, error: "Only store owners and buyers can remove team report recipients." };
    }

    const { data: targetUser } = await adminClient
      .from("company_users")
      .select("id, permissions, company_id")
      .eq("id", targetUserId)
      .eq("company_id", cu.company_id)
      .maybeSingle();

    if (!targetUser) return { success: false, error: "Target recipient not found." };

    const currentPerms = (targetUser.permissions && typeof targetUser.permissions === "object" ? targetUser.permissions : {}) as Record<string, any>;
    const updatedPerms = {
      ...currentPerms,
      weekly_report_email_opt_in: false,
      weekly_report_opted_in_at: null,
      weekly_report_unsubscribed: true,
    };

    const { error: updErr } = await adminClient
      .from("company_users")
      .update({ permissions: updatedPerms })
      .eq("id", targetUserId);

    if (updErr) return { success: false, error: updErr.message };

    revalidatePath("/settings/notifications");
    revalidatePath("/retailer/settings/notifications");
    return { success: true };
  } catch (err: any) {
    console.error("Error in removeWeeklyReportRecipientAction:", err);
    return { success: false, error: err.message || "Failed to remove recipient." };
  }
}
