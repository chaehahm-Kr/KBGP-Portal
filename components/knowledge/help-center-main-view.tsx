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
  heroSubtitle = "궁금한 내용을 검색하거나 업무 주제를 선택하세요.",
  searchPlaceholder = "궁금한 내용을 입력해 주세요... (예: 브랜드 등록, 상표권, 출고지 등)",
  supportCtaText = "1:1 문의하기",
  supportDescription = "도움말에서 해결되지 않은 문제는 담당자에게 문의해 주세요."
}: HelpCenterMainViewProps) {
  const router = useRouter();

  // Knowledge & FAQ Data State
  const [items, setItems] = useState<HelpItem[]>([]);
  const [faqs, setFaqs] = useState<any[]>([]);
  const [topics, setTopics] = useState<CanonicalTopic[]>(
    portalType === "BRAND" ? CANONICAL_BRAND_TOPICS : []
  );
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Integrated Question / Ask State
  const [questionInput, setQuestionInput] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const [askResponse, setAskResponse] = useState<AskAnswerResponse | null>(null);
  const [askError, setAskError] = useState<string | null>(null);
  const [openAskFaqId, setOpenAskFaqId] = useState<string | null>(null);

  // Selected Topic State & Accordion
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [openTopicFaqId, setOpenTopicFaqId] = useState<string | null>(null);

  // Refs for smooth navigation
  const questionInputRef = useRef<HTMLInputElement>(null);
  const topicDetailSectionRef = useRef<HTMLDivElement>(null);
  const askResultRef = useRef<HTMLDivElement>(null);
  const topHeroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchHelpItems();
    fetchTopics();
    fetchFaqs();
    fetchSuggestedQuestions();
  }, [apiEndpoint, portalType]);

  const fetchTopics = async () => {
    try {
      const res = await fetch(`/api/knowledge/topics?portal_scope=${portalType}`);
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.topics)) {
          const mapped: CanonicalTopic[] = json.topics.map((t: any) => ({
            id: t.id,
            key: t.id.replace("topic-", "").toUpperCase(),
            title_ko: t.name_ko || t.title_ko,
            title_en: t.name_en || t.title_en || "",
            short_desc_ko: t.short_desc_ko || "",
            short_desc_en: t.short_desc_en || "",
            description_ko: t.description_ko || "",
            description_en: t.description_en || "",
            icon: t.icon || "📁",
            order: t.display_order || 0,
            matchModules: t.match_modules || [],
            matchKeywords: t.match_keywords || []
          }));
          setTopics(mapped);
        }
      }
    } catch (e) {
      console.error("Failed to load topics:", e);
    }
  };

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
          : (askResponse?.sources && askResponse.sources.length > 0)
          ? "GROUNDED_ANSWER"
          : "NO_ANSWER";

        const escalationContext = {
          origin: "HELP_CENTER_ASK",
          question: questionInput.trim() || askResponse?.question || "",
          askResult: askResult,
          suggestedAnswer: askResponse?.directAnswer || "",
          sources: (askResponse?.sources || []).map((s: AskSourceCitation) => ({
            id: s.id,
            title: s.title,
            version: s.version
          })),
          timestamp: new Date().toISOString()
        };

        if (typeof window !== "undefined") {
          sessionStorage.setItem("kselect_support_handoff", JSON.stringify(escalationContext));
        }
      } catch (e) {
        console.error("Failed to save escalation context:", e);
      }
    }

    router.push(baseSupportPath);
  };

  // Authoritative Primary Topic Maps
  const itemPrimaryTopicMap = useMemo(() => {
    const map = new Map<string, CanonicalTopic>();
    items.forEach(item => {
      map.set(item.id, matchTopicForKnowledge(item, topics));
    });
    return map;
  }, [items, topics]);

  const faqPrimaryTopicMap = useMemo(() => {
    const map = new Map<string, CanonicalTopic>();
    faqs.forEach(faq => {
      const parentItem = items.find(i => i.id === faq.source_knowledge_id);
      map.set(faq.id, matchTopicForFaq(faq, parentItem, topics));
    });
    return map;
  }, [faqs, items, topics]);

  // Topic Statistics
  const topicStats = useMemo(() => {
    const counts: Record<string, { knowledgeCount: number; faqCount: number; total: number }> = {};
    topics.forEach(t => {
      counts[t.id] = { knowledgeCount: 0, faqCount: 0, total: 0 };
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
  }, [items, faqs, itemPrimaryTopicMap, faqPrimaryTopicMap, topics]);

  // Dynamic Topic Visibility: Topics with usable content (total > 0)
  const activeTopics = useMemo(() => {
    return topics.filter(t => (topicStats[t.id]?.total || 0) > 0);
  }, [topics, topicStats]);

  // Selected Topic Object
  const currentSelectedTopic = useMemo(() => {
    if (!selectedTopicId) return null;
    return topics.find(t => t.id === selectedTopicId) || null;
  }, [selectedTopicId, topics]);

  // FAQs belonging to the selected Topic
  const topicSpecificFaqs = useMemo(() => {
    if (!selectedTopicId) return [];
    return faqs.filter(faq => {
      const topic = faqPrimaryTopicMap.get(faq.id);
      return topic?.id === selectedTopicId;
    });
  }, [faqs, selectedTopicId, faqPrimaryTopicMap]);

  // Knowledge Items belonging to the selected Topic (Only relevant published docs)
  const topicSpecificItems = useMemo(() => {
    if (!selectedTopicId) return [];
    return items.filter(item => {
      const topic = itemPrimaryTopicMap.get(item.id);
      return topic?.id === selectedTopicId;
    });
  }, [items, selectedTopicId, itemPrimaryTopicMap]);

  // Relevant FAQs for the search / asked question (Contextual FAQ matching)
  const questionRelevantFaqs = useMemo(() => {
    if (!askResponse && !questionInput.trim()) return [];
    const query = (questionInput || askResponse?.question || "").toLowerCase().trim();
    if (!query) return [];

    const citedKnowledgeIds = new Set((askResponse?.sources || []).map(s => s.id));
    const queryWords = query.split(/\s+/).filter(w => w.length >= 2);

    return faqs.filter(faq => {
      // Direct link to cited knowledge
      if (faq.source_knowledge_id && citedKnowledgeIds.has(faq.source_knowledge_id)) {
        return true;
      }
      // Keyword match in question or answer
      const qText = (faq.question_ko || faq.question_en || "").toLowerCase();
      const aText = (faq.answer_ko || faq.answer_en || "").toLowerCase();
      return queryWords.some(w => qText.includes(w) || aText.includes(w));
    }).slice(0, 4);
  }, [faqs, questionInput, askResponse]);

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
        return <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800">MANUAL</span>;
      case "POLICY":
        return <span className="rounded-md bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800">POLICY</span>;
      case "FAQ":
        return <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">FAQ</span>;
      case "SOP":
        return <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800">SOP</span>;
      case "GUIDE":
        return <span className="rounded-md bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 border border-sky-200 dark:border-sky-800">GUIDE</span>;
      default:
        return <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-[10px] font-bold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">{type}</span>;
    }
  };

  const handleTopicCardClick = (topicId: string) => {
    setSelectedTopicId(topicId);
    setTimeout(() => {
      topicDetailSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  return (
    <div className="space-y-6 w-full max-w-6xl px-4 sm:px-6 py-4 select-text">
      {/* ========================================================================= */}
      {/* SECTION 1: PRIMARY QUESTION EXPERIENCE (Compact Functional Hero)          */}
      {/* ========================================================================= */}
      <div ref={topHeroRef} className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-gradient-to-r from-zinc-900 via-[#131E2E] to-zinc-900 text-white p-4 sm:p-5 shadow-sm space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
          <div>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <span>{heroTitle}</span>
            </h1>
            <p className="text-xs text-zinc-300">
              {heroSubtitle}
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-md bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-300">
            <span>🛡️</span> {heroBadgeText}
          </span>
        </div>

        {/* Primary Unified Question Input Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAskQuestion();
          }}
          className="space-y-2.5"
        >
          <div className="relative flex items-center">
            <span className="absolute left-3.5 text-zinc-400 text-base select-none">💬</span>
            <input
              ref={questionInputRef}
              type="text"
              value={questionInput}
              onChange={(e) => setQuestionInput(e.target.value)}
              placeholder={searchPlaceholder}
              disabled={isAsking}
              className="w-full rounded-lg bg-white/10 text-white dark:bg-zinc-800/90 pl-10 pr-24 py-2.5 text-xs sm:text-sm font-medium border border-white/20 dark:border-zinc-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500 placeholder:text-zinc-400 disabled:opacity-60 transition-all"
            />
            <button
              type="submit"
              disabled={isAsking || !questionInput.trim()}
              className="absolute right-1.5 px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1"
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
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none text-xs">
            <span className="text-zinc-400 text-[11px] shrink-0 font-medium">추천:</span>
            {displayQuickQuestions.map((qText, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleAskQuestion(qText)}
                className="rounded-md bg-white/10 hover:bg-white/20 text-zinc-200 hover:text-white px-2.5 py-1 text-[11px] font-medium transition-all shrink-0 cursor-pointer border border-white/10"
              >
                {qText}
              </button>
            ))}
          </div>
        </form>
      </div>

      {/* Loading Skeleton for Question */}
      {isAsking && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-xs space-y-3 animate-pulse">
          <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-1/4" />
          <div className="h-5 bg-zinc-200 dark:bg-zinc-800 rounded w-3/4" />
          <div className="space-y-2 pt-1">
            <div className="h-3.5 bg-zinc-100 dark:bg-zinc-800/60 rounded w-full" />
            <div className="h-3.5 bg-zinc-100 dark:bg-zinc-800/60 rounded w-5/6" />
          </div>
        </div>
      )}

      {/* Error Message */}
      {askError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300 flex items-center justify-between">
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

      {/* Grounded Answer Card (Contextual Search / Question Results) */}
      {askResponse && !isAsking && (
        <div ref={askResultRef} className="space-y-4 transition-all duration-300">
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-sm space-y-4">
            {/* Answer Header */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
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
            <div className="space-y-2.5">
              <h3 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-white leading-snug">
                {askResponse.directAnswer}
              </h3>

              {/* Core Rule Bullets */}
              {askResponse.currentRuleBullets && askResponse.currentRuleBullets.length > 0 && (
                <div className="rounded-lg bg-zinc-50 dark:bg-zinc-950 p-3 space-y-1.5 border border-zinc-100 dark:border-zinc-800/80">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block">
                    📌 핵심 정책 및 운영 규칙 (Core Rules)
                  </span>
                  <ul className="space-y-1 text-xs text-zinc-700 dark:text-zinc-300">
                    {askResponse.currentRuleBullets.map((b, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="text-blue-500 font-bold mt-0.5">•</span>
                        <span className="leading-relaxed">{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Contextual FAQs Related to Search / Answer */}
            {questionRelevantFaqs.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block">
                  💡 관련 자주 묻는 질문 (FAQ)
                </span>
                <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-800 overflow-hidden bg-zinc-50/40 dark:bg-zinc-900/40">
                  {questionRelevantFaqs.map((faq) => {
                    const isOpen = openAskFaqId === faq.id;
                    return (
                      <div key={faq.id}>
                        <button
                          type="button"
                          onClick={() => setOpenAskFaqId(isOpen ? null : faq.id)}
                          className="w-full text-left px-3.5 py-2.5 flex items-center justify-between gap-3 hover:bg-zinc-100/60 dark:hover:bg-zinc-800/60 cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-blue-600 dark:text-blue-400 font-mono font-bold text-xs shrink-0">Q.</span>
                            <span className="text-xs font-semibold text-zinc-900 dark:text-white truncate">
                              {faq.question_ko}
                            </span>
                          </div>
                          <span className={`text-zinc-400 text-[10px] shrink-0 font-bold transition-transform ${isOpen ? "rotate-180" : ""}`}>
                            ▼
                          </span>
                        </button>
                        {isOpen && (
                          <div className="px-3.5 pb-3 pt-1 text-xs text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-900/80 space-y-2 border-t border-zinc-100 dark:border-zinc-800">
                            <div className="flex items-start gap-2 pt-1.5">
                              <span className="text-emerald-600 dark:text-emerald-400 font-mono font-bold text-xs shrink-0">A.</span>
                              <p className="leading-relaxed flex-1 font-normal">{faq.answer_ko}</p>
                            </div>
                            {faq.source_knowledge_id && (
                              <div className="text-right pt-1">
                                <Link
                                  href={`${baseHelpPath}/${faq.source_knowledge_id}`}
                                  className="text-[11px] text-blue-600 hover:text-blue-700 dark:text-blue-400 font-semibold"
                                >
                                  공식 문서 확인 &rarr;
                                </Link>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Official Source Citations / 관련 공식 도움말 (Only relevant documents) */}
            {askResponse.sources && askResponse.sources.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block">
                  📚 관련 공식 도움말
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {askResponse.sources.map((src: AskSourceCitation) => (
                    <Link
                      key={src.id}
                      href={src.url}
                      className="group flex flex-col justify-between rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 p-3 hover:border-blue-400 dark:hover:border-blue-500 transition-all shadow-2xs"
                    >
                      <div className="space-y-1">
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
                      <div className="mt-2 pt-1.5 border-t border-zinc-100 dark:border-zinc-800/60 flex items-center justify-between text-[10px] text-zinc-400">
                        <span>시행일: {src.effectiveDate}</span>
                        <span className="font-semibold text-blue-600 dark:text-blue-400 group-hover:translate-x-0.5 transition-transform">
                          보기 &rarr;
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
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block">
                  📄 첨부 공식 PDF 매뉴얼
                </span>
                <div className="space-y-1.5">
                  {askResponse.relatedManuals.map((man, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between gap-3 rounded-lg border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/20 p-2.5"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-base shrink-0">📄</span>
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
                        className="rounded-md bg-emerald-600 hover:bg-emerald-700 px-2.5 py-1 text-[11px] font-bold text-white shadow-2xs transition-colors shrink-0 cursor-pointer"
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
              <div className="rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50/80 dark:bg-amber-950/30 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="space-y-0.5">
                  <h4 className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                    <span>💬</span>
                    <span>공식 도움말에서 충분한 정보를 찾지 못하셨나요?</span>
                  </h4>
                  <p className="text-xs text-amber-800/90 dark:text-amber-300">
                    운영팀 1:1 문의로 전달하시면 질문 내용이 자동 연계되어 신속하게 안내해 드립니다.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleEscalateToSupport("NO_ANSWER")}
                  className="rounded-md bg-[#131E2E] dark:bg-zinc-100 text-white dark:text-zinc-900 px-3.5 py-1.5 text-xs font-bold hover:bg-[#1f3047] dark:hover:bg-zinc-200 transition-colors shrink-0 shadow-2xs cursor-pointer flex items-center gap-1"
                >
                  <span>1:1 문의하기</span>
                  <span>&rarr;</span>
                </button>
              </div>
            )}

            {/* Answered Additional Help Link */}
            {!askResponse.isUnknown && (
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800 text-xs text-zinc-500">
                <span>추가 세부 문의가 필요하신가요?</span>
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
      {/* SECTION 2: BROWSE BY TOPIC (주제별 도움말 - Compact Selectors Grid)         */}
      {/* ========================================================================= */}
      {activeTopics.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                <span>📂 주제별 도움말</span>
              </h2>
              <span className="text-xs text-zinc-500 dark:text-zinc-400 hidden sm:inline">
                업무 주제를 선택하시면 관련 FAQ 및 공식 도움말이 표시됩니다.
              </span>
            </div>
            {selectedTopicId && (
              <button
                type="button"
                onClick={() => setSelectedTopicId(null)}
                className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 font-medium cursor-pointer"
              >
                ✕ 선택 해제
              </button>
            )}
          </div>

          {/* Compact Topic Selector Tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
            {activeTopics.map((topic) => {
              const stat = topicStats[topic.id] || { knowledgeCount: 0, faqCount: 0, total: 0 };
              const isSelected = selectedTopicId === topic.id;
              const countBadgeLabel = `${stat.faqCount} FAQ · ${stat.knowledgeCount} 도움말`;

              return (
                <button
                  key={topic.id}
                  type="button"
                  onClick={() => handleTopicCardClick(topic.id)}
                  className={`text-left p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? "border-blue-600 bg-blue-50/80 dark:bg-blue-950/40 text-blue-900 dark:text-blue-100 ring-2 ring-blue-500/20 shadow-xs"
                      : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-zinc-50/80 dark:hover:bg-zinc-850 shadow-2xs"
                  }`}
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="text-lg">{topic.icon}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      isSelected
                        ? "bg-blue-200/80 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200"
                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                    }`}>
                      {countBadgeLabel}
                    </span>
                  </div>
                  <div className="mt-2">
                    <div className="text-xs font-bold leading-tight">
                      {topic.title_ko}
                    </div>
                    {topic.short_desc_ko && (
                      <div className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5 truncate font-normal">
                        {topic.short_desc_ko}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 3: TOPIC DETAIL (Topic FAQs First -> Topic Official Knowledge)    */}
      {/* ========================================================================= */}
      {currentSelectedTopic && (
        <div ref={topicDetailSectionRef} className="space-y-4 pt-3 border-t border-zinc-200 dark:border-zinc-800">
          {/* Compact Topic Header */}
          <div className="rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/40 dark:bg-blue-950/20 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span className="text-2xl">{currentSelectedTopic.icon}</span>
              <div>
                <h3 className="text-sm font-extrabold text-zinc-900 dark:text-white flex items-center gap-2">
                  <span>{currentSelectedTopic.title_ko}</span>
                  <span className="rounded-md bg-blue-100 dark:bg-blue-900/60 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:text-blue-300">
                    {topicSpecificFaqs.length} FAQ · {topicSpecificItems.length} 도움말
                  </span>
                </h3>
                <p className="text-[11px] text-zinc-600 dark:text-zinc-400 font-normal">
                  {currentSelectedTopic.description_ko}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSelectedTopicId(null)}
              className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2.5 py-1 text-xs font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors shrink-0 cursor-pointer self-end sm:self-auto"
            >
              ✕ 닫기
            </button>
          </div>

          {/* 1. Topic FAQs First */}
          {topicSpecificFaqs.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                <span>💡 자주 묻는 질문</span>
                <span className="text-[11px] font-mono text-zinc-400">({topicSpecificFaqs.length})</span>
              </div>

              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 divide-y divide-zinc-100 dark:divide-zinc-800 overflow-hidden shadow-xs">
                {topicSpecificFaqs.map((faq) => {
                  const isOpen = openTopicFaqId === faq.id;
                  return (
                    <div key={faq.id} className="transition-colors">
                      <button
                        type="button"
                        onClick={() => setOpenTopicFaqId(isOpen ? null : faq.id)}
                        className="w-full text-left px-4 py-3 flex items-center justify-between gap-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-blue-600 dark:text-blue-400 font-mono font-bold text-xs shrink-0">
                            Q.
                          </span>
                          <span className="text-xs sm:text-sm font-semibold text-zinc-900 dark:text-white truncate">
                            {faq.question_ko}
                          </span>
                        </div>
                        <span
                          className={`text-zinc-400 text-[11px] shrink-0 font-bold transition-transform duration-150 ${
                            isOpen ? "rotate-180" : ""
                          }`}
                        >
                          ▼
                        </span>
                      </button>

                      {isOpen && (
                        <div className="px-4 pb-4 pt-1 text-xs text-zinc-700 dark:text-zinc-300 bg-zinc-50/60 dark:bg-zinc-900/60 space-y-2.5 border-t border-zinc-100 dark:border-zinc-800/60">
                          <div className="flex items-start gap-2 pt-2">
                            <span className="text-emerald-600 dark:text-emerald-400 font-mono font-bold text-xs shrink-0">
                              A.
                            </span>
                            <div className="space-y-1.5 leading-relaxed flex-1">
                              <p className="font-normal">{faq.answer_ko}</p>
                              {faq.answer_en && (
                                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 pt-1 border-t border-zinc-200/50 dark:border-zinc-800">
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

          {/* 2. Topic Relevant Official Knowledge Items (Only published knowledge belonging to this Topic) */}
          {topicSpecificItems.length > 0 && (
            <div className="space-y-2 pt-1">
              <div className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                <span>📚 관련 공식 도움말</span>
                <span className="text-[11px] font-mono text-zinc-400">({topicSpecificItems.length})</span>
              </div>

              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 divide-y divide-zinc-100 dark:divide-zinc-800 overflow-hidden shadow-xs">
                {topicSpecificItems.map((item) => (
                  <div key={item.id} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                    <div className="flex items-start sm:items-center gap-3 min-w-0">
                      {getTypeBadge(item.type)}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white truncate">
                            {item.title_ko || item.title}
                          </h4>
                          {item.document_url && (
                            <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shrink-0">
                              PDF
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate max-w-xl">
                          {item.summary_ko || item.summary_en || "공식 도움말 내용을 확인하세요."}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto text-[11px] text-zinc-400">
                      <span>버전 {item.current_version || "v1.0"}</span>
                      <Link
                        href={`${baseHelpPath}/${item.slug || item.id}`}
                        className="px-2.5 py-1 rounded bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 font-bold transition-colors"
                      >
                        자세히 보기 &rarr;
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3. In-Topic Ask & Support Action Bar */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-2xs">
            <div className="flex items-center gap-2">
              <span className="text-zinc-600 dark:text-zinc-300 font-medium">원하는 답변을 찾지 못하셨나요?</span>
              <span className="text-zinc-400 hidden sm:inline">직접 질문하거나 운영팀에 1:1 문의를 남겨주세요.</span>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                type="button"
                onClick={handleFocusQuestionInput}
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold transition-colors shrink-0 shadow-xs cursor-pointer flex items-center gap-1 text-xs"
              >
                <span>직접 질문하기</span>
                <span>&uarr;</span>
              </button>
              <button
                type="button"
                onClick={() => handleEscalateToSupport("GENERAL")}
                className="px-3 py-1.5 rounded-lg bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-bold transition-colors shrink-0 shadow-xs cursor-pointer flex items-center gap-1 text-xs"
              >
                <span>1:1 문의하기</span>
                <span>&rarr;</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 4: STILL NEED HELP? (Support Escalation CTA - Default Home Only)  */}
      {/* ========================================================================= */}
      {!selectedTopicId && (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 sm:p-5 dark:border-zinc-800 dark:bg-zinc-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              <span className="text-base">💬</span>
              <h3 className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white">
                아직 해결되지 않았나요?
              </h3>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {supportDescription}
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleEscalateToSupport("GENERAL")}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#131E2E] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1f3047] dark:bg-white dark:text-[#131E2E] transition-colors shrink-0 shadow-xs cursor-pointer"
          >
            <span>{supportCtaText}</span>
            <span>&rarr;</span>
          </button>
        </div>
      )}
    </div>
  );
}
