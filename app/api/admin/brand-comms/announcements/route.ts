import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminApiSession } from "@/lib/insights/admin-auth";
import {
  isValidAnnouncementCategory,
  isValidAnnouncementPriority,
  isValidAudienceMode,
} from "@/lib/brand-comms/types";
import { recordBrandCommsAudit } from "@/lib/brand-comms/audit";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAdminApiSession();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const category = searchParams.get("category");
  const priority = searchParams.get("priority");
  const audience = searchParams.get("audience");
  const q = (searchParams.get("q") || "").trim().toLowerCase();

  const adminDb = createAdminClient();
  let query = adminDb
    .from("brand_announcements")
    .select("*")
    .order("is_pinned", { ascending: false })
    .order("updated_at", { ascending: false });

  if (status && status !== "ALL") query = query.eq("status", status);
  if (category && category !== "ALL") query = query.eq("category", category);
  if (priority && priority !== "ALL") query = query.eq("priority", priority);
  if (audience && audience !== "ALL") query = query.eq("audience_mode", audience);

  const { data: rows, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let announcements = rows || [];
  if (q) {
    announcements = announcements.filter(
      (a: any) =>
        (a.title_ko || "").toLowerCase().includes(q) ||
        (a.title_en || "").toLowerCase().includes(q) ||
        (a.body_ko || "").toLowerCase().includes(q) ||
        (a.body_en || "").toLowerCase().includes(q)
    );
  }

  const ids = announcements.map((a: any) => a.id);
  const targetMap = new Map<string, string[]>();
  const resourceMap = new Map<string, string[]>();
  const readCountMap = new Map<string, number>();

  if (ids.length > 0) {
    const [targetsRes, linksRes, readsRes] = await Promise.all([
      adminDb
        .from("brand_announcement_targets")
        .select("announcement_id, company_id")
        .in("announcement_id", ids),
      adminDb
        .from("brand_announcement_resources")
        .select("announcement_id, resource_id, sort_order")
        .in("announcement_id", ids)
        .order("sort_order", { ascending: true }),
      adminDb
        .from("brand_announcement_reads")
        .select("announcement_id")
        .in("announcement_id", ids),
    ]);

    for (const row of targetsRes.data || []) {
      const list = targetMap.get(row.announcement_id) || [];
      list.push(row.company_id);
      targetMap.set(row.announcement_id, list);
    }
    for (const row of linksRes.data || []) {
      const list = resourceMap.get(row.announcement_id) || [];
      list.push(row.resource_id);
      resourceMap.set(row.announcement_id, list);
    }
    for (const row of readsRes.data || []) {
      readCountMap.set(row.announcement_id, (readCountMap.get(row.announcement_id) || 0) + 1);
    }
  }

  const enriched = announcements.map((a: any) => ({
    ...a,
    target_company_ids: targetMap.get(a.id) || [],
    related_resource_ids: resourceMap.get(a.id) || [],
    read_count: readCountMap.get(a.id) || 0,
  }));

  return NextResponse.json({ announcements: enriched });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminApiSession();
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const titleKo = String(body.title_ko || "").trim();
    const bodyKo = String(body.body_ko || "").trim();
    if (!titleKo || !bodyKo) {
      return NextResponse.json(
        { error: "한국어 제목(title_ko)과 본문(body_ko)은 필수입니다." },
        { status: 400 }
      );
    }

    const category = isValidAnnouncementCategory(body.category) ? body.category : "GENERAL";
    const priority = isValidAnnouncementPriority(body.priority) ? body.priority : "NORMAL";
    const audienceMode = isValidAudienceMode(body.audience_mode)
      ? body.audience_mode
      : "ALL_COMPANIES";

    const targetCompanyIds: string[] = Array.isArray(body.target_company_ids)
      ? Array.from(new Set(body.target_company_ids.filter((v: any) => typeof v === "string" && v.trim())))
      : [];

    if (audienceMode === "SELECTED_COMPANIES" && targetCompanyIds.length === 0) {
      return NextResponse.json(
        { error: "특정 기업 대상 공지는 최소 1개 이상의 기업을 선택해야 합니다." },
        { status: 400 }
      );
    }

    const relatedResourceIds: string[] = Array.isArray(body.related_resource_ids)
      ? Array.from(new Set(body.related_resource_ids.filter((v: any) => typeof v === "string" && v.trim())))
      : [];

    const adminDb = createAdminClient();

    // Always create as DRAFT — publishing requires explicit publish endpoint
    const insertPayload = {
      title_ko: titleKo,
      title_en: body.title_en ? String(body.title_en).trim() : null,
      body_ko: bodyKo,
      body_en: body.body_en ? String(body.body_en).trim() : null,
      category,
      priority,
      audience_mode: audienceMode,
      is_pinned: Boolean(body.is_pinned),
      notification_enabled:
        typeof body.notification_enabled === "boolean" ? body.notification_enabled : true,
      status: "DRAFT",
      related_insight_id: body.related_insight_id || null,
      related_insight_slug: body.related_insight_slug || null,
      author_name: String(body.author_name || auth.email || "K SELECT Operations").trim(),
      created_by: auth.userId,
      updated_by: auth.userId,
    };

    const { data: created, error } = await adminDb
      .from("brand_announcements")
      .insert(insertPayload)
      .select()
      .single();

    if (error || !created) {
      return NextResponse.json({ error: error?.message || "공지 생성 실패" }, { status: 500 });
    }

    if (audienceMode === "SELECTED_COMPANIES" && targetCompanyIds.length > 0) {
      await adminDb.from("brand_announcement_targets").insert(
        targetCompanyIds.map((company_id) => ({
          announcement_id: created.id,
          company_id,
        }))
      );
    }

    if (relatedResourceIds.length > 0) {
      await adminDb.from("brand_announcement_resources").insert(
        relatedResourceIds.map((resource_id, idx) => ({
          announcement_id: created.id,
          resource_id,
          sort_order: idx,
        }))
      );
    }

    await recordBrandCommsAudit({
      entityType: "ANNOUNCEMENT",
      entityId: created.id,
      action: "CREATE",
      actorId: auth.userId,
      actorEmail: auth.email,
      summary: `Created DRAFT announcement "${titleKo}" (${audienceMode})`,
      metadata: {
        category,
        priority,
        audience_mode: audienceMode,
        target_count: targetCompanyIds.length,
        related_resource_count: relatedResourceIds.length,
      },
    });

    return NextResponse.json(
      {
        announcement: {
          ...created,
          target_company_ids: audienceMode === "SELECTED_COMPANIES" ? targetCompanyIds : [],
          related_resource_ids: relatedResourceIds,
          read_count: 0,
        },
      },
      { status: 201 }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Invalid request" }, { status: 400 });
  }
}
