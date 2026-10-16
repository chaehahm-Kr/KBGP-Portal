"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { saveProductComplianceReview } from "@/lib/compliance/actions";
import {
  type ComplianceReviewStatus,
  type ProductComplianceReviewItem,
  COMPLIANCE_REVIEW_STATUS_CONFIG,
} from "@/lib/compliance/types";

export function ComplianceReviewBadge({
  status,
  size = "md",
}: {
  status: ComplianceReviewStatus | string | null | undefined;
  size?: "sm" | "md";
}) {
  const normalized = (status as ComplianceReviewStatus) || "not_started";
  const cfg =
    COMPLIANCE_REVIEW_STATUS_CONFIG[normalized] ||
    COMPLIANCE_REVIEW_STATUS_CONFIG.not_started;
  const sizeClass =
    size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[11px]";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded font-medium border ${cfg.badgeClass} ${sizeClass}`}
      title={`사내 검토 상태: ${cfg.labelKo} (${cfg.labelEn}) - 정부 인증이나 법적 승인이 아닙니다`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dotClass}`} />
      <span>{cfg.labelKo}</span>
    </span>
  );
}

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

  // Authoritative linked partner inquiries
  inquiries?: Array<{
    id: string;
    case_number: string | null;
    title: string;
    status: string;
    priority?: string | null;
    is_action_required: boolean;
    updated_at: string;
  }>;

  // Internal compliance review records by section
  reviewsBySection?: Record<string, ProductComplianceReviewItem>;
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

/**
 * Six distinct information classification badges per Section 4:
 * A. Existing Product Data (Authoritative product values stored in system)
 * B. Uploaded Document (Actual uploaded certificate or label documents)
 * C. Regulatory Guidance (General explanatory regulatory info - NOT marked as existing data)
 * D. Data Not Available (Product-specific info not available)
 * E. Not Applicable (Existing explicit N/A value, not a formal legal determination)
 * F. Planned (Future features not yet implemented)
 * Plus G. Not Reviewed (Explicit unreviewed status)
 */
function ItemCategoryBadge({
  type,
}: {
  type:
    | "existing_data"
    | "uploaded_doc"
    | "regulatory_guidance"
    | "not_available"
    | "not_applicable"
    | "planned"
    | "not_reviewed";
}) {
  switch (type) {
    case "existing_data":
      return (
        <span
          title="Authoritative product value stored in system records"
          className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
        >
          Existing Product Data
        </span>
      );
    case "uploaded_doc":
      return (
        <span
          title="Product-specific document or certificate file uploaded in system"
          className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-teal-500/10 text-teal-400 border border-teal-500/30"
        >
          Uploaded Document
        </span>
      );
    case "regulatory_guidance":
      return (
        <span
          title="General explanatory regulatory guidance for review reference (Not product data)"
          className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/30"
        >
          Regulatory Guidance
        </span>
      );
    case "not_available":
      return (
        <span
          title="Product-specific information not available in authoritative source"
          className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-zinc-800 text-zinc-400 border border-zinc-700"
        >
          Data Not Available
        </span>
      );
    case "not_applicable":
      return (
        <span
          title="Explicit N/A value in system (Not an independently verified legal determination)"
          className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-zinc-800/80 text-zinc-400 border border-zinc-700/60"
        >
          Not Applicable (N/A)
        </span>
      );
    case "planned":
      return (
        <span
          title="Workflow capability planned for future compliance phase"
          className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/30"
        >
          Planned (Phase 2+)
        </span>
      );
    case "not_reviewed":
      return (
        <span
          title="Field explicitly marked as unreviewed in system"
          className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30"
        >
          Not Reviewed
        </span>
      );
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
  const [selectedLabelReviewStatus, setSelectedLabelReviewStatus] = useState("");
  const [selectedImportReadinessStatus, setSelectedImportReadinessStatus] = useState("");

  // Stored compliance reviews map by productId
  const [reviewsByProductId, setReviewsByProductId] = useState<
    Record<string, Record<string, ProductComplianceReviewItem>>
  >(() => {
    const map: Record<string, Record<string, ProductComplianceReviewItem>> = {};
    products.forEach((p) => {
      map[p.id] = { ...(p.reviewsBySection || {}) };
    });
    return map;
  });

  // Sync reviews if products prop changes
  useEffect(() => {
    setReviewsByProductId((prev) => {
      const updated = { ...prev };
      products.forEach((p) => {
        if (!updated[p.id] || Object.keys(updated[p.id]).length === 0) {
          updated[p.id] = { ...(p.reviewsBySection || {}) };
        }
      });
      return updated;
    });
  }, [products]);

  const handleReviewSaved = useCallback(
    (productId: string, savedReview: ProductComplianceReviewItem) => {
      setReviewsByProductId((prev) => {
        const prodReviews = { ...(prev[productId] || {}) };
        prodReviews[savedReview.section_id] = savedReview;
        return {
          ...prev,
          [productId]: prodReviews,
        };
      });
    },
    []
  );

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Detail Modal / Drawer
  const [selectedProduct, setSelectedProduct] = useState<ComplianceProductItem | null>(null);

  // Auto-open modal if productId is provided in URL
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const pid = params.get("productId");
    if (pid && products.length > 0) {
      const target = products.find((p) => p.id === pid);
      if (target) {
        setSelectedProduct(target);
      }
    }
  }, [products]);

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

      // 11. Advanced: Label Review Status
      if (selectedLabelReviewStatus) {
        const prodReviews = reviewsByProductId[p.id] || {};
        const secReview = prodReviews["2"] || prodReviews["product_labeling"];
        const currentStatus = secReview?.status || "not_started";
        if (currentStatus !== selectedLabelReviewStatus) return false;
      }

      // 12. Advanced: Import Readiness Status
      if (selectedImportReadinessStatus) {
        const prodReviews = reviewsByProductId[p.id] || {};
        const secReview = prodReviews["overall"] || prodReviews["7"] || prodReviews["import_customs"];
        const currentStatus = secReview?.status || "not_started";
        if (currentStatus !== selectedImportReadinessStatus) return false;
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
    selectedLabelReviewStatus,
    selectedImportReadinessStatus,
    reviewsByProductId,
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
    setSelectedLabelReviewStatus("");
    setSelectedImportReadinessStatus("");
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

        {/* Global Brand Inquiries Shortcut */}
        <div className="flex items-center gap-2">
          <Link
            href="/admin/partner-inquiries?type=brand"
            target="_blank"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-purple-500/30 bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 text-xs font-semibold transition-colors"
            title="Open Brand Inquiries in new tab"
          >
            <span>💬</span>
            <span>Brand Inquiries ↗</span>
          </Link>
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
            filterMissingInfoOnly ||
            selectedLabelReviewStatus ||
            selectedImportReadinessStatus) && (
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

              {/* Label Review Status Filter */}
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  Label Review Status
                </label>
                <select
                  value={selectedLabelReviewStatus}
                  onChange={(e) => {
                    setSelectedLabelReviewStatus(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full h-8 px-2.5 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs text-zinc-900 dark:text-zinc-100"
                >
                  <option value="">All Review Statuses</option>
                  <option value="not_started">미시작 (Not Started)</option>
                  <option value="in_review">검토 중 (In Review)</option>
                  <option value="info_requested">정보 요청 (Info Requested)</option>
                  <option value="needs_followup">후속 조치 필요 (Needs Follow-up)</option>
                  <option value="completed">내부 검토 완료 (Completed)</option>
                </select>
              </div>

              {/* Import Readiness Filter */}
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  Import Readiness
                </label>
                <select
                  value={selectedImportReadinessStatus}
                  onChange={(e) => {
                    setSelectedImportReadinessStatus(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full h-8 px-2.5 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs text-zinc-900 dark:text-zinc-100"
                >
                  <option value="">All Readiness Levels</option>
                  <option value="not_started">미시작 (Not Started)</option>
                  <option value="in_review">검토 중 (In Review)</option>
                  <option value="info_requested">정보 요청 (Info Requested)</option>
                  <option value="needs_followup">후속 조치 필요 (Needs Follow-up)</option>
                  <option value="completed">내부 검토 완료 (Completed)</option>
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
              <th className="py-3 px-3 text-right min-w-[190px]">Actions</th>
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

                  {/* Label Review (Section 2 Review Status) */}
                  <td className="py-2.5 px-3">
                    {(() => {
                      const pReviews = reviewsByProductId[p.id] || {};
                      const rev = pReviews["2"] || pReviews["product_labeling"];
                      return <ComplianceReviewBadge status={rev?.status || "not_started"} />;
                    })()}
                  </td>

                  {/* Import Readiness (Overall or Section 7 Review Status) */}
                  <td className="py-2.5 px-3">
                    {(() => {
                      const pReviews = reviewsByProductId[p.id] || {};
                      const rev = pReviews["overall"] || pReviews["7"] || pReviews["import_customs"];
                      return <ComplianceReviewBadge status={rev?.status || "not_started"} />;
                    })()}
                  </td>

                  {/* Actions: Review Checklist, Catalog, Contact Brand */}
                  <td className="py-2.5 px-3 text-right space-x-1.5 whitespace-nowrap">
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
                      data-testid={`catalog-link-${p.id}`}
                      className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                      title="Open authoritative Product Catalog editor"
                    >
                      Catalog ↗
                    </Link>
                    <Link
                      href={`/admin/partner-inquiries?type=brand&newCase=1&productId=${encodeURIComponent(p.id)}`}
                      target="_blank"
                      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium border border-purple-500/30 bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition-colors"
                      title={`Open Brand Inquiries for ${p.brand_name} (${p.company_name})`}
                    >
                      <span>Contact ↗</span>
                      {Boolean(p.inquiries && p.inquiries.length > 0) && (
                        <span className="px-1.5 py-0.2 rounded-full bg-purple-600 text-white font-mono text-[9px] font-bold" title={`${p.inquiries!.length} linked inquiry cases`}>
                          {p.inquiries!.length}
                        </span>
                      )}
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

      {/* 7. Product Compliance Checklist Detail Modal (Two-Panel Navigable Design) */}
      {selectedProduct && (
        <ComplianceDetailModal
          product={selectedProduct}
          reviews={reviewsByProductId[selectedProduct.id] || {}}
          onReviewSaved={(savedReview) => handleReviewSaved(selectedProduct.id, savedReview)}
          onClose={() => {
            setSelectedProduct(null);
            if (typeof window !== "undefined") {
              const url = new URL(window.location.href);
              if (url.searchParams.has("productId")) {
                url.searchParams.delete("productId");
                window.history.replaceState({}, "", url.pathname + (url.search ? url.search : ""));
              }
            }
          }}
        />
      )}
    </div>
  );
}

export interface ChecklistSectionConfig {
  id: string;
  badgeLabel: string;
  name: string;
  subtitle: string;
  icon: string;
  catalogTab: string;
  catalogHash: string;
}

// Checklist Sections Navigation Config including Section 0 (Overall) and Sections 1-7
const CHECKLIST_SECTIONS: readonly ChecklistSectionConfig[] = [
  {
    id: "overall",
    badgeLabel: "★",
    name: "Overall Review",
    subtitle: "Comprehensive Compliance Assessment",
    icon: "🌟",
    catalogTab: "category_attributes",
    catalogHash: "",
  },
  { 
    id: "1", 
    badgeLabel: "1",
    name: "Product Classification", 
    subtitle: "Category, Claims & Intended Use", 
    icon: "🏷️",
    catalogTab: "category_attributes",
    catalogHash: "",
  },
  { 
    id: "2", 
    badgeLabel: "2",
    name: "Product Labeling", 
    subtitle: "English Label, INCI, Net Contents", 
    icon: "📜",
    catalogTab: "basic",
    catalogHash: "",
  },
  { 
    id: "3", 
    badgeLabel: "3",
    name: "FDA Related", 
    subtitle: "FDA Requirements & Registrations", 
    icon: "🏛️",
    catalogTab: "category_attributes",
    catalogHash: "#attr-FDA_STATUS",
  },
  { 
    id: "4", 
    badgeLabel: "4",
    name: "MoCRA", 
    subtitle: "Facility & Product Listing Mandates", 
    icon: "📋",
    catalogTab: "category_attributes",
    catalogHash: "#attr-MOCRA_STATUS",
  },
  { 
    id: "5", 
    badgeLabel: "5",
    name: "OTC / Drug Facts", 
    subtitle: "OTC Monographs & Drug Facts", 
    icon: "💊",
    catalogTab: "category_attributes",
    catalogHash: "#attr-OTC_STATUS",
  },
  { 
    id: "6", 
    badgeLabel: "6",
    name: "Certifications & Testing", 
    subtitle: "COA, SDS, Testing Reports & Patents", 
    icon: "🔬",
    catalogTab: "certs",
    catalogHash: "",
  },
  { 
    id: "7", 
    badgeLabel: "7",
    name: "Import & Customs", 
    subtitle: "Country of Origin, Tariff & Clearance", 
    icon: "🚢",
    catalogTab: "logistics",
    catalogHash: "",
  },
] as const;

function getCatalogSectionUrl(productId: string, tab: string, hash?: string) {
  const base = `/admin/products/${productId}`;
  const query = tab ? `?tab=${tab}` : "";
  const fragment = hash ? (hash.startsWith("#") ? hash : `#${hash}`) : "";
  return `${base}${query}${fragment}`;
}

