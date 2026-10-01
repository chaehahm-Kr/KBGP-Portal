import {
  KnowledgeItem,
  KnowledgeFaqItem,
  FaqStatus,
  FaqKind,
  AudienceType,
  SecurityUserContext
} from "./types";
import {
  getStoreKnowledgeItems,
  getStoreKnowledgeById,
  getStoreFaqs,
  getStoreFaqById,
  saveStoreFaq,
  deleteStoreFaq,
  addStoreAuditLog
} from "./store";
import { isEligibleForAudience } from "./distribution";
import { normalizeQueryString, calculateLevenshtein } from "./search";

/**
 * Checks similarity between two questions to prevent duplicate candidates.
 */
export function isDuplicateQuestion(q1: string, q2: string): boolean {
  const norm1 = normalizeQueryString(q1);
  const norm2 = normalizeQueryString(q2);

  if (norm1 === norm2) return true;
  if (norm1.includes(norm2) || norm2.includes(norm1)) {
    const minLen = Math.min(norm1.length, norm2.length);
    if (minLen >= 8) return true;
  }

  const dist = calculateLevenshtein(norm1, norm2);
  const maxLen = Math.max(norm1.length, norm2.length);
  if (maxLen > 0 && dist / maxLen < 0.25) {
    return true;
  }

  return false;
}

/**
 * Candidate Generation Engine: Generates grounded FAQ & Suggested Question candidates
 * strictly derived from a Published Knowledge document.
 *
 * CRITICAL GOVERNANCE PRINCIPLE:
 * AI Generated !== Published FAQ.
 * Every generated item starts strictly in 'CANDIDATE' status.
 */
