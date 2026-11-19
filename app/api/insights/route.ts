import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  INSIGHTS_PDF_STORAGE_BUCKET,
  createInsightPreviewToken,
  extractPdfAttachment,
  isSafeInsightPdfStoragePath,
  toPublicPdfAttachment,
  verifyInsightPreviewToken,
} from "@/lib/insights/pdf-attachments";

const ALLOWED_ORIGINS = [
  "https://www.kselectnetwork.com",
  "https://kselectnetwork.com",
  "https://www.kselecthub.com",
  "https://kselecthub.com",
  "http://localhost:3000",
  "http://localhost:3010",
  "http://localhost:3025",
];

function getCorsHeaders(request: NextRequest) {
  const origin = request.headers.get("origin") || "";
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };

  if (ALLOWED_ORIGINS.includes(origin) || origin.startsWith("http://localhost:")) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Credentials"] = "true";
  } else {
    headers["Access-Control-Allow-Origin"] = "*";
  }

  return headers;
}

async function checkStorageObjectExists(
  supabase: ReturnType<typeof createAdminClient>,
  storagePath: string
): Promise<boolean> {
  if (!isSafeInsightPdfStoragePath(storagePath)) return false;
  const dir = path.posix.dirname(storagePath);
  const fileName = path.posix.basename(storagePath);
  const { data, error } = await supabase.storage
    .from(INSIGHTS_PDF_STORAGE_BUCKET)
    .list(dir, { limit: 20, search: fileName });
  if (error || !data) return false;
  return data.some((item) => item.name === fileName);
}

function sanitizeArticleForPublic(rawArticle: any, pdfAttachmentPublic: any) {
  const { visuals, reviewer_id, ...rest } = rawArticle;
  // Never expose internal storage paths from visuals array
  const safeVisuals = Array.isArray(visuals)
    ? visuals
        .filter((v: any) => !(v && typeof v === "object" && v.asset_type === "PDF_GUIDE"))
        .map(({ storage_bucket, storage_path, ...vRest }: any) => vRest)
    : [];

  return {
    ...rest,
    visuals: safeVisuals,
    pdf_attachment: pdfAttachmentPublic,
  };
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(request),
  });
}

export async function GET(request: NextRequest) {
  const corsHeaders = getCorsHeaders(request);
  const searchParams = request.nextUrl.searchParams;
  const slug = searchParams.get("slug");
  const previewToken = searchParams.get("preview");

  const rawChannel = (searchParams.get("channel") || "NETWORK").toUpperCase();
  const isHubChannel = rawChannel.includes("HUB");
  const channelVariants = isHubChannel
    ? ["HUB", "K_SELECT_HUB"]
    : ["NETWORK", "K_SELECT_NETWORK"];

  const supabase = createAdminClient();

  if (slug) {
    const { data: rawArticle, error } = await supabase
      .from("insights_articles")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();

    if (error) {
      console.error("Error fetching article by slug:", error);
      return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders });
    }

    if (!rawArticle) {
      return NextResponse.json({ error: "Article not found" }, { status: 404, headers: corsHeaders });
    }

    const isValidPreview = verifyInsightPreviewToken(rawArticle.id, rawArticle.slug, previewToken);
    const channels = Array.isArray(rawArticle.publish_channels) ? rawArticle.publish_channels : [];
    const matchesChannel =
      channels.some((c: string) => channelVariants.includes(c)) &&
      (isHubChannel ? rawArticle.hub_enabled !== false : rawArticle.network_enabled !== false);

    if (!isValidPreview && (rawArticle.status !== "PUBLISHED" || !matchesChannel)) {
      return NextResponse.json({ error: "Article not found" }, { status: 404, headers: corsHeaders });
    }

    const extractedPdf = extractPdfAttachment(rawArticle.visuals);
    let pdfPublic = null;
    if (extractedPdf) {
      const exists = await checkStorageObjectExists(supabase, extractedPdf.storage_path);
      pdfPublic = toPublicPdfAttachment(extractedPdf, rawArticle.slug, exists);
    }

    // Resolve optional related article cross-link
    let relatedArticle = null;
    if (rawArticle.related_insight_id) {
      const { data: rel } = await supabase
        .from("insights_articles")
        .select("id, slug, title, title_ko, title_en, summary_ko, summary_en, excerpt, category, status")
        .eq("id", rawArticle.related_insight_id)
        .maybeSingle();
      if (rel && (rel.status === "PUBLISHED" || isValidPreview)) {
        relatedArticle = {
          slug: rel.slug,
          title: rel.title_ko || rel.title,
          title_en: rel.title_en || rel.title,
          excerpt: rel.summary_ko || rel.excerpt || "",
          category: rel.category,
          is_published: rel.status === "PUBLISHED",
          preview_token:
            isValidPreview && rel.status !== "PUBLISHED"
              ? createInsightPreviewToken(rel.id, rel.slug)
              : undefined,
        };
      }
    }

    // Get previous and next published article slugs/titles for navigation
    const { data: allArticles } = await supabase
      .from("insights_articles")
      .select("slug, title, publish_date, network_enabled, hub_enabled")
      .eq("status", "PUBLISHED")
      .overlaps("publish_channels", channelVariants)
      .order("publish_date", { ascending: true });

    const channelFiltered = (allArticles || []).filter((a: any) =>
      isHubChannel ? a.hub_enabled !== false : a.network_enabled !== false
    );

    let prevArticle = null;
    let nextArticle = null;

    if (channelFiltered.length > 1) {
      const currentIndex = channelFiltered.findIndex((a: any) => a.slug === slug);
      if (currentIndex > 0) {
        prevArticle = {
          slug: channelFiltered[currentIndex - 1].slug,
          title: channelFiltered[currentIndex - 1].title,
        };
      }
      if (currentIndex >= 0 && currentIndex < channelFiltered.length - 1) {
        nextArticle = {
          slug: channelFiltered[currentIndex + 1].slug,
          title: channelFiltered[currentIndex + 1].title,
        };
      }
    }

    return NextResponse.json(
      {
        article: sanitizeArticleForPublic(rawArticle, pdfPublic),
        relatedArticle,
        prevArticle,
        nextArticle,
        isPreview: isValidPreview && rawArticle.status !== "PUBLISHED",
      },
      { status: 200, headers: corsHeaders }
    );
  }

  // Fetch list of published articles for this channel
  const { data: rawList, error } = await supabase
    .from("insights_articles")
    .select(
      "id, title, slug, subtitle, category, content_type, hero_image, excerpt, author, publish_date, featured, trending, audience, publish_channels, network_enabled, hub_enabled, title_ko, title_en, summary_ko, summary_en, visuals"
    )
    .eq("status", "PUBLISHED")
    .overlaps("publish_channels", channelVariants)
    .order("publish_date", { ascending: false });

  if (error) {
    console.error("Error fetching articles:", error);
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }

  const articles = (rawList || [])
    .filter((a: any) => (isHubChannel ? a.hub_enabled !== false : a.network_enabled !== false))
    .map((a: any) => {
      const pdf = extractPdfAttachment(a.visuals);
      const { visuals, ...rest } = a;
      return {
        ...rest,
        has_pdf_guide: Boolean(pdf),
        pdf_attachment: pdf ? toPublicPdfAttachment(pdf, a.slug, true) : null,
      };
    });

  return NextResponse.json({ articles }, { status: 200, headers: corsHeaders });
}
