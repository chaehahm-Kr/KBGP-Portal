"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";

export interface ComplianceProductItem {
  id: string;
  name: string;
  name_en: string | null;
  display_name: string;
  manufacture_sku: string | null;
  display_manufacture_sku: string | null;
  letusto_sku: string | null;
  brand_id: string;
  brand_name: string;
  company_id: string;
  company_name: string;
  company_country: string | null;
  category: string | null;
  category_code: string | null;
  category_full_path: string | null;
  photoUrl: string | null;
  origin: string | null;
  description: string | null;
  how_to_use: string | null;
  bullet_points: string[] | null;
  volume: string | null;
  ingredients_text: string | null;
  ingredients_file_path: string | null;
  ingredients_file_path_en: string | null;
  ingredientsFileSignedUrl?: string | null;
  ingredientsFileEnSignedUrl?: string | null;

  // Regulatory attributes
  fda_status: string | null;
  mocra_status: string | null;
  otc_status: string | null;
  drug_facts_status: string | null;

  // Additional relevant attributes for checklist
  hair_loss_claim?: string | null;
  primary_concern?: string | string[] | null;
  spf_value?: string | number | null;
  pa_rating?: string | null;
  uv_filter_type?: string | string[] | null;
  formulation?: string | string[] | null;
  package_format?: string | null;
  shelf_life_months?: string | number | null;
  pao_months?: string | number | null;
  storage_condition?: string | string[] | null;

  // Certificates uploaded for this product
  certificates: Array<{
    id: string;
    certificate_type: string;
    storage_path: string;
    original_filename: string | null;
    version: number;
    created_at: string;
    signedUrl?: string | null;
  }>;
}

interface ComplianceClientProps {
  products: ComplianceProductItem[];
  brands: { id: string; name: string }[];
  companies: { id: string; name: string }[];
  categories: { code: string; name_ko: string }[];
}

