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
  BusinessType,
} from "@/lib/brand-sourcing/types";
import { COMPANY_TYPE_OPTIONS } from "@/lib/brand-sourcing/types";
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
    name: "3일애 (Three Days Love)",
    url: "https://www.intercharmkorea.com/ko-kr/exhibitor_directory/Exhibitor_detail.3%EC%9D%BC%EC%95%A0.org-b4fa5886-d5fd-490e-92bf-0c0b65d0a79e.html",
  },
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

  // Evaluation & Curation Fields
  const [grade, setGrade] = useState<"A" | "B" | "C" | "UNRATED">("UNRATED");
  const [status, setStatus] = useState<"DRAFT" | "REVIEWED" | "SAVED" | "ARCHIVED">("REVIEWED");
  const [internalNotes, setInternalNotes] = useState<string>("");
  const [selectedBusinessTypes, setSelectedBusinessTypes] = useState<BusinessType[]>([]);
  const [companyTypeOtherExplanation, setCompanyTypeOtherExplanation] = useState<string>("");

  // Company-level category input for Import & Review
  const [newCompanyCategoryInput, setNewCompanyCategoryInput] = useState<string>("");

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

  // --------------------------------------------------------------------------
  // TAB 2: BRAND LIST STATE
  // --------------------------------------------------------------------------
  const [candidates, setCandidates] = useState<any[]>(initialCandidates);
  const [totalCandidates, setTotalCandidates] = useState<number>(initialTotal);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterGrade, setFilterGrade] = useState("ALL");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [filterCategory, setFilterCategory] = useState("ALL");
  const [filterBusinessTypes, setFilterBusinessTypes] = useState<string[]>([]);
  const [filterBusinessTypeMatchMode, setFilterBusinessTypeMatchMode] = useState<"ANY" | "ALL">("ANY");
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const pageSize = 20;

  // Detail Drawer / Modal state for viewing an existing saved candidate
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [selectedCandidateDetail, setSelectedCandidateDetail] = useState<any | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isUpdatingCandidate, setIsUpdatingCandidate] = useState(false);
  const [detailEditSuccess, setDetailEditSuccess] = useState<string | null>(null);
  const [drawerNewCategoryInput, setDrawerNewCategoryInput] = useState<string>("");

  const [isPending, startTransition] = useTransition();

  // --------------------------------------------------------------------------
  // COMPUTED / MEMOIZED VALUES
  // --------------------------------------------------------------------------
  // Unique extracted company-level products for Import & Review
  const importExtractedProducts = useMemo(() => {
    if (reviewedDraft?.companyProducts && reviewedDraft.companyProducts.length > 0) {
      return reviewedDraft.companyProducts;
    }
    const map = new Map<string, any>();
    for (const b of reviewedDraft?.brands || []) {
      for (const p of b.keyProducts || []) {
        const key = (p.id || p.titleKr || p.titleEn || "").toLowerCase();
        if (key && !map.has(key)) {
          map.set(key, p);
        }
      }
    }
    return Array.from(map.values());
  }, [reviewedDraft]);

  // Drawer company categories
  const drawerCategories = useMemo(() => {
    if (!selectedCandidateDetail) return [];
    if (Array.isArray(selectedCandidateDetail.categories) && selectedCandidateDetail.categories.length > 0) {
      return selectedCandidateDetail.categories;
    }
    if (Array.isArray(selectedCandidateDetail.companyCategories) && selectedCandidateDetail.companyCategories.length > 0) {
      return selectedCandidateDetail.companyCategories;
    }
    return Array.from(
      new Set(selectedCandidateDetail.sourcing_brands?.flatMap((b: any) => b.categories || []) || [])
    ) as string[];
  }, [selectedCandidateDetail]);

  // Drawer extracted products
  const drawerProducts = useMemo(() => {
    if (!selectedCandidateDetail) return [];
    if (Array.isArray(selectedCandidateDetail.companyProducts) && selectedCandidateDetail.companyProducts.length > 0) {
      return selectedCandidateDetail.companyProducts;
    }
    const map = new Map<string, any>();
    for (const b of selectedCandidateDetail.sourcing_brands || []) {
      for (const p of b.key_products || []) {
        const key = (p.id || p.titleKr || p.titleEn || "").toLowerCase();
        if (key && !map.has(key)) {
          map.set(key, p);
        }
      }
    }
    return Array.from(map.values());
  }, [selectedCandidateDetail]);

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
      setSelectedBusinessTypes(res.draft.company.businessTypes || []);
      setCompanyTypeOtherExplanation("");
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
        businessTypes: selectedBusinessTypes,
        companyTypeOtherExplanation: selectedBusinessTypes.includes("OTHER") ? companyTypeOtherExplanation : null,
        categories: reviewedDraft.categories || [],
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
        businessTypes: filterBusinessTypes.length > 0 ? filterBusinessTypes : undefined,
        businessTypeMatchMode: filterBusinessTypeMatchMode,
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
      const currentCats = selectedCandidateDetail.categories || drawerCategories;
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
          categories: currentCats.length > 0 ? currentCats : (b.categories || []),
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
        categories: currentCats,
        companyProducts: drawerProducts,
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
        businessTypes: selectedCandidateDetail.business_types || [],
        companyTypeOtherExplanation: selectedCandidateDetail.companyTypeOtherExplanation || null,
        categories: currentCats,
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

  // Company Type Toggle for Import & Review
  const toggleBusinessType = (type: BusinessType) => {
    setSelectedBusinessTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  // Company Category Handlers for Import & Review
  const handleAddCompanyCategory = () => {
    const raw = newCompanyCategoryInput.trim();
    if (!raw || !reviewedDraft) return;
    const currentCats = Array.isArray(reviewedDraft.categories) ? reviewedDraft.categories : [];
    const exists = currentCats.some((c) => c.toLowerCase() === raw.toLowerCase());
    if (!exists) {
      setReviewedDraft({
        ...reviewedDraft,
        categories: [...currentCats, raw],
      });
    }
    setNewCompanyCategoryInput("");
  };

  const handleRemoveCompanyCategory = (catIdx: number) => {
    if (!reviewedDraft) return;
    const currentCats = Array.isArray(reviewedDraft.categories) ? reviewedDraft.categories : [];
    setReviewedDraft({
      ...reviewedDraft,
      categories: currentCats.filter((_, idx) => idx !== catIdx),
    });
  };

  // Drawer Company Type & Category Handlers
  const handleToggleDrawerBusinessType = (type: BusinessType) => {
    if (!selectedCandidateDetail) return;
    const currentTypes: BusinessType[] = selectedCandidateDetail.business_types || [];
    const updated = currentTypes.includes(type)
      ? currentTypes.filter((t) => t !== type)
      : [...currentTypes, type];
    setSelectedCandidateDetail({
      ...selectedCandidateDetail,
      business_types: updated,
    });
  };

  const handleAddDrawerCategory = () => {
    const raw = drawerNewCategoryInput.trim();
    if (!raw || !selectedCandidateDetail) return;
    const currentCats: string[] = selectedCandidateDetail.categories || drawerCategories;
    const exists = currentCats.some((c) => c.toLowerCase() === raw.toLowerCase());
    if (!exists) {
      setSelectedCandidateDetail({
        ...selectedCandidateDetail,
        categories: [...currentCats, raw],
      });
    }
    setDrawerNewCategoryInput("");
  };

  const handleRemoveDrawerCategory = (idx: number) => {
    if (!selectedCandidateDetail) return;
    const currentCats: string[] = selectedCandidateDetail.categories || drawerCategories;
    setSelectedCandidateDetail({
      ...selectedCandidateDetail,
      categories: currentCats.filter((_, i) => i !== idx),
    });
  };

  // Company Type badge styling helper
  const renderCompanyTypeBadge = (bt: string) => {
    const opt = COMPANY_TYPE_OPTIONS.find((o) => o.value === bt);
    return (
      <span
        key={bt}
        className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60"
      >
        {opt ? opt.labelKr : bt}
      </span>
    );
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
                <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-5 shadow-xs space-y-6">
                  <div className="flex justify-between items-center border-b border-zinc-100 dark:border-zinc-800 pb-3">
                    <div>
                      <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                        3. Brands & Product Catalog ({reviewedDraft.brands.length} Brands)
                      </h3>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        Company brands, category tags, and extracted product catalog.
                      </p>
                    </div>
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

                  {/* SUBSECTION A: Represented Brands (Brands Only) */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                        Represented Brands ({reviewedDraft.brands.length})
                      </span>
                      <span className="text-[11px] text-zinc-400">
                        Extracted brand identities
                      </span>
                    </div>

                    <div className="space-y-3">
                      {reviewedDraft.brands.map((brand, bIdx) => (
                        <div
                          key={bIdx}
                          className="p-3.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 space-y-2.5"
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
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* SUBSECTION B: Company Categories (Independent Section) */}
                  <div className="space-y-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                          Company Categories ({reviewedDraft.categories?.length || 0})
                        </span>
                        <p className="text-[11px] text-zinc-500 mt-0.5">
                          InterCHARM 카테고리 검색결과 및 전시 품목 분류 (회사 레벨 관리)
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 min-h-[46px]">
                      {reviewedDraft.categories && reviewedDraft.categories.length > 0 ? (
                        reviewedDraft.categories.map((cat, catIdx) => (
                          <span
                            key={catIdx}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                          >
                            {cat}
                            <button
                              type="button"
                              onClick={() => handleRemoveCompanyCategory(catIdx)}
                              className="hover:text-blue-900 dark:hover:text-blue-100 cursor-pointer ml-1 font-bold"
                              title="Remove category"
                            >
                              ✕
                            </button>
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-zinc-400 italic">No company categories assigned</span>
                      )}

                      <div className="inline-flex items-center gap-1.5 ml-auto">
                        <input
                          type="text"
                          placeholder="+ Add category"
                          value={newCompanyCategoryInput}
                          onChange={(e) => setNewCompanyCategoryInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleAddCompanyCategory();
                            }
                          }}
                          className="px-2.5 py-1 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 w-32 focus:w-44 transition-all"
                        />
                        <button
                          type="button"
                          onClick={handleAddCompanyCategory}
                          data-testid="add-cat-btn"
                          className="px-2.5 py-1 text-xs font-semibold rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-700 cursor-pointer"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* SUBSECTION C: Extracted Products (Independent Section) */}
                  <div className="space-y-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                          Extracted Products ({importExtractedProducts.length})
                        </span>
                        <p className="text-[11px] text-zinc-500 mt-0.5">
                          전시회 등록 출품작 및 주요 제품 정보 (중복 없이 단일 표시)
                        </p>
                      </div>
                    </div>

                    {importExtractedProducts.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {importExtractedProducts.map((prod, pIdx) => (
                          <div
                            key={pIdx}
                            className="flex items-start gap-3 p-3 rounded-lg bg-zinc-50/50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 text-xs"
                          >
                            {prod.imageUrl ? (
                              <img
                                src={prod.imageUrl}
                                alt={prod.titleKr || prod.titleEn || "Product"}
                                className="w-14 h-14 object-cover rounded-md shrink-0 border border-zinc-200 dark:border-zinc-700 bg-white"
                              />
                            ) : (
                              <div className="w-14 h-14 rounded-md shrink-0 bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 text-lg">
                                📦
                              </div>
                            )}
                            <div className="min-w-0 flex-1 space-y-1">
                              <p className="font-bold text-zinc-900 dark:text-zinc-100 leading-snug">
                                {prod.titleKr || prod.titleEn}
                              </p>
                              {prod.titleEn && prod.titleEn !== prod.titleKr && (
                                <p className="text-[11px] text-zinc-400">
                                  {prod.titleEn}
                                </p>
                              )}
                              {prod.description && (
                                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-relaxed">
                                  {prod.description}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-center text-xs text-zinc-400 italic">
                        No extracted products registered by exhibitor.
                      </div>
                    )}
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

                  {/* Company Type Selector (Multi-Select) */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                        Company Type (회사 유형)
                      </label>
                      <span className="text-[10px] text-zinc-400">복수 선택 가능</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50">
                      {COMPANY_TYPE_OPTIONS.map((opt) => {
                        const isChecked = selectedBusinessTypes.includes(opt.value);
                        return (
                          <label
                            key={opt.value}
                            className={`flex items-start gap-2 p-1.5 rounded text-xs cursor-pointer transition-colors ${
                              isChecked
                                ? "bg-blue-50/80 dark:bg-blue-950/50 text-blue-900 dark:text-blue-200 font-semibold"
                                : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleBusinessType(opt.value)}
                              className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
                            />
                            <div className="min-w-0">
                              <span className="block leading-tight">{opt.labelKr}</span>
                              <span className="text-[10px] text-zinc-400 font-normal leading-tight">{opt.labelEn}</span>
                            </div>
                          </label>
                        );
                      })}
                    </div>

                    {/* Other Explanation Input */}
                    {selectedBusinessTypes.includes("OTHER") && (
                      <div className="pt-1">
                        <input
                          type="text"
                          placeholder="기타 회사 유형 설명 (예: 원료 공급사, 패키징 전문 등)"
                          value={companyTypeOtherExplanation}
                          onChange={(e) => setCompanyTypeOtherExplanation(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100"
                        />
                      </div>
                    )}
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

            {/* Company Type Filter */}
            <div className="flex items-center gap-1.5">
              <select
                value={filterBusinessTypes.length === 0 ? "ALL" : filterBusinessTypes[0]}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "ALL") {
                    setFilterBusinessTypes([]);
                  } else {
                    setFilterBusinessTypes([val]);
                  }
                  setCurrentPage(1);
                }}
                className="w-40 px-2.5 py-1.5 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100"
              >
                <option value="ALL">Company Type: All</option>
                {COMPANY_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.labelKr} ({opt.labelEn})
                  </option>
                ))}
              </select>

              {filterBusinessTypes.length > 0 && (
                <div className="inline-flex rounded border border-zinc-300 dark:border-zinc-700 p-0.5 bg-zinc-50 dark:bg-zinc-900 text-[10px]">
                  <button
                    type="button"
                    onClick={() => {
                      setFilterBusinessTypeMatchMode("ANY");
                      setCurrentPage(1);
                    }}
                    className={`px-1.5 py-0.5 rounded cursor-pointer ${
                      filterBusinessTypeMatchMode === "ANY"
                        ? "bg-zinc-800 text-white font-bold"
                        : "text-zinc-500 hover:text-zinc-800"
                    }`}
                    title="Match any selected type"
                  >
                    ANY
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFilterBusinessTypeMatchMode("ALL");
                      setCurrentPage(1);
                    }}
                    className={`px-1.5 py-0.5 rounded cursor-pointer ${
                      filterBusinessTypeMatchMode === "ALL"
                        ? "bg-zinc-800 text-white font-bold"
                        : "text-zinc-500 hover:text-zinc-800"
                    }`}
                    title="Match all selected types"
                  >
                    ALL
                  </button>
                </div>
              )}
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
                    <th className="p-3">Company Type</th>
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
                      <td colSpan={10} className="p-8 text-center text-zinc-400">
                        Loading candidate list...
                      </td>
                    </tr>
                  ) : candidates.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-12 text-center space-y-2">
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

                      // Extract unique categories across company payload and all brands
                      const allCategories = Array.from(
                        new Set([
                          ...(Array.isArray(c.raw_payload_snapshot?.categories) ? c.raw_payload_snapshot.categories : []),
                          ...(c.sourcing_brands?.flatMap((b: any) => b.categories || []) || []),
                        ])
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
                          {/* Company Type Column */}
                          <td className="p-3">
                            <div className="flex flex-wrap gap-1 max-w-[180px]">
                              {Array.isArray(c.business_types) && c.business_types.length > 0 ? (
                                c.business_types.map((bt: string, btIdx: number) => (
                                  <React.Fragment key={btIdx}>
                                    {renderCompanyTypeBadge(bt)}
                                  </React.Fragment>
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

                {/* 1) TOP CARD — Company Overview (Requirement 4 & ADD11) */}
                {(() => {
                  const primaryContact =
                    selectedCandidateDetail.sourcing_contacts?.find((ct: any) => ct.is_primary) ||
                    selectedCandidateDetail.sourcing_contacts?.[0];
                  const otherContacts = (selectedCandidateDetail.sourcing_contacts || []).filter(
                    (ct: any) => ct !== primaryContact
                  );

                  const primaryWebObj =
                    selectedCandidateDetail.sourcing_websites?.find((ws: any) => ws.is_primary) ||
                    selectedCandidateDetail.sourcing_websites?.[0];
                  const primaryWeb = primaryWebObj?.url?.trim() || "";
                  const otherWebsites = (selectedCandidateDetail.sourcing_websites || []).filter(
                    (ws: any) => ws !== primaryWebObj
                  );

                  return (
                    <div className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-850/60 border border-zinc-200 dark:border-zinc-800 space-y-4">
                      {/* Top Row: Company Name & Badges */}
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

                      {/* Prominent Website Card with Full URL & Open Website Button */}
                      <div className="p-3 rounded-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <span className="text-[10px] uppercase font-bold text-zinc-400 block mb-0.5">
                            Official Website (공식 웹사이트)
                          </span>
                          {primaryWeb ? (
                            <a
                              href={primaryWeb.startsWith("http") ? primaryWeb : `https://${primaryWeb}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 dark:text-blue-400 font-mono font-medium underline break-all hover:text-blue-800"
                            >
                              {primaryWeb}
                            </a>
                          ) : (
                            <span className="text-zinc-400 text-xs">-</span>
                          )}
                        </div>
                        {primaryWeb && (
                          <a
                            href={primaryWeb.startsWith("http") ? primaryWeb : `https://${primaryWeb}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors inline-flex items-center gap-1 shrink-0"
                          >
                            <span>Open Website</span>
                            <span>↗</span>
                          </a>
                        )}
                      </div>

                      {/* Company Info Grid */}
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
                            {selectedCandidateDetail.business_registration_number || selectedCandidateDetail.business_number || "-"}
                          </span>
                        </div>

                        {/* Standalone Primary Contact Person, Email & Phone */}
                        <div>
                          <span className="text-zinc-400 font-semibold block text-[11px]">Primary Contact (담당자)</span>
                          <span className="text-zinc-800 dark:text-zinc-200 font-medium">
                            {primaryContact?.name || "-"}
                            {primaryContact?.job_title && (
                              <span className="text-zinc-400 font-normal ml-1">({primaryContact.job_title})</span>
                            )}
                            {primaryContact?.department && (
                              <span className="text-zinc-400 font-normal ml-1">/ {primaryContact.department}</span>
                            )}
                          </span>
                        </div>
                        <div>
                          <span className="text-zinc-400 font-semibold block text-[11px]">Contact Email (이메일)</span>
                          {primaryContact?.email ? (
                            <a
                              href={`mailto:${primaryContact.email}`}
                              className="text-blue-600 dark:text-blue-400 underline font-medium font-mono text-xs"
                            >
                              {primaryContact.email}
                            </a>
                          ) : (
                            <span className="text-zinc-400">-</span>
                          )}
                        </div>
                        <div>
                          <span className="text-zinc-400 font-semibold block text-[11px]">Contact Phone (전화번호)</span>
                          {(primaryContact?.phone || primaryContact?.mobile) ? (
                            <a
                              href={`tel:${primaryContact.phone || primaryContact.mobile}`}
                              className="text-zinc-800 dark:text-zinc-200 font-medium font-mono text-xs hover:underline"
                            >
                              {primaryContact.phone || primaryContact.mobile}
                            </a>
                          ) : (
                            <span className="text-zinc-400">-</span>
                          )}
                        </div>

                        {/* Additional Websites if present */}
                        {otherWebsites.length > 0 && (
                          <div className="md:col-span-2 pt-1 border-t border-zinc-200/60 dark:border-zinc-800/80">
                            <span className="text-zinc-400 font-semibold block text-[11px] mb-1">Additional Websites</span>
                            <div className="flex flex-wrap gap-2">
                              {otherWebsites.map((ws: any, wsIdx: number) => {
                                const rawUrl = ws.url?.trim() || "";
                                const displayUrl = rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`;
                                return (
                                  <a
                                    key={wsIdx}
                                    href={displayUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-blue-600 dark:text-blue-400 hover:underline"
                                  >
                                    <span>🌐 {ws.label || "Website"}</span>
                                    <span className="text-zinc-400 text-[10px]">↗</span>
                                  </a>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* 2) FIRST SUB-SECTION — Represented Brands (Brands Only) */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">
                      Represented Brands ({selectedCandidateDetail.sourcing_brands?.length || 0})
                    </h4>
                    <span className="text-[11px] text-zinc-400">보유 브랜드</span>
                  </div>

                  {selectedCandidateDetail.sourcing_brands && selectedCandidateDetail.sourcing_brands.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {selectedCandidateDetail.sourcing_brands.map((b: any, idx: number) => (
                        <div
                          key={idx}
                          className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 flex items-center justify-between"
                        >
                          <div>
                            <span className="font-bold text-xs text-zinc-900 dark:text-zinc-100">
                              {b.brand_name_kr}
                            </span>
                            {b.brand_name_en && b.brand_name_en !== b.brand_name_kr && (
                              <span className="text-zinc-400 text-[11px] block mt-0.5">
                                {b.brand_name_en}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-mono">
                            Brand
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-zinc-400 text-xs italic">No brands registered.</p>
                  )}
                </div>

                {/* 3) SECOND SUB-SECTION — Company Categories (Independent Section with Tag Adder) */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">
                      Company Categories ({drawerCategories.length})
                    </h4>
                    <span className="text-[10px] text-zinc-400">회사 레벨 카테고리 태그</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950 min-h-[44px]">
                    {drawerCategories.length > 0 ? (
                      drawerCategories.map((cat: string, catIdx: number) => (
                        <span
                          key={catIdx}
                          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                        >
                          {cat}
                          <button
                            type="button"
                            onClick={() => handleRemoveDrawerCategory(catIdx)}
                            className="hover:text-blue-900 dark:hover:text-blue-100 cursor-pointer ml-1 font-bold"
                            title="Remove category"
                          >
                            ✕
                          </button>
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-zinc-400 italic">No categories assigned</span>
                    )}

                    <div className="inline-flex items-center gap-1.5 ml-auto">
                      <input
                        type="text"
                        placeholder="+ Add category"
                        value={drawerNewCategoryInput}
                        onChange={(e) => setDrawerNewCategoryInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddDrawerCategory();
                          }
                        }}
                        className="px-2 py-0.5 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 w-28 focus:w-36 transition-all"
                      />
                      <button
                        type="button"
                        onClick={handleAddDrawerCategory}
                        className="px-2 py-0.5 text-xs font-semibold rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-700 cursor-pointer"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>

                {/* 4) THIRD SUB-SECTION — Extracted Products (Independent Section) */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">
                      Extracted Products ({drawerProducts.length})
                    </h4>
                    <span className="text-[11px] text-zinc-400">전시회 출품 제품</span>
                  </div>

                  {drawerProducts.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {drawerProducts.map((prod: any, pIdx: number) => (
                        <div
                          key={pIdx}
                          className="flex items-start gap-2.5 p-2.5 rounded-lg bg-zinc-50/50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 text-xs"
                        >
                          {prod.imageUrl ? (
                            <img
                              src={prod.imageUrl}
                              alt={prod.titleKr || prod.titleEn || "Product"}
                              className="w-12 h-12 object-cover rounded shrink-0 border border-zinc-200 dark:border-zinc-700 bg-white"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded shrink-0 bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 text-base">
                              📦
                            </div>
                          )}
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <p className="font-bold text-zinc-900 dark:text-zinc-100 truncate">
                              {prod.titleKr || prod.titleEn}
                            </p>
                            {prod.titleEn && prod.titleEn !== prod.titleKr && (
                              <p className="text-[11px] text-zinc-400 truncate">
                                {prod.titleEn}
                              </p>
                            )}
                            {prod.description && (
                              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-2">
                                {prod.description}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-zinc-400 text-xs italic">No extracted products available.</p>
                  )}
                </div>

                {/* 5) FOURTH SECTION — Corporate Description */}
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

                {/* 6) FIFTH SECTION — Evaluation & Workflow Status (with Company Type Multi-Select) */}
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

                    {/* Company Type Multi-Select for Drawer */}
                    <div className="col-span-2 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="block text-zinc-600 dark:text-zinc-400 font-semibold text-[11px]">
                          Company Type (회사 유형)
                        </label>
                        <span className="text-[10px] text-zinc-400">복수 선택 가능</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
                        {COMPANY_TYPE_OPTIONS.map((opt) => {
                          const currentTypes = selectedCandidateDetail.business_types || [];
                          const isChecked = currentTypes.includes(opt.value);
                          return (
                            <label
                              key={opt.value}
                              className={`flex items-start gap-2 p-1.5 rounded text-xs cursor-pointer transition-colors ${
                                isChecked
                                  ? "bg-blue-50/80 dark:bg-blue-950/50 text-blue-900 dark:text-blue-200 font-semibold"
                                  : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleToggleDrawerBusinessType(opt.value)}
                                className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
                              />
                              <div className="min-w-0">
                                <span className="block leading-tight">{opt.labelKr}</span>
                                <span className="text-[10px] text-zinc-400 font-normal leading-tight">{opt.labelEn}</span>
                              </div>
                            </label>
                          );
                        })}
                      </div>

                      {/* Other explanation input */}
                      {(selectedCandidateDetail.business_types || []).includes("OTHER") && (
                        <div className="pt-1">
                          <input
                            type="text"
                            placeholder="기타 회사 유형 설명 (예: 원료 공급사, 패키징 전문 등)"
                            value={selectedCandidateDetail.companyTypeOtherExplanation || ""}
                            onChange={(e) =>
                              setSelectedCandidateDetail({
                                ...selectedCandidateDetail,
                                companyTypeOtherExplanation: e.target.value,
                              })
                            }
                            className="w-full px-2.5 py-1.5 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                          />
                        </div>
                      )}
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

                {/* 7) BOTTOM ACTIONS */}
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
