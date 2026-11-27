"use client";

import React, { useState, useEffect, useTransition } from "react";
import Link from "next/link";

// Lightweight self-contained icon helpers
function AlertTriangle({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
}
function CheckCircle2({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
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
function Building2({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  );
}
function ShieldCheck({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
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
function UploadCloud({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  );
}
function Lock({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  );
}
function Info({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
function AlertCircle({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
function FileDown({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  );
}
import {
  FDA_NON_APPROVAL_DISCLAIMER_KO,
  FDA_NON_APPROVAL_DISCLAIMER_EN,
  US_REGULATORY_CLASSIFICATIONS,
  OTC_APPLICABILITIES,
  MOCRA_LISTING_STATUSES,
  OTC_LISTING_STATUSES,
  DRUG_FACTS_STATUSES,
  COMPLIANCE_VERIFICATION_STATUSES,
  IMPORT_READINESS_STATUSES,
  COMPLIANCE_DOCUMENT_CATEGORIES,
  evaluateRenewalWindow,
  type UsRegulatoryClassification,
  type OtcApplicability,
  type MocraListingStatus,
  type OtcListingStatus,
  type DrugFactsStatus,
  type ComplianceVerificationStatus,
  type ImportReadinessStatus,
  type ComplianceDocumentCategory,
  type ProductRegulatoryComplianceRecord,
  type CompanyLocationRecord,
  type ManufacturingFacilityComplianceRecord,
} from "@/lib/compliance/v1-types";
import {
  getProductRegulatoryComplianceAction,
  saveProductRegulatoryDeclarationAction,
  adminVerifyProductComplianceAction,
  getComplianceAdminNotesAction,
  getProductManufacturingFacilitiesAction,
  getProductComplianceDocumentsAction,
} from "@/lib/compliance/v1-product-actions";

export interface ProductRegulatoryComplianceTabProps {
  productId: string;
  companyId?: string | null;
  isAdmin?: boolean;
  readOnly?: boolean;
  product?: any;
  initialCompliance?: ProductRegulatoryComplianceRecord | null;
  onSaved?: () => void;
  onDirtyChange?: (isDirty: boolean) => void;
}

export function ProductRegulatoryComplianceTab({
  productId,
  companyId,
  isAdmin = false,
  readOnly = false,
  product,
  initialCompliance = null,
  onSaved,
  onDirtyChange,
}: ProductRegulatoryComplianceTabProps) {
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Authoritative Compliance Record
  const [compliance, setCompliance] = useState<ProductRegulatoryComplianceRecord | null>(initialCompliance);
  const [isGrandfathered, setIsGrandfathered] = useState(false);

  // Form State (Section 01: Classification)
  const [usClassification, setUsClassification] = useState<UsRegulatoryClassification>(
    initialCompliance?.us_classification || "UNDETERMINED"
  );
  const [otcApplicability, setOtcApplicability] = useState<OtcApplicability>(
    initialCompliance?.otc_applicability || "UNKNOWN"
  );
  const [otcDualMocraApplicable, setOtcDualMocraApplicable] = useState<boolean>(
    initialCompliance?.otc_dual_mocra_applicable ?? false
  );
  const [classificationRationale, setClassificationRationale] = useState<string>(
    initialCompliance?.classification_rationale || ""
  );

  // Section 02: Linked Facilities
  const [facilities, setFacilities] = useState<
    Array<{
      link_id: string;
      facility_id: string;
      is_primary: boolean;
      location: CompanyLocationRecord;
      compliance: ManufacturingFacilityComplianceRecord | null;
    }>
  >([]);

  // Section 03: MoCRA Product Listing
  const [mocraListingStatus, setMocraListingStatus] = useState<MocraListingStatus>(
    initialCompliance?.mocra_listing_status || "UNKNOWN"
  );
  const [mocraListingNumber, setMocraListingNumber] = useState<string>(
    initialCompliance?.mocra_listing_number || ""
  );
  const [mocraListedAt, setMocraListedAt] = useState<string>(
    initialCompliance?.mocra_listed_at ? initialCompliance.mocra_listed_at.slice(0, 10) : ""
  );
  const [mocraNextRenewalDate, setMocraNextRenewalDate] = useState<string>(
    initialCompliance?.mocra_next_renewal_date ? initialCompliance.mocra_next_renewal_date.slice(0, 10) : ""
  );
  const [mocraExemptionReason, setMocraExemptionReason] = useState<string>(
    initialCompliance?.mocra_exemption_reason || ""
  );

  // Section 04: OTC Drug Listing & Labeling
  const [otcListingStatus, setOtcListingStatus] = useState<OtcListingStatus>(
    initialCompliance?.otc_listing_status || "UNKNOWN"
  );
  const [otcNdcNumber, setOtcNdcNumber] = useState<string>(
    initialCompliance?.otc_ndc_number || ""
  );
  const [otcListedAt, setOtcListedAt] = useState<string>(
    initialCompliance?.otc_listed_at ? initialCompliance.otc_listed_at.slice(0, 10) : ""
  );
  const [otcNextRenewalDate, setOtcNextRenewalDate] = useState<string>(
    initialCompliance?.otc_next_renewal_date ? initialCompliance.otc_next_renewal_date.slice(0, 10) : ""
  );
  const [otcNaReason, setOtcNaReason] = useState<string>(
    initialCompliance?.otc_na_reason || ""
  );
  const [drugFactsStatus, setDrugFactsStatus] = useState<DrugFactsStatus>(
    initialCompliance?.drug_facts_status || "UNKNOWN"
  );

  // Section 05: Ingredients & Documents
  const [documents, setDocuments] = useState<any[]>([]);
  const [uploadCategory, setUploadCategory] = useState<ComplianceDocumentCategory>("MOCRA_PRODUCT_LISTING");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Section 06: Compliance Review (Admin Actions)
  const [adminVerificationStatus, setAdminVerificationStatus] = useState<ComplianceVerificationStatus>(
    initialCompliance?.verification_status || "UNREVIEWED"
  );
  const [adminImportReadiness, setAdminImportReadiness] = useState<ImportReadinessStatus>(
    initialCompliance?.import_readiness_status || "NOT_EVALUATED"
  );
  const [adminVerificationMethod, setAdminVerificationMethod] = useState("");
  const [adminVerificationBasis, setAdminVerificationBasis] = useState("");
  const [adminPublicComment, setAdminPublicComment] = useState(
    initialCompliance?.public_review_comment || ""
  );
  const [adminPrivateNote, setAdminPrivateNote] = useState("");
  const [adminCorrectionRequest, setAdminCorrectionRequest] = useState("");
  const [adminNotesList, setAdminNotesList] = useState<any[]>([]);

  // Dirty State Tracking
  const [isDirty, setIsDirty] = useState(false);

  // Load compliance, facilities, documents, admin notes
  useEffect(() => {
    let mounted = true;
    async function loadData() {
      setLoading(true);
      try {
        const [compRes, facRes, docRes] = await Promise.all([
          getProductRegulatoryComplianceAction(productId),
          getProductManufacturingFacilitiesAction(productId),
          getProductComplianceDocumentsAction(productId),
        ]);

        if (mounted && compRes.ok && compRes.compliance) {
          const c = compRes.compliance;
          setCompliance(c);
          setIsGrandfathered(compRes.isGrandfathered);
          setUsClassification(c.us_classification || "UNDETERMINED");
          setOtcApplicability(c.otc_applicability || "UNKNOWN");
          setOtcDualMocraApplicable(Boolean(c.otc_dual_mocra_applicable));
          setClassificationRationale(c.classification_rationale || "");
          setMocraListingStatus(c.mocra_listing_status || "UNKNOWN");
          setMocraListingNumber(c.mocra_listing_number || "");
          setMocraListedAt(c.mocra_listed_at ? c.mocra_listed_at.slice(0, 10) : "");
          setMocraNextRenewalDate(c.mocra_next_renewal_date ? c.mocra_next_renewal_date.slice(0, 10) : "");
          setMocraExemptionReason(c.mocra_exemption_reason || "");
          setOtcListingStatus(c.otc_listing_status || "UNKNOWN");
          setOtcNdcNumber(c.otc_ndc_number || "");
          setOtcListedAt(c.otc_listed_at ? c.otc_listed_at.slice(0, 10) : "");
          setOtcNextRenewalDate(c.otc_next_renewal_date ? c.otc_next_renewal_date.slice(0, 10) : "");
          setOtcNaReason(c.otc_na_reason || "");
          setDrugFactsStatus(c.drug_facts_status || "UNKNOWN");
          setAdminVerificationStatus(c.verification_status || "UNREVIEWED");
          setAdminImportReadiness(c.import_readiness_status || "NOT_EVALUATED");
          setAdminPublicComment(c.public_review_comment || "");
        }

        if (mounted && facRes.ok) {
          setFacilities(facRes.facilities || []);
        }

        if (mounted && docRes.ok) {
          setDocuments(docRes.documents || []);
        }

        if (mounted && isAdmin) {
          const notesRes = await getComplianceAdminNotesAction({
            targetType: "PRODUCT",
            targetId: productId,
          });
          if (notesRes.ok) {
            setAdminNotesList(notesRes.notes || []);
          }
        }
      } catch (err) {
        console.warn("[ProductRegulatoryComplianceTab] load error:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadData();
    return () => {
      mounted = false;
    };
  }, [productId, isAdmin]);

  // Classification dependency helper
  const handleClassificationChange = (val: UsRegulatoryClassification) => {
    setUsClassification(val);
    setIsDirty(true);
    if (val === "COSMETIC") {
      setOtcApplicability("NOT_APPLICABLE");
      setOtcListingStatus("NOT_APPLICABLE");
      setDrugFactsStatus("NOT_APPLICABLE");
    } else if (val === "OTC_DRUG") {
      setOtcApplicability("APPLICABLE");
      setMocraListingStatus("NOT_APPLICABLE");
    } else if (val === "COSMETIC_OTC_DUAL") {
      setOtcApplicability("DUAL_REVIEW_REQUIRED");
      setOtcDualMocraApplicable(true);
    } else if (val === "NOT_APPLICABLE") {
      setOtcApplicability("NOT_APPLICABLE");
      setMocraListingStatus("NOT_APPLICABLE");
      setOtcListingStatus("NOT_APPLICABLE");
      setDrugFactsStatus("NOT_APPLICABLE");
    }
  };

  // Handle Save Declaration (Brand Portal & Admin)
  const handleSaveDeclaration = async () => {
    setSaveMessage(null);
    startTransition(async () => {
      const res = await saveProductRegulatoryDeclarationAction(productId, {
        us_classification: usClassification,
        otc_applicability: otcApplicability,
        otc_dual_mocra_applicable: usClassification === "COSMETIC_OTC_DUAL" ? otcDualMocraApplicable : null,
        classification_rationale: classificationRationale,
        mocra_listing_status: mocraListingStatus,
        mocra_listing_number: mocraListingNumber,
        mocra_exemption_reason: mocraExemptionReason,
        mocra_listed_at: mocraListedAt || null,
        mocra_next_renewal_date: mocraNextRenewalDate || null,
        otc_listing_status: otcListingStatus,
        otc_ndc_number: otcNdcNumber,
        otc_na_reason: otcNaReason,
        otc_listed_at: otcListedAt || null,
        otc_next_renewal_date: otcNextRenewalDate || null,
        drug_facts_status: drugFactsStatus,
      });

      if (res.ok) {
        setCompliance(res.compliance);
        setIsDirty(false);
        setSaveMessage({ type: "success", text: "규제 선언 정보가 성공적으로 저장되었습니다." });
        onSaved?.();
        onDirtyChange?.(false);
      } else {
        setSaveMessage({ type: "error", text: res.error || "저장에 실패했습니다." });
      }
    });
  };

  // Handle Admin Verification Save
  const handleAdminVerify = async () => {
    if (!isAdmin) return;
    setSaveMessage(null);
    startTransition(async () => {
      const res = await adminVerifyProductComplianceAction(productId, {
        verification_status: adminVerificationStatus,
        import_readiness_status: adminImportReadiness,
        verification_method: adminVerificationMethod || null,
        verification_basis: adminVerificationBasis || null,
        public_review_comment: adminPublicComment || null,
        private_admin_note: adminPrivateNote || null,
        correction_request: adminCorrectionRequest || null,
      });

      if (res.ok) {
        setCompliance(res.compliance);
        setAdminPrivateNote("");
        setAdminCorrectionRequest("");
        setSaveMessage({ type: "success", text: "어드민 규제 검증이 성공적으로 반영되었습니다." });
        onSaved?.();
        // Reload admin notes
        const notesRes = await getComplianceAdminNotesAction({
          targetType: "PRODUCT",
          targetId: productId,
        });
        if (notesRes.ok) setAdminNotesList(notesRes.notes || []);
      } else {
        setSaveMessage({ type: "error", text: res.error || "검증 저장에 실패했습니다." });
      }
    });
  };

  // Handle Document Upload
  const handleDocumentUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) return;
    setIsUploading(true);
    setUploadError(null);

    try {
      const fd = new FormData();
      fd.append("file", uploadFile);
      fd.append("target_type", "PRODUCT");
      fd.append("target_id", productId);
      fd.append("document_category", uploadCategory);

      const res = await fetch("/api/compliance/documents", {
        method: "POST",
        body: fd,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "문서 업로드 실패");
      }

      setUploadFile(null);
      // Reload documents
      const docRes = await getProductComplianceDocumentsAction(productId);
      if (docRes.ok) setDocuments(docRes.documents || []);
      setSaveMessage({ type: "success", text: "규제 증빙 문서가 등록되었습니다." });
    } catch (err: any) {
      setUploadError(err?.message || "업로드 중 오류가 발생했습니다.");
    } finally {
      setIsUploading(false);
    }
  };

  // Renewal evaluations
  const mocraRenewalEval = evaluateRenewalWindow({
    isActiveRegistration: mocraListingStatus === "LISTED",
    nextRenewalDate: mocraNextRenewalDate,
  });

  const otcRenewalEval = evaluateRenewalWindow({
    isActiveRegistration: otcListingStatus === "LISTED",
    nextRenewalDate: otcNextRenewalDate,
  });

  const getUrgencyBadge = (ev: typeof mocraRenewalEval) => {
    if (ev.urgency === "NOT_APPLICABLE") return null;
    if (ev.urgency === "CONFIRMATION_REQUIRED") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-950/45 px-2.5 py-0.5 text-[11px] font-bold text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
          <Clock className="w-3 h-3" />
          {ev.labelKo}
        </span>
      );
    }
    if (ev.urgency === "OVERDUE") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 dark:bg-rose-950/45 px-2.5 py-0.5 text-[11px] font-bold text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
          <AlertCircle className="w-3 h-3" />
          {ev.labelKo}
        </span>
      );
    }
    if (ev.urgency === "URGENT_30D") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 dark:bg-orange-950/45 px-2.5 py-0.5 text-[11px] font-bold text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-800">
          <AlertTriangle className="w-3 h-3" />
          {ev.labelKo}
        </span>
      );
    }
    if (ev.urgency === "PREPARATION_60D" || ev.urgency === "UPCOMING_90D") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 dark:bg-blue-950/45 px-2.5 py-0.5 text-[11px] font-bold text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
          <Clock className="w-3 h-3" />
          {ev.labelKo}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/45 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
        <CheckCircle2 className="w-3 h-3" />
        {ev.labelKo}
      </span>
    );
  };

  const verificationStatusBadge = (status: ComplianceVerificationStatus) => {
    switch (status) {
      case "VERIFIED":
        return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">검증 완료 (VERIFIED)</span>;
      case "UNDER_REVIEW":
        return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800">검토 진행 중 (UNDER_REVIEW)</span>;
      case "NEEDS_INFO":
        return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800">보완 요청 (NEEDS_INFO)</span>;
      case "RE_REVIEW_REQUIRED":
        return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-orange-50 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300 border border-orange-200 dark:border-orange-800">재검토 필요 (RE_REVIEW)</span>;
      case "VALIDITY_REVIEW_REQUIRED":
        return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border border-purple-200 dark:border-purple-800">유효성 검토 (VALIDITY_REVIEW)</span>;
      case "REJECTED":
        return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-800">반려 (REJECTED)</span>;
      default:
        return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">검토 대기 (UNREVIEWED)</span>;
    }
  };

  const importReadinessBadge = (status: ImportReadinessStatus) => {
    switch (status) {
      case "READY":
        return <span className="px-2 py-0.5 text-[11px] font-bold rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">수입 가능 (READY)</span>;
      case "CONDITIONAL":
        return <span className="px-2 py-0.5 text-[11px] font-bold rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">조건부 수입 (CONDITIONAL)</span>;
      case "BLOCKED":
        return <span className="px-2 py-0.5 text-[11px] font-bold rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">수입 불가 (BLOCKED)</span>;
      case "EXEMPT":
        return <span className="px-2 py-0.5 text-[11px] font-bold rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">수입 면제 (EXEMPT)</span>;
      default:
        return <span className="px-2 py-0.5 text-[11px] font-bold rounded bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border border-zinc-500/20">미평가 (NOT_EVALUATED)</span>;
    }
  };

  return (
    <div className="space-y-8">
      {/* Save / Status Toast Alert */}
      {saveMessage && (
        <div
          className={`p-4 rounded-xl text-xs font-medium border flex items-center justify-between ${
            saveMessage.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
              : "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800"
          }`}
        >
          <div className="flex items-center gap-2">
            {saveMessage.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{saveMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setSaveMessage(null)}
            className="text-zinc-400 hover:text-zinc-600 text-sm font-bold"
          >
            ×
          </button>
        </div>
      )}

      {/* FDA Non-Approval Disclaimer Banner */}
      <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-900/60 dark:bg-amber-950/20">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <div className="space-y-1 text-xs">
            <p className="font-bold text-amber-950 dark:text-amber-200">
              미국 FDA 공식 규제 고지사항 (Regulatory Disclaimer)
            </p>
            <p className="text-amber-800 dark:text-amber-300/90 leading-relaxed">
              {FDA_NON_APPROVAL_DISCLAIMER_KO}
            </p>
            <p className="text-amber-700/80 dark:text-amber-400/80 text-[11px] leading-relaxed italic">
              {FDA_NON_APPROVAL_DISCLAIMER_EN}
            </p>
          </div>
        </div>
      </div>

      {/* Header Summary Card */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-100 dark:border-zinc-800">
          <div>
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <h2 className="text-base font-bold text-zinc-900 dark:text-white">
                규제 및 인허가 종합 현황 (Regulatory & Compliance)
              </h2>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              미국 MoCRA 제품 리스팅, OTC Drug Listing 및 제조시설 인허가 데이터를 중앙에서 관리하고 검증합니다.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {verificationStatusBadge(compliance?.verification_status || "UNREVIEWED")}
            {importReadinessBadge(compliance?.import_readiness_status || "NOT_EVALUATED")}
          </div>
        </div>

        {/* Grandfathered Warning if applicable */}
        {isGrandfathered && (
          <div className="mt-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/60 text-xs text-blue-800 dark:text-blue-300 flex items-center gap-2">
            <Info className="w-4 h-4 shrink-0 text-blue-600" />
            <span>기존 등록 상품으로 시설 연결 유예 상태입니다. 차기 정보 갱신 전까지 등록된 제조시설을 연결해 주세요.</span>
          </div>
        )}
      </div>

      {/* SECTION 01: US Regulatory Classification */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-6">
        <div className="flex items-center justify-between border-b border-zinc-100 pb-3 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-900 text-xs font-bold text-white dark:bg-white dark:text-zinc-950">
              01
            </span>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
              미국 규제 분류 (US Regulatory Classification)
            </h3>
          </div>
          <span className="text-xs font-semibold text-zinc-500">
            {usClassification}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
              규제 분류 (Classification) <span className="text-rose-500">*</span>
            </label>
            <select
              value={usClassification}
              disabled={readOnly}
              onChange={(e) => handleClassificationChange(e.target.value as UsRegulatoryClassification)}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 p-2.5 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-950"
            >
              <option value="UNDETERMINED">미분류 / 확인 필요 (UNDETERMINED)</option>
              <option value="COSMETIC">일반 화장품 (COSMETIC)</option>
              <option value="OTC_DRUG">일반의약품 (OTC_DRUG)</option>
              <option value="COSMETIC_OTC_DUAL">화장품·OTC 복합 제제 (COSMETIC_OTC_DUAL)</option>
              <option value="NOT_APPLICABLE">규제 비대상 (NOT_APPLICABLE)</option>
            </select>
            <p className="text-[11px] text-zinc-500">
              자외선 차단제, 비듬 샴푸, 여드름 완화 기능성 제제 등은 OTC 또는 DUAL 검토가 필요합니다.
            </p>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
              OTC 적용성 (OTC Applicability)
            </label>
            <select
              value={otcApplicability}
              disabled={readOnly || usClassification === "COSMETIC" || usClassification === "NOT_APPLICABLE"}
              onChange={(e) => {
                setOtcApplicability(e.target.value as OtcApplicability);
                setIsDirty(true);
              }}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 p-2.5 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-950 disabled:opacity-50"
            >
              <option value="UNKNOWN">확인 필요 (UNKNOWN)</option>
              <option value="APPLICABLE">OTC 대상 (APPLICABLE)</option>
              <option value="NOT_APPLICABLE">OTC 비대상 (NOT_APPLICABLE)</option>
              <option value="DUAL_REVIEW_REQUIRED">복합 제제 검토 필요 (DUAL_REVIEW_REQUIRED)</option>
            </select>
          </div>
        </div>

        {usClassification === "COSMETIC_OTC_DUAL" && (
          <div className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-750 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-zinc-900 dark:text-white">MoCRA 화장품 리스팅 동시 적용</p>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                복합 제제 중 화장품 성분 리스팅 의무가 동시 부과되는 품목인 경우 체크합니다.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={otcDualMocraApplicable}
                disabled={readOnly}
                onChange={(e) => {
                  setOtcDualMocraApplicable(e.target.checked);
                  setIsDirty(true);
                }}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-zinc-200 peer-focus:outline-none rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-zinc-600 peer-checked:bg-zinc-900 dark:peer-checked:bg-zinc-100"></div>
            </label>
          </div>
        )}

        <div className="space-y-2">
          <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
            분류 사유 및 규제 검토 메모 (Classification Rationale)
          </label>
          <textarea
            rows={2}
            value={classificationRationale}
            disabled={readOnly}
            onChange={(e) => {
              setClassificationRationale(e.target.value);
              setIsDirty(true);
            }}
            placeholder="예: 일반 보습 크림으로 MoCRA 화장품 단독 규제 적용 대상임."
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 p-2.5 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-950"
          />
        </div>
      </div>

      {/* SECTION 02: Facility Registration */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-6">
        <div className="flex items-center justify-between border-b border-zinc-100 pb-3 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-900 text-xs font-bold text-white dark:bg-white dark:text-zinc-950">
              02
            </span>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
              제조시설 등록 현황 (Manufacturing Facility Registration)
            </h3>
          </div>
          <span className="text-xs text-zinc-500 font-semibold">
            연결된 제조시설 {facilities.length}개
          </span>
        </div>

        {facilities.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 p-8 text-center">
            <Building2 className="w-8 h-8 text-zinc-400 mx-auto mb-2" />
            <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
              연결된 제조시설이 없습니다.
            </p>
            <p className="text-[11px] text-zinc-500 mt-1 max-w-md mx-auto">
              미국 수입 통관 및 규제 준수를 위해 상품 제조시설을 연결해야 합니다.
            </p>
            <div className="mt-4">
              <Link
                href={isAdmin ? (companyId ? `/admin/companies/${companyId}?tab=shipping-origin` : "/admin/products/compliance") : "/portal/company/info?tab=shipping-origin"}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 hover:opacity-90"
              >
                <span>제조시설 관리 페이지로 이동</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {facilities.map((f) => {
              const comp = f.compliance;
              return (
                <div
                  key={f.link_id}
                  className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 bg-zinc-50/50 dark:bg-zinc-850/40 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                          f.is_primary
                            ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                            : "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200"
                        }`}
                      >
                        {f.is_primary ? "대표 제조시설 (Primary)" : "추가 제조시설"}
                      </span>
                      <span className="text-xs font-bold text-zinc-900 dark:text-white">
                        {f.location.name}
                      </span>
                      {f.location.manufacturer_legal_name_en && (
                        <span className="text-xs text-zinc-500 font-mono">
                          ({f.location.manufacturer_legal_name_en})
                        </span>
                      )}
                    </div>
                    <Link
                      href={isAdmin ? `/admin/companies/${f.location.company_id}?tab=shipping-origin` : "/portal/company/info?tab=shipping-origin"}
                      className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white inline-flex items-center gap-1"
                    >
                      <span>시설 정보 보기</span>
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-2 border-t border-zinc-200/60 dark:border-zinc-800">
                    <div>
                      <span className="text-[10px] text-zinc-400 font-bold block">FEI 등록 번호</span>
                      <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200">
                        {comp?.fei_number || "미등록 (N/A)"}
                      </span>
                      <span className="block text-[10px] text-zinc-500">{comp?.fei_status || "UNKNOWN"}</span>
                    </div>

                    <div>
                      <span className="text-[10px] text-zinc-400 font-bold block">MoCRA 시설 등록</span>
                      <span className="font-bold text-zinc-800 dark:text-zinc-200">
                        {comp?.mocra_facility_status || "UNKNOWN"}
                      </span>
                      {comp?.mocra_next_renewal_date && (
                        <span className="block text-[10px] text-zinc-500">
                          갱신: {comp.mocra_next_renewal_date.slice(0, 10)}
                        </span>
                      )}
                    </div>

                    <div>
                      <span className="text-[10px] text-zinc-400 font-bold block">OTC 시설 등록</span>
                      <span className="font-bold text-zinc-800 dark:text-zinc-200">
                        {comp?.otc_facility_status || "UNKNOWN"}
                      </span>
                      {comp?.otc_next_renewal_date && (
                        <span className="block text-[10px] text-zinc-500">
                          갱신: {comp.otc_next_renewal_date.slice(0, 10)}
                        </span>
                      )}
                    </div>

                    <div>
                      <span className="text-[10px] text-zinc-400 font-bold block">시설 검증 상태</span>
                      {verificationStatusBadge(comp?.verification_status || "UNREVIEWED")}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SECTION 03: MoCRA Product Listing */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-6">
        <div className="flex items-center justify-between border-b border-zinc-100 pb-3 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-900 text-xs font-bold text-white dark:bg-white dark:text-zinc-950">
              03
            </span>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
              MoCRA 화장품 제품 리스팅 (Cosmetic Product Listing)
            </h3>
          </div>
          {getUrgencyBadge(mocraRenewalEval)}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
              MoCRA 리스팅 상태 <span className="text-rose-500">*</span>
            </label>
            <select
              value={mocraListingStatus}
              disabled={readOnly}
              onChange={(e) => {
                setMocraListingStatus(e.target.value as MocraListingStatus);
                setIsDirty(true);
              }}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 p-2.5 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-950"
            >
              <option value="UNKNOWN">확인 필요 (UNKNOWN)</option>
              <option value="NOT_STARTED">미착수 (NOT_STARTED)</option>
              <option value="IN_PROGRESS">제출 진행 중 (IN_PROGRESS)</option>
              <option value="LISTED">리스팅 완료 (LISTED)</option>
              <option value="EXEMPT_SMALL_BUSINESS">소기업 면제 대상 (EXEMPT_SMALL_BUSINESS)</option>
              <option value="NOT_APPLICABLE">규제 비대상 (NOT_APPLICABLE)</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
              MoCRA 리스팅 번호 (Listing Number)
            </label>
            <input
              type="text"
              value={mocraListingNumber}
              disabled={readOnly || mocraListingStatus !== "LISTED"}
              onChange={(e) => {
                setMocraListingNumber(e.target.value);
                setIsDirty(true);
              }}
              placeholder="예: 12345678"
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 p-2.5 text-xs text-zinc-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-zinc-950 disabled:opacity-50"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
              리스팅 등록 완료일 (Listed Date)
            </label>
            <input
              type="date"
              value={mocraListedAt}
              disabled={readOnly || mocraListingStatus !== "LISTED"}
              onChange={(e) => {
                setMocraListedAt(e.target.value);
                setIsDirty(true);
              }}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 p-2.5 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-950 disabled:opacity-50"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
              차기 갱신 예정일 (Next Renewal Date)
            </label>
            <input
              type="date"
              value={mocraNextRenewalDate}
              disabled={readOnly || mocraListingStatus !== "LISTED"}
              onChange={(e) => {
                setMocraNextRenewalDate(e.target.value);
                setIsDirty(true);
              }}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 p-2.5 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-950 disabled:opacity-50"
            />
            <p className="text-[11px] text-zinc-500">
              MoCRA 규정에 따른 격년 갱신 주기를 입력해 주세요.
            </p>
          </div>
        </div>

        {(mocraListingStatus === "EXEMPT_SMALL_BUSINESS" || mocraListingStatus === "NOT_APPLICABLE") && (
          <div className="space-y-2">
            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
              면제 또는 비대상 구체 사유 (Exemption Reason)
            </label>
            <textarea
              rows={2}
              value={mocraExemptionReason}
              disabled={readOnly}
              onChange={(e) => {
                setMocraExemptionReason(e.target.value);
                setIsDirty(true);
              }}
              placeholder="직전 3개년 평균 미국 내 화장품 총 매출액 100만 달러 미만 소기업 면제 요건 해당 등 구체적 사유 작성"
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 p-2.5 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-950"
            />
          </div>
        )}
      </div>

      {/* SECTION 04: OTC Drug Listing & Labeling */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-6">
        <div className="flex items-center justify-between border-b border-zinc-100 pb-3 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-900 text-xs font-bold text-white dark:bg-white dark:text-zinc-950">
              04
            </span>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
              OTC 의약품 리스팅 및 Drug Facts 라벨링 (OTC Drug Listing & Labeling)
            </h3>
          </div>
          {getUrgencyBadge(otcRenewalEval)}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
              OTC 리스팅 상태 <span className="text-rose-500">*</span>
            </label>
            <select
              value={otcListingStatus}
              disabled={readOnly || usClassification === "COSMETIC" || usClassification === "NOT_APPLICABLE"}
              onChange={(e) => {
                setOtcListingStatus(e.target.value as OtcListingStatus);
                setIsDirty(true);
              }}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 p-2.5 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-950 disabled:opacity-50"
            >
              <option value="UNKNOWN">확인 필요 (UNKNOWN)</option>
              <option value="NOT_APPLICABLE">비대상 (NOT_APPLICABLE)</option>
              <option value="NOT_STARTED">미착수 (NOT_STARTED)</option>
              <option value="IN_PROGRESS">제출 진행 중 (IN_PROGRESS)</option>
              <option value="LISTED">NDC 등록 완료 (LISTED)</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
              NDC 번호 (National Drug Code)
            </label>
            <input
              type="text"
              value={otcNdcNumber}
              disabled={readOnly || otcListingStatus !== "LISTED"}
              onChange={(e) => {
                setOtcNdcNumber(e.target.value);
                setIsDirty(true);
              }}
              placeholder="예: 12345-678-90"
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 p-2.5 text-xs text-zinc-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-zinc-950 disabled:opacity-50"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
              OTC 리스팅 등록일
            </label>
            <input
              type="date"
              value={otcListedAt}
              disabled={readOnly || otcListingStatus !== "LISTED"}
              onChange={(e) => {
                setOtcListedAt(e.target.value);
                setIsDirty(true);
              }}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 p-2.5 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-950 disabled:opacity-50"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
              연례 갱신일 (Annual Renewal Date)
            </label>
            <input
              type="date"
              value={otcNextRenewalDate}
              disabled={readOnly || otcListingStatus !== "LISTED"}
              onChange={(e) => {
                setOtcNextRenewalDate(e.target.value);
                setIsDirty(true);
              }}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 p-2.5 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-950 disabled:opacity-50"
            />
          </div>
        </div>

        {/* Drug Facts Status */}
        <div className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-zinc-900 dark:text-white">Drug Facts 라벨 준비 상태</p>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                미국 21 CFR 201.66 기준 Drug Facts 패키지 라벨링 적합성 검토 상태입니다.
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-zinc-700 dark:text-zinc-300">
              {drugFactsStatus}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 pt-2">
            {DRUG_FACTS_STATUSES.map((st) => {
              const isDisabled = readOnly || (!isAdmin && st === "VERIFIED");
              const isSelected = drugFactsStatus === st;
              return (
                <button
                  key={st}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => {
                    setDrugFactsStatus(st);
                    setIsDirty(true);
                  }}
                  className={`p-2 rounded-lg text-xs font-bold text-center border transition-all ${
                    isSelected
                      ? "bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-zinc-950 dark:border-white shadow-sm"
                      : "bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  } ${isDisabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
                >
                  <div>{st}</div>
                  {!isAdmin && st === "VERIFIED" && (
                    <span className="text-[9px] block text-zinc-400 font-normal">관리자 전용</span>
                  )}
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-zinc-500">
            * 브랜드사는 READY(제출 준비 완료)까지 선언 가능하며, 최종 VERIFIED(라벨 검증 완료) 승인은 K SELECT 어드민이 실행합니다.
          </p>
        </div>
      </div>

      {/* SECTION 05: Ingredients & Documents */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-6">
        <div className="flex items-center justify-between border-b border-zinc-100 pb-3 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-900 text-xs font-bold text-white dark:bg-white dark:text-zinc-950">
              05
            </span>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
              전성분 및 규제 서류 관리 (Ingredients & Documents)
            </h3>
          </div>
          <span className="text-xs text-zinc-500 font-semibold">
            증빙 문서 {documents.length}건
          </span>
        </div>

        {/* INCI Ingredients Text Display */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-850/50 border border-zinc-200 dark:border-zinc-800">
            <span className="text-xs font-bold text-zinc-900 dark:text-white block">
              국문 전성분 (INCI Korean)
            </span>
            <p className="text-xs text-zinc-600 dark:text-zinc-300 max-h-32 overflow-y-auto leading-relaxed whitespace-pre-wrap">
              {product?.ingredients_ko || "등록된 국문 전성분 정보가 없습니다."}
            </p>
          </div>

          <div className="space-y-1.5 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-850/50 border border-zinc-200 dark:border-zinc-800">
            <span className="text-xs font-bold text-zinc-900 dark:text-white block">
              영문 전성분 (INCI English)
            </span>
            <p className="text-xs text-zinc-600 dark:text-zinc-300 max-h-32 overflow-y-auto leading-relaxed whitespace-pre-wrap font-mono text-[11px]">
              {product?.ingredients_en || "등록된 영문 전성분 정보가 없습니다."}
            </p>
          </div>
        </div>

        {/* Evidence Documents List */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-zinc-900 dark:text-white">
            등록된 규제 증빙 문서 (Evidence Documents)
          </h4>

          {documents.length === 0 ? (
            <p className="text-xs text-zinc-400 py-4 text-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-lg">
              등록된 인허가 증빙 서류(FEI 접수증, MoCRA 접수증, NDC 리스팅, Drug Facts 라벨 등)가 없습니다.
            </p>
          ) : (
            <div className="divide-y divide-zinc-150 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="p-3 bg-white dark:bg-zinc-900 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 shrink-0">
                      {doc.document_category}
                    </span>
                    <span className="font-semibold text-zinc-900 dark:text-white truncate">
                      {doc.file_name}
                    </span>
                    <span className="text-[10px] text-zinc-400 shrink-0">
                      ({(doc.file_size / 1024).toFixed(1)} KB)
                    </span>
                  </div>

                  <a
                    href={`/api/compliance/documents/${doc.id}/download`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold text-zinc-700 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 shrink-0"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    <span>다운로드</span>
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upload Form */}
        {!readOnly && (
          <form
            onSubmit={handleDocumentUpload}
            className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-850/30 space-y-3"
          >
            <div className="flex items-center gap-2">
              <UploadCloud className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
              <h5 className="text-xs font-bold text-zinc-900 dark:text-white">
                규제 증빙 서류 업로드 (PDF, PNG, JPG, WEBP, XLSX, DOCX / 최대 20MB)
              </h5>
            </div>

            {uploadError && (
              <p className="text-xs text-rose-600 font-semibold">{uploadError}</p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1">
                  문서 유형 (Category)
                </label>
                <select
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value as ComplianceDocumentCategory)}
                  className="w-full rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-2 text-xs text-zinc-900 dark:text-white"
                >
                  <option value="MOCRA_PRODUCT_LISTING">MoCRA 제품 리스팅 증빙</option>
                  <option value="OTC_NDC_LISTING">OTC NDC 리스팅 증빙</option>
                  <option value="DRUG_FACTS_LABEL">Drug Facts 패키지 라벨</option>
                  <option value="FEI_CONFIRMATION">FEI 번호 발급 확인서</option>
                  <option value="MOCRA_FACILITY_RECEIPT">MoCRA 시설 등록 접수증</option>
                  <option value="OTC_FACILITY_RECEIPT">OTC 시설 등록 접수증</option>
                  <option value="EXEMPTION_STATEMENT">소기업 규제 면제 증빙서</option>
                  <option value="OTHER">기타 규제 증빙 서류</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1">
                  파일 선택
                </label>
                <div className="flex gap-2">
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.docx"
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                    className="flex-1 text-xs text-zinc-600 dark:text-zinc-400 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-bold file:bg-zinc-200 file:text-zinc-800 hover:file:bg-zinc-300"
                  />
                  <button
                    type="submit"
                    disabled={!uploadFile || isUploading}
                    className="px-4 py-1.5 rounded text-xs font-bold bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 disabled:opacity-50 shrink-0"
                  >
                    {isUploading ? "업로드 중..." : "등록"}
                  </button>
                </div>
              </div>
            </div>
          </form>
        )}
      </div>

      {/* SECTION 06: Compliance Review & Admin Verification */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-6">
        <div className="flex items-center justify-between border-b border-zinc-100 pb-3 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-900 text-xs font-bold text-white dark:bg-white dark:text-zinc-950">
              06
            </span>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
              규제 검토 및 수입 적합성 (Compliance Review & Import Readiness)
            </h3>
          </div>
          <div className="flex items-center gap-2">
            {verificationStatusBadge(compliance?.verification_status || "UNREVIEWED")}
            {importReadinessBadge(compliance?.import_readiness_status || "NOT_EVALUATED")}
          </div>
        </div>

        {/* Public Review Comment / Correction Request (Brand Visible) */}
        {compliance?.public_review_comment && (
          <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/70 dark:border-blue-900/60 dark:bg-blue-950/20 space-y-1">
            <p className="text-xs font-bold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
              <Info className="w-4 h-4 text-blue-600" />
              <span>어드민 규제 검토 의견 및 보완 요청 사항</span>
            </p>
            <p className="text-xs text-blue-800 dark:text-blue-300/90 whitespace-pre-wrap leading-relaxed pl-5">
              {compliance.public_review_comment}
            </p>
            {compliance.verified_at && (
              <p className="text-[10px] text-blue-600 dark:text-blue-400 pl-5">
                검토 일시: {new Date(compliance.verified_at).toLocaleString("ko-KR")}
              </p>
            )}
          </div>
        )}

        {/* ADMIN ONLY Verification Panel */}
        {isAdmin && (
          <div className="p-5 rounded-xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-950/40 space-y-4">
            <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-2">
              <Lock className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
              <h4 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
                ADMIN 전용 검증 패널 (Compliance Authority)
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  검증 상태 (Verification Status)
                </label>
                <select
                  value={adminVerificationStatus}
                  onChange={(e) => setAdminVerificationStatus(e.target.value as ComplianceVerificationStatus)}
                  className="w-full rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-2 text-xs font-bold text-zinc-900 dark:text-white"
                >
                  {COMPLIANCE_VERIFICATION_STATUSES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  수입 적합성 판정 (Import Readiness)
                </label>
                <select
                  value={adminImportReadiness}
                  onChange={(e) => setAdminImportReadiness(e.target.value as ImportReadinessStatus)}
                  className="w-full rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-2 text-xs font-bold text-zinc-900 dark:text-white"
                >
                  {IMPORT_READINESS_STATUSES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  검증 방법 (Verification Method)
                </label>
                <input
                  type="text"
                  value={adminVerificationMethod}
                  onChange={(e) => setAdminVerificationMethod(e.target.value)}
                  placeholder="예: FDA FEI/MoCRA 포털 직접 조회 및 대조"
                  className="w-full rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-2 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  검증 근거 (Verification Basis)
                </label>
                <input
                  type="text"
                  value={adminVerificationBasis}
                  onChange={(e) => setAdminVerificationBasis(e.target.value)}
                  placeholder="예: MoCRA 공식 등록 통지서 번호 일치 확인"
                  className="w-full rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-2 text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                브랜드 공개 안내 코멘트 / 보완 요청 내용 (Public Review Comment)
              </label>
              <textarea
                rows={2}
                value={adminPublicComment}
                onChange={(e) => setAdminPublicComment(e.target.value)}
                placeholder="브랜드사 포털에 표시되는 검토 결과 및 보완 요청 사항입니다."
                className="w-full rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-2 text-xs"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  어드민 비공개 내부 메모 (Private Admin Note)
                </label>
                <textarea
                  rows={2}
                  value={adminPrivateNote}
                  onChange={(e) => setAdminPrivateNote(e.target.value)}
                  placeholder="어드민 내부에서만 보존되는 비공개 심사 기록입니다."
                  className="w-full rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-2 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  공식 보완 요청서 기록 (Correction Request)
                </label>
                <textarea
                  rows={2}
                  value={adminCorrectionRequest}
                  onChange={(e) => setAdminCorrectionRequest(e.target.value)}
                  placeholder="보완 요청 사유 및 제출 기한 메모"
                  className="w-full rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-2 text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                disabled={isPending}
                onClick={handleAdminVerify}
                className="px-5 py-2 rounded-lg text-xs font-bold bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 hover:opacity-90 disabled:opacity-50"
              >
                {isPending ? "검증 저장 중..." : "어드민 검증 결과 확정"}
              </button>
            </div>

            {/* Admin Notes History */}
            {adminNotesList.length > 0 && (
              <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 space-y-2">
                <span className="text-[11px] font-bold text-zinc-500 uppercase">
                  이전 내부 메모 히스토리 ({adminNotesList.length}건)
                </span>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {adminNotesList.map((n) => (
                    <div
                      key={n.id}
                      className="p-2 rounded bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-[11px]"
                    >
                      <p className="text-zinc-800 dark:text-zinc-200">{n.private_note}</p>
                      {n.correction_request && (
                        <p className="text-amber-700 dark:text-amber-400 mt-0.5">
                          보완 요청: {n.correction_request}
                        </p>
                      )}
                      <span className="text-[9px] text-zinc-400 block mt-1">
                        {new Date(n.created_at).toLocaleString("ko-KR")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Brand Declaration Action Buttons */}
        {!readOnly && (
          <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-zinc-500">
              * 규제 정보를 수정하여 저장하면 검증 완료(VERIFIED) 상태는 자동으로 재검토 필요(RE_REVIEW_REQUIRED) 상태로 전환됩니다.
            </div>
            <button
              type="button"
              disabled={isPending}
              onClick={handleSaveDeclaration}
              className="px-6 py-2.5 rounded-lg text-xs font-bold bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 hover:opacity-90 disabled:opacity-50 shadow-sm cursor-pointer"
            >
              {isPending ? "저장 중..." : "규제 선언 정보 저장하기"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
