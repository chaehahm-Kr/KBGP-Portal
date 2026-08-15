import {
  KnowledgeItem,
  SecurityUserContext,
  GuideAnswerResponse,
  GuideSourceCitation,
  GuideActionLink,
  KnowledgeGapRecord,
  GuideFeedbackRecord,
  KnowledgeType
} from "../types";
import { getAuthorizedKnowledgeList } from "../retrieval";
import { searchKnowledgeCore } from "../search";
import { getStoreAssets, getStoreRelations, getStoreKnowledgeById } from "../store";

// Storage for Knowledge Gaps and Feedback in memory
const memoryGaps: KnowledgeGapRecord[] = [];
const memoryFeedback: GuideFeedbackRecord[] = [];

export async function processGuideQuestion(
  question: string,
  userContext: SecurityUserContext,
  currentRoute: string = "/admin",
  selectedModule?: string
): Promise<GuideAnswerResponse> {
  const now = new Date().toISOString();
  const q = question.toLowerCase().trim();

  // 1. Check for Read-Only Mutation / Action Attempts
  const isWriteAttempt = checkWriteActionAttempt(q);

  // 2. RETRIEVAL-LEVEL SECURITY & SHARED SEARCH CORE: Fetch ONLY Authorized Knowledge items for this user in GUIDE Mode
  const searchResult = await searchKnowledgeCore(question, {
    mode: "GUIDE",
    userContext,
    currentRoute,
    selectedModule
  });

  const matchedItems = searchResult.items;

  // 3. Handle Write Action Attempts immediately (Read-Only Enforcement)
  if (isWriteAttempt.isAttempt) {
    return buildReadonlyActionResponse(question, isWriteAttempt.actionType, matchedItems, now);
  }

  let bestMatch = matchedItems.length > 0 ? matchedItems[0] : null;

  // STRICT ZERO CROSS-MODULE FALLBACK:
  // If an explicit selectedModule is specified, reject any candidate from another module.
  if (selectedModule && bestMatch && bestMatch.category !== selectedModule) {
    bestMatch = null;
  }

  // 5. Handle Unknown / Insufficient Authorized Knowledge (Module-Scoped vs Global)
  if (!bestMatch) {
    recordKnowledgeGap({
      id: `gap-${Date.now()}`,
      question,
      user_id: userContext.userId,
      user_name: userContext.role,
      current_route: currentRoute,
      created_at: now
    });

    const moduleDisplayName = selectedModule
      ? selectedModule === "SIMULATOR" ? "Growth Simulator"
        : selectedModule === "KNOWLEDGE" ? "Knowledge Center"
        : selectedModule === "INSIGHTS" ? "INSIGHTS"
        : selectedModule === "PRODUCTS" ? "Products"
        : selectedModule === "APPLICATIONS" ? "Applications"
        : selectedModule
      : "K SELECT";

    return {
      id: `ans-${Date.now()}`,
      question,
      directAnswer: `현재 승인된 ${moduleDisplayName} Knowledge에서 이 질문에 대한 충분한 공식 운영 기준을 확인하지 못했습니다.`,
      currentRuleBullets: [
        `${moduleDisplayName} 영역에 해당하는 공식 Knowledge가 아직 등록되지 않았거나 검토 중일 수 있습니다.`,
        `K SELECT Knowledge Library에서 관련 태그로 검색하시거나 ${moduleDisplayName} Knowledge Gap으로 접수해 주세요.`
      ],
      sources: [],
      actions: [
        { label: "Knowledge Library에서 검색", url: `/admin/knowledge/library?search=${encodeURIComponent(question)}`, type: "library" },
        { label: `${moduleDisplayName} Knowledge Gap 보고`, url: "#gap", type: "gap" }
      ],
      isUnknown: true,
      isReadonlyActionAttempt: false,
      createdAt: now
    };
  }

  // 6. Generate Answer from Best Matching Knowledge & Priority Hierarchy
  const topMatches = matchedItems.slice(0, 3);
  return buildStructuredGuideAnswer(question, bestMatch, topMatches, userContext, currentRoute, now);
}

// --------------------------------------------------
// Helper: Detect Write Action Attempt
// --------------------------------------------------
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