export async function generateFaqCandidatesForKnowledge(
  knowledgeId: string,
  userContext?: SecurityUserContext
): Promise<{ success: boolean; createdCount: number; items: KnowledgeFaqItem[]; message?: string }> {
  const item = await getStoreKnowledgeById(knowledgeId);
  if (!item) {
    throw new Error(`Knowledge item '${knowledgeId}' not found.`);
  }

  if (item.status !== "PUBLISHED") {
    throw new Error(`Cannot generate FAQ from non-published knowledge (Current status: ${item.status}). Only PUBLISHED knowledge is eligible.`);
  }

  const existingFaqs = await getStoreFaqs(knowledgeId);
  const candidatesToCreate: Array<{
    question_ko: string;
    question_en: string;
    answer_ko: string;
    answer_en: string;
    kind: FaqKind;
    display_order: number;
    is_featured: boolean;
  }> = [];

  const now = new Date().toISOString();
  const titleText = (item.title_ko || item.title || "").toLowerCase();
  const isBrandPolicy = item.id === "kno-brand-policy-v10" || item.slug?.includes("brand-policy") || titleText.includes("브랜드 등록");
  const isInsights = item.category === "INSIGHTS" || item.module === "INSIGHTS";

  if (isBrandPolicy) {
    // Grounded FAQ Candidates derived directly from MAN-BRAND-001 (6 Core Policies)
    candidatesToCreate.push(
      {
        question_ko: "브랜드는 어떻게 등록하나요?",
        question_en: "How do I register a brand in the portal?",
        answer_ko: "포털 내 브랜드 관리 메뉴(/portal/brands) 또는 신규 등록 화면(/portal/brands/new)에서 브랜드 국문/영문명, 사업자 등록번호, 대표 카테고리, 슬로건 및 물류 출고지/반품지 정보를 입력하여 등록합니다. 상품 등록 전 활성 브랜드 등록이 필수입니다. (Policy 01)",
        answer_en: "Navigate to Brand Management (/portal/brands) or New Brand (/portal/brands/new) to enter brand names, business ID, category, and logistics origins. Brand registration is mandatory before product listings. (Policy 01)",
        kind: "BOTH",
        display_order: 1,
        is_featured: true
      },
      {
        question_ko: "상표권이 없어도 브랜드 등록이 가능한가요?",
        question_en: "Can I register a brand without an official trademark?",
        answer_ko: "네, 가능합니다. 포털 내 브랜드 등록은 카탈로그 분류를 위한 것이며, 특허청(KIPO/USPTO) 상표권 등록이 필수 전제 조건은 아닙니다. 상표권이 없거나 출원 중인 브랜드도 자유롭게 등록하여 입점할 수 있습니다. (Policy 02)",
        answer_en: "Yes. Brand registration in the portal is for catalog classification and does not require official trademark registration. Brands without trademarks or with pending applications can be registered. (Policy 02)",
        kind: "BOTH",
        display_order: 2,
        is_featured: true
      },
      {
        question_ko: "상품이 연결된 브랜드를 삭제할 수 있나요?",
        question_en: "Can I delete a brand that has associated products?",
        answer_ko: "단 1건이라도 상품이 등록된 브랜드는 발주·통관·인보이스 무결성 보존을 위해 물리 삭제(Hard Delete)가 절대 불가합니다. 취급 중단 시 영구 삭제 대신 '사용 중단(Inactive)' 비활성화 처리를 적용하며, 언제든지 재활성화가 가능합니다. (Policy 05 & 06)",
        answer_en: "Brands associated with even one product cannot be physically hard-deleted to preserve order, customs, and invoice audit integrity. Use Inactive status instead. (Policy 05 & 06)",
        kind: "BOTH",
        display_order: 3,
        is_featured: true
      },
      {
        question_ko: "동일한 브랜드를 여러 회사가 취급할 수 있나요?",
        question_en: "Can multiple partner companies distribute the same brand?",
        answer_ko: "네, 글로벌 B2B 유통 구조를 반영하여 동일 브랜드를 여러 회사(제조사, 공식 총판, 셀러)가 독립적으로 취급할 수 있습니다. 단, 지식재산권을 직접 보유한 원천 Brand Owner는 시스템상 1개사로 정의됩니다. (Policy 03 & 04)",
        answer_en: "Yes. Multiple independent companies (manufacturers, distributors, sellers) can distribute the same brand, while authoritative Brand Ownership is maintained at 1 entity. (Policy 03 & 04)",
        kind: "BOTH",
        display_order: 4,
        is_featured: false
      },
      {
        question_ko: "사용하지 않는 브랜드는 어떻게 처리하나요?",
        question_en: "How do I handle unused or discontinued brands?",
        answer_ko: "취급을 중단하거나 사용하지 않는 브랜드는 브랜드 관리 목록에서 '사용 중단(Inactive)'으로 전환합니다. 비활성화된 브랜드는 신규 상품 등록 목록에서 제외되지만 기존 거래 내역은 안전하게 보존됩니다. (Policy 06)",
        answer_en: "Set discontinued brands to Inactive in the Brand Management screen. Inactive brands are hidden from new product selection while preserving audit history. (Policy 06)",
        kind: "BOTH",
        display_order: 5,
        is_featured: false
      }
    );
  } else if (isInsights) {
    candidatesToCreate.push(
      {
        question_ko: "INSIGHTS Topic Score 기준은 몇 점인가요?",
        question_en: "What is the Topic Score threshold for INSIGHTS?",
        answer_ko: "현재 적용 중인 Topic Score 기준점은 80점 이상입니다. 80점을 통과한 주제만 Daily Insight Candidate로 채택되며, 기준 통과 항목이 없을 경우 당일 초안이 0개인 것도 정상 동작입니다.",
        answer_en: "The current Topic Score threshold is 80+ points. Topics meeting 80+ are selected as Daily Candidates; 0 draft days are normal.",
        kind: "BOTH",
        display_order: 1,
        is_featured: true
      },
      {
        question_ko: "HIGH Risk Claim은 무엇을 확인해야 하나요?",
        question_en: "What verification is required for HIGH Risk claims?",
        answer_ko: "규제(Regulation), 정확한 숫자(%), 금액($), 시장 규모 및 성장률을 포함한 문장은 HIGH Risk로 분류되며, 승인 전 반드시 뒷받침하는 원본 근거(Source / Evidence)를 직접 재확인해야 합니다.",
        answer_en: "Regulations, %, $, and growth rate claims are classified as HIGH Risk requiring mandatory source trace verification before approval.",
        kind: "BOTH",
        display_order: 2,
        is_featured: true
      }
    );
  } else {
    // Generic Grounded Fallback Candidates from Item Content
    const summaryKo = item.summary_ko || item.title_ko || item.title;
    candidatesToCreate.push(
      {
        question_ko: `${item.title_ko || item.title}의 주요 운영 기준은 무엇인가요?`,
        question_en: `What are the core operating standards for ${item.title_en || item.title}?`,
        answer_ko: `${summaryKo}. 상세 절차는 공식 승인된 ${item.current_version} 매뉴얼 문서를 참조해 주시기 바랍니다.`,
        answer_en: `${item.summary_en || summaryKo}. Refer to official ${item.current_version} document.`,
        kind: "BOTH",
        display_order: 1,
        is_featured: true
      }
    );
  }

  // Duplicate Guard Filter
  const createdItems: KnowledgeFaqItem[] = [];

  for (const cand of candidatesToCreate) {
    const isDup = existingFaqs.some(ef =>
      isDuplicateQuestion(ef.question_ko, cand.question_ko) ||
      (cand.question_en && ef.question_en && isDuplicateQuestion(ef.question_en, cand.question_en))
    );

    if (!isDup) {
      const newFaq: KnowledgeFaqItem = {
        id: `faq-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        source_knowledge_id: item.id,
        source_version: item.current_version || "v1.0",
        source_title: item.title_ko || item.title,
        question_ko: cand.question_ko,
        question_en: cand.question_en,
        answer_ko: cand.answer_ko,
        answer_en: cand.answer_en,
        audience: item.audience,
        status: "CANDIDATE", // Strictly starts as CANDIDATE
        kind: cand.kind,
        display_order: cand.display_order,
        is_featured: cand.is_featured,
        generated_by: "AI",
        created_at: now,
        updated_at: now
      };

      await saveStoreFaq(newFaq);
      createdItems.push(newFaq);

      await addStoreAuditLog({
        id: `log-faq-gen-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        knowledge_id: item.id,
        user_name: userContext?.userId || "Admin (AI Generator)",
        action: "FAQ Candidate Generated",
        previous_value: undefined,
        new_value: { faqId: newFaq.id, question: newFaq.question_ko, status: "CANDIDATE" },
        reason: `Auto-generated FAQ candidate from ${item.title} (${item.current_version})`,
        created_at: now
      });
    }
  }

  return {
    success: true,
    createdCount: createdItems.length,
    items: createdItems,
    message: createdItems.length > 0
      ? `${createdItems.length}개의 신규 FAQ/질문 후보가 생성되었습니다 (검토 대기 상태).`
      : "중복되지 않는 신규 질문 후보가 없습니다 (기존 후보/승인 목록 유지)."
  };
}

