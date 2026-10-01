import { NextRequest, NextResponse } from "next/server";
import {
  generateFaqCandidatesForKnowledge,
  approveFaqItem,
  rejectFaqItem,
  editFaqItem,
  deactivateFaqItem,
  createManualFaqItem,
  resolveFaqNoUpdateNeeded
} from "@/lib/knowledge/faq-engine";
import { getStoreFaqs } from "@/lib/knowledge/store";
import { SecurityUserContext } from "@/lib/knowledge/types";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const faqs = await getStoreFaqs(id);
    return NextResponse.json({ success: true, count: faqs.length, faqs });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch FAQs" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { action, faqId, updates, reason, reviewerName = "Admin", manualFaq } = body;

    const userContext: SecurityUserContext = {
      userId: "admin-user",
      role: "admin"
    };

    if (action === "GENERATE") {
      const result = await generateFaqCandidatesForKnowledge(id, userContext);
      return NextResponse.json(result);
    }

    if (action === "CREATE_MANUAL") {
      if (!manualFaq?.question_ko || !manualFaq?.answer_ko) {
        return NextResponse.json({ error: "question_ko and answer_ko are required" }, { status: 400 });
      }
      const item = await createManualFaqItem({
        source_knowledge_id: id,
        question_ko: manualFaq.question_ko,
        question_en: manualFaq.question_en,
        answer_ko: manualFaq.answer_ko,
        answer_en: manualFaq.answer_en,
        audience: manualFaq.audience,
        kind: manualFaq.kind,
        createdBy: reviewerName
      });
      return NextResponse.json({ success: true, item });
    }

    if (action === "APPROVE") {
      if (!faqId) return NextResponse.json({ error: "faqId required" }, { status: 400 });
      const item = await approveFaqItem(faqId, reviewerName, reason);
      return NextResponse.json({ success: true, item });
    }

    if (action === "REJECT") {
      if (!faqId) return NextResponse.json({ error: "faqId required" }, { status: 400 });
      const item = await rejectFaqItem(faqId, reviewerName, reason);
      return NextResponse.json({ success: true, item });
    }

    if (action === "EDIT") {
      if (!faqId || !updates) return NextResponse.json({ error: "faqId and updates required" }, { status: 400 });
      const item = await editFaqItem(faqId, updates, reviewerName);
      return NextResponse.json({ success: true, item });
    }

    if (action === "DEACTIVATE") {
      if (!faqId) return NextResponse.json({ error: "faqId required" }, { status: 400 });
      const item = await deactivateFaqItem(faqId, reviewerName);
      return NextResponse.json({ success: true, item });
    }

    if (action === "NO_UPDATE_NEEDED") {
      if (!faqId) return NextResponse.json({ error: "faqId required" }, { status: 400 });
      const item = await resolveFaqNoUpdateNeeded(faqId, reviewerName, reason);
      return NextResponse.json({ success: true, item });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error: any) {
    console.error("POST /api/admin/knowledge/[id]/faqs error:", error);
    return NextResponse.json({ error: error.message || "Failed to process FAQ action" }, { status: 500 });
  }
}
