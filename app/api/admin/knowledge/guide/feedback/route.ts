import { NextRequest, NextResponse } from "next/server";
import { recordGuideFeedback, getGuideFeedback } from "@/lib/knowledge/guide/engine";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { question, isHelpful, reason } = body;

    const record = recordGuideFeedback({
      id: `fb-${Date.now()}`,
      question: question || "Unknown Question",
      is_helpful: Boolean(isHelpful),
      reason: reason || null,
      created_at: new Date().toISOString()
    });

    return NextResponse.json({ success: true, record });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Feedback logging failed" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ feedback: getGuideFeedback() });
}
