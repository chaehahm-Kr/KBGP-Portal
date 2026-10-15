"use server";

import { verifyRetailerSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export interface ExternalRecipientRecord {
  id: string;
  email: string;
  name?: string;
  status: "active" | "disabled";
  optIn: boolean;
  optedInAt: string | null;
  unsubscribed?: boolean;
  addedBy?: string;
  addedAt?: string;
  isExternal: boolean;
}

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
 * and all authorized company report recipients (internal team members and external recipients).
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

    const eligibleTeamMembers: Array<{
      id: string;
      name: string;
      email: string;
      role: string;
      status: string;
    }> = [];

    const recipientsMap = new Map<string, WeeklyReportRecipientItem>();
    let externalRecipients: ExternalRecipientRecord[] = [];

    // 1. Process team members
    for (const m of teamMembers || []) {
      const mRole = (roleMap.get(m.id) || m.company_role || "employee").toLowerCase();
      const mPerms = (m.permissions && typeof m.permissions === "object" ? m.permissions : {}) as Record<string, any>;
      const mOptIn = mPerms.weekly_report_email_opt_in === true;
      const mOptedInAt = mPerms.weekly_report_opted_in_at || null;

      // Extract external recipients list if stored on manager permissions
      if (Array.isArray(mPerms.weekly_report_external_recipients) && mPerms.weekly_report_external_recipients.length > 0) {
        if (externalRecipients.length === 0 || m.id === session.userId) {
          externalRecipients = mPerms.weekly_report_external_recipients;
        }
      }

      eligibleTeamMembers.push({
        id: m.id,
        name: m.name || m.email?.split("@")[0] || "Team Member",
        email: m.email || "",
        role: mRole,
        status: m.status || "active",
      });

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
          isEligibleRole: true,
          status: recipientStatus,
          optIn: mOptIn,
          optedInAt: mOptedInAt,
          isCurrentUser: m.id === session.userId,
          isExternal: false,
        });
      }
    }

    // 2. Process unrestricted external recipients
    for (const ext of externalRecipients) {
      if (!ext.email) continue;
      // Do not duplicate if already registered as a team member
      const existingTeam = Array.from(recipientsMap.values()).find(
        (r) => r.email.toLowerCase() === ext.email.toLowerCase()
      );
      if (existingTeam) continue;

      recipientsMap.set(ext.id, {
        id: ext.id,
        email: ext.email,
        name: ext.name || ext.email.split("@")[0],
        role: "External Recipient",
        isEligibleRole: true,
        status: ext.status || (ext.optIn ? "active" : "disabled"),
        optIn: ext.optIn !== false,
        optedInAt: ext.optedInAt || null,
        isCurrentUser: false,
        isExternal: true,
      });
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
 * Add or enable an authorized recipient for weekly performance reports.
 * Supports ANY valid email address (internal team member or external advisor/partner/Gmail/Letusto/Admin).
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

    // 1. Verify caller authorization (Only Owner or Buyer)
    const { data: cu } = await adminClient
      .from("company_users")
      .select("id, company_role, company_id, permissions")
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

    // 2. Resolve input
    let targetMember: any = null;
    let cleanEmail = "";

    if (input.userId) {
      const { data } = await adminClient
        .from("company_users")
        .select("id, email, name, status, company_role, permissions, company_id")
        .eq("id", input.userId)
        .eq("company_id", cu.company_id) // Strict tenant boundary
        .maybeSingle();
      targetMember = data;
      if (targetMember?.email) cleanEmail = targetMember.email.trim().toLowerCase();
    } else if (input.email) {
      cleanEmail = input.email.trim().toLowerCase();
      // Format validation
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        return { success: false, error: "Please enter a valid email address." };
      }
      // Check if email matches a member of THIS company
      const { data } = await adminClient
        .from("company_users")
        .select("id, email, name, status, company_role, permissions, company_id")
        .eq("company_id", cu.company_id)
        .ilike("email", cleanEmail)
        .maybeSingle();
      targetMember = data;
    } else {
      return { success: false, error: "Please enter an email address or select a team member." };
    }

    // CASE A: Recipient is an existing team member of this company
    if (targetMember) {
      const targetRole = targetMember.company_role || "employee";
      const currentPerms = (targetMember.permissions && typeof targetMember.permissions === "object"
        ? targetMember.permissions
        : {}) as Record<string, any>;

      // Check duplicate active recipient
      if (currentPerms.weekly_report_email_opt_in === true) {
        return {
          success: false,
          error: "This team member is already registered as an active report recipient.",
        };
      }

      const updatedPerms = {
        ...currentPerms,
        weekly_report_email_opt_in: true,
        weekly_report_opted_in_at: new Date().toISOString(),
        weekly_report_unsubscribed: false,
        weekly_report_granted_by: session.userId,
      };

      const { error: updErr } = await adminClient
        .from("company_users")
        .update({ permissions: updatedPerms })
        .eq("id", targetMember.id);

      if (updErr) return { success: false, error: updErr.message };

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
          isExternal: false,
        },
      };
    }

    // CASE B: Unrestricted External Email Recipient
    // (Gmail, external accounting firms, business partners, Letusto, Admin, brand reps, other retailers, etc.)
    const { data: managers } = await adminClient
      .from("company_users")
      .select("id, permissions")
      .eq("company_id", cu.company_id);

    let externalList: ExternalRecipientRecord[] = [];
    for (const m of managers || []) {
      const list = m.permissions?.weekly_report_external_recipients;
      if (Array.isArray(list) && list.length > 0) {
        externalList = list;
        break;
      }
    }

    // Check duplicate
    const existingIndex = externalList.findIndex(
      (r) => r.email.toLowerCase() === cleanEmail
    );

    if (existingIndex >= 0 && externalList[existingIndex].optIn) {
      return {
        success: false,
        error: "This email address is already registered as an active report recipient.",
      };
    }

    let extRecord: ExternalRecipientRecord;
    const nowIso = new Date().toISOString();

    if (existingIndex >= 0) {
      // Re-enable existing recipient
      externalList[existingIndex] = {
        ...externalList[existingIndex],
        status: "active",
        optIn: true,
        optedInAt: nowIso,
        unsubscribed: false,
      };
      extRecord = externalList[existingIndex];
    } else {
      const newExtId = `ext_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      extRecord = {
        id: newExtId,
        email: cleanEmail,
        name: cleanEmail.split("@")[0],
        status: "active",
        optIn: true,
        optedInAt: nowIso,
        unsubscribed: false,
        addedBy: session.userId,
        addedAt: nowIso,
        isExternal: true,
      };
      externalList.push(extRecord);
    }

    // Persist to all managers for this company
    const managerIds = (managers || [cu]).map((m) => m.id);
    for (const mgrId of managerIds) {
      const currentMgr = managers?.find((m) => m.id === mgrId);
      const currentPerms = currentMgr?.permissions && typeof currentMgr.permissions === "object"
        ? currentMgr.permissions
        : {};

      await adminClient
        .from("company_users")
        .update({
          permissions: {
            ...currentPerms,
            weekly_report_external_recipients: externalList,
          },
        })
        .eq("id", mgrId);
    }

    revalidatePath("/settings/notifications");
    revalidatePath("/retailer/settings/notifications");

    return {
      success: true,
      recipient: {
        id: extRecord.id,
        email: extRecord.email,
        name: extRecord.name || extRecord.email.split("@")[0],
        role: "External Recipient",
        isEligibleRole: true,
        status: "active",
        optIn: true,
        optedInAt: nowIso,
        isCurrentUser: false,
        isExternal: true,
      },
    };
  } catch (err: any) {
    console.error("Error in addWeeklyReportRecipientAction:", err);
    return { success: false, error: err.message || "Failed to add report recipient." };
  }
}

/**
 * Toggle delivery status for an existing recipient.
 * Supports both internal team members and external recipients.
 * Scoped to Owner / Buyer or individual recipient self-service.
 */
export async function toggleRecipientDeliveryAction(
  targetId: string,
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
    const isSelf = targetId === session.userId;

    if (!isSelf && !["owner", "buyer"].includes(callerRole)) {
      return { success: false, error: "Only store owners and buyers can update team recipient delivery." };
    }

    // Check if target is external
    if (targetId.startsWith("ext_")) {
      const { data: managers } = await adminClient
        .from("company_users")
        .select("id, permissions")
        .eq("company_id", cu.company_id);

      let externalList: ExternalRecipientRecord[] = [];
      for (const m of managers || []) {
        const list = m.permissions?.weekly_report_external_recipients;
        if (Array.isArray(list) && list.length > 0) {
          externalList = list;
          break;
        }
      }

      const idx = externalList.findIndex((r) => r.id === targetId);
      if (idx >= 0) {
        externalList[idx] = {
          ...externalList[idx],
          optIn: !!enable,
          status: enable ? "active" : "disabled",
          optedInAt: enable ? new Date().toISOString() : null,
          unsubscribed: !enable,
        };

        for (const m of managers || []) {
          const currentPerms = m.permissions && typeof m.permissions === "object" ? m.permissions : {};
          await adminClient
            .from("company_users")
            .update({
              permissions: {
                ...currentPerms,
                weekly_report_external_recipients: externalList,
              },
            })
            .eq("id", m.id);
        }
      }

      revalidatePath("/settings/notifications");
      revalidatePath("/retailer/settings/notifications");
      return { success: true };
    }

    // Team member
    const { data: targetUser } = await adminClient
      .from("company_users")
      .select("id, permissions, company_id")
      .eq("id", targetId)
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
      .eq("id", targetId);

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
 * Supports both internal team members and external recipients.
 */
export async function removeWeeklyReportRecipientAction(
  targetId: string
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
    const isSelf = targetId === session.userId;

    if (!isSelf && !["owner", "buyer"].includes(callerRole)) {
      return { success: false, error: "Only store owners and buyers can remove team report recipients." };
    }

    // Check if target is external
    if (targetId.startsWith("ext_")) {
      const { data: managers } = await adminClient
        .from("company_users")
        .select("id, permissions")
        .eq("company_id", cu.company_id);

      let externalList: ExternalRecipientRecord[] = [];
      for (const m of managers || []) {
        const list = m.permissions?.weekly_report_external_recipients;
        if (Array.isArray(list) && list.length > 0) {
          externalList = list;
          break;
        }
      }

      externalList = externalList.filter((r) => r.id !== targetId);

      for (const m of managers || []) {
        const currentPerms = m.permissions && typeof m.permissions === "object" ? m.permissions : {};
        await adminClient
          .from("company_users")
          .update({
            permissions: {
              ...currentPerms,
              weekly_report_external_recipients: externalList,
            },
          })
          .eq("id", m.id);
      }

      revalidatePath("/settings/notifications");
      revalidatePath("/retailer/settings/notifications");
      return { success: true };
    }

    // Team member
    const { data: targetUser } = await adminClient
      .from("company_users")
      .select("id, permissions, company_id")
      .eq("id", targetId)
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
      .eq("id", targetId);

    if (updErr) return { success: false, error: updErr.message };

    revalidatePath("/settings/notifications");
    revalidatePath("/retailer/settings/notifications");
    return { success: true };
  } catch (err: any) {
    console.error("Error in removeWeeklyReportRecipientAction:", err);
    return { success: false, error: err.message || "Failed to remove recipient." };
  }
}

/**
 * Server DAL: Get all active weekly report recipient email destinations for a company.
 * Merges opted-in team members and active external recipients with suppression filtering.
 */
export async function getActiveCompanyWeeklyReportRecipients(companyId: string): Promise<Array<{
  email: string;
  name: string;
  isExternal: boolean;
}>> {
  const adminClient = createAdminClient();
  const recipients: Array<{ email: string; name: string; isExternal: boolean }> = [];
  const seenEmails = new Set<string>();

  // 1. Team members opted-in
  const { data: teamMembers } = await adminClient
    .from("company_users")
    .select("id, email, name, status, permissions")
    .eq("company_id", companyId);

  let externalList: ExternalRecipientRecord[] = [];

  for (const tm of teamMembers || []) {
    const perms = (tm.permissions && typeof tm.permissions === "object" ? tm.permissions : {}) as Record<string, any>;
    if (perms.weekly_report_email_opt_in === true && perms.weekly_report_unsubscribed !== true && tm.status === "active") {
      const cleanEmail = (tm.email || "").toLowerCase().trim();
      if (cleanEmail && !seenEmails.has(cleanEmail)) {
        seenEmails.add(cleanEmail);
        recipients.push({
          email: cleanEmail,
          name: tm.name || cleanEmail.split("@")[0],
          isExternal: false,
        });
      }
    }

    if (Array.isArray(perms.weekly_report_external_recipients) && perms.weekly_report_external_recipients.length > 0) {
      if (externalList.length === 0) {
        externalList = perms.weekly_report_external_recipients;
      }
    }
  }

  // 2. Active external recipients
  for (const ext of externalList) {
    if (ext.optIn && !ext.unsubscribed && ext.email) {
      const cleanEmail = ext.email.toLowerCase().trim();
      if (!seenEmails.has(cleanEmail)) {
        seenEmails.add(cleanEmail);
        recipients.push({
          email: cleanEmail,
          name: ext.name || cleanEmail.split("@")[0],
          isExternal: true,
        });
      }
    }
  }

  return recipients;
}
