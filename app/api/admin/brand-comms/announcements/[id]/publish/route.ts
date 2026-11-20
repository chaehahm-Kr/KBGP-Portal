import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminApiSession } from "@/lib/insights/admin-auth";
import { dispatchBrandCommsNotifications } from "@/lib/brand-comms/notifications";
import { recordBrandCommsAudit } from "@/lib/brand-comms/audit";
import type { AudienceMode } from "@/lib/brand-comms/types";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApiSession();
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const adminDb = createAdminClient();

  const { data: existing, error: fetchErr } = await adminDb
    .from("brand_announcements")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (fetchErr || !existing) {
    return NextResponse.json({ error: "Announcement not found." }, { status: 404 });
  }

  try {
    const body = await req.json();
    const action = String(body.action || "").toUpperCase();

    if (!["PUBLISH", "UNPUBLISH", "ARCHIVE"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action. Expected PUBLISH, UNPUBLISH, or ARCHIVE." },
        { status: 400 }
      );
    }

    const { data: targets } = await adminDb
      .from("brand_announcement_targets")
      .select("company_id")
      .eq("announcement_id", id);
    const targetCompanyIds = (targets || []).map((t: any) => t.company_id);

    if (
      action === "PUBLISH" &&
      existing.audience_mode === "SELECTED_COMPANIES" &&
      targetCompanyIds.length === 0
    ) {
      return NextResponse.json(
        { error: "선택 기업 대상 공지는 최소 1개 이상의 기업이 지정되어야 게시할 수 있습니다." },
        { status: 400 }
      );
    }

    const nowIso = new Date().toISOString();
    const nextStatus =
      action === "PUBLISH" ? "PUBLISHED" : action === "ARCHIVE" ? "ARCHIVED" : "DRAFT";

    const updatePayload: Record<string, any> = {
      status: nextStatus,
      updated_by: auth.userId,
      updated_at: nowIso,
    };

    if (action === "PUBLISH" && !existing.published_at) {
      updatePayload.published_at = nowIso;
    }

    let notificationResult = { dispatchedCount: 0, skippedDuplicates: 0 };

    // Only dispatch notifications on explicit PUBLISH when notification_enabled === true
    // and notification_sent_at is null (idempotent: double check in dispatchBrandCommsNotifications too)
    if (action === "PUBLISH" && existing.notification_enabled && !existing.notification_sent_at) {
      const priorityPrefix =
        existing.priority === "ACTION_REQUIRED"
          ? "[조치 필요] "
          : existing.priority === "IMPORTANT"
          ? "[중요 공지] "
          : "[공지사항] ";

      notificationResult = await dispatchBrandCommsNotifications({
        type: "ANNOUNCEMENT_PUBLISHED",
        entityId: id,
        title: `${priorityPrefix}${existing.title_ko}`,
        content: (existing.body_ko || "").slice(0, 140),
        linkUrl: `/portal/announcements/${id}`,
        audienceMode: existing.audience_mode as AudienceMode,
        targetCompanyIds,
        senderId: auth.userId,
      });

      if (notificationResult.dispatchedCount > 0 || notificationResult.skippedDuplicates > 0) {
        updatePayload.notification_sent_at = nowIso;
      }
    }

    const { data: updated, error: updateErr } = await adminDb
      .from("brand_announcements")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (updateErr || !updated) {
      return NextResponse.json({ error: updateErr?.message || "상태 변경 실패" }, { status: 500 });
    }

    await recordBrandCommsAudit({
      entityType: "ANNOUNCEMENT",
      entityId: id,
      action,
      actorId: auth.userId,
      actorEmail: auth.email,
      summary: `${action} announcement "${updated.title_ko}" (notified: ${notificationResult.dispatchedCount}, skipped dup: ${notificationResult.skippedDuplicates})`,
      metadata: {
        previous_status: existing.status,
        next_status: nextStatus,
        notification_dispatched: notificationResult.dispatchedCount,
        notification_skipped_duplicates: notificationResult.skippedDuplicates,
      },
    });

    revalidatePath("/portal", "layout");
    revalidatePath("/portal/announcements");

    return NextResponse.json({
      announcement: {
        ...updated,
        target_company_ids: targetCompanyIds,
      },
      notifications: notificationResult,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Invalid request" }, { status: 400 });
  }
}
