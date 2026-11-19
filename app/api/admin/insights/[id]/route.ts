import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminApiSession } from "@/lib/insights/admin-auth";
import {
  createInsightPreviewToken,
  extractPdfAttachment,
} from "@/lib/insights/pdf-attachments";

const KNOWN_COLUMNS = new Set([
  "id",
  "title",
  "slug",
  "subtitle",
  "category",
  "content_type",
  "hero_image",
  "excerpt",
  "body_blocks",
  "author",
  "publish_date",
  "sources",
  "sources_detail",
  "source_count",
  "claims",
  "claim_risk_summary",
  "content_layers",
  "research_brief",
  "seo_title",
  "meta_description",
  "status",
  "audience",
  "publish_channels",
  "featured",
  "trending",
  "brand_takeaway",
  "brand_actions",
  "retailer_takeaway",
  "retailer_actions",
  "primary_language",
  "analysis_confidence",
  "topic_score",
  "topic_score_breakdown",
  "critical_conditions",
  "relation_type",
  "related_insight_id",
  "title_ko",
  "title_en",
  "subtitle_ko",
  "subtitle_en",
  "summary_ko",
  "summary_en",
  "body_blocks_ko",
  "body_blocks_en",
  "network_enabled",
  "network_category",
  "network_brand_takeaway_ko",
  "network_brand_takeaway_en",
  "network_brand_actions_ko",
  "network_brand_actions_en",
  "network_implication_ko",
  "network_implication_en",
  "network_cta_ko",
  "network_cta_en",
  "network_publish_status",
  "network_publish_date",
  "hub_enabled",
  "hub_category",
  "hub_retailer_takeaway_ko",
  "hub_retailer_takeaway_en",
  "hub_retailer_actions_ko",
  "hub_retailer_actions_en",
  "hub_checklist_ko",
  "hub_checklist_en",
  "hub_opportunity_ko",
  "hub_opportunity_en",
  "hub_cta_ko",
  "hub_cta_en",
  "hub_publish_status",
  "hub_publish_date",
  "network_suitability",
  "hub_suitability",
  "visuals",
  "visual_status",
  "animation_recommendations",
  "reviewer_id",
  "reviewer_name",
  "generated_date",
  "created_at",
  "updated_at",
]);

function sanitizePayload(raw: Record<string, any>) {
  const cleanPayload: Record<string, any> = {};
  for (const key of Object.keys(raw)) {
    if (KNOWN_COLUMNS.has(key) && raw[key] !== undefined) {
      cleanPayload[key] = raw[key];
    }
  }
  return cleanPayload;
}

