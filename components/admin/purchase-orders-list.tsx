"use client";

import React, { useState } from "react";
import Link from "next/link";

interface PurchaseOrderItem {
  id: string;
  po_number: string;
  order_date: string;
  status: "DRAFT" | "APPROVED" | "SENT" | "IN_PRODUCTION" | "READY_TO_SHIP" | "CANCELLED";
  currency: string;
  expected_ready_date: string | null;
  last_updated: string;
  supplier_name: string;
  warehouse_name: string;
  warehouse_code: string;
  total_qty: number;
  total_amount: number;
}

interface WarehouseOption {
  id: string;
  name: string;
  code: string;
}

interface SupplierOption {
  id: string;
  name: string;
}

interface PurchaseOrdersListProps {
  initialPos: PurchaseOrderItem[];
  warehouses: WarehouseOption[];
  suppliers: SupplierOption[];
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-zinc-100 text-zinc-650 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700",
  APPROVED: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/50",
  SENT: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/20 dark:text-indigo-400 dark:border-indigo-900/50",
  IN_PRODUCTION: "bg-amber-50 text-amber-700 border-amber-250 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/50",
  READY_TO_SHIP: "bg-emerald-50 text-emerald-700 border-emerald-250 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/50",
  CANCELLED: "bg-rose-50 text-rose-700 border-rose-250 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/50",
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "초안 (Draft)",
  APPROVED: "승인됨 (Approved)",
  SENT: "발송완료 (Sent)",
  IN_PRODUCTION: "생산중 (In Production)",
  READY_TO_SHIP: "선적대기 (Ready to Ship)",
  CANCELLED: "취소됨 (Cancelled)",
};