export const FDA_STATUS_CONFIG: Record<string, { labelKo: string; labelEn: string; color: string }> = {
  NOT_REVIEWED: { labelKo: "미검토", labelEn: "Not Reviewed", color: "bg-amber-500/10 text-amber-400 border-amber-500/30" },
  NOT_APPLICABLE: { labelKo: "해당 없음", labelEn: "Not Applicable", color: "bg-zinc-500/10 text-zinc-400 border-zinc-500/30" },
  NA: { labelKo: "해당 없음 (N/A)", labelEn: "Not Applicable (N/A)", color: "bg-zinc-500/10 text-zinc-400 border-zinc-500/30" },
  REVIEW_REQUIRED: { labelKo: "검토 필요", labelEn: "Review Required", color: "bg-rose-500/10 text-rose-400 border-rose-500/30" },
  IN_PROGRESS: { labelKo: "진행 중", labelEn: "In Progress", color: "bg-blue-500/10 text-blue-400 border-blue-500/30" },
  SUBMITTED: { labelKo: "제출 완료", labelEn: "Submitted", color: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30" },
  COMPLETED: { labelKo: "완료", labelEn: "Completed", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
  ADMIN_VERIFIED: { labelKo: "관리자 확인 완료", labelEn: "Admin Verified", color: "bg-teal-500/10 text-teal-400 border-teal-500/30" },
};

export const MOCRA_STATUS_CONFIG: Record<string, { labelKo: string; labelEn: string; color: string }> = {
  NOT_REVIEWED: { labelKo: "미검토", labelEn: "Not Reviewed", color: "bg-amber-500/10 text-amber-400 border-amber-500/30" },
  NOT_APPLICABLE: { labelKo: "해당 없음", labelEn: "Not Applicable", color: "bg-zinc-500/10 text-zinc-400 border-zinc-500/30" },
  NA: { labelKo: "해당 없음 (N/A)", labelEn: "Not Applicable (N/A)", color: "bg-zinc-500/10 text-zinc-400 border-zinc-500/30" },
  REVIEW_REQUIRED: { labelKo: "검토 필요", labelEn: "Review Required", color: "bg-rose-500/10 text-rose-400 border-rose-500/30" },
  FACILITY_PENDING: { labelKo: "시설 등록 준비 중", labelEn: "Facility Reg. Pending", color: "bg-purple-500/10 text-purple-400 border-purple-500/30" },
  PRODUCT_LISTING_PENDING: { labelKo: "제품 리스팅 준비 중", labelEn: "Listing Pending", color: "bg-indigo-500/10 text-indigo-400 border-indigo-500/30" },
  COMPLETED: { labelKo: "완료", labelEn: "Completed", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
  ADMIN_VERIFIED: { labelKo: "관리자 확인 완료", labelEn: "Admin Verified", color: "bg-teal-500/10 text-teal-400 border-teal-500/30" },
};

export const OTC_STATUS_CONFIG: Record<string, { labelKo: string; labelEn: string; color: string }> = {
  NOT_REVIEWED: { labelKo: "미검토", labelEn: "Not Reviewed", color: "bg-amber-500/10 text-amber-400 border-amber-500/30" },
  NOT_OTC: { labelKo: "OTC 아님", labelEn: "Not OTC", color: "bg-zinc-500/10 text-zinc-400 border-zinc-500/30" },
  NA: { labelKo: "해당 없음 (N/A)", labelEn: "Not Applicable (N/A)", color: "bg-zinc-500/10 text-zinc-400 border-zinc-500/30" },
  POTENTIAL_OTC: { labelKo: "OTC 가능성 있음", labelEn: "Potential OTC", color: "bg-amber-500/10 text-amber-400 border-amber-500/30" },
  OTC_REQUIRED: { labelKo: "OTC 적용", labelEn: "OTC Required", color: "bg-rose-500/10 text-rose-400 border-rose-500/30" },
  IN_PROGRESS: { labelKo: "준비 중", labelEn: "In Progress", color: "bg-blue-500/10 text-blue-400 border-blue-500/30" },
  COMPLETED: { labelKo: "완료", labelEn: "Completed", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
};

export const DRUG_FACTS_STATUS_CONFIG: Record<string, { labelKo: string; labelEn: string; color: string }> = {
  NOT_REVIEWED: { labelKo: "미검토", labelEn: "Not Reviewed", color: "bg-amber-500/10 text-amber-400 border-amber-500/30" },
  NOT_APPLICABLE: { labelKo: "해당 없음", labelEn: "Not Applicable", color: "bg-zinc-500/10 text-zinc-400 border-zinc-500/30" },
  NA: { labelKo: "해당 없음 (N/A)", labelEn: "Not Applicable (N/A)", color: "bg-zinc-500/10 text-zinc-400 border-zinc-500/30" },
  REQUIRED: { labelKo: "필요", labelEn: "Required", color: "bg-rose-500/10 text-rose-400 border-rose-500/30" },
  DRAFT: { labelKo: "초안", labelEn: "Draft", color: "bg-blue-500/10 text-blue-400 border-blue-500/30" },
  REVIEWING: { labelKo: "검토 중", labelEn: "Under Review", color: "bg-purple-500/10 text-purple-400 border-purple-500/30" },
  COMPLETED: { labelKo: "완료", labelEn: "Completed", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
};

function StatusBadge({
  rawStatus,
  configMap,
  fallback = "Data Not Available",
}: {
  rawStatus: string | null | undefined;
  configMap: Record<string, { labelKo: string; labelEn: string; color: string }>;
  fallback?: string;
}) {
  if (!rawStatus) {
    return (
      <span
        title="Field not yet populated in database"
        className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-zinc-800 text-zinc-400 border border-zinc-700/60"
      >
        {fallback}
      </span>
    );
  }

  const normalized = String(rawStatus).trim();
  const cfg = configMap[normalized] || configMap[normalized.toUpperCase()];

  if (!cfg) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-zinc-800 text-zinc-300 border border-zinc-700">
        {normalized}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${cfg.color}`}
      title={`${cfg.labelKo} (${cfg.labelEn})`}
    >
      {cfg.labelEn}
    </span>
  );
}

function ItemCategoryBadge({ type }: { type: "existing" | "not_reviewed" | "not_available" | "not_applicable" | "planned" }) {
  switch (type) {
    case "existing":
      return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">Existing Data</span>;
    case "not_reviewed":
      return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">Not Reviewed</span>;
    case "not_available":
      return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-zinc-800 text-zinc-400 border border-zinc-700">Data Not Available</span>;
    case "not_applicable":
      return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-zinc-800/80 text-zinc-400 border border-zinc-700/60">Not Applicable (N/A)</span>;
    case "planned":
      return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">Planned (Phase 2+)</span>;
  }
}

export function ComplianceClient({
  products,
  brands,
  companies,
  categories,
}: ComplianceClientProps) {
  // Search & Filter States
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("");
  const [selectedCompany, setSelectedCompany] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedFdaStatus, setSelectedFdaStatus] = useState("");
  const [selectedMocraStatus, setSelectedMocraStatus] = useState("");
  const [selectedOtcStatus, setSelectedOtcStatus] = useState("");
  const [selectedDrugFactsStatus, setSelectedDrugFactsStatus] = useState("");

  // Advanced Filters
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [selectedOrigin, setSelectedOrigin] = useState("");
  const [filterMissingInfoOnly, setFilterMissingInfoOnly] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Detail Modal / Drawer
  const [selectedProduct, setSelectedProduct] = useState<ComplianceProductItem | null>(null);

  // Distinct origins for advanced filter
  const distinctOrigins = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.origin && p.origin.trim()) set.add(p.origin.trim());
    });
    return Array.from(set).sort();
  }, [products]);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // 1. Text Search (Product Name, English Name, Letusto SKU, Mfg SKU)
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim();
        const matchesName = (p.name || "").toLowerCase().includes(query);
        const matchesNameEn = (p.name_en || "").toLowerCase().includes(query);
        const matchesDisplayName = (p.display_name || "").toLowerCase().includes(query);
        const matchesLetustoSku = (p.letusto_sku || "").toLowerCase().includes(query);
        const matchesMfgSku = (p.manufacture_sku || "").toLowerCase().includes(query);
        const matchesDisplayMfgSku = (p.display_manufacture_sku || "").toLowerCase().includes(query);

        if (
          !matchesName &&
          !matchesNameEn &&
          !matchesDisplayName &&
          !matchesLetustoSku &&
          !matchesMfgSku &&
          !matchesDisplayMfgSku
        ) {
          return false;
        }
      }

      // 2. Brand
      if (selectedBrand && p.brand_id !== selectedBrand) return false;

      // 3. Company
      if (selectedCompany && p.company_id !== selectedCompany) return false;

      // 4. Category
      if (selectedCategory && p.category_code !== selectedCategory && p.category !== selectedCategory) {
        return false;
      }

      // 5. FDA Status
      if (selectedFdaStatus) {
        if (selectedFdaStatus === "DATA_NOT_AVAILABLE") {
          if (p.fda_status) return false;
        } else {
          if (!p.fda_status || p.fda_status.toUpperCase() !== selectedFdaStatus.toUpperCase()) {
            return false;
          }
        }
      }

      // 6. MoCRA Status
      if (selectedMocraStatus) {
        if (selectedMocraStatus === "DATA_NOT_AVAILABLE") {
          if (p.mocra_status) return false;
        } else {
          if (!p.mocra_status || p.mocra_status.toUpperCase() !== selectedMocraStatus.toUpperCase()) {
            return false;
          }
        }
      }

      // 7. OTC Status
      if (selectedOtcStatus) {
        if (selectedOtcStatus === "DATA_NOT_AVAILABLE") {
          if (p.otc_status) return false;
        } else {
          if (!p.otc_status || p.otc_status.toUpperCase() !== selectedOtcStatus.toUpperCase()) {
            return false;
          }
        }
      }

      // 8. Drug Facts Status
      if (selectedDrugFactsStatus) {
        if (selectedDrugFactsStatus === "DATA_NOT_AVAILABLE") {
          if (p.drug_facts_status) return false;
        } else {
          if (!p.drug_facts_status || p.drug_facts_status.toUpperCase() !== selectedDrugFactsStatus.toUpperCase()) {
            return false;
          }
        }
      }

      // 9. Advanced: Country of origin
      if (selectedOrigin && (p.origin || "").trim() !== selectedOrigin) {
        return false;
      }

      // 10. Advanced: Missing Information filter
      if (filterMissingInfoOnly) {
        const hasMissingReg = !p.fda_status || !p.mocra_status || !p.otc_status || !p.drug_facts_status;
        if (!hasMissingReg) return false;
      }

      return true;
    });
  }, [
    products,
    searchTerm,
    selectedBrand,
    selectedCompany,
    selectedCategory,
    selectedFdaStatus,
    selectedMocraStatus,
    selectedOtcStatus,
    selectedDrugFactsStatus,
    selectedOrigin,
    filterMissingInfoOnly,
  ]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredProducts.length / pageSize) || 1;
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredProducts.slice(start, start + pageSize);
  }, [filteredProducts, currentPage, pageSize]);

  // Reset all filters
  const resetFilters = () => {
    setSearchTerm("");
    setSelectedBrand("");
    setSelectedCompany("");
    setSelectedCategory("");
    setSelectedFdaStatus("");
    setSelectedMocraStatus("");
    setSelectedOtcStatus("");
    setSelectedDrugFactsStatus("");
    setSelectedOrigin("");
    setFilterMissingInfoOnly(false);
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-950 dark:text-white">
              Product Compliance
            </h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              Phase 1 · Read-Only
            </span>
          </div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            US Import & Market Readiness — Regulatory review checklist and existing product compliance overview
          </p>
        </div>
      </div>

      {/* 2. Overview Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Products */}
        <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 shadow-sm">
          <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
            Total Products
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
              {products.length}
            </span>
            <span className="text-xs text-zinc-400">SKUs in catalog</span>
          </div>
          <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
            Authorized products available in system
          </p>
        </div>

        {/* Products Reviewed */}
        <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 shadow-sm">
          <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
            Products Reviewed
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="inline-flex items-center px-2.5 py-1 rounded text-sm font-semibold bg-zinc-800 text-zinc-400 border border-zinc-700">
              Not Yet Tracked
            </span>
          </div>
          <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
            Formal review workflow not established in Phase 1
          </p>
        </div>

        {/* Products Not Reviewed */}
        <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 shadow-sm">
          <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
            Products Not Reviewed
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="inline-flex items-center px-2.5 py-1 rounded text-sm font-semibold bg-zinc-800 text-zinc-400 border border-zinc-700">
              Not Yet Tracked
            </span>
          </div>
          <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
            Pending formal regulatory workflow engine
          </p>
        </div>

        {/* Products Requiring Attention */}
        <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 shadow-sm">
          <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
            Products Requiring Attention
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="inline-flex items-center px-2.5 py-1 rounded text-sm font-semibold bg-zinc-800 text-zinc-400 border border-zinc-700">
              Not Yet Tracked
            </span>
          </div>
          <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
            Requires authoritative decision engine
          </p>
        </div>
      </div>

      {/* 3. Search and Primary Filters */}
      <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search */}
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
              Search Name / SKU
            </label>
            <input
              type="text"
              placeholder="Search product name or SKU..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400"
            />
          </div>

          {/* Brand Filter */}
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
              Brand
            </label>
            <select
              value={selectedBrand}
              onChange={(e) => {
                setSelectedBrand(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full h-9 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400"
            >
              <option value="">All Brands ({brands.length})</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Company Filter */}
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
              Company
            </label>
            <select
              value={selectedCompany}
              onChange={(e) => {
                setSelectedCompany(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full h-9 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400"
            >
              <option value="">All Companies ({companies.length})</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
              Category
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full h-9 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400"
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.code} value={cat.code}>
                  {cat.name_ko} ({cat.code})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Regulatory Status Filter Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 pt-1 border-t border-zinc-100 dark:border-zinc-800/60">
          {/* FDA Status */}
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
              FDA Status
            </label>
            <select
              value={selectedFdaStatus}
              onChange={(e) => {
                setSelectedFdaStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full h-9 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400"
            >
              <option value="">All FDA Statuses</option>
              <option value="DATA_NOT_AVAILABLE">Data Not Available</option>
              <option value="NOT_REVIEWED">미검토 (Not Reviewed)</option>
              <option value="NOT_APPLICABLE">해당 없음 (Not Applicable)</option>
              <option value="NA">해당 없음 (N/A)</option>
              <option value="REVIEW_REQUIRED">검토 필요 (Review Required)</option>
              <option value="IN_PROGRESS">진행 중 (In Progress)</option>
              <option value="SUBMITTED">제출 완료 (Submitted)</option>
              <option value="COMPLETED">완료 (Completed)</option>
              <option value="ADMIN_VERIFIED">관리자 확인 완료 (Admin Verified)</option>
            </select>
          </div>

          {/* MoCRA Status */}
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
              MoCRA Status
            </label>
            <select
              value={selectedMocraStatus}
              onChange={(e) => {
                setSelectedMocraStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full h-9 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400"
            >
              <option value="">All MoCRA Statuses</option>
              <option value="DATA_NOT_AVAILABLE">Data Not Available</option>
              <option value="NOT_REVIEWED">미검토 (Not Reviewed)</option>
              <option value="NOT_APPLICABLE">해당 없음 (Not Applicable)</option>
              <option value="NA">해당 없음 (N/A)</option>
              <option value="REVIEW_REQUIRED">검토 필요 (Review Required)</option>
              <option value="FACILITY_PENDING">시설 등록 준비 중 (Facility Pending)</option>
              <option value="PRODUCT_LISTING_PENDING">제품 리스팅 준비 중 (Listing Pending)</option>
              <option value="COMPLETED">완료 (Completed)</option>
              <option value="ADMIN_VERIFIED">관리자 확인 완료 (Admin Verified)</option>
            </select>
          </div>

          {/* OTC Status */}
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
              OTC Status
            </label>
            <select
              value={selectedOtcStatus}
              onChange={(e) => {
                setSelectedOtcStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full h-9 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400"
            >
              <option value="">All OTC Statuses</option>
              <option value="DATA_NOT_AVAILABLE">Data Not Available</option>
              <option value="NOT_REVIEWED">미검토 (Not Reviewed)</option>
              <option value="NOT_OTC">OTC 아님 (Not OTC)</option>
              <option value="NA">해당 없음 (N/A)</option>
              <option value="POTENTIAL_OTC">OTC 가능성 있음 (Potential OTC)</option>
              <option value="OTC_REQUIRED">OTC 적용 (OTC Required)</option>
              <option value="IN_PROGRESS">준비 중 (In Progress)</option>
              <option value="COMPLETED">완료 (Completed)</option>
            </select>
          </div>

          {/* Drug Facts Status */}
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
              Drug Facts Status
            </label>
            <select
              value={selectedDrugFactsStatus}
              onChange={(e) => {
                setSelectedDrugFactsStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full h-9 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400"
            >
              <option value="">All Drug Facts Statuses</option>
              <option value="DATA_NOT_AVAILABLE">Data Not Available</option>
              <option value="NOT_REVIEWED">미검토 (Not Reviewed)</option>
              <option value="NOT_APPLICABLE">해당 없음 (Not Applicable)</option>
              <option value="NA">해당 없음 (N/A)</option>
              <option value="REQUIRED">필요 (Required)</option>
              <option value="DRAFT">초안 (Draft)</option>
              <option value="REVIEWING">검토 중 (Under Review)</option>
              <option value="COMPLETED">완료 (Completed)</option>
            </select>
          </div>
        </div>

        {/* Advanced Filters Toggle & Content */}
        <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/60 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className="text-xs font-medium text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 flex items-center gap-1.5 transition-colors"
          >
            <span>{showAdvancedFilters ? "▲ Hide Advanced Filters" : "▼ Show Advanced Filters"}</span>
          </button>

          {(searchTerm ||
            selectedBrand ||
            selectedCompany ||
            selectedCategory ||
            selectedFdaStatus ||
            selectedMocraStatus ||
            selectedOtcStatus ||
            selectedDrugFactsStatus ||
            selectedOrigin ||
            filterMissingInfoOnly) && (
            <button
              type="button"
              onClick={resetFilters}
              className="text-xs text-rose-500 hover:text-rose-400 font-medium transition-colors"
            >
              Reset Filters
            </button>
          )}
        </div>

        {showAdvancedFilters && (
          <div className="p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-lg space-y-3 border border-zinc-200 dark:border-zinc-800">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Country of Origin (Functional) */}
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  Country of Origin
                </label>
                <select
                  value={selectedOrigin}
                  onChange={(e) => {
                    setSelectedOrigin(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full h-8 px-2.5 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs text-zinc-900 dark:text-zinc-100"
                >
                  <option value="">All Origins</option>
                  {distinctOrigins.map((orig) => (
                    <option key={orig} value={orig}>
                      {orig}
                    </option>
                  ))}
                </select>
              </div>

              {/* Missing Information Toggle (Functional) */}
              <div className="flex items-center pt-5">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-700 dark:text-zinc-300">
                  <input
                    type="checkbox"
                    checked={filterMissingInfoOnly}
                    onChange={(e) => {
                      setFilterMissingInfoOnly(e.target.checked);
                      setCurrentPage(1);
                    }}
                    className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-400"
                  />
                  <span>Show only products with missing data</span>
                </label>
              </div>

              {/* Planned Filter: Label Review Status */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-zinc-400 dark:text-zinc-500">
                    Label Review Status
                  </label>
                  <span className="text-[10px] uppercase font-semibold text-indigo-400 bg-indigo-500/10 px-1 py-0.2 rounded border border-indigo-500/20">
                    Planned
                  </span>
                </div>
                <select
                  disabled
                  className="w-full h-8 px-2.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900/50 text-xs text-zinc-400 cursor-not-allowed"
                >
                  <option>All Review Statuses (Planned)</option>
                </select>
              </div>

              {/* Planned Filter: Import Readiness */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-zinc-400 dark:text-zinc-500">
                    Import Readiness
                  </label>
                  <span className="text-[10px] uppercase font-semibold text-indigo-400 bg-indigo-500/10 px-1 py-0.2 rounded border border-indigo-500/20">
                    Planned
                  </span>
                </div>
                <select
                  disabled
                  className="w-full h-8 px-2.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900/50 text-xs text-zinc-400 cursor-not-allowed"
                >
                  <option>All Readiness Levels (Planned)</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4. Results Header & Count */}
      <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 px-1">
        <div>
          Showing <span className="font-semibold text-zinc-900 dark:text-zinc-100">{filteredProducts.length}</span> of{" "}
          <span className="font-semibold text-zinc-900 dark:text-zinc-100">{products.length}</span> products
        </div>

        <div className="flex items-center gap-2">
          <span>Rows per page:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="h-7 px-2 rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
        </div>
      </div>

      {/* 5. Product Compliance Table */}
      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/80 font-semibold text-zinc-600 dark:text-zinc-300">
              <th className="py-3 px-3 w-14 text-center">Image</th>
              <th className="py-3 px-4 min-w-[220px]">Product Name / SKU</th>
              <th className="py-3 px-3 min-w-[140px]">Brand / Company</th>
              <th className="py-3 px-3 min-w-[120px]">Category</th>
              <th className="py-3 px-3 min-w-[110px]">FDA Status</th>
              <th className="py-3 px-3 min-w-[110px]">MoCRA Status</th>
              <th className="py-3 px-3 min-w-[100px]">OTC Status</th>
              <th className="py-3 px-3 min-w-[110px]">Drug Facts</th>
              <th className="py-3 px-3 min-w-[100px]">Label Review</th>
              <th className="py-3 px-3 min-w-[110px]">Import Ready</th>
              <th className="py-3 px-3 text-right min-w-[140px]">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-zinc-800 dark:text-zinc-200">
            {paginatedProducts.length === 0 ? (
              <tr>
                <td colSpan={11} className="py-12 text-center text-zinc-400 dark:text-zinc-500">
                  No products found matching the selected filter criteria.
                </td>
              </tr>
            ) : (
              paginatedProducts.map((p) => (
                <tr
                  key={p.id}
                  className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                >
                  {/* Thumbnail Image */}
                  <td className="py-2.5 px-3 text-center">
                    <div className="h-10 w-10 mx-auto rounded-md bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 overflow-hidden flex items-center justify-center">
                      {p.photoUrl ? (
                        <Image
                          src={p.photoUrl}
                          alt={p.display_name}
                          width={40}
                          height={40}
                          className="h-full w-full object-cover"
                          unoptimized
                        />
                      ) : (
                        <span className="text-[10px] text-zinc-400">No img</span>
                      )}
                    </div>
                  </td>

                  {/* Name & SKU */}
                  <td className="py-2.5 px-4">
                    <div className="font-medium text-zinc-900 dark:text-zinc-100 line-clamp-1" title={p.display_name}>
                      {p.display_name}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                      {p.letusto_sku && (
                        <span className="font-mono text-zinc-700 dark:text-zinc-300">
                          {p.letusto_sku}
                        </span>
                      )}
                      {p.display_manufacture_sku && p.display_manufacture_sku !== p.letusto_sku && (
                        <span className="text-zinc-400">
                          (Mfg: {p.display_manufacture_sku})
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Brand & Company */}
                  <td className="py-2.5 px-3">
                    <div className="font-medium text-zinc-900 dark:text-zinc-100">{p.brand_name}</div>
                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400">{p.company_name}</div>
                  </td>

                  {/* Category */}
                  <td className="py-2.5 px-3">
                    <div className="text-zinc-700 dark:text-zinc-300 text-[11px] line-clamp-2">
                      {p.category_full_path || p.category || "-"}
                    </div>
                  </td>

                  {/* FDA Status */}
                  <td className="py-2.5 px-3">
                    <StatusBadge rawStatus={p.fda_status} configMap={FDA_STATUS_CONFIG} />
                  </td>

                  {/* MoCRA Status */}
                  <td className="py-2.5 px-3">
                    <StatusBadge rawStatus={p.mocra_status} configMap={MOCRA_STATUS_CONFIG} />
                  </td>

                  {/* OTC Status */}
                  <td className="py-2.5 px-3">
                    <StatusBadge rawStatus={p.otc_status} configMap={OTC_STATUS_CONFIG} />
                  </td>

                  {/* Drug Facts Status */}
                  <td className="py-2.5 px-3">
                    <StatusBadge rawStatus={p.drug_facts_status} configMap={DRUG_FACTS_STATUS_CONFIG} />
                  </td>

                  {/* Label Review (Not Yet Tracked) */}
                  <td className="py-2.5 px-3">
                    <span
                      title="Label review workflow not established in Phase 1"
                      className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-zinc-800 text-zinc-400 border border-zinc-700/60"
                    >
                      Not Yet Tracked
                    </span>
                  </td>

                  {/* Import Readiness (Not Yet Tracked) */}
                  <td className="py-2.5 px-3">
                    <span
                      title="Import readiness decision not automated in Phase 1"
                      className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-zinc-800 text-zinc-400 border border-zinc-700/60"
                    >
                      Not Yet Tracked
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="py-2.5 px-3 text-right space-x-2">
                    <button
                      type="button"
                      onClick={() => setSelectedProduct(p)}
                      className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 hover:opacity-90 transition-opacity"
                    >
                      Review Checklist
                    </button>
                    <Link
                      href={`/admin/products/${p.id}`}
                      target="_blank"
                      className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                      title="Open full product catalog editor"
                    >
                      Catalog ↗
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 6. Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-zinc-700 dark:text-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            ← Previous
          </button>
          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            Page <span className="font-semibold text-zinc-900 dark:text-zinc-100">{currentPage}</span> of{" "}
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">{totalPages}</span>
          </div>
          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-zinc-700 dark:text-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            Next →
          </button>
        </div>
      )}

      {/* 7. Product Compliance Checklist Detail Modal */}
      {selectedProduct && (
        <ComplianceDetailModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
        />
      )}
    </div>
  );
}

function ComplianceDetailModal({
  product,
  onClose,
}: {
  product: ComplianceProductItem;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/75 backdrop-blur-sm animate-fadeIn"
    >
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-start justify-between gap-4 bg-zinc-50 dark:bg-zinc-900/80">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 overflow-hidden flex-shrink-0 flex items-center justify-center">
              {product.photoUrl ? (
                <Image
                  src={product.photoUrl}
                  alt={product.display_name}
                  width={48}
                  height={48}
                  className="h-full w-full object-cover"
                  unoptimized
                />
              ) : (
                <span className="text-[10px] text-zinc-400">No img</span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 line-clamp-1">
                  {product.display_name}
                </h2>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  Read-Only Checklist
                </span>
              </div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 flex flex-wrap items-center gap-2">
                <span>Brand: <strong className="text-zinc-700 dark:text-zinc-200">{product.brand_name}</strong></span>
                <span>•</span>
                <span>Company: <strong className="text-zinc-700 dark:text-zinc-200">{product.company_name}</strong></span>
                {product.letusto_sku && (
                  <>
                    <span>•</span>
                    <span className="font-mono">Letusto SKU: <strong className="text-zinc-700 dark:text-zinc-200">{product.letusto_sku}</strong></span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <Link
              href={`/admin/products/${product.id}`}
              target="_blank"
              className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              Catalog View ↗
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="h-8 w-8 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Modal Body: Seven Structured Sections */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs text-zinc-800 dark:text-zinc-200">
          {/* Section 1: Product Classification */}
          <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 bg-zinc-50/50 dark:bg-zinc-900/40">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2 mb-3">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-800 text-[11px] font-bold text-zinc-700 dark:text-zinc-300">
                  1
                </span>
                Product Classification
              </h3>
              <span className="text-[11px] text-zinc-400">Classification & Intended Use</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-zinc-600 dark:text-zinc-400">Product Category</span>
                  <ItemCategoryBadge type={product.category_full_path || product.category ? "existing" : "not_available"} />
                </div>
                <div className="mt-1 text-zinc-900 dark:text-zinc-100">
                  {product.category_full_path || product.category || "Data Not Available"}
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-zinc-600 dark:text-zinc-400">Regulatory Classification</span>
                  <ItemCategoryBadge
                    type={
                      product.otc_status === "NOT_OTC"
                        ? "not_applicable"
                        : product.otc_status === "OTC_REQUIRED" || product.otc_status === "POTENTIAL_OTC"
                        ? "existing"
                        : product.otc_status === "NOT_REVIEWED"
                        ? "not_reviewed"
                        : "not_available"
                    }
                  />
                </div>
                <div className="mt-1 text-zinc-900 dark:text-zinc-100">
                  {product.otc_status === "NOT_OTC"
                    ? "Standard Cosmetic (Non-OTC)"
                    : product.otc_status === "OTC_REQUIRED"
                    ? "Over-the-Counter Drug (OTC)"
                    : product.otc_status === "POTENTIAL_OTC"
                    ? "Potential OTC / Functional Product"
                    : product.otc_status === "NOT_REVIEWED"
                    ? "Not Reviewed"
                    : "Data Not Available"}
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-zinc-600 dark:text-zinc-400">Intended Use & Directions</span>
                  <ItemCategoryBadge type={product.how_to_use || product.description ? "existing" : "not_available"} />
                </div>
                <div className="mt-1 text-zinc-900 dark:text-zinc-100 line-clamp-3">
                  {product.how_to_use || product.description || "Data Not Available"}
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-zinc-600 dark:text-zinc-400">Product Claims</span>
                  <ItemCategoryBadge
                    type={
                      (product.bullet_points && product.bullet_points.length > 0) || product.hair_loss_claim
                        ? "existing"
                        : "not_available"
                    }
                  />
                </div>
                <div className="mt-1 text-zinc-900 dark:text-zinc-100 line-clamp-3">
                  {product.hair_loss_claim && (
                    <div className="text-[11px] text-amber-400 mb-0.5">
                      • Hair-loss claim: {product.hair_loss_claim}
                    </div>
                  )}
                  {product.bullet_points && product.bullet_points.length > 0
                    ? product.bullet_points.join(" • ")
                    : !product.hair_loss_claim
                    ? "Data Not Available"
                    : null}
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Product Labeling */}
          <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 bg-zinc-50/50 dark:bg-zinc-900/40">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2 mb-3">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-800 text-[11px] font-bold text-zinc-700 dark:text-zinc-300">
                  2
                </span>
                Product Labeling
              </h3>
              <span className="text-[11px] text-zinc-400">Packaging, Text & Ingredients</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-zinc-600 dark:text-zinc-400">English Product Label</span>
                  <ItemCategoryBadge type={product.ingredientsFileEnSignedUrl || product.ingredients_file_path_en ? "existing" : "not_available"} />
                </div>
                <div className="mt-1 text-zinc-900 dark:text-zinc-100">
                  {product.ingredientsFileEnSignedUrl ? (
                    <a
                      href={product.ingredientsFileEnSignedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan-400 underline hover:text-cyan-300"
                    >
                      View Uploaded English Label File ↗
                    </a>
                  ) : product.ingredients_file_path_en ? (
                    <span className="font-mono text-[11px]">{product.ingredients_file_path_en}</span>
                  ) : (
                    "Data Not Available (Future Input Required)"
                  )}
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-zinc-600 dark:text-zinc-400">Ingredient Declaration (INCI)</span>
                  <ItemCategoryBadge type={product.ingredients_text || product.ingredientsFileSignedUrl ? "existing" : "not_available"} />
                </div>
                <div className="mt-1 text-zinc-900 dark:text-zinc-100 line-clamp-3">
                  {product.ingredients_text ? (
                    product.ingredients_text
                  ) : product.ingredientsFileSignedUrl ? (
                    <a
                      href={product.ingredientsFileSignedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan-400 underline hover:text-cyan-300"
                    >
                      View Ingredients Document ↗
                    </a>
                  ) : (
                    "Data Not Available"
                  )}
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-zinc-600 dark:text-zinc-400">Net Contents</span>
                  <ItemCategoryBadge type={product.volume ? "existing" : "not_available"} />
                </div>
                <div className="mt-1 text-zinc-900 dark:text-zinc-100">
                  {product.volume ? product.volume : "Data Not Available"}
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-zinc-600 dark:text-zinc-400">Responsible Company Information</span>
                  <ItemCategoryBadge type="existing" />
                </div>
                <div className="mt-1 text-zinc-900 dark:text-zinc-100">
                  {product.company_name} ({product.company_country || "Country Not Recorded"})
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60 md:col-span-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-zinc-600 dark:text-zinc-400">Required Warnings & Precautionary Text</span>
                  <ItemCategoryBadge type="planned" />
                </div>
                <div className="mt-1 text-zinc-500 dark:text-zinc-400">
                  Mandatory warning labels review (e.g. eye contact, flammable aerosols, child safety) planned for Phase 2 workflow integration.
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: FDA Related */}
          <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 bg-zinc-50/50 dark:bg-zinc-900/40">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2 mb-3">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-800 text-[11px] font-bold text-zinc-700 dark:text-zinc-300">
                  3
                </span>
                FDA Related
              </h3>
              <span className="text-[11px] text-zinc-400">U.S. Food and Drug Administration</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-zinc-600 dark:text-zinc-400">Existing FDA Status</span>
                  <StatusBadge rawStatus={product.fda_status} configMap={FDA_STATUS_CONFIG} />
                </div>
                <div className="mt-1 text-zinc-500 dark:text-zinc-400 text-[11px]">
                  Authoritative database attribute: <code className="text-zinc-300">FDA_STATUS</code>
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-zinc-600 dark:text-zinc-400">Applicable FDA Requirements</span>
                  <ItemCategoryBadge type="existing" />
                </div>
                <div className="mt-1 text-zinc-700 dark:text-zinc-300 text-[11px]">
                  Cosmetics do not receive pre-market FDA approval, but must not be adulterated or misbranded under FD&C Act.
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60 md:col-span-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-zinc-600 dark:text-zinc-400">Existing Registration Information</span>
                  {product.certificates.some((c) => c.certificate_type === "fda_registration") ? (
                    <ItemCategoryBadge type="existing" />
                  ) : (
                    <ItemCategoryBadge type="not_available" />
                  )}
                </div>
                <div className="mt-1 text-zinc-900 dark:text-zinc-100">
                  {product.certificates.filter((c) => c.certificate_type === "fda_registration").length > 0 ? (
                    <ul className="space-y-1">
                      {product.certificates
                        .filter((c) => c.certificate_type === "fda_registration")
                        .map((c) => (
                          <li key={c.id} className="flex items-center justify-between text-xs">
                            <span>📄 {c.original_filename || "FDA Registration Certificate"} (v{c.version})</span>
                            {c.signedUrl && (
                              <a href={c.signedUrl} target="_blank" rel="noopener noreferrer" className="text-cyan-400 underline">
                                Download ↗
                              </a>
                            )}
                          </li>
                        ))}
                    </ul>
                  ) : (
                    "No FDA Registration Documents Uploaded"
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: MoCRA */}
          <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 bg-zinc-50/50 dark:bg-zinc-900/40">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2 mb-3">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-800 text-[11px] font-bold text-zinc-700 dark:text-zinc-300">
                  4
                </span>
                MoCRA (Modernization of Cosmetics Regulation Act)
              </h3>
              <span className="text-[11px] text-zinc-400">Facility & Listing Mandates</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-zinc-600 dark:text-zinc-400">Existing MoCRA Status</span>
                  <StatusBadge rawStatus={product.mocra_status} configMap={MOCRA_STATUS_CONFIG} />
                </div>
                <div className="mt-1 text-zinc-500 dark:text-zinc-400 text-[11px]">
                  Authoritative database attribute: <code className="text-zinc-300">MOCRA_STATUS</code>
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-zinc-600 dark:text-zinc-400">Facility Registration</span>
                  <ItemCategoryBadge type="planned" />
                </div>
                <div className="mt-1 text-zinc-500 dark:text-zinc-400 text-[11px]">
                  Cosmetics Direct facility registration tracking planned for Phase 2.
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-zinc-600 dark:text-zinc-400">Product Listing</span>
                  <ItemCategoryBadge type="planned" />
                </div>
                <div className="mt-1 text-zinc-500 dark:text-zinc-400 text-[11px]">
                  FDA cosmetic product listing submission record planned for Phase 2.
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-zinc-600 dark:text-zinc-400">Responsible Person</span>
                  <ItemCategoryBadge type="existing" />
                </div>
                <div className="mt-1 text-zinc-900 dark:text-zinc-100 text-[11px]">
                  {product.company_name} (U.S. Agent Designation: Future Input Required)
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60 md:col-span-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-zinc-600 dark:text-zinc-400">Safety Substantiation</span>
                  <ItemCategoryBadge type="planned" />
                </div>
                <div className="mt-1 text-zinc-500 dark:text-zinc-400 text-[11px]">
                  Documentation establishing adequate safety substantiation under MoCRA section 608 planned for Phase 2 checklist verification.
                </div>
              </div>
            </div>
          </div>

          {/* Section 5: OTC / Drug Facts */}
          <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 bg-zinc-50/50 dark:bg-zinc-900/40">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2 mb-3">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-800 text-[11px] font-bold text-zinc-700 dark:text-zinc-300">
                  5
                </span>
                OTC / Drug Facts
              </h3>
              <span className="text-[11px] text-zinc-400">Over-the-Counter Drug Mandates</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-zinc-600 dark:text-zinc-400">Existing OTC Status</span>
                  <StatusBadge rawStatus={product.otc_status} configMap={OTC_STATUS_CONFIG} />
                </div>
                <div className="mt-1 text-zinc-500 dark:text-zinc-400 text-[11px]">
                  Authoritative database attribute: <code className="text-zinc-300">OTC_STATUS</code>
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-zinc-600 dark:text-zinc-400">Drug Facts Status</span>
                  <StatusBadge rawStatus={product.drug_facts_status} configMap={DRUG_FACTS_STATUS_CONFIG} />
                </div>
                <div className="mt-1 text-zinc-500 dark:text-zinc-400 text-[11px]">
                  Authoritative database attribute: <code className="text-zinc-300">DRUG_FACTS_STATUS</code>
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-zinc-600 dark:text-zinc-400">Active Ingredients</span>
                  <ItemCategoryBadge
                    type={
                      product.otc_status === "NOT_OTC" || product.otc_status === "NOT_APPLICABLE" || product.otc_status === "NA"
                        ? "not_applicable"
                        : "not_available"
                    }
                  />
                </div>
                <div className="mt-1 text-zinc-900 dark:text-zinc-100 text-[11px]">
                  {product.otc_status === "NOT_OTC" || product.otc_status === "NOT_APPLICABLE" || product.otc_status === "NA"
                    ? "Not Applicable (Cosmetic / Non-OTC)"
                    : "Review Required for OTC monographs (Future Input Required)"}
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-zinc-600 dark:text-zinc-400">OTC Labeling Requirements</span>
                  <ItemCategoryBadge
                    type={
                      product.otc_status === "NOT_OTC" || product.otc_status === "NOT_APPLICABLE" || product.otc_status === "NA"
                        ? "not_applicable"
                        : "planned"
                    }
                  />
                </div>
                <div className="mt-1 text-zinc-900 dark:text-zinc-100 text-[11px]">
                  {product.otc_status === "NOT_OTC" || product.otc_status === "NOT_APPLICABLE" || product.otc_status === "NA"
                    ? "Not Applicable (Standard Cosmetic Labeling)"
                    : "Drug Facts Box formatting compliance review planned for Phase 2."}
                </div>
              </div>
            </div>
          </div>

          {/* Section 6: Certifications & Testing */}
          <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 bg-zinc-50/50 dark:bg-zinc-900/40">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2 mb-3">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-800 text-[11px] font-bold text-zinc-700 dark:text-zinc-300">
                  6
                </span>
                Certifications & Testing
              </h3>
              <span className="text-[11px] text-zinc-400">Laboratory Reports & Documents</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-zinc-600 dark:text-zinc-400">COA (Certificate of Analysis)</span>
                  {product.certificates.some((c) => c.certificate_type === "ingredient_certification") ? (
                    <ItemCategoryBadge type="existing" />
                  ) : (
                    <ItemCategoryBadge type="not_available" />
                  )}
                </div>
                <div className="mt-1 text-zinc-900 dark:text-zinc-100 text-[11px]">
                  {product.certificates.some((c) => c.certificate_type === "ingredient_certification")
                    ? "Uploaded in Product Documents"
                    : "Data Not Available"}
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-zinc-600 dark:text-zinc-400">SDS (Safety Data Sheet)</span>
                  <ItemCategoryBadge type="not_available" />
                </div>
                <div className="mt-1 text-zinc-900 dark:text-zinc-100 text-[11px]">
                  Data Not Available (Future Input Required)
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-zinc-600 dark:text-zinc-400">Testing Reports (Stability / Heavy Metals)</span>
                  <ItemCategoryBadge type="not_available" />
                </div>
                <div className="mt-1 text-zinc-900 dark:text-zinc-100 text-[11px]">
                  Data Not Available (Future Input Required)
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-zinc-600 dark:text-zinc-400">Other Certifications (Trademarks / Patents)</span>
                  {product.certificates.some((c) => c.certificate_type === "trademark" || c.certificate_type === "patent") ? (
                    <ItemCategoryBadge type="existing" />
                  ) : (
                    <ItemCategoryBadge type="not_available" />
                  )}
                </div>
                <div className="mt-1 text-zinc-900 dark:text-zinc-100 text-[11px]">
                  {product.certificates.filter((c) => c.certificate_type === "trademark" || c.certificate_type === "patent").length > 0
                    ? `${product.certificates.filter((c) => c.certificate_type === "trademark" || c.certificate_type === "patent").length} certificate(s) uploaded`
                    : "No Patents or Trademarks Uploaded"}
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60 md:col-span-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-zinc-600 dark:text-zinc-400">Document Expiration Dates</span>
                  <ItemCategoryBadge type="planned" />
                </div>
                <div className="mt-1 text-zinc-500 dark:text-zinc-400 text-[11px]">
                  Document lifecycle tracking and automated expiration alerts planned for Phase 2.
                </div>
              </div>
            </div>
          </div>

          {/* Section 7: Import & Customs */}
          <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 bg-zinc-50/50 dark:bg-zinc-900/40">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2 mb-3">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-800 text-[11px] font-bold text-zinc-700 dark:text-zinc-300">
                  7
                </span>
                Import & Customs
              </h3>
              <span className="text-[11px] text-zinc-400">Cross-Border Clearance Readiness</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-zinc-600 dark:text-zinc-400">HS / HTS Classification</span>
                  <ItemCategoryBadge type="not_available" />
                </div>
                <div className="mt-1 text-zinc-900 dark:text-zinc-100 text-[11px]">
                  Data Not Available (Phase 2 Tariff Classification Required)
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-zinc-600 dark:text-zinc-400">Country of Origin</span>
                  <ItemCategoryBadge type={product.origin ? "existing" : "not_available"} />
                </div>
                <div className="mt-1 text-zinc-900 dark:text-zinc-100 text-[11px]">
                  {product.origin || "Data Not Available"}
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-zinc-600 dark:text-zinc-400">Importer / Manufacturer</span>
                  <ItemCategoryBadge type="existing" />
                </div>
                <div className="mt-1 text-zinc-900 dark:text-zinc-100 text-[11px]">
                  Manufacturer: {product.company_name} · U.S. Importer: K SELECT NETWORK LLC
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-zinc-600 dark:text-zinc-400">Commercial Invoice & Packing List</span>
                  <ItemCategoryBadge type="not_applicable" />
                </div>
                <div className="mt-1 text-zinc-700 dark:text-zinc-300 text-[11px]">
                  Generated dynamically per Purchase Order / Logistics shipment (Not stored at product-level)
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60 md:col-span-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-zinc-600 dark:text-zinc-400">Applicable Import Requirements</span>
                  <ItemCategoryBadge type="existing" />
                </div>
                <div className="mt-1 text-zinc-700 dark:text-zinc-300 text-[11px]">
                  Prior Notice under FDA/BTA, CBP Entry Summary, MoCRA Compliance verification at port of entry.
                </div>
              </div>
            </div>
          </div>

          {/* Legal Safety Notice */}
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 flex items-start gap-2">
            <span className="text-sm">⚠️</span>
            <div>
              <strong className="font-semibold">Regulatory Safety Notice:</strong> This Phase 1 Compliance tool organizes existing product data for review planning and U.S. market readiness. It does NOT constitute legal counsel, FDA certification, or an automated determination of import or commercial distribution eligibility.
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/80 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
