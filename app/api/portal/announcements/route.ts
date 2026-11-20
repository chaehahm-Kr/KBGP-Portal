import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isCompanyAuthorizedForAudience,
  requirePortalApiCompanyContext,
} from "@/lib/brand-comms/portal-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const ctx = await requirePortalApiCompanyContext();
  if (!ctx.ok) return ctx.response;

  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const q = (searchParams.get("q") || "").trim().toLowerCase();

  const adminDb = createAdminClient();

  const [annRes, targetsRes, readsRes, linksRes] = await Promise.all([
    adminDb
      .from("brand_announcements")
      .select(
        "id, title_ko, title_en, body_ko, body_en, category, priority, audience_mode, is_pinned, status, published_at, related_insight_id, related_insight_slug, attachment_file_name, attachment_file_size, attachment_mime_type, author_name, created_at, updated_at"
      )
      .eq("status", "PUBLISHED")
      .order("is_pinned", { ascending: false })
      .order("published_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false }),
    adminDb
      .from("brand_announcement_targets")
      .select("announcement_id, company_id")
      .eq("company_id", ctx.companyId),
    adminDb
      .from("brand_announcement_reads")
      .select("announcement_id, read_at")
      .eq("user_id", ctx.userId),
    adminDb.from("brand_announcement_resources").select("announcement_id, resource_id"),
  ]);

  if (annRes.error) {
    return NextResponse.json({ error: annRes.error.message }, { status: 500 });
  }

  const targetedIds = new Set((targetsRes.data || []).map((t: any) => t.announcement_id));
  const readMap = new Map<string, string>(
    (readsRes.data || []).map((r: any) => [r.announcement_id, r.read_at])
  );
  const resourceCountMap = new Map<string, number>();
  for (const l of linksRes.data || []) {
    resourceCountMap.set(l.announcement_id, (resourceCountMap.get(l.announcement_id) || 0) + 1);
  }

  let visible = (annRes.data || []).filter((a: any) =>
    isCompanyAuthorizedForAudience({
      status: a.status,
      audienceMode: a.audience_mode,
      targetCompanyIds: targetedIds.has(a.id) ? [ctx.companyId] : [],
      companyId: ctx.companyId,
    })
  );

  if (category && category !== "ALL") {
    visible = visible.filter((a: any) => a.category === category);
  }

  if (q) {
    visible = visible.filter(
      (a: any) =>
        (a.title_ko || "").toLowerCase().includes(q) ||
        (a.title_en || "").toLowerCase().includes(q) ||
        (a.body_ko || "").toLowerCase().includes(q) ||
        (a.body_en || "").toLowerCase().includes(q)
    );
  }

  const items = visible.map((a: any) => ({
    id: a.id,
    title_ko: a.title_ko,
    title_en: a.title_en,
    excerpt_ko: (a.body_ko || "").slice(0, 180),
    excerpt_en: a.body_en ? a.body_en.slice(0, 180) : null,
    category: a.category,
    priority: a.priority,
    audience_mode: a.audience_mode,
    is_pinned: Boolean(a.is_pinned),
    published_at: a.published_at || a.created_at,
    updated_at: a.updated_at,
    author_name: a.author_name,
    has_attachment: Boolean(a.attachment_file_name),
    related_resource_count: resourceCountMap.get(a.id) || 0,
    related_insight_slug: a.related_insight_slug || null,
    is_read: readMap.has(a.id),
    read_at: readMap.get(a.id) || null,
  }));

  return NextResponse.json(
    {
      company_name: ctx.companyName,
      announcements: items,
      unread_count: items.filter((i) => !i.is_read).length,
    },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
