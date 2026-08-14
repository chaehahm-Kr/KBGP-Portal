"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { PlusIcon, SearchIcon, ChevronRightIcon } from "@/components/admin/icons";
import InsightPreviewModal from "@/components/admin/insights/insight-preview-modal";

export default function InsightsOverviewPage() {
  const [metrics, setMetrics] = useState<any>({
    aiDraftsToday: 0,
    awaitingReview: 0,
    revisionRequested: 0,
    approved: 0,
    scheduled: 0,
    published: 0,
    failedNeedsAttention: 0,
    totalCount: 0
  });

  const [pipelineStages, setPipelineStages] = useState<any[]>([]);
  const [recentArticles, setRecentArticles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [previewArticle, setPreviewArticle] = useState<any>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const fetchOverviewData = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/admin/insights?mode=overview");
      if (res.ok) {
        const data = await res.json();
        setMetrics(data.metrics || {});
        setPipelineStages(data.pipelineStages || []);
        setRecentArticles(data.articles || []);
      }
    } catch (err) {
      console.error("Failed to load insights overview:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOverviewData();
  }, []);

  const handleApprove = async (id: string) => {
    if (!confirm("Approve this insight for publishing?")) return;
    try {
      const res = await fetch(`/api/admin/insights/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "APPROVED", changed_by: "Admin Approver" })
      });
      if (res.ok) {
        fetchOverviewData();
      }
    } catch (e) {
      alert("Failed to approve insight.");
    }
  };

  return (
    <div className="w-full space-y-8">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-widest">
              Editorial Control Center
            </span>
            <span className="rounded bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800 dark:bg-blue-950 dark:text-blue-300">
              V1
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-zinc-900 dark:text-white mt-1">
            Insights Overview
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            Monitor AI research drafts, editorial review queues, channel assignments, and daily publish pipelines.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/admin/insights/queue"
            className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-xs font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Go to Review Queue ({metrics.awaitingReview + metrics.revisionRequested})
          </Link>
          <Link
            href="/admin/insights/all"
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-blue-700 transition-all"
          >
            <PlusIcon size={16} />
            <span>Add New Insight</span>
          </Link>
        </div>
      </div>

      {/* Top 7 Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
            AI Drafts Today
          </span>
          <div className="mt-2 text-2xl font-black text-blue-600 dark:text-blue-400">
            {metrics.aiDraftsToday}
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
            Awaiting Review
          </span>
          <div className="mt-2 text-2xl font-black text-amber-600 dark:text-amber-400">
            {metrics.awaitingReview}
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
            Revision Requested
          </span>
          <div className="mt-2 text-2xl font-black text-rose-600 dark:text-rose-400">
            {metrics.revisionRequested}
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
            Approved
          </span>
          <div className="mt-2 text-2xl font-black text-emerald-600 dark:text-emerald-400">
            {metrics.approved}
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
            Scheduled
          </span>
          <div className="mt-2 text-2xl font-black text-indigo-600 dark:text-indigo-400">
            {metrics.scheduled}
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
            Published
          </span>
          <div className="mt-2 text-2xl font-black text-zinc-900 dark:text-white">
            {metrics.published}
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
            Needs Attention
          </span>
          <div className="mt-2 text-2xl font-black text-zinc-500 dark:text-zinc-400">
            {metrics.failedNeedsAttention}
          </div>
        </div>
      </div>

      {/* Today's Insight Pipeline */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-zinc-900 dark:text-white">
              Today's Insight Pipeline
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              End-to-end automated research & human editorial validation workflow
            </p>
          </div>
          <span className="text-xs font-semibold text-zinc-400">
            Daily Auto-Run: 05:00 AM ET (Active)
          </span>
        </div>

        {/* Pipeline Step Visualizer */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2 pt-2">
          {pipelineStages.map((stage: any, idx: number) => {
            const isLast = idx === pipelineStages.length - 1;
            return (
              <div
                key={stage.name}
                className="relative flex flex-col justify-between rounded-xl border border-zinc-200 bg-zinc-50/50 p-3 dark:border-zinc-800 dark:bg-zinc-900/50"
              >
                <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                  <span>{idx + 1}. {stage.name}</span>
                  {!isLast && <ChevronRightIcon size={12} className="hidden lg:block text-zinc-300 dark:text-zinc-700" />}
                </div>
                <div className="mt-3 flex items-baseline justify-between">
                  <span className="text-lg font-black text-zinc-900 dark:text-white">
                    {stage.count}
                  </span>
                  <span className={`h-2 w-2 rounded-full ${
                    stage.status === "warning" ? "bg-rose-500 animate-pulse" : stage.count > 0 ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-700"
                  }`} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Editorial Activity Table */}
      <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950 overflow-hidden">
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <div>
            <h3 className="text-base font-bold text-zinc-900 dark:text-white">
              Recent Insight Articles
            </h3>
            <p className="text-xs text-zinc-500">
              Showing active articles requiring review or recently published
            </p>
          </div>
          <Link
            href="/admin/insights/all"
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400"
          >
            View All ({recentArticles.length}) →
          </Link>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-sm text-zinc-500">Loading insight pipeline...</div>
        ) : recentArticles.length === 0 ? (
          <div className="p-8 text-center text-sm text-zinc-500">No insight articles found. Click "Add New Insight" to create one.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-zinc-200 bg-zinc-50 font-semibold text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400">
                <tr>
                  <th className="px-6 py-3">Title</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Topic Score</th>
                  <th className="px-4 py-3">Channels</th>
                  <th className="px-4 py-3">Last Updated</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-zinc-800 dark:text-zinc-200">
                {recentArticles.slice(0, 8).map((art: any) => (
                  <tr key={art.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/40">
                    <td className="px-6 py-4">
                      <div className="font-bold text-zinc-900 dark:text-white line-clamp-1">
                        {art.title_ko || art.title}
                      </div>
                      <div className="text-[11px] text-zinc-400 line-clamp-1">
                        {art.slug}
                      </div>
                    </td>
                    <td className="px-4 py-4 font-medium text-zinc-600 dark:text-zinc-400">
                      {art.category}
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        art.status === "PUBLISHED" ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-950" :
                        art.status === "APPROVED" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" :
                        art.status === "REVISION_REQUESTED" ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300" :
                        art.status === "IN_REVIEW" ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" :
                        "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                      }`}>
                        {art.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 font-bold text-blue-600 dark:text-blue-400">
                      {art.topic_score || 85} / 100
                    </td>
                    <td className="px-4 py-4 text-[11px] text-zinc-500">
                      {Array.isArray(art.publish_channels) && art.publish_channels.length > 0
                        ? art.publish_channels.join(", ")
                        : "NETWORK, HUB"}
                    </td>
                    <td className="px-4 py-4 text-zinc-400">
                      {new Date(art.updated_at || art.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setPreviewArticle(art);
                            setIsPreviewOpen(true);
                          }}
                          className="rounded px-2 py-1 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                        >
                          Preview
                        </button>
                        <Link
                          href={`/admin/insights/${art.id}`}
                          className="rounded bg-zinc-100 px-2.5 py-1 text-xs font-bold text-zinc-900 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-white dark:hover:bg-zinc-700"
                        >
                          Edit
                        </Link>
                        {art.status !== "APPROVED" && art.status !== "PUBLISHED" && (
                          <button
                            onClick={() => handleApprove(art.id)}
                            className="rounded bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-emerald-700"
                          >
                            Approve
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Live Preview Modal */}
      <InsightPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        article={previewArticle}
      />
    </div>
  );
}
