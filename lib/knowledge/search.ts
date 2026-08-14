import {
  KnowledgeItem,
  SecurityUserContext,
  KnowledgeFilterOptions,
  AudienceType
} from "./types";
import { getStoreKnowledgeItems } from "./store";
import { isAuthorizedForAudience } from "./retrieval";

// --------------------------------------------------
// Korean <-> English Alias & Synonym Dictionary
// --------------------------------------------------
export const ALIAS_DICTIONARY: Record<string, string[]> = {
  INSIGHTS: ["insights", "insight", "인사이트", "인싸이트", "인사이트기사", "인사이트뉴스", "insighp"],
  MANUAL: ["manual", "manul", "매뉴얼", "메뉴얼", "사용법", "운영 가이드", "실무 가이드", "운영 매뉴얼"],
  APPROVE: ["approve", "approval", "승인", "게재 승인", "기사 승인", "go approve"],
  REVISION: ["revision", "수정", "수정 요청", "재검토", "fix revision", "리비전"],
  REVIEW: ["review", "검토", "심사", "리뷰", "검토 큐"],
  AUTOMATION: ["automation", "자동화", "자동 실행", "오토메이션", "데일리 오토"],
  PUBLISHED: ["publish", "published", "publication", "발행", "게시", "공개"],
  SYSTEM_RULE: ["system rule", "system_rule", "운영 기준", "시스템 기준", "설정 기준", "룰", "규칙"],
  SOP: ["sop", "표준 절차", "절차", "작업 절차"],
  POLICY: ["policy", "정책", "규정", "팩트체크", "위험성", "팩트 체크"],
  FAQ: ["faq", "자주 묻는 질문", "질문", "q&a"],
  DEFINITION: ["definition", "용어 정의", "정의", "상태 정의", "claim status"],
  BRAND: ["brand", "브랜드", "파트너"],
  RETAILER: ["retailer", "retialer", "리테일러", "바이어"],
  OUTDATED: ["outdated", "potentially_outdated", "구버전", "업데이트 검토"]
};

// Natural language intent mapping rules
interface IntentPattern {
  keywords: string[];
  matchedIdsOrSlugs: string[];
  boostScore: number;
}

const INTENT_PATTERNS: IntentPattern[] = [
  {
    keywords: ["글 안 나왔는데", "0 draft", "0개", "글이 하나도", "오늘 글 안", "0 draft day"],
    matchedIdsOrSlugs: ["kno-insights-guide-automation-run-status", "kno-insights-rule-daily-auto"],
    boostScore: 120
  },
  {
    keywords: ["강한 숫자", "위험한 숫자", "숫자 검증", "risk", "high risk", "수치 근거"],
    matchedIdsOrSlugs: ["kno-insights-policy-factcheck-risk"],
    boostScore: 120
  },
  {
    keywords: ["발행된 정책", "정책 고치고", "매뉴얼 바꾸는", "기존 정책", "version", "버전 수정"],
    matchedIdsOrSlugs: ["kno-insights-manual-v10"],
    boostScore: 120
  },
  {
    keywords: ["자동 발행", "자동 게시", "auto publish"],
    matchedIdsOrSlugs: ["kno-insights-rule-daily-auto", "kno-insights-sop-review-decision"],
    boostScore: 120
  },
  {
    keywords: ["리비전", "수정 요청", "reject", "거절"],
    matchedIdsOrSlugs: ["kno-insights-sop-review-decision"],
    boostScore: 120
  }
];

export interface SearchCoreOptions {
  mode: "LIBRARY" | "GUIDE";
  userContext: SecurityUserContext;
  filters?: KnowledgeFilterOptions;
  currentRoute?: string;
  selectedModule?: string;
}

export interface SearchCoreResult {
  items: KnowledgeItem[];
  total: number;
  suggestionNotice?: string | null;
  expandedTokens: string[];
  canonicalQuery: string;
}

/**
 * Shared Knowledge Search Core used by both Knowledge Library and K SELECT Guide V1.
 */
