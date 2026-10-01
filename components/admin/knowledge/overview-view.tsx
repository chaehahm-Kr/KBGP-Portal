"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { KnowledgeItem } from "@/lib/knowledge/types";
import KnowledgeNavTabs from "./knowledge-nav-tabs";

export default function OverviewView() {
  const [data, setData] = useState<{
    items: KnowledgeItem[];
    metrics: {
      publishedCount: number;
      draftCount: number;
      archivedCount: number;
      totalCount: number;
    };
    needsAttention: KnowledgeItem[];
    recentlyUpdated: KnowledgeItem[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOverview();
  }, []);

  const fetchOverview = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/knowledge");
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (e) {
      console.error("Failed to load knowledge overview:", e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <KnowledgeNavTabs />
        <div className="h-8 w-64 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 bg-zinc-100 dark:bg-zinc-900 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const items = data?.items || [];
  const publishedCount = items.filter((i) => i.status === "PUBLISHED").length;
  const draftCount = items.filter((i) => i.status === "DRAFT" || i.status === "IN_REVIEW").length;
  const archivedCount = items.filter((i) => i.status === "ARCHIVED" || i.status === "SUPERSEDED").length;
  const updateRequiredCount = items.filter((i) => i.system_impact_status === "UPDATE_REQUIRED" || i.system_impact_status === "POTENTIALLY_OUTDATED").length;

  const recentlyUpdated = data?.recentlyUpdated || items.slice(0, 6);
  const needsAttention = data?.needsAttention || items.filter(i => i.system_impact_status === "UPDATE_REQUIRED" || i.status === "DRAFT" || i.status === "IN_REVIEW").slice(0, 6);

  const getTypeBadge = (type: string) => {
    return (
      <span className="rounded-md bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-[11px] font-semibold text-zinc-750 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
        {type}
      </span>
    );
  };

  return (
    <div className="space-y-8">
      <KnowledgeNavTabs />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
              Knowledge Center
            </h1>
            <span className="rounded-full bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              Source of Truth
            </span>
          </div>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            K SELECT NETWORK의 공식 매뉴얼, 정책, 가이드, FAQ를 관리하는 중앙 지식 센터입니다.
          </p>
        </div>
        <Link
          href="/admin/knowledge/new"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#131E2E] px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-[#1f3047] dark:bg-white dark:text-[#131E2E] dark:hover:bg-zinc-100 transition-colors shrink-0"
        >
          <span>+ Create Knowledge</span>
        </Link>
      </div>

      {/* UPDATE REQUIRED Notification Card if any exist */}
      {updateRequiredCount > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50/90 p-5 dark:border-amber-700/60 dark:bg-amber-950/30 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500 text-white font-bold text-base shadow-xs">
                ⚠️
              </span>
              <div>
                <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                  {updateRequiredCount}건의 지식 문서에 시스템 변경 영향(UPDATE REQUIRED)이 감지되었습니다.
                </h3>
                <p className="text-xs text-amber-800 dark:text-amber-300 mt-0.5">
                  관련 메뉴, 워크플로우 또는 설정 변경이 감지되었습니다. 매뉴얼 내용 일치 여부를 검토해 주세요.
                </p>
              </div>
            </div>
            <Link
              href="/admin/knowledge/library?impact=UPDATE_REQUIRED"
              className="inline-flex items-center justify-center rounded-lg bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-700 transition-colors shadow-xs shrink-0"
            >
              검토 대상 보기 ({updateRequiredCount}건) &rarr;
            </Link>
          </div>
        </div>
      )}

      {/* Simplified Metric Cards (Published / Draft / Archived) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {/* Published */}
        <Link
          href="/admin/knowledge/library?status=PUBLISHED"
          className="group rounded-xl border border-zinc-200 bg-white p-6 shadow-sm hover:shadow-md hover:border-emerald-500 transition-all dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Published
            </span>
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-zinc-900 dark:text-white">
              {publishedCount}
            </span>
            <span className="text-xs text-zinc-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 font-semibold transition-colors">
              View All &rarr;
            </span>
          </div>
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            현재 공식 배포 및 운영 중인 지식
          </p>
        </Link>

        {/* Draft */}
        <Link
          href="/admin/knowledge/library?status=DRAFT"
          className="group rounded-xl border border-zinc-200 bg-white p-6 shadow-sm hover:shadow-md hover:border-zinc-400 transition-all dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
              Draft
            </span>
            <span className="h-2.5 w-2.5 rounded-full bg-zinc-400" />
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-zinc-900 dark:text-white">
              {draftCount}
            </span>
            <span className="text-xs text-zinc-400 group-hover:text-zinc-700 dark:group-hover:text-zinc-200 font-semibold transition-colors">
              View All &rarr;
            </span>
          </div>
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            작성 중이거나 검토 대기 중인 지식
          </p>
        </Link>

        {/* Archived */}
        <Link
          href="/admin/knowledge/library?status=ARCHIVED"
          className="group rounded-xl border border-zinc-200 bg-white p-6 shadow-sm hover:shadow-md hover:border-amber-500 transition-all dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Archived
            </span>
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-zinc-900 dark:text-white">
              {archivedCount}
            </span>
            <span className="text-xs text-zinc-400 group-hover:text-amber-600 dark:group-hover:text-amber-400 font-semibold transition-colors">
              View All &rarr;
            </span>
          </div>
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            구버전 대체 또는 보관 처리된 지식
          </p>
        </Link>
      </div>

      {/* Two Column Grid: Recently Updated & Needs Attention */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recently Updated */}
        <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 shadow-sm">
          <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-4">
            <h2 className="text-sm font-bold text-zinc-900 dark:text-white">
              Recently Updated
            </h2>
            <Link
              href="/admin/knowledge/library"
              className="text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
            >
              전체 보기 &rarr;
            </Link>
          </div>
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800 mt-2">
            {recentlyUpdated.length === 0 ? (
              <p className="py-8 text-center text-xs text-zinc-400">업데이트 내역이 없습니다.</p>
            ) : (
              recentlyUpdated.slice(0, 5).map((item) => (
                <div key={item.id} className="py-3.5 flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/admin/knowledge/${item.id}`}
                      className="text-xs font-bold text-zinc-900 hover:underline dark:text-white block truncate"
                    >
                      {item.title}
                    </Link>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-zinc-500">
                      <span>{item.module || item.category || "General"}</span>
                      <span>&bull;</span>
                      <span>{item.current_version || "v1.0"}</span>
                      <span>&bull;</span>
                      <span>{new Date(item.updated_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  {getTypeBadge(item.type)}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Needs Attention */}
        <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 shadow-sm">
          <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-4">
            <h2 className="text-sm font-bold text-zinc-900 dark:text-white">
              Needs Attention
            </h2>
            <span className="text-xs text-zinc-400 font-semibold">
              {needsAttention.length}건
            </span>
          </div>
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800 mt-2">
            {needsAttention.length === 0 ? (
              <p className="py-8 text-center text-xs text-zinc-400">확인이 필요한 항목이 없습니다.</p>
            ) : (
              needsAttention.slice(0, 5).map((item) => (
                <div key={item.id} className="py-3.5 flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/admin/knowledge/${item.id}`}
                      className="text-xs font-bold text-zinc-900 hover:underline dark:text-white block truncate"
                    >
                      {item.title}
                    </Link>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-zinc-500">
                      <span className="font-semibold text-amber-600 dark:text-amber-400">
                        {item.status === "DRAFT" ? "작성 중" : item.status === "IN_REVIEW" ? "검토 대기" : "확인 필요"}
                      </span>
                      <span>&bull;</span>
                      <span>{item.module || item.category || "General"}</span>
                    </div>
                  </div>
                  <Link
                    href={`/admin/knowledge/${item.id}`}
                    className="rounded-md bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors shrink-0"
                  >
                    확인
                  </Link>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
