"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useLanguage } from "@/lib/i18n";

export interface HelpDetailData {
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
  faqs?: Array<{
    id: string;
    question_ko: string;
    question_en?: string;
    answer_ko: string;
    answer_en?: string;
    source_title?: string;
    source_version?: string;
  }>;
}

export interface HelpCenterDetailViewProps {
  portalType: "BRAND" | "RETAILER";
  baseHelpPath: string;
  baseSupportPath: string;
  apiDetailBaseEndpoint: string;
  supportCtaText?: string;
  supportDescription?: string;
}

function renderFormattedMarkdown(text: string) {
  if (!text) return null;

  const lines = text.split(/\r?\n/);
  const elements: React.ReactNode[] = [];
  let listBuffer: { type: "ul" | "ol"; items: string[] } | null = null;
  let quoteBuffer: string[] = [];

  const flushList = () => {
    if (!listBuffer) return;
    if (listBuffer.type === "ul") {
      elements.push(
        <ul key={`ul-${elements.length}`} className="my-3 space-y-1.5 list-disc list-inside text-xs sm:text-sm text-zinc-700 dark:text-zinc-300">
          {listBuffer.items.map((item, i) => (
            <li key={i} className="leading-relaxed">
              {renderInlineMarkdown(item)}
            </li>
          ))}
        </ul>
      );
    } else {
      elements.push(
        <ol key={`ol-${elements.length}`} className="my-3 space-y-1.5 list-decimal list-inside text-xs sm:text-sm text-zinc-700 dark:text-zinc-300">
          {listBuffer.items.map((item, i) => (
            <li key={i} className="leading-relaxed">
              {renderInlineMarkdown(item)}
            </li>
          ))}
        </ol>
      );
    }
    listBuffer = null;
  };

  const flushQuote = () => {
    if (quoteBuffer.length === 0) return;
    const rawQuote = quoteBuffer.join(" ");
    let isImportant = rawQuote.includes("[!IMPORTANT]") || rawQuote.includes("[!WARNING]");
    let isNote = rawQuote.includes("[!NOTE]") || rawQuote.includes("[!TIP]");
    const cleanQuote = rawQuote.replace(/\[!(IMPORTANT|WARNING|NOTE|TIP)\]/gi, "").trim();

    elements.push(
      <div
        key={`quote-${elements.length}`}
        className={`my-3 p-3.5 rounded-xl border text-xs sm:text-sm leading-relaxed ${
          isImportant
            ? "bg-amber-50/80 dark:bg-amber-950/30 border-amber-300 dark:border-amber-900/60 text-amber-900 dark:text-amber-200"
            : isNote
            ? "bg-blue-50/80 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900/60 text-blue-900 dark:text-blue-200"
            : "bg-zinc-50 dark:bg-zinc-950/40 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300"
        }`}
      >
        <div className="flex items-start gap-2">
          <span className="text-base shrink-0">{isImportant ? "⚠️" : isNote ? "📌" : "💬"}</span>
          <div className="flex-1">{renderInlineMarkdown(cleanQuote)}</div>
        </div>
      </div>
    );
    quoteBuffer = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      flushList();
      flushQuote();
      continue;
    }

    if (trimmed.startsWith(">")) {
      flushList();
      quoteBuffer.push(trimmed.replace(/^>\s?/, ""));
      continue;
    } else {
      flushQuote();
    }

    if (trimmed.startsWith("### ")) {
      flushList();
      elements.push(
        <h3 key={`h3-${i}`} className="text-sm sm:text-base font-bold text-zinc-900 dark:text-white mt-5 mb-2 flex items-center gap-1.5">
          <span>{trimmed.replace("### ", "")}</span>
        </h3>
      );
      continue;
    }

    if (trimmed.startsWith("## ")) {
      flushList();
      elements.push(
        <h2 key={`h2-${i}`} className="text-base sm:text-lg font-extrabold text-zinc-900 dark:text-white mt-6 mb-2.5 pb-1 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-2">
          <span>{trimmed.replace("## ", "")}</span>
        </h2>
      );
      continue;
    }

    if (trimmed.startsWith("# ")) {
      flushList();
      elements.push(
        <h1 key={`h1-${i}`} className="text-lg sm:text-xl font-black text-zinc-900 dark:text-white mt-6 mb-3 pb-2 border-b border-zinc-200 dark:border-zinc-800">
          {trimmed.replace("# ", "")}
        </h1>
      );
      continue;
    }

    if (trimmed === "---" || trimmed === "***") {
      flushList();
      elements.push(<hr key={`hr-${i}`} className="my-5 border-zinc-200 dark:border-zinc-800" />);
      continue;
    }

    if (/^[-*•]\s/.test(trimmed)) {
      if (!listBuffer || listBuffer.type !== "ul") {
        flushList();
        listBuffer = { type: "ul", items: [] };
      }
      listBuffer.items.push(trimmed.replace(/^[-*•]\s+/, ""));
      continue;
    }

    if (/^\d+\.\s/.test(trimmed)) {
      if (!listBuffer || listBuffer.type !== "ol") {
        flushList();
        listBuffer = { type: "ol", items: [] };
      }
      listBuffer.items.push(trimmed.replace(/^\d+\.\s+/, ""));
      continue;
    }

    flushList();
    elements.push(
      <p key={`p-${i}`} className="text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed my-2">
        {renderInlineMarkdown(line)}
      </p>
    );
  }

  flushList();
  flushQuote();
  return elements;
}

