"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

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
  heroTitle = portalType === "BRAND" ? "Help Center (도움말 센터)" : "Help Center",
  heroSubtitle = portalType === "BRAND"
    ? "K SELECT NETWORK 이용에 필요한 공식 매뉴얼, 브랜드 등록 정책, FAQ를 검색하고 해결해 보세요."
    : "K SELECT 이용에 필요한 도움말과 정책을 찾아보세요.",
  searchPlaceholder = portalType === "BRAND"
    ? "무엇을 찾고 계신가요? (예: 브랜드 등록, 상표권, 출고지, FAQ 등)"
    : "무엇을 찾고 계신가요?",
  supportCtaText = portalType === "BRAND" ? "1:1 문의하기" : "1:1 문의하기",
  supportDescription = "K SELECT 운영팀에 문의를 남겨주시면 담당자가 신속하고 정확하게 답변을 안내해 드립니다."
}: HelpCenterMainViewProps) {
  const router = useRouter();
  const [items, setItems] = useState<HelpItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTopic, setSelectedTopic] = useState("ALL");
  const [selectedType, setSelectedType] = useState("ALL");

  useEffect(() => {
    fetchHelpItems();
  }, [apiEndpoint]);

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

  // Extract unique topics / modules from available items
  const availableTopics = useMemo(() => {
    const set = new Set<string>();
    items.forEach(i => {
      const mod = i.module || i.category;
      if (mod) set.add(mod);
    });
    return Array.from(set);
  }, [items]);

  // Extract unique types from available items
  const availableTypes = useMemo(() => {
    const set = new Set<string>();
    items.forEach(i => {
      if (i.type) set.add(i.type);
    });
    return Array.from(set);
  }, [items]);

  // Filter items based on search, topic, and type
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesTopic =
        selectedTopic === "ALL" ||
        item.module?.toLowerCase() === selectedTopic.toLowerCase() ||
        item.category?.toLowerCase() === selectedTopic.toLowerCase();

      const matchesType =
        selectedType === "ALL" || item.type.toUpperCase() === selectedType.toUpperCase();

      const q = searchQuery.trim().toLowerCase();
      if (!q) return matchesTopic && matchesType;

      const matchesSearch =
        item.title?.toLowerCase().includes(q) ||
        item.title_ko?.toLowerCase().includes(q) ||
        item.title_en?.toLowerCase().includes(q) ||
        item.summary_ko?.toLowerCase().includes(q) ||
        item.summary_en?.toLowerCase().includes(q) ||
        item.tags?.some(t => t.toLowerCase().includes(q)) ||
        item.module?.toLowerCase().includes(q) ||
        item.category?.toLowerCase().includes(q);

      return matchesTopic && matchesType && matchesSearch;
    });
  }, [items, searchQuery, selectedTopic, selectedType]);

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

  return (
    <div className="space-y-8 max-w-5xl mx-auto px-4 sm:px-6 py-6">
      {/* Hero Header & Search Section */}
      <div className="rounded-2xl bg-gradient-to-b from-zinc-900 via-[#131E2E] to-zinc-900 text-white p-8 sm:p-12 shadow-md space-y-6 text-center">
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

        {/* Big Search Input */}
        <div className="max-w-2xl mx-auto relative">
          <div className="relative flex items-center">
            <span className="absolute left-4 text-zinc-400 text-lg select-none">🔍</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded-xl bg-white text-zinc-900 dark:bg-zinc-900 dark:text-white pl-12 pr-10 py-3.5 text-sm font-medium shadow-lg border border-zinc-200 dark:border-zinc-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition-all placeholder:text-zinc-400"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-sm cursor-pointer p-1"
                title="검색어 지우기"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Topic & Type Filter Section */}
      <div className="space-y-3">
        {/* Topic Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none text-xs font-semibold select-none">
          <button
            type="button"
            onClick={() => setSelectedTopic("ALL")}
            className={`px-3.5 py-1.5 rounded-full transition-colors shrink-0 cursor-pointer ${
              selectedTopic === "ALL"
                ? "bg-[#131E2E] text-white dark:bg-white dark:text-[#131E2E] shadow-xs font-bold"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            }`}
          >
            전체 주제 (All Topics)
          </button>
          {availableTopics.map((topic) => (
            <button
              key={topic}
              type="button"
              onClick={() => setSelectedTopic(topic)}
              className={`px-3.5 py-1.5 rounded-full transition-colors shrink-0 cursor-pointer ${
                selectedTopic === topic
                  ? "bg-[#131E2E] text-white dark:bg-white dark:text-[#131E2E] shadow-xs font-bold"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              }`}
            >
              {topic}
            </button>
          ))}
        </div>

        {/* Type Pills */}
        {availableTypes.length > 1 && (
          <div className="flex items-center gap-1.5 text-xs text-zinc-500">
            <span className="text-[11px] font-semibold text-zinc-400 shrink-0">유형:</span>
            <button
              type="button"
              onClick={() => setSelectedType("ALL")}
              className={`px-2.5 py-0.5 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                selectedType === "ALL"
                  ? "bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-900"
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
                    ? "bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-900"
                    : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Content Grid / Listing */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-44 rounded-xl bg-zinc-100 dark:bg-zinc-900 animate-pulse" />
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        /* Empty Search / No Result UX */
        <div className="rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-800 p-12 text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 text-2xl">
            🔍
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="text-base font-bold text-zinc-900 dark:text-white">
              관련 도움말을 찾지 못했습니다.
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {searchQuery ? (
                <>
                  입력하신 검색어 <span className="font-semibold text-zinc-700 dark:text-zinc-300">&ldquo;{searchQuery}&rdquo;</span>에 해당하는 공식 문서가 없습니다. 검색어를 변경하시거나 운영팀에 직접 문의해 주세요.
                </>
              ) : (
                <>현재 등록된 공식 도움말 문서가 없습니다. 운영팀에 직접 문의해 주세요.</>
              )}
            </p>
          </div>
          <div className="pt-2 flex items-center justify-center gap-3">
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedTopic("ALL");
                  setSelectedType("ALL");
                }}
                className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900 cursor-pointer"
              >
                전체 목록 보기
              </button>
            )}
            <Link
              href={baseSupportPath}
              className="rounded-lg bg-[#131E2E] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1f3047] dark:bg-white dark:text-[#131E2E] cursor-pointer shadow-xs"
            >
              {supportCtaText} &rarr;
            </Link>
          </div>
        </div>
      ) : (
        /* Knowledge Cards Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredItems.map((item) => (
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
                      {item.module || item.category}
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
      )}

      {/* Footer Support Escalation Card */}
      <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-6 sm:p-8 dark:border-zinc-800 dark:bg-zinc-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-lg">💬</span>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
              원하는 답을 찾지 못하셨나요?
            </h3>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
            {supportDescription}
          </p>
        </div>
        <Link
          href={baseSupportPath}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#131E2E] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#1f3047] dark:bg-white dark:text-[#131E2E] transition-colors shrink-0 shadow-xs cursor-pointer"
        >
          <span>{supportCtaText}</span>
          <span>&rarr;</span>
        </Link>
      </div>
    </div>
  );
}
