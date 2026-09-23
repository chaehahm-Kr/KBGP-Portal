"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { getEasternTodayString } from "@/lib/utils/timezone";

export interface PurchaseOrderLineItem {
  id: string;
  po_id: string;
  po_number: string;
  product_id: string;
  product_name: string;
  letusto_sku: string;
  manufacture_sku: string;
  brand_name: string;
  qty: number;
  unit_cost: number;
  confirmed_qty?: number | null;
  line_note?: string;
  shipped_qty: number;
  received_qty: number;
  remaining_qty: number;
  image_url?: string | null;
  supplier_name: string;
  order_date: string;
  po_status: "DRAFT" | "APPROVED" | "SENT" | "CANCELLED";
  fulfillment_status: "PENDING" | "IN_PRODUCTION" | "READY_TO_SHIP" | "SHIPPED" | "RECEIVED";
  supplier_confirmation_status?: string | null;
  warehouse_code: string;
  warehouse_name: string;
  eta?: string | null;
}

export interface PurchaseOrderItem {
  id: string;
  po_number: string;
  order_date: string;
  po_status: "DRAFT" | "APPROVED" | "SENT" | "CANCELLED";
  fulfillment_status: "PENDING" | "IN_PRODUCTION" | "READY_TO_SHIP" | "SHIPPED" | "RECEIVED";
  supplier_confirmation_status?: string | null;
  currency: string;
  expected_ready_date: string | null;
  last_updated: string;
  supplier_name: string;
  supplier_id?: string;
  warehouse_name: string;
  warehouse_code: string;
  destination_warehouse_id?: string;
  ship_from_name: string;
  ship_from_code: string;
  total_qty: number;
  total_amount: number;
  overall_status?: string;
  shipment_status?: string;
  receiving_status?: string;
  final_qty?: number;
  eta?: string | null;
  lines?: PurchaseOrderLineItem[];
}

export interface WarehouseOption {
  id: string;
  name: string;
  code: string;
}

export interface SupplierOption {
  id: string;
  name: string;
}

export interface PurchaseOrdersListProps {
  initialPos: PurchaseOrderItem[];
  warehouses: WarehouseOption[];
  suppliers: SupplierOption[];
}

