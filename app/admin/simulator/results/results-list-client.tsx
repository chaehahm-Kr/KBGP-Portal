"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { updateSimulationFollowupAction } from "@/lib/simulator/actions";

interface ResultsListClientProps {
  initialData: any[];
  total: number;
  search: string;
  type: string; // "LIVE" | "SANDBOX" | "ALL"
  display: string;
  primaryAp: string;
  confidence: string;
  budgetFit: string;
  followupStatus: string;
  sortBy: string;
  page: number;
  limit: number;
}

export default function ResultsListClient({
  initialData,
  total,
  search: initSearch,
  type: initType,
  display: initDisplay,
  primaryAp: initPrimaryAp,
  confidence: initConfidence,
  budgetFit: initBudgetFit,
  followupStatus: initFollowupStatus,
  sortBy: initSortBy,
  page,
  limit,
}: ResultsListClientProps) {
  const router = useRouter();

  const [search, setSearch] = useState(initSearch);
  const [type, setType] = useState(initType || "LIVE");
  const [display, setDisplay] = useState(initDisplay);
  const [primaryAp, setPrimaryAp] = useState(initPrimaryAp);
  const [confidence, setConfidence] = useState(initConfidence);
  const [budgetFit, setBudgetFit] = useState(initBudgetFit);
  const [followupStatus, setFollowupStatus] = useState(initFollowupStatus);
  const [sortBy, setSortBy] = useState(initSortBy);

  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Apply filters by push URL state
  const pushFilters = (newParams: Record<string, string>) => {
    const queryParams = new URLSearchParams();
    const current = {
      search,
      type,
      display,
      primaryAp,
      confidence,
      budgetFit,
      followupStatus,
      sortBy,
      page: "1",
      ...newParams
    };

    if (current.search.trim()) queryParams.set("search", current.search.trim());
    if (current.type && current.type !== "LIVE") queryParams.set("type", current.type);
    if (current.display) queryParams.set("display", current.display);
    if (current.primaryAp) queryParams.set("primaryAp", current.primaryAp);
    if (current.confidence) queryParams.set("confidence", current.confidence);
    if (current.budgetFit) queryParams.set("budgetFit", current.budgetFit);
    if (current.followupStatus) queryParams.set("followupStatus", current.followupStatus);
    if (current.sortBy !== "newest") queryParams.set("sortBy", current.sortBy);
    if (current.page !== "1") queryParams.set("page", current.page);

    router.push(`/admin/simulator/results?${queryParams.toString()}`);
  };

  const handleApplyFilters = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    pushFilters({ page: "1" });
  };

  const handleTypeTabChange = (newType: string) => {
    setType(newType);
    pushFilters({ type: newType, page: "1" });
  };

  const handleClearFilters = () => {
    setSearch("");
    setType("LIVE");
    setDisplay("");
    setPrimaryAp("");
    setConfidence("");
    setBudgetFit("");
    setFollowupStatus("");
    setSortBy("newest");
    router.push("/admin/simulator/results");
  };

  const handlePageChange = (newPage: number) => {
    pushFilters({ page: newPage.toString() });
  };

  const handleStatusChange = async (simId: string, newStatus: string) => {
    setUpdatingId(simId);
    try {
      const res = await updateSimulationFollowupAction({
        id: simId,
        followupStatus: newStatus
      });
      if (res.error) {
        alert(res.error);
      } else {
        router.refresh();
      }
    } catch (err: any) {
      alert("상태 변경 실패: " + err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const totalPages = Math.ceil(total / limit);

  const CONFIDENCE_BADGES: Record<string, string> = {
    HIGH: "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900",
    GOOD: "bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900",
    BASIC: "bg-zinc-50 text-zinc-650 border-zinc-200 dark:bg-zinc-800/40 dark:text-zinc-300 dark:border-zinc-700",
  };

  const FOLLOWUP_BADGES: Record<string, string> = {
    NEW: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900",
    REVIEWED: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-900",
    CONTACTED: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900",
    CONSULTATION: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900",
    CLOSED: "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700",
  };

  return (
    <div className="space-y-4">
      {/* 1. Live vs Sandbox Separation Tabs (Item 3) */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-800">
        <button
          onClick={() => handleTypeTabChange("LIVE")}
          className={`px-4 py-2.5 text-xs font-bold transition border-b-2 cursor-pointer ${
            type === "LIVE"
              ? "border-[#ff2b75] text-[#ff2b75]"
              : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
          }`}
        >
          🌐 LIVE Submissions (실제 Retailer)
        </button>
        <button
          onClick={() => handleTypeTabChange("SANDBOX")}
          className={`px-4 py-2.5 text-xs font-bold transition border-b-2 cursor-pointer ${
            type === "SANDBOX"
              ? "border-[#ff2b75] text-[#ff2b75]"
              : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
          }`}
        >
          🧪 SANDBOX / TEST Submissions
        </button>
        <button
          onClick={() => handleTypeTabChange("ALL")}
          className={`px-4 py-2.5 text-xs font-bold transition border-b-2 cursor-pointer ${
            type === "ALL"
              ? "border-[#ff2b75] text-[#ff2b75]"
              : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
          }`}
        >
          📋 전체 (All Submissions)
        </button>
      </div>

      {/* 2. Search and Filters panel */}
      <form
        onSubmit={handleApplyFilters}
        className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-6 lg:grid-cols-7 items-end"
      >
        <div className="md:col-span-2 flex flex-col gap-1">
          <label className="text-[10px] font-bold text-zinc-400 uppercase">검색어 (Store / Contact / Email / ID)</label>
          <input
            type="text"
            placeholder="Search by Store, Contact, Email..."
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
          <label className="text-[10px] font-bold text-zinc-400 uppercase">후속 상담 상태 (Follow-up)</label>
          <select
            value={followupStatus}
            onChange={(e) => setFollowupStatus(e.target.value)}
            className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-xs focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
          >
            <option value="">전체 (All)</option>
            <option value="NEW">NEW (접수)</option>
            <option value="REVIEWED">REVIEWED (검토완료)</option>
            <option value="CONTACTED">CONTACTED (연락완료)</option>
            <option value="CONSULTATION">CONSULTATION (상담진행)</option>
            <option value="CLOSED">CLOSED (완료/종결)</option>
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

        <div className="flex gap-2 justify-end w-full col-span-1 sm:col-span-2 md:col-span-1">
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

      {/* Sorting & Result Counts panel */}
      <div className="flex justify-between items-center text-xs text-zinc-500 px-1">
        <span>
          [{type === "LIVE" ? "LIVE" : type === "SANDBOX" ? "SANDBOX" : "ALL"}] 검색 결과: <strong className="text-zinc-900 dark:text-white">{total}</strong>건
        </span>
        <div className="flex items-center gap-2">
          <span>정렬:</span>
          <select
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value);
              pushFilters({ sortBy: e.target.value, page: "1" });
            }}
            className="h-8 rounded-md border border-zinc-200 bg-white px-2 text-xs focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
          >
            <option value="newest">최신순 (Newest)</option>
            <option value="oldest">오래된순 (Oldest)</option>
          </select>
        </div>
      </div>

      {/* 3. Table Section with Required Fields (Item 2 & 8) */}
      <div className="rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs text-zinc-500 dark:text-zinc-400">
            <thead>
              <tr className="border-b border-zinc-150 bg-zinc-50 font-bold text-zinc-950 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-white">
                <th className="px-4 py-3 font-semibold">제출 일시</th>
                <th className="px-4 py-3 font-semibold">Retailer / Store Name</th>
                <th className="px-4 py-3 font-semibold text-center">Recommended Display</th>
                <th className="px-4 py-3 font-semibold text-center">Assortment Strategy</th>
                <th className="px-4 py-3 font-semibold text-right">Initial Investment</th>
                <th className="px-4 py-3 font-semibold text-right">Year-1 Sales</th>
                <th className="px-4 py-3 font-semibold text-center">Confidence</th>
                <th className="px-4 py-3 font-semibold text-center">Type</th>
                <th className="px-4 py-3 font-semibold text-center">Follow-up Status</th>
                <th className="px-4 py-3 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {initialData.map((sim) => {
                const res = sim.result_snapshot || {};
                const isSandbox = res.is_sandbox === true;
                const displayProg = res.display?.program || "-";
                const primaryAp = res.assortment?.primary || "-";
                const investment = res.financial?.initial_product_investment || res.display?.investment || 0;
                const sales = res.financial?.annual_sales || 0;
                const confidence = res.confidence?.level || "-";
                const followup = res.followup_status || "NEW";

                const retInfo = res.retailer_info || {};
                const storeName = retInfo.store_name || (sim.email ? sim.email.split("@")[0] : "Retailer Store");
                const contactName = retInfo.contact_name || "";
                const phone = retInfo.phone || "";

                return (
                  <tr key={sim.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      {new Date(sim.created_at).toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-zinc-900 dark:text-white">{storeName}</div>
                      <div className="text-[11px] text-zinc-400">
                        {sim.email || "No email"} {contactName ? `• ${contactName}` : ""} {phone ? `(${phone})` : ""}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-block rounded bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 font-extrabold text-zinc-800 dark:text-zinc-200">
                        {displayProg}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-zinc-800 dark:text-zinc-200">
                      {primaryAp}
                    </td>
                    <td className="px-4 py-3 text-right font-extrabold text-zinc-900 dark:text-white">
                      ${investment.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                      ${sales.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block rounded px-1.5 py-0.5 border text-[10px] font-bold ${CONFIDENCE_BADGES[confidence] || ""}`}>
                        {confidence}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {isSandbox ? (
                        <span className="inline-block rounded bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.5 text-[10px] font-bold dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-900">
                          SANDBOX
                        </span>
                      ) : (
                        <span className="inline-block rounded bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 text-[10px] font-bold dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900">
                          LIVE
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <select
                        value={followup}
                        disabled={updatingId === sim.id}
                        onChange={(e) => handleStatusChange(sim.id, e.target.value)}
                        className={`text-[10px] font-bold rounded px-1.5 py-1 border focus:outline-none cursor-pointer ${FOLLOWUP_BADGES[followup] || ""}`}
                      >
                        <option value="NEW">NEW (접수)</option>
                        <option value="REVIEWED">REVIEWED (검토완료)</option>
                        <option value="CONTACTED">CONTACTED (연락완료)</option>
                        <option value="CONSULTATION">CONSULTATION (상담진행)</option>
                        <option value="CLOSED">CLOSED (완료/종결)</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <Link
                        href={`/admin/simulator/results/${sim.id}`}
                        className="inline-flex items-center gap-1 text-xs font-bold text-[#ff2b75] hover:underline"
                      >
                        상세보기 →
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {initialData.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-zinc-400">
                    등록되거나 검색 조건에 일치하는 시뮬레이션 제출 건이 없습니다.
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

