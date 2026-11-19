import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminApiSession } from "@/lib/insights/admin-auth";
import { extractPdfAttachment } from "@/lib/insights/pdf-attachments";

// Full set of verified columns on public.insights_articles (Migrations 0046–0049)
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

export async function GET(request: NextRequest) {
  const auth = await requireAdminApiSession();
  if (!auth.ok) return auth.response;

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

    let feedbackMap: Record<
      string,
      { helpful: number; not_helpful: number; total: number; helpful_rate: number }
    > = {};
    try {
      const { data: fbData } = await supabase
        .from("insights_reader_feedback")
        .select("article_id, feedback");
      if (fbData) {
        fbData.forEach((r) => {
          if (!feedbackMap[r.article_id]) {
            feedbackMap[r.article_id] = { helpful: 0, not_helpful: 0, total: 0, helpful_rate: 0 };
          }
          if (r.feedback === "HELPFUL") feedbackMap[r.article_id].helpful++;
          else if (r.feedback === "NOT_HELPFUL") feedbackMap[r.article_id].not_helpful++;
          feedbackMap[r.article_id].total++;
        });
        Object.keys(feedbackMap).forEach((id) => {
          const s = feedbackMap[id];
          s.helpful_rate = s.total > 0 ? Math.round((s.helpful / s.total) * 1000) / 10 : 0;
        });
      }
    } catch {}

    const articles = (rawArticles || []).map((a) => ({
      ...a,
      primary_language: a.primary_language || "KO",
      analysis_confidence: a.analysis_confidence || 85,
      topic_score: a.topic_score || 85,
      topic_score_breakdown: a.topic_score_breakdown || {
        relevance: 25,
        actionability: 25,
        evidence_strength: 20,
        timeliness: 15,
        originality: 10,
        strategic_fit: 5,
      },
      critical_conditions: a.critical_conditions || {
        evidence_quality: "PASS",
        duplicate_check: "PASS",
        claim_validation: "PASS",
        audience_relevance: "PASS",
      },
      feedback_stats: feedbackMap[a.id] ||
        feedbackMap[a.slug] || { helpful: 0, not_helpful: 0, total: 0, helpful_rate: 0 },
      title_ko: a.title_ko || a.title,
      title_en: a.title_en || "",
      subtitle_ko: a.subtitle_ko || a.subtitle,
      subtitle_en: a.subtitle_en || "",
      summary_ko: a.summary_ko || a.excerpt,
      summary_en: a.summary_en || "",
      body_blocks_ko:
        Array.isArray(a.body_blocks_ko) && a.body_blocks_ko.length > 0
          ? a.body_blocks_ko
          : a.body_blocks || [],
      body_blocks_en: Array.isArray(a.body_blocks_en) ? a.body_blocks_en : [],
      network_enabled: a.network_enabled !== false,
      network_category: a.network_category || a.category,
      network_brand_takeaway_ko: a.network_brand_takeaway_ko || a.brand_takeaway,
      network_brand_takeaway_en: a.network_brand_takeaway_en || "",
      network_brand_actions_ko:
        Array.isArray(a.network_brand_actions_ko) && a.network_brand_actions_ko.length > 0
          ? a.network_brand_actions_ko
          : a.brand_actions || [],
      network_brand_actions_en: Array.isArray(a.network_brand_actions_en)
        ? a.network_brand_actions_en
        : [],
      network_publish_status: a.network_publish_status || a.status,
      hub_enabled: a.hub_enabled !== false,
      hub_category: a.hub_category || a.category,
      hub_retailer_takeaway_ko: a.hub_retailer_takeaway_ko || "",
      hub_retailer_takeaway_en: a.hub_retailer_takeaway_en || a.retailer_takeaway,
      hub_retailer_actions_ko: Array.isArray(a.hub_retailer_actions_ko)
        ? a.hub_retailer_actions_ko
        : [],
      hub_retailer_actions_en:
        Array.isArray(a.hub_retailer_actions_en) && a.hub_retailer_actions_en.length > 0
          ? a.hub_retailer_actions_en
          : a.retailer_actions || [],
      hub_publish_status: a.hub_publish_status || a.status,
      network_suitability: a.network_suitability || "HIGH",
      hub_suitability: a.hub_suitability || "HIGH",
      visual_status: a.visual_status || "APPROVED",
      pdf_attachment: extractPdfAttachment(a.visuals),
      source_count: a.source_count || (Array.isArray(a.sources) ? a.sources.length : 0),
      generated_date: a.generated_date || a.created_at,
    }));

    const metrics = {
      aiDraftsToday: articles.filter((a) => a.status === "AI_DRAFT" || a.status === "DRAFT").length,
      awaitingReview: articles.filter((a) => a.status === "IN_REVIEW" || a.status === "REVIEW")
        .length,
      revisionRequested: articles.filter((a) => a.status === "REVISION_REQUESTED").length,
      approved: articles.filter((a) => a.status === "APPROVED").length,
      scheduled: articles.filter((a) => a.status === "SCHEDULED").length,
      published: articles.filter((a) => a.status === "PUBLISHED").length,
      failedNeedsAttention: articles.filter(
        (a) => a.status === "REJECTED" || a.visual_status === "FAILED"
      ).length,
      totalCount: articles.length,
    };

    let latestRun: any = null;
    try {
      const { data: runData } = await supabase
        .from("insights_automation_runs")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      latestRun = runData;
    } catch {}

    const pipelineStages = [
      { name: "Research", count: latestRun?.sources_scanned || 35, status: "active" },
      { name: "Candidate", count: latestRun?.candidates_found || 4, status: "active" },
      {
        name: "AI Draft",
        count: metrics.aiDraftsToday,
        status: metrics.aiDraftsToday > 0 ? "active" : "empty",
      },
      {
        name: "Review",
        count: metrics.awaitingReview,
        status: metrics.awaitingReview > 0 ? "active" : "empty",
      },
      {
        name: "Revision",
        count: metrics.revisionRequested,
        status: metrics.revisionRequested > 0 ? "warning" : "empty",
      },
      {
        name: "Approved",
        count: metrics.approved,
        status: metrics.approved > 0 ? "active" : "empty",
      },
      {
        name: "Scheduled",
        count: metrics.scheduled,
        status: metrics.scheduled > 0 ? "active" : "empty",
      },
      {
        name: "Published",
        count: metrics.published,
        status: metrics.published > 0 ? "active" : "empty",
      },
    ];

    let filtered = [...articles];

    if (mode === "queue") {
      filtered = filtered.filter((a) =>
        ["AI_DRAFT", "DRAFT", "IN_REVIEW", "REVIEW", "REVISION_REQUESTED", "APPROVED"].includes(
          a.status
        )
      );
    }

    if (status && status !== "ALL") {
      filtered = filtered.filter((a) => a.status === status);
    }

    if (channel && channel !== "ALL") {
      filtered = filtered.filter(
        (a) => Array.isArray(a.publish_channels) && a.publish_channels.includes(channel)
      );
    }

    if (category && category !== "ALL") {
      filtered = filtered.filter((a) => a.category === category);
    }

    if (search && search.trim()) {
      const q = search.toLowerCase().trim();
      filtered = filtered.filter(
        (a) =>
          (a.title && a.title.toLowerCase().includes(q)) ||
          (a.title_en && a.title_en.toLowerCase().includes(q)) ||
          (a.slug && a.slug.toLowerCase().includes(q)) ||
          (a.excerpt && a.excerpt.toLowerCase().includes(q))
      );
    }

    if (sortBy === "oldest") {
      filtered.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    } else if (sortBy === "score") {
      filtered.sort((a, b) => (b.topic_score || 85) - (a.topic_score || 85));
    } else if (sortBy === "reviewPriority") {
      const priorityOrder: Record<string, number> = {
        REVISION_REQUESTED: 1,
        IN_REVIEW: 2,
        REVIEW: 2,
        AI_DRAFT: 3,
        DRAFT: 3,
        APPROVED: 4,
        SCHEDULED: 5,
        PUBLISHED: 6,
        REJECTED: 7,
      };
      filtered.sort((a, b) => (priorityOrder[a.status] || 99) - (priorityOrder[b.status] || 99));
    } else {
      filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    return NextResponse.json({
      articles: filtered,
      metrics,
      pipelineStages,
    });
  } catch (err: any) {
    console.error("GET /api/admin/insights exception:", err);
    return NextResponse.json(
      { error: err.message || "Failed to fetch insights" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminApiSession();
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const supabase = createAdminClient();

    const title_ko = body.title_ko || body.title || "New Insight Core Draft";
    const title_en = body.title_en || "";
    const slug = body.slug || `insight-${Date.now()}`;
    const category = body.category || "U.S. MARKET ENTRY";
    const content_type = body.content_type || "PRACTICAL_GUIDE";
    const author = body.author || "Compliance Operations Team";
    const status = body.status || "DRAFT";
    const publishChannels: string[] = Array.isArray(body.publish_channels)
      ? body.publish_channels
      : ["K_SELECT_NETWORK"];
    const networkEnabled =
      typeof body.network_enabled === "boolean"
        ? body.network_enabled
        : publishChannels.includes("K_SELECT_NETWORK") || publishChannels.includes("NETWORK");
    const hubEnabled =
      typeof body.hub_enabled === "boolean"
        ? body.hub_enabled
        : publishChannels.includes("K_SELECT_HUB") || publishChannels.includes("HUB");

    const isPublished = status === "PUBLISHED";
    const networkPublishStatus = !networkEnabled
      ? "DISABLED"
      : isPublished
        ? "PUBLISHED"
        : "DRAFT";
    const hubPublishStatus = !hubEnabled ? "DISABLED" : isPublished ? "PUBLISHED" : "DRAFT";

    const bodyBlocksKo = Array.isArray(body.body_blocks_ko)
      ? body.body_blocks_ko
      : Array.isArray(body.body_blocks)
        ? body.body_blocks
        : [];
    const bodyBlocksEn = Array.isArray(body.body_blocks_en) ? body.body_blocks_en : [];

    const fullPayload: Record<string, any> = {
      ...body,
      title: title_ko,
      title_ko,
      title_en,
      slug,
      subtitle: body.subtitle_ko ?? body.subtitle ?? "",
      subtitle_ko: body.subtitle_ko ?? body.subtitle ?? "",
      subtitle_en: body.subtitle_en ?? "",
      category,
      network_category: body.network_category || category,
      hub_category: body.hub_category || category,
      content_type,
      author,
      hero_image: body.hero_image || "/images/insights/why_products_fail.jpg",
      excerpt: body.summary_ko || body.excerpt || "New insight draft for review.",
      summary_ko: body.summary_ko || body.excerpt || "",
      summary_en: body.summary_en || "",
      body_blocks: bodyBlocksKo,
      body_blocks_ko: bodyBlocksKo,
      body_blocks_en: bodyBlocksEn,
      status,
      audience: body.audience || (hubEnabled ? "BOTH" : "BRAND"),
      publish_channels: publishChannels,
      network_enabled: networkEnabled,
      network_publish_status: networkPublishStatus,
      hub_enabled: hubEnabled,
      hub_publish_status: hubPublishStatus,
      brand_takeaway: body.network_brand_takeaway_ko || body.brand_takeaway || "",
      network_brand_takeaway_ko: body.network_brand_takeaway_ko || body.brand_takeaway || "",
      network_brand_takeaway_en: body.network_brand_takeaway_en || "",
      brand_actions: body.network_brand_actions_ko || body.brand_actions || [],
      network_brand_actions_ko: body.network_brand_actions_ko || body.brand_actions || [],
      network_brand_actions_en: body.network_brand_actions_en || [],
      retailer_takeaway: body.hub_retailer_takeaway_en || body.retailer_takeaway || "",
      retailer_actions: body.hub_retailer_actions_en || body.retailer_actions || [],
      sources: body.sources || [],
      sources_detail: body.sources_detail || [],
      source_count: Array.isArray(body.sources) ? body.sources.length : 0,
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

    // Record V1 initial snapshot in version history
    try {
      await supabase.from("insights_version_history").insert({
        article_id: newArticle.id,
        version_number: 1,
        changed_by: auth.email,
        change_type: "DRAFT_CREATED",
        review_note: `Created draft "${newArticle.title}" (${newArticle.status})`,
        snapshot: newArticle,
      });
    } catch {}

    return NextResponse.json({ article: newArticle }, { status: 201 });
  } catch (err: any) {
    console.error("POST /api/admin/insights exception:", err);
    return NextResponse.json(
      { error: err.message || "Failed to create insight" },
      { status: 500 }
    );
  }
}
