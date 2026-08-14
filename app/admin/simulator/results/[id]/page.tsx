import type { Metadata } from "next";
import Link from "next/link";
import { verifyAdminSession } from "@/lib/auth/dal";
import { getSimulationResultDetail } from "@/lib/simulator/admin";

export const metadata: Metadata = {
  title: "시뮬레이션 상세 결과 | K SELECT NETWORK 어드민",
};

export const dynamic = "force-dynamic";

export default async function SimulationResultDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await verifyAdminSession();
  const { id } = await params;

  const detail = await getSimulationResultDetail(id);
  if (!detail) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-400">
        시뮬레이션 상세 내역을 찾을 수 없거나 데이터베이스 오류가 발생했습니다. (ID: {id})
      </div>
    );
  }

  const { row, labelMapping } = detail;
  const res = row.result_snapshot || {};
  const trace = row.calculation_trace || {};

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

  // Helper to resolve question and answer labels
  const renderQuestionAndAnswer = (qId: string, value: any) => {
    // Try to find any option label mappings
    let qKo = qId;
    let qEn = qId;
    let aVal = "";

    const resolveValue = (v: string) => {
      const mapping = labelMapping[v];
      if (mapping) {
        qKo = mapping.qLabelKo;
        qEn = mapping.qLabelEn;
        return `${mapping.aLabelKo} (${mapping.aLabelEn})`;
      }
      return v;
    };

    if (Array.isArray(value)) {
      aVal = value.map(resolveValue).join(", ");
    } else {
      aVal = resolveValue(String(value));
    }

    return {
      qText: `${qId}. ${qKo} (${qEn})`,
      aText: aVal,
    };
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumbs and Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <Link href="/admin/simulator" className="hover:underline">GROWTH SIMULATOR</Link>
            <span>&gt;</span>
            <Link href="/admin/simulator/results" className="hover:underline">RESULTS</Link>
            <span>&gt;</span>
            <span className="font-mono text-zinc-700 dark:text-zinc-300">{id}</span>
          </div>
          <h1 className="text-xl font-bold text-zinc-950 dark:text-white">시뮬레이션 상세 분석 리포트</h1>
        </div>
        <div className="shrink-0 flex gap-2">
          <Link
            href="/admin/simulator/results"
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-850 px-3.5 py-2 text-xs font-bold transition-all cursor-pointer text-zinc-700 dark:text-zinc-300"
          >
            ← 목록으로
          </Link>
        </div>
      </div>

      {/* Grid: A & B (Summary & Projections) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Simulation Summary */}
        <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4 lg:col-span-2">
          <h2 className="text-sm font-bold text-zinc-900 dark:text-white border-b border-zinc-100 dark:border-zinc-800 pb-2">
            A. 분석 요약 (Simulation Summary)
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1">
              <span className="text-zinc-400">Simulation ID</span>
              <p className="font-mono font-semibold text-zinc-900 dark:text-white">{row.id}</p>
            </div>
            <div className="space-y-1">
              <span className="text-zinc-400">실행 일시 (Created At)</span>
              <p className="font-semibold text-zinc-900 dark:text-white">{new Date(row.created_at).toLocaleString("ko-KR")}</p>
            </div>
            <div className="space-y-1">
              <span className="text-zinc-400">컨택 이메일 (Email)</span>
              <p className="font-semibold text-zinc-900 dark:text-white">{row.email || "미입력 (이메일 수집 누락)"}</p>
            </div>
            <div className="space-y-1">
              <span className="text-zinc-400">추천 매대 프로그램 (Recommended Display)</span>
              <p className="font-semibold text-zinc-900 dark:text-white">
                <span className="rounded bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 font-bold mr-1">
                  {res.display?.program || "-"}
                </span>
                ({res.display?.width_ft}FT, {res.display?.sku_count} SKU)
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-zinc-400">주요 카테고리 구성 (Primary AP)</span>
              <p className="font-bold text-zinc-900 dark:text-white">{res.assortment?.primary || "-"} ({res.assortment?.primary_description_ko})</p>
            </div>
            <div className="space-y-1">
              <span className="text-zinc-400">보조 카테고리 구성 (Secondary AP)</span>
              <p className="font-semibold text-zinc-650 dark:text-zinc-300">{res.assortment?.secondary || "-"} ({res.assortment?.secondary_description_ko})</p>
            </div>
            <div className="space-y-1">
              <span className="text-zinc-400">예상 회전율 범위 (Expected / Conservative / Growth)</span>
              <p className="font-semibold text-zinc-900 dark:text-white">
                ~{res.financial?.turnover}회 / ~{trace.turnover_details?.scenarios?.conservative?.toFixed(1) || "-"}회 / ~{trace.turnover_details?.scenarios?.growth?.toFixed(1) || "-"}회
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-zinc-400">예산 적합도 및 신뢰도</span>
              <div className="flex gap-2 items-center mt-0.5">
                <span className={`inline-block rounded px-1.5 py-0.5 border text-[10px] font-bold ${BUDGET_BADGES[res.financial?.budget_fit] || ""}`}>
                  Budget Fit: {res.financial?.budget_fit}
                </span>
                <span className={`inline-block rounded px-1.5 py-0.5 border text-[10px] font-bold ${CONFIDENCE_BADGES[res.confidence?.level] || ""}`}>
                  Confidence: {res.confidence?.level}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Financial Projections */}
        <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
          <h2 className="text-sm font-bold text-zinc-900 dark:text-white border-b border-zinc-100 dark:border-zinc-800 pb-2">
            B. 예상 재무 지표 (Financial Projection)
          </h2>
          <div className="space-y-3 text-xs">
            <div className="flex justify-between items-center border-b border-zinc-50 dark:border-zinc-800 pb-1.5">
              <span className="text-zinc-400">초기 상품 구매액 (Initial Product Purchase)</span>
              <strong className="text-zinc-900 dark:text-white">${res.financial?.initial_product_investment?.toLocaleString() || "-"}</strong>
            </div>
            <div className="flex justify-between items-center border-b border-zinc-50 dark:border-zinc-800 pb-1.5">
              <span className="text-zinc-400">예상 연매출 (Annual Retail Sales)</span>
              <strong className="text-zinc-900 dark:text-white">${res.financial?.annual_sales?.toLocaleString() || "-"}</strong>
            </div>
            <div className="flex justify-between items-center border-b border-zinc-50 dark:border-zinc-800 pb-1.5">
              <span className="text-zinc-400">예상 총마진액 (Gross Profit)</span>
              <strong className="text-emerald-600 dark:text-emerald-400">${res.financial?.gross_profit?.toLocaleString() || "-"}</strong>
            </div>
            <div className="flex justify-between items-center pb-0.5">
              <span className="text-zinc-400">예상 원금 회수 기간 (Payback Months)</span>
              <strong className="text-zinc-900 dark:text-white">약 {res.financial?.payback_months || "-"}개월</strong>
            </div>
          </div>
          <div className="bg-zinc-50 dark:bg-zinc-900/50 p-2.5 rounded text-[10px] text-zinc-400 leading-normal border border-zinc-100 dark:border-zinc-800">
            ⚠️ 해당 지표는 입력 조건 기반의 추정치이며, 현지 상권, 품목 마크업 정책 및 운영 효율성에 따라 달라질 수 있습니다.
          </div>
        </div>
      </div>

      {/* Answer Review Section */}
      <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
        <h2 className="text-sm font-bold text-zinc-900 dark:text-white border-b border-zinc-100 dark:border-zinc-800 pb-2">
          C. 유저 답변 검토 (Answer Review)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {Object.entries(row.answers_snapshot || {}).map(([qId, val]) => {
            const { qText, aText } = renderQuestionAndAnswer(qId, val);
            return (
              <div key={qId} className="bg-zinc-50/50 dark:bg-zinc-900/20 border border-zinc-100 dark:border-zinc-800/80 p-3 rounded-lg flex flex-col gap-1">
                <span className="text-zinc-400 font-bold leading-tight">{qText}</span>
                <strong className="text-[#ff2b75] text-[13px]">{aText}</strong>
              </div>
            );
          })}
        </div>
      </div>

      {/* Version Information */}
      <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
        <h2 className="text-sm font-bold text-zinc-900 dark:text-white border-b border-zinc-100 dark:border-zinc-800 pb-2">
          D. 버전 정보 (Version Information)
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-xs text-center">
          {[
            { label: "Questionnaire", val: `v${row.questionnaire_version}` },
            { label: "Mapping Table", val: `v${row.mapping_version}` },
            { label: "Calibration Parameters", val: `v${row.calibration_version}` },
            { label: "Simulator Engine", val: `v${row.engine_version}` },
            { label: "Financial Assumptions", val: `v${row.financial_assumption_version}` },
          ].map((v, i) => (
            <div key={i} className="border border-zinc-100 dark:border-zinc-800 p-2.5 rounded-lg">
              <span className="text-zinc-400 block mb-1">{v.label}</span>
              <strong className="text-zinc-900 dark:text-white font-mono">{v.val}</strong>
            </div>
          ))}
        </div>
      </div>

      {/* Calculation Trace Section */}
      <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
        <h2 className="text-sm font-bold text-zinc-900 dark:text-white border-b border-zinc-100 dark:border-zinc-800 pb-2">
          E. 상세 연산 추적 로그 (Calculation Trace)
        </h2>
        
        <div className="space-y-4 text-xs">
          {/* Display Score Trace */}
          <div>
            <span className="font-bold text-zinc-700 dark:text-zinc-300 block mb-1.5">1. 매대 매칭 점수 (Display Module Scores)</span>
            <div className="flex gap-4">
              {Object.entries(trace.display_scores || {}).map(([key, val]: any) => (
                <div key={key} className="bg-zinc-50 dark:bg-zinc-900 px-3 py-1.5 rounded border border-zinc-100 dark:border-zinc-800">
                  <span className="text-zinc-400 uppercase mr-2">{key}:</span>
                  <strong className="text-zinc-900 dark:text-white">{val}점</strong>
                </div>
              ))}
            </div>
          </div>

          {/* AP Score Trace */}
          <div>
            <span className="font-bold text-zinc-700 dark:text-zinc-300 block mb-1.5">2. 카테고리 매칭 점수 (Assortment Profile Scores)</span>
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
              {Object.entries(trace.ap_scores || {}).map(([key, val]: any) => (
                <div key={key} className="bg-zinc-50 dark:bg-zinc-900 p-2 rounded border border-zinc-100 dark:border-zinc-800 text-center">
                  <span className="text-[10px] text-zinc-400 block uppercase mb-1">{key}</span>
                  <strong className="text-zinc-900 dark:text-white">{val}점</strong>
                </div>
              ))}
            </div>
          </div>

          {/* Constraints & Warnings */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <span className="font-bold text-zinc-700 dark:text-zinc-300 block mb-1.5">3. 적용된 제약조건 (Applied Constraints)</span>
              <ul className="list-disc list-inside bg-zinc-50 dark:bg-zinc-900 p-3 rounded border border-zinc-100 dark:border-zinc-800 space-y-1 text-zinc-650 dark:text-zinc-300">
                {trace.applied_constraints && trace.applied_constraints.length > 0 ? (
                  trace.applied_constraints.map((c: string, idx: number) => (
                    <li key={idx}>{c}</li>
                  ))
                ) : (
                  <span className="text-zinc-400">적용된 Hard Constraint가 없습니다.</span>
                )}
              </ul>
            </div>
            <div>
              <span className="font-bold text-zinc-700 dark:text-zinc-300 block mb-1.5">4. 상충 및 모순 경고 (Warnings / Contradictions)</span>
              <ul className="list-disc list-inside bg-zinc-50 dark:bg-zinc-900 p-3 rounded border border-zinc-100 dark:border-zinc-800 space-y-1 text-zinc-650 dark:text-zinc-300">
                {trace.confidence_details?.contradictions && trace.confidence_details.contradictions.length > 0 ? (
                  trace.confidence_details.contradictions.map((c: string, idx: number) => (
                    <li key={idx}>{c}</li>
                  ))
                ) : (
                  <span className="text-zinc-400">감지된 상충 관계나 모순이 없습니다.</span>
                )}
              </ul>
            </div>
          </div>

          {/* Raw JSON Trace dropdown */}
          <div className="border-t border-zinc-100 dark:border-zinc-800 pt-4">
            <details className="cursor-pointer group">
              <summary className="text-xs font-bold text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white select-none">
                ⚙️ 원본 계산 Trace JSON 데이터 보기 (Advanced Raw Trace JSON)
              </summary>
              <pre className="mt-2.5 p-4 rounded-lg bg-zinc-900 text-[11px] text-zinc-300 font-mono overflow-auto max-h-[300px] border border-zinc-800 dark:bg-black/60">
                {JSON.stringify({ row, trace }, null, 2)}
              </pre>
            </details>
          </div>
        </div>
      </div>
    </div>
  );
}