/**
 * Approves a FAQ candidate for official distribution.
 */
export async function approveFaqItem(
  faqId: string,
  reviewerName: string = "Admin",
  reviewNote?: string
): Promise<KnowledgeFaqItem> {
  const faq = await getStoreFaqById(faqId);
  if (!faq) {
    throw new Error(`FAQ item '${faqId}' not found.`);
  }

  const now = new Date().toISOString();
  const prevStatus = faq.status;

  const updatedFaq: KnowledgeFaqItem = {
    ...faq,
    status: "APPROVED",
    reviewed_by: reviewerName,
    reviewed_at: now,
    review_note: reviewNote || faq.review_note,
    updated_at: now
  };

  await saveStoreFaq(updatedFaq);

  await addStoreAuditLog({
    id: `log-faq-appr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    knowledge_id: faq.source_knowledge_id,
    user_name: reviewerName,
    action: "FAQ Approved",
    previous_value: { status: prevStatus },
    new_value: { status: "APPROVED", faqId, question: faq.question_ko },
    reason: reviewNote || "Admin reviewed and approved FAQ for official distribution.",
    created_at: now
  });

  return updatedFaq;
}

/**
 * Rejects a FAQ candidate.
 */
export async function rejectFaqItem(
  faqId: string,
  reviewerName: string = "Admin",
  reviewNote?: string
): Promise<KnowledgeFaqItem> {
  const faq = await getStoreFaqById(faqId);
  if (!faq) {
    throw new Error(`FAQ item '${faqId}' not found.`);
  }

  const now = new Date().toISOString();
  const prevStatus = faq.status;

  const updatedFaq: KnowledgeFaqItem = {
    ...faq,
    status: "REJECTED",
    reviewed_by: reviewerName,
    reviewed_at: now,
    review_note: reviewNote || faq.review_note,
    updated_at: now
  };

  await saveStoreFaq(updatedFaq);

  await addStoreAuditLog({
    id: `log-faq-rej-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    knowledge_id: faq.source_knowledge_id,
    user_name: reviewerName,
    action: "FAQ Rejected",
    previous_value: { status: prevStatus },
    new_value: { status: "REJECTED", faqId, question: faq.question_ko },
    reason: reviewNote || "Admin rejected FAQ candidate.",
    created_at: now
  });

  return updatedFaq;
}