export async function searchKnowledgeCore(
  rawQuery: string,
  options: SearchCoreOptions
): Promise<SearchCoreResult> {
  const { mode, userContext, filters = {}, currentRoute = "/admin", selectedModule } = options;
  const rawItems = await getStoreKnowledgeItems();

  // 1. SECURITY: Enforce Strict Audience Security (Deny-by-Default)
  const authorizedItems = rawItems.filter(item => isAuthorizedForAudience(userContext, item));

  // 2. Mode-Specific Status Filtering
  let candidatePool = [...authorizedItems];

  if (mode === "GUIDE") {
    // Guide Mode: STRICTLY Current Published Only (Hide SUPERSEDED and ARCHIVED)
    candidatePool = candidatePool.filter(
      item => item.status === "PUBLISHED" && !item.current_version.toLowerCase().includes("draft")
    );

    // MODULE-SCOPED RETRIEVAL RULE:
    // If selectedModule is specified (e.g. SIMULATOR, KNOWLEDGE, INSIGHTS), restrict candidatePool strictly to that module.
    if (selectedModule) {
      candidatePool = candidatePool.filter(item => item.category === selectedModule);
    }
  } else {
    // Library Mode: Apply Status Filter
    if (filters.status && filters.status !== "ALL") {
      candidatePool = candidatePool.filter(item => item.status === filters.status);
    } else {
      // Default library view excludes SUPERSEDED and ARCHIVED
      candidatePool = candidatePool.filter(
        item => item.status !== "SUPERSEDED" && item.status !== "ARCHIVED"
      );
    }

    if (filters.type && filters.type !== "ALL") {
      candidatePool = candidatePool.filter(item => item.type === filters.type);
    }
    if (filters.audience && filters.audience !== "ALL") {
      candidatePool = candidatePool.filter(item => item.audience.includes(filters.audience as AudienceType));
    }
    if (filters.module && filters.module !== "ALL") {
      candidatePool = candidatePool.filter(item => item.category === filters.module);
    }
    if (filters.language && filters.language !== "ALL") {
      if (filters.language === "KO") candidatePool = candidatePool.filter(i => Boolean(i.title_ko && i.content_ko));
      else if (filters.language === "EN") candidatePool = candidatePool.filter(i => Boolean(i.title_en && i.content_en));
      else if (filters.language === "BOTH") candidatePool = candidatePool.filter(i => Boolean(i.title_ko && i.title_en));
    }
  }

  const cleanQuery = normalizeQueryString(rawQuery);

  if (!cleanQuery) {
    // If empty query, apply sorting
    sortItems(candidatePool, filters.sortBy);
    return {
      items: candidatePool,
      total: candidatePool.length,
      suggestionNotice: null,
      expandedTokens: [],
      canonicalQuery: ""
    };
  }

  // 3. Query Normalization & Alias/Synonym Expansion
  const { expandedTokens, canonicalTerms, suggestionNotice } = expandQueryAliasesAndTypos(cleanQuery);

  // 4. Scoring Candidate Items
  const scoredList = candidatePool.map(item => {
    let score = 0;
    const titleText = (item.title + " " + item.title_ko + " " + item.title_en).toLowerCase();
    const summaryText = (item.summary_ko + " " + item.summary_en).toLowerCase();
    const contentText = (item.content_ko + " " + item.content_en).toLowerCase();
    const itemTags = item.tags.map(t => t.toLowerCase());

    // A. Natural Language Intent Patterns
    INTENT_PATTERNS.forEach(pattern => {
      if (pattern.keywords.some(kw => cleanQuery.includes(kw))) {
        if (pattern.matchedIdsOrSlugs.includes(item.id) || pattern.matchedIdsOrSlugs.includes(item.slug)) {
          score += pattern.boostScore;
        }
      }
    });

    // B. Canonical & Alias Exact/Contains Match
    canonicalTerms.forEach(term => {
      if (titleText.includes(term.toLowerCase())) score += 80;
      if (item.type.toLowerCase() === term.toLowerCase()) score += 70;
      if (item.category.toLowerCase() === term.toLowerCase()) score += 50;
      if (itemTags.some(t => t.includes(term.toLowerCase()))) score += 60;
      if (summaryText.includes(term.toLowerCase())) score += 40;
    });

    // C. Token Matching (Expanded Tokens including typos/synonyms)
    expandedTokens.forEach(token => {
      const t = token.toLowerCase();
      if (titleText.includes(t)) score += 40;
      if (itemTags.some(tag => tag.includes(t))) score += 35;
      if (summaryText.includes(t)) score += 20;
      if (contentText.includes(t)) score += 10;
    });

    // D. Fuzzy String Matching for Typos
    const wordsInQuery = cleanQuery.split(/\s+/);
    wordsInQuery.forEach(w => {
      if (w.length >= 3) {
        if (calculateLevenshtein(w, "insights") <= 2 && titleText.includes("insights")) score += 50;
        if (calculateLevenshtein(w, "manual") <= 2 && (item.type === "MANUAL" || titleText.includes("매뉴얼"))) score += 50;
        if (calculateLevenshtein(w, "retailer") <= 2 && (titleText.includes("retailer") || itemTags.includes("retailer"))) score += 50;
      }
    });

    // E. Route Context Weighting (Guide Mode)
    if (mode === "GUIDE") {
      if (currentRoute.includes("/admin/insights") && item.category === "INSIGHTS") score += 25;
      if (currentRoute.includes("/admin/knowledge") && item.category === "OPERATIONS") score += 25;

      // Type Priority Hierarchy Weight
      if (item.type === "SYSTEM_RULE") score += 30;
      else if (item.type === "POLICY") score += 25;
      else if (item.type === "SOP") score += 20;
      else if (item.type === "MANUAL") score += 15;
    }

    return { item, score };
  });

  // Filter out non-matching items (score > 0)
  const matched = scoredList.filter(s => s.score > 0);
  matched.sort((a, b) => b.score - a.score);

  const finalItems = matched.map(m => m.item);

  return {
    items: finalItems,
    total: finalItems.length,
    suggestionNotice: finalItems.length > 0 ? suggestionNotice : null,
    expandedTokens,
    canonicalQuery: cleanQuery
  };
}

