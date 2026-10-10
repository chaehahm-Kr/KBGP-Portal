"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
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

function ZoomInIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
    </svg>
  );
}

interface ContentStatusListProps {
  initialProducts: ContentProductItem[];
  filterOptions: ContentStatusListFilterOptions;
}

export function ContentStatusList({ initialProducts, filterOptions }: ContentStatusListProps) {
  // 1. Filter States
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedOverallStatus, setSelectedOverallStatus] = useState<string>("all");
  const [issueQuickFilter, setIssueQuickFilter] = useState<string>("all");
  
  // Brand Multi-Select State
  const [selectedBrandIds, setSelectedBrandIds] = useState<string[]>([]);
  const [isBrandDropdownOpen, setIsBrandDropdownOpen] = useState(false);
  const [brandSearchTerm, setBrandSearchTerm] = useState("");
  const brandDropdownRef = useRef<HTMLDivElement>(null);

  // Category Filter State
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // More Filters Collapsible State
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [selectedOperational, setSelectedOperational] = useState<string>("all");
  const [selectedVisibility, setSelectedVisibility] = useState<string>("all");
  const [selectedCustomerPage, setSelectedCustomerPage] = useState<string>("all");
  const [selectedTraining, setSelectedTraining] = useState<string>("all");
  const [selectedMedia, setSelectedMedia] = useState<string>("all");
  const [selectedFaq, setSelectedFaq] = useState<string>("all");
  const [selectedReview, setSelectedReview] = useState<string>("all");
  const [selectedQr, setSelectedQr] = useState<string>("all");

  // 2. Pagination State
  const [pageSize, setPageSize] = useState<number>(20);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // 3. Sorting State
  const [sortField, setSortField] = useState<"name" | "brand" | "sku" | "updated">("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // 4. Image Lightbox Preview State
  const [lightboxImage, setLightboxImage] = useState<{ url: string; title: string; sku?: string | null } | null>(null);

  // Close brand dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (brandDropdownRef.current && !brandDropdownRef.current.contains(event.target as Node)) {
        setIsBrandDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close Lightbox on ESC key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setLightboxImage(null);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Reset page to 1 whenever any filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [
    searchTerm,
    selectedOverallStatus,
    issueQuickFilter,
    selectedBrandIds,
    selectedCategory,
    selectedOperational,
    selectedVisibility,
    selectedCustomerPage,
    selectedTraining,
    selectedMedia,
    selectedFaq,
    selectedReview,
    selectedQr,
    pageSize,
  ]);

  const resetAllFilters = () => {
    setSearchTerm("");
    setSelectedOverallStatus("all");
    setIssueQuickFilter("all");
    setSelectedBrandIds([]);
    setSelectedCategory("all");
    setSelectedOperational("all");
    setSelectedVisibility("all");
    setSelectedCustomerPage("all");
    setSelectedTraining("all");
    setSelectedMedia("all");
    setSelectedFaq("all");
    setSelectedReview("all");
    setSelectedQr("all");
    setCurrentPage(1);
  };

  const hasActiveFilters =
    searchTerm !== "" ||
    selectedOverallStatus !== "all" ||
    issueQuickFilter !== "all" ||
    selectedBrandIds.length > 0 ||
    selectedCategory !== "all" ||
    selectedOperational !== "all" ||
    selectedVisibility !== "all" ||
    selectedCustomerPage !== "all" ||
    selectedTraining !== "all" ||
    selectedMedia !== "all" ||
    selectedFaq !== "all" ||
    selectedReview !== "all" ||
    selectedQr !== "all";

  // Counts for Overall Status Buttons
  const overallStatusCounts = useMemo(() => {
    const counts = {
      all: initialProducts.length,
      needs_attention: 0,
      not_started: 0,
      in_progress: 0,
      ready: 0,
      published: 0,
    };
    initialProducts.forEach((p) => {
      if (counts[p.overall_status] !== undefined) {
        counts[p.overall_status] += 1;
      }
    });
    return counts;
  }, [initialProducts]);

  // Filtered Brand List for Multi-Select dropdown
  const filteredBrandOptions = useMemo(() => {
    if (!brandSearchTerm.trim()) return filterOptions.brands;
    const q = brandSearchTerm.toLowerCase();
    return filterOptions.brands.filter((b) => b.name.toLowerCase().includes(q));
  }, [filterOptions.brands, brandSearchTerm]);

  const toggleBrandSelection = (brandId: string) => {
    setSelectedBrandIds((prev) =>
      prev.includes(brandId) ? prev.filter((id) => id !== brandId) : [...prev, brandId]
    );
  };

  const toggleSelectAllBrands = () => {
    if (selectedBrandIds.length === filterOptions.brands.length) {
      setSelectedBrandIds([]);
    } else {
      setSelectedBrandIds(filterOptions.brands.map((b) => b.id));
    }
  };

  // Filter products
  const filteredProducts = useMemo(() => {
    return initialProducts.filter((product) => {
      // 1. Search term
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

      // 2. Row 1: Overall Content Status
      if (selectedOverallStatus !== "all" && product.overall_status !== selectedOverallStatus) {
        return false;
      }

      // 3. Row 2: Issue Quick Filters
      if (issueQuickFilter === "customer_page_missing") {
        if (product.customer_page_status !== "missing" && product.customer_page_status !== "not_started") return false;
      } else if (issueQuickFilter === "training_missing") {
        if (product.training_status !== "missing") return false;
      } else if (issueQuickFilter === "media_missing") {
        if (product.media_status !== "missing") return false;
      } else if (issueQuickFilter === "qr_not_published") {
        if (product.qr_status === "live") return false;
      } else if (issueQuickFilter === "review_pending") {
        if (product.review_status !== "pending") return false;
      }

      // 4. Multi-Select Brand Filter
      if (selectedBrandIds.length > 0 && !selectedBrandIds.includes(product.brand_id)) {
        return false;
      }

      // 5. Category Filter (1st + 2nd Depth Authoritative Category Master)
      if (selectedCategory !== "all") {
        const match1st = product.depth1Code === selectedCategory;
        const match2nd = product.depth2Code === selectedCategory;
        const matchPath = product.category_display_path === selectedCategory;
        const matchCode = product.category_code === selectedCategory;
        if (!match1st && !match2nd && !matchPath && !matchCode) {
          return false;
        }
      }

      // 6. More Filters
      if (selectedOperational !== "all" && product.operational_status !== selectedOperational) return false;
      if (selectedVisibility !== "all" && product.visibility !== selectedVisibility) return false;
      if (selectedCustomerPage !== "all" && product.customer_page_status !== selectedCustomerPage) return false;
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
    selectedOverallStatus,
    issueQuickFilter,
    selectedBrandIds,
    selectedCategory,
    selectedOperational,
    selectedVisibility,
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

  // Paginated products
  const totalProducts = sortedProducts.length;
  const totalPages = Math.max(1, Math.ceil(totalProducts / pageSize));
  const validCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (validCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalProducts);
  const paginatedProducts = sortedProducts.slice(startIndex, endIndex);

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
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/60 whitespace-nowrap">
          Active
        </span>
      );
    }
    if (status === "inactive") {
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-zinc-100 text-zinc-600 border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700 whitespace-nowrap">
          Inactive
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-zinc-200 text-zinc-700 border border-zinc-300 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700 whitespace-nowrap">
        Historical
      </span>
    );
  };

  const renderVisibilityBadge = (visibility: "visible" | "hidden") => {
    if (visibility === "visible") {
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60 whitespace-nowrap">
          Visible
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-zinc-100 text-zinc-500 border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700 whitespace-nowrap">
        Hidden
      </span>
    );
  };

  const renderOverallStatusBadge = (status: ContentOverallStatus) => {
    switch (status) {
      case "published":
        return (
          <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 whitespace-nowrap">
            <CheckCircleIcon className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            Published
          </span>
        );
      case "ready":
        return (
          <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9.5px] font-bold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800 whitespace-nowrap">
            <SparklesIcon className="w-2.5 h-2.5 text-blue-600 dark:text-blue-400 shrink-0" />
            Ready
          </span>
        );
      case "in_progress":
        return (
          <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9.5px] font-bold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800 whitespace-nowrap">
            <ClockIcon className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400 shrink-0" />
            In Progress
          </span>
        );
      case "needs_attention":
        return (
          <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9.5px] font-bold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800 whitespace-nowrap">
            <AlertCircleIcon className="w-2.5 h-2.5 text-rose-600 dark:text-rose-400 shrink-0" />
            Needs Attention
          </span>
        );
      case "not_started":
      default:
        return (
          <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9.5px] font-bold bg-zinc-100 text-zinc-600 border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700 whitespace-nowrap">
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
        <span className="inline-flex items-center px-1 py-0.5 rounded text-[9.5px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/50 whitespace-nowrap">
          {val === "complete" && extra !== undefined ? `Complete (${extra})` : val === "active" ? "Active" : val.charAt(0).toUpperCase() + val.slice(1)}
        </span>
      );
    }
    if (val === "draft" || val === "in_progress" || val === "partial" || val === "pending" || val === "inactive") {
      return (
        <span className="inline-flex items-center px-1 py-0.5 rounded text-[9.5px] font-medium bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800/50 whitespace-nowrap">
          {val === "partial" && extra !== undefined ? `Partial (${extra})` : val === "in_progress" ? "In Progress" : val.charAt(0).toUpperCase() + val.slice(1)}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-1 py-0.5 rounded text-[9.5px] font-medium bg-zinc-100 text-zinc-500 border border-zinc-200 dark:bg-zinc-800/60 dark:text-zinc-400 dark:border-zinc-700 whitespace-nowrap">
        {val === "not_generated" ? "Not Gen" : val === "not_started" ? "Not Started" : val.charAt(0).toUpperCase() + val.slice(1)}
      </span>
    );
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
              Content & Training
            </h1>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              Foundation
            </span>
          </div>
          <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 mt-1">
            상품별 고객 안내 페이지, 교육 자료, 미디어 에셋, FAQ, 리뷰, QR 퍼블리싱 현황을 통합 관리합니다.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700">
            Total <strong className="text-zinc-900 dark:text-zinc-100 font-bold">{initialProducts.length}</strong> Products
          </div>
        </div>
      </div>

      {/* FILTER AREA CONTAINER */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 shadow-2xs space-y-4">
        {/* ROW 1: OVERALL CONTENT STATUS BUTTON GROUP */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
            <span>Overall Content Status</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: "all", label: "All Statuses", count: overallStatusCounts.all },
              { id: "needs_attention", label: "Needs Attention", count: overallStatusCounts.needs_attention },
              { id: "not_started", label: "Not Started", count: overallStatusCounts.not_started },
              { id: "in_progress", label: "In Progress", count: overallStatusCounts.in_progress },
              { id: "ready", label: "Ready", count: overallStatusCounts.ready },
              { id: "published", label: "Published", count: overallStatusCounts.published },
            ].map((btn) => {
              const isActive = selectedOverallStatus === btn.id;
              return (
                <button
                  key={btn.id}
                  type="button"
                  onClick={() => setSelectedOverallStatus(btn.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                    isActive
                      ? btn.id === "needs_attention"
                        ? "bg-rose-600 text-white shadow-xs font-bold ring-2 ring-rose-500/20"
                        : btn.id === "published"
                        ? "bg-emerald-600 text-white shadow-xs font-bold ring-2 ring-emerald-500/20"
                        : btn.id === "ready"
                        ? "bg-blue-600 text-white shadow-xs font-bold ring-2 ring-blue-500/20"
                        : "bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-xs font-bold"
                      : "bg-zinc-50 dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 border border-zinc-200/80 dark:border-zinc-700/80 hover:bg-zinc-100 dark:hover:bg-zinc-750"
                  }`}
                >
                  <span>{btn.label}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      isActive
                        ? "bg-white/20 text-white"
                        : "bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400"
                    }`}
                  >
                    {btn.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ROW 2: ISSUE QUICK FILTERS */}
        <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80 space-y-1.5">
          <div className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
            <span>Issue Quick Filters (조치 원인 필터)</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: "all", label: "All Issues" },
              { id: "customer_page_missing", label: "Customer Page Missing" },
              { id: "training_missing", label: "Training Missing" },
              { id: "media_missing", label: "Media Missing" },
              { id: "qr_not_published", label: "QR Not Published" },
              { id: "review_pending", label: "Review Pending" },
            ].map((pill) => {
              const isActive = issueQuickFilter === pill.id;
              return (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => setIssueQuickFilter(pill.id)}
                  className={`px-3 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
                    isActive
                      ? "bg-indigo-600 text-white font-bold shadow-xs"
                      : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                  }`}
                >
                  {pill.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ROW 3: MAIN SEARCH / FILTERS */}
        <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80 grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {/* Integrated Search */}
          <div className="md:col-span-5 relative">
            <SearchIcon className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search Product Name, Letusto SKU, Brand, UPC..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
              >
                <CloseIcon className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Searchable Multi-Select Brand Dropdown */}
          <div className="md:col-span-3 relative" ref={brandDropdownRef}>
            <button
              type="button"
              onClick={() => setIsBrandDropdownOpen(!isBrandDropdownOpen)}
              className={`w-full py-2 px-3 text-xs rounded-xl border text-left flex items-center justify-between transition-colors cursor-pointer ${
                selectedBrandIds.length > 0
                  ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-900 dark:text-indigo-200 font-semibold"
                  : "border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 text-zinc-900 dark:text-zinc-100"
              }`}
            >
              <span className="truncate">
                {selectedBrandIds.length === 0
                  ? "All Brands"
                  : selectedBrandIds.length === 1
                  ? filterOptions.brands.find((b) => b.id === selectedBrandIds[0])?.name || "1 Brand Selected"
                  : `${selectedBrandIds.length} Brands Selected`}
              </span>
              <ChevronDownIcon className="w-3.5 h-3.5 text-zinc-400 shrink-0 ml-1" />
            </button>

            {isBrandDropdownOpen && (
              <div className="absolute top-full left-0 mt-1.5 w-72 z-40 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-2xl shadow-xl p-3 space-y-2.5">
                {/* Search input inside brand dropdown */}
                <div className="relative">
                  <SearchIcon className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search brand name..."
                    value={brandSearchTerm}
                    onChange={(e) => setBrandSearchTerm(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-hidden"
                  />
                </div>

                {/* Actions Header */}
                <div className="flex items-center justify-between text-[11px] text-zinc-500 border-b border-zinc-100 dark:border-zinc-800 pb-2 px-1">
                  <span>{selectedBrandIds.length} selected</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={toggleSelectAllBrands}
                      className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline cursor-pointer"
                    >
                      {selectedBrandIds.length === filterOptions.brands.length ? "Deselect All" : "Select All"}
                    </button>
                    {selectedBrandIds.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedBrandIds([])}
                        className="text-zinc-400 hover:text-rose-600 cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                {/* Brand List checkboxes */}
                <div className="max-h-56 overflow-y-auto space-y-1 scrollbar-thin pr-1">
                  {filteredBrandOptions.length === 0 ? (
                    <div className="py-3 text-center text-xs text-zinc-400">No brands found</div>
                  ) : (
                    filteredBrandOptions.map((brand) => {
                      const isChecked = selectedBrandIds.includes(brand.id);
                      return (
                        <label
                          key={brand.id}
                          className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer text-xs text-zinc-800 dark:text-zinc-200 transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleBrandSelection(brand.id)}
                            className="rounded text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
                          />
                          <span className="truncate">{brand.name}</span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Category Dropdown (1st + 2nd Depth Authoritative Master) */}
          <div className="md:col-span-2">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full py-2 px-3 text-xs rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Categories</option>
              {filterOptions.categories.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.depth === 2 ? `└ ${c.name}` : c.name}
                </option>
              ))}
            </select>
          </div>

          {/* More Filters Toggle & Reset Button */}
          <div className="md:col-span-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowMoreFilters(!showMoreFilters)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold rounded-xl border transition-colors cursor-pointer ${
                showMoreFilters || (selectedOperational !== "all" || selectedVisibility !== "all" || selectedCustomerPage !== "all" || selectedTraining !== "all" || selectedMedia !== "all" || selectedFaq !== "all" || selectedReview !== "all" || selectedQr !== "all")
                  ? "bg-indigo-50 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300"
                  : "bg-zinc-50 dark:bg-zinc-800/80 border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-750"
              }`}
            >
              <FilterIcon className="w-3.5 h-3.5" />
              <span>More Filters</span>
              {showMoreFilters ? <ChevronUpIcon className="w-3.5 h-3.5" /> : <ChevronDownIcon className="w-3.5 h-3.5" />}
            </button>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetAllFilters}
                title="Reset all filters"
                className="p-2 text-xs font-semibold rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-750 cursor-pointer"
              >
                <RefreshIcon className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* MORE FILTERS COLLAPSIBLE PANEL */}
        {showMoreFilters && (
          <div className="pt-3 mt-3 border-t border-zinc-100 dark:border-zinc-800 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                Operational Status
              </label>
              <select
                value={selectedOperational}
                onChange={(e) => setSelectedOperational(e.target.value)}
                className="w-full py-1.5 px-2 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
              >
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="historical">Historical</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                Visibility
              </label>
              <select
                value={selectedVisibility}
                onChange={(e) => setSelectedVisibility(e.target.value)}
                className="w-full py-1.5 px-2 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
              >
                <option value="all">All</option>
                <option value="visible">Visible</option>
                <option value="hidden">Hidden</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                Customer Page
              </label>
              <select
                value={selectedCustomerPage}
                onChange={(e) => setSelectedCustomerPage(e.target.value)}
                className="w-full py-1.5 px-2 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
              >
                <option value="all">All</option>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
                <option value="missing">Missing</option>
                <option value="not_started">Not Started</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                Training Status
              </label>
              <select
                value={selectedTraining}
                onChange={(e) => setSelectedTraining(e.target.value)}
                className="w-full py-1.5 px-2 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
              >
                <option value="all">All</option>
                <option value="ready">Ready</option>
                <option value="in_progress">In Progress</option>
                <option value="missing">Missing</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                Media Status
              </label>
              <select
                value={selectedMedia}
                onChange={(e) => setSelectedMedia(e.target.value)}
                className="w-full py-1.5 px-2 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
              >
                <option value="all">All</option>
                <option value="complete">Complete</option>
                <option value="partial">Partial</option>
                <option value="missing">Missing</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                QR / Publishing
              </label>
              <select
                value={selectedQr}
                onChange={(e) => setSelectedQr(e.target.value)}
                className="w-full py-1.5 px-2 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
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

      {/* RESULTS SUMMARY BAR & PAGINATION TOP */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-zinc-500 dark:text-zinc-400 px-1">
        <div>
          {totalProducts === 0 ? (
            <span>No matching products</span>
          ) : (
            <span>
              Showing <strong className="text-zinc-900 dark:text-zinc-100 font-bold">{startIndex + 1}–{endIndex}</strong> of{" "}
              <strong className="text-zinc-900 dark:text-zinc-100 font-bold">{totalProducts}</strong> products
              {hasActiveFilters && " (Filtered)"}
            </span>
          )}
        </div>

        {/* Rows per page selector */}
        <div className="flex items-center gap-2">
          <span className="text-[11px]">Products per page:</span>
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="py-1 px-2 text-xs font-semibold rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-hidden"
          >
            <option value={20}>20 per page</option>
            <option value={50}>50 per page</option>
            <option value={100}>100 per page</option>
          </select>
        </div>
      </div>

      {/* CONTENT STATUS TABLE */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full table-fixed text-left text-xs text-zinc-600 dark:text-zinc-400">
            <thead className="bg-zinc-50 dark:bg-zinc-850 text-[10px] font-semibold text-zinc-700 dark:text-zinc-300 border-b border-zinc-200 dark:border-zinc-800 select-none">
              <tr>
                {/* 1. Product Column (Compact: Thumbnail, Name, SKU) */}
                <th
                  onClick={() => handleSort("name")}
                  className="py-2 px-1.5 font-semibold cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors w-[185px]"
                >
                  <div className="flex items-center gap-1">
                    <span>Product</span>
                    <ArrowUpDownIcon className="w-3 h-3 text-zinc-400 shrink-0" />
                  </div>
                </th>

                {/* 2. Brand / Category Compact 2-Line Column */}
                <th
                  onClick={() => handleSort("brand")}
                  className="py-2 px-1.5 font-semibold cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors w-[125px]"
                >
                  <div className="flex items-center gap-1">
                    <span>Brand / Category</span>
                    <ArrowUpDownIcon className="w-3 h-3 text-zinc-400 shrink-0" />
                  </div>
                </th>

                {/* Status Columns */}
                <th className="py-2 px-0.5 text-center w-[65px]">Operational</th>
                <th className="py-2 px-0.5 text-center w-[60px]">Visibility</th>
                <th className="py-2 px-0.5 text-center w-[95px]">Overall Status</th>
                <th className="py-2 px-0.5 text-center w-[80px]">Customer Page</th>
                <th className="py-2 px-0.5 text-center w-[60px]">Training</th>
                <th className="py-2 px-0.5 text-center w-[55px]">Media</th>
                <th className="py-2 px-0.5 text-center w-[45px]">FAQ</th>
                <th className="py-2 px-0.5 text-center w-[50px]">Reviews</th>
                <th className="py-2 px-0.5 text-center w-[75px]">Publishing / QR</th>
                <th
                  onClick={() => handleSort("updated")}
                  className="py-2 px-1 font-semibold cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-right w-[65px]"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Updated</span>
                    <ArrowUpDownIcon className="w-3 h-3 text-zinc-400 shrink-0" />
                  </div>
                </th>
                <th className="py-2 px-1 font-semibold text-right w-[60px]">Manage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {paginatedProducts.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-12 text-center text-zinc-500 dark:text-zinc-400">
                    <div className="flex flex-col items-center justify-center">
                      <LayersIcon className="w-8 h-8 text-zinc-300 dark:text-zinc-600 mb-2" />
                      <p className="text-sm font-semibold">No products match your active filters</p>
                      <p className="text-xs text-zinc-400 mt-1">Try adjusting your search terms or resetting filters</p>
                      {hasActiveFilters && (
                        <button
                          type="button"
                          onClick={resetAllFilters}
                          className="mt-3 px-3.5 py-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                        >
                          Reset all filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedProducts.map((p) => (
                  <tr
                    key={p.id}
                    className="hover:bg-zinc-50/80 dark:hover:bg-zinc-850/50 transition-colors group"
                  >
                    {/* 1. Product (Thumbnail, Name, SKU) */}
                    <td className="py-2 px-1.5">
                      <div className="flex items-center gap-2">
                        {/* Thumbnail with Lightbox Click Handler */}
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            if (p.photoUrl) {
                              setLightboxImage({ url: p.photoUrl, title: p.name, sku: p.letusto_sku });
                            }
                          }}
                          className={`w-8 h-8 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-850 overflow-hidden shrink-0 relative flex items-center justify-center transition-all ${
                            p.photoUrl ? "cursor-pointer hover:ring-2 hover:ring-indigo-500/30 group-hover:border-zinc-300" : ""
                          }`}
                          title={p.photoUrl ? "Click to view full image" : "No image registered"}
                        >
                          {p.photoUrl ? (
                            <>
                              <img
                                src={p.photoUrl}
                                alt={p.name}
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 bg-black/30 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                                <ZoomInIcon className="w-3 h-3 text-white" />
                              </div>
                            </>
                          ) : (
                            <span className="text-[8px] font-bold text-zinc-400">No Pic</span>
                          )}
                        </div>

                        {/* Product Title & Letusto SKU */}
                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/admin/products/content/${p.id}`}
                            className="font-bold text-zinc-900 dark:text-zinc-100 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors truncate block text-[11.5px]"
                            title={p.name}
                          >
                            {p.name}
                          </Link>
                          <div className="text-[9.5px] text-zinc-400 font-mono mt-0.5 truncate">
                            SKU: {p.letusto_sku || "-"}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* 2. Brand / Category Compact 2-Line Column */}
                    <td className="py-2 px-1.5">
                      <div className="min-w-0">
                        {/* Line 1: Brand */}
                        <div className="font-bold text-zinc-900 dark:text-zinc-100 truncate text-[11.5px]" title={p.brand_name}>
                          {p.brand_name}
                        </div>
                        {/* Line 2: 1st > 2nd Category English Name */}
                        <div className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 truncate mt-0.5" title={p.category_display_path}>
                          {p.category_display_path}
                        </div>
                      </div>
                    </td>

                    {/* 3. Operational */}
                    <td className="py-2 px-0.5 text-center">
                      {renderOperationalBadge(p.operational_status)}
                    </td>

                    {/* 4. Visibility */}
                    <td className="py-2 px-0.5 text-center">
                      {renderVisibilityBadge(p.visibility)}
                    </td>

                    {/* 5. Overall Status */}
                    <td className="py-2 px-0.5 text-center">
                      {renderOverallStatusBadge(p.overall_status)}
                    </td>

                    {/* 6. Customer Page */}
                    <td className="py-2 px-0.5 text-center">
                      {renderModuleStatusBadge("customer", p.customer_page_status)}
                    </td>

                    {/* 7. Training */}
                    <td className="py-2 px-0.5 text-center">
                      {renderModuleStatusBadge("training", p.training_status)}
                    </td>

                    {/* 8. Media */}
                    <td className="py-2 px-0.5 text-center">
                      {renderModuleStatusBadge("media", p.media_status, p.image_count)}
                    </td>

                    {/* 9. FAQ */}
                    <td className="py-2 px-0.5 text-center">
                      {renderModuleStatusBadge("faq", p.faq_status)}
                    </td>

                    {/* 10. Reviews */}
                    <td className="py-2 px-0.5 text-center">
                      {renderModuleStatusBadge("review", p.review_status)}
                    </td>

                    {/* 11. Publishing / QR */}
                    <td className="py-2 px-0.5 text-center">
                      {renderModuleStatusBadge("qr", p.qr_status)}
                    </td>

                    {/* 12. Last Updated */}
                    <td className="py-2 px-1 text-right font-mono text-[10px] text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                      {p.last_updated}
                    </td>

                    {/* 13. Manage */}
                    <td className="py-2.5 px-3 text-right">
                      <Link
                        href={`/admin/products/content/${p.id}`}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-colors cursor-pointer"
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

      {/* PAGINATION CONTROLS FOOTER */}
      {totalProducts > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-zinc-600 dark:text-zinc-400 px-1 pt-1">
          <div>
            Page <strong className="text-zinc-900 dark:text-zinc-100 font-bold">{validCurrentPage}</strong> of{" "}
            <strong className="text-zinc-900 dark:text-zinc-100 font-bold">{totalPages}</strong>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={validCurrentPage <= 1}
              className="px-3 py-1.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-50 dark:hover:bg-zinc-750 transition-colors cursor-pointer"
            >
              Previous
            </button>
            <span className="font-mono px-2 text-zinc-500 font-semibold">
              {validCurrentPage} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={validCurrentPage >= totalPages}
              className="px-3 py-1.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-50 dark:hover:bg-zinc-750 transition-colors cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* THUMBNAIL LIGHTBOX PREVIEW MODAL */}
      {lightboxImage && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4"
          onClick={() => setLightboxImage(null)}
        >
          <div
            className="relative max-w-xl w-full bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950">
              <div className="min-w-0 pr-4">
                <h3 className="text-sm font-bold text-white truncate">{lightboxImage.title}</h3>
                {lightboxImage.sku && (
                  <p className="text-xs font-mono text-zinc-400">SKU: {lightboxImage.sku}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setLightboxImage(null)}
                className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                aria-label="Close Preview"
              >
                <CloseIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Image Box */}
            <div className="p-6 bg-zinc-950 flex items-center justify-center max-h-[70vh] overflow-hidden">
              <img
                src={lightboxImage.url}
                alt={lightboxImage.title}
                className="max-h-[60vh] max-w-full object-contain rounded-xl shadow-lg"
              />
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-zinc-800 bg-zinc-950 flex items-center justify-between text-xs text-zinc-400">
              <span>Authoritative Catalog Packshot</span>
              <a
                href={lightboxImage.url}
                target="_blank"
                rel="noreferrer"
                className="hover:text-indigo-400 transition-colors inline-flex items-center gap-1"
              >
                <span>Open Original</span>
                <ExternalLinkIcon className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
