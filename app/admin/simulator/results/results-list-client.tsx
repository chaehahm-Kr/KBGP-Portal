"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface ResultsListClientProps {
  initialData: any[];
  total: number;
  search: string;
  display: string;
  primaryAp: string;
  confidence: string;
  budgetFit: string;
  sortBy: string;
  page: number;
  limit: number;
}

export default function ResultsListClient({
  initialData,
  total,
  search: initSearch,
  display: initDisplay,
  primaryAp: initPrimaryAp,
  confidence: initConfidence,
  budgetFit: initBudgetFit,
  sortBy: initSortBy,
  page,
  limit,
}: ResultsListClientProps) {
  const router = useRouter();

  const [search, setSearch] = useState(initSearch);
  const [display, setDisplay] = useState(initDisplay);
  const [primaryAp, setPrimaryAp] = useState(initPrimaryAp);
  const [confidence, setConfidence] = useState(initConfidence);
  const [budgetFit, setBudgetFit] = useState(initBudgetFit);
  const [sortBy, setSortBy] = useState(initSortBy);

  // Apply filters by push URL state
  const handleApplyFilters = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const queryParams = new URLSearchParams();
    if (search.trim()) queryParams.set("search", search.trim());
    if (display) queryParams.set("display", display);
    if (primaryAp) queryParams.set("primaryAp", primaryAp);
    if (confidence) queryParams.set("confidence", confidence);
    if (budgetFit) queryParams.set("budgetFit", budgetFit);
    if (sortBy !== "newest") queryParams.set("sortBy", sortBy);
    queryParams.set("page", "1"); // Reset to page 1 on filter apply

    router.push(`/admin/simulator/results?${queryParams.toString()}`);
  };

  const handleClearFilters = () => {
    setSearch("");
    setDisplay("");
    setPrimaryAp("");
    setConfidence("");
    setBudgetFit("");
    setSortBy("newest");
    router.push("/admin/simulator/results");
  };

  const handlePageChange = (newPage: number) => {
    const queryParams = new URLSearchParams();
    if (search.trim()) queryParams.set("search", search.trim());
    if (display) queryParams.set("display", display);
    if (primaryAp) queryParams.set("primaryAp", primaryAp);
    if (confidence) queryParams.set("confidence", confidence);
    if (budgetFit) queryParams.set("budgetFit", budgetFit);
    if (sortBy !== "newest") queryParams.set("sortBy", sortBy);
    queryParams.set("page", newPage.toString());

    router.push(`/admin/simulator/results?${queryParams.toString()}`);
  };

  const totalPages = Math.ceil(total / limit);

  const CONFIDENCE_BADGES: Record<string, string> = {
    HIGH: "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900",
    GOOD: "bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900",
    BASIC: "bg-zinc-50 text-zinc-650 border-zinc-200 dark:bg-zinc-800/40 dark:text-zinc-300 dark:border-zinc-700",
  };

  const BUDGET_BADGES: Record<string, string> = {
    HIGH: "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900",
    MEDIUM: "bg-sky-50 text-sky-700 border-sky-100 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-900",
    LOW: "bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900",
    "VERY LOW": "bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900",
  };

  return (
    <div className="space-y-4">
      {/* Search and Filters panel */}
      <form
        onSubmit={handleApplyFilters}
        className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-6 lg:grid-cols-7 items-end"
      >
        <div className="md:col-span-2 flex flex-col gap-1">
          <label className="text-[10px] font-bold text-zinc-400 uppercase">검색어 (ID / Email)</label>
          <input
            type="text"
            placeholder="Search by ID or Email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-xs focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold text-zinc-400 uppercase">추천 매대 (Display)</label>
          <select
            value={display}
            onChange={(e) => setDisplay(e.target.value)}
            className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-xs focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
          >
            <option value="">전체 (All)</option>
            <option value="START">START</option>
            <option value="GROW">GROW</option>
            <option value="EXPAND">EXPAND</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold text-zinc-400 uppercase">주요 AP (Primary AP)</label>
          <select
            value={primaryAp}
            onChange={(e) => setPrimaryAp(e.target.value)}
            className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-xs focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
          >
            <option value="">전체 (All)</option>
            <option value="BALANCE">BALANCE</option>
            <option value="SKIN">SKIN</option>
            <option value="HAIR">HAIR</option>
            <option value="ESSENTIAL">ESSENTIAL</option>
            <option value="TREND">TREND</option>
            <option value="PREMIUM">PREMIUM</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold text-zinc-400 uppercase">신뢰도 (Confidence)</label>
          <select
            value={confidence}
            onChange={(e) => setConfidence(e.target.value)}
            className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-xs focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
          >
            <option value="">전체 (All)</option>
            <option value="HIGH">HIGH</option>
            <option value="GOOD">GOOD</option>
            <option value="BASIC">BASIC</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold text-zinc-400 uppercase">예산 적합도 (Budget Fit)</label>
          <select
            value={budgetFit}
            onChange={(e) => setBudgetFit(e.target.value)}
            className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-xs focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
          >
            <option value="">전체 (All)</option>
            <option value="HIGH">HIGH</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="LOW">LOW</option>
            <option value="VERY LOW">VERY LOW</option>
          </select>
        </div>

        <div className="flex gap-2 justify-end w-full">
          <button
            type="submit"
            className="h-9 flex-1 bg-zinc-900 hover:bg-zinc-800 text-white rounded-md text-xs font-bold transition cursor-pointer dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-950"
          >
            적용
          </button>
          <button
            type="button"
            onClick={handleClearFilters}
            className="h-9 flex-1 border border-zinc-200 hover:bg-zinc-50 text-zinc-600 rounded-md text-xs font-bold transition cursor-pointer dark:border-zinc-800 dark:hover:bg-zinc-800 dark:text-zinc-400"
          >
            초기화
          </button>
        </div>
      </form>

      {/* Sorting panel */}
      <div className="flex justify-between items-center text-xs text-zinc-500 px-1">
        <span>검색 결과: <strong className="text-zinc-900 dark:text-white">{total}</strong>건</span>
        <div className="flex items-center gap-2">
          <span>정렬:</span>
          <select
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value);
              const queryParams = new URLSearchParams();
              if (search.trim()) queryParams.set("search", search.trim());
              if (display) queryParams.set("display", display);
              if (primaryAp) queryParams.set("primaryAp", primaryAp);
              if (confidence) queryParams.set("confidence", confidence);
              if (budgetFit) queryParams.set("budgetFit", budgetFit);
              queryParams.set("sortBy", e.target.value);
              queryParams.set("page", "1");
              router.push(`/admin/simulator/results?${queryParams.toString()}`);
            }}
            className="h-8 rounded-md border border-zinc-200 bg-white px-2 text-xs focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
          >
            <option value="newest">최신순 (Newest)</option>
            <option value="oldest">오래된순 (Oldest)</option>
          </select>
        </div>
      </div>

      {/* Table Section */}
      <div className="rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs text-zinc-500 dark:text-zinc-400">
            <thead>
              <tr className="border-b border-zinc-150 bg-zinc-50 font-bold text-zinc-950 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-white">
                <th className="px-6 py-3 font-semibold">일시 (Created At)</th>
                <th className="px-6 py-3 font-semibold">Simulation ID</th>
                <th className="px-6 py-3 font-semibold">이메일 (Email)</th>
                <th className="px-6 py-3 font-semibold text-center">추천 매대</th>
                <th className="px-6 py-3 font-semibold text-center">주요 AP</th>
                <th className="px-6 py-3 font-semibold text-center">보조 AP</th>
                <th className="px-6 py-3 font-semibold text-center">예상 회전율</th>
                <th className="px-6 py-3 font-semibold text-center">예산 적합도</th>
                <th className="px-6 py-3 font-semibold text-center">신뢰도</th>
                <th className="px-6 py-3 font-semibold text-center">버전 정보</th>
                <th className="px-6 py-3 font-semibold text-right">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {initialData.map((sim) => {
                const res = sim.result_snapshot || {};
                const displayProg = res.display?.program || "-";
                const primaryAp = res.assortment?.primary || "-";
                const secondaryAp = res.assortment?.secondary || "-";
                const turnover = res.financial?.turnover || 0;
                const budgetFit = res.financial?.budget_fit || "-";
                const confidence = res.confidence?.level || "-";

                return (
                  <tr key={sim.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50">
                    <td className="px-6 py-3">
                      {new Date(sim.created_at).toLocaleString("ko-KR")}
                    </td>
                    <td className="px-6 py-3 font-mono text-[10.5px]">
                      {sim.id}
                    </td>
                    <td className="px-6 py-3 font-semibold text-zinc-850 dark:text-zinc-200">
                      {sim.email || "미입력"}
                    </td>
                    <td className="px-6 py-3 text-center">
                      <span className="inline-block rounded bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 font-bold">
                        {displayProg}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-center font-bold text-zinc-900 dark:text-white">
                      {primaryAp}
                    </td>
                    <td className="px-6 py-3 text-center text-zinc-500">
                      {secondaryAp}
                    </td>
                    <td className="px-6 py-3 text-center">
                      {turnover}회
                    </td>
                    <td className="px-6 py-3 text-center">
                      <span className={`inline-block rounded px-1.5 py-0.5 border text-[10px] font-bold ${BUDGET_BADGES[budgetFit] || ""}`}>
                        {budgetFit}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-center">
                      <span className={`inline-block rounded px-1.5 py-0.5 border text-[10px] font-bold ${CONFIDENCE_BADGES[confidence] || ""}`}>
                        {confidence}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-center text-zinc-400 font-medium">
                      Q{sim.questionnaire_version} / C{sim.calibration_version}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <Link
                        href={`/admin/simulator/results/${sim.id}`}
                        className="font-bold text-[#ff2b75] hover:underline"
                      >
                        상세
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {initialData.length === 0 && (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-zinc-400">
                    검색 조건에 맞는 실행 기록이 존재하지 않습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination component */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center text-xs text-zinc-500 px-1 pt-2">
          <span>Page {page} of {totalPages}</span>
          <div className="flex gap-1.5">
            <button
              onClick={() => handlePageChange(page - 1)}
              disabled={page <= 1}
              className="h-8 px-3 border border-zinc-200 rounded-md bg-white hover:bg-zinc-50 disabled:opacity-40 disabled:hover:bg-white cursor-pointer transition dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
            >
              이전 (Prev)
            </button>
            <button
              onClick={() => handlePageChange(page + 1)}
              disabled={page >= totalPages}
              className="h-8 px-3 border border-zinc-200 rounded-md bg-white hover:bg-zinc-50 disabled:opacity-40 disabled:hover:bg-white cursor-pointer transition dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
            >
              다음 (Next)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
