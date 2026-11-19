"use client";

import React, { useState } from "react";
import { extractPdfAttachment } from "@/lib/insights/pdf-attachments";

interface InsightPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  article: any;
}

function renderRichTextWithLinks(text: string) {
  if (!text) return null;
  const parts: React.ReactNode[] = [];
  const linkRe = /\[([^\]]+)\]\(([^)]+)\)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = linkRe.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const label = match[1];
    const href = match[2];
    const isExternal = /^https?:\/\//i.test(href);
    parts.push(
      <a
        key={`${match.index}-${href}`}
        href={href}
        target={isExternal ? "_blank" : undefined}
        rel={isExternal ? "noopener noreferrer" : undefined}
        className="font-semibold text-blue-600 underline hover:text-blue-800 dark:text-blue-400"
      >
        {label}
      </a>
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "";
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
  return `${Math.round(bytes / 1024)} KB`;
}

export default function InsightPreviewModal({
  isOpen,
  onClose,
  article,
}: InsightPreviewModalProps) {
  const [activeChannel, setActiveChannel] = useState<"K_SELECT_NETWORK" | "K_SELECT_HUB">(
    "K_SELECT_NETWORK"
  );
  const [activeLang, setActiveLang] = useState<"KO" | "EN">("KO");

  if (!isOpen || !article) return null;

  const isNetwork = activeChannel === "K_SELECT_NETWORK";
  const isKo = activeLang === "KO";

  const title = isKo
    ? article.title_ko || article.title || "제목 없음"
    : article.title_en || article.title || "Untitled Insight";

  const subtitle = isKo
    ? article.subtitle_ko || article.subtitle || ""
    : article.subtitle_en || article.subtitle || "";

  const summary = isKo
    ? article.summary_ko || article.excerpt || ""
    : article.summary_en || article.excerpt || "";

  const category = isNetwork
    ? article.network_category || article.category
    : article.hub_category || article.category;

  const takeaway = isNetwork
    ? isKo
      ? article.network_brand_takeaway_ko || article.brand_takeaway
      : article.network_brand_takeaway_en || article.brand_takeaway
    : isKo
      ? article.hub_retailer_takeaway_ko || article.retailer_takeaway
      : article.hub_retailer_takeaway_en || article.retailer_takeaway;

  const actions = isNetwork
    ? isKo
      ? article.network_brand_actions_ko || article.brand_actions
      : article.network_brand_actions_en || article.brand_actions
    : isKo
      ? article.hub_retailer_actions_ko || article.retailer_actions
      : article.hub_retailer_actions_en || article.retailer_actions;

  const bodyBlocks = isKo
    ? article.body_blocks_ko && article.body_blocks_ko.length > 0
      ? article.body_blocks_ko
      : article.body_blocks || []
    : article.body_blocks_en && article.body_blocks_en.length > 0
      ? article.body_blocks_en
      : article.body_blocks || [];

  const pdfAttachment = article.pdf_attachment || extractPdfAttachment(article.visuals);
  const hasInlinePdfBlock =
    Array.isArray(bodyBlocks) &&
    bodyBlocks.some((b: any) => String(b?.type || "").toUpperCase() === "PDF_DOWNLOAD");

  const sources =
    article.sources_detail && article.sources_detail.length > 0
      ? article.sources_detail
      : article.sources || [];

  const renderPdfDownloadCard = (keySuffix: string) => {
    if (!pdfAttachment) return null;
    const cardTitle = isKo
      ? pdfAttachment.card_title_ko
      : pdfAttachment.card_title_en || pdfAttachment.card_title_ko;
    const cardDesc = isKo
      ? pdfAttachment.card_description_ko
      : pdfAttachment.card_description_en || pdfAttachment.card_description_ko;
    const btnLabel = isKo
      ? pdfAttachment.button_label_ko || "무료 PDF 다운로드"
      : pdfAttachment.button_label_en || "Download Free PDF";

    return (
      <div
        key={`pdf-card-${keySuffix}`}
        className="rounded-xl border border-zinc-900/15 bg-[#0e0e10] text-[#f4f0e8] p-6 shadow-sm my-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <span className="inline-block text-[10px] font-extrabold uppercase tracking-widest text-blue-400">
              PRACTICAL PDF GUIDE • K SELECT NETWORK
            </span>
            <h4 className="text-lg font-bold text-white">{cardTitle}</h4>
            <p className="text-xs text-zinc-300">
              {cardDesc}
              {pdfAttachment.file_size ? ` • ${formatBytes(pdfAttachment.file_size)}` : ""}
            </p>
          </div>
          <a
            href={`/api/admin/insights/${article.id}/attachment`}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-blue-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-blue-500 transition-colors shrink-0"
          >
            <span>{btnLabel}</span>
            <span aria-hidden="true">↓</span>
          </a>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fadeIn">
      <div className="flex h-[90vh] w-full max-w-4xl flex-col rounded-xl bg-white shadow-2xl dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        {/* Modal Top Bar */}
        <div className="flex flex-wrap items-center justify-between border-b border-zinc-200 bg-zinc-50 px-6 py-4 dark:border-zinc-800 dark:bg-zinc-950">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Live Editorial Preview
            </span>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white line-clamp-1">
              {title}
            </h3>
          </div>

          <div className="flex items-center gap-3 mt-2 sm:mt-0">
            <div className="inline-flex rounded-lg bg-zinc-200 p-1 dark:bg-zinc-800">
              <button
                onClick={() => setActiveChannel("K_SELECT_NETWORK")}
                className={`rounded-md px-3 py-1 text-xs font-semibold transition-all ${
                  isNetwork
                    ? "bg-white text-zinc-900 shadow dark:bg-zinc-950 dark:text-white"
                    : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
                }`}
              >
                NETWORK (Brand)
              </button>
              <button
                onClick={() => setActiveChannel("K_SELECT_HUB")}
                className={`rounded-md px-3 py-1 text-xs font-semibold transition-all ${
                  !isNetwork
                    ? "bg-white text-zinc-900 shadow dark:bg-zinc-950 dark:text-white"
                    : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
                }`}
              >
                HUB (Retailer)
              </button>
            </div>

            <div className="inline-flex rounded-lg bg-zinc-200 p-1 dark:bg-zinc-800">
              <button
                onClick={() => setActiveLang("KO")}
                className={`rounded-md px-3 py-1 text-xs font-bold transition-all ${
                  isKo
                    ? "bg-blue-600 text-white shadow"
                    : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
                }`}
              >
                KO
              </button>
              <button
                onClick={() => setActiveLang("EN")}
                className={`rounded-md px-3 py-1 text-xs font-bold transition-all ${
                  !isKo
                    ? "bg-blue-600 text-white shadow"
                    : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
                }`}
              >
                EN
              </button>
            </div>

            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-white"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Modal Scrollable Article Body */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">
          {!isNetwork && article.hub_enabled === false && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs font-semibold text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
              K SELECT HUB channel is currently DISABLED for this article (Target Channel: K SELECT NETWORK ONLY).
            </div>
          )}

          {/* Channel Badge Header */}
          <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-4">
            <div className="flex items-center gap-2">
              <span
                className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${
                  isNetwork
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                    : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                }`}
              >
                {isNetwork
                  ? "K SELECT NETWORK — BRAND CHANNEL"
                  : "K SELECT HUB — RETAILER CHANNEL"}
              </span>
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">
                {category}
              </span>
            </div>
            <span className="text-xs text-zinc-400">
              {article.author} •{" "}
              {new Date(article.publish_date || article.created_at).toLocaleDateString()}
            </span>
          </div>

          {/* Hero Image */}
          {article.hero_image && (
            <div className="overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-800 max-h-72 border border-zinc-200 dark:border-zinc-800">
              <img
                src={article.hero_image}
                alt={title}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = "none";
                }}
              />
            </div>
          )}

          {/* Headline & Subtitle */}
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-zinc-900 dark:text-white leading-tight">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-2 text-base font-medium text-zinc-600 dark:text-zinc-300">
                {subtitle}
              </p>
            )}
          </div>

          {/* Summary Callout */}
          {summary && (
            <div className="rounded-lg border-l-4 border-blue-600 bg-blue-50/50 p-4 dark:bg-blue-950/20 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
              <strong>{isKo ? "핵심 요약:" : "Executive Summary:"}</strong> {summary}
            </div>
          )}

          {/* Body Content Blocks */}
          <div className="space-y-4 pt-2">
            {Array.isArray(bodyBlocks) && bodyBlocks.length > 0 ? (
              bodyBlocks.map((block: any, i: number) => {
                const bType = String(block?.type || "TEXT").toUpperCase();
                const bVal = block?.content || block?.value || "";

                if (bType === "HEADING" || bType === "HEADER") {
                  return (
                    <h3
                      key={i}
                      className="text-lg font-bold text-zinc-900 dark:text-white pt-4 border-b border-zinc-100 dark:border-zinc-800 pb-1.5"
                    >
                      {bVal}
                    </h3>
                  );
                }

                if (bType === "KEY_TAKEAWAY") {
                  return (
                    <div
                      key={i}
                      className="rounded-lg border-l-4 border-blue-600 bg-zinc-50 dark:bg-zinc-950 p-4 text-sm font-medium text-zinc-800 dark:text-zinc-200 leading-relaxed"
                    >
                      <div className="text-[10px] font-extrabold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-1">
                        KEY TAKEAWAY
                      </div>
                      {renderRichTextWithLinks(bVal)}
                    </div>
                  );
                }

                if (bType === "CHECKLIST" && Array.isArray(block.items)) {
                  return (
                    <div
                      key={i}
                      className="rounded-lg border border-zinc-200 p-4 bg-white dark:bg-zinc-950 dark:border-zinc-800"
                    >
                      {block.title && (
                        <h5 className="text-xs font-bold text-zinc-900 dark:text-white mb-2">
                          {block.title}
                        </h5>
                      )}
                      <ul className="space-y-1.5 text-xs text-zinc-700 dark:text-zinc-300 pl-4 list-disc">
                        {block.items.map((item: string, j: number) => (
                          <li key={j}>{renderRichTextWithLinks(item)}</li>
                        ))}
                      </ul>
                    </div>
                  );
                }

                if (bType === "MARKET_DATA" && Array.isArray(block.headers)) {
                  return (
                    <div key={i} className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800">
                          <tr>
                            {block.headers.map((h: string, hIdx: number) => (
                              <th key={hIdx} className="px-3 py-2.5 font-bold text-zinc-700 dark:text-zinc-300">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                          {(block.rows || []).map((row: string[], rIdx: number) => (
                            <tr key={rIdx}>
                              {row.map((cell: string, cIdx: number) => (
                                <td key={cIdx} className="px-3 py-2 text-zinc-700 dark:text-zinc-300">
                                  {renderRichTextWithLinks(cell)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                }

                if (bType === "RELATED_INSIGHT") {
                  return (
                    <div
                      key={i}
                      className="rounded-xl border border-zinc-200 bg-zinc-50/80 dark:border-zinc-800 dark:bg-zinc-950 p-4 flex items-center justify-between gap-4"
                    >
                      <div>
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                          {isKo ? "연관 실무 가이드" : "RELATED PRACTICAL GUIDE"}
                        </span>
                        <div className="text-sm font-bold text-zinc-900 dark:text-white mt-0.5">
                          {block.title || bVal}
                        </div>
                        {block.description && (
                          <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
                            {block.description}
                          </p>
                        )}
                      </div>
                      {block.href && (
                        <span className="text-xs font-bold text-blue-600 shrink-0">
                          {block.href} →
                        </span>
                      )}
                    </div>
                  );
                }

                if (bType === "PDF_DOWNLOAD") {
                  return renderPdfDownloadCard(String(i));
                }

                return (
                  <p
                    key={i}
                    className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap"
                  >
                    {renderRichTextWithLinks(bVal || (typeof block === "string" ? block : ""))}
                  </p>
                );
              })
            ) : (
              <p className="text-sm text-zinc-500 italic">
                {isKo
                  ? "본문 내용이 준비되지 않았습니다."
                  : "No body content available for this selection."}
              </p>
            )}
          </div>

          {/* Render PDF Download Card automatically if not placed inline */}
          {!hasInlinePdfBlock && pdfAttachment && renderPdfDownloadCard("auto")}

          {/* Key Takeaway & Actions Box */}
          {(takeaway || (actions && actions.length > 0)) && (
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-950/50 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-white">
                {isNetwork
                  ? isKo
                    ? "브랜드 핵심 시사점 & 실행 체크리스트"
                    : "Brand Strategic Takeaway & Action Checklist"
                  : isKo
                    ? "리테일러 핵심 시사점 & 실행과제"
                    : "Retailer Strategic Takeaway & Action Plan"}
              </h4>
              {takeaway && (
                <p className="text-sm font-semibold text-zinc-900 dark:text-white leading-relaxed">
                  {takeaway}
                </p>
              )}
              {Array.isArray(actions) && actions.length > 0 && (
                <ul className="space-y-1.5 pl-4 text-xs font-medium text-zinc-700 dark:text-zinc-300 list-disc">
                  {actions.map((act: string, idx: number) => (
                    <li key={idx}>{act}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Sources Section */}
          {Array.isArray(sources) && sources.length > 0 && (
            <div className="mt-8 border-t border-zinc-200 dark:border-zinc-800 pt-4 text-xs text-zinc-500">
              <h5 className="font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                {isKo ? "공식 참고 자료 및 출처 (Official Sources)" : "Official Reference Sources"}
              </h5>
              <ul className="list-disc pl-4 space-y-1">
                {sources.map((src: any, sIdx: number) => {
                  if (typeof src === "string") {
                    return <li key={sIdx}>{renderRichTextWithLinks(src)}</li>;
                  }
                  const label = `${src.name || src.sourceName || src.source_name || "FDA"}: ${src.title || src.sourceTitle || src.url || ""}`;
                  return (
                    <li key={sIdx}>
                      {src.url ? (
                        <a
                          href={src.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 underline hover:text-blue-800 dark:text-blue-400"
                        >
                          {label}
                        </a>
                      ) : (
                        label
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-zinc-200 bg-zinc-50 px-6 py-3 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="text-xs text-zinc-500">
            Current Status:{" "}
            <span className="font-bold text-zinc-900 dark:text-white">{article.status}</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
}
