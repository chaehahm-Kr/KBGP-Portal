"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import type {
  AdminStoreOperationItem,
  AdminStoreOperationsData,
  AdminStoreInventoryItem,
  AdminStoreInventoryOverview,
  AdminStoreOrderItem,
  AdminStoreOrdersOverview,
} from "@/lib/retailer/admin-store-operations";

interface StoreOperationsViewProps {
  data: AdminStoreOperationsData;
}

type DetailTabKey =
  | "overview"
  | "inventory"
  | "orders"
  | "sales"
  | "training"
  | "fixtures"
  | "activities";

interface TabDefinition {
  key: DetailTabKey;
  label: string;
  badge?: string;
  phaseLabel: string;
}

const DETAIL_TABS: TabDefinition[] = [
  { key: "overview", label: "Overview", phaseLabel: "Phase 1 (Active)" },
  { key: "inventory", label: "Inventory & Reorder", phaseLabel: "Phase 2 (Active)" },
  { key: "orders", label: "Orders & Deliveries", phaseLabel: "Phase 2 (Active)" },
  { key: "sales", label: "Sales & Performance", badge: "Phase 4", phaseLabel: "Phase 4 (Planned)" },
  { key: "training", label: "Staff & Training", badge: "Phase 5", phaseLabel: "Phase 5 (Planned)" },
  { key: "fixtures", label: "Fixtures & Placements", badge: "Future", phaseLabel: "Future Phase (Planned)" },
  { key: "activities", label: "Store Activities", badge: "Future", phaseLabel: "Future Phase (Planned)" },
];

