import { NextRequest, NextResponse } from "next/server";
import { recordKnowledgeGap, getKnowledgeGaps } from "@/lib/knowledge/guide/engine";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { question, currentRoute } = body;

    const record = recordKnowledgeGap({
      id: `gap-${Date.now()}`,
      question: question || "Unspecified Question",
      user_id: "staff-user",
      user_name: "Admin Operator",
      current_route: currentRoute || "/admin",
      created_at: new Date().toISOString()
    });

    return NextResponse.json({ success: true, record });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Knowledge Gap logging failed" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ gaps: getKnowledgeGaps() });
}