function renderInlineMarkdown(text: string): React.ReactNode {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={index} className="rounded bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 font-mono text-[11px] sm:text-xs text-blue-600 dark:text-blue-400 font-semibold border border-zinc-200 dark:border-zinc-700">
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={index} className="font-bold text-zinc-900 dark:text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}

function formatFileSize(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return "1.39 MB";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function HelpCenterDetailView({
  portalType,
  baseHelpPath,
  baseSupportPath,
  apiDetailBaseEndpoint,
  supportCtaText: customSupportCta,
  supportDescription: customSupportDesc
}: HelpCenterDetailViewProps) {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug as string;
  const { locale } = useLanguage();
  const isEn = portalType === "RETAILER" && locale !== "ko";

  const supportCtaText = customSupportCta || (isEn ? "Submit Inquiry" : "1:1 문의하기");
  const supportDescription = customSupportDesc || (isEn
    ? "If you have additional questions or special cases not covered in this guide, contact the K SELECT support team."
    : "문서에 기재되지 않은 특수 사례나 추가 문의사항은 K SELECT 운영팀에 남겨주시면 안내해 드립니다.");

  const [data, setData] = useState<HelpDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [language, setLanguage] = useState<"KO" | "EN">(isEn ? "EN" : "KO");
  const [notFound, setNotFound] = useState(false);
  const [openFaqId, setOpenFaqId] = useState<string | null>(null);

  useEffect(() => {
    if (isEn) {
      setLanguage("EN");
    }
  }, [isEn]);

  useEffect(() => {
    if (slug) {
      fetchDetail();
    }
  }, [slug, apiDetailBaseEndpoint]);

  const fetchDetail = async () => {
    setLoading(true);
    setNotFound(false);
    try {
      const res = await fetch(`${apiDetailBaseEndpoint}/${slug}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
        if (isEn || (!json.item.content_ko && json.item.content_en)) {
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

  const handleEscalateToSupport = () => {
    if (data?.item) {
      try {
        const escalationContext = {
          origin: "HELP_CENTER_MANUAL",
          knowledgeId: data.item.id,
          title: isEn ? (data.item.title_en || data.item.title_ko || data.item.title) : (data.item.title_ko || data.item.title),
          version: data.item.current_version || "v1.0",
          module: data.item.module || data.item.category,
          currentUrl: typeof window !== "undefined" ? window.location.href : "",
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
        <div className="h-24 bg-zinc-100 dark:bg-zinc-900 rounded-xl" />
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
            href={baseHelpPath}
            className="rounded-lg bg-[#131E2E] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1f3047] dark:bg-white dark:text-[#131E2E]"
          >
            &larr; 도움말 센터 메인으로
          </Link>
          <button
            type="button"
            onClick={handleEscalateToSupport}
            className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer"
          >
            {supportCtaText}
          </button>
        </div>
      </div>
    );
  }

  const { item, assets, related, faqs } = data;
  const currentTitle = language === "KO" ? (item.title_ko || item.title) : (item.title_en || item.title);
  const currentSummary = language === "KO" ? (item.summary_ko || item.summary_en) : (item.summary_en || item.summary_ko);
  const currentContent = language === "KO"
    ? (item.content_ko || item.content_en || "본문 내용이 등록되지 않았습니다.")
    : (item.content_en || item.content_ko || "Content is not available in English.");

  const primaryDoc = item.document_url
    ? {
        url: item.document_url,
        name: item.document_name || "MAN-BRAND-001 Brand Policy.pdf",
        size: item.document_size || 1391802
      }
    : assets && assets.length > 0
    ? {
        url: assets[0].file_url,
        name: assets[0].file_name || "MAN-BRAND-001 Brand Policy.pdf",
        size: assets[0].file_size || 1391802
      }
    : null;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Top Breadcrumb & Back Link */}
      <div className="flex items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-3 text-xs">
        <Link
          href={baseHelpPath}
          className="inline-flex items-center gap-1.5 font-semibold text-blue-600 dark:text-blue-400 hover:underline"
        >
          <span>&larr;</span>
          <span>Help Center 메인으로</span>
        </Link>
        <div className="flex items-center gap-1.5 text-zinc-400 text-[11px]">
          <span>Help Center</span>
          <span>/</span>
          <span className="font-medium text-zinc-600 dark:text-zinc-300">{item.module || item.category}</span>
        </div>
      </div>

      {/* Article Header */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {getTypeBadge(item.type)}
          <span className="rounded bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
            {item.module || item.category}
          </span>
          <span className="font-mono text-xs text-zinc-600 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-950 px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-800 font-semibold">
            버전 {item.current_version || "v1.0"}
          </span>
          {item.effective_date && (
            <span className="text-xs text-zinc-400">
              &bull; 적용일: {item.effective_date}
            </span>
          )}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-zinc-900 dark:text-white leading-tight">
            {currentTitle}
          </h1>

          {/* Language Switcher if bilingual */}
          {(item.content_ko && item.content_en) && (
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

      {/* Official PDF Document Banner */}
      {primaryDoc && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-5 rounded-xl border border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/60 dark:bg-emerald-950/30 shadow-xs">
          <div className="flex items-start sm:items-center gap-3.5 min-w-0">
            <span className="text-3xl select-none shrink-0">📄</span>
            <div className="space-y-0.5 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-xs sm:text-sm font-bold text-emerald-950 dark:text-emerald-200">
                  공식 배포 문서 (Official Manual &amp; Policy)
                </h3>
                <span className="rounded bg-emerald-200/80 dark:bg-emerald-900 px-1.5 py-0.2 text-[10px] font-bold text-emerald-900 dark:text-emerald-200">
                  PDF
                </span>
              </div>
              <p className="text-xs text-emerald-800 dark:text-emerald-300 font-medium truncate">
                {primaryDoc.name} <span className="text-[11px] opacity-75">({formatFileSize(primaryDoc.size)})</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            <a
              href={primaryDoc.url}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg bg-white dark:bg-zinc-900 border border-emerald-300 dark:border-emerald-800 px-3.5 py-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors shadow-xs"
            >
              PDF 보기 (View)
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
        <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/40 space-y-1">
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
            📌 SUMMARY (요약)
          </span>
          <p className="text-xs sm:text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed font-medium">
            {currentSummary}
          </p>
        </div>
      )}

      {/* Main Content Body */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-7 dark:border-zinc-800 dark:bg-zinc-900 shadow-sm">
        <div className="space-y-1">
          {renderFormattedMarkdown(currentContent)}
        </div>
      </div>

      {/* Linked Official FAQs */}
      {faqs && faqs.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
              <span>💡</span>
              <span>관련 자주 묻는 질문 (FAQ)</span>
            </h3>
            <span className="text-xs text-zinc-400 font-mono">({faqs.length})</span>
          </div>

          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 divide-y divide-zinc-100 dark:divide-zinc-800 overflow-hidden shadow-xs">
            {faqs.map((faq) => {
              const isOpen = openFaqId === faq.id;
              return (
                <div key={faq.id}>
                  <button
                    type="button"
                    onClick={() => setOpenFaqId(isOpen ? null : faq.id)}
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
                    <span className={`text-zinc-400 text-[11px] shrink-0 font-bold transition-transform ${isOpen ? "rotate-180" : ""}`}>
                      ▼
                    </span>
                  </button>

                  {isOpen && (
                    <div className="px-4 pb-4 pt-1 text-xs text-zinc-700 dark:text-zinc-300 bg-zinc-50/60 dark:bg-zinc-900/60 space-y-2 border-t border-zinc-100 dark:border-zinc-800/60">
                      <div className="flex items-start gap-2 pt-2">
                        <span className="text-emerald-600 dark:text-emerald-400 font-mono font-bold text-xs shrink-0">
                          A.
                        </span>
                        <div className="space-y-1.5 leading-relaxed flex-1">
                          <p className="font-normal">{faq.answer_ko}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Related Knowledge / Guides */}
      {related && related.length > 0 && (
        <div className="space-y-3 pt-2">
          <h3 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
            <span>📚</span>
            <span>관련 도움말 및 가이드</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {related.map((rel) => (
              <Link
                key={rel.id}
                href={`${baseHelpPath}/${rel.slug || rel.id}`}
                className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-400 dark:hover:border-zinc-600 transition-all shadow-xs group flex flex-col justify-between"
              >
                <div>
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
                </div>
                <div className="text-right mt-2 text-[10px] text-blue-600 dark:text-blue-400 font-semibold">
                  자세히 보기 &rarr;
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Bottom Support Escalation Card (Single Clean CTA) */}
      <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 sm:p-5 dark:border-zinc-800 dark:bg-zinc-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5">
            <span className="text-base">💬</span>
            <h3 className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white">
              원하는 내용을 찾지 못하셨나요?
            </h3>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {supportDescription}
          </p>
        </div>
        <button
          type="button"
          onClick={handleEscalateToSupport}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#131E2E] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1f3047] dark:bg-white dark:text-[#131E2E] transition-colors shrink-0 shadow-xs cursor-pointer"
        >
          <span>{supportCtaText}</span>
          <span>&rarr;</span>
        </button>
      </div>
    </div>
  );
}

