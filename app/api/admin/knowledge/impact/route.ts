import { NextRequest, NextResponse } from "next/server";
import { triggerKnowledgeImpact, getStoreTriggers } from "@/lib/knowledge/store";

export async function GET() {
  try {
    const triggers = await getStoreTriggers();
    return NextResponse.json({ triggers });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch impact triggers" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      knowledge_id,
      route,
      module: targetModule,
      setting_key,
      task_id,
      reason,
      triggered_by
    } = body;

    if (!reason) {
      return NextResponse.json(
        { error: "Impact reason (reason) is required" },
        { status: 400 }
      );
    }

    const result = await triggerKnowledgeImpact({
      knowledgeId: knowledge_id,
      route,
      module: targetModule,
      settingKey: setting_key,
      taskId: task_id,
      reason,
      triggeredBy: triggered_by || "System Impact Engine"
    });

    return NextResponse.json({
      success: true,
      message: `${result.impactedCount} knowledge item(s) marked as UPDATE_REQUIRED`,
      ...result
    });
  } catch (error: any) {
    console.error("POST /api/admin/knowledge/impact error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process system impact trigger" },
      { status: 500 }
    );
  }
}