function buildPublicSiteBaseUrl(): string {
  return process.env.NEXT_PUBLIC_MARKETING_SITE_URL || "https://www.kselectnetwork.com";
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApiSession();
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const supabase = createAdminClient();

    const { data: rawArticle, error } = await supabase
      .from("insights_articles")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !rawArticle) {
      return NextResponse.json({ error: error?.message || "Insight not found" }, { status: 404 });
    }

    const previewToken = createInsightPreviewToken(rawArticle.id, rawArticle.slug);
    const publicBase = buildPublicSiteBaseUrl();
    const ownerPreviewUrl = previewToken
      ? `${publicBase}/insights/${encodeURIComponent(rawArticle.slug)}?preview=${previewToken}`
      : `${publicBase}/insights/${encodeURIComponent(rawArticle.slug)}`;

    const article = {
      ...rawArticle,
      primary_language: rawArticle.primary_language || "KO",
      analysis_confidence: rawArticle.analysis_confidence || 85,
      topic_score: rawArticle.topic_score || 85,
      topic_score_breakdown: rawArticle.topic_score_breakdown || {
        relevance: 25,
        actionability: 25,
        evidence_strength: 20,
        timeliness: 15,
        originality: 10,
        strategic_fit: 5,
      },
      critical_conditions: rawArticle.critical_conditions || {
        evidence_quality: "PASS",
        duplicate_check: "PASS",
        claim_validation: "PASS",
        audience_relevance: "PASS",
      },
      title_ko: rawArticle.title_ko || rawArticle.title,
      title_en: rawArticle.title_en || "",
      subtitle_ko: rawArticle.subtitle_ko || rawArticle.subtitle,
      subtitle_en: rawArticle.subtitle_en || "",
      summary_ko: rawArticle.summary_ko || rawArticle.excerpt,
      summary_en: rawArticle.summary_en || "",
      body_blocks_ko:
        Array.isArray(rawArticle.body_blocks_ko) && rawArticle.body_blocks_ko.length > 0
          ? rawArticle.body_blocks_ko
          : rawArticle.body_blocks || [],
      body_blocks_en: Array.isArray(rawArticle.body_blocks_en) ? rawArticle.body_blocks_en : [],
      network_enabled: rawArticle.network_enabled !== false,
      network_category: rawArticle.network_category || rawArticle.category,
      network_brand_takeaway_ko:
        rawArticle.network_brand_takeaway_ko || rawArticle.brand_takeaway || "",
      network_brand_takeaway_en: rawArticle.network_brand_takeaway_en || "",
      network_brand_actions_ko:
        Array.isArray(rawArticle.network_brand_actions_ko) &&
        rawArticle.network_brand_actions_ko.length > 0
          ? rawArticle.network_brand_actions_ko
          : rawArticle.brand_actions || [],
      network_brand_actions_en: Array.isArray(rawArticle.network_brand_actions_en)
        ? rawArticle.network_brand_actions_en
        : [],
      network_publish_status: rawArticle.network_publish_status || rawArticle.status,
      hub_enabled: rawArticle.hub_enabled !== false,
      hub_category: rawArticle.hub_category || rawArticle.category,
      hub_retailer_takeaway_ko: rawArticle.hub_retailer_takeaway_ko || "",
      hub_retailer_takeaway_en:
        rawArticle.hub_retailer_takeaway_en || rawArticle.retailer_takeaway || "",
      hub_retailer_actions_ko: Array.isArray(rawArticle.hub_retailer_actions_ko)
        ? rawArticle.hub_retailer_actions_ko
        : [],
      hub_retailer_actions_en:
        Array.isArray(rawArticle.hub_retailer_actions_en) &&
        rawArticle.hub_retailer_actions_en.length > 0
          ? rawArticle.hub_retailer_actions_en
          : rawArticle.retailer_actions || [],
      hub_publish_status: rawArticle.hub_publish_status || rawArticle.status,
      network_suitability: rawArticle.network_suitability || "HIGH",
      hub_suitability: rawArticle.hub_suitability || "HIGH",
      visual_status: rawArticle.visual_status || "APPROVED",
      pdf_attachment: extractPdfAttachment(rawArticle.visuals),
      owner_preview_token: previewToken,
      owner_preview_url: ownerPreviewUrl,
      source_count:
        rawArticle.source_count ||
        (Array.isArray(rawArticle.sources) ? rawArticle.sources.length : 0),
      generated_date: rawArticle.generated_date || rawArticle.created_at,
    };

    let revisions: any[] = [];
    try {
      const { data: revData } = await supabase
        .from("insights_revision_requests")
        .select("*")
        .eq("article_id", id)
        .order("created_at", { ascending: false });
      revisions = revData || [];
    } catch (e) {
      console.warn("Revisions fetch warning:", e);
    }

    let versionHistory: any[] = [];
    try {
      const { data: histData } = await supabase
        .from("insights_version_history")
        .select("*")
        .eq("article_id", id)
        .order("version_number", { ascending: false });
      versionHistory = histData || [];
    } catch (e) {
      console.warn("Version history fetch warning:", e);
    }

    return NextResponse.json({
      article,
      revisions,
      versionHistory,
    });
  } catch (err: any) {
    console.error("GET /api/admin/insights/[id] exception:", err);
    return NextResponse.json(
      { error: err.message || "Failed to fetch insight detail" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApiSession();
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const body = await request.json();
    const supabase = createAdminClient();

    const { data: existing } = await supabase
      .from("insights_articles")
      .select("*")
      .eq("id", id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    const updated_at = new Date().toISOString();
    const nextStatus = body.status || existing.status;
    const nextNetworkEnabled =
      typeof body.network_enabled === "boolean"
        ? body.network_enabled
        : existing.network_enabled !== false;
    const nextHubEnabled =
      typeof body.hub_enabled === "boolean" ? body.hub_enabled : existing.hub_enabled !== false;

    // Keep publish_channels synchronized with enabled channels
    let nextPublishChannels: string[] = Array.isArray(body.publish_channels)
      ? [...body.publish_channels]
      : Array.isArray(existing.publish_channels)
        ? [...existing.publish_channels]
        : ["K_SELECT_NETWORK"];

    if (typeof body.network_enabled === "boolean" || typeof body.hub_enabled === "boolean") {
      const rebuilt: string[] = [];
      if (nextNetworkEnabled) rebuilt.push("K_SELECT_NETWORK");
      if (nextHubEnabled) rebuilt.push("K_SELECT_HUB");
      nextPublishChannels = rebuilt;
    }

    const isPublished = nextStatus === "PUBLISHED";
    const networkInChannels =
      nextPublishChannels.includes("K_SELECT_NETWORK") || nextPublishChannels.includes("NETWORK");
    const hubInChannels =
      nextPublishChannels.includes("K_SELECT_HUB") || nextPublishChannels.includes("HUB");

    const nextNetworkPublishStatus =
      !nextNetworkEnabled || !networkInChannels
        ? "DISABLED"
        : isPublished
          ? "PUBLISHED"
          : nextStatus === "APPROVED"
            ? "APPROVED"
            : "DRAFT";

    const nextHubPublishStatus =
      !nextHubEnabled || !hubInChannels
        ? "DISABLED"
        : isPublished
          ? "PUBLISHED"
          : nextStatus === "APPROVED"
            ? "APPROVED"
            : "DRAFT";

    const fullPayload: Record<string, any> = {
      ...body,
      status: nextStatus,
      network_enabled: nextNetworkEnabled,
      hub_enabled: nextHubEnabled,
      publish_channels: nextPublishChannels,
      network_publish_status: nextNetworkPublishStatus,
      hub_publish_status: nextHubPublishStatus,
      updated_at,
    };

    if (nextStatus === "PUBLISHED" && existing.status !== "PUBLISHED") {
      fullPayload.publish_date = updated_at;
      if (nextNetworkPublishStatus === "PUBLISHED") fullPayload.network_publish_date = updated_at;
      if (nextHubPublishStatus === "PUBLISHED") fullPayload.hub_publish_date = updated_at;
    }

    if (body.title_ko !== undefined || body.title !== undefined) {
      fullPayload.title = body.title_ko || body.title;
    }
    if (body.subtitle_ko !== undefined || body.subtitle !== undefined) {
      fullPayload.subtitle = body.subtitle_ko ?? body.subtitle ?? "";
    }
    if (body.summary_ko !== undefined || body.excerpt !== undefined) {
      fullPayload.excerpt = body.summary_ko ?? body.excerpt ?? "";
    }
    if (Array.isArray(body.body_blocks_ko)) {
      fullPayload.body_blocks = body.body_blocks_ko;
    } else if (Array.isArray(body.body_blocks)) {
      fullPayload.body_blocks_ko = body.body_blocks;
    }
    if (body.network_brand_takeaway_ko !== undefined) {
      fullPayload.brand_takeaway = body.network_brand_takeaway_ko;
    }
    if (Array.isArray(body.network_brand_actions_ko)) {
      fullPayload.brand_actions = body.network_brand_actions_ko;
    }
    if (body.hub_retailer_takeaway_en !== undefined) {
      fullPayload.retailer_takeaway = body.hub_retailer_takeaway_en;
    }
    if (Array.isArray(body.hub_retailer_actions_en)) {
      fullPayload.retailer_actions = body.hub_retailer_actions_en;
    }
    if (Array.isArray(body.sources)) {
      fullPayload.source_count = body.sources.length;
    }

    const cleanPayload = sanitizePayload(fullPayload);

    const { data: updatedArticle, error } = await supabase
      .from("insights_articles")
      .update(cleanPayload)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating insight:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Record audit snapshot in insights_version_history
    try {
      const { data: latestHist } = await supabase
        .from("insights_version_history")
        .select("version_number")
        .eq("article_id", id)
        .order("version_number", { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextVer = (latestHist?.version_number || 0) + 1;
      const changeType =
        existing.status !== nextStatus
          ? `STATUS_${nextStatus}`
          : body.change_type || "EDITOR_MODIFIED";

      await supabase.from("insights_version_history").insert({
        article_id: id,
        version_number: nextVer,
        changed_by: auth.email,
        change_type: changeType,
        review_note:
          body.review_note ||
          (existing.status !== nextStatus
            ? `Status changed from ${existing.status} to ${nextStatus}`
            : "Updated article fields via Admin Insight Editor"),
        snapshot: updatedArticle,
      });
    } catch (histErr) {
      console.warn("Insights version history insert warning:", histErr);
    }

    return NextResponse.json({ article: updatedArticle });
  } catch (err: any) {
    console.error("PUT /api/admin/insights/[id] exception:", err);
    return NextResponse.json(
      { error: err.message || "Failed to update insight" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApiSession();
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const supabase = createAdminClient();

    const { data: archivedArticle, error } = await supabase
      .from("insights_articles")
      .update({
        status: "ARCHIVED",
        network_publish_status: "DISABLED",
        hub_publish_status: "DISABLED",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, article: archivedArticle });
  } catch (err: any) {
    console.error("DELETE /api/admin/insights/[id] exception:", err);
    return NextResponse.json(
      { error: err.message || "Failed to archive insight" },
      { status: 500 }
    );
  }
}
