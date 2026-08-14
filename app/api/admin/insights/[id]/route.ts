import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const KNOWN_COLUMNS = new Set([
  "id", "title", "slug", "subtitle", "category", "content_type", 
  "hero_image", "excerpt", "body_blocks", "author", "publish_date", 
  "sources", "seo_title", "meta_description", "status", "audience", 
  "publish_channels", "featured", "trending", "brand_takeaway", 
  "brand_actions", "retailer_takeaway", "retailer_actions", 
  "created_at", "updated_at"
]);

function sanitizePayload(raw: Record<string, any>) {
  const cleanPayload: Record<string, any> = {};
  for (const key of Object.keys(raw)) {
    if (KNOWN_COLUMNS.has(key)) {
      cleanPayload[key] = raw[key];
    }
  }
  return cleanPayload;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const article = {
      ...rawArticle,
      primary_language: rawArticle.primary_language || "KO",
      analysis_confidence: rawArticle.analysis_confidence || 85,
      topic_score: rawArticle.topic_score || 85,
      topic_score_breakdown: rawArticle.topic_score_breakdown || {
        relevance: 25, actionability: 25, evidence_strength: 20, timeliness: 15, originality: 10, strategic_fit: 5
      },
      critical_conditions: rawArticle.critical_conditions || {
        evidence_quality: "PASS", duplicate_check: "PASS", claim_validation: "PASS", audience_relevance: "PASS"
      },
      title_ko: rawArticle.title_ko || rawArticle.title,
      title_en: rawArticle.title_en || rawArticle.title,
      subtitle_ko: rawArticle.subtitle_ko || rawArticle.subtitle,
      subtitle_en: rawArticle.subtitle_en || "",
      summary_ko: rawArticle.summary_ko || rawArticle.excerpt,
      summary_en: rawArticle.summary_en || "",
      body_blocks_ko: rawArticle.body_blocks_ko || rawArticle.body_blocks || [],
      body_blocks_en: rawArticle.body_blocks_en || [],
      network_enabled: rawArticle.network_enabled !== false,
      network_category: rawArticle.network_category || rawArticle.category,
      network_brand_takeaway_ko: rawArticle.network_brand_takeaway_ko || rawArticle.brand_takeaway,
      network_brand_takeaway_en: rawArticle.network_brand_takeaway_en || "",
      network_brand_actions_ko: rawArticle.network_brand_actions_ko || rawArticle.brand_actions || [],
      network_brand_actions_en: rawArticle.network_brand_actions_en || [],
      network_publish_status: rawArticle.network_publish_status || rawArticle.status,
      hub_enabled: rawArticle.hub_enabled !== false,
      hub_category: rawArticle.hub_category || rawArticle.category,
      hub_retailer_takeaway_ko: rawArticle.hub_retailer_takeaway_ko || "",
      hub_retailer_takeaway_en: rawArticle.hub_retailer_takeaway_en || rawArticle.retailer_takeaway,
      hub_retailer_actions_ko: rawArticle.hub_retailer_actions_ko || [],
      hub_retailer_actions_en: rawArticle.hub_retailer_actions_en || rawArticle.retailer_actions || [],
      hub_publish_status: rawArticle.hub_publish_status || rawArticle.status,
      network_suitability: rawArticle.network_suitability || "HIGH",
      hub_suitability: rawArticle.hub_suitability || "HIGH",
      visual_status: rawArticle.visual_status || "APPROVED",
      source_count: rawArticle.source_count || (Array.isArray(rawArticle.sources) ? rawArticle.sources.length : 0),
      generated_date: rawArticle.generated_date || rawArticle.created_at
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
      versionHistory
    });
  } catch (err: any) {
    console.error("GET /api/admin/insights/[id] exception:", err);
    return NextResponse.json({ error: err.message || "Failed to fetch insight detail" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const fullPayload = {
      ...body,
      updated_at
    };

    if (body.status === "PUBLISHED" && existing.status !== "PUBLISHED") {
      fullPayload.publish_date = new Date().toISOString();
    }
    if (body.title_ko || body.title) {
      fullPayload.title = body.title_ko || body.title;
    }
    if (body.subtitle_ko || body.subtitle) {
      fullPayload.subtitle = body.subtitle_ko || body.subtitle;
    }
    if (body.summary_ko || body.excerpt) {
      fullPayload.excerpt = body.summary_ko || body.excerpt;
    }
    if (body.body_blocks_ko || body.body_blocks) {
      fullPayload.body_blocks = body.body_blocks_ko || body.body_blocks;
    }
    if (body.network_brand_takeaway_ko) {
      fullPayload.brand_takeaway = body.network_brand_takeaway_ko;
    }
    if (body.network_brand_actions_ko) {
      fullPayload.brand_actions = body.network_brand_actions_ko;
    }
    if (body.hub_retailer_takeaway_en) {
      fullPayload.retailer_takeaway = body.hub_retailer_takeaway_en;
    }
    if (body.hub_retailer_actions_en) {
      fullPayload.retailer_actions = body.hub_retailer_actions_en;
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

    return NextResponse.json({ article: updatedArticle });
  } catch (err: any) {
    console.error("PUT /api/admin/insights/[id] exception:", err);
    return NextResponse.json({ error: err.message || "Failed to update insight" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createAdminClient();

    const { data: archivedArticle, error } = await supabase
      .from("insights_articles")
      .update({
        status: "ARCHIVED",
        updated_at: new Date().toISOString()
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
    return NextResponse.json({ error: err.message || "Failed to archive insight" }, { status: 500 });
  }
}
