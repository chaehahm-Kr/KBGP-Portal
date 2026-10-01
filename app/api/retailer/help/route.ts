import { NextRequest, NextResponse } from "next/server";
import { getPublishedKnowledgeForAudience } from "@/lib/knowledge/distribution";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const module = searchParams.get("module") || undefined;
    const type = searchParams.get("type") || undefined;
    const search = searchParams.get("search") || undefined;

    // Strict Server-Side Audience Boundary: RETAILER ONLY
    const result = await getPublishedKnowledgeForAudience("RETAILER", {
      module,
      type,
      search
    });

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("GET /api/retailer/help error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to load help articles" },
      { status: 500 }
    );
  }
}
