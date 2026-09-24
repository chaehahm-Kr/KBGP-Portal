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
import { getEasternTodayString } from "@/lib/utils/timezone";

interface PoOption {
  id: string;
  po_number: string;
  supplier_id: string;
  supplier: { id: string; name: string };
  currency: string;
  payment_terms?: string;
  incoterms?: string;
  active_invoice_id?: string | null;
  active_invoice_no?: string | null;
  active_invoice_status?: string | null;
  is_locked?: boolean;
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
  const [receivedDate, setReceivedDate] = useState(invoice?.received_date || getEasternTodayString());
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

  // Adjustments State
  interface AdjustmentItemInput {
    id?: string;
    type: "PLUS" | "MINUS";
    reason: string;
    amount: number;
    note: string;
  }

  const [adjustments, setAdjustments] = useState<AdjustmentItemInput[]>(() => {
    if (invoice?.adjustments && Array.isArray(invoice.adjustments)) {
      return invoice.adjustments.map((a: any) => ({
        id: a.id,
        type: (a.adjustment_direction === 'CHARGE' ? 'PLUS' : 'MINUS') as "PLUS" | "MINUS",
        reason: a.reason || "",
        amount: Number(a.adjustment_amount || a.amount || 0),
        note: a.internal_note || a.note || ""
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

  // Filter POs by selected Supplier
  const supplierPos = eligiblePos.filter(po => po.supplier_id === supplierId);
  const selectedPo = supplierPos.find(p => p.id === poId);

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
  const baseInvoiceAmount = subtotal;
  const adjustmentTotal = adjustments.reduce((sum, adj) => {
    const amt = Number(adj.amount) || 0;
    return adj.type === "PLUS" ? sum + amt : sum - amt;
  }, 0);
  const total = Number((baseInvoiceAmount + Number(taxAmount) + Number(otherCharges) + adjustmentTotal).toFixed(2));

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

    if (total < 0) {
      setErrorMessage("최종 인보이스 청구 금액(Final Invoice Amount)은 0 이상이어야 합니다. 조정 금액을 확인해 주세요.");
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
      })),
      adjustments: adjustments.map(adj => ({
        id: adj.id,
        type: adj.type,
        reason: adj.reason.trim(),
        amount: Number(adj.amount),
        note: adj.note.trim()
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
                  <div className="space-y-2">
                    <select
                      value={poId}
                      onChange={(e) => setPoId(e.target.value)}
                      className="w-full h-9 rounded-xl border border-zinc-200 bg-white px-3 outline-none dark:border-zinc-850 dark:bg-zinc-955 dark:text-white"
                      required
                    >
                      <option value="">발주서를 선택하세요</option>
                      {supplierPos.map(po => {
                        const isDraft = po.active_invoice_status === "DRAFT";
                        const isLocked = po.is_locked;
                        let label = po.po_number;
                        if (isDraft) {
                          label += ` [Draft 존재: ${po.active_invoice_no || "DRAFT"}]`;
                        } else if (isLocked) {
                          label += ` [진행 중인 인보이스: ${po.active_invoice_no || ""} (${po.active_invoice_status})]`;
                        }

                        return (
                          <option key={po.id} value={po.id} disabled={isLocked}>
                            {label}
                          </option>
                        );
                      })}
                    </select>

                    {selectedPo?.active_invoice_id && selectedPo.active_invoice_status === "DRAFT" && (
                      <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 dark:bg-blue-950/20 dark:border-blue-900/50 dark:text-blue-300 text-[11px] flex items-center justify-between gap-2">
                        <span>
                          💡 이 발주서에 작성 중인 <strong>Draft 인보이스({selectedPo.active_invoice_no || "DRAFT"})</strong>가 있습니다.
                        </span>
                        <Link
                          href={`/admin/finance/invoices/${selectedPo.active_invoice_id}/edit`}
                          className="px-2 py-1 rounded bg-blue-600 text-white font-bold text-[10px] hover:bg-blue-700 shrink-0"
                        >
                          기존 Draft 열기 →
                        </Link>
                      </div>
                    )}
                  </div>
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

            {/* Adjustments Section */}
            <div className="border-t border-zinc-150 pt-5 dark:border-zinc-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-zinc-850 dark:text-zinc-200 flex items-center gap-2">
                    <span>조정 항목 (Adjustments)</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-mono">
                      {adjustments.length}
                    </span>
                  </h4>
                  <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">
                    운송 지원비(+), 파손 공제(-), 마케팅 크레딧(-) 등 인보이스 기본 청구액에 가감할 항목을 추가합니다.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleAddAdjustment("PLUS", "")}
                    className="px-2.5 py-1.5 bg-emerald-50 border border-emerald-250 hover:bg-emerald-100 text-emerald-750 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300 font-bold rounded-lg text-xs transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <span>+</span> 추가 청구 (+ PLUS)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddAdjustment("MINUS", "")}
                    className="px-2.5 py-1.5 bg-rose-50 border border-rose-250 hover:bg-rose-100 text-rose-750 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300 font-bold rounded-lg text-xs transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <span>-</span> 공제 (- MINUS)
                  </button>
                </div>
              </div>

              {adjustments.length === 0 ? (
                <div className="p-4 text-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl">
                  <p className="text-xs text-zinc-400 dark:text-zinc-500">등록된 조정 항목이 없습니다. (0 Adjustments)</p>
                  <div className="flex justify-center gap-2 mt-1.5">
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
                <div className="overflow-x-auto rounded-lg border border-zinc-150 dark:border-zinc-800/80">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-zinc-50/50 text-zinc-500 font-bold border-b border-zinc-150 dark:bg-zinc-900/50 dark:border-zinc-800 dark:text-zinc-350">
                        <th className="px-3 py-2 w-36">구분 (Type)</th>
                        <th className="px-3 py-2">조정 사유 (Reason) *</th>
                        <th className="px-3 py-2 text-right w-36">금액 (Amount) *</th>
                        <th className="px-3 py-2">비고 / 메모 (Note)</th>
                        <th className="px-3 py-2 text-center w-12">삭제</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      {adjustments.map((adj, index) => (
                        <tr key={index} className="hover:bg-zinc-50/30 dark:hover:bg-zinc-850/5">
                          <td className="px-3 py-2">
                            <select
                              value={adj.type}
                              onChange={(e) => handleAdjustmentChange(index, "type", e.target.value as "PLUS" | "MINUS")}
                              className={`w-full px-2 py-1 rounded border text-xs font-bold ${
                                adj.type === "PLUS"
                                  ? "border-emerald-300 bg-emerald-50 text-emerald-750 dark:bg-emerald-950/60 dark:border-emerald-800 dark:text-emerald-300"
                                  : "border-rose-300 bg-rose-50 text-rose-750 dark:bg-rose-950/60 dark:border-rose-800 dark:text-rose-300"
                              }`}
                            >
                              <option value="PLUS">+ PLUS (추가)</option>
                              <option value="MINUS">- MINUS (공제)</option>
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={adj.reason}
                              onChange={(e) => handleAdjustmentChange(index, "reason", e.target.value)}
                              placeholder="예: Freight Support, Damage Allowance, Marketing Credit"
                              className="w-full rounded border border-zinc-200 p-1 text-xs dark:border-zinc-850 dark:bg-zinc-950 dark:text-white"
                              required
                            />
                          </td>
                          <td className="px-3 py-2 text-right">
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
                                className="w-24 text-right font-mono font-bold rounded border border-zinc-200 p-1 text-xs dark:border-zinc-850 dark:bg-zinc-950 dark:text-white"
                                required
                              />
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={adj.note}
                              onChange={(e) => handleAdjustmentChange(index, "note", e.target.value)}
                              placeholder="세부 메모 또는 참조 번호"
                              className="w-full rounded border border-zinc-200 p-1 text-xs dark:border-zinc-850 dark:bg-zinc-950 dark:text-white"
                            />
                          </td>
                          <td className="px-3 py-2 text-center">
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
              )}
            </div>

            {/* Subtotal, Adjustments, Tax, Other Charges and Final Total */}
            <div className="border-t border-zinc-150 pt-4 dark:border-zinc-800 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
              {/* Summary Cards */}
              <div className="grid grid-cols-3 gap-2 w-full md:w-auto text-xs">
                <div className="p-2.5 rounded-lg border border-zinc-150 bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-950/50">
                  <div className="text-[10px] text-zinc-400 font-semibold">Base Amount</div>
                  <div className="font-mono font-bold text-zinc-800 dark:text-zinc-200 text-sm">
                    {currency} {baseInvoiceAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="p-2.5 rounded-lg border border-zinc-150 bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-950/50">
                  <div className="text-[10px] text-zinc-400 font-semibold">Adjustments</div>
                  <div className={`font-mono font-bold text-sm ${
                    adjustmentTotal > 0 ? "text-emerald-600 dark:text-emerald-400" : adjustmentTotal < 0 ? "text-rose-600 dark:text-rose-400" : "text-zinc-600 dark:text-zinc-400"
                  }`}>
                    {adjustmentTotal > 0 ? "+" : ""}{currency} {adjustmentTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-zinc-950 text-white dark:bg-zinc-100 dark:text-zinc-950">
                  <div className="text-[10px] opacity-70 font-semibold">Final Total</div>
                  <div className="font-mono font-extrabold text-sm">
                    {currency} {total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              {/* Detailed Breakdown Inputs */}
              <div className="w-full md:w-72 space-y-2 text-right">
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400 font-semibold">품목 공급가액 (Base Amount):</span>
                  <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200">
                    {currency} {baseInvoiceAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400 font-semibold">조정 합계 (Adjustment Total):</span>
                  <span className={`font-mono font-bold ${
                    adjustmentTotal > 0 ? "text-emerald-600 dark:text-emerald-400" : adjustmentTotal < 0 ? "text-rose-600 dark:text-rose-400" : "text-zinc-800 dark:text-zinc-200"
                  }`}>
                    {adjustmentTotal > 0 ? "+" : ""}{currency} {adjustmentTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                  <span className="text-zinc-700 dark:text-white">최종 청구액 (Final Invoice Total):</span>
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
