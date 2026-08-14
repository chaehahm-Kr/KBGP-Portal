"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { KnowledgeItem } from "@/lib/knowledge/types";
import KnowledgeNavTabs from "./knowledge-nav-tabs";

export default function LibraryView() {
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [audienceFilter, setAudienceFilter] = useState("ALL");
  const [moduleFilter, setModuleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [langFilter, setLangFilter] = useState("ALL");

  const [suggestionNotice, setSuggestionNotice] = useState<string | null>(null);

  useEffect(() => {
    fetchLibrary();
  }, [typeFilter, audienceFilter, moduleFilter, statusFilter, langFilter, search]);

  const fetchLibrary = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (typeFilter !== "ALL") params.set("type", typeFilter);
      if (audienceFilter !== "ALL") params.set("audience", audienceFilter);
      if (moduleFilter !== "ALL") params.set("module", moduleFilter);
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (langFilter !== "ALL") params.set("language", langFilter);
      if (search.trim()) params.set("search", search.trim());

      const res = await fetch(`/api/admin/knowledge?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setItems(json.items || []);
        setSuggestionNotice(json.suggestionNotice || null);
      }
    } catch (e) {
      console.error("Failed to fetch library:", e);
    } finally {
      setLoading(false);
    }
  };

  const clearAllFilters = () => {
    setSearch("");
    setTypeFilter("ALL");
    setAudienceFilter("ALL");
    setModuleFilter("ALL");
    setStatusFilter("ALL");
    setLangFilter("ALL");
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PUBLISHED":
        return <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">PUBLISHED</span>;
      case "DRAFT":
        return <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">DRAFT</span>;
      case "IN_REVIEW":
        return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300">IN REVIEW</span>;
      case "SUPERSEDED":
        return <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-semibold text-zinc-500 line-through dark:bg-zinc-800 dark:text-zinc-500">SUPERSEDED</span>;
      case "ARCHIVED":
        return <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700 dark:bg-rose-950 dark:text-rose-400">ARCHIVED</span>;
      default:
        return <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-700">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      <KnowledgeNavTabs />
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
            Knowledge Library
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Central repository for all K SELECT Manuals, Policies, SOPs, FAQs, System Rules, Definitions & Guides.
          </p>
        </div>
        <Link
          href="/admin/knowledge/new"
          className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 transition-colors"
        >
          <span>+ Create Knowledge</span>
        </Link>
      </div>

      {/* Search Bar */}
      <div className="space-y-2">
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search knowledge, policies, manuals, FAQs (e.g. 인사이트, 매뉴얼, SOP)..."
            className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 pl-11 text-sm text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white dark:placeholder-zinc-500"
          />
          <svg
            className="absolute left-4 top-3.5 h-4 w-4 text-zinc-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {suggestionNotice && (
          <div className="px-3.5 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
            <span>💡</span>
            <span>{suggestionNotice}</span>
          </div>
        )}
      </div>

      {/* Filters Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div>
          <label className="block text-[11px] font-semibold uppercase text-zinc-500 mb-1">Type</label>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-800 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200"
          >
            <option value="ALL">All Types</option>
            <option value="MANUAL">MANUAL</option>
            <option value="POLICY">POLICY</option>
            <option value="SOP">SOP</option>
            <option value="FAQ">FAQ</option>
            <option value="SYSTEM_RULE">SYSTEM_RULE</option>
            <option value="DEFINITION">DEFINITION</option>
            <option value="GUIDE">GUIDE</option>
            <option value="DECISION_RECORD">DECISION_RECORD</option>
            <option value="INTERNAL_RULE">INTERNAL_RULE</option>
            <option value="TRAINING">TRAINING</option>
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-semibold uppercase text-zinc-500 mb-1">Audience</label>
          <select
            value={audienceFilter}
            onChange={(e) => setAudienceFilter(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-800 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200"
          >
            <option value="ALL">All Audiences</option>
            <option value="INTERNAL">INTERNAL ONLY</option>
            <option value="ADMIN / MANAGEMENT">ADMIN / MANAGEMENT</option>
            <option value="BRAND">BRAND</option>
            <option value="RETAILER">RETAILER</option>
            <option value="PUBLIC">PUBLIC</option>
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-semibold uppercase text-zinc-500 mb-1">Module</label>
          <select
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-800 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200"
          >
            <option value="ALL">All Modules</option>
            <option value="INSIGHTS">INSIGHTS</option>
            <option value="GROWTH_SIMULATOR">GROWTH SIMULATOR</option>
            <option value="PRODUCTS">PRODUCTS</option>
            <option value="RETAIL_NETWORK">RETAIL NETWORK</option>
            <option value="APPLICATIONS">APPLICATIONS</option>
            <option value="AMAZON">AMAZON</option>
            <option value="OPERATIONS">OPERATIONS</option>
            <option value="ONBOARDING">ONBOARDING</option>
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-semibold uppercase text-zinc-500 mb-1">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-800 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200"
          >
            <option value="ALL">Active (Excl. Superseded)</option>
            <option value="PUBLISHED">PUBLISHED</option>
            <option value="DRAFT">DRAFT</option>
            <option value="IN_REVIEW">IN REVIEW</option>
            <option value="SUPERSEDED">SUPERSEDED</option>
            <option value="ARCHIVED">ARCHIVED</option>
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-semibold uppercase text-zinc-500 mb-1">Language</label>
          <select
            value={langFilter}
            onChange={(e) => setLangFilter(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-800 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200"
          >
            <option value="ALL">All Languages</option>
            <option value="KO">Korean (KO)</option>
            <option value="EN">English (EN)</option>
            <option value="BOTH">Dual (KO + EN)</option>
          </select>
        </div>
      </div>

      {/* Library Data Table */}
      <div className="rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-zinc-500">Loading library records...</div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-400 mx-auto flex items-center justify-center text-xl font-bold">
              🔍
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                관련 지식 항목을 찾지 못했습니다.
              </h3>
              <p className="mt-1 text-xs text-zinc-500 max-w-md mx-auto">
                검색어의 띄어쓰기나 철자를 확인하시거나, 아래 추천 키워드로 재검색해보세요.
              </p>
            </div>

            <div className="flex flex-wrap justify-center gap-2 pt-1">
              {["INSIGHTS", "MANUAL", "SOP", "SYSTEM_RULE", "POLICY"].map((kw) => (
                <button
                  key={kw}
                  onClick={() => setSearch(kw)}
                  className="px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-300 transition"
                >
                  {kw}
                </button>
              ))}
            </div>

            <div className="pt-2">
              <button
                onClick={clearAllFilters}
                className="px-4 py-2 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-bold hover:bg-zinc-800 transition"
              >
                Clear All Filters & Reset
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm select-none">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400">
                <tr>
                  <th className="py-3.5 px-4">Title</th>
                  <th className="py-3.5 px-4">Type</th>
                  <th className="py-3.5 px-4">Audience</th>
                  <th className="py-3.5 px-4">Module</th>
                  <th className="py-3.5 px-4">Version</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {items.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors cursor-pointer"
                  >
                    <td className="py-3.5 px-4">
                      <Link href={`/admin/knowledge/${item.id}`} className="block">
                        <div className="font-semibold text-zinc-900 dark:text-white hover:underline flex items-center gap-2">
                          {item.title_ko || item.title}
                          {item.is_sensitive_internal && (
                            <span className="rounded bg-amber-100 px-1.5 py-0.2 text-[9px] font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                              SENSITIVE
                            </span>
                          )}
                          {item.source_type === "HYBRID" && (
                            <span className="rounded bg-indigo-100 px-1.5 py-0.2 text-[9px] font-bold text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                              HYBRID
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-zinc-500 line-clamp-1 mt-0.5">
                          {item.summary_ko || item.summary_en || "No summary provided."}
                        </div>
                      </Link>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="rounded font-mono px-2 py-0.5 text-xs font-semibold bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
                        {item.type}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap gap-1">
                        {item.audience.map((aud) => (
                          <span
                            key={aud}
                            className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                              aud === "INTERNAL"
                                ? "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300"
                                : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            }`}
                          >
                            {aud}
                          </span>
                        ))}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-xs font-medium text-zinc-600 dark:text-zinc-400">
                      {item.category}
                    </td>

                    <td className="py-3.5 px-4 font-mono text-xs font-bold text-zinc-800 dark:text-zinc-200">
                      {item.current_version}
                    </td>

                    <td className="py-3.5 px-4">{getStatusBadge(item.status)}</td>

                    <td className="py-3.5 px-4 text-xs text-zinc-500">
                      {new Date(item.updated_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
