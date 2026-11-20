import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminApiSession } from "@/lib/insights/admin-auth";
import {
  isValidAudienceMode,
  isValidResourceCategory,
} from "@/lib/brand-comms/types";
import {
  BRAND_COMMS_STORAGE_BUCKET,
  isValidBrandCommsStoragePath,
} from "@/lib/brand-comms/file-validation";
import { resolveLinkedInsightPdf } from "@/lib/brand-comms/insight-resolver";
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

  const [resRow, targetsRes, auditRes] = await Promise.all([
    adminDb.from("brand_resources").select("*").eq("id", id).maybeSingle(),
    adminDb.from("brand_resource_targets").select("company_id").eq("resource_id", id),
    adminDb
      .from("brand_comms_audit_logs")
      .select("*")
      .eq("entity_type", "RESOURCE")
      .eq("entity_id", id)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  if (resRow.error || !resRow.data) {
    return NextResponse.json({ error: "Resource not found." }, { status: 404 });
  }

  return NextResponse.json({
    resource: {
      ...resRow.data,
      target_company_ids: (targetsRes.data || []).map((t: any) => t.company_id),
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
    if (body.description_ko !== undefined) {
      updatePayload.description_ko = body.description_ko ? String(body.description_ko).trim() : null;
    }
    if (body.description_en !== undefined) {
      updatePayload.description_en = body.description_en ? String(body.description_en).trim() : null;
    }
    if (isValidResourceCategory(body.category)) {
      updatePayload.category = body.category;
    }
    if (typeof body.version === "string" && body.version.trim()) {
      updatePayload.version = body.version.trim();
    }
    if (["KO", "EN", "KO_EN"].includes(body.language)) {
      updatePayload.language = body.language;
    }
    if (typeof body.notification_enabled === "boolean") {
      updatePayload.notification_enabled = body.notification_enabled;
    }

    if (body.source_type === "LINKED_INSIGHT_PDF" && body.linked_insight_id) {
      const resolved = await resolveLinkedInsightPdf(body.linked_insight_id);
      if (!resolved) {
        return NextResponse.json(
          { error: "선택한 Insights 기사에 유효한 PDF 첨부파일이 없습니다." },
          { status: 400 }
        );
      }
      updatePayload.source_type = "LINKED_INSIGHT_PDF";
      updatePayload.linked_insight_id = resolved.insightId;
      updatePayload.linked_insight_slug = resolved.slug;
      updatePayload.file_type = "PDF";
      updatePayload.file_name = resolved.fileName;
      updatePayload.mime_type = resolved.mimeType;
      updatePayload.file_size = resolved.fileSize;
      updatePayload.file_sha256 = resolved.sha256;
      updatePayload.page_count = resolved.pageCount;
      updatePayload.storage_path = null;
    } else if (body.linked_insight_id !== undefined) {
      updatePayload.linked_insight_id = body.linked_insight_id || null;
      updatePayload.linked_insight_slug = body.linked_insight_slug || null;
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
        { error: "특정 기업 대상 자료는 최소 1개 이상의 기업을 선택해야 합니다." },
        { status: 400 }
      );
    }

    const { data: updated, error: updateErr } = await adminDb
      .from("brand_resources")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (updateErr || !updated) {
      return NextResponse.json({ error: updateErr?.message || "업데이트 실패" }, { status: 500 });
    }

    let finalTargets: string[] = [];
    if (nextAudienceMode === "ALL_COMPANIES") {
      await adminDb.from("brand_resource_targets").delete().eq("resource_id", id);
    } else if (targetCompanyIds !== null) {
      await adminDb.from("brand_resource_targets").delete().eq("resource_id", id);
      if (targetCompanyIds.length > 0) {
        await adminDb.from("brand_resource_targets").insert(
          targetCompanyIds.map((company_id) => ({
            resource_id: id,
            company_id,
          }))
        );
      }
      finalTargets = targetCompanyIds;
    } else {
      const { data: curTargets } = await adminDb
        .from("brand_resource_targets")
        .select("company_id")
        .eq("resource_id", id);
      finalTargets = (curTargets || []).map((t: any) => t.company_id);
    }

    await recordBrandCommsAudit({
      entityType: "RESOURCE",
      entityId: id,
      action:
        existing.audience_mode !== nextAudienceMode || targetCompanyIds !== null
          ? "AUDIENCE_CHANGE"
          : "UPDATE",
      actorId: auth.userId,
      actorEmail: auth.email,
      summary: `Updated resource "${updated.title_ko}" (${updated.version}, ${nextAudienceMode})`,
      metadata: {
        audience_mode: nextAudienceMode,
        target_count: finalTargets.length,
        version: updated.version,
      },
    });

    return NextResponse.json({
      resource: {
        ...updated,
        target_company_ids: finalTargets,
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
    .from("brand_resources")
    .select("id, title_ko, source_type, storage_path")
    .eq("id", id)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: "Resource not found." }, { status: 404 });
  }

  // Only delete uploaded brand-comms storage files — NEVER delete linked Insights PDFs!
  if (
    existing.source_type === "UPLOADED_FILE" &&
    isValidBrandCommsStoragePath(existing.storage_path)
  ) {
    const { data: others } = await adminDb
      .from("brand_resources")
      .select("id")
      .eq("storage_path", existing.storage_path)
      .neq("id", id)
      .limit(1);
    if (!others || others.length === 0) {
      await adminDb.storage
        .from(BRAND_COMMS_STORAGE_BUCKET)
        .remove([existing.storage_path]);
    }
  }

  const { error } = await adminDb.from("brand_resources").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await recordBrandCommsAudit({
    entityType: "RESOURCE",
    entityId: id,
    action: "DELETE",
    actorId: auth.userId,
    actorEmail: auth.email,
    summary: `Deleted resource "${existing.title_ko}"`,
  });

  return NextResponse.json({ deleted: true });
}