const PO_STATUS_OPTIONS: { key: "DRAFT" | "APPROVED" | "SENT" | "CANCELLED"; label: string; chipClass: string }[] = [
  { key: "DRAFT", label: "Draft", chipClass: "bg-zinc-100 text-zinc-700 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700" },
  { key: "APPROVED", label: "Approved", chipClass: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900" },
  { key: "SENT", label: "Sent", chipClass: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-900" },
  { key: "CANCELLED", label: "Cancelled", chipClass: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-900" },
];

const ORDER_STATUS_OPTIONS: { key: "PENDING" | "IN_PRODUCTION" | "READY_TO_SHIP" | "SHIPPED" | "RECEIVED"; label: string; chipClass: string }[] = [
  { key: "PENDING", label: "Pending", chipClass: "bg-zinc-100 text-zinc-600 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700" },
  { key: "IN_PRODUCTION", label: "In Production", chipClass: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900" },
  { key: "READY_TO_SHIP", label: "Ready to Ship", chipClass: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900" },
  { key: "SHIPPED", label: "Shipped", chipClass: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/30 dark:text-teal-400 dark:border-teal-900" },
  { key: "RECEIVED", label: "Received", chipClass: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/30 dark:text-sky-400 dark:border-sky-900" },
];

const PO_STATUS_BADGE: Record<string, string> = {
  DRAFT: "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700",
  APPROVED: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/50",
  SENT: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/20 dark:text-indigo-400 dark:border-indigo-900/50",
  CANCELLED: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/50",
};

const ORDER_STATUS_BADGE: Record<string, string> = {
  PENDING: "bg-zinc-50 text-zinc-500 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-500 dark:border-zinc-800",
  IN_PRODUCTION: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/50",
  READY_TO_SHIP: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/50",
  SHIPPED: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/20 dark:text-teal-400 dark:border-teal-900/50",
  RECEIVED: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/20 dark:text-sky-400 dark:border-sky-900/50",
};

const CONFIRMATION_BADGE: Record<string, { label: string; className: string }> = {
  CONFIRMED: { label: "확인완료 (Confirmed)", className: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/50" },
  UNCONFIRMED: { label: "미확인 (Pending)", className: "bg-zinc-50 text-zinc-600 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800" },
  CHANGE_REQUESTED: { label: "수정요청 (Change Req)", className: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/50" },
};

export function PurchaseOrdersList({
  initialPos,
  warehouses,
  suppliers,
}: PurchaseOrdersListProps) {
  const today = getEasternTodayString();
  const searchParams = useSearchParams();

  const urlSupplier = searchParams ? searchParams.get("supplierId") : null;
  const urlSearch = searchParams ? searchParams.get("search") : null;
  const urlOrderStatus = searchParams ? searchParams.get("orderStatus") : null;

  // View mode switcher: 'po' (PO별 보기) vs 'product' (제품별 보기)
  const [viewMode, setViewMode] = useState<"po" | "product">("po");

  // Shared Filters
  const [searchTerm, setSearchTerm] = useState(urlSearch || "");
  const [selectedSupplierId, setSelectedSupplierId] = useState(urlSupplier || "all");
  const [selectedPoStatuses, setSelectedPoStatuses] = useState<string[]>([]);
  const [selectedOrderStatuses, setSelectedOrderStatuses] = useState<string[]>(
    urlOrderStatus ? [urlOrderStatus] : []
  );
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("all");

  // Toggle multi-select PO status
  const togglePoStatus = (status: string) => {
    setSelectedPoStatuses((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
  };

  // Toggle multi-select Order status
  const toggleOrderStatus = (status: string) => {
    setSelectedOrderStatuses((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
  };

  // Reset all filters
  const handleResetFilters = () => {
    setSearchTerm("");
    setSelectedSupplierId("all");
    setSelectedPoStatuses([]);
    setSelectedOrderStatuses([]);
    setSelectedWarehouseId("all");
  };

  const hasActiveFilters =
    searchTerm !== "" ||
    selectedSupplierId !== "all" ||
    selectedPoStatuses.length > 0 ||
    selectedOrderStatuses.length > 0 ||
    selectedWarehouseId !== "all";

  // Filtered POs
  const filteredPos = useMemo(() => {
    const s = searchTerm.toLowerCase().trim();

    return initialPos.filter((po) => {
      // 1. Supplier filter
      const supplierOption = suppliers.find((sub) => sub.id === selectedSupplierId);
      const matchesSupplier =
        selectedSupplierId === "all" ||
        po.supplier_id === selectedSupplierId ||
        po.supplier_name === supplierOption?.name;

      // 2. PO Status filter (multi-select: if empty, match all)
      const matchesPoStatus =
        selectedPoStatuses.length === 0 || selectedPoStatuses.includes(po.po_status);

      // 3. Order Status filter (multi-select: if empty, match all)
      const matchesOrderStatus =
        selectedOrderStatuses.length === 0 ||
        selectedOrderStatuses.includes(po.fulfillment_status) ||
        selectedOrderStatuses.some((st) => {
          if (st === 'Pending') return po.fulfillment_status === 'PENDING' || po.po_status === 'DRAFT' || po.po_status === 'APPROVED';
          if (st === 'In Production') return po.fulfillment_status === 'IN_PRODUCTION';
          if (st === 'Ready to Ship') return po.fulfillment_status === 'READY_TO_SHIP';
          if (st === 'Shipped') return po.fulfillment_status === 'SHIPPED';
          if (st === 'Received') return po.fulfillment_status === 'RECEIVED';
          return false;
        });

      // 4. Warehouse filter
      const matchesWarehouse =
        selectedWarehouseId === "all" ||
        po.destination_warehouse_id === selectedWarehouseId ||
        warehouses.find((w) => w.id === selectedWarehouseId)?.code === po.warehouse_code;

      // 5. Search filter (PO number, Supplier name, or contained products)
      let matchesSearch = true;
      if (s) {
        const matchesPo =
          po.po_number.toLowerCase().includes(s) ||
          po.supplier_name.toLowerCase().includes(s);

        const matchesLine = (po.lines || []).some(
          (l) =>
            l.product_name.toLowerCase().includes(s) ||
            l.letusto_sku.toLowerCase().includes(s) ||
            l.manufacture_sku.toLowerCase().includes(s)
        );

        matchesSearch = matchesPo || matchesLine;
      }

      return matchesSupplier && matchesPoStatus && matchesOrderStatus && matchesWarehouse && matchesSearch;
    });
  }, [initialPos, suppliers, warehouses, searchTerm, selectedSupplierId, selectedPoStatuses, selectedOrderStatuses, selectedWarehouseId]);

  // Flattened Product Lines for '제품별 보기'
  const filteredProductLines = useMemo(() => {
    const lines: PurchaseOrderLineItem[] = [];
    const s = searchTerm.toLowerCase().trim();

    filteredPos.forEach((po) => {
      (po.lines || []).forEach((l) => {
        if (s) {
          const matchesKeyword =
            l.product_name.toLowerCase().includes(s) ||
            l.letusto_sku.toLowerCase().includes(s) ||
            l.manufacture_sku.toLowerCase().includes(s) ||
            l.po_number.toLowerCase().includes(s) ||
            l.supplier_name.toLowerCase().includes(s);
          if (!matchesKeyword) return;
        }
        lines.push(l);
      });
    });

    return lines;
  }, [filteredPos, searchTerm]);

  return (
    <div className="space-y-4">
      {/* View Mode Switcher Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="inline-flex rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-inner">
          <button
            type="button"
            onClick={() => setViewMode("po")}
            className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              viewMode === "po"
                ? "bg-white text-zinc-950 shadow-sm dark:bg-zinc-950 dark:text-white"
                : "text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white"
            }`}
          >
            <span>📄</span>
            <span>PO별 보기 (PO View)</span>
            <span className="ml-1 rounded-full bg-zinc-200 dark:bg-zinc-700 px-2 py-0.5 text-[10px] font-mono">
              {filteredPos.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("product")}
            className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              viewMode === "product"
                ? "bg-white text-zinc-950 shadow-sm dark:bg-zinc-950 dark:text-white"
                : "text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white"
            }`}
          >
            <span>📦</span>
            <span>제품별 보기 (Product View)</span>
            <span className="ml-1 rounded-full bg-zinc-200 dark:bg-zinc-700 px-2 py-0.5 text-[10px] font-mono">
              {filteredProductLines.length}
            </span>
          </button>
        </div>

        <div className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
          {viewMode === "po" ? (
            <span>총 <strong className="text-zinc-900 dark:text-white">{filteredPos.length}</strong>건의 발주서</span>
          ) : (
            <span>총 <strong className="text-zinc-900 dark:text-white">{filteredProductLines.length}</strong>건의 품목 라인</span>
          )}
        </div>
      </div>

      {/* Shared Search and Filters Panel */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
        {/* Row 1: Search, Supplier, Destination Warehouse */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {/* Search Input */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
              검색어 (Search)
            </span>
            <input
              type="text"
              placeholder="발주 번호, 공급사명, 제품명, SKU..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2 text-xs outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-955 dark:text-white dark:focus:border-zinc-700"
            />
          </div>

          {/* Supplier filter */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
              공급사 (Supplier)
            </span>
            <select
              value={selectedSupplierId}
              onChange={(e) => setSelectedSupplierId(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-955 dark:text-white"
            >
              <option value="all">전체 공급사 (All Suppliers)</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Destination Warehouse filter */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
              입고 목적 창고 (Destination Warehouse)
            </span>
            <select
              value={selectedWarehouseId}
              onChange={(e) => setSelectedWarehouseId(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-955 dark:text-white"
            >
              <option value="all">전체 창고 (All Warehouses)</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  [{w.code}] {w.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 2: Status Multi-select Chips */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-zinc-100 dark:border-zinc-800">
          {/* PO Status Multi-select */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                PO Status (문서 진행 상태)
              </span>
              {selectedPoStatuses.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedPoStatuses([])}
                  className="text-[10px] text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 underline cursor-pointer"
                >
                  전체
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {PO_STATUS_OPTIONS.map((opt) => {
                const isSelected = selectedPoStatuses.includes(opt.key);
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => togglePoStatus(opt.key)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer select-none ${
                      isSelected
                        ? "bg-zinc-950 text-white border-zinc-950 dark:bg-white dark:text-zinc-950 dark:border-white shadow-sm"
                        : "bg-zinc-50/80 text-zinc-600 border-zinc-200 hover:bg-zinc-100 dark:bg-zinc-950/40 dark:text-zinc-400 dark:border-zinc-800 dark:hover:bg-zinc-800"
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${isSelected ? "bg-emerald-400" : "bg-zinc-300 dark:bg-zinc-600"}`} />
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Order Status Multi-select */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                Order Status (물류 이행 상태)
              </span>
              {selectedOrderStatuses.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedOrderStatuses([])}
                  className="text-[10px] text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 underline cursor-pointer"
                >
                  전체
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {ORDER_STATUS_OPTIONS.map((opt) => {
                const isSelected = selectedOrderStatuses.includes(opt.key);
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => toggleOrderStatus(opt.key)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer select-none ${
                      isSelected
                        ? "bg-zinc-950 text-white border-zinc-950 dark:bg-white dark:text-zinc-950 dark:border-white shadow-sm"
                        : "bg-zinc-50/80 text-zinc-600 border-zinc-200 hover:bg-zinc-100 dark:bg-zinc-950/40 dark:text-zinc-400 dark:border-zinc-800 dark:hover:bg-zinc-800"
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${isSelected ? "bg-emerald-400" : "bg-zinc-300 dark:bg-zinc-600"}`} />
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Results Info & Reset */}
        <div className="flex justify-between items-center text-[10px] text-zinc-500 dark:text-zinc-400 pt-1 border-t border-zinc-100 dark:border-zinc-800">
          <span>
            조회 결과:{" "}
            <strong className="text-zinc-900 dark:text-zinc-200 font-bold">
              {viewMode === "po" ? filteredPos.length : filteredProductLines.length}
            </strong>{" "}
            건
          </span>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-zinc-900 hover:underline dark:text-zinc-200 font-bold cursor-pointer"
            >
              🔄 필터 전체 초기화
            </button>
          )}
        </div>
      </div>

      {/* VIEW 1: PO별 보기 (PO-Level Table) */}
      {viewMode === "po" && (
        <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50/60 text-zinc-600 font-bold dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300">
                  <th className="px-5 py-3.5 whitespace-nowrap">PO Number</th>
                  <th className="px-5 py-3.5 whitespace-nowrap">Supplier</th>
                  <th className="px-5 py-3.5 whitespace-nowrap">Order Date</th>
                  <th className="px-5 py-3.5 whitespace-nowrap text-right">Ordered Qty</th>
                  <th className="px-5 py-3.5 whitespace-nowrap">PO Status</th>
                  <th className="px-5 py-3.5 whitespace-nowrap">Order Status</th>
                  <th className="px-5 py-3.5 whitespace-nowrap">Supplier Confirm</th>
                  <th className="px-5 py-3.5 whitespace-nowrap text-right">Received / Final</th>
                  <th className="px-5 py-3.5 whitespace-nowrap">ETA / 입고예정일</th>
                  <th className="px-5 py-3.5 whitespace-nowrap text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-150 dark:divide-zinc-800/80">
                {filteredPos.map((po) => {
                  const isOverdue =
                    po.eta &&
                    po.eta < today &&
                    po.fulfillment_status !== "RECEIVED" &&
                    po.po_status !== "CANCELLED";

                  const confInfo = po.supplier_confirmation_status
                    ? CONFIRMATION_BADGE[po.supplier_confirmation_status]
                    : null;

                  return (
                    <tr
                      key={po.id}
                      className="hover:bg-zinc-50/40 dark:hover:bg-zinc-850/20 transition-colors"
                    >
                      {/* PO Number */}
                      <td className="px-5 py-4 align-middle font-mono font-bold text-zinc-950 dark:text-white whitespace-nowrap">
                        <Link
                          href={`/admin/purchasing/${po.id}`}
                          className="hover:underline hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        >
                          {po.po_number}
                        </Link>
                      </td>

                      {/* Supplier */}
                      <td className="px-5 py-4 align-middle font-bold text-zinc-900 dark:text-zinc-200 max-w-[140px] truncate">
                        {po.supplier_name}
                      </td>

                      {/* Order Date */}
                      <td className="px-5 py-4 align-middle text-zinc-600 dark:text-zinc-400 font-medium whitespace-nowrap">
                        {po.order_date}
                      </td>

                      {/* Ordered Qty */}
                      <td className="px-5 py-4 align-middle text-right font-mono font-bold text-zinc-900 dark:text-white whitespace-nowrap">
                        {po.total_qty.toLocaleString()}
                      </td>

                      {/* PO Status */}
                      <td className="px-5 py-4 align-middle whitespace-nowrap">
                        <span
                          className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold border ${
                            PO_STATUS_BADGE[po.po_status] || "bg-zinc-100 text-zinc-700"
                          }`}
                        >
                          {po.po_status}
                        </span>
                      </td>

                      {/* Order Status */}
                      <td className="px-5 py-4 align-middle whitespace-nowrap">
                        <span
                          className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold border ${
                            ORDER_STATUS_BADGE[po.fulfillment_status] || "bg-zinc-100 text-zinc-700"
                          }`}
                        >
                          {po.fulfillment_status}
                        </span>
                      </td>

                      {/* Supplier Confirmation */}
                      <td className="px-5 py-4 align-middle whitespace-nowrap">
                        {confInfo ? (
                          <span
                            className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold border ${confInfo.className}`}
                          >
                            {confInfo.label}
                          </span>
                        ) : (
                          <span className="text-zinc-400 text-[11px]">-</span>
                        )}
                      </td>

                      {/* Received / Final Qty */}
                      <td className="px-5 py-4 align-middle text-right font-mono font-bold text-zinc-900 dark:text-white whitespace-nowrap">
                        {po.fulfillment_status === "RECEIVED" || (po.final_qty ?? 0) > 0 ? (
                          <span>{(po.final_qty ?? 0).toLocaleString()}</span>
                        ) : (
                          <span className="text-zinc-400 font-normal">-</span>
                        )}
                      </td>

                      {/* ETA */}
                      <td className="px-5 py-4 align-middle whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="text-zinc-600 dark:text-zinc-300 font-medium">
                            {po.eta || "-"}
                          </span>
                          {isOverdue && (
                            <span className="rounded bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-900 px-1.5 py-0.2 text-[9px] font-bold tracking-tight">
                              Overdue
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Action */}
                      <td className="px-5 py-4 align-middle text-right whitespace-nowrap">
                        <Link
                          href={`/admin/purchasing/${po.id}`}
                          className="inline-flex items-center px-3 py-1.5 bg-zinc-950 hover:bg-zinc-800 text-white dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 text-[11px] font-bold rounded-lg transition-colors cursor-pointer"
                        >
                          상세 보기 →
                        </Link>
                      </td>
                    </tr>
                  );
                })}

                {filteredPos.length === 0 && (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-zinc-400 dark:text-zinc-500">
                      일치하는 발주서가 존재하지 않습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 2: 제품별 보기 (Product-Level Table) */}
      {viewMode === "product" && (
        <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50/60 text-zinc-600 font-bold dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300">
                  <th className="px-4 py-3.5 whitespace-nowrap">이미지</th>
                  <th className="px-4 py-3.5 whitespace-nowrap">Letusto SKU</th>
                  <th className="px-4 py-3.5 whitespace-nowrap">제조사 SKU</th>
                  <th className="px-4 py-3.5 whitespace-nowrap min-w-[180px]">Product Name</th>
                  <th className="px-4 py-3.5 whitespace-nowrap">Supplier</th>
                  <th className="px-4 py-3.5 whitespace-nowrap">PO Number</th>
                  <th className="px-4 py-3.5 whitespace-nowrap">Order Date</th>
                  <th className="px-4 py-3.5 whitespace-nowrap text-right">Ordered</th>
                  <th className="px-4 py-3.5 whitespace-nowrap text-right">Shipped</th>
                  <th className="px-4 py-3.5 whitespace-nowrap text-right">Received</th>
                  <th className="px-4 py-3.5 whitespace-nowrap text-right">Remaining</th>
                  <th className="px-4 py-3.5 whitespace-nowrap">PO Status</th>
                  <th className="px-4 py-3.5 whitespace-nowrap">Order Status</th>
                  <th className="px-4 py-3.5 whitespace-nowrap">ETA</th>
                  <th className="px-4 py-3.5 whitespace-nowrap text-right">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-150 dark:divide-zinc-800/80">
                {filteredProductLines.map((line) => {
                  const isOverdue =
                    line.eta &&
                    line.eta < today &&
                    line.fulfillment_status !== "RECEIVED" &&
                    line.po_status !== "CANCELLED";

                  const isPartialShipped = line.shipped_qty > 0 && line.shipped_qty < line.qty;
                  const isPartialReceived = line.received_qty > 0 && line.received_qty < line.qty;

                  return (
                    <tr
                      key={`${line.po_id}-${line.id}`}
                      className="hover:bg-zinc-50/40 dark:hover:bg-zinc-850/20 transition-colors"
                    >
                      {/* Image Thumbnail */}
                      <td className="px-4 py-3.5 align-middle whitespace-nowrap">
                        <div className="w-10 h-10 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center overflow-hidden shrink-0 relative">
                          {line.image_url ? (
                            <Image
                              src={line.image_url}
                              alt={line.product_name}
                              fill
                              className="object-cover"
                              sizes="40px"
                            />
                          ) : (
                            <span className="text-zinc-300 dark:text-zinc-700 text-[10px]">No Img</span>
                          )}
                        </div>
                      </td>

                      {/* Letusto SKU */}
                      <td className="px-4 py-3.5 align-middle font-mono font-bold text-zinc-900 dark:text-zinc-100 whitespace-nowrap">
                        {line.letusto_sku || "-"}
                      </td>

                      {/* Manufacturer SKU */}
                      <td className="px-4 py-3.5 align-middle font-mono text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                        {line.manufacture_sku || "-"}
                      </td>

                      {/* Product Name */}
                      <td className="px-4 py-3.5 align-middle max-w-[240px]">
                        <Link
                          href={`/admin/purchasing/${line.po_id}`}
                          className="font-bold text-zinc-950 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 hover:underline transition-colors block line-clamp-2"
                        >
                          {line.product_name}
                        </Link>
                        <span className="text-[10px] text-zinc-400">{line.brand_name}</span>
                      </td>

                      {/* Supplier */}
                      <td className="px-4 py-3.5 align-middle font-semibold text-zinc-800 dark:text-zinc-200 max-w-[120px] truncate">
                        {line.supplier_name}
                      </td>

                      {/* PO Number */}
                      <td className="px-4 py-3.5 align-middle font-mono font-bold text-zinc-950 dark:text-white whitespace-nowrap">
                        <Link
                          href={`/admin/purchasing/${line.po_id}`}
                          className="hover:underline hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        >
                          {line.po_number}
                        </Link>
                      </td>

                      {/* Order Date */}
                      <td className="px-4 py-3.5 align-middle text-zinc-600 dark:text-zinc-400 font-medium whitespace-nowrap">
                        {line.order_date}
                      </td>

                      {/* Ordered Qty */}
                      <td className="px-4 py-3.5 align-middle text-right font-mono font-bold text-zinc-950 dark:text-white whitespace-nowrap">
                        {line.qty.toLocaleString()}
                      </td>

                      {/* Shipped Qty */}
                      <td className="px-4 py-3.5 align-middle text-right font-mono font-semibold whitespace-nowrap">
                        <div className="flex flex-col items-end">
                          <span className={line.shipped_qty > 0 ? "text-teal-600 dark:text-teal-400 font-bold" : "text-zinc-400"}>
                            {line.shipped_qty.toLocaleString()}
                          </span>
                          {isPartialShipped && (
                            <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400">
                              Partial ({line.shipped_qty}/{line.qty})
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Received Qty */}
                      <td className="px-4 py-3.5 align-middle text-right font-mono font-semibold whitespace-nowrap">
                        <div className="flex flex-col items-end">
                          <span className={line.received_qty > 0 ? "text-emerald-600 dark:text-emerald-400 font-bold" : "text-zinc-400"}>
                            {line.received_qty.toLocaleString()}
                          </span>
                          {isPartialReceived && (
                            <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400">
                              Partial ({line.received_qty}/{line.qty})
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Remaining Qty */}
                      <td className="px-4 py-3.5 align-middle text-right font-mono font-bold whitespace-nowrap">
                        <span className={line.remaining_qty > 0 ? "text-rose-600 dark:text-rose-400" : "text-zinc-400"}>
                          {line.remaining_qty.toLocaleString()}
                        </span>
                      </td>

                      {/* PO Status */}
                      <td className="px-4 py-3.5 align-middle whitespace-nowrap">
                        <span
                          className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold border ${
                            PO_STATUS_BADGE[line.po_status] || "bg-zinc-100 text-zinc-700"
                          }`}
                        >
                          {line.po_status}
                        </span>
                      </td>

                      {/* Order Status */}
                      <td className="px-4 py-3.5 align-middle whitespace-nowrap">
                        <span
                          className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold border ${
                            ORDER_STATUS_BADGE[line.fulfillment_status] || "bg-zinc-100 text-zinc-700"
                          }`}
                        >
                          {line.fulfillment_status}
                        </span>
                      </td>

                      {/* ETA */}
                      <td className="px-4 py-3.5 align-middle whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="text-zinc-600 dark:text-zinc-300 font-medium">
                            {line.eta || "-"}
                          </span>
                          {isOverdue && (
                            <span className="rounded bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-900 px-1 py-0.2 text-[9px] font-bold tracking-tight">
                              Overdue
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Action */}
                      <td className="px-4 py-3.5 align-middle text-right whitespace-nowrap">
                        <Link
                          href={`/admin/purchasing/${line.po_id}`}
                          className="inline-flex items-center px-2.5 py-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-200 text-[10px] font-bold rounded-lg transition-colors cursor-pointer"
                        >
                          상세 보기
                        </Link>
                      </td>
                    </tr>
                  );
                })}

                {filteredProductLines.length === 0 && (
                  <tr>
                    <td colSpan={15} className="py-12 text-center text-zinc-400 dark:text-zinc-500">
                      일치하는 제품 라인이 존재하지 않습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
