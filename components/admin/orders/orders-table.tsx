// components/admin/orders/orders-table.tsx
// Phase B6 / ADM-ORDER-PROCESSING-001: Centralized Order Processing Workspace
"use client";

import React, { useState, useTransition, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  AdminRetailerOrderSummary,
  ApprovedOrderStatus,
  AdminOrderFilter,
  AdminOrderSummaryCounters,
  AdminOrderBox,
} from "@/lib/admin/orders-types";
import { getAdminRetailerOrdersAction } from "@/lib/admin/orders-actions";
import { PackagesPopover } from "./packages-popover";
import { EditTrackingModal } from "./edit-tracking-modal";

function formatYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatOrderDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

function formatActivityDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  const h = String(d.getUTCHours()).padStart(2, "0");
  const min = String(d.getUTCMinutes()).padStart(2, "0");
  return `${m}/${day}, ${h}:${min}`;
}

const STATUS_CHIP_OPTIONS: Array<{
  id: ApprovedOrderStatus;
  label: string;
  icon: string;
  activeBg: string;
  activeText: string;
  activeBorder: string;
  activeRing: string;
}> = [
  {
    id: "submitted",
    label: "Submitted",
    icon: "🆕",
    activeBg: "bg-blue-600",
    activeText: "text-white",
    activeBorder: "border-blue-600",
    activeRing: "ring-blue-500/30",
  },
  {
    id: "processing",
    label: "Processing",
    icon: "⚡",
    activeBg: "bg-amber-600",
    activeText: "text-white",
    activeBorder: "border-amber-600",
    activeRing: "ring-amber-500/30",
  },
  {
    id: "partially_shipped",
    label: "Partially Shipped",
    icon: "📦",
    activeBg: "bg-indigo-600",
    activeText: "text-white",
    activeBorder: "border-indigo-600",
    activeRing: "ring-indigo-500/30",
  },
  {
    id: "shipped",
    label: "Shipped",
    icon: "✓",
    activeBg: "bg-emerald-600",
    activeText: "text-white",
    activeBorder: "border-emerald-600",
    activeRing: "ring-emerald-500/30",
  },
  {
    id: "partially_cancelled",
    label: "Partially Cancelled",
    icon: "⚠️",
    activeBg: "bg-orange-600",
    activeText: "text-white",
    activeBorder: "border-orange-600",
    activeRing: "ring-orange-500/30",
  },
  {
    id: "cancelled",
    label: "Cancelled",
    icon: "🛑",
    activeBg: "bg-rose-600",
    activeText: "text-white",
    activeBorder: "border-rose-600",
    activeRing: "ring-rose-500/30",
  },
];

interface OrdersTableProps {
  initialOrders: AdminRetailerOrderSummary[];
  initialTotal: number;
  initialCounters?: AdminOrderSummaryCounters;
  companies?: { id: string; name: string; companyCode?: string | null }[];
  stores?: { id: string; name: string; companyId: string; city?: string | null; state?: string | null }[];
}

