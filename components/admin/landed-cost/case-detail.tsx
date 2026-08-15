"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  addExpense,
  updateExpense,
  deleteExpense,
  finalizeLandedCostCase,
  reopenLandedCostCase,
  autoAllocateExpense
} from "@/lib/landed-cost/actions";

interface CaseDetailProps {
  caseDetails: any;
  vendors: Array<{ id: string; name: string }>;
  receivingLinesWithCosts: any[];
}

const COST_TYPES = [
  { value: "OCEAN_FREIGHT", label: "해상 운임 (OCEAN FREIGHT)" },
  { value: "AIR_FREIGHT", label: "항공 운임 (AIR FREIGHT)" },
  { value: "DUTY", label: "관세 (DUTY)" },
  { value: "CUSTOMS_BROKER", label: "통관 수수료 (CUSTOMS BROKER)" },
  { value: "PORT_TERMINAL", label: "항만/터미널 비용 (PORT TERMINAL)" },
  { value: "TRUCKING", label: "내륙 운송료 (TRUCKING)" },
  { value: "DOMESTIC_FREIGHT", label: "미국 내 배송료 (DOMESTIC FREIGHT)" },
  { value: "INSURANCE", label: "적하 보험료 (INSURANCE)" },
  { value: "INSPECTION", label: "검사비 (INSPECTION)" },
  { value: "STORAGE_DEMURRAGE", label: "창고 보관/체선료 (STORAGE DEMURRAGE)" },
  { value: "OTHER", label: "기타 비용 (OTHER)" },
];

const ALLOCATION_METHODS = [
  { value: "CBM", label: "부피 배분 (CBM)" },
  { value: "WEIGHT", label: "중량 배분 (WEIGHT)" },
  { value: "VALUE", label: "가액 비율 배분 (VALUE)" },
  { value: "DIRECT", label: "특정 SKU 직접 배분 (DIRECT)" },
  { value: "MANUAL", label: "수동 배분 (MANUAL)" },
];

const STATUS_COLORS: Record<string, string> = {
  OPEN: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/50",
  FINALIZED: "bg-emerald-50 text-emerald-750 border-emerald-250 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/50",
};

