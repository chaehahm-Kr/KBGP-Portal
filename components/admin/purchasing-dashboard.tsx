"use client";

import React, { useState, useTransition, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  PurchasingDashboardData,
  DashboardFilterInput,
  getPurchasingDashboardData,
} from "@/lib/purchasing-dashboard/actions";

interface PurchasingDashboardProps {
  initialData: PurchasingDashboardData;
}

export function PurchasingDashboard({ initialData }: PurchasingDashboardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [data, setData] = useState<PurchasingDashboardData>(initialData);

  // Filter state
  const [dateRangePreset, setDateRangePreset] = useState<'this_month' | 'last_month' | 'this_quarter' | 'this_year' | 'custom'>('this_month');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [supplierId, setSupplierId] = useState<string>('ALL');
  const [poStatus, setPoStatus] = useState<string>('ALL');
  const [orderStatus, setOrderStatus] = useState<string>('ALL');
  const [destinationWarehouseId, setDestinationWarehouseId] = useState<string>('ALL');
  const [productSearch, setProductSearch] = useState<string>('');

  // Handle filter application
  const applyFilters = (newOverrides: Partial<DashboardFilterInput> = {}) => {
    const filterInput: DashboardFilterInput = {
      dateRangePreset: newOverrides.dateRangePreset !== undefined ? newOverrides.dateRangePreset : dateRangePreset,
      startDate: newOverrides.startDate !== undefined ? newOverrides.startDate : startDate,
      endDate: newOverrides.endDate !== undefined ? newOverrides.endDate : endDate,
      supplierId: newOverrides.supplierId !== undefined ? newOverrides.supplierId : supplierId,
      poStatus: newOverrides.poStatus !== undefined ? newOverrides.poStatus : poStatus,
      orderStatus: newOverrides.orderStatus !== undefined ? newOverrides.orderStatus : orderStatus,
      destinationWarehouseId: newOverrides.destinationWarehouseId !== undefined ? newOverrides.destinationWarehouseId : destinationWarehouseId,
    };

    startTransition(async () => {
      try {
        const freshData = await getPurchasingDashboardData(filterInput);
        setData(freshData);
      } catch (err: any) {
        console.error("Failed to load dashboard data:", err);
      }
    });
  };

  const handleResetFilters = () => {
    setDateRangePreset('this_month');
    setStartDate('');
    setEndDate('');
    setSupplierId('ALL');
    setPoStatus('ALL');
    setOrderStatus('ALL');
    setDestinationWarehouseId('ALL');
    setProductSearch('');
    applyFilters({
      dateRangePreset: 'this_month',
      startDate: '',
      endDate: '',
      supplierId: 'ALL',
      poStatus: 'ALL',
      orderStatus: 'ALL',
      destinationWarehouseId: 'ALL',
    });
  };

  // Filtered Product Summary (local product search)
  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return data.productSummary;
    const q = productSearch.toLowerCase();
    return data.productSummary.filter(
      (p) =>
        p.productName.toLowerCase().includes(q) ||
        p.letustoSku.toLowerCase().includes(q) ||
        p.manufactureSku.toLowerCase().includes(q) ||
        p.supplierName.toLowerCase().includes(q)
    );
  }, [data.productSummary, productSearch]);

  const { kpis, orderStatusSummary, supplierSummary, paymentSummary, attentionItems } = data;

  return (
    <div className="space-y-6 select-none">
      {/* Top Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-zinc-950 dark:text-white">
            Purchasing Order Dashboard
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            발주(PO), 선적, 실물 입고, Supplier Invoice 및 Payment 통합 실시간 현황
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/purchasing/orders"
            className="px-3.5 py-2 text-xs font-bold rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800/80 transition-all shadow-xs"
          >
            📋 발주서 목록 (PO List)
          </Link>
          <Link
            href="/admin/purchasing/new"
            className="px-4 py-2 text-xs font-bold rounded-xl bg-zinc-950 hover:bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 transition-all shadow-sm"
          >
            + 신규 발주 (New PO)
          </Link>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-4 rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-extrabold text-zinc-900 dark:text-white uppercase tracking-wider">
              🔍 Global Dashboard Filters
            </span>
            {isPending && (
              <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 animate-pulse">
                데이터 집계 중...
              </span>
            )}
          </div>
          <button
            onClick={handleResetFilters}
            className="text-xs font-bold text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white underline cursor-pointer"
          >
            필터 초기화
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Date Range Preset */}
          <div>
            <label className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 mb-1">
              기간 (Date Range)
            </label>
            <select
              value={dateRangePreset}
              onChange={(e) => {
                const val = e.target.value as any;
                setDateRangePreset(val);
                applyFilters({ dateRangePreset: val });
              }}
              className="w-full text-xs font-semibold rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white"
            >
              <option value="this_month">This Month (이번 달)</option>
              <option value="last_month">Last Month (지난 달)</option>
              <option value="this_quarter">This Quarter (이번 분기)</option>
              <option value="this_year">This Year (올해)</option>
              <option value="custom">Custom Date Range (직접 입력)</option>
            </select>
          </div>

          {/* Supplier Filter */}
          <div>
            <label className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 mb-1">
              공급사 (Supplier)
            </label>
            <select
              value={supplierId}
              onChange={(e) => {
                const val = e.target.value;
                setSupplierId(val);
                applyFilters({ supplierId: val });
              }}
              className="w-full text-xs font-semibold rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white"
            >
              <option value="ALL">전체 공급사 (All Suppliers)</option>
              {data.suppliersList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* PO Status Filter */}
          <div>
            <label className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 mb-1">
              PO Status (발주서 상태)
            </label>
            <select
              value={poStatus}
              onChange={(e) => {
                const val = e.target.value;
                setPoStatus(val);
                applyFilters({ poStatus: val });
              }}
              className="w-full text-xs font-semibold rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white"
            >
              <option value="ALL">전체 PO Status</option>
              <option value="DRAFT">Draft (초안)</option>
              <option value="APPROVED">Approved (승인됨)</option>
              <option value="SENT">Sent (공급사 전송됨)</option>
              <option value="COMPLETED">Completed (종결)</option>
              <option value="CANCELLED">Cancelled (취소)</option>
            </select>
          </div>

          {/* Order Status Filter */}
          <div>
            <label className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 mb-1">
              Order Status (진행 단계)
            </label>
            <select
              value={orderStatus}
              onChange={(e) => {
                const val = e.target.value;
                setOrderStatus(val);
                applyFilters({ orderStatus: val });
              }}
              className="w-full text-xs font-semibold rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white"
            >
              <option value="ALL">전체 Order Status</option>
              <option value="Pending">Pending (발주대기)</option>
              <option value="In Production">In Production (생산중)</option>
              <option value="Ready to Ship">Ready to Ship (선적대기)</option>
              <option value="Shipped">Shipped (출고/운송중)</option>
              <option value="Received">Received (입고완료)</option>
            </select>
          </div>

          {/* Destination Warehouse Filter */}
          <div>
            <label className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 mb-1">
              입고 창고 (Destination Warehouse)
            </label>
            <select
              value={destinationWarehouseId}
              onChange={(e) => {
                const val = e.target.value;
                setDestinationWarehouseId(val);
                applyFilters({ destinationWarehouseId: val });
              }}
              className="w-full text-xs font-semibold rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white"
            >
              <option value="ALL">전체 입고 창고</option>
              {data.warehousesList.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.code})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Custom Date Inputs if selected */}
        {dateRangePreset === 'custom' && (
          <div className="flex items-center gap-3 pt-2 border-t border-zinc-100 dark:border-zinc-800/60">
            <div>
              <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 mr-2">시작일:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  applyFilters({ startDate: e.target.value });
                }}
                className="text-xs border border-zinc-200 dark:border-zinc-800 rounded-lg px-2.5 py-1 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white"
              />
            </div>
            <div>
              <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 mr-2">종료일:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  applyFilters({ endDate: e.target.value });
                }}
                className="text-xs border border-zinc-200 dark:border-zinc-800 rounded-lg px-2.5 py-1 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white"
              />
            </div>
          </div>
        )}
      </div>

      {/* 1. TOP KPI SUMMARY CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {/* Total PO Count */}
        <Link
          href="/admin/purchasing/orders"
          className="p-4 rounded-2xl border border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700 transition-all shadow-xs block group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              총 PO 건수
            </span>
            <span className="text-xs font-bold text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-white transition-colors">
              →
            </span>
          </div>
          <div className="text-2xl font-black text-zinc-900 dark:text-white mt-2">
            {kpis.totalPoCount.toLocaleString()}{" "}
            <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">건</span>
          </div>
        </Link>

        {/* Total Ordered Qty */}
        <div className="p-4 rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 shadow-xs">
          <span className="text-xs font-extrabold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
            총 주문 수량
          </span>
          <div className="text-2xl font-black text-zinc-900 dark:text-white mt-2">
            {kpis.totalOrderedQty.toLocaleString()}{" "}
            <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">EA</span>
          </div>
        </div>

        {/* Total Order Amount */}
        <div className="p-4 rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 shadow-xs">
          <span className="text-xs font-extrabold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
            총 주문 금액
          </span>
          <div className="text-2xl font-black text-zinc-900 dark:text-white mt-2">
            ${kpis.totalOrderAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>

        {/* Open PO Amount */}
        <div className="p-4 rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 shadow-xs">
          <span className="text-xs font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
            Open PO 금액 (미종결)
          </span>
          <div className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-2">
            ${kpis.openPoAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>

        {/* Unreceived Qty & Amount */}
        <div className="p-4 rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 shadow-xs">
          <span className="text-xs font-extrabold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
            미입고 수량 / 금액
          </span>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-2">
            {kpis.unreceivedQty.toLocaleString()}{" "}
            <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">EA</span>
          </div>
          <div className="text-xs font-extrabold text-zinc-500 dark:text-zinc-400 mt-1">
            (${kpis.unreceivedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
          </div>
        </div>

        {/* Paid Amount */}
        <div className="p-4 rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 shadow-xs">
          <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
            지급 완료 금액
          </span>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-2">
            ${kpis.paidAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>

        {/* Outstanding Amount */}
        <div className="p-4 rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 shadow-xs">
          <span className="text-xs font-extrabold text-rose-600 dark:text-rose-400 uppercase tracking-wider">
            미지급 잔액 (Outstanding)
          </span>
          <div className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-2">
            ${kpis.outstandingAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>

        {/* Overdue PO Count */}
        <div className="p-4 rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 shadow-xs">
          <span className="text-xs font-extrabold text-rose-600 dark:text-rose-400 uppercase tracking-wider">
            지연 PO 수 (Overdue)
          </span>
          <div className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-2">
            {kpis.overduePoCount.toLocaleString()}{" "}
            <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">건</span>
          </div>
        </div>
      </div>

      {/* 2. ORDER STATUS SUMMARY */}
      <div className="p-5 rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-extrabold text-zinc-950 dark:text-white">
            📊 Order Status Summary (진행 단계별 집계)
          </h2>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            상태 카드를 클릭하면 해당 진행 단계 발주서 목록으로 이동합니다.
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {orderStatusSummary.map((st) => (
            <button
              key={st.key}
              onClick={() => router.push(`/admin/purchasing/orders?orderStatus=${st.key}`)}
              className="p-4 rounded-xl border border-zinc-200 bg-zinc-50/70 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900/60 dark:hover:bg-zinc-800/80 transition-all text-left group cursor-pointer"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className={`w-2.5 h-2.5 rounded-full ${st.colorClass}`} />
                <span className="text-xs font-extrabold text-zinc-900 dark:text-white truncate">
                  {st.label}
                </span>
              </div>
              <div className="text-lg font-black text-zinc-900 dark:text-white">
                {st.poCount.toLocaleString()} <span className="text-xs font-semibold text-zinc-500">건</span>
              </div>
              <div className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 font-semibold">
                수량: {st.orderedQty.toLocaleString()} EA
              </div>
              <div className="text-xs font-extrabold text-zinc-900 dark:text-zinc-200 mt-0.5">
                ${st.orderAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 3. ATTENTION REQUIRED SECTION */}
      <div className="p-5 rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
          <div>
            <h2 className="text-base font-extrabold text-zinc-950 dark:text-white flex items-center gap-2">
              🚨 Attention Required (운영자 즉시 확인 필요 건)
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              지연, 선적 대기, 부분 입고/출고 및 미지급 잔액이 존재하는 관심 필요 주문 목록
            </p>
          </div>
          <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
            총 {attentionItems.length}건
          </span>
        </div>

        {attentionItems.length === 0 ? (
          <div className="py-8 text-center text-xs font-semibold text-zinc-500 dark:text-zinc-400">
            ✅ 현재 확인이 필요한 지연 또는 부분 입고/출고 주의 항목이 없습니다.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {attentionItems.slice(0, 12).map((item, idx) => (
              <Link
                key={`${item.poId}-${item.type}-${idx}`}
                href={`/admin/purchasing/${item.poId}`}
                className="p-3.5 rounded-xl border border-zinc-200 bg-zinc-50/50 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900/40 dark:hover:bg-zinc-800/80 transition-all flex flex-col justify-between gap-2 shadow-2xs group"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className={`inline-flex px-2 py-0.5 text-[10px] font-black rounded-md border ${item.badgeColor}`}>
                      {item.typeLabel}
                    </span>
                    <span className="text-xs font-black text-zinc-900 dark:text-white group-hover:underline">
                      {item.poNumber}
                    </span>
                  </div>
                  <div className="text-xs font-bold text-zinc-800 dark:text-zinc-200 truncate">
                    {item.supplierName}
                  </div>
                  <div className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-1">
                    {item.detailMessage}
                  </div>
                </div>
                <div className="text-[10px] text-zinc-400 dark:text-zinc-500 text-right pt-2 border-t border-zinc-200/50 dark:border-zinc-800/50">
                  발주일: {item.orderDate}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* 4. SUPPLIER SUMMARY TABLE */}
      <div className="p-5 rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-extrabold text-zinc-950 dark:text-white">
              🏢 Supplier Summary (공급사별 주문 및 대금 현황)
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              공급사명을 클릭하면 해당 공급사로 필터링된 발주서 목록으로 이동합니다.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-zinc-200 bg-zinc-50 font-semibold text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-3">공급사 (Supplier)</th>
                <th className="px-3 py-3 text-center">PO 건수 (전체 / Open)</th>
                <th className="px-3 py-3 text-right">주문 수량 (EA)</th>
                <th className="px-3 py-3 text-right">주문 금액 ($)</th>
                <th className="px-3 py-3 text-right">출고 수량 (Shipped)</th>
                <th className="px-3 py-3 text-right">입고 수량 (Received)</th>
                <th className="px-3 py-3 text-right">지급 완료 ($)</th>
                <th className="px-3 py-3 text-right">미지급 잔액 ($)</th>
                <th className="px-4 py-3 text-center">최근 발주일</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-zinc-800 dark:text-zinc-200">
              {supplierSummary.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-zinc-500">
                    등록된 공급사 발주 데이터가 없습니다.
                  </td>
                </tr>
              ) : (
                supplierSummary.map((s) => (
                  <tr key={s.supplierId} className="hover:bg-zinc-50/70 dark:hover:bg-zinc-900/50">
                    <td className="px-4 py-3 font-bold text-zinc-900 dark:text-white">
                      <Link
                        href={`/admin/purchasing/orders?supplierId=${s.supplierId}`}
                        className="hover:underline text-zinc-950 dark:text-white"
                      >
                        {s.supplierName}
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-center font-semibold">
                      {s.poCount} <span className="text-zinc-400">/</span>{" "}
                      <span className="text-blue-600 dark:text-blue-400 font-extrabold">{s.openPoCount}</span>
                    </td>
                    <td className="px-3 py-3 text-right font-semibold">
                      {s.orderedQty.toLocaleString()}
                    </td>
                    <td className="px-3 py-3 text-right font-extrabold text-zinc-950 dark:text-white">
                      ${s.orderAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-3 text-right text-zinc-600 dark:text-zinc-400 font-semibold">
                      {s.shippedQty.toLocaleString()}
                    </td>
                    <td className="px-3 py-3 text-right text-emerald-600 dark:text-emerald-400 font-semibold">
                      {s.receivedQty.toLocaleString()}
                    </td>
                    <td className="px-3 py-3 text-right text-emerald-600 dark:text-emerald-400 font-semibold">
                      ${s.paidAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-3 text-right text-rose-600 dark:text-rose-400 font-extrabold">
                      ${s.outstandingAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-center text-zinc-500 dark:text-zinc-400 font-mono">
                      {s.lastOrderDate || "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. PRODUCT ORDER SUMMARY TABLE */}
      <div className="p-5 rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-extrabold text-zinc-950 dark:text-white">
              📦 Product Order Summary (제품별 주문 및 잔여 입고 현황)
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Letusto SKU 및 Manufacturer SKU 기준 제품별 집계 (지정되지 않은 Letusto SKU는 '지정 대기'로 표시)
            </p>
          </div>
          <input
            type="text"
            placeholder="제품명 / SKU / 공급사 검색..."
            value={productSearch}
            onChange={(e) => setProductSearch(e.target.value)}
            className="text-xs border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-1.5 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-white w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-zinc-200 bg-zinc-50 font-semibold text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400">
              <tr>
                <th className="px-3 py-3 text-center">이미지</th>
                <th className="px-4 py-3">Letusto SKU</th>
                <th className="px-4 py-3">Manufacturer SKU</th>
                <th className="px-4 py-3">제품명 (Product Name)</th>
                <th className="px-4 py-3">공급사</th>
                <th className="px-3 py-3 text-right">총 주문수량</th>
                <th className="px-3 py-3 text-right">출고 수량</th>
                <th className="px-3 py-3 text-right">입고 수량</th>
                <th className="px-3 py-3 text-right">미입고 잔여</th>
                <th className="px-3 py-3 text-right">총 주문금액 ($)</th>
                <th className="px-4 py-3 text-center">최근 발주일</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-zinc-800 dark:text-zinc-200">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-zinc-500">
                    검색 조건에 해당되는 제품 발주 내역이 없습니다.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => (
                  <tr key={p.productId} className="hover:bg-zinc-50/70 dark:hover:bg-zinc-900/50">
                    <td className="px-3 py-2 text-center">
                      {p.imageUrl ? (
                        <img
                          src={p.imageUrl}
                          alt={p.productName}
                          className="w-8 h-8 rounded-md object-cover border border-zinc-200 dark:border-zinc-800 mx-auto"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-md bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-[10px] text-zinc-400 mx-auto">
                          No Img
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-zinc-900 dark:text-white">
                      {p.letustoSku === "지정 대기" ? (
                        <span className="text-amber-600 dark:text-amber-400 font-sans text-[11px] font-bold">
                          지정 대기
                        </span>
                      ) : (
                        <Link
                          href={`/admin/purchasing/orders?search=${encodeURIComponent(p.letustoSku)}`}
                          className="hover:underline"
                        >
                          {p.letustoSku}
                        </Link>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-zinc-600 dark:text-zinc-400">
                      {p.manufactureSku || "-"}
                    </td>
                    <td className="px-4 py-3 font-semibold max-w-xs truncate text-zinc-900 dark:text-white">
                      {p.productName}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {p.supplierName}
                    </td>
                    <td className="px-3 py-3 text-right font-extrabold text-zinc-900 dark:text-white">
                      {p.totalOrderedQty.toLocaleString()}
                    </td>
                    <td className="px-3 py-3 text-right text-zinc-600 dark:text-zinc-400">
                      {p.shippedQty.toLocaleString()}
                    </td>
                    <td className="px-3 py-3 text-right text-emerald-600 dark:text-emerald-400 font-semibold">
                      {p.receivedQty.toLocaleString()}
                    </td>
                    <td className="px-3 py-3 text-right text-amber-600 dark:text-amber-400 font-extrabold">
                      {p.remainingQty.toLocaleString()}
                    </td>
                    <td className="px-3 py-3 text-right font-extrabold text-zinc-950 dark:text-white">
                      ${p.totalOrderAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-center text-zinc-500 dark:text-zinc-400 font-mono">
                      {p.lastOrderDate || "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. PAYMENT SUMMARY */}
      <div className="p-5 rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-extrabold text-zinc-950 dark:text-white">
              💳 Payment Summary (Finance 정산 & 미지급 대금 집계)
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              기존 Supplier Invoice 및 Supplier Payment Single Source of Truth 기준 대금 현황
            </p>
          </div>
          <Link
            href="/admin/finance/invoices"
            className="text-xs font-bold text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white underline"
          >
            Finance Invoices 이동 →
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-4 rounded-xl border border-zinc-200 bg-zinc-50/70 dark:border-zinc-800 dark:bg-zinc-900/60">
            <span className="text-xs font-extrabold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              Total PO Amount (총 발주일)
            </span>
            <div className="text-xl font-black text-zinc-900 dark:text-white mt-1">
              ${paymentSummary.totalPoAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>

          <div className="p-4 rounded-xl border border-zinc-200 bg-zinc-50/70 dark:border-zinc-800 dark:bg-zinc-900/60">
            <span className="text-xs font-extrabold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              Invoiced Amount (청구 완료)
            </span>
            <div className="text-xl font-black text-zinc-900 dark:text-white mt-1">
              ${paymentSummary.invoicedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>

          <div className="p-4 rounded-xl border border-zinc-200 bg-zinc-50/70 dark:border-zinc-800 dark:bg-zinc-900/60">
            <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
              Paid Amount (지급 완료)
            </span>
            <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
              ${paymentSummary.paidAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>

          <div className="p-4 rounded-xl border border-zinc-200 bg-zinc-50/70 dark:border-zinc-800 dark:bg-zinc-900/60">
            <span className="text-xs font-extrabold text-rose-600 dark:text-rose-400 uppercase tracking-wider">
              Outstanding Amount (미지급 잔액)
            </span>
            <div className="text-xl font-black text-rose-600 dark:text-rose-400 mt-1">
              ${paymentSummary.outstandingAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
