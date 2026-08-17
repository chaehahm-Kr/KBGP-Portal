import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const ALLOWED_ORIGINS = [
  "https://www.kselectnetwork.com",
  "https://kselectnetwork.com",
  "https://www.kselecthub.com",
  "https://kselecthub.com",
  "http://localhost:3000",
  "http://localhost:3010"
];

function getCorsHeaders(request: NextRequest) {
  const origin = request.headers.get("origin") || "";
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400"
  };

  if (ALLOWED_ORIGINS.includes(origin) || origin.startsWith("http://localhost:")) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Credentials"] = "true";
  } else {
    headers["Access-Control-Allow-Origin"] = "*";
  }

  return headers;
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(request)
  });
}

export async function GET(request: NextRequest) {
  const corsHeaders = getCorsHeaders(request);
  const searchParams = request.nextUrl.searchParams;
  const slug = searchParams.get("slug");
  
  // Resolve channel parameter & channel variants (handles NETWORK, HUB, K_SELECT_NETWORK, K_SELECT_HUB)
  const rawChannel = (searchParams.get("channel") || "NETWORK").toUpperCase();
  const channelVariants = rawChannel.includes("HUB")
    ? ["HUB", "K_SELECT_HUB"]
    : ["NETWORK", "K_SELECT_NETWORK"];

  const supabase = createAdminClient();

  if (slug) {
    // Fetch single article detail by slug
    const { data: article, error } = await supabase
      .from("insights_articles")
      .select("*")
      .eq("slug", slug)
      .eq("status", "PUBLISHED")
      .maybeSingle();

    if (error) {
      console.error("Error fetching article by slug:", error);
      return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders });
    }

    if (!article) {
      return NextResponse.json({ error: "Article not found" }, { status: 404, headers: corsHeaders });
    }

    // Get previous and next article slugs/titles for navigation
    const { data: allArticles } = await supabase
      .from("insights_articles")
      .select("slug, title, publish_date")
      .eq("status", "PUBLISHED")
      .overlaps("publish_channels", channelVariants)
      .order("publish_date", { ascending: true });

    let prevArticle = null;
    let nextArticle = null;

    if (allArticles && allArticles.length > 1) {
      const currentIndex = allArticles.findIndex(a => a.slug === slug);
      if (currentIndex > 0) {
        prevArticle = allArticles[currentIndex - 1];
      }
      if (currentIndex < allArticles.length - 1) {
        nextArticle = allArticles[currentIndex + 1];
      }
    }

    return NextResponse.json(
      { article, prevArticle, nextArticle },
      { status: 200, headers: corsHeaders }
    );
  }

  // Fetch list of published articles for this channel
  const { data: articles, error } = await supabase
    .from("insights_articles")
    .select("id, title, slug, subtitle, category, content_type, hero_image, excerpt, author, publish_date, featured, trending, audience, publish_channels, title_ko, title_en, summary_ko, summary_en")
    .eq("status", "PUBLISHED")
    .overlaps("publish_channels", channelVariants)
    .order("publish_date", { ascending: false });

  if (error) {
    console.error("Error fetching articles:", error);
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }

  return NextResponse.json({ 
    articles,
    dbUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    secretKeyLength: process.env.SUPABASE_SECRET_KEY ? process.env.SUPABASE_SECRET_KEY.length : 0
  }, { status: 200, headers: corsHeaders });
}
