"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import InsightPreviewModal from "@/components/admin/insights/insight-preview-modal";

export default function ReviewQueuePage() {
  const [articles, setArticles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedArticle, setSelectedArticle] = useState<any>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  
  // Revision Modal State
  const [isRevisionModalOpen, setIsRevisionModalOpen] = useState(false);
  const [revisionArticleId, setRevisionArticleId] = useState<string | null>(null);
  const [revisionComment, setRevisionComment] = useState("");
  const [revisionSection, setRevisionSection] = useState("CORE");

  const fetchQueueArticles = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/admin/insights?mode=queue");
      if (res.ok) {
        const data = await res.json();
        setArticles(data.articles || []);
      }
    } catch (e) {
      console.error("Failed to load queue articles:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchQueueArticles();
  }, []);

  const handleApprove = async (id: string) => {
    if (!confirm("Approve this insight article?")) return;
    try {
      const res = await fetch(`/api/admin/insights/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "APPROVED", changed_by: "Admin Approver" })
      });
      if (res.ok) {
        fetchQueueArticles();
      }
    } catch (e) {
      alert("Failed to approve article.");
    }
  };

  const handleReject = async (id: string) => {
    if (!confirm("Reject this insight article draft?")) return;
    try {
      const res = await fetch(`/api/admin/insights/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "REJECTED", changed_by: "Reviewer" })
      });
      if (res.ok) {
        fetchQueueArticles();
      }
    } catch (e) {
      alert("Failed to reject article.");
    }
  };

  const submitRevisionRequest = async () => {
    if (!revisionArticleId || !revisionComment.trim()) {
      alert("Please enter a revision request note.");
      return;
    }
    try {
      const res = await fetch(`/api/admin/insights/${revisionArticleId}/revisions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requested_by: "Reviewer Editor",
          comment: revisionComment.trim(),
          target_section: revisionSection
        })
      });

      if (res.ok) {
        setIsRevisionModalOpen(false);
        setRevisionComment("");
        fetchQueueArticles();
      }
    } catch (e) {
      alert("Failed to submit revision request.");
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-6">
        <div>
          <span className="text-xs font-extrabold text-amber-600 dark:text-amber-400 uppercase tracking-widest">
            Editorial Pipeline
          </span>
          <h1 className="text-2xl md:text-3xl font-extrabold text-zinc-900 dark:text-white mt-1">
            Review Queue
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            Priority queue for AI drafts, in-review insights, revision requests, and items awaiting final human approval.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchQueueArticles}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
          >
            Refresh Queue
          </button>
        </div>
      </div>

      {/* Queue Table */}
      <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-sm text-zinc-500">Loading queue items...</div>
        ) : articles.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <h3 className="text-base font-bold text-zinc-900 dark:text-white">Queue Empty! 🎉</h3>
            <p className="text-xs text-zinc-500">All pending AI drafts and revision requests have been processed.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-zinc-200 bg-zinc-50 font-semibold text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400">
                <tr>
                  <th className="px-5 py-3.5">Title & Info</th>
                  <th className="px-4 py-3.5">Gen Date</th>
                  <th className="px-3 py-3.5">Lang</th>
                  <th className="px-4 py-3.5">Category</th>
                  <th className="px-3 py-3.5">Suitability</th>
                  <th className="px-3 py-3.5">Topic Score</th>
                  <th className="px-3 py-3.5">Confidence</th>
                  <th className="px-3 py-3.5">Visuals</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-zinc-800 dark:text-zinc-200">
                {articles.map((art: any) => (
                  <tr key={art.id} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-900/40">
                    
                    {/* Title & Info */}
                    <td className="px-5 py-4 max-w-xs">
                      <div className="font-bold text-zinc-900 dark:text-white line-clamp-1">
                        {art.title_ko || art.title}
                      </div>
                      <div className="text-[11px] text-zinc-400 mt-0.5 flex items-center gap-2">
                        <span>Reviewer: {art.reviewer_name || "Unassigned"}</span>
                        <span>•</span>
                        <span>Sources: {art.source_count || (art.sources?.length || 0)}</span>
                      </div>
                    </td>

                    {/* Gen Date */}
                    <td className="px-4 py-4 text-zinc-500 whitespace-nowrap">
                      {new Date(art.generated_date || art.created_at).toLocaleDateString()}
                    </td>

                    {/* Primary Language */}
                    <td className="px-3 py-4">
                      <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-extrabold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                        {art.primary_language || "KO"}
                      </span>
                    </td>

                    {/* Category */}
                    <td className="px-4 py-4 font-semibold text-zinc-700 dark:text-zinc-300">
                      {art.category}
                    </td>

                    {/* Suitability */}
                    <td className="px-3 py-4 text-[11px]">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-amber-600 dark:text-amber-400 font-semibold">
                          NET: {art.network_suitability || "HIGH"}
                        </span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                          HUB: {art.hub_suitability || "HIGH"}
                        </span>
                      </div>
                    </td>

                    {/* Topic Score */}
                    <td className="px-3 py-4 font-extrabold text-blue-600 dark:text-blue-400">
                      {art.topic_score || 85}/100
                    </td>

                    {/* Confidence */}
                    <td className="px-3 py-4 font-semibold text-zinc-600 dark:text-zinc-400">
                      {art.analysis_confidence || 85}%
                    </td>

                    {/* Visual Status */}
                    <td className="px-3 py-4">
                      <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold ${
                        art.visual_status === "APPROVED" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" :
                        art.visual_status === "FAILED" ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300" :
                        "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                      }`}>
                        {art.visual_status || "APPROVED"}
                      </span>
                    </td>

                    {/* Current Status */}
                    <td className="px-4 py-4">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-black ${
                        art.status === "REVISION_REQUESTED" ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300" :
                        art.status === "IN_REVIEW" ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" :
                        art.status === "APPROVED" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" :
                        "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                      }`}>
                        {art.status}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => {
                            setSelectedArticle(art);
                            setIsPreviewOpen(true);
                          }}
                          className="rounded bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
                        >
                          Preview
                        </button>

                        <Link
                          href={`/admin/insights/${art.id}`}
                          className="rounded bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-300"
                        >
                          Review
                        </Link>

                        <button
                          onClick={() => {
                            setRevisionArticleId(art.id);
                            setIsRevisionModalOpen(true);
                          }}
                          className="rounded bg-rose-50 px-2 py-1 text-xs font-bold text-rose-700 hover:bg-rose-100 dark:bg-rose-950 dark:text-rose-300"
                        >
                          Revise
                        </button>

                        <button
                          onClick={() => handleApprove(art.id)}
                          className="rounded bg-emerald-600 px-2 py-1 text-xs font-bold text-white hover:bg-emerald-700"
                        >
                          Approve
                        </button>

                        <button
                          onClick={() => handleReject(art.id)}
                          className="rounded px-1.5 py-1 text-xs text-zinc-400 hover:text-rose-600"
                        >
                          Reject
                        </button>
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
        article={selectedArticle}
      />

      {/* Revision Request Modal */}
      {isRevisionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-4">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
              Request Revision
            </h3>
            <p className="text-xs text-zinc-500">
              Provide feedback note for AI/Editor revision engine. Status will move to <strong>REVISION_REQUESTED</strong>.
            </p>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Target Section
              </label>
              <select
                value={revisionSection}
                onChange={(e) => setRevisionSection(e.target.value)}
                className="w-full rounded-md border border-zinc-300 bg-white p-2 text-xs font-medium dark:border-zinc-700 dark:bg-zinc-950"
              >
                <option value="CORE">CORE (Title, Summary, Body)</option>
                <option value="NETWORK">K SELECT NETWORK (Brand Action)</option>
                <option value="HUB">K SELECT HUB (Retailer Action)</option>
                <option value="VISUALS">VISUALS & ANIMATION</option>
                <option value="SOURCES">SOURCES & CLAIMS</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Revision Feedback Comment
              </label>
              <textarea
                value={revisionComment}
                onChange={(e) => setRevisionComment(e.target.value)}
                rows={4}
                placeholder="e.g. Retailer Action is too generic. Specify actions for Independent Beauty Supply Store owners in the U.S."
                className="w-full rounded-md border border-zinc-300 bg-white p-2 text-xs dark:border-zinc-700 dark:bg-zinc-950"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setIsRevisionModalOpen(false)}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-xs font-semibold text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
              >
                Cancel
              </button>
              <button
                onClick={submitRevisionRequest}
                className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700"
              >
                Submit Revision Request
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
