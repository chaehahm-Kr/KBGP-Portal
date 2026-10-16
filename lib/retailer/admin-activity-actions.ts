"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAdminSession } from "@/lib/auth/dal";
import {
  ActivityType,
  ACTIVITY_TYPE_CONFIGS,
  CreateStoreActivityInput,
  UpdateStoreActivityInput,
} from "./admin-store-activities-types";

const MIGRATION_PENDING_ERROR =
  "Database migration pending: The store_activities table has not been applied to Production Supabase yet. Live manual activity writes are safely gated until Owner migration execution.";

/**
 * Helper to check whether the store_activities table is available in Supabase.
 */
async function isStoreActivitiesTableAvailable(adminClient: any): Promise<boolean> {
  try {
    const { error } = await adminClient.from("store_activities").select("id").limit(1);
    if (error) {
      const code = (error as any).code;
      const msg = error.message || "";
      if (code === "PGRST205" || code === "42P01" || msg.includes("schema cache") || msg.includes("store_activities")) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Creates a new manual Store Activity record.
 */
export async function createStoreActivityAction(
  input: CreateStoreActivityInput
): Promise<{ success: boolean; activityId?: string; error?: string }> {
  try {
    const session = await verifyAdminSession();
    if (!session || !session.userId) {
      return { success: false, error: "Unauthorized: Admin session required." };
    }

    const adminClient = createAdminClient();

    // 1. Feature Gate Check: Verify database table availability
    const tableAvailable = await isStoreActivitiesTableAvailable(adminClient);
    if (!tableAvailable) {
      return { success: false, error: MIGRATION_PENDING_ERROR };
    }

    // 2. Validate Inputs
    const trimmedTitle = (input.title || "").trim();
    if (trimmedTitle.length < 3 || trimmedTitle.length > 200) {
      return { success: false, error: "Activity title must be between 3 and 200 characters." };
    }

    if (!ACTIVITY_TYPE_CONFIGS[input.activityType]) {
      return { success: false, error: "Invalid activity category selected." };
    }

    if (!input.activityDate || !/^\d{4}-\d{2}-\d{2}$/.test(input.activityDate)) {
      return { success: false, error: "A valid activity date (YYYY-MM-DD) is required." };
    }

    if (input.hasFollowUp) {
      if (!input.followUpDate || !/^\d{4}-\d{2}-\d{2}$/.test(input.followUpDate)) {
        return { success: false, error: "A valid follow-up due date (YYYY-MM-DD) is required when follow-up is scheduled." };
      }
      if (!input.followUpNote || input.followUpNote.trim().length === 0) {
        return { success: false, error: "A follow-up note is required when follow-up is scheduled." };
      }
    }

    // 3. Verify Store Existence and resolve company_id
    const { data: store, error: storeErr } = await adminClient
      .from("stores")
      .select("id, company_id")
      .eq("id", input.storeId)
      .maybeSingle();

    if (storeErr || !store) {
      return { success: false, error: "Target store not found or access denied." };
    }

    const companyId = store.company_id;
    const authorAdminName =
      input.responsibleAdminName?.trim() ||
      session.email?.split("@")[0] ||
      "Admin";

    // 4. Insert Record
    const insertPayload = {
      store_id: input.storeId,
      company_id: companyId,
      activity_type: input.activityType,
      title: trimmedTitle,
      description: input.description?.trim() || null,
      activity_date: input.activityDate,
      responsible_admin_id: input.responsibleAdminId || session.userId,
      responsible_admin_name: authorAdminName,
      has_follow_up: Boolean(input.hasFollowUp),
      follow_up_date: input.hasFollowUp ? input.followUpDate : null,
      follow_up_status: input.hasFollowUp ? "pending" : "none",
      follow_up_note: input.hasFollowUp ? input.followUpNote?.trim() || null : null,
      completed_at: null,
      completed_by: null,
      metadata: input.metadata || {},
      edit_history: [],
      created_by: session.userId,
    };

    const { data: inserted, error: insertErr } = await adminClient
      .from("store_activities")
      .insert(insertPayload)
      .select("id")
      .single();

    if (insertErr || !inserted) {
      console.error("[createStoreActivityAction] Insert error:", insertErr);
      return { success: false, error: insertErr?.message || "Failed to create store activity." };
    }

    revalidatePath("/admin/store-operations");
    return { success: true, activityId: inserted.id };
  } catch (err: any) {
    console.error("[createStoreActivityAction] Unexpected exception:", err);
    return { success: false, error: err?.message || "Internal server error." };
  }
}

/**
 * Updates an existing Store Activity and appends to the audit edit history.
 */
export async function updateStoreActivityAction(
  input: UpdateStoreActivityInput
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await verifyAdminSession();
    if (!session || !session.userId) {
      return { success: false, error: "Unauthorized: Admin session required." };
    }

    const adminClient = createAdminClient();

    // 1. Feature Gate Check
    const tableAvailable = await isStoreActivitiesTableAvailable(adminClient);
    if (!tableAvailable) {
      return { success: false, error: MIGRATION_PENDING_ERROR };
    }

    // 2. Fetch Existing Activity
    const { data: existing, error: fetchErr } = await adminClient
      .from("store_activities")
      .select("*")
      .eq("id", input.activityId)
      .maybeSingle();

    if (fetchErr || !existing) {
      return { success: false, error: "Activity record not found." };
    }

    // 3. Validate Updates
    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    const changedFields: string[] = [];

    if (input.title !== undefined) {
      const trimmed = input.title.trim();
      if (trimmed.length < 3 || trimmed.length > 200) {
        return { success: false, error: "Activity title must be between 3 and 200 characters." };
      }
      if (trimmed !== existing.title) {
        updates.title = trimmed;
        changedFields.push("title");
      }
    }

    if (input.activityType !== undefined) {
      if (!ACTIVITY_TYPE_CONFIGS[input.activityType]) {
        return { success: false, error: "Invalid activity category selected." };
      }
      if (input.activityType !== existing.activity_type) {
        updates.activity_type = input.activityType;
        changedFields.push("activity_type");
      }
    }

    if (input.description !== undefined) {
      const desc = input.description?.trim() || null;
      if (desc !== existing.description) {
        updates.description = desc;
        changedFields.push("description");
      }
    }

    if (input.activityDate !== undefined) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(input.activityDate)) {
        return { success: false, error: "Valid activity date (YYYY-MM-DD) is required." };
      }
      if (input.activityDate !== existing.activity_date) {
        updates.activity_date = input.activityDate;
        changedFields.push("activity_date");
      }
    }

    if (input.hasFollowUp !== undefined) {
      if (input.hasFollowUp !== existing.has_follow_up) {
        updates.has_follow_up = input.hasFollowUp;
        changedFields.push("has_follow_up");
        if (input.hasFollowUp) {
          if (!input.followUpDate) return { success: false, error: "Follow-up due date is required." };
          if (!input.followUpNote) return { success: false, error: "Follow-up note is required." };
          updates.follow_up_date = input.followUpDate;
          updates.follow_up_note = input.followUpNote.trim();
          if (existing.follow_up_status === "none") updates.follow_up_status = "pending";
        } else {
          updates.follow_up_status = "none";
          updates.follow_up_date = null;
          updates.follow_up_note = null;
        }
      }
    }

    if (changedFields.length === 0) {
      return { success: true };
    }

    // 4. Append to edit_history
    const adminName = session.email?.split("@")[0] || "Admin";

    const editHistory = Array.isArray(existing.edit_history) ? [...existing.edit_history] : [];
    editHistory.push({
      timestamp: new Date().toISOString(),
      adminId: session.userId,
      adminName,
      changedFields,
    });
    updates.edit_history = editHistory;

    const { error: updateErr } = await adminClient
      .from("store_activities")
      .update(updates)
      .eq("id", input.activityId);

    if (updateErr) {
      console.error("[updateStoreActivityAction] Update error:", updateErr);
      return { success: false, error: updateErr.message || "Failed to update activity." };
    }

    revalidatePath("/admin/store-operations");
    return { success: true };
  } catch (err: any) {
    console.error("[updateStoreActivityAction] Exception:", err);
    return { success: false, error: err?.message || "Internal server error." };
  }
}

