"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  createInvoice,
  updateInvoice,
  getPurchaseOrderForInvoice,
  uploadInvoiceAttachment
} from "@/lib/supplier-invoice/actions";

interface PoOption {
  id: string;
  po_number: string;
  supplier_id: string;
  supplier: { id: string; name: string };
  currency: string;
  payment_terms?: string;
  incoterms?: string;
}

interface InvoiceLineItem {
  purchase_order_line_id: string;
  product_id: string;
  sku_snapshot: string;
  product_name_snapshot: string;
  invoiced_qty: number;
  unit_price: number;
  line_note: string;
  // References
  qty: number; // PO Qty
  unit_cost: number; // PO Cost
}

interface SupplierOption {
  id: string;
  name: string;
}

interface InvoiceFormProps {
  invoice?: any; // If provided, edit mode
  eligiblePos: PoOption[];
  suppliers: SupplierOption[];
}

export function InvoiceForm({ invoice, eligiblePos, suppliers }: InvoiceFormProps) {
  const router = useRouter();
  const isEdit = !!invoice;

  const [supplierId, setSupplierId] = useState(invoice?.supplier_company_id || "");
  const [poId, setPoId] = useState(invoice?.purchase_order_id || "");
  const [invoiceNumber, setInvoiceNumber] = useState(invoice?.supplier_invoice_number || "");
  const [invoiceDate, setInvoiceDate] = useState(invoice?.invoice_date || "");
  const [receivedDate, setReceivedDate] = useState(invoice?.received_date || new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState(invoice?.due_date || "");
  const [currency, setCurrency] = useState(invoice?.currency || "USD");
  const [paymentTerms, setPaymentTerms] = useState(invoice?.payment_terms_snapshot || "");
  const [incoterms, setIncoterms] = useState(invoice?.incoterms_snapshot || "");
  const [taxAmount, setTaxAmount] = useState(invoice?.tax_amount || 0);
  const [otherCharges, setOtherCharges] = useState(invoice?.other_charges || 0);
  const [internalNote, setInternalNote] = useState(invoice?.internal_note || "");
  const [attachmentPath, setAttachmentPath] = useState(invoice?.attachment_path || "");

  const [lines, setLines] = useState<InvoiceLineItem[]>([]);
  const [isLoadingLines, setIsLoadingLines] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [uploadingFile, setUploadingFile] = useState(false);

  // Filter POs by selected Supplier
  const supplierPos = eligiblePos.filter(po => po.supplier_id === supplierId);

  // Load lines when PO is selected in New mode
  useEffect(() => {
    if (isEdit || !poId) return;

    const loadPoLines = async () => {
      setIsLoadingLines(true);
      setErrorMessage("");
      try {
        const poData = await getPurchaseOrderForInvoice(poId);
        setCurrency(poData.currency);
        setPaymentTerms(poData.payment_terms || "");
        setIncoterms(poData.incoterms || "");

        const formattedLines: InvoiceLineItem[] = poData.lines.map((l: any) => ({
          purchase_order_line_id: l.id,
          product_id: l.product_id,
          sku_snapshot: l.product?.letusto_sku || "",
          product_name_snapshot: l.product_name_snapshot,
          invoiced_qty: l.qty,
          unit_price: Number(l.unit_cost),
          line_note: "",
          qty: l.qty,
          unit_cost: Number(l.unit_cost)
        }));
        setLines(formattedLines);
      } catch (err: any) {
        setErrorMessage(err.message || "PO 정보를 불러오지 못했습니다.");
      } finally {
        setIsLoadingLines(false);
      }
    };

    loadPoLines();
  }, [poId, isEdit]);

  // Load lines in Edit mode on mount
  useEffect(() => {
    if (!isEdit || !invoice) return;

    const loadEditLines = async () => {
      setIsLoadingLines(true);
      try {
        const poData = await getPurchaseOrderForInvoice(invoice.purchase_order_id);
        const poLinesMap = new Map(poData.lines.map((l: any) => [l.id, l]));

        const formattedLines: InvoiceLineItem[] = invoice.lines.map((l: any) => {
          const poLine = poLinesMap.get(l.purchase_order_line_id);
          return {
            purchase_order_line_id: l.purchase_order_line_id,
            product_id: l.product_id,
            sku_snapshot: l.sku_snapshot,
            product_name_snapshot: l.product_name_snapshot,
            invoiced_qty: l.invoiced_qty,
            unit_price: Number(l.unit_price),
            line_note: l.line_note || "",
            qty: poLine ? poLine.qty : l.invoiced_qty,
            unit_cost: poLine ? Number(poLine.unit_cost) : Number(l.unit_price)
          };
        });
        setLines(formattedLines);
      } catch (err: any) {
        setErrorMessage("기존 PO 데이터를 연동하여 검수선을 매핑하지 못했습니다.");
      } finally {
        setIsLoadingLines(false);
      }
    };

    loadEditLines();
  }, [invoice, isEdit]);

  const handleLineChange = (index: number, field: keyof InvoiceLineItem, value: any) => {
    const updated = [...lines];
    updated[index] = {
      ...updated[index],
      [field]: value
    };
    setLines(updated);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingFile(true);
    setErrorMessage("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await uploadInvoiceAttachment(formData);
      if (res.path) {
        setAttachmentPath(res.path);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "파일 업로드에 실패했습니다.");
    } finally {
      setUploadingFile(false);
    }
  };

  // Computations
  const subtotal = lines.reduce((sum, l) => sum + (l.invoiced_qty * l.unit_price), 0);
  const total = subtotal + Number(taxAmount) + Number(otherCharges);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId || !poId || !invoiceNumber || !invoiceDate || !dueDate) {
      setErrorMessage("필수 필드를 입력해 주세요.");
      return;
    }
    if (lines.length === 0) {
      setErrorMessage("최소 하나의 품목 라인이 필요합니다.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    const payload = {
      supplier_company_id: supplierId,
      purchase_order_id: poId,
      supplier_invoice_number: invoiceNumber,
      invoice_date: invoiceDate,
      received_date: receivedDate,
      due_date: dueDate,
      currency,
      payment_terms_snapshot: paymentTerms,
      incoterms_snapshot: incoterms,
      tax_amount: Number(taxAmount),
      other_charges: Number(otherCharges),
      internal_note: internalNote,
      attachment_path: attachmentPath,
      lines: lines.map(l => ({
        purchase_order_line_id: l.purchase_order_line_id,
        product_id: l.product_id,
        sku_snapshot: l.sku_snapshot,
        product_name_snapshot: l.product_name_snapshot,
        invoiced_qty: Number(l.invoiced_qty),
        unit_price: Number(l.unit_price),
        line_note: l.line_note
      }))
    };

    try {
      if (isEdit) {
        await updateInvoice(invoice.id, payload);
        router.push(`/admin/finance/invoices/${invoice.id}`);
      } else {
        const created = await createInvoice(payload);
        router.push(`/admin/finance/invoices/${created.id}`);
      }
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err.message || "저장 처리 도중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 text-xs">
      {errorMessage && (
        <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-250 text-rose-600 font-bold dark:bg-rose-950/10 dark:border-rose-900/50 dark:text-rose-400">
          ⚠️ {errorMessage}
        </div>
      )}

      {!isEdit && eligiblePos.length === 0 && (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-250 text-amber-800 dark:bg-amber-950/10 dark:border-amber-900/50 dark:text-amber-400 leading-relaxed font-semibold">
          💡 현재 인보이스를 등록할 수 있는 발주서(PO)가 시스템에 존재하지 않습니다.<br />
          공급업체에 발송 완료 상태(<code className="font-mono text-amber-900 bg-amber-100 dark:bg-amber-900/80 px-1 py-0.5 rounded">SENT</code>)인 발주서만 인보이스 신규 등록이 가능합니다.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: General metadata */}
        <div className="lg:col-span-1 space-y-6">
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
            <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider border-b border-zinc-100 pb-2 dark:border-zinc-800">
              인보이스 기본 정보
            </h3>

            <div className="space-y-3.5">
              {/* Supplier Selection */}
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 dark:text-zinc-500 mb-1">공급사 (Supplier) *</label>
                <select
                  disabled={isEdit}
                  value={supplierId}
                  onChange={(e) => {
                    setSupplierId(e.target.value);
                    setPoId("");
                    setLines([]);
                  }}
                  className="w-full h-9 rounded-xl border border-zinc-200 bg-white px-3 outline-none dark:border-zinc-850 dark:bg-zinc-950 dark:text-white"
                  required
                >
                  <option value="">공급사를 선택하세요</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              {/* PO Selection */}
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 dark:text-zinc-500 mb-1">발주서 (Purchase Order) *</label>
                {isEdit ? (
                  <div className="h-9 border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 flex items-center px-3 rounded-xl font-mono font-bold dark:text-white">
                    {invoice.po?.po_number}
                  </div>
                ) : !supplierId ? (
                  <div className="p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-zinc-450 dark:bg-zinc-950/20 dark:border-zinc-800 font-medium">
                    공급사(Supplier)를 먼저 선택하시면 인보이스 등록이 가능한 발주서(PO) 목록이 표시됩니다.
                  </div>
                ) : supplierPos.length === 0 ? (
                  <div className="p-2.5 bg-rose-50 border border-rose-150 rounded-xl text-rose-600 dark:bg-rose-950/10 dark:border-rose-900/50 dark:text-rose-400 font-medium leading-relaxed">
                    해당 공급사의 발송 완료 상태(<code className="font-mono text-rose-900 bg-rose-100 dark:bg-rose-900/50 px-1 py-0.5 rounded">SENT</code>)인 발주서가 존재하지 않습니다.
                  </div>
                ) : (
                  <select
                    value={poId}
                    onChange={(e) => setPoId(e.target.value)}
                    className="w-full h-9 rounded-xl border border-zinc-200 bg-white px-3 outline-none dark:border-zinc-850 dark:bg-zinc-955 dark:text-white"
                    required
                  >
                    <option value="">발주서를 선택하세요</option>
                    {supplierPos.map(po => (
                      <option key={po.id} value={po.id}>{po.po_number}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Invoice Number */}
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 dark:text-zinc-500 mb-1">공급업체 인보이스 번호 *</label>
                <input
                  type="text"
                  placeholder="예: INV-12345"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="w-full h-9 rounded-xl border border-zinc-200 bg-white px-3 outline-none dark:border-zinc-850 dark:bg-zinc-955 dark:text-white font-mono font-bold"
                  required
                />
              </div>

              {/* Currency */}
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 dark:text-zinc-500 mb-1">통화 (Currency) *</label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full h-9 rounded-xl border border-zinc-200 bg-white px-3 outline-none dark:border-zinc-850 dark:bg-zinc-955 dark:text-white font-bold"
                  required
                >
                  <option value="USD">USD</option>
                  <option value="KRW">KRW</option>
                  <option value="JPY">JPY</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>

              {/* Invoice Date */}
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 dark:text-zinc-500 mb-1">인보이스 발행일 (Invoice Date) *</label>
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="w-full h-9 rounded-xl border border-zinc-200 bg-white px-3 outline-none dark:border-zinc-850 dark:bg-zinc-955 dark:text-white font-mono"
                  required
                />
              </div>

              {/* Received Date */}
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 dark:text-zinc-500 mb-1">인보이스 접수일 (Received Date)</label>
                <input
                  type="date"
                  value={receivedDate}
                  onChange={(e) => setReceivedDate(e.target.value)}
                  className="w-full h-9 rounded-xl border border-zinc-200 bg-white px-3 outline-none dark:border-zinc-850 dark:bg-zinc-955 dark:text-white font-mono"
                />
              </div>

              {/* Due Date */}
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 dark:text-zinc-500 mb-1">지급 기한 (Due Date) *</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full h-9 rounded-xl border border-zinc-200 bg-white px-3 outline-none dark:border-zinc-850 dark:bg-zinc-955 dark:text-white font-mono"
                  required
                />
              </div>

              {/* Payment Terms Snapshot */}
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 dark:text-zinc-500 mb-1">결제 조건 (Payment Terms)</label>
                <input
                  type="text"
                  placeholder="예: Net 30"
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  className="w-full h-9 rounded-xl border border-zinc-200 bg-white px-3 outline-none dark:border-zinc-850 dark:bg-zinc-955 dark:text-white"
                />
              </div>

              {/* Incoterms Snapshot */}
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 dark:text-zinc-500 mb-1">인코텀즈 (Incoterms)</label>
                <input
                  type="text"
                  placeholder="예: FOB Busan"
                  value={incoterms}
                  onChange={(e) => setIncoterms(e.target.value)}
                  className="w-full h-9 rounded-xl border border-zinc-200 bg-white px-3 outline-none dark:border-zinc-850 dark:bg-zinc-955 dark:text-white"
                />
              </div>

              {/* File Attachment */}
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 dark:text-zinc-500 mb-1">인보이스 첨부 파일 (PDF / Scan)</label>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={handleFileUpload}
                  className="w-full text-xs text-zinc-500 file:mr-4 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-[10px] file:font-bold file:bg-zinc-100 file:text-zinc-700 hover:file:bg-zinc-200 dark:file:bg-zinc-800 dark:file:text-zinc-350 cursor-pointer"
                  disabled={uploadingFile}
                />
                {uploadingFile && <span className="text-[10px] text-zinc-400 mt-1 block">업로드 중...</span>}
                {attachmentPath && (
                  <span className="text-[10px] text-emerald-600 font-bold mt-1.5 block">
                    ✓ 파일 업로드 완료 (경로: {attachmentPath.split("/").pop()})
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Invoice Lines & Totals */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
            <h3 className="text-sm font-bold text-zinc-850 dark:text-white">인보이스 상세 품목 정보 (Invoice Lines)</h3>
            
            {isLoadingLines ? (
              <div className="p-8 text-center text-zinc-400">품목을 불러오는 중...</div>
            ) : lines.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-zinc-150 rounded-xl text-zinc-400 font-semibold">
                상단에서 발주서(PO)를 먼저 지정하면 해당 품목이 여기에 로드됩니다.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-zinc-150 dark:border-zinc-800/80">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-zinc-50/50 text-zinc-500 font-bold border-b border-zinc-150 dark:bg-zinc-900/50 dark:border-zinc-800 dark:text-zinc-350">
                      <th className="px-4 py-2.5">Letusto SKU</th>
                      <th className="px-4 py-2.5">제품명</th>
                      <th className="px-4 py-2.5 text-right w-20">발주 수량</th>
                      <th className="px-4 py-2.5 text-right w-20">발주 단가</th>
                      <th className="px-4 py-2.5 text-right w-24">청구 수량 *</th>
                      <th className="px-4 py-2.5 text-right w-24">청구 단가 *</th>
                      <th className="px-4 py-2.5 text-right w-24">금액</th>
                      <th className="px-4 py-2.5">품목 비고</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {lines.map((l, index) => {
                      const amount = l.invoiced_qty * l.unit_price;
                      return (
                        <tr key={l.purchase_order_line_id} className="hover:bg-zinc-50/30 dark:hover:bg-zinc-850/5">
                          <td className="px-4 py-3 font-mono font-bold text-zinc-900 dark:text-white">{l.sku_snapshot}</td>
                          <td className="px-4 py-3 font-bold text-zinc-900 dark:text-white max-w-xs truncate">{l.product_name_snapshot}</td>
                          
                          {/* Reference PO Qty */}
                          <td className="px-4 py-3 text-right font-mono text-zinc-450">{l.qty.toLocaleString()}</td>
                          
                          {/* Reference PO Cost */}
                          <td className="px-4 py-3 text-right font-mono text-zinc-450">{l.unit_cost.toLocaleString()}</td>
                          
                          {/* Invoiced Qty Input */}
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              min="1"
                              value={l.invoiced_qty}
                              onChange={(e) => handleLineChange(index, "invoiced_qty", parseInt(e.target.value) || 0)}
                              className="w-full text-right font-mono font-bold rounded border border-zinc-200 p-1 dark:border-zinc-850 dark:bg-zinc-950 dark:text-white"
                              required
                            />
                          </td>

                          {/* Unit Price Input */}
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              step="0.0001"
                              min="0"
                              value={l.unit_price}
                              onChange={(e) => handleLineChange(index, "unit_price", parseFloat(e.target.value) || 0)}
                              className="w-full text-right font-mono font-bold rounded border border-zinc-200 p-1 dark:border-zinc-850 dark:bg-zinc-950 dark:text-white"
                              required
                            />
                          </td>

                          {/* Computed Amount */}
                          <td className="px-4 py-3 text-right font-mono font-bold text-zinc-700 dark:text-zinc-300">
                            {amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>

                          {/* Line Note */}
                          <td className="px-4 py-3">
                            <input
                              type="text"
                              placeholder="품목 비고..."
                              value={l.line_note}
                              onChange={(e) => handleLineChange(index, "line_note", e.target.value)}
                              className="w-full rounded border border-zinc-200 p-1 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Subtotal, Tax, Other Charges and Total */}
            <div className="border-t border-zinc-150 pt-4 dark:border-zinc-800 flex justify-end">
              <div className="w-64 space-y-2 text-right">
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400 font-semibold">Subtotal (공급가액):</span>
                  <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200">
                    {currency} {subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400 font-semibold">세액 (Tax Amount):</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={taxAmount}
                    onChange={(e) => setTaxAmount(parseFloat(e.target.value) || 0)}
                    className="w-28 text-right font-mono font-bold rounded border border-zinc-200 p-1 dark:border-zinc-850 dark:bg-zinc-950 dark:text-white"
                  />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400 font-semibold">기타 비용 (Other Charges):</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={otherCharges}
                    onChange={(e) => setOtherCharges(parseFloat(e.target.value) || 0)}
                    className="w-28 text-right font-mono font-bold rounded border border-zinc-200 p-1 dark:border-zinc-850 dark:bg-zinc-950 dark:text-white"
                  />
                </div>
                <div className="flex justify-between items-center border-t border-zinc-100 pt-2 dark:border-zinc-800 font-bold text-sm">
                  <span className="text-zinc-700 dark:text-white">인보이스 합계 (Total):</span>
                  <span className="font-mono text-zinc-950 dark:text-white">
                    {currency} {total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Internal Memo */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-2">
            <label className="font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">내부 검수 메모 (Internal Note)</label>
            <textarea
              placeholder="인보이스 수동 등록 시 특이사항이나 단가 편차 발생 사유 등을 메모하세요..."
              value={internalNote}
              onChange={(e) => setInternalNote(e.target.value)}
              className="w-full rounded border border-zinc-200 p-2 text-xs text-zinc-900 bg-zinc-50 dark:border-zinc-850 dark:bg-zinc-955 dark:text-white outline-none min-h-[70px]"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Link
              href={isEdit ? `/admin/finance/invoices/${invoice.id}` : "/admin/finance/invoices"}
              className="px-4 py-2 border border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-350 text-xs font-bold rounded-xl cursor-pointer transition-colors"
            >
              취소
            </Link>
            <button
              type="submit"
              disabled={isSubmitting || uploadingFile}
              className="px-5 py-2 bg-zinc-950 hover:bg-zinc-900 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 text-white text-xs font-bold rounded-xl cursor-pointer shadow-sm transition-colors disabled:opacity-50"
            >
              {isSubmitting ? "저장 중..." : "인보이스 저장 (Save)"}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
