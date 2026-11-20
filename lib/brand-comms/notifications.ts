import { createAdminClient } from "@/lib/supabase/admin";
import type { AudienceMode } from "./types";

export type BrandCommsNotificationType =
  | "ANNOUNCEMENT_PUBLISHED"
  | "RESOURCE_PUBLISHED";

/**
 * Dispatches idempotent company-wide notifications into the existing
 * public.notifications table (0146_notifications_tables.sql).
 *
 * Duplicate protection:
 * - Checks existing rows matching (company_id, type, metadata->>entityId).
 * - Never sends emails in Phase 1.
 * - Targets only active brand companies eligible for the audience.
 */
export async function dispatchBrandCommsNotifications(params: {
  type: BrandCommsNotificationType;
  entityId: string;
  title: string;
  content: string;
  linkUrl: string;
  audienceMode: AudienceMode;
  targetCompanyIds: string[];
  senderId: string | null;
}): Promise<{ dispatchedCount: number; skippedDuplicates: number }> {
  const adminDb = createAdminClient();

  let eligibleCompanyIds: string[] = [];

  if (params.audienceMode === "ALL_COMPANIES") {
    const { data: companies, error } = await adminDb
      .from("companies")
      .select("id")
      .eq("status", "active");
    if (error) {
      console.error("[brand-comms/notifications] Failed to load active companies:", error.message);
      return { dispatchedCount: 0, skippedDuplicates: 0 };
    }
    eligibleCompanyIds = (companies || []).map((c: any) => c.id);
  } else {
    const uniqueTargets = Array.from(new Set(params.targetCompanyIds.filter(Boolean)));
    if (uniqueTargets.length === 0) {
      return { dispatchedCount: 0, skippedDuplicates: 0 };
    }
    const { data: companies, error } = await adminDb
      .from("companies")
      .select("id")
      .in("id", uniqueTargets)
      .eq("status", "active");
    if (error) {
      console.error("[brand-comms/notifications] Failed to verify target companies:", error.message);
      return { dispatchedCount: 0, skippedDuplicates: 0 };
    }
    eligibleCompanyIds = (companies || []).map((c: any) => c.id);
  }

  if (eligibleCompanyIds.length === 0) {
    return { dispatchedCount: 0, skippedDuplicates: 0 };
  }

  // Check already-dispatched notifications for this entity + type to prevent duplicates
  const { data: existingRows, error: dupErr } = await adminDb
    .from("notifications")
    .select("company_id")
    .eq("type", params.type)
    .eq("metadata->>entityId", params.entityId)
    .in("company_id", eligibleCompanyIds);

  if (dupErr) {
    console.error("[brand-comms/notifications] Duplicate check failed:", dupErr.message);
    return { dispatchedCount: 0, skippedDuplicates: 0 };
  }

  const alreadyNotified = new Set(
    (existingRows || []).map((r: any) => r.company_id).filter(Boolean)
  );
  const toInsertIds = eligibleCompanyIds.filter((cid) => !alreadyNotified.has(cid));
  const skippedDuplicates = eligibleCompanyIds.length - toInsertIds.length;

  if (toInsertIds.length === 0) {
    return { dispatchedCount: 0, skippedDuplicates };
  }

  const rowsToInsert = toInsertIds.map((companyId) => ({
    company_id: companyId,
    sender_id: params.senderId,
    type: params.type,
    title: params.title.slice(0, 200),
    content: params.content,
    link_url: params.linkUrl,
    is_read: false,
    metadata: {
      entityId: params.entityId,
      entityType: params.type === "ANNOUNCEMENT_PUBLISHED" ? "ANNOUNCEMENT" : "RESOURCE",
      audienceMode: params.audienceMode,
    },
  }));

  const { error: insertErr } = await adminDb.from("notifications").insert(rowsToInsert);
  if (insertErr) {
    console.error("[brand-comms/notifications] Insert failed:", insertErr.message);
    return { dispatchedCount: 0, skippedDuplicates };
  }

  return {
    dispatchedCount: rowsToInsert.length,
    skippedDuplicates,
  };
}
