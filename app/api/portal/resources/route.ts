import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isCompanyAuthorizedForAudience,
  requirePortalApiCompanyContext,
} from "@/lib/brand-comms/portal-auth";
import { resolveLinkedInsightPdf } from "@/lib/brand-comms/insight-resolver";
import { PUBLIC_WEBSITE_BASE_URL } from "@/lib/brand-comms/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const ctx = await requirePortalApiCompanyContext();
  if (!ctx.ok) return ctx.response;

  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const q = (searchParams.get("q") || "").trim().toLowerCase();

  const adminDb = createAdminClient();
  const [resRows, targetsRes] = await Promise.all([
    adminDb
      .from("brand_resources")
      .select(
        "id, title_ko, title_en, description_ko, description_en, category, source_type, linked_insight_id, linked_insight_slug, file_type, file_name, storage_path, mime_type, file_size, page_count, version, language, audience_mode, status, published_at, updated_at"
      )
      .eq("status", "PUBLISHED")
      .order("updated_at", { ascending: false }),
    adminDb
      .from("brand_resource_targets")
      .select("resource_id, company_id")
      .eq("company_id", ctx.companyId),
  ]);

  if (resRows.error) {
    return NextResponse.json({ error: resRows.error.message }, { status: 500 });
  }

  const targetedIds = new Set((targetsRes.data || []).map((t: any) => t.resource_id));

  let visible = (resRows.data || []).filter((r: any) =>
    isCompanyAuthorizedForAudience({
      status: r.status,
      audienceMode: r.audience_mode,
      targetCompanyIds: targetedIds.has(r.id) ? [ctx.companyId] : [],
      companyId: ctx.companyId,
    })
  );

  if (category && category !== "ALL") {
    visible = visible.filter((r: any) => r.category === category);
  }

  if (q) {
    visible = visible.filter(
      (r: any) =>
        (r.title_ko || "").toLowerCase().includes(q) ||
        (r.title_en || "").toLowerCase().includes(q) ||
        (r.description_ko || "").toLowerCase().includes(q) ||
        (r.description_en || "").toLowerCase().includes(q) ||
        (r.file_name || "").toLowerCase().includes(q)
    );
  }

  const items = await Promise.all(
    visible.map(async (r: any) => {
      let fileName = r.file_name;
      let fileSize = r.file_size;
      let pageCount = r.page_count;
      let fileAvailable = Boolean(r.storage_path);
      let relatedInsightUrl: string | null = null;

      if (r.source_type === "LINKED_INSIGHT_PDF" && r.linked_insight_id) {
        const resolved = await resolveLinkedInsightPdf(r.linked_insight_id);
        if (resolved) {
          fileName = resolved.fileName;
          fileSize = resolved.fileSize;
          pageCount = resolved.pageCount;
          fileAvailable = true;
          if (resolved.insightStatus === "PUBLISHED") {
            relatedInsightUrl = resolved.publicUrl;
          }
        } else {
          fileAvailable = false;
        }
      } else if (r.linked_insight_slug) {
        relatedInsightUrl = `${PUBLIC_WEBSITE_BASE_URL.replace(/\/$/, "")}/insights/${encodeURIComponent(r.linked_insight_slug)}`;
      }

      // Never expose raw storage_path to the Brand Portal browser!
      return {
        id: r.id,
        title_ko: r.title_ko,
        title_en: r.title_en,
        description_ko: r.description_ko,
        description_en: r.description_en,
        category: r.category,
        source_type: r.source_type,
        file_type: r.file_type,
        file_name: fileName,
        file_size: fileSize,
        page_count: pageCount,
        version: r.version,
        language: r.language,
        audience_mode: r.audience_mode,
        published_at: r.published_at,
        updated_at: r.updated_at,
        file_available: fileAvailable,
        download_url: fileAvailable ? `/api/portal/resources/${r.id}/download` : null,
        related_insight_url: relatedInsightUrl,
      };
    })
  );

  return NextResponse.json(
    {
      company_name: ctx.companyName,
      resources: items,
    },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