// --------------------------------------------------
// Helper: Build Read-Only Action Attempt Response
// --------------------------------------------------
function buildReadonlyActionResponse(
  question: string,
  actionType: string,
  authorizedItems: KnowledgeItem[],
  now: string
): GuideAnswerResponse {
  let directAnswer = "K SELECT Guide는 READ-ONLY 업무 안내 전용 가이드입니다. 시스템 설정 변경, 게시물 승인, 삭제 등의 Write Action을 직접 수행하지 않습니다.";
  let bullets: string[] = [];
  let actions: GuideActionLink[] = [];

  if (actionType === "SETTING_CHANGE") {
    directAnswer = "운영 설정 및 시스템 Rule 변경은 어드민 해당 설정 페이지에서 직접 수행하셔야 합니다. Guide는 직접 변경하지 않습니다.";
    bullets = [
      "INSIGHTS Topic Score / Quota / Run Time ➔ Admin → INSIGHTS → Editorial Rules",
      "K SELECT 지식 센터 개정 ➔ Knowledge Detail → VERSIONS → Create New Version"
    ];
    actions = [
      { label: "Go to Editorial Rules", url: "/admin/insights/rules", type: "route" },
      { label: "Go to Knowledge Library", url: "/admin/knowledge/library", type: "route" }
    ];
  } else if (actionType === "APPROVE_INSIGHT") {
    directAnswer = "Insight 기사 승인 및 Publish 조치는 Review Queue에서 실무자 검토 후 직접 수행하셔야 합니다.";
    bullets = [
      "HIGH Risk Claim 및 근거(Source) 재확인 후 GO · APPROVE 판정",
      "수정이 필요한 경우 FIX · REQUEST REVISION 실행"
    ];
    actions = [
      { label: "Go to Review Queue", url: "/admin/insights/queue", type: "route" }
    ];
  } else if (actionType === "DELETE_KNOWLEDGE") {
    directAnswer = "Knowledge 항목의 Archive 및 삭제 조치는 지식 상세 화면에서 권한 있는 관리자가 수행해야 합니다.";
    bullets = [
      "PUBLISHED 이력이 있는 지식은 감사 보존을 위해 DB에서 물리 삭제되지 않고 ARCHIVED 처리됩니다."
    ];
    actions = [
      { label: "Go to Knowledge Library", url: "/admin/knowledge/library", type: "route" }
    ];
  }

  return {
    id: `ans-readonly-${Date.now()}`,
    question,
    directAnswer,
    currentRuleBullets: bullets,
    sources: [],
    actions,
    isUnknown: false,
    isReadonlyActionAttempt: true,
    createdAt: now
  };
}

