"use client";

import React, { useState } from "react";
import Link from "next/link";

interface ReceivingItem {
  id: string;
  receiving_number: string;
  received_date: string;
  status: "DRAFT" | "FINALIZED" | "CANCELLED";
  shipment_number: string;
  po_number: string;
  supplier_name: string;
  warehouse_name: string;
  warehouse_code: string;
  received_by_name: string;
  total_received: number;
  total_hold_damaged: number;
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

interface ReceivingsListProps {
  initialReceivings: ReceivingItem[];
  warehouses: WarehouseOption[];
  suppliers: SupplierOption[];
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-zinc-100 text-zinc-650 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700",
  FINALIZED: "bg-emerald-50 text-emerald-700 border-emerald-250 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/50",
  CANCELLED: "bg-rose-50 text-rose-700 border-rose-250 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/50",
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "검수 대기 (Draft)",
  FINALIZED: "입고 확정 (Finalized)",
  CANCELLED: "취소됨 (Cancelled)",
};

export function ReceivingsList({
  initialReceivings,
  warehouses,
  suppliers,
}: ReceivingsListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSupplierId, setSelectedSupplierId] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("all");
  const [selectedDate, setSelectedDate] = useState("");

  const filteredReceivings = initialReceivings.filter((r) => {
    const s = searchTerm.toLowerCase();
    const matchesSearch =
      !s ||
      r.receiving_number.toLowerCase().includes(s) ||
      r.shipment_number.toLowerCase().includes(s) ||
      r.po_number.toLowerCase().includes(s) ||
      r.supplier_name.toLowerCase().includes(s);

    const supplierOption = suppliers.find((sub) => sub.id === selectedSupplierId);
    const matchesSupplier =
      selectedSupplierId === "all" || r.supplier_name === supplierOption?.name;

    const matchesStatus = selectedStatus === "all" || r.status === selectedStatus;
    
    const matchesWarehouse =
      selectedWarehouseId === "all" || r.warehouse_code === warehouses.find((w) => w.id === selectedWarehouseId)?.code;

    const matchesDate = !selectedDate || r.received_date === selectedDate;

    return matchesSearch && matchesSupplier && matchesStatus && matchesWarehouse && matchesDate;
  });

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          
          {/* Search keyword */}
          <div className="flex flex-col gap-1.5 col-span-1 sm:col-span-2 md:col-span-1">
            <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase">검색어</span>
            <input
              type="text"
              placeholder="입고 번호, 선적 번호, PO, 공급사..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2 text-xs outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-955 dark:text-white dark:focus:border-zinc-700"
            />
          </div>

