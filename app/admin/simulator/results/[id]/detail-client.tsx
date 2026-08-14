"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { updateSimulationFollowupAction } from "@/lib/simulator/actions";

interface DetailClientProps {
  id: string;
  created_at: string;
  email: string;
  simulation_code?: string;
  revision_no?: number;
  base_simulation_id?: string;
  revision_history?: any[];
  result_snapshot: any;
  calculation_trace: any;
  labelMapping: Record<string, { qLabelKo: string; qLabelEn: string; aLabelKo: string; aLabelEn: string }>;
  answers_snapshot: Record<string, any>;
  questionnaire_version: number;
  mapping_version: number;
  calibration_version: number;
  engine_version: number;
  financial_assumption_version: number;
}

export default function SimulationDetailClient({
  id,
  created_at,
  email,
  simulation_code,
  revision_no = 0,
  base_simulation_id,
  revision_history = [],
  result_snapshot: res,
  calculation_trace: trace,
  labelMapping,
  answers_snapshot,
  questionnaire_version,
  mapping_version,
  calibration_version,
  engine_version,
  financial_assumption_version,
}: DetailClientProps) {
  const router = useRouter();

  const [followupStatus, setFollowupStatus] = useState<string>(res?.followup_status || "NEW");
  const [notes, setNotes] = useState<string>(res?.followup_notes || "");
  const [assignedStaff, setAssignedStaff] = useState<string>(res?.assigned_staff || "");
  const [isSaving, setIsSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  const isSandbox = res?.is_sandbox === true;
  const retInfo = res?.retailer_info || {};
  const storeName = retInfo.store_name || (email ? email.split("@")[0] : "Retailer Store");
  const contactName = retInfo.contact_name || "";
  const phone = retInfo.phone || "";
  const location = retInfo.location || "-";

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

  const FOLLOWUP_BADGES: Record<string, string> = {
    NEW: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900",
    REVIEWED: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-900",
    CONTACTED: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900",
    CONSULTATION: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900",
    CLOSED: "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700",
  };

  const handleSaveFollowup = async () => {
    setIsSaving(true);
    setSaveMsg("");
    try {
      const result = await updateSimulationFollowupAction({
        id,
        followupStatus,
        notes,
        assignedStaff
      });
      if (result.error) {
        setSaveMsg(`❌ ${result.error}`);
      } else {
        setSaveMsg("✅ 후속 상담 상태가 정상 저장되었습니다.");
        router.refresh();
      }
    } catch (err: any) {
      setSaveMsg(`❌ 저장 에러: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const renderQuestionAndAnswer = (qId: string, value: any) => {
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

  const invTrace = trace?.investment_trace || res?.trace?.investment_trace || {};
  const mode = invTrace.investment_calculation_mode || "FULL_ESTIMATE";

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
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-zinc-950 dark:text-white">시뮬레이션 상세 분석 및 상담 관리</h1>
            <span className="font-mono text-xs font-extrabold px-2.5 py-1 bg-zinc-900 text-cyan-400 rounded-md border border-zinc-700">
              {simulation_code || `GS-${id.substring(0, 8)}`}
            </span>
            {revision_no > 0 && (
              <span className="font-mono text-xs font-extrabold px-2 py-0.5 bg-amber-500/10 text-amber-500 border border-amber-500/30 rounded">
                REVISION R{revision_no}
              </span>
            )}
            {isSandbox ? (
              <span className="rounded bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 text-xs font-bold dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-900">
                SANDBOX / TEST
              </span>
            ) : (
              <span className="rounded bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 text-xs font-bold dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900">
                LIVE SUBMISSION
              </span>
            )}
          </div>
        </div>
        <div className="shrink-0 flex gap-2">
          <Link
            href="/admin/simulator/results"
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-850 px-3.5 py-2 text-xs font-bold transition-all cursor-pointer text-zinc-700 dark:text-zinc-300"
          >
            ← 제출 목록으로
          </Link>
        </div>
      </div>

      {/* Revision History Timeline Section */}
      {revision_history && revision_history.length > 1 && (
        <div className="rounded-lg border border-cyan-500/20 bg-cyan-950/10 p-5 dark:border-cyan-500/30 space-y-3">
          <div className="flex justify-between items-center border-b border-cyan-500/20 pb-2.5">
            <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-widest flex items-center gap-2">
              📜 ANALYSIS REVISION HISTORY ({revision_history.length} REVISIONS IN THIS SESSION)
            </h3>
            <span className="text-[11px] text-zinc-400">Base ID: {base_simulation_id || id}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 pt-1">
            {revision_history.map((rev: any) => {
              const revNo = rev.revision_no ?? 0;
              const isCurrent = rev.id === id;
              const revRes = rev.result_snapshot || {};
              const revTime = new Date(rev.created_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
              const revCode = rev.simulation_code || (revNo === 0 ? "Original" : `R${revNo}`);

              return (
                <Link
                  key={rev.id}
                  href={`/admin/simulator/results/${rev.id}`}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    isCurrent
                      ? "bg-cyan-500/20 border-cyan-500 text-white font-bold ring-1 ring-cyan-500"
                      : "bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-white"
                  }`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-mono text-xs font-black text-cyan-400">
                      {revNo === 0 ? "Original (R0)" : `Revision R${revNo}`}
                    </span>
                    {rev.is_latest && (
                      <span className="text-[9px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-1.5 py-0.2 rounded font-bold">
                        LATEST
                      </span>
                    )}
                  </div>
                  <div className="text-xs font-extrabold text-white">
                    {revRes.display?.program || "START"} · {revRes.assortment?.primary || "BALANCE"}
                  </div>
                  <div className="text-[10px] text-zinc-500 mt-1 font-mono">{revTime}</div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* 1. Follow-up Status Management Card (Item 8) */}
      <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
        <div className="flex justify-between items-center border-b border-zinc-100 dark:border-zinc-800 pb-3">
          <h2 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            📌 후속 상담 상태 관리 (Follow-up Status)
          </h2>
          <span className={`rounded px-2.5 py-1 text-xs font-bold border ${FOLLOWUP_BADGES[followupStatus] || ""}`}>
            현재 상태: {followupStatus}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="space-y-1">
            <label className="text-zinc-500 font-bold">상담 상태 (Status)</label>
            <select
              value={followupStatus}
              onChange={(e) => setFollowupStatus(e.target.value)}
              className="w-full h-9 rounded-md border border-zinc-200 bg-white px-3 font-semibold dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:outline-none"
            >
              <option value="NEW">NEW (새 제출 건 - 미검토)</option>
              <option value="REVIEWED">REVIEWED (내부 분석 완료)</option>
              <option value="CONTACTED">CONTACTED (리테일러 연락 완료)</option>
              <option value="CONSULTATION">CONSULTATION (견적 및 상담 진행 중)</option>
              <option value="CLOSED">CLOSED (계약 완료 / 종결)</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-zinc-500 font-bold">담당 직원 (Assigned Staff)</label>
            <input
              type="text"
              placeholder="담당자 이름..."
              value={assignedStaff}
              onChange={(e) => setAssignedStaff(e.target.value)}
              className="w-full h-9 rounded-md border border-zinc-200 bg-white px-3 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-zinc-500 font-bold">내부 공유 메모 (Internal Notes)</label>
            <input
              type="text"
              placeholder="상담 메모, 요구사항 기록..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full h-9 rounded-md border border-zinc-200 bg-white px-3 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:outline-none"
            />
          </div>
        </div>

        <div className="flex justify-between items-center pt-2">
          <span className="text-xs text-zinc-500 font-medium">{saveMsg}</span>
          <button
            onClick={handleSaveFollowup}
            disabled={isSaving}
            className="h-9 px-5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-md text-xs font-bold transition cursor-pointer disabled:opacity-50 dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-950"
          >
            {isSaving ? "저장 중..." : "상태 변경 저장"}
          </button>
        </div>
      </div>

      {/* 2. Grid: A. Retailer Info & B. Recommendation Summary */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Retailer Information & Summary */}
        <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4 lg:col-span-2">
          <h2 className="text-sm font-bold text-zinc-900 dark:text-white border-b border-zinc-100 dark:border-zinc-800 pb-2">
            A. 리테일러 및 시뮬레이션 개요 (Retailer Summary)
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1">
              <span className="text-zinc-400">매장명 (Store Name)</span>
              <p className="font-bold text-zinc-900 dark:text-white text-sm">{storeName}</p>
            </div>
            <div className="space-y-1">
              <span className="text-zinc-400">담당자 / 이메일</span>
              <p className="font-semibold text-zinc-900 dark:text-white">
                {contactName ? `${contactName} (${email || "미입력"})` : (email || "미입력")}
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-zinc-400">연락처 / 위치 (Phone & Location)</span>
              <p className="font-semibold text-zinc-900 dark:text-white">
                {phone || "전화번호 미입력"} / {location}
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-zinc-400">제출 일시 (Submission Date)</span>
              <p className="font-semibold text-zinc-900 dark:text-white">{new Date(created_at).toLocaleString("ko-KR")}</p>
            </div>
            <div className="space-y-1">
              <span className="text-zinc-400">추천 매대 규격 (Recommended Display)</span>
              <p className="font-semibold text-zinc-900 dark:text-white">
                <span className="rounded bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 font-extrabold mr-1">
                  {res.display?.program || "-"} ({res.display?.program === "START" ? "4FT" : res.display?.program === "GROW" ? "8FT" : "12FT"})
                </span>
                ({res.display?.sku_count} SKUs, 총 {res.display?.initial_units} Units)
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-zinc-400">주요 구색 전략 (Primary AP)</span>
              <p className="font-bold text-zinc-900 dark:text-white">{res.assortment?.primary || "-"} ({res.assortment?.primary_description_ko})</p>
            </div>
            <div className="space-y-1">
              <span className="text-zinc-400">보조 구색 전략 (Secondary AP)</span>
              <p className="font-semibold text-zinc-650 dark:text-zinc-300">{res.assortment?.secondary || "-"} ({res.assortment?.secondary_description_ko})</p>
            </div>
            <div className="space-y-1">
              <span className="text-zinc-400">분석 신뢰도 및 예산 적합도</span>
              <div className="flex gap-2 items-center mt-0.5">
                <span className={`inline-block rounded px-1.5 py-0.5 border text-[10px] font-bold ${BUDGET_BADGES[res.financial?.budget_fit] || ""}`}>
                  Budget Fit: {res.financial?.budget_fit}
                </span>
                <span className={`inline-block rounded px-1.5 py-0.5 border text-[10px] font-bold ${CONFIDENCE_BADGES[res.confidence?.level] || ""}`}>
                  Confidence: {res.confidence?.level} ({res.confidence?.accuracy_percentage}%)
                </span>
              </div>
            </div>
          </div>

          {/* Category Mix */}
          <div className="border-t border-zinc-100 dark:border-zinc-800 pt-3">
            <span className="text-xs font-bold text-zinc-500 block mb-2">권장 카테고리 믹스 (Category Mix)</span>
            <div className="flex flex-wrap gap-2 text-xs">
              {(res.assortment?.category_mix || []).map((c: any, i: number) => (
                <div key={i} className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-750">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">{c.category}:</span>
                  <strong className="text-zinc-900 dark:text-white">{c.percentage}%</strong>
                </div>
              ))}
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
              <span className="text-zinc-400">초도 상품 투자금 (Initial Investment)</span>
              <strong className="text-zinc-900 dark:text-white text-sm">${(res.financial?.initial_product_investment || res.display?.investment || 0).toLocaleString()}</strong>
            </div>
            <div className="flex justify-between items-center border-b border-zinc-50 dark:border-zinc-800 pb-1.5">
              <span className="text-zinc-400">초도 재고 수량 (Initial Inventory Units)</span>
              <strong className="text-zinc-900 dark:text-white">{res.display?.initial_units || 0} Units</strong>
            </div>
            <div className="flex justify-between items-center border-b border-zinc-50 dark:border-zinc-800 pb-1.5">
              <span className="text-zinc-400">안정기 회전율 (Steady-State Turnover)</span>
              <strong className="text-zinc-900 dark:text-white">{res.financial?.turnover || 0}회 / 년</strong>
            </div>
            <div className="flex justify-between items-center border-b border-zinc-50 dark:border-zinc-800 pb-1.5">
              <span className="text-zinc-400">1년 차 예상 매출 (Year-1 Sales)</span>
              <strong className="text-zinc-900 dark:text-white">${res.financial?.annual_sales?.toLocaleString() || "-"}</strong>
            </div>
            <div className="flex justify-between items-center border-b border-zinc-50 dark:border-zinc-800 pb-1.5">
              <span className="text-zinc-400">1년 차 예상 총이익 (Gross Profit)</span>
              <strong className="text-emerald-600 dark:text-emerald-400 font-bold">${res.financial?.gross_profit?.toLocaleString() || "-"}</strong>
            </div>
            <div className="flex justify-between items-center border-b border-zinc-50 dark:border-zinc-800 pb-1.5">
              <span className="text-zinc-400">Gross Profit ROI (투자 대비 손익)</span>
              <strong className="text-emerald-600 dark:text-emerald-400 font-bold">
                {res.financial?.initial_product_investment && res.financial?.gross_profit
                  ? `${Math.round((res.financial.gross_profit / res.financial.initial_product_investment) * 100)}%`
                  : "-"}
              </strong>
            </div>
            <div className="flex justify-between items-center pb-0.5">
              <span className="text-zinc-400">예상 원금 회수 기간 (Payback Months)</span>
              <strong className="text-zinc-900 dark:text-white">약 {res.financial?.payback_months <= 12 ? `${res.financial.payback_months}개월` : "12개월 이상"}</strong>
            </div>
          </div>
          <div className="bg-zinc-50 dark:bg-zinc-900/50 p-2.5 rounded text-[10px] text-zinc-400 leading-normal border border-zinc-100 dark:border-zinc-800">
            🔒 저장된 Engine Result Snapshot을 그대로 보존하여 조작 및 재계산 없이 원본을 보장합니다.
          </div>
        </div>
      </div>

      {/* 3. Retailer Questionnaire Answers Section (Item 5) */}
      <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
        <h2 className="text-sm font-bold text-zinc-900 dark:text-white border-b border-zinc-100 dark:border-zinc-800 pb-2 flex justify-between items-center">
          <span>C. 제출 설문 답변 내역 (Retailer Questionnaire Answers)</span>
          <span className="text-xs font-normal text-zinc-400">총 {Object.keys(answers_snapshot || {}).length}개 항목</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          {Object.entries(answers_snapshot || {}).map(([qId, val]) => {
            const { qText, aText } = renderQuestionAndAnswer(qId, val);
            return (
              <div key={qId} className="bg-zinc-50/70 dark:bg-zinc-900/40 border border-zinc-100 dark:border-zinc-800 p-3 rounded-lg flex flex-col gap-1.5">
                <span className="text-zinc-500 font-bold leading-snug">{qText}</span>
                <div className="flex justify-between items-baseline pt-0.5">
                  <strong className="text-[#ff2b75] text-[12.5px]">{aText}</strong>
                  <span className="text-[10px] font-mono text-zinc-400 bg-zinc-150 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                    {Array.isArray(val) ? val.join(", ") : String(val)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Admin Internal Calculation Information & Trace (Item 6) */}
      <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
        <h2 className="text-sm font-bold text-zinc-900 dark:text-white border-b border-zinc-100 dark:border-zinc-800 pb-2">
          D. 어드민 내부 엔진 연산 정보 (Internal Calculation Trace)
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
          <div className="p-3 bg-zinc-50 dark:bg-zinc-900 rounded border border-zinc-100 dark:border-zinc-800 space-y-1">
            <span className="text-zinc-400 block text-[10px] uppercase font-bold">Investment Mode</span>
            <strong className="text-zinc-900 dark:text-white font-mono text-sm">{mode}</strong>
          </div>
          <div className="p-3 bg-zinc-50 dark:bg-zinc-900 rounded border border-zinc-100 dark:border-zinc-800 space-y-1">
            <span className="text-zinc-400 block text-[10px] uppercase font-bold">Priced / Estimated SKUs</span>
            <strong className="text-zinc-900 dark:text-white font-mono text-sm">
              {invTrace.curation_wholesale_priced_count || invTrace.actual_priced_sku_count || 0} Priced / {invTrace.estimated_missing_sku_count || invTrace.estimated_sku_count || 0} Estimated
            </strong>
          </div>
          <div className="p-3 bg-zinc-50 dark:bg-zinc-900 rounded border border-zinc-100 dark:border-zinc-800 space-y-1">
            <span className="text-zinc-400 block text-[10px] uppercase font-bold">Average Wholesale Cost</span>
            <strong className="text-zinc-900 dark:text-white font-mono text-sm">${invTrace.estimated_wholesale_cost || 12.00}</strong>
          </div>
          <div className="p-3 bg-zinc-50 dark:bg-zinc-900 rounded border border-zinc-100 dark:border-zinc-800 space-y-1">
            <span className="text-zinc-400 block text-[10px] uppercase font-bold">Confidence Penalty Score</span>
            <strong className="text-zinc-900 dark:text-white font-mono text-sm">{trace.confidence_details?.score || 100}점</strong>
          </div>
        </div>

        {/* Display Reasons */}
        {res.display?.reasons && res.display.reasons.length > 0 && (
          <div className="text-xs space-y-1 bg-zinc-50 dark:bg-zinc-900 p-3 rounded border border-zinc-100 dark:border-zinc-800">
            <span className="font-bold text-zinc-700 dark:text-zinc-300 block mb-1">💡 추천 이유 (Recommendation Reasons)</span>
            <ul className="list-disc list-inside space-y-1 text-zinc-650 dark:text-zinc-300">
              {res.display.reasons.map((r: string, idx: number) => (
                <li key={idx}>{r}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* 5. Candidate Product Recommendations (Admin Internal View Only - Item 7) */}
      <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
        <div className="flex justify-between items-center border-b border-zinc-100 dark:border-zinc-800 pb-2">
          <div>
            <h2 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              🔒 E. 내부 추천 후보 SKU 목록 (Admin Internal Candidate Products)
            </h2>
            <p className="text-[11px] text-zinc-400">어드민 내부 전용이며, 퍼블릭 사이트 및 API에 절대로 노출되지 않습니다.</p>
          </div>
          <span className="text-[11px] font-bold text-zinc-600 bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 rounded">
            총 {(res.internal_candidate_products || res.assortment?.recommended_products || []).length}개 Candidate SKU
          </span>
        </div>

        {(res.internal_candidate_products || res.assortment?.recommended_products || []).length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 dark:bg-zinc-850 text-zinc-500 dark:text-zinc-400 font-semibold border-b border-zinc-200 dark:border-zinc-800">
                <tr>
                  <th className="py-2.5 px-3">상품 / 브랜드</th>
                  <th className="py-2.5 px-3">Curation Role</th>
                  <th className="py-2.5 px-3">Category Code</th>
                  <th className="py-2.5 px-3 text-right">MSRP (소비자가)</th>
                  <th className="py-2.5 px-3 text-right">Wholesale Price (도매가)</th>
                  <th className="py-2.5 px-3 text-center">Sales Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-zinc-800 dark:text-zinc-200">
                {(res.internal_candidate_products || res.assortment?.recommended_products || []).map((prod: any, idx: number) => (
                  <tr key={idx} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/40">
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-zinc-900 dark:text-white">{prod.name}</div>
                      <div className="text-[11px] text-zinc-400">{prod.brand_name}</div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200/50 dark:border-amber-900/50">
                        {prod.priority_role || prod.curation_role || "CORE"}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-zinc-600 dark:text-zinc-400">
                      {prod.category_code || "-"}
                    </td>
                    <td className="py-2.5 px-3 text-right font-semibold text-zinc-700 dark:text-zinc-300">
                      ${prod.estimated_retail_price || 0}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                      ${prod.wholesale_price || 0}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="inline-block px-1.5 py-0.5 rounded text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-mono">
                        {prod.sales_status || "ON_SALE"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-800/30 text-center text-xs text-zinc-400">
            <span>추천된 Candidate SKU 데이터가 없습니다.</span>
          </div>
        )}
      </div>
    </div>
  );
}
