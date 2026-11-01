"use client";

import React, { useState, useEffect, useTransition } from "react";
import { listMarketingSuppressionListAction } from "@/lib/brand-marketing/campaign-actions";

export interface SuppressionEntry {
  id: string;
  email: string;
  reason: "UNSUBSCRIBED" | "BOUNCED" | "COMPLAINT" | "MANUAL_ADMIN" | string;
  notes?: string | null;
  suppressed_at: string;
  created_by?: string | null;
}

export function SuppressionListView() {
  const [suppressions, setSuppressions] = useState<SuppressionEntry[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const fetchSuppressions = (query: string = "") => {
    setIsLoading(true);
    setError(null);
    startTransition(async () => {
      try {
        const res = await listMarketingSuppressionListAction(query);
        if (res.success && res.suppressions) {
          setSuppressions(res.suppressions);
        } else {
          setError(res.error || "수신 거부 목록을 불러오지 못했습니다.");
        }
      } catch (err: any) {
        setError(err.message || "목록 조회 중 예외가 발생했습니다.");
      } finally {
        setIsLoading(false);
      }
    });
  };

  useEffect(() => {
    fetchSuppressions(search);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchSuppressions(search);
  };

  const getReasonBadge = (reason: string) => {
    switch (reason?.toUpperCase()) {
      case "UNSUBSCRIBED":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-900">
            수신 거부 (UNSUBSCRIBED)
          </span>
        );
      case "BOUNCED":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-900">
            영구 반송 (BOUNCED)
          </span>
        );
      case "COMPLAINT":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400 border border-red-200 dark:border-red-900">
            스팸 신고 (COMPLAINT)
          </span>
        );
      case "MANUAL_ADMIN":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300 border border-stone-200 dark:border-stone-700">
            관리자 등록 (MANUAL)
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
            {reason || "UNKNOWN"}
          </span>
        );
    }
  };

  const formatDate = (isoString?: string | null) => {
    if (!isoString) return "-";
    try {
      const d = new Date(isoString);
      return d.toLocaleString("ko-KR", {
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

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                수신 거부 목록 (Suppression List)
              </h2>
              <span className="px-2 py-0.5 text-xs font-semibold bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 rounded border border-stone-200 dark:border-stone-700">
                총 {suppressions.length}건
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
              이메일 수신 거부(Unsubscribe), 반송(Bounce) 및 발송 제외된 주소 목록입니다.
              법적 규정(CAN-SPAM / 한국 정보통신망법)에 따라 모든 마케팅 캠페인 발송 대상에서 자동으로 영구 제외(Fail-Closed)됩니다.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => fetchSuppressions(search)}
              disabled={isLoading || isPending}
              className="px-3 py-1.5 text-xs font-semibold rounded bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 transition cursor-pointer disabled:opacity-50"
            >
              {isLoading || isPending ? "새로고침 중..." : "새로고침"}
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearchSubmit} className="mt-4 flex items-center gap-2">
          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="이메일 주소로 검색..."
              className="w-full px-3 py-1.5 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-500"
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  fetchSuppressions("");
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={isLoading || isPending}
            className="px-3 py-1.5 text-xs font-semibold rounded bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white transition cursor-pointer"
          >
            검색
          </button>
        </form>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-lg text-xs text-rose-700 dark:text-rose-400">
          {error}
        </div>
      )}

      {/* Suppression Records Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 font-semibold">
              <tr>
                <th className="py-3 px-4">이메일 주소</th>
                <th className="py-3 px-4">거부 사유</th>
                <th className="py-3 px-4">등록 일시 (UTC / 로컬)</th>
                <th className="py-3 px-4">등록 출처</th>
                <th className="py-3 px-4">사유 / 메모</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {isLoading && suppressions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-zinc-400">
                    수신 거부 목록을 조회하는 중입니다...
                  </td>
                </tr>
              ) : suppressions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-zinc-400">
                    {search ? `"${search}" 검색 조건과 일치하는 수신 거부 내역이 없습니다.` : "등록된 수신 거부 주소가 없습니다."}
                  </td>
                </tr>
              ) : (
                suppressions.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/40 transition"
                  >
                    <td className="py-3 px-4 font-mono font-medium text-zinc-900 dark:text-zinc-100">
                      {item.email}
                    </td>
                    <td className="py-3 px-4">{getReasonBadge(item.reason)}</td>
                    <td className="py-3 px-4 text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                      {formatDate(item.suppressed_at)}
                    </td>
                    <td className="py-3 px-4 text-zinc-500 font-mono text-[11px]">
                      {item.created_by || "system:unsubscribe_flow"}
                    </td>
                    <td className="py-3 px-4 text-zinc-600 dark:text-zinc-300 max-w-xs truncate">
                      {item.notes || "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="p-3 bg-zinc-50/50 dark:bg-zinc-800/30 border-t border-zinc-200 dark:border-zinc-800 text-[11px] text-zinc-500 flex items-center justify-between">
          <span>* 법적 보존 정책에 따라 수신 거부 내역은 관리자 임의 삭제 또는 재수신 강제 처리가 불가합니다.</span>
          <span className="font-mono text-zinc-400">Fail-Closed Invariant: Active</span>
        </div>
      </div>
    </div>
  );
}