/**
 * Deactivates an existing approved FAQ.
 */
export async function deactivateFaqItem(
  faqId: string,
  reviewerName: string = "Admin"
): Promise<KnowledgeFaqItem> {
  const faq = await getStoreFaqById(faqId);
  if (!faq) {
    throw new Error(`FAQ item '${faqId}' not found.`);
  }

  const now = new Date().toISOString();
  const updatedFaq: KnowledgeFaqItem = {
    ...faq,
    status: "INACTIVE",
    updated_at: now
  };

  await saveStoreFaq(updatedFaq);

  await addStoreAuditLog({
    id: `log-faq-deact-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    knowledge_id: faq.source_knowledge_id,
    user_name: reviewerName,
    action: "FAQ Deactivated",
    previous_value: { status: faq.status },
    new_value: { status: "INACTIVE", faqId },
    reason: "Admin deactivated FAQ.",
    created_at: now
  });

  return updatedFaq;
}

/**
 * Edits a FAQ item (Human Editing Governance).
 */
export async function editFaqItem(
  faqId: string,
  updates: Partial<KnowledgeFaqItem>,
  editorName: string = "Admin"
): Promise<KnowledgeFaqItem> {
  const faq = await getStoreFaqById(faqId);
  if (!faq) {
    throw new Error(`FAQ item '${faqId}' not found.`);
  }

  const now = new Date().toISOString();
  const updatedFaq: KnowledgeFaqItem = {
    ...faq,
    ...updates,
    id: faq.id,
    source_knowledge_id: updates.source_knowledge_id || faq.source_knowledge_id,
    updated_at: now
  };

  await saveStoreFaq(updatedFaq);

  await addStoreAuditLog({
    id: `log-faq-edit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    knowledge_id: faq.source_knowledge_id,
    user_name: editorName,
    action: "FAQ Edited",
    previous_value: { question: faq.question_ko, answer: faq.answer_ko, status: faq.status, topic_id: faq.topic_id },
    new_value: { question: updatedFaq.question_ko, answer: updatedFaq.answer_ko, status: updatedFaq.status, topic_id: updatedFaq.topic_id },
    reason: "Admin edited FAQ item.",
    created_at: now
  });

  return updatedFaq;
}

/**
 * Manually creates a new FAQ item linked to an authoritative Published Knowledge item or standalone.
 */
