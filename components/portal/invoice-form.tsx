"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  getPoLinesForInvoice,
  createPortalInvoiceDraft,
  updatePortalInvoiceDraft,
  uploadPortalInvoiceAttachment,
  getPortalSupplierRemittance
} from "@/lib/portal/actions";

interface PoOption {
  id: string;
  po_number: string;
  order_date: string;
  currency: string;
  hasActiveInvoice?: boolean;
  activeInvoiceId?: string | null;
  activeInvoiceStatus?: string | null;
  activeInvoiceNumber?: string | null;
  activeApNumber?: string | null;
  activeInvoiceTotal?: number | null;
}

interface InvoiceFormProps {
  eligiblePos: PoOption[];
  initialInvoice?: any; // Used for edit mode
}

export function InvoiceForm({ eligiblePos, initialInvoice }: InvoiceFormProps) {
  const router = useRouter();
  const isEditMode = !!initialInvoice;

  // Form Fields
  const [selectedPoId, setSelectedPoId] = useState(initialInvoice?.purchaseOrderId || "");
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState(initialInvoice?.supplierInvoiceNumber || "");
  
  // Set default invoice date to today
  const [invoiceDate, setInvoiceDate] = useState(
    initialInvoice?.invoiceDate || new Date().toISOString().split("T")[0]
  );
  
  // Set default due date to 30 days from today
  const [dueDate, setDueDate] = useState(
    initialInvoice?.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  );

  const [currency, setCurrency] = useState(initialInvoice?.currency || "USD");

  // Remittance
  const [remittance, setRemittance] = useState<any>(null);
  const [loadingRemittance, setLoadingRemittance] = useState(false);

  useEffect(() => {
    const loadRemittance = async () => {
      setLoadingRemittance(true);
      try {
        const rem = await getPortalSupplierRemittance();
        setRemittance(rem);
      } catch (e) {
        console.error("Failed to load remittance:", e);
      } finally {
        setLoadingRemittance(false);
      }
    };
    loadRemittance();
  }, []);

  // Attachments
  const [attachmentPath, setAttachmentPath] = useState<string | null>(initialInvoice?.attachmentPath || null);
  const [attachmentFilename, setAttachmentFilename] = useState<string | null>(
    initialInvoice?.attachmentPath ? "업로드된 인보이스.pdf" : null
  );

  // PO Lines
  const [lines, setLines] = useState<any[]>([]);
  const [loadingLines, setLoadingLines] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Adjustments State
  interface AdjustmentItemInput {
    id?: string;
    type: "PLUS" | "MINUS";
    reason: string;
    amount: number;
    note: string;
  }

  const [adjustments, setAdjustments] = useState<AdjustmentItemInput[]>(() => {
    if (initialInvoice?.adjustments && Array.isArray(initialInvoice.adjustments)) {
      return initialInvoice.adjustments.map((a: any) => ({
        id: a.id,
        type: (a.plusMinusType || (a.direction === 'CHARGE' ? 'PLUS' : 'MINUS')) as "PLUS" | "MINUS",
        reason: a.reason || "",
        amount: Number(a.amount || 0),
        note: a.note || a.internalNote || ""
      }));
    }
    return [];
  });

  const handleAddAdjustment = (presetType: "PLUS" | "MINUS" = "PLUS", presetReason: string = "") => {
    setAdjustments(prev => [
      ...prev,
      {
        type: presetType,
        reason: presetReason,
        amount: 0,
        note: ""
      }
    ]);
  };

  const handleRemoveAdjustment = (index: number) => {
    setAdjustments(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleAdjustmentChange = (index: number, field: keyof AdjustmentItemInput, val: any) => {
    setAdjustments(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        [field]: val
      };
      return updated;
    });
  };

  // Line Invoiced quantities & notes
  const [lineInputs, setLineInputs] = useState<Record<string, {
    invoicedQty: number;
    unitPrice: number;
    lineNote: string;
  }>>({});

  // Auto-load PO lines when selectedPoId changes
  useEffect(() => {
    if (!selectedPoId) {
      setLines([]);
      setLineInputs({});
      return;
    }

    const loadPoLines = async () => {
      setLoadingLines(true);
      setErrorMessage("");
      try {
        const res = await getPoLinesForInvoice(selectedPoId, initialInvoice?.id);
        setCurrency(res.currency);
        setLines(res.lines);

        const initialInputs: typeof lineInputs = {};
        res.lines.forEach((l: any) => {
          // If editing, load original invoiced quantity
          const existingLine = initialInvoice?.lines?.find(
            (el: any) => el.purchaseOrderLineId === l.purchaseOrderLineId
          );

          initialInputs[l.purchaseOrderLineId] = {
            invoicedQty: existingLine ? existingLine.invoicedQty : Math.max(0, l.receivedQty - l.alreadyInvoicedQty),
            unitPrice: existingLine ? existingLine.unitPrice : l.unitCost,
            lineNote: existingLine?.lineNote || ""
          };
        });

        setLineInputs(initialInputs);
      } catch (err: any) {
        setErrorMessage(err.message || "발주 품목 로드 실패");
      } finally {
        setLoadingLines(false);
      }
    };

    loadPoLines();
  }, [selectedPoId, initialInvoice]);

  const handleLineFieldChange = (poLineId: string, field: "invoicedQty" | "unitPrice" | "lineNote", val: any) => {
    setLineInputs(prev => ({
      ...prev,
      [poLineId]: {
        ...prev[poLineId],
        [field]: val
      }
    }));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMessage("");
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await uploadPortalInvoiceAttachment(formData);
      if (res.error) throw new Error(res.error);

      setAttachmentPath(res.path || null);
      setAttachmentFilename(res.filename || null);
      setSuccessMessage("인보이스 파일이 성공적으로 업로드되었습니다.");
    } catch (err: any) {
      setErrorMessage(err.message || "파일 업로드 실패");
    }
  };

  // Calculate totals
  const subtotal = Object.values(lineInputs).reduce((sum, item) => {
    return sum + (item.invoicedQty * item.unitPrice);
  }, 0);

  const baseInvoiceAmount = subtotal;
  const adjustmentTotal = adjustments.reduce((sum, adj) => {
    const amt = Number(adj.amount) || 0;
    return adj.type === "PLUS" ? sum + amt : sum - amt;
  }, 0);
  const finalInvoiceAmount = Number((baseInvoiceAmount + adjustmentTotal).toFixed(2));

  const poConfirmedValue = lines.reduce((sum, l) => sum + ((l.confirmedQty || 0) * (l.unitCost || 0)), 0);
  const previouslyInvoicedAmount = lines.reduce((sum, l) => sum + (l.alreadyInvoicedAmount || 0), 0);
  const currentInvoiceAmount = finalInvoiceAmount;
  const cumulativeInvoicedAmount = previouslyInvoicedAmount + currentInvoiceAmount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPoId) {
      setErrorMessage("발주서(PO)를 먼저 선택하세요.");
      return;
    }
    if (!supplierInvoiceNumber.trim()) {
      setErrorMessage("인보이스 번호(Invoice Number)를 입력하세요.");
      return;
    }

    const payloadLines = Object.entries(lineInputs).map(([poLineId, input]) => {
      const originalLine = lines.find(l => l.purchaseOrderLineId === poLineId);
      return {
        purchaseOrderLineId: poLineId,
        productId: originalLine?.productId || "",
        invoicedQty: Number(input.invoicedQty),
        unitPrice: Number(input.unitPrice),
        lineNote: input.lineNote
      };
    });

    if (payloadLines.some(l => l.invoicedQty < 0 || l.unitPrice < 0)) {
      setErrorMessage("모든 수량 및 단가는 0 이상이어야 합니다.");
      return;
    }

    // Validate adjustments
    for (let i = 0; i < adjustments.length; i++) {
      const adj = adjustments[i];
      if (!adj.reason.trim()) {
        setErrorMessage(`조정 항목 #${i + 1}의 사유(Reason)를 입력해 주세요.`);
        return;
      }
      if (Number(adj.amount) <= 0) {
        setErrorMessage(`조정 항목 #${i + 1}의 금액은 0보다 커야 합니다.`);
        return;
      }
    }

    if (finalInvoiceAmount < 0) {
      setErrorMessage("최종 인보이스 청구 금액(Final Invoice Amount)은 0 이상이어야 합니다. 조정 금액을 확인해주세요.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    const payloadAdjustments = adjustments.map(adj => ({
      id: adj.id,
      type: adj.type,
      reason: adj.reason.trim(),
      amount: Number(adj.amount),
      note: adj.note.trim()
    }));

    try {
      if (isEditMode) {
        await updatePortalInvoiceDraft({
          id: initialInvoice.id,
          supplierInvoiceNumber,
          invoiceDate,
          dueDate,
          attachmentPath,
          lines: payloadLines,
          adjustments: payloadAdjustments
        });
        setSuccessMessage("인보이스가 수정되었습니다.");
        setTimeout(() => {
          router.push(`/portal/finance/${initialInvoice.id}`);
          router.refresh();
        }, 1000);
      } else {
        const res = await createPortalInvoiceDraft({
          purchaseOrderId: selectedPoId,
          supplierInvoiceNumber,
          invoiceDate,
          dueDate,
          attachmentPath,
          lines: payloadLines,
          adjustments: payloadAdjustments
        });
        setSuccessMessage("인보이스 초안이 작성되었습니다.");
        setTimeout(() => {
          router.push(`/portal/finance/${res.id}`);
          router.refresh();
        }, 1000);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "저장 실패");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {errorMessage && (
        <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-250 text-rose-700 dark:bg-rose-950/40 dark:border-rose-900/60 dark:text-rose-300 font-bold text-xs font-sans">
          ⚠️ {errorMessage}
        </div>
      )}
      {successMessage && (
        <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-250 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-900/60 dark:text-emerald-300 font-bold text-xs font-sans">
          ✅ {successMessage}
        </div>
      )}

      {/* Basic Meta Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-5 rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 space-y-4 shadow-sm">
          <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 border-b border-zinc-150 dark:border-zinc-800 pb-2">
            발주 및 기본 정보
          </h2>

          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 mb-1">관련 발주서 (PO) *</label>
              {isEditMode ? (
                <div className="px-3 py-2 bg-zinc-50 border border-zinc-200 dark:bg-zinc-950 dark:border-zinc-800 rounded-lg text-xs font-mono font-bold text-zinc-700 dark:text-zinc-300">
                  {initialInvoice.poNumber}
                </div>
              ) : (
                <div className="space-y-2">
                  <select
                    value={selectedPoId}
                    onChange={(e) => setSelectedPoId(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100"
                    required
                  >
                    <option value="">-- 발주서 선택 --</option>
                    {eligiblePos.map((po) => {
                      const isDraft = po.hasActiveInvoice && po.activeInvoiceStatus === "DRAFT";
                      const isLocked = po.hasActiveInvoice && po.activeInvoiceStatus !== "DRAFT";
                      return (
                        <option
                          key={po.id}
                          value={po.id}
                          disabled={isLocked}
                        >
                          {po.po_number} ({po.order_date})
                          {isDraft ? ` [작성 중인 Draft 있음]` : isLocked ? ` [진행 중인 인보이스: ${po.activeApNumber || po.activeInvoiceNumber} (${po.activeInvoiceStatus})]` : ""}
                        </option>
                      );
                    })}
                  </select>

                  {/* Duplicate Active Invoice Warning */}
                  {(() => {
                    const selectedPo = eligiblePos.find((p) => p.id === selectedPoId);
                    if (!selectedPo?.hasActiveInvoice) return null;
                    const isDraft = selectedPo.activeInvoiceStatus === "DRAFT";
                    return (
                      <div className="p-3 bg-amber-50 border border-amber-250 rounded-lg dark:bg-amber-950/40 dark:border-amber-900/60 text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between gap-2">
                        <div>
                          ⚠️ <strong>안내:</strong> 해당 발주서(PO)에 이미 등록된 인보이스(
                          <strong>{selectedPo.activeApNumber || selectedPo.activeInvoiceNumber}</strong>, 상태:{" "}
                          <strong>{selectedPo.activeInvoiceStatus}</strong>)가 존재합니다.
                        </div>
                        {isDraft && selectedPo.activeInvoiceId && (
                          <Link
                            href={`/portal/finance/${selectedPo.activeInvoiceId}/edit`}
                            className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded text-[11px] whitespace-nowrap transition-colors"
                          >
                            기존 Draft 열기 →
                          </Link>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 mb-1">인보이스 번호 (Invoice No.) *</label>
              <input
                type="text"
                value={supplierInvoiceNumber}
                onChange={(e) => setSupplierInvoiceNumber(e.target.value)}
                placeholder="예: TEST-INV-001"
                className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 font-mono font-bold"
                required
              />
            </div>
          </div>
        </div>

        <div className="p-5 rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 space-y-4 shadow-sm">
          <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 border-b border-zinc-150 dark:border-zinc-800 pb-2">
            거래 일자 및 첨부파일
          </h2>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 mb-1">발행 일자 (Invoice Date) *</label>
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 mb-1">만기 일자 (Due Date) *</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 mb-1">인보이스 PDF 파일</label>
              <div className="flex items-center gap-3">
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="pdf-upload"
                />
                <label
                  htmlFor="pdf-upload"
                  className="px-3.5 py-1.5 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-lg text-xs font-bold text-zinc-700 dark:text-zinc-200 cursor-pointer transition-colors"
                >
                  파일 선택 (PDF)
                </label>
                <span className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate max-w-[200px]">
                  {attachmentFilename || "업로드된 파일 없음"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Remittance Bank Account Card */}
        <div className="p-5 rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 space-y-3 shadow-sm md:col-span-2">
          <div className="flex items-center justify-between border-b border-zinc-150 dark:border-zinc-800 pb-2">
            <div>
              <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                수취 계좌 정보 (Remittance Bank Account)
              </h2>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                인보이스 발행 시 회사에 등록된 송금 수취 계좌가 스냅샷으로 저장되어 정산 대금 지급 시 사용됩니다.
              </p>
            </div>
            <Link
              href="/portal/company/info"
              className="px-2.5 py-1 text-[11px] font-bold border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-lg text-zinc-700 dark:text-zinc-300 transition-colors"
            >
              ⚙️ 계좌 관리
            </Link>
          </div>

          {loadingRemittance ? (
            <p className="text-xs text-zinc-400 dark:text-zinc-500 italic">계좌 정보 로딩 중...</p>
          ) : remittance ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs pt-1">
              <div>
                <span className="text-[10px] font-bold text-zinc-400 block mb-0.5">수취 은행</span>
                <span className="font-bold text-zinc-900 dark:text-zinc-100">{remittance.bank_name || "-"}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-zinc-400 block mb-0.5">예금주 (Beneficiary)</span>
                <span className="font-bold text-zinc-900 dark:text-zinc-100">{remittance.beneficiary_name || "-"}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-zinc-400 block mb-0.5">계좌 번호</span>
                <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">
                  {remittance.account_number ? `**** ${remittance.account_number.slice(-4)}` : "-"}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-zinc-400 block mb-0.5">통화 / SWIFT</span>
                <span className="font-medium text-zinc-800 dark:text-zinc-200">
                  {remittance.account_currency || "USD"} {remittance.swift_bic ? `/ ${remittance.swift_bic}` : ""}
                </span>
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-250 dark:bg-amber-950/30 dark:border-amber-900/50 text-amber-800 dark:text-amber-300 text-xs flex items-center justify-between">
              <span>
                💡 <strong>등록된 송금 계좌가 없습니다.</strong> 원활한 정산 및 대금 지급을 위해 회사 정보에서 계좌를 등록해 주세요.
              </span>
              <Link
                href="/portal/company/info"
                className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded text-[11px] shrink-0 ml-3"
              >
                계좌 등록하러 가기 →
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* PO Lines Table */}
      <div className="p-5 rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 space-y-4 shadow-sm">
        <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">청구 품목 수량 및 단가 입력</h2>

        {loadingLines ? (
          <p className="text-xs text-zinc-400 dark:text-zinc-500 italic">발주 품목 로딩 중...</p>
        ) : lines.length === 0 ? (
          <p className="text-xs text-zinc-400 dark:text-zinc-500 italic">발주서를 선택하면 청구 가능한 라인이 표시됩니다.</p>
        ) : (
          <div className="overflow-x-auto space-y-4">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-zinc-50/80 text-zinc-600 font-bold border-b border-zinc-200 dark:bg-zinc-950/60 dark:border-zinc-800 dark:text-zinc-400">
                  <th className="px-3 py-2.5">상품 정보 / SKU</th>
                  <th className="px-3 py-2.5 text-right">발주 (Ordered)</th>
                  <th className="px-3 py-2.5 text-right">확정 (Confirmed)</th>
                  <th className="px-3 py-2.5 text-right">선적 (Shipped)</th>
                  <th className="px-3 py-2.5 text-right">입고 (Received)</th>
                  <th className="px-3 py-2.5 text-right">기 청구 (Invoiced)</th>
                  <th className="px-3 py-2.5 text-right">청구 가능 (Available)</th>
                  <th className="px-3 py-2.5 text-right">청구 수량 (Invoice Qty)</th>
                  <th className="px-3 py-2.5 text-right">FOB 단가</th>
                  <th className="px-3 py-2.5 text-right">청구 금액</th>
                  <th className="px-3 py-2.5">메모</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                {lines.map((line) => {
                  const input = lineInputs[line.purchaseOrderLineId] || { invoicedQty: 0, unitPrice: 0, lineNote: "" };
                  const lineTotal = input.invoicedQty * input.unitPrice;
                  
                  const availableQty = Math.max(0, line.shippedQty - line.alreadyInvoicedQty);
                  const isQtyOverShip = input.invoicedQty > line.shippedQty;
                  const isQtyOverConfirm = (line.alreadyInvoicedQty + input.invoicedQty) > line.confirmedQty;

                  return (
                    <tr key={line.purchaseOrderLineId} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                      <td className="px-3 py-2.5">
                        <div className="font-bold text-zinc-900 dark:text-zinc-100">{line.productName}</div>
                        <div className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400 mt-0.5">{line.sku}</div>
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-zinc-700 dark:text-zinc-300">{line.orderedQty}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-zinc-700 dark:text-zinc-300">{line.confirmedQty}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-zinc-700 dark:text-zinc-300">{line.shippedQty}</td>
                      <td className="px-3 py-2.5 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">{line.receivedQty}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-zinc-500 dark:text-zinc-400">{line.alreadyInvoicedQty}</td>
                      <td className="px-3 py-2.5 text-right font-mono font-semibold text-blue-600 dark:text-blue-400">{availableQty}</td>
                      <td className="px-3 py-2.5 text-right">
                        <div className="flex flex-col items-end">
                          <input
                            type="number"
                            value={input.invoicedQty}
                            min={0}
                            id={`qty-${line.sku}`}
                            onChange={(e) => handleLineFieldChange(line.purchaseOrderLineId, "invoicedQty", parseInt(e.target.value) || 0)}
                            className={`w-16 px-1.5 py-1 border rounded text-right font-mono text-xs bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 ${
                              isQtyOverConfirm ? "border-rose-500 bg-rose-50/50 dark:bg-rose-950/30" : isQtyOverShip ? "border-amber-500 bg-amber-50/50 dark:bg-amber-950/30" : "border-zinc-200 dark:border-zinc-800"
                            }`}
                            required
                          />
                          {isQtyOverConfirm && (
                            <span className="text-[9px] text-rose-600 dark:text-rose-400 mt-1 font-semibold whitespace-nowrap">Confirmed 초과</span>
                          )}
                          {!isQtyOverConfirm && isQtyOverShip && (
                            <span className="text-[9px] text-amber-600 dark:text-amber-400 mt-1 font-semibold whitespace-nowrap">Shipped 초과</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <input
                          type="number"
                          value={input.unitPrice}
                          min={0}
                          step={0.01}
                          id={`price-${line.sku}`}
                          onChange={(e) => handleLineFieldChange(line.purchaseOrderLineId, "unitPrice", parseFloat(e.target.value) || 0)}
                          className="w-16 px-1.5 py-1 border border-zinc-200 dark:border-zinc-800 rounded text-right font-mono text-xs bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100"
                          required
                        />
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-bold text-zinc-900 dark:text-zinc-100">
                        {new Intl.NumberFormat("en-US", { style: "currency", currency }).format(lineTotal)}
                      </td>
                      <td className="px-3 py-2.5">
                        <input
                          type="text"
                          value={input.lineNote}
                          onChange={(e) => handleLineFieldChange(line.purchaseOrderLineId, "lineNote", e.target.value)}
                          placeholder="메모 사항"
                          className="w-full px-2 py-1 border border-zinc-200 dark:border-zinc-800 rounded text-[11px] bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Invoiced Summary Grid */}
            <div className="bg-zinc-50/80 dark:bg-zinc-950/70 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs mt-4">
              <div>
                <span className="text-zinc-500 dark:text-zinc-400 block font-semibold mb-1">PO 확정 금액 (PO Confirmed Value)</span>
                <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  {new Intl.NumberFormat("en-US", { style: "currency", currency }).format(poConfirmedValue)}
                </span>
              </div>
              <div>
                <span className="text-zinc-500 dark:text-zinc-400 block font-semibold mb-1">기 청구 금액 (Previously Invoiced)</span>
                <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  {new Intl.NumberFormat("en-US", { style: "currency", currency }).format(previouslyInvoicedAmount)}
                </span>
              </div>
              <div>
                <span className="text-zinc-500 dark:text-zinc-400 block font-semibold mb-1">금회 청구 금액 (Current Invoice)</span>
                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                  {new Intl.NumberFormat("en-US", { style: "currency", currency }).format(currentInvoiceAmount)}
                </span>
              </div>
              <div>
                <span className="text-zinc-500 dark:text-zinc-400 block font-semibold mb-1">누적 청구 금액 (Cumulative Invoiced)</span>
                <span className={`text-sm font-bold ${cumulativeInvoicedAmount > poConfirmedValue ? "text-rose-600 dark:text-rose-400" : "text-zinc-900 dark:text-zinc-100"}`}>
                  {new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cumulativeInvoicedAmount)}
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4 flex items-center justify-between">
          <div className="text-zinc-500 dark:text-zinc-400 text-xs">
            발주서 통화: <span className="font-bold text-zinc-900 dark:text-zinc-100">{currency}</span>
          </div>
          <div className="text-right">
            <span className="text-xs text-zinc-500 dark:text-zinc-400">품목 기본 공급가액 합계 (Base Amount):</span>
            <div className="text-base font-bold text-zinc-900 dark:text-zinc-100 font-mono">
              {new Intl.NumberFormat("en-US", { style: "currency", currency }).format(baseInvoiceAmount)}
            </div>
          </div>
        </div>
      </div>

      {/* Adjustments Section */}
      <div className="p-5 rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 space-y-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-zinc-150 dark:border-zinc-800 pb-3">
          <div>
            <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <span>조정 항목 (Adjustments)</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-mono">
                {adjustments.length}
              </span>
            </h2>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
              운송 지원비(+), 파손 공제(-), 마케팅 크레딧(-) 등 인보이스 기본 청구액에 가감할 항목을 추가합니다.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleAddAdjustment("PLUS", "")}
              className="px-3 py-1.5 bg-emerald-50 border border-emerald-250 hover:bg-emerald-100 text-emerald-750 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300 font-bold rounded-lg text-xs transition-colors flex items-center gap-1 cursor-pointer"
            >
              <span>+</span> 추가 청구 (+ PLUS)
            </button>
            <button
              type="button"
              onClick={() => handleAddAdjustment("MINUS", "")}
              className="px-3 py-1.5 bg-rose-50 border border-rose-250 hover:bg-rose-100 text-rose-750 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300 font-bold rounded-lg text-xs transition-colors flex items-center gap-1 cursor-pointer"
            >
              <span>-</span> 공제 (- MINUS)
            </button>
          </div>
        </div>

        {adjustments.length === 0 ? (
          <div className="p-6 text-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl">
            <p className="text-xs text-zinc-400 dark:text-zinc-500">등록된 조정 항목이 없습니다. (0 Adjustments)</p>
            <div className="flex justify-center gap-2 mt-2">
              <button
                type="button"
                onClick={() => handleAddAdjustment("PLUS", "Freight Support")}
                className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline font-medium cursor-pointer"
              >
                + 운송 지원비 추가
              </button>
              <span className="text-zinc-300 dark:text-zinc-700">|</span>
              <button
                type="button"
                onClick={() => handleAddAdjustment("MINUS", "Damage Allowance")}
                className="text-[11px] text-rose-600 dark:text-rose-400 hover:underline font-medium cursor-pointer"
              >
                - 파손 공제 추가
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-zinc-50/80 text-zinc-600 font-bold border-b border-zinc-200 dark:bg-zinc-950/60 dark:border-zinc-800 dark:text-zinc-400">
                    <th className="px-3 py-2 w-36">구분 (Type)</th>
                    <th className="px-3 py-2">조정 사유 (Reason) *</th>
                    <th className="px-3 py-2 text-right w-40">금액 (Amount) *</th>
                    <th className="px-3 py-2">비고 / 메모 (Note)</th>
                    <th className="px-3 py-2 text-center w-16">삭제</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                  {adjustments.map((adj, index) => (
                    <tr key={index} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                      <td className="px-3 py-2.5">
                        <select
                          value={adj.type}
                          onChange={(e) => handleAdjustmentChange(index, "type", e.target.value as "PLUS" | "MINUS")}
                          className={`w-full px-2 py-1 border rounded text-xs font-bold ${
                            adj.type === "PLUS"
                              ? "border-emerald-300 bg-emerald-50 text-emerald-750 dark:bg-emerald-950/60 dark:border-emerald-800 dark:text-emerald-300"
                              : "border-rose-300 bg-rose-50 text-rose-750 dark:bg-rose-950/60 dark:border-rose-800 dark:text-rose-300"
                          }`}
                        >
                          <option value="PLUS">+ PLUS (추가)</option>
                          <option value="MINUS">- MINUS (공제)</option>
                        </select>
                      </td>
                      <td className="px-3 py-2.5">
                        <input
                          type="text"
                          value={adj.reason}
                          onChange={(e) => handleAdjustmentChange(index, "reason", e.target.value)}
                          placeholder="예: Freight Support, Damage Allowance, Marketing Credit"
                          className="w-full px-2.5 py-1 border border-zinc-200 dark:border-zinc-800 rounded text-xs bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100"
                          required
                        />
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <span className={`font-mono font-bold ${adj.type === "PLUS" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                            {adj.type === "PLUS" ? "+" : "-"}
                          </span>
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            value={adj.amount}
                            onChange={(e) => handleAdjustmentChange(index, "amount", parseFloat(e.target.value) || 0)}
                            className="w-28 px-2 py-1 border border-zinc-200 dark:border-zinc-800 rounded text-right font-mono font-bold text-xs bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100"
                            required
                          />
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <input
                          type="text"
                          value={adj.note}
                          onChange={(e) => handleAdjustmentChange(index, "note", e.target.value)}
                          placeholder="세부 내용 또는 참조 번호"
                          className="w-full px-2.5 py-1 border border-zinc-200 dark:border-zinc-800 rounded text-[11px] bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100"
                        />
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveAdjustment(index)}
                          className="p-1 text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
                          title="조정 항목 삭제"
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Distinct Amount Summary Breakdown */}
        <div className="mt-4 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950/70 border border-zinc-200 dark:border-zinc-800">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-3 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-150 dark:border-zinc-800">
              <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 block mb-1">
                기본 품목 청구액 (Base Invoice Amount)
              </span>
              <div className="text-base font-bold font-mono text-zinc-900 dark:text-zinc-100">
                {new Intl.NumberFormat("en-US", { style: "currency", currency }).format(baseInvoiceAmount)}
              </div>
            </div>

            <div className="p-3 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-150 dark:border-zinc-800">
              <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 block mb-1">
                조정 항목 합계 (Adjustment Total)
              </span>
              <div className={`text-base font-bold font-mono ${
                adjustmentTotal > 0 ? "text-emerald-600 dark:text-emerald-400" : adjustmentTotal < 0 ? "text-rose-600 dark:text-rose-400" : "text-zinc-700 dark:text-zinc-300"
              }`}>
                {adjustmentTotal > 0 ? "+" : ""}
                {new Intl.NumberFormat("en-US", { style: "currency", currency }).format(adjustmentTotal)}
              </div>
            </div>

            <div className="p-3 bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 rounded-lg shadow-sm">
              <span className="text-[11px] font-bold text-zinc-300 dark:text-zinc-600 block mb-1">
                최종 청구 금액 (Final Invoice Amount)
              </span>
              <div className="text-lg font-extrabold font-mono text-white dark:text-zinc-950">
                {new Intl.NumberFormat("en-US", { style: "currency", currency }).format(finalInvoiceAmount)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pb-6">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-lg text-xs font-bold text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 bg-zinc-950 text-white hover:bg-zinc-900 dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-950 rounded-lg text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
        >
          {isSubmitting ? "저장 중..." : isEditMode ? "인보이스 수정 완료" : "인보이스 임시저장 (Draft)"}
        </button>
      </div>
    </form>
  );
}