/**
 * 1-Click complete action for a scheduled follow-up.
 */
export async function completeStoreFollowUpAction(
  activityId: string,
  completionNote?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await verifyAdminSession();
    if (!session || !session.userId) {
      return { success: false, error: "Unauthorized: Admin session required." };
    }

    const adminClient = createAdminClient();

    const tableAvailable = await isStoreActivitiesTableAvailable(adminClient);
    if (!tableAvailable) {
      return { success: false, error: MIGRATION_PENDING_ERROR };
    }

    const { data: existing, error: fetchErr } = await adminClient
      .from("store_activities")
      .select("id, follow_up_note, edit_history")
      .eq("id", activityId)
      .maybeSingle();

    if (fetchErr || !existing) {
      return { success: false, error: "Activity record not found." };
    }

    const adminName = session.email?.split("@")[0] || "Admin";
    const nowIso = new Date().toISOString();

    let updatedNote = existing.follow_up_note || "";
    if (completionNote && completionNote.trim()) {
      updatedNote += ` [Completed on ${nowIso.split("T")[0]}: ${completionNote.trim()}]`;
    }

    const editHistory = Array.isArray(existing.edit_history) ? [...existing.edit_history] : [];
    editHistory.push({
      timestamp: nowIso,
      adminId: session.userId,
      adminName,
      changedFields: ["follow_up_status", "completed_at", "completed_by"],
    });

    const { error: updateErr } = await adminClient
      .from("store_activities")
      .update({
        follow_up_status: "completed",
        completed_at: nowIso,
        completed_by: session.userId,
        follow_up_note: updatedNote,
        edit_history: editHistory,
        updated_at: nowIso,
      })
      .eq("id", activityId);

    if (updateErr) {
      return { success: false, error: updateErr.message || "Failed to complete follow-up." };
    }

    revalidatePath("/admin/store-operations");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Internal server error." };
  }
}

