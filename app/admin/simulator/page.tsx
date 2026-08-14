import type { Metadata } from "next";
import Link from "next/link";
import { verifyAdminSession } from "@/lib/auth/dal";
import { getSimulatorOverviewStats } from "@/lib/simulator/admin";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = {
  title: "성장 시뮬레이터 개요 | K SELECT NETWORK 어드민",
};

export const dynamic = "force-dynamic";

export default async function SimulatorOverviewPage() {
  await verifyAdminSession();

  const stats = await getSimulatorOverviewStats();
  if (!stats) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-400">
        시뮬레이션 통계 데이터를 불러오는 중 오류가 발생했습니다.
      </div>
    );
  }

  // Fetch recent simulations
  const supabase = createAdminClient();
  const { data: recentSims } = await supabase
    .from("simulation_results")
    .select("id, created_at, email, result_snapshot")
    .order("created_at", { ascending: false })
    .limit(10);

  // Helper to calculate percentages
  const getPercentage = (value: number, total: number) => {
    if (total === 0) return 0;
    return Math.round((value / total) * 100);
  };

  const DISPLAY_COLORS: Record<string, string> = {
    START: "bg-blue-500",
    GROW: "bg-emerald-500",
    EXPAND: "bg-purple-500",
  };

  const AP_COLORS: Record<string, string> = {
    BALANCE: "bg-zinc-500",
    SKIN: "bg-sky-500",
    HAIR: "bg-pink-500",
    ESSENTIAL: "bg-amber-500",
    TREND: "bg-rose-500",
    PREMIUM: "bg-violet-500",
  };

  const CONFIDENCE_COLORS: Record<string, string> = {
    HIGH: "bg-emerald-500",
    GOOD: "bg-amber-500",
    BASIC: "bg-zinc-400",
  };

  const BUDGET_COLORS: Record<string, string> = {
    HIGH: "bg-emerald-500",
    MEDIUM: "bg-sky-500",
    LOW: "bg-amber-500",
    "VERY LOW": "bg-rose-500",
  };

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
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-zinc-950 dark:text-white">성장 시뮬레이터 개요 (Overview)</h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Growth Simulator 운영 현황 및 누적 설문 완료 내역 통계 대시보드입니다.
        </p>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: "Total Simulations", value: stats.totalSimulations, desc: "전체 시뮬레이션 실행 횟수" },
          { label: "Last 7 Days", value: stats.last7Days, desc: "최근 7일 이내 실행 횟수" },
          { label: "Last 30 Days", value: stats.last30Days, desc: "최근 30일 이내 실행 횟수" },
        ].map((kpi, idx) => (
          <div
            key={idx}
            className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
          >
            <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
              {kpi.label}
            </span>
            <div className="mt-2">
              <span className="text-3xl font-extrabold text-zinc-900 dark:text-white">
                {kpi.value.toLocaleString()}
              </span>
            </div>
            <span className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1 block">
              {kpi.desc}
            </span>
          </div>
        ))}
      </div>

      {/* Distribution Section */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Recommended Display & AP Distribution */}
        <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-6">
          <div>
            <h2 className="text-sm font-bold text-zinc-900 dark:text-white">매대 규격 추천 분포 (Recommended Display)</h2>
            <div className="mt-4 space-y-3">
              {Object.entries(stats.displayDistribution).map(([key, val]) => {
                const percent = getPercentage(val, stats.totalSimulations);
                return (
                  <div key={key} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-zinc-700 dark:text-zinc-300">{key}</span>
                      <span className="text-zinc-500">{val}건 ({percent}%)</span>
                    </div>
                    <div className="h-2.5 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${DISPLAY_COLORS[key] || "bg-zinc-400"}`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="border-t border-zinc-100 dark:border-zinc-800 pt-6">
            <h2 className="text-sm font-bold text-zinc-900 dark:text-white">주요 구색 추천 분포 (Primary AP)</h2>
            <div className="mt-4 space-y-3">
              {Object.entries(stats.apDistribution).map(([key, val]) => {
                const percent = getPercentage(val, stats.totalSimulations);
                return (
                  <div key={key} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-zinc-700 dark:text-zinc-300">{key}</span>
                      <span className="text-zinc-500">{val}건 ({percent}%)</span>
                    </div>
                    <div className="h-2.5 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${AP_COLORS[key] || "bg-zinc-400"}`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Confidence & Budget Fit Distribution */}
        <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-6">
          <div>
            <h2 className="text-sm font-bold text-zinc-900 dark:text-white">분석 신뢰도 분포 (Confidence Level)</h2>
            <div className="mt-4 space-y-3">
              {Object.entries(stats.confidenceDistribution).map(([key, val]) => {
                const percent = getPercentage(val, stats.totalSimulations);
                return (
                  <div key={key} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-zinc-700 dark:text-zinc-300">{key}</span>
                      <span className="text-zinc-500">{val}건 ({percent}%)</span>
                    </div>
                    <div className="h-2.5 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${CONFIDENCE_COLORS[key] || "bg-zinc-400"}`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="border-t border-zinc-100 dark:border-zinc-800 pt-6">
            <h2 className="text-sm font-bold text-zinc-900 dark:text-white">예산 적합도 분포 (Budget Fit)</h2>
            <div className="mt-4 space-y-3">
              {Object.entries(stats.budgetDistribution).map(([key, val]) => {
                const percent = getPercentage(val, stats.totalSimulations);
                return (
                  <div key={key} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-zinc-700 dark:text-zinc-300">{key}</span>
                      <span className="text-zinc-500">{val}건 ({percent}%)</span>
                    </div>
                    <div className="h-2.5 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${BUDGET_COLORS[key] || "bg-zinc-400"}`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Simulations Table */}
      <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-zinc-900 dark:text-white">최근 실행 내역 (Recent Simulations)</h2>
          <Link
            href="/admin/simulator/results"
            className="text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white hover:underline"
          >
            전체 내역 보기 →
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs text-zinc-500 dark:text-zinc-400">
            <thead>
              <tr className="border-b border-zinc-200 font-bold text-zinc-950 dark:border-zinc-800 dark:text-white bg-zinc-50/50 dark:bg-zinc-900/50">
                <th className="px-4 py-3 font-semibold">일시 (Date)</th>
                <th className="px-4 py-3 font-semibold">Simulation ID</th>
                <th className="px-4 py-3 font-semibold">이메일 (Email)</th>
                <th className="px-4 py-3 font-semibold text-center">추천 매대</th>
                <th className="px-4 py-3 font-semibold text-center">주요 AP</th>
                <th className="px-4 py-3 font-semibold text-center">예상 회전율</th>
                <th className="px-4 py-3 font-semibold text-center">예산 적합도</th>
                <th className="px-4 py-3 font-semibold text-center">신뢰도</th>
                <th className="px-4 py-3 font-semibold text-right">상세</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {(recentSims || []).map((sim) => {
                const res = (sim.result_snapshot as any) || {};
                const displayProg = res.display?.program || "-";
                const primaryAp = res.assortment?.primary || "-";
                const turnover = res.financial?.turnover || 0;
                const budgetFit = res.financial?.budget_fit || "-";
                const confidence = res.confidence?.level || "-";

                return (
                  <tr key={sim.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50">
                    <td className="px-4 py-3">
                      {new Date(sim.created_at).toLocaleString("ko-KR")}
                    </td>
                    <td className="px-4 py-3 font-mono text-[10px] text-zinc-900 dark:text-zinc-100">
                      {sim.id.substring(0, 8)}...
                    </td>
                    <td className="px-4 py-3 font-semibold text-zinc-800 dark:text-zinc-200">
                      {sim.email || "미입력"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-block rounded bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 font-bold">
                        {displayProg}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-zinc-900 dark:text-white">
                      {primaryAp}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {turnover}회 / 년
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block rounded px-1.5 py-0.5 border text-[10px] font-bold ${BUDGET_BADGES[budgetFit] || ""}`}>
                        {budgetFit}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block rounded px-1.5 py-0.5 border text-[10px] font-bold ${CONFIDENCE_BADGES[confidence] || ""}`}>
                        {confidence}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/simulator/results/${sim.id}`}
                        className="font-bold text-[#ff2b75] hover:underline"
                      >
                        상세보기
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {(recentSims || []).length === 0 && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-zinc-400">
                    시뮬레이션 실행 기록이 존재하지 않습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
