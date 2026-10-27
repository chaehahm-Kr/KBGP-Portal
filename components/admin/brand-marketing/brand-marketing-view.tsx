"use client";

import React, { useState, useTransition, useMemo } from "react";
import type {
  NormalizedCompanyDraft,
  DuplicateMatchResult,
  SourcingEvaluationInput,
  SourcingBrand,
  SourcingContact,
  SourcingWebsite,
  FieldOrigin,
} from "@/lib/brand-sourcing/types";
import {
  extractSourcingDraftAction,
  saveSourcingCandidateAction,
  listSourcingCandidatesAction,
  getSourcingCandidateDetailAction,
  updateSourcingCandidateAction,
  updateSourcingEvaluationAction,
  deleteSourcingCandidateAction,
} from "@/lib/brand-sourcing/actions";

interface StaffMemberOption {
  id: string;
  name: string;
  email: string;
}

interface BrandMarketingViewProps {
  initialStaff: StaffMemberOption[];
  initialCandidates: any[];
  initialTotal: number;
  initialTab?: "import" | "list";
}

// InterCHARM Korea Verified Sample URLs for Operator QA
const QUICK_TEST_URLS = [
  {
    name: "JCOMO (제이코모)",
    url: "https://www.intercharmkorea.com/ko-kr/exhibitor_directory/Exhibitor_detail.주제이코모.org-ec0b85bc-960d-49d4-9dca-146c10ae59cb.html#/",
  },
  {
    name: "JD BIO (제이디바이오)",
    url: "https://www.intercharmkorea.com/ko-kr/exhibitor_directory/Exhibitor_detail.제이디바이오.org-a2d35424-a9e1-41c1-b77a-88e839ae0b0f.html#/",
  },
  {
    name: "LEBELAGE (르베라쥬)",
    url: "https://www.intercharmkorea.com/ko-kr/exhibitor_directory/Exhibitor_detail.르베라쥬.org-18c803be-34f2-4461-bc72-fa5ec798209b.html#/",
  },
  {
    name: "BEAUGANIC (보가닉)",
    url: "https://www.intercharmkorea.com/ko-kr/exhibitor_directory/Exhibitor_detail.뷰가닉.org-d14d1a34-e041-400d-9488-88121361b460.html#/",
  },
];

