import {
  KnowledgeItem,
  SecurityUserContext,
  AudienceType,
  UserRole,
  KnowledgeType,
  KnowledgeStatus
} from "./types";
import { getStoreKnowledgeItems, getStoreRelations, getStoreAssets } from "./store";
import { isEligibleForAudience } from "./distribution";
import { calculateLevenshtein, normalizeQueryString } from "./search";

export interface AskSourceCitation {
  id: string;
  slug: string;
  title: string;
  type: KnowledgeType;
  version: string;
  status: KnowledgeStatus;
  effectiveDate: string;
  url: string;
  documentUrl?: string | null;
  documentName?: string | null;
  isLiveRule?: boolean;
}

export interface AskActionLink {
  label: string;
  url: string;
  type: "knowledge" | "manual" | "download" | "route" | "support" | "help" | "gap";
}

export interface AskAnswerResponse {
  id: string;
  question: string;
  directAnswer: string;
  currentRuleBullets?: string[];
  liveRuleNote?: string | null;
  sources: AskSourceCitation[];
  relatedManuals?: Array<{
    id: string;
    title: string;
    version: string;
    status: string;
    audience: string;
    viewUrl: string;
    downloadUrl: string;
  }>;
  relatedQuestions?: string[];
  actions: AskActionLink[];
  isUnknown: boolean;
  isReadonlyActionAttempt: boolean;
  createdAt: string;
  audience: AudienceType;
}

export interface AskQuestionOptions {
  question: string;
  audience?: AudienceType;
  userContext: SecurityUserContext;
  currentRoute?: string;
  selectedModule?: string;
}

/**
 * Resolves authoritative audience based on server session role and requested audience.
 * Enforces Deny-by-Default security: Non-admin users cannot escalate to INTERNAL.
 */
export function resolveServerAudience(
  userRole: UserRole,
  requestedAudience?: AudienceType
): AudienceType {
  if (userRole === "admin") {
    if (requestedAudience === "BRAND") return "BRAND";
    if (requestedAudience === "RETAILER" || requestedAudience === "RETAIL" as any) return "RETAILER";
    if (requestedAudience === "PUBLIC") return "PUBLIC";
    return "INTERNAL";
  }

  if (userRole === "brand" || requestedAudience === "BRAND") {
    return "BRAND";
  }

  if (userRole === "retailer" || requestedAudience === "RETAILER" || requestedAudience === "RETAIL" as any) {
    return "RETAILER";
  }

  return "BRAND";
}

/**
 * Checks for prompt injection and system penetration attempts.
 */
function checkPromptInjectionOrAttack(q: string): boolean {
  const lower = q.toLowerCase();
  const suspiciousPatterns = [
    "ignore previous instructions",
    "ignore all previous rules",
    "system prompt",
    "시스템 프롬프트",
    "프롬프트를 보여줘",
    "show instructions",
    "reveal secret",
    "admin password",
    "관리자 비밀번호",
    "drop table",
    "select * from",
    "bypass security",
    "auth token",
    "service_role",
    "supabase_service"
  ];
  return suspiciousPatterns.some(p => lower.includes(p));
}

/**
 * Checks for general off-topic questions (e.g. weather, crypto, cooking).
 */
function checkGeneralOutOfScope(q: string): boolean {
  const lower = q.toLowerCase();
  const outOfScopeKeywords = [
    "오늘 날씨",
    "weather",
    "비트코인",
    "bitcoin",
    "주가",
    "stock price",
    "요리법",
    "recipe",
    "who is the president",
    "write a poem",
    "시 써줘",
    "노래 가사",
    "아이돌"
  ];
  return outOfScopeKeywords.some(kw => lower.includes(kw));
}

/**
 * Checks for write / mutation action attempts in Ask Assistant.
 */
function checkWriteActionAttempt(q: string): { isAttempt: boolean; actionType: string } {
  if (
    q.includes("변경해줘") ||
    q.includes("바꿔줘") ||
    q.includes("수정해줘") ||
    q.includes("설정해줘") ||
    q.includes("modify") ||
    q.includes("change setting")
  ) {
    return { isAttempt: true, actionType: "SETTING_CHANGE" };
  }
  if (q.includes("승인해줘") || q.includes("approve this") || q.includes("publish this")) {
    return { isAttempt: true, actionType: "APPROVE_INSIGHT" };
  }
  if (q.includes("삭제해줘") || q.includes("delete this") || q.includes("archive this")) {
    return { isAttempt: true, actionType: "DELETE_KNOWLEDGE" };
  }
  return { isAttempt: false, actionType: "" };
}

/**
 * Main Grounded Knowledge Assistant Engine for K SELECT.
 * Serves Admin (Internal), Brand Portal (Brand), and Retail Portal (Retailer).
 */
