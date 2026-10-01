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

  if (userRole === "brand") {
    return "BRAND";
  }

  if (userRole === "retailer") {
    return "RETAILER";
  }

  return "PUBLIC";
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

    tokens.forEach(token => {
      if (titleText.includes(token)) score += 60;
      if (itemTags.some(tag => tag.includes(token))) score += 40;
      if (summaryText.includes(token)) score += 30;
      if (contentText.includes(token)) score += 15;
    });

    // Specific Domain Intent Matches for Brand Policy (MAN-BRAND-001)
    if (item.id === "kno-brand-policy-v10" || item.slug === "brand-registration-and-management-policy-v1") {
      if (cleanQ.includes("브랜드") || cleanQ.includes("brand")) score += 40;
      if (cleanQ.includes("등록") || cleanQ.includes("전제조건") || cleanQ.includes("신규") || cleanQ.includes("생성")) score += 50;
      if (cleanQ.includes("상표권") || cleanQ.includes("trademark") || cleanQ.includes("특허청")) score += 60;
      if (cleanQ.includes("삭제") || cleanQ.includes("delete") || cleanQ.includes("비활성화") || cleanQ.includes("inactive")) score += 60;
      if (cleanQ.includes("다중") || cleanQ.includes("여러 회사") || cleanQ.includes("총판") || cleanQ.includes("owner")) score += 50;
      if (cleanQ.includes("상품 등록") || cleanQ.includes("귀속")) score += 40;
    }

    // Specific Domain Intent Matches for Brand FAQ (kno-002-brand-faq)
    if (item.id === "kno-002-brand-faq") {
      if (cleanQ.includes("입점") || cleanQ.includes("자격") || cleanQ.includes("온보딩") || cleanQ.includes("onboarding")) score += 50;
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
  const best = scoredCandidates.length > 0 && scoredCandidates[0].score >= 20 ? scoredCandidates[0].item : null;

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
  return buildGroundedResponse(rawQ, cleanQ, best, scoredCandidates.filter(s => s.score >= 20).map(s => s.item), audience, helpBasePath, supportPath, now);
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
  if (primary.id === "kno-brand-policy-v10" || primary.slug === "brand-registration-and-management-policy-v1") {
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