export default function BrandMarketingView({
  initialStaff,
  initialCandidates,
  initialTotal,
  initialTab = "import",
}: BrandMarketingViewProps) {
  // Navigation Tabs: import | list | email (disabled) | results (disabled)
  const [activeTab, setActiveTab] = useState<"import" | "list">(initialTab);

  // --------------------------------------------------------------------------
  // TAB 1: IMPORT & REVIEW STATE
  // --------------------------------------------------------------------------
  const [sourceUrl, setSourceUrl] = useState("");
  const [enrichWebsite, setEnrichWebsite] = useState(true);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);

  // The draft being actively reviewed/edited
  const [reviewedDraft, setReviewedDraft] = useState<NormalizedCompanyDraft | null>(null);

  // Evaluation Fields
  const [grade, setGrade] = useState<"A" | "B" | "C" | "UNRATED">("UNRATED");
  const [status, setStatus] = useState<"DRAFT" | "REVIEWED" | "SAVED" | "ARCHIVED">("REVIEWED");
  const [internalNotes, setInternalNotes] = useState<string>("");

  // Duplicate candidate alert state
  const [duplicateCheck, setDuplicateCheck] = useState<DuplicateMatchResult | null>(null);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateOverrideReason, setDuplicateOverrideReason] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  // Delete Candidate Confirmation Modal state
  const [candidateToDelete, setCandidateToDelete] = useState<any | null>(null);
  const [isDeletingCandidate, setIsDeletingCandidate] = useState(false);
  const [deleteSuccessMessage, setDeleteSuccessMessage] = useState<string | null>(null);

  // Per-Brand inline category input for Import & Review
  const [newBrandCategoryInputs, setNewBrandCategoryInputs] = useState<Record<number, string>>({});

  // --------------------------------------------------------------------------
  // TAB 2: BRAND LIST STATE
  // --------------------------------------------------------------------------
  const [candidates, setCandidates] = useState<any[]>(initialCandidates);
  const [totalCandidates, setTotalCandidates] = useState<number>(initialTotal);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterGrade, setFilterGrade] = useState("ALL");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [filterCategory, setFilterCategory] = useState("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const pageSize = 20;

  // Detail Drawer / Modal state for viewing an existing saved candidate
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [selectedCandidateDetail, setSelectedCandidateDetail] = useState<any | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isUpdatingCandidate, setIsUpdatingCandidate] = useState(false);
  const [detailEditSuccess, setDetailEditSuccess] = useState<string | null>(null);

  const [isPending, startTransition] = useTransition();

  // --------------------------------------------------------------------------
  // EXTRACTION HANDLER
  // --------------------------------------------------------------------------
  const handleExtract = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!sourceUrl.trim()) {
      setExtractError("Please enter a valid InterCHARM exhibitor URL.");
      return;
    }

    setIsExtracting(true);
    setExtractError(null);
    setSaveSuccessMessage(null);

    try {
      const res = await extractSourcingDraftAction(sourceUrl.trim(), {
        enrichWithOfficialWebsite: enrichWebsite,
      });

      if (!res.success || !res.draft) {
        setExtractError(res.error || "Failed to extract exhibitor info.");
        setIsExtracting(false);
        return;
      }

      setReviewedDraft(res.draft);
      setDuplicateCheck(res.duplicateCheck || null);

      // Reset evaluation fields to clean state (Default to REVIEWED)
      setGrade("UNRATED");
      setStatus("REVIEWED");
      setInternalNotes("");
    } catch (err: any) {
      setExtractError(err.message || "An unexpected error occurred during extraction.");
    } finally {
      setIsExtracting(false);
    }
  };

  // --------------------------------------------------------------------------
  // SAVE HANDLER
  // --------------------------------------------------------------------------
  const handleInitiateSave = () => {
    if (!reviewedDraft) return;

    if (!reviewedDraft.company.nameKr?.trim()) {
      alert("Company Korean name is required before saving.");
      return;
    }

    // If duplicate detected and user hasn't explicitly overridden, prompt modal
    if (duplicateCheck && duplicateCheck.isDuplicate) {
      setShowDuplicateModal(true);
      return;
    }

    executeSave();
  };

  const executeSave = async (overrideReason?: string) => {
    if (!reviewedDraft) return;

    setIsSaving(true);
    setShowDuplicateModal(false);

    try {
      const evaluation: SourcingEvaluationInput = {
        grade,
        status,
        assignedTo: null,
        internalNotes: overrideReason
          ? `[DUPLICATE OVERRIDE]: ${overrideReason}\n\n${internalNotes}`
          : internalNotes,
        marketingConsentStatus: "UNCONFIRMED", // Strict invariant
      };

      const res = await saveSourcingCandidateAction(reviewedDraft, evaluation);

      if (!res.success) {
        alert(`Failed to save: ${res.error}`);
        setIsSaving(false);
        return;
      }

      setSaveSuccessMessage(`Candidate "${reviewedDraft.company.nameKr}" saved successfully!`);
      // Refresh list in background
      refreshBrandList();
    } catch (err: any) {
      alert(`Save error: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // --------------------------------------------------------------------------
  // LIST REFRESH & PAGINATION HANDLER
  // --------------------------------------------------------------------------
  const refreshBrandList = async (page = currentPage) => {
    setIsLoadingList(true);
    try {
      const res = await listSourcingCandidatesAction({
        search: searchQuery || undefined,
        grade: filterGrade !== "ALL" ? filterGrade : undefined,
        status: filterStatus !== "ALL" ? filterStatus : undefined,
        category: filterCategory !== "ALL" ? filterCategory : undefined,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });

      if (res.success && res.candidates) {
        setCandidates(res.candidates);
        setTotalCandidates(res.total || 0);
      }
    } catch (err) {
      console.error("Failed to refresh brand list:", err);
    } finally {
      setIsLoadingList(false);
    }
  };

  // --------------------------------------------------------------------------
  // OPEN DETAIL DRAWER
  // --------------------------------------------------------------------------
  const handleOpenDetail = async (id: string) => {
    setSelectedCandidateId(id);
    setIsDetailLoading(true);
    setDetailEditSuccess(null);

    try {
      const res = await getSourcingCandidateDetailAction(id);
      if (res.success && res.candidate) {
        setSelectedCandidateDetail(res.candidate);
      }
    } catch (err: any) {
      alert(`Failed to load details: ${err.message}`);
    } finally {
      setIsDetailLoading(false);
    }
  };

  const handleUpdateDetailEvaluation = async () => {
    if (!selectedCandidateDetail) return;
    setIsUpdatingCandidate(true);
    setDetailEditSuccess(null);

    try {
      // Reconstruct draft for full update
      const draft: NormalizedCompanyDraft = {
        company: {
          nameKr: selectedCandidateDetail.company_name_kr,
          nameEn: selectedCandidateDetail.company_name_en,
          descriptionKr: selectedCandidateDetail.description_kr,
          descriptionEn: selectedCandidateDetail.description_en,
          address: {
            line1: selectedCandidateDetail.address_line1,
            line2: selectedCandidateDetail.address_line2,
            city: selectedCandidateDetail.address_city,
            stateProvince: selectedCandidateDetail.address_state_province,
            postcode: selectedCandidateDetail.address_postcode,
            country: selectedCandidateDetail.address_country,
            countryCode: selectedCandidateDetail.address_country_code,
            formattedKr: selectedCandidateDetail.address_formatted_kr,
            formattedEn: selectedCandidateDetail.address_formatted_en,
          },
          businessTypes: selectedCandidateDetail.business_types || [],
          businessTypeEvidence: selectedCandidateDetail.business_type_evidence || [],
          representativeName: selectedCandidateDetail.representative_name,
          businessRegistrationNumber: selectedCandidateDetail.business_registration_number,
        },
        brands: (selectedCandidateDetail.sourcing_brands || []).map((b: any) => ({
          nameKr: b.brand_name_kr,
          nameEn: b.brand_name_en,
          description: b.description,
          categories: b.categories || [],
          keyProducts: b.key_products || [],
          source: b.source,
        })),
        contacts: (selectedCandidateDetail.sourcing_contacts || []).map((c: any) => ({
          name: c.name,
          department: c.department,
          jobTitle: c.job_title,
          email: c.email,
          phone: c.phone,
          isPrimary: c.is_primary,
          source: c.source,
          sourceUrl: c.source_url,
        })),
        websites: (selectedCandidateDetail.sourcing_websites || []).map((w: any) => ({
          url: w.url,
          label: w.label,
          source: w.source,
        })),
        socialMedia: [],
        categories: [],
        source: {
          provider: selectedCandidateDetail.sourcing_sources?.[0]?.provider || "INTERCHARM",
          sourceUrl: selectedCandidateDetail.sourcing_sources?.[0]?.source_url || "",
          sourceIdentifier: selectedCandidateDetail.sourcing_sources?.[0]?.source_identifier || "",
          collectedAt: selectedCandidateDetail.created_at,
          eventEditionId: selectedCandidateDetail.sourcing_sources?.[0]?.event_edition_id || null,
          standLocation: selectedCandidateDetail.sourcing_sources?.[0]?.stand_location || null,
        },
        enrichment: { attempted: false, success: false, enrichedUrl: null, enrichedPages: [] },
        audit: selectedCandidateDetail.audit_summary || { status: "SUCCESS", missingKeyFields: [], notes: [] },
      };

      const evalData: SourcingEvaluationInput = {
        grade: selectedCandidateDetail.grade,
        status: selectedCandidateDetail.status,
        assignedTo: selectedCandidateDetail.assigned_to || null,
        internalNotes: selectedCandidateDetail.internal_notes || null,
        marketingConsentStatus: selectedCandidateDetail.marketing_consent_status || "UNCONFIRMED",
      };

      const res = await updateSourcingCandidateAction(selectedCandidateDetail.id, draft, evalData);
      if (res.success) {
        setDetailEditSuccess("Changes saved successfully!");
        refreshBrandList();
      } else {
        alert(`Update failed: ${res.error}`);
      }
    } catch (err: any) {
      alert(`Error updating: ${err.message}`);
    } finally {
      setIsUpdatingCandidate(false);
    }
  };

  const handleArchiveCandidate = async (id: string) => {
    if (!selectedCandidateDetail) return;
    try {
      setIsUpdatingCandidate(true);
      const res = await updateSourcingEvaluationAction(id, {
        grade: selectedCandidateDetail.grade,
        status: "ARCHIVED",
        assignedTo: selectedCandidateDetail.assigned_to || undefined,
        internalNotes: selectedCandidateDetail.internal_notes,
        marketingConsentStatus: selectedCandidateDetail.marketing_consent_status,
      });
      if (res.success) {
        setSelectedCandidateDetail((prev: any) => (prev ? { ...prev, status: "ARCHIVED" } : null));
        setDetailEditSuccess("Candidate archived successfully.");
        refreshBrandList();
      } else {
        alert(`Archive failed: ${res.error}`);
      }
    } catch (err: any) {
      alert(`Archive error: ${err.message}`);
    } finally {
      setIsUpdatingCandidate(false);
    }
  };

  const handleDeleteCandidate = (candidateOrId: any) => {
    if (typeof candidateOrId === "string") {
      const found = candidates.find((c) => c.id === candidateOrId) || selectedCandidateDetail;
      setCandidateToDelete(found || { id: candidateOrId, company_name_kr: "Candidate" });
    } else {
      setCandidateToDelete(candidateOrId);
    }
  };

  const handleConfirmDeleteCandidate = async () => {
    if (!candidateToDelete) return;
    setIsDeletingCandidate(true);
    try {
      const res = await deleteSourcingCandidateAction(candidateToDelete.id);
      if (res.success) {
        setDeleteSuccessMessage(`Candidate "${candidateToDelete.company_name_kr}" was deleted successfully.`);
        if (selectedCandidateId === candidateToDelete.id) {
          setSelectedCandidateId(null);
          setSelectedCandidateDetail(null);
        }
        setCandidateToDelete(null);
        refreshBrandList();
        setTimeout(() => setDeleteSuccessMessage(null), 5000);
      } else {
        alert(`Delete failed: ${res.error}`);
      }
    } catch (err: any) {
      alert(`Delete error: ${err.message}`);
    } finally {
      setIsDeletingCandidate(false);
    }
  };

  const handleAddCategoryToBrand = (bIdx: number) => {
    const raw = (newBrandCategoryInputs[bIdx] || "").trim();
    if (!raw || !reviewedDraft) return;
    const brand = reviewedDraft.brands[bIdx];
    const currentCats = Array.isArray(brand?.categories) ? brand.categories : [];
    if (!currentCats.includes(raw)) {
      const copy = [...reviewedDraft.brands];
      copy[bIdx] = {
        ...brand,
        categories: [...currentCats, raw],
      };
      setReviewedDraft({ ...reviewedDraft, brands: copy });
    }
    setNewBrandCategoryInputs((prev) => ({ ...prev, [bIdx]: "" }));
  };

  const handleRemoveCategoryFromBrand = (bIdx: number, catIdx: number) => {
    if (!reviewedDraft) return;
    const brand = reviewedDraft.brands[bIdx];
    const currentCats = Array.isArray(brand?.categories) ? brand.categories : [];
    const copy = [...reviewedDraft.brands];
    copy[bIdx] = {
      ...brand,
      categories: currentCats.filter((_, idx) => idx !== catIdx),
    };
    setReviewedDraft({ ...reviewedDraft, brands: copy });
  };

  // Grade badge styling helper
  const renderGradeBadge = (g: string) => {
    switch (g) {
      case "A":
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">Grade A</span>;
      case "B":
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-300 dark:border-blue-800">Grade B</span>;
      case "C":
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-800">Grade C</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">UNRATED</span>;
    }
  };

  // Status badge styling helper
  const renderStatusBadge = (st: string) => {
    switch (st) {
      case "SAVED":
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">SAVED</span>;
      case "REVIEWED":
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200 dark:border-blue-800/60">REVIEWED</span>;
      case "ARCHIVED":
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">ARCHIVED</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-zinc-50 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">DRAFT</span>;
    }
  };

  // Field Origin badge helper
  const renderOriginTag = (origin?: FieldOrigin) => {
    switch (origin) {
      case "SOURCE_EXHIBITION":
        return <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60 font-mono">INTERCHARM</span>;
      case "OFFICIAL_WEBSITE":
        return <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-50 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800/60 font-mono">OFFICIAL_WEBSITE</span>;
      case "MANUAL":
        return <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 font-mono">ADMIN_EDIT</span>;
      default:
        return <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 font-mono">INFERRED</span>;
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* ------------------------------------------------------------------ */}
      {/* PAGE HEADER & TOP NAVIGATION TABS                                  */}
      {/* ------------------------------------------------------------------ */}
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            Brand Marketing
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Exhibition lead discovery, multi-channel extraction & brand curation pipeline.
          </p>
        </div>

        {/* 4 Top-level Tabs */}
        <div className="flex border-b border-zinc-200 dark:border-zinc-800 gap-2">
          <button
            onClick={() => setActiveTab("import")}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === "import"
                ? "border-zinc-950 text-zinc-950 dark:border-white dark:text-white"
                : "border-transparent text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`}
          >
            <span>Import & Review</span>
            {reviewedDraft && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            )}
          </button>

          <button
            onClick={() => {
              setActiveTab("list");
              refreshBrandList();
            }}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === "list"
                ? "border-zinc-950 text-zinc-950 dark:border-white dark:text-white"
                : "border-transparent text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`}
          >
            <span>Brand List</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-normal">
              {totalCandidates}
            </span>
          </button>

          {/* Phase 2: Disabled Tabs */}
          <button
            disabled
            className="px-4 py-2.5 text-xs font-semibold border-b-2 border-transparent text-zinc-400 dark:text-zinc-600 cursor-not-allowed opacity-60 flex items-center gap-1.5"
            title="Phase 2 Feature"
          >
            <span>Email Campaigns</span>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-850 text-zinc-500 font-medium">
              Coming Soon
            </span>
          </button>

          <button
            disabled
            className="px-4 py-2.5 text-xs font-semibold border-b-2 border-transparent text-zinc-400 dark:text-zinc-600 cursor-not-allowed opacity-60 flex items-center gap-1.5"
            title="Phase 2 Feature"
          >
            <span>Results</span>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-850 text-zinc-500 font-medium">
              Coming Soon
            </span>
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* TAB 1: IMPORT & REVIEW WORKSPACE                                   */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === "import" && (
        <div className="space-y-6">
          {/* Top URL Input Card */}
          <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div>
                <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  InterCHARM Korea Exhibitor Sourcing Adapter
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Enter an exhibitor detail URL to parse company, brand, product catalog, and contact channels.
                </p>
              </div>

              {/* Enrichment Toggle */}
              <label className="flex items-center gap-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 cursor-pointer select-none bg-zinc-50 dark:bg-zinc-800/60 px-3 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-750">
                <input
                  type="checkbox"
                  checked={enrichWebsite}
                  onChange={(e) => setEnrichWebsite(e.target.checked)}
                  className="rounded text-zinc-900 focus:ring-zinc-900 dark:text-white"
                />
                <span>Official Website Enrichment (공식 웹사이트 연계 분석)</span>
              </label>
            </div>

            <form onSubmit={handleExtract} className="flex flex-col sm:flex-row gap-2">
              <input
                type="url"
                required
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://intercharm.co.kr/fairDash.do?hl=KOR&dType=A&..."
                className="flex-1 px-3 py-2 text-xs rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-400"
              />
              <button
                type="submit"
                disabled={isExtracting}
                className="px-5 py-2 text-xs font-bold text-white bg-zinc-950 dark:bg-zinc-100 dark:text-zinc-950 rounded-md hover:bg-zinc-800 dark:hover:bg-white/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 shrink-0 cursor-pointer"
              >
                {isExtracting ? (
                  <>
                    <svg className="animate-spin h-3.5 w-3.5 text-current" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    <span>Extracting...</span>
                  </>
                ) : (
                  <span>Extract Exhibitor Info</span>
                )}
              </button>
            </form>

            {/* Quick Test Sample Loader */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-850 text-xs text-zinc-500">
              <span className="font-semibold text-zinc-600 dark:text-zinc-400">Quick Test Samples:</span>
              {QUICK_TEST_URLS.map((sample) => (
                <button
                  key={sample.name}
                  type="button"
                  onClick={() => {
                    setSourceUrl(sample.url);
                    setExtractError(null);
                  }}
                  className="px-2 py-1 text-[11px] rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 cursor-pointer transition-colors"
                >
                  {sample.name}
                </button>
              ))}
            </div>

            {/* Error Message Banner */}
            {extractError && (
              <div className="p-3 text-xs rounded-md bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300">
                <strong>Extraction Failed:</strong> {extractError}
              </div>
            )}

            {/* Success Message Banner */}
            {saveSuccessMessage && (
              <div className="p-3 text-xs rounded-md bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 flex justify-between items-center">
                <span>{saveSuccessMessage}</span>
                <button
                  onClick={() => {
                    setActiveTab("list");
                    refreshBrandList();
                  }}
                  className="underline font-bold hover:text-emerald-900 dark:hover:text-emerald-100 cursor-pointer"
                >
                  Go to Brand List →
                </button>
              </div>
            )}
          </div>

          {/* Review Workspace when draft is extracted */}
          {reviewedDraft ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* LEFT & CENTER: DRAFT DETAILS WORKSPACE (2 Cols) */}
              <div className="lg:col-span-2 space-y-6">
                {/* Legal Entity vs Brands Separation Alert */}
                <div className="bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-md p-3 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
                  <span className="font-bold shrink-0">NOTICE:</span>
                  <span>
                    Legal company entity and brand names are strictly decoupled. Please confirm that legal master attributes represent the corporate manufacturer, while product lines are assigned to brand profiles.
                  </span>
                </div>

                {/* Duplicate Detection Alert Banner */}
                {duplicateCheck && duplicateCheck.isDuplicate && (
                  <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-md p-4 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-red-800 dark:text-red-300">
                      <svg className="w-4 h-4 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <span>Potential Duplicate Candidate Detected ({duplicateCheck.matches.length} matches)</span>
                    </div>
                    <p className="text-xs text-red-700 dark:text-red-300">
                      Matching records were found in the database. Auto-merging is strictly disabled. You can review matches below before deciding to save.
                    </p>
                    <ul className="text-xs space-y-1 pl-4 list-disc text-red-700 dark:text-red-300 font-mono">
                      {duplicateCheck.matches.map((m, idx) => (
                        <li key={idx}>
                          [{m.matchType}] Matched: &quot;{m.matchedValue}&quot; with {m.entityType} ({m.entityName})
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 1. Legal Company Entity Card */}
                <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-5 shadow-xs space-y-4">
                  <div className="flex justify-between items-center border-b border-zinc-100 dark:border-zinc-800 pb-3">
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                      1. Legal Company Entity (제조사 / 법인 정보)
                    </h3>
                    <div className="flex items-center gap-1.5">
                      {reviewedDraft.company.businessTypes.map((bt) => (
                        <span key={bt} className="text-[10px] font-bold px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                          {bt}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                        Company Name (Korean) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={reviewedDraft.company.nameKr}
                        onChange={(e) =>
                          setReviewedDraft({
                            ...reviewedDraft,
                            company: { ...reviewedDraft.company, nameKr: e.target.value },
                          })
                        }
                        className="w-full px-3 py-1.5 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                        Company Name (English)
                      </label>
                      <input
                        type="text"
                        value={reviewedDraft.company.nameEn || ""}
                        onChange={(e) =>
                          setReviewedDraft({
                            ...reviewedDraft,
                            company: { ...reviewedDraft.company, nameEn: e.target.value },
                          })
                        }
                        className="w-full px-3 py-1.5 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                        Representative / CEO (대표자명)
                      </label>
                      <input
                        type="text"
                        value={reviewedDraft.company.representativeName || ""}
                        onChange={(e) =>
                          setReviewedDraft({
                            ...reviewedDraft,
                            company: { ...reviewedDraft.company, representativeName: e.target.value },
                          })
                        }
                        className="w-full px-3 py-1.5 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100"
                        placeholder="미확인 (Not provided)"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                        Business Registration No. (사업자등록번호)
                      </label>
                      <input
                        type="text"
                        value={reviewedDraft.company.businessRegistrationNumber || ""}
                        onChange={(e) =>
                          setReviewedDraft({
                            ...reviewedDraft,
                            company: {
                              ...reviewedDraft.company,
                              businessRegistrationNumber: e.target.value,
                            },
                          })
                        }
                        className="w-full px-3 py-1.5 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100"
                        placeholder="미확인 (Not provided)"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                        Formatted Address (소재지 주소)
                      </label>
                      <input
                        type="text"
                        value={reviewedDraft.company.address.formattedKr || ""}
                        onChange={(e) =>
                          setReviewedDraft({
                            ...reviewedDraft,
                            company: {
                              ...reviewedDraft.company,
                              address: {
                                ...reviewedDraft.company.address,
                                formattedKr: e.target.value,
                              },
                            },
                          })
                        }
                        className="w-full px-3 py-1.5 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Communication Channels & Official Websites Card */}
                <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-5 shadow-xs space-y-4">
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 border-b border-zinc-100 dark:border-zinc-800 pb-3">
                    2. Contacts & Digital Footprint
                  </h3>

                  {/* Contacts Table */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                        Discovered Contacts ({reviewedDraft.contacts.length})
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const newC: SourcingContact = {
                            name: "",
                            department: null,
                            jobTitle: null,
                            email: "",
                            phone: null,
                            isPrimary: reviewedDraft.contacts.length === 0,
                            source: "MANUAL",
                            sourceUrl: null,
                          };
                          setReviewedDraft({
                            ...reviewedDraft,
                            contacts: [...reviewedDraft.contacts, newC],
                          });
                        }}
                        className="text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer font-medium"
                      >
                        + Add Contact
                      </button>
                    </div>

                    <div className="border border-zinc-200 dark:border-zinc-800 rounded-md overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 font-semibold border-b border-zinc-200 dark:border-zinc-800">
                          <tr>
                            <th className="p-2">Name / Title</th>
                            <th className="p-2">Email</th>
                            <th className="p-2">Phone</th>
                            <th className="p-2">Origin</th>
                            <th className="p-2 text-center">Primary</th>
                            <th className="p-2 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                          {reviewedDraft.contacts.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="p-3 text-center text-zinc-400 italic">
                                No contacts listed. Click &quot;+ Add Contact&quot; to add one.
                              </td>
                            </tr>
                          ) : (
                            reviewedDraft.contacts.map((c, cIdx) => (
                              <tr key={cIdx} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                                <td className="p-2">
                                  <input
                                    type="text"
                                    value={c.name || ""}
                                    placeholder="담당자명"
                                    onChange={(e) => {
                                      const copy = [...reviewedDraft.contacts];
                                      copy[cIdx].name = e.target.value;
                                      setReviewedDraft({ ...reviewedDraft, contacts: copy });
                                    }}
                                    className="w-full px-2 py-0.5 text-xs rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                                  />
                                </td>
                                <td className="p-2">
                                  <input
                                    type="email"
                                    value={c.email}
                                    placeholder="email@company.com"
                                    onChange={(e) => {
                                      const copy = [...reviewedDraft.contacts];
                                      copy[cIdx].email = e.target.value;
                                      setReviewedDraft({ ...reviewedDraft, contacts: copy });
                                    }}
                                    className="w-full px-2 py-0.5 text-xs rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                                  />
                                </td>
                                <td className="p-2">
                                  <input
                                    type="text"
                                    value={c.phone || ""}
                                    placeholder="010-0000-0000"
                                    onChange={(e) => {
                                      const copy = [...reviewedDraft.contacts];
                                      copy[cIdx].phone = e.target.value;
                                      setReviewedDraft({ ...reviewedDraft, contacts: copy });
                                    }}
                                    className="w-full px-2 py-0.5 text-xs rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                                  />
                                </td>
                                <td className="p-2">{renderOriginTag(c.source)}</td>
                                <td className="p-2 text-center">
                                  <input
                                    type="radio"
                                    name="primaryContact"
                                    checked={c.isPrimary}
                                    onChange={() => {
                                      const copy = reviewedDraft.contacts.map((item, idx) => ({
                                        ...item,
                                        isPrimary: idx === cIdx,
                                      }));
                                      setReviewedDraft({ ...reviewedDraft, contacts: copy });
                                    }}
                                    className="text-zinc-900"
                                  />
                                </td>
                                <td className="p-2 text-right">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const wasPrimary = c.isPrimary;
                                      const remaining = reviewedDraft.contacts.filter((_, idx) => idx !== cIdx);
                                      if (wasPrimary && remaining.length > 0) {
                                        remaining[0].isPrimary = true;
                                      }
                                      setReviewedDraft({ ...reviewedDraft, contacts: remaining });
                                    }}
                                    className="text-xs text-red-500 hover:text-red-700 font-semibold cursor-pointer"
                                  >
                                    Remove
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Websites List */}
                  <div className="space-y-2 pt-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                        Corporate Websites & Domains ({reviewedDraft.websites.length})
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const newW: SourcingWebsite = {
                            url: "https://",
                            label: "OFFICIAL",
                            source: "MANUAL",
                          };
                          setReviewedDraft({
                            ...reviewedDraft,
                            websites: [...reviewedDraft.websites, newW],
                          });
                        }}
                        className="text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer font-medium"
                      >
                        + Add Website
                      </button>
                    </div>

                    <div className="space-y-1.5">
                      {reviewedDraft.websites.map((w, wIdx) => (
                        <div
                          key={wIdx}
                          className="flex items-center gap-2 p-2 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 text-xs"
                        >
                          <select
                            value={w.label}
                            onChange={(e) => {
                              const copy = [...reviewedDraft.websites];
                              copy[wIdx].label = e.target.value as any;
                              setReviewedDraft({ ...reviewedDraft, websites: copy });
                            }}
                            className="px-2 py-1 text-xs rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                          >
                            <option value="OFFICIAL">OFFICIAL</option>
                            <option value="BRAND">BRAND</option>
                            <option value="SHOP">SHOP</option>
                            <option value="OTHER">OTHER</option>
                          </select>
                          <input
                            type="url"
                            value={w.url}
                            onChange={(e) => {
                              const copy = [...reviewedDraft.websites];
                              copy[wIdx].url = e.target.value;
                              setReviewedDraft({ ...reviewedDraft, websites: copy });
                            }}
                            className="flex-1 px-2.5 py-1 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                          />
                          {renderOriginTag(w.source)}
                          <a
                            href={w.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                          >
                            ↗
                          </a>
                          <button
                            type="button"
                            onClick={() => {
                              const updated = reviewedDraft.websites.filter((_, idx) => idx !== wIdx);
                              setReviewedDraft({ ...reviewedDraft, websites: updated });
                            }}
                            className="text-xs text-red-500 hover:text-red-700 cursor-pointer px-1 font-bold"
                            title="Remove website"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 3. Brands & Product Catalog Card */}
                <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-5 shadow-xs space-y-5">
                  <div className="flex justify-between items-center border-b border-zinc-100 dark:border-zinc-800 pb-3">
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                      3. Brands & Product Catalog ({reviewedDraft.brands.length} Brands)
                    </h3>
                    <button
                      type="button"
                      onClick={() => {
                        const newBrand: SourcingBrand = {
                          nameKr: "신규 브랜드",
                          nameEn: "",
                          description: "",
                          categories: reviewedDraft.categories?.length > 0 ? [reviewedDraft.categories[0]] : ["Skin Care"],
                          keyProducts: [],
                          source: "MANUAL",
                        };
                        setReviewedDraft({
                          ...reviewedDraft,
                          brands: [...reviewedDraft.brands, newBrand],
                        });
                      }}
                      className="px-2.5 py-1 text-xs font-semibold rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 cursor-pointer"
                    >
                      + Add Brand
                    </button>
                  </div>

                  {/* Represented Brands Section */}
                  <div className="space-y-3">
                    <div className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                      Represented Brands ({reviewedDraft.brands.length})
                    </div>

                    <div className="space-y-4">
                      {reviewedDraft.brands.map((brand, bIdx) => (
                        <div
                          key={bIdx}
                          className="p-4 rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 space-y-3"
                        >
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                                Brand #{bIdx + 1}
                              </span>
                              {renderOriginTag(brand.source)}
                            </div>
                            {reviewedDraft.brands.length > 1 && (
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = reviewedDraft.brands.filter((_, idx) => idx !== bIdx);
                                  setReviewedDraft({ ...reviewedDraft, brands: updated });
                                }}
                                className="text-xs text-red-500 hover:text-red-700 cursor-pointer"
                              >
                                Remove
                              </button>
                            )}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-0.5">
                                Brand Name (Korean)
                              </label>
                              <input
                                type="text"
                                value={brand.nameKr}
                                onChange={(e) => {
                                  const copy = [...reviewedDraft.brands];
                                  copy[bIdx].nameKr = e.target.value;
                                  setReviewedDraft({ ...reviewedDraft, brands: copy });
                                }}
                                className="w-full px-2.5 py-1 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-0.5">
                                Brand Name (English)
                              </label>
                              <input
                                type="text"
                                value={brand.nameEn || ""}
                                onChange={(e) => {
                                  const copy = [...reviewedDraft.brands];
                                  copy[bIdx].nameEn = e.target.value;
                                  setReviewedDraft({ ...reviewedDraft, brands: copy });
                                }}
                                className="w-full px-2.5 py-1 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                              />
                            </div>

                            {/* Rendered as Visual Chips/Tiles (Requirement 2) */}
                            <div className="sm:col-span-2 space-y-1.5">
                              <label className="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
                                Categories
                              </label>
                              <div className="flex flex-wrap items-center gap-1.5 p-2 rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 min-h-[38px]">
                                {brand.categories && brand.categories.length > 0 ? (
                                  brand.categories.map((cat, catIdx) => (
                                    <span
                                      key={catIdx}
                                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                                    >
                                      {cat}
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveCategoryFromBrand(bIdx, catIdx)}
                                        className="hover:text-blue-900 dark:hover:text-blue-100 cursor-pointer ml-0.5 font-bold"
                                        title="Remove category"
                                      >
                                        ✕
                                      </button>
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-[11px] text-zinc-400 italic">No categories assigned</span>
                                )}

                                <div className="inline-flex items-center gap-1 ml-auto">
                                  <input
                                    type="text"
                                    placeholder="+ Add category"
                                    value={newBrandCategoryInputs[bIdx] || ""}
                                    onChange={(e) =>
                                      setNewBrandCategoryInputs({
                                        ...newBrandCategoryInputs,
                                        [bIdx]: e.target.value,
                                      })
                                    }
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        e.preventDefault();
                                        handleAddCategoryToBrand(bIdx);
                                      }
                                    }}
                                    className="px-2 py-0.5 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 w-28 focus:w-40 transition-all"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleAddCategoryToBrand(bIdx)}
                                    title="Add category to brand"
                                    data-testid="add-cat-btn"
                                    className="px-2 py-0.5 text-xs font-semibold rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-700 cursor-pointer"
                                  >
                                    Add
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Specifically Attributed Products (if any) */}
                          {brand.keyProducts.length > 0 && (
                            <div className="pt-2">
                              <span className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 block mb-1.5">
                                Attributed Products ({brand.keyProducts.length})
                              </span>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {brand.keyProducts.map((prod, pIdx) => (
                                  <div
                                    key={pIdx}
                                    className="flex items-start gap-2 p-2 rounded bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs"
                                  >
                                    {prod.imageUrl && (
                                      <img
                                        src={prod.imageUrl}
                                        alt={prod.titleKr || prod.titleEn || "Product"}
                                        className="w-10 h-10 object-cover rounded shrink-0 border border-zinc-200 dark:border-zinc-700"
                                      />
                                    )}
                                    <div className="min-w-0 flex-1">
                                      <p className="font-bold text-zinc-900 dark:text-zinc-100 truncate">
                                        {prod.titleKr || prod.titleEn}
                                      </p>
                                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-1">
                                        {prod.description || "No description"}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 4. Corporate Description & Overview Card (Moved to bottom - Requirement 1) */}
                <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-5 shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                      4. Corporate Description & Overview (회사 소개 및 기업 개요)
                    </h3>
                    <span className="text-[11px] text-zinc-400">
                      Source Overview & Narrative
                    </span>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                          Corporate Description (Korean)
                        </label>
                        {!reviewedDraft.company.descriptionKr && reviewedDraft.company.descriptionEn && (
                          <span className="text-[10px] text-zinc-400 italic">
                            Exhibitor did not register a Korean description
                          </span>
                        )}
                      </div>
                      <textarea
                        rows={3}
                        placeholder="국문 회사 소개 및 기업 개요 (미입력 시 영문 소개가 기본 참조됩니다)"
                        value={reviewedDraft.company.descriptionKr || ""}
                        onChange={(e) =>
                          setReviewedDraft({
                            ...reviewedDraft,
                            company: { ...reviewedDraft.company, descriptionKr: e.target.value },
                          })
                        }
                        className="w-full px-3 py-2 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 whitespace-pre-wrap font-sans leading-relaxed"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                          Corporate Description (English)
                        </label>
                        {!reviewedDraft.company.descriptionKr && reviewedDraft.company.descriptionEn && (
                          <span className="px-2 py-0.5 text-[10px] font-semibold rounded bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900">
                            Exhibitor Source: English only
                          </span>
                        )}
                      </div>
                      <textarea
                        rows={4}
                        placeholder="English corporate description from exhibitor registry or official website..."
                        value={reviewedDraft.company.descriptionEn || ""}
                        onChange={(e) =>
                          setReviewedDraft({
                            ...reviewedDraft,
                            company: { ...reviewedDraft.company, descriptionEn: e.target.value },
                          })
                        }
                        className="w-full px-3 py-2 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 whitespace-pre-wrap font-sans leading-relaxed"
                      />
                    </div>
                  </div>
                </div>

                {/* 4. Provenance Attribution Footprint */}
                <div className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 text-xs space-y-1.5 text-zinc-500 dark:text-zinc-400">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-zinc-700 dark:text-zinc-300">
                      Provenance: {reviewedDraft.source.provider}
                    </span>
                    <span className="font-mono text-[11px]">
                      ID: {reviewedDraft.source.sourceIdentifier}
                    </span>
                  </div>
                  <div>
                    Source URL:{" "}
                    <a
                      href={reviewedDraft.source.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline text-blue-600 dark:text-blue-400 break-all"
                    >
                      {reviewedDraft.source.sourceUrl}
                    </a>
                  </div>
                  {reviewedDraft.source.standLocation && (
                    <div>Exhibition Stand: {reviewedDraft.source.standLocation}</div>
                  )}
                  {reviewedDraft.enrichment.attempted && (
                    <div>
                      Website Enrichment:{" "}
                      {reviewedDraft.enrichment.success
                        ? `SUCCESS (${reviewedDraft.enrichment.enrichedPages.length} pages crawled)`
                        : `FAILED: ${reviewedDraft.enrichment.error || "Could not crawl"}`}
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT COLUMN: ADMIN EVALUATION & SAVE ACTION PANEL */}
              <div className="space-y-6">
                <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-5 shadow-xs space-y-4 sticky top-6">
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 border-b border-zinc-100 dark:border-zinc-800 pb-3">
                    5. Admin Evaluation & Curation
                  </h3>

                  {/* Grade Selector */}
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                      Candidate Grade (등급 평가)
                    </label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {(["A", "B", "C", "UNRATED"] as const).map((g) => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => setGrade(g)}
                          className={`py-1.5 text-xs font-bold rounded border transition-colors cursor-pointer text-center ${
                            grade === g
                              ? g === "A"
                                ? "bg-emerald-600 text-white border-emerald-600"
                                : g === "B"
                                ? "bg-blue-600 text-white border-blue-600"
                                : g === "C"
                                ? "bg-amber-600 text-white border-amber-600"
                                : "bg-zinc-800 text-white border-zinc-800"
                              : "bg-white dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50"
                          }`}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-1">
                      A: High Priority, B: Promising, C: Low Priority, UNRATED: Pending review
                    </p>
                  </div>

                  {/* Status Selector */}
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                      Workflow Status (진행 상태)
                    </label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as any)}
                      className="w-full px-3 py-1.5 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100"
                    >
                      <option value="DRAFT">DRAFT (초안 검토 중)</option>
                      <option value="REVIEWED">REVIEWED (검토 완료)</option>
                      <option value="SAVED">SAVED (후보 등록 완료)</option>
                      <option value="ARCHIVED">ARCHIVED (보관/제외)</option>
                    </select>
                  </div>

                  {/* Marketing Consent Status (Read-only Invariant) */}
                  <div className="p-2.5 rounded bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 text-xs">
                    <span className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-0.5">
                      Marketing Consent Status:
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-amber-700 dark:text-amber-400 font-bold">
                        UNCONFIRMED (미확인)
                      </span>
                    </div>
                    <p className="text-[10px] text-zinc-400 mt-1">
                      Legal compliance: External marketing consent is strictly unconfirmed by default and decoupled from email collection.
                    </p>
                  </div>

                  {/* Internal Review Notes */}
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                      Internal Notes (검토 및 메모)
                    </label>
                    <textarea
                      rows={3}
                      value={internalNotes}
                      onChange={(e) => setInternalNotes(e.target.value)}
                      placeholder="제품 경쟁력, 해외 유통 가능성, 후속 연락 전략..."
                      className="w-full px-3 py-2 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100"
                    />
                  </div>

                  {/* Save Action Buttons */}
                  <div className="pt-2 space-y-2">
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={handleInitiateSave}
                      className="w-full py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md transition-colors shadow-xs disabled:opacity-50 cursor-pointer flex justify-center items-center gap-2"
                    >
                      {isSaving ? (
                        <>
                          <svg className="animate-spin h-3.5 w-3.5 text-current" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                          </svg>
                          <span>Saving to QA DB...</span>
                        </>
                      ) : (
                        <span>Save to Brand List (브랜드 목록에 저장)</span>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (confirm("Reset current draft? Unsaved changes will be lost.")) {
                          setReviewedDraft(null);
                          setDuplicateCheck(null);
                          setExtractError(null);
                        }
                      }}
                      className="w-full py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 rounded border border-zinc-200 dark:border-zinc-800 cursor-pointer"
                    >
                      Clear Workspace
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Empty State for Review Workspace */
            <div className="bg-white dark:bg-zinc-900 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-800 p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto text-zinc-400">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              </div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                No Exhibitor Draft Loaded
              </h3>
              <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                Paste an InterCHARM Korea exhibitor URL above or select a quick sample to parse exhibition profiles into the review workspace.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* TAB 2: BRAND LIST VIEW                                             */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === "list" && (
        <div className="space-y-4">
          {/* Search & Filter Bar */}
          <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 shadow-xs flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="flex-1 min-w-[240px]">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setCurrentPage(1);
                    refreshBrandList(1);
                  }
                }}
                placeholder="Search company, brand, email, or domain..."
                className="w-full px-3 py-1.5 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100"
              />
            </div>

            {/* Grade Filter */}
            <div className="w-32">
              <select
                value={filterGrade}
                onChange={(e) => {
                  setFilterGrade(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-2.5 py-1.5 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100"
              >
                <option value="ALL">Grade: All</option>
                <option value="A">Grade A</option>
                <option value="B">Grade B</option>
                <option value="C">Grade C</option>
                <option value="UNRATED">UNRATED</option>
              </select>
            </div>

            {/* Status Filter */}
            <div className="w-36">
              <select
                value={filterStatus}
                onChange={(e) => {
                  setFilterStatus(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-2.5 py-1.5 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100"
              >
                <option value="ALL">Status: All</option>
                <option value="SAVED">SAVED</option>
                <option value="REVIEWED">REVIEWED</option>
                <option value="DRAFT">DRAFT</option>
                <option value="ARCHIVED">ARCHIVED</option>
              </select>
            </div>

            {/* Apply & Refresh Buttons */}
            <button
              type="button"
              onClick={() => {
                setCurrentPage(1);
                refreshBrandList(1);
              }}
              className="px-4 py-1.5 text-xs font-bold text-white bg-zinc-950 dark:bg-zinc-100 dark:text-zinc-950 rounded hover:bg-zinc-800 dark:hover:bg-white/90 cursor-pointer"
            >
              Filter
            </button>
          </div>

          {/* Delete Success Alert */}
          {deleteSuccessMessage && (
            <div className="p-3.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
              <span>{deleteSuccessMessage}</span>
              <button
                type="button"
                onClick={() => setDeleteSuccessMessage(null)}
                className="text-emerald-600 hover:text-emerald-800 dark:hover:text-emerald-100 cursor-pointer font-bold"
              >
                ✕
              </button>
            </div>
          )}

          {/* Sourcing Candidates Table */}
          <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 dark:bg-zinc-800/60 text-zinc-600 dark:text-zinc-300 font-semibold border-b border-zinc-200 dark:border-zinc-800">
                  <tr>
                    <th className="p-3">Company (법인명)</th>
                    <th className="p-3">Brands</th>
                    <th className="p-3">Categories</th>
                    <th className="p-3">Grade</th>
                    <th className="p-3">Primary Contact</th>
                    <th className="p-3">Website</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Discovered</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {isLoadingList ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-zinc-400">
                        Loading candidate list...
                      </td>
                    </tr>
                  ) : candidates.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-12 text-center space-y-2">
                        <p className="text-zinc-500 font-medium">No sourcing candidates found.</p>
                        <button
                          type="button"
                          onClick={() => setActiveTab("import")}
                          className="text-xs text-blue-600 dark:text-blue-400 font-bold underline cursor-pointer"
                        >
                          Extract and add candidates from InterCHARM →
                        </button>
                      </td>
                    </tr>
                  ) : (
                    candidates.map((c) => {
                      const primaryContact = c.sourcing_contacts?.find((ct: any) => ct.is_primary) || c.sourcing_contacts?.[0];
                      const primaryWeb = c.sourcing_websites?.[0]?.url;

                      // Extract unique categories across all brands for this candidate
                      const allCategories = Array.from(
                        new Set(c.sourcing_brands?.flatMap((b: any) => b.categories || []) || [])
                      ) as string[];

                      return (
                        <tr
                          key={c.id}
                          onClick={() => handleOpenDetail(c.id)}
                          className="hover:bg-zinc-50 dark:hover:bg-zinc-850/50 cursor-pointer transition-colors"
                        >
                          <td className="p-3">
                            <p className="font-bold text-zinc-900 dark:text-zinc-100">
                              {c.company_name_kr}
                            </p>
                            {c.company_name_en && (
                              <p className="text-[11px] text-zinc-400 truncate max-w-[180px]">
                                {c.company_name_en}
                              </p>
                            )}
                          </td>
                          {/* Distinct Brands Column (Requirement 3) */}
                          <td className="p-3">
                            <div className="flex flex-wrap gap-1 max-w-[200px]">
                              {c.sourcing_brands && c.sourcing_brands.length > 0 ? (
                                c.sourcing_brands.map((b: any, idx: number) => (
                                  <span
                                    key={idx}
                                    className="inline-block px-1.5 py-0.5 rounded text-[11px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700"
                                  >
                                    {b.brand_name_kr || b.brand_name_en}
                                  </span>
                                ))
                              ) : (
                                <span className="text-zinc-400 text-[11px]">-</span>
                              )}
                            </div>
                          </td>
                          {/* Distinct Categories Column (Requirement 3) */}
                          <td className="p-3">
                            <div className="flex flex-wrap gap-1 max-w-[220px]">
                              {allCategories.length > 0 ? (
                                allCategories.map((cat: string, catIdx: number) => (
                                  <span
                                    key={catIdx}
                                    className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/60"
                                  >
                                    {cat}
                                  </span>
                                ))
                              ) : (
                                <span className="text-zinc-400 text-[11px]">-</span>
                              )}
                            </div>
                          </td>
                          <td className="p-3">{renderGradeBadge(c.grade)}</td>
                          <td className="p-3 text-zinc-600 dark:text-zinc-400">
                            {primaryContact ? (
                              <div>
                                <p className="font-medium text-zinc-800 dark:text-zinc-200">
                                  {primaryContact.name || "담당자"}
                                </p>
                                <p className="text-[11px] text-zinc-500 font-mono truncate max-w-[140px]">
                                  {primaryContact.email}
                                </p>
                              </div>
                            ) : (
                              <span className="text-zinc-400">-</span>
                            )}
                          </td>
                          <td className="p-3 text-zinc-500">
                            {primaryWeb ? (
                              <a
                                href={primaryWeb}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-blue-600 dark:text-blue-400 underline truncate max-w-[120px] inline-block"
                              >
                                {new URL(primaryWeb).hostname.replace(/^www\./, "")}
                              </a>
                            ) : (
                              "-"
                            )}
                          </td>
                          <td className="p-3">{renderStatusBadge(c.status)}</td>
                          <td className="p-3 text-zinc-500 text-[11px]">
                            {new Date(c.created_at).toLocaleDateString()}
                          </td>
                          {/* Actions: View/Edit + Delete Button */}
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenDetail(c.id);
                                }}
                                className="px-2.5 py-1 text-[11px] font-semibold rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 cursor-pointer"
                              >
                                View / Edit
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteCandidate(c);
                                }}
                                className="px-2 py-1 text-[11px] font-semibold rounded text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 border border-red-200 dark:border-red-900/50 cursor-pointer"
                                title="Delete candidate"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination footer */}
            <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-xs text-zinc-500">
              <span>
                Showing {candidates.length} of {totalCandidates} candidates
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => {
                    const p = currentPage - 1;
                    setCurrentPage(p);
                    refreshBrandList(p);
                  }}
                  className="px-2.5 py-1 rounded border border-zinc-200 dark:border-zinc-700 disabled:opacity-40 cursor-pointer"
                >
                  Previous
                </button>
                <span>
                  Page {currentPage} of {Math.max(1, Math.ceil(totalCandidates / pageSize))}
                </span>
                <button
                  type="button"
                  disabled={currentPage >= Math.ceil(totalCandidates / pageSize)}
                  onClick={() => {
                    const p = currentPage + 1;
                    setCurrentPage(p);
                    refreshBrandList(p);
                  }}
                  className="px-2.5 py-1 rounded border border-zinc-200 dark:border-zinc-700 disabled:opacity-40 cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* DUPLICATE WARNING MODAL DIALOG                                     */}
      {/* ------------------------------------------------------------------ */}
      {showDuplicateModal && duplicateCheck && (
        <div className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              Potential Duplicate Candidate Warning
            </h3>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              The company you are trying to save matches existing candidate or partner records:
            </p>

            <div className="bg-red-50 dark:bg-red-950/40 p-3 rounded-md text-xs font-mono text-red-700 dark:text-red-300 space-y-1">
              {duplicateCheck.matches.map((m, idx) => (
                <div key={idx}>
                  • [{m.matchType}] {m.matchedValue} ({m.entityName})
                </div>
              ))}
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Override Audit Reason (필수 사유 입력):
              </label>
              <input
                type="text"
                placeholder="e.g. New exhibition edition update, subsidiary brand..."
                value={duplicateOverrideReason}
                onChange={(e) => setDuplicateOverrideReason(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100"
              />
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                disabled={!duplicateOverrideReason.trim()}
                onClick={() => executeSave(duplicateOverrideReason.trim())}
                className="w-full py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-md disabled:opacity-50 cursor-pointer"
              >
                Save as New Candidate with Audit Log
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowDuplicateModal(false);
                  setActiveTab("list");
                  refreshBrandList();
                }}
                className="w-full py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 rounded-md hover:bg-zinc-200 cursor-pointer"
              >
                Go to Brand List to View Existing
              </button>

              <button
                type="button"
                onClick={() => setShowDuplicateModal(false)}
                className="w-full py-1 text-xs text-zinc-500 hover:text-zinc-700 cursor-pointer"
              >
                Cancel and Return to Review
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* DELETE CANDIDATE CONFIRMATION MODAL                                */}
      {/* ------------------------------------------------------------------ */}
      {candidateToDelete && (
        <div className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0 text-lg font-bold">
                ⚠️
              </div>
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  Delete Sourcing Candidate
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Permanent removal of sourcing entity
                </p>
              </div>
            </div>

            <div className="p-3 rounded-md bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60 text-xs">
              <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                {candidateToDelete.company_name_kr}
                {candidateToDelete.company_name_en && (
                  <span className="text-zinc-500 font-normal ml-1">
                    ({candidateToDelete.company_name_en})
                  </span>
                )}
              </p>
              {candidateToDelete.sourcing_brands && candidateToDelete.sourcing_brands.length > 0 && (
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
                  Associated Brands ({candidateToDelete.sourcing_brands.length}):{" "}
                  {candidateToDelete.sourcing_brands
                    .map((b: any) => b.brand_name_kr || b.brand_name_en)
                    .join(", ")}
                </p>
              )}
            </div>

            <div className="text-xs text-zinc-600 dark:text-zinc-300 space-y-2">
              <p className="font-medium text-red-600 dark:text-red-400">
                This will permanently delete this company and all its associated brands, contacts, websites, and exhibition sources.
              </p>
              <div className="p-2.5 rounded bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 text-[11px] text-amber-800 dark:text-amber-200">
                <strong>Tip — Archive vs. Delete:</strong> If you want to preserve records for historical audit or avoid re-importing duplicates, consider changing the status to <strong>Archive</strong> instead of permanent deletion.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
              <button
                type="button"
                disabled={isDeletingCandidate}
                onClick={() => setCandidateToDelete(null)}
                className="px-3.5 py-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingCandidate}
                onClick={handleConfirmDeleteCandidate}
                className="px-4 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {isDeletingCandidate ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* CANDIDATE DETAIL SLIDEOVER DRAWER                                  */}
      {/* ------------------------------------------------------------------ */}
      {selectedCandidateId && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex justify-end">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-2xl h-full shadow-2xl overflow-y-auto p-6 space-y-6 border-l border-zinc-200 dark:border-zinc-800">
            {/* Drawer Header */}
            <div className="flex justify-between items-center border-b border-zinc-200 dark:border-zinc-800 pb-4">
              <div>
                <span className="text-[11px] font-mono text-zinc-400">Candidate Detail</span>
                <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                  {selectedCandidateDetail?.company_name_kr || "Loading..."}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedCandidateId(null);
                  setSelectedCandidateDetail(null);
                }}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            {isDetailLoading ? (
              <div className="py-20 text-center text-zinc-400 text-xs">Loading candidate profile...</div>
            ) : selectedCandidateDetail ? (
              <div className="space-y-6 text-xs">
                {detailEditSuccess && (
                  <div className="p-3 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-semibold">
                    {detailEditSuccess}
                  </div>
                )}

                {/* 1) TOP CARD — Company Overview (Requirement 4) */}
                <div className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-850/60 border border-zinc-200 dark:border-zinc-800 space-y-3.5">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                        Company Overview
                      </span>
                      <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 mt-0.5">
                        {selectedCandidateDetail.company_name_kr}
                      </h3>
                      {selectedCandidateDetail.company_name_en && (
                        <p className="text-xs text-zinc-500 font-medium">
                          {selectedCandidateDetail.company_name_en}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {renderGradeBadge(selectedCandidateDetail.grade)}
                      {renderStatusBadge(selectedCandidateDetail.status)}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-zinc-200/80 dark:border-zinc-800 text-xs">
                    {/* Address */}
                    <div className="md:col-span-2">
                      <span className="text-zinc-400 font-semibold block text-[11px]">Address (주소)</span>
                      <span className="text-zinc-800 dark:text-zinc-200 font-medium">
                        {selectedCandidateDetail.address_formatted_kr || selectedCandidateDetail.address_street_kr || "-"}
                      </span>
                    </div>

                    {/* Representative & Business Number */}
                    <div>
                      <span className="text-zinc-400 font-semibold block text-[11px]">Representative (대표자)</span>
                      <span className="text-zinc-800 dark:text-zinc-200 font-medium">
                        {selectedCandidateDetail.representative_name || "-"}
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-400 font-semibold block text-[11px]">Business Registration # (사업자등록번호)</span>
                      <span className="text-zinc-800 dark:text-zinc-200 font-medium">
                        {selectedCandidateDetail.business_number || "-"}
                      </span>
                    </div>

                    {/* Primary Contact Person, Email & Phone */}
                    {(() => {
                      const primaryContact =
                        selectedCandidateDetail.sourcing_contacts?.find((ct: any) => ct.is_primary) ||
                        selectedCandidateDetail.sourcing_contacts?.[0];
                      return (
                        <>
                          <div>
                            <span className="text-zinc-400 font-semibold block text-[11px]">Primary Contact (담당자)</span>
                            <span className="text-zinc-800 dark:text-zinc-200 font-medium">
                              {primaryContact?.name || "-"}
                              {primaryContact?.role && (
                                <span className="text-zinc-400 font-normal ml-1">({primaryContact.role})</span>
                              )}
                            </span>
                          </div>
                          <div>
                            <span className="text-zinc-400 font-semibold block text-[11px]">Contact Email & Phone</span>
                            <div className="space-y-0.5">
                              {primaryContact?.email ? (
                                <div>
                                  <a
                                    href={`mailto:${primaryContact.email}`}
                                    className="text-blue-600 dark:text-blue-400 underline font-medium"
                                  >
                                    {primaryContact.email}
                                  </a>
                                </div>
                              ) : (
                                <span className="text-zinc-400">-</span>
                              )}
                              {(primaryContact?.phone || primaryContact?.mobile) && (
                                <div className="text-zinc-600 dark:text-zinc-400 text-[11px]">
                                  {primaryContact.phone || primaryContact.mobile}
                                </div>
                              )}
                            </div>
                          </div>
                        </>
                      );
                    })()}

                    {/* Website(s) with clickable external links */}
                    <div className="md:col-span-2">
                      <span className="text-zinc-400 font-semibold block text-[11px]">Websites (웹사이트)</span>
                      {selectedCandidateDetail.sourcing_websites && selectedCandidateDetail.sourcing_websites.length > 0 ? (
                        <div className="flex flex-wrap gap-2 mt-1">
                          {selectedCandidateDetail.sourcing_websites.map((ws: any, wsIdx: number) => {
                            const rawUrl = ws.url?.trim() || "";
                            const displayUrl = rawUrl.startsWith("http://") || rawUrl.startsWith("https://") ? rawUrl : `https://${rawUrl}`;
                            return (
                              <a
                                key={wsIdx}
                                href={displayUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-blue-600 dark:text-blue-400 hover:underline"
                              >
                                <span>🌐 {ws.title || ws.website_type || "Website"}</span>
                                <span className="text-zinc-400 text-[10px]">↗</span>
                              </a>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="text-zinc-400">-</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* 2) SECOND SECTION — Represented Brands & Categories (Requirement 4) */}
                <div className="space-y-3">
                  <h4 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">
                    Represented Brands & Categories ({selectedCandidateDetail.sourcing_brands?.length || 0})
                  </h4>

                  {selectedCandidateDetail.sourcing_brands && selectedCandidateDetail.sourcing_brands.length > 0 ? (
                    selectedCandidateDetail.sourcing_brands.map((b: any, idx: number) => (
                      <div
                        key={idx}
                        className="p-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 space-y-2.5"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                              {b.brand_name_kr}
                            </span>
                            {b.brand_name_en && b.brand_name_en !== b.brand_name_kr && (
                              <span className="text-zinc-500 font-normal ml-1.5 text-xs">
                                ({b.brand_name_en})
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Categories as chips/tags */}
                        <div>
                          <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide block mb-1">
                            Categories
                          </span>
                          {b.categories && b.categories.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                              {b.categories.map((cat: string, catIdx: number) => (
                                <span
                                  key={catIdx}
                                  className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/60"
                                >
                                  {cat}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-zinc-400 text-[11px] italic">No categories assigned</span>
                          )}
                        </div>

                        {/* Attributed Products */}
                        {b.key_products && b.key_products.length > 0 && (
                          <div className="pt-2 border-t border-zinc-200/60 dark:border-zinc-800/80">
                            <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide block mb-1.5">
                              Attributed Products ({b.key_products.length})
                            </span>
                            <div className="space-y-1.5">
                              {b.key_products.map((kp: any, pIdx: number) => (
                                <div
                                  key={pIdx}
                                  className="text-xs text-zinc-700 dark:text-zinc-300 flex items-start gap-2 bg-white dark:bg-zinc-900 p-2 rounded border border-zinc-200/80 dark:border-zinc-800"
                                >
                                  <span className="text-zinc-400 mt-0.5">•</span>
                                  <div className="flex-1">
                                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                                      {kp.titleKr || kp.titleEn}
                                    </span>
                                    {kp.titleEn && kp.titleEn !== kp.titleKr && (
                                      <span className="text-zinc-400 text-[11px] ml-1.5">
                                        ({kp.titleEn})
                                      </span>
                                    )}
                                    {kp.descriptionKr && (
                                      <p className="text-[11px] text-zinc-500 mt-0.5 line-clamp-2">
                                        {kp.descriptionKr}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-zinc-400 text-xs italic">No brands associated with this company.</p>
                  )}
                </div>

                {/* 3) THIRD SECTION — Corporate Description (Requirement 4) */}
                <div className="space-y-3">
                  <h4 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">
                    Corporate Description
                  </h4>
                  {selectedCandidateDetail.description_kr || selectedCandidateDetail.description_en ? (
                    <div className="space-y-2.5">
                      {selectedCandidateDetail.description_kr && (
                        <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-1">
                          <span className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 block">
                            Korean Description
                          </span>
                          <p className="text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap font-sans text-xs leading-relaxed">
                            {selectedCandidateDetail.description_kr}
                          </p>
                        </div>
                      )}
                      {selectedCandidateDetail.description_en && (
                        <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
                              English Description
                            </span>
                            {!selectedCandidateDetail.description_kr && (
                              <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
                                Exhibitor Source: English only
                              </span>
                            )}
                          </div>
                          <p className="text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap font-sans text-xs leading-relaxed">
                            {selectedCandidateDetail.description_en}
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-400 text-xs italic">
                      No corporate description provided.
                    </div>
                  )}
                </div>

                {/* 4) FOURTH SECTION — Evaluation & Workflow Status (Requirement 4) */}
                <div className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 space-y-3">
                  <h4 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">Evaluation & Workflow Status</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-zinc-600 dark:text-zinc-400 mb-1 font-semibold text-[11px]">
                        Grade
                      </label>
                      <select
                        value={selectedCandidateDetail.grade}
                        onChange={(e) =>
                          setSelectedCandidateDetail({
                            ...selectedCandidateDetail,
                            grade: e.target.value,
                          })
                        }
                        className="w-full px-2.5 py-1.5 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                      >
                        <option value="A">Grade A (High Priority)</option>
                        <option value="B">Grade B (Standard)</option>
                        <option value="C">Grade C (Low Priority)</option>
                        <option value="UNRATED">UNRATED</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-zinc-600 dark:text-zinc-400 mb-1 font-semibold text-[11px]">
                        Status
                      </label>
                      <select
                        value={selectedCandidateDetail.status}
                        onChange={(e) =>
                          setSelectedCandidateDetail({
                            ...selectedCandidateDetail,
                            status: e.target.value,
                          })
                        }
                        className="w-full px-2.5 py-1.5 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                      >
                        <option value="DRAFT">DRAFT</option>
                        <option value="REVIEWED">REVIEWED</option>
                        <option value="SAVED">SAVED</option>
                        <option value="ARCHIVED">ARCHIVED</option>
                      </select>
                    </div>

                    <div className="col-span-2">
                      <label className="block text-zinc-600 dark:text-zinc-400 mb-1 font-semibold text-[11px]">
                        Internal Notes
                      </label>
                      <textarea
                        rows={3}
                        value={selectedCandidateDetail.internal_notes || ""}
                        onChange={(e) =>
                          setSelectedCandidateDetail({
                            ...selectedCandidateDetail,
                            internal_notes: e.target.value,
                          })
                        }
                        placeholder="Add internal evaluation comments, sourcing history, or follow-up notes..."
                        className="w-full px-2.5 py-1.5 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                      />
                    </div>
                  </div>
                </div>

                {/* Provenance Link */}
                {selectedCandidateDetail.sourcing_sources?.[0] && (
                  <div className="pt-2 text-[11px] text-zinc-500 flex items-center justify-between border-t border-zinc-200 dark:border-zinc-800">
                    <span>
                      Source Provider:{" "}
                      <strong className="text-zinc-700 dark:text-zinc-300">
                        {selectedCandidateDetail.sourcing_sources[0].provider}
                      </strong>
                      {selectedCandidateDetail.sourcing_sources[0].edition && ` (${selectedCandidateDetail.sourcing_sources[0].edition})`}
                    </span>
                    {selectedCandidateDetail.sourcing_sources[0].source_url && (
                      <a
                        href={selectedCandidateDetail.sourcing_sources[0].source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline text-blue-600 dark:text-blue-400 flex items-center gap-1"
                      >
                        Original Exhibition URL ↗
                      </a>
                    )}
                  </div>
                )}

                {/* 5) BOTTOM ACTIONS (Requirement 4) */}
                <div className="flex items-center gap-2 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                  <button
                    type="button"
                    disabled={isUpdatingCandidate}
                    onClick={handleUpdateDetailEvaluation}
                    className="flex-1 py-2 text-xs font-bold text-white bg-zinc-950 dark:bg-zinc-100 dark:text-zinc-950 rounded hover:bg-zinc-800 dark:hover:bg-zinc-200 cursor-pointer disabled:opacity-50"
                  >
                    {isUpdatingCandidate ? "Saving..." : "Save Changes"}
                  </button>

                  {selectedCandidateDetail.status !== "ARCHIVED" && (
                    <button
                      type="button"
                      disabled={isUpdatingCandidate}
                      onClick={() => handleArchiveCandidate(selectedCandidateDetail.id)}
                      className="px-3.5 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer disabled:opacity-50"
                      title="Soft-archive this candidate without deleting associated records"
                    >
                      Archive
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleDeleteCandidate(selectedCandidateDetail)}
                    className="px-3.5 py-2 text-xs font-bold text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/80 rounded hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer"
                    title="Permanently remove candidate and cascade-delete child brands, contacts and websites"
                  >
                    Delete Candidate
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
