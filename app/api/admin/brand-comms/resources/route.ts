import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminApiSession } from "@/lib/insights/admin-auth";
import {
  isValidAudienceMode,
  isValidResourceCategory,
} from "@/lib/brand-comms/types";
import { resolveLinkedInsightPdf } from "@/lib/brand-comms/insight-resolver";
import { recordBrandCommsAudit } from "@/lib/brand-comms/audit";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAdminApiSession();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const category = searchParams.get("category");
  const fileType = searchParams.get("fileType");
  const audience = searchParams.get("audience");
  const q = (searchParams.get("q") || "").trim().toLowerCase();

  const adminDb = createAdminClient();
  let query = adminDb
    .from("brand_resources")
    .select("*")
    .order("updated_at", { ascending: false });

  if (status && status !== "ALL") query = query.eq("status", status);
  if (category && category !== "ALL") query = query.eq("category", category);
  if (fileType && fileType !== "ALL") query = query.eq("file_type", fileType);
  if (audience && audience !== "ALL") query = query.eq("audience_mode", audience);

  const { data: rows, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let resources = rows || [];
  if (q) {
    resources = resources.filter(
      (r: any) =>
        (r.title_ko || "").toLowerCase().includes(q) ||
        (r.title_en || "").toLowerCase().includes(q) ||
        (r.description_ko || "").toLowerCase().includes(q) ||
        (r.description_en || "").toLowerCase().includes(q) ||
        (r.file_name || "").toLowerCase().includes(q)
    );
  }

  const ids = resources.map((r: any) => r.id);
  const targetMap = new Map<string, string[]>();
  if (ids.length > 0) {
    const { data: targets } = await adminDb
      .from("brand_resource_targets")
      .select("resource_id, company_id")
      .in("resource_id", ids);
    for (const row of targets || []) {
      const list = targetMap.get(row.resource_id) || [];
      list.push(row.company_id);
      targetMap.set(row.resource_id, list);
    }
  }

  const enriched = await Promise.all(
    resources.map(async (r: any) => {
      if (r.source_type === "LINKED_INSIGHT_PDF" && r.linked_insight_id) {
        const resolved = await resolveLinkedInsightPdf(r.linked_insight_id);
        return {
          ...r,
          target_company_ids: targetMap.get(r.id) || [],
          linked_insight_slug: resolved?.slug || r.linked_insight_slug,
          file_name: resolved?.fileName || r.file_name,
          file_size: resolved?.fileSize || r.file_size,
          file_sha256: resolved?.sha256 || r.file_sha256,
          page_count: resolved?.pageCount || r.page_count,
          resolved_file_available: Boolean(resolved),
        };
      }
      return {
        ...r,
        target_company_ids: targetMap.get(r.id) || [],
        resolved_file_available: Boolean(r.storage_path),
      };
    })
  );

  return NextResponse.json({ resources: enriched });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminApiSession();
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const titleKo = String(body.title_ko || "").trim();
    if (!titleKo) {
      return NextResponse.json(
        { error: "한국어 자료 제목(title_ko)은 필수입니다." },
        { status: 400 }
      );
    }

    const category = isValidResourceCategory(body.category) ? body.category : "FDA_COMPLIANCE";
    const audienceMode = isValidAudienceMode(body.audience_mode)
      ? body.audience_mode
      : "ALL_COMPANIES";
    const sourceType =
      body.source_type === "LINKED_INSIGHT_PDF" ? "LINKED_INSIGHT_PDF" : "UPLOADED_FILE";
    const language = ["KO", "EN", "KO_EN"].includes(body.language) ? body.language : "KO";
    const version = String(body.version || "v1.0").trim() || "v1.0";

    const targetCompanyIds: string[] = Array.isArray(body.target_company_ids)
      ? Array.from(
          new Set(body.target_company_ids.filter((v: any) => typeof v === "string" && v.trim()))
        )
      : [];

    if (audienceMode === "SELECTED_COMPANIES" && targetCompanyIds.length === 0) {
      return NextResponse.json(
        { error: "특정 기업 대상 자료는 최소 1개 이상의 기업을 선택해야 합니다." },
        { status: 400 }
      );
    }

    let linkedInsightId: string | null = body.linked_insight_id || null;
    let linkedInsightSlug: string | null = body.linked_insight_slug || null;
    let fileType: "PDF" | "XLSX" | "DOCX" = ["PDF", "XLSX", "DOCX"].includes(body.file_type)
      ? body.file_type
      : "PDF";
    let fileName: string | null = null;
    let mimeType: string | null = null;
    let fileSize: number | null = null;
    let fileSha256: string | null = null;
    let pageCount: number | null = null;

    if (sourceType === "LINKED_INSIGHT_PDF") {
      if (!linkedInsightId) {
        return NextResponse.json(
          { error: "기존 Insights PDF 연결 시 linked_insight_id가 필요합니다." },
          { status: 400 }
        );
      }
      const resolved = await resolveLinkedInsightPdf(linkedInsightId);
      if (!resolved) {
        return NextResponse.json(
          { error: "선택한 Insights 기사에 유효한 PDF 첨부파일이 없습니다." },
          { status: 400 }
        );
      }
      linkedInsightSlug = resolved.slug;
      fileType = "PDF";
      fileName = resolved.fileName;
      mimeType = resolved.mimeType;
      fileSize = resolved.fileSize;
      fileSha256 = resolved.sha256;
      pageCount = resolved.pageCount;
    }

    const adminDb = createAdminClient();
    const { data: created, error } = await adminDb
      .from("brand_resources")
      .insert({
        title_ko: titleKo,
        title_en: body.title_en ? String(body.title_en).trim() : null,
        description_ko: body.description_ko ? String(body.description_ko).trim() : null,
        description_en: body.description_en ? String(body.description_en).trim() : null,
        category,
        source_type: sourceType,
        linked_insight_id: linkedInsightId,
        linked_insight_slug: linkedInsightSlug,
        file_type: fileType,
        file_name: fileName,
        storage_path: null,
        mime_type: mimeType,
        file_size: fileSize,
        file_sha256: fileSha256,
        page_count: pageCount,
        version,
        language,
        audience_mode: audienceMode,
        notification_enabled: Boolean(body.notification_enabled),
        status: "DRAFT",
        created_by: auth.userId,
        updated_by: auth.userId,
      })
      .select()
      .single();

    if (error || !created) {
      return NextResponse.json({ error: error?.message || "자료 생성 실패" }, { status: 500 });
    }

    if (audienceMode === "SELECTED_COMPANIES" && targetCompanyIds.length > 0) {
      await adminDb.from("brand_resource_targets").insert(
        targetCompanyIds.map((company_id) => ({
          resource_id: created.id,
          company_id,
        }))
      );
    }

    await recordBrandCommsAudit({
      entityType: "RESOURCE",
      entityId: created.id,
      action: "CREATE",
      actorId: auth.userId,
      actorEmail: auth.email,
      summary: `Created DRAFT resource "${titleKo}" (${sourceType}, ${audienceMode})`,
      metadata: {
        category,
        source_type: sourceType,
        linked_insight_id: linkedInsightId,
        audience_mode: audienceMode,
        target_count: targetCompanyIds.length,
      },
    });

    return NextResponse.json(
      {
        resource: {
          ...created,
          target_company_ids: audienceMode === "SELECTED_COMPANIES" ? targetCompanyIds : [],
          resolved_file_available: sourceType === "LINKED_INSIGHT_PDF",
        },
      },
      { status: 201 }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Invalid request" }, { status: 400 });
  }
}
