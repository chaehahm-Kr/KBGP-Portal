"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import type {
  ContentProductItem,
  ContentStatusListFilterOptions,
  ContentOverallStatus,
  CustomerPageStatus,
  TrainingStatus,
  MediaStatus,
  FaqStatus,
  ReviewStatus,
  QrPublishingStatus,
} from "@/lib/product/content-actions";

// Native SVG Icons
function SearchIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}

function FilterIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
    </svg>
  );
}

function ChevronDownIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function ChevronUpIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
    </svg>
  );
}

function CloseIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function ExternalLinkIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
    </svg>
  );
}

function CheckCircleIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function SparklesIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  );
}

function ClockIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function AlertCircleIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function ArrowUpDownIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
    </svg>
  );
}

function RefreshIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}

function LayersIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  );
}

interface ContentStatusListProps {
  initialProducts: ContentProductItem[];
  filterOptions: ContentStatusListFilterOptions;
}

export function ContentStatusList({ initialProducts, filterOptions }: ContentStatusListProps) {
  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [quickFilter, setQuickFilter] = useState<string>("all");
  
  // Primary Filters
  const [selectedBrand, setSelectedBrand] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedOperational, setSelectedOperational] = useState("all");
  const [selectedVisibility, setSelectedVisibility] = useState("all");
  const [selectedOverallStatus, setSelectedOverallStatus] = useState("all");
  const [selectedCustomerPage, setSelectedCustomerPage] = useState("all");

  // More Filters (Collapsible)
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [selectedTraining, setSelectedTraining] = useState("all");
  const [selectedMedia, setSelectedMedia] = useState("all");
  const [selectedFaq, setSelectedFaq] = useState("all");
  const [selectedReview, setSelectedReview] = useState("all");
  const [selectedQr, setSelectedQr] = useState("all");

  // Sorting
  const [sortField, setSortField] = useState<"name" | "brand" | "sku" | "updated">("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const resetAllFilters = () => {
    setSearchTerm("");
    setQuickFilter("all");
    setSelectedBrand("all");
    setSelectedCategory("all");
    setSelectedOperational("all");
    setSelectedVisibility("all");
    setSelectedOverallStatus("all");
    setSelectedCustomerPage("all");
    setSelectedTraining("all");
    setSelectedMedia("all");
    setSelectedFaq("all");
    setSelectedReview("all");
    setSelectedQr("all");
  };

  const hasActiveFilters =
    searchTerm !== "" ||
    quickFilter !== "all" ||
    selectedBrand !== "all" ||
    selectedCategory !== "all" ||
    selectedOperational !== "all" ||
    selectedVisibility !== "all" ||
    selectedOverallStatus !== "all" ||
    selectedCustomerPage !== "all" ||
    selectedTraining !== "all" ||
    selectedMedia !== "all" ||
    selectedFaq !== "all" ||
    selectedReview !== "all" ||
    selectedQr !== "all";

  // Filter products
  const filteredProducts = useMemo(() => {
    return initialProducts.filter((product) => {
      // 1. Integrated Search
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim();
        const matchName = product.name?.toLowerCase().includes(query);
        const matchOrigName = product.original_name?.toLowerCase().includes(query);
        const matchSku = product.letusto_sku?.toLowerCase().includes(query);
        const matchBrand = product.brand_name?.toLowerCase().includes(query);
        const matchUpc = product.upc?.toLowerCase().includes(query);
        if (!matchName && !matchOrigName && !matchSku && !matchBrand && !matchUpc) {
          return false;
        }
      }

      // 2. Quick Filters
      if (quickFilter === "needs_attention") {
        if (product.overall_status !== "needs_attention") return false;
      } else if (quickFilter === "customer_page_missing") {
        if (product.customer_page_status !== "missing" && product.customer_page_status !== "not_started") return false;
      } else if (quickFilter === "training_missing") {
        if (product.training_status !== "missing") return false;
      } else if (quickFilter === "media_missing") {
        if (product.media_status !== "missing") return false;
      } else if (quickFilter === "qr_not_published") {
        if (product.qr_status === "live") return false;
      } else if (quickFilter === "review_pending") {
        if (product.review_status !== "pending") return false;
      }

      // 3. Primary Filters
      if (selectedBrand !== "all" && product.brand_id !== selectedBrand) return false;
      if (selectedCategory !== "all" && (product.category_full_path !== selectedCategory && product.category !== selectedCategory)) {
        return false;
      }
      if (selectedOperational !== "all" && product.operational_status !== selectedOperational) return false;
      if (selectedVisibility !== "all" && product.visibility !== selectedVisibility) return false;
      if (selectedOverallStatus !== "all" && product.overall_status !== selectedOverallStatus) return false;
      if (selectedCustomerPage !== "all" && product.customer_page_status !== selectedCustomerPage) return false;

      // 4. More Filters
      if (selectedTraining !== "all" && product.training_status !== selectedTraining) return false;
      if (selectedMedia !== "all" && product.media_status !== selectedMedia) return false;
      if (selectedFaq !== "all" && product.faq_status !== selectedFaq) return false;
      if (selectedReview !== "all" && product.review_status !== selectedReview) return false;
      if (selectedQr !== "all" && product.qr_status !== selectedQr) return false;

      return true;
    });
  }, [
    initialProducts,
    searchTerm,
    quickFilter,
    selectedBrand,
    selectedCategory,
    selectedOperational,
    selectedVisibility,
    selectedOverallStatus,
    selectedCustomerPage,
    selectedTraining,
    selectedMedia,
    selectedFaq,
    selectedReview,
    selectedQr,
  ]);

  // Sort products
  const sortedProducts = useMemo(() => {
    return [...filteredProducts].sort((a, b) => {
      let comparison = 0;
      if (sortField === "name") {
        comparison = (a.name || "").localeCompare(b.name || "");
      } else if (sortField === "brand") {
        comparison = (a.brand_name || "").localeCompare(b.brand_name || "");
      } else if (sortField === "sku") {
        comparison = (a.letusto_sku || "").localeCompare(b.letusto_sku || "");
      } else if (sortField === "updated") {
        comparison = (a.updated_at || "").localeCompare(b.updated_at || "");
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [filteredProducts, sortField, sortDirection]);

  const handleSort = (field: "name" | "brand" | "sku" | "updated") => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Status Badge Renderers
  const renderOperationalBadge = (status: "active" | "inactive" | "historical") => {
    if (status === "active") {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/60">
          Active
        </span>
      );
    }
    if (status === "inactive") {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-zinc-100 text-zinc-600 border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700">
          Inactive
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-zinc-200 text-zinc-700 border border-zinc-300 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700">
        Historical
      </span>
    );
  };

  const renderVisibilityBadge = (visibility: "visible" | "hidden") => {
    if (visibility === "visible") {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60">
          Visible
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-zinc-100 text-zinc-500 border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700">
        Hidden
      </span>
    );
  };

  const renderOverallStatusBadge = (status: ContentOverallStatus) => {
    switch (status) {
      case "published":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
            <CheckCircleIcon className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            Published
          </span>
        );
      case "ready":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800">
            <SparklesIcon className="w-3 h-3 text-blue-600 dark:text-blue-400" />
            Ready
          </span>
        );
      case "in_progress":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
            <ClockIcon className="w-3 h-3 text-amber-600 dark:text-amber-400" />
            In Progress
          </span>
        );
      case "needs_attention":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800">
            <AlertCircleIcon className="w-3 h-3 text-rose-600 dark:text-rose-400" />
            Needs Attention
          </span>
        );
      case "not_started":
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-zinc-100 text-zinc-600 border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700">
            Not Started
          </span>
        );
    }
  };

  const renderModuleStatusBadge = (
    module: "customer" | "training" | "media" | "faq" | "review" | "qr",
    val: string,
    extra?: number
  ) => {
    if (val === "published" || val === "ready" || val === "complete" || val === "live" || val === "active") {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10.5px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/50">
          {val === "complete" && extra !== undefined ? `Complete (${extra})` : val === "active" ? "Active" : val.charAt(0).toUpperCase() + val.slice(1)}
        </span>
      );
    }
    if (val === "draft" || val === "in_progress" || val === "partial" || val === "pending" || val === "inactive") {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10.5px] font-medium bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800/50">
          {val === "partial" && extra !== undefined ? `Partial (${extra})` : val === "in_progress" ? "In Progress" : val.charAt(0).toUpperCase() + val.slice(1)}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10.5px] font-medium bg-zinc-100 text-zinc-500 border border-zinc-200 dark:bg-zinc-800/60 dark:text-zinc-400 dark:border-zinc-700">
        {val === "not_generated" ? "Not Gen" : val === "not_started" ? "Not Started" : val.charAt(0).toUpperCase() + val.slice(1)}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              Content & Training
            </h1>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              Foundation
            </span>
          </div>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
            상품별 고객 안내 페이지, 교육 자료, 미디어 에셋, FAQ, 리뷰, QR 퍼블리싱 현황을 통합 관리합니다.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            Total <span className="font-semibold text-zinc-900 dark:text-zinc-100">{initialProducts.length}</span> Products
          </div>
        </div>
      </div>

      {/* Quick Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
        {[
          { id: "all", label: "All Products" },
          { id: "needs_attention", label: "Needs Attention" },
          { id: "customer_page_missing", label: "Customer Page Missing" },
          { id: "training_missing", label: "Training Missing" },
          { id: "media_missing", label: "Media Missing" },
          { id: "qr_not_published", label: "QR Not Published" },
          { id: "review_pending", label: "Review Pending" },
        ].map((pill) => {
          const isActive = quickFilter === pill.id;
          return (
            <button
              key={pill.id}
              onClick={() => setQuickFilter(pill.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                isActive
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-sm"
                  : "bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-750"
              }`}
            >
              {pill.label}
            </button>
          );
        })}
      </div>

      {/* Search & Primary Filters */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 shadow-sm space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Integrated Search */}
          <div className="md:col-span-4 relative">
            <SearchIcon className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by Product Name, Letusto SKU, Brand, UPC..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                <CloseIcon className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Brand Filter */}
          <div className="md:col-span-2">
            <select
              value={selectedBrand}
              onChange={(e) => setSelectedBrand(e.target.value)}
              className="w-full py-2 px-2.5 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Brands</option>
              {filterOptions.brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div className="md:col-span-2">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full py-2 px-2.5 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Categories</option>
              {filterOptions.categories.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Overall Status */}
          <div className="md:col-span-2">
            <select
              value={selectedOverallStatus}
              onChange={(e) => setSelectedOverallStatus(e.target.value)}
              className="w-full py-2 px-2.5 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Overall: All</option>
              <option value="published">Published</option>
              <option value="ready">Ready</option>
              <option value="in_progress">In Progress</option>
              <option value="needs_attention">Needs Attention</option>
              <option value="not_started">Not Started</option>
            </select>
          </div>

          {/* More Filters Toggle */}
          <div className="md:col-span-2 flex items-center gap-2">
            <button
              onClick={() => setShowMoreFilters(!showMoreFilters)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-medium rounded-lg border transition-colors ${
                showMoreFilters || (selectedTraining !== "all" || selectedMedia !== "all" || selectedFaq !== "all" || selectedReview !== "all" || selectedQr !== "all")
                  ? "bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-300"
                  : "bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-750"
              }`}
            >
              <FilterIcon className="w-3.5 h-3.5" />
              <span>More Filters</span>
              {showMoreFilters ? (
                <ChevronUpIcon className="w-3.5 h-3.5" />
              ) : (
                <ChevronDownIcon className="w-3.5 h-3.5" />
              )}
            </button>

            {hasActiveFilters && (
              <button
                onClick={resetAllFilters}
                title="Reset all filters"
                className="p-2 text-xs font-medium rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-750"
              >
                <RefreshIcon className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* More Filters Panel */}
        {showMoreFilters && (
          <div className="pt-3 mt-3 border-t border-zinc-100 dark:border-zinc-800 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {/* Operational Status */}
            <div>
              <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">
                Operational Status
              </label>
              <select
                value={selectedOperational}
                onChange={(e) => setSelectedOperational(e.target.value)}
                className="w-full py-1.5 px-2 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
              >
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="historical">Historical</option>
              </select>
            </div>

            {/* Visibility */}
            <div>
              <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">
                Visibility
              </label>
              <select
                value={selectedVisibility}
                onChange={(e) => setSelectedVisibility(e.target.value)}
                className="w-full py-1.5 px-2 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
              >
                <option value="all">All</option>
                <option value="visible">Visible</option>
                <option value="hidden">Hidden</option>
              </select>
            </div>

            {/* Customer Page */}
            <div>
              <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">
                Customer Page
              </label>
              <select
                value={selectedCustomerPage}
                onChange={(e) => setSelectedCustomerPage(e.target.value)}
                className="w-full py-1.5 px-2 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
              >
                <option value="all">All</option>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
                <option value="missing">Missing</option>
                <option value="not_started">Not Started</option>
              </select>
            </div>

            {/* Training Status */}
            <div>
              <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">
                Training Status
              </label>
              <select
                value={selectedTraining}
                onChange={(e) => setSelectedTraining(e.target.value)}
                className="w-full py-1.5 px-2 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
              >
                <option value="all">All</option>
                <option value="ready">Ready</option>
                <option value="in_progress">In Progress</option>
                <option value="missing">Missing</option>
              </select>
            </div>

            {/* Media Status */}
            <div>
              <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">
                Media Status
              </label>
              <select
                value={selectedMedia}
                onChange={(e) => setSelectedMedia(e.target.value)}
                className="w-full py-1.5 px-2 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
              >
                <option value="all">All</option>
                <option value="complete">Complete</option>
                <option value="partial">Partial</option>
                <option value="missing">Missing</option>
              </select>
            </div>

            {/* QR / Publishing */}
            <div>
              <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">
                QR / Publishing
              </label>
              <select
                value={selectedQr}
                onChange={(e) => setSelectedQr(e.target.value)}
                className="w-full py-1.5 px-2 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
              >
                <option value="all">All</option>
                <option value="live">Live</option>
                <option value="inactive">Inactive</option>
                <option value="not_generated">Not Generated</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Results summary bar */}
      <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 px-1">
        <div>
          Showing <span className="font-semibold text-zinc-900 dark:text-zinc-100">{sortedProducts.length}</span> of {initialProducts.length} products
          {hasActiveFilters && " (Filtered)"}
        </div>
      </div>

      {/* Content Status Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-zinc-600 dark:text-zinc-400">
            <thead className="bg-zinc-50 dark:bg-zinc-850/80 text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 border-b border-zinc-200 dark:border-zinc-800 select-none">
              <tr>
                <th
                  onClick={() => handleSort("name")}
                  className="py-3.5 px-4 font-semibold cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors min-w-[240px]"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Product</span>
                    <ArrowUpDownIcon className="w-3 h-3 text-zinc-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("brand")}
                  className="py-3.5 px-3 font-semibold cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors min-w-[110px]"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Brand</span>
                    <ArrowUpDownIcon className="w-3 h-3 text-zinc-400" />
                  </div>
                </th>
                <th className="py-3.5 px-3 font-semibold min-w-[120px]">Category</th>
                <th className="py-3.5 px-2.5 font-semibold text-center min-w-[80px]">Operational</th>
                <th className="py-3.5 px-2.5 font-semibold text-center min-w-[75px]">Visibility</th>
                <th className="py-3.5 px-3 font-semibold text-center min-w-[130px]">Overall Status</th>
                <th className="py-3.5 px-2.5 font-semibold text-center min-w-[95px]">Customer Page</th>
                <th className="py-3.5 px-2.5 font-semibold text-center min-w-[85px]">Training</th>
                <th className="py-3.5 px-2.5 font-semibold text-center min-w-[90px]">Media</th>
                <th className="py-3.5 px-2 font-semibold text-center min-w-[75px]">FAQ</th>
                <th className="py-3.5 px-2 font-semibold text-center min-w-[75px]">Reviews</th>
                <th className="py-3.5 px-2.5 font-semibold text-center min-w-[90px]">Publishing / QR</th>
                <th
                  onClick={() => handleSort("updated")}
                  className="py-3.5 px-3 font-semibold cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors min-w-[95px] text-right"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Last Updated</span>
                    <ArrowUpDownIcon className="w-3 h-3 text-zinc-400" />
                  </div>
                </th>
                <th className="py-3.5 px-4 font-semibold text-right min-w-[100px]">Manage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {sortedProducts.length === 0 ? (
                <tr>
                  <td colSpan={14} className="py-12 text-center text-zinc-500 dark:text-zinc-400">
                    <div className="flex flex-col items-center justify-center">
                      <LayersIcon className="w-8 h-8 text-zinc-300 dark:text-zinc-600 mb-2" />
                      <p className="text-sm font-medium">No products match your filters</p>
                      <p className="text-xs text-zinc-400 mt-1">Try adjusting your search criteria or resetting filters</p>
                      {hasActiveFilters && (
                        <button
                          onClick={resetAllFilters}
                          className="mt-3 px-3 py-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          Reset all filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                sortedProducts.map((p) => (
                  <tr
                    key={p.id}
                    className="hover:bg-zinc-50/80 dark:hover:bg-zinc-850/50 transition-colors group"
                  >
                    {/* Product */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-850 overflow-hidden shrink-0 relative flex items-center justify-center">
                          {p.photoUrl ? (
                            <img
                              src={p.photoUrl}
                              alt={p.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-[10px] font-semibold text-zinc-400">No Pic</span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/admin/products/content/${p.id}`}
                            className="font-semibold text-zinc-900 dark:text-zinc-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors line-clamp-1 text-xs"
                            title={p.name}
                          >
                            {p.name}
                          </Link>
                          <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono mt-0.5">
                            SKU: {p.letusto_sku || "-"}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Brand */}
                    <td className="py-3 px-3 font-medium text-zinc-800 dark:text-zinc-200">
                      <div className="truncate max-w-[120px]" title={p.brand_name}>
                        {p.brand_name}
                      </div>
                    </td>

                    {/* Category */}
                    <td className="py-3 px-3 text-zinc-600 dark:text-zinc-400">
                      <div className="truncate max-w-[140px] text-[11px]" title={p.category_full_path || p.category}>
                        {p.category_full_path || p.category}
                      </div>
                    </td>

                    {/* Operational */}
                    <td className="py-3 px-2.5 text-center">
                      {renderOperationalBadge(p.operational_status)}
                    </td>

                    {/* Visibility */}
                    <td className="py-3 px-2.5 text-center">
                      {renderVisibilityBadge(p.visibility)}
                    </td>

                    {/* Overall Status */}
                    <td className="py-3 px-3 text-center">
                      {renderOverallStatusBadge(p.overall_status)}
                    </td>

                    {/* Customer Page */}
                    <td className="py-3 px-2.5 text-center">
                      {renderModuleStatusBadge("customer", p.customer_page_status)}
                    </td>

                    {/* Training */}
                    <td className="py-3 px-2.5 text-center">
                      {renderModuleStatusBadge("training", p.training_status)}
                    </td>

                    {/* Media */}
                    <td className="py-3 px-2.5 text-center">
                      {renderModuleStatusBadge("media", p.media_status, p.image_count)}
                    </td>

                    {/* FAQ */}
                    <td className="py-3 px-2 text-center">
                      {renderModuleStatusBadge("faq", p.faq_status)}
                    </td>

                    {/* Reviews */}
                    <td className="py-3 px-2 text-center">
                      {renderModuleStatusBadge("review", p.review_status)}
                    </td>

                    {/* Publishing / QR */}
                    <td className="py-3 px-2.5 text-center">
                      {renderModuleStatusBadge("qr", p.qr_status)}
                    </td>

                    {/* Last Updated */}
                    <td className="py-3 px-3 text-right font-mono text-[11px] text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                      {p.last_updated}
                    </td>

                    {/* Manage */}
                    <td className="py-3 px-4 text-right">
                      <Link
                        href={`/admin/products/content/${p.id}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/50 border border-transparent hover:border-blue-200 dark:hover:border-blue-800 transition-colors"
                      >
                        <span>Manage</span>
                        <ExternalLinkIcon className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
