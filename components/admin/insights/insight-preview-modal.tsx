"use client";

import React, { useState } from "react";

interface InsightPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  article: any;
}

export default function InsightPreviewModal({ isOpen, onClose, article }: InsightPreviewModalProps) {
  const [activeChannel, setActiveChannel] = useState<"K_SELECT_NETWORK" | "K_SELECT_HUB">("K_SELECT_NETWORK");
  const [activeLang, setActiveLang] = useState<"KO" | "EN">("KO");

  if (!isOpen || !article) return null;

  // Determine current content based on Channel & Language
  const isNetwork = activeChannel === "K_SELECT_NETWORK";
  const isKo = activeLang === "KO";

  const title = isKo 
    ? (article.title_ko || article.title || "제목 없음")
    : (article.title_en || article.title || "Untitled Insight");

  const subtitle = isKo
    ? (article.subtitle_ko || article.subtitle || "")
    : (article.subtitle_en || article.subtitle || "");

  const summary = isKo
    ? (article.summary_ko || article.excerpt || "")
    : (article.summary_en || article.excerpt || "");

  const category = isNetwork
    ? (article.network_category || article.category)
    : (article.hub_category || article.category);

  // Takeaway & Action Points
  const takeaway = isNetwork
    ? (isKo ? (article.network_brand_takeaway_ko || article.brand_takeaway) : (article.network_brand_takeaway_en || article.brand_takeaway))
    : (isKo ? (article.hub_retailer_takeaway_ko || article.retailer_takeaway) : (article.hub_retailer_takeaway_en || article.retailer_takeaway));

  const actions = isNetwork
    ? (isKo ? (article.network_brand_actions_ko || article.brand_actions) : (article.network_brand_actions_en || article.brand_actions))
    : (isKo ? (article.hub_retailer_actions_ko || article.retailer_actions) : (article.hub_retailer_actions_en || article.retailer_actions));

  const bodyBlocks = isKo 
    ? (article.body_blocks_ko && article.body_blocks_ko.length > 0 ? article.body_blocks_ko : article.body_blocks || [])
    : (article.body_blocks_en && article.body_blocks_en.length > 0 ? article.body_blocks_en : article.body_blocks || []);

  const sources = article.sources_detail || article.sources || [];

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

          {/* Channel & Language Toggles */}
          <div className="flex items-center gap-3 mt-2 sm:mt-0">
            {/* Channel Segmented Control */}
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

            {/* Language Toggle */}
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

            {/* Close Button */}
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
          
          {/* Channel Badge Header */}
          <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-4">
            <div className="flex items-center gap-2">
              <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${
                isNetwork ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
              }`}>
                {isNetwork ? "K SELECT NETWORK — BRAND PORTAL" : "K SELECT HUB — RETAILER PORTAL"}
              </span>
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">
                {category}
              </span>
            </div>
            <span className="text-xs text-zinc-400">
              {article.author} • {new Date(article.publish_date || article.created_at).toLocaleDateString()}
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
                  (e.target as HTMLElement).style.display = 'none';
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

          {/* Key Takeaway & Actions Box */}
          {(takeaway || (actions && actions.length > 0)) && (
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-950/50 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-white">
                {isNetwork ? (isKo ? "💡 브랜드 핵심 시사점 & 실행과제" : "💡 Brand Strategic Takeaway & Action Plan") : (isKo ? "🛍️ 리테일러 핵심 시사점 & 실행과제" : "🛍️ Retailer Strategic Takeaway & Action Plan")}
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

          {/* Body Content Blocks */}
          <div className="space-y-4 pt-2">
            {Array.isArray(bodyBlocks) && bodyBlocks.length > 0 ? (
              bodyBlocks.map((block: any, i: number) => {
                if (block.type === "HEADING") {
                  return (
                    <h3 key={i} className="text-lg font-bold text-zinc-900 dark:text-white pt-2 border-b border-zinc-100 dark:border-zinc-800 pb-1">
                      {block.value}
                    </h3>
                  );
                }
                if (block.type === "CHECKLIST" && block.items) {
                  return (
                    <div key={i} className="rounded-lg border border-zinc-200 p-4 bg-white dark:bg-zinc-950 dark:border-zinc-800">
                      {block.title && <h5 className="text-xs font-bold text-zinc-900 dark:text-white mb-2">{block.title}</h5>}
                      <ul className="space-y-1 text-xs text-zinc-700 dark:text-zinc-300 pl-4 list-disc">
                        {block.items.map((item: string, j: number) => (
                          <li key={j}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  );
                }
                return (
                  <p key={i} className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                    {block.value || (typeof block === "string" ? block : "")}
                  </p>
                );
              })
            ) : (
              <p className="text-sm text-zinc-500 italic">
                {isKo ? "본문 내용이 준비되지 않았습니다." : "No body content available for this selection."}
              </p>
            )}
          </div>

          {/* Sources Section */}
          {Array.isArray(sources) && sources.length > 0 && (
            <div className="mt-8 border-t border-zinc-200 dark:border-zinc-800 pt-4 text-xs text-zinc-500">
              <h5 className="font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                {isKo ? "참고 자료 및 출처 (Sources)" : "Reference Sources"}
              </h5>
              <ul className="list-disc pl-4 space-y-0.5">
                {sources.map((src: any, sIdx: number) => (
                  <li key={sIdx}>
                    {typeof src === "string" ? src : `${src.name || src.source_name || "Source"}: ${src.title || src.url || ""}`}
                  </li>
                ))}
              </ul>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-zinc-200 bg-zinc-50 px-6 py-3 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="text-xs text-zinc-500">
            Current Status: <span className="font-bold text-zinc-900 dark:text-white">{article.status}</span>
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
