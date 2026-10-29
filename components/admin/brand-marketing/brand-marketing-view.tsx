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
  BusinessTypeEvidence,
  ClassificationStatus,
  SourcingDocumentItem,
  SourcingDocumentType,
  PrimaryProductCategory,
} from "@/lib/brand-sourcing/types";
import {
  COMPANY_TYPE_OPTIONS,
  COMPANY_TYPE_SHORT_LABELS,
  PRIMARY_PRODUCT_CATEGORY_OPTIONS,
} from "@/lib/brand-sourcing/types";
import type {
  DuplicateMatchItem,
  AdminDuplicateExceptionInput,
  LinkSourceResult,
  DuplicateAuditReport,
} from "@/lib/brand-sourcing/types";
import {
  extractSourcingDraftAction,
  checkDuplicatesAction,
  saveSourcingCandidateAction,
  linkSourcingSourceAction,
  getSourcingDuplicateAuditReportAction,
  listSourcingCandidatesAction,
  getSourcingCandidateDetailAction,
  updateSourcingCandidateAction,
  updateSourcingEvaluationAction,
  updateSourcingCandidateGradeAction,
  updateSourcingCandidateDocumentsAction,
  deleteSourcingCandidateAction,
  bulkArchiveSourcingCandidatesAction,
} from "@/lib/brand-sourcing/actions";
import { EmailCampaignsView } from "./email-campaigns-view";
import { CampaignResultsView } from "./campaign-results-view";

interface StaffMemberOption {
  id: string;
  name: string;
  email: string;
}

interface BrandMarketingViewProps {
  initialStaff: StaffMemberOption[];
  initialCandidates: any[];
  initialTotal: number;
  initialTab?: "import" | "list" | "campaigns" | "results";
}

