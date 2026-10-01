import { NextRequest, NextResponse } from "next/server";
import { getStoreTopics } from "@/lib/knowledge/store";
import { PortalScope } from "@/lib/knowledge/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const portalScope = (searchParams.get("portal_scope") as PortalScope) || "BRAND";

    // Only active topics for public portal
    const topics = await getStoreTopics(portalScope, false);

    return NextResponse.json({
      success: true,
      portal_scope: portalScope,
      count: topics.length,
      topics
    });
  } catch (error: any) {
    console.error("GET /api/knowledge/topics error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch topics" }, { status: 500 });
  }
}
