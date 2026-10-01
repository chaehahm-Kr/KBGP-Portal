import { NextRequest, NextResponse } from "next/server";
import { getPublishedBrandKnowledgeDetail } from "@/lib/knowledge/distribution";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    // Strict Server-Side Audience Boundary: BRAND ONLY
    const detail = await getPublishedBrandKnowledgeDetail(slug);

    if (!detail) {
      return NextResponse.json(
        { error: "도움말 문서를 찾을 수 없거나 접근 권한이 없습니다." },
        { status: 404 }
      );
    }

    return NextResponse.json(detail);
  } catch (err: any) {
    console.error("GET /api/portal/help/[slug] error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to load help article detail" },
      { status: 500 }
    );
  }
}