function formatOrderCurrency(amount: number): string {
  return `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatOrderDate(dateStr?: string | null): string {
  if (!dateStr) return "N/A";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function formatOrderDateTime(dateStr?: string | null): string {
  if (!dateStr) return "N/A";
  try {
    const d = new Date(dateStr);
    return `${d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })} ${d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`;
  } catch {
    return dateStr;
  }
}

function getOrderStatusBadgeClasses(status: string): string {
  const s = status.toLowerCase();
  switch (s) {
    case "submitted":
      return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-300";
    case "confirmed":
      return "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:border-purple-800 dark:text-purple-300";
    case "processing":
      return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300";
    case "partially_shipped":
      return "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:border-orange-800 dark:text-orange-300";
    case "shipped":
      return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300";
    case "delivered":
      return "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:border-teal-800 dark:text-teal-300";
    case "cancelled":
    case "partially_cancelled":
      return "bg-zinc-100 text-zinc-500 border-zinc-300 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400";
    default:
      return "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300";
  }
}

function formatOrderStatusName(status: string): string {
  const s = status.toLowerCase();
  switch (s) {
    case "submitted":
      return "Submitted";
    case "confirmed":
      return "Confirmed";
    case "processing":
      return "Processing";
    case "partially_shipped":
      return "Partially Shipped";
    case "shipped":
      return "Shipped";
    case "delivered":
      return "Delivered";
    case "cancelled":
      return "Cancelled";
    case "partially_cancelled":
      return "Partially Cancelled";
    default:
      return status.charAt(0).toUpperCase() + status.slice(1);
  }
}

export function StoreOperationsView({ data }: StoreOperationsViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Search and Filter States
  const [searchTerm, setSearchTerm] = useState("");
  const [retailerFilter, setRetailerFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Selected Store ID from URL or local state
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(() => searchParams?.get("storeId") || null);
  const activeTabParam = (searchParams?.get("tab") as DetailTabKey) || "overview";
  const [activeTab, setActiveTab] = useState<DetailTabKey>(activeTabParam);

  useEffect(() => {
    setSelectedStoreId(searchParams?.get("storeId") || null);
  }, [searchParams]);

  useEffect(() => {
    if (activeTabParam && DETAIL_TABS.some((t) => t.key === activeTabParam)) {
      setActiveTab(activeTabParam);
    }
  }, [activeTabParam]);

  const selectedStore = useMemo(() => {
    if (!selectedStoreId) return null;
    return data.stores.find((s) => s.id === selectedStoreId) || null;
  }, [selectedStoreId, data.stores]);

  const handleSelectStore = (storeId: string) => {
    setSelectedStoreId(storeId);
    setActiveTab("overview");
    const params = new URLSearchParams(searchParams?.toString() || "");
    params.set("storeId", storeId);
    params.set("tab", "overview");
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleBackToList = () => {
    setSelectedStoreId(null);
    router.push(pathname);
  };

  const handleTabChange = (tabKey: DetailTabKey) => {
    setActiveTab(tabKey);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tabKey);
    router.push(`${pathname}?${params.toString()}`);
  };

  // Inventory Tab Search, Filter and Sort States
  const [inventorySearch, setInventorySearch] = useState("");
  const [inventoryFilter, setInventoryFilter] = useState<"ALL" | "REPORTED" | "NOT_REPORTED" | "REORDER_ATTENTION">("ALL");
  const [inventorySort, setInventorySort] = useState<"REORDER_FIRST" | "STOCK_DESC" | "STOCK_ASC" | "NAME_ASC" | "NAME_DESC" | "DATE_DESC">("REORDER_FIRST");

  const storeInventory = useMemo<AdminStoreInventoryOverview | null>(() => {
    if (!selectedStoreId || !data.storeInventoryMap) return null;
    return data.storeInventoryMap[selectedStoreId] || null;
  }, [selectedStoreId, data.storeInventoryMap]);

  const filteredInventoryItems = useMemo<AdminStoreInventoryItem[]>(() => {
    if (!storeInventory?.items) return [];
    let items = [...storeInventory.items];

    // Search filter
    if (inventorySearch.trim()) {
      const q = inventorySearch.toLowerCase().trim();
      items = items.filter(
        (it) =>
          it.productName.toLowerCase().includes(q) ||
          it.brandName.toLowerCase().includes(q) ||
          it.sku.toLowerCase().includes(q) ||
          it.category.toLowerCase().includes(q)
      );
    }

    // Status filter
    if (inventoryFilter === "REPORTED") {
      items = items.filter((it) => it.reportedRemaining !== null);
    } else if (inventoryFilter === "NOT_REPORTED") {
      items = items.filter((it) => it.reportedRemaining === null);
    } else if (inventoryFilter === "REORDER_ATTENTION") {
      items = items.filter((it) => it.reorderNeeded);
    }

    // Sort
    items.sort((a, b) => {
      switch (inventorySort) {
        case "REORDER_FIRST": {
          if (a.reorderNeeded !== b.reorderNeeded) {
            return a.reorderNeeded ? -1 : 1;
          }
          if (b.suggestedReorderQty !== a.suggestedReorderQty) {
            return b.suggestedReorderQty - a.suggestedReorderQty;
          }
          return a.productName.localeCompare(b.productName);
        }
        case "STOCK_DESC": {
          const valA = a.reportedRemaining ?? -1;
          const valB = b.reportedRemaining ?? -1;
          return valB - valA;
        }
        case "STOCK_ASC": {
          const valA = a.reportedRemaining ?? 999999;
          const valB = b.reportedRemaining ?? 999999;
          return valA - valB;
        }
        case "NAME_ASC":
          return a.productName.localeCompare(b.productName);
        case "NAME_DESC":
          return b.productName.localeCompare(a.productName);
        case "DATE_DESC": {
          const dateA = a.reportingDate || "";
          const dateB = b.reportingDate || "";
          return dateB.localeCompare(dateA);
        }
        default:
          return 0;
      }
    });

    return items;
  }, [storeInventory, inventorySearch, inventoryFilter, inventorySort]);

  // Orders Tab Search, Filter and Sort States
  const [orderSearch, setOrderSearch] = useState("");
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>("ALL");
  const [orderSort, setOrderSort] = useState<"DATE_DESC" | "DATE_ASC" | "AMOUNT_DESC" | "AMOUNT_ASC" | "UNITS_DESC">("DATE_DESC");
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  const storeOrders = useMemo<AdminStoreOrdersOverview | null>(() => {
    if (!selectedStoreId || !data.storeOrdersMap) return null;
    return data.storeOrdersMap[selectedStoreId] || null;
  }, [selectedStoreId, data.storeOrdersMap]);

  const filteredStoreOrders = useMemo<AdminStoreOrderItem[]>(() => {
    if (!storeOrders?.orders) return [];
    let orders = [...storeOrders.orders];

    // Search filter
    if (orderSearch.trim()) {
      const q = orderSearch.toLowerCase().trim();
      orders = orders.filter((o) => {
        const matchNumber = o.orderNumber.toLowerCase().includes(q);
        const matchTracking = o.fulfillments.some((f) =>
          (f.trackingNumber && f.trackingNumber.toLowerCase().includes(q)) ||
          (f.carrier && f.carrier.toLowerCase().includes(q)) ||
          f.boxes.some((b) => b.trackingNumber && b.trackingNumber.toLowerCase().includes(q))
        );
        const matchItem = o.items.some((it) =>
          it.productName.toLowerCase().includes(q) ||
          it.sku.toLowerCase().includes(q) ||
          (it.brandName && it.brandName.toLowerCase().includes(q))
        );
        return matchNumber || matchTracking || matchItem;
      });
    }

    // Status filter
    if (orderStatusFilter !== "ALL") {
      orders = orders.filter((o) => o.orderStatus.toLowerCase() === orderStatusFilter.toLowerCase());
    }

    // Sort
    orders.sort((a, b) => {
      switch (orderSort) {
        case "DATE_DESC":
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case "DATE_ASC":
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case "AMOUNT_DESC":
          return b.totalAmount - a.totalAmount;
        case "AMOUNT_ASC":
          return a.totalAmount - b.totalAmount;
        case "UNITS_DESC":
          return b.totalOrderedUnits - a.totalOrderedUnits;
        default:
          return 0;
      }
    });

    return orders;
  }, [storeOrders, orderSearch, orderStatusFilter, orderSort]);

  // Filtered stores for list
  const filteredStores = useMemo(() => {
    return data.stores.filter((store) => {
      // 1. Search Query
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const matchName = store.name.toLowerCase().includes(q);
        const matchRetailer = store.companyName.toLowerCase().includes(q);
        const matchCode = store.storeCode?.toLowerCase().includes(q) || false;
        const matchCity = store.city?.toLowerCase().includes(q) || false;
        const matchState = store.state?.toLowerCase().includes(q) || false;
        if (!matchName && !matchRetailer && !matchCode && !matchCity && !matchState) {
          return false;
        }
      }

      // 2. Retailer Filter
      if (retailerFilter !== "ALL" && store.companyId !== retailerFilter) {
        return false;
      }

      // 3. Status Filter
      if (statusFilter !== "ALL" && store.status.toLowerCase() !== statusFilter.toLowerCase()) {
        return false;
      }

      return true;
    });
  }, [data.stores, searchTerm, retailerFilter, statusFilter]);

  const isFilterActive = searchTerm.trim() !== "" || retailerFilter !== "ALL" || statusFilter !== "ALL";

  const handleClearFilters = () => {
    setSearchTerm("");
    setRetailerFilter("ALL");
    setStatusFilter("ALL");
  };

  return (
    <div className="space-y-6 w-full" data-testid="store-operations-container">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-zinc-950 dark:text-white" data-testid="page-title">
              Store Operations
            </h1>
            <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-2.5 py-0.5 text-[10px] font-bold text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
              {data.totalStoresCount} Stores
            </span>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1" data-testid="page-subtitle">
            Store Network & Operations Overview
          </p>
        </div>

        {/* Global Action / Link to Retailers */}
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/admin/retailers"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-750 text-xs font-semibold transition-all shadow-xs"
          >
            <span>Retailer 360° Management ↗</span>
          </Link>
        </div>
      </div>

      {/* KPI Stats Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-zinc-200 bg-white p-3.5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            Total Stores
          </span>
          <p className="text-lg font-bold text-zinc-900 dark:text-white mt-0.5">
            {data.totalStoresCount}
          </p>
          <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
            Authoritative physical stores
          </span>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-3.5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            Active Stores
          </span>
          <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
            {data.activeStoresCount}
          </p>
          <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
            Ready for dispatch & orders
          </span>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-3.5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            Operating Retailers
          </span>
          <p className="text-lg font-bold text-zinc-900 dark:text-white mt-0.5">
            {data.totalRetailersCount}
          </p>
          <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
            Distinct partner companies
          </span>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-3.5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            Operations Foundation
          </span>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
            <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
              Phase 1 Active
            </span>
          </div>
          <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
            Read-only consolidated overview
          </span>
        </div>
      </div>

      {/* DETAIL VIEW (When a store is selected) */}
      {selectedStore ? (
        <div className="space-y-6" data-testid="store-detail-view">
          {/* Detail View Breadcrumbs & Back Link */}
          <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800/80">
            <button
              type="button"
              onClick={handleBackToList}
              data-testid="back-to-store-list-btn"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 transition-colors cursor-pointer"
            >
              <span>←</span>
              <span>Back to Store List</span>
            </button>

            <Link
              href={`/admin/retailers/${selectedStore.companyId}?tab=stores`}
              data-testid="open-retailer-360-btn"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors"
            >
              <span>Manage in Retailer 360°</span>
              <span>↗</span>
            </Link>
          </div>

          {/* Compact Store Header */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900" data-testid="store-detail-header">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-bold text-zinc-950 dark:text-white" data-testid="detail-store-name">
                    {selectedStore.name}
                  </h2>
                  {selectedStore.storeCode && (
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700" data-testid="detail-store-code">
                      {selectedStore.storeCode}
                    </span>
                  )}
                  <span
                    data-testid="detail-store-status"
                    className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold border ${
                      selectedStore.status === "active"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800/40 dark:text-emerald-300"
                        : "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400"
                    }`}
                  >
                    {selectedStore.status.toUpperCase()}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                  <span>Parent Retailer:</span>
                  <Link
                    href={`/admin/retailers/${selectedStore.companyId}`}
                    data-testid="detail-parent-retailer-link"
                    className="font-semibold text-zinc-900 dark:text-zinc-100 hover:text-emerald-600 dark:hover:text-emerald-400 hover:underline"
                  >
                    {selectedStore.companyName}
                  </Link>
                  {selectedStore.companyCode && (
                    <span className="font-mono text-[10px] text-zinc-400 dark:text-zinc-500">
                      ({selectedStore.companyCode})
                    </span>
                  )}
                  <span className="text-zinc-300 dark:text-zinc-700">•</span>
                  <span>Store Type: {selectedStore.type}</span>
                </div>
              </div>

              {/* Quick ID Badge */}
              <div className="text-left md:text-right text-[10px] text-zinc-400 font-mono">
                <div>Store ID: {selectedStore.id}</div>
                <div>Company ID: {selectedStore.companyId}</div>
              </div>
            </div>
          </div>

          {/* 7 Section Navigation Tabs */}
          <div className="border-b border-zinc-200 dark:border-zinc-800">
            <nav className="flex space-x-2 overflow-x-auto scrollbar-thin pb-px" data-testid="store-detail-tabs">
              {DETAIL_TABS.map((tab) => {
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => handleTabChange(tab.key)}
                    data-testid={`tab-${tab.key}`}
                    className={`whitespace-nowrap px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-all border-b-2 cursor-pointer ${
                      isActive
                        ? "border-zinc-900 text-zinc-900 dark:border-white dark:text-white bg-zinc-50/50 dark:bg-zinc-850/40"
                        : "border-transparent text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-900"
                    }`}
                  >
                    <span>{tab.label}</span>
                    {tab.badge && (
                      <span className="ml-1.5 px-1.5 py-0.2 rounded text-[9px] font-normal bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                        {tab.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* TAB 1: OVERVIEW (Active Read-Only Content) */}
          {activeTab === "overview" && (
            <div className="space-y-6" data-testid="tab-content-overview">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Store Location & Address */}
                <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
                  <div className="border-b border-zinc-100 dark:border-zinc-800 pb-2">
                    <h3 className="text-xs font-bold text-zinc-950 dark:text-white uppercase tracking-wider">
                      Location & Shipping Address
                    </h3>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div>
                      <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase block">
                        Street Address
                      </span>
                      <p className="font-semibold text-zinc-900 dark:text-white mt-0.5">
                        {selectedStore.address || "Not Available"}
                      </p>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase block">
                          City
                        </span>
                        <p className="font-semibold text-zinc-900 dark:text-white mt-0.5">
                          {selectedStore.city || "Not Available"}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase block">
                          State
                        </span>
                        <p className="font-semibold text-zinc-900 dark:text-white mt-0.5">
                          {selectedStore.state || "Not Available"}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase block">
                          ZIP Code
                        </span>
                        <p className="font-semibold text-zinc-900 dark:text-white mt-0.5 font-mono">
                          {selectedStore.zip || "Not Available"}
                        </p>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 text-[11px] text-zinc-400">
                      ℹ️ Destination store for order delivery and physical stock intake.
                    </div>
                  </div>
                </div>

                {/* Store Management & Contact Info */}
                <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
                  <div className="border-b border-zinc-100 dark:border-zinc-800 pb-2">
                    <h3 className="text-xs font-bold text-zinc-950 dark:text-white uppercase tracking-wider">
                      Management & Contact Information
                    </h3>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div>
                      <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase block">
                        Store Phone
                      </span>
                      <p className="font-semibold text-zinc-900 dark:text-white mt-0.5 font-mono">
                        {selectedStore.phone || "Not Available"}
                      </p>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase block">
                        Store Email
                      </span>
                      <p className="font-semibold text-zinc-900 dark:text-white mt-0.5 font-mono">
                        {selectedStore.email || "Not Available"}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase block">
                          Store Manager Name
                        </span>
                        <p className="font-semibold text-zinc-900 dark:text-white mt-0.5">
                          {selectedStore.managerName || "Not Available"}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase block">
                          Manager Phone
                        </span>
                        <p className="font-semibold text-zinc-900 dark:text-white mt-0.5 font-mono">
                          {selectedStore.managerPhone || "Not Available"}
                        </p>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 text-[11px] text-zinc-400">
                      ℹ️ Managed and maintained by Retailer Organization owners.
                    </div>
                  </div>
                </div>
              </div>

              {/* Operational Record Linkages Summary */}
              <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
                <div className="border-b border-zinc-100 dark:border-zinc-800 pb-2">
                  <h3 className="text-xs font-bold text-zinc-950 dark:text-white uppercase tracking-wider">
                    Authoritative Operational Linkages
                  </h3>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                  <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase block">Orders Placed</span>
                    <p className="text-base font-bold text-zinc-900 dark:text-white mt-0.5">
                      {selectedStore.ordersCount} Orders
                    </p>
                    <span className="text-[10px] text-zinc-400">Linked to this store</span>
                  </div>

                  <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase block">Weekly Stock Checks</span>
                    <p className="text-base font-bold text-zinc-900 dark:text-white mt-0.5">
                      {selectedStore.weeklyChecksCount} Records
                    </p>
                    <span className="text-[10px] text-zinc-400">
                      {selectedStore.latestWeeklyCheckStatus
                        ? `Latest: ${selectedStore.latestWeeklyCheckStatus}`
                        : "No check recorded"}
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase block">Assigned Staff</span>
                    <p className="text-base font-bold text-zinc-900 dark:text-white mt-0.5">
                      {selectedStore.assignedUsersCount} Members
                    </p>
                    <span className="text-[10px] text-zinc-400">Authorized store users</span>
                  </div>

                  <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase block">Registration Date</span>
                    <p className="text-base font-bold text-zinc-900 dark:text-white mt-0.5 font-mono text-[11px]">
                      {new Date(selectedStore.createdAt).toLocaleDateString()}
                    </p>
                    <span className="text-[10px] text-zinc-400">Store record creation</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: INVENTORY & REORDER (Active Phase 2 Integration) */}
          {activeTab === "inventory" && (
            <div className="space-y-6" data-testid="tab-content-inventory">
              {/* If no inventory data or 0 products found */}
              {!storeInventory || storeInventory.items.length === 0 ? (
                <div
                  className="rounded-xl border border-zinc-200 bg-white p-8 text-center shadow-xs dark:border-zinc-800 dark:bg-zinc-900 space-y-4"
                  data-testid="inventory-empty-state"
                >
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 text-xl">
                    📦
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-zinc-950 dark:text-white" data-testid="inventory-empty-state-title">
                      No Weekly Stock Submissions Recorded
                    </h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
                      No weekly physical inventory counts have been submitted for {selectedStore.name} yet. Counts and automated replenishment recommendations will populate here automatically once physical stock checks are submitted by store staff.
                    </p>
                  </div>
                  <div className="pt-2">
                    <Link
                      href={`/admin/retailers/${selectedStore.companyId}?tab=performance`}
                      data-testid="inventory-empty-retailer-360-link"
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-100 dark:text-zinc-900 text-xs font-semibold transition-all shadow-xs"
                    >
                      <span>Manage Company Inventory in Retailer 360° ↗</span>
                    </Link>
                  </div>
                </div>
              ) : (
                <>
                  {/* 4 KPI Summary Cards */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {/* KPI 1: Latest Submission Date */}
                    <div
                      className="rounded-xl border border-zinc-200 bg-white p-4 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 space-y-1"
                      data-testid="kpi-latest-submission"
                    >
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 block">
                        Latest Submission
                      </span>
                      <p className="text-lg font-bold text-zinc-900 dark:text-white font-mono">
                        {storeInventory.latestSubmissionDate || "No Submission"}
                      </p>
                      <span className="text-[10px] text-zinc-400 dark:text-zinc-500 block">
                        {storeInventory.latestReportingWeek
                          ? `Week: ${storeInventory.latestReportingWeek}`
                          : "Pending weekly count"}
                      </span>
                    </div>

                    {/* KPI 2: Submission Status */}
                    <div
                      className="rounded-xl border border-zinc-200 bg-white p-4 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 space-y-1"
                      data-testid="kpi-submission-status"
                    >
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 block">
                        Submission Status
                      </span>
                      <div className="pt-0.5">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded text-xs font-bold border ${
                            storeInventory.submissionStatus === "submitted"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300"
                              : storeInventory.submissionStatus === "in_progress"
                              ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300"
                              : "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400"
                          }`}
                        >
                          {storeInventory.submissionStatusLabel}
                        </span>
                      </div>
                      <span className="text-[10px] text-zinc-400 dark:text-zinc-500 block">
                        Authoritative store status
                      </span>
                    </div>

                    {/* KPI 3: Reported Stock Coverage */}
                    <div
                      className="rounded-xl border border-zinc-200 bg-white p-4 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 space-y-1"
                      data-testid="kpi-stock-coverage"
                    >
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 block">
                        Stock Count Coverage
                      </span>
                      <p className="text-lg font-bold text-zinc-900 dark:text-white">
                        {storeInventory.productsWithReportedStockCount} / {storeInventory.totalAssortedProductsCount}
                        <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400 ml-1.5">
                          (
                          {storeInventory.totalAssortedProductsCount > 0
                            ? Math.round(
                                (storeInventory.productsWithReportedStockCount /
                                  storeInventory.totalAssortedProductsCount) *
                                  100
                              )
                            : 0}
                          %)
                        </span>
                      </p>
                      <span className="text-[10px] text-zinc-400 dark:text-zinc-500 block">
                        Assorted products counted
                      </span>
                    </div>

                    {/* KPI 4: Reorder Attention */}
                    <div
                      className="rounded-xl border border-zinc-200 bg-white p-4 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 space-y-1"
                      data-testid="kpi-reorder-attention"
                    >
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 block">
                        Reorder Attention
                      </span>
                      <p
                        className={`text-lg font-bold ${
                          storeInventory.reorderAttentionCount > 0
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-emerald-600 dark:text-emerald-400"
                        }`}
                      >
                        {storeInventory.reorderAttentionCount} Products
                      </p>
                      <span className="text-[10px] text-zinc-400 dark:text-zinc-500 block">
                        {storeInventory.reorderAttentionCount > 0
                          ? "Replenishment recommended"
                          : "Stock levels sufficient"}
                      </span>
                    </div>
                  </div>

                  {/* Search, Filter & Sort Controls */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-zinc-50 dark:bg-zinc-900/60 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800">
                    {/* Search Input */}
                    <div className="relative flex-1 min-w-[200px]">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-zinc-400 text-xs">
                        🔍
                      </span>
                      <input
                        type="text"
                        value={inventorySearch}
                        onChange={(e) => setInventorySearch(e.target.value)}
                        placeholder="Search product name, brand, SKU, category..."
                        data-testid="inventory-search-input"
                        className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400"
                      />
                      {inventorySearch && (
                        <button
                          type="button"
                          onClick={() => setInventorySearch("")}
                          className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-zinc-400 hover:text-zinc-600 text-xs cursor-pointer"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                      {/* Filter Select */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-semibold text-zinc-500 uppercase">Filter:</span>
                        <select
                          value={inventoryFilter}
                          onChange={(e) => setInventoryFilter(e.target.value as any)}
                          data-testid="inventory-filter-select"
                          className="px-2.5 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none cursor-pointer"
                        >
                          <option value="ALL">All Products ({storeInventory.items.length})</option>
                          <option value="REPORTED">Stock Reported ({storeInventory.productsWithReportedStockCount})</option>
                          <option value="NOT_REPORTED">
                            Not Reported ({storeInventory.totalAssortedProductsCount - storeInventory.productsWithReportedStockCount})
                          </option>
                          <option value="REORDER_ATTENTION">Reorder Attention ({storeInventory.reorderAttentionCount})</option>
                        </select>
                      </div>

                      {/* Sort Select */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-semibold text-zinc-500 uppercase">Sort:</span>
                        <select
                          value={inventorySort}
                          onChange={(e) => setInventorySort(e.target.value as any)}
                          data-testid="inventory-sort-select"
                          className="px-2.5 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none cursor-pointer"
                        >
                          <option value="REORDER_FIRST">Reorder Attention First</option>
                          <option value="STOCK_DESC">Reported Stock: High → Low</option>
                          <option value="STOCK_ASC">Reported Stock: Low → High</option>
                          <option value="NAME_ASC">Product Name (A → Z)</option>
                          <option value="NAME_DESC">Product Name (Z → A)</option>
                          <option value="DATE_DESC">Reporting Date (Newest)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Product Inventory Table */}
                  <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
                    <div className="overflow-x-auto scrollbar-thin">
                      <table className="w-full text-left text-xs" data-testid="inventory-table">
                        <thead className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/75 dark:bg-zinc-800/40 text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                          <tr>
                            <th className="py-3 px-3 min-w-[220px]">Product & Brand</th>
                            <th className="py-3 px-3 min-w-[120px]">SKU & Category</th>
                            <th className="py-3 px-3 text-right">Pack & MOQ</th>
                            <th className="py-3 px-3 text-right min-w-[130px]">Reported Stock</th>
                            <th className="py-3 px-3 text-right">Est. Sold</th>
                            <th className="py-3 px-3 min-w-[110px]">Reporting Date</th>
                            <th className="py-3 px-3 min-w-[170px]">Reorder Suggestion</th>
                            <th className="py-3 px-3 text-center min-w-[110px]">Status</th>
                            <th className="py-3 px-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                          {filteredInventoryItems.length === 0 ? (
                            <tr>
                              <td colSpan={9} className="py-8 text-center text-xs text-zinc-500">
                                No products match your current search and filter settings.
                                <div className="mt-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setInventorySearch("");
                                      setInventoryFilter("ALL");
                                    }}
                                    className="text-xs text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 font-semibold cursor-pointer"
                                  >
                                    Reset Filters
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ) : (
                            filteredInventoryItems.map((item) => (
                              <tr
                                key={item.productId}
                                data-testid={`inventory-table-row-${item.productId}`}
                                className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20 transition-colors"
                              >
                                {/* Product & Brand */}
                                <td className="py-2.5 px-3">
                                  <div className="flex items-center gap-2.5">
                                    {item.thumbnailUrl ? (
                                      <img
                                        src={item.thumbnailUrl}
                                        alt={item.productName}
                                        className="w-9 h-9 rounded-lg object-cover border border-zinc-200 dark:border-zinc-700 shrink-0 bg-white"
                                      />
                                    ) : (
                                      <div className="w-9 h-9 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0 text-zinc-400 text-[10px]">
                                        📦
                                      </div>
                                    )}
                                    <div className="min-w-0">
                                      <span
                                        className="font-semibold text-zinc-900 dark:text-white block truncate max-w-[200px]"
                                        title={item.productName}
                                      >
                                        {item.productName}
                                      </span>
                                      <span className="text-[10px] text-zinc-400 block truncate">
                                        {item.brandName}
                                      </span>
                                    </div>
                                  </div>
                                </td>

                                {/* SKU & Category */}
                                <td className="py-2.5 px-3">
                                  <span className="font-mono text-[11px] font-semibold text-zinc-800 dark:text-zinc-200 block">
                                    {item.sku}
                                  </span>
                                  <span className="text-[10px] text-zinc-400 block">
                                    {item.category}
                                  </span>
                                </td>

                                {/* Pack & MOQ */}
                                <td className="py-2.5 px-3 text-right">
                                  <span className="font-mono text-xs text-zinc-800 dark:text-zinc-200 block">
                                    {item.cartonPackQty} pcs/cs
                                  </span>
                                  <span className="text-[10px] text-zinc-400 block">
                                    MOQ: {item.moq} pcs
                                  </span>
                                </td>

                                {/* Reported Stock */}
                                <td className="py-2.5 px-3 text-right" data-testid={`stock-cell-${item.productId}`}>
                                  {item.reportedRemaining !== null ? (
                                    item.reportedRemaining === 0 ? (
                                      <div>
                                        <span className="font-mono font-bold text-rose-600 dark:text-rose-400 block">
                                          0 units
                                        </span>
                                        <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                                          Zero Stock
                                        </span>
                                      </div>
                                    ) : (
                                      <div>
                                        <span className="font-mono font-bold text-zinc-900 dark:text-white block">
                                          {item.reportedRemaining} units
                                        </span>
                                        <span className="text-[10px] text-zinc-400 block font-mono">
                                          {Math.floor(item.reportedRemaining / item.cartonPackQty)} cs
                                          {item.reportedRemaining % item.cartonPackQty > 0
                                            ? ` + ${item.reportedRemaining % item.cartonPackQty} ea`
                                            : ""}
                                        </span>
                                      </div>
                                    )
                                  ) : (
                                    <div>
                                      <span className="italic text-zinc-400 font-medium block">
                                        Not Reported
                                      </span>
                                      <span className="text-[9px] text-zinc-400 block">
                                        No count in check
                                      </span>
                                    </div>
                                  )}
                                </td>

                                {/* Estimated Sold */}
                                <td className="py-2.5 px-3 text-right font-mono">
                                  {item.estimatedSold !== null ? (
                                    <span className="text-zinc-900 dark:text-white font-semibold">
                                      {item.estimatedSold}
                                    </span>
                                  ) : (
                                    <span className="text-zinc-400 italic text-[11px]">
                                      Not Available
                                    </span>
                                  )}
                                </td>

                                {/* Reporting Date & Week */}
                                <td className="py-2.5 px-3">
                                  {item.reportingDate ? (
                                    <div>
                                      <span className="font-mono text-xs text-zinc-800 dark:text-zinc-200 block">
                                        {item.reportingDate}
                                      </span>
                                      {item.reportingWeek && (
                                        <span className="text-[10px] text-zinc-400 block font-mono">
                                          {item.reportingWeek}
                                        </span>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="italic text-zinc-400 text-xs">
                                      Not Reported
                                    </span>
                                  )}
                                </td>

                                {/* Reorder Suggestion */}
                                <td className="py-2.5 px-3">
                                  {item.reorderNeeded ? (
                                    <div>
                                      <div className="flex items-center gap-1 font-mono font-bold text-amber-600 dark:text-amber-400">
                                        <span>{item.suggestedReorderQty} units</span>
                                        <span className="text-[10px] font-normal">
                                          ({item.suggestedCases} {item.suggestedCases === 1 ? "cs" : "cases"})
                                        </span>
                                      </div>
                                      <span className="text-[10px] text-amber-700 dark:text-amber-300 block line-clamp-1" title={item.reorderReason}>
                                        {item.reorderReason}
                                      </span>
                                    </div>
                                  ) : item.reportedRemaining !== null ? (
                                    <div>
                                      <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium block">
                                        Sufficient Stock
                                      </span>
                                      <span className="text-[10px] text-zinc-400 block">
                                        No reorder needed
                                      </span>
                                    </div>
                                  ) : (
                                    <div>
                                      <span className="text-xs text-zinc-400 italic block">
                                        Needs Physical Count
                                      </span>
                                      <span className="text-[10px] text-zinc-400 block">
                                        Pending count submission
                                      </span>
                                    </div>
                                  )}
                                </td>

                                {/* Status Badge */}
                                <td className="py-2.5 px-3 text-center">
                                  <span
                                    data-testid={`stock-badge-${item.productId}`}
                                    className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border whitespace-nowrap ${
                                      item.dataStatus === "zero_stock"
                                        ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-300"
                                        : item.dataStatus === "reorder_attention"
                                        ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:border-amber-900 dark:text-amber-300"
                                        : item.dataStatus === "reported"
                                        ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300"
                                        : "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400"
                                    }`}
                                  >
                                    {item.dataStatus === "zero_stock"
                                      ? "Zero Stock"
                                      : item.dataStatus === "reorder_attention"
                                      ? "Reorder Needed"
                                      : item.dataStatus === "reported"
                                      ? "In Stock"
                                      : "Not Reported"}
                                  </span>
                                </td>

                                {/* Action */}
                                <td className="py-2.5 px-3 text-right">
                                  <Link
                                    href={`/admin/retailers/${selectedStore.companyId}?tab=performance`}
                                    data-testid={`reorder-link-${item.productId}`}
                                    className="text-xs font-semibold text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors"
                                  >
                                    360° ↗
                                  </Link>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Authoritative Attribution & Policy Footer Banner */}
                  <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-zinc-500 dark:text-zinc-400">
                    <div className="space-y-0.5">
                      <p className="font-semibold text-zinc-700 dark:text-zinc-300">
                        Authoritative Data Origin & Replenishment Rules
                      </p>
                      <p className="text-[11px] leading-relaxed">
                        Physical counts originate from submitted store weekly inventory checks. Carton pack sizing and minimum order quantities are synchronized with authoritative Brand Master specifications. Reorder quantities enforce whole carton multiples.
                      </p>
                    </div>
                    <Link
                      href={`/admin/retailers/${selectedStore.companyId}?tab=performance`}
                      data-testid="inventory-retailer-360-link"
                      className="shrink-0 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-750 text-xs font-semibold transition-all shadow-xs"
                    >
                      <span>Retailer 360° Management ↗</span>
                    </Link>
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB 3: ORDERS & DELIVERIES (Active Phase 2 Integration) */}
          {activeTab === "orders" && (
            <div className="space-y-6" data-testid="tab-content-orders">
              {/* If no orders data or 0 orders found for this store */}
              {!storeOrders || storeOrders.orders.length === 0 ? (
                <div
                  className="rounded-xl border border-zinc-200 bg-white p-8 text-center shadow-xs dark:border-zinc-800 dark:bg-zinc-900 space-y-4"
                  data-testid="orders-empty-state"
                >
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 text-xl">
                    🚚
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-zinc-950 dark:text-white" data-testid="orders-empty-state-title">
                      No Orders Recorded for This Store
                    </h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
                      No wholesale or replenishment orders have been routed to {selectedStore.name} yet. When an order is placed with this store as the shipping destination, it will be displayed here automatically.
                    </p>
                  </div>
                  <div className="pt-2">
                    <Link
                      href={`/admin/retailers/${selectedStore.companyId}?tab=orders`}
                      data-testid="orders-empty-retailer-360-link"
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-100 dark:text-zinc-900 text-xs font-semibold transition-all shadow-xs"
                    >
                      <span>View Company Orders in Retailer 360° ↗</span>
                    </Link>
                  </div>
                </div>
              ) : (
                <>
                  {/* 4 Summary KPI Cards */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {/* KPI 1: Total Orders */}
                    <div
                      className="rounded-xl border border-zinc-200 bg-white p-4 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 space-y-1"
                      data-testid="kpi-orders-total"
                    >
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 block">
                        Total Orders
                      </span>
                      <p className="text-lg font-bold text-zinc-900 dark:text-white font-mono">
                        {storeOrders.totalOrdersCount}
                      </p>
                      <span className="text-[10px] text-zinc-400 dark:text-zinc-500 block">
                        Store destination orders
                      </span>
                    </div>

                    {/* KPI 2: Open / In Progress Orders */}
                    <div
                      className="rounded-xl border border-zinc-200 bg-white p-4 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 space-y-1"
                      data-testid="kpi-orders-open"
                    >
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 block">
                        Open / In Progress
                      </span>
                      <p
                        className={`text-lg font-bold font-mono ${
                          storeOrders.openOrdersCount > 0
                            ? "text-blue-600 dark:text-blue-400"
                            : "text-zinc-900 dark:text-white"
                        }`}
                      >
                        {storeOrders.openOrdersCount}
                      </p>
                      <span className="text-[10px] text-zinc-400 dark:text-zinc-500 block">
                        Submitted, confirmed, or processing
                      </span>
                    </div>

                    {/* KPI 3: Shipped / Dispatched Orders */}
                    <div
                      className="rounded-xl border border-zinc-200 bg-white p-4 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 space-y-1"
                      data-testid="kpi-orders-shipped"
                    >
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 block">
                        Shipped / Dispatched
                      </span>
                      <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                        {storeOrders.shippedOrdersCount}
                      </p>
                      <span className="text-[10px] text-zinc-400 dark:text-zinc-500 block">
                        Fulfillments dispatched or delivered
                      </span>
                    </div>

                    {/* KPI 4: Orders With Remaining Units */}
                    <div
                      className="rounded-xl border border-zinc-200 bg-white p-4 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 space-y-1"
                      data-testid="kpi-orders-remaining"
                    >
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 block">
                        Remaining Unshipped
                      </span>
                      <p
                        className={`text-lg font-bold font-mono ${
                          storeOrders.ordersWithRemainingUnitsCount > 0
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-zinc-900 dark:text-white"
                        }`}
                      >
                        {storeOrders.ordersWithRemainingUnitsCount} Orders
                      </p>
                      <span className="text-[10px] text-zinc-400 dark:text-zinc-500 block">
                        {storeOrders.ordersWithRemainingUnitsCount > 0
                          ? "Orders with pending quantity"
                          : "All ordered units fulfilled"}
                      </span>
                    </div>
                  </div>

                  {/* Search, Filter & Sort Controls */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-zinc-50 dark:bg-zinc-900/60 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800">
                    {/* Search Input */}
                    <div className="relative flex-1 min-w-[200px]">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-zinc-400 text-xs">
                        🔍
                      </span>
                      <input
                        type="text"
                        value={orderSearch}
                        onChange={(e) => setOrderSearch(e.target.value)}
                        placeholder="Search order #, carrier tracking, product, SKU..."
                        data-testid="orders-search-input"
                        className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400"
                      />
                      {orderSearch && (
                        <button
                          type="button"
                          onClick={() => setOrderSearch("")}
                          className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-zinc-400 hover:text-zinc-600 text-xs cursor-pointer"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                      {/* Filter Select */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-semibold text-zinc-500 uppercase">Status:</span>
                        <select
                          value={orderStatusFilter}
                          onChange={(e) => setOrderStatusFilter(e.target.value)}
                          data-testid="orders-filter-select"
                          className="px-2.5 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none cursor-pointer"
                        >
                          <option value="ALL">All Statuses ({storeOrders.orders.length})</option>
                          <option value="submitted">Submitted</option>
                          <option value="confirmed">Confirmed</option>
                          <option value="processing">Processing</option>
                          <option value="partially_shipped">Partially Shipped</option>
                          <option value="shipped">Shipped</option>
                          <option value="delivered">Delivered</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </div>

                      {/* Sort Select */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-semibold text-zinc-500 uppercase">Sort:</span>
                        <select
                          value={orderSort}
                          onChange={(e) => setOrderSort(e.target.value as any)}
                          data-testid="orders-sort-select"
                          className="px-2.5 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none cursor-pointer"
                        >
                          <option value="DATE_DESC">Order Date (Newest First)</option>
                          <option value="DATE_ASC">Order Date (Oldest First)</option>
                          <option value="AMOUNT_DESC">Total Amount (High → Low)</option>
                          <option value="AMOUNT_ASC">Total Amount (Low → High)</option>
                          <option value="UNITS_DESC">Ordered Units (High → Low)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Orders Table */}
                  <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
                    <div className="overflow-x-auto scrollbar-thin">
                      <table className="w-full text-left text-xs" data-testid="orders-table">
                        <thead className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/75 dark:bg-zinc-800/40 text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                          <tr>
                            <th className="py-3 px-3 min-w-[170px]">Order Number & Date</th>
                            <th className="py-3 px-3 min-w-[120px]">Order Status</th>
                            <th className="py-3 px-3 min-w-[160px]">Items & Units</th>
                            <th className="py-3 px-3 text-right min-w-[110px]">Total Amount</th>
                            <th className="py-3 px-3 min-w-[170px]">Fulfillment / Dispatch</th>
                            <th className="py-3 px-3 min-w-[180px]">Tracking & Cartons</th>
                            <th className="py-3 px-3 text-right min-w-[130px]">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                          {filteredStoreOrders.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="py-8 text-center text-xs text-zinc-500">
                                No orders match your current search and filter settings.
                                <div className="mt-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOrderSearch("");
                                      setOrderStatusFilter("ALL");
                                    }}
                                    className="text-xs text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 font-semibold cursor-pointer"
                                  >
                                    Reset Filters
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ) : (
                            filteredStoreOrders.map((order) => {
                              const isExpanded = expandedOrderId === order.id;
                              return (
                                <React.Fragment key={order.id}>
                                  <tr
                                    data-testid={`orders-table-row-${order.id}`}
                                    className={`hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20 transition-colors ${
                                      isExpanded ? "bg-zinc-50/40 dark:bg-zinc-800/30" : ""
                                    }`}
                                  >
                                    {/* Order Number & Date */}
                                    <td className="py-2.5 px-3">
                                      <div className="font-mono font-bold text-zinc-900 dark:text-white">
                                        {order.orderNumber}
                                      </div>
                                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                                        {formatOrderDateTime(order.createdAt)}
                                      </div>
                                      <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                                        {order.paymentTerms && (
                                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                                            {order.paymentTerms}
                                          </span>
                                        )}
                                        <span className="text-[10px] font-medium text-zinc-400 capitalize">
                                          {order.paymentStatus}
                                        </span>
                                      </div>
                                    </td>

                                    {/* Order Status */}
                                    <td className="py-2.5 px-3">
                                      <span
                                        className={`inline-block px-2.5 py-0.5 rounded text-xs font-bold border ${getOrderStatusBadgeClasses(
                                          order.orderStatus
                                        )}`}
                                        data-testid={`order-status-${order.id}`}
                                      >
                                        {formatOrderStatusName(order.orderStatus)}
                                      </span>
                                    </td>

                                    {/* Items & Units */}
                                    <td className="py-2.5 px-3">
                                      <div className="font-semibold text-zinc-900 dark:text-white">
                                        {order.totalItemsCount} {order.totalItemsCount === 1 ? "line item" : "line items"} · {order.totalOrderedUnits} units
                                      </div>
                                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                                        {order.totalShippedUnits > 0 ? (
                                          <span>{order.totalShippedUnits} shipped</span>
                                        ) : order.orderStatus.toLowerCase() === "cancelled" ? (
                                          <span className="text-zinc-400">Cancelled</span>
                                        ) : (
                                          <span className="text-zinc-400">0 shipped</span>
                                        )}
                                        {order.totalRemainingUnits > 0 && order.orderStatus.toLowerCase() !== "cancelled" && (
                                          <span className="text-amber-600 dark:text-amber-400 font-semibold ml-1.5">
                                            ({order.totalRemainingUnits} remaining)
                                          </span>
                                        )}
                                      </div>
                                    </td>

                                    {/* Total Amount */}
                                    <td className="py-2.5 px-3 text-right">
                                      <div className="font-mono font-bold text-zinc-900 dark:text-white">
                                        {formatOrderCurrency(order.totalAmount)}
                                      </div>
                                      <div className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5">
                                        Subtotal: {formatOrderCurrency(order.subtotalAmount)}
                                      </div>
                                    </td>

                                    {/* Fulfillment / Dispatch */}
                                    <td className="py-2.5 px-3">
                                      {order.fulfillments.length === 0 ? (
                                        <div className="text-zinc-400 dark:text-zinc-500 italic text-[11px]">
                                          No Dispatches Yet
                                        </div>
                                      ) : (
                                        <div className="space-y-1">
                                          <div className="font-semibold text-zinc-900 dark:text-white text-[11px]">
                                            {order.fulfillments.length}{" "}
                                            {order.fulfillments.length === 1 ? "Dispatch" : "Dispatches"}
                                            {order.totalBoxCount > 0 && ` (${order.totalBoxCount} Cartons)`}
                                          </div>
                                          <div className="flex items-center gap-1.5 flex-wrap">
                                            {order.fulfillments.map((f) => (
                                              <span
                                                key={f.id}
                                                className={`px-1.5 py-0.2 rounded text-[10px] font-bold border ${
                                                  f.status.toLowerCase() === "delivered"
                                                    ? "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800"
                                                    : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                                                }`}
                                              >
                                                {f.status.toLowerCase() === "delivered" ? "Delivered" : "Shipped"}
                                              </span>
                                            ))}
                                            {order.fulfillments[0]?.shippedAt && (
                                              <span className="text-[10px] text-zinc-400">
                                                {formatOrderDate(order.fulfillments[0].shippedAt)}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      )}
                                    </td>

                                    {/* Tracking & Cartons */}
                                    <td className="py-2.5 px-3">
                                      {order.fulfillments.length === 0 ? (
                                        <span className="text-zinc-400 text-[11px]">—</span>
                                      ) : (
                                        <div className="space-y-1">
                                          {order.fulfillments.map((f) => (
                                            <div key={f.id} className="text-[11px]">
                                              {f.trackingUrl ? (
                                                <a
                                                  href={f.trackingUrl}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="font-mono text-emerald-600 dark:text-emerald-400 hover:underline font-semibold flex items-center gap-1"
                                                >
                                                  {f.carrier ? `${f.carrier}: ` : ""}
                                                  {f.trackingNumber || "Track"} ↗
                                                </a>
                                              ) : f.trackingNumber ? (
                                                <span className="font-mono text-zinc-700 dark:text-zinc-300">
                                                  {f.carrier ? `${f.carrier}: ` : ""}
                                                  {f.trackingNumber}
                                                </span>
                                              ) : (
                                                <span className="text-zinc-400 italic">No tracking #</span>
                                              )}
                                              {f.boxes.length > 1 && (
                                                <div className="text-[10px] text-zinc-400">
                                                  {f.boxes.length} carton tracking numbers
                                                </div>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </td>

                                    {/* Actions */}
                                    <td className="py-2.5 px-3 text-right">
                                      <div className="flex items-center justify-end gap-1.5">
                                        <button
                                          type="button"
                                          onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                                          data-testid={`order-toggle-${order.id}`}
                                          className="px-2 py-1 rounded border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-[11px] font-medium text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
                                        >
                                          {isExpanded ? "Hide ▲" : "Details ▼"}
                                        </button>
                                        <Link
                                          href={`/admin/sales/orders/${order.id}`}
                                          data-testid={`order-process-link-${order.id}`}
                                          className="px-2.5 py-1 rounded bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-900 text-[11px] font-bold transition-all shadow-xs shrink-0 flex items-center gap-1"
                                        >
                                          <span>Process ↗</span>
                                        </Link>
                                      </div>
                                    </td>
                                  </tr>

                                  {/* Expanded Drawer */}
                                  {isExpanded && (
                                    <tr
                                      className="bg-zinc-50/70 dark:bg-zinc-950/40 border-b border-zinc-200 dark:border-zinc-800"
                                      data-testid={`order-expanded-${order.id}`}
                                    >
                                      <td colSpan={7} className="p-4 space-y-4">
                                        {/* Deliveries / Dispatches Section */}
                                        <div className="space-y-2">
                                          <h4 className="text-[11px] font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
                                            Confirmed Dispatches & Packaging ({order.fulfillments.length})
                                          </h4>
                                          {order.fulfillments.length === 0 ? (
                                            <div className="text-xs text-zinc-400 italic bg-white dark:bg-zinc-900 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800">
                                              No fulfillment packages have been dispatched for this order yet.
                                            </div>
                                          ) : (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                              {order.fulfillments.map((f) => (
                                                <div
                                                  key={f.id}
                                                  className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-2"
                                                >
                                                  <div className="flex items-center justify-between gap-2">
                                                    <div className="font-mono font-bold text-xs text-zinc-900 dark:text-white">
                                                      {f.fulfillmentNumber}
                                                    </div>
                                                    <span
                                                      className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                                        f.status.toLowerCase() === "delivered"
                                                          ? "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800"
                                                          : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                                                      }`}
                                                    >
                                                      {f.status.toLowerCase() === "delivered"
                                                        ? "Delivered"
                                                        : "Shipped"}
                                                    </span>
                                                  </div>
                                                  <div className="text-xs text-zinc-600 dark:text-zinc-300 space-y-0.5">
                                                    <div>
                                                      <span className="text-zinc-400">Carrier:</span>{" "}
                                                      <span className="font-medium">{f.carrier || "Standard"}</span>
                                                    </div>
                                                    {f.shippedAt && (
                                                      <div>
                                                        <span className="text-zinc-400">Shipped:</span>{" "}
                                                        <span>{formatOrderDateTime(f.shippedAt)}</span>
                                                      </div>
                                                    )}
                                                    {f.deliveredAt && (
                                                      <div>
                                                        <span className="text-zinc-400">Delivered:</span>{" "}
                                                        <span className="text-teal-600 dark:text-teal-400 font-medium">
                                                          {formatOrderDateTime(f.deliveredAt)}
                                                        </span>
                                                      </div>
                                                    )}
                                                    {f.trackingNumber && (
                                                      <div>
                                                        <span className="text-zinc-400">Master Tracking:</span>{" "}
                                                        {f.trackingUrl ? (
                                                          <a
                                                            href={f.trackingUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="font-mono text-emerald-600 dark:text-emerald-400 hover:underline font-semibold"
                                                          >
                                                            {f.trackingNumber} ↗
                                                          </a>
                                                        ) : (
                                                          <span className="font-mono">{f.trackingNumber}</span>
                                                        )}
                                                      </div>
                                                    )}
                                                    {f.notes && (
                                                      <div className="text-[11px] text-zinc-500 italic mt-1">
                                                        Notes: {f.notes}
                                                      </div>
                                                    )}
                                                  </div>

                                                  {/* Carton Boxes */}
                                                  {f.boxes && f.boxes.length > 0 && (
                                                    <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 space-y-1">
                                                      <div className="text-[10px] font-bold text-zinc-400 uppercase">
                                                        Carton Boxes ({f.boxes.length}):
                                                      </div>
                                                      <div className="space-y-1">
                                                        {f.boxes.map((b) => (
                                                          <div
                                                            key={b.id}
                                                            className="flex items-center justify-between text-xs py-0.5 px-1.5 rounded bg-zinc-50 dark:bg-zinc-800/60"
                                                          >
                                                            <span className="font-medium text-zinc-700 dark:text-zinc-300">
                                                              Carton #{b.boxNumber} of {b.boxTotal}
                                                            </span>
                                                            {b.trackingUrl ? (
                                                              <a
                                                                href={b.trackingUrl}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="font-mono text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline"
                                                              >
                                                                {b.trackingNumber || "Track"} ↗
                                                              </a>
                                                            ) : (
                                                              <span className="font-mono text-[11px] text-zinc-500">
                                                                {b.trackingNumber || "No tracking"}
                                                              </span>
                                                            )}
                                                          </div>
                                                        ))}
                                                      </div>
                                                    </div>
                                                  )}
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                        </div>

                                        {/* Order Items Table */}
                                        <div className="space-y-2">
                                          <h4 className="text-[11px] font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
                                            Ordered Products & Quantities ({order.items.length})
                                          </h4>
                                          <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden bg-white dark:bg-zinc-900">
                                            <table className="w-full text-left text-xs">
                                              <thead className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/75 dark:bg-zinc-800/40 text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                                                <tr>
                                                  <th className="py-2 px-3">Product Name & Brand</th>
                                                  <th className="py-2 px-3">SKU</th>
                                                  <th className="py-2 px-3 text-right">Ordered</th>
                                                  <th className="py-2 px-3 text-right">Shipped</th>
                                                  <th className="py-2 px-3 text-right">Cancelled</th>
                                                  <th className="py-2 px-3 text-right">Remaining</th>
                                                  <th className="py-2 px-3 text-right">Unit Price</th>
                                                  <th className="py-2 px-3 text-right">Line Total</th>
                                                </tr>
                                              </thead>
                                              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                                                {order.items.length === 0 ? (
                                                  <tr>
                                                    <td colSpan={8} className="py-4 text-center text-zinc-400 italic">
                                                      No line item details found.
                                                    </td>
                                                  </tr>
                                                ) : (
                                                  order.items.map((item) => (
                                                    <tr
                                                      key={item.id}
                                                      className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20"
                                                    >
                                                      <td className="py-2 px-3">
                                                        <div className="font-semibold text-zinc-900 dark:text-white">
                                                          {item.productName}
                                                        </div>
                                                        {item.brandName && (
                                                          <div className="text-[10px] text-zinc-400">
                                                            {item.brandName}
                                                          </div>
                                                        )}
                                                      </td>
                                                      <td className="py-2 px-3 font-mono text-[11px] text-zinc-500">
                                                        {item.sku}
                                                      </td>
                                                      <td className="py-2 px-3 text-right font-medium">
                                                        {item.quantity}
                                                      </td>
                                                      <td className="py-2 px-3 text-right font-medium text-emerald-600 dark:text-emerald-400">
                                                        {item.quantityShipped}
                                                      </td>
                                                      <td className="py-2 px-3 text-right font-medium text-zinc-400">
                                                        {item.quantityCancelled}
                                                      </td>
                                                      <td className="py-2 px-3 text-right font-medium">
                                                        {item.quantityRemaining > 0 ? (
                                                          <span className="text-amber-600 dark:text-amber-400 font-bold">
                                                            {item.quantityRemaining}
                                                          </span>
                                                        ) : (
                                                          <span className="text-zinc-400">0</span>
                                                        )}
                                                      </td>
                                                      <td className="py-2 px-3 text-right font-mono text-zinc-600 dark:text-zinc-300">
                                                        {formatOrderCurrency(item.unitWholesalePrice)}
                                                      </td>
                                                      <td className="py-2 px-3 text-right font-mono font-bold text-zinc-900 dark:text-white">
                                                        {formatOrderCurrency(item.lineTotal)}
                                                      </td>
                                                    </tr>
                                                  ))
                                                )}
                                              </tbody>
                                            </table>
                                          </div>
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </React.Fragment>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Authoritative Attribution & Policy Footer Banner */}
                  <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-zinc-500 dark:text-zinc-400">
                    <div className="space-y-0.5">
                      <p className="font-semibold text-zinc-700 dark:text-zinc-300">
                        Authoritative Sales Order Ledger & Carrier Fulfillment
                      </p>
                      <p className="text-[11px] leading-relaxed">
                        Store orders are authoritatively tracked and processed within the Sales Orders module. Fulfillments, multi-carton tracking numbers, and delivery verifications are synchronized with carrier dispatches.
                      </p>
                    </div>
                    <Link
                      href={`/admin/retailers/${selectedStore.companyId}?tab=orders`}
                      data-testid="orders-retailer-360-link"
                      className="shrink-0 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-750 text-xs font-semibold transition-all shadow-xs"
                    >
                      <span>Retailer 360° Orders ↗</span>
                    </Link>
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB 4: SALES & PERFORMANCE */}
          {activeTab === "sales" && (
            <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 space-y-4" data-testid="tab-content-sales">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:border-amber-900 dark:text-amber-300">
                  Phase 4 Planned
                </span>
                <h3 className="text-sm font-bold text-zinc-950 dark:text-white">
                  Store Sell-Through Analytics & Movement
                </h3>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed max-w-2xl">
                Store-level estimated movement, weeks of supply, and sales velocity metrics will be exposed in Phase 4. Estimated sales are derived authoritatively from weekly physical inventory count continuity.
              </p>
              <div className="pt-2">
                <Link
                  href={`/admin/retailers/${selectedStore.companyId}?tab=performance`}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-100 dark:text-zinc-900 text-xs font-bold transition-all shadow-xs"
                >
                  <span>View Authoritative Performance in Retailer 360° ↗</span>
                </Link>
              </div>
            </div>
          )}

          {/* TAB 5: STAFF & TRAINING */}
          {activeTab === "training" && (
            <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 space-y-4" data-testid="tab-content-training">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:border-amber-900 dark:text-amber-300">
                  Phase 5 Planned
                </span>
                <h3 className="text-sm font-bold text-zinc-950 dark:text-white">
                  Store Staff & Training Coverage Matrix
                </h3>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed max-w-2xl">
                Individual employee verified quiz results and official Store Training Coverage (requiring at least 1 verified passing employee per eligible carried product) are currently computed in Retailer 360°.
              </p>
              <div className="pt-2">
                <Link
                  href={`/admin/retailers/${selectedStore.companyId}?tab=training`}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-100 dark:text-zinc-900 text-xs font-bold transition-all shadow-xs"
                >
                  <span>View Authoritative Training Coverage in Retailer 360° ↗</span>
                </Link>
              </div>
            </div>
          )}

          {/* TAB 6: FIXTURES & PLACEMENTS */}
          {activeTab === "fixtures" && (
            <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 space-y-4" data-testid="tab-content-fixtures">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-100 text-zinc-700 border border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300">
                  Future Phase Planned
                </span>
                <h3 className="text-sm font-bold text-zinc-950 dark:text-white">
                  Physical Fixtures & Planogram Placements
                </h3>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed max-w-2xl">
                Installed shelf fixtures, slot positions, display planograms, and fixture maintenance photos will be recorded here when physical fixture tracking is enabled. The legacy Placements tab contained placeholder demo records and has been retired in favor of authoritative operational records.
              </p>
              <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-150 dark:border-zinc-800 text-[11px] text-zinc-500 max-w-xl">
                📌 <strong>Status:</strong> No fixture registration or placement records currently exist in the database.
              </div>
            </div>
          )}

          {/* TAB 7: STORE ACTIVITIES */}
          {activeTab === "activities" && (
            <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 space-y-4" data-testid="tab-content-activities">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-100 text-zinc-700 border border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300">
                  Future Phase Planned
                </span>
                <h3 className="text-sm font-bold text-zinc-950 dark:text-white">
                  Store Field Visits & On-Site Activities
                </h3>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed max-w-2xl">
                Field representative store inspections, photo logs, and assigned operational tasks will be tracked here in future phases. Retailer support tickets linked to this store can be viewed under Retailer 360°.
              </p>
              <div className="pt-2">
                <Link
                  href={`/admin/retailers/${selectedStore.companyId}?tab=support`}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-100 dark:text-zinc-900 text-xs font-bold transition-all shadow-xs"
                >
                  <span>View Store Support Inquiries in Retailer 360° ↗</span>
                </Link>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* STORE LIST VIEW (Default) */
        <div className="space-y-4" data-testid="store-list-view">
          {/* Search & Filter Toolbar */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-3 rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex flex-1 items-center gap-2 min-w-0">
              <div className="relative flex-1">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-zinc-400">
                  🔍
                </span>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by store name, code, retailer, city, state..."
                  data-testid="store-search-input"
                  className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-white transition-all"
                />
              </div>

              {/* Retailer Filter */}
              <select
                value={retailerFilter}
                onChange={(e) => setRetailerFilter(e.target.value)}
                data-testid="retailer-filter-select"
                className="px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs text-zinc-800 dark:text-zinc-200 outline-none cursor-pointer"
              >
                <option value="ALL">All Retailers</option>
                {data.retailers.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} {r.companyCode ? `(${r.companyCode})` : ""}
                  </option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                data-testid="status-filter-select"
                className="px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs text-zinc-800 dark:text-zinc-200 outline-none cursor-pointer"
              >
                <option value="ALL">All Statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="closed">Closed</option>
              </select>
            </div>

            {isFilterActive && (
              <button
                type="button"
                onClick={handleClearFilters}
                data-testid="clear-filters-btn"
                className="px-2.5 py-1.5 text-xs text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white underline cursor-pointer shrink-0"
              >
                Clear Filters
              </button>
            )}
          </div>

          {/* Stores Table */}
          <div className="rounded-xl border border-zinc-200 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs" data-testid="stores-table">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50/50 text-[10px] font-bold text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50 uppercase tracking-wider">
                    <th className="px-4 py-3">Store Name & Code</th>
                    <th className="px-4 py-3">Parent Retailer</th>
                    <th className="px-4 py-3">Location</th>
                    <th className="px-4 py-3">Contact & Manager</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/60">
                  {filteredStores.length > 0 ? (
                    filteredStores.map((store) => (
                      <tr
                        key={store.id}
                        data-testid={`store-row-${store.id}`}
                        className="hover:bg-zinc-50/50 dark:hover:bg-zinc-850/20 transition-colors"
                      >
                        {/* 1. Store Name & Code */}
                        <td className="px-4 py-3">
                          <div className="flex flex-col">
                            <span className="font-bold text-zinc-900 dark:text-white text-xs">
                              {store.name}
                            </span>
                            {store.storeCode ? (
                              <span className="font-mono text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                                {store.storeCode}
                              </span>
                            ) : (
                              <span className="text-[9px] text-zinc-400 italic mt-0.5">
                                No Store Code
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 2. Parent Retailer */}
                        <td className="px-4 py-3">
                          <div className="flex flex-col">
                            <Link
                              href={`/admin/retailers/${store.companyId}`}
                              className="font-semibold text-zinc-900 dark:text-white hover:text-emerald-600 dark:hover:text-emerald-400 hover:underline"
                            >
                              {store.companyName}
                            </Link>
                            {store.companyCode && (
                              <span className="font-mono text-[9px] text-zinc-400">
                                {store.companyCode}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 3. Location */}
                        <td className="px-4 py-3 text-zinc-650 dark:text-zinc-350">
                          {store.city || store.state ? (
                            <div>
                              <span>{[store.city, store.state].filter(Boolean).join(", ")}</span>
                              {store.zip && <span className="text-zinc-400 font-mono text-[10px] ml-1">({store.zip})</span>}
                            </div>
                          ) : (
                            <span className="text-zinc-400 italic">Location Not Set</span>
                          )}
                        </td>

                        {/* 4. Contact & Manager */}
                        <td className="px-4 py-3 text-zinc-650 dark:text-zinc-350">
                          <div>
                            {store.managerName ? (
                              <span className="font-medium text-zinc-900 dark:text-white">
                                {store.managerName}
                              </span>
                            ) : (
                              <span className="text-zinc-400 italic">No Manager</span>
                            )}
                            {store.phone && (
                              <p className="text-[10px] text-zinc-400 font-mono mt-0.5">
                                📞 {store.phone}
                              </p>
                            )}
                          </div>
                        </td>

                        {/* 5. Status */}
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-block rounded px-2 py-0.5 text-[9px] font-bold border ${
                              store.status === "active"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800/40 dark:text-emerald-300"
                                : "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400"
                            }`}
                          >
                            {store.status.toUpperCase()}
                          </span>
                        </td>

                        {/* 6. Actions */}
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleSelectStore(store.id)}
                            data-testid={`view-store-btn-${store.id}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-100 dark:text-zinc-900 text-[11px] font-bold transition-all shadow-xs cursor-pointer"
                          >
                            <span>View Details</span>
                            <span>→</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-zinc-400 text-xs italic">
                        {isFilterActive
                          ? "No stores match the selected search and filter criteria."
                          : "No authorized store records found in the database."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Footer */}
            <div className="flex items-center justify-between px-4 py-2.5 border-t border-zinc-150 dark:border-zinc-800 text-[11px] text-zinc-500 bg-zinc-50/50 dark:bg-zinc-900/50">
              <span>
                Showing {filteredStores.length} of {data.totalStoresCount} stores
              </span>
              <span>Authoritative Source: public.stores</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
