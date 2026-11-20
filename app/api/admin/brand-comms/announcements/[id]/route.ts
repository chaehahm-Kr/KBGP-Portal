import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminApiSession } from "@/lib/insights/admin-auth";
import {
  isValidAnnouncementCategory,
  isValidAnnouncementPriority,
  isValidAudienceMode,
} from "@/lib/brand-comms/types";
import {
  BRAND_COMMS_STORAGE_BUCKET,
  isValidBrandCommsStoragePath,
} from "@/lib/brand-comms/file-validation";
import { recordBrandCommsAudit } from "@/lib/brand-comms/audit";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApiSession();
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const adminDb = createAdminClient();

  const [annRes, targetsRes, linksRes, auditRes] = await Promise.all([
    adminDb.from("brand_announcements").select("*").eq("id", id).maybeSingle(),
    adminDb
      .from("brand_announcement_targets")
      .select("company_id")
      .eq("announcement_id", id),
    adminDb
      .from("brand_announcement_resources")
      .select("resource_id, sort_order")
      .eq("announcement_id", id)
      .order("sort_order", { ascending: true }),
    adminDb
      .from("brand_comms_audit_logs")
      .select("*")
      .eq("entity_type", "ANNOUNCEMENT")
      .eq("entity_id", id)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  if (annRes.error || !annRes.data) {
    return NextResponse.json({ error: "Announcement not found." }, { status: 404 });
  }

  return NextResponse.json({
    announcement: {
      ...annRes.data,
      target_company_ids: (targetsRes.data || []).map((t: any) => t.company_id),
      related_resource_ids: (linksRes.data || []).map((l: any) => l.resource_id),
    },
    audit_logs: auditRes.data || [],
  });
}

export async function PUT(
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
    const updatePayload: Record<string, any> = {
      updated_by: auth.userId,
      updated_at: new Date().toISOString(),
    };

    if (typeof body.title_ko === "string" && body.title_ko.trim()) {
      updatePayload.title_ko = body.title_ko.trim();
    }
    if (body.title_en !== undefined) {
      updatePayload.title_en = body.title_en ? String(body.title_en).trim() : null;
    }
    if (typeof body.body_ko === "string" && body.body_ko.trim()) {
      updatePayload.body_ko = body.body_ko.trim();
    }
    if (body.body_en !== undefined) {
      updatePayload.body_en = body.body_en ? String(body.body_en).trim() : null;
    }
    if (isValidAnnouncementCategory(body.category)) {
      updatePayload.category = body.category;
    }
    if (isValidAnnouncementPriority(body.priority)) {
      updatePayload.priority = body.priority;
    }
    if (typeof body.is_pinned === "boolean") {
      updatePayload.is_pinned = body.is_pinned;
    }
    if (typeof body.notification_enabled === "boolean") {
      updatePayload.notification_enabled = body.notification_enabled;
    }
    if (body.related_insight_id !== undefined) {
      updatePayload.related_insight_id = body.related_insight_id || null;
    }
    if (body.related_insight_slug !== undefined) {
      updatePayload.related_insight_slug = body.related_insight_slug || null;
    }
    if (typeof body.author_name === "string" && body.author_name.trim()) {
      updatePayload.author_name = body.author_name.trim();
    }

    const nextAudienceMode = isValidAudienceMode(body.audience_mode)
      ? body.audience_mode
      : existing.audience_mode;
    updatePayload.audience_mode = nextAudienceMode;

    const targetCompanyIds: string[] | null = Array.isArray(body.target_company_ids)
      ? Array.from(
          new Set(body.target_company_ids.filter((v: any) => typeof v === "string" && v.trim()))
        )
      : null;

    if (nextAudienceMode === "SELECTED_COMPANIES" && targetCompanyIds && targetCompanyIds.length === 0) {
      return NextResponse.json(
        { error: "특정 기업 대상 공지는 최소 1개 이상의 기업을 선택해야 합니다." },
        { status: 400 }
      );
    }

    // Editing an already-published announcement NEVER sends repeat notifications!
    const { data: updated, error: updateErr } = await adminDb
      .from("brand_announcements")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (updateErr || !updated) {
      return NextResponse.json({ error: updateErr?.message || "업데이트 실패" }, { status: 500 });
    }

    let finalTargets: string[] = [];
    if (nextAudienceMode === "ALL_COMPANIES") {
      await adminDb.from("brand_announcement_targets").delete().eq("announcement_id", id);
    } else if (targetCompanyIds !== null) {
      await adminDb.from("brand_announcement_targets").delete().eq("announcement_id", id);
      if (targetCompanyIds.length > 0) {
        await adminDb.from("brand_announcement_targets").insert(
          targetCompanyIds.map((company_id) => ({
            announcement_id: id,
            company_id,
          }))
        );
      }
      finalTargets = targetCompanyIds;
    } else {
      const { data: curTargets } = await adminDb
        .from("brand_announcement_targets")
        .select("company_id")
        .eq("announcement_id", id);
      finalTargets = (curTargets || []).map((t: any) => t.company_id);
    }

    let finalResources: string[] = [];
    if (Array.isArray(body.related_resource_ids)) {
      const cleanRes = Array.from(
        new Set(body.related_resource_ids.filter((v: any) => typeof v === "string" && v.trim()))
      ) as string[];
      await adminDb.from("brand_announcement_resources").delete().eq("announcement_id", id);
      if (cleanRes.length > 0) {
        await adminDb.from("brand_announcement_resources").insert(
          cleanRes.map((resource_id, idx) => ({
            announcement_id: id,
            resource_id,
            sort_order: idx,
          }))
        );
      }
      finalResources = cleanRes;
    } else {
      const { data: curLinks } = await adminDb
        .from("brand_announcement_resources")
        .select("resource_id")
        .eq("announcement_id", id);
      finalResources = (curLinks || []).map((l: any) => l.resource_id);
    }

    const audienceChanged =
      existing.audience_mode !== nextAudienceMode || targetCompanyIds !== null;

    await recordBrandCommsAudit({
      entityType: "ANNOUNCEMENT",
      entityId: id,
      action: audienceChanged ? "AUDIENCE_CHANGE" : "UPDATE",
      actorId: auth.userId,
      actorEmail: auth.email,
      summary: `Updated announcement "${updated.title_ko}" (${updated.status}, ${nextAudienceMode})`,
      metadata: {
        audience_mode: nextAudienceMode,
        target_count: finalTargets.length,
        status: updated.status,
      },
    });

    return NextResponse.json({
      announcement: {
        ...updated,
        target_company_ids: finalTargets,
        related_resource_ids: finalResources,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Invalid request" }, { status: 400 });
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApiSession();
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const adminDb = createAdminClient();

  const { data: existing } = await adminDb
    .from("brand_announcements")
    .select("id, title_ko, attachment_storage_path")
    .eq("id", id)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: "Announcement not found." }, { status: 404 });
  }

  if (isValidBrandCommsStoragePath(existing.attachment_storage_path)) {
    const { data: others } = await adminDb
      .from("brand_announcements")
      .select("id")
      .eq("attachment_storage_path", existing.attachment_storage_path)
      .neq("id", id)
      .limit(1);
    if (!others || others.length === 0) {
      await adminDb.storage
        .from(BRAND_COMMS_STORAGE_BUCKET)
        .remove([existing.attachment_storage_path]);
    }
  }

  const { error } = await adminDb.from("brand_announcements").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await recordBrandCommsAudit({
    entityType: "ANNOUNCEMENT",
    entityId: id,
    action: "DELETE",
    actorId: auth.userId,
    actorEmail: auth.email,
    summary: `Deleted announcement "${existing.title_ko}"`,
  });

  return NextResponse.json({ deleted: true });
}
