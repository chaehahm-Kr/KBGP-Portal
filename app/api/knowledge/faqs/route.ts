import { NextRequest, NextResponse } from "next/server";
import { getApprovedFaqsForAudience } from "@/lib/knowledge/faq-engine";
import { AudienceType, FaqKind, UserRole } from "@/lib/knowledge/types";
import { resolveServerAudience } from "@/lib/knowledge/ask-engine";
import { createServerClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env/public";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedAudience = searchParams.get("audience") as AudienceType | null;
    const kind = searchParams.get("kind") as FaqKind | null;
    const topicId = searchParams.get("topic_id") || undefined;
    const search = searchParams.get("search") || undefined;
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : undefined;

    // Resolve user session role
    let userRole: UserRole = "anonymous";
    try {
      const allCookies = request.cookies.getAll();
      const mappedCookies = allCookies.map(c => {
        if (c.name.startsWith("admin-sb-")) return { name: c.name.replace("admin-sb-", "sb-"), value: c.value };
        if (c.name.startsWith("portal-sb-")) return { name: c.name.replace("portal-sb-", "sb-"), value: c.value };
        return c;
      });

      const supabase = createServerClient(
        publicEnv.NEXT_PUBLIC_SUPABASE_URL,
        publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
        {
          cookies: {
            getAll: () => mappedCookies,
            setAll: () => {}
          }
        }
      );

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
        userRole = (profile?.role || user.app_metadata?.role || user.user_metadata?.role || "brand") as UserRole;
      }
    } catch (e) {}

    // Enforce server-side audience resolution
    const audience = resolveServerAudience(userRole, requestedAudience || undefined);

    const items = await getApprovedFaqsForAudience(audience, {
      kind: kind || undefined,
      topic_id: topicId,
      search,
      limit
    });

    return NextResponse.json({
      success: true,
      audience,
      count: items.length,
      items: items.map(f => ({
        id: f.id,
        portal_scope: f.portal_scope || (f.audience?.some(a => a.includes("RETAIL")) ? "RETAILER" : "BRAND"),
        topic_id: f.topic_id || null,
        source_knowledge_id: f.source_knowledge_id,
        source_version: f.source_version,
        source_title: f.source_title,
        question_ko: f.question_ko,
        question_en: f.question_en,
        answer_ko: f.answer_ko,
        answer_en: f.answer_en,
        kind: f.kind,
        is_featured: f.is_featured,
        display_order: f.display_order,
        updated_at: f.updated_at
      }))
    });
  } catch (error: any) {
    console.error("GET /api/knowledge/faqs error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch approved FAQs" }, { status: 500 });
  }
}

