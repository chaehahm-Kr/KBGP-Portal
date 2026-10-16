"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import type { AdminStoreOperationItem, AdminStoreOperationsData } from "@/lib/retailer/admin-store-operations";

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
  { key: "inventory", label: "Inventory & Reorder", badge: "Phase 2", phaseLabel: "Phase 2 (Planned)" },
  { key: "orders", label: "Orders & Deliveries", badge: "Phase 3", phaseLabel: "Phase 3 (Planned)" },
  { key: "sales", label: "Sales & Performance", badge: "Phase 4", phaseLabel: "Phase 4 (Planned)" },
  { key: "training", label: "Staff & Training", badge: "Phase 5", phaseLabel: "Phase 5 (Planned)" },
  { key: "fixtures", label: "Fixtures & Placements", badge: "Future", phaseLabel: "Future Phase (Planned)" },
  { key: "activities", label: "Store Activities", badge: "Future", phaseLabel: "Future Phase (Planned)" },
];

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

          {/* TAB 2: INVENTORY & REORDER */}
          {activeTab === "inventory" && (
            <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 space-y-4" data-testid="tab-content-inventory">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:border-amber-900 dark:text-amber-300">
                  Phase 2 Planned
                </span>
                <h3 className="text-sm font-bold text-zinc-950 dark:text-white">
                  Store-Specific Physical Inventory & Reorder Recommendations
                </h3>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed max-w-2xl">
                Store-level periodic physical count submission, weekly count continuity, and automatic replenishment carton sizing will be unified into this workspace in Phase 2. Currently, company-wide and per-store inventory history is managed authoritatively under Retailer 360°.
              </p>
              <div className="pt-2">
                <Link
                  href={`/admin/retailers/${selectedStore.companyId}?tab=performance`}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-100 dark:text-zinc-900 text-xs font-bold transition-all shadow-xs"
                >
                  <span>View Authoritative Inventory in Retailer 360° ↗</span>
                </Link>
              </div>
            </div>
          )}

          {/* TAB 3: ORDERS & DELIVERIES */}
          {activeTab === "orders" && (
            <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 space-y-4" data-testid="tab-content-orders">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:border-amber-900 dark:text-amber-300">
                  Phase 3 Planned
                </span>
                <h3 className="text-sm font-bold text-zinc-950 dark:text-white">
                  Store Destination Orders & Dispatch Tracking
                </h3>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed max-w-2xl">
                Direct store order routing, carrier package box tracking, and proof-of-delivery receipts will be consolidated in Phase 3. Orders placed for this store are authoritatively recorded in the orders ledger.
              </p>
              <div className="pt-2">
                <Link
                  href={`/admin/retailers/${selectedStore.companyId}?tab=orders`}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-100 dark:text-zinc-900 text-xs font-bold transition-all shadow-xs"
                >
                  <span>View Authoritative Orders in Retailer 360° ↗</span>
                </Link>
              </div>
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