export function PurchaseOrdersList({
  initialPos,
  warehouses,
  suppliers,
}: PurchaseOrdersListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSupplierId, setSelectedSupplierId] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("all");

  // Filtering Logic
  const filteredPos = initialPos.filter((po) => {
    const s = searchTerm.toLowerCase();
    const matchesSearch =
      !s ||
      po.po_number.toLowerCase().includes(s) ||
      po.supplier_name.toLowerCase().includes(s);

    // Supplier filter
    const supplierOption = suppliers.find((sub) => sub.id === selectedSupplierId);
    const matchesSupplier =
      selectedSupplierId === "all" || po.supplier_name === supplierOption?.name;

    const matchesStatus = selectedStatus === "all" || po.status === selectedStatus;
    const matchesWarehouse =
      selectedWarehouseId === "all" ||
      warehouses.find((w) => w.id === selectedWarehouseId)?.code === po.warehouse_code;

    return matchesSearch && matchesSupplier && matchesStatus && matchesWarehouse;
  });

  return (
    <div className="space-y-4">
      {/* Search and Filters panel */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {/* Search Input */}
          <div className="flex flex-col gap-1.5 col-span-1 sm:col-span-2 md:col-span-1">
            <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase">검색어</span>
            <input
              type="text"
              placeholder="발주 번호, 공급사명..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2 text-xs outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white dark:focus:border-zinc-700"
            />
          </div>

          {/* Supplier filter */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase">공급사 (Supplier)</span>
            <select
              value={selectedSupplierId}
              onChange={(e) => setSelectedSupplierId(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
            >
              <option value="all">전체 공급사</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status filter */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase">진행 상태</span>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
            >
              <option value="all">전체 상태</option>
              {Object.entries(STATUS_LABELS).map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Warehouse filter */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase">입고 목적 창고</span>
            <select
              value={selectedWarehouseId}
              onChange={(e) => setSelectedWarehouseId(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
            >
              <option value="all">전체 물류창고</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  [{w.code}] {w.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Results Info & Reset */}
        <div className="flex justify-between items-center text-[10px] text-zinc-450 dark:text-zinc-500 pt-1">
          <span>검색 결과: <strong className="text-zinc-900 dark:text-zinc-200 font-bold">{filteredPos.length}</strong> 건</span>
          {(searchTerm || selectedSupplierId !== "all" || selectedStatus !== "all" || selectedWarehouseId !== "all") && (
            <button
              onClick={() => {
                setSearchTerm("");
                setSelectedSupplierId("all");
                setSelectedStatus("all");
                setSelectedWarehouseId("all");
              }}
              className="text-zinc-900 hover:underline dark:text-zinc-250 font-semibold cursor-pointer"
            >
              필터 초기화
            </button>
          )}
        </div>
      </div>

      {/* Orders Table */}
      <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50/50 text-zinc-550 font-bold dark:border-zinc-850 dark:bg-zinc-900/50 dark:text-white">
                <th className="px-6 py-3.5 whitespace-nowrap">발주 번호</th>
                <th className="px-6 py-3.5 whitespace-nowrap">공급사 (Supplier)</th>
                <th className="px-6 py-3.5 whitespace-nowrap">발주 일자</th>
                <th className="px-6 py-3.5 whitespace-nowrap">진행 상태</th>
                <th className="px-6 py-3.5 whitespace-nowrap">입고 목적지</th>
                <th className="px-6 py-3.5 whitespace-nowrap text-right">총 발주 수량</th>
                <th className="px-6 py-3.5 whitespace-nowrap text-right">총 발주 금액</th>
                <th className="px-6 py-3.5 whitespace-nowrap">출하예정일 (Ready)</th>
                <th className="px-6 py-3.5 whitespace-nowrap">최종 변경</th>
                <th className="px-6 py-3.5 whitespace-nowrap text-right">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-150 dark:divide-zinc-800/80">
              {filteredPos.map((po) => (
                <tr
                  key={po.id}
                  className="hover:bg-zinc-50/30 dark:hover:bg-zinc-850/10 transition-colors"
                >
                  {/* PO Number */}
                  <td className="px-6 py-4 align-middle font-mono font-bold text-zinc-955 dark:text-white whitespace-nowrap">
                    <Link
                      href={`/admin/purchasing/${po.id}`}
                      className="hover:underline hover:text-zinc-950 dark:hover:text-white transition-colors"
                    >
                      {po.po_number}
                    </Link>
                  </td>

                  {/* Supplier */}
                  <td className="px-6 py-4 align-middle font-bold text-zinc-900 dark:text-white max-w-[150px] truncate">
                    {po.supplier_name}
                  </td>

                  {/* Order Date */}
                  <td className="px-6 py-4 align-middle text-zinc-650 dark:text-zinc-350 font-medium whitespace-nowrap">
                    {po.order_date}
                  </td>

                  {/* Status */}
                  <td className="px-6 py-4 align-middle whitespace-nowrap">
                    <span className={`inline-flex items-center rounded px-2.5 py-0.5 text-[10px] font-bold border ${STATUS_COLORS[po.status] || STATUS_COLORS.DRAFT}`}>
                      {STATUS_LABELS[po.status] || po.status}
                    </span>
                  </td>

                  {/* Destination Warehouse */}
                  <td className="px-6 py-4 align-middle font-semibold text-zinc-800 dark:text-zinc-300 whitespace-nowrap">
                    <span className="font-mono text-zinc-550">[{po.warehouse_code}]</span> {po.warehouse_name}
                  </td>

                  {/* Total Qty */}
                  <td className="px-6 py-4 align-middle text-right font-mono font-bold text-zinc-900 dark:text-white whitespace-nowrap">
                    {po.total_qty.toLocaleString()}
                  </td>

                  {/* Total Amount */}
                  <td className="px-6 py-4 align-middle text-right font-mono font-bold text-zinc-900 dark:text-white whitespace-nowrap">
                    {po.currency} {po.total_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>

                  {/* Expected Ready Date */}
                  <td className="px-6 py-4 align-middle text-zinc-650 dark:text-zinc-350 font-medium whitespace-nowrap">
                    {po.expected_ready_date || <span className="text-zinc-350 dark:text-zinc-600 italic font-sans font-normal">-</span>}
                  </td>

                  {/* Last Updated */}
                  <td className="px-6 py-4 align-middle font-mono text-[10px] text-zinc-450 dark:text-zinc-500 whitespace-nowrap">
                    {new Date(po.last_updated).toLocaleString("ko-KR")}
                  </td>

                  {/* Action */}
                  <td className="px-6 py-4 align-middle text-right whitespace-nowrap">
                    <Link
                      href={`/admin/purchasing/${po.id}`}
                      className="inline-flex items-center px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-[10px] font-bold rounded-lg transition-colors cursor-pointer"
                    >
                      상세 보기
                    </Link>
                  </td>
                </tr>
              ))}
              {filteredPos.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-zinc-400 dark:text-zinc-500">
                    발주 서류가 존재하지 않습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
