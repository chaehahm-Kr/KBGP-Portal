"use client";

import React, { useEffect, useState, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  RESOURCE_CATEGORIES,
  formatBytes,
  getResourceCategoryLabel,
  type ResourceCategory,
  type ResourceFileType,
  type ResourceLanguage,
} from "@/lib/brand-comms/types";

interface PortalResourceItem {
  id: string;
  title_ko: string;
  title_en: string | null;
  description_ko: string | null;
  description_en: string | null;
  category: ResourceCategory;
  source_type: "UPLOADED_FILE" | "LINKED_INSIGHT_PDF";
  file_type: ResourceFileType;
  file_name: string | null;
  file_size: number | null;
  page_count: number | null;
  version: string;
  language: ResourceLanguage;
  audience_mode: "ALL_COMPANIES" | "SELECTED_COMPANIES";
  published_at: string | null;
  updated_at: string;
  file_available: boolean;
  download_url: string | null;
  related_insight_url: string | null;
}

function PortalResourcesInner() {
  const searchParams = useSearchParams();
  const highlightId = searchParams?.get("highlight") || "";

  const [resources, setResources] = useState<PortalResourceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState("ALL");
  const [searchQ, setSearchQ] = useState("");
  const [locale, setLocale] = useState<"ko" | "en">("ko");

  const loadResources = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (category !== "ALL") params.set("category", category);
      if (searchQ.trim()) params.set("q", searchQ.trim());

      const res = await fetch(`/api/portal/resources?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "자료실 목록을 불러오지 못했습니다.");
      setResources(data.resources || []);
    } catch (e: any) {
      setError(e?.message || "자료실 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [category, searchQ]);

  useEffect(() => {
    loadResources();
  }, [loadResources]);

  const fileBadgeStyle = (ft: ResourceFileType) => {
    if (ft === "PDF") return "bg-rose-500/15 text-rose-600 dark:text-rose-400";
    if (ft === "XLSX") return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400";
    return "bg-blue-500/15 text-blue-600 dark:text-blue-400";
  };

  return (
    <div className="max-w-5xl space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white">
            {locale === "en" ? "Resource Center" : "자료실"}
          </h1>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {locale === "en"
              ? "Download official FDA compliance guides, onboarding manuals, templates, and company-authorized documents."
              : "FDA 규제 실무 가이드, 온보딩 매뉴얼, 제품 등록·물류 템플릿 및 귀사 전용 문서를 다운로드하세요."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setLocale("ko")}
              className={`px-2.5 py-1 rounded-md font-medium cursor-pointer ${
                locale === "ko"
                  ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-950"
                  : "text-zinc-500"
              }`}
            >
              한국어
            </button>
            <button
              type="button"
              onClick={() => setLocale("en")}
              className={`px-2.5 py-1 rounded-md font-medium cursor-pointer ${
                locale === "en"
                  ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-950"
                  : "text-zinc-500"
              }`}
            >
              EN
            </button>
          </div>
          <Link
            href="/portal/announcements"
            className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            {locale === "en" ? "Announcements →" : "공지사항 보기 →"}
          </Link>
        </div>
      </div>

      {/* Search & Category Tabs */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-3 space-y-2.5">
        <input
          type="text"
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
          placeholder={
            locale === "en"
              ? "Search guides, templates, or filenames..."
              : "가이드 제목, 설명 또는 파일명 검색..."
          }
          className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setCategory("ALL")}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${
              category === "ALL"
                ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-950"
                : "bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800"
            }`}
          >
            {locale === "en" ? "All Categories" : "전체 자료"}
          </button>
          {RESOURCE_CATEGORIES.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setCategory(c.value)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${
                category === c.value
                  ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-950"
                  : "bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800"
              }`}
            >
              {locale === "en" ? c.labelEn : c.labelKo}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-600 dark:text-rose-400">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 animate-pulse space-y-2.5"
            >
              <div className="h-4 w-1/3 rounded bg-zinc-200 dark:bg-zinc-800" />
              <div className="h-5 w-3/4 rounded bg-zinc-200 dark:bg-zinc-800" />
              <div className="h-10 w-full rounded bg-zinc-100 dark:bg-zinc-900" />
            </div>
          ))}
        </div>
      ) : resources.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-10 text-center space-y-2">
          <div className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            {locale === "en" ? "No resources found" : "표시할 자료가 없습니다"}
          </div>
          <p className="text-xs text-zinc-500">
            {locale === "en"
              ? "Try a different keyword or category."
              : "다른 검색어 또는 카테고리를 선택해 보세요."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {resources.map((item) => {
            const isHighlighted = highlightId === item.id;
            const title =
              locale === "en" && item.title_en ? item.title_en : item.title_ko;
            const desc =
              locale === "en" && item.description_en
                ? item.description_en
                : item.description_ko;

            return (
              <div
                key={item.id}
                className={`rounded-xl border bg-white dark:bg-zinc-950 p-4 flex flex-col justify-between gap-3 transition-shadow ${
                  isHighlighted
                    ? "border-blue-500 ring-2 ring-blue-500/20"
                    : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
                }`}
              >
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold ${fileBadgeStyle(
                          item.file_type
                        )}`}
                      >
                        {item.file_type}
                      </span>
                      <span className="rounded bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:text-zinc-300">
                        {getResourceCategoryLabel(item.category, locale)}
                      </span>
                      {item.audience_mode === "SELECTED_COMPANIES" && (
                        <span className="rounded bg-indigo-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-600 dark:text-indigo-300">
                          {locale === "en" ? "Exclusive" : "전용"}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] font-mono text-zinc-400">
                      {item.version}
                    </span>
                  </div>

                  <h2 className="text-sm font-bold text-zinc-950 dark:text-white leading-snug">
                    {title}
                  </h2>

                  {desc && (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed line-clamp-2">
                      {desc}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-400">
                    {item.page_count ? <span>{item.page_count}p</span> : null}
                    {item.file_size ? <span>• {formatBytes(item.file_size)}</span> : null}
                    <span>• {item.language}</span>
                    <span>
                      • {locale === "en" ? "Updated" : "업데이트"}{" "}
                      {new Date(item.updated_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-900">
                  {item.related_insight_url ? (
                    <a
                      href={item.related_insight_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {locale === "en" ? "Read Insight ↗" : "관련 인사이트 ↗"}
                    </a>
                  ) : (
                    <span className="text-[11px] text-zinc-400 truncate max-w-[160px]">
                      {item.file_name || ""}
                    </span>
                  )}

                  {item.download_url ? (
                    <a
                      href={item.download_url}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors"
                    >
                      ↓ {locale === "en" ? "Download" : "다운로드"}
                    </a>
                  ) : (
                    <span className="text-xs text-zinc-400">
                      {locale === "en" ? "File unavailable" : "파일 준비 중"}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function PortalResourcesPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-5xl p-6 text-sm text-zinc-500">Loading Resource Center...</div>
      }
    >
      <PortalResourcesInner />
    </Suspense>
  );
}
