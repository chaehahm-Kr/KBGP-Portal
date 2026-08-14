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
      needsReviewCount: number;
      externalApprovalCount: number;
      outdatedCount: number;
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
        <div className="h-8 w-64 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
        <div className="grid grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-24 bg-zinc-100 dark:bg-zinc-900 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const metrics = data?.metrics || {
    publishedCount: 0,
    draftCount: 0,
    needsReviewCount: 0,
    externalApprovalCount: 0,
    outdatedCount: 0,
    totalCount: 0
  };

  return (
    <div className="space-y-8">
      <KnowledgeNavTabs />
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
              Knowledge Center Overview
            </h1>
            <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-2.5 py-0.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
              Phase 1 Governance Foundation
            </span>
          </div>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Source of Truth governance dashboard for platform Manuals, Policies, SOPs, FAQs & System Rules.
          </p>
        </div>
        <Link
          href="/admin/knowledge/new"
          className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 transition-colors"
        >
          <span>+ Create Knowledge</span>
        </Link>
      </div>

      {/* Metric Cards Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            Published
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-3xl font-bold text-zinc-900 dark:text-white">
              {metrics.publishedCount}
            </span>
            <span className="text-xs text-zinc-500">Source of Truth</span>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Draft
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-3xl font-bold text-zinc-900 dark:text-white">
              {metrics.draftCount}
            </span>
            <span className="text-xs text-zinc-500">In Progress</span>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
            Needs Review
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-3xl font-bold text-zinc-900 dark:text-white">
              {metrics.needsReviewCount}
            </span>
            <span className="text-xs text-zinc-500">Queue Active</span>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
            External Approval
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-3xl font-bold text-zinc-900 dark:text-white">
              {metrics.externalApprovalCount}
            </span>
            <span className="text-xs text-zinc-500">Guard Required</span>
          </div>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-5 dark:border-amber-900/40 dark:bg-amber-950/20 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400">
            Outdated / Impacted
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-3xl font-bold text-rose-600 dark:text-rose-400">
              {metrics.outdatedCount}
            </span>
            <span className="text-xs text-rose-500 font-medium">System Impact</span>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Needs Your Attention List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-500"></span>
              Needs Your Attention
            </h2>
            <Link href="/admin/knowledge/review" className="text-xs font-semibold text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white">
              View Review Queues →
            </Link>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 divide-y divide-zinc-100 dark:divide-zinc-900 shadow-sm overflow-hidden">
            {data?.needsAttention && data.needsAttention.length > 0 ? (
              data.needsAttention.map((item) => (
                <div key={item.id} className="p-4 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="rounded px-2 py-0.5 text-[10px] font-bold bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
                        {item.type}
                      </span>
                      {item.system_impact_status === "POTENTIALLY_OUTDATED" && (
                        <span className="rounded px-2 py-0.5 text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                          SYSTEM CHANGE IMPACT
                        </span>
                      )}
                      {item.external_review_status === "REQUESTED" && (
                        <span className="rounded px-2 py-0.5 text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                          APPROVAL PENDING
                        </span>
                      )}
                      {item.is_sensitive_internal && (
                        <span className="rounded px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                          SENSITIVE INTERNAL
                        </span>
                      )}
                    </div>
                    <Link
                      href={`/admin/knowledge/${item.id}`}
                      className="text-sm font-semibold text-zinc-900 dark:text-white hover:underline block"
                    >
                      {item.title_ko || item.title}
                    </Link>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-1">
                      {item.system_impact_reason || item.summary_ko || item.summary_en || "Requires review"}
                    </p>
                  </div>
                  <Link
                    href={`/admin/knowledge/${item.id}`}
                    className="shrink-0 rounded border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900"
                  >
                    Review
                  </Link>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-sm text-zinc-500">
                ✨ No items currently require immediate attention!
              </div>
            )}
          </div>
        </div>

        {/* Recently Updated Column */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
              Recently Updated
            </h2>
            <Link href="/admin/knowledge/library" className="text-xs font-semibold text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white">
              View All Library →
            </Link>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 divide-y divide-zinc-100 dark:divide-zinc-900 shadow-sm overflow-hidden">
            {data?.recentlyUpdated && data.recentlyUpdated.length > 0 ? (
              data.recentlyUpdated.map((item) => (
                <Link
                  key={item.id}
                  href={`/admin/knowledge/${item.id}`}
                  className="p-4 block hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors"
                >
                  <div className="flex items-center justify-between text-xs text-zinc-500 mb-1">
                    <span className="font-semibold text-zinc-700 dark:text-zinc-300">{item.current_version}</span>
                    <span>{new Date(item.updated_at).toLocaleDateString()}</span>
                  </div>
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-white line-clamp-1">
                    {item.title_ko || item.title}
                  </h3>
                  <div className="mt-2 flex items-center gap-1.5">
                    {item.audience.map((aud) => (
                      <span
                        key={aud}
                        className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                          aud === "INTERNAL"
                            ? "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                            : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                        }`}
                      >
                        {aud}
                      </span>
                    ))}
                  </div>
                </Link>
              ))
            ) : (
              <div className="p-8 text-center text-sm text-zinc-500">
                No recent updates found.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
