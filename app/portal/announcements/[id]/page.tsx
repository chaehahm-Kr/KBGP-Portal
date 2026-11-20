"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import {
  formatBytes,
  getAnnouncementCategoryLabel,
  getAnnouncementPriorityLabel,
  getResourceCategoryLabel,
  type AnnouncementCategory,
  type AnnouncementPriority,
} from "@/lib/brand-comms/types";

interface AnnouncementDetail {
  id: string;
  title_ko: string;
  title_en: string | null;
  body_ko: string;
  body_en: string | null;
  category: AnnouncementCategory;
  priority: AnnouncementPriority;
  audience_mode: "ALL_COMPANIES" | "SELECTED_COMPANIES";
  is_pinned: boolean;
  published_at: string;
  updated_at: string;
  author_name: string;
  attachment: {
    file_name: string;
    file_size: number | null;
    mime_type: string | null;
    download_url: string;
  } | null;
  related_resources: {
    id: string;
    title_ko: string;
    title_en: string | null;
    category: string;
    file_type: string;
    file_name: string | null;
    file_size: number | null;
    version: string;
    download_url: string;
  }[];
  related_insight: {
    id: string;
    slug: string;
    title_ko: string;
    title_en: string | null;
    public_url: string;
  } | null;
}

export default function PortalAnnouncementDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [item, setItem] = useState<AnnouncementDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [locale, setLocale] = useState<"ko" | "en">("ko");

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/portal/announcements/${id}`);
        const data = await res.json();
        if (!res.ok) {
          throw new Error(
            res.status === 404
              ? "해당 공지사항을 찾을 수 없거나 열람 권한이 없습니다."
              : data.error || "공지사항을 불러오지 못했습니다."
          );
        }
        if (active) setItem(data.announcement);
      } catch (e: any) {
        if (active) setError(e?.message || "오류가 발생했습니다.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-4xl rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 animate-pulse space-y-3">
        <div className="h-5 w-1/3 rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-7 w-2/3 rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-32 w-full rounded bg-zinc-100 dark:bg-zinc-900" />
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="max-w-4xl space-y-4">
        <Link
          href="/portal/announcements"
          className="inline-flex items-center text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
        >
          ← 공지사항 목록으로 돌아가기
        </Link>
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-6 text-sm text-rose-600 dark:text-rose-400">
          {error || "공지사항을 찾을 수 없습니다."}
        </div>
      </div>
    );
  }

  const title = locale === "en" && item.title_en ? item.title_en : item.title_ko;
  const body = locale === "en" && item.body_en ? item.body_en : item.body_ko;

  return (
    <div className="max-w-4xl space-y-5">
      {/* Top Bar */}
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/portal/announcements"
          className="inline-flex items-center text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
        >
          ← {locale === "en" ? "Back to Announcements" : "공지사항 목록으로"}
        </Link>
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
      </div>

      {/* Article Card */}
      <article className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 space-y-5">
        <div className="space-y-2.5 border-b border-zinc-200 dark:border-zinc-800 pb-4">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {item.is_pinned && (
              <span className="rounded bg-amber-500/15 px-2 py-0.5 font-bold text-amber-600 dark:text-amber-400">
                {locale === "en" ? "PINNED" : "고정 공지"}
              </span>
            )}
            <span
              className={`rounded border px-2 py-0.5 font-bold ${
                item.priority === "ACTION_REQUIRED"
                  ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30"
                  : item.priority === "IMPORTANT"
                  ? "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700"
              }`}
            >
              {getAnnouncementPriorityLabel(item.priority, locale)}
            </span>
            <span className="rounded bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 font-medium text-zinc-700 dark:text-zinc-300">
              {getAnnouncementCategoryLabel(item.category, locale)}
            </span>
            {item.audience_mode === "SELECTED_COMPANIES" && (
              <span className="rounded bg-indigo-500/15 px-2 py-0.5 font-semibold text-indigo-600 dark:text-indigo-300">
                {locale === "en" ? "Company-Specific Notice" : "귀사 전용 공지"}
              </span>
            )}
          </div>

          <h1 className="text-xl font-bold tracking-tight text-zinc-950 dark:text-white leading-snug">
            {title}
          </h1>

          <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500">
            <span>{item.author_name}</span>
            <span>•</span>
            <span>
              {locale === "en" ? "Published" : "게시일"}:{" "}
              {new Date(item.published_at).toLocaleDateString()}
            </span>
          </div>
        </div>

        {/* Body */}
        <div className="whitespace-pre-wrap text-sm leading-7 text-zinc-800 dark:text-zinc-200">
          {body}
        </div>

        {/* Direct Attachment */}
        {item.attachment && (
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 p-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                {locale === "en" ? "Attachment" : "첨부파일"}
              </div>
              <div className="text-sm font-semibold text-zinc-900 dark:text-white mt-0.5">
                {item.attachment.file_name}
              </div>
              <div className="text-xs text-zinc-500">
                {formatBytes(item.attachment.file_size)}
              </div>
            </div>
            <a
              href={item.attachment.download_url}
              className="rounded-lg bg-zinc-900 dark:bg-white px-4 py-2 text-xs font-semibold text-white dark:text-zinc-950 hover:opacity-90"
            >
              {locale === "en" ? "Download File" : "첨부파일 다운로드"}
            </a>
          </div>
        )}

        {/* Linked Resource Center Items */}
        {item.related_resources.length > 0 && (
          <div className="space-y-2.5 pt-2 border-t border-zinc-200 dark:border-zinc-800">
            <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">
              {locale === "en" ? "Related Resource Center Guides" : "연결된 자료실 문서"}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {item.related_resources.map((res) => (
                <div
                  key={res.id}
                  className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/50 p-3.5 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-blue-600 dark:text-blue-400">
                      <span>{res.file_type}</span>
                      <span>•</span>
                      <span>{res.version}</span>
                      <span>•</span>
                      <span className="truncate text-zinc-500">
                        {getResourceCategoryLabel(res.category, locale)}
                      </span>
                    </div>
                    <div className="mt-1 text-xs font-semibold text-zinc-900 dark:text-white truncate">
                      {locale === "en" && res.title_en ? res.title_en : res.title_ko}
                    </div>
                    <div className="text-[11px] text-zinc-500">
                      {formatBytes(res.file_size)}
                    </div>
                  </div>
                  <a
                    href={res.download_url}
                    className="shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                  >
                    {locale === "en" ? "Download" : "다운로드"}
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Related Public Insights Link */}
        {item.related_insight && (
          <div className="rounded-xl border border-blue-200/70 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/20 p-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                K SELECT NETWORK INSIGHTS
              </div>
              <div className="text-sm font-semibold text-zinc-900 dark:text-white mt-0.5">
                {locale === "en" && item.related_insight.title_en
                  ? item.related_insight.title_en
                  : item.related_insight.title_ko}
              </div>
            </div>
            <a
              href={item.related_insight.public_url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-blue-300 dark:border-blue-800 px-3 py-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-100/60 dark:hover:bg-blue-900/40"
            >
              {locale === "en" ? "Read Full Insight ↗" : "관련 인사이트 보기 ↗"}
            </a>
          </div>
        )}
      </article>
    </div>
  );
}