export async function processAskQuestion(
  options: AskQuestionOptions
): Promise<AskAnswerResponse> {
  const { question, userContext, currentRoute = "/portal/help", selectedModule } = options;
  const now = new Date().toISOString();
  const cleanQ = normalizeQueryString(question);
  const rawQ = question.trim();

  // 1. Audience Resolution (Server-Side Enforced)
  const audience = resolveServerAudience(userContext.role, options.audience);

  // 2. Base Help and Support URLs by Audience
  const helpBasePath = audience === "BRAND"
    ? "/portal/help"
    : audience === "RETAILER"
    ? "/retailer/help"
    : "/admin/knowledge";

  const supportPath = audience === "BRAND"
    ? "/portal/support"
    : audience === "RETAILER"
    ? "/retailer/support"
    : "/admin/knowledge/review";

  // 3. Check for Prompt Injection / Security Attacks
  if (checkPromptInjectionOrAttack(cleanQ)) {
    return {
      id: `ans-sec-${Date.now()}`,
      question: rawQ,
      directAnswer: "K SELECT의 공식 매뉴얼 및 정책에 관한 질문만 안내해 드릴 수 있습니다. 시스템 보안 정책에 따라 내부 시스템 지침이나 비공개 설정은 제공되지 않습니다.",
      currentRuleBullets: [
        "보안 원칙: K SELECT 공식 어시스턴트는 시스템 프롬프트 및 비공개 내부 설정 조회를 엄격히 차단합니다.",
        "운영 문의: 플랫폼 사용 방법이나 정책에 관해 질문해 주시면 공식 도움말을 안내해 드립니다."
      ],
      sources: [],
      actions: [
        { label: "Help Center 홈", url: helpBasePath, type: "help" },
        { label: "1:1 문의하기", url: supportPath, type: "support" }
      ],
      isUnknown: true,
      isReadonlyActionAttempt: false,
      createdAt: now,
      audience
    };
  }

  // 4. Check for General Out-of-Scope Questions
  if (checkGeneralOutOfScope(cleanQ)) {
    return {
      id: `ans-scope-${Date.now()}`,
      question: rawQ,
      directAnswer: "K SELECT 공식 어시스턴트는 K SELECT 플랫폼의 이용 정책, 브랜드/상품 등록 절차, 유통 및 운영 매뉴얼에 특화되어 있습니다. 질문하신 일반 문의에 대한 공식 지식은 등록되어 있지 않습니다.",
      currentRuleBullets: [
        "적용 범위: K SELECT 브랜드 관리, 파트너 온보딩, 발주/정산, 운영 정책 등 공식 지식에 대한 답변을 제공합니다.",
        "도움말 검색: 플랫폼 사용법이 궁금하시다면 아래 도움말 센터를 확인해 주세요."
      ],
      sources: [],
      actions: [
        { label: "Help Center에서 정책 찾기", url: helpBasePath, type: "help" },
        { label: "1:1 문의하기", url: supportPath, type: "support" }
      ],
      isUnknown: true,
      isReadonlyActionAttempt: false,
      createdAt: now,
      audience
    };
  }

  // 5. Check for Write Action Attempts
  const writeAttempt = checkWriteActionAttempt(cleanQ);
  if (writeAttempt.isAttempt) {
    return {
      id: `ans-readonly-${Date.now()}`,
      question: rawQ,
      directAnswer: "Ask K SELECT는 조회 및 안내 전용(READ-ONLY) 어시스턴트입니다. 시스템 설정 변경, 데이터 삭제, 게시물 승인 등의 작업은 해당 관리 페이지에서 직접 수행해 주셔야 합니다.",
      currentRuleBullets: [
        "직접 설정: 브랜드 정보 수정은 브랜드 관리 메뉴에서, 설정 변경은 해당 관리 화면에서 실행해 주세요.",
        "정책 가이드: 각 기능의 상세 변경 방법은 공식 매뉴얼을 통해 확인하실 수 있습니다."
      ],
      sources: [],
      actions: [
        { label: "Help Center 홈", url: helpBasePath, type: "help" },
        { label: "1:1 문의하기", url: supportPath, type: "support" }
      ],
      isUnknown: false,
      isReadonlyActionAttempt: true,
      createdAt: now,
      audience
    };
  }

  // 6. RETRIEVAL-LEVEL SECURITY: Fetch ONLY eligible Published Knowledge items for this audience
  const allItems = await getStoreKnowledgeItems();
  const eligibleItems = allItems.filter(item => isEligibleForAudience(item, audience));

  // 7. If NO eligible published knowledge exists (e.g. Retail Portal currently has 0 published items)
  if (eligibleItems.length === 0) {
    const audienceDisplayName = audience === "BRAND"
      ? "Brand Portal"
      : audience === "RETAILER"
      ? "Retail Portal"
      : "K SELECT";

    return {
      id: `ans-empty-${Date.now()}`,
      question: rawQ,
      directAnswer: `현재 등록된 ${audienceDisplayName} 공식 도움말에서 이 질문에 대한 충분한 정보를 찾지 못했습니다. K SELECT는 임의 추정이나 확인되지 않은 정책을 생성하여 답변하지 않습니다.`,
      currentRuleBullets: [
        "절대 원칙 (NO FABRICATION): 공식 승인 및 배포된 도움말/매뉴얼 문서가 없는 경우 답변 생성이 엄격히 제한됩니다.",
        "조치 방법: Help Center에서 전체 문서를 확인하시거나 1:1 문의하기를 통해 운영팀에 직접 문의해 주세요."
      ],
      sources: [],
      actions: [
        { label: "Help Center 둘러보기", url: helpBasePath, type: "help" },
        { label: "1:1 문의하기", url: supportPath, type: "support" }
      ],
      isUnknown: true,
      isReadonlyActionAttempt: false,
      createdAt: now,
      audience
    };
  }

  // 8. Grounded Matching Engine against eligible items
  const scoredCandidates = eligibleItems.map(item => {
    let score = 0;
    const titleText = (item.title + " " + (item.title_ko || "") + " " + (item.title_en || "")).toLowerCase();
    const summaryText = ((item.summary_ko || "") + " " + (item.summary_en || "")).toLowerCase();
    const contentText = ((item.content_ko || "") + " " + (item.content_en || "")).toLowerCase();
    const itemTags = (item.tags || []).map(t => t.toLowerCase());

    const tokens = cleanQ.split(" ").filter(t => t.length >= 2);
    let hasTitleMatch = false;
    let hasTagMatch = false;
    let domainIntentMatch = false;

    tokens.forEach(token => {
      if (titleText.includes(token)) {
        score += 60;
        hasTitleMatch = true;
      }
      if (itemTags.some(tag => tag.includes(token))) {
        score += 40;
        hasTagMatch = true;
      }
      if (summaryText.includes(token)) score += 30;
      if (contentText.includes(token)) score += 15;
    });

    // Specific Domain Intent Matches for Brand Policy (MAN-BRAND-001)
    if (item.id === "kno-brand-policy-v10" || item.slug === "brand-registration-and-management-policy-v1" || item.slug === "man-brand-001-brand-policy") {
      if (cleanQ.includes("브랜드") || cleanQ.includes("brand")) { score += 50; domainIntentMatch = true; }
      if (cleanQ.includes("등록") || cleanQ.includes("전제조건") || cleanQ.includes("신규") || cleanQ.includes("생성")) { score += 50; domainIntentMatch = true; }
      if (cleanQ.includes("상표권") || cleanQ.includes("trademark") || cleanQ.includes("특허청")) { score += 60; domainIntentMatch = true; }
      if (cleanQ.includes("삭제") || cleanQ.includes("delete") || cleanQ.includes("비활성화") || cleanQ.includes("inactive")) { score += 60; domainIntentMatch = true; }
      if (cleanQ.includes("다중") || cleanQ.includes("여러 회사") || cleanQ.includes("총판") || cleanQ.includes("owner")) { score += 50; domainIntentMatch = true; }
      if (cleanQ.includes("상품 등록") || cleanQ.includes("귀속")) { score += 40; domainIntentMatch = true; }
    }

    // Specific Domain Intent Matches for Onboarding Guide (MAN-B-ONB-001)
    if (item.id === "kno-onboarding-guide-v10" || item.slug === "man-b-onb-001-onboarding-guide") {
      if (cleanQ.includes("온보딩") || cleanQ.includes("onboarding") || cleanQ.includes("시작") || cleanQ.includes("가입")) { score += 60; domainIntentMatch = true; }
      if (cleanQ.includes("무엇부터") || cleanQ.includes("절차") || cleanQ.includes("진행") || cleanQ.includes("처음")) { score += 60; domainIntentMatch = true; }
      if (cleanQ.includes("회사 정보") || cleanQ.includes("법인 주소") || cleanQ.includes("주소")) { score += 60; domainIntentMatch = true; }
      if (cleanQ.includes("관리자") || cleanQ.includes("영문 이름") || cleanQ.includes("프로필")) { score += 50; domainIntentMatch = true; }
      if (cleanQ.includes("팀원") || cleanQ.includes("초대") || cleanQ.includes("나중에 하기") || cleanQ.includes("건너뛰기")) { score += 60; domainIntentMatch = true; }
      if (cleanQ.includes("담당 업무") || cleanQ.includes("6대 업무") || cleanQ.includes("주 담당자") || cleanQ.includes("owner")) { score += 60; domainIntentMatch = true; }
      if (cleanQ.includes("상품") && (cleanQ.includes("몇 개") || cleanQ.includes("필수") || cleanQ.includes("요건") || cleanQ.includes("완료 조건"))) { score += 60; domainIntentMatch = true; }
      if (cleanQ.includes("계약") || cleanQ.includes("기본계약") || cleanQ.includes("서명") || cleanQ.includes("전자서명")) { score += 60; domainIntentMatch = true; }
      if (cleanQ.includes("완료 조건") || cleanQ.includes("100%") || cleanQ.includes("7/7") || cleanQ.includes("7단계")) { score += 60; domainIntentMatch = true; }
    }

    // Specific Domain Intent Matches for Product Registration & Management (MAN-B-PROD-001)
    if (item.id === "kno-product-management-v10" || item.slug === "man-b-prod-001-product-management") {
      if (cleanQ.includes("상품") || cleanQ.includes("제품") || cleanQ.includes("product") || cleanQ.includes("sku")) { score += 60; domainIntentMatch = true; }
      if (cleanQ.includes("등록") || cleanQ.includes("신규") || cleanQ.includes("draft") || cleanQ.includes("임시")) { score += 50; domainIntentMatch = true; }
      if (cleanQ.includes("10대") || cleanQ.includes("완료 조건") || cleanQ.includes("complete") || cleanQ.includes("필수")) { score += 60; domainIntentMatch = true; }
      if (cleanQ.includes("카테고리") || cleanQ.includes("동적 속성") || cleanQ.includes("3-depth") || cleanQ.includes("속성")) { score += 60; domainIntentMatch = true; }
      if (cleanQ.includes("바코드") || cleanQ.includes("upc") || cleanQ.includes("ean") || cleanQ.includes("식별")) { score += 60; domainIntentMatch = true; }
      if (cleanQ.includes("가격") || cleanQ.includes("fob") || cleanQ.includes("마진") || cleanQ.includes("수량별") || cleanQ.includes("tiered")) { score += 60; domainIntentMatch = true; }
      if (cleanQ.includes("물류") || cleanQ.includes("규격") || cleanQ.includes("단품") || cleanQ.includes("패키지") || cleanQ.includes("카톤") || cleanQ.includes("cbm")) { score += 60; domainIntentMatch = true; }
      if (cleanQ.includes("시뮬레이터") || cleanQ.includes("컨테이너") || cleanQ.includes("20ft") || cleanQ.includes("40ft")) { score += 60; domainIntentMatch = true; }
      if (cleanQ.includes("이미지") || cleanQ.includes("미디어") || cleanQ.includes("썸네일") || cleanQ.includes("10장")) { score += 60; domainIntentMatch = true; }
      if (cleanQ.includes("전성분") || cleanQ.includes("번역") || cleanQ.includes("원산지") || cleanQ.includes("리드타임")) { score += 60; domainIntentMatch = true; }
      if (cleanQ.includes("인허가") || cleanQ.includes("서류") || cleanQ.includes("보증서") || cleanQ.includes("버전")) { score += 60; domainIntentMatch = true; }
      if (cleanQ.includes("포커스") || cleanQ.includes("누락") || cleanQ.includes("보완 대기")) { score += 60; domainIntentMatch = true; }
      if (cleanQ.includes("상태") || cleanQ.includes("선정") || cleanQ.includes("판매 상태") || cleanQ.includes("삭제") || cleanQ.includes("복구")) { score += 50; domainIntentMatch = true; }
    }

    // Require title, tag, or domain intent match to qualify as grounded candidate
    if (!hasTitleMatch && !hasTagMatch && !domainIntentMatch) {
      score = 0;
    }

    // Specific Domain Intent Matches for Brand FAQ (kno-002-brand-faq)
    if (item.id === "kno-002-brand-faq") {
      if (cleanQ.includes("입점") || cleanQ.includes("자격")) score += 50;
      if (cleanQ.includes("요건") || cleanQ.includes("fda")) score += 40;
    }

    // Specific Domain Intent Matches for INSIGHTS (Internal only)
    if (item.category === "INSIGHTS" && audience === "INTERNAL") {
      if (cleanQ.includes("insight") || cleanQ.includes("인사이트")) score += 50;
      if (cleanQ.includes("topic score") || cleanQ.includes("80점")) score += 60;
      if (cleanQ.includes("risk") || cleanQ.includes("high risk")) score += 60;
      if (cleanQ.includes("automation") || cleanQ.includes("05:00")) score += 50;
      if (cleanQ.includes("0 draft") || cleanQ.includes("0개")) score += 60;
    }

    return { item, score };
  });

  scoredCandidates.sort((a, b) => b.score - a.score);
  const best = scoredCandidates.length > 0 && scoredCandidates[0].score >= 50 ? scoredCandidates[0].item : null;

  // 9. If no candidate reached sufficient relevance score -> Insufficient Evidence Fallback
  if (!best) {
    return {
      id: `ans-unknown-${Date.now()}`,
      question: rawQ,
      directAnswer: "현재 등록된 K SELECT 공식 도움말에서 이 질문에 대한 충분한 정보를 찾지 못했습니다. K SELECT는 임의 추정이나 확인되지 않은 정책을 생성하여 답변하지 않습니다.",
      currentRuleBullets: [
        "절대 원칙 (NO FABRICATION): 공식 검증된 매뉴얼 및 정책 문서가 없는 경우 답변 생성이 엄격히 제한됩니다.",
        "조치 방법: Help Center에서 전체 문서를 확인하시거나 1:1 문의를 남겨주시면 담당자가 신속히 안내해 드립니다."
      ],
      sources: [],
      actions: [
        { label: "Help Center 둘러보기", url: helpBasePath, type: "help" },
        { label: "1:1 문의하기", url: supportPath, type: "support" }
      ],
      isUnknown: true,
      isReadonlyActionAttempt: false,
      createdAt: now,
      audience
    };
  }

  // 10. Build Grounded Answer from Best Matching Knowledge
  return buildGroundedResponse(rawQ, cleanQ, best, scoredCandidates.filter(s => s.score >= 50).map(s => s.item), audience, helpBasePath, supportPath, now);
}

