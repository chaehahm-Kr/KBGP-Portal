import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminApiSession } from "@/lib/insights/admin-auth";
import { resolveLinkedInsightPdf } from "@/lib/brand-comms/insight-resolver";
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

  const { data: existing } = await adminDb
    .from("brand_resources")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: "Resource not found." }, { status: 404 });
  }

  try {
    const body = await req.json();
    const action = String(body.action || "").toUpperCase();
    const sendNotification =
      typeof body.send_notification === "boolean"
        ? body.send_notification
        : Boolean(existing.notification_enabled);

    if (!["PUBLISH", "UNPUBLISH", "ARCHIVE"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action. Expected PUBLISH, UNPUBLISH, or ARCHIVE." },
        { status: 400 }
      );
    }

    const { data: targets } = await adminDb
      .from("brand_resource_targets")
      .select("company_id")
      .eq("resource_id", id);
    const targetCompanyIds = (targets || []).map((t: any) => t.company_id);

    if (action === "PUBLISH") {
      if (existing.audience_mode === "SELECTED_COMPANIES" && targetCompanyIds.length === 0) {
        return NextResponse.json(
          { error: "특정 기업 대상 자료는 최소 1개 이상의 기업이 지정되어야 게시할 수 있습니다." },
          { status: 400 }
        );
      }
      if (existing.source_type === "LINKED_INSIGHT_PDF") {
        const resolved = await resolveLinkedInsightPdf(existing.linked_insight_id);
        if (!resolved) {
          return NextResponse.json(
            { error: "연결된 Insights PDF 첨부파일이 없어 게시할 수 없습니다." },
            { status: 400 }
          );
        }
      } else if (!existing.storage_path) {
        return NextResponse.json(
          { error: "파일을 먼저 업로드한 뒤 게시할 수 있습니다." },
          { status: 400 }
        );
      }
    }

    const nowIso = new Date().toISOString();
    const nextStatus =
      action === "PUBLISH" ? "PUBLISHED" : action === "ARCHIVE" ? "ARCHIVED" : "DRAFT";

    const updatePayload: Record<string, any> = {
      status: nextStatus,
      notification_enabled: sendNotification,
      updated_by: auth.userId,
      updated_at: nowIso,
    };

    if (action === "PUBLISH" && !existing.published_at) {
      updatePayload.published_at = nowIso;
    }

    let notificationResult = { dispatchedCount: 0, skippedDuplicates: 0 };

    if (action === "PUBLISH" && sendNotification && !existing.notification_sent_at) {
      notificationResult = await dispatchBrandCommsNotifications({
        type: "RESOURCE_PUBLISHED",
        entityId: id,
        title: `[자료실 신규 등록] ${existing.title_ko}`,
        content: (existing.description_ko || existing.file_name || "새 자료가 자료실에 등록되었습니다.").slice(0, 140),
        linkUrl: `/portal/resources?highlight=${id}`,
        audienceMode: existing.audience_mode as AudienceMode,
        targetCompanyIds,
        senderId: auth.userId,
      });

      if (notificationResult.dispatchedCount > 0 || notificationResult.skippedDuplicates > 0) {
        updatePayload.notification_sent_at = nowIso;
      }
    }

    const { data: updated, error: updateErr } = await adminDb
      .from("brand_resources")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (updateErr || !updated) {
      return NextResponse.json({ error: updateErr?.message || "상태 변경 실패" }, { status: 500 });
    }

    await recordBrandCommsAudit({
      entityType: "RESOURCE",
      entityId: id,
      action,
      actorId: auth.userId,
      actorEmail: auth.email,
      summary: `${action} resource "${updated.title_ko}" (notified: ${notificationResult.dispatchedCount})`,
      metadata: {
        previous_status: existing.status,
        next_status: nextStatus,
        notification_dispatched: notificationResult.dispatchedCount,
      },
    });

    revalidatePath("/portal", "layout");
    revalidatePath("/portal/resources");

    return NextResponse.json({
      resource: {
        ...updated,
        target_company_ids: targetCompanyIds,
      },
      notifications: notificationResult,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Invalid request" }, { status: 400 });
  }
}
