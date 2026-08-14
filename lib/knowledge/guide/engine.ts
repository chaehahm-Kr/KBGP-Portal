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
import { getStoreAssets, getStoreRelations, getStoreKnowledgeById } from "../store";

// Storage for Knowledge Gaps and Feedback in memory
const memoryGaps: KnowledgeGapRecord[] = [];
const memoryFeedback: GuideFeedbackRecord[] = [];

// Priority ranking weight for Knowledge Types
const TYPE_PRIORITY_WEIGHTS: Record<KnowledgeType, number> = {
  SYSTEM_RULE: 100,
  POLICY: 90,
  SOP: 80,
  MANUAL: 70,
  GUIDE: 60,
  FAQ: 60,
  DEFINITION: 50,
  TRAINING: 50,
  DECISION_RECORD: 40,
  INTERNAL_RULE: 90
};

export async function processGuideQuestion(
  question: string,
  userContext: SecurityUserContext,
  currentRoute: string = "/admin"
): Promise<GuideAnswerResponse> {
  const now = new Date().toISOString();
  const q = question.toLowerCase().trim();

  // 1. Check for Read-Only Mutation / Action Attempts
  const isWriteAttempt = checkWriteActionAttempt(q);

  // 2. RETRIEVAL-LEVEL SECURITY: Fetch ONLY Authorized Knowledge items for this user
  const { items: authorizedItems } = await getAuthorizedKnowledgeList(userContext, {
    status: "PUBLISHED"
  });

  // Filter out SUPERSEDED and ARCHIVED from default retrieval
  const activeAuthorizedItems = authorizedItems.filter(
    i => i.status === "PUBLISHED" && !i.current_version.toLowerCase().includes("draft")
  );

  // 3. Handle Write Action Attempts immediately (Read-Only Enforcement)
  if (isWriteAttempt.isAttempt) {
    return buildReadonlyActionResponse(question, isWriteAttempt.actionType, activeAuthorizedItems, now);
  }

  // 4. Rank and Find Best Matching Knowledge Items
  const scoredItems = activeAuthorizedItems.map(item => {
    let score = 0;
    const itemTitle = (item.title + " " + item.title_ko + " " + item.title_en).toLowerCase();
    const itemSummary = (item.summary_ko + " " + item.summary_en).toLowerCase();
    const itemContent = (item.content_ko + " " + item.content_en).toLowerCase();
    const itemTags = item.tags.map(t => t.toLowerCase());

    // Keyword matching
    const keywords = q.split(/\s+/).filter(k => k.length > 1);
    keywords.forEach(kw => {
      if (itemTitle.includes(kw)) score += 30;
      if (itemTags.some(t => t.includes(kw))) score += 25;
      if (itemSummary.includes(kw)) score += 15;
      if (itemContent.includes(kw)) score += 5;
    });

    // Exact phrase bonus
    if (q.includes("topic score") && (itemTitle.includes("topic score") || itemContent.includes("topic score"))) score += 50;
    if (q.includes("fact check") && (itemTitle.includes("fact check") || itemContent.includes("fact check"))) score += 50;
    if (q.includes("automation") && (itemTitle.includes("automation") || itemContent.includes("automation"))) score += 50;
    if (q.includes("high risk") && itemContent.includes("high risk")) score += 50;
    if (q.includes("medium risk") && itemContent.includes("medium risk")) score += 50;
    if (q.includes("claim status") && itemTitle.includes("claim status")) score += 50;
    if (q.includes("revision") && (itemTitle.includes("approve") || itemContent.includes("revision"))) score += 50;
    if (q.includes("reject") && (itemTitle.includes("approve") || itemContent.includes("reject"))) score += 50;
    if (q.includes("매뉴얼") && (item.type === "MANUAL" || itemTitle.includes("매뉴얼"))) score += 50;
    if (q.includes("version") || q.includes("버전") || q.includes("수정")) {
      if (itemTitle.includes("매뉴얼") || itemContent.includes("version")) score += 40;
    }
    if (q.includes("brand") || q.includes("공개") || q.includes("audience")) {
      if (itemTitle.includes("faq") || itemTitle.includes("금지사항") || itemContent.includes("audience")) score += 40;
    }
    if (q.includes("outdated") || q.includes("system rule") || q.includes("rule")) {
      if (item.type === "SYSTEM_RULE" || itemContent.includes("outdated")) score += 40;
    }

    // Context aware weighting (currentRoute)
    if (currentRoute.includes("/admin/insights") && item.category === "INSIGHTS") score += 15;
    if (currentRoute.includes("/admin/knowledge") && item.category === "OPERATIONS") score += 15;

    // Type Priority Weighting
    score += (TYPE_PRIORITY_WEIGHTS[item.type] || 0) * 0.1;

    return { item, score };
  });

  scoredItems.sort((a, b) => b.score - a.score);

  const bestMatch = scoredItems.length > 0 && scoredItems[0].score > 15 ? scoredItems[0].item : null;

  // 5. Handle Unknown / Insufficient Authorized Knowledge
  if (!bestMatch) {
    recordKnowledgeGap({
      id: `gap-${Date.now()}`,
      question,
      user_id: userContext.userId,
      user_name: userContext.role,
      current_route: currentRoute,
      created_at: now
    });

    return {
      id: `ans-${Date.now()}`,
      question,
      directAnswer: "현재 승인된 K SELECT Knowledge에서 이 질문에 대한 충분한 공식 운영 기준을 확인하지 못했습니다.",
      currentRuleBullets: [
        "질문 내용에 해당하는 공식 Knowledge가 등록되지 않았거나, 열람 권한이 제한되어 있을 수 있습니다.",
        "K SELECT Knowledge Library에서 직접 검색하거나 Knowledge Gap 보고서를 제출해 주세요."
      ],
      sources: [],
      actions: [
        { label: "Knowledge Library에서 검색", url: `/admin/knowledge/library?search=${encodeURIComponent(question)}`, type: "library" },
        { label: "Knowledge Gap 보고", url: "#gap", type: "gap" }
      ],
      isUnknown: true,
      isReadonlyActionAttempt: false,
      createdAt: now
    };
  }

  // 6. Generate Answer from Best Matching Knowledge & Priority Hierarchy
  const topMatches = scoredItems.filter(s => s.score > 15).slice(0, 3).map(s => s.item);
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

  // Build Primary Citation
  sources.push({
    id: primaryMatch.id,
    title: primaryMatch.title_ko || primaryMatch.title,
    type: primaryMatch.type,
    version: primaryMatch.current_version,
    status: primaryMatch.status,
    effectiveDate: primaryMatch.effective_date,
    isLiveRule: primaryMatch.source_type === "LIVE_SYSTEM" || primaryMatch.source_type === "HYBRID"
  });

  // Additional Matches as Citations
  allMatches.slice(1).forEach(m => {
    if (!sources.some(s => s.id === m.id)) {
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

  // Specific Content Answers based on Topic
  if (q.includes("topic score") || primaryMatch.id === "kno-insights-rule-daily-auto") {
    directAnswer = "현재 적용 중인 K SELECT INSIGHTS의 Topic Score 기준은 **80점 이상**입니다. 기준점 80점을 통과한 Topic만 Daily Insight Candidate로 채택됩니다.";
    bullets = [
      "Priority 1 Ground Truth (LIVE RULE): Topic Score 80+ / Daily Run 05:00 ET",
      "NETWORK 모듈: 최대 3 Draft / HUB 모듈: 최대 3 Draft 생성 Quota 적용",
      "기준점 80점을 통과하는 Topic이 없는 경우 당일 생성 Draft가 0개일 수 있으며, 이는 정상적인 품질 검증 보호 동작입니다 (0 Draft Day ≠ Failure)."
    ];
    actions.push({ label: "View Knowledge Detail", url: `/admin/knowledge/${primaryMatch.id}`, type: "knowledge" });
    actions.push({ label: "Go to Editorial Rules", url: "/admin/insights/rules", type: "route" });

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
    actions.push({ label: "View Knowledge Detail", url: `/admin/knowledge/${primaryMatch.id}`, type: "knowledge" });
    actions.push({ label: "Go to Review Queue", url: "/admin/insights/queue", type: "route" });
  } else if (q.includes("automation") || q.includes("status") || primaryMatch.id === "kno-insights-guide-automation-run-status") {
    directAnswer = "Daily Automation Run 상태는 **COMPLETED, PARTIAL, FAILED, SKIPPED_DUPLICATE, SKIPPED_TIME_WINDOW** 5가지로 구분됩니다.";
    bullets = [
      "COMPLETED: 정상 완료 (당일 기준 통과 Topic이 없어 0 Draft인 경우도 성공 처리)",
      "PARTIAL: 일부 Candidate 분석 또는 Visual 생성 실패 (Error Log 확인 필요)",
      "FAILED: System Run 자체 실패 (Source, Scheduler, Auth 확인)",
      "SKIPPED_DUPLICATE: 오늘 이미 실행 성공하여 중복 실행 방지됨",
      "핵심 원칙: '0 Draft Day ≠ Failure' (수량을 채우기 위한 저품질 작성 금지)"
    ];
    actions.push({ label: "View Knowledge Detail", url: `/admin/knowledge/${primaryMatch.id}`, type: "knowledge" });
    actions.push({ label: "Go to Automation Runs", url: "/admin/insights/automation-runs", type: "route" });
  } else if (q.includes("claim status") || primaryMatch.id === "kno-insights-def-claim-status") {
    directAnswer = "INSIGHTS Claim Status는 **FACT VERIFIED, VIEW INFERRED, SIGNAL, INTERNAL, ESTIMATE, STOP / UNSUPPORTED** 6가지로 정의됩니다.";
    bullets = [
      "FACT VERIFIED: 외부 객관적 공식 데이터로 입증된 Fact",
      "VIEW INFERRED: 여러 신호를 종합한 K SELECT 전문 분석관 추론",
      "SIGNAL: 시장에서 감지된 초기 정량/정성 신호",
      "ESTIMATE: 공개 데이터 기반 자체 모델링 추정치",
      "STOP / UNSUPPORTED: 근거가 부족하여 게재가 중단되거나 지지되지 않는 주소"
    ];
    actions.push({ label: "View Knowledge Detail", url: `/admin/knowledge/${primaryMatch.id}`, type: "knowledge" });
    actions.push({ label: "Go to Review Queue", url: "/admin/insights/queue", type: "route" });
  } else if (q.includes("revision") || q.includes("reject") || primaryMatch.id === "kno-insights-sop-review-decision") {
    directAnswer = "승인 검토 시 판단 기준은 **GO · APPROVE, FIX · REQUEST REVISION, STOP · REJECT** 3가지입니다.";
    bullets = [
      "GO · APPROVE: Audience 가치, HIGH Risk 근거, Visual 정합성이 모두 확인된 경우",
      "FIX · REQUEST REVISION: 수치 근거 미흡, 타겟 독자군 표현 어색함 ➔ (어느 독자 / 어느 섹션 / 무엇을 어떻게 수정할지) 원칙 제시",
      "STOP · REJECT: 근거 불분명, 허위 수치, 독자층에 부적절한 기사 ➔ 거절 처리"
    ];
    actions.push({ label: "View Knowledge Detail", url: `/admin/knowledge/${primaryMatch.id}`, type: "knowledge" });
    actions.push({ label: "Go to Review Queue", url: "/admin/insights/queue", type: "route" });
  } else if (q.includes("매뉴얼") || primaryMatch.id === "kno-insights-manual-v10") {
    directAnswer = "현재 등록된 공식 매뉴얼은 **K SELECT INSIGHTS 실무자 운영 매뉴얼 v1.0**입니다. 수동 등록, 승인, 보안 및 시스템 룰 연동 표준 절차가 수록되어 있습니다.";
    bullets = [
      "버전: v1.0 (Effective: 2026-08-14)",
      "Audience: INTERNAL ONLY (외부 유출 금지)",
      "연결된 PDF Asset: K_SELECT_INSIGHTS_Operations_Manual_v1.0.pdf (7.2MB)"
    ];
    actions.push({ label: "View Knowledge Detail", url: `/admin/knowledge/${primaryMatch.id}`, type: "knowledge" });

    // Attach Secure Manual PDF Delivery Asset Link if available
    const assets = await getStoreAssets(primaryMatch.id);
    if (assets.length > 0) {
      actions.push({ label: "View Manual (Secure PDF)", url: `/api/admin/knowledge/asset/${assets[0].id}?action=view`, type: "manual" });
      actions.push({ label: "Download Manual PDF", url: `/api/admin/knowledge/asset/${assets[0].id}?action=download`, type: "download" });
    }
  } else if (q.includes("create new version") || q.includes("버전") || q.includes("수정")) {
    directAnswer = "이미 배포된 `PUBLISHED` 지식의 운영 기준이나 정책이 변경된 경우, 덮어쓰지 않고 **`Create New Version`**을 실행해야 합니다.";
    bullets = [
      "1. Knowledge Detail 상단 `VERSIONS` 탭 이동 ➔ `Create New Version` 클릭",
      "2. 무엇이 변경되었는지(What)와 왜 변경되었는지(Why) 필수 기록",
      "3. v1.1 Draft 작성 및 승인 ➔ Publish 시 기존 v1.0은 자동으로 `SUPERSEDED` 스냅샷 전환"
    ];
    actions.push({ label: "Go to Knowledge Library", url: "/admin/knowledge/library", type: "route" });
  } else if (q.includes("audience") || q.includes("brand") || q.includes("sensitive")) {
    directAnswer = "Knowledge Center의 모든 신규 등록 지식 기본값은 **`INTERNAL ONLY`**입니다. 외부 공개(BRAND, RETAILER, PUBLIC) 지정 시 승인 워크플로우를 거칩니다.";
    bullets = [
      "INTERNAL: 내부 임직원 전용 (외부 검색 및 데이터 반환 0건)",
      "BRAND / RETAILER / PUBLIC: 외부 검토 승인(APPROVED) 및 PUBLISHED 필수",
      "Sensitive Internal: 마진, 원가, 내부 심사점수, 고유 알고리즘 등 절대 외부 공개 금지"
    ];
    actions.push({ label: "Go to Knowledge Library", url: "/admin/knowledge/library", type: "route" });
  } else if (q.includes("outdated")) {
    directAnswer = "`POTENTIALLY_OUTDATED`는 지식을 삭제하라는 의미가 아니라, **어드민 시스템 설정(Rule)이 변경되어 사람이 현재 지식 내용의 유효성을 재검토해야 함**을 의미합니다.";
    bullets = [
      "조치 1: 변경된 시스템 설정에 맞추어 `Create Updated Version`으로 개정 배포",
      "조치 2: 지식 내용이 여전히 유효함을 확인 후 사유(Reason) 입력 및 `No Update Required` 실행"
    ];
    actions.push({ label: "Go to Review & Updates", url: "/admin/knowledge/review", type: "route" });
  } else {
    // Default Fallback Summary from Knowledge Content
    directAnswer = primaryMatch.summary_ko || primaryMatch.summary_en || primaryMatch.title_ko;
    const cleanLines = (primaryMatch.content_ko || "").split("\n").filter(l => l.startsWith("- ") || l.startsWith("1. ") || l.startsWith("2. ")).slice(0, 4);
    bullets = cleanLines.length > 0 ? cleanLines.map(l => l.replace(/^[-1234567890.]*\s*/, "")) : [primaryMatch.summary_ko];
    actions.push({ label: "View Knowledge Detail", url: `/admin/knowledge/${primaryMatch.id}`, type: "knowledge" });
  }

  // Attach Related Route Links if defined in Knowledge Relations
  const relations = await getStoreRelations(primaryMatch.id);
  relations.forEach(r => {
    if (r.related_route && !actions.some(a => a.url === r.related_route)) {
      actions.push({
        label: `Go to ${r.related_menu || "Related Page"}`,
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