/**
 * Builds grounded answer and official citations from verified knowledge item.
 */
function buildGroundedResponse(
  rawQ: string,
  cleanQ: string,
  primary: KnowledgeItem,
  matches: KnowledgeItem[],
  audience: AudienceType,
  helpBasePath: string,
  supportPath: string,
  now: string
): AskAnswerResponse {
  let directAnswer = "";
  let bullets: string[] = [];
  let liveRuleNote: string | null = null;
  const actions: AskActionLink[] = [];
  const sources: AskSourceCitation[] = [];
  const relatedManuals: any[] = [];
  let relatedQuestions: string[] = [];

  const detailUrlFor = (item: KnowledgeItem) => {
    if (audience === "BRAND") return `/portal/help/${item.slug || item.id}`;
    if (audience === "RETAILER") return `/retailer/help/${item.slug || item.id}`;
    return `/admin/knowledge/${item.id}`;
  };

  // Primary Citation
  sources.push({
    id: primary.id,
    slug: primary.slug || primary.id,
    title: primary.title_ko || primary.title,
    type: primary.type,
    version: primary.current_version || "v1.0",
    status: primary.status,
    effectiveDate: primary.effective_date,
    url: detailUrlFor(primary),
    documentUrl: primary.document_url,
    documentName: primary.document_name,
    isLiveRule: primary.source_type === "LIVE_SYSTEM" || primary.source_type === "HYBRID"
  });

  // Secondary Citations (strictly same audience & category)
  matches.slice(1, 3).forEach(m => {
    if (!sources.some(s => s.id === m.id)) {
      sources.push({
        id: m.id,
        slug: m.slug || m.id,
        title: m.title_ko || m.title,
        type: m.type,
        version: m.current_version || "v1.0",
        status: m.status,
        effectiveDate: m.effective_date,
        url: detailUrlFor(m),
        documentUrl: m.document_url,
        documentName: m.document_name,
        isLiveRule: m.source_type === "LIVE_SYSTEM" || m.source_type === "HYBRID"
      });
    }
  });

  // Attach PDF Asset if primary item has document_url
  if (primary.document_url) {
    relatedManuals.push({
      id: `asset-${primary.id}`,
      title: primary.document_name || primary.title_ko || primary.title,
      version: primary.current_version || "v1.0",
      status: "CURRENT",
      audience,
      viewUrl: primary.document_url,
      downloadUrl: primary.document_url
    });
  }

  // --- BRAND PORTAL KNOWLEDGE TAILORING (MAN-BRAND-001) ---
  if (primary.id === "kno-brand-policy-v10" || primary.slug === "brand-registration-and-management-policy-v1" || primary.slug === "man-brand-001-brand-policy") {
    if (cleanQ.includes("상표권") || cleanQ.includes("trademark")) {
      directAnswer = "포털 내 브랜드 등록은 카탈로그 분류를 위한 것이며, **특허청(KIPO/USPTO) 상표권 등록이 필수 전제 조건은 아닙니다.** (Policy 02)";
      bullets = [
        "상표권이 없거나 출원 중인 신규 브랜드도 포털에 자유롭게 등록하여 상품을 입점할 수 있습니다.",
        "등록 시 '상표권 보유 여부'를 선택할 수 있으며, 상표권 보유 시 미국 유통 바이어 신뢰도가 향상됩니다.",
        "동일 브랜드에 대해 복수의 유통사/총판이 독립적으로 등록 및 취급이 가능합니다."
      ];
      relatedQuestions = [
        "브랜드 등록 전제조건이 무엇인가요?",
        "상품이 연결된 브랜드를 삭제할 수 있나요?",
        "동일 브랜드를 여러 회사가 취급할 수 있나요?"
      ];
      actions.push({ label: "공식 매뉴얼 자세히 보기", url: detailUrlFor(primary), type: "knowledge" });
      actions.push({ label: "브랜드 등록 바로가기", url: "/portal/brands/new", type: "route" });
    } else if (cleanQ.includes("삭제") || cleanQ.includes("delete") || cleanQ.includes("비활성화") || cleanQ.includes("inactive")) {
      directAnswer = "단 1건이라도 상품이 등록된 브랜드는 **발주·통관·인보이스 무결성 보존을 위해 물리 삭제(Hard Delete)가 절대 불가**합니다. (Policy 05 & 06)";
      bullets = [
        "영구 삭제 대신 '사용 중단(Inactive)' 상태로 전환하여 관리합니다.",
        "비활성화된 브랜드는 신규 상품 등록 시 선택 목록에서 제외되지만 기존 거래 내역은 안전하게 보존됩니다.",
        "필요한 경우 언제든지 브랜드 관리 화면에서 '재활성화(Active)'할 수 있습니다."
      ];
      relatedQuestions = [
        "브랜드 등록과 상표권 등록의 차이는?",
        "브랜드 등록 전제조건이 무엇인가요?",
        "동일 브랜드를 여러 회사가 취급할 수 있나요?"
      ];
      actions.push({ label: "공식 매뉴얼 자세히 보기", url: detailUrlFor(primary), type: "knowledge" });
      actions.push({ label: "브랜드 관리 바로가기", url: "/portal/brands", type: "route" });
    } else if (cleanQ.includes("다중") || cleanQ.includes("여러") || cleanQ.includes("owner") || cleanQ.includes("총판")) {
      directAnswer = "글로벌 B2B 유통 구조를 반영하여 **동일 브랜드를 여러 회사(제조사, 총판, 셀러)가 독립적으로 취급**할 수 있습니다. (Policy 03 & 04)";
      bullets = [
        "동일 브랜드 다중 파트너 취급 지원: 서로 다른 입점사가 동일한 브랜드를 각자의 상품 카탈로그에 등록할 수 있습니다.",
        "단일 Brand Owner 원칙: 유통사가 여러 곳이더라도 지식재산권을 보유한 공식 원천 Brand Owner는 1개사로 정의됩니다.",
        "각 회사는 독립적인 발주 및 정산 데이터를 보유합니다."
      ];
      relatedQuestions = [
        "브랜드 등록 전제조건이 무엇인가요?",
        "상표권 없어도 등록 가능한가요?",
        "상품이 연결된 브랜드를 삭제할 수 있나요?"
      ];
      actions.push({ label: "공식 매뉴얼 자세히 보기", url: detailUrlFor(primary), type: "knowledge" });
      actions.push({ label: "브랜드 관리 바로가기", url: "/portal/brands", type: "route" });
    } else {
      // General Brand Registration Policy
      directAnswer = "모든 상품은 반드시 등록된 **활성(Active) 브랜드에 귀속**되어야 합니다. 브랜드가 등록되어 있지 않은 경우 상품 등록 진입 시 브랜드 생성 화면으로 자동 안내됩니다. (Policy 01)";
      bullets = [
        "Policy 01: 상품 등록 전 활성 브랜드 등록 필수",
        "Policy 02: 상표권 등록 필수 아님 (미등록/출원 중 등록 가능)",
        "Policy 03: 동일 브랜드 다중 파트너 독립 취급 가능",
        "Policy 05: 상품이 연결된 브랜드는 물리 삭제 불가 (Inactive 비활성화 관리)"
      ];
      relatedQuestions = [
        "상표권 없어도 브랜드 등록이 가능한가요?",
        "상품이 등록된 브랜드를 삭제할 수 있나요?",
        "동일 브랜드를 여러 회사가 취급할 수 있나요?"
      ];
      actions.push({ label: "공식 매뉴얼 자세히 보기", url: detailUrlFor(primary), type: "knowledge" });
      actions.push({ label: "신규 브랜드 등록하기", url: "/portal/brands/new", type: "route" });
    }
  } else if (primary.id === "kno-onboarding-guide-v10" || primary.slug === "man-b-onb-001-onboarding-guide") {
    // --- BRAND PORTAL ONBOARDING GUIDE (MAN-B-ONB-001) ---
    if (cleanQ.includes("회사 정보") || cleanQ.includes("주소") || cleanQ.includes("법인")) {
      directAnswer = "회사 정보는 **회사 정보 관리 메뉴(/portal/company/info)**에서 입력합니다. 기본 주소, 시, 주/도, 우편번호 4개 필수 주소가 모두 저장되어야 1단계가 완료됩니다. (STEP 1)";
      bullets = [
        "필수 주소 4대 항목: 기본 주소, 시(City), 주/도(State/Province), 우편번호(Zip Code)",
        "완료 처리: 정보 입력 후 상단의 '저장' 버튼을 누르고 '회사 정보 확인 완료 ✓' 버튼을 클릭합니다.",
        "수정 안내: 저장된 회사 정보는 향후 언제든지 실시간으로 업데이트할 수 있습니다."
      ];
      relatedQuestions = [
        "온보딩은 어떻게 진행하나요?",
        "관리자 정보는 어디에서 등록하나요?",
        "온보딩 완료 조건은 무엇인가요?"
      ];
      actions.push({ label: "공식 매뉴얼 자세히 보기", url: detailUrlFor(primary), type: "knowledge" });
      actions.push({ label: "회사 정보 입력하기", url: "/portal/company/info", type: "route" });
    } else if (cleanQ.includes("관리자") || cleanQ.includes("영문 이름") || cleanQ.includes("프로필")) {
      directAnswer = "관리자 정보는 **내 계정 메뉴(/portal/account)**에서 등록합니다. 소통 및 수출입 서류 작성을 위해 국문 성명, 영문 성명(여권 표기 일치), 직함, 연락처를 입력합니다. (STEP 2)";
      bullets = [
        "필수 정보: 국문 성명, 영문 First Name/Last Name, 직함(Job Title), 대표 연락처",
        "영문 이름 원칙: 공식 무역 서류 및 통관에 활용되므로 여권상 표기와 동일하게 입력해야 합니다.",
        "저장: 입력 후 하단의 '프로필 정보 저장' 버튼을 클릭하면 반영됩니다."
      ];
      relatedQuestions = [
        "회사 정보는 어디에서 입력하나요?",
        "팀원 초대는 필수인가요?",
        "온보딩 완료 조건은 무엇인가요?"
      ];
      actions.push({ label: "공식 매뉴얼 자세히 보기", url: detailUrlFor(primary), type: "knowledge" });
      actions.push({ label: "관리자 프로필 바로가기", url: "/portal/account", type: "route" });
    } else if (cleanQ.includes("팀원") || cleanQ.includes("초대") || cleanQ.includes("나중에")) {
      directAnswer = "팀원 초대는 **선택 사항(Optional)**입니다. 1인 기업이거나 즉시 초대가 불필요한 경우 대시보드에서 **'나중에 하기'**를 눌러 건너뛸 수 있습니다. (STEP 4)";
      bullets = [
        "팀원 초대 메뉴: 소속 사용자 관리(/portal/company/users)에서 이메일로 사내 동료를 초대하고 권한(관리자/멤버)을 부여합니다.",
        "건너뛰기: 대시보드 온보딩 체크리스트 STEP 4 카드의 '나중에 하기' 버튼을 클릭하면 즉시 완료 처리됩니다.",
        "추후 초대: 온보딩 완료 후에도 언제든지 팀원을 추가 초대할 수 있습니다."
      ];
      relatedQuestions = [
        "담당 업무는 어떻게 지정하나요?",
        "1인 기업도 온보딩을 완료할 수 있나요?",
        "온보딩 전체 절차는 어떻게 되나요?"
      ];
      actions.push({ label: "공식 매뉴얼 자세히 보기", url: detailUrlFor(primary), type: "knowledge" });
      actions.push({ label: "팀원 관리 바로가기", url: "/portal/company/users", type: "route" });
    } else if (cleanQ.includes("담당 업무") || cleanQ.includes("6대") || cleanQ.includes("주 담당자") || cleanQ.includes("owner")) {
      directAnswer = "담당 업무는 **회사 정보 관리 > 담당 업무 및 주 담당자 탭(/portal/company/info?tab=tasks)**에서 6대 핵심 업무별 사내 주 담당자(Primary Owner)를 매칭하여 지정합니다. (STEP 5)";
      bullets = [
        "6대 핵심 업무: 회사·신청, 계약, 제품·콘텐츠·인증, 가격·견적, 발주·물류·재고, 정산·문의",
        "주 담당자 매칭: 각 업무 드롭다운에서 담당자를 선택하고 이메일 알림 수신인을 체크합니다.",
        "1인 기업 겸임 지원: 1인 기업의 경우 대표 관리자 1인이 6개 업무를 모두 겸임하여 지정할 수 있습니다."
      ];
      relatedQuestions = [
        "팀원 초대는 필수인가요?",
        "상품은 몇 개 등록해야 하나요?",
        "기본계약 체결은 언제 하나요?"
      ];
      actions.push({ label: "공식 매뉴얼 자세히 보기", url: detailUrlFor(primary), type: "knowledge" });
      actions.push({ label: "담당 업무 지정 바로가기", url: "/portal/company/info?tab=tasks", type: "route" });
    } else if (cleanQ.includes("상품") || cleanQ.includes("몇 개")) {
      directAnswer = "온보딩 완수를 위해서는 대표 상품을 **최소 1개 이상 '등록 완료(COMPLETE)' 상태로 등록**해야 합니다. 단순 임시저장(Draft) 상태는 인정되지 않습니다. (STEP 6)";
      bullets = [
        "필수 요건: 기본정보, 카테고리 필수 속성, 한국소비자가/FOB가격, 3단계 로지스틱스 규격(단품/패키지/카톤), UPC/EAN 바코드, 대표 이미지 1장 이상",
        "임시저장과의 차이: 10대 필수 영역이 모두 충족되어 상태 배지가 '등록 완료(COMPLETE)'로 변경되어야 합니다.",
        "추가 등록: 온보딩 완료 후 나머지 제품 라인업을 자유롭게 추가 등록할 수 있습니다."
      ];
      relatedQuestions = [
        "온보딩 완료 조건은 무엇인가요?",
        "기본계약은 어떻게 서명하나요?",
        "브랜드 정보는 어떻게 등록하나요?"
      ];
      actions.push({ label: "공식 매뉴얼 자세히 보기", url: detailUrlFor(primary), type: "knowledge" });
      actions.push({ label: "상품 등록 바로가기", url: "/portal/products", type: "route" });
    } else if (cleanQ.includes("계약") || cleanQ.includes("서명") || cleanQ.includes("전자서명")) {
      directAnswer = "기본계약은 **회사 정보 관리 > 공급 및 이용 약관 탭(/portal/company/info?tab=agreements)**에서 약관 전문을 검토한 후 자필 전자서명을 작성하여 체결합니다. (STEP 7)";
      bullets = [
        "계약 내용: 비독점 브랜드 공급, 미국 유통 및 플랫폼 이용에 관한 기본공급계약",
        "서명 절차: '✍ 계약서 확인 / 서명' 클릭 ➔ 조항 검토 ➔ 서명 패드에 자필 서명 ➔ '전자서명 완료 및 계약 체결'",
        "체결 후: 체결 완료 즉시 Active 상태로 전환되며 서명된 PDF 계약서를 다운로드할 수 있습니다."
      ];
      relatedQuestions = [
        "온보딩 완료 조건은 무엇인가요?",
        "계약 체결 전 상품 등록이 가능한가요?",
        "온보딩은 어떻게 진행하나요?"
      ];
      actions.push({ label: "공식 매뉴얼 자세히 보기", url: detailUrlFor(primary), type: "knowledge" });
      actions.push({ label: "기본계약 확인 바로가기", url: "/portal/company/info?tab=agreements", type: "route" });
    } else if (cleanQ.includes("완료 조건") || cleanQ.includes("100%") || cleanQ.includes("7/7") || cleanQ.includes("완료")) {
      directAnswer = "온보딩 완료 조건은 **7개 단계(회사, 관리자, 브랜드, 팀원, 업무, 상품, 계약)가 모두 완료되어 7 / 7 (100%)를 달성**하는 것입니다. (Chapter 11)";
      bullets = [
        "7단계 필수 완료: 회사 4대 주소, 관리자 영문 성명, 브랜드 확인, 팀원(또는 나중에하기), 6대 담당업무 매칭, 상품 1개 이상 COMPLETE, 기본계약 전자서명",
        "완료 후 혜택: 7/7 완료 시 대시보드 녹색 배지가 켜지며 Brand Portal의 정식 운영 기능이 활성화됩니다.",
        "정보 변경: 완료 후에도 주소, 담당자, 상품 정보는 언제든지 자유롭게 수정할 수 있습니다."
      ];
      relatedQuestions = [
        "온보딩 전체 절차는 어떻게 되나요?",
        "처음 가입했는데 무엇부터 해야 하나요?",
        "도움이 필요한 경우 어떻게 하나요?"
      ];
      actions.push({ label: "공식 매뉴얼 자세히 보기", url: detailUrlFor(primary), type: "knowledge" });
      actions.push({ label: "대시보드 온보딩 현황 보기", url: "/portal", type: "route" });
    } else {
      // General Onboarding Roadmap
      directAnswer = "K SELECT Brand Portal 온보딩은 **7단계 표준 절차(회사 ➔ 관리자 ➔ 브랜드 ➔ 팀원 ➔ 업무 ➔ 상품 ➔ 계약)**로 구성되며, 준비된 순서에 따라 자유롭게 진행하실 수 있습니다. (MAN-B-ONB-001)";
      bullets = [
        "STEP 1~3 (기본 설정): 법인 필수 4대 주소, 관리자 국문/영문 프로필, 대표 브랜드 및 상표권 확인",
        "STEP 4~5 (운영 조직): 팀원 초대(선택/나중에하기 가능) 및 6대 핵심 업무별 주 담당자 지정",
        "STEP 6~7 (공급 체결): 대표 상품 1개 이상 등록 완료(COMPLETE) 및 기본공급계약 자필 전자서명",
        "완료 기준: 7단계 100% 충족 시 정식 운영 기능 활성화"
      ];
      relatedQuestions = [
        "회사 정보는 어디에서 입력하나요?",
        "팀원 초대는 필수인가요?",
        "온보딩 완료 조건은 무엇인가요?"
      ];
      actions.push({ label: "공식 매뉴얼 자세히 보기", url: detailUrlFor(primary), type: "knowledge" });
      actions.push({ label: "온보딩 대시보드 바로가기", url: "/portal", type: "route" });
    }
  } else if (primary.id === "kno-product-management-v10" || primary.slug === "man-b-prod-001-product-management") {
    // --- BRAND PORTAL PRODUCT REGISTRATION & MANAGEMENT (MAN-B-PROD-001) ---
    if (cleanQ.includes("draft") || cleanQ.includes("임시") || cleanQ.includes("보완 대기")) {
      directAnswer = "임시 저장(Draft)은 4대 기본 정보(브랜드, 카테고리, 영문명, SKU)만 입력하여 저장한 상태이며, 온보딩 완료 및 MD 입점 심사를 받으려면 **10대 필수 조건이 모두 완료된 COMPLETE 상태**여야 합니다. (Chapter 03 & 10)";
      bullets = [
        "임시 저장: 필수 항목이 미비해도 나중에 이어 작성할 수 있도록 보완 대기 상태로 보관",
        "스마트 포커스: 상단 로즈색 보완 대기 배너의 누락 항목 클릭 시 해당 탭과 입력창으로 자동 이동",
        "등록 완료 전환: 10대 필수 조건 100% 충족 시 '등록 완료(COMPLETE)' 뱃지 자동 획득"
      ];
      relatedQuestions = [
        "상품 등록 완료 10대 조건은 무엇인가요?",
        "누락된 항목은 어떻게 찾나요?",
        "신규 상품은 어떻게 등록하나요?"
      ];
      actions.push({ label: "공식 매뉴얼 자세히 보기", url: detailUrlFor(primary), type: "knowledge" });
      actions.push({ label: "상품 관리 바로가기", url: "/portal/products", type: "route" });
    } else if (cleanQ.includes("10대") || cleanQ.includes("완료 조건") || cleanQ.includes("complete") || cleanQ.includes("필수")) {
      directAnswer = "상품 등록 완료(COMPLETE)를 판정하는 **10대 필수 조건**은 활성 브랜드, 3-Depth 카테고리, 필수 동적 속성(*), 영문 제품명, 제조사 SKU, 원산지, 2대 가격(KRW/FOB), 3단계 물리 규격(단품/패키지/카톤), 바코드(UPC/EAN), 대표 이미지(1장 이상)입니다. (Chapter 10)";
      bullets = [
        "기본 & 카테고리: 활성 브랜드 지정, 3-Depth 리프 카테고리 및 별표(*) 필수 속성 입력",
        "가격 & 바코드: 한국소비자가(KRW) + 수출FOB가(USD), 12자리 UPC 또는 13자리 EAN 바코드",
        "물류 & 미디어: 단품/패키지/카톤(입수량 포함) 3단계 규격, 최소 1장 이상의 대표 이미지(Position 0)"
      ];
      relatedQuestions = [
        "Draft 상태에서 누락된 항목은 어떻게 찾나요?",
        "바코드는 UPC와 EAN 중 무엇을 넣어야 하나요?",
        "물류 규격과 CBM은 어떻게 계산되나요?"
      ];
      actions.push({ label: "공식 매뉴얼 자세히 보기", url: detailUrlFor(primary), type: "knowledge" });
      actions.push({ label: "신규 상품 등록하기", url: "/portal/products/new", type: "route" });
    } else if (cleanQ.includes("카테고리") || cleanQ.includes("속성") || cleanQ.includes("3-depth")) {
      directAnswer = "탭 2(카테고리 & 속성)에서 3단계(대분류 ➔ 중분류 ➔ 소분류)를 선택하거나 **스마트 동의어 검색**(예: 수분크림, Sunscreen)을 활용하여 리프 카테고리를 지정하면 맞춤형 동적 속성 폼이 로드됩니다. (Chapter 05)";
      bullets = [
        "3-Depth 계층 구조: 대분류 > 중분류 > 세부 리프 카테고리 표준 체계",
        "동적 속성 폼: 피부 타입, 제형, SPF, 주요 성분 등 카테고리 맞춤형 입력 필드 자동 생성",
        "필수 속성: 붉은 별표(*)가 표시된 카테고리 필수 속성을 모두 입력해야 등록 완료가 충족됩니다."
      ];
      relatedQuestions = [
        "상품 등록 완료 10대 조건은 무엇인가요?",
        "기본 정보는 어떻게 입력하나요?",
        "가격 정보는 어떻게 설정하나요?"
      ];
      actions.push({ label: "공식 매뉴얼 자세히 보기", url: detailUrlFor(primary), type: "knowledge" });
      actions.push({ label: "상품 상세 관리", url: "/portal/products", type: "route" });
    } else if (cleanQ.includes("가격") || cleanQ.includes("fob") || cleanQ.includes("마진") || cleanQ.includes("tiered") || cleanQ.includes("수량별")) {
      directAnswer = "탭 3(가격 정보)에서 **한국 소비자가(KRW)와 수출 FOB 공급가(USD)**를 필수로 입력합니다. 실시간 FOB 마진율(%)과 배수가 자동 연산되며, 대량 발주에 대비한 수량별 공급가(Tiered Pricing)를 추가할 수 있습니다. (Chapter 06)";
      bullets = [
        "4대 가격 체계: 한국 소비자가(KRW), 수출용 FOB 공급가(USD), 미국 권장소비자가(MSRP), 미국 정규판매가(Retail)",
        "실시간 마진 지표: 당일 환율 기반 FOB 마진율 및 소비자가 대비 배수 실시간 자동 계산",
        "수량별 차등 단가: MOQ 구간별(예: 1~499개, 500~1999개, 2000개 이상) 공급가 차등 설정 지원"
      ];
      relatedQuestions = [
        "로지스틱스 규격은 어떻게 입력하나요?",
        "바코드는 어떤 것을 등록해야 하나요?",
        "상품 등록 완료 조건은 무엇인가요?"
      ];
      actions.push({ label: "공식 매뉴얼 자세히 보기", url: detailUrlFor(primary), type: "knowledge" });
      actions.push({ label: "가격 정보 관리", url: "/portal/products", type: "route" });
    } else if (cleanQ.includes("물류") || cleanQ.includes("규격") || cleanQ.includes("cbm") || cleanQ.includes("단품") || cleanQ.includes("카톤") || cleanQ.includes("컨테이너") || cleanQ.includes("시뮬레이터")) {
      directAnswer = "탭 4(로지스틱스)에서 **단품 본품, 단상자 패키지, 마스터 카톤의 3단계 규격**을 관리하며, 카톤 체적(CBM) 및 20ft/40ft/40HQ 컨테이너 선적 수량이 실시간 자동 시뮬레이션됩니다. (Chapter 07)";
      bullets = [
        "3단계 물리 규격: 단품(Net), 패키지(단상자 Gross), 마스터 카톤(아웃박스) 규격 및 중량",
        "CBM 자동 계산: 가로 × 세로 × 높이 ÷ 1,000,000 공식으로 마스터 카톤 체적 자동 연산",
        "컨테이너 시뮬레이터: 20ft(28 CBM), 40ft(58 CBM), 40HQ(68 CBM) 최대 적재 카톤/제품 수량 산출",
        "단위 자동 변환: cm ↔ inch, g ↔ kg ↔ lb 양방향 실시간 단위 환산 지원"
      ];
      relatedQuestions = [
        "이미지 등록 요건은 어떻게 되나요?",
        "바코드 입력 규칙은 무엇인가요?",
        "등록 완료 10대 필수 조건은 무엇인가요?"
      ];
      actions.push({ label: "공식 매뉴얼 자세히 보기", url: detailUrlFor(primary), type: "knowledge" });
      actions.push({ label: "로지스틱스 규격 관리", url: "/portal/products", type: "route" });
    } else if (cleanQ.includes("이미지") || cleanQ.includes("미디어") || cleanQ.includes("썸네일") || cleanQ.includes("사진")) {
      directAnswer = "이미지는 **최대 10장, 파일당 최대 10MB(JPG/PNG/WEBP)**까지 업로드 가능하며, 탭 5(미디어)에서 마우스 드래그앤드롭으로 순서를 변경할 수 있습니다. **첫 번째(Position 0) 이미지가 대표 썸네일**로 지정됩니다. (Chapter 08)";
      bullets = [
        "이미지 규격: 최대 10장, 장당 최대 10MB (1000×1000 이상 흰색 배경 정방형 권장)",
        "대표 썸네일: 맨 앞(Position 0)으로 드래그하면 즉시 대표 썸네일로 자동 저장",
        "디테일 뷰 & 동영상: 고해상도 라이트박스 줌 및 YouTube/Vimeo 스트리밍/MP4 파일 연동 지원"
      ];
      relatedQuestions = [
        "인허가 서류는 어디에 업로드하나요?",
        "상품 등록 완료 조건은 무엇인가요?",
        "상품 정보는 어떻게 수정하나요?"
      ];
      actions.push({ label: "공식 매뉴얼 자세히 보기", url: detailUrlFor(primary), type: "knowledge" });
      actions.push({ label: "미디어 관리 바로가기", url: "/portal/products", type: "route" });
    } else if (cleanQ.includes("삭제") || cleanQ.includes("복구") || cleanQ.includes("보관")) {
      directAnswer = "상품 삭제 시 데이터는 영구 삭제되지 않고 **`deleted_at` 타임스탬프가 부여되는 소프트 삭제(Soft Delete)**로 처리되어 'Deleted (삭제됨)' 탭에 안전하게 격리 보관됩니다. (Chapter 13)";
      bullets = [
        "소프트 삭제: SKU, 과거 주문 내역, 감사 로그 등 무결성 데이터 영구 보존",
        "목록 분리: Active/Draft 목록에서 즉시 제외되며 'Deleted' 필터 탭에서 조회 가능",
        "복구 문의: 실수로 삭제하여 복구 및 재활성화가 필요한 경우 Help Center 1:1 고객지원으로 문의"
      ];
      relatedQuestions = [
        "상품 등록 완료 조건은 무엇인가요?",
        "임시 저장 상품은 어떻게 관리하나요?",
        "1:1 고객지원 문의는 어떻게 하나요?"
      ];
      actions.push({ label: "공식 매뉴얼 자세히 보기", url: detailUrlFor(primary), type: "knowledge" });
      actions.push({ label: "상품 목록 바로가기", url: "/portal/products", type: "route" });
    } else {
      // General Product Management Guide
      directAnswer = "K SELECT Brand Portal 상품 관리는 **신규 등록 ➔ 6대 전문 관리 탭(기본, 카테고리, 가격, 물류, 미디어, 서류) 작성 ➔ 10대 필수 조건 충족(COMPLETE) ➔ MD 검토**로 진행됩니다. (MAN-B-PROD-001)";
      bullets = [
        "6대 관리 탭: 기본정보, 카테고리&동적속성, 가격&공급가, 3단계로지스틱스(CBM/시뮬레이터), 미디어(최대10장), 인허가&보증서",
        "10대 등록 완료 조건: 활성브랜드, 리프카테고리, 필수속성, 영문명, SKU, 원산지, 가격, 3단계규격, 바코드, 이미지",
        "3대 상태 차원: 등록 상태(Draft/Complete), 선정 상태(MD 검토), 판매 상태(유통 진행) 독립 운영"
      ];
      relatedQuestions = [
        "상품 등록 완료 10대 조건은 무엇인가요?",
        "임시 저장과 등록 완료의 차이는 무엇인가요?",
        "가격 정보와 물류 규격은 어떻게 입력하나요?"
      ];
      actions.push({ label: "공식 매뉴얼 자세히 보기", url: detailUrlFor(primary), type: "knowledge" });
      actions.push({ label: "상품 관리 바로가기", url: "/portal/products", type: "route" });
    }
  } else if (primary.id === "kno-002-brand-faq") {
    directAnswer = "K SELECT NETWORK는 미국 시장 진출을 희망하는 정식 등록 한국 화장품 브랜드사를 대상으로 입점 및 파트너 온보딩을 지원합니다.";
    bullets = [
      "자격 요건: 미국 화장품 규정(FDA 등)을 준수할 수 있는 화장품 브랜드사",
      "온보딩 절차: 파트너 신청서 제출 ➔ 관리자 검토 및 승인 ➔ 브랜드 및 상품 등록 ➔ 바이어 발주 연동",
      "상세 지원: 1:1 문의를 통해 입점 상담 및 사전 가이드를 받아보실 수 있습니다."
    ];
    relatedQuestions = [
      "브랜드 등록 전제조건이 무엇인가요?",
      "상표권 없어도 등록 가능한가요?",
      "입점 신청 후 승인까지 얼마나 걸리나요?"
    ];
    actions.push({ label: "FAQ 문서 자세히 보기", url: detailUrlFor(primary), type: "knowledge" });
    actions.push({ label: "1:1 문의하기", url: supportPath, type: "support" });
  } else if (primary.category === "INSIGHTS" && audience === "INTERNAL") {
    // Internal INSIGHTS Grounding
    if (cleanQ.includes("topic score") || primary.id === "kno-insights-rule-daily-auto") {
      directAnswer = "현재 적용 중인 K SELECT INSIGHTS의 Topic Score 기준은 **80점 이상**입니다. 80점을 통과한 Topic만 Daily Candidate로 채택됩니다.";
      bullets = [
        "Live System Rule: Topic Score 80+ / Daily Run 05:00 ET",
        "Draft Quota: NETWORK 최대 3개, HUB 최대 3개",
        "0 Draft Day: 기준을 통과하는 Topic이 없는 경우 0개 생성이 정상 동작입니다."
      ];
      relatedQuestions = [
        "HIGH Risk 기준은 무엇인가요?",
        "오늘 Draft가 0개면 오류인가요?",
        "Revision은 언제 요청하나요?"
      ];
      actions.push({ label: "지식 상세 보기", url: detailUrlFor(primary), type: "knowledge" });
      actions.push({ label: "Editorial Rules 열기", url: "/admin/insights/rules", type: "route" });
    } else if (cleanQ.includes("high risk") || primary.id === "kno-insights-policy-factcheck-risk") {
      directAnswer = "INSIGHTS에서 **HIGH Risk**는 규제(Regulation), 정확한 숫자(%), 금액($), 시장 규모, 성장률 및 강한 인과 표현을 포함한 항목입니다.";
      bullets = [
        "HIGH Risk 검증: 승인 전 반드시 뒷받침하는 Source / Evidence를 직접 재확인",
        "MEDIUM Risk: 시장 트렌드, 검색 모멘텀 ('signals suggest' 수준 확인)",
        "LOW Risk: K SELECT 자체 운영 해석 및 체크리스트"
      ];
      relatedQuestions = [
        "Claim Status 정의 보기",
        "Revision 요청 가이드",
        "Topic Score 기준은?"
      ];
      actions.push({ label: "지식 상세 보기", url: detailUrlFor(primary), type: "knowledge" });
      actions.push({ label: "Review Queue 열기", url: "/admin/insights/queue", type: "route" });
    } else {
      directAnswer = primary.summary_ko || primary.summary_en || primary.title_ko;
      const cleanLines = (primary.content_ko || "").split("\n").filter(l => l.startsWith("- ") || l.startsWith("1. ") || l.startsWith("2. ")).slice(0, 4);
      bullets = cleanLines.length > 0 ? cleanLines.map(l => l.replace(/^[-1234567890.]*\s*/, "")) : [primary.summary_ko];
      relatedQuestions = [
        "INSIGHTS Topic Score 기준은?",
        "HIGH Risk 기준은 무엇인가요?",
        "관련 운영 정책 보기"
      ];
      actions.push({ label: "지식 상세 보기", url: detailUrlFor(primary), type: "knowledge" });
    }
  } else {
    // Fallback Grounded Extraction from Published Knowledge
    directAnswer = primary.summary_ko || primary.summary_en || primary.title_ko;
    const cleanLines = (primary.content_ko || "").split("\n").filter(l => l.startsWith("- ") || l.startsWith("1. ") || l.startsWith("2. ") || l.startsWith("3. ")).slice(0, 4);
    bullets = cleanLines.length > 0 ? cleanLines.map(l => l.replace(/^[-1234567890.]*\s*/, "")) : [primary.summary_ko];
    relatedQuestions = [
      "관련 운영 정책 보기",
      "도움말 센터에서 전체 문서 검색",
      "1:1 문의하기"
    ];
    actions.push({ label: "도움말 문서 자세히 보기", url: detailUrlFor(primary), type: "knowledge" });
  }

  // Always append Support Action at the end
  actions.push({ label: "1:1 문의하기", url: supportPath, type: "support" });

  return {
    id: `ans-${Date.now()}`,
    question: rawQ,
    directAnswer,
    currentRuleBullets: bullets,
    liveRuleNote,
    sources,
    relatedManuals,
    relatedQuestions,
    actions,
    isUnknown: false,
    isReadonlyActionAttempt: false,
    createdAt: now,
    audience
  };
}
