"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  evaluateRenewalWindow,
  FDA_NON_APPROVAL_DISCLAIMER_KO,
  type UsRegulatoryClassification,
  type ComplianceVerificationStatus,
  type ImportReadinessStatus,
  type FeiIssuanceStatus,
  type MocraFacilityStatus,
  type OtcFacilityStatus,
  type MocraListingStatus,
  type OtcListingStatus,
  type DrugFactsStatus,
} from "@/lib/compliance/v1-types";

// Lightweight self-contained SVGs
function ShieldCheck({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  );
}
function Building2({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  );
}
function PackageIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  );
}
function Clock({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
function AlertTriangle({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
}
function ExternalLink({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
    </svg>
  );
}
function Search({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}

export interface ComplianceFacilityItem {
  id: string;
  company_id: string;
  company_name: string;
  name: string;
  location_type: string;
  facility_code: string | null;
  manufacturer_legal_name_en: string | null;
  manufacturer_name_ko: string | null;
  country: string;
  city: string;
  address_line1: string;
  fei_status: FeiIssuanceStatus;
  fei_number: string | null;
  mocra_facility_status: MocraFacilityStatus;
  mocra_next_renewal_date: string | null;
  otc_facility_status: OtcFacilityStatus;
  otc_next_renewal_date: string | null;
  verification_status: ComplianceVerificationStatus;
  import_readiness_status: ImportReadinessStatus;
}

export interface ComplianceProductRow {
  id: string;
  name: string;
  name_en: string | null;
  brand_name: string;
  company_id: string;
  company_name: string;
  brand_sku: string | null;
  letusto_sku: string | null;
  photo_url: string | null;
  us_classification: UsRegulatoryClassification;
  otc_applicability: string | null;
  mocra_listing_status: MocraListingStatus;
  mocra_listing_number: string | null;
  mocra_next_renewal_date: string | null;
  otc_listing_status: OtcListingStatus;
  otc_ndc_number: string | null;
  otc_next_renewal_date: string | null;
  drug_facts_status: DrugFactsStatus;
  verification_status: ComplianceVerificationStatus;
  import_readiness_status: ImportReadinessStatus;
  primary_facility_name: string | null;
  additional_facility_names: string[];
}

interface ComplianceCenterClientProps {
  products: ComplianceProductRow[];
  facilities: ComplianceFacilityItem[];
  brands: Array<{ id: string; name: string }>;
  companies: Array<{ id: string; name: string }>;
  renderLegacyReviewModal?: (productId: string, onClose: () => void) => React.ReactNode;
}

export function ComplianceCenterClient({
  products,
  facilities,
  brands,
  companies,
  renderLegacyReviewModal,
}: ComplianceCenterClientProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "facilities" | "products" | "renewals">("overview");

  // Facilities Tab Filters
  const [facSearch, setFacSearch] = useState("");
  const [facFeiFilter, setFacFeiFilter] = useState("ALL");
  const [facMocraFilter, setFacMocraFilter] = useState("ALL");
  const [facOtcFilter, setFacOtcFilter] = useState("ALL");
  const [facVerifFilter, setFacVerifFilter] = useState("ALL");

  // Products Tab Filters
  const [prodSearch, setProdSearch] = useState("");
  const [prodBrandFilter, setProdBrandFilter] = useState("ALL");
  const [prodClassFilter, setProdClassFilter] = useState("ALL");
  const [prodMocraFilter, setProdMocraFilter] = useState("ALL");
  const [prodOtcFilter, setProdOtcFilter] = useState("ALL");
  const [prodVerifFilter, setProdVerifFilter] = useState("ALL");
  const [prodReadinessFilter, setProdReadinessFilter] = useState("ALL");

  // Renewals Tab Filter
  const [renewalFilter, setRenewalFilter] = useState<"ALL" | "OVERDUE" | "URGENT" | "PREPARATION" | "UPCOMING" | "CONFIRMATION">("ALL");

  // Legacy review modal state
  const [reviewModalProductId, setReviewModalProductId] = useState<string | null>(null);

  // Compute Overview Statistics
  const stats = useMemo(() => {
    const totalProducts = products.length;
    const totalFacilities = facilities.length;

    const feiIssuedCount = facilities.filter((f) => f.fei_status === "ISSUED").length;
    const mocraFacRegistered = facilities.filter((f) => f.mocra_facility_status === "REGISTERED").length;
    const otcFacRegistered = facilities.filter((f) => f.otc_facility_status === "REGISTERED").length;

    const mocraProdListed = products.filter((p) => p.mocra_listing_status === "LISTED").length;
    const otcProdListed = products.filter((p) => p.otc_listing_status === "LISTED").length;

    const pendingReviewCount = products.filter((p) =>
      ["UNREVIEWED", "UNDER_REVIEW", "NEEDS_INFO", "RE_REVIEW_REQUIRED"].includes(p.verification_status)
    ).length;

    const verifiedProductsCount = products.filter((p) => p.verification_status === "VERIFIED").length;
    const importReadyCount = products.filter((p) => p.import_readiness_status === "READY").length;

    // Classification counts
    const classCounts: Record<string, number> = {
      COSMETIC: 0,
      OTC_DRUG: 0,
      COSMETIC_OTC_DUAL: 0,
      NOT_APPLICABLE: 0,
      UNDETERMINED: 0,
    };
    products.forEach((p) => {
      const c = p.us_classification || "UNDETERMINED";
      classCounts[c] = (classCounts[c] || 0) + 1;
    });

    // Renewal Items list
    const renewalItems: Array<{
      id: string;
      targetType: "FACILITY" | "PRODUCT";
      name: string;
      companyOrBrand: string;
      regItem: string;
      renewalDate: string | null;
      daysRemaining: number | null;
      urgency: string;
      labelKo: string;
      verificationStatus: ComplianceVerificationStatus;
      detailUrl: string;
    }> = [];

    // Evaluate facilities
    facilities.forEach((f) => {
      if (f.mocra_facility_status === "REGISTERED") {
        const ev = evaluateRenewalWindow({
          isActiveRegistration: true,
          nextRenewalDate: f.mocra_next_renewal_date,
        });
        if (ev.urgency !== "NOT_APPLICABLE" && ev.urgency !== "CURRENT") {
          renewalItems.push({
            id: `fac-mocra-${f.id}`,
            targetType: "FACILITY",
            name: f.name,
            companyOrBrand: f.company_name,
            regItem: "MoCRA 시설 등록",
            renewalDate: f.mocra_next_renewal_date,
            daysRemaining: ev.daysRemaining,
            urgency: ev.urgency,
            labelKo: ev.labelKo,
            verificationStatus: f.verification_status,
            detailUrl: `/admin/companies/${f.company_id}`,
          });
        }
      }
      if (f.otc_facility_status === "REGISTERED") {
        const ev = evaluateRenewalWindow({
          isActiveRegistration: true,
          nextRenewalDate: f.otc_next_renewal_date,
        });
        if (ev.urgency !== "NOT_APPLICABLE" && ev.urgency !== "CURRENT") {
          renewalItems.push({
            id: `fac-otc-${f.id}`,
            targetType: "FACILITY",
            name: f.name,
            companyOrBrand: f.company_name,
            regItem: "OTC 시설 등록",
            renewalDate: f.otc_next_renewal_date,
            daysRemaining: ev.daysRemaining,
            urgency: ev.urgency,
            labelKo: ev.labelKo,
            verificationStatus: f.verification_status,
            detailUrl: `/admin/companies/${f.company_id}`,
          });
        }
      }
    });

    // Evaluate products
    products.forEach((p) => {
      if (p.mocra_listing_status === "LISTED") {
        const ev = evaluateRenewalWindow({
          isActiveRegistration: true,
          nextRenewalDate: p.mocra_next_renewal_date,
        });
        if (ev.urgency !== "NOT_APPLICABLE" && ev.urgency !== "CURRENT") {
          renewalItems.push({
            id: `prod-mocra-${p.id}`,
            targetType: "PRODUCT",
            name: p.name,
            companyOrBrand: `${p.brand_name} / ${p.company_name}`,
            regItem: "MoCRA 제품 리스팅",
            renewalDate: p.mocra_next_renewal_date,
            daysRemaining: ev.daysRemaining,
            urgency: ev.urgency,
            labelKo: ev.labelKo,
            verificationStatus: p.verification_status,
            detailUrl: `/admin/products/${p.id}?tab=certs`,
          });
        }
      }
      if (p.otc_listing_status === "LISTED") {
        const ev = evaluateRenewalWindow({
          isActiveRegistration: true,
          nextRenewalDate: p.otc_next_renewal_date,
        });
        if (ev.urgency !== "NOT_APPLICABLE" && ev.urgency !== "CURRENT") {
          renewalItems.push({
            id: `prod-otc-${p.id}`,
            targetType: "PRODUCT",
            name: p.name,
            companyOrBrand: `${p.brand_name} / ${p.company_name}`,
            regItem: "OTC NDC 리스팅",
            renewalDate: p.otc_next_renewal_date,
            daysRemaining: ev.daysRemaining,
            urgency: ev.urgency,
            labelKo: ev.labelKo,
            verificationStatus: p.verification_status,
            detailUrl: `/admin/products/${p.id}?tab=certs`,
          });
        }
      }
    });

    // Sort renewals by days remaining (overdue and urgent first)
    renewalItems.sort((a, b) => {
      if (a.urgency === "OVERDUE" && b.urgency !== "OVERDUE") return -1;
      if (b.urgency === "OVERDUE" && a.urgency !== "OVERDUE") return 1;
      if (a.daysRemaining !== null && b.daysRemaining !== null) {
        return a.daysRemaining - b.daysRemaining;
      }
      return 0;
    });

    return {
      totalProducts,
      totalFacilities,
      feiIssuedCount,
      mocraFacRegistered,
      otcFacRegistered,
      mocraProdListed,
      otcProdListed,
      pendingReviewCount,
      verifiedProductsCount,
      importReadyCount,
      classCounts,
      renewalItems,
      urgentRenewalsCount: renewalItems.filter((r) => r.urgency === "URGENT_30D" || r.urgency === "OVERDUE").length,
    };
  }, [products, facilities]);

  // Filtered Facilities List
  const filteredFacilities = useMemo(() => {
    return facilities.filter((f) => {
      if (facSearch) {
        const q = facSearch.toLowerCase();
        const matchName = f.name.toLowerCase().includes(q);
        const matchComp = f.company_name.toLowerCase().includes(q);
        const matchFei = (f.fei_number || "").toLowerCase().includes(q);
        const matchLegal = (f.manufacturer_legal_name_en || "").toLowerCase().includes(q);
        if (!matchName && !matchComp && !matchFei && !matchLegal) return false;
      }
      if (facFeiFilter !== "ALL" && f.fei_status !== facFeiFilter) return false;
      if (facMocraFilter !== "ALL" && f.mocra_facility_status !== facMocraFilter) return false;
      if (facOtcFilter !== "ALL" && f.otc_facility_status !== facOtcFilter) return false;
      if (facVerifFilter !== "ALL" && f.verification_status !== facVerifFilter) return false;
      return true;
    });
  }, [facilities, facSearch, facFeiFilter, facMocraFilter, facOtcFilter, facVerifFilter]);

  // Filtered Products List
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (prodSearch) {
        const q = prodSearch.toLowerCase();
        const matchName = p.name.toLowerCase().includes(q) || (p.name_en || "").toLowerCase().includes(q);
        const matchBrand = p.brand_name.toLowerCase().includes(q);
        const matchComp = p.company_name.toLowerCase().includes(q);
        const matchBrandSku = (p.brand_sku || "").toLowerCase().includes(q);
        const matchLetustoSku = (p.letusto_sku || "").toLowerCase().includes(q);
        const matchMocra = (p.mocra_listing_number || "").toLowerCase().includes(q);
        const matchNdc = (p.otc_ndc_number || "").toLowerCase().includes(q);
        if (!matchName && !matchBrand && !matchComp && !matchBrandSku && !matchLetustoSku && !matchMocra && !matchNdc) {
          return false;
        }
      }
      if (prodBrandFilter !== "ALL" && p.brand_name !== prodBrandFilter) return false;
      if (prodClassFilter !== "ALL" && p.us_classification !== prodClassFilter) return false;
      if (prodMocraFilter !== "ALL" && p.mocra_listing_status !== prodMocraFilter) return false;
      if (prodOtcFilter !== "ALL" && p.otc_listing_status !== prodOtcFilter) return false;
      if (prodVerifFilter !== "ALL" && p.verification_status !== prodVerifFilter) return false;
      if (prodReadinessFilter !== "ALL" && p.import_readiness_status !== prodReadinessFilter) return false;
      return true;
    });
  }, [products, prodSearch, prodBrandFilter, prodClassFilter, prodMocraFilter, prodOtcFilter, prodVerifFilter, prodReadinessFilter]);

  // Filtered Renewals List
  const filteredRenewals = useMemo(() => {
    return stats.renewalItems.filter((r) => {
      if (renewalFilter === "ALL") return true;
      if (renewalFilter === "OVERDUE") return r.urgency === "OVERDUE";
      if (renewalFilter === "URGENT") return r.urgency === "URGENT_30D";
      if (renewalFilter === "PREPARATION") return r.urgency === "PREPARATION_60D";
      if (renewalFilter === "UPCOMING") return r.urgency === "UPCOMING_90D";
      if (renewalFilter === "CONFIRMATION") return r.urgency === "CONFIRMATION_REQUIRED";
      return true;
    });
  }, [stats.renewalItems, renewalFilter]);

  const renderVerificationBadge = (st: ComplianceVerificationStatus) => {
    switch (st) {
      case "VERIFIED":
        return <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">검증 완료</span>;
      case "UNDER_REVIEW":
        return <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800">검토 중</span>;
      case "NEEDS_INFO":
        return <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800">보완 요청</span>;
      case "RE_REVIEW_REQUIRED":
        return <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-orange-50 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300 border border-orange-200 dark:border-orange-800">재검토 필요</span>;
      case "REJECTED":
        return <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-800">반려</span>;
      default:
        return <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">검토 대기</span>;
    }
  };

  const renderReadinessBadge = (st: ImportReadinessStatus) => {
    switch (st) {
      case "READY":
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">READY</span>;
      case "CONDITIONAL":
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-amber-500/10 text-amber-600 border border-amber-500/20">CONDITIONAL</span>;
      case "BLOCKED":
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-rose-500/10 text-rose-600 border border-rose-500/20">BLOCKED</span>;
      case "EXEMPT":
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-blue-500/10 text-blue-600 border border-blue-500/20">EXEMPT</span>;
      default:
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-zinc-500/10 text-zinc-600 border border-zinc-500/20">미평가</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top FDA Disclaimer */}
      <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 dark:border-amber-900/60 dark:bg-amber-950/20">
        <div className="flex items-center gap-2.5 text-xs text-amber-900 dark:text-amber-200">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
          <p className="font-medium leading-relaxed">
            <strong>FDA 규제 고지사항:</strong> {FDA_NON_APPROVAL_DISCLAIMER_KO}
          </p>
        </div>
      </div>

      {/* Main Tab Navigation */}
      <div className="flex items-center gap-1 border-b border-zinc-200 dark:border-zinc-800 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab("overview")}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-bold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === "overview"
              ? "border-zinc-950 text-zinc-950 dark:border-white dark:text-white"
              : "border-transparent text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>규제 현황 종합 (Overview)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("facilities")}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-bold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === "facilities"
              ? "border-zinc-950 text-zinc-950 dark:border-white dark:text-white"
              : "border-transparent text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>제조시설 인허가 ({facilities.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("products")}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-bold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === "products"
              ? "border-zinc-950 text-zinc-950 dark:border-white dark:text-white"
              : "border-transparent text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
          }`}
        >
          <PackageIcon className="w-4 h-4" />
          <span>상품 규제 리스팅 ({products.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("renewals")}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-bold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === "renewals"
              ? "border-zinc-950 text-zinc-950 dark:border-white dark:text-white"
              : "border-transparent text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>갱신 및 사후관리 ({stats.renewalItems.length})</span>
          {stats.urgentRenewalsCount > 0 && (
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-500 text-white animate-pulse">
              {stats.urgentRenewalsCount}
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Key Metric KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm space-y-1">
              <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">등록 대상 상품</span>
              <div className="text-2xl font-black text-zinc-950 dark:text-white font-mono">
                {stats.totalProducts}
              </div>
              <span className="text-[11px] text-zinc-400 block">검증 완료: {stats.verifiedProductsCount}건</span>
            </div>

            <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm space-y-1">
              <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">제조시설 / FEI 발급</span>
              <div className="text-2xl font-black text-zinc-950 dark:text-white font-mono">
                {stats.feiIssuedCount} <span className="text-sm font-normal text-zinc-400">/ {stats.totalFacilities}</span>
              </div>
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold block">
                발급률 {stats.totalFacilities ? Math.round((stats.feiIssuedCount / stats.totalFacilities) * 100) : 0}%
              </span>
            </div>

            <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm space-y-1">
              <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">MoCRA 시설 / 제품</span>
              <div className="text-2xl font-black text-zinc-950 dark:text-white font-mono">
                {stats.mocraFacRegistered} <span className="text-sm font-normal text-zinc-400">시설 · {stats.mocraProdListed} 제품</span>
              </div>
              <span className="text-[11px] text-zinc-400 block">공식 제출 등록 완료</span>
            </div>

            <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm space-y-1">
              <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">심사 대기 / 보완 요청</span>
              <div className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono">
                {stats.pendingReviewCount}
              </div>
              <span className="text-[11px] text-zinc-400 block">수입 적합(READY): {stats.importReadyCount}건</span>
            </div>
          </div>

          {/* Breakdown Grids */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Classification Breakdown */}
            <div className="p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm space-y-4">
              <h3 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider border-b border-zinc-100 dark:border-zinc-800 pb-2">
                미국 규제 분류 분포 (US Classification)
              </h3>
              <div className="space-y-2.5">
                {[
                  { label: "화장품 (COSMETIC)", count: stats.classCounts.COSMETIC, color: "bg-blue-500" },
                  { label: "일반의약품 (OTC_DRUG)", count: stats.classCounts.OTC_DRUG, color: "bg-emerald-500" },
                  { label: "화장품·OTC 복합 제제 (COSMETIC_OTC_DUAL)", count: stats.classCounts.COSMETIC_OTC_DUAL, color: "bg-purple-500" },
                  { label: "규제 비대상 (NOT_APPLICABLE)", count: stats.classCounts.NOT_APPLICABLE, color: "bg-zinc-400" },
                  { label: "미분류 / 확인 필요 (UNDETERMINED)", count: stats.classCounts.UNDETERMINED, color: "bg-amber-500" },
                ].map((item) => (
                  <div key={item.label} className="space-y-1 text-xs">
                    <div className="flex justify-between font-semibold text-zinc-700 dark:text-zinc-300">
                      <span>{item.label}</span>
                      <span className="font-mono">{item.count}개</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                      <div
                        className={`h-full ${item.color}`}
                        style={{ width: `${stats.totalProducts ? (item.count / stats.totalProducts) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Actions & Urgent Alerts */}
            <div className="p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm space-y-4">
              <h3 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider border-b border-zinc-100 dark:border-zinc-800 pb-2">
                긴급 조치 및 모니터링 (Urgent Actions)
              </h3>
              {stats.renewalItems.length === 0 ? (
                <p className="text-xs text-zinc-400 py-6 text-center">도래 예정인 긴급 갱신 대상이 없습니다.</p>
              ) : (
                <div className="space-y-2">
                  {stats.renewalItems.slice(0, 4).map((r) => (
                    <div
                      key={r.id}
                      className="p-3 rounded-lg border border-zinc-150 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-850/50 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0">
                        <span className="text-[10px] font-bold text-zinc-400 block">{r.regItem}</span>
                        <p className="font-bold text-zinc-900 dark:text-white truncate">{r.name}</p>
                        <span className="text-[11px] text-zinc-500">{r.companyOrBrand}</span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 block mb-1">
                          {r.labelKo}
                        </span>
                        <Link
                          href={r.detailUrl}
                          className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400 hover:underline"
                        >
                          상세 점검 →
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MANUFACTURING FACILITIES */}
      {activeTab === "facilities" && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  value={facSearch}
                  onChange={(e) => setFacSearch(e.target.value)}
                  placeholder="제조시설명, 회사명, FEI 번호, 영문 법인명 검색..."
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-zinc-950"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <select
                  value={facFeiFilter}
                  onChange={(e) => setFacFeiFilter(e.target.value)}
                  className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-2.5 py-2 text-xs"
                >
                  <option value="ALL">FEI 상태 전체</option>
                  <option value="ISSUED">발급 완료 (ISSUED)</option>
                  <option value="IN_PROGRESS">발급 진행 중</option>
                  <option value="NOT_ISSUED">미발급</option>
                </select>

                <select
                  value={facMocraFilter}
                  onChange={(e) => setFacMocraFilter(e.target.value)}
                  className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-2.5 py-2 text-xs"
                >
                  <option value="ALL">MoCRA 시설 전체</option>
                  <option value="REGISTERED">등록 완료 (REGISTERED)</option>
                  <option value="IN_PROGRESS">등록 진행 중</option>
                  <option value="EXEMPT_SMALL_BUSINESS">소기업 면제</option>
                </select>

                <select
                  value={facVerifFilter}
                  onChange={(e) => setFacVerifFilter(e.target.value)}
                  className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-2.5 py-2 text-xs"
                >
                  <option value="ALL">검증 상태 전체</option>
                  <option value="VERIFIED">검증 완료</option>
                  <option value="UNDER_REVIEW">검토 중</option>
                  <option value="UNREVIEWED">검토 대기</option>
                </select>
              </div>
            </div>
          </div>

          {/* Facilities Table */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 dark:bg-zinc-950/60 text-zinc-500 font-bold border-b border-zinc-200 dark:border-zinc-800">
                  <tr>
                    <th className="px-4 py-3">제조시설명 / 영문 법인명</th>
                    <th className="px-4 py-3">회사명</th>
                    <th className="px-4 py-3">국가 / 위치</th>
                    <th className="px-4 py-3">FEI 번호 및 상태</th>
                    <th className="px-4 py-3">MoCRA 시설 등록</th>
                    <th className="px-4 py-3">OTC 시설 등록</th>
                    <th className="px-4 py-3">검증 상태</th>
                    <th className="px-4 py-3 text-right">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-150 dark:divide-zinc-800">
                  {filteredFacilities.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-zinc-400">
                        조건에 일치하는 제조시설이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    filteredFacilities.map((f) => (
                      <tr key={f.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-850/40">
                        <td className="px-4 py-3">
                          <span className="font-bold text-zinc-900 dark:text-white block">{f.name}</span>
                          <span className="text-[11px] text-zinc-400 font-mono">
                            {f.manufacturer_legal_name_en || "-"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300 font-medium">
                          {f.company_name}
                        </td>
                        <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                          {f.country} · {f.city}
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-mono font-bold text-zinc-900 dark:text-white block">
                            {f.fei_number || "-"}
                          </span>
                          <span className="text-[10px] text-zinc-500">{f.fei_status}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-semibold block">{f.mocra_facility_status}</span>
                          {f.mocra_next_renewal_date && (
                            <span className="text-[10px] text-zinc-400 font-mono">
                              갱신: {f.mocra_next_renewal_date.slice(0, 10)}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-semibold block">{f.otc_facility_status}</span>
                          {f.otc_next_renewal_date && (
                            <span className="text-[10px] text-zinc-400 font-mono">
                              갱신: {f.otc_next_renewal_date.slice(0, 10)}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {renderVerificationBadge(f.verification_status)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={`/admin/companies/${f.company_id}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200"
                          >
                            <span>시설 관리</span>
                            <ExternalLink className="w-3 h-3" />
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
      )}

      {/* TAB 3: PRODUCT COMPLIANCE */}
      {activeTab === "products" && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  value={prodSearch}
                  onChange={(e) => setProdSearch(e.target.value)}
                  placeholder="제품명, 브랜드 SKU, Letusto SKU, MoCRA 번호, NDC 검색..."
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-zinc-950"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <select
                  value={prodClassFilter}
                  onChange={(e) => setProdClassFilter(e.target.value)}
                  className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-2.5 py-2 text-xs"
                >
                  <option value="ALL">규제 분류 전체</option>
                  <option value="COSMETIC">화장품 (COSMETIC)</option>
                  <option value="OTC_DRUG">일반의약품 (OTC_DRUG)</option>
                  <option value="COSMETIC_OTC_DUAL">화장품·OTC 복합 제제</option>
                  <option value="NOT_APPLICABLE">비대상</option>
                  <option value="UNDETERMINED">미분류 / 확인 필요</option>
                </select>

                <select
                  value={prodMocraFilter}
                  onChange={(e) => setProdMocraFilter(e.target.value)}
                  className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-2.5 py-2 text-xs"
                >
                  <option value="ALL">MoCRA 리스팅 전체</option>
                  <option value="LISTED">리스팅 완료 (LISTED)</option>
                  <option value="IN_PROGRESS">제출 진행 중</option>
                  <option value="EXEMPT_SMALL_BUSINESS">소기업 면제</option>
                  <option value="NOT_STARTED">미착수</option>
                </select>

                <select
                  value={prodVerifFilter}
                  onChange={(e) => setProdVerifFilter(e.target.value)}
                  className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-2.5 py-2 text-xs"
                >
                  <option value="ALL">검증 상태 전체</option>
                  <option value="VERIFIED">검증 완료</option>
                  <option value="UNDER_REVIEW">검토 중</option>
                  <option value="NEEDS_INFO">보완 요청</option>
                  <option value="RE_REVIEW_REQUIRED">재검토 필요</option>
                  <option value="UNREVIEWED">검토 대기</option>
                </select>

                <select
                  value={prodReadinessFilter}
                  onChange={(e) => setProdReadinessFilter(e.target.value)}
                  className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-2.5 py-2 text-xs"
                >
                  <option value="ALL">수입 적합성 전체</option>
                  <option value="READY">수입 가능 (READY)</option>
                  <option value="CONDITIONAL">조건부 수입</option>
                  <option value="BLOCKED">수입 불가</option>
                </select>
              </div>
            </div>
          </div>

          {/* Products Table */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 dark:bg-zinc-950/60 text-zinc-500 font-bold border-b border-zinc-200 dark:border-zinc-800">
                  <tr>
                    <th className="px-4 py-3">제품명 / 브랜드</th>
                    <th className="px-4 py-3">브랜드 SKU / Letusto SKU</th>
                    <th className="px-4 py-3">연결 제조시설</th>
                    <th className="px-4 py-3">규제 분류</th>
                    <th className="px-4 py-3">MoCRA 리스팅</th>
                    <th className="px-4 py-3">OTC NDC 리스팅</th>
                    <th className="px-4 py-3">Drug Facts</th>
                    <th className="px-4 py-3">검증 / 수입 적합</th>
                    <th className="px-4 py-3 text-right">작업</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-150 dark:divide-zinc-800">
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-zinc-400">
                        조건에 일치하는 상품이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map((p) => (
                      <tr key={p.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-850/40">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            {p.photo_url ? (
                              <img src={p.photo_url} alt="" className="w-8 h-8 rounded object-cover border border-zinc-200 shrink-0" />
                            ) : (
                              <div className="w-8 h-8 rounded bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 shrink-0 font-bold text-[10px]">
                                No img
                              </div>
                            )}
                            <div className="min-w-0">
                              <span className="font-bold text-zinc-900 dark:text-white block truncate max-w-[200px]">
                                {p.name}
                              </span>
                              <span className="text-[11px] text-zinc-400 block truncate max-w-[200px]">
                                {p.brand_name} · {p.company_name}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3 font-mono">
                          <span className="text-zinc-900 dark:text-white font-bold block">
                            {p.brand_sku || "-"}
                          </span>
                          <span className="text-[10px] text-zinc-400">{p.letusto_sku || "-"}</span>
                        </td>

                        <td className="px-4 py-3">
                          {p.primary_facility_name ? (
                            <div>
                              <span className="font-bold text-zinc-800 dark:text-zinc-200 block truncate max-w-[140px]">
                                {p.primary_facility_name}
                              </span>
                              {p.additional_facility_names.length > 0 && (
                                <span className="text-[10px] text-zinc-400 block">
                                  외 {p.additional_facility_names.length}개소
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-zinc-400 italic">미연결</span>
                          )}
                        </td>

                        <td className="px-4 py-3">
                          <span className="font-bold text-zinc-800 dark:text-zinc-200 block">
                            {p.us_classification}
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          <span className="font-mono font-bold block">{p.mocra_listing_number || "-"}</span>
                          <span className="text-[10px] text-zinc-500">{p.mocra_listing_status}</span>
                        </td>

                        <td className="px-4 py-3">
                          <span className="font-mono font-bold block">{p.otc_ndc_number || "-"}</span>
                          <span className="text-[10px] text-zinc-500">{p.otc_listing_status}</span>
                        </td>

                        <td className="px-4 py-3 font-mono text-[11px]">
                          {p.drug_facts_status}
                        </td>

                        <td className="px-4 py-3">
                          <div className="space-y-1">
                            {renderVerificationBadge(p.verification_status)}
                            <div className="block">{renderReadinessBadge(p.import_readiness_status)}</div>
                          </div>
                        </td>

                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {renderLegacyReviewModal && (
                              <button
                                type="button"
                                onClick={() => setReviewModalProductId(p.id)}
                                className="px-2 py-1 rounded text-xs font-bold bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200"
                              >
                                심사 모달
                              </button>
                            )}
                            <Link
                              href={`/admin/products/${p.id}?tab=certs`}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 hover:opacity-90"
                            >
                              <span>규제 상세</span>
                              <ExternalLink className="w-3 h-3" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: RENEWALS & FOLLOW-UP */}
      {activeTab === "renewals" && (
        <div className="space-y-4">
          {/* Urgency Filter Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {[
              { id: "ALL", label: `전체 (${stats.renewalItems.length})` },
              { id: "OVERDUE", label: "기한 초과 (Overdue)" },
              { id: "URGENT", label: "긴급 갱신 (D-30)" },
              { id: "PREPARATION", label: "갱신 준비 (D-60)" },
              { id: "UPCOMING", label: "갱신 예정 (D-90)" },
              { id: "CONFIRMATION", label: "갱신일 확인 필요" },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setRenewalFilter(f.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  renewalFilter === f.id
                    ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-sm"
                    : "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Renewals Table */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 dark:bg-zinc-950/60 text-zinc-500 font-bold border-b border-zinc-200 dark:border-zinc-800">
                  <tr>
                    <th className="px-4 py-3">구분</th>
                    <th className="px-4 py-3">대상명</th>
                    <th className="px-4 py-3">회사 / 브랜드</th>
                    <th className="px-4 py-3">규제 항목</th>
                    <th className="px-4 py-3">갱신 예정일</th>
                    <th className="px-4 py-3">긴급도 / 잔여일수</th>
                    <th className="px-4 py-3">현재 검증 상태</th>
                    <th className="px-4 py-3 text-right">점검 바로가기</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-150 dark:divide-zinc-800">
                  {filteredRenewals.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-zinc-400">
                        해당 조건에 해당하는 갱신 및 사후관리 항목이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    filteredRenewals.map((r) => (
                      <tr key={r.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-850/40">
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                              r.targetType === "FACILITY"
                                ? "bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300"
                                : "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
                            }`}
                          >
                            {r.targetType === "FACILITY" ? "제조시설" : "등록상품"}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-bold text-zinc-900 dark:text-white">
                          {r.name}
                        </td>
                        <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                          {r.companyOrBrand}
                        </td>
                        <td className="px-4 py-3 font-semibold text-zinc-800 dark:text-zinc-200">
                          {r.regItem}
                        </td>
                        <td className="px-4 py-3 font-mono">
                          {r.renewalDate ? r.renewalDate.slice(0, 10) : "확인 필요"}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[11px] font-bold inline-flex items-center gap-1 ${
                              r.urgency === "OVERDUE"
                                ? "bg-rose-50 text-rose-700 border border-rose-200"
                                : r.urgency === "URGENT_30D"
                                ? "bg-orange-50 text-orange-700 border border-orange-200"
                                : r.urgency === "PREPARATION_60D" || r.urgency === "UPCOMING_90D"
                                ? "bg-blue-50 text-blue-700 border border-blue-200"
                                : "bg-amber-50 text-amber-700 border border-amber-200"
                            }`}
                          >
                            <Clock className="w-3 h-3" />
                            {r.labelKo}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {renderVerificationBadge(r.verificationStatus)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={r.detailUrl}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 hover:opacity-90"
                          >
                            <span>점검</span>
                            <ExternalLink className="w-3 h-3" />
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
      )}

      {/* Optional Legacy Modal Review */}
      {reviewModalProductId && renderLegacyReviewModal && (
        renderLegacyReviewModal(reviewModalProductId, () => setReviewModalProductId(null))
      )}
    </div>
  );
}
