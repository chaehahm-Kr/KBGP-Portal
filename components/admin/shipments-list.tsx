"use client";

import React, { useState } from "react";
import Link from "next/link";

interface ShipmentItem {
  id: string;
  shipment_number: string;
  status: "DRAFT" | "BOOKED" | "IN_TRANSIT" | "ARRIVED" | "PARTIALLY_RECEIVED" | "RECEIVED" | "CANCELLED";
  shipping_method: string;
  etd: string | null;
  eta: string | null;
  last_updated: string;
  po_number: string;
  supplier_name: string;
  warehouse_name: string;
  warehouse_code: string;
  total_shipped: number;
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

interface ShipmentsListProps {
  initialShipments: ShipmentItem[];
  warehouses: WarehouseOption[];
  suppliers: SupplierOption[];
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-zinc-100 text-zinc-650 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700",
  BOOKED: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/50",
  IN_TRANSIT: "bg-amber-50 text-amber-700 border-amber-250 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/50",
  ARRIVED: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/20 dark:text-indigo-400 dark:border-indigo-900/50",
  PARTIALLY_RECEIVED: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/20 dark:text-teal-400 dark:border-teal-900/50",
  RECEIVED: "bg-emerald-50 text-emerald-700 border-emerald-250 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/50",
  CANCELLED: "bg-rose-50 text-rose-700 border-rose-250 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/50",
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "초안 (Draft)",
  BOOKED: "예약 완료 (Booked)",
  IN_TRANSIT: "선적중 (In Transit)",
  ARRIVED: "창고도착 (Arrived)",
  PARTIALLY_RECEIVED: "일부 입고 (Partially Received)",
  RECEIVED: "입고 완료 (Received)",
  CANCELLED: "취소됨 (Cancelled)",
};

const METHOD_LABELS: Record<string, string> = {
  Ocean: "해상 (Ocean)",
  Air: "항공 (Air)",
  Ground: "육상 (Ground)",
  Courier: "택배 (Courier)",
  Other: "기타 (Other)",
};

export function ShipmentsList({
  initialShipments,
  warehouses,
  suppliers,
}: ShipmentsListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSupplierId, setSelectedSupplierId] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("all");
  const [selectedMethod, setSelectedMethod] = useState("all");