/**
 * Reopens a completed follow-up back to pending.
 */
export async function reopenStoreFollowUpAction(
  activityId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await verifyAdminSession();
    if (!session || !session.userId) {
      return { success: false, error: "Unauthorized: Admin session required." };
    }

    const adminClient = createAdminClient();

    const tableAvailable = await isStoreActivitiesTableAvailable(adminClient);
    if (!tableAvailable) {
      return { success: false, error: MIGRATION_PENDING_ERROR };
    }

    const { data: existing, error: fetchErr } = await adminClient
      .from("store_activities")
      .select("id, edit_history")
      .eq("id", activityId)
      .maybeSingle();

    if (fetchErr || !existing) {
      return { success: false, error: "Activity record not found." };
    }

    const adminName = session.email?.split("@")[0] || "Admin";
    const nowIso = new Date().toISOString();

    const editHistory = Array.isArray(existing.edit_history) ? [...existing.edit_history] : [];
    editHistory.push({
      timestamp: nowIso,
      adminId: session.userId,
      adminName,
      changedFields: ["follow_up_status (reopened)"],
    });

    const { error: updateErr } = await adminClient
      .from("store_activities")
      .update({
        follow_up_status: "pending",
        completed_at: null,
        completed_by: null,
        edit_history: editHistory,
        updated_at: nowIso,
      })
      .eq("id", activityId);

    if (updateErr) {
      return { success: false, error: updateErr.message || "Failed to reopen follow-up." };
    }

    revalidatePath("/admin/store-operations");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Internal server error." };
  }
}