export async function createManualFaqItem(params: {
  source_knowledge_id?: string;
  portal_scope?: "BRAND" | "RETAILER";
  topic_id?: string | null;
  question_ko: string;
  question_en?: string;
  answer_ko: string;
  answer_en?: string;
  audience?: AudienceType[];
  status?: FaqStatus;
  kind?: FaqKind;
  display_order?: number;
  is_featured?: boolean;
  createdBy?: string;
}): Promise<KnowledgeFaqItem> {
  let sourceId = params.source_knowledge_id;
  let sourceTitle = "Direct Admin FAQ";
  let sourceVersion = "v1.0";
  let itemAudience: AudienceType[] = params.portal_scope === "RETAILER" ? ["RETAILER"] : ["BRAND"];

  if (sourceId) {
    const item = await getStoreKnowledgeById(sourceId);
    if (item) {
      sourceTitle = item.title_ko || item.title;
      sourceVersion = item.current_version || "v1.0";
      itemAudience = item.audience;
    }
  } else {
    // Default fallback to knowledge item if any
    const allKnowledge = await getStoreKnowledgeItems();
    const defaultItem = allKnowledge.find(k => k.status === "PUBLISHED");
    if (defaultItem) {
      sourceId = defaultItem.id;
      sourceTitle = defaultItem.title_ko || defaultItem.title;
      sourceVersion = defaultItem.current_version || "v1.0";
    } else {
      sourceId = "kno-brand-policy-v10";
    }
  }

  const now = new Date().toISOString();
  const portalScope = params.portal_scope || (params.audience?.some(a => a.includes("RETAIL")) ? "RETAILER" : "BRAND");

  const newFaq: KnowledgeFaqItem = {
    id: `faq-man-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    portal_scope: portalScope,
    topic_id: params.topic_id || null,
    source_knowledge_id: sourceId!,
    source_version: sourceVersion,
    source_title: sourceTitle,
    question_ko: params.question_ko.trim(),
    question_en: params.question_en?.trim() || "",
    answer_ko: params.answer_ko.trim(),
    answer_en: params.answer_en?.trim() || "",
    audience: params.audience || (portalScope === "RETAILER" ? ["RETAILER", "INTERNAL"] : ["BRAND", "INTERNAL", "ADMIN / MANAGEMENT"]),
    status: params.status || "APPROVED",
    kind: params.kind || "BOTH",
    display_order: params.display_order ?? 0,
    is_featured: params.is_featured ?? false,
    generated_by: "MANUAL",
    created_at: now,
    updated_at: now
  };

  await saveStoreFaq(newFaq);

  await addStoreAuditLog({
    id: `log-faq-man-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    knowledge_id: sourceId!,
    user_name: params.createdBy || "Admin",
    action: "Manual FAQ Created",
    previous_value: undefined,
    new_value: { faqId: newFaq.id, question: newFaq.question_ko, portal_scope: portalScope, topic_id: newFaq.topic_id },
    reason: "Admin manually created FAQ.",
    created_at: now
  });

  return newFaq;
}


/**
 * Source Version Governance: Triggers UPDATE_REQUIRED review for linked approved FAQs
 * when a new version of the parent knowledge is published.
 *
 * DO NOT AUTOMATICALLY REWRITE FAQ.
 */
