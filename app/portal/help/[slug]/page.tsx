"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

interface HelpDetail {
  item: {
    id: string;
    slug: string;
    title: string;
    title_ko: string;
    title_en: string;
    summary_ko: string;
    summary_en: string;
    content_ko: string;
    content_en: string;
    type: string;
    module: string;
    category: string;
    tags: string[];
    current_version: string;
    effective_date: string;
    document_url?: string | null;
    document_name?: string | null;
    document_size?: number | null;
    document_type?: string | null;
    updated_at: string;
  };
  assets: Array<{
    id: string;
    manual_title: string;
    version: string;
    language: string;
    file_url: string;
    file_name: string;
    file_size: number;
    published_date: string;
  }>;
  related: Array<{
    id: string;
    slug: string;
    title: string;
    title_ko: string;
    title_en: string;
    summary_ko: string;
    type: string;
    module: string;
  }>;
}

export default function BrandHelpDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug as string;

  const [data, setData] = useState<HelpDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [language, setLanguage] = useState<"KO" | "EN">("KO");
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (slug) {
      fetchDetail();
    }
  }, [slug]);

  const fetchDetail = async () => {
    setLoading(true);
    setNotFound(false);
    try {
      const res = await fetch(`/api/portal/help/${slug}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
        // Default to English if Korean content is empty
        if (!json.item.content_ko && json.item.content_en) {
          setLanguage("EN");
        }
      } else {
        setNotFound(true);
      }
    } catch (e) {
      console.error("Failed to load detail:", e);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type?.toUpperCase()) {
      case "MANUAL":
        return <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800">MANUAL</span>;
      case "POLICY":
        return <span className="rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-bold text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800">POLICY</span>;
      case "FAQ":
        return <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">FAQ</span>;
      case "SOP":
        return <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800">SOP</span>;
      case "GUIDE":
        return <span className="rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-bold text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 border border-sky-200 dark:border-sky-800">GUIDE</span>;
      default:
        return <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-bold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">{type}</span>;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto px-4 py-8 animate-pulse">
        <div className="h-6 w-36 bg-zinc-200 dark:bg-zinc-800 rounded" />
        <div className="h-10 w-3/4 bg-zinc-200 dark:bg-zinc-800 rounded" />
        <div className="h-32 bg-zinc-100 dark:bg-zinc-900 rounded-xl" />
        <div className="h-96 bg-zinc-100 dark:bg-zinc-900 rounded-xl" />
      </div>
    );
  }

  if (notFound || !data?.item) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4 text-center space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 text-2xl">
          ⚠️
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white">
            도움말 문서를 찾을 수 없습니다.
          </h2>
          <p className="text-xs text-zinc-500">
            요청하신 문서는 존재하지 않거나, 권한이 없어 접근할 수 없습니다.
          </p>
        </div>
        <div className="pt-3 flex items-center justify-center gap-3">
          <Link
            href="/portal/help"
            className="rounded-lg bg-[#131E2E] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1f3047] dark:bg-white dark:text-[#131E2E]"
          >
            &larr; 도움말 센터 메인으로
          </Link>
          <Link
            href="/portal/support"
            className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50"
          >
            1:1 문의하기
          </Link>
        </div>
      </div>
    );
  }

  const { item, assets, related } = data;
  const currentTitle = language === "KO" ? (item.title_ko || item.title) : (item.title_en || item.title);
  const currentSummary = language === "KO" ? (item.summary_ko || item.summary_en) : (item.summary_en || item.summary_ko);
  const currentContent = language === "KO"
    ? (item.content_ko || item.content_en || "본문 내용이 등록되지 않았습니다.")
    : (item.content_en || item.content_ko || "Content is not available in English.");

  const primaryDoc = item.document_url
    ? { url: item.document_url, name: item.document_name || "Official_Manual.pdf" }
    : (assets.length > 0 ? { url: assets[0].file_url, name: assets[0].file_name } : null);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-8">
      {/* Top Breadcrumb & Back Link */}
      <div className="flex items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-4 text-xs">
        <Link
          href="/portal/help"
          className="inline-flex items-center gap-1.5 font-semibold text-blue-600 dark:text-blue-400 hover:underline"
        >
          <span>&larr;</span>
          <span>Help Center 메인으로</span>
        </Link>
        <div className="flex items-center gap-1.5 text-zinc-400">
          <span>Help Center</span>
          <span>/</span>
          <span>{item.module || item.category}</span>
        </div>
      </div>

      {/* Article Header */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2.5">
          {getTypeBadge(item.type)}
          <span className="rounded bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
            {item.module || item.category}
          </span>
          <span className="font-mono text-xs text-zinc-500 bg-zinc-50 dark:bg-zinc-950 px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-800">
            버전 {item.current_version || "v1.0"}
          </span>
          {item.effective_date && (
            <span className="text-xs text-zinc-400">
              &bull; 적용일: {item.effective_date}
            </span>
          )}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-white leading-tight">
            {currentTitle}
          </h1>

          {/* Language Switcher if bilingual */}
          {(item.content_ko || item.content_en) && (
            <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded-lg text-xs font-semibold shrink-0 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setLanguage("KO")}
                className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                  language === "KO"
                    ? "bg-white text-zinc-900 shadow-xs dark:bg-zinc-900 dark:text-white font-bold"
                    : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400"
                }`}
              >
                KO (한국어)
              </button>
              <button
                type="button"
                onClick={() => setLanguage("EN")}
                className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                  language === "EN"
                    ? "bg-white text-zinc-900 shadow-xs dark:bg-zinc-900 dark:text-white font-bold"
                    : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400"
                }`}
              >
                EN (English)
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Official PDF Manual Banner (Section 10) */}
      {primaryDoc && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-xl border border-emerald-200 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/30 shadow-xs">
          <div className="flex items-start sm:items-center gap-3.5">
            <span className="text-3xl select-none">📄</span>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <h3 className="text-xs sm:text-sm font-bold text-emerald-950 dark:text-emerald-200">
                  Official Policy &amp; Manual Document (공식 배포 문서)
                </h3>
                <span className="rounded bg-emerald-200/60 dark:bg-emerald-900 px-1.5 py-0.2 text-[10px] font-bold text-emerald-900 dark:text-emerald-200">
                  PDF
                </span>
              </div>
              <p className="text-xs text-emerald-800 dark:text-emerald-300 font-medium truncate max-w-md">
                {primaryDoc.name}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href={primaryDoc.url}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg bg-white dark:bg-zinc-900 border border-emerald-300 dark:border-emerald-800 px-3.5 py-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors shadow-xs"
            >
              문서 보기 (View)
            </a>
            <a
              href={`${primaryDoc.url}?action=download`}
              download
              className="rounded-lg bg-emerald-700 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-800 transition-colors shadow-xs"
            >
              다운로드 (Download)
            </a>
          </div>
        </div>
      )}

      {/* Summary Box */}
      {currentSummary && (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
            Summary (요약)
          </span>
          <p className="text-xs sm:text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed font-medium">
            {currentSummary}
          </p>
        </div>
      )}

      {/* Main Content Body */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 sm:p-8 dark:border-zinc-800 dark:bg-zinc-900 shadow-sm">
        <div className="prose dark:prose-invert max-w-none text-xs sm:text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed whitespace-pre-wrap font-sans space-y-4">
          {currentContent}
        </div>
      </div>

      {/* Related Knowledge (Section 9) */}
      {related && related.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
            관련 도움말 및 가이드 (Related Guides)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {related.map((rel) => (
              <Link
                key={rel.id}
                href={`/portal/help/${rel.slug || rel.id}`}
                className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-400 dark:hover:border-zinc-600 transition-all shadow-xs group"
              >
                <div className="flex items-center gap-2 mb-1">
                  {getTypeBadge(rel.type)}
                  <span className="text-[10px] text-zinc-400">{rel.module}</span>
                </div>
                <h4 className="text-xs font-bold text-zinc-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {rel.title_ko || rel.title}
                </h4>
                {rel.summary_ko && (
                  <p className="text-[11px] text-zinc-500 line-clamp-1 mt-0.5">
                    {rel.summary_ko}
                  </p>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Bottom Support Escalation Card (Section 15) */}
      <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-6 dark:border-zinc-800 dark:bg-zinc-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-lg">💬</span>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
              원하는 내용을 찾지 못하셨나요?
            </h3>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
            문서에 기재되지 않은 특수 사례나 추가 문의사항은 K SELECT 운영팀에 남겨주시면 안내해 드립니다.
          </p>
        </div>
        <Link
          href="/portal/support"
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#131E2E] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#1f3047] dark:bg-white dark:text-[#131E2E] transition-colors shrink-0 shadow-xs cursor-pointer"
        >
          <span>1:1 문의하기</span>
          <span>&rarr;</span>
        </Link>
      </div>
    </div>
  );
}
