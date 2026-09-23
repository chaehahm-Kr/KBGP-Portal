"use client";

import React, { useState, useMemo } from "react";
import type { ProductChangeLogItem } from "@/lib/product/audit";
import { formatEasternDateTime } from "@/lib/utils/timezone";

interface ProductChangeHistoryTabProps {
  logs: ProductChangeLogItem[];
  isLoading?: boolean;
}

export function ProductChangeHistoryTab({
  logs,
  isLoading = false,
}: ProductChangeHistoryTabProps) {
  const [expandedLogIds, setExpandedLogIds] = useState<Set<string>>(new Set());
  const [filterSource, setFilterSource] = useState<string>("ALL");
  const [filterSection, setFilterSection] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Extract unique sections from logs
  const availableSections = useMemo(() => {
    const sections = new Set<string>();
    logs.forEach((log) => {
      if (log.section) {
        log.section.split(",").forEach((s) => {
          const trimmed = s.trim();
          if (trimmed) sections.add(trimmed);
        });
      }
    });
    return Array.from(sections).sort();
  }, [logs]);

  // Filter logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Source filter
      if (filterSource !== "ALL") {
        if (filterSource === "ADMIN" && log.source !== "ADMIN") return false;
        if (filterSource === "BRAND_PORTAL" && log.source !== "BRAND_PORTAL") return false;
        if (filterSource === "SYSTEM" && log.source !== "SYSTEM" && log.source !== "AUTOMATION") return false;
      }

      // Section filter
      if (filterSection !== "ALL") {
        if (!log.section || !log.section.includes(filterSection)) return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const userName = (log.userName || "").toLowerCase();
        const companyName = (log.companyName || "").toLowerCase();
        const summary = (log.summary || "").toLowerCase();
        const section = (log.section || "").toLowerCase();

        let matchChanges = false;
        if (log.changes) {
          matchChanges = Object.entries(log.changes).some(([key, val]) => {
            const label = (typeof val === "object" && val?.label ? val.label : key).toLowerCase();
            const before = String(typeof val === "object" ? val?.before : "").toLowerCase();
            const after = String(typeof val === "object" ? val?.after : val).toLowerCase();
            return label.includes(query) || before.includes(query) || after.includes(query);
          });
        }

        if (
          !userName.includes(query) &&
          !companyName.includes(query) &&
          !summary.includes(query) &&
          !section.includes(query) &&
          !matchChanges
        ) {
          return false;
        }
      }

      return true;
    });
  }, [logs, filterSource, filterSection, searchQuery]);

  const toggleExpand = (id: string) => {
    setExpandedLogIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleExpandAll = () => {
    const allWithChanges = new Set(
      filteredLogs.filter((l) => l.changes && Object.keys(l.changes).length > 0).map((l) => l.id)
    );
    setExpandedLogIds(allWithChanges);
  };

  const handleCollapseAll = () => {
    setExpandedLogIds(new Set());
  };

  const getSourceBadge = (source: string, companyName: string | null) => {
    switch (source) {
      case "ADMIN":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-blue-700 border border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-900/60">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse"></span>
            Admin · {companyName || "Letusto Admin"}
          </span>
        );
      case "BRAND_PORTAL":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 px-2.5 py-0.5 text-[11px] font-bold text-purple-700 border border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-900/60">
            <span className="h-1.5 w-1.5 rounded-full bg-purple-500"></span>
            Brand Portal · {companyName || "브랜드사"}
          </span>
        );
      case "SYSTEM":
      case "AUTOMATION":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-2.5 py-0.5 text-[11px] font-bold text-zinc-700 border border-zinc-250 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700">
            <span className="h-1.5 w-1.5 rounded-full bg-zinc-500"></span>
            System / Automation
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-2.5 py-0.5 text-[11px] font-medium text-zinc-600">
            {source}
          </span>
        );
    }
  };

  const getActionTypeIcon = (actionType: string) => {
    switch (actionType) {
      case "CREATE":
        return "✨";
      case "DELETE":
        return "🗑️";
      case "RESTORE":
        return "🔄";
      case "STATUS_CHANGE":
        return "🏷️";
      default:
        return "✏️";
    }
  };

  const formatDateTime = (isoString: string) => {
    return formatEasternDateTime(isoString, true);
  };

  if (isLoading) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-12 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-zinc-900 border-t-transparent dark:border-white dark:border-t-transparent"></div>
        <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">변경 감사 이력을 불러오는 중입니다...</p>
      </div>
    );
  }

  if (!logs || logs.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-12 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-xl text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500">
          📜
        </div>
        <h3 className="text-sm font-bold text-zinc-900 dark:text-white">기록된 변경 감사 이력이 없습니다</h3>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 max-w-md mx-auto leading-relaxed">
          관리자(Admin) 또는 브랜드사(Brand Portal) 사용자가 상품 기본 정보, 가격, 로지스틱스, 카테고리/속성, 미디어, 인허가 서류를 수정하거나 삭제/복구하면 여기에 Field-Level 감사 로그가 자동으로 기록됩니다.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
        <div>
          <h3 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <span>상품 변경 감사 이력</span>
            <span className="text-xs font-mono font-normal text-zinc-400 dark:text-zinc-500">
              (Field-Level Audit Trail)
            </span>
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Admin과 Brand Portal 양쪽에서 발생한 모든 변경 내역을 불변의 단일 타임라인으로 보존합니다.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="rounded-md bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
            {filteredLogs.length === logs.length ? `총 ${logs.length}건` : `${filteredLogs.length}건 / 전체 ${logs.length}건`}
          </span>
          <button
            type="button"
            onClick={handleExpandAll}
            className="rounded border border-zinc-200 bg-white px-2 py-1 text-[11px] font-semibold text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            모두 펼치기
          </button>
          <button
            type="button"
            onClick={handleCollapseAll}
            className="rounded border border-zinc-200 bg-white px-2 py-1 text-[11px] font-semibold text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            모두 접기
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 flex flex-wrap items-center justify-between gap-3">
        {/* Left Filter: Source pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 mr-1">주체:</span>
          <button
            type="button"
            onClick={() => setFilterSource("ALL")}
            className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
              filterSource === "ALL"
                ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-sm"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
            }`}
          >
            전체 ({logs.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterSource("ADMIN")}
            className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
              filterSource === "ADMIN"
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-400 dark:hover:bg-blue-900/60"
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-blue-400"></span>
            Admin ({logs.filter((l) => l.source === "ADMIN").length})
          </button>
          <button
            type="button"
            onClick={() => setFilterSource("BRAND_PORTAL")}
            className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
              filterSource === "BRAND_PORTAL"
                ? "bg-purple-600 text-white shadow-sm"
                : "bg-purple-50 text-purple-700 hover:bg-purple-100 dark:bg-purple-950/40 dark:text-purple-400 dark:hover:bg-purple-900/60"
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-purple-400"></span>
            Brand Portal ({logs.filter((l) => l.source === "BRAND_PORTAL").length})
          </button>
        </div>

        {/* Right Controls: Section Dropdown & Search Bar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Section selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400">섹션:</span>
            <select
              value={filterSection}
              onChange={(e) => setFilterSection(e.target.value)}
              className="rounded-lg border border-zinc-250 bg-white px-2.5 py-1 text-xs font-medium text-zinc-800 shadow-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 cursor-pointer"
            >
              <option value="ALL">모든 섹션 (All Sections)</option>
              {availableSections.map((sec) => (
                <option key={sec} value={sec}>
                  {sec}
                </option>
              ))}
            </select>
          </div>

          {/* Search input */}
          <div className="relative">
            <input
              type="text"
              placeholder="감사 내역 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-44 rounded-lg border border-zinc-250 bg-white px-2.5 py-1 text-xs text-zinc-800 placeholder-zinc-400 shadow-sm focus:border-zinc-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:placeholder-zinc-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1.5 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Empty Filter State */}
      {filteredLogs.length === 0 && (
        <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">선택한 필터 조건에 일치하는 변경 이력이 없습니다.</p>
          <button
            type="button"
            onClick={() => {
              setFilterSource("ALL");
              setFilterSection("ALL");
              setSearchQuery("");
            }}
            className="mt-3 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 transition-colors cursor-pointer"
          >
            필터 초기화
          </button>
        </div>
      )}

      {/* Timeline List */}
      {filteredLogs.length > 0 && (
        <div className="relative border-l-2 border-zinc-200 ml-4 dark:border-zinc-800 space-y-6 pb-4">
          {filteredLogs.map((log) => {
            const isExpanded = expandedLogIds.has(log.id);
            const hasDetailedChanges = log.changes && Object.keys(log.changes).length > 0;

            return (
              <div key={log.id} className="relative pl-6">
                {/* Timeline Dot */}
                <div className="absolute -left-[9px] top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-white ring-4 ring-zinc-100 dark:bg-zinc-900 dark:ring-zinc-800">
                  <span className="h-2 w-2 rounded-full bg-zinc-900 dark:bg-zinc-100"></span>
                </div>

                {/* Log Card */}
                <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition-all hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700">
                  {/* Top Row: Date, User, Source Badge, Section */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 pb-3 dark:border-zinc-800">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-zinc-900 dark:text-white">
                        {log.userName}
                      </span>
                      {getSourceBadge(log.source, log.companyName)}
                      <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-bold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                        {log.section}
                      </span>
                    </div>
                    <time className="text-xs font-medium text-zinc-400 dark:text-zinc-500 font-mono">
                      {formatDateTime(log.createdAt)}
                    </time>
                  </div>

                  {/* Content Summary */}
                  <div className="mt-3 flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2">
                      <span className="text-base">{getActionTypeIcon(log.actionType)}</span>
                      <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 leading-relaxed">
                        {log.summary}
                      </p>
                    </div>

                    {hasDetailedChanges && (
                      <button
                        type="button"
                        onClick={() => toggleExpand(log.id)}
                        className="shrink-0 text-xs font-bold text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors cursor-pointer"
                      >
                        {isExpanded ? "상세 접기 ▲" : `변경점 (${Object.keys(log.changes!).length}개) ▼`}
                      </button>
                    )}
                  </div>

                  {/* Expanded Detailed Field Changes Table */}
                  {isExpanded && hasDetailedChanges && (
                    <div className="mt-4 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50/70 p-3.5 dark:border-zinc-800 dark:bg-zinc-950/50 space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                          필드별 상세 변경 내역 (Field-Level Diffs)
                        </h4>
                        <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500">
                          총 {Object.keys(log.changes!).length}개 항목 수정됨
                        </span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-zinc-200 text-zinc-500 dark:border-zinc-800">
                              <th className="py-1.5 pr-4 font-bold w-1/3">항목 (Field)</th>
                              <th className="py-1.5 pr-4 font-bold text-rose-600 dark:text-rose-400 w-1/3">변경 전 (Before)</th>
                              <th className="py-1.5 font-bold text-emerald-600 dark:text-emerald-400 w-1/3">변경 후 (After)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-200/60 dark:divide-zinc-800/60 font-mono text-[11px]">
                            {Object.entries(log.changes!).map(([key, val]: [string, any]) => {
                              const isObject = typeof val === "object" && val !== null && "before" in val;
                              const label = isObject && val.label ? val.label : key;
                              const beforeVal = isObject
                                ? (val.before === null || val.before === undefined ? "(미입력)" : String(val.before))
                                : "-";
                              const afterVal = isObject
                                ? (val.after === null || val.after === undefined ? "(미입력/삭제)" : String(val.after))
                                : String(val);

                              return (
                                <tr key={key} className="hover:bg-zinc-100/50 dark:hover:bg-zinc-900/50">
                                  <td className="py-2 pr-4 font-sans font-semibold text-zinc-800 dark:text-zinc-200">
                                    {label}
                                  </td>
                                  <td className="py-2 pr-4 text-rose-600/80 line-through dark:text-rose-400/80">
                                    {beforeVal}
                                  </td>
                                  <td className="py-2 font-bold text-emerald-700 dark:text-emerald-400">
                                    {afterVal}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
