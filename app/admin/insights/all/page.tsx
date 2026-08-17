"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { PlusIcon, SearchIcon } from "@/components/admin/icons";
import InsightPreviewModal from "@/components/admin/insights/insight-preview-modal";

export default function AllInsightsPage() {
  const [articles, setArticles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Filter States
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [channelFilter, setChannelFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("latest");

  // Modal State
  const [selectedArticle, setSelectedArticle] = useState<any>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const fetchArticles = async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      params.set("mode", "all");
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (channelFilter !== "ALL") params.set("channel", channelFilter);
      if (categoryFilter !== "ALL") params.set("category", categoryFilter);
      if (searchQuery.trim()) params.set("search", searchQuery.trim());
      params.set("sortBy", sortBy);

      const res = await fetch(`/api/admin/insights?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setArticles(data.articles || []);
      }
    } catch (e) {
      console.error("Failed to fetch articles:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchArticles();
  }, [statusFilter, channelFilter, categoryFilter, sortBy]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchArticles();
  };

  const handleArchive = async (id: string) => {
    if (!confirm("Archive this insight article? Existing public URLs will be retired.")) return;
    try {
      const res = await fetch(`/api/admin/insights/${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchArticles();
      }
    } catch (e) {
      alert("Failed to archive article.");
    }
  };

  const handleCreateNewDraft = async () => {
    try {
      const res = await fetch("/api/admin/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "New Core Research Insight Draft",
          category: "U.S. MARKET ENTRY",
          status: "AI_DRAFT"
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.article?.id) {
          window.location.href = `/admin/insights/${data.article.id}`;
        }
      }
    } catch (e) {
      alert("Failed to create new draft.");
    }
  };

  return (
    <div className="w-full space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-6">
        <div>
          <span className="text-xs font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-widest">
            Editorial Management
          </span>
          <h1 className="text-2xl md:text-3xl font-extrabold text-zinc-900 dark:text-white mt-1">
            All Insights Repository
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            Full directory of core insights across AI drafts, in-review, approved, and published channels.
          </p>
        </div>

        <button
          onClick={handleCreateNewDraft}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow hover:bg-blue-700 transition-all self-start sm:self-auto shrink-0"
        >
          <PlusIcon size={16} />
          <span>Add New Insight</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="w-full rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-col lg:flex-row items-center gap-3">
          
          {/* Search Input */}
          <div className="relative flex-1 w-full">
            <SearchIcon size={16} className="absolute left-3 top-2.5 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title, slug, or keyword..."
              className="w-full rounded-lg border border-zinc-300 bg-zinc-50/50 pl-9 pr-4 py-1.5 text-xs text-zinc-900 focus:bg-white dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full lg:w-auto rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
          >
            <option value="ALL">All Statuses</option>
            <option value="AI_DRAFT">AI_DRAFT</option>
            <option value="IN_REVIEW">IN_REVIEW</option>
            <option value="REVISION_REQUESTED">REVISION_REQUESTED</option>
            <option value="APPROVED">APPROVED</option>
            <option value="SCHEDULED">SCHEDULED</option>
            <option value="PUBLISHED">PUBLISHED</option>
            <option value="ARCHIVED">ARCHIVED</option>
          </select>

          {/* Channel Filter */}
          <select
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
            className="w-full lg:w-auto rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
          >
            <option value="ALL">All Channels</option>
            <option value="K_SELECT_NETWORK">K SELECT NETWORK</option>
            <option value="K_SELECT_HUB">K SELECT HUB</option>
          </select>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full lg:w-auto rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
          >
            <option value="ALL">All Categories</option>
            <option value="U.S. MARKET ENTRY">U.S. MARKET ENTRY</option>
            <option value="RETAIL TRENDS">RETAIL TRENDS</option>
            <option value="CONSUMER INSIGHTS">CONSUMER INSIGHTS</option>
            <option value="COMPLIANCE & LEGAL">COMPLIANCE & LEGAL</option>
          </select>

          {/* Sort By */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="w-full lg:w-auto rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
          >
            <option value="latest">Sort: Latest First</option>
            <option value="oldest">Sort: Oldest First</option>
            <option value="score">Sort: Topic Score</option>
            <option value="reviewPriority">Sort: Review Priority</option>
          </select>

          <button
            type="submit"
            className="w-full lg:w-auto rounded-lg bg-zinc-900 px-4 py-1.5 text-xs font-bold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 shrink-0"
          >
            Search
          </button>
        </form>
      </div>

      {/* Table */}
      <div className="w-full rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-sm text-zinc-500">Fetching insight directory...</div>
        ) : articles.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <h3 className="text-base font-bold text-zinc-900 dark:text-white">No articles match your criteria</h3>
            <p className="text-xs text-zinc-500">Try clearing filters or search query.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-zinc-200 bg-zinc-50 font-semibold text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400">
                <tr>
                  <th className="px-5 py-3.5">Insight Title</th>
                  <th className="px-4 py-3.5">Category</th>
                  <th className="px-3 py-3.5">Status</th>
                  <th className="px-3 py-3.5">Topic Score</th>
                  <th className="px-4 py-3.5">Reader Feedback</th>
                  <th className="px-4 py-3.5">Publish Channels</th>
                  <th className="px-4 py-3.5">Author</th>
                  <th className="px-4 py-3.5">Publish / Gen Date</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-zinc-800 dark:text-zinc-200">
                {articles.map((art: any) => (
                  <tr key={art.id} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-900/40">
                    
                    {/* Title */}
                    <td className="px-5 py-4 max-w-sm">
                      <div className="font-bold text-zinc-900 dark:text-white line-clamp-1">
                        {art.title_ko || art.title}
                      </div>
                      <div className="text-[11px] text-zinc-400 line-clamp-1 mt-0.5">
                        /{art.slug}
                      </div>
                    </td>

                    {/* Category */}
                    <td className="px-4 py-4 font-semibold text-zinc-700 dark:text-zinc-300">
                      {art.category}
                    </td>

                    {/* Status */}
                    <td className="px-3 py-4">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-extrabold ${
                        art.status === "PUBLISHED" ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-950" :
                        art.status === "APPROVED" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" :
                        art.status === "REVISION_REQUESTED" ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300" :
                        art.status === "IN_REVIEW" ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" :
                        "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                      }`}>
                        {art.status}
                      </span>
                    </td>

                    {/* Topic Score */}
                    <td className="px-3 py-4 font-extrabold text-blue-600 dark:text-blue-400">
                      {art.topic_score || 85}
                    </td>

                    {/* Reader Feedback */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      {art.feedback_stats && art.feedback_stats.total > 0 ? (
                        <div className="flex items-center gap-1.5 text-[11px] font-bold">
                          <span className="text-emerald-600 dark:text-emerald-400">👍 {art.feedback_stats.helpful}</span>
                          <span className="text-zinc-400">/</span>
                          <span className="text-rose-500">👎 {art.feedback_stats.not_helpful}</span>
                          <span className="ml-1 rounded bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-700 dark:text-zinc-300 font-extrabold">
                            {art.feedback_stats.helpful_rate}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-zinc-400 font-mono">No feedback</span>
                      )}
                    </td>

                    {/* Publish Channels */}
                    <td className="px-4 py-4 text-[11px] text-zinc-600 dark:text-zinc-400">
                      {Array.isArray(art.publish_channels) && art.publish_channels.length > 0
                        ? art.publish_channels.join(", ")
                        : "NETWORK, HUB"}
                    </td>

                    {/* Author */}
                    <td className="px-4 py-4 text-zinc-600 dark:text-zinc-400">
                      {art.author}
                    </td>

                    {/* Date */}
                    <td className="px-4 py-4 text-zinc-400 whitespace-nowrap">
                      {new Date(art.publish_date || art.created_at).toLocaleDateString()}
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center justify-end gap-2 whitespace-nowrap">
                        <button
                          onClick={() => {
                            setSelectedArticle(art);
                            setIsPreviewOpen(true);
                          }}
                          className="rounded-md bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 transition-colors"
                        >
                          Preview
                        </button>
                        <Link
                          href={`/admin/insights/${art.id}`}
                          className="rounded-md bg-blue-600 px-3 py-1 text-xs font-bold text-white hover:bg-blue-700 transition-colors"
                        >
                          Manage
                        </Link>
                        {art.status !== "ARCHIVED" && (
                          <button
                            onClick={() => handleArchive(art.id)}
                            className="rounded-md px-2 py-1 text-xs text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                          >
                            Archive
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
        article={selectedArticle}
      />

    </div>
  );
}