// --------------------------------------------------
// Helper: Build Structured Guide Answer
// --------------------------------------------------
async function buildStructuredGuideAnswer(
  question: string,
  primaryMatch: KnowledgeItem,
  allMatches: KnowledgeItem[],
  userContext: SecurityUserContext,
  currentRoute: string,
  now: string
): Promise<GuideAnswerResponse> {
  const q = question.toLowerCase();
  let directAnswer = "";
  let bullets: string[] = [];
  let liveRuleNote: string | null = null;
  const actions: GuideActionLink[] = [];
  const sources: GuideSourceCitation[] = [];
  const relatedManuals: any[] = [];
  let relatedQuestions: string[] = [];

  // Grounding Citation: ONLY Primary Match and strictly category-matching items
  sources.push({
    id: primaryMatch.id,
    title: primaryMatch.title_ko || primaryMatch.title,
    type: primaryMatch.type,
    version: primaryMatch.current_version,
    status: primaryMatch.status,
    effectiveDate: primaryMatch.effective_date,
    isLiveRule: primaryMatch.source_type === "LIVE_SYSTEM" || primaryMatch.source_type === "HYBRID"
  });

  // Secondary Citations: Only add items that share the EXACT same category (no cross-category leakage)
  allMatches.slice(1).forEach(m => {
    if (m.category === primaryMatch.category && !sources.some(s => s.id === m.id)) {
      sources.push({
        id: m.id,
        title: m.title_ko || m.title,
        type: m.type,
        version: m.current_version,
        status: m.status,
        effectiveDate: m.effective_date,
        isLiveRule: m.source_type === "LIVE_SYSTEM" || m.source_type === "HYBRID"
      });
    }
  });

  // Attach Related PDF Manual if INSIGHTS or Manual exists
  if (primaryMatch.category === "INSIGHTS" || primaryMatch.type === "MANUAL" || q.includes("매뉴얼") || q.includes("insights")) {
    relatedManuals.push({
      id: "kno-insights-manual-v10",
      title: "K SELECT INSIGHTS 실무자 운영 매뉴얼",
      version: "v1.0",
      status: "CURRENT",
      audience: "INTERNAL",
      isOutdatedWarning: primaryMatch.system_impact_status === "POTENTIALLY_OUTDATED",
      assetId: "asset-insights-manual-v10",
      viewUrl: "/api/admin/knowledge/asset/asset-insights-manual-v10?action=view",
      downloadUrl: "/api/admin/knowledge/asset/asset-insights-manual-v10?action=download"
    });
  }

  // Specific Content Answers based on Topic
  if (q.includes("시뮬레이터") || q.includes("simulator") || primaryMatch.category === "SIMULATOR") {
    directAnswer = "Growth Simulator는 K-Beauty 브랜드 및 리테일 네트워크의 마진(Margin), 원가(COGS), 플랫폼 수수료 및 예상 수익성(Profitability)을 계산하는 어드민 시뮬레이션 도구입니다.";
    bullets = [
      "모형 파라미터 기준: 제조원가(COGS 35%~45%), 플랫폼 수수료(15%), 통관/배송비($3.50) 설정",
      "실행 경로: Admin → Growth Simulator → Sandbox (/admin/simulator/sandbox)",
      "목표 지표: 미국 진출 시 목표 순마진(Target Net Margin) 20% 이상 확보 여부 시나리오 검증"
    ];
    relatedQuestions = [
      "Profitability 시뮬레이션 실행 가이드",
      "마진 파라미터 설정 방법",
      "시뮬레이션 결과 리포트 저장법"
    ];
    actions.push({ label: "Growth Simulator Configuration 열기", url: "/admin/simulator/configuration", type: "route" });
    actions.push({ label: "Growth Simulator Sandbox 열기", url: "/admin/simulator/sandbox", type: "route" });
    actions.push({ label: "Growth Simulator Results 열기", url: "/admin/simulator/results", type: "route" });
  } else if (
    q === "insight" ||
    q === "insights" ||
    q === "인사이트" ||
    q === "인싸이트" ||
    q === "insighp"
  ) {
    directAnswer = "K SELECT INSIGHTS는 매일 05:00 ET 미국 K-Beauty 유통/브랜드 시장 시그널을 조사하는 Daily Auto Insight Engine + Editorial Control Center입니다.";
    bullets = [
      "매일 05:00 ET 자동 실행 / Topic Score 80점 이상 후보 채택",
      "NETWORK / HUB 각 최대 3개 Draft Quota 적용 (0 Draft Day ≠ Failure)",
      "Human Gate: AI는 AI_DRAFT까지만 생성하며 최종 Editorial 승인은 사람이 직접 수행"
    ];
    relatedQuestions = [
      "INSIGHTS Topic Score 기준은?",
      "HIGH Risk는 무엇을 확인해야 해?",
      "Revision은 언제 요청하나요?",
      "오늘 Draft가 0개면 오류인가요?",
      "Automation Run 상태를 설명해줘"
    ];
    actions.push({ label: "지식 상세 보기", url: "/admin/knowledge/kno-insights-manual-v10", type: "knowledge" });
    actions.push({ label: "Editorial Rules 열기", url: "/admin/insights/rules", type: "route" });
    actions.push({ label: "Review Queue 열기", url: "/admin/insights/queue", type: "route" });
  } else if (q.includes("topic score") || primaryMatch.id === "kno-insights-rule-daily-auto") {
    // STRICT CITATION ACCURACY: Topic Score Grounding Sources
    sources.length = 0;
    sources.push({
      id: "kno-insights-rule-daily-auto",
      title: "INSIGHTS Daily Auto Insight 운영 기준",
      type: "SYSTEM_RULE",
      version: "v1.0",
      status: "PUBLISHED",
      effectiveDate: "2026-08-14",
      isLiveRule: true
    });
    sources.push({
      id: "kno-insights-manual-v10",
      title: "K SELECT INSIGHTS 실무자 운영 매뉴얼 v1.0",
      type: "MANUAL",
      version: "v1.0",
      status: "PUBLISHED",
      effectiveDate: "2026-08-14",
      isLiveRule: false
    });

    directAnswer = "현재 적용 중인 K SELECT INSIGHTS의 Topic Score 기준은 **80점 이상**입니다. 기준점 80점을 통과한 Topic만 Daily Insight Candidate로 채택됩니다.";
    bullets = [
      "Priority 1 Ground Truth (LIVE RULE): Topic Score 80+ / Daily Run 05:00 ET",
      "NETWORK 모듈: 최대 3 Draft / HUB 모듈: 최대 3 Draft 생성 Quota 적용",
      "기준점 80점을 통과하는 Topic이 없는 경우 당일 생성 Draft가 0개일 수 있으며, 이는 정상적인 품질 검증 보호 동작입니다 (0 Draft Day ≠ Failure)."
    ];
    relatedQuestions = [
      "오늘 Draft가 0개면 오류인가요?",
      "HIGH Risk 기준은 무엇인가요?",
      "Revision은 언제 요청하나요?"
    ];
    actions.push({ label: "지식 상세 보기", url: `/admin/knowledge/${primaryMatch.id}`, type: "knowledge" });
    actions.push({ label: "Editorial Rules 열기", url: "/admin/insights/rules", type: "route" });

    if (primaryMatch.system_impact_status === "POTENTIALLY_OUTDATED") {
      liveRuleNote = "⚠️ 현재 관련 지식 항목에 System Setting 변경에 따른 POTENTIALLY_OUTDATED 검토 알림이 생성되어 있습니다.";
    }
  } else if (q.includes("high risk") || (q.includes("risk") && primaryMatch.id === "kno-insights-policy-factcheck-risk")) {
    directAnswer = "INSIGHTS에서 **HIGH Risk**는 규제(Regulation), 정확한 숫자(%), 금액($), 시장 규모(Market Size), 성장률(Growth Rate) 및 강한 인과 표현을 포함한 항목입니다.";
    bullets = [
      "HIGH Risk 검증 수칙: 승인 전 반드시 뒷받침하는 원본 근거(Source / Evidence)를 직접 재확인",
      "핵심 점검 예시: 'FDA certification', '매출 +22% 보장', '객단가 $35 증가' 등 수치/보장 문장 필수 검증",
      "MEDIUM Risk: 시장 트렌드, 검색 모멘텀 ('signals suggest' 수준 확인)",
      "LOW Risk: K SELECT 자체 운영 해석 및 체크리스트"
    ];
    relatedQuestions = [
      "MEDIUM Risk와 LOW Risk 기준은?",
      "Claim Status 정의 보기",
      "Revision 요청 가이드"
    ];
    actions.push({ label: "지식 상세 보기", url: `/admin/knowledge/${primaryMatch.id}`, type: "knowledge" });
    actions.push({ label: "Review Queue 열기", url: "/admin/insights/queue", type: "route" });
  } else if (q.includes("automation") || q.includes("status") || primaryMatch.id === "kno-insights-guide-automation-run-status") {
    directAnswer = "Daily Automation Run 상태는 **COMPLETED, PARTIAL, FAILED, SKIPPED_DUPLICATE, SKIPPED_TIME_WINDOW** 5가지로 구분됩니다.";
    bullets = [
      "COMPLETED: 정상 완료 (당일 기준 통과 Topic이 없어 0 Draft인 경우도 성공 처리)",
      "PARTIAL: 일부 Candidate 분석 또는 Visual 생성 실패 (Error Log 확인 필요)",
      "FAILED: System Run 자체 실패 (Source, Scheduler, Auth 확인)",
      "SKIPPED_DUPLICATE: 오늘 이미 실행 성공하여 중복 실행 방지됨",
      "핵심 원칙: '0 Draft Day ≠ Failure' (수량을 채우기 위한 저품질 작성 금지)"
    ];
    relatedQuestions = [
      "0 Draft Day란 무엇인가요?",
      "FAILED 시 오류 조치법",
      "Editorial Rules 설정 열기"
    ];
    actions.push({ label: "지식 상세 보기", url: `/admin/knowledge/${primaryMatch.id}`, type: "knowledge" });
    actions.push({ label: "Automation Runs 열기", url: "/admin/insights/automation-runs", type: "route" });
  } else if (q.includes("claim status") || primaryMatch.id === "kno-insights-def-claim-status") {
    directAnswer = "INSIGHTS Claim Status는 **FACT VERIFIED, VIEW INFERRED, SIGNAL, INTERNAL, ESTIMATE, STOP / UNSUPPORTED** 6가지로 정의됩니다.";
    bullets = [
      "FACT VERIFIED: 외부 객관적 공식 데이터로 입증된 Fact",
      "VIEW INFERRED: 여러 신호를 종합한 K SELECT 전문 분석관 추론",
      "SIGNAL: 시장에서 감지된 초기 정량/정성 신호",
      "ESTIMATE: 공개 데이터 기반 자체 모델링 추정치",
      "STOP / UNSUPPORTED: 근거가 부족하여 게재가 중단되거나 지지되지 않는 주소"
    ];
    relatedQuestions = [
      "FACT VERIFIED 검증 수칙",
      "HIGH Risk 수치 검증 수칙",
      "Revision 요청 가이드"
    ];
    actions.push({ label: "지식 상세 보기", url: `/admin/knowledge/${primaryMatch.id}`, type: "knowledge" });
    actions.push({ label: "Review Queue 열기", url: "/admin/insights/queue", type: "route" });
  } else if (q.includes("revision") || q.includes("reject") || primaryMatch.id === "kno-insights-sop-review-decision") {
    directAnswer = "승인 검토 시 판단 기준은 **GO · APPROVE, FIX · REQUEST REVISION, STOP · REJECT** 3가지입니다.";
    bullets = [
      "GO · APPROVE: Audience 가치, HIGH Risk 근거, Visual 정합성이 모두 확인된 경우",
      "FIX · REQUEST REVISION: 수치 근거 미흡, 타겟 독자군 표현 어색함 ➔ (어느 독자 / 어느 섹션 / 무엇을 어떻게 수정할지) 원칙 제시",
      "STOP · REJECT: 근거 불분명, 허위 수치, 독자층에 부적절한 기사 ➔ 거절 처리"
    ];
    relatedQuestions = [
      "HIGH Risk 수치 검증 수칙",
      "GO APPROVE 판정 가이드",
      "Knowledge 개정 방법"
    ];
    actions.push({ label: "지식 상세 보기", url: `/admin/knowledge/${primaryMatch.id}`, type: "knowledge" });
    actions.push({ label: "Review Queue 열기", url: "/admin/insights/queue", type: "route" });
  } else if (q.includes("매뉴얼") || primaryMatch.id === "kno-insights-manual-v10") {
    directAnswer = "현재 등록된 공식 매뉴얼은 **K SELECT INSIGHTS 실무자 운영 매뉴얼 v1.0**입니다. 수동 등록, 승인, 보안 및 시스템 룰 연동 표준 절차가 수록되어 있습니다.";
    bullets = [
      "버전: v1.0 (Effective: 2026-08-14)",
      "Audience: INTERNAL ONLY (외부 유출 금지)",
      "연결된 PDF Asset: K_SELECT_INSIGHTS_Operations_Manual_v1.0.pdf (7.2MB)"
    ];
    relatedQuestions = [
      "Create New Version 사용법",
      "Audience 지정 가이드",
      "Potentially Outdated 조치 방법"
    ];
    actions.push({ label: "지식 상세 보기", url: `/admin/knowledge/${primaryMatch.id}`, type: "knowledge" });
  } else if (q.includes("create new version") || q.includes("버전") || q.includes("수정")) {
    directAnswer = "이미 배포된 `PUBLISHED` 지식의 운영 기준이나 정책이 변경된 경우, 덮어쓰지 않고 **`Create New Version`**을 실행해야 합니다.";
    bullets = [
      "1. Knowledge Detail 상단 `VERSIONS` 탭 이동 ➔ `Create New Version` 클릭",
      "2. 무엇이 변경되었는지(What)와 왜 변경되었는지(Why) 필수 기록",
      "3. v1.1 Draft 작성 및 승인 ➔ Publish 시 기존 v1.0은 자동으로 `SUPERSEDED` 스냅샷 전환"
    ];
    relatedQuestions = [
      "Audience 지정 가이드",
      "Potentially Outdated 조치 방법",
      "매뉴얼 관리 방법"
    ];
    actions.push({ label: "Knowledge Library 열기", url: "/admin/knowledge/library", type: "route" });
  } else if (q.includes("audience") || q.includes("brand") || q.includes("sensitive")) {
    directAnswer = "Knowledge Center의 모든 신규 등록 지식 기본값은 **`INTERNAL ONLY`**입니다. 외부 공개(BRAND, RETAILER, PUBLIC) 지정 시 승인 워크플로우를 거칩니다.";
    bullets = [
      "INTERNAL: 내부 임직원 전용 (외부 검색 및 데이터 반환 0건)",
      "BRAND / RETAILER / PUBLIC: 외부 검토 승인(APPROVED) 및 PUBLISHED 필수",
      "Sensitive Internal: 마진, 원가, 내부 심사점수, 고유 알고리즘 등 절대 외부 공개 금지"
    ];
    relatedQuestions = [
      "Sensitive Internal 수칙",
      "외부 공개 리뷰 절차",
      "Knowledge Library 열기"
    ];
    actions.push({ label: "Knowledge Library 열기", url: "/admin/knowledge/library", type: "route" });
  } else if (q.includes("outdated")) {
    directAnswer = "`POTENTIALLY_OUTDATED`는 지식을 삭제하라는 의미가 아니라, **어드민 시스템 설정(Rule)이 변경되어 사람이 현재 지식 내용의 유효성을 재검토해야 함**을 의미합니다.";
    bullets = [
      "조치 1: 변경된 시스템 설정에 맞추어 `Create Updated Version`으로 개정 배포",
      "조치 2: 지식 내용이 여전히 유효함을 확인 후 사유(Reason) 입력 및 `No Update Required` 실행"
    ];
    relatedQuestions = [
      "Create New Version 사용법",
      "No Update Required 처리법",
      "Review & Updates 열기"
    ];
    actions.push({ label: "Review & Updates 열기", url: "/admin/knowledge/review", type: "route" });
  } else {
    // Default Fallback Summary from Knowledge Content
    directAnswer = primaryMatch.summary_ko || primaryMatch.summary_en || primaryMatch.title_ko;
    const cleanLines = (primaryMatch.content_ko || "").split("\n").filter(l => l.startsWith("- ") || l.startsWith("1. ") || l.startsWith("2. ")).slice(0, 4);
    bullets = cleanLines.length > 0 ? cleanLines.map(l => l.replace(/^[-1234567890.]*\s*/, "")) : [primaryMatch.summary_ko];
    relatedQuestions = [
      "관련 운영 정책 보기",
      "관련 SOP 절차 보기",
      "Knowledge Library에서 검색"
    ];
    actions.push({ label: "지식 상세 보기", url: `/admin/knowledge/${primaryMatch.id}`, type: "knowledge" });
  }

  // Attach Related Route Links if defined in Knowledge Relations
  const relations = await getStoreRelations(primaryMatch.id);
  relations.forEach(r => {
    if (r.related_route && !actions.some(a => a.url === r.related_route)) {
      actions.push({
        label: `${r.related_menu || "관련 페이지"} 열기`,
        url: r.related_route,
        type: "route"
      });
    }
  });

  return {
    id: `ans-${Date.now()}`,
    question,
    directAnswer,
    currentRuleBullets: bullets,
    liveRuleNote,
    sources,
    relatedManuals,
    relatedQuestions,
    actions,
    isUnknown: false,
    isReadonlyActionAttempt: false,
    createdAt: now
  };
}

// --------------------------------------------------
// Knowledge Gap & Feedback Logging
// --------------------------------------------------
export function recordKnowledgeGap(record: KnowledgeGapRecord): KnowledgeGapRecord {
  memoryGaps.unshift(record);
  return record;
}

export function getKnowledgeGaps(): KnowledgeGapRecord[] {
  return memoryGaps;
}

export function recordGuideFeedback(record: GuideFeedbackRecord): GuideFeedbackRecord {
  memoryFeedback.unshift(record);
  return record;
}

export function getGuideFeedback(): GuideFeedbackRecord[] {
  return memoryFeedback;
}
