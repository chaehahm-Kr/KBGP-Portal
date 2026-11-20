import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isCompanyAuthorizedForAudience,
  requirePortalApiCompanyContext,
} from "@/lib/brand-comms/portal-auth";
import { PUBLIC_WEBSITE_BASE_URL } from "@/lib/brand-comms/types";
import { resolveLinkedInsightPdf } from "@/lib/brand-comms/insight-resolver";

export const dynamic = "force-dynamic";

async function loadAuthorizedAnnouncement(id: string, companyId: string) {
  const adminDb = createAdminClient();
  const { data: ann } = await adminDb
    .from("brand_announcements")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!ann) return null;

  const { data: targets } = await adminDb
    .from("brand_announcement_targets")
    .select("company_id")
    .eq("announcement_id", id);

  const authorized = isCompanyAuthorizedForAudience({
    status: ann.status,
    audienceMode: ann.audience_mode,
    targetCompanyIds: (targets || []).map((t: any) => t.company_id),
    companyId,
  });

  if (!authorized) return null;
  return ann;
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const ctx = await requirePortalApiCompanyContext();
  if (!ctx.ok) return ctx.response;

  const { id } = await context.params;
  const ann = await loadAuthorizedAnnouncement(id, ctx.companyId);
  if (!ann) {
    return NextResponse.json({ error: "Announcement not found." }, { status: 404 });
  }

  const adminDb = createAdminClient();

  // Automatically record read state for this user (non-blocking)
  await adminDb.from("brand_announcement_reads").upsert(
    {
      announcement_id: id,
      user_id: ctx.userId,
      company_id: ctx.companyId,
      read_at: new Date().toISOString(),
    },
    { onConflict: "announcement_id,user_id", ignoreDuplicates: true }
  );

  // Load linked Resource Center items authorized for this company
  const { data: linkRows } = await adminDb
    .from("brand_announcement_resources")
    .select("resource_id, sort_order")
    .eq("announcement_id", id)
    .order("sort_order", { ascending: true });

  const linkedResourceIds = (linkRows || []).map((l: any) => l.resource_id);
  const authorizedResources: any[] = [];

  if (linkedResourceIds.length > 0) {
    const [resRows, resTargets] = await Promise.all([
      adminDb
        .from("brand_resources")
        .select("*")
        .in("id", linkedResourceIds)
        .eq("status", "PUBLISHED"),
      adminDb
        .from("brand_resource_targets")
        .select("resource_id, company_id")
        .in("resource_id", linkedResourceIds)
        .eq("company_id", ctx.companyId),
    ]);

    const resTargetSet = new Set((resTargets.data || []).map((t: any) => t.resource_id));
    const resMap = new Map((resRows.data || []).map((r: any) => [r.id, r]));

    for (const rid of linkedResourceIds) {
      const r = resMap.get(rid);
      if (!r) continue;
      const canSee = isCompanyAuthorizedForAudience({
        status: r.status,
        audienceMode: r.audience_mode,
        targetCompanyIds: resTargetSet.has(r.id) ? [ctx.companyId] : [],
        companyId: ctx.companyId,
      });
      if (!canSee) continue;

      let fileName = r.file_name;
      let fileSize = r.file_size;
      if (r.source_type === "LINKED_INSIGHT_PDF" && r.linked_insight_id) {
        const resolved = await resolveLinkedInsightPdf(r.linked_insight_id);
        if (resolved) {
          fileName = resolved.fileName;
          fileSize = resolved.fileSize;
        }
      }

      authorizedResources.push({
        id: r.id,
        title_ko: r.title_ko,
        title_en: r.title_en,
        category: r.category,
        file_type: r.file_type,
        file_name: fileName,
        file_size: fileSize,
        version: r.version,
        download_url: `/api/portal/resources/${r.id}/download`,
      });
    }
  }

  // Optional related public Insight article link
  let relatedInsight: {
    id: string;
    slug: string;
    title_ko: string;
    title_en: string | null;
    public_url: string;
  } | null = null;

  if (ann.related_insight_id) {
    const { data: art } = await adminDb
      .from("insights_articles")
      .select("id, slug, title_ko, title_en, status")
      .eq("id", ann.related_insight_id)
      .maybeSingle();
    if (art && art.slug) {
      relatedInsight = {
        id: art.id,
        slug: art.slug,
        title_ko: art.title_ko,
        title_en: art.title_en,
        public_url: `${PUBLIC_WEBSITE_BASE_URL.replace(/\/$/, "")}/insights/${encodeURIComponent(art.slug)}`,
      };
    }
  } else if (ann.related_insight_slug) {
    relatedInsight = {
      id: "",
      slug: ann.related_insight_slug,
      title_ko: ann.related_insight_slug,
      title_en: ann.related_insight_slug,
      public_url: `${PUBLIC_WEBSITE_BASE_URL.replace(/\/$/, "")}/insights/${encodeURIComponent(ann.related_insight_slug)}`,
    };
  }

  return NextResponse.json(
    {
      announcement: {
        id: ann.id,
        title_ko: ann.title_ko,
        title_en: ann.title_en,
        body_ko: ann.body_ko,
        body_en: ann.body_en,
        category: ann.category,
        priority: ann.priority,
        audience_mode: ann.audience_mode,
        is_pinned: Boolean(ann.is_pinned),
        published_at: ann.published_at || ann.created_at,
        updated_at: ann.updated_at,
        author_name: ann.author_name,
        attachment: ann.attachment_storage_path
          ? {
              file_name: ann.attachment_file_name,
              file_size: ann.attachment_file_size,
              mime_type: ann.attachment_mime_type,
              download_url: `/api/portal/announcements/${ann.id}/attachment`,
            }
          : null,
        related_resources: authorizedResources,
        related_insight: relatedInsight,
        is_read: true,
      },
    },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const ctx = await requirePortalApiCompanyContext();
  if (!ctx.ok) return ctx.response;

  const { id } = await context.params;
  const ann = await loadAuthorizedAnnouncement(id, ctx.companyId);
  if (!ann) {
    return NextResponse.json({ error: "Announcement not found." }, { status: 404 });
  }

  const adminDb = createAdminClient();
  await adminDb.from("brand_announcement_reads").upsert(
    {
      announcement_id: id,
      user_id: ctx.userId,
      company_id: ctx.companyId,
      read_at: new Date().toISOString(),
    },
    { onConflict: "announcement_id,user_id" }
  );

  return NextResponse.json({ read: true });
}
