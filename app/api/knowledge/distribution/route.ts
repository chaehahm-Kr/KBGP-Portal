import { NextRequest, NextResponse } from "next/server";
import {
  getPublishedKnowledgeForAudience,
  normalizeAudience
} from "@/lib/knowledge/distribution";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rawAudience = searchParams.get("audience");

    if (!rawAudience) {
      return NextResponse.json(
        {
          error: "Audience parameter is required (e.g. ?audience=BRAND | RETAIL | INTERNAL)"
        },
        { status: 400 }
      );
    }

    const audience = normalizeAudience(rawAudience);
    if (!audience) {
      return NextResponse.json(
        {
          error: `Invalid audience '${rawAudience}'. Supported audiences: BRAND, RETAIL, INTERNAL, PUBLIC`
        },
        { status: 400 }
      );
    }

    const module = searchParams.get("module") || undefined;
    const type = searchParams.get("type") || undefined;
    const search = searchParams.get("search") || undefined;

    const distribution = await getPublishedKnowledgeForAudience(audience, {
      module,
      type,
      search
    });

    return NextResponse.json(distribution);
  } catch (err: any) {
    console.error("GET /api/knowledge/distribution error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to query published knowledge distribution" },
      { status: 500 }
    );
  }
}