export function AdminOrdersTable({
  initialOrders,
  initialTotal,
  initialCounters,
  companies = [],
  stores = [],
}: OrdersTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Primary Data State
  const [orders, setOrders] = useState<AdminRetailerOrderSummary[]>(initialOrders);
  const [totalCount, setTotalCount] = useState<number>(initialTotal);
  const [counters, setCounters] = useState<AdminOrderSummaryCounters>(
    initialCounters || {
      total: initialTotal,
      newOrders: 0,
      readyToProcess: 0,
      partiallyShipped: 0,
      onHold: 0,
      trackingMissing: 0,
      completed: 0,
    }
  );

  // Selected row IDs for batch operations
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());

  // In-place tracking modal state
  const [trackingModalState, setTrackingModalState] = useState<{
    fulfillmentId: string;
    fulfillmentNumber: string;
    orderNumber: string;
    currentBoxes: AdminOrderBox[];
    currentNotes?: string | null;
  } | null>(null);

  // Filter States initialized from URL searchParams
  const [quickFilter, setQuickFilter] = useState<string>(
    searchParams.get("quickFilter") || "all"
  );
  const [searchTerm, setSearchTerm] = useState<string>(
    searchParams.get("search") || ""
  );
  const [skuTerm, setSkuTerm] = useState<string>(
    searchParams.get("sku") || ""
  );
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(
    searchParams.get("companyId") || "all"
  );
  const [selectedStoreId, setSelectedStoreId] = useState<string>(
    searchParams.get("storeId") || "all"
  );
  const [statusFilter, setStatusFilter] = useState<string>(
    searchParams.get("status") || "all"
  );
  const [selectedStatuses, setSelectedStatuses] = useState<Set<ApprovedOrderStatus>>(() => {
    const raw = searchParams.get("status");
    if (!raw || raw === "all") return new Set<ApprovedOrderStatus>();
    const list = raw.split(",").map((s) => s.trim().toLowerCase()) as ApprovedOrderStatus[];
    return new Set(
      list.filter((s) =>
        ["submitted", "processing", "partially_shipped", "shipped", "partially_cancelled", "cancelled"].includes(s)
      )
    );
  });
  const [paymentStatus, setPaymentStatus] = useState<string>(
    searchParams.get("paymentStatus") || "all"
  );
  const [datePreset, setDatePreset] = useState<string>(
    searchParams.get("datePreset") || "all"
  );
  const [startDate, setStartDate] = useState<string>(
    searchParams.get("startDate") || ""
  );
  const [endDate, setEndDate] = useState<string>(
    searchParams.get("endDate") || ""
  );
  const [testMode, setTestMode] = useState<string>(
    searchParams.get("testMode") || "all"
  );

  // Sorting & Pagination States
  const [sortBy, setSortBy] = useState<string>(
    searchParams.get("sortBy") || "created_at"
  );
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">(
    (searchParams.get("sortDirection") as "asc" | "desc") || "desc"
  );
  const [currentPage, setCurrentPage] = useState<number>(
    parseInt(searchParams.get("page") || "1", 10) || 1
  );
  const [pageSize, setPageSize] = useState<number>(
    parseInt(searchParams.get("pageSize") || "25", 10) || 25
  );

  // Cascading stores filtered by company
  const availableStores = useMemo(() => {
    if (selectedCompanyId === "all") return stores;
    return stores.filter((s) => s.companyId === selectedCompanyId);
  }, [stores, selectedCompanyId]);

  // Determine if active custom filters exist
  const hasActiveFilters = useMemo(() => {
    return (
      quickFilter !== "all" ||
      Boolean(searchTerm.trim()) ||
      Boolean(skuTerm.trim()) ||
      selectedCompanyId !== "all" ||
      selectedStoreId !== "all" ||
      (statusFilter !== "all" && selectedStatuses.size > 0 && selectedStatuses.size < 6) ||
      paymentStatus !== "all" ||
      datePreset !== "all" ||
      Boolean(startDate) ||
      Boolean(endDate) ||
      testMode !== "all"
    );
  }, [
    quickFilter,
    searchTerm,
    skuTerm,
    selectedCompanyId,
    selectedStoreId,
    statusFilter,
    selectedStatuses,
    paymentStatus,
    datePreset,
    startDate,
    endDate,
    testMode,
  ]);

  // Execute query action & sync URL
  const executeQuery = (custom?: Partial<AdminOrderFilter>) => {
    const nextQuickFilter = custom?.quickFilter !== undefined ? custom.quickFilter : quickFilter;
    const nextSearch = custom?.search !== undefined ? custom.search : searchTerm.trim();
    const nextSku = custom?.sku !== undefined ? custom.sku : skuTerm.trim();
    const nextCompanyId = custom?.companyId !== undefined ? custom.companyId : selectedCompanyId;
    const nextStoreId = custom?.storeId !== undefined ? custom.storeId : selectedStoreId;
    const nextStatus = custom?.status !== undefined ? custom.status : statusFilter;
    const nextPaymentStatus = custom?.paymentStatus !== undefined ? custom.paymentStatus : paymentStatus;
    const nextDatePreset = custom?.datePreset !== undefined ? custom.datePreset : datePreset;
    const nextStartDate = custom?.startDate !== undefined ? custom.startDate : startDate;
    const nextEndDate = custom?.endDate !== undefined ? custom.endDate : endDate;
    const nextTestMode = custom?.testMode !== undefined ? custom.testMode : testMode;
    const nextSortBy = custom?.sortBy !== undefined ? custom.sortBy : sortBy;
    const nextSortDirection = custom?.sortDirection !== undefined ? custom.sortDirection : sortDirection;
    const nextPage = custom?.page !== undefined ? custom.page : 1;
    const nextPageSize = custom?.pageSize !== undefined ? custom.pageSize : pageSize;

    // Update URL query parameters seamlessly
    const query = new URLSearchParams();
    if (nextQuickFilter && nextQuickFilter !== "all") query.set("quickFilter", nextQuickFilter);
    if (nextSearch) query.set("search", nextSearch);
    if (nextSku) query.set("sku", nextSku);
    if (nextCompanyId && nextCompanyId !== "all") query.set("companyId", nextCompanyId);
    if (nextStoreId && nextStoreId !== "all") query.set("storeId", nextStoreId);
    if (nextStatus && nextStatus !== "all") query.set("status", typeof nextStatus === "string" ? nextStatus : nextStatus.join(","));
    if (nextPaymentStatus && nextPaymentStatus !== "all") query.set("paymentStatus", nextPaymentStatus);
    if (nextDatePreset && nextDatePreset !== "all") query.set("datePreset", nextDatePreset);
    if (nextStartDate) query.set("startDate", nextStartDate);
    if (nextEndDate) query.set("endDate", nextEndDate);
    if (nextTestMode && nextTestMode !== "all") query.set("testMode", nextTestMode);
    if (nextSortBy && nextSortBy !== "created_at") query.set("sortBy", nextSortBy);
    if (nextSortDirection && nextSortDirection !== "desc") query.set("sortDirection", nextSortDirection);
    if (nextPage && nextPage > 1) query.set("page", String(nextPage));
    if (nextPageSize && nextPageSize !== 25) query.set("pageSize", String(nextPageSize));

    const qStr = query.toString();
    const nextUrl = `${pathname}${qStr ? `?${qStr}` : ""}`;
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", nextUrl);
    }
    router.replace(nextUrl, { scroll: false });

    startTransition(async () => {
      const activeFilter: AdminOrderFilter = {
        quickFilter: (nextQuickFilter as any) || undefined,
        search: nextSearch || undefined,
        sku: nextSku || undefined,
        companyId: nextCompanyId !== "all" ? nextCompanyId : undefined,
        storeId: nextStoreId !== "all" ? nextStoreId : undefined,
        status: nextStatus !== "all" ? nextStatus : undefined,
        paymentStatus: nextPaymentStatus !== "all" ? nextPaymentStatus : undefined,
        datePreset: (nextDatePreset as any) || undefined,
        startDate: nextStartDate || undefined,
        endDate: nextEndDate || undefined,
        testMode: (nextTestMode as any) || undefined,
        sortBy: (nextSortBy as any) || undefined,
        sortDirection: nextSortDirection || undefined,
        page: nextPage,
        pageSize: nextPageSize,
      };

      const res = await getAdminRetailerOrdersAction(activeFilter);
      setOrders(res.orders);
      setTotalCount(res.totalCount);
      setCounters(res.summaryCounters);
      setCurrentPage(nextPage);
    });
  };

  const handleToggleAllStatuses = () => {
    setSelectedStatuses(new Set());
    setStatusFilter("all");
    executeQuery({ status: "all", page: 1 });
  };

  const handleToggleStatus = (statusId: ApprovedOrderStatus) => {
    const nextSet = new Set(selectedStatuses);
    if (nextSet.has(statusId)) {
      nextSet.delete(statusId);
    } else {
      nextSet.add(statusId);
    }
    setSelectedStatuses(nextSet);

    let nextStatusParam = "all";
    if (nextSet.size > 0 && nextSet.size < 6) {
      nextStatusParam = Array.from(nextSet).join(",");
    } else {
      nextSet.clear();
      setSelectedStatuses(new Set());
    }
    setStatusFilter(nextStatusParam);
    executeQuery({ status: nextStatusParam, page: 1 });
  };

  const handleSelectDatePreset = (preset: "all" | "today" | "7d" | "30d") => {
    setDatePreset(preset);
    const now = new Date();
    let nextStart = "";
    let nextEnd = "";
    if (preset === "today") {
      nextStart = formatYMD(now);
      nextEnd = formatYMD(now);
    } else if (preset === "7d") {
      const past7 = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
      nextStart = formatYMD(past7);
      nextEnd = formatYMD(now);
    } else if (preset === "30d") {
      const past30 = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
      nextStart = formatYMD(past30);
      nextEnd = formatYMD(now);
    }
    setStartDate(nextStart);
    setEndDate(nextEnd);
    executeQuery({ datePreset: preset, startDate: nextStart, endDate: nextEnd, page: 1 });
  };

  const handleDateInputChange = (newStart: string, newEnd: string) => {
    let validatedStart = newStart;
    let validatedEnd = newEnd;
    if (validatedStart && validatedEnd && validatedStart > validatedEnd) {
      validatedEnd = validatedStart;
    }
    setStartDate(validatedStart);
    setEndDate(validatedEnd);
    setDatePreset("");
    executeQuery({ datePreset: undefined, startDate: validatedStart, endDate: validatedEnd, page: 1 });
  };

  const handleReset = () => {
    setQuickFilter("all");
    setSearchTerm("");
    setSkuTerm("");
    setSelectedCompanyId("all");
    setSelectedStoreId("all");
    setStatusFilter("all");
    setSelectedStatuses(new Set());
    setPaymentStatus("all");
    setDatePreset("all");
    setStartDate("");
    setEndDate("");
    setTestMode("all");
    setSortBy("created_at");
    setSortDirection("desc");
    setCurrentPage(1);

    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", pathname);
    }
    router.replace(pathname, { scroll: false });

    startTransition(async () => {
      const res = await getAdminRetailerOrdersAction({});
      setOrders(res.orders);
      setTotalCount(res.totalCount);
      setCounters(res.summaryCounters);
    });
  };

  const handleSort = (field: "created_at" | "order_number" | "retailer" | "remaining" | "total" | "updated_at" | "days_open") => {
    const nextDirection = sortBy === field && sortDirection === "desc" ? "asc" : "desc";
    setSortBy(field);
    setSortDirection(nextDirection);
    executeQuery({ sortBy: field, sortDirection: nextDirection, page: 1 });
  };

  // Checkbox batch selections
  const allCurrentIds = useMemo(() => orders.map((o) => o.id), [orders]);
  const isAllSelected = allCurrentIds.length > 0 && allCurrentIds.every((id) => selectedOrderIds.has(id));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedOrderIds(new Set());
    } else {
      setSelectedOrderIds(new Set(allCurrentIds));
    }
  };

  const toggleSelectOne = (id: string) => {
    const next = new Set(selectedOrderIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedOrderIds(next);
  };

  const handleExportSelectedCartonsCsv = () => {
    const selectedOrders = orders.filter((o) => selectedOrderIds.has(o.id));
    const rows = [
      [
        "Order Number",
        "Company Name",
        "Store Name",
        "Box Number",
        "Box Total",
        "Carrier",
        "Tracking Number",
        "Tracking URL",
        "Weight (lbs)",
        "Dimensions",
      ],
    ];

    selectedOrders.forEach((o) => {
      if (o.packages && o.packages.length > 0) {
        o.packages.forEach((p) => {
          rows.push([
            o.orderNumber,
            o.companyName,
            o.storeName,
            String(p.boxNumber),
            String(p.boxTotal),
            p.carrier,
            p.trackingNumber || "",
            p.trackingUrl || "",
            p.weightLbs ? String(p.weightLbs) : "",
            p.dimensionsInch || "",
          ]);
        });
      } else {
        rows.push([
          o.orderNumber,
          o.companyName,
          o.storeName,
          "1",
          "1",
          "Unassigned",
          "",
          "",
          "",
          "",
        ]);
      }
    });

    const csvContent = "data:text/csv;charset=utf-8," + rows.map((e) => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `carton_manifest_batch_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Status Badge Helper
  const getStatusBadge = (status: ApprovedOrderStatus) => {
    switch (status) {
      case "submitted":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/20">
            Submitted
          </span>
        );
      case "processing":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/20">
            Processing
          </span>
        );
      case "partially_shipped":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border border-indigo-500/20">
            Partially Shipped
          </span>
        );
      case "shipped":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
            Shipped
          </span>
        );
      case "partially_cancelled":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-500/15 text-orange-700 dark:text-orange-400 border border-orange-500/20">
            Partially Cancelled
          </span>
        );
      case "cancelled":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/20">
            Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-500/15 text-zinc-700 dark:text-zinc-400 border border-zinc-500/20">
            {status}
          </span>
        );
    }
  };

  // Operational Action Badge Helper
  const getActionBadge = (ord: AdminRetailerOrderSummary) => {
    if (ord.cancellationRequested) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30 animate-pulse">
          🛑 Hold: Cancellation
        </span>
      );
    }
    if (ord.hasMissingTracking) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
          ⚠️ Tracking Needed
        </span>
      );
    }
    if (ord.orderStatus === "submitted") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30">
          🆕 New Order
        </span>
      );
    }
    if (
      ["submitted", "processing", "partially_shipped"].includes(ord.orderStatus) &&
      ord.totalRemainingUnits > 0
    ) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
          ⚡ Ready to Pack
        </span>
      );
    }
    if (ord.orderStatus === "shipped" || ord.totalRemainingUnits === 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
          ✓ Completed
        </span>
      );
    }
    return null;
  };

  // Total pages
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <div className="space-y-5">
      {/* 0. Header Area */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-zinc-950 dark:text-white tracking-tight">
              Order Processing (주문 처리 및 출고 관리)
            </h1>
            <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border border-indigo-500/20">
              Warehouse Live Queue
            </span>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            모든 리테일 매장 발주 큐, 4-Way 수량 정합성(주문/출고/취소/잔여), 멀티박스 운송장 번호 관리 및 분할 인보이스 통합 워크스페이스입니다.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleReset}
              className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors"
            >
              Reset Filters
            </button>
          )}
          <button
            type="button"
            onClick={() => executeQuery()}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 hover:opacity-90 shadow-2xs transition-all"
          >
            {isPending ? (
              <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <span>↻</span>
            )}
            Refresh
          </button>
        </div>
      </div>

      {/* 1. Operational Summary KPI Cards / Quick Filter Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
        {/* All Orders */}
        <button
          type="button"
          onClick={() => {
            setQuickFilter("all");
            executeQuery({ quickFilter: "all", page: 1 });
          }}
          className={`p-3 rounded-2xl border text-left transition-all ${
            quickFilter === "all"
              ? "border-zinc-900 dark:border-white bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-md ring-2 ring-zinc-900/20"
              : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white hover:border-zinc-400"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">
              All Orders
            </span>
            <span className="text-xs">📦</span>
          </div>
          <span className="text-xl font-black mt-1 block">{counters.total}</span>
        </button>

        {/* New Orders */}
        <button
          type="button"
          onClick={() => {
            setQuickFilter("new");
            executeQuery({ quickFilter: "new", page: 1 });
          }}
          className={`p-3 rounded-2xl border text-left transition-all ${
            quickFilter === "new"
              ? "border-blue-600 bg-blue-600 text-white shadow-md ring-2 ring-blue-600/20"
              : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white hover:border-blue-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">
              New Orders
            </span>
            <span className="text-xs">🆕</span>
          </div>
          <span className="text-xl font-black mt-1 block text-blue-600 dark:text-blue-400 group-hover:text-blue-700">
            {counters.newOrders}
          </span>
        </button>

        {/* Ready to Process */}
        <button
          type="button"
          onClick={() => {
            setQuickFilter("ready");
            executeQuery({ quickFilter: "ready", page: 1 });
          }}
          className={`p-3 rounded-2xl border text-left transition-all ${
            quickFilter === "ready"
              ? "border-emerald-600 bg-emerald-600 text-white shadow-md ring-2 ring-emerald-600/20"
              : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white hover:border-emerald-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">
              Ready to Ship
            </span>
            <span className="text-xs">⚡</span>
          </div>
          <span className="text-xl font-black mt-1 block text-emerald-600 dark:text-emerald-400">
            {counters.readyToProcess}
          </span>
        </button>

        {/* Partially Shipped */}
        <button
          type="button"
          onClick={() => {
            setQuickFilter("partially_shipped");
            executeQuery({ quickFilter: "partially_shipped", page: 1 });
          }}
          className={`p-3 rounded-2xl border text-left transition-all ${
            quickFilter === "partially_shipped"
              ? "border-indigo-600 bg-indigo-600 text-white shadow-md ring-2 ring-indigo-600/20"
              : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white hover:border-indigo-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">
              Part. Shipped
            </span>
            <span className="text-xs">🚚</span>
          </div>
          <span className="text-xl font-black mt-1 block text-indigo-600 dark:text-indigo-400">
            {counters.partiallyShipped}
          </span>
        </button>

        {/* On Hold */}
        <button
          type="button"
          onClick={() => {
            setQuickFilter("on_hold");
            executeQuery({ quickFilter: "on_hold", page: 1 });
          }}
          className={`p-3 rounded-2xl border text-left transition-all ${
            quickFilter === "on_hold"
              ? "border-rose-600 bg-rose-600 text-white shadow-md ring-2 ring-rose-600/20"
              : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white hover:border-rose-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">
              On Hold
            </span>
            <span className="text-xs">🛑</span>
          </div>
          <span className="text-xl font-black mt-1 block text-rose-600 dark:text-rose-400">
            {counters.onHold}
          </span>
        </button>

        {/* Tracking Missing */}
        <button
          type="button"
          onClick={() => {
            setQuickFilter("tracking_missing");
            executeQuery({ quickFilter: "tracking_missing", page: 1 });
          }}
          className={`p-3 rounded-2xl border text-left transition-all ${
            quickFilter === "tracking_missing"
              ? "border-amber-600 bg-amber-600 text-white shadow-md ring-2 ring-amber-600/20"
              : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white hover:border-amber-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">
              Track Needed
            </span>
            <span className="text-xs">⚠️</span>
          </div>
          <span className="text-xl font-black mt-1 block text-amber-600 dark:text-amber-400">
            {counters.trackingMissing}
          </span>
        </button>

        {/* Completed */}
        <button
          type="button"
          onClick={() => {
            setQuickFilter("completed");
            executeQuery({ quickFilter: "completed", page: 1 });
          }}
          className={`p-3 rounded-2xl border text-left transition-all ${
            quickFilter === "completed"
              ? "border-zinc-700 bg-zinc-800 text-white shadow-md ring-2 ring-zinc-700/20"
              : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white hover:border-zinc-400"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">
              Completed
            </span>
            <span className="text-xs">✅</span>
          </div>
          <span className="text-xl font-black mt-1 block text-zinc-600 dark:text-zinc-300">
            {counters.completed}
          </span>
        </button>
      </div>

      {/* 2. Advanced Search & Filtering Toolbar */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-xs space-y-3">
        {/* Row 1: Search, Retailer, Store, Status */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          {/* Freeform Search */}
          <div className="sm:col-span-4">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
              Search Orders
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Order #, Store, City, State..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && executeQuery()}
                className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
              <span className="absolute left-2.5 top-2.5 text-zinc-400 text-xs">🔍</span>
            </div>
          </div>

          {/* SKU / Product Filter */}
          <div className="sm:col-span-2">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
              Filter by SKU
            </label>
            <input
              type="text"
              placeholder="e.g. DR120-SB..."
              value={skuTerm}
              onChange={(e) => setSkuTerm(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && executeQuery()}
              className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 text-zinc-900 dark:text-white"
            />
          </div>

          {/* Retailer Company Selector */}
          <div className="sm:col-span-3">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
              Retailer Company
            </label>
            <select
              value={selectedCompanyId}
              onChange={(e) => {
                const newCompanyId = e.target.value;
                setSelectedCompanyId(newCompanyId);
                setSelectedStoreId("all");
                executeQuery({ companyId: newCompanyId, storeId: "all", page: 1 });
              }}
              className="w-full px-2.5 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 text-zinc-900 dark:text-white font-medium"
            >
              <option value="all">All Retailers</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.companyCode ? `(${c.companyCode})` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Store Selector (Cascading) */}
          <div className="sm:col-span-3">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
              Destination Store
            </label>
            <select
              value={selectedStoreId}
              onChange={(e) => {
                const newStoreId = e.target.value;
                setSelectedStoreId(newStoreId);
                executeQuery({ storeId: newStoreId, page: 1 });
              }}
              className="w-full px-2.5 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 text-zinc-900 dark:text-white font-medium"
            >
              <option value="all">All Stores</option>
              {availableStores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.state ? `(${s.state})` : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 2: Status Multi-Select Filter Chips */}
        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mr-1">
            Status:
          </span>
          {/* All Statuses Toggle Chip */}
          <button
            type="button"
            onClick={handleToggleAllStatuses}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all border ${
              selectedStatuses.size === 0 || selectedStatuses.size === 6
                ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 border-zinc-900 dark:border-white shadow-2xs"
                : "bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400 border-transparent"
            }`}
          >
            All Statuses
          </button>

          {/* 6 Individual Status Chips */}
          {STATUS_CHIP_OPTIONS.map((opt) => {
            const isSelected = selectedStatuses.has(opt.id);
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleToggleStatus(opt.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all border ${
                  isSelected
                    ? `${opt.activeBg} ${opt.activeText} ${opt.activeBorder} shadow-2xs ring-2 ${opt.activeRing}`
                    : "bg-white dark:bg-zinc-800/80 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700"
                }`}
              >
                <span>{opt.icon}</span>
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>

        {/* Row 3: Date Presets & Pickers, Payment Status, Mode & Apply Button */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            {/* Always Visible Date Pickers & Presets */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-semibold text-zinc-500 mr-0.5">Date:</span>
              {(["all", "today", "7d", "30d"] as const).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handleSelectDatePreset(preset)}
                  className={`px-2 py-1 rounded-md text-[11px] font-bold transition-colors ${
                    datePreset === preset
                      ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-2xs"
                      : "bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300"
                  }`}
                >
                  {preset === "all" ? "All" : preset === "today" ? "Today" : preset === "7d" ? "7 Days" : "30 Days"}
                </button>
              ))}

              {/* From and To Date Inputs ALWAYS VISIBLE Side-by-Side */}
              <div className="flex items-center gap-1.5 bg-zinc-50 dark:bg-zinc-800/80 px-2 py-1 rounded-xl border border-zinc-200 dark:border-zinc-700">
                <span className="text-[10px] font-bold text-zinc-500 uppercase">From:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => handleDateInputChange(e.target.value, endDate)}
                  onClick={(e) => {
                    try {
                      e.currentTarget.showPicker?.();
                    } catch {}
                  }}
                  className="w-28 px-1.5 py-0.5 text-[11px] rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white cursor-pointer [color-scheme:light] dark:[color-scheme:dark]"
                />
                <span className="text-zinc-400 text-xs">→</span>
                <span className="text-[10px] font-bold text-zinc-500 uppercase">To:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => handleDateInputChange(startDate, e.target.value)}
                  onClick={(e) => {
                    try {
                      e.currentTarget.showPicker?.();
                    } catch {}
                  }}
                  className="w-28 px-1.5 py-0.5 text-[11px] rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white cursor-pointer [color-scheme:light] dark:[color-scheme:dark]"
                />
              </div>
            </div>

            {/* Payment Status Dropdown */}
            <div className="flex items-center gap-1.5 pl-2 border-l border-zinc-200 dark:border-zinc-700">
              <span className="text-[11px] font-semibold text-zinc-500">Payment:</span>
              <select
                value={paymentStatus}
                onChange={(e) => {
                  setPaymentStatus(e.target.value);
                  executeQuery({ paymentStatus: e.target.value, page: 1 });
                }}
                className="px-2.5 py-1 text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white font-medium"
              >
                <option value="all">All Payment Statuses</option>
                <option value="unpaid">Unpaid</option>
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
                <option value="refunded">Refunded</option>
              </select>
            </div>

            {/* Test Mode Selector */}
            <div className="flex items-center gap-1 pl-2 border-l border-zinc-200 dark:border-zinc-700">
              <span className="text-[11px] font-semibold text-zinc-500 mr-1">Mode:</span>
              {(["all", "live", "test"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    setTestMode(mode);
                    executeQuery({ testMode: mode, page: 1 });
                  }}
                  className={`px-2 py-1 rounded-md text-[11px] font-bold transition-colors ${
                    testMode === mode
                      ? mode === "test"
                        ? "bg-amber-600 text-white shadow-2xs"
                        : "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-2xs"
                      : "bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300"
                  }`}
                >
                  {mode === "all" ? "All Orders" : mode === "live" ? "Live" : "TEST"}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => executeQuery({ page: 1 })}
              disabled={isPending}
              className="px-3.5 py-1.5 text-xs font-bold rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 hover:opacity-90 shadow-2xs"
            >
              {isPending ? "Filtering..." : "Apply Filters"}
            </button>
          </div>
        </div>
      </div>

      {/* 3. Batch Selection Toolbar (if any selected) */}
      {selectedOrderIds.size > 0 && (
        <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-indigo-50 border border-indigo-200 dark:bg-indigo-950/40 dark:border-indigo-800 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-indigo-900 dark:text-indigo-200">
              {selectedOrderIds.size} {selectedOrderIds.size === 1 ? "order" : "orders"} selected
            </span>
            <span className="text-zinc-400">|</span>
            <button
              type="button"
              onClick={() => setSelectedOrderIds(new Set())}
              className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 underline font-medium"
            >
              Clear selection
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportSelectedCartonsCsv}
              className="px-3 py-1 rounded-lg font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-2xs transition-colors"
            >
              Export Carton Manifest CSV 📄
            </button>
          </div>
        </div>
      )}

      {/* 4. Results Header & Count */}
      <div className="flex items-center justify-between px-1 text-xs text-zinc-500">
        <span>
          Showing <strong>{orders.length}</strong> of <strong>{totalCount}</strong> retailer orders
          {hasActiveFilters && <span className="ml-1 text-indigo-600 font-semibold">(Filtered)</span>}
        </span>
        {isPending && (
          <span className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 font-medium">
            <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
            Updating queue...
          </span>
        )}
      </div>

      {/* 5. Centralized High-Density Orders Table */}
      {orders.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-12 text-center space-y-3">
          <div className="text-3xl">📦</div>
          <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
            No Orders Found in Processing Queue
          </h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            {hasActiveFilters
              ? "선택한 필터 조건과 일치하는 주문이 없습니다. 검색어를 변경하거나 필터를 초기화해 보세요."
              : "현재 처리 대기 중인 주문이 없습니다."}
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-1.5 rounded-xl text-xs font-bold bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
            >
              Clear Filters
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[1240px]">
              <thead className="bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 uppercase tracking-wider font-semibold text-[10px]">
                <tr>
                  <th className="py-3 px-3 w-8 text-center">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={toggleSelectAll}
                      className="rounded border-zinc-300 dark:border-zinc-700 text-indigo-600 focus:ring-indigo-500"
                    />
                  </th>
                  <th
                    className="py-3 px-3 cursor-pointer hover:text-zinc-900 dark:hover:text-white"
                    onClick={() => handleSort("order_number")}
                  >
                    Order # {sortBy === "order_number" && (sortDirection === "asc" ? "▲" : "▼")}
                  </th>
                  <th
                    className="py-3 px-3 cursor-pointer hover:text-zinc-900 dark:hover:text-white"
                    onClick={() => handleSort("created_at")}
                  >
                    Date & Activity {sortBy === "created_at" && (sortDirection === "asc" ? "▲" : "▼")}
                  </th>
                  <th
                    className="py-3 px-3 text-center cursor-pointer hover:text-zinc-900 dark:hover:text-white"
                    onClick={() => handleSort("days_open")}
                  >
                    Days Open {sortBy === "days_open" && (sortDirection === "asc" ? "▲" : "▼")}
                  </th>
                  <th
                    className="py-3 px-3 cursor-pointer hover:text-zinc-900 dark:hover:text-white"
                    onClick={() => handleSort("retailer")}
                  >
                    Retailer & Destination {sortBy === "retailer" && (sortDirection === "asc" ? "▲" : "▼")}
                  </th>
                  <th className="py-3 px-3 text-center">SKUs / Units</th>
                  <th
                    className="py-3 px-3 text-center cursor-pointer hover:text-zinc-900 dark:hover:text-white"
                    onClick={() => handleSort("remaining")}
                  >
                    Fulfillment Progress {sortBy === "remaining" && (sortDirection === "asc" ? "▲" : "▼")}
                  </th>
                  <th className="py-3 px-3">Order Status</th>
                  <th className="py-3 px-3 text-center">Tracking & Cartons</th>
                  <th className="py-3 px-3">Invoice & Terms</th>
                  <th
                    className="py-3 px-3 text-right cursor-pointer hover:text-zinc-900 dark:hover:text-white"
                    onClick={() => handleSort("total")}
                  >
                    Total Amount {sortBy === "total" && (sortDirection === "asc" ? "▲" : "▼")}
                  </th>
                  <th className="py-3 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                {orders.map((ord) => {
                  const isSelected = selectedOrderIds.has(ord.id);
                  const completionPct =
                    ord.totalOrderedUnits > 0
                      ? Math.round((ord.totalShippedUnits / ord.totalOrderedUnits) * 100)
                      : 0;

                  return (
                    <tr
                      key={ord.id}
                      className={`hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors ${
                        isSelected ? "bg-indigo-50/40 dark:bg-indigo-950/20" : ""
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectOne(ord.id)}
                          className="rounded border-zinc-300 dark:border-zinc-700 text-indigo-600 focus:ring-indigo-500"
                        />
                      </td>

                      {/* Order # and Priority Indicator */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Link
                            href={`/admin/sales/orders/${ord.id}`}
                            className="font-bold text-zinc-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                          >
                            {ord.orderNumber}
                          </Link>
                          {ord.isTest && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                              TEST
                            </span>
                          )}
                        </div>
                        <div className="mt-1">
                          {getActionBadge(ord)}
                        </div>
                      </td>

                      {/* Date & Activity */}
                      <td className="py-3 px-3 text-zinc-600 dark:text-zinc-400 whitespace-nowrap" suppressHydrationWarning>
                        <div className="font-medium text-zinc-900 dark:text-white" suppressHydrationWarning>
                          {formatOrderDate(ord.createdAt)}
                        </div>
                        <span className="text-[10px] text-zinc-400 block" suppressHydrationWarning>
                          Act: {formatActivityDate(ord.lastActivityAt || ord.updatedAt)}
                        </span>
                      </td>

                      {/* Days Open */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {ord.isCompleted || ord.daysOpen === null ? (
                          <span className="text-zinc-400 text-xs font-mono">—</span>
                        ) : ord.daysOpen >= 7 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30 animate-pulse">
                            {ord.daysOpen}d
                          </span>
                        ) : ord.daysOpen >= 3 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                            {ord.daysOpen}d
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                            {ord.daysOpen}d
                          </span>
                        )}
                      </td>

                      {/* Retailer & Destination */}
                      <td className="py-3 px-3">
                        <div className="font-semibold text-zinc-900 dark:text-white leading-tight">
                          {ord.companyName}
                        </div>
                        <div className="text-[11px] text-zinc-500 flex items-center gap-1 mt-0.5">
                          <span>🏪 {ord.storeName}</span>
                          {(ord.shippingCity || ord.shippingState) && (
                            <span className="text-zinc-400">
                              · {ord.shippingCity ? `${ord.shippingCity}, ` : ""}{ord.shippingState || ""}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* SKUs & Units */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span className="font-mono text-xs font-bold text-zinc-900 dark:text-white">
                          {ord.totalSkusCount} {ord.totalSkusCount === 1 ? "SKU" : "SKUs"}
                        </span>
                        <span className="text-[11px] text-zinc-400 block">
                          ({ord.totalOrderedUnits} units)
                        </span>
                      </td>

                      {/* Fulfillment Progress */}
                      <td className="py-3 px-3">
                        <div className="w-36 mx-auto space-y-1">
                          <div className="flex items-center justify-between text-[11px] font-mono">
                            <span className="font-bold text-indigo-600 dark:text-indigo-400">
                              {ord.totalShippedUnits}/{ord.totalOrderedUnits}
                            </span>
                            <span className={ord.totalRemainingUnits > 0 ? "font-bold text-amber-600 dark:text-amber-400" : "text-zinc-400"}>
                              {ord.totalRemainingUnits > 0 ? `${ord.totalRemainingUnits} rem` : "✓ Full"}
                            </span>
                          </div>
                          {/* Mini Progress Bar */}
                          <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                completionPct === 100
                                  ? "bg-emerald-500"
                                  : completionPct > 0
                                  ? "bg-indigo-500"
                                  : "bg-zinc-300 dark:bg-zinc-700"
                              }`}
                              style={{ width: `${Math.min(100, Math.max(0, completionPct))}%` }}
                            />
                          </div>
                          {ord.totalCancelledUnits > 0 && (
                            <span className="text-[10px] text-rose-500 block text-center font-medium">
                              ({ord.totalCancelledUnits} cancelled)
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Unified Status */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {getStatusBadge(ord.orderStatus)}
                      </td>

                      {/* Tracking & Cartons */}
                      <td className="py-3 px-3 text-center">
                        {!ord.hasConfirmedDispatch ? (
                          <span className="text-zinc-400 text-xs italic">— Not Shipped</span>
                        ) : ord.untrackedDispatchesCount > 0 ? (
                          <div className="flex flex-col items-center gap-1">
                            {ord.packages.length > 0 && (
                              <PackagesPopover
                                packages={ord.packages}
                                orderNumber={ord.orderNumber}
                              />
                            )}
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                              ⚠️ {ord.untrackedDispatchesCount} {ord.untrackedDispatchesCount === 1 ? "Dispatch" : "Dispatches"} Missing Track
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                const untracked =
                                  ord.dispatches.find((d) => d.status !== "cancelled" && !d.isTrackingComplete) ||
                                  ord.dispatches[0];
                                if (untracked) {
                                  setTrackingModalState({
                                    fulfillmentId: untracked.id,
                                    fulfillmentNumber: untracked.fulfillmentNumber,
                                    orderNumber: ord.orderNumber,
                                    currentBoxes: untracked.boxes,
                                    currentNotes: untracked.notes,
                                  });
                                }
                              }}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-2xs transition-colors"
                            >
                              + Add Track
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-1">
                            <div className="flex items-center gap-1.5">
                              <PackagesPopover
                                packages={ord.packages}
                                orderNumber={ord.orderNumber}
                              />
                              {ord.dispatches.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const target = ord.dispatches[ord.dispatches.length - 1] || ord.dispatches[0];
                                    setTrackingModalState({
                                      fulfillmentId: target.id,
                                      fulfillmentNumber: target.fulfillmentNumber,
                                      orderNumber: ord.orderNumber,
                                      currentBoxes: target.boxes,
                                      currentNotes: target.notes,
                                    });
                                  }}
                                  className="px-1.5 py-0.5 rounded text-[10px] font-semibold text-zinc-600 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                                  title="Edit Tracking / Boxes"
                                >
                                  ✏️ Edit
                                </button>
                              )}
                            </div>
                            <span className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-400">
                              ✓ All Tracked
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Invoice & Terms */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {ord.invoices && ord.invoices.length > 0 ? (
                          <div className="space-y-0.5">
                            {ord.invoices.map((inv) => (
                              <div key={inv.id} className="flex items-center gap-1">
                                <Link
                                  href={`/admin/finance/invoices/${inv.id}`}
                                  className="font-mono text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1"
                                >
                                  <span>{inv.invoiceNumber}</span>
                                </Link>
                                <span className="text-[9px] font-bold px-1 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 uppercase">
                                  {inv.invoiceStatus}
                                </span>
                              </div>
                            ))}
                            <span className="text-[10px] text-zinc-500 block">
                              {ord.paymentTerms}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-zinc-400 italic">
                            Uninvoiced ({ord.paymentTerms})
                          </span>
                        )}
                      </td>

                      {/* Total Amount */}
                      <td className="py-3 px-3 text-right font-black text-zinc-900 dark:text-white whitespace-nowrap">
                        ${ord.totalAmount.toFixed(2)}
                      </td>

                      {/* Action Button */}
                      <td className="py-3 px-3 text-right">
                        {ord.cancellationRequested ? (
                          <Link
                            href={`/admin/sales/orders/${ord.id}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-600 text-white hover:bg-rose-700 shadow-2xs transition-colors"
                          >
                            Review Hold 🛑
                          </Link>
                        ) : ord.totalRemainingUnits > 0 ? (
                          <Link
                            href={`/admin/sales/orders/${ord.id}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 shadow-2xs transition-colors"
                          >
                            {ord.totalShippedUnits === 0 ? "Process Order ⚡" : `Ship Rem (${ord.totalRemainingUnits}) 📦`}
                          </Link>
                        ) : (
                          <Link
                            href={`/admin/sales/orders/${ord.id}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 transition-colors"
                          >
                            View Details ↗
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border-t border-zinc-200 dark:border-zinc-800 text-xs">
            <div className="flex items-center gap-2 text-zinc-500">
              <span>
                Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong> ({totalCount} total orders)
              </span>
              <span className="text-zinc-300 dark:text-zinc-700">|</span>
              <div className="flex items-center gap-1">
                <span>Per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    const newSize = parseInt(e.target.value, 10);
                    setPageSize(newSize);
                    executeQuery({ pageSize: newSize, page: 1 });
                  }}
                  className="px-2 py-0.5 text-xs rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => executeQuery({ page: 1 })}
                disabled={currentPage <= 1 || isPending}
                className="px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-50 dark:hover:bg-zinc-700"
              >
                « First
              </button>
              <button
                type="button"
                onClick={() => executeQuery({ page: currentPage - 1 })}
                disabled={currentPage <= 1 || isPending}
                className="px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-50 dark:hover:bg-zinc-700"
              >
                ‹ Prev
              </button>
              <span className="px-3 py-1 font-bold text-zinc-900 dark:text-white">
                {currentPage}
              </span>
              <button
                type="button"
                onClick={() => executeQuery({ page: currentPage + 1 })}
                disabled={currentPage >= totalPages || isPending}
                className="px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-50 dark:hover:bg-zinc-700"
              >
                Next ›
              </button>
              <button
                type="button"
                onClick={() => executeQuery({ page: totalPages })}
                disabled={currentPage >= totalPages || isPending}
                className="px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-50 dark:hover:bg-zinc-700"
              >
                Last »
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. In-place Multi-Box Tracking Modal */}
      {trackingModalState && (
        <EditTrackingModal
          isOpen={Boolean(trackingModalState)}
          fulfillmentId={trackingModalState.fulfillmentId}
          fulfillmentNumber={trackingModalState.fulfillmentNumber}
          orderNumber={trackingModalState.orderNumber}
          currentBoxes={trackingModalState.currentBoxes}
          currentNotes={trackingModalState.currentNotes}
          onClose={() => setTrackingModalState(null)}
          onSuccess={() => {
            setTrackingModalState(null);
            executeQuery();
          }}
        />
      )}
    </div>
  );
}
