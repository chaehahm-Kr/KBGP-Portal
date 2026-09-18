"use client";

import React, { useState } from "react";
import type { ProductChangeLogItem } from "@/lib/product/audit";

interface ProductChangeHistoryTabProps {
  logs: ProductChangeLogItem[];
  isLoading?: boolean;
}

export function ProductChangeHistoryTab({
  logs,
  isLoading = false,
}: ProductChangeHistoryTabProps) {
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedLogId((prev) => (prev === id ? null : id));
  };

  const getSourceBadge = (source: string, companyName: string | null) => {
    switch (source) {
      case "ADMIN":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900/60">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500"></span>
            Admin
          </span>
        );
      case "BRAND_PORTAL":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2 py-0.5 text-[11px] font-semibold text-purple-700 border border-purple-200 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-900/60">
            <span className="h-1.5 w-1.5 rounded-full bg-purple-500"></span>
            Brand Portal {companyName ? `(${companyName})` : ""}
          </span>
        );
      case "SYSTEM":
      case "AUTOMATION":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-700 border border-zinc-250 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700">
            <span className="h-1.5 w-1.5 rounded-full bg-zinc-500"></span>
            System
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600">
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
    try {
      const date = new Date(isoString);
      return date.toLocaleString("ko-KR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });
    } catch {
      return isoString;
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-12 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-zinc-900 border-t-transparent dark:border-white dark:border-t-transparent"></div>
        <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">변경 이력을 불러오는 중입니다...</p>
      </div>
    );
  }

  if (!logs || logs.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-12 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-xl text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500">
          📜
        </div>
        <h3 className="text-sm font-bold text-zinc-900 dark:text-white">기록된 변경 이력이 없습니다</h3>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          관리자 또는 브랜드사 사용자가 상품 정보를 수정하거나 삭제/복구하면 여기에 감사 로그가 자동으로 기록됩니다.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header Info */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
            상품 변경 감사 이력 (Change History Timeline)
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Admin과 Brand Portal에서 발생한 모든 상품 정보 수정, 상태 전이 및 삭제/복구 이력이 단일 타임라인으로 보존됩니다.
          </p>
        </div>
        <span className="rounded-md bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
          총 {logs.length}건
        </span>
      </div>

      {/* Timeline List */}
      <div className="relative border-l-2 border-zinc-200 ml-4 dark:border-zinc-800 space-y-6 pb-4">
        {logs.map((log) => {
          const isExpanded = expandedLogId === log.id;
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
                    <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                      {log.section}
                    </span>
                  </div>
                  <time className="text-xs font-medium text-zinc-400 dark:text-zinc-500">
                    {formatDateTime(log.createdAt)}
                  </time>
                </div>

                {/* Content Summary */}
                <div className="mt-3 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2">
                    <span className="text-base">{getActionTypeIcon(log.actionType)}</span>
                    <p className="text-xs font-medium text-zinc-800 dark:text-zinc-200 leading-relaxed">
                      {log.summary}
                    </p>
                  </div>

                  {hasDetailedChanges && (
                    <button
                      type="button"
                      onClick={() => toggleExpand(log.id)}
                      className="shrink-0 text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors cursor-pointer"
                    >
                      {isExpanded ? "접기 ▲" : "변경점 보기 ▼"}
                    </button>
                  )}
                </div>

                {/* Expanded Detailed Field Changes Table */}
                {isExpanded && hasDetailedChanges && (
                  <div className="mt-4 overflow-hidden rounded-lg border border-zinc-150 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-950/50">
                    <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      필드별 상세 변경 내역
                    </h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-zinc-200 text-zinc-500 dark:border-zinc-800">
                            <th className="py-1.5 pr-4 font-semibold">항목 (Field)</th>
                            <th className="py-1.5 pr-4 font-semibold text-rose-600 dark:text-rose-400">변경 전 (Before)</th>
                            <th className="py-1.5 font-semibold text-emerald-600 dark:text-emerald-400">변경 후 (After)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200/60 dark:divide-zinc-800/60 font-mono text-[11px]">
                          {Object.entries(log.changes!).map(([key, val]: [string, any]) => {
                            const isObject = typeof val === "object" && val !== null && "before" in val;
                            const label = isObject && val.label ? val.label : key;
                            const beforeVal = isObject ? (val.before === null ? "null" : String(val.before)) : "-";
                            const afterVal = isObject ? (val.after === null ? "null" : String(val.after)) : String(val);

                            return (
                              <tr key={key} className="hover:bg-zinc-100/50 dark:hover:bg-zinc-900/50">
                                <td className="py-2 pr-4 font-sans font-medium text-zinc-700 dark:text-zinc-300">
                                  {label}
                                </td>
                                <td className="py-2 pr-4 text-zinc-500 line-through dark:text-zinc-400">
                                  {beforeVal}
                                </td>
                                <td className="py-2 font-semibold text-emerald-700 dark:text-emerald-400">
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
    </div>
  );
}
