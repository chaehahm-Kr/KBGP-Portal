"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  ANNOUNCEMENT_CATEGORIES,
  getAnnouncementCategoryLabel,
  getAnnouncementPriorityLabel,
  type AnnouncementCategory,
  type AnnouncementPriority,
} from "@/lib/brand-comms/types";

interface PortalAnnouncementSummary {
  id: string;
  title_ko: string;
  title_en: string | null;
  excerpt_ko: string;
  excerpt_en: string | null;
  category: AnnouncementCategory;
  priority: AnnouncementPriority;
  audience_mode: "ALL_COMPANIES" | "SELECTED_COMPANIES";
  is_pinned: boolean;
  published_at: string;
  author_name: string;
  has_attachment: boolean;
  related_resource_count: number;
  related_insight_slug: string | null;
  is_read: boolean;
}

export default function PortalAnnouncementsPage() {
  const [items, setItems] = useState<PortalAnnouncementSummary[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState("ALL");
  const [searchQ, setSearchQ] = useState("");
  const [locale, setLocale] = useState<"ko" | "en">("ko");

  const loadAnnouncements = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (category !== "ALL") params.set("category", category);
      if (searchQ.trim()) params.set("q", searchQ.trim());

      const res = await fetch(`/api/portal/announcements?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "공지사항을 불러오지 못했습니다.");
      setItems(data.announcements || []);
      setUnreadCount(data.unread_count || 0);
    } catch (e: any) {
      setError(e?.message || "공지사항을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [category, searchQ]);

  useEffect(() => {
    loadAnnouncements();
  }, [loadAnnouncements]);

  const priorityStyle = (p: AnnouncementPriority) => {
    if (p === "ACTION_REQUIRED")
      return "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30";
    if (p === "IMPORTANT")
      return "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30";
    return "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700";
  };

  return (
    <div className="max-w-5xl space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white">
              {locale === "en" ? "Announcements" : "공지사항"}
            </h1>
            {unreadCount > 0 && (
              <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[11px] font-bold text-white">
                {locale === "en" ? `${unreadCount} unread` : `미확인 ${unreadCount}`}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {locale === "en"
              ? "Official K SELECT NETWORK operational updates, regulatory notices, and partner-specific announcements."
              : "K SELECT NETWORK 운영 안내, FDA·규제 공지 및 귀사 전용 안내 사항을 확인하세요."}
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
            href="/portal/resources"
            className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            {locale === "en" ? "Resource Center →" : "자료실 바로가기 →"}
          </Link>
        </div>
      </div>

      {/* Search & Category Filter */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-3 space-y-2.5">
        <input
          type="text"
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
          placeholder={
            locale === "en"
              ? "Search announcements by keyword..."
              : "공지 제목 또는 내용 검색..."
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
            {locale === "en" ? "All" : "전체"}
          </button>
          {ANNOUNCEMENT_CATEGORIES.map((c) => (
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

      {/* Content */}
      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-600 dark:text-rose-400">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 divide-y divide-zinc-200/70 dark:divide-zinc-800">
          {[1, 2, 3].map((n) => (
            <div key={n} className="p-4 animate-pulse space-y-2">
              <div className="h-4 w-1/3 rounded bg-zinc-200 dark:bg-zinc-800" />
              <div className="h-3 w-2/3 rounded bg-zinc-100 dark:bg-zinc-900" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-10 text-center space-y-2">
          <div className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            {locale === "en" ? "No announcements available" : "등록된 공지사항이 없습니다"}
          </div>
          <p className="text-xs text-zinc-500">
            {locale === "en"
              ? "Try clearing your search or category filter."
              : "검색어 또는 카테고리 필터를 변경해 보세요."}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 divide-y divide-zinc-200/70 dark:divide-zinc-800 overflow-hidden">
          {items.map((item) => {
            const title =
              locale === "en" && item.title_en ? item.title_en : item.title_ko;
            const excerpt =
              locale === "en" && item.excerpt_en ? item.excerpt_en : item.excerpt_ko;

            return (
              <Link
                key={item.id}
                href={`/portal/announcements/${item.id}`}
                className={`block px-4 py-3.5 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/70 ${
                  !item.is_read ? "bg-blue-50/40 dark:bg-blue-950/15" : ""
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {!item.is_read && (
                      <span
                        className="h-2 w-2 rounded-full bg-blue-600 shrink-0"
                        title={locale === "en" ? "Unread" : "읽지 않음"}
                      />
                    )}
                    {item.is_pinned && (
                      <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                        {locale === "en" ? "PINNED" : "고정"}
                      </span>
                    )}
                    <span
                      className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${priorityStyle(
                        item.priority
                      )}`}
                    >
                      {getAnnouncementPriorityLabel(item.priority, locale)}
                    </span>
                    <span className="rounded bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:text-zinc-300">
                      {getAnnouncementCategoryLabel(item.category, locale)}
                    </span>
                    {item.audience_mode === "SELECTED_COMPANIES" && (
                      <span className="rounded bg-indigo-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-600 dark:text-indigo-300">
                        {locale === "en" ? "Direct Notice" : "전용 안내"}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-zinc-400 whitespace-nowrap">
                    {new Date(item.published_at).toLocaleDateString()}
                  </span>
                </div>

                <h2
                  className={`mt-1.5 text-sm leading-snug ${
                    !item.is_read
                      ? "font-bold text-zinc-950 dark:text-white"
                      : "font-semibold text-zinc-800 dark:text-zinc-200"
                  }`}
                >
                  {title}
                </h2>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2">
                  {excerpt}
                </p>

                {(item.has_attachment || item.related_resource_count > 0) && (
                  <div className="mt-2 flex items-center gap-3 text-[11px] text-zinc-400">
                    {item.has_attachment && (
                      <span>📎 {locale === "en" ? "Attachment" : "첨부파일"}</span>
                    )}
                    {item.related_resource_count > 0 && (
                      <span>
                        📁{" "}
                        {locale === "en"
                          ? `${item.related_resource_count} linked resource(s)`
                          : `연결 자료 ${item.related_resource_count}건`}
                      </span>
                    )}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