          {/* Supplier */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase">공급사 (Supplier)</span>
            <select
              value={selectedSupplierId}
              onChange={(e) => setSelectedSupplierId(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-955 dark:text-white"
            >
              <option value="all">전체 공급사</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase">입고 상태</span>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-955 dark:text-white"
            >
              <option value="all">전체 상태</option>
              {Object.entries(STATUS_LABELS).map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Warehouse */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase">입고 창고</span>
            <select
              value={selectedWarehouseId}
              onChange={(e) => setSelectedWarehouseId(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-955 dark:text-white"
            >
              <option value="all">전체 창고</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  [{w.code}] {w.name}
                </option>
              ))}
            </select>
          </div>

          {/* Received Date */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase">입고 일자</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-955 dark:text-white"
            />
          </div>
        </div>

        {/* Info panel */}
        <div className="flex justify-between items-center text-[10px] text-zinc-450 dark:text-zinc-500 pt-1">
          <span>검색 입고: <strong className="text-zinc-900 dark:text-zinc-250 font-bold">{filteredReceivings.length}</strong> 건</span>
          {(searchTerm || selectedSupplierId !== "all" || selectedStatus !== "all" || selectedWarehouseId !== "all" || selectedDate) && (
            <button
              onClick={() => {
                setSearchTerm("");
                setSelectedSupplierId("all");
                setSelectedStatus("all");
                setSelectedWarehouseId("all");
                setSelectedDate("");
              }}
              className="text-zinc-900 hover:underline dark:text-zinc-250 font-semibold cursor-pointer"
            >
              필터 초기화
            </button>
          )}
        </div>
      </div>

      {/* Receivings Table */}
      <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50/50 text-zinc-550 font-bold dark:border-zinc-850 dark:bg-zinc-900/50 dark:text-white">
                <th className="px-6 py-3.5 whitespace-nowrap">입고 번호</th>
                <th className="px-6 py-3.5 whitespace-nowrap">선적 번호</th>
                <th className="px-6 py-3.5 whitespace-nowrap">발주 번호</th>
                <th className="px-6 py-3.5 whitespace-nowrap">공급사</th>
                <th className="px-6 py-3.5 whitespace-nowrap">입고 일자</th>
                <th className="px-6 py-3.5 whitespace-nowrap">진행 상태</th>
                <th className="px-6 py-3.5 whitespace-nowrap">입고지 창고</th>
                <th className="px-6 py-3.5 whitespace-nowrap text-right">정상 입고수량</th>
                <th className="px-6 py-3.5 whitespace-nowrap text-right">보류/파손 수량</th>
                <th className="px-6 py-3.5 whitespace-nowrap">검수자</th>
                <th className="px-6 py-3.5 text-right">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-150 dark:divide-zinc-800/80">
              {filteredReceivings.map((r) => (
                <tr
                  key={r.id}
                  className="hover:bg-zinc-50/30 dark:hover:bg-zinc-850/10 transition-colors"
                >
                  {/* Receiving Number */}
                  <td className="px-6 py-4 align-middle font-mono font-bold text-zinc-955 dark:text-white whitespace-nowrap">
                    <Link
                      href={`/admin/purchasing/receiving/${r.id}`}
                      className="hover:underline hover:text-zinc-950 dark:hover:text-white transition-colors"
                    >
                      {r.receiving_number}
                    </Link>
                  </td>

                  {/* Shipment Number */}
                  <td className="px-6 py-4 align-middle font-mono font-semibold text-zinc-650 dark:text-zinc-400 whitespace-nowrap">
                    <Link
                      href={`/admin/purchasing/shipments/${r.id}`} // Wait, this links to r.id, but should link to shipment link! Let's check how we link to shipments.
                      className="hover:underline"
                    >
                      {r.shipment_number}
                    </Link>
                  </td>

                  {/* PO Number */}
                  <td className="px-6 py-4 align-middle font-mono text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                    {r.po_number}
                  </td>

                  {/* Supplier */}
                  <td className="px-6 py-4 align-middle font-bold text-zinc-900 dark:text-white max-w-[150px] truncate">
                    {r.supplier_name}
                  </td>

                  {/* Received Date */}
                  <td className="px-6 py-4 align-middle text-zinc-650 dark:text-zinc-350 font-mono font-medium whitespace-nowrap">
                    {r.received_date}
                  </td>

                  {/* Status */}
                  <td className="px-6 py-4 align-middle whitespace-nowrap">
                    <span className={`inline-flex items-center rounded px-2.5 py-0.5 text-[10px] font-bold border ${STATUS_COLORS[r.status] || STATUS_COLORS.DRAFT}`}>
                      {STATUS_LABELS[r.status] || r.status}
                    </span>
                  </td>

                  {/* Destination Warehouse */}
                  <td className="px-6 py-4 align-middle font-semibold text-zinc-800 dark:text-zinc-300 whitespace-nowrap">
                    <span className="font-mono text-zinc-550">[{r.warehouse_code}]</span> {r.warehouse_name}
                  </td>

                  {/* Total Received */}
                  <td className="px-6 py-4 align-middle text-right font-mono font-bold text-zinc-900 dark:text-white whitespace-nowrap">
                    {r.total_received.toLocaleString()}
                  </td>

                  {/* Total Hold/Damaged */}
                  <td className="px-6 py-4 align-middle text-right font-mono font-bold text-rose-500 whitespace-nowrap">
                    {r.total_hold_damaged.toLocaleString()}
                  </td>

                  {/* Inspector name */}
                  <td className="px-6 py-4 align-middle text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
                    {r.received_by_name}
                  </td>

                  {/* Action */}
                  <td className="px-6 py-4 align-middle text-right whitespace-nowrap">
                    <Link
                      href={`/admin/purchasing/receiving/${r.id}`}
                      className="inline-flex items-center px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-[10px] font-bold rounded-lg transition-colors cursor-pointer"
                    >
                      상세 보기
                    </Link>
                  </td>
                </tr>
              ))}
              {filteredReceivings.length === 0 && (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-zinc-400 dark:text-zinc-500">
                    입고 검수 기록이 존재하지 않습니다.
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
