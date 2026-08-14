import { NextRequest, NextResponse } from "next/server";
import { getAuthorizedKnowledgeList } from "@/lib/knowledge/retrieval";
import { getStoreKnowledgeItems, saveStoreKnowledgeItem } from "@/lib/knowledge/store";
import { logKnowledgeActivity } from "@/lib/knowledge/audit";
import { KnowledgeItem, SecurityUserContext, AudienceType } from "@/lib/knowledge/types";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get("type") || "ALL";
    const audience = searchParams.get("audience") || "ALL";
    const module = searchParams.get("module") || "ALL";
    const status = searchParams.get("status") || "ALL";
    const language = searchParams.get("language") || "ALL";
    const search = searchParams.get("search") || "";
    const sortBy = (searchParams.get("sortBy") as any) || "latest";

    // Default admin context for admin portal endpoints
    const userContext: SecurityUserContext = {
      userId: "admin-user",
      role: "admin"
    };

    const { items, total, suggestionNotice } = await getAuthorizedKnowledgeList(userContext, {
      type,
      audience,
      module,
      status,
      language,
      search,
      sortBy
    });

    const allRawItems = await getStoreKnowledgeItems();

    // Summary Metrics
    const metrics = {
      publishedCount: allRawItems.filter(i => i.status === "PUBLISHED").length,
      draftCount: allRawItems.filter(i => i.status === "DRAFT").length,
      needsReviewCount: allRawItems.filter(i => i.status === "IN_REVIEW").length,
      externalApprovalCount: allRawItems.filter(i => i.external_review_status === "REQUESTED").length,
      outdatedCount: allRawItems.filter(i => i.system_impact_status === "POTENTIALLY_OUTDATED").length,
      totalCount: allRawItems.length
    };

    // Needs Your Attention Items
    const needsAttention = allRawItems.filter(
      i =>
        i.external_review_status === "REQUESTED" ||
        i.system_impact_status === "POTENTIALLY_OUTDATED" ||
        i.status === "IN_REVIEW" ||
        i.is_sensitive_internal
    );

    // Recently Updated Items
    const recentlyUpdated = [...allRawItems]
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 6);

    return NextResponse.json({
      items,
      total,
      suggestionNotice,
      metrics,
      needsAttention,
      recentlyUpdated
    });
  } catch (err: any) {
    console.error("GET /api/admin/knowledge error:", err);
    return NextResponse.json({ error: err.message || "Failed to fetch knowledge items" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const now = new Date().toISOString();
    const today = now.split("T")[0];

    const title = body.title || body.title_ko || "New Knowledge Item";
    const slug = body.slug || `knowledge-${Date.now()}`;
    const type = body.type || "MANUAL";
    const category = body.category || "GENERAL";
    const source_type = body.source_type || "CONTENT";

    // CRITICAL: Default Audience MUST be INTERNAL ONLY if not specified
    const selectedAudience: AudienceType[] = body.audience && Array.isArray(body.audience) && body.audience.length > 0
      ? body.audience
      : ["INTERNAL"];

    // External Publication Guard: Require approval if audience has BRAND, RETAILER, or PUBLIC
    const hasExternalAudience = selectedAudience.some(a =>
      ["BRAND", "RETAILER", "PUBLIC"].includes(a)
    );

    const requires_external_approval = hasExternalAudience;
    const external_review_status = hasExternalAudience ? "REQUESTED" : "NONE";
    const initialStatus = hasExternalAudience ? "IN_REVIEW" : (body.status || "DRAFT");

    const newItem: KnowledgeItem = {
      id: `kno-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      slug,
      title,
      title_ko: body.title_ko || title,
      title_en: body.title_en || "",
      summary_ko: body.summary_ko || "",
      summary_en: body.summary_en || "",
      content_ko: body.content_ko || "",
      content_en: body.content_en || "",
      type,
      source_type,
      linked_system_setting_key: body.linked_system_setting_key || null,
      linked_system_setting_name: body.linked_system_setting_name || null,
      linked_system_setting_value: body.linked_system_setting_value || null,
      category,
      tags: body.tags || [],
      owner_id: body.owner_id || "admin-01",
      owner_name: body.owner_name || "Knowledge Admin",
      status: initialStatus,
      system_impact_status: "NORMAL",
      audience: selectedAudience,
      is_sensitive_internal: Boolean(body.is_sensitive_internal),
      requires_external_approval,
      external_review_status,
      current_version: "v1.0 (Draft)",
      effective_date: body.effective_date || today,
      created_at: now,
      updated_at: now
    };

    await saveStoreKnowledgeItem(newItem);

    await logKnowledgeActivity(
      newItem.id,
      { name: newItem.owner_name },
      "Created",
      {},
      { title: newItem.title, audience: newItem.audience, status: newItem.status },
      hasExternalAudience ? "External publication review requested automatically." : "Initial creation"
    );

    return NextResponse.json({ item: newItem }, { status: 201 });
  } catch (err: any) {
    console.error("POST /api/admin/knowledge error:", err);
    return NextResponse.json({ error: err.message || "Failed to create knowledge item" }, { status: 500 });
  }
}
