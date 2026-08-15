"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  createPurchaseOrder,
  updatePurchaseOrder,
  getProductsForSupplier,
} from "@/lib/purchase-order/actions";

interface WarehouseOption {
  id: string;
  name: string;
  code: string;
  company_id: string;
}

interface SupplierOption {
  id: string;
  name: string;
  default_currency: string;
  default_payment_terms: string;
  default_payment_terms_custom: string;
  default_incoterms: string;
  default_port_of_loading: string;
  default_production_lead_time: string;
  po_receiving_email: string;
  default_ship_from_warehouse_id: string;
}

interface FormLine {
  product_id: string;
  name: string;
  letusto_sku: string | null;
  manufacture_sku: string | null;
  qty: number;
  unit_cost: number;
  line_note: string;
}

interface PurchaseOrderFormProps {
  initialPo?: any;
  warehouses: WarehouseOption[];
  suppliers: SupplierOption[];
  defaultWarehouseId: string;
}

export function PurchaseOrderForm({
  initialPo,
  warehouses,
  suppliers,
  defaultWarehouseId,
}: PurchaseOrderFormProps) {
  const router = useRouter();
  const isEdit = !!initialPo;

  // Header Fields
  const [supplierId, setSupplierId] = useState(initialPo?.supplier_id || "");
  const [orderDate, setOrderDate] = useState(
    initialPo?.order_date || new Date().toISOString().split("T")[0]
  );
  const [currency, setCurrency] = useState(initialPo?.currency || "USD");
  const [paymentTerms, setPaymentTerms] = useState(initialPo?.payment_terms || "");
  const [incoterms, setIncoterms] = useState(initialPo?.incoterms || "");
  const [portOfLoading, setPortOfLoading] = useState(initialPo?.port_of_loading || "");
  const [expectedReadyDate, setExpectedReadyDate] = useState(initialPo?.expected_ready_date || "");
  const [expectedShipDate, setExpectedShipDate] = useState(initialPo?.expected_ship_date || "");
  const [shipFromWarehouseId, setShipFromWarehouseId] = useState(initialPo?.ship_from_warehouse_id || "");
  const [destinationWarehouseId, setDestinationWarehouseId] = useState(
    initialPo?.destination_warehouse_id || defaultWarehouseId
  );
  const [poReceivingEmail, setPoReceivingEmail] = useState(initialPo?.po_receiving_email || "");
  const [internalNote, setInternalNote] = useState(initialPo?.internal_note || "");
  const [supplierFacingNote, setSupplierFacingNote] = useState(initialPo?.supplier_facing_note || "");

  // Lines
  const [lines, setLines] = useState<FormLine[]>(initialPo?.lines || []);

  // Reactive state for selected supplier's products
  const [supplierProducts, setSupplierProducts] = useState<any[]>([]);
  const [searchProductTerm, setSearchProductTerm] = useState("");
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load supplier defaults when supplier changes
  const handleSupplierChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const sId = e.target.value;
    setSupplierId(sId);
    setLines([]); // Clear added lines when supplier changes to prevent mismatched product associations

    const supplier = suppliers.find((s) => s.id === sId);
    if (supplier) {
      setCurrency(supplier.default_currency || "USD");
      setPaymentTerms(supplier.default_payment_terms_custom || supplier.default_payment_terms || "");
      setIncoterms(supplier.default_incoterms || "");
      setPortOfLoading(supplier.default_port_of_loading || "");
      setPoReceivingEmail(supplier.po_receiving_email || "");
      setShipFromWarehouseId(supplier.default_ship_from_warehouse_id || "");
      
      // Compute default expected ready date if production lead time is a number
      if (supplier.default_production_lead_time) {
        const days = parseInt(supplier.default_production_lead_time);
        if (!isNaN(days)) {
          const readyDate = new Date();
          readyDate.setDate(readyDate.getDate() + days);
          setExpectedReadyDate(readyDate.toISOString().split("T")[0]);
        }
      }
    }
  };

  // Fetch supplier products when supplierId changes
  useEffect(() => {
    if (!supplierId) {
      setSupplierProducts([]);
      return;
    }

    const fetchProducts = async () => {
      setIsLoadingProducts(true);
      try {
        const prods = await getProductsForSupplier(supplierId);
        setSupplierProducts(prods);
      } catch (err) {
        console.error("Failed to load products for supplier", err);
      } finally {
        setIsLoadingProducts(false);
      }
    };

    fetchProducts();
  }, [supplierId]);

  // Add Product to line
  const handleAddProduct = (prodId: string) => {
    const prod = supplierProducts.find((p) => p.id === prodId);
    if (!prod) return;

    // Check if already added
    if (lines.some((l) => l.product_id === prodId)) {
      alert("이미 추가된 제품입니다.");
      return;
    }

    const newLine: FormLine = {
      product_id: prod.id,
      name: prod.display_name,
      letusto_sku: prod.letusto_sku,
      manufacture_sku: prod.manufacture_sku,
      qty: 1,
      unit_cost: prod.price_usd_fob || 0,
      line_note: "",
    };

    setLines([...lines, newLine]);
    setSearchProductTerm(""); // Clear search
  };

  // Modify line property
  const handleLineChange = (index: number, key: keyof FormLine, value: any) => {
    const updated = [...lines];
    updated[index] = {
      ...updated[index],
      [key]: value,
    };
    setLines(updated);
  };

  // Remove line
  const handleRemoveLine = (index: number) => {
    const updated = [...lines];
    updated.splice(index, 1);
    setLines(updated);
  };

  // Calculation totals
  const totalQty = lines.reduce((sum, l) => sum + l.qty, 0);
  const totalAmount = lines.reduce((sum, l) => sum + l.qty * l.unit_cost, 0);

  // Form Submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError("");
    setIsSubmitting(true);

    try {
      if (!supplierId) throw new Error("공급사(Supplier)를 선택해 주세요.");
      if (!destinationWarehouseId) throw new Error("입고 목적 창고를 선택해 주세요.");
      if (lines.length === 0) throw new Error("최소 한 개 이상의 라인 품목을 추가해 주세요.");

      const payload = {
        supplier_id: supplierId,
        order_date: orderDate,
        currency,
        payment_terms: paymentTerms,
        incoterms,
        port_of_loading: portOfLoading,
        expected_ready_date: expectedReadyDate,
        expected_ship_date: expectedShipDate,
        ship_from_warehouse_id: shipFromWarehouseId || null,
        destination_warehouse_id: destinationWarehouseId,
        po_receiving_email: poReceivingEmail,
        internal_note: internalNote,
        supplier_facing_note: supplierFacingNote,
        lines: lines.map((l) => ({
          product_id: l.product_id,
          qty: l.qty,
          unit_cost: l.unit_cost,
          line_note: l.line_note,
        })),
      };

      if (isEdit) {
        await updatePurchaseOrder(initialPo.id, payload);
        router.push(`/admin/purchasing/${initialPo.id}`);
      } else {
        const res = await createPurchaseOrder(payload);
        router.push(`/admin/purchasing/${res.id}`);
      }
      router.refresh();
    } catch (err: any) {
      setSubmitError(err.message || "발주서 저장 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter supplier products list in selector based on search keyword
  const filteredSupplierProducts = supplierProducts.filter((p) => {
    const keyword = searchProductTerm.toLowerCase();
    return (
      p.display_name.toLowerCase().includes(keyword) ||
      (p.letusto_sku || "").toLowerCase().includes(keyword) ||
      (p.manufacture_sku || "").toLowerCase().includes(keyword)
    );
  });

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {submitError && (
        <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-600 font-bold dark:bg-rose-950/10 dark:border-rose-900/50 dark:text-rose-400 text-xs">
          ⚠️ {submitError}
        </div>
      )}

      {/* PO Header Fields Panel */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
        <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider border-b border-zinc-100 pb-2 dark:border-zinc-800">
          기본 발주 정보 및 상업 조건
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
          {/* Supplier */}
          <div className="space-y-1.5">
            <label className="font-bold text-zinc-600 dark:text-zinc-400">공급사 (Supplier) *</label>
            <select
              value={supplierId}
              onChange={handleSupplierChange}
              disabled={isEdit}
              className="w-full rounded border border-zinc-200 p-2.5 bg-white text-zinc-900 dark:border-zinc-850 dark:bg-zinc-955 dark:text-white focus:border-zinc-950 outline-none disabled:bg-zinc-50 dark:disabled:bg-zinc-800"
              required
            >
              <option value="">-- 공급사를 선택해 주세요 --</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Order Date */}
          <div className="space-y-1.5">
            <label className="font-bold text-zinc-600 dark:text-zinc-400">발주 일자 (Order Date) *</label>
            <input
              type="date"
              value={orderDate}
              onChange={(e) => setOrderDate(e.target.value)}
              className="w-full rounded border border-zinc-200 p-2 bg-white text-zinc-900 dark:border-zinc-850 dark:bg-zinc-955 dark:text-white focus:border-zinc-950 outline-none"
              required
            />
          </div>

          {/* Destination Warehouse */}
          <div className="space-y-1.5">
            <label className="font-bold text-zinc-600 dark:text-zinc-400">입고 목적 창고 (Destination) *</label>
            <select
              value={destinationWarehouseId}
              onChange={(e) => setDestinationWarehouseId(e.target.value)}
              className="w-full rounded border border-zinc-200 p-2.5 bg-white text-zinc-900 dark:border-zinc-850 dark:bg-zinc-955 dark:text-white focus:border-zinc-950 outline-none"
              required
            >
              {warehouses.map((wh) => (
                <option key={wh.id} value={wh.id}>
                  [{wh.code}] {wh.name}
                </option>
              ))}
            </select>
          </div>

          {/* Ship From Warehouse */}
          <div className="space-y-1.5">
            <label className="font-bold text-zinc-600 dark:text-zinc-400">출고지 창고 (Ship From)</label>
            <select
              value={shipFromWarehouseId}
              onChange={(e) => setShipFromWarehouseId(e.target.value)}
              className="w-full rounded border border-zinc-200 p-2.5 bg-white text-zinc-900 dark:border-zinc-850 dark:bg-zinc-955 dark:text-white focus:border-zinc-950 outline-none"
            >
              <option value="">미지정 (Not Set)</option>
              {warehouses
                .filter((wh) => wh.company_id === supplierId)
                .map((wh) => (
                  <option key={wh.id} value={wh.id}>
                    [{wh.code}] {wh.name}
                  </option>
                ))}
            </select>
          </div>

          {/* Currency */}
          <div className="space-y-1.5">
            <label className="font-bold text-zinc-600 dark:text-zinc-400">결제 통화 (Currency)</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full rounded border border-zinc-200 p-2.5 bg-white text-zinc-900 dark:border-zinc-850 dark:bg-zinc-955 dark:text-white focus:border-zinc-950 outline-none font-bold"
            >
              <option value="USD">USD ($)</option>
              <option value="KRW">KRW (₩)</option>
              <option value="JPY">JPY (¥)</option>
              <option value="EUR">EUR (€)</option>
            </select>
          </div>

          {/* Payment Terms */}
          <div className="space-y-1.5">
            <label className="font-bold text-zinc-600 dark:text-zinc-400">결제 조건 (Payment Terms)</label>
            <input
              type="text"
              placeholder="예: 30% Deposit / 70% Balance"
              value={paymentTerms}
              onChange={(e) => setPaymentTerms(e.target.value)}
              className="w-full rounded border border-zinc-200 p-2 bg-white text-zinc-900 dark:border-zinc-850 dark:bg-zinc-955 dark:text-white focus:border-zinc-950 outline-none"
            />
          </div>

          {/* Incoterms */}
          <div className="space-y-1.5">
            <label className="font-bold text-zinc-600 dark:text-zinc-400">거래 인도 조건 (Incoterms)</label>
            <input
              type="text"
              placeholder="예: FOB, CIF, EXW"
              value={incoterms}
              onChange={(e) => setIncoterms(e.target.value)}
              className="w-full rounded border border-zinc-200 p-2 bg-white text-zinc-900 dark:border-zinc-850 dark:bg-zinc-955 dark:text-white focus:border-zinc-950 outline-none"
            />
          </div>

          {/* Port of Loading */}
          <div className="space-y-1.5">
            <label className="font-bold text-zinc-600 dark:text-zinc-400">선적항 (Port of Loading)</label>
            <input
              type="text"
              placeholder="예: Shanghai Port, Incheon"
              value={portOfLoading}
              onChange={(e) => setPortOfLoading(e.target.value)}
              className="w-full rounded border border-zinc-200 p-2 bg-white text-zinc-900 dark:border-zinc-850 dark:bg-zinc-955 dark:text-white focus:border-zinc-950 outline-none"
            />
          </div>

          {/* Expected Ready Date */}
          <div className="space-y-1.5">
            <label className="font-bold text-zinc-600 dark:text-zinc-400">생산완료예정일 (Expected Ready Date)</label>
            <input
              type="date"
              value={expectedReadyDate}
              onChange={(e) => setExpectedReadyDate(e.target.value)}
              className="w-full rounded border border-zinc-200 p-2 bg-white text-zinc-900 dark:border-zinc-850 dark:bg-zinc-955 dark:text-white focus:border-zinc-950 outline-none"
            />
          </div>

          {/* Expected Ship Date */}
          <div className="space-y-1.5">
            <label className="font-bold text-zinc-600 dark:text-zinc-400">선적예정일 (Expected Ship Date)</label>
            <input
              type="date"
              value={expectedShipDate}
              onChange={(e) => setExpectedShipDate(e.target.value)}
              className="w-full rounded border border-zinc-200 p-2 bg-white text-zinc-900 dark:border-zinc-850 dark:bg-zinc-955 dark:text-white focus:border-zinc-950 outline-none"
            />
          </div>

          {/* PO Email */}
          <div className="space-y-1.5 md:col-span-3">
            <label className="font-bold text-zinc-600 dark:text-zinc-400">발주 이메일 수신처 (PO Receiving Email)</label>
            <input
              type="email"
              placeholder="supplier-email@example.com"
              value={poReceivingEmail}
              onChange={(e) => setPoReceivingEmail(e.target.value)}
              className="w-full rounded border border-zinc-200 p-2 bg-white text-zinc-900 dark:border-zinc-850 dark:bg-zinc-955 dark:text-white focus:border-zinc-950 outline-none"
            />
          </div>
        </div>
      </div>

      {/* Line Items Panel */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
        <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider border-b border-zinc-100 pb-2 dark:border-zinc-800">
          발주 품목 설정 (Line Items)
        </h3>

        {/* Product Selector to add lines */}
        {supplierId ? (
          <div className="space-y-2 text-xs">
            <label className="font-bold text-zinc-700 dark:text-zinc-300">상품 추가하기</label>
            <div className="relative max-w-lg">
              <input
                type="text"
                placeholder="추가할 제품명, Letusto SKU, 제조사 SKU 검색..."
                value={searchProductTerm}
                onChange={(e) => setSearchProductTerm(e.target.value)}
                className="w-full rounded border border-zinc-200 p-2 bg-zinc-50 text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white outline-none focus:border-zinc-950"
              />

              {searchProductTerm && (
                <div className="absolute left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded shadow-lg z-10 text-xs font-semibold">
                  {isLoadingProducts ? (
                    <div className="p-3 text-zinc-400">제품 로딩 중...</div>
                  ) : filteredSupplierProducts.length === 0 ? (
                    <div className="p-3 text-zinc-400">검색된 제품이 없습니다.</div>
                  ) : (
                    filteredSupplierProducts.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleAddProduct(p.id)}
                        className="w-full text-left p-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-850 flex justify-between items-center"
                      >
                        <div>
                          <span className="text-zinc-900 dark:text-white block font-bold">{p.display_name}</span>
                          <span className="text-[10px] text-zinc-400 font-mono">
                            SKU: {p.letusto_sku || "지정대기"} | 제조사 SKU: {p.manufacture_sku || "미입력"}
                          </span>
                        </div>
                        <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">
                          {currency} {p.price_usd_fob?.toFixed(2) || "0.00"} (FOB)
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="p-4 rounded border border-dashed border-zinc-200 dark:border-zinc-850 text-center text-zinc-400 text-xs font-semibold">
            상품을 선택하려면 상단에서 먼저 공급사를 지정해 주세요.
          </div>
        )}

        {/* Lines table */}
        {lines.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-zinc-150 dark:border-zinc-800/80">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-zinc-50/50 text-zinc-500 font-bold border-b border-zinc-150 dark:bg-zinc-900/50 dark:border-zinc-800 dark:text-zinc-350">
                  <th className="px-4 py-2.5">Letusto SKU</th>
                  <th className="px-4 py-2.5">제조사 SKU</th>
                  <th className="px-4 py-2.5">제품명</th>
                  <th className="px-4 py-2.5 w-24 text-right">발주수량 *</th>
                  <th className="px-4 py-2.5 w-32 text-right">FOB 단가 ({currency}) *</th>
                  <th className="px-4 py-2.5 w-32 text-right">합계 금액</th>
                  <th className="px-4 py-2.5">라인 비고</th>
                  <th className="px-4 py-2.5 text-center">삭제</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {lines.map((line, index) => (
                  <tr key={line.product_id} className="hover:bg-zinc-50/30 dark:hover:bg-zinc-850/5">
                    <td className="px-4 py-3 font-mono font-bold text-zinc-900 dark:text-white">
                      {line.letusto_sku || <span className="text-zinc-350 italic font-sans font-normal">지정 대기</span>}
                    </td>
                    <td className="px-4 py-3 font-mono text-zinc-700 dark:text-zinc-400">
                      {line.manufacture_sku || <span className="text-zinc-350 italic font-sans font-normal">미입력</span>}
                    </td>
                    <td className="px-4 py-3 font-bold text-zinc-900 dark:text-white max-w-xs truncate">{line.name}</td>
                    <td className="px-4 py-3 text-right">
                      <input
                        type="number"
                        min="1"
                        value={line.qty}
                        onChange={(e) => handleLineChange(index, "qty", parseInt(e.target.value) || 0)}
                        className="w-full text-right font-mono font-bold rounded border border-zinc-200 p-1 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                        required
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <input
                        type="number"
                        step="0.0001"
                        min="0"
                        value={line.unit_cost}
                        onChange={(e) => handleLineChange(index, "unit_cost", parseFloat(e.target.value) || 0)}
                        className="w-full text-right font-mono font-bold rounded border border-zinc-200 p-1 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                        required
                      />
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-zinc-900 dark:text-white">
                      {currency} {(line.qty * line.unit_cost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        placeholder="메모..."
                        value={line.line_note}
                        onChange={(e) => handleLineChange(index, "line_note", e.target.value)}
                        className="w-full rounded border border-zinc-200 p-1 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveLine(index)}
                        className="text-rose-500 hover:text-rose-700 text-xs font-bold"
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Aggregate Totals Panel */}
        {lines.length > 0 && (
          <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-900 flex justify-between items-center text-xs">
            <span className="text-zinc-500 font-bold">합계 요약</span>
            <div className="flex gap-6">
              <div>
                <span className="text-[10px] text-zinc-400 uppercase block mb-0.5">총 수량 (Total Qty)</span>
                <span className="text-sm font-bold font-mono text-zinc-900 dark:text-white">{totalQty.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-[10px] text-zinc-400 uppercase block mb-0.5">총 발주 금액 (Total Amount)</span>
                <span className="text-sm font-bold font-mono text-zinc-900 dark:text-white">
                  {currency} {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Notes Panel */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4 text-xs">
        <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider border-b border-zinc-100 pb-2 dark:border-zinc-800">
          비고 및 세부 특약사항
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-1.5">
            <label className="font-bold text-zinc-650 dark:text-zinc-400">내부 관리용 메모 (Internal Note)</label>
            <textarea
              placeholder="재고 입고 조건이나 특별한 사내 협의 내용을 작성해 주세요..."
              value={internalNote}
              onChange={(e) => setOriginalNote(e, setInternalNote)}
              className="w-full rounded border border-zinc-200 p-2.5 text-xs text-zinc-900 bg-zinc-50 dark:border-zinc-850 dark:bg-zinc-950 dark:text-white outline-none min-h-[80px]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="font-bold text-zinc-650 dark:text-zinc-400">공급사 전달용 메모 (Supplier-facing Note)</label>
            <textarea
              placeholder="Supplier 측에서 발주서 확인 시 전달할 패킹 요청이나 배송 수칙 등을 입력해 주세요..."
              value={supplierFacingNote}
              onChange={(e) => setOriginalNote(e, setSupplierFacingNote)}
              className="w-full rounded border border-zinc-200 p-2.5 text-xs text-zinc-900 bg-zinc-50 dark:border-zinc-850 dark:bg-zinc-955 dark:text-white outline-none min-h-[80px]"
            />
          </div>
        </div>
      </div>

      {/* Buttons */}
      <div className="flex justify-end gap-3.5">
        <button
          type="button"
          onClick={() => {
            if (isEdit) {
              router.push(`/admin/purchasing/${initialPo.id}`);
            } else {
              router.push("/admin/purchasing");
            }
          }}
          className="px-5 py-2.5 bg-zinc-50 border border-zinc-200 text-zinc-650 hover:bg-zinc-100 dark:bg-zinc-850 dark:border-zinc-800 dark:text-zinc-450 dark:hover:bg-zinc-800 rounded-xl font-bold cursor-pointer transition-all"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-5 py-2.5 bg-zinc-950 hover:bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 rounded-xl font-bold disabled:opacity-50 cursor-pointer shadow-sm transition-all"
        >
          {isSubmitting ? "저장 중..." : isEdit ? "발주서 수정" : "초안(Draft) 임시저장"}
        </button>
      </div>
    </form>
  );

  function setOriginalNote(e: React.ChangeEvent<HTMLTextAreaElement>, setter: (val: string) => void) {
    setter(e.target.value);
  }
}
