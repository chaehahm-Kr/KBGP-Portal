import { NextRequest, NextResponse } from "next/server";
import { getStoreKnowledgeItems, getStoreTriggers } from "@/lib/knowledge/store";
import { resolveSystemImpact } from "@/lib/knowledge/system-impact";

export async function GET() {
  try {
    const items = await getStoreKnowledgeItems();
    const triggers = await getStoreTriggers();

    const awaitingApproval = items.filter(
      i => i.external_review_status === "REQUESTED" || i.status === "IN_REVIEW"
    );

    const needsReview = items.filter(
      i =>
        i.status === "DRAFT" ||
        i.system_impact_status === "POTENTIALLY_OUTDATED" ||
        i.is_sensitive_internal
    );

    const systemChangeImpact = items.filter(
      i => i.system_impact_status === "POTENTIALLY_OUTDATED"
    );

    return NextResponse.json({
      awaitingApproval,
      needsReview,
      systemChangeImpact,
      triggers
    });
  } catch (err: any) {
    console.error("GET /api/admin/knowledge/review error:", err);
    return NextResponse.json({ error: err.message || "Failed to fetch review queues" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { knowledgeId, action, reason, user_name } = body;

    if (!knowledgeId || !action) {
      return NextResponse.json({ error: "knowledgeId and action are required" }, { status: 400 });
    }

    const updatedItem = await resolveSystemImpact(
      knowledgeId,
      { id: "admin-user", name: user_name || "Knowledge Operator" },
      action === "NO_UPDATE_REQUIRED" ? "NO_UPDATE_REQUIRED" : "CREATE_VERSION",
      reason || "System change impact reviewed"
    );

    return NextResponse.json({ item: updatedItem });
  } catch (err: any) {
    console.error("POST /api/admin/knowledge/review error:", err);
    return NextResponse.json({ error: err.message || "Failed to resolve system impact" }, { status: 500 });
  }
}