export function CaseDetail({ caseDetails, vendors, receivingLinesWithCosts }: CaseDetailProps) {
  const router = useRouter();

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modals status
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any | null>(null);

  // Expense form fields
  const [costType, setCostType] = useState<any>("OCEAN_FREIGHT");
  const [vendorCompanyId, setVendorCompanyId] = useState("");
  const [description, setDescription] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [estimatedAmount, setEstimatedAmount] = useState(0);
  const [actualAmount, setActualAmount] = useState<number | null>(null);
  const [fxRate, setFxRate] = useState(1.0);
  const [allocationMethod, setAllocationMethod] = useState<any>("CBM");
  const [invoiceReference, setInvoiceReference] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [attachmentPath, setAttachmentPath] = useState("");

  const openAddExpenseModal = () => {
    setEditingExpense(null);
    setCostType("OCEAN_FREIGHT");
    setVendorCompanyId("");
    setDescription("");
    setCurrency("USD");
    setEstimatedAmount(0);
    setActualAmount(null);
    setFxRate(1.0);
    setAllocationMethod("CBM");
    setInvoiceReference("");
    setInvoiceDate("");
    setInternalNote("");
    setAttachmentPath("");
    setShowExpenseModal(true);
  };

  const openEditExpenseModal = (exp: any) => {
    setEditingExpense(exp);
    setCostType(exp.cost_type);
    setVendorCompanyId(exp.vendor_company_id || "");
    setDescription(exp.description || "");
    setCurrency(exp.currency);
    setEstimatedAmount(Number(exp.estimated_amount));
    setActualAmount(exp.actual_amount !== null ? Number(exp.actual_amount) : null);
    setFxRate(Number(exp.fx_rate_to_base));
    setAllocationMethod(exp.allocation_method);
    setInvoiceReference(exp.invoice_reference || "");
    setInvoiceDate(exp.invoice_date || "");
    setInternalNote(exp.internal_note || "");
    setAttachmentPath(exp.attachment_path || "");
    setShowExpenseModal(true);
  };

  const handleExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");

    const payload = {
      cost_type: costType,
      vendor_company_id: vendorCompanyId || null,
      description: description || null,
      currency,
      estimated_amount: estimatedAmount,
      actual_amount: actualAmount !== null ? Number(actualAmount) : null,
      fx_rate_to_base: fxRate,
      allocation_method: allocationMethod,
      invoice_reference: invoiceReference || null,
      invoice_date: invoiceDate || null,
      attachment_path: attachmentPath || null,
      internal_note: internalNote || null,
    };

    try {
      if (editingExpense) {
        await updateExpense(editingExpense.id, payload);
        setSuccessMessage("비용 항목이 성공적으로 업데이트되었습니다.");
      } else {
        await addExpense(caseDetails.id, payload);
        setSuccessMessage("비용 항목이 추가되었습니다.");
      }
      setShowExpenseModal(false);
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err.message || "비용 저장 도중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteExpense = async (id: string) => {
    if (!confirm("이 비용 항목을 삭제하시겠습니까? 관련 배분 내역도 함께 삭제됩니다.")) return;
    setIsSubmitting(true);
    setErrorMessage("");

    try {
      await deleteExpense(id);
      setSuccessMessage("비용 항목이 성공적으로 삭제되었습니다.");
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err.message || "비용 삭제 도중 오류가 발생했습니다.");
      setIsSubmitting(false);
    }
  };

  const handleFinalize = async () => {
    // Check finalized conditions: actual amounts must exist
    const missingActuals = (caseDetails.expenses ?? []).some(
      (exp: any) => exp.actual_amount === null || exp.actual_amount === undefined
    );
    if (missingActuals) {
      alert("모든 비용 항목에 실제 확정 금액(Actual Amount)이 기입되어 있어야 확정이 가능합니다.");
      return;
    }

    if (!confirm("이 케이스의 모든 수하물 단가를 확정하고 FIFO Cost Layer를 활성화하시겠습니까? 확정 시 수정할 수 없습니다.")) return;

    setIsSubmitting(true);
    setErrorMessage("");
    try {
      await finalizeLandedCostCase(caseDetails.id);
      setSuccessMessage("Landed Cost가 최종 확정되었습니다! FIFO 재고 레이어가 생성되었습니다.");
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err.message || "확정 도중 오류가 발생했습니다.");
      setIsSubmitting(false);
    }
  };

  const handleReopen = async () => {
    const reason = prompt("Landed Cost 케이스를 재개하려는 사유를 입력해주세요:");
    if (reason === null) return; // Cancelled prompt
    if (!reason.trim()) {
      alert("재개 사유를 반드시 작성하셔야 합니다.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    try {
      await reopenLandedCostCase(caseDetails.id, reason);
      setSuccessMessage("정산 케이스가 성공적으로 재개(OPEN)되었습니다.");
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err.message || "재개 도중 오류가 발생했습니다.");
      setIsSubmitting(false);
    }
  };

  // Aggregated Cost calculations
  const totalSupplierCost = receivingLinesWithCosts.reduce((sum, l) => sum + l.supplier_acquisition_cost, 0);

  // Sum ancillary base currency expenses
  const expensesList = caseDetails.expenses ?? [];
  const totalBaseExpenses = expensesList.reduce((sum: number, exp: any) => sum + Number(exp.base_currency_amount), 0);

  // Sum allocated costs to receiving lines
  const totalLandedCost = totalSupplierCost + totalBaseExpenses;

  return (
    <div className="space-y-6 text-xs">
      
      {/* Breadcrumbs */}
      <div className="flex flex-col gap-2">
        <div className="text-[10px] text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-wider font-sans">
          Admin / Finance / Landed Cost
        </div>
        <div>
          <Link
            href="/admin/finance/landed-cost"
            className="text-xs text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors"
          >
            ← Landed Cost 케이스 목록으로 돌아가기
          </Link>
        </div>
      </div>

      {successMessage && (
        <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-250 text-emerald-700 font-bold">
          ✅ {successMessage}
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-250 text-rose-600 font-bold dark:bg-rose-955/10 dark:border-rose-900/50 dark:text-rose-450">
          ⚠️ {errorMessage}
        </div>
      )}

      {/* Operation Control Bar */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-bold text-zinc-900 dark:text-white font-mono">{caseDetails.landed_cost_number}</h1>
            <span className={`inline-flex items-center rounded px-2.5 py-0.5 border text-[9px] font-bold ${STATUS_COLORS[caseDetails.status]}`}>
              {caseDetails.status === "OPEN" ? "기입 중 (Open)" : "확정됨 (Finalized)"}
            </span>
          </div>
          <p className="text-zinc-500 dark:text-zinc-400 font-medium">설명: {caseDetails.description || "지정 없음"}</p>
        </div>

        <div className="flex items-center gap-2">
          {caseDetails.status === "OPEN" ? (
            <>
              <button
                onClick={openAddExpenseModal}
                disabled={isSubmitting}
                className="px-3.5 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-750 dark:text-zinc-300 font-bold rounded-xl cursor-pointer transition-colors"
              >
                + 비용 항목 기입 (Add Expense)
              </button>
              <button
                onClick={handleFinalize}
                disabled={isSubmitting}
                className="px-4 py-2 bg-zinc-950 hover:bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 font-bold rounded-xl cursor-pointer transition-all shadow-sm"
              >
                🔒 원가 최종 확정 (Finalize)
              </button>
            </>
          ) : (
            <button
              onClick={handleReopen}
              disabled={isSubmitting}
              className="px-4 py-2 bg-rose-650 hover:bg-rose-700 text-white font-bold rounded-xl cursor-pointer transition-colors"
            >
              🔓 정산 재개 (Reopen Case)
            </button>
          )}
        </div>
      </div>

      {/* Grid layouts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Area: Shipments list & Expenses worksheet */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Consolidated Shipments */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-3">
            <h3 className="text-xs font-bold text-zinc-450 dark:text-zinc-500 uppercase tracking-wider">
              대상 선적 (Consolidated Shipments)
            </h3>
            <div className="flex flex-wrap gap-2 pt-1">
              {(caseDetails.shipments ?? []).map((s: any, idx: number) => (
                <div key={idx} className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded-lg p-3 w-44 space-y-1.5 font-medium">
                  <div className="flex justify-between items-center">
                    <span className="font-mono font-bold text-indigo-650 hover:underline">
                      <Link href={`/admin/purchasing/shipments/${s.shipment?.id}`}>
                        {s.shipment?.shipment_number}
                      </Link>
                    </span>
                    <span className="text-[8px] px-1 py-0.5 bg-zinc-150 rounded font-bold text-zinc-500">
                      {s.shipment?.status}
                    </span>
                  </div>
                  <div className="text-[10px] text-zinc-400">
                    PO: {s.shipment?.po?.po_number}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Ancillary Expenses worksheet */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
            <h3 className="text-xs font-bold text-zinc-450 dark:text-zinc-500 uppercase tracking-wider border-b border-zinc-150 pb-2 dark:border-zinc-800">
              추가 제비용 관리 (Ancillary Expenses)
            </h3>

            <div className="overflow-hidden rounded-lg border border-zinc-150 dark:border-zinc-800/80">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-zinc-50 border-b border-zinc-150 dark:bg-zinc-900/50 dark:border-zinc-800 text-zinc-500 font-bold dark:text-zinc-350">
                    <th className="px-3 py-2.5">비용 종류</th>
                    <th className="px-3 py-2.5">청구 공급업체</th>
                    <th className="px-3 py-2.5">배분 수단</th>
                    <th className="px-3 py-2.5 text-right">예상 금액 (Est)</th>
                    <th className="px-3 py-2.5 text-right">확정 금액 (Act)</th>
                    <th className="px-3 py-2.5 text-right">환산금액 (USD)</th>
                    {caseDetails.status === "OPEN" && <th className="px-3 py-2.5 text-center w-28">작업</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {expensesList.length === 0 ? (
                    <tr>
                      <td colSpan={caseDetails.status === "OPEN" ? 7 : 6} className="px-3 py-8 text-center text-zinc-400 italic">
                        추가 기입된 제비용(운임/관세/통관료 등)이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    expensesList.map((exp: any) => (
                      <tr key={exp.id} className="hover:bg-zinc-50/20 dark:hover:bg-zinc-850/5">
                        <td className="px-3 py-3 font-semibold text-zinc-800 dark:text-zinc-200">
                          {exp.cost_type}
                        </td>
                        <td className="px-3 py-3 text-zinc-550">
                          {exp.vendor?.name || <span className="text-zinc-350 italic">미정</span>}
                        </td>
                        <td className="px-3 py-3">
                          <span className="px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 rounded font-semibold text-zinc-650">
                            {exp.allocation_method}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right font-mono text-zinc-650">
                          {exp.currency} {Number(exp.estimated_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-3 py-3 text-right font-mono font-semibold">
                          {exp.actual_amount !== null ? (
                            <span className="text-zinc-900 dark:text-zinc-200">
                              {exp.currency} {Number(exp.actual_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>
                          ) : (
                            <span className="text-rose-500 font-bold">확정대기</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right font-mono font-bold text-zinc-900 dark:text-white">
                          USD {Number(exp.base_currency_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        {caseDetails.status === "OPEN" && (
                          <td className="px-3 py-3 text-center space-x-1.5">
                            <button
                              onClick={() => openEditExpenseModal(exp)}
                              className="px-2 py-1 text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded font-bold transition-colors cursor-pointer"
                            >
                              수정
                            </button>
                            <button
                              onClick={() => handleDeleteExpense(exp.id)}
                              className="px-2 py-1 text-white bg-rose-600 hover:bg-rose-700 rounded font-bold transition-colors cursor-pointer"
                            >
                              삭제
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* SKU calculation worksheet table */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4 overflow-hidden">
            <h3 className="text-xs font-bold text-zinc-450 dark:text-zinc-500 uppercase tracking-wider border-b border-zinc-150 pb-2 dark:border-zinc-800">
              SKU별 원가 정산 시트 (SKU Costing Spreadsheet)
            </h3>

            <div className="overflow-x-auto rounded-lg border border-zinc-150 dark:border-zinc-800/80">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-zinc-50 border-b border-zinc-150 dark:bg-zinc-900/50 dark:border-zinc-800 text-zinc-500 font-bold dark:text-zinc-350">
                    <th className="px-3 py-2.5">SKU</th>
                    <th className="px-3 py-2.5">상품명</th>
                    <th className="px-3 py-2.5 text-right w-20">입고수량</th>
                    <th className="px-3 py-2.5 text-right w-28">공급원가 / unit</th>
                    <th className="px-3 py-2.5 text-right w-28">물류비배분 / unit</th>
                    <th className="px-3 py-2.5 text-right w-28">총 Landed Cost / unit</th>
                    <th className="px-3 py-2.5 text-right w-32">총 원가 합계</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {receivingLinesWithCosts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-8 text-center text-zinc-400 italic">
                        정산 대상 SKU 품목 정보가 없습니다.
                      </td>
                    </tr>
                  ) : (
                    receivingLinesWithCosts.map((line) => {
                      // Sum of allocations for this receiving line
                      let lineAncillary = 0;
                      expensesList.forEach((exp: any) => {
                        const alloc = (exp.allocations ?? []).find(
                          (a: any) => a.receiving_line_id === line.id
                        );
                        if (alloc) {
                          lineAncillary += Number(alloc.allocated_amount);
                        }
                      });

                      const unitAncillary = line.received_qty > 0 ? (lineAncillary / line.received_qty) : 0;
                      const unitLanded = line.unit_supplier_cost + unitAncillary;
                      const totalLanded = line.supplier_acquisition_cost + lineAncillary;

                      return (
                        <tr key={line.id} className="hover:bg-zinc-50/20 dark:hover:bg-zinc-850/5">
                          <td className="px-3 py-3 font-mono font-bold text-zinc-900 dark:text-zinc-200">
                            {line.sku}
                          </td>
                          <td className="px-3 py-3 truncate max-w-xs">
                            {line.name}
                          </td>
                          <td className="px-3 py-3 text-right font-mono">
                            {line.received_qty.toLocaleString()}
                          </td>
                          <td className="px-3 py-3 text-right font-mono text-zinc-600 dark:text-zinc-400">
                            USD {line.unit_supplier_cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                          </td>
                          <td className="px-3 py-3 text-right font-mono text-indigo-650 font-medium">
                            +USD {unitAncillary.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                          </td>
                          <td className="px-3 py-3 text-right font-mono font-bold text-emerald-700 dark:text-emerald-400">
                            USD {unitLanded.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                          </td>
                          <td className="px-3 py-3 text-right font-mono font-bold text-zinc-900 dark:text-white">
                            USD {totalLanded.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* Right Area: Cost structure breakdown summaries */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Landed Cost Consolidation Summary Card */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
            <h3 className="text-xs font-bold text-zinc-450 dark:text-zinc-500 uppercase tracking-wider border-b border-zinc-150 pb-2 dark:border-zinc-800">
              정산 총괄 요약 (Consolidated Summary)
            </h3>

            <div className="space-y-4 font-semibold">
              <div>
                <span className="text-[10px] text-zinc-400 block mb-0.5">공급사 매입액 (Acquisition Cost)</span>
                <span className="font-mono text-sm text-zinc-900 dark:text-white">
                  USD {totalSupplierCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="border-t border-zinc-100 pt-3 dark:border-zinc-850">
                <span className="text-[10px] text-zinc-400 block mb-0.5">물류/기타 제비용 (Ancillary Cost)</span>
                <span className="font-mono text-sm text-indigo-650">
                  +USD {totalBaseExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="border-t border-zinc-150 pt-3 dark:border-zinc-850 bg-zinc-50 dark:bg-zinc-950 p-3 rounded-lg">
                <span className="text-[10px] text-emerald-650 block font-bold mb-0.5">총 창고 도착 원가 (Total Landed Cost)</span>
                <span className="font-mono text-lg font-bold text-emerald-700 dark:text-emerald-400">
                  USD {totalLandedCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="text-[10px] text-zinc-400 font-bold border-t border-zinc-100 pt-3 dark:border-zinc-800 space-y-1">
                <div>* 상태: {caseDetails.status === "FINALIZED" ? "원가 확정 완료" : "원가 기입/조정 중"}</div>
                <div>* 확정 시 미국 창고 실재고의 FIFO 원가 레이어가 가동됩니다.</div>
              </div>
            </div>
          </div>

          {/* Audit trail */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-2">
            <h4 className="font-bold text-zinc-450 dark:text-zinc-500 uppercase tracking-wide">처리 감사 정보 (Audit Trail)</h4>
            <div className="space-y-3.5 border-t border-zinc-100 pt-3 dark:border-zinc-850">
              <div>
                <span className="text-[9px] text-zinc-400 block">생성 담당자</span>
                <span className="font-bold">{caseDetails.creator?.full_name || "System"}</span>
                <span className="text-[8px] text-zinc-400 font-mono block">{new Date(caseDetails.created_at).toLocaleString()}</span>
              </div>
              {caseDetails.finalized_at && (
                <div>
                  <span className="text-[9px] text-zinc-400 block">원가 최종 확정자</span>
                  <span className="font-bold text-emerald-600">{caseDetails.finalizer?.full_name || "-"}</span>
                  <span className="text-[8px] text-zinc-400 font-mono block">{new Date(caseDetails.finalized_at).toLocaleString()}</span>
                </div>
              )}
              {caseDetails.reopened_at && (
                <div className="p-2.5 bg-rose-50 border border-rose-150 rounded-lg">
                  <span className="text-[9px] text-rose-500 block font-bold">마지막 정산 재개(Reopen)</span>
                  <span className="font-bold">{caseDetails.reopener?.full_name || "-"}</span>
                  <span className="text-[8px] text-zinc-400 font-mono block mb-1">{new Date(caseDetails.reopened_at).toLocaleString()}</span>
                  <div className="text-[9px] text-rose-700 italic">사유: {caseDetails.reopen_reason}</div>
                </div>
              )}
            </div>
          </div>

        </div>

      </div>

      {/* Expense Modal (Add / Edit) */}
      {showExpenseModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 w-full max-w-md rounded-xl p-5 shadow-xl space-y-4">
            <h4 className="text-sm font-bold text-zinc-850 dark:text-white font-sans border-b border-zinc-100 pb-2 dark:border-zinc-800">
              {editingExpense ? "비용 항목 수정 (Edit Expense)" : "비용 항목 기입 (Add Expense)"}
            </h4>

            <form onSubmit={handleExpenseSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 mb-1">비용 종류 *</label>
                  <select
                    value={costType}
                    onChange={(e) => setCostType(e.target.value as any)}
                    className="w-full h-8 border border-zinc-250 bg-white dark:border-zinc-800 dark:bg-zinc-950 dark:text-white px-2 outline-none rounded-lg"
                    required
                  >
                    {COST_TYPES.map(ct => (
                      <option key={ct.value} value={ct.value}>{ct.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 mb-1">배분 수단 (Allocation) *</label>
                  <select
                    value={allocationMethod}
                    onChange={(e) => setAllocationMethod(e.target.value as any)}
                    className="w-full h-8 border border-zinc-250 bg-white dark:border-zinc-800 dark:bg-zinc-955 dark:text-white px-2 outline-none rounded-lg"
                    required
                  >
                    {ALLOCATION_METHODS.map(am => (
                      <option key={am.value} value={am.value}>{am.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-400 mb-1">청구 벤더 / 공급사</label>
                <select
                  value={vendorCompanyId}
                  onChange={(e) => setVendorCompanyId(e.target.value)}
                  className="w-full h-8 border border-zinc-250 bg-white dark:border-zinc-800 dark:bg-zinc-955 dark:text-white px-2 outline-none rounded-lg"
                >
                  <option value="">벤더 선택...</option>
                  {vendors.map(v => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 mb-1">예상 금액 (Est) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={estimatedAmount || ""}
                    onChange={(e) => setEstimatedAmount(parseFloat(e.target.value) || 0)}
                    className="w-full h-8 border border-zinc-250 bg-white dark:border-zinc-800 dark:bg-zinc-955 dark:text-white px-2 outline-none rounded-lg font-mono font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 mb-1">실제 확정 금액 (Act)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="확정대기"
                    value={actualAmount !== null ? actualAmount : ""}
                    onChange={(e) => setActualAmount(e.target.value !== "" ? parseFloat(e.target.value) : null)}
                    className="w-full h-8 border border-zinc-250 bg-white dark:border-zinc-800 dark:bg-zinc-955 dark:text-white px-2 outline-none rounded-lg font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 mb-1">통화 (Currency) *</label>
                  <input
                    type="text"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                    className="w-full h-8 border border-zinc-250 bg-white dark:border-zinc-800 dark:bg-zinc-955 dark:text-white px-2 outline-none rounded-lg font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 mb-1">원화/외화 환율 (FX Rate to Base) *</label>
                  <input
                    type="number"
                    step="0.000001"
                    min="0.000001"
                    value={fxRate || ""}
                    onChange={(e) => setFxRate(parseFloat(e.target.value) || 1.0)}
                    className="w-full h-8 border border-zinc-250 bg-white dark:border-zinc-800 dark:bg-zinc-955 dark:text-white px-2 outline-none rounded-lg font-mono font-bold"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 mb-1">인보이스 참조번호 (Invoice Ref)</label>
                  <input
                    type="text"
                    placeholder="예: INV-FREIGHT-90"
                    value={invoiceReference}
                    onChange={(e) => setInvoiceReference(e.target.value)}
                    className="w-full h-8 border border-zinc-250 bg-white dark:border-zinc-800 dark:bg-zinc-955 dark:text-white px-2 outline-none rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 mb-1">발행 일자 (Invoice Date)</label>
                  <input
                    type="date"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    className="w-full h-8 border border-zinc-250 bg-white dark:border-zinc-800 dark:bg-zinc-955 dark:text-white px-2 outline-none rounded-lg font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-400 mb-1">비용 설명</label>
                <input
                  type="text"
                  placeholder="예: 물량 과다에 따른 보관 수수료"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full h-8 border border-zinc-250 bg-white dark:border-zinc-800 dark:bg-zinc-955 dark:text-white px-2 outline-none rounded-lg"
                />
              </div>

              {allocationMethod === "MANUAL" && (
                <div className="p-2 bg-zinc-50 border border-zinc-200 text-[9px] text-zinc-500 rounded-lg">
                  💡 MANUAL(수동) 배분을 선택하신 경우, 비용 저장 후 전체 SKU 원가 시트 금액 비중으로 초기화됩니다. 특정 품목의 할당 비중 조정은 정산 시트 완료 후 DB/E2E 레벨에서 정교하게 차이가 반영됩니다.
                </div>
              )}

              <div className="flex justify-end gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowExpenseModal(false)}
                  className="px-3.5 py-1.5 border border-zinc-200 bg-white hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800 rounded-lg font-bold cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 bg-zinc-950 hover:bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 font-bold rounded-lg cursor-pointer disabled:opacity-50"
                >
                  비용 저장
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