// --------------------------------------------------
// Helpers: Normalization, Alias Expansion, Levenshtein
// --------------------------------------------------

export function normalizeQueryString(q: string): string {
  return q
    .toLowerCase()
    .trim()
    .replace(/[-_.,!?~]/g, " ")
    .replace(/\s+/g, " ");
}

export function expandQueryAliasesAndTypos(query: string): {
  expandedTokens: string[];
  canonicalTerms: string[];
  suggestionNotice: string | null;
} {
  const expandedTokens: Set<string> = new Set(query.split(" "));
  const canonicalTerms: Set<string> = new Set();
  let suggestionNotice: string | null = null;

  Object.entries(ALIAS_DICTIONARY).forEach(([canonicalKey, aliases]) => {
    const isMatched = aliases.some(alias => {
      if (query.includes(alias)) return true;
      // Check fuzzy match for misspellings like 'insighp', 'retialer', 'manul'
      const queryWords = query.split(" ");
      return queryWords.some(w => w.length >= 4 && calculateLevenshtein(w, alias) <= 2);
    });

    if (isMatched) {
      canonicalTerms.add(canonicalKey);
      aliases.forEach(a => expandedTokens.add(a));

      // Generate suggestion notice for Korean or Typo queries
      if (canonicalKey === "INSIGHTS" && (query.includes("인사이트") || query.includes("인싸이트") || query.includes("insighp"))) {
        suggestionNotice = "INSIGHTS 관련 지식 및 매뉴얼 결과를 표시하고 있습니다.";
      } else if (canonicalKey === "MANUAL" && (query.includes("메뉴얼") || query.includes("manul") || query.includes("사용법"))) {
        suggestionNotice = "MANUAL (매뉴얼) 관련 지식을 표시하고 있습니다.";
      } else if (canonicalKey === "RETAILER" && query.includes("retialer")) {
        suggestionNotice = "RETAILER (리테일러) 관련 지식을 표시하고 있습니다.";
      }
    }
  });

  return {
    expandedTokens: Array.from(expandedTokens),
    canonicalTerms: Array.from(canonicalTerms),
    suggestionNotice
  };
}

/**
 * Calculates Levenshtein Distance between two strings for fuzzy matching.
 */
export function calculateLevenshtein(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

function sortItems(items: KnowledgeItem[], sortBy?: string) {
  if (sortBy === "title") {
    items.sort((a, b) => a.title.localeCompare(b.title));
  } else if (sortBy === "updated") {
    items.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  } else {
    items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }
}
