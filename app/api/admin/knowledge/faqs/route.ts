import { NextRequest, NextResponse } from "next/server";
import {
  getStoreFaqs,
  getStoreFaqById,
  saveStoreFaq,
  deleteStoreFaq,
  getStoreKnowledgeItems,
  getStoreTopics
} from "@/lib/knowledge/store";
import {
  createManualFaqItem,
  editFaqItem,
  approveFaqItem,
  rejectFaqItem,
  deactivateFaqItem,
  resolveFaqNoUpdateNeeded
} from "@/lib/knowledge/faq-engine";
import { PortalScope, FaqStatus, FaqKind } from "@/lib/knowledge/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const portalScope = (searchParams.get("portal_scope") as PortalScope) || undefined;
    const topicId = searchParams.get("topic_id") || undefined;
    const status = (searchParams.get("status") as FaqStatus) || undefined;

    const faqs = await getStoreFaqs(undefined, status, undefined, portalScope, topicId);
    return NextResponse.json({ success: true, count: faqs.length, faqs });
  } catch (error: any) {
    console.error("GET /api/admin/knowledge/faqs error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch faqs" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, faqId, updates, reason, reviewerName = "Admin", manualFaq, orderedIds, portalScope } = body;

    if (action === "CREATE") {
      if (!manualFaq?.question_ko || !manualFaq?.answer_ko) {
        return NextResponse.json({ error: "question_ko and answer_ko are required" }, { status: 400 });
      }

      // Check audience isolation if source_knowledge_id is given
      if (manualFaq.source_knowledge_id) {
        const allKnowledge = await getStoreKnowledgeItems();
        const src = allKnowledge.find(k => k.id === manualFaq.source_knowledge_id);
        if (src) {
          const isRetailTarget = manualFaq.portal_scope === "RETAILER";
          const isBrandTarget = manualFaq.portal_scope === "BRAND";
          if (isRetailTarget && src.audience && !src.audience.includes("RETAILER") && !src.audience.includes("PUBLIC")) {
            return NextResponse.json({ error: `해당 Knowledge(${src.title_ko})는 Retailer 대상이 아니므로 Retail FAQ에 연결할 수 없습니다.` }, { status: 400 });
          }
          if (isBrandTarget && src.audience && !src.audience.includes("BRAND") && !src.audience.includes("PUBLIC")) {
            return NextResponse.json({ error: `해당 Knowledge(${src.title_ko})는 Brand 대상이 아니므로 Brand FAQ에 연결할 수 없습니다.` }, { status: 400 });
          }
        }
      }

      const item = await createManualFaqItem({
        source_knowledge_id: manualFaq.source_knowledge_id,
        portal_scope: manualFaq.portal_scope || "BRAND",
        topic_id: manualFaq.topic_id || null,
        question_ko: manualFaq.question_ko,
        question_en: manualFaq.question_en,
        answer_ko: manualFaq.answer_ko,
        answer_en: manualFaq.answer_en,
        audience: manualFaq.audience,
        status: manualFaq.status || "APPROVED",
        kind: manualFaq.kind || "BOTH",
        display_order: manualFaq.display_order ?? 0,
        is_featured: manualFaq.is_featured ?? false,
        createdBy: reviewerName
      });
      return NextResponse.json({ success: true, item });
    }

    if (action === "EDIT") {
      if (!faqId || !updates) return NextResponse.json({ error: "faqId and updates required" }, { status: 400 });
      const item = await editFaqItem(faqId, updates, reviewerName);
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

    if (action === "DEACTIVATE") {
      if (!faqId) return NextResponse.json({ error: "faqId required" }, { status: 400 });
      const item = await deactivateFaqItem(faqId, reviewerName);
      return NextResponse.json({ success: true, item });
    }

    if (action === "DELETE") {
      if (!faqId) return NextResponse.json({ error: "faqId required" }, { status: 400 });
      await deleteStoreFaq(faqId);
      return NextResponse.json({ success: true, message: `FAQ ${faqId} deleted` });
    }

    if (action === "REORDER") {
      if (!Array.isArray(orderedIds)) return NextResponse.json({ error: "orderedIds array required" }, { status: 400 });
      for (let i = 0; i < orderedIds.length; i++) {
        const id = orderedIds[i];
        const faq = await getStoreFaqById(id);
        if (faq) {
          faq.display_order = i + 1;
          await saveStoreFaq(faq);
        }
      }
      const allUpdated = await getStoreFaqs(undefined, undefined, undefined, portalScope);
      return NextResponse.json({ success: true, faqs: allUpdated });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error: any) {
    console.error("POST /api/admin/knowledge/faqs error:", error);
    return NextResponse.json({ error: error.message || "Failed to process FAQ action" }, { status: 500 });
  }
}
