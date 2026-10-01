"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AskAnswerResponse, AskSourceCitation } from "@/lib/knowledge/ask-engine";
import { CANONICAL_BRAND_TOPICS, CanonicalTopic, matchTopicForKnowledge, matchTopicForFaq } from "@/lib/knowledge/topics";

export interface HelpItem {
  id: string;
  slug: string;
  title: string;
  title_ko: string;
  title_en: string;
  summary_ko: string;
  summary_en: string;
  type: string;
  module: string;
  category: string;
  tags: string[];
  current_version: string;
  effective_date: string;
  document_url?: string | null;
  document_name?: string | null;
  updated_at: string;
}

export interface HelpCenterMainViewProps {
  portalType: "BRAND" | "RETAILER";
  baseHelpPath: string;
  baseSupportPath: string;
  apiEndpoint: string;
  heroBadgeText?: string;
  heroTitle?: string;
  heroSubtitle?: string;
  searchPlaceholder?: string;
  supportCtaText?: string;
  supportDescription?: string;
}

export function HelpCenterMainView({
  portalType,
  baseHelpPath,
  baseSupportPath,
  apiEndpoint,
  heroBadgeText = "Official Knowledge & Policy",
  heroTitle = "무엇을 도와드릴까요?",
  heroSubtitle = "K SELECT 이용 방법이나 정책에 대해 궁금한 내용을 질문해 주세요.",
  searchPlaceholder = "궁금한 내용을 입력해 주세요... (예: 브랜드 등록, 상표권, 출고지, FAQ 등)",
  supportCtaText = "1:1 문의하기",
  supportDescription = "도움말에서 해결되지 않은 문제는 담당자에게 문의해 주세요."
}: HelpCenterMainViewProps) {
  const router = useRouter();

  // Knowledge & FAQ Data State
  const [items, setItems] = useState<HelpItem[]>([]);
  const [faqs, setFaqs] = useState<any[]>([]);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Integrated Question / Ask State
  const [questionInput, setQuestionInput] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const [askResponse, setAskResponse] = useState<AskAnswerResponse | null>(null);
  const [askError, setAskError] = useState<string | null>(null);

  // Filters & State
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string>("ALL");
  const [librarySearch, setLibrarySearch] = useState<string>("");
  const [openFaqId, setOpenFaqId] = useState<string | null>(null);
  const [openTopicFaqId, setOpenTopicFaqId] = useState<string | null>(null);

  // Refs for smooth navigation
  const questionInputRef = useRef<HTMLInputElement>(null);
  const topicDetailSectionRef = useRef<HTMLDivElement>(null);
  const askResultRef = useRef<HTMLDivElement>(null);
  const topHeroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchHelpItems();
    fetchFaqs();
    fetchSuggestedQuestions();
  }, [apiEndpoint, portalType]);

  const fetchHelpItems = async () => {
    setLoading(true);
    try {
      const res = await fetch(apiEndpoint);
      if (res.ok) {
        const json = await res.json();
        setItems(json.items || []);
      }
    } catch (e) {
      console.error("Failed to load help items:", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchFaqs = async () => {
    try {
      const res = await fetch(`/api/knowledge/faqs?audience=${portalType}&kind=FAQ`);
      if (res.ok) {
        const json = await res.json();
        const list = json.items || json.faqs || [];
        setFaqs(list);
      }
    } catch (e) {
      console.error("Failed to load FAQs:", e);
    }
  };

  const fetchSuggestedQuestions = async () => {
    try {
      const res = await fetch(`/api/knowledge/faqs?audience=${portalType}&kind=SUGGESTED_QUESTION`);
      if (res.ok) {
        const json = await res.json();
        const list = json.items || json.faqs || [];
        if (Array.isArray(list)) {
          const qList = list.map((f: any) => f.question_ko).filter(Boolean);
          setSuggestedQuestions(qList);
        }
      }
    } catch (e) {
      console.error("Failed to load suggested questions:", e);
    }
  };

  // Primary Question Handler (Reusing Ask K SELECT Grounded Engine)
  const handleAskQuestion = async (queryText?: string) => {
    const q = (queryText || questionInput).trim();
    if (!q) return;

    setIsAsking(true);
    setAskError(null);
    setQuestionInput(q);

    try {
      const res = await fetch("/api/knowledge/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q,
          audience: portalType === "BRAND" ? "BRAND" : "RETAILER",
          currentRoute: baseHelpPath
        })
      });

      if (!res.ok) {
        throw new Error(`답변 조회에 실패했습니다. (상태 코드: ${res.status})`);
      }

      const data = await res.json();
      setAskResponse(data);

      setTimeout(() => {
        askResultRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 100);
    } catch (err: any) {
      console.error("Help Center question error:", err);
      setAskError(err.message || "답변을 조회하는 중 오류가 발생했습니다. 다시 시도해 주세요.");
    } finally {
      setIsAsking(false);
    }
  };

  // Focus and scroll to top question input
  const handleFocusQuestionInput = () => {
    topHeroRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(() => {
      questionInputRef.current?.focus();
    }, 400);
  };

  // Support Escalation Handler with Context Handoff (KNW-SUP-001)
  const handleEscalateToSupport = (actionType: "NO_ANSWER" | "PARTIAL" | "ANSWERED" | "GENERAL" = "GENERAL") => {
    if (askResponse || questionInput.trim()) {
      try {
        const askResult = askResponse?.isUnknown
          ? "NO_ANSWER"
          : ((askResponse?.sources?.length ?? 0) > 0 ? "ANSWERED" : "PARTIAL");

        const handoffSources = (askResponse?.sources || []).map((src: AskSourceCitation) => ({
          id: src.id,
          title: src.title,
          version: src.version,
          url: src.url,
          type: src.type
        }));

        const contextPayload = {
          origin: "ASK_KSELECT",
          portalType,
          question: questionInput || askResponse?.question || "",
          askResult,
          answerSummary: askResponse?.directAnswer || "",
          sources: handoffSources,
          timestamp: new Date().toISOString()
        };

        if (typeof window !== "undefined" && window.sessionStorage) {
          window.sessionStorage.setItem("kselect_ask_escalation_context", JSON.stringify(contextPayload));
        }
      } catch (e) {
        console.error("Failed to store ask escalation context in sessionStorage:", e);
      }
      router.push(`${baseSupportPath}?new=1&origin=ASK_KSELECT`);
    } else {
      router.push(baseSupportPath);
    }
  };

  // Primary Topic Mapping: Every knowledge item has exactly ONE Primary Topic (Section 13)
  const itemPrimaryTopicMap = useMemo(() => {
    const map = new Map<string, CanonicalTopic>();
    items.forEach(item => {
      map.set(item.id, matchTopicForKnowledge(item));
    });
    return map;
  }, [items]);

  // Primary Topic Mapping for FAQs
  const faqPrimaryTopicMap = useMemo(() => {
    const map = new Map<string, CanonicalTopic>();
    faqs.forEach(faq => {
      const parentItem = items.find(i => i.id === faq.source_knowledge_id);
      map.set(faq.id, matchTopicForFaq(faq, parentItem));
    });
    return map;
  }, [faqs, items]);

  // Dynamic Topic Stats: Calculate unique count per canonical topic (Section 15)
  const topicStats = useMemo(() => {
    const counts: Record<string, { knowledgeCount: number; faqCount: number; total: number }> = {};
    CANONICAL_BRAND_TOPICS.forEach(topic => {
      counts[topic.id] = { knowledgeCount: 0, faqCount: 0, total: 0 };
    });

    items.forEach(item => {
      const topic = itemPrimaryTopicMap.get(item.id);
      if (topic && counts[topic.id]) {
        counts[topic.id].knowledgeCount += 1;
        counts[topic.id].total += 1;
      }
    });

    faqs.forEach(faq => {
      const topic = faqPrimaryTopicMap.get(faq.id);
      if (topic && counts[topic.id]) {
        counts[topic.id].faqCount += 1;
        counts[topic.id].total += 1;
      }
    });

    return counts;
  }, [items, faqs, itemPrimaryTopicMap, faqPrimaryTopicMap]);

  // Dynamic Topic Visibility: Topics with usable content (total > 0)
  const activeTopics = useMemo(() => {
    return CANONICAL_BRAND_TOPICS.filter(t => (topicStats[t.id]?.total || 0) > 0);
  }, [topicStats]);

  // Selected Topic Object
  const currentSelectedTopic = useMemo(() => {
    if (!selectedTopicId) return null;
    return CANONICAL_BRAND_TOPICS.find(t => t.id === selectedTopicId) || null;
  }, [selectedTopicId]);

  // FAQs belonging to the selected Topic
  const topicSpecificFaqs = useMemo(() => {
    if (!selectedTopicId) return [];
    return faqs.filter(faq => {
      const topic = faqPrimaryTopicMap.get(faq.id);
      return topic?.id === selectedTopicId;
    });
  }, [faqs, selectedTopicId, faqPrimaryTopicMap]);

  // Knowledge Items belonging to the selected Topic
  const topicSpecificItems = useMemo(() => {
    if (!selectedTopicId) return [];
    return items.filter(item => {
      const topic = itemPrimaryTopicMap.get(item.id);
      return topic?.id === selectedTopicId;
    });
  }, [items, selectedTopicId, itemPrimaryTopicMap]);

  // Filtered Knowledge Items for Section 5 (All Help Content)
  const filteredAllItems = useMemo(() => {
    return items.filter(item => {
      // Type filter
      if (selectedType !== "ALL" && item.type.toUpperCase() !== selectedType.toUpperCase()) {
        return false;
      }

      // Search filter
      const q = librarySearch.trim().toLowerCase();
      if (!q) return true;

      return (
        item.title?.toLowerCase().includes(q) ||
        item.title_ko?.toLowerCase().includes(q) ||
        item.title_en?.toLowerCase().includes(q) ||
        item.summary_ko?.toLowerCase().includes(q) ||
        item.summary_en?.toLowerCase().includes(q) ||
        item.tags?.some(t => t.toLowerCase().includes(q)) ||
        item.module?.toLowerCase().includes(q) ||
        item.category?.toLowerCase().includes(q)
      );
    });
  }, [items, selectedType, librarySearch]);

  // Available unique types from published items
  const availableTypes = useMemo(() => {
    const set = new Set<string>();
    items.forEach(i => {
      if (i.type) set.add(i.type);
    });
    return Array.from(set);
  }, [items]);

  // Quick fallback questions
  const defaultQuickQuestions = [
    "브랜드는 어떻게 등록하나요?",
    "상표권이 없어도 브랜드 등록이 가능한가요?",
    "상품이 연결된 브랜드를 삭제할 수 있나요?",
    "동일한 브랜드를 여러 회사가 취급할 수 있나요?"
  ];

  const displayQuickQuestions = suggestedQuestions.length > 0
    ? suggestedQuestions.slice(0, 4)
    : defaultQuickQuestions;

  const getTypeBadge = (type: string) => {
    switch (type?.toUpperCase()) {
      case "MANUAL":
        return <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800">MANUAL</span>;
      case "POLICY":
        return <span className="rounded-full bg-purple-50 px-2.5 py-0.5 text-[11px] font-bold text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800">POLICY</span>;
      case "FAQ":
        return <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">FAQ</span>;
      case "SOP":
        return <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800">SOP</span>;
      case "GUIDE":
        return <span className="rounded-full bg-sky-50 px-2.5 py-0.5 text-[11px] font-bold text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 border border-sky-200 dark:border-sky-800">GUIDE</span>;
      default:
        return <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-[11px] font-bold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">{type}</span>;
    }
  };

  const handleTopicCardClick = (topicId: string) => {
    setSelectedTopicId(topicId);
    setTimeout(() => {
      topicDetailSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  return (
    <div className="space-y-10 max-w-5xl mx-auto px-4 sm:px-6 py-6 select-text">
      {/* ========================================================================= */}
      {/* SECTION 1: PRIMARY QUESTION EXPERIENCE (Hero & Question Input)           */}
      {/* ========================================================================= */}
      <div ref={topHeroRef} className="rounded-2xl bg-gradient-to-b from-zinc-900 via-[#131E2E] to-zinc-900 text-white p-6 sm:p-10 shadow-lg space-y-6 text-center">
        <div className="space-y-2 max-w-2xl mx-auto">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold tracking-wider text-cyan-300 backdrop-blur-xs">
            <span>🛡️</span> {heroBadgeText}
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            {heroTitle}
          </h1>
          <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
            {heroSubtitle}
          </p>
        </div>

        {/* Primary Unified Question Input Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAskQuestion();
          }}
          className="max-w-2xl mx-auto space-y-3"
        >
          <div className="relative flex items-center">
            <span className="absolute left-4 text-zinc-400 text-lg select-none">💬</span>
            <input
              ref={questionInputRef}
              type="text"
              value={questionInput}
              onChange={(e) => setQuestionInput(e.target.value)}
              placeholder={searchPlaceholder}
              disabled={isAsking}
              className="w-full rounded-xl bg-white text-zinc-900 dark:bg-zinc-900 dark:text-white pl-12 pr-28 py-3.5 text-sm font-medium shadow-lg border border-zinc-200 dark:border-zinc-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition-all placeholder:text-zinc-400 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={isAsking || !questionInput.trim()}
              className="absolute right-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1"
            >
              {isAsking ? (
                <span>조회 중...</span>
              ) : (
                <>
                  <span>질문하기</span>
                  <span>&rarr;</span>
                </>
              )}
            </button>
          </div>

          {/* Quick Question Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none text-xs">
            <span className="text-zinc-400 text-[11px] shrink-0 font-medium">추천 질문:</span>
            {displayQuickQuestions.map((qText, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleAskQuestion(qText)}
                className="rounded-full bg-white/10 hover:bg-white/20 text-zinc-200 hover:text-white px-3 py-1 text-[11px] font-medium transition-all shrink-0 cursor-pointer border border-white/10"
              >
                {qText}
              </button>
            ))}
          </div>
        </form>
      </div>

      {/* Loading Skeleton for Question */}
      {isAsking && (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 sm:p-8 shadow-sm space-y-4 animate-pulse">
          <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-1/4" />
          <div className="h-6 bg-zinc-200 dark:bg-zinc-800 rounded w-3/4" />
          <div className="space-y-2 pt-2">
            <div className="h-4 bg-zinc-100 dark:bg-zinc-800/60 rounded w-full" />
            <div className="h-4 bg-zinc-100 dark:bg-zinc-800/60 rounded w-5/6" />
          </div>
        </div>
      )}

      {/* Error Message */}
      {askError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300 flex items-center justify-between">
          <span>⚠️ {askError}</span>
          <button
            type="button"
            onClick={() => setAskError(null)}
            className="text-red-500 hover:text-red-700 font-bold ml-2 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Grounded Answer Card (Integrated In-Place Result) */}
      {askResponse && !isAsking && (
        <div ref={askResultRef} className="space-y-6 transition-all duration-300">
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 sm:p-8 shadow-md space-y-6">
            {/* Answer Header */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-4">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  <span>🛡️</span>
                  <span>{askResponse.isUnknown ? "안내 (Notice)" : "공식 승인 지식 기반 답변"}</span>
                </span>
                <span className="text-xs text-zinc-400">
                  대상: {askResponse.audience}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[11px] text-zinc-400">
                  {new Date(askResponse.createdAt).toLocaleTimeString()} 기준
                </span>
                <button
                  type="button"
                  onClick={() => setAskResponse(null)}
                  className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer font-semibold"
                  title="답변 닫기"
                >
                  ✕ 닫기
                </button>
              </div>
            </div>

            {/* Direct Answer */}
            <div className="space-y-3">
              <h3 className="text-base sm:text-lg font-extrabold text-zinc-900 dark:text-white leading-snug">
                {askResponse.directAnswer}
              </h3>

              {/* Core Rule Bullets */}
              {askResponse.currentRuleBullets && askResponse.currentRuleBullets.length > 0 && (
                <div className="rounded-xl bg-zinc-50 dark:bg-zinc-950 p-4 space-y-2.5 border border-zinc-100 dark:border-zinc-800/80">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 block">
                    📌 핵심 정책 및 운영 규칙 (Core Rules)
                  </span>
                  <ul className="space-y-1.5 text-xs text-zinc-700 dark:text-zinc-300">
                    {askResponse.currentRuleBullets.map((b, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-blue-500 font-bold mt-0.5">•</span>
                        <span className="leading-relaxed">{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Official Source Citations */}
            {askResponse.sources && askResponse.sources.length > 0 && (
              <div className="space-y-3 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 block">
                  📚 관련 공식 도움말 출처
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {askResponse.sources.map((src: AskSourceCitation) => (
                    <Link
                      key={src.id}
                      href={src.url}
                      className="group flex flex-col justify-between rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 p-4 hover:border-blue-400 dark:hover:border-blue-500 transition-all shadow-xs"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-1">
                          {getTypeBadge(src.type)}
                          <span className="text-[10px] font-semibold text-zinc-400">
                            버전 {src.version}
                          </span>
                        </div>
                        <h4 className="text-xs font-bold text-zinc-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-1">
                          {src.title}
                        </h4>
                      </div>
                      <div className="mt-3 pt-2 border-t border-zinc-100 dark:border-zinc-800/60 flex items-center justify-between text-[10px] text-zinc-400">
                        <span>시행일: {src.effectiveDate}</span>
                        <span className="font-semibold text-blue-600 dark:text-blue-400 group-hover:translate-x-0.5 transition-transform">
                          자세히 보기 &rarr;
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Related PDF Manuals */}
            {askResponse.relatedManuals && askResponse.relatedManuals.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 block">
                  📄 첨부 공식 PDF 매뉴얼
                </span>
                <div className="space-y-2">
                  {askResponse.relatedManuals.map((man, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/20 p-3"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-lg shrink-0">📄</span>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-zinc-900 dark:text-white truncate">
                            {man.title}
                          </p>
                          <p className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium">
                            공식 배포본 ({man.version})
                          </p>
                        </div>
                      </div>
                      <a
                        href={man.viewUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 text-[11px] font-bold text-white shadow-xs transition-colors shrink-0 cursor-pointer"
                      >
                        PDF 보기
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* No Answer Escalation Notice */}
            {askResponse.isUnknown && (
              <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/80 dark:bg-amber-950/30 p-4.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <h4 className="text-xs sm:text-sm font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                    <span>💬</span>
                    <span>공식 도움말에서 충분한 정보를 찾지 못하셨나요?</span>
                  </h4>
                  <p className="text-xs text-amber-800/90 dark:text-amber-300">
                    운영팀 1:1 문의로 전달하시면 질문 내용이 자동 연계되어 빠르고 정확하게 안내받으실 수 있습니다.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleEscalateToSupport("NO_ANSWER")}
                  className="rounded-lg bg-[#131E2E] dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 text-xs font-bold hover:bg-[#1f3047] dark:hover:bg-zinc-200 transition-colors shrink-0 shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <span>1:1 문의하기</span>
                  <span>&rarr;</span>
                </button>
              </div>
            )}

            {/* Answered Additional Help Link */}
            {!askResponse.isUnknown && (
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800 text-xs text-zinc-500">
                <span>원하는 답을 찾지 못하셨거나 추가 세부 문의가 필요하신가요?</span>
                <button
                  type="button"
                  onClick={() => handleEscalateToSupport("ANSWERED")}
                  className="text-blue-600 dark:text-blue-400 font-bold hover:underline cursor-pointer flex items-center gap-1"
                >
                  <span>1:1 추가 문의하기</span>
                  <span>&rarr;</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 2: BROWSE BY TOPIC (주제별 도움말 - Primary Navigation Layer)      */}
      {/* ========================================================================= */}
      {activeTopics.length > 0 && (
        <div className="space-y-4 pt-2">
          <div className="space-y-1">
            <h2 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <span>📂 주제별 도움말</span>
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              업무 영역을 선택하면 관련 자주 묻는 질문과 공식 도움말을 확인할 수 있습니다.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
            {activeTopics.map((topic) => {
              const stat = topicStats[topic.id] || { knowledgeCount: 0, faqCount: 0, total: 0 };
              const isSelected = selectedTopicId === topic.id;

              // Format compact count badge (e.g. "5 FAQ · 1 도움말")
              const countBadgeParts: string[] = [];
              countBadgeParts.push(`${stat.faqCount} FAQ`);
              countBadgeParts.push(`${stat.knowledgeCount} 도움말`);
              const countBadgeLabel = countBadgeParts.join(" · ");

              return (
                <button
                  key={topic.id}
                  type="button"
                  onClick={() => handleTopicCardClick(topic.id)}
                  className={`text-left rounded-xl p-4.5 border transition-all cursor-pointer flex flex-col justify-between shadow-xs ${
                    isSelected
                      ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/20 ring-2 ring-blue-500/20"
                      : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-400 dark:hover:border-zinc-600 hover:shadow-md"
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-2xl">{topic.icon}</span>
                      <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-2.5 py-0.5 text-[10px] font-bold text-zinc-600 dark:text-zinc-300">
                        {countBadgeLabel}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-zinc-900 dark:text-white leading-snug">
                        {topic.title_ko}
                      </h3>
                      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 font-medium line-clamp-1 leading-relaxed">
                        {topic.short_desc_ko || topic.description_ko}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-[11px] text-blue-600 dark:text-blue-400 font-semibold">
                    <span>자주 묻는 질문 & 도움말</span>
                    <span>&rarr;</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 4: TOPIC DETAIL / TOPIC FAQS (Section 10 & 16: FAQ First)       */}
      {/* ========================================================================= */}
      {currentSelectedTopic && (
        <div ref={topicDetailSectionRef} className="space-y-6 pt-4 border-t border-zinc-200 dark:border-zinc-800">
          {/* Topic Banner Header */}
          <div className="rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/20 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3">
              <span className="text-3xl">{currentSelectedTopic.icon}</span>
              <div>
                <h3 className="text-base font-extrabold text-zinc-900 dark:text-white flex items-center gap-2">
                  <span>{currentSelectedTopic.title_ko}</span>
                  <span className="rounded-full bg-blue-100 dark:bg-blue-900/60 px-2.5 py-0.5 text-[11px] font-bold text-blue-700 dark:text-blue-300">
                    주제별 도움말
                  </span>
                </h3>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
                  {currentSelectedTopic.description_ko}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSelectedTopicId(null)}
              className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors shrink-0 cursor-pointer"
            >
              ✕ 전체 주제 보기
            </button>
          </div>

          {/* 1. Topic FAQs First (Section 10 & 16) */}
          {topicSpecificFaqs.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <span>💡 {currentSelectedTopic.title_ko} 자주 묻는 질문</span>
                <span className="rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 px-2 py-0.5 text-[11px] font-mono font-bold">
                  {topicSpecificFaqs.length}
                </span>
              </h4>

              <div className="space-y-2.5">
                {topicSpecificFaqs.map((faq) => {
                  const isOpen = openTopicFaqId === faq.id;
                  return (
                    <div
                      key={faq.id}
                      className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden transition-all shadow-xs"
                    >
                      <button
                        type="button"
                        onClick={() => setOpenTopicFaqId(isOpen ? null : faq.id)}
                        className="w-full text-left p-4 flex items-center justify-between gap-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer transition-colors"
                      >
                        <div className="flex items-start gap-2.5">
                          <span className="text-blue-600 dark:text-blue-400 font-mono font-bold text-sm select-none">
                            Q.
                          </span>
                          <h3 className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white leading-snug">
                            {faq.question_ko}
                          </h3>
                        </div>
                        <span
                          className={`text-zinc-400 text-xs shrink-0 font-bold transition-transform duration-200 ${
                            isOpen ? "rotate-180" : ""
                          }`}
                        >
                          ▼
                        </span>
                      </button>

                      {isOpen && (
                        <div className="px-4 pb-4 pt-1 text-xs text-zinc-700 dark:text-zinc-300 border-t border-zinc-100 dark:border-zinc-800/60 bg-zinc-50/50 dark:bg-zinc-900/40 space-y-3">
                          <div className="flex items-start gap-2 pt-2">
                            <span className="text-emerald-600 dark:text-emerald-400 font-mono font-bold text-sm select-none">
                              A.
                            </span>
                            <div className="space-y-2 leading-relaxed whitespace-pre-wrap flex-1">
                              <p>{faq.answer_ko}</p>
                              {faq.answer_en && (
                                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 pt-1.5 border-t border-zinc-200/60 dark:border-zinc-700/60">
                                  {faq.answer_en}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-2 border-t border-zinc-200/50 dark:border-zinc-800">
                            <span className="font-mono">
                              출처: {faq.source_title || faq.source_knowledge_id} ({faq.source_version})
                            </span>
                            {faq.source_knowledge_id && (
                              <Link
                                href={`${baseHelpPath}/${faq.source_knowledge_id}`}
                                className="text-blue-600 hover:text-blue-700 dark:text-blue-400 font-semibold"
                              >
                                공식 도움말 보기 &rarr;
                              </Link>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 2. Ask K SELECT In-Topic CTA (Section 17) */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-4.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div className="space-y-0.5">
              <h5 className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white">
                찾으시는 답변이 없나요?
              </h5>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                궁금한 내용을 직접 질문해 주시면 공식 지식에서 즉시 찾아 안내해 드립니다.
              </p>
            </div>
            <button
              type="button"
              onClick={handleFocusQuestionInput}
              className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-xs font-bold transition-colors shrink-0 shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              <span>직접 질문하기</span>
              <span>&uarr;</span>
            </button>
          </div>

          {/* 3. Related Official Documents Second (Section 10 & 16) */}
          {topicSpecificItems.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <span>📚 관련 공식 도움말</span>
                <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-2 py-0.5 text-[11px] font-mono font-bold">
                  {topicSpecificItems.length}
                </span>
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {topicSpecificItems.map((item) => (
                  <Link
                    key={item.id}
                    href={`${baseHelpPath}/${item.slug || item.id}`}
                    className="group flex flex-col justify-between rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-xs hover:border-zinc-400 dark:hover:border-zinc-600 hover:shadow-md transition-all cursor-pointer"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {getTypeBadge(item.type)}
                          <span className="text-[11px] font-semibold text-zinc-500">
                            {currentSelectedTopic.title_ko}
                          </span>
                        </div>
                        {item.document_url && (
                          <span className="inline-flex items-center gap-1 rounded bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            📄 PDF 문서
                          </span>
                        )}
                      </div>

                      <div>
                        <h3 className="text-sm font-bold text-zinc-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors leading-snug">
                          {item.title_ko || item.title}
                        </h3>
                        <p className="mt-1.5 text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2 leading-relaxed">
                          {item.summary_ko || item.summary_en || "자세한 가이드 및 정책 내용을 확인해 보세요."}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-400">
                      <span>버전 {item.current_version || "v1.0"}</span>
                      <span className="group-hover:translate-x-0.5 transition-transform font-semibold text-blue-600 dark:text-blue-400">
                        자세히 보기 &rarr;
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 4: ALL HELP CONTENT (모든 도움말 - Section 20 Simplification)    */}
      {/* ========================================================================= */}
      <div className="space-y-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <span>📖 모든 도움말</span>
              <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-2 py-0.5 text-xs font-mono font-bold">
                {filteredAllItems.length}
              </span>
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              K SELECT 공식 매뉴얼, 정책 및 가이드를 확인하세요.
            </p>
          </div>

          {/* Search within library */}
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              value={librarySearch}
              onChange={(e) => setLibrarySearch(e.target.value)}
              placeholder="문서명 또는 키워드 검색..."
              className="w-full rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
            />
            {librarySearch && (
              <button
                type="button"
                onClick={() => setLibrarySearch("")}
                className="absolute right-2.5 top-1.5 text-zinc-400 hover:text-zinc-600 text-xs cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Secondary Type Filter Pills */}
        {availableTypes.length > 1 && (
          <div className="flex items-center gap-1.5 text-xs text-zinc-500">
            <span className="text-[11px] font-semibold text-zinc-400 shrink-0">유형:</span>
            <button
              type="button"
              onClick={() => setSelectedType("ALL")}
              className={`px-2.5 py-0.5 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                selectedType === "ALL"
                  ? "bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-900 font-bold"
                  : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
              }`}
            >
              전체
            </button>
            {availableTypes.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setSelectedType(t)}
                className={`px-2.5 py-0.5 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                  selectedType === t
                    ? "bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-900 font-bold"
                    : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        )}

        {/* Knowledge Cards Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2].map((i) => (
              <div key={i} className="h-44 rounded-xl bg-zinc-100 dark:bg-zinc-900 animate-pulse" />
            ))}
          </div>
        ) : filteredAllItems.length === 0 ? (
          /* Empty Search / No Result UX */
          <div className="rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-800 p-10 text-center space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 text-2xl">
              🔍
            </div>
            <div className="space-y-1 max-w-md mx-auto">
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                관련 도움말을 찾지 못했습니다.
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                선택하신 조건에 해당하는 공식 도움말 문서가 없습니다. 검색 조건을 변경하시거나 운영팀에 직접 문의해 주세요.
              </p>
            </div>
            <div className="pt-2 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setSelectedType("ALL");
                  setLibrarySearch("");
                }}
                className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900 cursor-pointer"
              >
                전체 목록 보기
              </button>
              <button
                type="button"
                onClick={() => handleEscalateToSupport("GENERAL")}
                className="rounded-lg bg-[#131E2E] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1f3047] dark:bg-white dark:text-[#131E2E] cursor-pointer shadow-xs"
              >
                {supportCtaText} &rarr;
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredAllItems.map((item) => {
              const primaryTopic = itemPrimaryTopicMap.get(item.id);

              return (
                <Link
                  key={item.id}
                  href={`${baseHelpPath}/${item.slug || item.id}`}
                  className="group flex flex-col justify-between rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-xs hover:border-zinc-400 dark:hover:border-zinc-600 hover:shadow-md transition-all cursor-pointer"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {getTypeBadge(item.type)}
                        <span className="text-[11px] font-semibold text-zinc-500 flex items-center gap-1">
                          {primaryTopic?.icon} {primaryTopic?.title_ko || item.module}
                        </span>
                      </div>
                      {item.document_url && (
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          📄 PDF 문서
                        </span>
                      )}
                    </div>

                    <div>
                      <h3 className="text-sm font-bold text-zinc-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors leading-snug">
                        {item.title_ko || item.title}
                      </h3>
                      <p className="mt-1.5 text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2 leading-relaxed">
                        {item.summary_ko || item.summary_en || "자세한 가이드 및 정책 내용을 확인해 보세요."}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-400">
                    <span>버전 {item.current_version || "v1.0"}</span>
                    <span className="group-hover:translate-x-0.5 transition-transform font-semibold text-blue-600 dark:text-blue-400">
                      자세히 보기 &rarr;
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* SECTION 5: STILL NEED HELP? (아직 해결되지 않았나요? - Support CTA)      */}
      {/* ========================================================================= */}
      <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-6 sm:p-8 dark:border-zinc-800 dark:bg-zinc-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-lg">💬</span>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
              아직 해결되지 않았나요?
            </h3>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
            {supportDescription}
          </p>
        </div>
        <button
          type="button"
          onClick={() => handleEscalateToSupport("GENERAL")}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#131E2E] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#1f3047] dark:bg-white dark:text-[#131E2E] transition-colors shrink-0 shadow-xs cursor-pointer"
        >
          <span>{supportCtaText}</span>
          <span>&rarr;</span>
        </button>
      </div>
    </div>
  );
}