  const filteredShipments = initialShipments.filter((shp) => {
    const s = searchTerm.toLowerCase();
    const matchesSearch =
      !s ||
      shp.shipment_number.toLowerCase().includes(s) ||
      shp.po_number.toLowerCase().includes(s) ||
      shp.supplier_name.toLowerCase().includes(s);

    const supplierOption = suppliers.find((sub) => sub.id === selectedSupplierId);
    const matchesSupplier =
      selectedSupplierId === "all" || shp.supplier_name === supplierOption?.name;

    const matchesStatus = selectedStatus === "all" || shp.status === selectedStatus;
    
    const matchesWarehouse =
      selectedWarehouseId === "all" ||
      warehouses.find((w) => w.id === selectedWarehouseId)?.code === shp.warehouse_code;

    const matchesMethod = selectedMethod === "all" || shp.shipping_method === selectedMethod;

    return matchesSearch && matchesSupplier && matchesStatus && matchesWarehouse && matchesMethod;
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
              placeholder="선적 번호, PO 번호, 공급사..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2 text-xs outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white dark:focus:border-zinc-700"
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
            <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase">선적 상태</span>
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
              <option value="all">전체 입고창고</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  [{w.code}] {w.name}
                </option>
              ))}
            </select>
          </div>

          {/* Shipping Method */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase">운송 수단</span>
            <select
              value={selectedMethod}
              onChange={(e) => setSelectedMethod(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-955 dark:text-white"
            >
              <option value="all">전체 수단</option>
              {Object.entries(METHOD_LABELS).map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Info panel */}
        <div className="flex justify-between items-center text-[10px] text-zinc-450 dark:text-zinc-500 pt-1">
          <span>검색 선적: <strong className="text-zinc-900 dark:text-zinc-250 font-bold">{filteredShipments.length}</strong> 건</span>
          {(searchTerm || selectedSupplierId !== "all" || selectedStatus !== "all" || selectedWarehouseId !== "all" || selectedMethod !== "all") && (
            <button
              onClick={() => {
                setSearchTerm("");
                setSelectedSupplierId("all");
                setSelectedStatus("all");
                setSelectedWarehouseId("all");
                setSelectedMethod("all");
              }}
              className="text-zinc-900 hover:underline dark:text-zinc-250 font-semibold cursor-pointer"
            >
              필터 초기화
            </button>
          )}
        </div>
      </div>

      {/* Shipments Table */}
      <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50/50 text-zinc-550 font-bold dark:border-zinc-850 dark:bg-zinc-900/50 dark:text-white">
                <th className="px-6 py-3.5 whitespace-nowrap">선적 번호</th>
                <th className="px-6 py-3.5 whitespace-nowrap">발주 번호</th>
                <th className="px-6 py-3.5 whitespace-nowrap">공급사 (Supplier)</th>
                <th className="px-6 py-3.5 whitespace-nowrap">선적 상태</th>
                <th className="px-6 py-3.5 whitespace-nowrap">운송 수단</th>
                <th className="px-6 py-3.5 whitespace-nowrap">출발예정 (ETD)</th>
                <th className="px-6 py-3.5 whitespace-nowrap">도착예정 (ETA)</th>
                <th className="px-6 py-3.5 whitespace-nowrap">도착 목적지</th>
                <th className="px-6 py-3.5 whitespace-nowrap text-right">총 선적 수량</th>
                <th className="px-6 py-3.5 whitespace-nowrap text-right">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-150 dark:divide-zinc-800/80">
              {filteredShipments.map((shp) => (
                <tr
                  key={shp.id}
                  className="hover:bg-zinc-50/30 dark:hover:bg-zinc-850/10 transition-colors"
                >
                  {/* Shipment Number */}
                  <td className="px-6 py-4 align-middle font-mono font-bold text-zinc-955 dark:text-white whitespace-nowrap">
                    <Link
                      href={`/admin/purchasing/shipments/${shp.id}`}
                      className="hover:underline hover:text-zinc-950 dark:hover:text-white transition-colors"
                    >
                      {shp.shipment_number}
                    </Link>
                  </td>

                  {/* Related PO */}
                  <td className="px-6 py-4 align-middle font-mono font-semibold text-zinc-650 dark:text-zinc-400 whitespace-nowrap">
                    <Link
                      href={`/admin/purchasing?search=${encodeURIComponent(shp.po_number)}`}
                      className="hover:underline hover:text-zinc-950 dark:hover:text-white transition-colors"
                    >
                      {shp.po_number}
                    </Link>
                  </td>

                  {/* Supplier */}
                  <td className="px-6 py-4 align-middle font-bold text-zinc-900 dark:text-white max-w-[150px] truncate">
                    {shp.supplier_name}
                  </td>

                  {/* Status */}
                  <td className="px-6 py-4 align-middle whitespace-nowrap">
                    <span className={`inline-flex items-center rounded px-2.5 py-0.5 text-[10px] font-bold border ${STATUS_COLORS[shp.status] || STATUS_COLORS.DRAFT}`}>
                      {STATUS_LABELS[shp.status] || shp.status}
                    </span>
                  </td>

                  {/* Shipping Method */}
                  <td className="px-6 py-4 align-middle font-medium text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
                    {METHOD_LABELS[shp.shipping_method] || shp.shipping_method}
                  </td>

                  {/* ETD */}
                  <td className="px-6 py-4 align-middle text-zinc-650 dark:text-zinc-350 font-mono font-medium whitespace-nowrap">
                    {shp.etd || <span className="text-zinc-350 italic font-sans font-normal">-</span>}
                  </td>

                  {/* ETA */}
                  <td className="px-6 py-4 align-middle text-zinc-650 dark:text-zinc-350 font-mono font-medium whitespace-nowrap">
                    {shp.eta || <span className="text-zinc-350 italic font-sans font-normal">-</span>}
                  </td>

                  {/* Destination */}
                  <td className="px-6 py-4 align-middle font-semibold text-zinc-800 dark:text-zinc-300 whitespace-nowrap">
                    <span className="font-mono text-zinc-550">[{shp.warehouse_code}]</span> {shp.warehouse_name}
                  </td>

                  {/* Total Shipped */}
                  <td className="px-6 py-4 align-middle text-right font-mono font-bold text-zinc-900 dark:text-white whitespace-nowrap">
                    {shp.total_shipped.toLocaleString()}
                  </td>

                  {/* Action */}
                  <td className="px-6 py-4 align-middle text-right whitespace-nowrap">
                    <Link
                      href={`/admin/purchasing/shipments/${shp.id}`}
                      className="inline-flex items-center px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-[10px] font-bold rounded-lg transition-colors cursor-pointer"
                    >
                      상세 보기
                    </Link>
                  </td>
                </tr>
              ))}
              {filteredShipments.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-zinc-400 dark:text-zinc-500">
                    선적 서류가 존재하지 않습니다.
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