function SectionInternalReviewPanel({
  productId,
  sectionId,
  sectionName,
  review,
  linkedInquiries,
  onSaved,
  brandName,
  companyName,
}: {
  productId: string;
  sectionId: string;
  sectionName: string;
  review?: ProductComplianceReviewItem;
  linkedInquiries: NonNullable<ComplianceProductItem["inquiries"]>;
  onSaved: (savedReview: ProductComplianceReviewItem) => void;
  brandName: string;
  companyName: string;
}) {
  const [status, setStatus] = useState<ComplianceReviewStatus>(review?.status || "not_started");
  const [notes, setNotes] = useState<string>(review?.notes || "");
  const [evidenceReference, setEvidenceReference] = useState<string>(review?.evidence_reference || "");
  const [relatedInquiryId, setRelatedInquiryId] = useState<string>(review?.related_inquiry_id || "");
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Sync state whenever active section or persisted review changes
  useEffect(() => {
    setStatus(review?.status || "not_started");
    setNotes(review?.notes || "");
    setEvidenceReference(review?.evidence_reference || "");
    setRelatedInquiryId(review?.related_inquiry_id || "");
    setFeedback(null);
  }, [sectionId, review]);

  const hasChanges = useMemo(() => {
    const origStatus = review?.status || "not_started";
    const origNotes = review?.notes || "";
    const origEvidence = review?.evidence_reference || "";
    const origInq = review?.related_inquiry_id || "";
    return (
      status !== origStatus ||
      notes !== origNotes ||
      evidenceReference !== origEvidence ||
      relatedInquiryId !== origInq
    );
  }, [status, notes, evidenceReference, relatedInquiryId, review]);

  const handleReset = () => {
    setStatus(review?.status || "not_started");
    setNotes(review?.notes || "");
    setEvidenceReference(review?.evidence_reference || "");
    setRelatedInquiryId(review?.related_inquiry_id || "");
    setFeedback(null);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setFeedback(null);
    try {
      const res = await saveProductComplianceReview({
        productId,
        sectionId,
        status,
        notes: notes || null,
        evidenceReference: evidenceReference || null,
        relatedInquiryId: relatedInquiryId || null,
      });

      if (!res.success || !res.review) {
        setFeedback({
          type: "error",
          message: res.error || "검토 내용 저장에 실패했습니다.",
        });
      } else {
        setFeedback({
          type: "success",
          message: "검토 상태 및 사내 메모가 안전하게 저장되었습니다.",
        });
        onSaved(res.review);
      }
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: err?.message || "네트워크 또는 서버 통신 오류가 발생했습니다.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-700/80 bg-zinc-50/70 dark:bg-zinc-800/40 p-4 space-y-3.5 shadow-sm">
      {/* Panel Top: Title, Saved Status Badge, Reviewer Info */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-zinc-200 dark:border-zinc-700/60">
        <div className="flex items-center gap-2">
          <span className="text-base">📋</span>
          <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
            Internal Compliance Review · {sectionName}
          </h4>
          <ComplianceReviewBadge status={review?.status || "not_started"} size="sm" />
        </div>

        <div className="text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5 flex-wrap">
          {review ? (
            <>
              <span>검토자:</span>
              <strong className="text-zinc-700 dark:text-zinc-200 font-medium">
                {review.reviewer?.name || review.reviewer?.email || "Admin Staff"}
              </strong>
              <span>•</span>
              <span>최근 검토:</span>
              <span className="font-mono text-zinc-700 dark:text-zinc-300">
                {new Date(review.last_reviewed_at).toLocaleDateString("ko-KR", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </>
          ) : (
            <span className="italic text-zinc-400">아직 저장된 사내 검토 없음 (미시작)</span>
          )}
        </div>
      </div>

      {/* Form Controls Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {/* Review Status Selector */}
        <div>
          <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
            Review Status (검토 상태) <span className="text-rose-500">*</span>
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as ComplianceReviewStatus)}
            className="w-full h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 font-medium focus:outline-none focus:ring-2 focus:ring-zinc-400"
          >
            <option value="not_started">미시작 (Not Started)</option>
            <option value="in_review">검토 중 (In Review)</option>
            <option value="info_requested">정보 요청 (Info Requested)</option>
            <option value="needs_followup">후속 조치 필요 (Needs Follow-up)</option>
            <option value="completed">내부 검토 완료 (Review Completed)</option>
          </select>
        </div>

        {/* Linked Brand Inquiry Selector */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Linked Brand Inquiry (연계 문의)
            </label>
            {relatedInquiryId ? (
              <Link
                href={`/admin/partner-inquiries?type=brand&id=${encodeURIComponent(relatedInquiryId)}`}
                target="_blank"
                className="text-[10.5px] font-semibold text-purple-600 dark:text-purple-400 hover:underline"
              >
                문의 열기 ↗
              </Link>
            ) : (
              <Link
                href={`/admin/partner-inquiries?type=brand&newCase=1&productId=${encodeURIComponent(productId)}&section=${encodeURIComponent(sectionId)}`}
                target="_blank"
                className="text-[10.5px] font-semibold text-purple-600 dark:text-purple-400 hover:underline"
              >
                + 새 문의 작성 ↗
              </Link>
            )}
          </div>
          <select
            value={relatedInquiryId}
            onChange={(e) => setRelatedInquiryId(e.target.value)}
            className="w-full h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 font-medium focus:outline-none focus:ring-2 focus:ring-zinc-400"
          >
            <option value="">(연결된 문의 없음 / None)</option>
            {linkedInquiries.map((inq) => (
              <option key={inq.id} value={inq.id}>
                [{inq.case_number || "NO-CASE"}] {inq.title} ({inq.status})
              </option>
            ))}
          </select>
        </div>

        {/* Evidence Reference Input */}
        <div className="md:col-span-2">
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Evidence Reference (증빙 문서/자료 참조)
            </label>
            <span
              className={`text-[10.5px] font-mono ${
                evidenceReference.length > 450 ? "text-amber-500 font-bold" : "text-zinc-400"
              }`}
            >
              {evidenceReference.length} / 500자
            </span>
          </div>
          <input
            type="text"
            value={evidenceReference}
            maxLength={500}
            onChange={(e) => setEvidenceReference(e.target.value)}
            placeholder="예: FDA 시설등록 번호 / SDS v2.1 승인서 / 국문 라벨 번역본 검수완료 / 미생물 성적서 등"
            className="w-full h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400 placeholder:text-zinc-400"
          />
        </div>

        {/* Internal Review Notes Textarea */}
        <div className="md:col-span-2">
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Internal Review Notes (사내 검토 메모 — 비공개)
            </label>
            <span
              className={`text-[10.5px] font-mono ${
                notes.length > 1800 ? "text-amber-500 font-bold" : "text-zinc-400"
              }`}
            >
              {notes.length} / 2,000자
            </span>
          </div>
          <textarea
            rows={3}
            value={notes}
            maxLength={2000}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="규제 준수 상태 확인 의견, 브랜드에 요청한 사항, 보완 필요 조치 내역 등 관리자 전용 사내 메모를 입력하세요 (포털 사용자에게 노출되지 않음)..."
            className="w-full p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400 placeholder:text-zinc-400 leading-relaxed resize-y"
          />
        </div>
      </div>

      {/* Safety Notice & Non-Approval Legal Disclaimer */}
      <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 flex items-start gap-2">
        <span className="text-sm shrink-0">⚠️</span>
        <div className="leading-relaxed">
          <strong className="font-semibold">법적 고지:</strong> 사내 '내부 검토 완료(Completed)'는 K SELECT NETWORK의 내부 규정 준수 검토 기록을 의미하며, FDA 승인, 미국 정부 기관의 법적 인증, 또는 상업적 통관/판매 허가를 보증하지 않습니다.
        </div>
      </div>

      {/* Action Bar: Feedback Message & Save/Reset Buttons */}
      <div className="flex items-center justify-between gap-3 pt-1">
        <div className="flex-1 min-w-0">
          {feedback && (
            <div
              className={`text-xs font-medium flex items-center gap-1.5 truncate ${
                feedback.type === "success" ? "text-emerald-500 dark:text-emerald-400" : "text-rose-500 dark:text-rose-400"
              }`}
            >
              <span>{feedback.type === "success" ? "✓" : "⚠️"}</span>
              <span className="truncate">{feedback.message}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {hasChanges && (
            <button
              type="button"
              disabled={isSaving}
              onClick={handleReset}
              className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              원래대로
            </button>
          )}

          <button
            type="button"
            disabled={isSaving || !hasChanges}
            onClick={handleSave}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
          >
            {isSaving ? (
              <>
                <span className="h-3 w-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                <span>저장 중...</span>
              </>
            ) : (
              <span>검토 저장 (Save Review)</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function ComplianceDetailModal({
  product,
  reviews,
  onReviewSaved,
  onClose,
}: {
  product: ComplianceProductItem;
  reviews: Record<string, ProductComplianceReviewItem>;
  onReviewSaved: (savedReview: ProductComplianceReviewItem) => void;
  onClose: () => void;
}) {
  const [activeSectionId, setActiveSectionId] = useState<string>("overall");

  // Keyboard navigation: Escape to close, Arrow keys to navigate sections cyclically
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        setActiveSectionId((curr) => {
          const idx = CHECKLIST_SECTIONS.findIndex((s) => s.id === curr);
          const nextIdx = idx < CHECKLIST_SECTIONS.length - 1 ? idx + 1 : 0;
          return CHECKLIST_SECTIONS[nextIdx].id;
        });
      } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        setActiveSectionId((curr) => {
          const idx = CHECKLIST_SECTIONS.findIndex((s) => s.id === curr);
          const prevIdx = idx > 0 ? idx - 1 : CHECKLIST_SECTIONS.length - 1;
          return CHECKLIST_SECTIONS[prevIdx].id;
        });
      }
    },
    [onClose]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const activeSection = CHECKLIST_SECTIONS.find((s) => s.id === activeSectionId) || CHECKLIST_SECTIONS[0];

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm animate-fadeIn"
    >
      <div className="relative w-full max-w-5xl h-[88vh] bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-3.5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-4 bg-zinc-50/90 dark:bg-zinc-900/90 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-11 w-11 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 overflow-hidden flex-shrink-0 flex items-center justify-center">
              {product.photoUrl ? (
                <Image
                  src={product.photoUrl}
                  alt={product.display_name}
                  width={44}
                  height={44}
                  className="h-full w-full object-cover"
                  unoptimized
                />
              ) : (
                <span className="text-[10px] text-zinc-400">No img</span>
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 truncate" title={product.display_name}>
                  {product.display_name}
                </h2>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shrink-0">
                  Read-Only Checklist
                </span>
              </div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 flex flex-wrap items-center gap-2 truncate">
                <span>Brand: <strong className="text-zinc-700 dark:text-zinc-200">{product.brand_name}</strong></span>
                <span>•</span>
                <span>Company: <strong className="text-zinc-700 dark:text-zinc-200">{product.company_name}</strong></span>
                {product.letusto_sku && (
                  <>
                    <span>•</span>
                    <span className="font-mono text-zinc-700 dark:text-zinc-300">SKU: {product.letusto_sku}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Header Action Shortcuts */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Contact Brand Shortcut (Reuses existing Brand Inquiries) */}
            <Link
              href={`/admin/partner-inquiries?type=brand&newCase=1&productId=${encodeURIComponent(product.id)}&section=${activeSectionId}`}
              target="_blank"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-purple-500/40 bg-purple-500/15 text-purple-300 hover:bg-purple-500/25 text-xs font-semibold transition-colors"
              title={`Open Brand Inquiries for ${product.brand_name} (${product.company_name})`}
            >
              <span>💬</span>
              <span>Contact Brand ↗</span>
            </Link>

            {/* Catalog View Link */}
            <Link
              href={`/admin/products/${product.id}`}
              target="_blank"
              data-testid="modal-catalog-view-btn"
              className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              title="Open authoritative Product Catalog editor"
            >
              Catalog View ↗
            </Link>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="h-8 w-8 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              title="Close modal (Esc)"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Modal Body: Two-Panel Grid (Left: 7-Section Nav, Right: Selected Section Detail) */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 min-h-0 overflow-hidden">
          {/* Left Panel: Seven-Section Navigation List */}
          <div className="md:col-span-4 lg:col-span-4 border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 p-4 flex flex-col justify-between overflow-y-auto">
            <div className="space-y-1.5">
              <div className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider px-2 mb-2">
                Checklist Sections ({CHECKLIST_SECTIONS.length})
              </div>

              {CHECKLIST_SECTIONS.map((sec) => {
                const isSelected = sec.id === activeSectionId;
                const secReview = reviews[sec.id];
                return (
                  <button
                    key={sec.id}
                    type="button"
                    onClick={() => setActiveSectionId(sec.id)}
                    className={`w-full text-left p-2.5 rounded-xl transition-all flex items-center justify-between gap-2.5 cursor-pointer ${
                      isSelected
                        ? "bg-zinc-900 text-white dark:bg-zinc-800 dark:text-zinc-100 shadow-sm border border-zinc-700/80"
                        : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 border border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <span
                        className={`flex h-6 w-6 items-center justify-center rounded-lg text-xs font-bold shrink-0 ${
                          isSelected
                            ? "bg-cyan-500 text-black font-extrabold"
                            : "bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                        }`}
                      >
                        {sec.badgeLabel}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold truncate">{sec.name}</div>
                        <div
                          className={`text-[10px] truncate ${
                            isSelected ? "text-zinc-300 dark:text-zinc-400" : "text-zinc-400 dark:text-zinc-500"
                          }`}
                        >
                          {sec.subtitle}
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0">
                      <ComplianceReviewBadge
                        status={secReview?.status || "not_started"}
                        size="sm"
                      />
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Contextual Brand Inquiry Notice in Left Panel */}
            <div className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800/40 text-[11px] space-y-2 mt-4 shrink-0">
              <div className="font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                <span>💬</span>
                <span>Contact Brand Shortcut</span>
              </div>
              <p className="text-zinc-500 dark:text-zinc-400 text-[10.5px] leading-relaxed">
                Need regulatory certificates or missing label files from <strong className="text-zinc-700 dark:text-zinc-300">{product.company_name}</strong>?
              </p>
              <Link
                href={`/admin/partner-inquiries?type=brand&newCase=1&productId=${encodeURIComponent(product.id)}&section=${activeSectionId}`}
                target="_blank"
                className="inline-flex items-center justify-center w-full px-2.5 py-1.5 rounded-lg border border-purple-500/30 bg-purple-500/10 text-purple-300 text-xs font-semibold hover:bg-purple-500/20 transition-colors"
              >
                Open Brand Inquiries ↗
              </Link>
            </div>

            {/* Linked Inquiries (if any exist for this product) */}
            {Boolean(product.inquiries && product.inquiries.length > 0) && (
              <div className="p-3 rounded-xl border border-purple-200/60 dark:border-purple-900/50 bg-purple-50/50 dark:bg-purple-950/20 text-[11px] space-y-2 mt-3 shrink-0">
                <div className="flex items-center justify-between font-semibold text-purple-900 dark:text-purple-300">
                  <span className="flex items-center gap-1.5">
                    <span>📨</span>
                    <span>연계 문의 ({product.inquiries!.length})</span>
                  </span>
                  <Link
                    href={`/admin/partner-inquiries?type=brand`}
                    target="_blank"
                    className="text-[10px] text-purple-600 dark:text-purple-400 hover:underline"
                  >
                    전체 ↗
                  </Link>
                </div>
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-0.5">
                  {product.inquiries!.map((inq) => (
                    <Link
                      key={inq.id}
                      href={`/admin/partner-inquiries?type=brand&id=${encodeURIComponent(inq.id)}`}
                      target="_blank"
                      className="block p-2 rounded-lg bg-white dark:bg-zinc-900 border border-purple-100 dark:border-purple-900/40 hover:border-purple-300 dark:hover:border-purple-700 transition-colors shadow-2xs"
                    >
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="font-mono font-bold text-purple-700 dark:text-purple-400 truncate">
                          {inq.case_number || "No Case #"}
                        </span>
                        <span className={`px-1.5 py-0.2 rounded text-[9px] font-semibold uppercase ${
                          inq.is_action_required ? "bg-rose-500/10 text-rose-500 border border-rose-500/20" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"
                        }`}>
                          {inq.status}
                        </span>
                      </div>
                      <div className="text-[11px] font-medium text-zinc-800 dark:text-zinc-200 truncate mt-0.5" title={inq.title}>
                        {inq.title}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Panel: Selected Section Detail Content */}
          <div className="md:col-span-8 lg:col-span-8 p-6 overflow-y-auto flex flex-col justify-between space-y-6">
            <div className="space-y-5">
              {/* Section Header */}
              <div className="border-b border-zinc-200 dark:border-zinc-800 pb-3 flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{activeSection.icon}</span>
                    <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                      {activeSection.name}
                    </h3>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    {activeSection.subtitle}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    href={getCatalogSectionUrl(product.id, activeSection.catalogTab, activeSection.catalogHash)}
                    target="_blank"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 text-xs font-semibold transition-colors"
                    title={`Edit ${activeSection.name} in Product Catalog`}
                    data-testid={`section-${activeSection.id}-edit-catalog`}
                  >
                    <span>✏️</span>
                    <span>Edit in Product Catalog ↗</span>
                  </Link>
                  <span className="text-[11px] font-mono text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
                    {activeSection.id === "overall" ? "Overall Assessment" : `Section ${activeSection.badgeLabel} of 7`}
                  </span>
                </div>
              </div>

              {/* Internal Compliance Review Card (Rendered for active section) */}
              <SectionInternalReviewPanel
                productId={product.id}
                sectionId={activeSection.id}
                sectionName={activeSection.name}
                review={reviews[activeSection.id]}
                linkedInquiries={product.inquiries || []}
                onSaved={onReviewSaved}
                brandName={product.brand_name}
                companyName={product.company_name}
              />

              {/* SECTION: Overall Review Summary */}
              {activeSectionId === "overall" && (
                <div className="space-y-4 pt-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                      Checklist Sections Summary (7개 섹션 진행 현황)
                    </h4>
                    <span className="text-[11px] text-zinc-400">
                      섹션을 클릭하여 상세 정보와 내부 검토를 진행하세요
                    </span>
                  </div>

                  <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden divide-y divide-zinc-200 dark:divide-zinc-800 bg-white dark:bg-zinc-900/60">
                    {CHECKLIST_SECTIONS.filter((s) => s.id !== "overall").map((sec) => {
                      const secReview = reviews[sec.id];
                      return (
                        <div
                          key={sec.id}
                          className="p-3.5 flex items-center justify-between gap-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="flex h-6 w-6 items-center justify-center rounded-lg text-xs font-bold shrink-0 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                              {sec.badgeLabel}
                            </span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm">{sec.icon}</span>
                                <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">
                                  {sec.name}
                                </span>
                              </div>
                              <p className="text-[10.5px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                                {sec.subtitle}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            <ComplianceReviewBadge status={secReview?.status || "not_started"} size="sm" />
                            <button
                              type="button"
                              onClick={() => setActiveSectionId(sec.id)}
                              className="text-xs font-semibold text-cyan-500 hover:text-cyan-400 hover:underline flex items-center gap-1"
                            >
                              <span>검토 이동 →</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* SECTION 1: Product Classification */}
              {activeSectionId === "1" && (
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-zinc-700 dark:text-zinc-300">Product Category</span>
                      <div className="flex items-center gap-2">
                        <ItemCategoryBadge type={product.category_full_path || product.category ? "existing_data" : "not_available"} />
                        <Link
                          href={getCatalogSectionUrl(product.id, "category_attributes")}
                          target="_blank"
                          className="text-[11px] font-medium text-cyan-400 hover:underline hover:text-cyan-300 flex items-center gap-0.5"
                          title="Edit Category in Product Catalog"
                          data-testid="edit-category-link"
                        >
                          Edit ↗
                        </Link>
                      </div>
                    </div>
                    <div className="mt-1.5 text-xs text-zinc-900 dark:text-zinc-100 font-medium">
                      {product.category_full_path || product.category || "Data Not Available"}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-zinc-700 dark:text-zinc-300">Regulatory Classification</span>
                      <div className="flex items-center gap-2">
                        <ItemCategoryBadge
                          type={
                            product.otc_status === "NOT_OTC"
                              ? "not_applicable"
                              : product.otc_status === "OTC_REQUIRED" || product.otc_status === "POTENTIAL_OTC"
                              ? "existing_data"
                              : product.otc_status === "NOT_REVIEWED"
                              ? "not_reviewed"
                              : "not_available"
                          }
                        />
                        <Link
                          href={getCatalogSectionUrl(product.id, "category_attributes", "#attr-OTC_STATUS")}
                          target="_blank"
                          className="text-[11px] font-medium text-cyan-400 hover:underline hover:text-cyan-300 flex items-center gap-0.5"
                          title="Edit Regulatory Classification in Product Catalog"
                          data-testid="edit-classification-link"
                        >
                          Edit ↗
                        </Link>
                      </div>
                    </div>
                    <div className="mt-1.5 text-xs text-zinc-900 dark:text-zinc-100 font-medium">
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

                  <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-zinc-700 dark:text-zinc-300">Intended Use & Directions</span>
                      <ItemCategoryBadge type={product.how_to_use || product.description ? "existing_data" : "not_available"} />
                    </div>
                    <div className="mt-1.5 text-xs text-zinc-900 dark:text-zinc-100 line-clamp-4 leading-relaxed">
                      {product.how_to_use || product.description || "Data Not Available"}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-zinc-700 dark:text-zinc-300">Product Claims</span>
                      <ItemCategoryBadge
                        type={
                          (product.bullet_points && product.bullet_points.length > 0) || product.hair_loss_claim
                            ? "existing_data"
                            : "not_available"
                        }
                      />
                    </div>
                    <div className="mt-1.5 text-xs text-zinc-900 dark:text-zinc-100 leading-relaxed">
                      {product.hair_loss_claim && (
                        <div className="text-amber-400 mb-1">
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

                  {/* General Regulatory Guidance Card */}
                  <div className="p-3 rounded-xl bg-sky-500/5 border border-sky-500/20 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-sky-400">Classification Regulatory Context</span>
                      <ItemCategoryBadge type="regulatory_guidance" />
                    </div>
                    <p className="text-zinc-400 dark:text-zinc-400 leading-relaxed text-[11px]">
                      Under U.S. law, product classification depends on intended use, claims, and active ingredients. Articles intended only to cleanse, beautify, or alter appearance are cosmetics under MoCRA; articles intended to affect bodily structure or function or treat/prevent conditions are drugs (OTC).
                    </p>
                  </div>
                </div>
              )}

              {/* SECTION 2: Product Labeling */}
              {activeSectionId === "2" && (
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-zinc-700 dark:text-zinc-300">English Product Label</span>
                      <div className="flex items-center gap-2">
                        <ItemCategoryBadge type={product.ingredientsFileEnSignedUrl || product.ingredients_file_path_en ? "uploaded_doc" : "not_available"} />
                        <Link
                          href={getCatalogSectionUrl(product.id, "media")}
                          target="_blank"
                          className="text-[11px] font-medium text-cyan-400 hover:underline hover:text-cyan-300 flex items-center gap-0.5"
                          title="Upload or manage English label file in Product Catalog"
                          data-testid="edit-label-file-link"
                        >
                          Edit ↗
                        </Link>
                      </div>
                    </div>
                    <div className="mt-1.5 text-xs text-zinc-900 dark:text-zinc-100">
                      {product.ingredientsFileEnSignedUrl ? (
                        <a
                          href={product.ingredientsFileEnSignedUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-cyan-400 underline hover:text-cyan-300 flex items-center gap-1"
                        >
                          <span>📄</span>
                          <span>View Uploaded English Label File ↗</span>
                        </a>
                      ) : product.ingredients_file_path_en ? (
                        <span className="font-mono text-[11px]">{product.ingredients_file_path_en}</span>
                      ) : (
                        "Data Not Available (Future Input Required)"
                      )}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-zinc-700 dark:text-zinc-300">Ingredient Declaration (INCI)</span>
                      <div className="flex items-center gap-2">
                        <ItemCategoryBadge
                          type={
                            product.ingredients_text
                              ? "existing_data"
                              : product.ingredientsFileSignedUrl
                              ? "uploaded_doc"
                              : "not_available"
                          }
                        />
                        <Link
                          href={getCatalogSectionUrl(product.id, "basic")}
                          target="_blank"
                          className="text-[11px] font-medium text-cyan-400 hover:underline hover:text-cyan-300 flex items-center gap-0.5"
                          title="Edit ingredients in Product Catalog"
                          data-testid="edit-ingredients-link"
                        >
                          Edit ↗
                        </Link>
                      </div>
                    </div>
                    <div className="mt-1.5 text-xs text-zinc-900 dark:text-zinc-100 leading-relaxed">
                      {product.ingredients_text ? (
                        <p className="line-clamp-4">{product.ingredients_text}</p>
                      ) : product.ingredientsFileSignedUrl ? (
                        <a
                          href={product.ingredientsFileSignedUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-cyan-400 underline hover:text-cyan-300 flex items-center gap-1"
                        >
                          <span>📄</span>
                          <span>View Ingredients Document ↗</span>
                        </a>
                      ) : (
                        "Data Not Available"
                      )}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-zinc-700 dark:text-zinc-300">Net Contents</span>
                      <div className="flex items-center gap-2">
                        <ItemCategoryBadge type={product.volume ? "existing_data" : "not_available"} />
                        <Link
                          href={getCatalogSectionUrl(product.id, "basic")}
                          target="_blank"
                          className="text-[11px] font-medium text-cyan-400 hover:underline hover:text-cyan-300 flex items-center gap-0.5"
                          title="Edit net contents/volume in Product Catalog"
                          data-testid="edit-volume-link"
                        >
                          Edit ↗
                        </Link>
                      </div>
                    </div>
                    <div className="mt-1.5 text-xs text-zinc-900 dark:text-zinc-100 font-medium">
                      {product.volume ? product.volume : "Data Not Available"}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-zinc-700 dark:text-zinc-300">Responsible Company Information</span>
                      <ItemCategoryBadge type="existing_data" />
                    </div>
                    <div className="mt-1.5 text-xs text-zinc-900 dark:text-zinc-100 font-medium">
                      {product.company_name} ({product.company_country || "Country Not Recorded"})
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-zinc-700 dark:text-zinc-300">Required Warnings & Precautionary Statements</span>
                      <ItemCategoryBadge type="planned" />
                    </div>
                    <div className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                      Mandatory cosmetic warning labels (e.g. eye safety, flammable propellants, patch test cautions) review workflow planned for Phase 2.
                    </div>
                  </div>

                  {/* General Regulatory Guidance Card */}
                  <div className="p-3 rounded-xl bg-sky-500/5 border border-sky-500/20 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-sky-400">Labeling Regulatory Requirements</span>
                      <ItemCategoryBadge type="regulatory_guidance" />
                    </div>
                    <p className="text-zinc-400 dark:text-zinc-400 leading-relaxed text-[11px]">
                      U.S. cosmetic labels must prominently state all required information in English, display ingredients in descending order using standard INCI nomenclature, declare net quantity in both U.S. Customary and Metric units, and identify the responsible distributor/importer.
                    </p>
                  </div>
                </div>
              )}

              {/* SECTION 3: FDA Related */}
              {activeSectionId === "3" && (
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-zinc-700 dark:text-zinc-300">Existing FDA Status</span>
                      <div className="flex items-center gap-2">
                        <StatusBadge rawStatus={product.fda_status} configMap={FDA_STATUS_CONFIG} />
                        <Link
                          href={getCatalogSectionUrl(product.id, "category_attributes", "#attr-FDA_STATUS")}
                          target="_blank"
                          className="text-[11px] font-medium text-cyan-400 hover:underline hover:text-cyan-300 flex items-center gap-0.5"
                          title="Edit FDA_STATUS in Product Catalog"
                          data-testid="edit-fda-status-link"
                        >
                          Edit ↗
                        </Link>
                      </div>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
                      <div>Authoritative database attribute: <code className="text-zinc-300">FDA_STATUS</code></div>
                      <span className="text-[10px] text-zinc-400">Edits saved in Product Catalog</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-zinc-700 dark:text-zinc-300">Existing FDA Registration Documents</span>
                      <div className="flex items-center gap-2">
                        <ItemCategoryBadge
                          type={
                            product.certificates.some((c) => c.certificate_type === "fda_registration")
                              ? "uploaded_doc"
                              : "not_available"
                          }
                        />
                        <Link
                          href={getCatalogSectionUrl(product.id, "certs")}
                          target="_blank"
                          className="text-[11px] font-medium text-cyan-400 hover:underline hover:text-cyan-300 flex items-center gap-0.5"
                          title="Manage certificates in Product Catalog"
                          data-testid="edit-certs-fda-link"
                        >
                          Manage ↗
                        </Link>
                      </div>
                    </div>
                    <div className="mt-1.5 text-xs text-zinc-900 dark:text-zinc-100">
                      {product.certificates.filter((c) => c.certificate_type === "fda_registration").length > 0 ? (
                        <ul className="space-y-1.5">
                          {product.certificates
                            .filter((c) => c.certificate_type === "fda_registration")
                            .map((c) => (
                              <li key={c.id} className="flex items-center justify-between text-xs p-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-md">
                                <span>📄 {c.original_filename || "FDA Registration Certificate"} (v{c.version})</span>
                                {c.signedUrl && (
                                  <a href={c.signedUrl} target="_blank" rel="noopener noreferrer" className="text-cyan-400 underline hover:text-cyan-300">
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

                  {/* General Regulatory Guidance Card */}
                  <div className="p-3 rounded-xl bg-sky-500/5 border border-sky-500/20 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-sky-400">Applicable FDA Safety & Adulteration Requirements</span>
                      <ItemCategoryBadge type="regulatory_guidance" />
                    </div>
                    <p className="text-zinc-400 dark:text-zinc-400 leading-relaxed text-[11px]">
                      Under the Federal Food, Drug, and Cosmetic Act (FD&C Act), cosmetics do not undergo pre-market FDA approval (except color additives). However, products must not be adulterated (injurious to users) or misbranded (false or deceptive). The manufacturer holds legal liability for product safety.
                    </p>
                  </div>
                </div>
              )}

              {/* SECTION 4: MoCRA */}
              {activeSectionId === "4" && (
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-zinc-700 dark:text-zinc-300">Existing MoCRA Status</span>
                      <div className="flex items-center gap-2">
                        <StatusBadge rawStatus={product.mocra_status} configMap={MOCRA_STATUS_CONFIG} />
                        <Link
                          href={getCatalogSectionUrl(product.id, "category_attributes", "#attr-MOCRA_STATUS")}
                          target="_blank"
                          className="text-[11px] font-medium text-cyan-400 hover:underline hover:text-cyan-300 flex items-center gap-0.5"
                          title="Edit MOCRA_STATUS in Product Catalog"
                          data-testid="edit-mocra-status-link"
                        >
                          Edit ↗
                        </Link>
                      </div>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
                      <div>Authoritative database attribute: <code className="text-zinc-300">MOCRA_STATUS</code></div>
                      <span className="text-[10px] text-zinc-400">Edits saved in Product Catalog</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-zinc-700 dark:text-zinc-300">Facility Registration (MoCRA § 605)</span>
                      <ItemCategoryBadge type="planned" />
                    </div>
                    <div className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                      Mandatory biennial cosmetic manufacturing/processing facility registration via FDA Cosmetics Direct. Structured verification planned for Phase 2.
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-zinc-700 dark:text-zinc-300">Cosmetic Product Listing (MoCRA § 607)</span>
                      <ItemCategoryBadge type="planned" />
                    </div>
                    <div className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                      Mandatory product listing submission to FDA (including product category, ingredients, and facility info). Systematic tracking planned for Phase 2.
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-zinc-700 dark:text-zinc-300">Responsible Person & U.S. Agent</span>
                      <ItemCategoryBadge type="existing_data" />
                    </div>
                    <div className="mt-1.5 text-xs text-zinc-900 dark:text-zinc-100 font-medium">
                      Responsible Entity: {product.company_name} · U.S. Agent Designation: Future Input Required
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-zinc-700 dark:text-zinc-300">Safety Substantiation (MoCRA § 608)</span>
                      <ItemCategoryBadge type="planned" />
                    </div>
                    <div className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                      Requirement to maintain records supporting adequate safety substantiation for each cosmetic formulation prior to distribution. Audit tracking planned for Phase 2.
                    </div>
                  </div>

                  {/* General Regulatory Guidance Card */}
                  <div className="p-3 rounded-xl bg-sky-500/5 border border-sky-500/20 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-sky-400">MoCRA Statutory Context</span>
                      <ItemCategoryBadge type="regulatory_guidance" />
                    </div>
                    <p className="text-zinc-400 dark:text-zinc-400 leading-relaxed text-[11px]">
                      Enacted in December 2022, the Modernization of Cosmetics Regulation Act expands FDA oversight to mandatory facility registration, cosmetic listing, safety records, and serious adverse event reporting within 15 business days.
                    </p>
                  </div>
                </div>
              )}

              {/* SECTION 5: OTC / Drug Facts */}
              {activeSectionId === "5" && (
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-zinc-700 dark:text-zinc-300">Existing OTC Status</span>
                      <div className="flex items-center gap-2">
                        <StatusBadge rawStatus={product.otc_status} configMap={OTC_STATUS_CONFIG} />
                        <Link
                          href={getCatalogSectionUrl(product.id, "category_attributes", "#attr-OTC_STATUS")}
                          target="_blank"
                          className="text-[11px] font-medium text-cyan-400 hover:underline hover:text-cyan-300 flex items-center gap-0.5"
                          title="Edit OTC_STATUS in Product Catalog"
                          data-testid="edit-otc-status-link"
                        >
                          Edit ↗
                        </Link>
                      </div>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
                      <div>Authoritative database attribute: <code className="text-zinc-300">OTC_STATUS</code></div>
                      <span className="text-[10px] text-zinc-400">Edits saved in Product Catalog</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-zinc-700 dark:text-zinc-300">Drug Facts Status</span>
                      <div className="flex items-center gap-2">
                        <StatusBadge rawStatus={product.drug_facts_status} configMap={DRUG_FACTS_STATUS_CONFIG} />
                        <Link
                          href={getCatalogSectionUrl(product.id, "category_attributes", "#attr-DRUG_FACTS_STATUS")}
                          target="_blank"
                          className="text-[11px] font-medium text-cyan-400 hover:underline hover:text-cyan-300 flex items-center gap-0.5"
                          title="Edit DRUG_FACTS_STATUS in Product Catalog"
                          data-testid="edit-drug-facts-status-link"
                        >
                          Edit ↗
                        </Link>
                      </div>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
                      <div>Authoritative database attribute: <code className="text-zinc-300">DRUG_FACTS_STATUS</code></div>
                      <span className="text-[10px] text-zinc-400">Edits saved in Product Catalog</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-zinc-700 dark:text-zinc-300">Active Pharmaceutical Ingredients</span>
                      <ItemCategoryBadge
                        type={
                          product.otc_status === "NOT_OTC" || product.otc_status === "NOT_APPLICABLE" || product.otc_status === "NA"
                            ? "not_applicable"
                            : "not_available"
                        }
                      />
                    </div>
                    <div className="mt-1.5 text-xs text-zinc-900 dark:text-zinc-100">
                      {product.otc_status === "NOT_OTC" || product.otc_status === "NOT_APPLICABLE" || product.otc_status === "NA"
                        ? "Not Applicable (Cosmetic without active drug ingredients or monograph claims)"
                        : "Review Required for OTC active ingredients under applicable FDA monographs"}
                    </div>
                  </div>

                  {/* General Regulatory Guidance Card */}
                  <div className="p-3 rounded-xl bg-sky-500/5 border border-sky-500/20 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-sky-400">OTC Drug Facts Labeling Monograph Mandate</span>
                      <ItemCategoryBadge type="regulatory_guidance" />
                    </div>
                    <p className="text-zinc-400 dark:text-zinc-400 leading-relaxed text-[11px]">
                      Articles with therapeutic or functional active ingredients (sunscreen UV filters, acne actives, dandruff agents) are governed as Over-the-Counter drugs, requiring standardized Drug Facts labeling (21 CFR 201.66) specifying active ingredients, purpose, uses, warnings, and directions.
                    </p>
                  </div>
                </div>
              )}

              {/* SECTION 6: Certifications & Testing */}
              {activeSectionId === "6" && (
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-zinc-700 dark:text-zinc-300">COA (Certificate of Analysis)</span>
                      <div className="flex items-center gap-2">
                        <ItemCategoryBadge
                          type={
                            product.certificates.some((c) => c.certificate_type === "ingredient_certification")
                              ? "uploaded_doc"
                              : "not_available"
                          }
                        />
                        <Link
                          href={getCatalogSectionUrl(product.id, "certs")}
                          target="_blank"
                          className="text-[11px] font-medium text-cyan-400 hover:underline hover:text-cyan-300 flex items-center gap-0.5"
                          title="Manage certificates in Product Catalog"
                          data-testid="edit-certs-coa-link"
                        >
                          Manage ↗
                        </Link>
                      </div>
                    </div>
                    <div className="mt-1.5 text-xs text-zinc-900 dark:text-zinc-100">
                      {product.certificates.some((c) => c.certificate_type === "ingredient_certification")
                        ? "Uploaded in Product Documents"
                        : "Data Not Available"}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-zinc-700 dark:text-zinc-300">SDS (Safety Data Sheet)</span>
                      <ItemCategoryBadge type="not_available" />
                    </div>
                    <div className="mt-1.5 text-xs text-zinc-900 dark:text-zinc-100">
                      Data Not Available (Future Input Required)
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-zinc-700 dark:text-zinc-300">Testing Reports (Stability / Micro / Heavy Metals)</span>
                      <ItemCategoryBadge type="not_available" />
                    </div>
                    <div className="mt-1.5 text-xs text-zinc-900 dark:text-zinc-100">
                      Data Not Available (Future Input Required)
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-zinc-700 dark:text-zinc-300">Other Certifications (Trademarks / Patents)</span>
                      <div className="flex items-center gap-2">
                        <ItemCategoryBadge
                          type={
                            product.certificates.some((c) => c.certificate_type === "trademark" || c.certificate_type === "patent")
                              ? "uploaded_doc"
                              : "not_available"
                          }
                        />
                        <Link
                          href={getCatalogSectionUrl(product.id, "certs")}
                          target="_blank"
                          className="text-[11px] font-medium text-cyan-400 hover:underline hover:text-cyan-300 flex items-center gap-0.5"
                          title="Manage certificates in Product Catalog"
                          data-testid="edit-certs-other-link"
                        >
                          Manage ↗
                        </Link>
                      </div>
                    </div>
                    <div className="mt-1.5 text-xs text-zinc-900 dark:text-zinc-100">
                      {product.certificates.filter((c) => c.certificate_type === "trademark" || c.certificate_type === "patent").length > 0
                        ? `${product.certificates.filter((c) => c.certificate_type === "trademark" || c.certificate_type === "patent").length} certificate(s) uploaded`
                        : "No Patents or Trademarks Uploaded"}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-zinc-700 dark:text-zinc-300">Document Expiration & Renewal Tracking</span>
                      <ItemCategoryBadge type="planned" />
                    </div>
                    <div className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                      Automated expiration monitoring and renewal alert workflows planned for Phase 2.
                    </div>
                  </div>
                </div>
              )}

              {/* SECTION 7: Import & Customs */}
              {activeSectionId === "7" && (
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-zinc-700 dark:text-zinc-300">HS / HTS Classification</span>
                      <ItemCategoryBadge type="not_available" />
                    </div>
                    <div className="mt-1.5 text-xs text-zinc-900 dark:text-zinc-100">
                      Data Not Available (Phase 2 Tariff Classification Required)
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-zinc-700 dark:text-zinc-300">Country of Origin</span>
                      <div className="flex items-center gap-2">
                        <ItemCategoryBadge type={product.origin ? "existing_data" : "not_available"} />
                        <Link
                          href={getCatalogSectionUrl(product.id, "basic")}
                          target="_blank"
                          className="text-[11px] font-medium text-cyan-400 hover:underline hover:text-cyan-300 flex items-center gap-0.5"
                          title="Edit Origin in Product Catalog"
                          data-testid="edit-origin-link"
                        >
                          Edit ↗
                        </Link>
                      </div>
                    </div>
                    <div className="mt-1.5 text-xs text-zinc-900 dark:text-zinc-100 font-medium">
                      {product.origin || "Data Not Available"}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-zinc-700 dark:text-zinc-300">Importer / Manufacturer Roles</span>
                      <ItemCategoryBadge type="existing_data" />
                    </div>
                    <div className="mt-1.5 text-xs text-zinc-900 dark:text-zinc-100 font-medium">
                      Manufacturer: {product.company_name} · U.S. Importer: K SELECT NETWORK LLC
                    </div>
                  </div>

                  {/* General Regulatory Guidance Cards */}
                  <div className="p-3 rounded-xl bg-sky-500/5 border border-sky-500/20 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-sky-400">Commercial Invoice & Packing List Protocol</span>
                      <ItemCategoryBadge type="regulatory_guidance" />
                    </div>
                    <p className="text-zinc-400 dark:text-zinc-400 leading-relaxed text-[11px]">
                      Commercial Invoices and Packing Lists are generated dynamically per Purchase Order shipment and clearance package, not stored as static product-level attributes.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-sky-500/5 border border-sky-500/20 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-sky-400">U.S. Customs & Border Protection (CBP) Clearance Mandates</span>
                      <ItemCategoryBadge type="regulatory_guidance" />
                    </div>
                    <p className="text-zinc-400 dark:text-zinc-400 leading-relaxed text-[11px]">
                      Prior Notice under FDA/BTA, CBP Entry Summary (Form 7501), and verification of MoCRA compliance at U.S. ports of entry.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Controls of Right Panel: Sequential Navigation & Regulatory Disclaimer */}
            <div className="space-y-4 pt-4 border-t border-zinc-200 dark:border-zinc-800 shrink-0">
              {/* Previous / Next Section Buttons */}
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  disabled={CHECKLIST_SECTIONS.findIndex((s) => s.id === activeSectionId) <= 0}
                  onClick={() => {
                    const idx = CHECKLIST_SECTIONS.findIndex((s) => s.id === activeSectionId);
                    if (idx > 0) setActiveSectionId(CHECKLIST_SECTIONS[idx - 1].id);
                  }}
                  className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  ← Previous Section
                </button>
                <span className="text-[11px] text-zinc-400">
                  Tip: Use ↑ / ↓ or ← / → arrow keys to navigate
                </span>
                <button
                  type="button"
                  disabled={CHECKLIST_SECTIONS.findIndex((s) => s.id === activeSectionId) >= CHECKLIST_SECTIONS.length - 1}
                  onClick={() => {
                    const idx = CHECKLIST_SECTIONS.findIndex((s) => s.id === activeSectionId);
                    if (idx < CHECKLIST_SECTIONS.length - 1) setActiveSectionId(CHECKLIST_SECTIONS[idx + 1].id);
                  }}
                  className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  Next Section →
                </button>
              </div>

              {/* Product Catalog Authoritative Note */}
              <div className="p-2.5 rounded-lg bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-800 text-[10.5px] text-zinc-600 dark:text-zinc-400 flex items-center justify-between gap-3">
                <div>
                  <strong className="text-zinc-700 dark:text-zinc-300">Authoritative Single Source of Truth:</strong> Regulatory product values are authored and maintained directly in the Product Catalog. Updates reflect automatically on refresh.
                </div>
                <Link
                  href={getCatalogSectionUrl(product.id, activeSection.catalogTab, activeSection.catalogHash)}
                  target="_blank"
                  className="text-cyan-400 font-semibold hover:underline shrink-0 text-[11px]"
                  data-testid="bottom-edit-catalog-link"
                >
                  Edit in Catalog ↗
                </Link>
              </div>

              {/* Regulatory Safety Disclaimer Notice */}
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 flex items-start gap-2">
                <span className="text-sm">⚠️</span>
                <div>
                  <strong className="font-semibold">Regulatory Safety Notice:</strong> This Phase 1 Compliance tool organizes existing product data for review planning and U.S. market readiness. It does NOT constitute legal counsel, FDA certification, or an automated determination of import or commercial distribution eligibility.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-2.5 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/90 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 shrink-0">
          <div>
            Reviewing: <span className="font-semibold text-zinc-700 dark:text-zinc-300">{product.display_name}</span>
          </div>
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
