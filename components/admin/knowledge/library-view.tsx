"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { KnowledgeItem } from "@/lib/knowledge/types";
import KnowledgeNavTabs from "./knowledge-nav-tabs";

export default function LibraryView() {
  const searchParams = useSearchParams();
  const initialStatus = searchParams.get("status") || "ALL";
  const initialImpact = searchParams.get("impact") || searchParams.get("impact_status") || "ALL";

  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [audienceFilter, setAudienceFilter] = useState("ALL");
  const [moduleFilter, setModuleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [impactFilter, setImpactFilter] = useState(initialImpact);
  const [langFilter, setLangFilter] = useState("ALL");

  useEffect(() => {
    fetchLibrary();
  }, [typeFilter, audienceFilter, moduleFilter, statusFilter, impactFilter, langFilter, search]);

  const fetchLibrary = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (typeFilter !== "ALL") params.set("type", typeFilter);
      if (audienceFilter !== "ALL") params.set("audience", audienceFilter);
      if (moduleFilter !== "ALL") params.set("module", moduleFilter);
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (impactFilter !== "ALL") params.set("impact_status", impactFilter);
      if (langFilter !== "ALL") params.set("language", langFilter);
      if (search.trim()) params.set("search", search.trim());

      const res = await fetch(`/api/admin/knowledge?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setItems(json.items || []);
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
    setImpactFilter("ALL");
    setLangFilter("ALL");
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PUBLISHED":
        return (
          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            PUBLISHED
          </span>
        );
      case "DRAFT":
      case "IN_REVIEW":
        return (
          <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-bold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
            DRAFT
          </span>
        );
      case "ARCHIVED":
      case "SUPERSEDED":
        return (
          <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            ARCHIVED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-bold text-zinc-700">
            {status}
          </span>
        );
    }
  };

  const getAudienceBadges = (audience: string[] = []) => {
    if (audience.length === 0) return <span className="text-zinc-400 text-xs">-</span>;
    return (
      <div className="flex flex-wrap gap-1">
        {audience.map((aud) => {
          let label = aud;
          let colorClass = "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";
          if (aud === "INTERNAL" || aud === "ADMIN / MANAGEMENT") {
            label = "Internal";
            colorClass = "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700";
          } else if (aud === "BRAND") {
            label = "Brand";
            colorClass = "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800";
          } else if (aud === "RETAIL" || aud === "RETAILER") {
            label = "Retail";
            colorClass = "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800";
          } else if (aud === "PUBLIC") {
            label = "Public";
            colorClass = "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800";
          }

          return (
            <span key={aud} className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${colorClass}`}>
              {label}
            </span>
          );
        })}
      </div>
    );
  };

  const hasActiveFilters =
    search.trim() !== "" ||
    typeFilter !== "ALL" ||
    audienceFilter !== "ALL" ||
    moduleFilter !== "ALL" ||
    statusFilter !== "ALL" ||
    langFilter !== "ALL";

  return (
    <div className="space-y-6">
      <KnowledgeNavTabs />

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
            Knowledge Library
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            K SELECT NETWORK의 모든 공식 매뉴얼, 정책, SOP, FAQ, 가이드 목록을 검색하고 관리합니다.
          </p>
        </div>
        <Link
          href="/admin/knowledge/new"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#131E2E] px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-[#1f3047] dark:bg-white dark:text-[#131E2E] dark:hover:bg-zinc-100 transition-colors shrink-0"
        >
          <span>+ Create Knowledge</span>
        </Link>
      </div>

      {/* Search & Filter Bar */}
      <div className="space-y-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="제목, 요약, 본문, 모듈, 유형 검색..."
            className="w-full rounded-lg border border-zinc-300 bg-zinc-50/50 py-2.5 pl-10 pr-4 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-[#131E2E] focus:bg-white focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-white dark:focus:border-zinc-500"
          />
          <svg
            className="absolute left-3.5 top-3 h-4 w-4 text-zinc-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {/* Filters Dropdowns Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {/* Type Filter */}
          <div>
            <label className="block text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
              Type (유형)
            </label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-800 focus:border-[#131E2E] focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
            >
              <option value="ALL">All Types</option>
              <option value="MANUAL">Manual (매뉴얼)</option>
              <option value="POLICY">Policy (정책)</option>
              <option value="FAQ">FAQ (자주 묻는 질문)</option>
              <option value="SOP">SOP (표준절차)</option>
              <option value="GUIDE">Guide (가이드)</option>
              <option value="SYSTEM_RULE">System Rule (시스템 룰)</option>
              <option value="DEFINITION">Definition (용어 정의)</option>
            </select>
          </div>

          {/* Audience Filter */}
          <div>
            <label className="block text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
              Audience (대상)
            </label>
            <select
              value={audienceFilter}
              onChange={(e) => setAudienceFilter(e.target.value)}
              className="w-full rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-800 focus:border-[#131E2E] focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
            >
              <option value="ALL">All Audiences</option>
              <option value="INTERNAL">Internal / Admin</option>
              <option value="BRAND">Brand Portal</option>
              <option value="RETAILER">Retail Portal</option>
              <option value="PUBLIC">Public</option>
            </select>
          </div>

          {/* Module Filter */}
          <div>
            <label className="block text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
              Module (모듈)
            </label>
            <select
              value={moduleFilter}
              onChange={(e) => setModuleFilter(e.target.value)}
              className="w-full rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-800 focus:border-[#131E2E] focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
            >
              <option value="ALL">All Modules</option>
              <option value="General">General</option>
              <option value="Onboarding">Onboarding</option>
              <option value="Company">Company</option>
              <option value="Brand">Brand</option>
              <option value="Products">Products</option>
              <option value="Orders">Orders</option>
              <option value="Purchasing">Purchasing</option>
              <option value="Finance">Finance</option>
              <option value="Shipping">Shipping</option>
              <option value="Support">Support</option>
              <option value="Retail">Retail</option>
              <option value="Insights">Insights</option>
              <option value="Operations">Operations</option>
              <option value="Simulator">Simulator</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
              Status (상태)
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-800 focus:border-[#131E2E] focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
            >
              <option value="ALL">All Status</option>
              <option value="PUBLISHED">Published</option>
              <option value="DRAFT">Draft</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </div>

          {/* Impact Status Filter */}
          <div>
            <label className="block text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
              Impact (영향 상태)
            </label>
            <select
              value={impactFilter}
              onChange={(e) => setImpactFilter(e.target.value)}
              className="w-full rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-800 focus:border-[#131E2E] focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
            >
              <option value="ALL">All Impacts</option>
              <option value="UPDATE_REQUIRED">⚠️ Update Required</option>
              <option value="NORMAL">Normal</option>
            </select>
          </div>

          {/* Language Filter */}
          <div>
            <label className="block text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
              Language (언어)
            </label>
            <select
              value={langFilter}
              onChange={(e) => setLangFilter(e.target.value)}
              className="w-full rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-800 focus:border-[#131E2E] focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
            >
              <option value="ALL">All Languages</option>
              <option value="KO">Korean (KO)</option>
              <option value="EN">English (EN)</option>
            </select>
          </div>
        </div>

        {hasActiveFilters && (
          <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-800 text-xs">
            <span className="text-zinc-500">
              검색 결과: <strong className="text-zinc-900 dark:text-white">{items.length}</strong>건
            </span>
            <button
              onClick={clearAllFilters}
              className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
            >
              필터 초기화
            </button>
          </div>
        )}
      </div>

      {/* Knowledge Items Table */}
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50/75 dark:border-zinc-800 dark:bg-zinc-950 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                <th className="py-3 px-4">Title / Knowledge ID</th>
                <th className="py-3 px-3">Type</th>
                <th className="py-3 px-3">Audience</th>
                <th className="py-3 px-3">Module</th>
                <th className="py-3 px-3 text-center">Version</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-4 text-right">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-zinc-400">
                    지식 라이브러리를 불러오는 중입니다...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-zinc-400">
                    <p className="text-sm font-semibold">검색 조건에 맞는 지식 항목이 없습니다.</p>
                    <p className="mt-1 text-xs text-zinc-400">다른 검색어를 입력하시거나 필터를 초기화해 보세요.</p>
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors"
                  >
                    {/* Title & Short Summary */}
                    <td className="py-3.5 px-4 max-w-sm sm:max-w-md">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/admin/knowledge/${item.id}`}
                          className="font-bold text-zinc-900 hover:text-blue-600 dark:text-white dark:hover:text-blue-400 block truncate"
                        >
                          {item.title}
                        </Link>
                      </div>
                      <p className="text-[11px] text-zinc-500 truncate mt-0.5">
                        {item.summary_ko || item.summary_en || item.id}
                      </p>
                    </td>

                    {/* Type */}
                    <td className="py-3.5 px-3 whitespace-nowrap">
                      <span className="rounded bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                        {item.type}
                      </span>
                    </td>

                    {/* Audience */}
                    <td className="py-3.5 px-3">
                      {getAudienceBadges(item.audience)}
                    </td>

                    {/* Module */}
                    <td className="py-3.5 px-3 whitespace-nowrap text-zinc-600 dark:text-zinc-300 font-medium">
                      {item.module || item.category || "General"}
                    </td>

                    {/* Version */}
                    <td className="py-3.5 px-3 text-center whitespace-nowrap font-mono text-[11px] text-zinc-600 dark:text-zinc-400">
                      {item.current_version || "v1.0"}
                    </td>

                    {/* Status & Impact */}
                    <td className="py-3.5 px-3 text-center whitespace-nowrap">
                      <div className="flex flex-col items-center gap-1">
                        {getStatusBadge(item.status)}
                        {(item.system_impact_status === "UPDATE_REQUIRED" || item.system_impact_status === "POTENTIALLY_OUTDATED") && (
                          <span
                            className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400 border border-amber-300 dark:border-amber-700"
                            title={item.system_impact_reason || "시스템 변경 영향 감지 (업데이트 필요)"}
                          >
                            ⚠️ UPDATE REQUIRED
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Updated */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap text-zinc-400 text-[11px]">
                      {new Date(item.updated_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
