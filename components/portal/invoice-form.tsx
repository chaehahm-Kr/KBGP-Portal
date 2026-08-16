"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  getPoLinesForInvoice,
  createPortalInvoiceDraft,
  updatePortalInvoiceDraft,
  uploadPortalInvoiceAttachment
} from "@/lib/portal/actions";

interface PoOption {
  id: string;
  po_number: string;
  order_date: string;
  currency: string;
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
        const res = await getPoLinesForInvoice(selectedPoId);
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

    setIsSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      if (isEditMode) {
        await updatePortalInvoiceDraft({
          id: initialInvoice.id,
          supplierInvoiceNumber,
          invoiceDate,
          dueDate,
          attachmentPath,
          lines: payloadLines
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
          lines: payloadLines
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

  // Calculate totals
  const subtotal = Object.values(lineInputs).reduce((sum, item) => {
    return sum + (item.invoicedQty * item.unitPrice);
  }, 0);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {errorMessage && (
        <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-250 text-rose-700 font-bold text-xs">
          ⚠️ {errorMessage}
        </div>
      )}
      {successMessage && (
        <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-250 text-emerald-700 font-bold text-xs">
          ✅ {successMessage}
        </div>
      )}

      {/* Basic Meta Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-5 rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
          <h2 className="text-sm font-bold text-zinc-900 dark:text-white border-b border-zinc-150 pb-2">
            발주 및 기본 정보
          </h2>

          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-bold text-zinc-400 mb-1">관련 발주서 (PO)</label>
              {isEditMode ? (
                <div className="px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-mono font-bold text-zinc-650">
                  {initialInvoice.poNumber}
                </div>
              ) : (
                <select
                  value={selectedPoId}
                  onChange={(e) => setSelectedPoId(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs bg-transparent dark:bg-zinc-950"
                  required
                >
                  <option value="">-- 발주서 선택 --</option>
                  {eligiblePos.map((po) => (
                    <option key={po.id} value={po.id}>
                      {po.po_number} ({po.order_date})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-bold text-zinc-400 mb-1">인보이스 번호 (Invoice No.)</label>
              <input
                type="text"
                value={supplierInvoiceNumber}
                onChange={(e) => setSupplierInvoiceNumber(e.target.value)}
                placeholder="예: TEST-INV-001"
                className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs bg-transparent"
                required
              />
            </div>
          </div>
        </div>

        <div className="p-5 rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
          <h2 className="text-sm font-bold text-zinc-900 dark:text-white border-b border-zinc-150 pb-2">
            거래 일자 및 첨부파일
          </h2>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-zinc-400 mb-1">발행 일자 (Invoice Date)</label>
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs bg-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-zinc-400 mb-1">만기 일자 (Due Date)</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs bg-transparent"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-zinc-400 mb-1">인보이스 PDF 파일</label>
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
                  className="px-3.5 py-1.5 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 rounded-lg text-xs font-bold cursor-pointer transition-colors"
                >
                  파일 선택 (PDF)
                </label>
                <span className="text-[11px] text-zinc-400 truncate max-w-[200px]">
                  {attachmentFilename || "업로드된 파일 없음"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* PO Lines Table */}
      <div className="p-5 rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 space-y-4 shadow-sm">
        <h2 className="text-sm font-bold text-zinc-900 dark:text-white">청구 품목 수량 및 단가 입력</h2>

        {loadingLines ? (
          <p className="text-xs text-zinc-400 italic">발주 품목 로딩 중...</p>
        ) : lines.length === 0 ? (
          <p className="text-xs text-zinc-400 italic">발주서를 선택하면 청구 가능한 라인이 표시됩니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-zinc-50/50 text-zinc-500 font-bold border-b border-zinc-200 dark:bg-zinc-900/50 dark:border-zinc-800">
                  <th className="px-3 py-2">상품 정보 / SKU</th>
                  <th className="px-3 py-2 text-right">발주 (Ordered)</th>
                  <th className="px-3 py-2 text-right">준비 완료 (Ready)</th>
                  <th className="px-3 py-2 text-right">입고 완료 (Received)</th>
                  <th className="px-3 py-2 text-right">기 청구 (Invoiced)</th>
                  <th className="px-3 py-2 text-right">청구 수량 (Invoice Qty)</th>
                  <th className="px-3 py-2 text-right">FOB 단가</th>
                  <th className="px-3 py-2 text-right">청구 금액</th>
                  <th className="px-3 py-2">메모</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {lines.map((line) => {
                  const input = lineInputs[line.purchaseOrderLineId] || { invoicedQty: 0, unitPrice: 0, lineNote: "" };
                  const lineTotal = input.invoicedQty * input.unitPrice;

                  return (
                    <tr key={line.purchaseOrderLineId}>
                      <td className="px-3 py-2.5">
                        <div className="font-bold text-zinc-900 dark:text-white">{line.productName}</div>
                        <div className="text-[10px] font-mono text-zinc-400 mt-0.5">{line.sku}</div>
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-zinc-700">{line.orderedQty}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-zinc-700">{line.readyQty}</td>
                      <td className="px-3 py-2.5 text-right font-mono font-bold text-emerald-600">{line.receivedQty}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-zinc-400">{line.alreadyInvoicedQty}</td>
                      <td className="px-3 py-2.5 text-right">
                        <input
                          type="number"
                          value={input.invoicedQty}
                          min={0}
                          onChange={(e) => handleLineFieldChange(line.purchaseOrderLineId, "invoicedQty", parseInt(e.target.value) || 0)}
                          className="w-16 px-1.5 py-1 border border-zinc-200 dark:border-zinc-800 rounded text-right font-mono text-xs"
                          required
                        />
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <input
                          type="number"
                          value={input.unitPrice}
                          min={0}
                          step={0.01}
                          onChange={(e) => handleLineFieldChange(line.purchaseOrderLineId, "unitPrice", parseFloat(e.target.value) || 0)}
                          className="w-16 px-1.5 py-1 border border-zinc-200 dark:border-zinc-800 rounded text-right font-mono text-xs"
                          required
                        />
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-bold text-zinc-900 dark:text-white">
                        {new Intl.NumberFormat("en-US", { style: "currency", currency }).format(lineTotal)}
                      </td>
                      <td className="px-3 py-2.5">
                        <input
                          type="text"
                          value={input.lineNote}
                          onChange={(e) => handleLineFieldChange(line.purchaseOrderLineId, "lineNote", e.target.value)}
                          placeholder="메모 사항"
                          className="w-full px-2 py-1 border border-zinc-200 dark:border-zinc-800 rounded text-[11px]"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="border-t border-zinc-200 pt-4 flex items-center justify-between">
          <div className="text-zinc-500 text-xs">
            발주서 통화: <span className="font-bold text-zinc-900 dark:text-white">{currency}</span>
          </div>
          <div className="text-right">
            <span className="text-xs text-zinc-400">송장 공급가액 합계:</span>
            <div className="text-lg font-extrabold text-zinc-900 dark:text-white">
              {new Intl.NumberFormat("en-US", { style: "currency", currency }).format(subtotal)}
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pb-6">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 rounded-lg text-xs font-bold transition-colors cursor-pointer"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 bg-zinc-950 text-white hover:bg-zinc-900 dark:bg-white dark:text-zinc-950 rounded-lg text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
        >
          {isSubmitting ? "저장 중..." : isEditMode ? "인보이스 수정 완료" : "인보이스 임시저장 (Draft)"}
        </button>
      </div>
    </form>
  );
}