export async function triggerSourceVersionFaqImpact(
  knowledgeId: string,
  newVersion: string,
  triggeredBy: string = "Version Publication Governance"
): Promise<{ impactedCount: number; faqIds: string[] }> {
  const allFaqs = await getStoreFaqs(knowledgeId);
  const approvedFaqs = allFaqs.filter(f => f.status === "APPROVED" && f.source_version !== newVersion);

  const now = new Date().toISOString();
  const impactedIds: string[] = [];

  for (const faq of approvedFaqs) {
    const updated: KnowledgeFaqItem = {
      ...faq,
      status: "UPDATE_REQUIRED",
      review_note: `Source published new version (${newVersion}). Human review required to verify FAQ validity.`,
      updated_at: now
    };
    await saveStoreFaq(updated);
    impactedIds.push(faq.id);

    await addStoreAuditLog({
      id: `log-faq-ver-impact-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      knowledge_id: knowledgeId,
      user_name: triggeredBy,
      action: "FAQ Impact Detected: UPDATE_REQUIRED",
      previous_value: { status: "APPROVED", source_version: faq.source_version },
      new_value: { status: "UPDATE_REQUIRED", latest_source_version: newVersion },
      reason: `Source knowledge updated to ${newVersion}. FAQ flagged for review.`,
      created_at: now
    });
  }

  return { impactedCount: impactedIds.length, faqIds: impactedIds };
}

/**
 * No Update Needed Review: Admin confirms existing FAQ is still accurate despite source version change.
 */
export async function resolveFaqNoUpdateNeeded(
  faqId: string,
  reviewerName: string = "Admin",
  reason: string = "FAQ remains accurate and valid with current source version."
): Promise<KnowledgeFaqItem> {
  const faq = await getStoreFaqById(faqId);
  if (!faq) {
    throw new Error(`FAQ item '${faqId}' not found.`);
  }

  const parentItem = await getStoreKnowledgeById(faq.source_knowledge_id);
  const currentVer = parentItem?.current_version || faq.source_version;
  const now = new Date().toISOString();

  const updatedFaq: KnowledgeFaqItem = {
    ...faq,
    source_version: currentVer,
    status: "APPROVED",
    reviewed_by: reviewerName,
    reviewed_at: now,
    review_note: reason,
    updated_at: now
  };

  await saveStoreFaq(updatedFaq);

  await addStoreAuditLog({
    id: `log-faq-no-update-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    knowledge_id: faq.source_knowledge_id,
    user_name: reviewerName,
    action: "FAQ Review: No Update Needed",
    previous_value: { status: faq.status, source_version: faq.source_version },
    new_value: { status: "APPROVED", source_version: currentVer },
    reason,
    created_at: now
  });

  return updatedFaq;
}

/**
 * Audience-Scoped FAQ Retrieval:
 * Strictly retrieves ONLY Approved, Non-Sensitive FAQs linked to eligible Published Knowledge.
 */
export async function getApprovedFaqsForAudience(
  audience: AudienceType,
  options?: {
    kind?: FaqKind;
    topic_id?: string;
    search?: string;
    limit?: number;
  }
): Promise<KnowledgeFaqItem[]> {
  const allItems = await getStoreKnowledgeItems();
  const eligibleItems = allItems.filter(item => isEligibleForAudience(item, audience));

  if (eligibleItems.length === 0) {
    return []; // Strict zero fabrication
  }

  const eligibleKnowledgeIds = new Set(eligibleItems.map(i => i.id));
  const allFaqs = await getStoreFaqs();

  let filtered = allFaqs.filter(faq => {
    // Rule 1: Must be APPROVED
    if (faq.status !== "APPROVED") return false;

    // Rule 2: Must be linked to an eligible Published Knowledge document
    if (!eligibleKnowledgeIds.has(faq.source_knowledge_id)) return false;

    // Rule 3: Audience matching
    const auds = (faq.audience || []).map(a => a.toUpperCase());
    const target = audience.toUpperCase();

    if (target === "BRAND" && !auds.includes("BRAND")) return false;
    if ((target === "RETAIL" || target === "RETAILER") && (!auds.includes("RETAIL") && !auds.includes("RETAILER"))) return false;
    if (target === "PUBLIC" && !auds.includes("PUBLIC")) return false;

    // Rule 4: Topic filter
    if (options?.topic_id && faq.topic_id !== options.topic_id) return false;

    // Rule 5: Kind filter (FAQ, SUGGESTED_QUESTION, BOTH)
    if (options?.kind) {
      if (options.kind === "FAQ" && faq.kind !== "FAQ" && faq.kind !== "BOTH") return false;
      if (options.kind === "SUGGESTED_QUESTION" && faq.kind !== "SUGGESTED_QUESTION" && faq.kind !== "BOTH") return false;
    }

    return true;
  });

  // Search filter
  if (options?.search) {
    const q = options.search.toLowerCase().trim();
    filtered = filtered.filter(f =>
      f.question_ko.toLowerCase().includes(q) ||
      (f.question_en && f.question_en.toLowerCase().includes(q)) ||
      f.answer_ko.toLowerCase().includes(q) ||
      (f.answer_en && f.answer_en.toLowerCase().includes(q)) ||
      f.source_title.toLowerCase().includes(q)
    );
  }

  // Ordering: is_featured first, then display_order ascending, then created_at descending
  filtered.sort((a, b) => {
    if (a.is_featured && !b.is_featured) return -1;
    if (!a.is_featured && b.is_featured) return 1;
    if (a.display_order !== b.display_order) return a.display_order - b.display_order;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  if (options?.limit && options.limit > 0) {
    filtered = filtered.slice(0, options.limit);
  }

  return filtered;
}

