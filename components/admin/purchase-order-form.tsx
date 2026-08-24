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

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Load supplier defaults when supplier changes
  const handleSupplierChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const sId = e.target.value;

    if (lines.length > 0) {
      const confirmChange = window.confirm(
        "공급사를 변경하면 현재 선택된 발주 상품이 제거됩니다. 계속하시겠습니까?"
      );
      if (!confirmChange) {
        // Prevent changing state so select dropdown value reverts
        return;
      }
    }

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

  // Add multiple products from modal to lines
  const handleAddSelectedProducts = (selectedProducts: any[]) => {
    const newLines = [...lines];
    selectedProducts.forEach((prod) => {
      if (!newLines.some((l) => l.product_id === prod.id)) {
        newLines.push({
          product_id: prod.id,
          name: prod.display_name || prod.name,
          letusto_sku: prod.letusto_sku,
          manufacture_sku: prod.manufacture_sku,
          qty: 1,
          unit_cost: prod.price_usd_fob || 0,
          line_note: "",
        });
      }
    });
    setLines(newLines);
    setIsModalOpen(false);
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
              {/* Product Selector to add lines */}
        <div className="space-y-2 text-xs">
          <label className="font-bold text-zinc-700 dark:text-zinc-300">상품 추가하기</label>
          <div className="flex gap-2 items-center max-w-xl">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder={
                  supplierId
                    ? "추가할 제품명, Letusto SKU, 제조사 SKU 검색..."
                    : "공급사를 먼저 선택해 주세요..."
                }
                value={searchProductTerm}
                onChange={(e) => {
                  if (!supplierId) {
                    alert("먼저 공급사를 선택해주세요. 공급사를 선택하면 해당 공급사가 등록한 상품만 조회됩니다.");
                    return;
                  }
                  setSearchProductTerm(e.target.value);
                }}
                disabled={!supplierId}
                className="w-full rounded border border-zinc-200 p-2 bg-zinc-50 text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white outline-none focus:border-zinc-950 text-xs disabled:opacity-50"
              />

              {supplierId && searchProductTerm && (
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
                        className="w-full text-left p-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-850 flex justify-between items-center cursor-pointer"
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

            <button
              type="button"
              onClick={() => {
                if (!supplierId) {
                  alert("먼저 공급사를 선택해주세요. 공급사를 선택하면 해당 공급사가 등록한 상품만 조회됩니다.");
                  return;
                }
                setIsModalOpen(true);
              }}
              className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-white rounded border border-zinc-300 dark:border-zinc-750 text-xs font-bold transition-all cursor-pointer whitespace-nowrap"
            >
              상품 찾아보기
            </button>
          </div>
          {!supplierId && (
            <p className="text-[10px] text-zinc-500 font-medium">
              ※ 상품을 선택하려면 상단에서 먼저 공급사를 지정해 주세요.
            </p>
          )}
        </div>

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

      {isModalOpen && (
        <ProductBrowseModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          supplierName={suppliers.find((s) => s.id === supplierId)?.name || ""}
          products={supplierProducts}
          onAddProducts={handleAddSelectedProducts}
          addedProductIds={new Set(lines.map((l) => l.product_id))}
          currency={currency}
        />
      )}
    </form>
  );

  function setOriginalNote(e: React.ChangeEvent<HTMLTextAreaElement>, setter: (val: string) => void) {
    setter(e.target.value);
  }
}

interface ProductBrowseModalProps {
  isOpen: boolean;
  onClose: () => void;
  supplierName: string;
  products: any[];
  onAddProducts: (selectedProducts: any[]) => void;
  addedProductIds: Set<string>;
  currency: string;
}

function ProductBrowseModal({
  isOpen,
  onClose,
  supplierName,
  products,
  onAddProducts,
  addedProductIds,
  currency,
}: ProductBrowseModalProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());

  // Extract unique brands and categories
  const uniqueBrands = Array.from(new Set(products.map((p) => p.brand_name).filter(Boolean))) as string[];
  const uniqueCategories = Array.from(new Set(products.map((p) => p.category_label).filter(Boolean))) as string[];

  // Filter products based on search term, category, and brand
  const filteredProducts = products.filter((p) => {
    const term = searchTerm.trim().toLowerCase();
    const matchesSearch = !term || [
      p.display_name,
      p.brand_name,
      p.letusto_sku,
      p.manufacture_sku,
      p.upc
    ].some(field => (field || "").toLowerCase().includes(term));

    const matchesBrand = selectedBrand === "all" || p.brand_name === selectedBrand;
    const matchesCategory = selectedCategory === "all" || p.category_label === selectedCategory;

    return matchesSearch && matchesBrand && matchesCategory;
  });

  // Grouping logic for Parent/Variant structures
  const parentSkus = new Set<string>();
  filteredProducts.forEach((p) => {
    if (p.parent_sku) {
      parentSkus.add(p.parent_sku);
    }
  });

  const parents: any[] = [];
  const childrenMap = new Map<string, any[]>();
  const standalones: any[] = [];

  filteredProducts.forEach((p) => {
    if (p.parent_sku) {
      const list = childrenMap.get(p.parent_sku) || [];
      list.push(p);
      childrenMap.set(p.parent_sku, list);
    } else if (p.letusto_sku && parentSkus.has(p.letusto_sku)) {
      parents.push(p);
    } else {
      standalones.push(p);
    }
  });

  // Handle virtual parents where parent record is missing from catalog
  for (const parentSku of parentSkus) {
    const hasParent = parents.some((p) => p.letusto_sku === parentSku);
    if (!hasParent) {
      const children = childrenMap.get(parentSku) || [];
      if (children.length > 0) {
        parents.push({
          id: `virtual-${parentSku}`,
          display_name: children[0].display_name.replace(/\s*[-–].*$/, "") || `Product (${parentSku})`,
          brand_name: children[0].brand_name,
          category_label: children[0].category_label,
          letusto_sku: parentSku,
          photo_url: children[0].photo_url,
          is_virtual: true,
        });
      }
    }
  }

  // Toggle expand
  const toggleParentExpand = (parentSku: string) => {
    const next = new Set(expandedParents);
    if (next.has(parentSku)) {
      next.delete(parentSku);
    } else {
      next.add(parentSku);
    }
    setExpandedParents(next);
  };

  const handleSelectProduct = (id: string, checked: boolean) => {
    const next = new Set(selectedProductIds);
    if (checked) {
      next.add(id);
    } else {
      next.delete(id);
    }
    setSelectedProductIds(next);
  };

  const handleSelectParentAll = (parentSku: string, checked: boolean) => {
    const next = new Set(selectedProductIds);
    const children = childrenMap.get(parentSku) || [];
    children.forEach((c) => {
      if (!addedProductIds.has(c.id)) {
        if (checked) {
          next.add(c.id);
        } else {
          next.delete(c.id);
        }
      }
    });
    setSelectedProductIds(next);
  };

  const handleSelectAllVisible = (checked: boolean) => {
    const next = new Set(selectedProductIds);
    filteredProducts.forEach((p) => {
      const hasChildren = parentSkus.has(p.letusto_sku || "");
      const isCheckable = !p.parent_sku ? !hasChildren : true;
      if (isCheckable && !addedProductIds.has(p.id)) {
        if (checked) {
          next.add(p.id);
        } else {
          next.delete(p.id);
        }
      }
    });
    for (const parentSku of parentSkus) {
      const children = childrenMap.get(parentSku) || [];
      children.forEach((c) => {
        if (!addedProductIds.has(c.id)) {
          if (checked) {
            next.add(c.id);
          } else {
            next.delete(c.id);
          }
        }
      });
    }
    setSelectedProductIds(next);
  };

  // Determine if header checkbox should be checked/indeterminate
  const checkableProducts = filteredProducts.filter((p) => {
    const hasChildren = parentSkus.has(p.letusto_sku || "");
    const isCheckable = !p.parent_sku ? !hasChildren : true;
    return isCheckable && !addedProductIds.has(p.id);
  });
  const allChecked = checkableProducts.length > 0 && checkableProducts.every((p) => selectedProductIds.has(p.id));

  const handleAddClick = () => {
    const selected = products.filter((p) => selectedProductIds.has(p.id));
    onAddProducts(selected);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-5xl rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl flex flex-col max-h-[85vh] text-xs">
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-zinc-150 dark:border-zinc-800">
          <h2 className="text-sm font-bold text-zinc-900 dark:text-white">
            상품 선택 — <span className="text-zinc-655 dark:text-zinc-350">{supplierName}</span>
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors text-base font-bold cursor-pointer"
          >
            &times;
          </button>
        </div>

        {/* Filter bar */}
        <div className="px-6 py-4 bg-zinc-50/50 dark:bg-zinc-955/20 border-b border-zinc-150 dark:border-zinc-800 flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="제품명 / Brand / Letusto SKU / Supplier SKU / UPC 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-zinc-900 dark:text-white outline-none focus:border-zinc-400 dark:focus:border-zinc-700"
            />
          </div>
          <div className="w-full md:w-48">
            <select
              value={selectedBrand}
              onChange={(e) => setSelectedBrand(e.target.value)}
              className="w-full rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-2 text-zinc-900 dark:text-white outline-none"
            >
              <option value="all">All Brands</option>
              {uniqueBrands.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
          <div className="w-full md:w-48">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-2 text-zinc-900 dark:text-white outline-none"
            >
              <option value="all">All Categories</option>
              {uniqueCategories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Table Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50/50 dark:bg-zinc-950/20 text-zinc-550 dark:text-zinc-400 font-bold border-b border-zinc-150 dark:border-zinc-800">
                <th className="px-4 py-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={(e) => handleSelectAllVisible(e.target.checked)}
                    className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </th>
                <th className="px-4 py-3 w-16">이미지</th>
                <th className="px-4 py-3">제품명 / 상세 정보</th>
                <th className="px-4 py-3 w-28">브랜드</th>
                <th className="px-4 py-3 w-28">카테고리</th>
                <th className="px-4 py-3 w-28">제조사 SKU</th>
                <th className="px-4 py-3 w-28">Letusto SKU</th>
                <th className="px-4 py-3 w-32">UPC / EAN</th>
                <th className="px-4 py-3 w-28 text-right">FOB 단가 ({currency})</th>
                <th className="px-4 py-3 w-16 text-center">상세</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {/* Standalones */}
              {standalones.map((p) => {
                const isAdded = addedProductIds.has(p.id);
                return (
                  <tr key={p.id} className="hover:bg-zinc-50/30 dark:hover:bg-zinc-850/5">
                    <td className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        disabled={isAdded}
                        checked={isAdded || selectedProductIds.has(p.id)}
                        onChange={(e) => handleSelectProduct(p.id, e.target.checked)}
                        className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500 cursor-pointer disabled:opacity-50"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="w-10 h-10 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 overflow-hidden flex items-center justify-center">
                        {p.photo_url ? (
                          <img src={p.photo_url} alt={p.display_name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-[9px] text-zinc-400">No Image</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-bold text-zinc-900 dark:text-white block">{p.display_name}</span>
                      {isAdded && (
                        <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 font-bold text-[9px]">
                          이미 발주에 추가됨
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-700 dark:text-zinc-400">{p.brand_name}</td>
                    <td className="px-4 py-3 text-zinc-500">{p.category_label}</td>
                    <td className="px-4 py-3 font-mono text-zinc-750 dark:text-zinc-450">{p.manufacture_sku || "-"}</td>
                    <td className="px-4 py-3 font-mono font-bold text-zinc-900 dark:text-white">{p.letusto_sku || "-"}</td>
                    <td className="px-4 py-3 font-mono text-zinc-500">{p.upc || "-"}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-zinc-900 dark:text-white">
                      {(p.price_usd_fob || 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-center">-</td>
                  </tr>
                );
              })}

              {/* Parents with child variants */}
              {parents.map((parent) => {
                const children = childrenMap.get(parent.letusto_sku) || [];
                const isExpanded = expandedParents.has(parent.letusto_sku);
                const checkableChildren = children.filter((c) => !addedProductIds.has(c.id));
                const allChildrenSelected = checkableChildren.length > 0 && checkableChildren.every((c) => selectedProductIds.has(c.id));

                return (
                  <React.Fragment key={parent.id}>
                    {/* Parent Row */}
                    <tr className="bg-zinc-50/20 dark:bg-zinc-900/10 font-bold border-b border-zinc-100 dark:border-zinc-800">
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          disabled={checkableChildren.length === 0}
                          checked={allChildrenSelected}
                          onChange={(e) => handleSelectParentAll(parent.letusto_sku, e.target.checked)}
                          className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500 cursor-pointer disabled:opacity-50"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="w-10 h-10 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 overflow-hidden flex items-center justify-center">
                          {parent.photo_url ? (
                            <img src={parent.photo_url} alt={parent.display_name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-[9px] text-zinc-400">No Image</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-zinc-900 dark:text-white text-xs">{parent.display_name}</span>
                        <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/10 text-blue-600 dark:text-blue-400 text-[9px] ml-1.5">
                          {children.length} Variants
                        </span>
                      </td>
                      <td className="px-4 py-3 text-zinc-700 dark:text-zinc-400">{parent.brand_name}</td>
                      <td className="px-4 py-3 text-zinc-500">{parent.category_label || "-"}</td>
                      <td className="px-4 py-3 font-mono text-zinc-400">-</td>
                      <td className="px-4 py-3 font-mono text-zinc-500">{parent.letusto_sku}</td>
                      <td className="px-4 py-3 font-mono text-zinc-400">-</td>
                      <td className="px-4 py-3 text-right font-mono text-zinc-400">Variant 단위 선택</td>
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => toggleParentExpand(parent.letusto_sku)}
                          className="w-6 h-6 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 flex items-center justify-center font-mono text-sm cursor-pointer"
                        >
                          {isExpanded ? "▼" : "▶"}
                        </button>
                      </td>
                    </tr>

                    {/* Children Rows */}
                    {isExpanded &&
                      children.map((child) => {
                        const isAdded = addedProductIds.has(child.id);
                        return (
                          <tr key={child.id} className="bg-zinc-50/10 dark:bg-zinc-900/5 hover:bg-zinc-50/30 dark:hover:bg-zinc-850/5">
                            <td className="px-4 py-3 text-center pl-8">
                              <input
                                type="checkbox"
                                disabled={isAdded}
                                checked={isAdded || selectedProductIds.has(child.id)}
                                onChange={(e) => handleSelectProduct(child.id, e.target.checked)}
                                className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500 cursor-pointer disabled:opacity-50"
                              />
                            </td>
                            <td className="px-4 py-3 pl-8">
                              <div className="w-8 h-8 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 overflow-hidden flex items-center justify-center">
                                {child.photo_url ? (
                                  <img src={child.photo_url} alt={child.display_name} className="w-full h-full object-cover" />
                                ) : (
                                  <span className="text-[8px] text-zinc-400">No Image</span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 pl-6">
                              <span className="text-zinc-700 dark:text-zinc-300 font-bold block">{child.display_name}</span>
                              {isAdded && (
                                <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 font-bold text-[9px]">
                                  이미 발주에 추가됨
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-zinc-400">{child.brand_name}</td>
                            <td className="px-4 py-3 text-zinc-400">{child.category_label}</td>
                            <td className="px-4 py-3 font-mono text-zinc-700 dark:text-zinc-400">{child.manufacture_sku || "-"}</td>
                            <td className="px-4 py-3 font-mono font-bold text-zinc-900 dark:text-white">{child.letusto_sku || "-"}</td>
                            <td className="px-4 py-3 font-mono text-zinc-550">{child.upc || "-"}</td>
                            <td className="px-4 py-3 text-right font-mono font-bold text-zinc-900 dark:text-white">
                              {(child.price_usd_fob || 0).toFixed(2)}
                            </td>
                            <td className="px-4 py-3 text-center">-</td>
                          </tr>
                        );
                      })}
                  </React.Fragment>
                );
              })}

              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={10} className="text-center p-8 text-zinc-400 font-semibold">
                    조회된 상품이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Actions */}
        <div className="flex justify-between items-center px-6 py-4 border-t border-zinc-150 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/20">
          <div className="font-bold text-zinc-500">
            {selectedProductIds.size}개 상품 선택됨
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-zinc-200 dark:border-zinc-800 rounded bg-white dark:bg-zinc-950 hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-750 dark:text-zinc-300 font-bold transition-all cursor-pointer"
            >
              닫기
            </button>
            <button
              type="button"
              onClick={handleAddClick}
              disabled={selectedProductIds.size === 0}
              className="px-4 py-2 rounded bg-zinc-950 text-white hover:bg-zinc-900 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 font-bold disabled:opacity-50 transition-all cursor-pointer"
            >
              선택한 {selectedProductIds.size}개 상품 추가
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
