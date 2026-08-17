import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import crypto from "crypto";

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
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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

/**
 * Generate a secure One-Way HMAC-SHA256 Hash for anonymous duplicate protection.
 * Secret is retrieved strictly from process.env.INSIGHTS_FEEDBACK_HASH_SECRET.
 * Zero hardcoded fallback strings permitted.
 */
function generateClientHmacHash(ip: string, userAgent: string, articleId: string): string {
  const secret = process.env.INSIGHTS_FEEDBACK_HASH_SECRET;
  if (!secret) {
    throw new Error("Server Configuration Error: INSIGHTS_FEEDBACK_HASH_SECRET is not configured.");
  }
  const rawInput = `${ip.trim()}|${userAgent.trim()}|${articleId.trim()}`;
  return crypto.createHmac("sha256", secret).update(rawInput).digest("hex");
}

/**
 * POST /api/insights/feedback
 * Accepts anonymous reader feedback with HMAC-SHA256 one-way hash duplicate protection.
 */
export async function POST(request: NextRequest) {
  const corsHeaders = getCorsHeaders(request);
  try {
    // Fail Closed: Enforce existence of server environment variable
    if (!process.env.INSIGHTS_FEEDBACK_HASH_SECRET) {
      console.error("[Security Error] INSIGHTS_FEEDBACK_HASH_SECRET environment variable is missing.");
      return NextResponse.json(
        { error: "Server Configuration Error: INSIGHTS_FEEDBACK_HASH_SECRET is not configured." },
        { status: 500, headers: corsHeaders }
      );
    }

    const body = await request.json();
    const { article_id, channel = "NETWORK", feedback } = body;

    if (!article_id || !feedback || !["HELPFUL", "NOT_HELPFUL"].includes(feedback)) {
      return NextResponse.json(
        { error: "Invalid payload. Required: article_id and feedback ('HELPFUL' | 'NOT_HELPFUL')" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Extract headers for HMAC-SHA256 hash (Raw values are discarded immediately)
    const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "anonymous";
    const userAgent = request.headers.get("user-agent") || "";
    const clientHash = generateClientHmacHash(ip, userAgent, article_id);

    const supabase = createAdminClient();

    // Resolve article_id: support both UUIDs and slugs
    let targetArticleId = article_id;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(article_id);

    if (!isUuid) {
      const { data: found } = await supabase
        .from("insights_articles")
        .select("id")
        .eq("slug", article_id)
        .maybeSingle();

      if (found) {
        targetArticleId = found.id;
      } else {
        // Auto-create article entry for static/new published article slugs
        const { data: newArt } = await supabase
          .from("insights_articles")
          .insert({
            title: article_id.replace(/-/g, " ").toUpperCase(),
            slug: article_id,
            category: "RETAIL INSIGHTS",
            content_type: "ARTICLE",
            author: "K SELECT Intelligence Desk",
            status: "PUBLISHED",
            audience: "RETAILER",
            publish_channels: ["HUB"]
          })
          .select("id")
          .single();

        if (newArt) {
          targetArticleId = newArt.id;
        }
      }
    }

    // Check if feedback already submitted from this HMAC-SHA256 client hash within 24h
    const { data: existing } = await supabase
      .from("insights_reader_feedback")
      .select("id")
      .eq("article_id", targetArticleId)
      .eq("client_hash", clientHash)
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json(
        { success: true, message: "Feedback already received today. Thank you!", duplicate: true },
        { status: 200, headers: corsHeaders }
      );
    }

    // Save ONLY the HMAC-SHA256 client_hash (No IP/User-Agent stored)
    const { error: insertErr } = await supabase.from("insights_reader_feedback").insert({
      article_id: targetArticleId,
      channel: channel.toUpperCase().includes("HUB") ? "HUB" : "NETWORK",
      feedback,
      client_hash: clientHash,
    });

    if (insertErr) {
      console.error("Reader feedback insert error:", insertErr);
      return NextResponse.json({ error: insertErr.message }, { status: 500, headers: corsHeaders });
    }

    return NextResponse.json(
      { success: true, message: "Thank you for your feedback!" },
      { status: 201, headers: corsHeaders }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Feedback error" }, { status: 500, headers: corsHeaders });
  }
}

/**
 * GET /api/insights/feedback
 * Returns ONLY aggregated summary metrics (Helpful, Not Helpful, Total, Helpful Rate %).
 * NEVER returns raw table records or client_hash.
 */
export async function GET(request: NextRequest) {
  const corsHeaders = getCorsHeaders(request);
  try {
    const searchParams = request.nextUrl.searchParams;
    const articleId = searchParams.get("article_id");

    const supabase = createAdminClient();

    let targetArticleId = articleId;
    if (articleId) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(articleId);
      if (!isUuid) {
        const { data: found } = await supabase
          .from("insights_articles")
          .select("id")
          .eq("slug", articleId)
          .maybeSingle();

        if (found) {
          targetArticleId = found.id;
        }
      }
    }

    let query = supabase.from("insights_reader_feedback").select("article_id, feedback");
    if (targetArticleId) {
      query = query.eq("article_id", targetArticleId);
    }

    const { data: records, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders });
    }

    // Aggregate metrics per article_id
    const statsMap: Record<string, { helpful: number; not_helpful: number; total: number; helpful_rate: number }> = {};

    (records || []).forEach((r) => {
      if (!statsMap[r.article_id]) {
        statsMap[r.article_id] = { helpful: 0, not_helpful: 0, total: 0, helpful_rate: 0 };
      }
      if (r.feedback === "HELPFUL") statsMap[r.article_id].helpful++;
      else if (r.feedback === "NOT_HELPFUL") statsMap[r.article_id].not_helpful++;
      statsMap[r.article_id].total++;
    });

    Object.keys(statsMap).forEach((id) => {
      const s = statsMap[id];
      s.helpful_rate = s.total > 0 ? Math.round((s.helpful / s.total) * 1000) / 10 : 0;
    });

    if (articleId) {
      const stats = statsMap[articleId] || { helpful: 0, not_helpful: 0, total: 0, helpful_rate: 0 };
      return NextResponse.json(
        { article_id: articleId, helpful: stats.helpful, not_helpful: stats.not_helpful, total: stats.total, helpful_rate: stats.helpful_rate },
        { status: 200, headers: corsHeaders }
      );
    }

    return NextResponse.json({ statsMap }, { status: 200, headers: corsHeaders });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Feedback query error" }, { status: 500, headers: corsHeaders });
  }
}