function formatFileSize(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// InterCHARM Korea Verified Sample URLs for Operator QA
const QUICK_TEST_URLS = [
  {
    name: "3일애 (Three Days Love)",
    url: "https://www.intercharmkorea.com/ko-kr/exhibitor_directory/Exhibitor_detail.3%EC%9D%BC%EC%95%A0.org-b4fa5886-d5fd-490e-92bf-0c0b65d0a79e.html",
  },
  {
    name: "MIJIN COSMETICS (미진화장품)",
    url: "https://www.intercharmkorea.com/ko-kr/exhibitor_directory/Exhibitor_detail.%EC%A3%BC%EB%AF%B8%EC%A7%84%ED%99%94%EC%9E%A5%ED%92%88.org-1121b56a-b02c-4552-bbee-db642b958546.html#/",
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
  // Navigation Tabs: import | list | campaigns | results
  const [activeTab, setActiveTab] = useState<"import" | "list" | "campaigns" | "results">(initialTab);

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
  const [businessTypeEvidence, setBusinessTypeEvidence] = useState<BusinessTypeEvidence[]>([]);
  const [expandedEvidenceType, setExpandedEvidenceType] = useState<BusinessType | null>(null);
  const [drawerExpandedEvidenceType, setDrawerExpandedEvidenceType] = useState<BusinessType | null>(null);
  const [companyTypeOtherExplanation, setCompanyTypeOtherExplanation] = useState<string>("");
  const [selectedPrimaryCategories, setSelectedPrimaryCategories] = useState<PrimaryProductCategory[]>([]);
  const [primaryCategoriesConfirmed, setPrimaryCategoriesConfirmed] = useState(false);

  // Company Documents state
  const [companyDocuments, setCompanyDocuments] = useState<SourcingDocumentItem[]>([]);

  // Add Document Modal state
  const [showAddDocModal, setShowAddDocModal] = useState(false);
  const [addDocTarget, setAddDocTarget] = useState<"import" | "drawer">("import");
  const [newDocTitle, setNewDocTitle] = useState("");
  const [newDocUrl, setNewDocUrl] = useState("");
  const [newDocType, setNewDocType] = useState<SourcingDocumentType>("CATALOG");

  // Inline Grade editing state
  const [savingGradeCompanyId, setSavingGradeCompanyId] = useState<string | null>(null);

  // Company-level category input for Import & Review
  const [newCompanyCategoryInput, setNewCompanyCategoryInput] = useState<string>("");

  // Duplicate candidate alert state
  const [duplicateCheck, setDuplicateCheck] = useState<DuplicateMatchResult | null>(null);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateOverrideReason, setDuplicateOverrideReason] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
  const [savedCompanyId, setSavedCompanyId] = useState<string | null>(null);

  // Link Source Modal state
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [targetCompanyToLink, setTargetCompanyToLink] = useState<DuplicateMatchItem | null>(null);
  const [linkNotes, setLinkNotes] = useState("");
  const [isLinking, setIsLinking] = useState(false);



  // Duplicate Audit Report Modal state
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [auditReport, setAuditReport] = useState<DuplicateAuditReport | null>(null);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);

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
  const [filterPrimaryCategories, setFilterPrimaryCategories] = useState<string[]>([]);
  const [showPrimaryCatFilterDropdown, setShowPrimaryCatFilterDropdown] = useState(false);
  const [activePopover, setActivePopover] = useState<{ rowId: string; col: "brands" | "categories" | "primary" } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [pageSize, setPageSize] = useState<number>(20);

  // Bulk selection and deletion state (ADM-BSRC-013)
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([]);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Detail Drawer / Modal state for viewing an existing saved candidate
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [selectedCandidateDetail, setSelectedCandidateDetail] = useState<any | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isUpdatingCandidate, setIsUpdatingCandidate] = useState(false);
  const [detailEditSuccess, setDetailEditSuccess] = useState<string | null>(null);
  const [drawerNewCategoryInput, setDrawerNewCategoryInput] = useState<string>("");

  // Drawer Contacts and Brands management state (ADM-BSRC-013)
  const [drawerContacts, setDrawerContacts] = useState<any[]>([]);
  const [showAddContactForm, setShowAddContactForm] = useState(false);
  const [newContactName, setNewContactName] = useState("");
  const [newContactJobTitle, setNewContactJobTitle] = useState("");
  const [newContactDepartment, setNewContactDepartment] = useState("");
  const [newContactEmail, setNewContactEmail] = useState("");
  const [newContactPhone, setNewContactPhone] = useState("");
  const [newContactIsPrimary, setNewContactIsPrimary] = useState(false);
  const [editingContactIdx, setEditingContactIdx] = useState<number | null>(null);

  const [drawerBrands, setDrawerBrands] = useState<any[]>([]);
  const [newBrandKrInput, setNewBrandKrInput] = useState("");
  const [newBrandEnInput, setNewBrandEnInput] = useState("");
  const [editingBrandIdx, setEditingBrandIdx] = useState<number | null>(null);
  const [brandErrorMessage, setBrandErrorMessage] = useState<string | null>(null);

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

  // Drawer company documents
  const drawerDocuments: SourcingDocumentItem[] = useMemo(() => {
    if (!selectedCandidateDetail) return [];
    if (Array.isArray(selectedCandidateDetail.documents)) {
      return selectedCandidateDetail.documents;
    }
    if (Array.isArray(selectedCandidateDetail.companyDocuments)) {
      return selectedCandidateDetail.companyDocuments;
    }
    const rawSnap = (selectedCandidateDetail.raw_payload_snapshot as any) || {};
    if (Array.isArray(rawSnap.documents)) {
      return rawSnap.documents;
    }
    return [];
  }, [selectedCandidateDetail]);

  // Drawer business type evidence
  const drawerBusinessTypeEvidence: BusinessTypeEvidence[] = useMemo(() => {
    if (!selectedCandidateDetail) return [];
    if (Array.isArray(selectedCandidateDetail.business_type_evidence)) {
      return selectedCandidateDetail.business_type_evidence;
    }
    return [];
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

      // Preserve confirmed categories if re-parsing an already confirmed candidate (ADM-BSRC-011-R1)
      const confirmedCandidateMatch = res.duplicateCheck?.matches?.find(
        (m) => m.entityType === "SOURCING_CANDIDATE" && m.primaryCategoriesConfirmed
      );

      // Reset evaluation fields to clean state (Default to REVIEWED)
      setGrade("UNRATED");
      setStatus("REVIEWED");
      setInternalNotes("");
      setSelectedBusinessTypes(res.draft.company.businessTypes || []);
      setBusinessTypeEvidence(res.draft.company.businessTypeEvidence || []);
      if (confirmedCandidateMatch && confirmedCandidateMatch.primaryCategoriesConfirmed) {
        setSelectedPrimaryCategories(confirmedCandidateMatch.primaryProductCategories || []);
        setPrimaryCategoriesConfirmed(true);
      } else {
        setSelectedPrimaryCategories(res.draft.company.primaryProductCategories || []);
        setPrimaryCategoriesConfirmed(false);
      }
      setCompanyDocuments(res.draft.companyDocuments || []);
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
  const handleRecheckDuplicates = async (draftToCheck: NormalizedCompanyDraft) => {
    try {
      const draftBrands = (draftToCheck.brands || []).map((b) => ({ nameKr: b.nameKr, nameEn: b.nameEn }));
      const draftEmails = (draftToCheck.contacts || []).map((c) => c.email).filter(Boolean);

      const res = await checkDuplicatesAction({
        sourceUrl: draftToCheck.source.sourceUrl,
        sourceIdentifier: draftToCheck.source.sourceIdentifier,
        companyNameKr: draftToCheck.company.nameKr,
        companyNameEn: draftToCheck.company.nameEn || undefined,
        brands: draftBrands,
        emails: draftEmails,
      });

      if (res.success && res.duplicateCheck) {
        setDuplicateCheck(res.duplicateCheck);
      }
    } catch (err) {
      console.error("Duplicate recheck failed:", err);
    }
  };

  const handleInitiateSave = () => {
    if (!reviewedDraft) return;

    if (!reviewedDraft.company.nameKr?.trim()) {
      alert("Company Korean name is required before saving.");
      return;
    }

    // Non-blocking duplicate detection: prompt confirmation dialog
    if (duplicateCheck && duplicateCheck.isDuplicate) {
      setShowDuplicateModal(true);
      return;
    }

    executeSave();
  };

  const executeSave = async (options?: { allowDuplicateConfirmed?: boolean }) => {
    if (!reviewedDraft || isSaving) return;

    setIsSaving(true);
    setShowDuplicateModal(false);
    setSaveSuccessMessage(null);

    try {
      const evaluation: SourcingEvaluationInput = {
        grade,
        status,
        assignedTo: null,
        businessTypes: selectedBusinessTypes,
        businessTypeEvidence,
        companyTypeOtherExplanation: selectedBusinessTypes.includes("OTHER") ? companyTypeOtherExplanation : null,
        primaryProductCategories: selectedPrimaryCategories,
        primaryCategoriesConfirmed,
        categories: reviewedDraft.categories || [],
        documents: companyDocuments,
        internalNotes: internalNotes,
        marketingConsentStatus: "UNCONFIRMED", // Strict invariant
      };

      const draftToSave: NormalizedCompanyDraft = {
        ...reviewedDraft,
        companyDocuments,
      };

      const matchedCompanyIds = duplicateCheck?.matches?.map((m) => m.entityId) || [];
      const matchedFields = Array.from(new Set(duplicateCheck?.matches?.map((m) => m.matchedField || "일치 항목") || []));

      const res = await saveSourcingCandidateAction(draftToSave, evaluation, {
        allowDuplicateConfirmed: options?.allowDuplicateConfirmed,
        matchedCompanyIds,
        matchedFields,
      });

      if (!res.success) {
        if (res.isDuplicate) {
          setShowDuplicateModal(true);
        } else {
          alert(`Failed to save: ${res.error}`);
        }
        setIsSaving(false);
        return;
      }

      setSavedCompanyId(res.companyId || null);
      setSaveSuccessMessage(
        options?.allowDuplicateConfirmed
          ? `중복 확인 후 신규 회사 "${reviewedDraft.company.nameKr}"이(가) 성공적으로 저장되었습니다.`
          : `Candidate "${reviewedDraft.company.nameKr}" saved successfully!`
      );
      setDuplicateCheck(null);
      refreshBrandList();
    } catch (err: any) {
      alert(`Save error: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Handlers for Link to Existing Company
  const handleOpenLinkModal = (match?: DuplicateMatchItem) => {
    const target = match || duplicateCheck?.matches.find((m) => m.entityId) || null;
    setTargetCompanyToLink(target || null);
    setLinkNotes("");
    setShowDuplicateModal(false);
    setShowLinkModal(true);
  };

  const handleConfirmLink = async () => {
    if (!reviewedDraft || !targetCompanyToLink || isLinking) return;
    setIsLinking(true);
    try {
      const res = await linkSourcingSourceAction({
        targetCompanyId: targetCompanyToLink.entityId,
        draft: reviewedDraft,
        overrideReason: linkNotes.trim() || undefined,
      });

      if (!res.success) {
        alert(res.error || "Failed to link source to existing company.");
        setIsLinking(false);
        return;
      }

      setShowLinkModal(false);
      setSavedCompanyId(targetCompanyToLink.entityId);
      setSaveSuccessMessage(res.result?.message || `소스를 "${targetCompanyToLink.entityName}"에 성공적으로 연결했습니다.`);
      refreshBrandList();
    } catch (err: any) {
      alert(`Error linking source: ${err.message}`);
    } finally {
      setIsLinking(false);
    }
  };



  // Handlers for Duplicate Audit Report Modal
  const handleOpenAuditModal = async () => {
    setShowAuditModal(true);
    setIsLoadingAudit(true);
    try {
      const res = await getSourcingDuplicateAuditReportAction();
      if (res.success && res.report) {
        setAuditReport(res.report);
      } else {
        alert(res.error || "Failed to load duplicate audit report.");
      }
    } catch (err: any) {
      alert(`Error loading audit: ${err.message}`);
    } finally {
      setIsLoadingAudit(false);
    }
  };

  // --------------------------------------------------------------------------
  // LIST REFRESH & PAGINATION HANDLER
  // --------------------------------------------------------------------------
  const refreshBrandList = async (page = currentPage, size = pageSize) => {
    setIsLoadingList(true);
    try {
      const res = await listSourcingCandidatesAction({
        search: searchQuery || undefined,
        grade: filterGrade !== "ALL" ? filterGrade : undefined,
        status: filterStatus !== "ALL" ? filterStatus : undefined,
        category: filterCategory !== "ALL" ? filterCategory : undefined,
        primaryCategories: filterPrimaryCategories.length > 0 ? filterPrimaryCategories : undefined,
        businessTypes: filterBusinessTypes.length > 0 ? filterBusinessTypes : undefined,
        businessTypeMatchMode: filterBusinessTypeMatchMode,
        limit: size,
        offset: (page - 1) * size,
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
    setShowAddContactForm(false);
    setEditingContactIdx(null);
    setEditingBrandIdx(null);
    setBrandErrorMessage(null);

    try {
      const res = await getSourcingCandidateDetailAction(id);
      if (res.success && res.candidate) {
        setSelectedCandidateDetail(res.candidate);
        setDrawerContacts(res.candidate.sourcing_contacts || []);
        setDrawerBrands(res.candidate.sourcing_brands || []);
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
        brands: (drawerBrands.length > 0 ? drawerBrands : (selectedCandidateDetail.sourcing_brands || [])).map((b: any) => ({
          id: b.id,
          nameKr: b.nameKr || b.brand_name_kr,
          nameEn: b.nameEn || b.brand_name_en || null,
          description: b.description || null,
          categories: currentCats.length > 0 ? currentCats : (b.categories || []),
          keyProducts: b.keyProducts || b.key_products || [],
          source: b.source || "MANUAL",
        })),
        contacts: (drawerContacts.length > 0 ? drawerContacts : (selectedCandidateDetail.sourcing_contacts || [])).map((c: any) => ({
          id: c.id,
          name: c.name || null,
          department: c.department || null,
          jobTitle: c.jobTitle || c.job_title || null,
          email: (c.email || "").trim(),
          phone: c.phone || null,
          isPrimary: Boolean(c.isPrimary ?? c.is_primary),
          source: c.source || "MANUAL",
          sourceUrl: c.sourceUrl || c.source_url || null,
        })),
        websites: (selectedCandidateDetail.sourcing_websites || []).map((w: any) => ({
          url: w.url,
          label: w.label,
          source: w.source,
        })),
        socialMedia: [],
        categories: currentCats,
        companyProducts: drawerProducts,
        companyDocuments: drawerDocuments,
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
        businessTypeEvidence: selectedCandidateDetail.business_type_evidence || [],
        companyTypeOtherExplanation: selectedCandidateDetail.companyTypeOtherExplanation || null,
        primaryProductCategories: selectedCandidateDetail.primary_product_categories || [],
        primaryCategoriesConfirmed: true,
        categories: currentCats,
        documents: drawerDocuments,
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

  const handleRemoveDocument = (index: number) => {
    setCompanyDocuments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRemoveDrawerDocument = (index: number) => {
    if (!selectedCandidateDetail) return;
    const currentDocs = drawerDocuments;
    const updated = currentDocs.filter((_, i) => i !== index);
    setSelectedCandidateDetail({
      ...selectedCandidateDetail,
      documents: updated,
      companyDocuments: updated,
    });
  };

  const handleAddDocumentSubmit = () => {
    if (!newDocTitle.trim() || !newDocUrl.trim()) {
      alert("Please enter a document title and a valid URL.");
      return;
    }
    const newDoc: SourcingDocumentItem = {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      title: newDocTitle.trim(),
      fileUrl: newDocUrl.trim(),
      fileType: newDocType,
      source: "MANUAL",
      uploadedAt: new Date().toISOString(),
    };

    if (addDocTarget === "import") {
      setCompanyDocuments((prev) => [...prev, newDoc]);
    } else if (selectedCandidateDetail) {
      const updated = [...drawerDocuments, newDoc];
      setSelectedCandidateDetail({
        ...selectedCandidateDetail,
        documents: updated,
        companyDocuments: updated,
      });
    }

    setNewDocTitle("");
    setNewDocUrl("");
    setNewDocType("CATALOG");
    setShowAddDocModal(false);
  };

  const handleInlineGradeChange = async (companyId: string, newGrade: "A" | "B" | "C" | "UNRATED") => {
    const previousGrade = candidates.find((c) => c.id === companyId)?.grade || selectedCandidateDetail?.grade;
    setCandidates((prev) =>
      prev.map((c) => (c.id === companyId ? { ...c, grade: newGrade } : c))
    );
    if (selectedCandidateDetail && selectedCandidateDetail.id === companyId) {
      setSelectedCandidateDetail((prev: any) => prev ? { ...prev, grade: newGrade } : null);
    }
    setSavingGradeCompanyId(companyId);

    try {
      const res = await updateSourcingCandidateGradeAction(companyId, newGrade);
      if (!res.success) {
        setCandidates((prev) =>
          prev.map((c) => (c.id === companyId ? { ...c, grade: previousGrade } : c))
        );
        if (selectedCandidateDetail && selectedCandidateDetail.id === companyId) {
          setSelectedCandidateDetail((prev: any) => prev ? { ...prev, grade: previousGrade } : null);
        }
        alert(`Failed to update grade: ${res.error}`);
      }
    } catch (err: any) {
      setCandidates((prev) =>
        prev.map((c) => (c.id === companyId ? { ...c, grade: previousGrade } : c))
      );
      if (selectedCandidateDetail && selectedCandidateDetail.id === companyId) {
        setSelectedCandidateDetail((prev: any) => prev ? { ...prev, grade: previousGrade } : null);
      }
      alert(`Error updating grade: ${err.message}`);
    } finally {
      setSavingGradeCompanyId(null);
    }
  };

  // --------------------------------------------------------------------------
  // BULK SELECTION & DELETION HANDLERS (ADM-BSRC-013)
  // --------------------------------------------------------------------------
  const handleToggleSelectAllCurrentPage = () => {
    const currentPageIds = candidates.map((c) => c.id);
    const allSelected = currentPageIds.length > 0 && currentPageIds.every((id) => selectedCompanyIds.includes(id));
    if (allSelected) {
      setSelectedCompanyIds((prev) => prev.filter((id) => !currentPageIds.includes(id)));
    } else {
      setSelectedCompanyIds((prev) => Array.from(new Set([...prev, ...currentPageIds])));
    }
  };

  const handleToggleSelectRow = (id: string) => {
    setSelectedCompanyIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleConfirmBulkDelete = async () => {
    if (selectedCompanyIds.length === 0) return;
    setIsBulkDeleting(true);
    try {
      const res = await bulkArchiveSourcingCandidatesAction(selectedCompanyIds);
      if (res.success) {
        setDeleteSuccessMessage(`선택한 ${res.count || selectedCompanyIds.length}개 회사가 보관/삭제 처리되었습니다.`);
        setSelectedCompanyIds([]);
        setShowBulkDeleteModal(false);
        refreshBrandList(1, pageSize);
        setTimeout(() => setDeleteSuccessMessage(null), 5000);
      } else {
        alert(`삭제 처리 실패: ${res.error}`);
      }
    } catch (err: any) {
      alert(`오류 발생: ${err.message}`);
    } finally {
      setIsBulkDeleting(false);
    }
  };

  // --------------------------------------------------------------------------
  // DRAWER CONTACTS MANAGEMENT HANDLERS (ADM-BSRC-013)
  // --------------------------------------------------------------------------
  const handleSetPrimaryContact = (contactIdx: number) => {
    setDrawerContacts((prev) =>
      prev.map((c, idx) => ({
        ...c,
        is_primary: idx === contactIdx,
        isPrimary: idx === contactIdx,
      }))
    );
  };

  const handleAddDrawerContact = () => {
    const cleanEmail = newContactEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      alert("올바른 이메일 주소를 입력해 주세요.");
      return;
    }

    const isFirstContact = drawerContacts.length === 0;
    const shouldBePrimary = newContactIsPrimary || isFirstContact;

    const newContact = {
      name: newContactName.trim() || null,
      job_title: newContactJobTitle.trim() || null,
      jobTitle: newContactJobTitle.trim() || null,
      department: newContactDepartment.trim() || null,
      email: cleanEmail,
      phone: newContactPhone.trim() || null,
      is_primary: shouldBePrimary,
      isPrimary: shouldBePrimary,
      source: "MANUAL",
    };

    setDrawerContacts((prev) => {
      const updated = shouldBePrimary
        ? prev.map((c) => ({ ...c, is_primary: false, isPrimary: false }))
        : [...prev];
      return [...updated, newContact];
    });

    setNewContactName("");
    setNewContactJobTitle("");
    setNewContactDepartment("");
    setNewContactEmail("");
    setNewContactPhone("");
    setNewContactIsPrimary(false);
    setShowAddContactForm(false);
  };

  const handleRemoveDrawerContact = (contactIdx: number) => {
    setDrawerContacts((prev) => {
      const removingPrimary = Boolean(prev[contactIdx]?.is_primary ?? prev[contactIdx]?.isPrimary);
      const remaining = prev.filter((_, idx) => idx !== contactIdx);
      if (removingPrimary && remaining.length > 0) {
        remaining[0] = { ...remaining[0], is_primary: true, isPrimary: true };
      }
      return remaining;
    });
    if (editingContactIdx === contactIdx) setEditingContactIdx(null);
  };

  // --------------------------------------------------------------------------
  // DRAWER BRANDS MANAGEMENT HANDLERS (ADM-BSRC-013)
  // --------------------------------------------------------------------------
  const handleAddDrawerBrand = () => {
    const nameKr = newBrandKrInput.trim();
    const nameEn = newBrandEnInput.trim() || null;
    if (!nameKr) {
      setBrandErrorMessage("브랜드명(한국어)을 입력해 주세요.");
      return;
    }

    const alreadyExists = drawerBrands.some(
      (b) =>
        (b.nameKr || b.brand_name_kr || "").toLowerCase().trim() === nameKr.toLowerCase() ||
        (nameEn && (b.nameEn || b.brand_name_en || "").toLowerCase().trim() === nameEn.toLowerCase())
    );

    if (alreadyExists) {
      setBrandErrorMessage(`이미 등록된 브랜드명입니다 ("${nameKr}").`);
      return;
    }

    setBrandErrorMessage(null);
    const newBrand = {
      brand_name_kr: nameKr,
      nameKr: nameKr,
      brand_name_en: nameEn,
      nameEn: nameEn,
      description: null,
      categories: drawerCategories,
      key_products: [],
      keyProducts: [],
      source: "MANUAL",
    };

    setDrawerBrands((prev) => [...prev, newBrand]);
    setNewBrandKrInput("");
    setNewBrandEnInput("");
  };

  const handleRemoveDrawerBrand = (brandIdx: number) => {
    setDrawerBrands((prev) => prev.filter((_, idx) => idx !== brandIdx));
    if (editingBrandIdx === brandIdx) setEditingBrandIdx(null);
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
    if (selectedBusinessTypes.includes(type)) {
      setSelectedBusinessTypes(selectedBusinessTypes.filter((t) => t !== type));
    } else {
      setSelectedBusinessTypes([...selectedBusinessTypes, type]);
      if (!businessTypeEvidence.some((e) => e.type === type)) {
        setBusinessTypeEvidence([
          ...businessTypeEvidence,
          {
            type,
            text: "관리자가 수동으로 지정함 (Manually selected by administrator)",
            source: "MANUAL",
            sourceMethod: "ADMIN_MANUAL",
            status: "ADMIN_EDIT",
          },
        ]);
      }
    }
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
    const currentEvidence: BusinessTypeEvidence[] = selectedCandidateDetail.business_type_evidence || [];
    let updatedTypes: BusinessType[];
    let updatedEvidence = [...currentEvidence];

    if (currentTypes.includes(type)) {
      updatedTypes = currentTypes.filter((t) => t !== type);
    } else {
      updatedTypes = [...currentTypes, type];
      if (!updatedEvidence.some((e) => e.type === type)) {
        updatedEvidence.push({
          type,
          text: "관리자가 수동으로 지정함 (Manually selected by administrator)",
          source: "MANUAL",
          sourceMethod: "ADMIN_MANUAL",
          status: "ADMIN_EDIT",
        });
      }
    }
    setSelectedCandidateDetail({
      ...selectedCandidateDetail,
      business_types: updatedTypes,
      business_type_evidence: updatedEvidence,
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

  // Primary Category toggle helper for Tab 1 (ADM-BSRC-011)
  const togglePrimaryCategory = (cat: PrimaryProductCategory) => {
    setSelectedPrimaryCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
    setPrimaryCategoriesConfirmed(true);
  };

  // Primary Category toggle helper for Drawer (ADM-BSRC-011)
  const handleToggleDrawerPrimaryCategory = (cat: PrimaryProductCategory) => {
    if (!selectedCandidateDetail) return;
    const current = (selectedCandidateDetail.primary_product_categories || []) as PrimaryProductCategory[];
    const next = current.includes(cat) ? current.filter((c) => c !== cat) : [...current, cat];
    setSelectedCandidateDetail({
      ...selectedCandidateDetail,
      primary_product_categories: next,
      primary_categories_confirmed: true,
    });
  };

  // Primary Product Category badge helper (ADM-BSRC-011)
  const renderPrimaryCategoryBadge = (cat: PrimaryProductCategory) => {
    const opt = PRIMARY_PRODUCT_CATEGORY_OPTIONS.find((o) => o.value === cat);
    return (
      <span
        key={cat}
        className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60"
      >
        {opt ? opt.labelKr : cat}
      </span>
    );
  };

  // Company Type badge styling helper with distinct color schemes (ADM-BSRC-013)
  // BRAND_OWNER (브랜드) -> Green
  // OEM_ODM (OEM) -> Blue
  // MANUFACTURER (제조사) -> Amber
  // DISTRIBUTOR (유통사) -> Purple
  // IMPORTER_EXPORTER (수출입) -> Teal
  // OTHER (기타) -> Neutral Gray
  const renderCompanyTypeBadge = (bt: string) => {
    const opt = COMPANY_TYPE_OPTIONS.find((o) => o.value === bt);
    const shortLabel = COMPANY_TYPE_SHORT_LABELS[bt as BusinessType] || (opt ? opt.labelKr : bt);
    const fullDesc = opt ? `${opt.labelKr} (${opt.labelEn})` : bt;

    let colorClasses = "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700";
    if (bt === "BRAND_OWNER") {
      colorClasses = "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/50";
    } else if (bt === "OEM_ODM") {
      colorClasses = "bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/60 hover:bg-blue-100 dark:hover:bg-blue-900/50";
    } else if (bt === "MANUFACTURER") {
      colorClasses = "bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/60 hover:bg-amber-100 dark:hover:bg-amber-900/50";
    } else if (bt === "DISTRIBUTOR") {
      colorClasses = "bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/60 hover:bg-purple-100 dark:hover:bg-purple-900/50";
    } else if (bt === "IMPORTER_EXPORTER") {
      colorClasses = "bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800/60 hover:bg-teal-100 dark:hover:bg-teal-900/50";
    }

    return (
      <span
        key={bt}
        title={fullDesc}
        className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold border cursor-help transition-colors ${colorClasses}`}
      >
        {shortLabel}
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

          {/* Phase 2: Email Campaigns Tab */}
          <button
            type="button"
            onClick={() => setActiveTab("campaigns")}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "campaigns"
                ? "border-zinc-950 text-zinc-950 dark:border-white dark:text-white"
                : "border-transparent text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`}
          >
            <span>Email Campaigns</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-medium">
              V1
            </span>
          </button>

          {/* Phase 2: Results & Follow-up Tab (ADM-BSRC-007) */}
          <button
            type="button"
            onClick={() => setActiveTab("results")}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "results"
                ? "border-zinc-950 text-zinc-950 dark:border-white dark:text-white"
                : "border-transparent text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`}
          >
            <span>Results & Follow-up</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 font-medium">
              V1
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
              <div className="p-3.5 text-xs rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 flex justify-between items-center flex-wrap gap-2">
                <span className="font-semibold">{saveSuccessMessage}</span>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("list");
                    refreshBrandList();
                    if (savedCompanyId) {
                      handleOpenDetail(savedCompanyId);
                    }
                  }}
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold cursor-pointer shadow-xs"
                >
                  Brand List 상세 보기 →
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

                {/* ADM-BSRC-012-R1: Non-Blocking Compact Duplicate Warning Banner */}
                {duplicateCheck && duplicateCheck.isDuplicate && (
                  <div className="rounded-lg border p-4 space-y-3 shadow-xs bg-amber-50/90 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800">
                    <div className="flex items-start justify-between flex-wrap gap-2 border-b pb-2.5 border-amber-200 dark:border-amber-800/60">
                      <div className="flex items-start gap-2">
                        <span className="text-lg">⚠️</span>
                        <div>
                          <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                            중복 가능성이 있는 회사입니다.
                          </h4>
                          <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                            기존 등록 정보와 일부 항목이 일치합니다. 확인 후 신규 회사로 등록할 수 있습니다.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setReviewedDraft(null);
                            setDuplicateCheck(null);
                          }}
                          className="px-2.5 py-1 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 cursor-pointer"
                        >
                          취소 (Cancel)
                        </button>
                      </div>
                    </div>

                    {/* Matched Records List */}
                    <div className="space-y-2">
                      {duplicateCheck.matches.map((m, idx) => (
                        <div
                          key={idx}
                          className="p-3 bg-white/95 dark:bg-zinc-900/95 rounded-md border border-zinc-200 dark:border-zinc-800 text-xs space-y-1.5"
                        >
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                {m.matchedField || "일치 항목"}
                              </span>
                              <span className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">
                                {m.entityName}
                                {m.entityNameEn && (
                                  <span className="text-zinc-400 font-normal ml-1">({m.entityNameEn})</span>
                                )}
                              </span>
                            </div>
                            <span className="font-mono text-[11px] text-zinc-400">
                              ID: {m.entityId.slice(0, 8)}...
                            </span>
                          </div>

                          <div className="text-zinc-600 dark:text-zinc-400">
                            <strong className="text-zinc-700 dark:text-zinc-300">일치 사유:</strong> {m.reason}
                            {m.matchedValue && (
                              <span className="font-mono text-[11px] text-zinc-500 ml-2">
                                (일치값: {m.matchedValue})
                              </span>
                            )}
                          </div>

                          {/* Quick Action Buttons for this match */}
                          <div className="pt-2 flex flex-wrap items-center gap-2 border-t border-zinc-100 dark:border-zinc-800">
                            <button
                              type="button"
                              onClick={() => {
                                setActiveTab("list");
                                handleOpenDetail(m.entityId);
                              }}
                              className="px-2.5 py-1 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 cursor-pointer"
                            >
                              기존 회사 보기 (View Existing Company)
                            </button>
                            <button
                              type="button"
                              onClick={() => handleInitiateSave()}
                              className="px-2.5 py-1 text-xs font-bold rounded bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                            >
                              신규 회사로 등록 (Register as New Company)
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ADM-BSRC-012-R1: Source URL Conflict Alert (Data Integrity, Separate Informational) */}
                {duplicateCheck?.sourceConflict?.hasConflict && (
                  <div className="rounded-lg border p-4 space-y-2.5 shadow-xs bg-blue-50/90 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800">
                    <div className="flex items-start justify-between flex-wrap gap-2">
                      <div className="flex items-start gap-2">
                        <span className="text-lg">ℹ️</span>
                        <div>
                          <h4 className="text-sm font-bold text-blue-900 dark:text-blue-200">
                            전시회 소스 URL 중복 안내
                          </h4>
                          <p className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">
                            이 전시회 출품 소스 URL은 이미 기존 회사(&quot;{duplicateCheck.sourceConflict.existingCompanyName}&quot;)에 등록되어 있습니다.
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleOpenLinkModal({
                          matchType: "SOURCE_URL",
                          severity: "POSSIBLE",
                          matchedValue: duplicateCheck.sourceConflict!.sourceUrl,
                          entityType: "SOURCING_CANDIDATE",
                          entityId: duplicateCheck.sourceConflict!.existingCompanyId,
                          entityName: duplicateCheck.sourceConflict!.existingCompanyName,
                          reason: duplicateCheck.sourceConflict!.reason,
                        })}
                        className="px-3 py-1.5 text-xs font-bold rounded bg-blue-600 hover:bg-blue-700 text-white cursor-pointer shadow-xs"
                      >
                        🔗 기존 회사에 소스 연결 (Link New Source)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleInitiateSave()}
                        className="px-3 py-1.5 text-xs font-bold rounded bg-zinc-700 hover:bg-zinc-800 text-white cursor-pointer shadow-xs"
                      >
                        신규 독립 법인으로 등록 (Register as New Company)
                      </button>
                    </div>
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
                        onChange={(e) => {
                          const updated = {
                            ...reviewedDraft,
                            company: { ...reviewedDraft.company, nameKr: e.target.value },
                          };
                          setReviewedDraft(updated);
                          handleRecheckDuplicates(updated);
                        }}
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
                        onChange={(e) => {
                          const updated = {
                            ...reviewedDraft,
                            company: { ...reviewedDraft.company, nameEn: e.target.value },
                          };
                          setReviewedDraft(updated);
                          handleRecheckDuplicates(updated);
                        }}
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

                    <div>
                      <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                        Telephone (대표 전화번호)
                      </label>
                      <input
                        type="text"
                        value={reviewedDraft.company.telephone || ""}
                        onChange={(e) =>
                          setReviewedDraft({
                            ...reviewedDraft,
                            company: {
                              ...reviewedDraft.company,
                              telephone: e.target.value,
                            },
                          })
                        }
                        className="w-full px-3 py-1.5 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-mono"
                        placeholder="02-000-0000"
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
                                      const updated = { ...reviewedDraft, contacts: copy };
                                      setReviewedDraft(updated);
                                      handleRecheckDuplicates(updated);
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
                                      const updated = { ...reviewedDraft, contacts: remaining };
                                      setReviewedDraft(updated);
                                      handleRecheckDuplicates(updated);
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
                                  const updated = { ...reviewedDraft, brands: copy };
                                  setReviewedDraft(updated);
                                  handleRecheckDuplicates(updated);
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
                                  const updated = { ...reviewedDraft, brands: copy };
                                  setReviewedDraft(updated);
                                  handleRecheckDuplicates(updated);
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

                {/* 4. Company Documents & Attachments Card */}
                <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-5 shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                        4. Company Documents / 첨부 자료 ({companyDocuments.length})
                      </h3>
                      <span className="text-xs text-zinc-400">
                        카탈로그, 브로슈어, 소개서 등
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setAddDocTarget("import");
                        setShowAddDocModal(true);
                      }}
                      className="px-2.5 py-1 text-xs font-semibold rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 cursor-pointer flex items-center gap-1"
                    >
                      + Add Document
                    </button>
                  </div>

                  {companyDocuments.length > 0 ? (
                    <div className="divide-y divide-zinc-100 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
                      {companyDocuments.map((doc, dIdx) => (
                        <div
                          key={doc.id || dIdx}
                          className="p-3 bg-zinc-50/50 dark:bg-zinc-950/40 flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center font-bold text-xs shrink-0">
                              PDF
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-zinc-900 dark:text-zinc-100 truncate">
                                {doc.title}
                              </p>
                              <div className="flex items-center gap-2 text-[10px] text-zinc-400 mt-0.5">
                                <span className="px-1.5 py-0.2 bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded font-semibold">
                                  {doc.fileType}
                                </span>
                                {doc.fileSize && <span>{formatFileSize(doc.fileSize)}</span>}
                                <span>출처: {doc.source === "SOURCE_EXHIBITION" ? "전시회 공식 문서" : "수동 첨부"}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <a
                              href={doc.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1 text-xs font-semibold rounded bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800 flex items-center gap-1"
                            >
                              View / Download ↗
                            </a>
                            <button
                              type="button"
                              onClick={() => handleRemoveDocument(dIdx)}
                              className="px-2 py-1 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded transition-colors cursor-pointer"
                              title="Remove document"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-dashed border-zinc-200 dark:border-zinc-800 text-center text-xs text-zinc-400 italic space-y-1">
                      <p>전시회 또는 수집 소스에서 발견된 공식 문서가 없습니다.</p>
                      <p className="text-[11px] text-zinc-500">필요 시 &apos;+ Add Document&apos; 버튼으로 카탈로그나 PDF 링크를 등록할 수 있습니다.</p>
                    </div>
                  )}
                </div>

                {/* 5. Corporate Description & Overview Card */}
                <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-5 shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                      5. Corporate Description & Overview (회사 소개 및 기업 개요)
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
                        const ev = businessTypeEvidence.find((e) => e.type === opt.value);
                        const isExpanded = expandedEvidenceType === opt.value;
                        return (
                          <div
                            key={opt.value}
                            className={`p-1.5 rounded text-xs transition-colors ${
                              isChecked
                                ? "bg-blue-50/80 dark:bg-blue-950/50 text-blue-900 dark:text-blue-200 font-semibold"
                                : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900"
                            }`}
                          >
                            <label className="flex items-start gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleBusinessType(opt.value)}
                                className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-1">
                                  <span className="block leading-tight">{opt.labelKr}</span>
                                </div>
                                <span className="text-[10px] text-zinc-400 font-normal leading-tight block">
                                  {opt.labelEn}
                                </span>
                              </div>
                            </label>
                            {isChecked && ev && (
                              <div className="mt-1 pl-5">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setExpandedEvidenceType(isExpanded ? null : opt.value);
                                  }}
                                  className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded border transition-colors cursor-pointer ${
                                    ev.status === "VERIFIED"
                                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
                                      : ev.status === "DEFAULT_UNVERIFIED"
                                      ? "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-800"
                                      : "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-300 dark:border-blue-800"
                                  }`}
                                >
                                  {ev.status === "VERIFIED"
                                    ? "✓ 근거 확인"
                                    : ev.status === "DEFAULT_UNVERIFIED"
                                    ? "⚠️ 미확인 기본값"
                                    : "✏️ 관리자 수정"}
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Expandable Evidence Details Card */}
                    {expandedEvidenceType && (() => {
                      const ev = businessTypeEvidence.find((e) => e.type === expandedEvidenceType);
                      const opt = COMPANY_TYPE_OPTIONS.find((o) => o.value === expandedEvidenceType);
                      if (!ev || !opt) return null;
                      return (
                        <div className="p-3 rounded-lg bg-zinc-100 dark:bg-zinc-850 border border-zinc-300 dark:border-zinc-700 text-xs space-y-2 mt-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-zinc-900 dark:text-zinc-100">
                                {opt.labelKr} 증빙 근거
                              </span>
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                                  ev.status === "VERIFIED"
                                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                    : ev.status === "DEFAULT_UNVERIFIED"
                                    ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                                    : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                                }`}
                              >
                                {ev.status || "VERIFIED"}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => setExpandedEvidenceType(null)}
                              className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xs font-bold cursor-pointer"
                            >
                              ✕
                            </button>
                          </div>

                          <div className="p-2 rounded bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-750 text-[11px] text-zinc-700 dark:text-zinc-300 italic leading-relaxed">
                            &ldquo;{ev.text}&rdquo;
                          </div>

                          <div className="flex items-center justify-between text-[10px] text-zinc-500 dark:text-zinc-400">
                            <span>
                              추출 방식: <code className="bg-zinc-200 dark:bg-zinc-750 px-1 py-0.5 rounded">{ev.sourceMethod || "INTERCHARM"}</code>
                            </span>
                            {ev.sourceUrl && (
                              <a
                                href={ev.sourceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5 font-medium"
                              >
                                원문 소스 확인 ↗
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    })()}

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

                  {/* Primary Product Category Selector (Multi-Select, ADM-BSRC-011) */}
                  <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                        Primary Product Category (주력 상품 분야)
                      </label>
                      <span className="text-[10px] text-zinc-400">복수 선택 가능</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50">
                      {PRIMARY_PRODUCT_CATEGORY_OPTIONS.map((opt) => {
                        const isChecked = selectedPrimaryCategories.includes(opt.value);
                        return (
                          <label
                            key={opt.value}
                            className={`p-1.5 rounded text-xs transition-colors flex items-start gap-2 cursor-pointer ${
                              isChecked
                                ? "bg-emerald-50/80 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-200 font-semibold"
                                : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => togglePrimaryCategory(opt.value)}
                              className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                            />
                            <div className="min-w-0 flex-1">
                              <span className="block leading-tight">{opt.labelKr}</span>
                              <span className="text-[10px] text-zinc-400 font-normal leading-tight block">
                                {opt.labelEn}
                              </span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                    {selectedPrimaryCategories.length === 0 && (
                      <p className="text-[10px] text-zinc-400 italic">
                        근거가 불충분할 경우 미분류(Unclassified) 상태로 저장됩니다.
                      </p>
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
                      className="w-full py-2.5 text-xs font-bold rounded-md transition-colors shadow-xs disabled:opacity-50 cursor-pointer flex justify-center items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      {isSaving ? (
                        <>
                          <svg className="animate-spin h-3.5 w-3.5 text-current" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                          </svg>
                          <span>Saving to QA DB...</span>
                        </>
                      ) : duplicateCheck?.isDuplicate ? (
                        <span>Save to Brand List (중복 확인 후 등록)</span>
                      ) : (
                        <span>Save to Brand List (브랜드 목록에 저장)</span>
                      )}
                    </button>

                    {duplicateCheck?.sourceConflict?.hasConflict && (
                      <button
                        type="button"
                        onClick={() => handleOpenLinkModal({
                          matchType: "SOURCE_URL",
                          severity: "POSSIBLE",
                          matchedValue: duplicateCheck.sourceConflict!.sourceUrl,
                          entityType: "SOURCING_CANDIDATE",
                          entityId: duplicateCheck.sourceConflict!.existingCompanyId,
                          entityName: duplicateCheck.sourceConflict!.existingCompanyName,
                          reason: duplicateCheck.sourceConflict!.reason,
                        })}
                        className="w-full py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-md cursor-pointer flex justify-center items-center gap-1.5 shadow-xs"
                      >
                        <span>🔗</span> 기존 회사에 새 소스 연결 (Link New Source)
                      </button>
                    )}

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
            {/* Search Input (Extended Search, ADM-BSRC-013) */}
            <div className="flex-1 min-w-[240px]">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setCurrentPage(1);
                    refreshBrandList(1, pageSize);
                  }
                }}
                placeholder="Search company, brand, email, phone, domain, notes..."
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

            {/* Primary Product Category Multi-Select Filter (ADM-BSRC-011) */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowPrimaryCatFilterDropdown((prev) => !prev)}
                className={`px-2.5 py-1.5 text-xs rounded border transition-colors flex items-center gap-1.5 cursor-pointer ${
                  filterPrimaryCategories.length > 0
                    ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 font-semibold"
                    : "bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 border-zinc-300 dark:border-zinc-700"
                }`}
              >
                <span>
                  {filterPrimaryCategories.length === 0
                    ? "Primary: All"
                    : `Primary (${filterPrimaryCategories.length})`}
                </span>
                <span className="text-[10px] text-zinc-400">▾</span>
              </button>

              {showPrimaryCatFilterDropdown && (
                <div
                  className="absolute z-50 left-0 top-full mt-1 w-52 p-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 shadow-xl space-y-1 text-xs"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between pb-1.5 border-b border-zinc-100 dark:border-zinc-800 text-[11px] font-bold text-zinc-700 dark:text-zinc-300">
                    <span>주력 상품 분류 필터</span>
                    {filterPrimaryCategories.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setFilterPrimaryCategories([]);
                          setCurrentPage(1);
                        }}
                        className="text-[10px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 underline cursor-pointer"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                  <div className="space-y-1 pt-1 max-h-48 overflow-y-auto">
                    {PRIMARY_PRODUCT_CATEGORY_OPTIONS.map((opt) => {
                      const isSelected = filterPrimaryCategories.includes(opt.value);
                      return (
                        <label
                          key={opt.value}
                          className="flex items-center gap-2 p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {
                              const next = isSelected
                                ? filterPrimaryCategories.filter((c) => c !== opt.value)
                                : [...filterPrimaryCategories, opt.value];
                              setFilterPrimaryCategories(next);
                              setCurrentPage(1);
                            }}
                            className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          />
                          <span className="text-zinc-800 dark:text-zinc-200 text-xs">
                            {opt.labelKr} ({opt.labelEn})
                          </span>
                        </label>
                      );
                    })}
                    <label className="flex items-center gap-2 p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer border-t border-zinc-100 dark:border-zinc-800 pt-1">
                      <input
                        type="checkbox"
                        checked={filterPrimaryCategories.includes("UNCLASSIFIED")}
                        onChange={() => {
                          const isSelected = filterPrimaryCategories.includes("UNCLASSIFIED");
                          const next = isSelected
                            ? filterPrimaryCategories.filter((c) => c !== "UNCLASSIFIED")
                            : [...filterPrimaryCategories, "UNCLASSIFIED"];
                          setFilterPrimaryCategories(next);
                          setCurrentPage(1);
                        }}
                        className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                      <span className="text-zinc-500 dark:text-zinc-400 text-xs italic">
                        미분류 (Unclassified)
                      </span>
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Apply & Refresh Buttons */}
            <button
              type="button"
              onClick={() => {
                setCurrentPage(1);
                refreshBrandList(1, pageSize);
              }}
              className="px-4 py-1.5 text-xs font-bold text-white bg-zinc-950 dark:bg-zinc-100 dark:text-zinc-950 rounded hover:bg-zinc-800 dark:hover:bg-white/90 cursor-pointer"
            >
              Filter
            </button>

            {/* Bulk Delete Button (ADM-BSRC-013) */}
            {selectedCompanyIds.length > 0 && (
              <button
                type="button"
                onClick={() => setShowBulkDeleteModal(true)}
                className="px-3 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded cursor-pointer flex items-center gap-1.5 shadow-2xs transition-colors ml-auto"
              >
                <span>🗑️</span>
                <span>Delete Selected ({selectedCompanyIds.length})</span>
              </button>
            )}
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
                    <th className="p-3 w-10 text-center">
                      <input
                        type="checkbox"
                        aria-label="Select all on current page"
                        checked={candidates.length > 0 && candidates.every((c) => selectedCompanyIds.includes(c.id))}
                        onChange={handleToggleSelectAllCurrentPage}
                        className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                    </th>
                    <th className="p-3">Company (법인명)</th>
                    <th className="p-3">Brands</th>
                    <th className="p-3">Categories</th>
                    <th className="p-3">Primary Product</th>
                    <th className="p-3">Company Type</th>
                    <th className="p-3">Grade</th>
                    <th className="p-3">Primary Contact</th>
                    <th className="p-3">Website</th>
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

                      const primaryCats = (c.primary_product_categories || []) as PrimaryProductCategory[];

                      const isRowSelected = selectedCompanyIds.includes(c.id);
                      return (
                        <tr
                          key={c.id}
                          className={`hover:bg-zinc-50 dark:hover:bg-zinc-850/50 transition-colors ${isRowSelected ? "bg-blue-50/50 dark:bg-blue-950/20" : ""}`}
                        >
                          <td className="p-3 w-10 text-center">
                            <input
                              type="checkbox"
                              aria-label={`Select ${c.company_name_kr}`}
                              checked={isRowSelected}
                              onChange={(e) => {
                                e.stopPropagation();
                                handleToggleSelectRow(c.id);
                              }}
                              className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                          </td>
                          <td className="p-3">
                            <button
                              type="button"
                              onClick={() => handleOpenDetail(c.id)}
                              className="text-left font-bold text-zinc-900 dark:text-zinc-100 hover:text-blue-600 dark:hover:text-blue-400 hover:underline cursor-pointer block"
                            >
                              {c.company_name_kr}
                            </button>
                            {c.company_name_en && (
                              <p className="text-[11px] text-zinc-400 truncate max-w-[180px]">
                                {c.company_name_en}
                              </p>
                            )}
                          </td>
                          {/* Brands Column: Count only + Popover on Hover/Click (ADM-BSRC-011) */}
                          <td className="p-3 relative" onClick={(e) => e.stopPropagation()}>
                            {c.sourcing_brands && c.sourcing_brands.length > 0 ? (
                              <div
                                className="relative inline-block"
                                onMouseEnter={() => setActivePopover({ rowId: c.id, col: "brands" })}
                                onMouseLeave={() => setActivePopover(null)}
                              >
                                <button
                                  type="button"
                                  aria-haspopup="dialog"
                                  aria-expanded={activePopover?.rowId === c.id && activePopover?.col === "brands"}
                                  onClick={() =>
                                    setActivePopover((curr) =>
                                      curr?.rowId === c.id && curr?.col === "brands" ? null : { rowId: c.id, col: "brands" }
                                    )
                                  }
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-700 cursor-pointer transition-colors"
                                >
                                  <span>{c.sourcing_brands.length}</span>
                                  <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-normal">
                                    {c.sourcing_brands.length === 1 ? "Brand" : "Brands"}
                                  </span>
                                </button>

                                {activePopover?.rowId === c.id && activePopover?.col === "brands" && (
                                  <div
                                    role="dialog"
                                    className="absolute z-50 left-0 top-full mt-1.5 w-60 max-h-56 overflow-y-auto rounded-lg bg-zinc-900 border border-zinc-700 shadow-2xl p-2.5 text-xs space-y-1.5 text-zinc-100 ring-1 ring-black/40"
                                  >
                                    <div className="flex items-center justify-between pb-1 border-b border-zinc-800 text-[11px] font-bold text-zinc-300">
                                      <span>보유 브랜드 목록</span>
                                      <span className="text-[10px] text-zinc-500 font-normal">
                                        총 {c.sourcing_brands.length}개
                                      </span>
                                    </div>
                                    <div className="flex flex-wrap gap-1 pt-1">
                                      {c.sourcing_brands.map((b: any, bIdx: number) => (
                                        <span
                                          key={bIdx}
                                          className="inline-block px-1.5 py-0.5 rounded text-[11px] font-medium bg-zinc-800 text-zinc-200 border border-zinc-700"
                                        >
                                          {b.brand_name_kr || b.brand_name_en}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-zinc-400 text-[11px]">—</span>
                            )}
                          </td>
                          {/* Categories Column: Count only + Popover on Hover/Click (ADM-BSRC-011) */}
                          <td className="p-3 relative" onClick={(e) => e.stopPropagation()}>
                            {allCategories.length > 0 ? (
                              <div
                                className="relative inline-block"
                                onMouseEnter={() => setActivePopover({ rowId: c.id, col: "categories" })}
                                onMouseLeave={() => setActivePopover(null)}
                              >
                                <button
                                  type="button"
                                  aria-haspopup="dialog"
                                  aria-expanded={activePopover?.rowId === c.id && activePopover?.col === "categories"}
                                  onClick={() =>
                                    setActivePopover((curr) =>
                                      curr?.rowId === c.id && curr?.col === "categories" ? null : { rowId: c.id, col: "categories" }
                                    )
                                  }
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 cursor-pointer transition-colors"
                                >
                                  <span>{allCategories.length}</span>
                                  <span className="text-[10px] text-blue-500 dark:text-blue-400 font-normal">
                                    {allCategories.length === 1 ? "Category" : "Categories"}
                                  </span>
                                </button>

                                {activePopover?.rowId === c.id && activePopover?.col === "categories" && (
                                  <div
                                    role="dialog"
                                    className="absolute z-50 left-0 top-full mt-1.5 w-64 max-h-56 overflow-y-auto rounded-lg bg-zinc-900 border border-zinc-700 shadow-2xl p-2.5 text-xs space-y-1.5 text-zinc-100 ring-1 ring-black/40"
                                  >
                                    <div className="flex items-center justify-between pb-1 border-b border-zinc-800 text-[11px] font-bold text-zinc-300">
                                      <span>수집 카테고리 전체</span>
                                      <span className="text-[10px] text-zinc-500 font-normal">
                                        총 {allCategories.length}개
                                      </span>
                                    </div>
                                    <div className="flex flex-wrap gap-1 pt-1">
                                      {allCategories.map((cat: string, catIdx: number) => (
                                        <span
                                          key={catIdx}
                                          className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-950/60 text-blue-200 border border-blue-800"
                                        >
                                          {cat}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-zinc-400 text-[11px]">—</span>
                            )}
                          </td>
                          {/* Primary Product Column: Up to 2 badges + +N with Popover (ADM-BSRC-011) */}
                          <td className="p-3 relative" onClick={(e) => e.stopPropagation()}>
                            {primaryCats.length === 0 ? (
                              <span className="text-zinc-400 dark:text-zinc-500 text-[11px] italic">
                                Unclassified
                              </span>
                            ) : (
                              <div
                                className="relative inline-flex items-center gap-1"
                                onMouseEnter={() => {
                                  if (primaryCats.length > 2) setActivePopover({ rowId: c.id, col: "primary" });
                                }}
                                onMouseLeave={() => setActivePopover(null)}
                              >
                                {primaryCats.slice(0, 2).map((cat) => renderPrimaryCategoryBadge(cat))}
                                {primaryCats.length > 2 && (
                                  <button
                                    type="button"
                                    aria-haspopup="dialog"
                                    aria-expanded={activePopover?.rowId === c.id && activePopover?.col === "primary"}
                                    onClick={() =>
                                      setActivePopover((curr) =>
                                        curr?.rowId === c.id && curr?.col === "primary" ? null : { rowId: c.id, col: "primary" }
                                      )
                                    }
                                    className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-700 cursor-pointer transition-colors"
                                  >
                                    +{primaryCats.length - 2}
                                  </button>
                                )}

                                {primaryCats.length > 2 && activePopover?.rowId === c.id && activePopover?.col === "primary" && (
                                  <div
                                    role="dialog"
                                    className="absolute z-50 left-0 top-full mt-1.5 w-56 max-h-56 overflow-y-auto rounded-lg bg-zinc-900 border border-zinc-700 shadow-2xl p-2.5 text-xs space-y-1.5 text-zinc-100 ring-1 ring-black/40"
                                  >
                                    <div className="flex items-center justify-between pb-1 border-b border-zinc-800 text-[11px] font-bold text-zinc-300">
                                      <span>주력 상품 분야 전체</span>
                                      <span className="text-[10px] text-zinc-500 font-normal">
                                        총 {primaryCats.length}개
                                      </span>
                                    </div>
                                    <div className="flex flex-wrap gap-1 pt-1">
                                      {primaryCats.map((cat) => renderPrimaryCategoryBadge(cat))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
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
                          {/* Inline Editable Grade Dropdown (Requirement 3) */}
                          <td className="p-3" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-1.5">
                              <select
                                value={c.grade || "UNRATED"}
                                disabled={savingGradeCompanyId === c.id}
                                onChange={(e) =>
                                  handleInlineGradeChange(
                                    c.id,
                                    e.target.value as "A" | "B" | "C" | "UNRATED"
                                  )
                                }
                                className={`text-xs font-semibold px-2 py-1 rounded border transition-colors cursor-pointer disabled:opacity-50 ${
                                  c.grade === "A"
                                    ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700"
                                    : c.grade === "B"
                                    ? "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700"
                                    : c.grade === "C"
                                    ? "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700"
                                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-750"
                                }`}
                              >
                                <option value="UNRATED">UNRATED</option>
                                <option value="A">Grade A</option>
                                <option value="B">Grade B</option>
                                <option value="C">Grade C</option>
                              </select>
                              {savingGradeCompanyId === c.id && (
                                <span className="animate-spin text-zinc-400 text-xs">⟳</span>
                              )}
                            </div>
                          </td>
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
                          {/* Note: Status column removed from Brand List table per Requirement 4 */}
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
                                  setActiveTab("results");
                                }}
                                className="px-2 py-1 text-[11px] font-medium rounded text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 cursor-pointer"
                                title="View Campaign & Outreach Results"
                              >
                                Results ↗
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

            {/* Pagination footer with Page Size selector (ADM-BSRC-013) */}
            <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-500">
              <div className="flex items-center gap-3">
                <span>
                  Showing {totalCandidates > 0 ? (currentPage - 1) * pageSize + 1 : 0}–{Math.min(currentPage * pageSize, totalCandidates)} of {totalCandidates} candidates
                </span>
                <div className="flex items-center gap-1.5 ml-2">
                  <span className="text-[11px] text-zinc-400">Rows per page:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      const newSize = Number(e.target.value);
                      setPageSize(newSize);
                      setCurrentPage(1);
                      refreshBrandList(1, newSize);
                    }}
                    className="px-2 py-0.5 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 cursor-pointer"
                  >
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={200}>200</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => {
                    const p = currentPage - 1;
                    setCurrentPage(p);
                    refreshBrandList(p, pageSize);
                  }}
                  className="px-2.5 py-1 rounded border border-zinc-200 dark:border-zinc-700 disabled:opacity-40 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800"
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
                    refreshBrandList(p, pageSize);
                  }}
                  className="px-2.5 py-1 rounded border border-zinc-200 dark:border-zinc-700 disabled:opacity-40 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* TAB 3: EMAIL CAMPAIGNS VIEW                                       */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === "campaigns" && (
        <EmailCampaignsView candidates={candidates} />
      )}

      {/* ------------------------------------------------------------------ */}
      {/* TAB 4: CAMPAIGN RESULTS & COMPANY FOLLOW-UP VIEW (ADM-BSRC-007)     */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === "results" && (
        <CampaignResultsView
          onNavigateToBrandList={(companyId) => {
            setActiveTab("list");
            handleOpenDetail(companyId);
          }}
        />
      )}

      {/* Bulk Delete Confirmation Modal (ADM-BSRC-013) */}
      {showBulkDeleteModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-xl max-w-md w-full p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  선택한 회사 삭제 (Delete Selected Companies)
                </h3>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  선택된 회사 {selectedCompanyIds.length}개
                </span>
              </div>
            </div>

            <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
              선택한 <strong className="text-red-600 dark:text-red-400">{selectedCompanyIds.length}개</strong> 회사를 보관/삭제 처리하시겠습니까?
              <br />
              이력 보호를 위해 안전하게 보관(ARCHIVED) 처리되며, 브랜드 목록에서 즉시 숨김 처리됩니다.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                disabled={isBulkDeleting}
                onClick={() => setShowBulkDeleteModal(false)}
                className="px-4 py-2 text-xs font-semibold rounded border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer"
              >
                취소 (Cancel)
              </button>
              <button
                type="button"
                disabled={isBulkDeleting}
                onClick={handleConfirmBulkDelete}
                className="px-4 py-2 text-xs font-bold rounded bg-red-600 hover:bg-red-700 text-white cursor-pointer disabled:opacity-50"
              >
                {isBulkDeleting ? "삭제 처리 중..." : `삭제 확인 (Delete ${selectedCompanyIds.length})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 1. DUPLICATE DECISION MODAL DIALOG                                 */}
      {/* ------------------------------------------------------------------ */}
      {showDuplicateModal && duplicateCheck && reviewedDraft && (
        <div className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start gap-3 border-b pb-3 border-zinc-100 dark:border-zinc-800">
              <span className="text-2xl">⚠️</span>
              <div className="flex-1">
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  중복 가능성이 있습니다.
                </h3>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
                  기존 회사와 일부 정보가 일치합니다. 그래도 새로운 회사로 등록하시겠습니까?
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowDuplicateModal(false)}
                className="text-zinc-400 hover:text-zinc-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Matched Summary Box */}
            <div className="bg-zinc-50 dark:bg-zinc-950 p-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800 space-y-2 text-xs">
              <span className="font-bold text-zinc-700 dark:text-zinc-300">
                일치 항목 ({duplicateCheck.matches.length}건):
              </span>
              <div className="space-y-2">
                {duplicateCheck.matches.map((m, idx) => (
                  <div key={idx} className="p-2.5 rounded bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">{m.entityName}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                        {m.matchedField || "일치 항목"}
                      </span>
                    </div>
                    <div className="text-[11px] text-zinc-600 dark:text-zinc-400">
                      <span className="font-semibold text-zinc-700 dark:text-zinc-300">사유: </span>
                      {m.reason}
                    </div>
                    {m.matchedValue && (
                      <div className="text-[11px] font-mono text-zinc-500">
                        일치값: {m.matchedValue}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Simplified Confirmation Dialog Actions: 취소, 기존 회사 보기, 신규 회사로 등록 */}
            <div className="flex flex-col sm:flex-row items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setShowDuplicateModal(false)}
                className="w-full sm:w-auto px-4 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 rounded-lg cursor-pointer"
              >
                취소 (Cancel)
              </button>

              {duplicateCheck.matches[0]?.entityId && (
                <button
                  type="button"
                  onClick={() => {
                    setShowDuplicateModal(false);
                    setActiveTab("list");
                    handleOpenDetail(duplicateCheck.matches[0].entityId);
                  }}
                  className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-zinc-50 rounded-lg cursor-pointer"
                >
                  기존 회사 보기 (View Existing Company)
                </button>
              )}

              <button
                type="button"
                disabled={isSaving}
                onClick={() => executeSave({ allowDuplicateConfirmed: true })}
                className="w-full sm:w-auto px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg cursor-pointer disabled:opacity-50 shadow-xs flex items-center justify-center gap-1.5"
              >
                {isSaving ? "등록 처리 중..." : "신규 회사로 등록 (Register as New Company)"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 2. LINK NEW SOURCE CONFIRMATION MODAL                               */}
      {/* ------------------------------------------------------------------ */}
      {showLinkModal && targetCompanyToLink && reviewedDraft && (
        <div className="fixed inset-0 z-[75] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-zinc-100 dark:border-zinc-800">
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <span>🔗</span> 기존 회사에 새 소스 연결 (Link New Source)
              </h3>
              <button
                type="button"
                onClick={() => setShowLinkModal(false)}
                className="text-zinc-400 hover:text-zinc-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg space-y-1.5">
                <div>
                  <strong className="text-blue-900 dark:text-blue-200">대상 기존 회사:</strong>{" "}
                  <span className="font-bold text-zinc-900 dark:text-zinc-100">{targetCompanyToLink.entityName}</span>
                </div>
                <div className="text-[11px] font-mono text-zinc-500">ID: {targetCompanyToLink.entityId}</div>
              </div>

              <div className="space-y-1">
                <span className="font-semibold text-zinc-700 dark:text-zinc-300">연결될 신규 전시회 소스:</span>
                <div className="p-2.5 bg-zinc-50 dark:bg-zinc-950 rounded border border-zinc-200 dark:border-zinc-800 font-mono text-[11px] truncate">
                  {reviewedDraft.source.sourceUrl}
                </div>
              </div>

              <div className="p-3 bg-zinc-50 dark:bg-zinc-950 rounded border border-zinc-200 dark:border-zinc-800 space-y-1 text-zinc-600 dark:text-zinc-400 text-[11px]">
                <div className="font-bold text-zinc-800 dark:text-zinc-200">데이터 무결성 보호 규칙:</div>
                <div>• 기존 회사의 검토된 법인 정보, 등급, 상태는 임의로 덮어쓰지 않습니다.</div>
                <div>• 신규 담당자 이메일({reviewedDraft.contacts.length}명) 중 중복되지 않은 정보만 추가됩니다.</div>
                <div>• 신규 웹사이트 및 브랜드가 중복 없이 안전하게 보존됩니다.</div>
                <div>• 마케팅 수신동의 상태는 변경되지 않으며 엄격히 분리 유지됩니다.</div>
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  소스 연결 사유 및 관리자 메모 (선택 입력):
                </label>
                <input
                  type="text"
                  placeholder="예: 2026 InterCHARM 참가 신규 출품 정보 및 담당자 추가 연결"
                  value={linkNotes}
                  onChange={(e) => setLinkNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setShowLinkModal(false)}
                disabled={isLinking}
                className="px-3.5 py-2 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 cursor-pointer"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleConfirmLink}
                disabled={isLinking}
                className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 cursor-pointer shadow-xs flex items-center gap-1.5"
              >
                {isLinking ? "연결 처리 중..." : "소스 연결 확정 (Confirm Link)"}
              </button>
            </div>
          </div>
        </div>
      )}

            {/* ------------------------------------------------------------------ */}
      {/* 4. DUPLICATE AUDIT REPORT MODAL                                    */}
      {/* ------------------------------------------------------------------ */}
      {showAuditModal && (
        <div className="fixed inset-0 z-[75] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3 border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <span className="text-xl">🔍</span>
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  Brand Sourcing 중복 감사 보고서 (Read-Only Duplicate Audit)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAuditModal(false)}
                className="text-zinc-400 hover:text-zinc-600 cursor-pointer font-bold text-base"
              >
                ✕
              </button>
            </div>

            {isLoadingAudit ? (
              <div className="py-12 text-center space-y-2">
                <div className="inline-block animate-spin text-2xl">⏳</div>
                <div className="text-xs text-zinc-500">전체 소싱 데이터베이스 중복 감사 분석 중...</div>
              </div>
            ) : auditReport ? (
              <div className="space-y-4 text-xs">
                {/* Metric Overview */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 bg-zinc-50 dark:bg-zinc-950 rounded-lg border border-zinc-200 dark:border-zinc-800 text-center">
                    <div className="text-[10px] text-zinc-400 font-bold uppercase">Total Companies</div>
                    <div className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{auditReport.totalCompanies}</div>
                  </div>
                  <div className="p-3 bg-zinc-50 dark:bg-zinc-950 rounded-lg border border-zinc-200 dark:border-zinc-800 text-center">
                    <div className="text-[10px] text-zinc-400 font-bold uppercase">Total Sources</div>
                    <div className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{auditReport.totalSources}</div>
                  </div>
                  <div className="p-3 bg-zinc-50 dark:bg-zinc-950 rounded-lg border border-zinc-200 dark:border-zinc-800 text-center">
                    <div className="text-[10px] text-zinc-400 font-bold uppercase">Duplicate Groups</div>
                    <div className={`text-lg font-bold ${auditReport.potentialDuplicateCompanyGroups.length > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                      {auditReport.potentialDuplicateCompanyGroups.length}
                    </div>
                  </div>
                </div>

                {/* Audit A: Confirmed Duplicate Source URLs */}
                <div className="space-y-1.5">
                  <h4 className="font-bold text-zinc-800 dark:text-zinc-200 flex items-center justify-between">
                    <span>A. 동일 전시회 소스 URL 그룹 (Canonical URL Duplicates)</span>
                    <span className="text-[11px] font-normal text-zinc-500">{auditReport.confirmedDuplicateUrlGroups.length}건 발견</span>
                  </h4>
                  {auditReport.confirmedDuplicateUrlGroups.length === 0 ? (
                    <div className="p-3 rounded bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs">
                      ✓ 확인된 중복 소스 URL이 없습니다. 모든 전시회 링크가 고유하게 관리되고 있습니다.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {auditReport.confirmedDuplicateUrlGroups.map((g, idx) => (
                        <div key={idx} className="p-3 rounded bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 space-y-1">
                          <div className="font-mono text-[11px] text-red-900 dark:text-red-200 truncate">{g.canonicalUrl}</div>
                          <div className="text-zinc-600 dark:text-zinc-400">연결된 회사: {g.companyNames.join(", ")}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Audit B: Potential Duplicate Company Name Groups */}
                <div className="space-y-1.5">
                  <h4 className="font-bold text-zinc-800 dark:text-zinc-200 flex items-center justify-between">
                    <span>B. 잠재적 중복 법인 그룹 (Potential Duplicate Company Groups)</span>
                    <span className="text-[11px] font-normal text-zinc-500">{auditReport.potentialDuplicateCompanyGroups.length}개 그룹</span>
                  </h4>
                  {auditReport.potentialDuplicateCompanyGroups.length === 0 ? (
                    <div className="p-3 rounded bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs">
                      ✓ 중복된 동일 법인명 레코드가 발견되지 않았습니다.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {auditReport.potentialDuplicateCompanyGroups.map((g, idx) => (
                        <div key={idx} className="p-3 rounded bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 space-y-2">
                          <div className="font-bold text-amber-900 dark:text-amber-200 flex items-center justify-between">
                            <span>정규화 상호: &quot;{g.normalizedName}&quot;</span>
                            <span className="text-[11px] font-normal">{g.companies.length}개 회사 레코드</span>
                          </div>
                          <div className="space-y-1">
                            {g.companies.map((c) => (
                              <div key={c.id} className="p-2 rounded bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-[11px] flex items-center justify-between flex-wrap gap-2">
                                <div>
                                  <span className="font-bold text-zinc-900 dark:text-zinc-100">{c.nameKr}</span>
                                  {c.nameEn && <span className="text-zinc-400 ml-1">({c.nameEn})</span>}
                                  <span className="ml-2 font-mono text-[10px] text-zinc-400">ID: {c.id.slice(0, 8)}...</span>
                                </div>
                                <div className="text-zinc-500 flex items-center gap-2">
                                  <span>상태: {c.status}</span>
                                  <span>소스: {c.sourcesCount}개</span>
                                  <span>담당자: {c.contactsCount}명</span>
                                  <span>캠페인: {c.campaignsCount}건</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Audit C: Duplicate Domain Groups */}
                <div className="space-y-1.5">
                  <h4 className="font-bold text-zinc-800 dark:text-zinc-200 flex items-center justify-between">
                    <span>C. 공식 웹사이트 도메인 공유 그룹</span>
                    <span className="text-[11px] font-normal text-zinc-500">{auditReport.duplicateDomainGroups.length}개 도메인</span>
                  </h4>
                  {auditReport.duplicateDomainGroups.length === 0 ? (
                    <div className="p-3 rounded bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 text-xs">
                      동일한 웹사이트 도메인을 공유하는 중복 회사가 없습니다.
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {auditReport.duplicateDomainGroups.map((d, idx) => (
                        <div key={idx} className="p-2 rounded bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-[11px] flex justify-between">
                          <span className="font-mono font-bold text-blue-600">{d.domain}</span>
                          <span className="text-zinc-500">{d.companies.map((c) => c.nameKr).join(", ")}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Remediation Note */}
                <div className="p-3.5 bg-blue-50/70 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800 text-[11px] space-y-1 text-blue-900 dark:text-blue-200">
                  <div className="font-bold">안전 권고 사항 (Safe Remediation):</div>
                  <p>{auditReport.remediationRecommendation}</p>
                </div>
              </div>
            ) : null}

            <div className="flex justify-end pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setShowAuditModal(false)}
                className="px-4 py-2 text-xs font-bold text-white bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 rounded-lg cursor-pointer"
              >
                닫기 (Close)
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
      {/* ADD DOCUMENT MODAL                                                 */}
      {/* ------------------------------------------------------------------ */}
      {showAddDocModal && (
        <div className="fixed inset-0 z-[75] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  Add Company Document
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  {addDocTarget === "import"
                    ? "Add document attachment to current import draft"
                    : "Add document attachment to candidate profile"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddDocModal(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-zinc-700 dark:text-zinc-300 font-semibold mb-1">
                  Document Title (문서명) *
                </label>
                <input
                  type="text"
                  placeholder="예: 2024 Product Catalog, Brand Introduction Brochure"
                  value={newDocTitle}
                  onChange={(e) => setNewDocTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-zinc-700 dark:text-zinc-300 font-semibold mb-1">
                  Document / PDF URL (파일 링크) *
                </label>
                <input
                  type="url"
                  placeholder="https://example.com/catalog.pdf"
                  value={newDocUrl}
                  onChange={(e) => setNewDocUrl(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-zinc-700 dark:text-zinc-300 font-semibold mb-1">
                  Document Type (문서 종류)
                </label>
                <select
                  value={newDocType}
                  onChange={(e) => setNewDocType(e.target.value as SourcingDocumentType)}
                  className="w-full px-3 py-2 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100"
                >
                  <option value="CATALOG">CATALOG (제품 카탈로그)</option>
                  <option value="BROCHURE">BROCHURE (브로슈어)</option>
                  <option value="COMPANY_PROFILE">COMPANY_PROFILE (회사 소개서)</option>
                  <option value="LOOKBOOK">LOOKBOOK (룩북)</option>
                  <option value="PRICE_LIST">PRICE_LIST (단가표)</option>
                  <option value="CERTIFICATION">CERTIFICATION (인증서)</option>
                  <option value="OTHER">OTHER (기타 문서)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-200 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setShowAddDocModal(false)}
                className="px-3.5 py-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddDocumentSubmit}
                className="px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded cursor-pointer"
              >
                Add Document
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
          <div className="bg-white dark:bg-zinc-900 w-full max-w-[800px] h-full shadow-2xl overflow-y-auto p-6 space-y-6 border-l border-zinc-200 dark:border-zinc-800">
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
                  const activeContacts = drawerContacts.length > 0 ? drawerContacts : (selectedCandidateDetail.sourcing_contacts || []);
                  const primaryContact =
                    activeContacts.find((ct: any) => Boolean(ct.is_primary ?? ct.isPrimary)) ||
                    activeContacts[0];
                  const otherContacts = activeContacts.filter(
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
                          <div className="flex items-center gap-1 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded px-2 py-0.5 shadow-2xs">
                            <span className="text-[10px] text-zinc-400 font-semibold">Grade:</span>
                            <select
                              aria-label="Candidate Grade"
                              value={selectedCandidateDetail.grade || "UNRATED"}
                              onChange={(e) => handleInlineGradeChange(selectedCandidateDetail.id, e.target.value as any)}
                              className="text-xs font-bold bg-transparent text-zinc-900 dark:text-zinc-100 cursor-pointer focus:outline-none"
                            >
                              <option value="A">Grade A</option>
                              <option value="B">Grade B</option>
                              <option value="C">Grade C</option>
                              <option value="UNRATED">UNRATED</option>
                            </select>
                          </div>
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

                {/* 2) DEDICATED CONTACTS MANAGEMENT SECTION (ADM-BSRC-013) */}
                <div className="space-y-3 p-4 rounded-lg bg-zinc-50 dark:bg-zinc-850/40 border border-zinc-200 dark:border-zinc-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm flex items-center gap-2">
                        <span>Company Contacts ({drawerContacts.length})</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-semibold">
                          다중 연락처 관리
                        </span>
                      </h4>
                      <p className="text-[11px] text-zinc-400 mt-0.5">
                        모든 등록된 담당자 정보입니다. 이메일 캠페인 수신자로 개별 선택 가능합니다.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAddContactForm(!showAddContactForm)}
                      className="px-2.5 py-1 text-xs font-semibold rounded bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 cursor-pointer flex items-center gap-1"
                    >
                      <span>+ Add Contact</span>
                    </button>
                  </div>

                  {/* Add Contact Inline Form */}
                  {showAddContactForm && (
                    <div className="p-3.5 rounded-lg border border-blue-200 dark:border-blue-800 bg-white dark:bg-zinc-900 space-y-3">
                      <span className="text-xs font-bold text-blue-600 dark:text-blue-400 block">
                        신규 담당자 추가
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                        <div>
                          <label className="block text-[11px] text-zinc-500 mb-0.5">이름 (Name)</label>
                          <input
                            type="text"
                            placeholder="예: 홍길동"
                            value={newContactName}
                            onChange={(e) => setNewContactName(e.target.value)}
                            className="w-full px-2.5 py-1 rounded border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-zinc-500 mb-0.5">직함 / 부서 (Job Title / Dept)</label>
                          <input
                            type="text"
                            placeholder="예: 해외영업팀 팀장"
                            value={newContactJobTitle}
                            onChange={(e) => setNewContactJobTitle(e.target.value)}
                            className="w-full px-2.5 py-1 rounded border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-zinc-500 mb-0.5">이메일 (Email) *</label>
                          <input
                            type="email"
                            placeholder="contact@company.com"
                            value={newContactEmail}
                            onChange={(e) => setNewContactEmail(e.target.value)}
                            className="w-full px-2.5 py-1 rounded border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-zinc-500 mb-0.5">전화번호 (Phone)</label>
                          <input
                            type="text"
                            placeholder="010-0000-0000"
                            value={newContactPhone}
                            onChange={(e) => setNewContactPhone(e.target.value)}
                            className="w-full px-2.5 py-1 rounded border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-mono"
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-1">
                        <label className="inline-flex items-center gap-1.5 text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={newContactIsPrimary}
                            onChange={(e) => setNewContactIsPrimary(e.target.checked)}
                            className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span>대표 담당자(Primary Contact)로 지정</span>
                        </label>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setShowAddContactForm(false)}
                            className="px-2.5 py-1 text-xs rounded border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                          >
                            취소
                          </button>
                          <button
                            type="button"
                            onClick={handleAddDrawerContact}
                            className="px-3 py-1 text-xs font-bold rounded bg-blue-600 hover:bg-blue-700 text-white"
                          >
                            추가 완료
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Contacts List */}
                  {drawerContacts.length > 0 ? (
                    <div className="space-y-2">
                      {drawerContacts.map((c: any, cIdx: number) => {
                        const isPrimary = Boolean(c.is_primary ?? c.isPrimary);
                        const isEditing = editingContactIdx === cIdx;

                        if (isEditing) {
                          return (
                            <div key={cIdx} className="p-3 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50/40 dark:bg-amber-950/20 space-y-2">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                <input
                                  type="text"
                                  placeholder="이름"
                                  value={c.name || ""}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setDrawerContacts((prev) => prev.map((item, i) => i === cIdx ? { ...item, name: val } : item));
                                  }}
                                  className="px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                                />
                                <input
                                  type="text"
                                  placeholder="직함/부서"
                                  value={c.job_title || c.jobTitle || ""}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setDrawerContacts((prev) => prev.map((item, i) => i === cIdx ? { ...item, job_title: val, jobTitle: val } : item));
                                  }}
                                  className="px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                                />
                                <input
                                  type="email"
                                  placeholder="이메일"
                                  value={c.email || ""}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setDrawerContacts((prev) => prev.map((item, i) => i === cIdx ? { ...item, email: val } : item));
                                  }}
                                  className="px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 font-mono"
                                />
                                <input
                                  type="text"
                                  placeholder="전화번호"
                                  value={c.phone || ""}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setDrawerContacts((prev) => prev.map((item, i) => i === cIdx ? { ...item, phone: val } : item));
                                  }}
                                  className="px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 font-mono"
                                />
                              </div>
                              <div className="flex justify-end gap-2 pt-1">
                                <button
                                  type="button"
                                  onClick={() => setEditingContactIdx(null)}
                                  className="px-2.5 py-1 text-xs rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200"
                                >
                                  완료
                                </button>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div
                            key={cIdx}
                            className={`p-3 rounded-lg border transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                              isPrimary
                                ? "border-blue-300 dark:border-blue-800/80 bg-white dark:bg-zinc-900 shadow-2xs"
                                : "border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40"
                            }`}
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-xs text-zinc-900 dark:text-zinc-100">
                                  {c.name || "담당자 (미기재)"}
                                </span>
                                {(c.job_title || c.jobTitle) && (
                                  <span className="text-[11px] text-zinc-500">
                                    {c.job_title || c.jobTitle}
                                  </span>
                                )}
                                {isPrimary ? (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                    ★ 대표 담당자 (Primary)
                                  </span>
                                ) : null}
                                {c.source && (
                                  <span className="text-[9px] font-mono px-1 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                                    {c.source}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 text-xs flex-wrap">
                                {c.email ? (
                                  <a href={`mailto:${c.email}`} className="font-mono text-blue-600 dark:text-blue-400 underline hover:text-blue-800">
                                    {c.email}
                                  </a>
                                ) : (
                                  <span className="text-zinc-400">이메일 없음</span>
                                )}
                                {c.phone && (
                                  <a href={`tel:${c.phone}`} className="font-mono text-zinc-600 dark:text-zinc-400 hover:underline">
                                    📞 {c.phone}
                                  </a>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
                              {!isPrimary && (
                                <button
                                  type="button"
                                  onClick={() => handleSetPrimaryContact(cIdx)}
                                  className="px-2 py-1 text-[11px] font-semibold rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 cursor-pointer"
                                  title="이 담당자를 대표 연락처로 지정"
                                >
                                  대표로 지정
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setEditingContactIdx(cIdx)}
                                className="px-2 py-1 text-[11px] font-semibold rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 cursor-pointer"
                              >
                                수정
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveDrawerContact(cIdx)}
                                className="px-2 py-1 text-[11px] font-semibold rounded text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
                                title="연락처 삭제"
                              >
                                삭제
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-zinc-400 text-xs italic">등록된 담당자 연락처가 없습니다.</p>
                  )}
                </div>

                {/* 3) REPRESENTED BRANDS SECTION (ADD / EDIT) (ADM-BSRC-013) */}
                <div className="space-y-3 p-4 rounded-lg bg-zinc-50 dark:bg-zinc-850/40 border border-zinc-200 dark:border-zinc-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">
                        Represented Brands ({drawerBrands.length})
                      </h4>
                      <span className="text-[11px] text-zinc-400">보유 브랜드 관리 (추가 / 수정 / 연결 해제)</span>
                    </div>
                  </div>

                  {brandErrorMessage && (
                    <div className="p-2 text-xs rounded bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
                      {brandErrorMessage}
                    </div>
                  )}

                  {/* Add Brand Inline Form */}
                  <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
                    <input
                      type="text"
                      placeholder="브랜드명(한국어) *"
                      value={newBrandKrInput}
                      onChange={(e) => setNewBrandKrInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddDrawerBrand();
                        }
                      }}
                      className="px-2.5 py-1 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 min-w-[150px] flex-1"
                    />
                    <input
                      type="text"
                      placeholder="Brand Name (English)"
                      value={newBrandEnInput}
                      onChange={(e) => setNewBrandEnInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddDrawerBrand();
                        }
                      }}
                      className="px-2.5 py-1 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 min-w-[150px] flex-1"
                    />
                    <button
                      type="button"
                      onClick={handleAddDrawerBrand}
                      className="px-3 py-1 text-xs font-bold rounded bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 cursor-pointer shrink-0"
                    >
                      + Add Brand
                    </button>
                  </div>

                  {/* Brands List */}
                  {drawerBrands.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {drawerBrands.map((b: any, bIdx: number) => {
                        const isEditing = editingBrandIdx === bIdx;
                        const bKr = b.brand_name_kr || b.nameKr || "";
                        const bEn = b.brand_name_en || b.nameEn || "";

                        if (isEditing) {
                          return (
                            <div key={bIdx} className="p-3 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50/40 dark:bg-amber-950/20 space-y-2">
                              <input
                                type="text"
                                value={bKr}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setDrawerBrands((prev) => prev.map((item, i) => i === bIdx ? { ...item, brand_name_kr: val, nameKr: val } : item));
                                }}
                                className="w-full px-2 py-1 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                                placeholder="브랜드명(한국어)"
                              />
                              <input
                                type="text"
                                value={bEn}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setDrawerBrands((prev) => prev.map((item, i) => i === bIdx ? { ...item, brand_name_en: val, nameEn: val } : item));
                                }}
                                className="w-full px-2 py-1 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                                placeholder="Brand Name (EN)"
                              />
                              <div className="flex justify-end gap-1.5 pt-1">
                                <button
                                  type="button"
                                  onClick={() => setEditingBrandIdx(null)}
                                  className="px-2 py-0.5 text-xs rounded bg-zinc-200 dark:bg-zinc-700"
                                >
                                  완료
                                </button>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div
                            key={bIdx}
                            className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center justify-between"
                          >
                            <div>
                              <span className="font-bold text-xs text-zinc-900 dark:text-zinc-100">
                                {bKr}
                              </span>
                              {bEn && bEn !== bKr && (
                                <span className="text-zinc-400 text-[11px] block mt-0.5">
                                  {bEn}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setEditingBrandIdx(bIdx)}
                                className="text-[11px] text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800"
                              >
                                수정
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveDrawerBrand(bIdx)}
                                className="text-[11px] text-red-500 hover:text-red-700 px-1.5 py-0.5 rounded hover:bg-red-50 dark:hover:bg-red-950/40"
                                title="브랜드 연결 해제"
                              >
                                삭제
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-zinc-400 text-xs italic">등록된 보유 브랜드가 없습니다.</p>
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

                {/* 4) FOURTH SUB-SECTION — Company Documents & Attachments (Independent Section) */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">
                        Company Documents / 첨부 자료 ({drawerDocuments.length})
                      </h4>
                      <p className="text-[11px] text-zinc-500 mt-0.5">
                        카탈로그, 브로슈어, 회사 소개서 등
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setAddDocTarget("drawer");
                        setShowAddDocModal(true);
                      }}
                      className="px-2.5 py-1 text-xs font-semibold rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 cursor-pointer flex items-center gap-1"
                    >
                      + Add Document
                    </button>
                  </div>

                  {drawerDocuments.length > 0 ? (
                    <div className="divide-y divide-zinc-100 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
                      {drawerDocuments.map((doc, dIdx) => (
                        <div
                          key={doc.id || dIdx}
                          className="p-3 bg-zinc-50/50 dark:bg-zinc-950/40 flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center font-bold text-xs shrink-0">
                              PDF
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-zinc-900 dark:text-zinc-100 truncate">
                                {doc.title}
                              </p>
                              <div className="flex items-center gap-2 text-[10px] text-zinc-400 mt-0.5">
                                <span className="px-1.5 py-0.2 bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded font-semibold">
                                  {doc.fileType}
                                </span>
                                {doc.fileSize && <span>{formatFileSize(doc.fileSize)}</span>}
                                <span>출처: {doc.source === "SOURCE_EXHIBITION" ? "전시회 공식 문서" : "수동 첨부"}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <a
                              href={doc.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1 text-xs font-semibold rounded bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800 flex items-center gap-1"
                            >
                              View / Download ↗
                            </a>
                            <button
                              type="button"
                              onClick={() => handleRemoveDrawerDocument(dIdx)}
                              className="px-2 py-1 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded transition-colors cursor-pointer"
                              title="Remove document"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-dashed border-zinc-200 dark:border-zinc-800 text-center text-xs text-zinc-400 italic space-y-1">
                      <p>등록된 첨부 문서가 없습니다.</p>
                      <p className="text-[11px] text-zinc-500">&apos;+ Add Document&apos; 버튼으로 카탈로그나 PDF 링크를 추가할 수 있습니다.</p>
                    </div>
                  )}
                </div>

                {/* 5) FIFTH SECTION — Corporate Description */}
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
                          const ev = drawerBusinessTypeEvidence.find((e) => e.type === opt.value);
                          const isExpanded = drawerExpandedEvidenceType === opt.value;
                          return (
                            <div
                              key={opt.value}
                              className={`p-1.5 rounded text-xs transition-colors ${
                                isChecked
                                  ? "bg-blue-50/80 dark:bg-blue-950/50 text-blue-900 dark:text-blue-200 font-semibold"
                                  : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                              }`}
                            >
                              <label className="flex items-start gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handleToggleDrawerBusinessType(opt.value)}
                                  className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                                />
                                <div className="min-w-0 flex-1">
                                  <span className="block leading-tight">{opt.labelKr}</span>
                                  <span className="text-[10px] text-zinc-400 font-normal leading-tight block">
                                    {opt.labelEn}
                                  </span>
                                </div>
                              </label>
                              {isChecked && ev && (
                                <div className="mt-1 pl-5">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setDrawerExpandedEvidenceType(isExpanded ? null : opt.value);
                                    }}
                                    className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded border transition-colors cursor-pointer ${
                                      ev.status === "VERIFIED"
                                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
                                        : ev.status === "DEFAULT_UNVERIFIED"
                                        ? "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-800"
                                        : "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-300 dark:border-blue-800"
                                    }`}
                                  >
                                    {ev.status === "VERIFIED"
                                      ? "✓ 근거 확인"
                                      : ev.status === "DEFAULT_UNVERIFIED"
                                      ? "⚠️ 미확인 기본값"
                                      : "✏️ 관리자 수정"}
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Expandable Drawer Evidence Details Card */}
                      {drawerExpandedEvidenceType && (() => {
                        const ev = drawerBusinessTypeEvidence.find((e) => e.type === drawerExpandedEvidenceType);
                        const opt = COMPANY_TYPE_OPTIONS.find((o) => o.value === drawerExpandedEvidenceType);
                        if (!ev || !opt) return null;
                        return (
                          <div className="p-3 rounded-lg bg-zinc-100 dark:bg-zinc-850 border border-zinc-300 dark:border-zinc-700 text-xs space-y-2 mt-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-zinc-900 dark:text-zinc-100">
                                  {opt.labelKr} 증빙 근거
                                </span>
                                <span
                                  className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                                    ev.status === "VERIFIED"
                                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                      : ev.status === "DEFAULT_UNVERIFIED"
                                      ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                                      : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                                  }`}
                                >
                                  {ev.status || "VERIFIED"}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => setDrawerExpandedEvidenceType(null)}
                                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xs font-bold"
                              >
                                ✕
                              </button>
                            </div>
                            <div className="space-y-1 text-zinc-700 dark:text-zinc-300">
                              <p className="bg-white dark:bg-zinc-900 p-2 rounded border border-zinc-200 dark:border-zinc-700 font-mono text-[11px] leading-relaxed">
                                &quot;{ev.text}&quot;
                              </p>
                              <div className="flex flex-wrap items-center gap-3 text-[10px] text-zinc-500 pt-1">
                                <span>인식 방식: {ev.sourceMethod || "INTERCHARM_DESCRIPTION"}</span>
                                {ev.sourceUrl && (
                                  <a
                                    href={ev.sourceUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 dark:text-blue-400 underline"
                                  >
                                    출처 링크 ↗
                                  </a>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })()}

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

                    {/* Primary Product Category Selector for Drawer (Multi-Select, ADM-BSRC-011) */}
                    <div className="col-span-2 space-y-2 pt-2 border-t border-zinc-200 dark:border-zinc-700">
                      <div className="flex items-center justify-between">
                        <label className="block text-zinc-600 dark:text-zinc-400 font-semibold text-[11px]">
                          Primary Product Category (주력 상품 분야)
                        </label>
                        <span className="text-[10px] text-zinc-400">복수 선택 가능</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
                        {PRIMARY_PRODUCT_CATEGORY_OPTIONS.map((opt) => {
                          const currentPrimary = (selectedCandidateDetail.primary_product_categories || []) as PrimaryProductCategory[];
                          const isChecked = currentPrimary.includes(opt.value);
                          return (
                            <label
                              key={opt.value}
                              className={`p-1.5 rounded text-xs transition-colors flex items-start gap-2 cursor-pointer ${
                                isChecked
                                  ? "bg-emerald-50/80 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-200 font-semibold"
                                  : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleToggleDrawerPrimaryCategory(opt.value)}
                                className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                              />
                              <div className="min-w-0 flex-1">
                                <span className="block leading-tight">{opt.labelKr}</span>
                                <span className="text-[10px] text-zinc-400 font-normal leading-tight block">
                                  {opt.labelEn}
                                </span>
                              </div>
                            </label>
                          );
                        })}
                      </div>
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
