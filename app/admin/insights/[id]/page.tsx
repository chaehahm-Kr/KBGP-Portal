"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import InsightPreviewModal from "@/components/admin/insights/insight-preview-modal";

export default function InsightEditorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [activeTab, setActiveTab] = useState<"CORE" | "NETWORK" | "HUB" | "VISUALS" | "SOURCES" | "HISTORY">("CORE");
  const [article, setArticle] = useState<any>(null);
  const [revisions, setRevisions] = useState<any[]>([]);
  const [versionHistory, setVersionHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // New Revision Modal
  const [isRevisionModalOpen, setIsRevisionModalOpen] = useState(false);
  const [revisionComment, setRevisionComment] = useState("");
  const [revisionSection, setRevisionSection] = useState("CORE");

  const fetchDetail = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/admin/insights/${id}`);
      if (res.ok) {
        const data = await res.json();
        setArticle(data.article);
        setRevisions(data.revisions || []);
        setVersionHistory(data.versionHistory || []);
      }
    } catch (e) {
      console.error("Failed to load insight detail:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [id]);

  const handleSave = async (overrides?: any) => {
    try {
      setIsSaving(true);
      const payload = {
        ...article,
        ...overrides,
        changed_by: "Editor User",
        change_type: "EDITOR_MODIFIED"
      };

      const res = await fetch(`/api/admin/insights/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        setArticle(data.article);
        fetchDetail();
      } else {
        alert("Failed to save changes.");
      }
    } catch (e) {
      alert("Error saving insight.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!confirm(`Change article status to ${newStatus}?`)) return;
    await handleSave({ status: newStatus });
  };

  const handleAddRevisionRequest = async () => {
    if (!revisionComment.trim()) {
      alert("Please enter a revision request note.");
      return;
    }
    try {
      const res = await fetch(`/api/admin/insights/${id}/revisions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requested_by: "Senior Editor",
          comment: revisionComment.trim(),
          target_section: revisionSection
        })
      });

      if (res.ok) {
        setIsRevisionModalOpen(false);
        setRevisionComment("");
        fetchDetail();
      }
    } catch (e) {
      alert("Error submitting revision request.");
    }
  };

  if (isLoading || !article) {
    return (
      <div className="p-12 text-center text-sm text-zinc-500 max-w-5xl mx-auto">
        Loading insight editor detail...
      </div>
    );
  }

  const topicScoreBreakdown = article.topic_score_breakdown || {
    relevance: 25, actionability: 25, evidence_strength: 20, timeliness: 15, originality: 10, strategic_fit: 5
  };

  const criticalConds = article.critical_conditions || {
    evidence_quality: "PASS", duplicate_check: "PASS", claim_validation: "PASS", audience_relevance: "PASS"
  };

  return (
    <div className="w-full space-y-6">
      
      {/* Top Navigation & Status Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/admin/insights/all" className="text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-white">
              ← Back to Insights Directory
            </Link>
            <span>•</span>
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
              ID: {article.id?.substring(0, 8)}
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-zinc-900 dark:text-white mt-1">
            {article.title_ko || article.title || "Untitled Insight Draft"}
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Slug: /{article.slug}
          </p>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsPreviewOpen(true)}
            className="rounded-lg border border-zinc-300 bg-white px-3.5 py-2 text-xs font-bold text-zinc-800 shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
          >
            Live Preview (KO/EN)
          </button>

          <button
            onClick={() => setIsRevisionModalOpen(true)}
            className="rounded-lg border border-rose-300 bg-rose-50 px-3.5 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300"
          >
            Request Revision
          </button>

          {article.status !== "APPROVED" && (
            <button
              onClick={() => handleStatusChange("APPROVED")}
              className="rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-700"
            >
              Approve Article
            </button>
          )}

          {article.status === "APPROVED" && (
            <button
              onClick={() => handleStatusChange("PUBLISHED")}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-xs font-extrabold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950"
            >
              Publish Channels
            </button>
          )}

          <button
            onClick={() => handleSave()}
            disabled={isSaving}
            className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-blue-700 disabled:opacity-50"
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      {/* Workflow & Channel Status Badges */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950 text-xs">
        <div>
          <span className="text-zinc-400 font-semibold mr-1.5">Article Status:</span>
          <span className="rounded-full bg-blue-100 px-2.5 py-0.5 font-bold text-blue-800 dark:bg-blue-950 dark:text-blue-300">
            {article.status}
          </span>
        </div>

        <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800" />

        <div>
          <span className="text-zinc-400 font-semibold mr-1.5">K SELECT NETWORK:</span>
          <span className={`rounded px-2 py-0.5 font-bold ${
            article.network_publish_status === "PUBLISHED" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
          }`}>
            {article.network_enabled ? (article.network_publish_status || article.status) : "DISABLED"}
          </span>
        </div>

        <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800" />

        <div>
          <span className="text-zinc-400 font-semibold mr-1.5">K SELECT HUB:</span>
          <span className={`rounded px-2 py-0.5 font-bold ${
            article.hub_publish_status === "PUBLISHED" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
          }`}>
            {article.hub_enabled ? (article.hub_publish_status || article.status) : "DISABLED"}
          </span>
        </div>

        <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800" />

        <div>
          <span className="text-zinc-400 font-semibold mr-1.5">Topic Score:</span>
          <span className="font-extrabold text-blue-600 dark:text-blue-400">
            {article.topic_score || 85} / 100
          </span>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-zinc-200 dark:border-zinc-800">
        <nav className="flex space-x-6">
          {[
            { key: "CORE", label: "A. CORE INSIGHT" },
            { key: "NETWORK", label: "B. K SELECT NETWORK" },
            { key: "HUB", label: "C. K SELECT HUB" },
            { key: "VISUALS", label: "D. VISUALS & ANIMATIONS" },
            { key: "SOURCES", label: "E. SOURCES & CLAIMS" },
            { key: "HISTORY", label: "F. REVISIONS & HISTORY" }
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`border-b-2 py-3 text-xs font-bold transition-all ${
                activeTab === tab.key
                  ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                  : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* TAB CONTENTS */}
      <div className="space-y-6">

        {/* TAB A: CORE */}
        {activeTab === "CORE" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left Column: Form Fields */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Titles & Slug */}
              <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 space-y-4">
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white border-b border-zinc-100 dark:border-zinc-800 pb-2">
                  Core Article Information
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Title (Korean KO)
                    </label>
                    <input
                      type="text"
                      value={article.title_ko || article.title || ""}
                      onChange={(e) => setArticle({ ...article, title_ko: e.target.value, title: e.target.value })}
                      className="w-full rounded-md border border-zinc-300 bg-white p-2 text-xs font-medium dark:border-zinc-700 dark:bg-zinc-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Title (English EN)
                    </label>
                    <input
                      type="text"
                      value={article.title_en || ""}
                      onChange={(e) => setArticle({ ...article, title_en: e.target.value })}
                      placeholder="English business title"
                      className="w-full rounded-md border border-zinc-300 bg-white p-2 text-xs font-medium dark:border-zinc-700 dark:bg-zinc-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Subtitle (KO)
                    </label>
                    <input
                      type="text"
                      value={article.subtitle_ko || article.subtitle || ""}
                      onChange={(e) => setArticle({ ...article, subtitle_ko: e.target.value, subtitle: e.target.value })}
                      className="w-full rounded-md border border-zinc-300 bg-white p-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Subtitle (EN)
                    </label>
                    <input
                      type="text"
                      value={article.subtitle_en || ""}
                      onChange={(e) => setArticle({ ...article, subtitle_en: e.target.value })}
                      className="w-full rounded-md border border-zinc-300 bg-white p-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Slug (URL Key)
                  </label>
                  <input
                    type="text"
                    value={article.slug || ""}
                    onChange={(e) => setArticle({ ...article, slug: e.target.value })}
                    className="w-full rounded-md border border-zinc-300 bg-white p-2 text-xs font-mono dark:border-zinc-700 dark:bg-zinc-900"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Category
                    </label>
                    <select
                      value={article.category || "U.S. MARKET ENTRY"}
                      onChange={(e) => setArticle({ ...article, category: e.target.value })}
                      className="w-full rounded-md border border-zinc-300 bg-white p-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                    >
                      <option value="U.S. MARKET ENTRY">U.S. MARKET ENTRY</option>
                      <option value="RETAIL TRENDS">RETAIL TRENDS</option>
                      <option value="CONSUMER INSIGHTS">CONSUMER INSIGHTS</option>
                      <option value="COMPLIANCE & LEGAL">COMPLIANCE & LEGAL</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Content Type
                    </label>
                    <input
                      type="text"
                      value={article.content_type || "MARKET_INTELLIGENCE"}
                      onChange={(e) => setArticle({ ...article, content_type: e.target.value })}
                      className="w-full rounded-md border border-zinc-300 bg-white p-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Author
                    </label>
                    <input
                      type="text"
                      value={article.author || "Compliance Operations Team"}
                      onChange={(e) => setArticle({ ...article, author: e.target.value })}
                      className="w-full rounded-md border border-zinc-300 bg-white p-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                    />
                  </div>
                </div>

                {/* Core Summaries */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Core Executive Summary (KO)
                    </label>
                    <textarea
                      value={article.summary_ko || article.excerpt || ""}
                      onChange={(e) => setArticle({ ...article, summary_ko: e.target.value, excerpt: e.target.value })}
                      rows={3}
                      className="w-full rounded-md border border-zinc-300 bg-white p-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Core Executive Summary (EN)
                    </label>
                    <textarea
                      value={article.summary_en || ""}
                      onChange={(e) => setArticle({ ...article, summary_en: e.target.value })}
                      rows={3}
                      className="w-full rounded-md border border-zinc-300 bg-white p-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                    />
                  </div>
                </div>
              </div>

            </div>

            {/* Right Column: Score Breakdown & Critical Conditions */}
            <div className="space-y-6">
              
              {/* Critical Conditions Check Results */}
              <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-white">
                  Critical Conditions Audit
                </h4>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-600 dark:text-zinc-400">Evidence Quality</span>
                    <span className="rounded bg-emerald-100 px-2 py-0.5 font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      {criticalConds.evidence_quality || "PASS"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-600 dark:text-zinc-400">Duplicate Check</span>
                    <span className="rounded bg-emerald-100 px-2 py-0.5 font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      {criticalConds.duplicate_check || "PASS"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-600 dark:text-zinc-400">Claim Validation</span>
                    <span className="rounded bg-emerald-100 px-2 py-0.5 font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      {criticalConds.claim_validation || "PASS"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-600 dark:text-zinc-400">Audience Relevance</span>
                    <span className="rounded bg-emerald-100 px-2 py-0.5 font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      {criticalConds.audience_relevance || "PASS"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Topic Score Breakdown */}
              <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-white">
                    Topic Score Weightings
                  </h4>
                  <span className="text-sm font-black text-blue-600 dark:text-blue-400">
                    {article.topic_score || 85} / 100
                  </span>
                </div>
                <div className="space-y-2 text-xs">
                  <div>
                    <div className="flex justify-between text-[11px] text-zinc-500 mb-0.5">
                      <span>Relevance (Max 25)</span>
                      <span>{topicScoreBreakdown.relevance || 25}</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                      <div className="h-full bg-blue-600" style={{ width: `${((topicScoreBreakdown.relevance || 25)/25)*100}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] text-zinc-500 mb-0.5">
                      <span>Actionability (Max 25)</span>
                      <span>{topicScoreBreakdown.actionability || 25}</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                      <div className="h-full bg-blue-600" style={{ width: `${((topicScoreBreakdown.actionability || 25)/25)*100}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] text-zinc-500 mb-0.5">
                      <span>Evidence Strength (Max 20)</span>
                      <span>{topicScoreBreakdown.evidence_strength || 20}</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                      <div className="h-full bg-blue-600" style={{ width: `${((topicScoreBreakdown.evidence_strength || 20)/20)*100}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] text-zinc-500 mb-0.5">
                      <span>Timeliness (Max 15)</span>
                      <span>{topicScoreBreakdown.timeliness || 15}</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                      <div className="h-full bg-blue-600" style={{ width: `${((topicScoreBreakdown.timeliness || 15)/15)*100}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] text-zinc-500 mb-0.5">
                      <span>Originality (Max 10)</span>
                      <span>{topicScoreBreakdown.originality || 10}</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                      <div className="h-full bg-blue-600" style={{ width: `${((topicScoreBreakdown.originality || 10)/10)*100}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] text-zinc-500 mb-0.5">
                      <span>Strategic Fit (Max 5)</span>
                      <span>{topicScoreBreakdown.strategic_fit || 5}</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                      <div className="h-full bg-blue-600" style={{ width: `${((topicScoreBreakdown.strategic_fit || 5)/5)*100}%` }} />
                    </div>
                  </div>
                </div>
              </div>

            </div>

          </div>
        )}

        {/* TAB B: K SELECT NETWORK */}
        {activeTab === "NETWORK" && (
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 space-y-6">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-4">
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                  K SELECT NETWORK Version (Target: K-Beauty Brands)
                </h3>
                <p className="text-xs text-zinc-500">
                  Customized for Korean cosmetics manufacturers, brand leaders, and exporters.
                </p>
              </div>
              <label className="flex items-center gap-2 text-xs font-bold text-zinc-700 dark:text-zinc-300">
                <span>NETWORK Enabled:</span>
                <input
                  type="checkbox"
                  checked={article.network_enabled !== false}
                  onChange={(e) => setArticle({ ...article, network_enabled: e.target.checked })}
                  className="h-4 w-4 rounded border-zinc-300"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Brand Takeaway (Korean KO)
                </label>
                <textarea
                  value={article.network_brand_takeaway_ko || article.brand_takeaway || ""}
                  onChange={(e) => setArticle({ ...article, network_brand_takeaway_ko: e.target.value, brand_takeaway: e.target.value })}
                  rows={4}
                  className="w-full rounded-md border border-zinc-300 bg-white p-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Brand Takeaway (English EN)
                </label>
                <textarea
                  value={article.network_brand_takeaway_en || ""}
                  onChange={(e) => setArticle({ ...article, network_brand_takeaway_en: e.target.value })}
                  rows={4}
                  className="w-full rounded-md border border-zinc-300 bg-white p-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  U.S. Market Implication (KO)
                </label>
                <textarea
                  value={article.network_implication_ko || ""}
                  onChange={(e) => setArticle({ ...article, network_implication_ko: e.target.value })}
                  rows={3}
                  className="w-full rounded-md border border-zinc-300 bg-white p-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  U.S. Market Implication (EN)
                </label>
                <textarea
                  value={article.network_implication_en || ""}
                  onChange={(e) => setArticle({ ...article, network_implication_en: e.target.value })}
                  rows={3}
                  className="w-full rounded-md border border-zinc-300 bg-white p-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                />
              </div>
            </div>

          </div>
        )}

        {/* TAB C: K SELECT HUB */}
        {activeTab === "HUB" && (
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 space-y-6">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-4">
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                  K SELECT HUB Version (Target: U.S. Retailers)
                </h3>
                <p className="text-xs text-zinc-500">
                  Customized for Independent Beauty Supply Retailers and buyers in the U.S.
                </p>
              </div>
              <label className="flex items-center gap-2 text-xs font-bold text-zinc-700 dark:text-zinc-300">
                <span>HUB Enabled:</span>
                <input
                  type="checkbox"
                  checked={article.hub_enabled !== false}
                  onChange={(e) => setArticle({ ...article, hub_enabled: e.target.checked })}
                  className="h-4 w-4 rounded border-zinc-300"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Retailer Takeaway (Korean KO)
                </label>
                <textarea
                  value={article.hub_retailer_takeaway_ko || ""}
                  onChange={(e) => setArticle({ ...article, hub_retailer_takeaway_ko: e.target.value })}
                  rows={4}
                  className="w-full rounded-md border border-zinc-300 bg-white p-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Retailer Takeaway (English EN)
                </label>
                <textarea
                  value={article.hub_retailer_takeaway_en || article.retailer_takeaway || ""}
                  onChange={(e) => setArticle({ ...article, hub_retailer_takeaway_en: e.target.value, retailer_takeaway: e.target.value })}
                  rows={4}
                  className="w-full rounded-md border border-zinc-300 bg-white p-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Product / Category Opportunity (KO)
                </label>
                <textarea
                  value={article.hub_opportunity_ko || ""}
                  onChange={(e) => setArticle({ ...article, hub_opportunity_ko: e.target.value })}
                  rows={3}
                  className="w-full rounded-md border border-zinc-300 bg-white p-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Product / Category Opportunity (EN)
                </label>
                <textarea
                  value={article.hub_opportunity_en || ""}
                  onChange={(e) => setArticle({ ...article, hub_opportunity_en: e.target.value })}
                  rows={3}
                  className="w-full rounded-md border border-zinc-300 bg-white p-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                />
              </div>
            </div>

          </div>
        )}

        {/* TAB D: VISUALS & ANIMATIONS */}
        {activeTab === "VISUALS" && (
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 space-y-6">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-4">
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                  Visual Assets & Motion Animation Management
                </h3>
                <p className="text-xs text-zinc-500">
                  Manage hero images, infographics, data charts, and animation presets. Visual status operates independently of content status.
                </p>
              </div>
              <span className={`rounded px-2.5 py-1 text-xs font-bold ${
                article.visual_status === "APPROVED" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-amber-100 text-amber-800"
              }`}>
                Visual Status: {article.visual_status || "APPROVED"}
              </span>
            </div>

            {/* Hero Image */}
            <div className="space-y-3">
              <label className="block text-xs font-bold text-zinc-900 dark:text-white">
                Hero Image URL
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={article.hero_image || ""}
                  onChange={(e) => setArticle({ ...article, hero_image: e.target.value })}
                  className="flex-1 rounded-md border border-zinc-300 bg-white p-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                />
              </div>

              {article.hero_image && (
                <div className="h-40 w-72 rounded-lg bg-zinc-100 overflow-hidden border border-zinc-200 dark:border-zinc-800">
                  <img src={article.hero_image} alt="Hero preview" className="w-full h-full object-cover" />
                </div>
              )}
            </div>

            {/* Asset List */}
            <div className="space-y-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
              <h4 className="text-xs font-bold text-zinc-900 dark:text-white">
                Supporting Visual Assets & Charts
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(article.visuals || [
                  { asset_id: "v-1", asset_type: "HERO", source_type: "AI_GENERATED", status: "APPROVED", preview_url: article.hero_image }
                ]).map((v: any, idx: number) => (
                  <div key={idx} className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50 flex items-center gap-4">
                    <div className="h-16 w-16 rounded bg-zinc-200 dark:bg-zinc-800 overflow-hidden shrink-0">
                      {v.preview_url ? <img src={v.preview_url} alt="asset" className="w-full h-full object-cover" /> : <div className="h-full flex items-center justify-center text-[10px] text-zinc-400">No Img</div>}
                    </div>
                    <div className="flex-1 text-xs space-y-1">
                      <div className="flex items-center justify-between font-bold">
                        <span>{v.asset_type || "SUPPORTING"}</span>
                        <span className="text-[10px] text-emerald-600 font-bold">{v.status || "APPROVED"}</span>
                      </div>
                      <div className="text-[11px] text-zinc-500">Source: {v.source_type || "AI_GENERATED"}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* TAB E: SOURCES & CLAIMS */}
        {activeTab === "SOURCES" && (
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 space-y-6">
            <div className="border-b border-zinc-100 dark:border-zinc-800 pb-4">
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                Sources & Claim Validation
              </h3>
              <p className="text-xs text-zinc-500">
                Track primary sources, source tiers (A, B, C, SIGNAL), and claim verification statuses.
              </p>
            </div>

            {/* Sources List */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-zinc-900 dark:text-white">
                Registered Sources
              </h4>
              <ul className="space-y-2 text-xs">
                {(article.sources_detail && article.sources_detail.length > 0 ? article.sources_detail : article.sources || []).map((src: any, idx: number) => (
                  <li key={idx} className="rounded-lg border border-zinc-200 p-3 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-zinc-900 dark:text-white">
                        {typeof src === "string" ? src : (src.name || src.title)}
                      </span>
                      {src.url && <div className="text-[11px] text-blue-600">{src.url}</div>}
                    </div>
                    <span className="rounded bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                      Tier {src.tier || "A"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

          </div>
        )}

        {/* TAB F: REVISIONS & HISTORY */}
        {activeTab === "HISTORY" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Revision Request Logs */}
            <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                  Revision Request History ({revisions.length})
                </h3>
                <button
                  onClick={() => setIsRevisionModalOpen(true)}
                  className="rounded bg-rose-600 px-3 py-1 text-xs font-bold text-white hover:bg-rose-700"
                >
                  + Request Revision
                </button>
              </div>

              {revisions.length === 0 ? (
                <p className="text-xs text-zinc-500 italic py-4 text-center">No revision requests submitted yet.</p>
              ) : (
                <div className="space-y-3">
                  {revisions.map((rev: any) => (
                    <div key={rev.id} className="rounded-lg border border-rose-100 bg-rose-50/50 p-4 dark:border-rose-950 dark:bg-rose-950/20 text-xs space-y-1">
                      <div className="flex items-center justify-between font-bold text-zinc-900 dark:text-white">
                        <span>Rev #{rev.revision_number} — {rev.target_section}</span>
                        <span className="text-[10px] text-rose-600 font-bold">{rev.resolution_status}</span>
                      </div>
                      <p className="text-zinc-700 dark:text-zinc-300 font-medium">
                        "{rev.comment}"
                      </p>
                      <div className="text-[10px] text-zinc-400 pt-1">
                        By {rev.requested_by} • {new Date(rev.requested_at || rev.created_at).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Version History Timeline */}
            <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 space-y-4">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white border-b border-zinc-100 dark:border-zinc-800 pb-3">
                Version Snapshot Timeline ({versionHistory.length})
              </h3>

              {versionHistory.length === 0 ? (
                <p className="text-xs text-zinc-500 italic py-4 text-center">V1 Initial version recorded.</p>
              ) : (
                <div className="space-y-3">
                  {versionHistory.map((vh: any) => (
                    <div key={vh.id} className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/50 text-xs space-y-1">
                      <div className="flex items-center justify-between font-bold text-zinc-900 dark:text-white">
                        <span>Version {vh.version_number}</span>
                        <span className="rounded bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                          {vh.change_type}
                        </span>
                      </div>
                      <p className="text-zinc-600 dark:text-zinc-400">
                        {vh.review_note}
                      </p>
                      <div className="text-[10px] text-zinc-400">
                        Changed by {vh.changed_by} • {new Date(vh.changed_at || vh.created_at).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

      </div>

      {/* Live Preview Modal */}
      <InsightPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        article={article}
      />

      {/* Revision Request Modal */}
      {isRevisionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-4">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
              Submit Revision Request
            </h3>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Target Section
              </label>
              <select
                value={revisionSection}
                onChange={(e) => setRevisionSection(e.target.value)}
                className="w-full rounded-md border border-zinc-300 bg-white p-2 text-xs dark:border-zinc-700 dark:bg-zinc-950"
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
                placeholder="Enter feedback for AI/Editor revision..."
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
                onClick={handleAddRevisionRequest}
                className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700"
              >
                Submit Request
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
