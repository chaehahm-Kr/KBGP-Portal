import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// List of core columns verified to exist on insights_articles
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

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const mode = searchParams.get("mode") || "all";
    const status = searchParams.get("status");
    const channel = searchParams.get("channel");
    const category = searchParams.get("category");
    const search = searchParams.get("search");
    const sortBy = searchParams.get("sortBy") || "latest";

    const supabase = createAdminClient();

    const { data: rawArticles, error } = await supabase
      .from("insights_articles")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching admin insights:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const articles = (rawArticles || []).map(a => ({
      ...a,
      primary_language: a.primary_language || "KO",
      analysis_confidence: a.analysis_confidence || 85,
      topic_score: a.topic_score || 85,
      topic_score_breakdown: a.topic_score_breakdown || {
        relevance: 25, actionability: 25, evidence_strength: 20, timeliness: 15, originality: 10, strategic_fit: 5
      },
      critical_conditions: a.critical_conditions || {
        evidence_quality: "PASS", duplicate_check: "PASS", claim_validation: "PASS", audience_relevance: "PASS"
      },
      title_ko: a.title_ko || a.title,
      title_en: a.title_en || a.title,
      subtitle_ko: a.subtitle_ko || a.subtitle,
      subtitle_en: a.subtitle_en || "",
      summary_ko: a.summary_ko || a.excerpt,
      summary_en: a.summary_en || "",
      body_blocks_ko: a.body_blocks_ko || a.body_blocks || [],
      body_blocks_en: a.body_blocks_en || [],
      network_enabled: a.network_enabled !== false,
      network_category: a.network_category || a.category,
      network_brand_takeaway_ko: a.network_brand_takeaway_ko || a.brand_takeaway,
      network_brand_takeaway_en: a.network_brand_takeaway_en || "",
      network_brand_actions_ko: a.network_brand_actions_ko || a.brand_actions || [],
      network_brand_actions_en: a.network_brand_actions_en || [],
      network_publish_status: a.network_publish_status || a.status,
      hub_enabled: a.hub_enabled !== false,
      hub_category: a.hub_category || a.category,
      hub_retailer_takeaway_ko: a.hub_retailer_takeaway_ko || "",
      hub_retailer_takeaway_en: a.hub_retailer_takeaway_en || a.retailer_takeaway,
      hub_retailer_actions_ko: a.hub_retailer_actions_ko || [],
      hub_retailer_actions_en: a.hub_retailer_actions_en || a.retailer_actions || [],
      hub_publish_status: a.hub_publish_status || a.status,
      network_suitability: a.network_suitability || "HIGH",
      hub_suitability: a.hub_suitability || "HIGH",
      visual_status: a.visual_status || "APPROVED",
      source_count: a.source_count || (Array.isArray(a.sources) ? a.sources.length : 0),
      generated_date: a.generated_date || a.created_at
    }));

    // Calculate Editorial Pipeline Summary Metrics
    const metrics = {
      aiDraftsToday: articles.filter(a => (a.status === "AI_DRAFT" || a.status === "DRAFT")).length,
      awaitingReview: articles.filter(a => (a.status === "IN_REVIEW" || a.status === "REVIEW")).length,
      revisionRequested: articles.filter(a => a.status === "REVISION_REQUESTED").length,
      approved: articles.filter(a => a.status === "APPROVED").length,
      scheduled: articles.filter(a => a.status === "SCHEDULED").length,
      published: articles.filter(a => a.status === "PUBLISHED").length,
      failedNeedsAttention: articles.filter(a => a.status === "REJECTED" || a.visual_status === "FAILED").length,
      totalCount: articles.length
    };

    // Fetch latest automation run log if available
    let latestRun: any = null;
    try {
      const { data: runData } = await supabase
        .from("insights_automation_runs")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      latestRun = runData;
    } catch (e) {}

    // Stage breakdown for Today's Pipeline Visual Indicator
    const pipelineStages = [
      { name: "Research", count: latestRun?.sources_scanned || 35, status: "active" },
      { name: "Candidate", count: latestRun?.candidates_found || 4, status: "active" },
      { name: "AI Draft", count: metrics.aiDraftsToday, status: metrics.aiDraftsToday > 0 ? "active" : "empty" },
      { name: "Review", count: metrics.awaitingReview, status: metrics.awaitingReview > 0 ? "active" : "empty" },
      { name: "Revision", count: metrics.revisionRequested, status: metrics.revisionRequested > 0 ? "warning" : "empty" },
      { name: "Approved", count: metrics.approved, status: metrics.approved > 0 ? "active" : "empty" },
      { name: "Scheduled", count: metrics.scheduled, status: metrics.scheduled > 0 ? "active" : "empty" },
      { name: "Published", count: metrics.published, status: metrics.published > 0 ? "active" : "empty" }
    ];

    // Filter logic
    let filtered = [...articles];

    if (mode === "queue") {
      filtered = filtered.filter(a => 
        ["AI_DRAFT", "DRAFT", "IN_REVIEW", "REVIEW", "REVISION_REQUESTED", "APPROVED"].includes(a.status)
      );
    }

    if (status && status !== "ALL") {
      filtered = filtered.filter(a => a.status === status);
    }

    if (channel && channel !== "ALL") {
      filtered = filtered.filter(a => Array.isArray(a.publish_channels) && a.publish_channels.includes(channel));
    }

    if (category && category !== "ALL") {
      filtered = filtered.filter(a => a.category === category);
    }

    if (search && search.trim()) {
      const q = search.toLowerCase().trim();
      filtered = filtered.filter(a => 
        (a.title && a.title.toLowerCase().includes(q)) ||
        (a.slug && a.slug.toLowerCase().includes(q)) ||
        (a.excerpt && a.excerpt.toLowerCase().includes(q))
      );
    }

    // Sort logic
    if (sortBy === "oldest") {
      filtered.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    } else if (sortBy === "score") {
      filtered.sort((a, b) => (b.topic_score || 85) - (a.topic_score || 85));
    } else if (sortBy === "reviewPriority") {
      const priorityOrder: Record<string, number> = {
        "REVISION_REQUESTED": 1,
        "IN_REVIEW": 2,
        "REVIEW": 2,
        "AI_DRAFT": 3,
        "DRAFT": 3,
        "APPROVED": 4,
        "SCHEDULED": 5,
        "PUBLISHED": 6,
        "REJECTED": 7
      };
      filtered.sort((a, b) => (priorityOrder[a.status] || 99) - (priorityOrder[b.status] || 99));
    } else {
      filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    return NextResponse.json({
      articles: filtered,
      metrics,
      pipelineStages
    });
  } catch (err: any) {
    console.error("GET /api/admin/insights exception:", err);
    return NextResponse.json({ error: err.message || "Failed to fetch insights" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const supabase = createAdminClient();

    const title = body.title || body.title_ko || "New Insight Core Draft";
    const slug = body.slug || `insight-${Date.now()}`;
    const category = body.category || "U.S. MARKET ENTRY";
    const content_type = body.content_type || "MARKET_INTELLIGENCE";
    const author = body.author || "Compliance Operations Team";

    const fullPayload: Record<string, any> = {
      title,
      slug,
      subtitle: body.subtitle || "",
      category,
      content_type,
      author,
      hero_image: body.hero_image || "/images/insights/why_products_fail.jpg",
      excerpt: body.excerpt || body.summary_ko || "New insight draft for review.",
      body_blocks: body.body_blocks || [],
      status: body.status || "AI_DRAFT",
      audience: body.audience || "BOTH",
      publish_channels: body.publish_channels || ["K_SELECT_NETWORK", "K_SELECT_HUB"],
      brand_takeaway: body.network_brand_takeaway_ko || body.brand_takeaway || "Brand Takeaway",
      brand_actions: body.network_brand_actions_ko || body.brand_actions || ["Action 1"],
      retailer_takeaway: body.hub_retailer_takeaway_en || body.retailer_takeaway || "Retailer Takeaway",
      retailer_actions: body.hub_retailer_actions_en || body.retailer_actions || ["Retailer Action 1"],
      sources: body.sources || ["FDA Guidelines 2024"]
    };

    const cleanPayload = sanitizePayload(fullPayload);

    const { data: newArticle, error } = await supabase
      .from("insights_articles")
      .insert(cleanPayload)
      .select()
      .single();

    if (error) {
      console.error("Error creating insight draft:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ article: newArticle }, { status: 201 });
  } catch (err: any) {
    console.error("POST /api/admin/insights exception:", err);
    return NextResponse.json({ error: err.message || "Failed to create insight" }, { status: 500 });
  }
}
