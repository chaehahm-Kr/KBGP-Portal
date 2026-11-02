"use client";

import React, { useState, useEffect, useMemo, useTransition, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  MarketingCampaign,
  MarketingTemplatePackage,
  DryRunReport,
  ImageTemplateSection,
  TemplateType,
} from "@/lib/brand-marketing/campaign-types";
import {
  listMarketingTemplatesAction,
  uploadMarketingTemplateAction,
  uploadTemplatePackageFileAction,
  duplicateMarketingTemplateAction,
  archiveMarketingTemplateAction,
  restoreMarketingTemplateAction,
  deleteMarketingTemplateAction,
  getMarketingFooterSettingsAction,
  validateCampaignPreApprovalAction,
  listMarketingCampaignsAction,
  getMarketingCampaignByIdAction,
  saveMarketingCampaignAction,
  runCampaignDryRunAction,
  sendTestCampaignEmailAction,
  sendTestCampaignEmailsAction,
  getMarketingTestAllowlistAction,
  addMarketingTestAllowlistEmailAction,
  removeMarketingTestAllowlistEmailAction,
  SendTestCampaignEmailsResult,
  approveMarketingCampaignAction,
  deleteMarketingTemplatesBulkAction,
  deleteMarketingCampaignAction,
  archiveMarketingCampaignAction,
  scheduleMarketingCampaignAction,
  cancelCampaignScheduleAction,
  executeCampaignDeliveryAction,
} from "@/lib/brand-marketing/campaign-actions";
import {
  parseAndValidateTestRecipients,
  MAX_TEST_RECIPIENTS_PER_BATCH,
} from "@/lib/brand-marketing/test-allowlist-shared";
import {
  assembleEmailWithMarketingFooter,
  DEFAULT_MARKETING_FOOTER,
  MarketingFooterSettings,
} from "@/lib/brand-marketing/marketing-footer";
import { personalizeEmail } from "@/lib/brand-marketing/personalization-engine";
import { ImageTemplateComposer } from "./image-template-composer";
import { DesignerGuideModal } from "./designer-guide-modal";
import { MarketingFooterSettingsView } from "./marketing-footer-settings-view";
import { SuppressionListView } from "./suppression-list-view";
import { validateSendReadyHtml, SendReadyHtmlValidationResult } from "@/lib/brand-marketing/personalization-engine";
import { TemplatePickerTable } from "./template-picker-table";
import { stageLargeFiles } from "@/lib/files/stage-form-files";
import {
  listSourcingCandidatesAction,
  getSourcingCandidatesByIdsAction,
} from "@/lib/brand-sourcing/actions";
import {
  COMPANY_TYPE_OPTIONS,
  PRIMARY_PRODUCT_CATEGORY_OPTIONS,
} from "@/lib/brand-sourcing/types";

interface EmailCampaignsViewProps {
  candidates?: any[];
  initialSubTab?: "campaigns" | "library" | "footer" | "suppression";
}

export function EmailCampaignsView({
  candidates = [],
  initialSubTab = "campaigns",
}: EmailCampaignsViewProps) {
  const searchParams = useSearchParams();
  const viewParam = searchParams?.get("view") || searchParams?.get("subtab");

  // Top-level Navigation Tabs
  const [mainTab, setMainTab] = useState<"campaigns" | "library" | "footer" | "suppression">(initialSubTab as any);

  // Campaign View Mode & Step
  const [viewMode, setViewMode] = useState<"list" | "editor">("list");

  // Sync sub-tabs with URL searchParams (handles browser Back/Forward & direct links)
  useEffect(() => {
    if (viewParam === "footer") {
      setMainTab("footer");
    } else if (viewParam === "templates" || viewParam === "library") {
      setMainTab("library");
    } else if (viewParam === "suppression") {
      setMainTab("suppression");
    } else if (viewParam === "list" || viewParam === "campaigns") {
      setMainTab("campaigns");
      setViewMode("list");
    }
  }, [viewParam]);
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [, startTransition] = useTransition();

  // Campaign List State
  const [campaigns, setCampaigns] = useState<MarketingCampaign[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [campaignSortDir, setCampaignSortDir] = useState<"desc" | "asc">("desc");
  const [deletingCampaign, setDeletingCampaign] = useState<MarketingCampaign | null>(null);
  const [isDeletingCampaign, setIsDeletingCampaign] = useState(false);
  const [campaignDeleteError, setCampaignDeleteError] = useState<string | null>(null);

  // Active Campaign in Editor & Unsaved Changes Guard (Task ADM-EMAIL-UX-001 - P0)
  const [editingCampaign, setEditingCampaign] = useState<MarketingCampaign | null>(null);
  const initialFormSnapshotRef = useRef<string>("");
  const pendingNavigationRef = useRef<{
    type: "url" | "action" | "back";
    url?: string;
    action?: () => void;
  } | null>(null);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [isSavingAndLeaving, setIsSavingAndLeaving] = useState(false);
  const [saveAndLeaveError, setSaveAndLeaveError] = useState<string | null>(null);

  // Central Marketing Footer State
  const [footerSettings, setFooterSettings] = useState<MarketingFooterSettings>({ ...DEFAULT_MARKETING_FOOTER });

  // Template Library State
  const [templates, setTemplates] = useState<MarketingTemplatePackage[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [previewViewport, setPreviewViewport] = useState<"desktop" | "mobile">("desktop");

  // Template Library Filters
  const [templateSearch, setTemplateSearch] = useState("");
  const [templateFormatFilter, setTemplateFormatFilter] = useState<"ALL" | "HTML" | "IMAGE">("ALL");
  const [templateLangFilter, setTemplateLangFilter] = useState<"ALL" | "ko" | "en">("ALL");
  const [templateStatusFilter, setTemplateStatusFilter] = useState<"ALL" | "ACTIVE" | "ARCHIVED">("ALL");
  const [templateSortBy, setTemplateSortBy] = useState<"recent" | "name">("recent");

  // Modals State
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [previewModalTemplate, setPreviewModalTemplate] = useState<MarketingTemplatePackage | null>(null);
  const [duplicateModalTemplate, setDuplicateModalTemplate] = useState<MarketingTemplatePackage | null>(null);
  const [duplicateNewName, setDuplicateNewName] = useState("");
  const [deleteConfirmTemplate, setDeleteConfirmTemplate] = useState<MarketingTemplatePackage | null>(null);

  // Template Upload Modal Form State
  const [uploadName, setUploadName] = useState("");
  const [uploadTemplateType, setUploadTemplateType] = useState<TemplateType>("HTML");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadHtmlText, setUploadHtmlText] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadWarnings, setUploadWarnings] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Image Composer Slices
  const [uploadImageSections, setUploadImageSections] = useState<ImageTemplateSection[]>([
    {
      id: "slice-1",
      imageUrl: "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=800&auto=format&fit=crop&q=80",
      altText: "K SELECT NETWORK — 브랜드 미국 진출 파트너십 제안",
      linkUrl: "https://www.kselectnetwork.com",
      hasCtaButton: false,
      ctaButtonLabel: "파트너십 안내서 확인 →",
      ctaButtonUrl: "https://www.kselectnetwork.com",
      ctaButtonAlign: "center",
    },
    {
      id: "slice-2",
      imageUrl: "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=800&auto=format&fit=crop&q=80",
      altText: "K SELECT NETWORK 바이어 큐레이션 프로그램 안내",
      linkUrl: "https://www.kselectnetwork.com/distribution",
      hasCtaButton: true,
      ctaButtonLabel: "북미 유통 프로그램 신청하기 →",
      ctaButtonUrl: "https://www.kselectnetwork.com/distribution",
      ctaButtonAlign: "center",
    },
  ]);

  // Recipient Selection & Discovery State (ADM-BSRC-009-R5 / R6)
  const [candidatePage, setCandidatePage] = useState<number>(1);
  const [candidatePageSize, setCandidatePageSize] = useState<number | "ALL">(20);
  const [candidateSortBy, setCandidateSortBy] = useState<
    "company_name" | "brand_name" | "grade" | "category" | "email" | "consent" | null
  >(null);
  const [candidateSortOrder, setCandidateSortOrder] = useState<"asc" | "desc" | null>(null);
  const [candidateSearch, setCandidateSearch] = useState<string>("");
  const [candidateSearchInput, setCandidateSearchInput] = useState<string>("");
  const [candidateFilterGrade, setCandidateFilterGrade] = useState<string>("ALL");
  const [candidateFilterStatus, setCandidateFilterStatus] = useState<string>("ALL");
  const [candidateFilterBusinessTypes, setCandidateFilterBusinessTypes] = useState<string[]>([]);
  const [candidateFilterBusinessTypeMatchMode, setCandidateFilterBusinessTypeMatchMode] = useState<"ANY" | "ALL">("ANY");
  const [candidateFilterPrimaryCategories, setCandidateFilterPrimaryCategories] = useState<string[]>([]);
  const [candidateFilterConsent, setCandidateFilterConsent] = useState<string>("ALL");
  const [candidatesList, setCandidatesList] = useState<any[]>(candidates);
  const [totalMatchingCandidates, setTotalMatchingCandidates] = useState<number>(0);
  const [isLoadingCandidates, setIsLoadingCandidates] = useState<boolean>(false);

  // Persistent Selected Company Cache (stores full company objects so metadata persists across page/filter switches)
  const [selectedCompaniesCache, setSelectedCompaniesCache] = useState<Map<string, any>>(() => {
    const initialMap = new Map<string, any>();
    candidates.forEach((comp) => initialMap.set(comp.id, comp));
    return initialMap;
  });

  // Recipient Selection State
  const [selectedGrades, setSelectedGrades] = useState<string[]>([]);
  const [selectedCompanyTypes, setSelectedCompanyTypes] = useState<string[]>([]);
  const [requireConsentedOnly, setRequireConsentedOnly] = useState(false);
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([]);
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [expandedContactCompanyIds, setExpandedContactCompanyIds] = useState<string[]>([]);

  // Manual Email Recipients State
  const [manualEmails, setManualEmails] = useState<string[]>([]);
  const [manualEmailInput, setManualEmailInput] = useState<string>("");
  const [manualEmailFeedback, setManualEmailFeedback] = useState<{
    accepted: string[];
    rejected: Array<{ email: string; reason: string }>;
  } | null>(null);

  // Manage Selection Modal State
  // Auto-height & Full Preview States (ADM-EMAIL-TPL-005)
  const [step2IframeHeight, setStep2IframeHeight] = useState<number>(1400);
  const [step4IframeHeight, setStep4IframeHeight] = useState<number>(1400);
  const [tplModalIframeHeight, setTplModalIframeHeight] = useState<number>(1400);
  const [fullPreviewHeight, setFullPreviewHeight] = useState<number>(1400);
  const [showFullPreviewModal, setShowFullPreviewModal] = useState<boolean>(false);
  const [step4Viewport, setStep4Viewport] = useState<"desktop" | "mobile">("desktop");
  const [tplModalViewport, setTplModalViewport] = useState<"desktop" | "mobile">("desktop");

  const setupDynamicIframeHeight = (
    e: React.SyntheticEvent<HTMLIFrameElement>,
    setter: (h: number) => void
  ) => {
    try {
      const iframe = e.currentTarget;
      const win = iframe.contentWindow;
      const doc = iframe.contentDocument;
      if (!doc || !win) return;

      // Ensure iframe document body and root never display internal scrollbars
      doc.documentElement.style.overflow = "hidden";
      doc.body.style.overflow = "hidden";

      const measure = () => {
        try {
          const h = Math.max(
            doc.body?.scrollHeight || 0,
            doc.documentElement?.scrollHeight || 0,
            doc.body?.offsetHeight || 0,
            doc.documentElement?.offsetHeight || 0
          );
          if (h > 150) {
            setter(h);
          }
        } catch {}
      };

      measure();

      // Listen to all image load events inside the iframe
      const images = Array.from(doc.images);
      images.forEach((img) => {
        if (!img.complete) {
          img.addEventListener("load", measure, { once: true });
          img.addEventListener("error", measure, { once: true });
        }
      });

      // Observe DOM resizing inside the iframe document
      const ResizeObs = (win as any).ResizeObserver || (typeof window !== "undefined" ? (window as any).ResizeObserver : null);
      if (ResizeObs && doc.body) {
        const ro = new ResizeObs(() => measure());
        ro.observe(doc.body);
      }

      // Schedule polling for late font / stylesheet layout settlement
      const timers = [100, 300, 600, 1200, 2500].map((t) => setTimeout(measure, t));

      iframe.addEventListener(
        "unload",
        () => {
          timers.forEach(clearTimeout);
        },
        { once: true }
      );
    } catch {
      // sandbox fallback
    }
  };

  const [showManageSelectionModal, setShowManageSelectionModal] = useState<boolean>(false);
  const [manageSelectionSearch, setManageSelectionSearch] = useState<string>("");
  // Manage Selection Modal Sorting State (ADM-BSRC-009-R8)
  const [manageSelectionSortBy, setManageSelectionSortBy] = useState<"type" | "company" | "email" | "consent" | "eligibility" | null>(null);
  const [manageSelectionSortOrder, setManageSelectionSortOrder] = useState<"asc" | "desc" | null>(null);

  // Dry Run & Test Send State
  const [dryRunReport, setDryRunReport] = useState<DryRunReport | null>(null);
  const [isRunningDryRun, setIsRunningDryRun] = useState(false);
  const [testEmailAddress, setTestEmailAddress] = useState("qa-admin-test@letusto.com, chae@letusto.com");
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testSendResult, setTestSendResult] = useState<{ success?: boolean; message?: string } | null>(null);
  const [testBatchResult, setTestBatchResult] = useState<SendTestCampaignEmailsResult | null>(null);
  const [ownerAllowlist, setOwnerAllowlist] = useState<string[]>([]);
  const [newAllowlistEmail, setNewAllowlistEmail] = useState("");
  const [isUpdatingAllowlist, setIsUpdatingAllowlist] = useState(false);
  const [showAllowlistManager, setShowAllowlistManager] = useState(false);

  // Real-time parsed test recipients
  const parsedTestRecipients = useMemo(() => {
    return parseAndValidateTestRecipients(testEmailAddress, MAX_TEST_RECIPIENTS_PER_BATCH);
  }, [testEmailAddress]);

  // Pre-Approval Checks State
  const [preApprovalChecks, setPreApprovalChecks] = useState<Array<{ name: string; status: "PASS" | "FAIL"; detail: string }>>([]);
  const [isValidatingApproval, setIsValidatingApproval] = useState(false);

  // Audit Logs State
  const [campaignLogs, setCampaignLogs] = useState<any[]>([]);

  // Delivery Management & Scheduling State (ADM-EMAIL-APP-002)
  const [showSendNowModal, setShowSendNowModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleInputValue, setScheduleInputValue] = useState("");
  const [isScheduling, setIsScheduling] = useState(false);
  const [isDispatching, setIsDispatching] = useState(false);
  const [deliveryResult, setDeliveryResult] = useState<any>(null);

  // Notification Toast
  const [notification, setNotification] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const showNotification = (type: "success" | "error", text: string) => {
    setNotification({ type, text });
    setTimeout(() => setNotification(null), 5000);
  };

  // --------------------------------------------------------------------------
  // INITIAL DATA LOADING
  // --------------------------------------------------------------------------
  const refreshCampaignsAndTemplates = async () => {
    setIsLoadingList(true);
    try {
      const [cRes, tRes, fRes] = await Promise.all([
        listMarketingCampaignsAction(),
        listMarketingTemplatesAction({ status: "ALL" }),
        getMarketingFooterSettingsAction(),
      ]);
      if (cRes.success && cRes.campaigns) {
        setCampaigns(cRes.campaigns);
      }
      if (tRes.success && tRes.templates) {
        setTemplates(tRes.templates);
        if (tRes.templates.length > 0 && !selectedTemplateId) {
          const defaultTpl = tRes.templates.find((t) => t.isDefault) || tRes.templates[0];
          setSelectedTemplateId(defaultTpl.id);
        }
      }
      if (fRes.success && fRes.settings) {
        setFooterSettings(fRes.settings);
      }
    } catch (err: any) {
      console.warn("Failed to load initial campaign data:", err);
    } finally {
      setIsLoadingList(false);
    }
  };

  useEffect(() => {
    refreshCampaignsAndTemplates();
  }, []);

  // Filtered Templates based on search & filter bar
  const filteredTemplates = useMemo(() => {
    return templates
      .filter((t) => {
        if (templateFormatFilter !== "ALL" && t.templateType !== templateFormatFilter) {
          return false;
        }
        if (templateLangFilter !== "ALL" && t.language !== templateLangFilter) {
          return false;
        }
        if (templateStatusFilter === "ACTIVE" && t.status === "ARCHIVED") {
          return false;
        }
        if (templateStatusFilter === "ARCHIVED" && t.status !== "ARCHIVED") {
          return false;
        }
        if (templateSearch.trim()) {
          const q = templateSearch.toLowerCase().trim();
          const matchName = t.name.toLowerCase().includes(q);
          const matchSubject = t.subject?.toLowerCase().includes(q);
          if (!matchName && !matchSubject) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (templateSortBy === "name") {
          return a.name.localeCompare(b.name);
        }
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      });
  }, [templates, templateFormatFilter, templateLangFilter, templateStatusFilter, templateSearch, templateSortBy]);

  // Active Template object
  const activeTemplate = useMemo(() => {
    return templates.find((t) => t.id === selectedTemplateId) || templates[0] || null;
  }, [templates, selectedTemplateId]);

  // Current effective subject
  const currentEffectiveSubject = useMemo(() => {
    if (!editingCampaign) return activeTemplate?.subject || "";
    return editingCampaign.subjectOverride !== undefined && editingCampaign.subjectOverride !== null
      ? editingCampaign.subjectOverride
      : activeTemplate?.subject || "";
  }, [editingCampaign, activeTemplate]);

  // Sample resolved subject preview
  const sampleResolvedSubject = useMemo(() => {
    if (!currentEffectiveSubject) return "";
    return currentEffectiveSubject
      .replace(/\{\{company_name\}\}/g, "(주)아모레퍼시픽")
      .replace(/\{\{contact_name\}\}/g, "김대표")
      .replace(/\{\{brand_name\}\}/g, "라네즈")
      .replace(/\{\{custom_message\}\}/g, "맞춤 제안 안내");
  }, [currentEffectiveSubject]);

  // Assembled Send-Ready HTML Preview (includes authoritative campaign settings and central footer)
  const assembledPreviewHtml = useMemo(() => {
    if (!activeTemplate?.htmlContent) return "";

    const raw = activeTemplate.htmlContent;
    const personalized = personalizeEmail(
      currentEffectiveSubject || activeTemplate.subject,
      raw,
      "",
      {
        companyName: "(주)아모레퍼시픽",
        contactName: "김대표",
        brandName: "라네즈",
        customMessage: editingCampaign?.customMessage || "귀사의 북미 진출을 위한 맞춤 제안입니다.",
        language: editingCampaign?.language || "ko",
      }
    );

    return assembleEmailWithMarketingFooter(personalized.html, {
      footerSettings,
      language: editingCampaign?.language || "ko",
      unsubscribeUrl: "https://admin.kselectnetwork.com/unsubscribe?token=sample-preview-token",
      previewText: editingCampaign?.previewText || "",
      landingPageUrl: editingCampaign?.landingPageUrl || "https://www.kselectnetwork.com",
      footerStyle: editingCampaign?.footerStyle || "classic",
    });
  }, [activeTemplate, currentEffectiveSubject, editingCampaign, footerSettings]);

  // Send-Ready Preflight Validation (ADM-EMAIL-TPL-005)
  const preflightValidationResult: SendReadyHtmlValidationResult = useMemo(() => {
    if (!assembledPreviewHtml) {
      return { isValid: true, blockingCount: 0, warningCount: 0, issues: [] };
    }
    return validateSendReadyHtml(assembledPreviewHtml, sampleResolvedSubject);
  }, [assembledPreviewHtml, sampleResolvedSubject]);

  // --------------------------------------------------------------------------
  // TASK ADM-EMAIL-UX-001: CAMPAIGN LIST SORTING & SAFE DELETION
  // --------------------------------------------------------------------------
  const filteredAndSortedCampaigns = useMemo(() => {
    const list = campaigns.filter((c) => {
      if (filterStatus !== "ALL" && c.status !== filterStatus) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = c.name?.toLowerCase().includes(q);
        const matchPurpose = c.purpose?.toLowerCase().includes(q);
        const matchSubject = c.subjectOverride?.toLowerCase().includes(q);
        if (!matchName && !matchPurpose && !matchSubject) return false;
      }
      return true;
    });

    list.sort((a, b) => {
      const aTime = new Date(a.createdAt || 0).getTime();
      const bTime = new Date(b.createdAt || 0).getTime();
      if (aTime !== bTime) {
        return campaignSortDir === "desc" ? bTime - aTime : aTime - bTime;
      }
      // Deterministic tie-breaker for identical timestamps
      return (b.id || "").localeCompare(a.id || "");
    });

    return list;
  }, [campaigns, filterStatus, searchQuery, campaignSortDir]);

  const isProtectedCampaign = (c: MarketingCampaign) => {
    const protectedStatuses = ["APPROVED", "SCHEDULED", "SENDING", "COMPLETED"];
    return protectedStatuses.includes(c.status) || c.approvalStatus === "APPROVED";
  };

  const handleConfirmDeleteCampaign = async () => {
    if (!deletingCampaign) return;
    setIsDeletingCampaign(true);
    setCampaignDeleteError(null);

    const res = await deleteMarketingCampaignAction(deletingCampaign.id);
    setIsDeletingCampaign(false);

    if (res.success) {
      showNotification("success", `Campaign "${deletingCampaign.name}" has been deleted.`);
      setDeletingCampaign(null);
      refreshCampaignsAndTemplates();
    } else {
      setCampaignDeleteError(res.error || "Failed to delete campaign.");
    }
  };

  const handleArchiveCampaign = async (c: MarketingCampaign) => {
    if (confirm(`캠페인 "${c.name}"은 승인/발송 이력이 있어 영구 삭제할 수 없습니다. 보관(Archive) 처리하시겠습니까?`)) {
      const res = await archiveMarketingCampaignAction(c.id);
      if (res.success) {
        showNotification("success", `캠페인 "${c.name}"이(가) 보관되었습니다.`);
        refreshCampaignsAndTemplates();
      } else {
        showNotification("error", res.error || "캠페인 보관에 실패했습니다.");
      }
    }
  };

  // --------------------------------------------------------------------------
  // TASK ADM-EMAIL-UX-001: UNSAVED CHANGES NAVIGATION GUARD (P0)
  // --------------------------------------------------------------------------
  const getCampaignFormSnapshot = (
    c: MarketingCampaign | null,
    tplId?: string,
    compIds?: string[],
    contactIds?: string[],
    manuals?: string[]
  ) => {
    if (!c) return "";
    return JSON.stringify({
      name: c.name || "",
      purpose: c.purpose || "",
      description: c.description || "",
      language: c.language || "ko",
      templateId: tplId || c.templateId || "",
      templateVersion: c.templateVersion || "",
      subjectOverride: c.subjectOverride || "",
      previewText: c.previewText || "",
      landingPageUrl: c.landingPageUrl || "",
      footerStyle: c.footerStyle || "classic",
      customMessage: c.customMessage || "",
      companyIds: compIds !== undefined ? compIds : (c.filterCriteria?.companyIds || []),
      contactIds: contactIds !== undefined ? contactIds : (c.filterCriteria?.contactIds || []),
      manualEmails: manuals !== undefined ? manuals : (c.filterCriteria?.manualEmails || []),
    });
  };

  const isDirty = useMemo(() => {
    if (viewMode !== "editor" || !editingCampaign) return false;
    const currentSnapshot = getCampaignFormSnapshot(
      editingCampaign,
      selectedTemplateId,
      selectedCompanyIds,
      selectedContactIds,
      manualEmails
    );
    return Boolean(initialFormSnapshotRef.current && currentSnapshot !== initialFormSnapshotRef.current);
  }, [viewMode, editingCampaign, selectedTemplateId, selectedCompanyIds, selectedContactIds, manualEmails]);

  const handleNavigateStep = async (targetStep: number) => {
    if (editingCampaign && isDirty) {
      await handleSaveCampaignDraft();
    }
    setCurrentStep(targetStep);
  };

  const executeNavigation = (nav: {
    type: "url" | "action" | "back";
    url?: string;
    action?: () => void;
  }) => {
    if (nav.type === "action" && nav.action) {
      nav.action();
    } else if (nav.type === "url" && nav.url) {
      window.location.href = nav.url;
    } else if (nav.type === "back") {
      window.history.back();
    }
  };

  const handleRequestNavigation = (nav: {
    type: "url" | "action" | "back";
    url?: string;
    action?: () => void;
  }) => {
    if (isDirty) {
      pendingNavigationRef.current = nav;
      setShowUnsavedModal(true);
    } else {
      executeNavigation(nav);
    }
  };

  const handleSaveAndLeave = async () => {
    if (!editingCampaign) return;
    setIsSavingAndLeaving(true);
    setSaveAndLeaveError(null);

    try {
      const payload: Partial<MarketingCampaign> & { name: string } = {
        ...editingCampaign,
        templateId: selectedTemplateId || editingCampaign.templateId,
        subjectOverride: currentEffectiveSubject,
        previewText: editingCampaign.previewText || "",
        landingPageUrl: editingCampaign.landingPageUrl || "https://www.kselectnetwork.com",
        footerStyle: editingCampaign.footerStyle || "classic",
        filterCriteria: {
          grades: candidateFilterGrade !== "ALL" ? [candidateFilterGrade as any] : [],
          companyTypes: candidateFilterBusinessTypes,
          companyTypeMatchMode: candidateFilterBusinessTypeMatchMode,
          primaryCategories: candidateFilterPrimaryCategories,
          status: candidateFilterStatus,
          marketingConsentStatus: candidateFilterConsent,
          searchQuery: candidateSearch,
          requireConsentedOnly,
          companyIds: selectedCompanyIds,
          contactIds: selectedContactIds,
          manualEmails: manualEmails,
        },
      };

      const res = await saveMarketingCampaignAction(payload);
      if (res.success && res.campaign) {
        setEditingCampaign(res.campaign);
        initialFormSnapshotRef.current = getCampaignFormSnapshot(
          res.campaign,
          res.campaign.templateId || "",
          selectedCompanyIds,
          selectedContactIds,
          manualEmails
        );
        showNotification("success", `Campaign "${res.campaign.name}" saved successfully.`);
        refreshCampaignsAndTemplates();
        setIsSavingAndLeaving(false);
        setShowUnsavedModal(false);

        if (pendingNavigationRef.current) {
          executeNavigation(pendingNavigationRef.current);
          pendingNavigationRef.current = null;
        }
      } else {
        setIsSavingAndLeaving(false);
        setSaveAndLeaveError(res.error || "Failed to save draft. Please check required fields.");
      }
    } catch (err: any) {
      setIsSavingAndLeaving(false);
      setSaveAndLeaveError(err.message || "An unexpected error occurred while saving draft.");
    }
  };

  const handleLeaveWithoutSaving = () => {
    setShowUnsavedModal(false);
    setSaveAndLeaveError(null);
    initialFormSnapshotRef.current = "";
    setEditingCampaign(null);
    setViewMode("list");
    setCurrentStep(1);

    if (pendingNavigationRef.current) {
      executeNavigation(pendingNavigationRef.current);
      pendingNavigationRef.current = null;
    }
  };

  const handleCancelLeave = () => {
    setShowUnsavedModal(false);
    setSaveAndLeaveError(null);
    pendingNavigationRef.current = null;
  };

  // Intercept normal in-tab document link clicks while preserving multi-tab opening
  useEffect(() => {
    if (!isDirty) return;

    const handleGlobalClick = (e: MouseEvent) => {
      // Multi-tab check: Ctrl, Cmd, Shift, Alt, middle-click (button 1), right-click (button 2)
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.button !== 0) {
        return; // Allow native browser behavior without warning!
      }

      const target = e.target as HTMLElement | null;
      const anchor = target?.closest("a");
      if (!anchor) return;

      if (anchor.target === "_blank") return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("javascript:")) return;

      e.preventDefault();
      e.stopPropagation();

      handleRequestNavigation({
        type: "url",
        url: href,
      });
    };

    document.addEventListener("click", handleGlobalClick, true);
    return () => {
      document.removeEventListener("click", handleGlobalClick, true);
    };
  }, [isDirty]);

  // Intercept browser back/forward buttons
  useEffect(() => {
    if (!isDirty) return;

    window.history.pushState({ inCampaignEditor: true }, "");

    const handlePopState = () => {
      if (isDirty) {
        window.history.pushState({ inCampaignEditor: true }, "");
        handleRequestNavigation({
          type: "back",
        });
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [isDirty]);

  // Native beforeunload for page refresh or tab closing
  useEffect(() => {
    if (!isDirty) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
      return "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isDirty]);

  // Server-side Candidate Query Loader (ADM-BSRC-009-R5 / R6)
  const loadCandidates = React.useCallback(
    async (overrideParams?: {
      page?: number;
      pageSize?: number | "ALL";
      search?: string;
      grade?: string;
      status?: string;
      businessTypes?: string[];
      businessTypeMatchMode?: "ANY" | "ALL";
      primaryCategories?: string[];
      marketingConsentStatus?: string;
      sortBy?: "company_name" | "brand_name" | "grade" | "category" | "email" | "consent" | null;
      sortOrder?: "asc" | "desc" | null;
    }) => {
      setIsLoadingCandidates(true);
      try {
        const page = overrideParams?.page ?? candidatePage;
        const pageSize = overrideParams?.pageSize !== undefined ? overrideParams.pageSize : candidatePageSize;
        const limit = pageSize === "ALL" ? -1 : pageSize;
        const offset = pageSize === "ALL" ? 0 : (page - 1) * pageSize;
        const sortBy = overrideParams?.sortBy !== undefined ? overrideParams.sortBy : candidateSortBy;
        const sortOrder = overrideParams?.sortOrder !== undefined ? overrideParams.sortOrder : candidateSortOrder;

        const res = await listSourcingCandidatesAction({
          search: overrideParams?.search !== undefined ? overrideParams.search : candidateSearch,
          grade: overrideParams?.grade !== undefined ? overrideParams.grade : candidateFilterGrade,
          status: overrideParams?.status !== undefined ? overrideParams.status : candidateFilterStatus,
          businessTypes: overrideParams?.businessTypes !== undefined ? overrideParams.businessTypes : candidateFilterBusinessTypes,
          businessTypeMatchMode: overrideParams?.businessTypeMatchMode !== undefined ? overrideParams.businessTypeMatchMode : candidateFilterBusinessTypeMatchMode,
          primaryCategories: overrideParams?.primaryCategories !== undefined ? overrideParams.primaryCategories : candidateFilterPrimaryCategories,
          marketingConsentStatus: overrideParams?.marketingConsentStatus !== undefined ? overrideParams.marketingConsentStatus : candidateFilterConsent,
          limit,
          offset,
          sortBy,
          sortOrder,
        });

        if (res.success && res.candidates) {
          setCandidatesList(res.candidates);
          setTotalMatchingCandidates(res.total || 0);

          // Update cache with freshly retrieved records to retain metadata across filters/pages
          setSelectedCompaniesCache((prev) => {
            const next = new Map(prev);
            res.candidates?.forEach((comp: any) => next.set(comp.id, comp));
            return next;
          });
        } else {
          showNotification("error", res.error || "Failed to query candidate companies");
        }
      } catch (err: any) {
        showNotification("error", err.message || "Error querying candidate companies");
      } finally {
        setIsLoadingCandidates(false);
      }
    },
    [
      candidatePage,
      candidatePageSize,
      candidateSearch,
      candidateFilterGrade,
      candidateFilterStatus,
      candidateFilterBusinessTypes,
      candidateFilterBusinessTypeMatchMode,
      candidateFilterPrimaryCategories,
      candidateFilterConsent,
      candidateSortBy,
      candidateSortOrder,
    ]
  );

  // Trigger candidate query when in Step 3 and any filter, pagination, or sorting changes
  useEffect(() => {
    if (viewMode === "editor" && currentStep === 3) {
      loadCandidates();
    }
  }, [
    viewMode,
    currentStep,
    candidatePage,
    candidatePageSize,
    candidateSearch,
    candidateFilterGrade,
    candidateFilterStatus,
    candidateFilterBusinessTypes,
    candidateFilterBusinessTypeMatchMode,
    candidateFilterPrimaryCategories,
    candidateFilterConsent,
    candidateSortBy,
    candidateSortOrder,
    loadCandidates,
  ]);

  // Hydration helper for reopening saved drafts with cross-filter selections
  const hydrateSelectedCompanies = async (companyIds: string[]) => {
    if (!companyIds || companyIds.length === 0) return;
    const missing = companyIds.filter((id) => !selectedCompaniesCache.has(id));
    if (missing.length === 0) return;
    try {
      const res = await getSourcingCandidatesByIdsAction(missing);
      if (res.success && res.candidates) {
        setSelectedCompaniesCache((prev) => {
          const next = new Map(prev);
          res.candidates?.forEach((c: any) => next.set(c.id, c));
          return next;
        });
      }
    } catch (e) {
      console.error("Failed to hydrate selected companies:", e);
    }
  };

  // RFC-compliant email validation helper for contact hygiene (ADM-BSRC-009-R6)
  const isValidContactEmail = (email?: string | null): boolean => {
    if (!email || typeof email !== "string") return false;
    const trimmed = email.trim();
    if (!trimmed) return false;
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return false;
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(trimmed);
  };

  // Extracts valid contacts for a company, deduplicating identical email addresses (primary preferred)
  const getValidCompanyContacts = (comp: any): any[] => {
    const contacts = comp?.sourcing_contacts || [];
    const valid: any[] = [];
    const seenEmails = new Set<string>();
    const sorted = [...contacts].sort((a: any, b: any) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0));
    for (const ct of sorted) {
      if (isValidContactEmail(ct.email)) {
        const norm = ct.email.toLowerCase().trim();
        if (!seenEmails.has(norm)) {
          seenEmails.add(norm);
          valid.push(ct);
        }
      }
    }
    return valid;
  };

  // 3-State Column Header Sort Handler (Ascending -> Descending -> Default/Unsorted)
  const handleHeaderSort = (
    field: "company_name" | "brand_name" | "grade" | "category" | "email" | "consent"
  ) => {
    let nextSortBy: typeof candidateSortBy = field;
    let nextSortOrder: typeof candidateSortOrder = "asc";

    if (candidateSortBy === field) {
      if (candidateSortOrder === "asc") {
        nextSortOrder = "desc";
      } else {
        nextSortBy = null;
        nextSortOrder = null;
      }
    }

    setCandidateSortBy(nextSortBy);
    setCandidateSortOrder(nextSortOrder);
    setCandidatePage(1);
  };

  // Company selection toggle with multi-contact default selection (ADM-BSRC-009-R6)
  const handleToggleCompany = (comp: any) => {
    const contacts = comp.sourcing_contacts || [];
    const validContacts = getValidCompanyContacts(comp);
    const validContactIds: string[] = validContacts.map((ct) => ct.id);
    const allCompContactIds: string[] = contacts.map((ct: any) => ct.id).filter(Boolean);
    const selectedValidCompContacts = validContactIds.filter((id) => selectedContactIds.includes(id));
    const isCompanySelected = selectedCompanyIds.includes(comp.id);

    if (isCompanySelected || selectedValidCompContacts.length > 0) {
      // Uncheck company and all its contacts
      setSelectedCompanyIds((prev) => prev.filter((id) => id !== comp.id));
      setSelectedContactIds((prev) => prev.filter((id) => !allCompContactIds.includes(id)));
    } else {
      if (validContactIds.length === 0) return; // Do not select companies without valid contacts (ADM-BSRC-009-R8)
      // Select company and ALL valid deduplicated contact emails
      setSelectedCompanyIds((prev) => [...prev, comp.id]);
      setSelectedContactIds((prev) => Array.from(new Set([...prev, ...validContactIds])));
      setSelectedCompaniesCache((prev) => new Map(prev).set(comp.id, comp));
    }
  };

  // Individual contact selection toggle (preserves manual unchecks across pagination/sorting)
  const handleToggleContact = (comp: any, contactId: string) => {
    const isSelected = selectedContactIds.includes(contactId);
    const updated = isSelected
      ? selectedContactIds.filter((id) => id !== contactId)
      : [...selectedContactIds, contactId];
    setSelectedContactIds(updated);

    const validContacts = getValidCompanyContacts(comp);
    const validContactIds: string[] = validContacts.map((ct) => ct.id);
    const hasAnyValid = validContactIds.some((id) => updated.includes(id));

    if (hasAnyValid && !selectedCompanyIds.includes(comp.id)) {
      setSelectedCompanyIds((prev) => [...prev, comp.id]);
      setSelectedCompaniesCache((prev) => new Map(prev).set(comp.id, comp));
    } else if (!hasAnyValid && selectedCompanyIds.includes(comp.id)) {
      setSelectedCompanyIds((prev) => prev.filter((id) => id !== comp.id));
    }
  };

  // Header Select All for CURRENT VISIBLE PAGE only (Never across entire database)
  const pageCompanyIds = useMemo(() => candidatesList.map((c) => c.id), [candidatesList]);
  const pageSelectableCompanyIds = useMemo(
    () => candidatesList.filter((c) => getValidCompanyContacts(c).length > 0).map((c) => c.id),
    [candidatesList]
  );
  const isAllPageSelected = pageSelectableCompanyIds.length > 0 && pageSelectableCompanyIds.every((id) => selectedCompanyIds.includes(id));
  const isSomePageSelected = pageSelectableCompanyIds.some((id) => selectedCompanyIds.includes(id)) && !isAllPageSelected;

  const handleToggleSelectAllPage = () => {
    if (isAllPageSelected) {
      setSelectedCompanyIds((prev) => prev.filter((id) => !pageCompanyIds.includes(id)));
      const pageContactIds: string[] = [];
      candidatesList.forEach((c) => {
        (c.sourcing_contacts || []).forEach((ct: any) => {
          if (ct.id) pageContactIds.push(ct.id);
        });
      });
      setSelectedContactIds((prev) => prev.filter((id) => !pageContactIds.includes(id)));
    } else {
      setSelectedCompanyIds((prev) => Array.from(new Set([...prev, ...pageSelectableCompanyIds])));
      const pageValidContactIds: string[] = [];
      candidatesList.forEach((c) => {
        const valid = getValidCompanyContacts(c);
        valid.forEach((ct) => pageValidContactIds.push(ct.id));
      });
      setSelectedContactIds((prev) => Array.from(new Set([...prev, ...pageValidContactIds])));
      setSelectedCompaniesCache((prev) => {
        const next = new Map(prev);
        candidatesList.forEach((c) => next.set(c.id, c));
        return next;
      });
    }
  };

  // Manual Email Recipient Parser & Validator
  const handleAddManualEmails = () => {
    if (!manualEmailInput.trim()) return;

    const tokens = manualEmailInput.split(/[\n,;]+/);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const accepted: string[] = [];
    const rejected: Array<{ email: string; reason: string }> = [];

    // Collect all existing emails for strict deduplication
    const existingEmails = new Set<string>();
    manualEmails.forEach((e) => existingEmails.add(e.toLowerCase().trim()));
    selectedCompaniesCache.forEach((comp) => {
      (comp.sourcing_contacts || []).forEach((ct: any) => {
        if (selectedContactIds.includes(ct.id) && ct.email) {
          existingEmails.add(ct.email.toLowerCase().trim());
        }
      });
    });

    for (const raw of tokens) {
      const trimmed = raw.trim();
      if (!trimmed) continue;
      const lower = trimmed.toLowerCase();

      if (!emailRegex.test(lower)) {
        rejected.push({ email: trimmed, reason: "유효하지 않은 이메일 형식 (Invalid syntax)" });
        continue;
      }
      if (existingEmails.has(lower) || accepted.includes(lower)) {
        rejected.push({ email: trimmed, reason: "이미 선택되었거나 중복된 이메일 (Duplicate)" });
        continue;
      }
      accepted.push(lower);
      existingEmails.add(lower);
    }

    if (accepted.length > 0) {
      setManualEmails((prev) => [...prev, ...accepted]);
      setManualEmailInput("");
    }
    setManualEmailFeedback({ accepted, rejected });
  };

  const handleRemoveManualEmail = (email: string) => {
    setManualEmails((prev) => prev.filter((e) => e !== email));
  };

  // Selected Company Contact Emails (Unique & Hygiene Guarded)
  const selectedCompanyEmails = useMemo(() => {
    const emails = new Set<string>();
    selectedCompaniesCache.forEach((comp) => {
      if (selectedCompanyIds.includes(comp.id)) {
        (comp.sourcing_contacts || []).forEach((ct: any) => {
          if (selectedContactIds.includes(ct.id) && isValidContactEmail(ct.email)) {
            emails.add(ct.email.toLowerCase().trim());
          }
        });
      }
    });
    return Array.from(emails);
  }, [selectedCompaniesCache, selectedCompanyIds, selectedContactIds]);

  // Total Unique Recipient Emails (Company contacts + Manual emails)
  const totalUniqueRecipients = useMemo(() => {
    const all = new Set<string>([...selectedCompanyEmails, ...manualEmails.map((e) => e.toLowerCase().trim())]);
    return Array.from(all);
  }, [selectedCompanyEmails, manualEmails]);

  // Authoritative Selected Recipient Model (ADM-BSRC-009-R8)
  // Perfectly reconciled with totalUniqueRecipients, powering Modal and Campaign Resolution
  interface SelectedRecipientItem {
    id: string;
    type: "COMPANY_CONTACT" | "MANUAL";
    email: string;
    companyId?: string;
    companyNameKr: string;
    companyNameEn?: string;
    brandName?: string;
    contactId?: string;
    contactName?: string;
    consentStatus: string;
    isSendable: boolean;
    exclusionReason?: string;
    associatedCompanyIds: string[];
    associatedContactIds: string[];
    sharedCompanyCount: number;
    sharingCompanyNames: string[];
  }

  const selectedRecipientItems = useMemo<SelectedRecipientItem[]>(() => {
    const emailToItemMap = new Map<string, SelectedRecipientItem>();

    // 1. Process selected company contacts
    selectedCompaniesCache.forEach((comp) => {
      if (selectedCompanyIds.includes(comp.id)) {
        const isConsented = comp.marketing_consent_status === "CONSENTED";
        (comp.sourcing_contacts || []).forEach((ct: any) => {
          if (selectedContactIds.includes(ct.id) && isValidContactEmail(ct.email)) {
            const normEmail = ct.email.toLowerCase().trim();
            const isSendable = requireConsentedOnly ? isConsented : true;
            const exclusionReason = !isSendable ? "마케팅 동의 미확인 (Strict Consent 필터 적용됨)" : undefined;

            if (emailToItemMap.has(normEmail)) {
              const existing = emailToItemMap.get(normEmail)!;
              if (!existing.associatedCompanyIds.includes(comp.id)) {
                existing.associatedCompanyIds.push(comp.id);
                existing.sharedCompanyCount = existing.associatedCompanyIds.length;
                if (!existing.sharingCompanyNames.includes(comp.company_name_kr)) {
                  existing.sharingCompanyNames.push(comp.company_name_kr);
                }
              }
              if (!existing.associatedContactIds.includes(ct.id)) {
                existing.associatedContactIds.push(ct.id);
              }
              if (isConsented && !existing.isSendable) {
                existing.isSendable = true;
                existing.exclusionReason = undefined;
                existing.consentStatus = "CONSENTED";
              }
            } else {
              emailToItemMap.set(normEmail, {
                id: `rec-comp-${comp.id}-${ct.id}`,
                type: "COMPANY_CONTACT",
                email: normEmail,
                companyId: comp.id,
                companyNameKr: comp.company_name_kr,
                companyNameEn: comp.company_name_en,
                brandName: comp.sourcing_brands?.[0]?.brand_name_kr || comp.company_name_kr,
                contactId: ct.id,
                contactName: ct.name,
                consentStatus: comp.marketing_consent_status || "UNCONFIRMED",
                isSendable,
                exclusionReason,
                associatedCompanyIds: [comp.id],
                associatedContactIds: [ct.id],
                sharedCompanyCount: 1,
                sharingCompanyNames: [comp.company_name_kr],
              });
            }
          }
        });
      }
    });

    // 2. Process manual emails
    manualEmails.forEach((rawEmail) => {
      const normEmail = rawEmail.toLowerCase().trim();
      if (!normEmail) return;
      if (!emailToItemMap.has(normEmail)) {
        const isSendable = !requireConsentedOnly;
        emailToItemMap.set(normEmail, {
          id: `rec-manual-${normEmail}`,
          type: "MANUAL",
          email: normEmail,
          companyNameKr: "수기 입력 수신자",
          companyNameEn: "Manual Entry Recipient",
          brandName: "Direct Outreach",
          contactName: "직접 입력",
          consentStatus: "미확인 (수기 입력)",
          isSendable,
          exclusionReason: !isSendable ? "수기 입력 이메일은 마케팅 동의 미확인으로 발송 제외됩니다" : undefined,
          associatedCompanyIds: [],
          associatedContactIds: [],
          sharedCompanyCount: 1,
          sharingCompanyNames: [],
        });
      }
    });

    return Array.from(emailToItemMap.values());
  }, [selectedCompaniesCache, selectedCompanyIds, selectedContactIds, manualEmails, requireConsentedOnly]);

  // Handle individual recipient removal inside modal (ADM-BSRC-009-R8)
  const handleRemoveRecipientItem = (item: SelectedRecipientItem) => {
    if (item.type === "MANUAL") {
      setManualEmails((prev) => prev.filter((e) => e.toLowerCase().trim() !== item.email));
    } else {
      const toRemoveContactIds = new Set(item.associatedContactIds);
      const remainingContactIds = selectedContactIds.filter((id) => !toRemoveContactIds.has(id));
      setSelectedContactIds(remainingContactIds);

      // Check associated companies: if a company has no remaining selected valid contacts, uncheck it
      setSelectedCompanyIds((prev) => {
        return prev.filter((cId) => {
          if (!item.associatedCompanyIds.includes(cId)) return true;
          const comp = selectedCompaniesCache.get(cId);
          if (!comp) return true;
          const validContacts = getValidCompanyContacts(comp);
          const hasRemaining = validContacts.some(
            (ct) => !toRemoveContactIds.has(ct.id) && remainingContactIds.includes(ct.id)
          );
          return hasRemaining;
        });
      });
    }
  };

  // 3-state Sorting for Manage Selection Modal (ADM-BSRC-009-R8)
  const handleToggleManageSelectionSort = (column: "type" | "company" | "email" | "consent" | "eligibility") => {
    if (manageSelectionSortBy !== column) {
      setManageSelectionSortBy(column);
      setManageSelectionSortOrder("asc");
    } else if (manageSelectionSortOrder === "asc") {
      setManageSelectionSortOrder("desc");
    } else {
      setManageSelectionSortBy(null);
      setManageSelectionSortOrder(null);
    }
  };

  const sortedManageSelectionItems = useMemo(() => {
    if (!manageSelectionSortBy || !manageSelectionSortOrder) {
      // Deterministic default order: Company name asc (Korean collation), then email asc
      return [...selectedRecipientItems].sort((a, b) => {
        const compCmp = (a.companyNameKr || "").localeCompare(b.companyNameKr || "", "ko");
        if (compCmp !== 0) return compCmp;
        return a.email.localeCompare(b.email);
      });
    }
    const factor = manageSelectionSortOrder === "asc" ? 1 : -1;
    return [...selectedRecipientItems].sort((a, b) => {
      switch (manageSelectionSortBy) {
        case "type":
          return a.type.localeCompare(b.type) * factor;
        case "company":
          return (a.companyNameKr || "").localeCompare(b.companyNameKr || "", "ko") * factor;
        case "email":
          return a.email.localeCompare(b.email) * factor;
        case "consent":
          return (a.consentStatus || "").localeCompare(b.consentStatus || "", "ko") * factor;
        case "eligibility": {
          const aVal = a.isSendable ? 1 : 0;
          const bVal = b.isSendable ? 1 : 0;
          return (aVal - bVal) * factor;
        }
        default:
          return 0;
      }
    });
  }, [selectedRecipientItems, manageSelectionSortBy, manageSelectionSortOrder]);

  const filteredManageSelectionItems = useMemo(() => {
    const q = manageSelectionSearch.trim().toLowerCase();
    if (!q) return sortedManageSelectionItems;
    return sortedManageSelectionItems.filter(
      (item) =>
        item.email.includes(q) ||
        item.companyNameKr.toLowerCase().includes(q) ||
        (item.companyNameEn && item.companyNameEn.toLowerCase().includes(q)) ||
        (item.brandName && item.brandName.toLowerCase().includes(q)) ||
        (item.contactName && item.contactName.toLowerCase().includes(q))
    );
  }, [sortedManageSelectionItems, manageSelectionSearch]);

  // Estimated Consent / Send Eligibility Breakdown (Reconciled from Authoritative Model)
  const consentEligibilityEstimate = useMemo(() => {
    let eligible = 0;
    let excluded = 0;
    selectedRecipientItems.forEach((item) => {
      if (item.isSendable) eligible++;
      else excluded++;
    });
    return { eligible, excluded };
  }, [selectedRecipientItems]);

  const handleClearAllSelections = () => {
    if (typeof window !== "undefined" && window.confirm("선택된 모든 기업, 연락처 및 수기 이메일을 해제하시겠습니까?")) {
      setSelectedCompanyIds([]);
      setSelectedContactIds([]);
      setManualEmails([]);
      setManualEmailFeedback(null);
    }
  };

  // Pre-approval checklist loader
  useEffect(() => {
    if (viewMode === "editor" && currentStep === 6 && editingCampaign?.id) {
      setIsValidatingApproval(true);
      validateCampaignPreApprovalAction(editingCampaign.id)
        .then((res) => setPreApprovalChecks(res.checks || []))
        .catch(() => {})
        .finally(() => setIsValidatingApproval(false));
    }
  }, [viewMode, currentStep, editingCampaign?.id]);

  // --------------------------------------------------------------------------
  // ACTIONS: CAMPAIGN CRUD
  // --------------------------------------------------------------------------
  const handleCreateNewCampaign = () => {
    if (isDirty) {
      handleRequestNavigation({
        type: "action",
        action: () => handleCreateNewCampaign(),
      });
      return;
    }

    const defaultTpl = templates.find((t) => t.isDefault) || templates[0];
    const newCamp: MarketingCampaign = {
      id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : "",
      name: "New Brand Outreach Campaign",
      purpose: "Brand Outreach",
      description: "",
      language: "ko",
      templateId: defaultTpl?.id || null,
      templateVersion: defaultTpl?.version || "1.0.0",
      subjectOverride: defaultTpl?.subject || "",
      previewText: "",
      landingPageUrl: "https://www.kselectnetwork.com",
      status: "DRAFT",
      approvalStatus: "PENDING",
      isLiveModeEnabled: false,
      footerStyle: "classic",
      filterCriteria: {},
      customMessage: "귀사의 우수한 뷰티 라인업에 깊은 인상을 받아 파트너십을 제안드립니다.",
      stats: {
        totalRecipients: 0,
        sendableCount: 0,
        excludedCount: 0,
        testSendsCount: 0,
        sentCount: 0,
        deliveredCount: 0,
        failedCount: 0,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setEditingCampaign(newCamp);
    if (defaultTpl) setSelectedTemplateId(defaultTpl.id);
    setSelectedCompanyIds([]);
    setSelectedContactIds([]);
    setManualEmails([]);
    setManualEmailFeedback(null);
    setCurrentStep(1);
    setDryRunReport(null);
    setTestSendResult(null);
    setViewMode("editor");
    initialFormSnapshotRef.current = getCampaignFormSnapshot(newCamp, defaultTpl?.id || "", [], [], []);
  };

  const handleEditCampaign = async (c: MarketingCampaign) => {
    if (isDirty && editingCampaign?.id !== c.id) {
      handleRequestNavigation({
        type: "action",
        action: () => handleEditCampaign(c),
      });
      return;
    }

    setEditingCampaign({ ...c, footerStyle: c.footerStyle || "classic" });
    if (c.templateId) setSelectedTemplateId(c.templateId);
    initialFormSnapshotRef.current = getCampaignFormSnapshot(
      c,
      c.templateId || "",
      c.filterCriteria?.companyIds || [],
      c.filterCriteria?.contactIds || [],
      c.filterCriteria?.manualEmails || []
    );
    if (c.filterCriteria?.grades && c.filterCriteria.grades.length > 0) {
      setSelectedGrades(c.filterCriteria.grades);
      setCandidateFilterGrade(c.filterCriteria.grades[0]);
    }
    if (c.filterCriteria?.companyTypes) {
      setSelectedCompanyTypes(c.filterCriteria.companyTypes);
      setCandidateFilterBusinessTypes(c.filterCriteria.companyTypes);
    }
    if (c.filterCriteria?.companyTypeMatchMode) {
      setCandidateFilterBusinessTypeMatchMode(c.filterCriteria.companyTypeMatchMode);
    }
    if (c.filterCriteria?.primaryCategories) {
      setCandidateFilterPrimaryCategories(c.filterCriteria.primaryCategories);
    }
    if (c.filterCriteria?.searchQuery) {
      setCandidateSearch(c.filterCriteria.searchQuery);
      setCandidateSearchInput(c.filterCriteria.searchQuery);
    }
    if (c.filterCriteria?.status) {
      setCandidateFilterStatus(c.filterCriteria.status);
    }
    if (c.filterCriteria?.marketingConsentStatus) {
      setCandidateFilterConsent(c.filterCriteria.marketingConsentStatus);
    }
    setRequireConsentedOnly(Boolean(c.filterCriteria?.requireConsentedOnly));
    if (c.filterCriteria?.companyIds) {
      setSelectedCompanyIds(c.filterCriteria.companyIds);
      hydrateSelectedCompanies(c.filterCriteria.companyIds);
    }
    if (c.filterCriteria?.contactIds) {
      setSelectedContactIds(c.filterCriteria.contactIds);
    }
    if (c.filterCriteria?.manualEmails) {
      setManualEmails(c.filterCriteria.manualEmails);
    }

    try {
      const detailRes = await getMarketingCampaignByIdAction(c.id);
      if (detailRes.logs) setCampaignLogs(detailRes.logs);
    } catch {}

    setCurrentStep(1);
    setViewMode("editor");
  };

  const handleSaveCampaignDraft = async () => {
    if (!editingCampaign) return;
    try {
      const payload: Partial<MarketingCampaign> & { name: string } = {
        ...editingCampaign,
        templateId: selectedTemplateId || editingCampaign.templateId,
        subjectOverride: currentEffectiveSubject,
        previewText: editingCampaign.previewText || "",
        landingPageUrl: editingCampaign.landingPageUrl || "https://www.kselectnetwork.com",
        footerStyle: editingCampaign.footerStyle || "classic",
        filterCriteria: {
          grades: candidateFilterGrade !== "ALL" ? [candidateFilterGrade as any] : [],
          companyTypes: candidateFilterBusinessTypes,
          companyTypeMatchMode: candidateFilterBusinessTypeMatchMode,
          primaryCategories: candidateFilterPrimaryCategories,
          status: candidateFilterStatus,
          marketingConsentStatus: candidateFilterConsent,
          searchQuery: candidateSearch,
          requireConsentedOnly,
          companyIds: selectedCompanyIds,
          contactIds: selectedContactIds,
          manualEmails: manualEmails,
        },
      };

      const res = await saveMarketingCampaignAction(payload);
      if (res.success && res.campaign) {
        setEditingCampaign(res.campaign);
        initialFormSnapshotRef.current = getCampaignFormSnapshot(
          res.campaign,
          res.campaign.templateId || "",
          selectedCompanyIds,
          selectedContactIds,
          manualEmails
        );
        showNotification("success", `Campaign "${res.campaign.name}" saved to database successfully.`);
        refreshCampaignsAndTemplates();
      } else {
        showNotification("error", res.error || "Failed to save campaign");
      }
    } catch (err: any) {
      showNotification("error", err.message);
    }
  };

  // --------------------------------------------------------------------------
  // ACTIONS: TEMPLATE MANAGEMENT (Duplicate, Archive, Restore, Delete)
  // --------------------------------------------------------------------------
  const handleOpenDuplicateModal = (tpl: MarketingTemplatePackage, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setDuplicateModalTemplate(tpl);
    setDuplicateNewName(`${tpl.name} (Copy)`);
  };

  const handleExecuteDuplicate = async () => {
    if (!duplicateModalTemplate || !duplicateNewName.trim()) return;
    try {
      const res = await duplicateMarketingTemplateAction(duplicateModalTemplate.id, duplicateNewName.trim());
      if (res.success && res.template) {
        showNotification("success", `Template duplicated: "${res.template.name}"`);
        setDuplicateModalTemplate(null);
        refreshCampaignsAndTemplates();
      } else {
        showNotification("error", res.error || "Failed to duplicate template");
      }
    } catch (err: any) {
      showNotification("error", err.message);
    }
  };

  const handleToggleArchiveTemplate = async (tpl: MarketingTemplatePackage, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const isArchived = tpl.status === "ARCHIVED";
    try {
      const action = isArchived ? restoreMarketingTemplateAction : archiveMarketingTemplateAction;
      const res = await action(tpl.id);
      if (res.success) {
        showNotification("success", isArchived ? `Template restored: "${tpl.name}"` : `Template archived: "${tpl.name}"`);
        refreshCampaignsAndTemplates();
      } else {
        showNotification("error", res.error || "Action failed");
      }
    } catch (err: any) {
      showNotification("error", err.message);
    }
  };

  const handleDeleteTemplate = async (tpl: MarketingTemplatePackage, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setDeleteConfirmTemplate(tpl);
  };

  const handleExecuteDelete = async () => {
    if (!deleteConfirmTemplate) return;
    try {
      const res = await deleteMarketingTemplateAction(deleteConfirmTemplate.id);
      if (res.success) {
        showNotification("success", `Template "${deleteConfirmTemplate.name}" deleted successfully.`);
        setDeleteConfirmTemplate(null);
        refreshCampaignsAndTemplates();
      } else {
        showNotification("error", res.error || "Failed to delete template");
      }
    } catch (err: any) {
      showNotification("error", err.message);
    }
  };

  const handleBulkDeleteTemplates = async (templateIds: string[]) => {
    const res = await deleteMarketingTemplatesBulkAction(templateIds);
    if (res.deletedCount > 0) {
      showNotification("success", `${res.deletedCount}개 템플릿이 삭제되었습니다.`);
    }
    if (res.blockedCount > 0) {
      showNotification(
        "error",
        `${res.blockedCount}개 템플릿은 기존 캠페인에서 참조 중이어서 삭제가 차단되었습니다.`
      );
    }
    refreshCampaignsAndTemplates();
    return res;
  };

  // --------------------------------------------------------------------------
  // ACTIONS: TEMPLATE UPLOAD (HTML / ZIP)
  // --------------------------------------------------------------------------
  const handleOpenUploadModal = () => {
    setUploadName("");
    setUploadFile(null);
    setUploadHtmlText("");
    setUploadError(null);
    setUploadWarnings([]);
    setShowUploadModal(true);
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError(null);
    setUploadWarnings([]);

    if (!uploadName.trim()) {
      setUploadError("Template Name is required.");
      return;
    }

    setIsUploading(true);

    try {
      if (uploadTemplateType === "IMAGE") {
        if (!uploadImageSections || uploadImageSections.length === 0) {
          setUploadError("At least one image slice section is required for an Image Template.");
          setIsUploading(false);
          return;
        }

        const res = await uploadMarketingTemplateAction({
          name: uploadName.trim(),
          templateType: "IMAGE",
          subject: uploadName.trim(),
          language: "ko",
          imageSections: uploadImageSections,
        });

        if (res.success && res.template) {
          setTemplates((prev) => [res.template!, ...prev]);
          setSelectedTemplateId(res.template.id);
          setShowUploadModal(false);
          showNotification("success", "IMAGE Template package saved successfully!");
        } else {
          setUploadError(res.error || "Failed to compile image package");
        }
      } else {
        const formData = new FormData();
        formData.set("name", uploadName.trim());
        formData.set("templateType", "HTML");
        formData.set("language", "ko");
        formData.set("subject", uploadName.trim());

        if (uploadFile) {
          formData.set("file", uploadFile);
        } else if (uploadHtmlText.trim()) {
          formData.set("rawHtml", uploadHtmlText.trim());
        } else {
          setUploadError("Please select an HTML or ZIP file, or paste raw HTML code.");
          setIsUploading(false);
          return;
        }

        // Stage large files (> 3.5MB) directly to Supabase storage to bypass Vercel 4.5MB Serverless Function payload limit
        const stagedFormData = await stageLargeFiles(formData);
        const res = await uploadTemplatePackageFileAction(stagedFormData);

        if (res.success && res.template) {
          setTemplates((prev) => [res.template!, ...prev]);
          setSelectedTemplateId(res.template.id);
          setShowUploadModal(false);
          const assetCount = res.importResult?.extractedAssets.length || 0;
          showNotification(
            "success",
            `Template package imported successfully! (${assetCount} image assets hosted safely)`
          );
          if (res.warnings && res.warnings.length > 0) {
            setUploadWarnings(res.warnings);
          }
        } else {
          setUploadError(res.error || "Failed to import package");
          if (res.warnings) setUploadWarnings(res.warnings);
        }
      }
    } catch (err: any) {
      setUploadError(err.message);
    } finally {
      setIsUploading(false);
    }
  };

  // --------------------------------------------------------------------------
  // ACTIONS: DRY RUN & TEST SEND
  // --------------------------------------------------------------------------
  const handleExecuteDryRun = async () => {
    if (!editingCampaign) return;
    setIsRunningDryRun(true);
    setDryRunReport(null);

    try {
      const res = await runCampaignDryRunAction(editingCampaign.id, {
        grades: candidateFilterGrade !== "ALL" ? [candidateFilterGrade as any] : [],
        companyTypes: candidateFilterBusinessTypes,
        companyTypeMatchMode: candidateFilterBusinessTypeMatchMode,
        primaryCategories: candidateFilterPrimaryCategories,
        status: candidateFilterStatus,
        marketingConsentStatus: candidateFilterConsent,
        searchQuery: candidateSearch,
        requireConsentedOnly,
        companyIds: selectedCompanyIds,
        contactIds: selectedContactIds,
        manualEmails: manualEmails,
      });

      if (res.success && res.report) {
        setDryRunReport(res.report);
        showNotification("success", "Dry Run simulation finished. Zero external emails sent.");
      } else {
        showNotification("error", res.error || "Dry Run failed");
      }
    } catch (err: any) {
      showNotification("error", err.message);
    } finally {
      setIsRunningDryRun(false);
    }
  };

  // Load allowlist on mount
  useEffect(() => {
    getMarketingTestAllowlistAction().then((res) => {
      if (res.success && res.allowlist) {
        setOwnerAllowlist(res.allowlist);
      }
    });
  }, []);

  const handleAddAllowlistEmail = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newAllowlistEmail.trim() || isUpdatingAllowlist) return;
    setIsUpdatingAllowlist(true);
    try {
      const res = await addMarketingTestAllowlistEmailAction(newAllowlistEmail);
      if (res.success) {
        setOwnerAllowlist(res.allowlist);
        setNewAllowlistEmail("");
        showNotification("success", `외부 테스트 이메일(${newAllowlistEmail})이 허용 목록에 추가되었습니다.`);
      } else {
        showNotification("error", res.error || "추가 실패");
      }
    } catch (err: any) {
      showNotification("error", err.message);
    } finally {
      setIsUpdatingAllowlist(false);
    }
  };

  const handleRemoveAllowlistEmail = async (email: string) => {
    if (isUpdatingAllowlist) return;
    setIsUpdatingAllowlist(true);
    try {
      const res = await removeMarketingTestAllowlistEmailAction(email);
      if (res.success) {
        setOwnerAllowlist(res.allowlist);
        showNotification("success", `이메일(${email})이 허용 목록에서 삭제되었습니다.`);
      } else {
        showNotification("error", res.error || "삭제 실패");
      }
    } catch (err: any) {
      showNotification("error", err.message);
    } finally {
      setIsUpdatingAllowlist(false);
    }
  };

  const handleSendTestEmail = async () => {
    if (!editingCampaign || !activeTemplate) return;
    setIsSendingTest(true);
    setTestSendResult(null);
    setTestBatchResult(null);

    try {
      const batchRes = await sendTestCampaignEmailsAction(
        editingCampaign.id,
        testEmailAddress,
        currentEffectiveSubject || activeTemplate.subject,
        activeTemplate.htmlContent,
        activeTemplate.plainText
      );

      setTestBatchResult(batchRes);

      if (batchRes.success) {
        setTestSendResult({
          success: true,
          message: `${batchRes.totalSent}명의 수신자에게 테스트 이메일이 발송되었습니다 (실패/거부: ${batchRes.totalFailed}명).`,
        });
        showNotification("success", `테스트 이메일 ${batchRes.totalSent}건 발송 완료.`);
      } else {
        setTestSendResult({
          success: false,
          message: batchRes.error || "테스트 발송이 거부되거나 실패했습니다.",
        });
        showNotification("error", batchRes.error || "테스트 발송이 거부되거나 차단되었습니다.");
      }
    } catch (err: any) {
      setTestSendResult({ success: false, message: err.message });
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleApproveCampaign = async () => {
    if (!editingCampaign) return;
    try {
      const res = await approveMarketingCampaignAction(editingCampaign.id);
      if (res.success && res.campaign) {
        setEditingCampaign(res.campaign);
        showNotification("success", "Campaign approved and immutable release snapshot locked!");
        refreshCampaignsAndTemplates();
      } else {
        showNotification("error", res.error || "Approval failed");
      }
    } catch (err: any) {
      showNotification("error", err.message);
    }
  };

  // --------------------------------------------------------------------------
    // --------------------------------------------------------------------------
  // DELIVERY MANAGEMENT & SCHEDULING HANDLERS (Task ID: ADM-EMAIL-APP-002)
  // --------------------------------------------------------------------------
  const handleScheduleCampaign = async () => {
    if (!editingCampaign?.id || !scheduleInputValue) return;
    setIsScheduling(true);
    try {
      const targetIso = new Date(scheduleInputValue).toISOString();
      const res = await scheduleMarketingCampaignAction(editingCampaign.id, targetIso);
      if (res.success && res.campaign) {
        setEditingCampaign(res.campaign);
        showNotification(
          "success",
          `캠페인이 ${new Date(targetIso).toLocaleString()} (KST: ${new Date(targetIso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })})로 예약되었습니다.`
        );
        setShowScheduleModal(false);
        refreshCampaignsAndTemplates();
      } else {
        showNotification("error", res.error || "예약 설정 실패");
      }
    } catch (err: any) {
      showNotification("error", err.message || "예약 설정 중 오류가 발생했습니다.");
    } finally {
      setIsScheduling(false);
    }
  };

  const handleCancelSchedule = async () => {
    if (!editingCampaign?.id) return;
    if (typeof window !== "undefined" && !window.confirm("캠페인 예약 발송을 취소하고 승인(APPROVED) 상태로 되돌리시겠습니까?")) {
      return;
    }
    setIsScheduling(true);
    try {
      const res = await cancelCampaignScheduleAction(editingCampaign.id);
      if (res.success && res.campaign) {
        setEditingCampaign(res.campaign);
        showNotification("success", "캠페인 예약이 취소되었습니다.");
        refreshCampaignsAndTemplates();
      } else {
        showNotification("error", res.error || "예약 취소 실패");
      }
    } catch (err: any) {
      showNotification("error", err.message || "예약 취소 중 오류가 발생했습니다.");
    } finally {
      setIsScheduling(false);
    }
  };

  const handleExecuteSendNow = async () => {
    if (!editingCampaign?.id) return;
    setIsDispatching(true);
    setDeliveryResult(null);
    try {
      const res = await executeCampaignDeliveryAction(editingCampaign.id, { mode: "SIMULATE" });
      if (res.success && res.result) {
        setDeliveryResult(res.result);
        showNotification("success", res.result.message || "캠페인 안전 발송 시뮬레이션이 완료되었습니다.");
        const updated = await getMarketingCampaignByIdAction(editingCampaign.id);
        if (updated.success && updated.campaign) {
          setEditingCampaign(updated.campaign);
          if (updated.logs) setCampaignLogs(updated.logs);
        }
        refreshCampaignsAndTemplates();
      } else {
        showNotification("error", res.error || "발송 실행 실패");
      }
    } catch (err: any) {
      showNotification("error", err.message || "발송 실행 중 오류가 발생했습니다.");
    } finally {
      setIsDispatching(false);
    }
  };

  // RENDER: TOP-LEVEL SUB-TAB BAR
  // --------------------------------------------------------------------------
  const renderSubTabBar = () => {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800 pb-2">
        <div className="flex items-center gap-1">
          <Link
            href="/admin/brand-marketing?tab=campaigns&view=list"
            onClick={() => {
              setMainTab("campaigns");
              setViewMode("list");
            }}
            className={`px-3 py-1.5 text-xs font-bold rounded-md transition cursor-pointer ${
              mainTab === "campaigns"
                ? "bg-zinc-950 text-white dark:bg-zinc-100 dark:text-zinc-950"
                : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            }`}
          >
            Campaigns (캠페인 목록)
          </Link>
          <Link
            href="/admin/brand-marketing?tab=campaigns&view=templates"
            onClick={() => setMainTab("library")}
            className={`px-3 py-1.5 text-xs font-bold rounded-md transition cursor-pointer ${
              mainTab === "library"
                ? "bg-zinc-950 text-white dark:bg-zinc-100 dark:text-zinc-950"
                : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            }`}
          >
            Template Library (템플릿 관리)
          </Link>
          <Link
            href="/admin/brand-marketing?tab=campaigns&view=footer"
            onClick={() => setMainTab("footer")}
            className={`px-3 py-1.5 text-xs font-bold rounded-md transition cursor-pointer flex items-center gap-1.5 ${
              mainTab === "footer"
                ? "bg-zinc-950 text-white dark:bg-zinc-100 dark:text-zinc-950"
                : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            }`}
          >
            <span>⚖️</span>
            Marketing Footer Settings (중앙 푸터 설정)
          </Link>
          <Link
            href="/admin/brand-marketing?tab=campaigns&view=suppression"
            onClick={() => setMainTab("suppression")}
            className={`px-3 py-1.5 text-xs font-bold rounded-md transition cursor-pointer flex items-center gap-1.5 ${
              mainTab === "suppression"
                ? "bg-zinc-950 text-white dark:bg-zinc-100 dark:text-zinc-950"
                : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            }`}
          >
            <span>🚫</span>
            Suppression List (수신 거부 목록)
          </Link>
        </div>

        {mainTab === "campaigns" && viewMode === "list" && (
          <button
            type="button"
            onClick={handleCreateNewCampaign}
            className="px-3.5 py-1.5 rounded-md text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white cursor-pointer shadow-xs"
          >
            + Create Campaign
          </button>
        )}

        {mainTab === "library" && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowGuideModal(true)}
              className="px-3 py-1.5 rounded-md text-xs font-semibold border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 cursor-pointer"
            >
              📖 Designer Guide &amp; AI Prompt
            </button>
            <button
              type="button"
              onClick={handleOpenUploadModal}
              className="px-3.5 py-1.5 rounded-md text-xs font-bold bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 hover:bg-zinc-800 cursor-pointer shadow-xs"
            >
              + Upload HTML / ZIP Package
            </button>
          </div>
        )}
      </div>
    );
  };

  // --------------------------------------------------------------------------
  // RENDER: CAMPAIGN LIST VIEW (Task ADM-EMAIL-UX-001)
  // --------------------------------------------------------------------------
  const renderCampaignList = () => {
    return (
      <div className="space-y-4">
        {/* Filter Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-zinc-50 dark:bg-zinc-900/40 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800">
          <input
            type="text"
            placeholder="Search campaigns..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-3 py-1.5 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 max-w-sm"
          />
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-zinc-500 dark:text-zinc-400">Sort:</span>
              <select
                value={campaignSortDir}
                onChange={(e) => setCampaignSortDir(e.target.value as "desc" | "asc")}
                className="px-2 py-1.5 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 cursor-pointer"
              >
                <option value="desc">Newest First (최신순)</option>
                <option value="asc">Oldest First (과거순)</option>
              </select>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-zinc-500 dark:text-zinc-400">Status:</span>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-2 py-1.5 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 cursor-pointer"
              >
                <option value="ALL">All Statuses</option>
                <option value="DRAFT">DRAFT</option>
                <option value="TESTING">TESTING</option>
                <option value="READY_FOR_APPROVAL">READY_FOR_APPROVAL</option>
                <option value="APPROVED">APPROVED</option>
              </select>
            </div>
          </div>
        </div>

        {/* Campaign Table */}
        <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-x-auto bg-white dark:bg-zinc-900 shadow-xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 dark:bg-zinc-800/60 text-zinc-600 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800">
              <tr>
                <th className="p-3">Campaign Name &amp; Purpose</th>
                <th className="p-3">Email Subject Override</th>
                <th className="p-3">Status</th>
                <th className="p-3">Approval</th>
                <th className="p-3">Recipients</th>
                <th className="p-3">Sent</th>
                <th className="p-3">Delivered</th>
                <th
                  onClick={() => setCampaignSortDir((prev) => (prev === "desc" ? "asc" : "desc"))}
                  className="p-3 cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-100 select-none whitespace-nowrap"
                  title="Click to toggle Newest / Oldest first"
                >
                  Created {campaignSortDir === "desc" ? "▼" : "▲"}
                </th>
                <th className="p-3 min-w-[170px] w-44 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {filteredAndSortedCampaigns.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-zinc-500">
                    No marketing campaigns found. Click &quot;+ Create Campaign&quot; to begin.
                  </td>
                </tr>
              ) : (
                filteredAndSortedCampaigns.map((c) => {
                  const protectedCamp = isProtectedCampaign(c);

                  return (
                    <tr key={c.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                      <td className="p-3">
                        <div className="font-bold text-zinc-900 dark:text-zinc-100">{c.name}</div>
                        <div className="text-[11px] text-zinc-400">{c.purpose}</div>
                      </td>
                      <td className="p-3 text-zinc-700 dark:text-zinc-300 max-w-xs truncate">
                        {c.subjectOverride || <span className="text-zinc-400 italic">Template Default</span>}
                      </td>
                      <td className="p-3">
                        <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200">
                          {c.status}
                        </span>
                      </td>
                      <td className="p-3">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            c.approvalStatus === "APPROVED"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                          }`}
                        >
                          {c.approvalStatus}
                        </span>
                      </td>
                      <td className="p-3 font-mono">{c.stats?.totalRecipients || 0}</td>
                      <td className="p-3 font-mono text-blue-600 dark:text-blue-400">{c.stats?.sentCount || 0}</td>
                      <td className="p-3 font-mono text-emerald-600 dark:text-emerald-400">{c.stats?.deliveredCount || 0}</td>
                      <td className="p-3 text-zinc-400 text-[11px] whitespace-nowrap">
                        {new Date(c.createdAt).toLocaleDateString()}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-nowrap whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleEditCampaign(c)}
                            className="px-2.5 py-1 text-xs font-semibold rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 cursor-pointer transition-colors"
                          >
                            Edit / Open →
                          </button>
                          {protectedCamp ? (
                            <button
                              type="button"
                              onClick={() => handleArchiveCampaign(c)}
                              className="px-2 py-1 text-xs font-semibold rounded border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 cursor-pointer transition-colors"
                              title="Approved or active campaigns cannot be deleted. Click to archive."
                            >
                              📦 보관
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setDeletingCampaign(c);
                                setCampaignDeleteError(null);
                              }}
                              className="px-2 py-1 text-xs font-semibold rounded border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 cursor-pointer transition-colors"
                              title="Delete draft campaign"
                            >
                              🗑️ 삭제
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // --------------------------------------------------------------------------
  // RENDER: TEMPLATE LIBRARY STANDALONE VIEW (Task ADM-EMAIL-UX-001)
  // Shared TemplatePickerTable architecture replacing card grid
  // --------------------------------------------------------------------------
  const renderTemplateLibraryStandaloneView = () => {
    return (
      <TemplatePickerTable
        mode="library"
        templates={templates}
        onPreviewTemplate={(tpl) => setPreviewModalTemplate(tpl)}
        onDuplicateTemplate={(tpl) => handleOpenDuplicateModal(tpl)}
        onDeleteTemplate={(tpl) => handleDeleteTemplate(tpl)}
        onBulkDeleteTemplates={handleBulkDeleteTemplates}
        onOpenUploadModal={handleOpenUploadModal}
        onOpenGuideModal={() => setShowGuideModal(true)}
      />
    );
  };

  // --------------------------------------------------------------------------
  // RENDER: CAMPAIGN EDITOR (Step 1 to 6)
  // --------------------------------------------------------------------------
  const renderCampaignEditor = () => {
    if (!editingCampaign) return null;

    const steps = [
      { num: 1, label: "Campaign Info & Settings" },
      { num: 2, label: "Template Package" },
      { num: 3, label: "Filter Recipients" },
      { num: 4, label: "Sample Review" },
      { num: 5, label: "Test Send & Dry Run" },
      { num: 6, label: "Approval & Activity" },
    ];

    return (
      <div className="space-y-6">
        {/* Editor Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 shadow-xs">
          <div>
            <div className="flex items-center gap-2">
              <Link
                href="/admin/brand-marketing?tab=campaigns&view=list"
                onClick={() => setViewMode("list")}
                className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 cursor-pointer"
              >
                ← Back to List
              </Link>
              <span className="text-zinc-300">/</span>
              <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                {editingCampaign.name}
              </h2>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                {editingCampaign.status}
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              {editingCampaign.approvalStatus === "APPROVED"
                ? "Locked release approval snapshot active."
                : "Draft in progress. Subject, preview text, and template modifications will trigger approval invalidation."}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSaveCampaignDraft}
              className="px-3 py-1.5 text-xs font-semibold rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 cursor-pointer shadow-xs"
            >
              Save Draft 💾
            </button>
            <Link
              href="/admin/brand-marketing?tab=campaigns&view=list"
              onClick={() => {
                setViewMode("list");
                refreshCampaignsAndTemplates();
              }}
              className="px-3 py-1.5 text-xs font-semibold rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 cursor-pointer inline-block"
            >
              Close
            </Link>
          </div>
        </div>

        {/* 6-Step Stepper Navigation */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
          {steps.map((s) => (
            <button
              key={s.num}
              type="button"
              onClick={() => handleNavigateStep(s.num)}
              className={`p-2.5 rounded-lg border text-left text-xs cursor-pointer transition-all ${
                currentStep === s.num
                  ? "border-blue-600 bg-blue-50/60 dark:bg-blue-950/40 text-blue-950 dark:text-blue-200 font-bold ring-2 ring-blue-500/20"
                  : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50"
              }`}
            >
              <div className="text-[10px] font-mono text-zinc-400">Step {s.num}</div>
              <div className="truncate">{s.label}</div>
            </button>
          ))}
        </div>

        {/* STEP 1: CAMPAIGN INFO & SETTINGS (Authoritative) */}
        {currentStep === 1 && (
          <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-5 shadow-xs space-y-4">
            <div className="border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                1. Campaign Information &amp; Authoritative Settings
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                캠페인의 발송 목적, 실제 발송될 이메일 제목, 메일함 사전보기 요약 문구(Preview Text), 랜딩 페이지 URL을 일원화하여 설정합니다.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Campaign Name *
                </label>
                <input
                  type="text"
                  value={editingCampaign.name}
                  onChange={(e) => setEditingCampaign({ ...editingCampaign, name: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-medium"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Campaign Purpose
                </label>
                <select
                  value={editingCampaign.purpose}
                  onChange={(e) => setEditingCampaign({ ...editingCampaign, purpose: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100"
                >
                  <option value="Brand Outreach">Brand Outreach (바이어 큐레이션 입점 제안)</option>
                  <option value="Catalog Announcement">Catalog Announcement (신규 바이어 카탈로그)</option>
                  <option value="Partnership Follow-up">Partnership Follow-up (파트너십 후속 미팅)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Language (언어 설정)
                </label>
                <select
                  value={editingCampaign.language}
                  onChange={(e) => setEditingCampaign({ ...editingCampaign, language: e.target.value as any })}
                  className="w-full px-3 py-2 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100"
                >
                  <option value="ko">한국어 (Korean)</option>
                  <option value="en">English (글로벌)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Scheduled Send Time (예약 발송 - 선택)
                </label>
                <input
                  type="datetime-local"
                  value={editingCampaign.scheduledAt || ""}
                  onChange={(e) => setEditingCampaign({ ...editingCampaign, scheduledAt: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100"
                />
              </div>

              {/* Authoritative Campaign Email Subject */}
              <div className="sm:col-span-2 p-3 bg-zinc-50 dark:bg-zinc-900/60 rounded-lg border border-zinc-200 dark:border-zinc-800 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-zinc-900 dark:text-zinc-100">
                    Campaign Email Subject (실제 발송 이메일 제목) <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
                    <span>변수 삽입:</span>
                    <button
                      type="button"
                      onClick={() => {
                        const cur = editingCampaign.subjectOverride ?? activeTemplate?.subject ?? "";
                        setEditingCampaign({ ...editingCampaign, subjectOverride: cur + " {{company_name}}" });
                      }}
                      className="px-1.5 py-0.5 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 rounded text-zinc-700 dark:text-zinc-300 font-mono text-[10px] cursor-pointer"
                    >
                      + {"{{company_name}}"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const cur = editingCampaign.subjectOverride ?? activeTemplate?.subject ?? "";
                        setEditingCampaign({ ...editingCampaign, subjectOverride: cur + " {{contact_name}}" });
                      }}
                      className="px-1.5 py-0.5 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 rounded text-zinc-700 dark:text-zinc-300 font-mono text-[10px] cursor-pointer"
                    >
                      + {"{{contact_name}}"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const cur = editingCampaign.subjectOverride ?? activeTemplate?.subject ?? "";
                        setEditingCampaign({ ...editingCampaign, subjectOverride: cur + " {{brand_name}}" });
                      }}
                      className="px-1.5 py-0.5 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 rounded text-zinc-700 dark:text-zinc-300 font-mono text-[10px] cursor-pointer"
                    >
                      + {"{{brand_name}}"}
                    </button>
                  </div>
                </div>
                <input
                  type="text"
                  placeholder="예: [K SELECT] {{company_name}}의 미국 뷰티 리테일 네트워크 진출을 제안드립니다"
                  value={editingCampaign.subjectOverride !== undefined && editingCampaign.subjectOverride !== null ? editingCampaign.subjectOverride : (activeTemplate?.subject || "")}
                  onChange={(e) =>
                    setEditingCampaign({ ...editingCampaign, subjectOverride: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs font-medium rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100"
                />
                <div className="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400 pt-1">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="font-semibold text-zinc-700 dark:text-zinc-300">미리보기 (샘플 적용):</span>
                    <span className="text-zinc-900 dark:text-zinc-100 truncate italic">
                      &quot;{sampleResolvedSubject}&quot;
                    </span>
                  </div>
                  {activeTemplate && editingCampaign.subjectOverride && editingCampaign.subjectOverride !== activeTemplate.subject && (
                    <button
                      type="button"
                      onClick={() => setEditingCampaign({ ...editingCampaign, subjectOverride: activeTemplate.subject })}
                      className="text-amber-600 dark:text-amber-400 hover:underline shrink-0 text-[10px] cursor-pointer"
                    >
                      ↺ 템플릿 기본 제목으로 초기화
                    </button>
                  )}
                </div>
              </div>

              {/* Authoritative Preview Text */}
              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Preview Text (메일함 한 줄 사전보기 문구)
                </label>
                <input
                  type="text"
                  placeholder="메일 목록에서 제목 옆에 노출되는 요약 문구"
                  value={editingCampaign.previewText || ""}
                  onChange={(e) => setEditingCampaign({ ...editingCampaign, previewText: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100"
                />
              </div>

              {/* Authoritative Landing Page URL */}
              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Campaign Landing Page URL (기본 CTA 목적지 링크)
                </label>
                <input
                  type="url"
                  placeholder="https://www.kselectnetwork.com"
                  value={editingCampaign.landingPageUrl || ""}
                  onChange={(e) => setEditingCampaign({ ...editingCampaign, landingPageUrl: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100"
                />
              </div>

              {/* Footer Design Style Selection (Task ADM-EMAIL-FTR-001) */}
              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Footer Design Style (푸터 디자인 스타일)
                </label>
                <select
                  value={editingCampaign.footerStyle || "classic"}
                  onChange={(e) =>
                    setEditingCampaign({
                      ...editingCampaign,
                      footerStyle: e.target.value as any,
                    })
                  }
                  className="w-full px-3 py-2 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100"
                >
                  <option value="classic">Classic (클래식 · 중앙 정렬 기본형)</option>
                  <option value="minimal">Minimal (미니멀 · 컴팩트 좌측 정렬)</option>
                  <option value="dark">Dark (다크 · 프리미엄 다크 모드)</option>
                </select>
                <p className="text-[11px] text-zinc-400 mt-1">
                  * 캠페인 이메일 하단에 결합될 마케팅 푸터의 디자인 스타일을 선택합니다. (기본값: Classic)
                </p>
              </div>

              <div className="sm:col-span-2">
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Description / Internal Notes
                </label>
                <input
                  type="text"
                  placeholder="내부 검토용 캠페인 메모 또는 타겟팅 목적"
                  value={editingCampaign.description || ""}
                  onChange={(e) => setEditingCampaign({ ...editingCampaign, description: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Global Custom Message (&#123;&#123;custom_message&#125;&#125; 변수에 삽입될 공통 본문)
                </label>
                <textarea
                  rows={3}
                  placeholder="귀사의 우수한 뷰티 라인업에 깊은 인상을 받아 파트너십을 제안드립니다."
                  value={editingCampaign.customMessage || ""}
                  onChange={(e) => setEditingCampaign({ ...editingCampaign, customMessage: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 leading-relaxed"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex justify-end">
              <button
                type="button"
                onClick={() => handleNavigateStep(2)}
                className="px-4 py-2 text-xs font-bold text-white bg-zinc-950 dark:bg-zinc-100 dark:text-zinc-950 rounded hover:bg-zinc-800 cursor-pointer"
              >
                Next: Select Template Package →
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: TEMPLATE PACKAGE SELECTION & LIBRARY */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <TemplatePickerTable
              templates={templates}
              selectedTemplateId={selectedTemplateId}
              onSelectTemplate={(tplId) => setSelectedTemplateId(tplId)}
              onPreviewTemplate={(tpl) => setPreviewModalTemplate(tpl)}
              onDuplicateTemplate={(tpl) => handleOpenDuplicateModal(tpl)}
              onDeleteTemplate={(tpl) => handleDeleteTemplate(tpl)}
              onBulkDeleteTemplates={handleBulkDeleteTemplates}
              onOpenUploadModal={handleOpenUploadModal}
              onOpenGuideModal={() => setShowGuideModal(true)}
            />

            {/* LIVE VISUAL PREVIEW HEADER WITH CAMPAIGN EMAIL SUBJECT BAR */}
            {activeTemplate && (
              <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-5 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                      Live Send-Ready Visual Preview: {activeTemplate.name}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                        activeTemplate.templateType === "IMAGE"
                          ? "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300"
                          : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                      }`}
                    >
                      {activeTemplate.templateType === "IMAGE" ? "🖼️ Image Template" : "📄 HTML Template"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="inline-flex rounded-md border border-zinc-200 dark:border-zinc-800 p-0.5 bg-zinc-50 dark:bg-zinc-950">
                      <button
                        type="button"
                        onClick={() => setPreviewViewport("desktop")}
                        className={`px-3 py-1 text-[11px] font-semibold rounded cursor-pointer ${
                          previewViewport === "desktop"
                            ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs"
                            : "text-zinc-500 hover:text-zinc-800"
                        }`}
                      >
                        Desktop (680px)
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewViewport("mobile")}
                        className={`px-3 py-1 text-[11px] font-semibold rounded cursor-pointer ${
                          previewViewport === "mobile"
                            ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs"
                            : "text-zinc-500 hover:text-zinc-800"
                        }`}
                      >
                        Mobile (375px)
                      </button>
                    </div>

                    {/* Footer Style Switcher (Task ADM-EMAIL-FTR-001) */}
                    <div className="inline-flex rounded-md border border-zinc-200 dark:border-zinc-800 p-0.5 bg-zinc-50 dark:bg-zinc-950">
                      <span className="px-2 py-0.5 text-[10px] text-zinc-400 font-medium self-center">Footer:</span>
                      {(["classic", "minimal", "dark"] as const).map((st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => setEditingCampaign({ ...editingCampaign, footerStyle: st })}
                          className={`px-2 py-0.5 text-[10px] font-bold rounded cursor-pointer capitalize ${
                            (editingCampaign.footerStyle || "classic") === st
                              ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs"
                              : "text-zinc-500 hover:text-zinc-800"
                          }`}
                        >
                          {st}
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowFullPreviewModal(true)}
                      className="px-2.5 py-1 text-[11px] font-semibold text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 hover:bg-zinc-50 flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <span>⛶</span> 전체 화면 미리보기
                    </button>
                  </div>
                </div>

                {/* Campaign Email Subject Bar */}
                <div className="p-3 bg-amber-50/50 dark:bg-amber-950/20 border-2 border-amber-500/80 rounded-lg space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                      <strong className="text-amber-950 dark:text-amber-200 font-bold">
                        Campaign Email Subject (실제 발송 제목):
                      </strong>
                    </div>
                  </div>
                  <div className="font-semibold text-zinc-900 dark:text-zinc-100 text-xs pl-4 font-mono">
                    &quot;{sampleResolvedSubject}&quot;
                  </div>
                  {editingCampaign.previewText && (
                    <div className="text-[11px] text-zinc-500 pl-4">
                      Preview Text: <span className="italic">&quot;{editingCampaign.previewText}&quot;</span>
                    </div>
                  )}
                </div>

                {/* Live Preview Container (Assembled with Central Marketing Footer) */}
                <div className="bg-zinc-100 dark:bg-zinc-950 p-4 rounded-lg flex justify-center overflow-x-auto min-h-[460px]">
                  <div
                    style={{
                      width: previewViewport === "desktop" ? "680px" : "375px",
                      minWidth: previewViewport === "desktop" ? "680px" : "375px",
                      maxWidth: "100%",
                      transition: "width 0.2s ease-in-out",
                    }}
                    className="bg-white rounded shadow-sm border border-zinc-200 overflow-hidden self-start"
                  >
                    <iframe
                      title="Send-Ready Email Preview"
                      srcDoc={assembledPreviewHtml}
                      onLoad={(e) => setupDynamicIframeHeight(e, setStep2IframeHeight)}
                      style={{ height: `${step2IframeHeight}px`, overflow: "hidden" }}
                      className="w-full border-0 block"
                      scrolling="no"
                      sandbox="allow-same-origin"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-zinc-100 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    className="px-4 py-2 text-xs font-semibold text-zinc-600 hover:text-zinc-900 cursor-pointer"
                  >
                    ← Back
                  </button>
                  <button
                    type="button"
                    onClick={() => handleNavigateStep(3)}
                    className="px-4 py-2 text-xs font-bold text-white bg-zinc-950 dark:bg-zinc-100 dark:text-zinc-950 rounded hover:bg-zinc-800 cursor-pointer"
                  >
                    Next: Recipient Selection →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 3: RECIPIENT SELECTION & DISCOVERY (ADM-BSRC-009-R5) */}
        {currentStep === 3 && (
          <div className="space-y-4">
            {/* 1. ALWAYS-VISIBLE SELECTED RECIPIENTS SUMMARY BAR */}
            <div className="bg-gradient-to-r from-indigo-50/80 via-white to-purple-50/80 dark:from-indigo-950/40 dark:via-zinc-900 dark:to-purple-950/30 border border-indigo-200/80 dark:border-indigo-800/80 rounded-lg p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 shadow-xs">
              <div className="flex flex-wrap items-center gap-2.5 text-xs">
                <div className="flex items-center gap-1.5 bg-white dark:bg-zinc-800/90 px-3 py-1.5 rounded-md border border-indigo-200 dark:border-indigo-800/60 shadow-xs">
                  <span className="text-zinc-500 dark:text-zinc-400">선택 기업:</span>
                  <strong className="font-mono text-indigo-600 dark:text-indigo-400 text-sm font-bold">
                    {selectedCompanyIds.length}개사
                  </strong>
                </div>
                <div className="flex items-center gap-1.5 bg-white dark:bg-zinc-800/90 px-3 py-1.5 rounded-md border border-indigo-200 dark:border-indigo-800/60 shadow-xs">
                  <span className="text-zinc-500 dark:text-zinc-400">기업 이메일:</span>
                  <strong className="font-mono text-indigo-600 dark:text-indigo-400 text-sm font-bold">
                    {selectedCompanyEmails.length}개
                  </strong>
                </div>
                <div className="flex items-center gap-1.5 bg-white dark:bg-zinc-800/90 px-3 py-1.5 rounded-md border border-purple-200 dark:border-purple-800/60 shadow-xs">
                  <span className="text-zinc-500 dark:text-zinc-400">수기 이메일:</span>
                  <strong className="font-mono text-purple-600 dark:text-purple-400 text-sm font-bold">
                    {manualEmails.length}개
                  </strong>
                </div>
                <div className="flex items-center gap-1.5 bg-indigo-600 text-white px-3 py-1.5 rounded-md font-semibold shadow-xs">
                  <span>총 고유 수신자:</span>
                  <span className="font-mono text-sm underline font-bold">{totalUniqueRecipients.length}명</span>
                </div>
                <div className="flex items-center gap-2 text-[11px] px-2.5 py-1.5 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                    발송 가능: {consentEligibilityEstimate.eligible}
                  </span>
                  <span className="text-zinc-300 dark:text-zinc-600">|</span>
                  <span className="text-amber-600 dark:text-amber-400 font-semibold">
                    동의 미확인: {consentEligibilityEstimate.excluded}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowManageSelectionModal(true)}
                  className="px-3.5 py-1.5 text-xs font-semibold rounded bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer flex items-center gap-1.5 shadow-xs transition-colors"
                >
                  <span>선택 목록 관리 ({totalUniqueRecipients.length})</span>
                </button>
                {totalUniqueRecipients.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearAllSelections}
                    className="px-3 py-1.5 text-xs font-medium rounded border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer transition-colors"
                  >
                    전체 해제
                  </button>
                )}
              </div>
            </div>

            {/* 2. ADVANCED SEARCH & BRAND-LIST EQUIVALENT FILTERS */}
            <div className="bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 space-y-3 shadow-xs">
              {/* Row 1: Search + Grade + Status + Consent + Search Action */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-2.5 items-center">
                {/* Multi-vector Text Search */}
                <div className="md:col-span-4 relative">
                  <input
                    type="text"
                    value={candidateSearchInput}
                    onChange={(e) => setCandidateSearchInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        setCandidateSearch(candidateSearchInput);
                        setCandidatePage(1);
                      }
                    }}
                    placeholder="회사명, 브랜드명, 이메일, 전화번호, 웹사이트, 메모 검색..."
                    className="w-full text-xs px-3 py-2 rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  />
                  {candidateSearchInput && (
                    <button
                      type="button"
                      onClick={() => {
                        setCandidateSearchInput("");
                        setCandidateSearch("");
                        setCandidatePage(1);
                      }}
                      className="absolute right-2.5 top-2 text-zinc-400 hover:text-zinc-600 text-xs cursor-pointer"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Grade Filter */}
                <div className="md:col-span-2">
                  <select
                    value={candidateFilterGrade}
                    onChange={(e) => {
                      setCandidateFilterGrade(e.target.value);
                      setCandidatePage(1);
                    }}
                    className="w-full text-xs px-2.5 py-2 rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                  >
                    <option value="ALL">등급: 전체 (All Grades)</option>
                    <option value="A">Grade A (최우선 타겟)</option>
                    <option value="B">Grade B (유망 타겟)</option>
                    <option value="C">Grade C (일반 타겟)</option>
                    <option value="UNRATED">UNRATED (미평가)</option>
                  </select>
                </div>

                {/* Workflow Status Filter */}
                <div className="md:col-span-2">
                  <select
                    value={candidateFilterStatus}
                    onChange={(e) => {
                      setCandidateFilterStatus(e.target.value);
                      setCandidatePage(1);
                    }}
                    className="w-full text-xs px-2.5 py-2 rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                  >
                    <option value="ALL">상태: 전체 (All Status)</option>
                    <option value="SAVED">SAVED (저장 완료)</option>
                    <option value="REVIEWED">REVIEWED (검토 완료)</option>
                    <option value="DRAFT">DRAFT (임시 등록)</option>
                    <option value="ARCHIVED">ARCHIVED (보관됨)</option>
                  </select>
                </div>

                {/* Consent Status Filter */}
                <div className="md:col-span-2">
                  <select
                    value={candidateFilterConsent}
                    onChange={(e) => {
                      setCandidateFilterConsent(e.target.value);
                      setCandidatePage(1);
                    }}
                    className="w-full text-xs px-2.5 py-2 rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                  >
                    <option value="ALL">마케팅 동의: 전체</option>
                    <option value="CONSENTED">CONSENTED (동의 완료)</option>
                    <option value="UNCONFIRMED">UNCONFIRMED (미확인)</option>
                    <option value="REFUSED">REFUSED (거부)</option>
                    <option value="EXCLUDED">EXCLUDED (제외)</option>
                  </select>
                </div>

                {/* Search & Reset Buttons */}
                <div className="md:col-span-2 flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setCandidateSearch(candidateSearchInput);
                      setCandidatePage(1);
                    }}
                    className="flex-1 px-3 py-2 text-xs font-semibold rounded bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 cursor-pointer transition-colors"
                  >
                    검색
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCandidateSearchInput("");
                      setCandidateSearch("");
                      setCandidateFilterGrade("ALL");
                      setCandidateFilterStatus("ALL");
                      setCandidateFilterBusinessTypes([]);
                      setCandidateFilterPrimaryCategories([]);
                      setCandidateFilterConsent("ALL");
                      setCandidatePage(1);
                    }}
                    title="필터 초기화"
                    className="px-2.5 py-2 text-xs font-medium rounded border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                  >
                    초기화
                  </button>
                </div>
              </div>

              {/* Row 2: Business Types + Primary Categories + Strict Consent Checkbox */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-zinc-200 dark:border-zinc-800 text-xs">
                <div className="flex flex-wrap items-center gap-3">
                  {/* Business Type Multi-select Chips */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-zinc-500 dark:text-zinc-400 font-medium">사업자 유형:</span>
                    {COMPANY_TYPE_OPTIONS.map((bt) => {
                      const isSelected = candidateFilterBusinessTypes.includes(bt.value);
                      return (
                        <button
                          key={bt.value}
                          type="button"
                          onClick={() => {
                            setCandidateFilterBusinessTypes((prev) =>
                              isSelected ? prev.filter((v) => v !== bt.value) : [...prev, bt.value]
                            );
                            setCandidatePage(1);
                          }}
                          className={`px-2 py-0.5 rounded text-[11px] font-medium border cursor-pointer transition-colors ${
                            isSelected
                              ? "bg-indigo-600 text-white border-indigo-600"
                              : "bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50"
                          }`}
                        >
                          {bt.labelKr}
                        </button>
                      );
                    })}
                    {candidateFilterBusinessTypes.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          setCandidateFilterBusinessTypeMatchMode((prev) => (prev === "ANY" ? "ALL" : "ANY"));
                          setCandidatePage(1);
                        }}
                        className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300"
                      >
                        매칭: {candidateFilterBusinessTypeMatchMode === "ANY" ? "OR (하나라도)" : "AND (모두)"}
                      </button>
                    )}
                  </div>

                  {/* Primary Product Categories Filter */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-zinc-500 dark:text-zinc-400 font-medium">대표 카테고리:</span>
                    {PRIMARY_PRODUCT_CATEGORY_OPTIONS.map((cat) => {
                      const isSelected = candidateFilterPrimaryCategories.includes(cat.value);
                      return (
                        <button
                          key={cat.value}
                          type="button"
                          onClick={() => {
                            setCandidateFilterPrimaryCategories((prev) =>
                              isSelected ? prev.filter((v) => v !== cat.value) : [...prev, cat.value]
                            );
                            setCandidatePage(1);
                          }}
                          className={`px-2 py-0.5 rounded text-[11px] font-medium border cursor-pointer transition-colors ${
                            isSelected
                              ? "bg-purple-600 text-white border-purple-600"
                              : "bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50"
                          }`}
                        >
                          {cat.labelKr}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Strict Consent Checkbox */}
                <label className="flex items-center gap-2 cursor-pointer bg-white dark:bg-zinc-800 px-3 py-1.5 rounded-md border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 shadow-2xs">
                  <input
                    type="checkbox"
                    checked={requireConsentedOnly}
                    onChange={(e) => setRequireConsentedOnly(e.target.checked)}
                    className="rounded border-amber-400 text-amber-600 focus:ring-amber-500 w-3.5 h-3.5"
                  />
                  <span className="font-semibold text-xs">상업성 정보 수신 동의 기업만 발송 (Strict Consent)</span>
                </label>
              </div>
            </div>

            {/* 3. MANUAL EMAIL RECIPIENT ENTRY SECTION */}
            <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    <span>수기 이메일 수신자 추가 (Add Email Recipients)</span>
                    <span className="text-[10px] font-normal px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 font-mono">
                      {manualEmails.length}개 등록됨
                    </span>
                  </h4>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                    줄바꿈(Enter), 쉼표(,), 세미콜론(;)으로 구분하여 여러 이메일을 한 번에 입력할 수 있습니다. 입력된 이메일은 기업 연락처와 분리되어 캠페인에만 단독 저장됩니다.
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <textarea
                  value={manualEmailInput}
                  onChange={(e) => setManualEmailInput(e.target.value)}
                  placeholder="buyer@nordstrom.com&#10;sourcing@sephora.com, buyer@ulta.com; contact@target.com"
                  rows={2}
                  className="flex-1 text-xs px-3 py-2 font-mono rounded border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  onClick={handleAddManualEmails}
                  disabled={!manualEmailInput.trim()}
                  className="px-4 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded cursor-pointer self-end sm:self-auto flex items-center justify-center gap-1 min-w-[130px] transition-colors"
                >
                  <span>이메일 파싱 및 추가</span>
                </button>
              </div>

              {/* Validation Feedback Banner */}
              {manualEmailFeedback && (
                <div className="text-xs p-2.5 rounded bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 space-y-1.5">
                  <div className="flex items-center gap-3">
                    {manualEmailFeedback.accepted.length > 0 && (
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                        ✓ {manualEmailFeedback.accepted.length}개 이메일 정상 추가됨
                      </span>
                    )}
                    {manualEmailFeedback.rejected.length > 0 && (
                      <span className="text-red-500 dark:text-red-400 font-semibold">
                        ✕ {manualEmailFeedback.rejected.length}개 이메일 제외됨
                      </span>
                    )}
                  </div>
                  {manualEmailFeedback.rejected.length > 0 && (
                    <div className="text-[11px] text-zinc-500 space-y-0.5 max-h-24 overflow-y-auto pl-2 border-l-2 border-red-400">
                      {manualEmailFeedback.rejected.map((rej, idx) => (
                        <div key={idx}>
                          <span className="font-mono text-zinc-700 dark:text-zinc-300 font-medium">{rej.email}</span>: {rej.reason}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Manual Email Chips */}
              {manualEmails.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {manualEmails.map((email) => (
                    <span
                      key={email}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-purple-50 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-800 text-purple-800 dark:text-purple-300 font-mono text-xs"
                    >
                      <span>{email}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveManualEmail(email)}
                        className="text-purple-400 hover:text-red-500 cursor-pointer font-bold"
                        title="제거"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* 4. SOURCING CANDIDATES TABLE WITH MULTI-CONTACT SEMANTICS */}
            <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2.5">
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    후보 기업 목록 ({totalMatchingCandidates}개사 검색됨)
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    필터링 및 페이지 이동 시에도 기존에 선택한 기업과 연락처는 유지됩니다.
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-zinc-500">현재 페이지 선택: </span>
                  <strong className="text-xs font-mono text-zinc-900 dark:text-zinc-100">
                    {pageCompanyIds.filter((id) => selectedCompanyIds.includes(id)).length} / {candidatesList.length}개사
                  </strong>
                </div>
              </div>

              {/* Table Container with Fully Opaque Sticky Header (ADM-BSRC-009-R6) */}
              <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-x-auto max-h-[460px]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-100 dark:bg-zinc-900 sticky top-0 z-20 shadow-xs border-b border-zinc-200 dark:border-zinc-800">
                    <tr>
                      <th className="p-2.5 w-10 bg-zinc-100 dark:bg-zinc-900">
                        <input
                          type="checkbox"
                          ref={(el) => {
                            if (el) el.indeterminate = isSomePageSelected;
                          }}
                          checked={isAllPageSelected}
                          onChange={handleToggleSelectAllPage}
                          title="현재 페이지 전체 선택/해제"
                          className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                      </th>
                      <th className="p-2.5 bg-zinc-100 dark:bg-zinc-900 select-none">
                        <button
                          type="button"
                          onClick={() => handleHeaderSort("company_name")}
                          aria-sort={candidateSortBy === "company_name" ? (candidateSortOrder === "asc" ? "ascending" : "descending") : "none"}
                          className="flex items-center gap-1.5 font-semibold text-zinc-900 dark:text-zinc-100 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer transition-colors group"
                        >
                          <span>기업명 (한국어 / 영문)</span>
                          <span className="text-[10px] font-mono">
                            {candidateSortBy === "company_name" ? (
                              candidateSortOrder === "asc" ? (
                                <span className="text-indigo-600 dark:text-indigo-400 font-bold">▲</span>
                              ) : (
                                <span className="text-indigo-600 dark:text-indigo-400 font-bold">▼</span>
                              )
                            ) : (
                              <span className="text-zinc-400 dark:text-zinc-500 opacity-60 group-hover:opacity-100">⇅</span>
                            )}
                          </span>
                        </button>
                      </th>
                      <th className="p-2.5 bg-zinc-100 dark:bg-zinc-900 select-none">
                        <button
                          type="button"
                          onClick={() => handleHeaderSort("brand_name")}
                          aria-sort={candidateSortBy === "brand_name" ? (candidateSortOrder === "asc" ? "ascending" : "descending") : "none"}
                          className="flex items-center gap-1.5 font-semibold text-zinc-900 dark:text-zinc-100 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer transition-colors group"
                        >
                          <span>대표 브랜드</span>
                          <span className="text-[10px] font-mono">
                            {candidateSortBy === "brand_name" ? (
                              candidateSortOrder === "asc" ? (
                                <span className="text-indigo-600 dark:text-indigo-400 font-bold">▲</span>
                              ) : (
                                <span className="text-indigo-600 dark:text-indigo-400 font-bold">▼</span>
                              )
                            ) : (
                              <span className="text-zinc-400 dark:text-zinc-500 opacity-60 group-hover:opacity-100">⇅</span>
                            )}
                          </span>
                        </button>
                      </th>
                      <th className="p-2.5 bg-zinc-100 dark:bg-zinc-900 select-none">
                        <button
                          type="button"
                          onClick={() => handleHeaderSort("grade")}
                          aria-sort={candidateSortBy === "grade" ? (candidateSortOrder === "asc" ? "ascending" : "descending") : "none"}
                          className="flex items-center gap-1.5 font-semibold text-zinc-900 dark:text-zinc-100 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer transition-colors group"
                        >
                          <span>등급</span>
                          <span className="text-[10px] font-mono">
                            {candidateSortBy === "grade" ? (
                              candidateSortOrder === "asc" ? (
                                <span className="text-indigo-600 dark:text-indigo-400 font-bold">▲</span>
                              ) : (
                                <span className="text-indigo-600 dark:text-indigo-400 font-bold">▼</span>
                              )
                            ) : (
                              <span className="text-zinc-400 dark:text-zinc-500 opacity-60 group-hover:opacity-100">⇅</span>
                            )}
                          </span>
                        </button>
                      </th>
                      <th className="p-2.5 bg-zinc-100 dark:bg-zinc-900 select-none">
                        <button
                          type="button"
                          onClick={() => handleHeaderSort("category")}
                          aria-sort={candidateSortBy === "category" ? (candidateSortOrder === "asc" ? "ascending" : "descending") : "none"}
                          className="flex items-center gap-1.5 font-semibold text-zinc-900 dark:text-zinc-100 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer transition-colors group"
                        >
                          <span>사업자 유형 / 카테고리</span>
                          <span className="text-[10px] font-mono">
                            {candidateSortBy === "category" ? (
                              candidateSortOrder === "asc" ? (
                                <span className="text-indigo-600 dark:text-indigo-400 font-bold">▲</span>
                              ) : (
                                <span className="text-indigo-600 dark:text-indigo-400 font-bold">▼</span>
                              )
                            ) : (
                              <span className="text-zinc-400 dark:text-zinc-500 opacity-60 group-hover:opacity-100">⇅</span>
                            )}
                          </span>
                        </button>
                      </th>
                      <th className="p-2.5 bg-zinc-100 dark:bg-zinc-900 select-none">
                        <button
                          type="button"
                          onClick={() => handleHeaderSort("email")}
                          aria-sort={candidateSortBy === "email" ? (candidateSortOrder === "asc" ? "ascending" : "descending") : "none"}
                          className="flex items-center gap-1.5 font-semibold text-zinc-900 dark:text-zinc-100 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer transition-colors group"
                        >
                          <span>수신 연락처</span>
                          <span className="text-[10px] font-mono">
                            {candidateSortBy === "email" ? (
                              candidateSortOrder === "asc" ? (
                                <span className="text-indigo-600 dark:text-indigo-400 font-bold">▲</span>
                              ) : (
                                <span className="text-indigo-600 dark:text-indigo-400 font-bold">▼</span>
                              )
                            ) : (
                              <span className="text-zinc-400 dark:text-zinc-500 opacity-60 group-hover:opacity-100">⇅</span>
                            )}
                          </span>
                        </button>
                      </th>
                      <th className="p-2.5 bg-zinc-100 dark:bg-zinc-900 select-none">
                        <button
                          type="button"
                          onClick={() => handleHeaderSort("consent")}
                          aria-sort={candidateSortBy === "consent" ? (candidateSortOrder === "asc" ? "ascending" : "descending") : "none"}
                          className="flex items-center gap-1.5 font-semibold text-zinc-900 dark:text-zinc-100 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer transition-colors group"
                        >
                          <span>마케팅 동의</span>
                          <span className="text-[10px] font-mono">
                            {candidateSortBy === "consent" ? (
                              candidateSortOrder === "asc" ? (
                                <span className="text-indigo-600 dark:text-indigo-400 font-bold">▲</span>
                              ) : (
                                <span className="text-indigo-600 dark:text-indigo-400 font-bold">▼</span>
                              )
                            ) : (
                              <span className="text-zinc-400 dark:text-zinc-500 opacity-60 group-hover:opacity-100">⇅</span>
                            )}
                          </span>
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {isLoadingCandidates ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-zinc-400">
                          후보 기업 데이터를 불러오는 중입니다...
                        </td>
                      </tr>
                    ) : candidatesList.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-zinc-400">
                          검색 및 필터 조건과 일치하는 후보 기업이 없습니다.
                        </td>
                      </tr>
                    ) : (
                      candidatesList.map((c) => {
                        const contacts = c.sourcing_contacts || [];
                        const validContacts = getValidCompanyContacts(c);
                        const validContactIds: string[] = validContacts.map((ct) => ct.id);
                        const selectedValidCompContacts = validContactIds.filter((id) => selectedContactIds.includes(id));
                        const isCompanySelected = selectedCompanyIds.includes(c.id);

                        const isAllSelected = validContactIds.length > 0 && selectedValidCompContacts.length === validContactIds.length;
                        const isSomeSelected = selectedValidCompContacts.length > 0 && selectedValidCompContacts.length < validContactIds.length;
                        const isIndeterminate = isSomeSelected;
                        const isChecked = isAllSelected || (validContactIds.length === 0 && isCompanySelected);

                        const brand = c.sourcing_brands?.[0]?.brand_name_kr || c.company_name_kr;
                        const primaryContact = contacts.find((ct: any) => ct.is_primary) || contacts[0];
                        const totalContacts = contacts.length;
                        const isExpanded = expandedContactCompanyIds.includes(c.id);
                        const isPrimaryEmailValid = primaryContact?.email ? isValidContactEmail(primaryContact.email) : false;

                        return (
                          <React.Fragment key={c.id}>
                            <tr
                              className={`hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors ${
                                isChecked || isIndeterminate ? "bg-indigo-50/20 dark:bg-indigo-950/10" : ""
                              }`}
                            >
                              <td className="p-2.5">
                                <input
                                  type="checkbox"
                                  ref={(el) => {
                                    if (el) el.indeterminate = isIndeterminate;
                                  }}
                                  checked={isChecked}
                                  disabled={validContactIds.length === 0}
                                  onChange={() => handleToggleCompany(c)}
                                  title={validContactIds.length === 0 ? "발송 가능한 유효 연락처가 없습니다" : undefined}
                                  className={`w-4 h-4 rounded border-zinc-300 dark:border-zinc-700 text-indigo-600 focus:ring-indigo-500 ${validContactIds.length === 0 ? "cursor-not-allowed opacity-40" : "cursor-pointer"}`}
                                />
                              </td>
                              <td className="p-2.5">
                                <div className="font-bold text-zinc-900 dark:text-zinc-100">{c.company_name_kr}</div>
                                {c.company_name_en && (
                                  <div className="text-[10px] text-zinc-400 font-mono truncate max-w-[200px]">
                                    {c.company_name_en}
                                  </div>
                                )}
                              </td>
                              <td className="p-2.5 text-zinc-700 dark:text-zinc-300">{brand}</td>
                              <td className="p-2.5 font-mono">
                                <span
                                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                    c.grade === "A"
                                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                      : c.grade === "B"
                                      ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                                      : c.grade === "C"
                                      ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                                      : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                                  }`}
                                >
                                  {c.grade || "UNRATED"}
                                </span>
                              </td>
                              <td className="p-2.5">
                                <div className="flex flex-wrap gap-1 max-w-[200px]">
                                  {(c.business_types || []).slice(0, 2).map((bt: string) => (
                                    <span
                                      key={bt}
                                      className="text-[9px] px-1 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300"
                                    >
                                      {bt}
                                    </span>
                                  ))}
                                  {(c.primary_product_categories || []).slice(0, 1).map((cat: string) => (
                                    <span
                                      key={cat}
                                      className="text-[9px] px-1 py-0.2 rounded bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800"
                                    >
                                      {cat}
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td className="p-2.5 text-zinc-600 dark:text-zinc-400">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-mono text-xs">
                                    {primaryContact?.email ? (
                                      isPrimaryEmailValid ? (
                                        primaryContact.email
                                      ) : (
                                        <span className="text-red-500 dark:text-red-400 font-semibold" title="이메일 형식 오류">
                                          {primaryContact.email} <span className="text-[10px] font-sans px-1 rounded bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">오류</span>
                                        </span>
                                      )
                                    ) : (
                                      <span className="text-red-400">이메일 없음</span>
                                    )}
                                  </span>
                                  {totalContacts > 1 && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setExpandedContactCompanyIds((prev) =>
                                          isExpanded ? prev.filter((id) => id !== c.id) : [...prev, c.id]
                                        )
                                      }
                                      className="text-[10px] font-semibold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 hover:bg-indigo-100 cursor-pointer flex items-center gap-1 border border-indigo-200 dark:border-indigo-800 transition-colors"
                                    >
                                      <span>{isExpanded ? "▲ 접기" : `▼ +${totalContacts - 1} 연락처 개별 선택`}</span>
                                      <span className="font-mono text-[9px] bg-indigo-200 dark:bg-indigo-900 px-1 rounded">
                                        {selectedValidCompContacts.length}/{validContacts.length}
                                      </span>
                                    </button>
                                  )}
                                </div>
                              </td>
                              <td className="p-2.5">
                                <span
                                  className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                                    c.marketing_consent_status === "CONSENTED"
                                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                      : c.marketing_consent_status === "REFUSED"
                                      ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                                      : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                                  }`}
                                >
                                  {c.marketing_consent_status || "UNCONFIRMED"}
                                </span>
                              </td>
                            </tr>

                            {/* Expanded Multi-contact Sub-rows with Hygiene Filtering */}
                            {isExpanded && totalContacts > 1 && (
                              <tr className="bg-indigo-50/30 dark:bg-indigo-950/20 border-b border-indigo-100 dark:border-indigo-900">
                                <td colSpan={7} className="p-3 pl-8">
                                  <div className="space-y-2 border-l-2 border-indigo-500 pl-3">
                                    <div className="flex items-center justify-between text-[11px] text-zinc-600 dark:text-zinc-400">
                                      <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                                        {c.company_name_kr} 개별 수신 연락처 선택 ({selectedValidCompContacts.length}/{validContacts.length} 선택됨):
                                      </span>
                                      <span className="text-[10px] text-zinc-500">
                                        유효한 이메일만 선택 가능하며, 체크된 연락처로 발송 시뮬레이션 및 실제 캠페인이 진행됩니다.
                                      </span>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                      {contacts.map((ct: any) => {
                                        const isValid = isValidContactEmail(ct.email);
                                        const isCtChecked = selectedContactIds.includes(ct.id);
                                        return (
                                          <label
                                            key={ct.id}
                                            className={`flex items-center gap-2 p-2 rounded border text-xs transition-colors ${
                                              !isValid
                                                ? "bg-red-50/40 dark:bg-red-950/20 border-red-200 dark:border-red-900/50 opacity-60 cursor-not-allowed"
                                                : isCtChecked
                                                ? "bg-white dark:bg-zinc-800 border-indigo-300 dark:border-indigo-700 shadow-xs cursor-pointer"
                                                : "bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 opacity-60 cursor-pointer"
                                            }`}
                                          >
                                            <input
                                              type="checkbox"
                                              checked={isCtChecked}
                                              disabled={!isValid}
                                              onChange={() => isValid && handleToggleContact(c, ct.id)}
                                              className="rounded border-zinc-300 dark:border-zinc-700 text-indigo-600 focus:ring-indigo-500 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                                            />
                                            <div className="flex flex-col min-w-0">
                                              <div className="flex items-center gap-1">
                                                <span className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                                                  {ct.name || "담당자"}
                                                </span>
                                                {ct.is_primary && (
                                                  <span className="text-[9px] font-bold px-1 rounded bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                                                    대표
                                                  </span>
                                                )}
                                              </div>
                                              <span
                                                className={`font-mono text-[10px] truncate ${
                                                  !isValid ? "text-red-500 dark:text-red-400 font-semibold" : "text-zinc-500 dark:text-zinc-400"
                                                }`}
                                              >
                                                {ct.email ? (
                                                  isValid ? (
                                                    ct.email
                                                  ) : (
                                                    <span title="유효하지 않은 이메일 형식">{ct.email} (오류)</span>
                                                  )
                                                ) : (
                                                  "이메일 없음"
                                                )}
                                              </span>
                                            </div>
                                          </label>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* 5. SERVER-SIDE PAGINATION & PAGE SIZE CONTROLS (ADM-BSRC-009-R6) */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2.5 border-t border-zinc-100 dark:border-zinc-800 text-xs">
                <div className="flex items-center gap-3">
                  {candidatePageSize === "ALL" ? (
                    <span className="text-zinc-500">
                      총 <strong className="font-mono text-zinc-900 dark:text-zinc-100">{totalMatchingCandidates}</strong>개사 중{" "}
                      <strong className="font-mono text-zinc-900 dark:text-zinc-100">{candidatesList.length}</strong>개사 표시 (전체 보기)
                    </span>
                  ) : (
                    <span className="text-zinc-500">
                      총 <strong className="font-mono text-zinc-900 dark:text-zinc-100">{totalMatchingCandidates}</strong>개사 중{" "}
                      <strong className="font-mono text-zinc-900 dark:text-zinc-100">{candidatesList.length}</strong>개사 표시 (페이지{" "}
                      <strong className="font-mono">{candidatePage}</strong> / {Math.max(1, Math.ceil(totalMatchingCandidates / (candidatePageSize as number)))})
                    </span>
                  )}
                  <div className="flex items-center gap-1.5">
                    <span className="text-zinc-400">페이지당:</span>
                    <select
                      value={candidatePageSize}
                      onChange={(e) => {
                        const val = e.target.value === "ALL" ? "ALL" : Number(e.target.value);
                        setCandidatePageSize(val);
                        setCandidatePage(1);
                      }}
                      className="text-xs px-2 py-1 rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-mono"
                    >
                      <option value={20}>20개</option>
                      <option value={50}>50개</option>
                      <option value={100}>100개</option>
                      <option value={200}>200개</option>
                      <option value="ALL">전체 보기 (All)</option>
                    </select>
                  </div>
                </div>

                {/* Pagination Navigation Buttons */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={candidatePageSize === "ALL" || candidatePage <= 1 || isLoadingCandidates}
                    onClick={() => setCandidatePage(1)}
                    className="px-2.5 py-1 rounded border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 disabled:opacity-40 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer disabled:cursor-not-allowed"
                  >
                    « 처음
                  </button>
                  <button
                    type="button"
                    disabled={candidatePageSize === "ALL" || candidatePage <= 1 || isLoadingCandidates}
                    onClick={() => setCandidatePage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1 rounded border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 disabled:opacity-40 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer disabled:cursor-not-allowed"
                  >
                    ‹ 이전
                  </button>
                  <span className="px-3 py-1 font-mono font-semibold text-zinc-900 dark:text-zinc-100 bg-zinc-100 dark:bg-zinc-800 rounded">
                    {candidatePageSize === "ALL"
                      ? "1 / 1 (전체)"
                      : `${candidatePage} / ${Math.max(1, Math.ceil(totalMatchingCandidates / (candidatePageSize as number)))}`}
                  </span>
                  <button
                    type="button"
                    disabled={
                      candidatePageSize === "ALL" ||
                      candidatePage >= Math.ceil(totalMatchingCandidates / (candidatePageSize as number)) ||
                      isLoadingCandidates
                    }
                    onClick={() => setCandidatePage((p) => p + 1)}
                    className="px-3 py-1 rounded border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 disabled:opacity-40 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer disabled:cursor-not-allowed"
                  >
                    다음 ›
                  </button>
                  <button
                    type="button"
                    disabled={
                      candidatePageSize === "ALL" ||
                      candidatePage >= Math.ceil(totalMatchingCandidates / (candidatePageSize as number)) ||
                      isLoadingCandidates
                    }
                    onClick={() => setCandidatePage(Math.max(1, Math.ceil(totalMatchingCandidates / (candidatePageSize as number))))}
                    className="px-2.5 py-1 rounded border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 disabled:opacity-40 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer disabled:cursor-not-allowed"
                  >
                    끝 »
                  </button>
                </div>
              </div>

              {/* Step Navigation Actions */}
              <div className="flex items-center justify-between pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="px-4 py-2 text-xs font-semibold text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 cursor-pointer"
                >
                  ← Back: Email Template &amp; Live Preview
                </button>
                <button
                  type="button"
                  onClick={() => handleNavigateStep(4)}
                  className="px-5 py-2 text-xs font-bold text-white bg-zinc-950 dark:bg-zinc-100 dark:text-zinc-950 rounded hover:bg-zinc-800 cursor-pointer transition-colors shadow-xs"
                >
                  Next: Sample Personalization Review ({totalUniqueRecipients.length}명 대상) →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: SAMPLE PERSONALIZATION REVIEW */}
        {currentStep === 4 && (
          <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-5 shadow-xs space-y-4">
            <div className="border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                4. Sample Recipient Review (Mandatory Pre-send Verification)
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                선택된 후보 기업 중 실제 데이터를 바탕으로 치환된 개인화 변수, 이미지 렌더링 및 중앙 푸터 결합 결과를 사전 검증합니다. 외부 발송은 발생하지 않습니다.
              </p>
            </div>

            {/* Viewport & Full Preview Controls for Step 4 */}
            <div className="flex items-center justify-between pb-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  Preview Viewport:
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                  {step4Viewport === "desktop" ? "Desktop (680px)" : "Mobile (375px)"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="inline-flex rounded-md border border-zinc-200 dark:border-zinc-800 p-0.5 bg-zinc-50 dark:bg-zinc-950">
                  <button
                    type="button"
                    onClick={() => setStep4Viewport("desktop")}
                    className={`px-3 py-1 text-[11px] font-semibold rounded cursor-pointer ${
                      step4Viewport === "desktop"
                        ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs"
                        : "text-zinc-500 hover:text-zinc-800"
                    }`}
                  >
                    Desktop (680px)
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep4Viewport("mobile")}
                    className={`px-3 py-1 text-[11px] font-semibold rounded cursor-pointer ${
                      step4Viewport === "mobile"
                        ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs"
                        : "text-zinc-500 hover:text-zinc-800"
                    }`}
                  >
                    Mobile (375px)
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setShowFullPreviewModal(true)}
                  className="px-2.5 py-1 text-[11px] font-semibold text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 hover:bg-zinc-50 flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <span>⛶</span> 전체 화면 미리보기
                </button>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 flex justify-center overflow-x-auto">
              <div
                style={{
                  width: step4Viewport === "desktop" ? "680px" : "375px",
                  minWidth: step4Viewport === "desktop" ? "680px" : "375px",
                  maxWidth: "100%",
                  transition: "width 0.2s ease-in-out",
                }}
                className="bg-white rounded shadow-sm border border-zinc-200 overflow-hidden self-start"
              >
                <iframe
                  title="Sample Personalized Preview"
                  srcDoc={assembledPreviewHtml}
                  onLoad={(e) => setupDynamicIframeHeight(e, setStep4IframeHeight)}
                  style={{ height: `${step4IframeHeight}px`, overflow: "hidden" }}
                  className="w-full border-0 block"
                  scrolling="no"
                  sandbox="allow-same-origin"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                className="px-4 py-2 text-xs font-semibold text-zinc-600 hover:text-zinc-900 cursor-pointer"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={() => handleNavigateStep(5)}
                className="px-4 py-2 text-xs font-bold text-white bg-zinc-950 dark:bg-zinc-100 dark:text-zinc-950 rounded hover:bg-zinc-800 cursor-pointer"
              >
                Next: Test Send &amp; Dry Run →
              </button>
            </div>
          </div>
        )}

        {/* STEP 5: TEST SEND & DRY RUN SIMULATION */}
        {currentStep === 5 && (
          <div className="space-y-6">
            {/* 5.A Test Email Dispatch */}
            <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-5 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3 gap-2">
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    <span>5.A Test Email Dispatch (Multi-Recipient &amp; Allowlist)</span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                      최대 {MAX_TEST_RECIPIENTS_PER_BATCH}명
                    </span>
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    안전한 검증을 위해 인가된 내부 도메인(@letusto.com, @kselectnetwork.com) 및 오너가 승인한 외부 테스트 이메일로만 발송됩니다.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAllowlistManager(!showAllowlistManager)}
                  className="self-start sm:self-auto text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white px-2.5 py-1 rounded border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer transition flex items-center gap-1.5"
                >
                  <span>⚙️ 외부 테스트 허용 목록</span>
                  <span className="text-[10px] bg-zinc-200 dark:bg-zinc-700 px-1.5 py-0.2 rounded font-mono">
                    {ownerAllowlist.length}
                  </span>
                </button>
              </div>

              {/* Owner Test Allowlist Manager Panel */}
              {showAllowlistManager && (
                <div className="p-4 bg-zinc-50 dark:bg-zinc-950 rounded-lg border border-zinc-200 dark:border-zinc-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                      외부 테스트 이메일 허용 목록 관리 (Owner Test Allowlist)
                    </span>
                    <span className="text-[11px] text-zinc-500">
                      내부 기본 허용: @letusto.com, @kselectnetwork.com
                    </span>
                  </div>

                  <form onSubmit={handleAddAllowlistEmail} className="flex gap-2">
                    <input
                      type="email"
                      value={newAllowlistEmail}
                      onChange={(e) => setNewAllowlistEmail(e.target.value)}
                      placeholder="예: owner.test@gmail.com, qa@outlook.com"
                      className="flex-1 px-3 py-1.5 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-mono"
                    />
                    <button
                      type="submit"
                      disabled={!newAllowlistEmail.trim() || isUpdatingAllowlist}
                      className="px-3 py-1.5 text-xs font-bold text-white bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 hover:bg-zinc-800 rounded disabled:opacity-50 cursor-pointer"
                    >
                      {isUpdatingAllowlist ? "추가 중..." : "+ 허용 목록 추가"}
                    </button>
                  </form>

                  <div className="space-y-1.5">
                    <div className="text-[11px] font-medium text-zinc-500">
                      등록된 외부 테스트 이메일 ({ownerAllowlist.length}개):
                    </div>
                    {ownerAllowlist.length === 0 ? (
                      <div className="text-xs text-zinc-400 italic py-1">
                        등록된 외부 테스트 주소가 없습니다. 내부 도메인(@letusto.com, @kselectnetwork.com)만 허용됩니다.
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {ownerAllowlist.map((email) => (
                          <span
                            key={email}
                            className="inline-flex items-center gap-1.5 text-xs font-mono px-2.5 py-1 rounded bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 shadow-2xs"
                          >
                            <span>{email}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveAllowlistEmail(email)}
                              disabled={isUpdatingAllowlist}
                              title="허용 목록에서 삭제"
                              className="text-zinc-400 hover:text-red-600 cursor-pointer font-bold"
                            >
                              ✕
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Multi-Recipient Input Area */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <label className="font-semibold text-zinc-700 dark:text-zinc-300">
                    테스트 수신자 주소 (쉼표, 세미콜론, 줄바꿈으로 구분):
                  </label>
                  <span className="text-zinc-400 text-[11px]">
                    1회 최대 {MAX_TEST_RECIPIENTS_PER_BATCH}명까지 일괄 발송
                  </span>
                </div>

                <textarea
                  rows={3}
                  value={testEmailAddress}
                  onChange={(e) => setTestEmailAddress(e.target.value)}
                  placeholder="chae@letusto.com, cyim@letusto.com; skim@letusto.com&#10;user.test@gmail.com"
                  className="w-full px-3 py-2 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-mono leading-relaxed"
                />

                {/* Real-time Parsed Badges */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[11px] font-medium text-zinc-500">인식 결과:</span>
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${
                      parsedTestRecipients.uniqueRecipients.length > 0 &&
                      !parsedTestRecipients.exceedsBatchLimit
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300"
                        : "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400"
                    }`}
                  >
                    유효 수신자 {parsedTestRecipients.uniqueRecipients.length}명
                  </span>

                  {parsedTestRecipients.duplicateCount > 0 && (
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300">
                      중복 {parsedTestRecipients.duplicateCount}건 자동 제거됨
                    </span>
                  )}

                  {parsedTestRecipients.invalidInputs.length > 0 && (
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/60 dark:text-red-300">
                      형식 오류 {parsedTestRecipients.invalidInputs.length}건 제외됨
                    </span>
                  )}

                  {parsedTestRecipients.exceedsBatchLimit && (
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-red-100 text-red-800 border border-red-300 dark:bg-red-900 dark:text-red-100">
                      ⚠️ 1회 발송 한도({MAX_TEST_RECIPIENTS_PER_BATCH}명) 초과
                    </span>
                  )}
                </div>

                {/* Parsed Chips List */}
                {parsedTestRecipients.uniqueRecipients.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {parsedTestRecipients.uniqueRecipients.map((em) => (
                      <span
                        key={em}
                        className="text-[11px] font-mono px-2 py-0.5 rounded bg-stone-100 dark:bg-zinc-800 text-stone-700 dark:text-zinc-300 border border-stone-200 dark:border-zinc-700"
                      >
                        {em}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Button */}
              <div className="flex items-center justify-between pt-2">
                <span className="text-[11px] text-zinc-400">
                  * 중앙 마케팅 푸터 및 개인화 수신 거부 링크가 자동 동기화되어 포함됩니다.
                </span>
                <button
                  type="button"
                  disabled={
                    isSendingTest ||
                    parsedTestRecipients.uniqueRecipients.length === 0 ||
                    parsedTestRecipients.exceedsBatchLimit
                  }
                  onClick={handleSendTestEmail}
                  className="px-5 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition shadow-xs flex items-center gap-2"
                >
                  {isSendingTest ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      <span>Sending Test Batch...</span>
                    </>
                  ) : (
                    <span>
                      Send Test Email ({parsedTestRecipients.uniqueRecipients.length}명 발송) ✉️
                    </span>
                  )}
                </button>
              </div>

              {/* General Summary Banner */}
              {testSendResult && (
                <div
                  className={`p-3 rounded-md text-xs font-medium ${
                    testSendResult.success
                      ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border border-emerald-200"
                      : "bg-red-50 dark:bg-red-950/60 text-red-800 dark:text-red-200 border border-red-200"
                  }`}
                >
                  {testSendResult.message}
                </div>
              )}

              {/* Detailed Per-Recipient Send Results */}
              {testBatchResult && testBatchResult.results.length > 0 && (
                <div className="p-3 bg-zinc-50 dark:bg-zinc-950 rounded-lg border border-zinc-200 dark:border-zinc-800 space-y-2">
                  <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center justify-between">
                    <span>수신자별 전송 결과 상세</span>
                    <span className="text-[11px] font-normal text-zinc-500">
                      성공: {testBatchResult.totalSent}건 / 실패·거부: {testBatchResult.totalFailed}건
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {testBatchResult.results.map((r) => (
                      <div
                        key={r.email}
                        className="flex flex-col sm:flex-row sm:items-center justify-between p-2 rounded bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs gap-1"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                              r.success
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                            }`}
                          >
                            {r.success ? "✓" : "✕"}
                          </span>
                          <span className="font-mono font-medium text-zinc-900 dark:text-zinc-100">
                            {r.email}
                          </span>
                        </div>
                        <div className="text-[11px]">
                          {r.success ? (
                            <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                              전송 완료 {r.messageId ? `(ID: ${r.messageId.slice(0, 12)}...)` : ""}
                            </span>
                          ) : (
                            <span className="text-red-600 dark:text-red-400">
                              {r.error || "발송 실패"}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 5.B Campaign Dry Run */}
            <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    5.B Campaign Dry Run (Pre-activation Simulation)
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    선택된 수신자 스냅샷을 동결하고, 중복·수신거부·동의 상태를 엄격히 검증하여 최종 발송 가능/제외 보고서를 생성합니다.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={isRunningDryRun}
                  onClick={handleExecuteDryRun}
                  className="px-4 py-2 text-xs font-bold text-white bg-zinc-950 dark:bg-zinc-100 dark:text-zinc-950 rounded hover:bg-zinc-800 cursor-pointer disabled:opacity-50"
                >
                  {isRunningDryRun ? "Simulating..." : "Execute Dry Run (0 Emails Sent)"}
                </button>
              </div>

              {dryRunReport && (
                <div className="space-y-4 p-4 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="p-3 rounded bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700">
                      <span className="text-zinc-400 block text-[10px]">Total Candidates</span>
                      <strong className="text-base text-zinc-900 dark:text-zinc-100">{dryRunReport.totalCandidatesEvaluated}</strong>
                    </div>
                    <div className="p-3 rounded bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200">
                      <span className="block text-[10px]">Sendable Recipients</span>
                      <strong className="text-base font-bold">{dryRunReport.sendableCount}</strong>
                    </div>
                    <div className="p-3 rounded bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200">
                      <span className="block text-[10px]">Excluded / Filtered</span>
                      <strong className="text-base font-bold">{dryRunReport.excludedCount}</strong>
                    </div>
                    <div className="p-3 rounded bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700">
                      <span className="text-zinc-400 block text-[10px]">Suppressed / Opted Out</span>
                      <strong className="text-base text-zinc-900 dark:text-zinc-100">{dryRunReport.suppressedFiltered}</strong>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setCurrentStep(4)}
                  className="px-4 py-2 text-xs font-semibold text-zinc-600 hover:text-zinc-900 cursor-pointer"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={() => handleNavigateStep(6)}
                  className="px-4 py-2 text-xs font-bold text-white bg-zinc-950 dark:bg-zinc-100 dark:text-zinc-950 rounded hover:bg-zinc-800 cursor-pointer"
                >
                  Next: Final Approval &amp; Activity →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 6: FINAL APPROVAL WORKFLOW & ACTIVITY LOG */}
        {currentStep === 6 && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-5 shadow-xs space-y-4">
              <div className="border-b border-zinc-100 dark:border-zinc-800 pb-3">
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  6. Final Approval Workflow &amp; Release Snapshot
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  캠페인을 승인 상태로 고정(Lock)합니다. 승인 전 법적 푸터 및 템플릿 무결성 체크리스트가 모두 통과되어야 승인이 가능합니다.
                </p>
              </div>

              {/* Pre-Approval Validation Checklist (Section 7) */}
              <div className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-2">
                <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                  Pre-Approval Integrity Checklist
                </div>
                {isValidatingApproval ? (
                  <div className="text-xs text-zinc-400 py-2">승인 전 체크리스트 검증 중...</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs">
                    {preApprovalChecks.map((chk, idx) => (
                      <div
                        key={idx}
                        className={`p-2.5 rounded border flex items-start gap-2 ${
                          chk.status === "PASS"
                            ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800 text-emerald-950 dark:text-emerald-200"
                            : "bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-800 text-red-950 dark:text-red-200"
                        }`}
                      >
                        <span className="font-bold">{chk.status === "PASS" ? "✓" : "✗"}</span>
                        <div>
                          <div className="font-bold">{chk.name}</div>
                          <div className="text-[11px] opacity-80">{chk.detail}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Approval Status Card */}
              <div className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300">Approval State:</span>
                  <span
                    className={`font-bold px-2 py-0.5 rounded ${
                      editingCampaign.approvalStatus === "APPROVED"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300"
                        : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                    }`}
                  >
                    {editingCampaign.approvalStatus}
                  </span>
                </div>

                {editingCampaign.approvalSnapshot && (
                  <div className="p-3 bg-white dark:bg-zinc-900 rounded border border-zinc-200 dark:border-zinc-700 text-[11px] space-y-1 font-mono">
                    <div>Approved At: {new Date(editingCampaign.approvalSnapshot.approvedAt).toLocaleString()}</div>
                    <div>Approved By: {editingCampaign.approvalSnapshot.approvedBy}</div>
                    <div>Frozen Sendable Count: {editingCampaign.approvalSnapshot.sendableCount}</div>
                    <div>Template Version: {editingCampaign.approvalSnapshot.templateVersion}</div>
                  </div>
                )}

                <div className="pt-2">
                  {editingCampaign.approvalStatus !== "APPROVED" ? (
                    <button
                      type="button"
                      onClick={handleApproveCampaign}
                      disabled={preApprovalChecks.some((c) => c.status === "FAIL")}
                      className="w-full py-2.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer shadow-xs disabled:opacity-50"
                    >
                      Approve Campaign (Lock Snapshot) ✓
                    </button>
                  ) : (
                    <div className="p-2.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 font-semibold text-center">
                      ✓ Campaign is officially approved and locked.
                    </div>
                  )}
                </div>
              </div>

              {/* Activity Audit Logs */}
              <div className="space-y-2 pt-2">
                <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                  Campaign Audit Log ({campaignLogs.length})
                </h4>
                {campaignLogs.length === 0 ? (
                  <p className="text-[11px] text-zinc-400 italic">No activity logs recorded yet.</p>
                ) : (
                  <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-x-auto max-h-[220px]">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-zinc-50 dark:bg-zinc-800 text-zinc-500">
                        <tr>
                          <th className="p-2">Event</th>
                          <th className="p-2">Mode</th>
                          <th className="p-2">Timestamp</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {campaignLogs.map((l, lIdx) => (
                          <tr key={l.id || lIdx}>
                            <td className="p-2 font-bold text-zinc-800 dark:text-zinc-200">{l.eventType}</td>
                            <td className="p-2 font-mono text-[10px]">{l.isTestMode ? "TEST_MODE" : "LIVE_MODE"}</td>
                            <td className="p-2 text-zinc-400 font-mono text-[10px]">
                              {new Date(l.createdAt).toLocaleTimeString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setCurrentStep(5)}
                  className="px-4 py-2 text-xs font-semibold text-zinc-600 hover:text-zinc-900 cursor-pointer"
                >
                  ← Back to Test Send
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setViewMode("list");
                    refreshCampaignsAndTemplates();
                  }}
                  className="px-4 py-2 text-xs font-bold text-white bg-zinc-950 dark:bg-zinc-100 dark:text-zinc-950 rounded hover:bg-zinc-800 cursor-pointer"
                >
                  Save &amp; Return to Campaign List
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // --------------------------------------------------------------------------
  // RENDER: UPLOAD HTML / ZIP MODAL (Section 1 & 2)
  // --------------------------------------------------------------------------
  const renderUploadModal = () => {
    if (!showUploadModal) return null;

    return (
      <div className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
          <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
            <div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                Upload Designer Email Package (HTML / ZIP)
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                HTML 파일 또는 이미지가 포함된 ZIP 패키지를 업로드하여 자동 호스팅 및 이미지 URL 변환을 수행합니다.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowUploadModal(false)}
              className="text-zinc-400 hover:text-zinc-600 text-sm font-bold cursor-pointer"
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleUploadSubmit} className="space-y-4 text-xs">
            {uploadError && (
              <div className="p-3 rounded bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-200 border border-red-200">
                {uploadError}
              </div>
            )}

            {/* Format Selector */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setUploadTemplateType("HTML")}
                className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${
                  uploadTemplateType === "HTML"
                    ? "border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-950 dark:text-emerald-200 ring-2 ring-emerald-500/20"
                    : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 hover:bg-zinc-50"
                }`}
              >
                <div className="font-bold flex items-center gap-1.5 text-xs">
                  <span>📄</span> HTML / ZIP 패키지 업로드
                </div>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                  디자이너가 작성한 HTML 또는 이미지 폴더가 포함된 ZIP을 업로드합니다.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setUploadTemplateType("IMAGE")}
                className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${
                  uploadTemplateType === "IMAGE"
                    ? "border-purple-600 bg-purple-50/50 dark:bg-purple-950/30 text-purple-950 dark:text-purple-200 ring-2 ring-purple-500/20"
                    : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 hover:bg-zinc-50"
                }`}
              >
                <div className="font-bold flex items-center gap-1.5 text-xs">
                  <span>🖼️</span> IMAGE 슬라이스 빌더
                </div>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                  600px 세로 분할 이미지와 CTA 버튼을 직접 조립합니다.
                </p>
              </button>
            </div>

            {/* Common Metadata Fields */}
            <div>
              <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Template Name *
              </label>
              <input
                type="text"
                placeholder="예: 2026 Fall Buyer Outreach - Package 01"
                value={uploadName}
                onChange={(e) => setUploadName(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100"
              />
            </div>

            {/* Mode-Specific Content */}
            {uploadTemplateType === "IMAGE" ? (
              <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800">
                <ImageTemplateComposer
                  sections={uploadImageSections}
                  onChange={setUploadImageSections}
                  defaultLandingUrl="https://www.kselectnetwork.com"
                />
              </div>
            ) : (
              <div className="space-y-3 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                {/* File Dropzone */}
                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Upload HTML or ZIP File (권장)
                  </label>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 hover:border-blue-500 rounded-lg p-6 text-center cursor-pointer transition bg-zinc-50 dark:bg-zinc-950/40"
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".html,.htm,.zip"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setUploadFile(file);
                          if (!uploadName.trim()) {
                            setUploadName(file.name.replace(/\.[^/.]+$/, ""));
                          }
                        }
                      }}
                      className="hidden"
                    />
                    {uploadFile ? (
                      <div className="space-y-1">
                        <span className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                          📦 {uploadFile.name}
                        </span>
                        <div className="text-[11px] text-zinc-400">
                          {(uploadFile.size / 1024).toFixed(1)} KB · 클릭하여 다른 파일 선택
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <div className="text-2xl">📂</div>
                        <div className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                          HTML 또는 ZIP 파일을 여기에 드래그하거나 클릭하여 업로드
                        </div>
                        <p className="text-[11px] text-zinc-400">
                          ZIP 내부에 포함된 이미지(images/...)는 관리형 HTTPS 스토리지로 자동 추출 및 호스팅됩니다.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Direct HTML Paste Fallback */}
                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Or Paste Raw HTML Directly (선택적 직접 입력)
                  </label>
                  <textarea
                    rows={4}
                    placeholder="<!DOCTYPE html><html><body>...</body></html>"
                    value={uploadHtmlText}
                    onChange={(e) => setUploadHtmlText(e.target.value)}
                    className="w-full px-3 py-2 font-mono text-[11px] rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 leading-relaxed"
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-200 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="px-3.5 py-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 rounded cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isUploading}
                className="px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded cursor-pointer disabled:opacity-50"
              >
                {isUploading ? "Importing & Hosting Assets..." : "Import & Save Package"}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  // --------------------------------------------------------------------------
  // RENDER: DUPLICATE / SAVE AS MODAL (Section 3)
  // --------------------------------------------------------------------------
  const renderDuplicateModal = () => {
    if (!duplicateModalTemplate) return null;

    return (
      <div className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg max-w-md w-full p-5 shadow-2xl space-y-4">
          <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
            Duplicate Template Package (Save As)
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            &quot;{duplicateModalTemplate.name}&quot; 템플릿의 소스 코드와 디자인 에셋을 보존하면서 새로운 독립 템플릿 레코드를 생성합니다.
          </p>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              New Template Name *
            </label>
            <input
              type="text"
              value={duplicateNewName}
              onChange={(e) => setDuplicateNewName(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-medium"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => setDuplicateModalTemplate(null)}
              className="px-3 py-1.5 text-xs font-semibold rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-700 dark:text-zinc-300 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleExecuteDuplicate}
              className="px-4 py-1.5 text-xs font-bold rounded bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 hover:bg-zinc-800 cursor-pointer"
            >
              Confirm Duplicate
            </button>
          </div>
        </div>
      </div>
    );
  };

  // --------------------------------------------------------------------------
  // RENDER: TEMPLATE PREVIEW MODAL
  // --------------------------------------------------------------------------

  // --------------------------------------------------------------------------
  // RENDER: FULL PREVIEW MODAL (ADM-EMAIL-TPL-005)
  // --------------------------------------------------------------------------
  const renderFullPreviewModal = () => {
    if (!showFullPreviewModal) return null;

    return (
      <div className="fixed inset-0 z-[95] bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl max-w-5xl w-full p-5 shadow-2xl flex flex-col h-[94vh]">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  전체 화면 미리보기 (Full Screen Send-Ready Preview)
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                  {previewViewport === "desktop" ? "Desktop (680px)" : "Mobile (375px)"}
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 truncate max-w-xl">
                제목: &quot;{sampleResolvedSubject}&quot;
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="inline-flex rounded-md border border-zinc-200 dark:border-zinc-800 p-0.5 bg-zinc-50 dark:bg-zinc-950">
                <button
                  type="button"
                  onClick={() => setPreviewViewport("desktop")}
                  className={`px-3 py-1 text-[11px] font-semibold rounded cursor-pointer ${
                    previewViewport === "desktop"
                      ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs"
                      : "text-zinc-500 hover:text-zinc-800"
                  }`}
                >
                  Desktop (680px)
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewViewport("mobile")}
                  className={`px-3 py-1 text-[11px] font-semibold rounded cursor-pointer ${
                    previewViewport === "mobile"
                      ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs"
                      : "text-zinc-500 hover:text-zinc-800"
                  }`}
                >
                  Mobile (375px)
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowFullPreviewModal(false)}
                className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 flex items-center justify-center text-zinc-600 dark:text-zinc-300 font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="bg-zinc-100 dark:bg-zinc-950 p-6 rounded-lg flex justify-center overflow-x-auto overflow-y-auto flex-1 mt-3">
            <div
              style={{
                width: previewViewport === "desktop" ? "680px" : "375px",
                minWidth: previewViewport === "desktop" ? "680px" : "375px",
                transition: "width 0.2s ease-in-out",
              }}
              className="bg-white rounded shadow-md border border-zinc-200 overflow-hidden self-start"
            >
              <iframe
                title="Full Screen Preview"
                srcDoc={assembledPreviewHtml}
                onLoad={(e) => setupDynamicIframeHeight(e, setFullPreviewHeight)}
                style={{ height: `${fullPreviewHeight}px`, overflow: "hidden" }}
                className="w-full border-0 block"
                scrolling="no"
                sandbox="allow-same-origin"
              />
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderTemplatePreviewModal = () => {
    if (!previewModalTemplate) return null;

    const modalAssembledHtml = assembleEmailWithMarketingFooter(previewModalTemplate.htmlContent, {
      footerSettings,
      language: previewModalTemplate.language,
      unsubscribeUrl: "https://admin.kselectnetwork.com/unsubscribe?token=sample-preview-token",
    });

    return (
      <div className="fixed inset-0 z-[85] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg max-w-4xl w-full p-5 shadow-2xl space-y-4 max-h-[92vh] flex flex-col">
          <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                {previewModalTemplate.name}
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                {previewModalTemplate.subject}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="inline-flex rounded-md border border-zinc-200 dark:border-zinc-800 p-0.5 bg-zinc-50 dark:bg-zinc-950">
                <button
                  type="button"
                  onClick={() => setTplModalViewport("desktop")}
                  className={`px-3 py-1 text-[11px] font-semibold rounded cursor-pointer ${
                    tplModalViewport === "desktop"
                      ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs"
                      : "text-zinc-500 hover:text-zinc-800"
                  }`}
                >
                  Desktop (680px)
                </button>
                <button
                  type="button"
                  onClick={() => setTplModalViewport("mobile")}
                  className={`px-3 py-1 text-[11px] font-semibold rounded cursor-pointer ${
                    tplModalViewport === "mobile"
                      ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs"
                      : "text-zinc-500 hover:text-zinc-800"
                  }`}
                >
                  Mobile (375px)
                </button>
              </div>
              <button
                type="button"
                onClick={() => setPreviewModalTemplate(null)}
                className="text-zinc-400 hover:text-zinc-600 text-sm font-bold cursor-pointer p-1"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="bg-zinc-100 dark:bg-zinc-950 p-4 rounded-lg flex justify-center overflow-x-auto flex-1 overflow-y-auto">
            <div
              style={{
                width: tplModalViewport === "desktop" ? "680px" : "375px",
                minWidth: tplModalViewport === "desktop" ? "680px" : "375px",
                maxWidth: "100%",
                transition: "width 0.2s ease-in-out",
              }}
              className="bg-white rounded shadow-sm border border-zinc-200 overflow-hidden self-start"
            >
              <iframe
                title="Template Preview"
                srcDoc={modalAssembledHtml}
                onLoad={(e) => setupDynamicIframeHeight(e, setTplModalIframeHeight)}
                style={{ height: `${tplModalIframeHeight}px`, overflow: "hidden" }}
                className="w-full border-0 block"
                scrolling="no"
                sandbox="allow-same-origin"
              />
            </div>
          </div>
        </div>
      </div>
    );
  };


  // --------------------------------------------------------------------------
  // RENDER: MANAGE SELECTION MODAL (ADM-BSRC-009-R8: Expanded 1500px, Opaque Sticky Header & 3-state Sorting)
  // --------------------------------------------------------------------------
  const renderManageSelectionModal = () => {
    if (!showManageSelectionModal) return null;

    const renderSortIndicator = (field: "type" | "company" | "email" | "consent" | "eligibility") => {
      if (manageSelectionSortBy !== field) {
        return <span className="text-zinc-400 dark:text-zinc-500 text-[10px]">↕</span>;
      }
      return (
        <span className="text-indigo-600 dark:text-indigo-400 font-bold text-[11px]">
          {manageSelectionSortOrder === "asc" ? "▲" : "▼"}
        </span>
      );
    };

    const sendableCount = selectedRecipientItems.filter((i) => i.isSendable).length;
    const excludedCount = selectedRecipientItems.length - sendableCount;

    return (
      <div className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 md:p-8 animate-in fade-in duration-150">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl w-[95vw] max-w-[1500px] h-[88vh] max-h-[90vh] shadow-2xl flex flex-col overflow-hidden">
          {/* Modal Header (Fixed height, no scroll) */}
          <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 px-6 py-4 bg-zinc-50/80 dark:bg-zinc-900 shrink-0">
            <div>
              <div className="flex items-center gap-3">
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <span>선택된 수신 대상 관리</span>
                  <span className="text-xs font-normal text-zinc-400">(Manage Selected Recipients)</span>
                </h3>
                <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  총 {selectedRecipientItems.length}명
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  발송 가능 {sendableCount}명
                </span>
                {excludedCount > 0 && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                    발송 제외 {excludedCount}명
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                기업 연락처 및 수기 추가된 모든 고유 이메일을 확인하고, 불필요한 대상을 개별 제거하거나 정렬하여 검토할 수 있습니다.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowManageSelectionModal(false)}
              className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-lg font-bold cursor-pointer p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              title="닫기"
            >
              ✕
            </button>
          </div>

          {/* Search within selections & Action Toolbar (Fixed, no scroll) */}
          <div className="flex items-center justify-between gap-4 px-6 py-3 border-b border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 shrink-0">
            <div className="relative flex-1 max-w-xl">
              <input
                type="text"
                value={manageSelectionSearch}
                onChange={(e) => setManageSelectionSearch(e.target.value)}
                placeholder="선택 목록 내 이메일, 회사명, 담당자명, 브랜드명 검색..."
                className="w-full text-xs px-3.5 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 transition-all"
              />
              {manageSelectionSearch && (
                <button
                  type="button"
                  onClick={() => setManageSelectionSearch("")}
                  className="absolute right-3 top-2.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xs cursor-pointer font-bold"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="flex items-center gap-3 shrink-0">
              {manageSelectionSearch && (
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  검색 결과: <strong className="text-zinc-900 dark:text-zinc-100 font-mono">{filteredManageSelectionItems.length}</strong> / {selectedRecipientItems.length}명
                </span>
              )}
              <button
                type="button"
                onClick={handleClearAllSelections}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-red-200 dark:border-red-900/60 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer transition-colors"
              >
                전체 선택 해제
              </button>
            </div>
          </div>

          {/* Table Container (Independently scrollable with OPAQUE STICKY HEADER) */}
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto relative bg-white dark:bg-zinc-900">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 z-20 bg-zinc-100 dark:bg-zinc-800 shadow-xs border-b border-zinc-200 dark:border-zinc-700">
                <tr>
                  <th
                    onClick={() => handleToggleManageSelectionSort("type")}
                    className="p-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 font-semibold cursor-pointer select-none hover:bg-zinc-200/80 dark:hover:bg-zinc-700 transition-colors w-28 shrink-0"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>유형</span>
                      {renderSortIndicator("type")}
                    </div>
                  </th>
                  <th
                    onClick={() => handleToggleManageSelectionSort("company")}
                    className="p-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 font-semibold cursor-pointer select-none hover:bg-zinc-200/80 dark:hover:bg-zinc-700 transition-colors min-w-[280px]"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>기업명 / 브랜드</span>
                      {renderSortIndicator("company")}
                    </div>
                  </th>
                  <th
                    onClick={() => handleToggleManageSelectionSort("email")}
                    className="p-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 font-semibold cursor-pointer select-none hover:bg-zinc-200/80 dark:hover:bg-zinc-700 transition-colors min-w-[320px]"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>담당자 / 이메일</span>
                      {renderSortIndicator("email")}
                    </div>
                  </th>
                  <th
                    onClick={() => handleToggleManageSelectionSort("consent")}
                    className="p-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 font-semibold cursor-pointer select-none hover:bg-zinc-200/80 dark:hover:bg-zinc-700 transition-colors w-36 shrink-0"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>동의 상태</span>
                      {renderSortIndicator("consent")}
                    </div>
                  </th>
                  <th
                    onClick={() => handleToggleManageSelectionSort("eligibility")}
                    className="p-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 font-semibold cursor-pointer select-none hover:bg-zinc-200/80 dark:hover:bg-zinc-700 transition-colors w-36 shrink-0"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>발송 자격</span>
                      {renderSortIndicator("eligibility")}
                    </div>
                  </th>
                  <th className="p-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 font-semibold text-right w-20 shrink-0">
                    <span>제거</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 bg-white dark:bg-zinc-900">
                {filteredManageSelectionItems.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-12 text-center text-zinc-400 dark:text-zinc-500">
                      {selectedRecipientItems.length === 0
                        ? "선택된 수신 대상이 없습니다."
                        : "검색 조건과 일치하는 수신 대상이 없습니다."}
                    </td>
                  </tr>
                ) : (
                  filteredManageSelectionItems.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                    >
                      {/* 1. Recipient Type */}
                      <td className="p-3 align-middle w-28 shrink-0">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block ${
                            item.type === "COMPANY_CONTACT"
                              ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60"
                              : "bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/60"
                          }`}
                        >
                          {item.type === "COMPANY_CONTACT" ? "기업 연락처" : "수기 입력"}
                        </span>
                      </td>

                      {/* 2. Company / Brand */}
                      <td className="p-3 align-middle min-w-[280px]">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="font-semibold text-zinc-900 dark:text-zinc-100 truncate max-w-[260px]"
                            title={item.sharingCompanyNames.length > 1 ? item.sharingCompanyNames.join(", ") : item.companyNameKr}
                          >
                            {item.companyNameKr}
                          </span>
                          {item.sharedCompanyCount > 1 && (
                            <span
                              className="text-[10px] font-mono font-medium px-1.5 py-0.2 rounded bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 shrink-0"
                              title={`공유 기업: ${item.sharingCompanyNames.join(", ")}`}
                            >
                              외 {item.sharedCompanyCount - 1}개사
                            </span>
                          )}
                        </div>
                        {item.brandName && (
                          <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 truncate max-w-[260px]">
                            {item.brandName}
                          </div>
                        )}
                      </td>

                      {/* 3. Contact / Email */}
                      <td className="p-3 align-middle min-w-[320px]">
                        <div className="font-mono text-xs font-medium text-zinc-900 dark:text-zinc-100 whitespace-nowrap">
                          {item.email}
                        </div>
                        {item.contactName && (
                          <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-sans mt-0.5">
                            {item.contactName}
                          </div>
                        )}
                      </td>

                      {/* 4. Consent Status */}
                      <td className="p-3 align-middle w-36 shrink-0">
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded inline-block ${
                            item.consentStatus === "CONSENTED"
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                              : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700"
                          }`}
                        >
                          {item.consentStatus}
                        </span>
                      </td>

                      {/* 5. Send Eligibility */}
                      <td className="p-3 align-middle w-36 shrink-0">
                        {item.isSendable ? (
                          <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <span>✓</span>
                            <span>발송 가능</span>
                          </span>
                        ) : (
                          <span
                            className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1 cursor-help"
                            title={item.exclusionReason || "발송 조건 미충족"}
                          >
                            <span>⚠️</span>
                            <span>발송 제외</span>
                          </span>
                        )}
                      </td>

                      {/* 6. Remove Action */}
                      <td className="p-3 align-middle text-right w-20 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleRemoveRecipientItem(item)}
                          className="px-2.5 py-1 text-xs font-bold text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-md cursor-pointer transition-colors"
                        >
                          제거
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Modal Footer (Fixed, no scroll) */}
          <div className="flex items-center justify-between px-6 py-3.5 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900 shrink-0">
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              * 마케팅 동의 미확인 및 수기 입력 대상은 Strict Consent 필터 활성화 시 발송에서 자동 제외됩니다.
            </span>
            <button
              type="button"
              onClick={() => setShowManageSelectionModal(false)}
              className="px-5 py-2 text-xs font-bold rounded-lg bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-200 cursor-pointer shadow-xs transition-colors"
            >
              확인 및 닫기
            </button>
          </div>
        </div>
      </div>
    );
  };

  // --------------------------------------------------------------------------
  // RENDER: DELETE CONFIRMATION MODAL
  // --------------------------------------------------------------------------
  const renderDeleteConfirmModal = () => {
    if (!deleteConfirmTemplate) return null;

    return (
      <div className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg max-w-md w-full p-5 shadow-2xl space-y-4">
          <h3 className="text-sm font-bold text-red-600 dark:text-red-400">
            Confirm Delete Template
          </h3>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
            정말 <strong>&quot;{deleteConfirmTemplate.name}&quot;</strong> 템플릿을 삭제하시겠습니까?
            <br />
            * 이미 마케팅 캠페인에서 사용 중인 템플릿은 무결성을 위해 삭제가 제한되며 [보관(Archive)] 처리해야 합니다.
          </p>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => setDeleteConfirmTemplate(null)}
              className="px-3 py-1.5 text-xs font-semibold rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-700 dark:text-zinc-300 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleExecuteDelete}
              className="px-4 py-1.5 text-xs font-bold rounded bg-red-600 text-white hover:bg-red-700 cursor-pointer"
            >
              Delete Permanently
            </button>
          </div>
        </div>
      </div>
    );
  };

  // --------------------------------------------------------------------------
  // RENDER: CAMPAIGN DELETE CONFIRMATION MODAL (Task ADM-EMAIL-UX-001)
  // --------------------------------------------------------------------------
  const renderCampaignDeleteModal = () => {
    if (!deletingCampaign) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
        <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 max-w-md w-full p-5 space-y-4 shadow-xl">
          <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <span>🗑️</span> 캠페인 삭제 확인 (Confirm Campaign Deletion)
          </h4>

          <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
            캠페인 <strong className="text-zinc-900 dark:text-zinc-100">&quot;{deletingCampaign.name}&quot;</strong>을(를)
            정말 삭제하시겠습니까?
          </p>

          <div className="p-3 bg-zinc-50 dark:bg-zinc-950 rounded border border-zinc-200 dark:border-zinc-800 text-[11px] text-zinc-500 space-y-1">
            <p className="font-semibold text-zinc-700 dark:text-zinc-300">보안 및 정책 안내:</p>
            <p>• 임시저장(DRAFT) 또는 취소된 캠페인만 안전하게 삭제할 수 있습니다.</p>
            <p>• 승인(APPROVED) 및 발송 이력이 존재하는 캠페인은 감사 및 규정 준수를 위해 영구 삭제가 차단됩니다.</p>
            <p>• 삭제된 캠페인은 복구할 수 없습니다.</p>
          </div>

          {campaignDeleteError && (
            <div className="p-3 rounded bg-red-50 dark:bg-red-950/40 text-red-900 dark:text-red-200 border border-red-200 text-xs">
              {campaignDeleteError}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => {
                setDeletingCampaign(null);
                setCampaignDeleteError(null);
              }}
              disabled={isDeletingCampaign}
              className="px-3 py-1.5 text-xs font-semibold rounded border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer"
            >
              취소 (Cancel)
            </button>
            <button
              type="button"
              onClick={handleConfirmDeleteCampaign}
              disabled={isDeletingCampaign}
              className="px-3.5 py-1.5 text-xs font-bold rounded bg-red-600 text-white hover:bg-red-700 cursor-pointer shadow-xs disabled:opacity-50"
            >
              {isDeletingCampaign ? "삭제 중..." : "확인 및 삭제 실행"}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // --------------------------------------------------------------------------
  // RENDER: UNSAVED CHANGES NAVIGATION GUARD MODAL (Task ADM-EMAIL-UX-001 - P0)
  // --------------------------------------------------------------------------
  const renderUnsavedChangesModal = () => {
    if (!showUnsavedModal) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
        <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 max-w-md w-full p-5 space-y-4 shadow-xl">
          <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <span>⚠️</span> 저장되지 않은 변경사항 (Unsaved Changes)
          </h4>

          <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
            작성 중인 캠페인 <strong className="text-zinc-900 dark:text-zinc-100">&quot;{editingCampaign?.name || "새 캠페인"}&quot;</strong>에
            저장되지 않은 변경사항이 있습니다. 페이지를 벗어나면 수정 내용이 유실될 수 있습니다.
          </p>

          {saveAndLeaveError && (
            <div className="p-3 rounded bg-red-50 dark:bg-red-950/40 text-red-900 dark:text-red-200 border border-red-200 text-xs">
              {saveAndLeaveError}
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800 text-xs font-semibold">
            <button
              type="button"
              onClick={handleCancelLeave}
              disabled={isSavingAndLeaving}
              className="px-3 py-2 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 cursor-pointer order-3 sm:order-1"
            >
              계속 편집 (Cancel)
            </button>
            <button
              type="button"
              onClick={handleLeaveWithoutSaving}
              disabled={isSavingAndLeaving}
              className="px-3 py-2 rounded border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/50 cursor-pointer order-2"
            >
              저장하지 않고 이동 (Leave Without Saving)
            </button>
            <button
              type="button"
              onClick={handleSaveAndLeave}
              disabled={isSavingAndLeaving}
              className="px-3.5 py-2 rounded bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-white/90 cursor-pointer shadow-xs disabled:opacity-50 order-1 sm:order-3"
            >
              {isSavingAndLeaving ? "저장 중..." : "저장하고 이동 (Save & Leave)"}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`p-3 rounded-lg text-xs font-semibold shadow-xs ${
            notification.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border border-emerald-200"
              : "bg-red-50 dark:bg-red-950/60 text-red-800 dark:text-red-200 border border-red-200"
          }`}
        >
          {notification.text}
        </div>
      )}

      {/* Main Sub-tab Bar */}
      {renderSubTabBar()}

      {/* View Switcher based on mainTab & viewMode */}
      {mainTab === "suppression" ? (
        <SuppressionListView />
      ) : mainTab === "footer" ? (
        <MarketingFooterSettingsView />
      ) : mainTab === "library" ? (
        renderTemplateLibraryStandaloneView()
      ) : viewMode === "list" ? (
        renderCampaignList()
      ) : (
        renderCampaignEditor()
      )}

      {/* Modals */}
      {renderUploadModal()}
      {renderDuplicateModal()}
      {renderTemplatePreviewModal()}
      {renderFullPreviewModal()}
      {renderDeleteConfirmModal()}
      {renderManageSelectionModal()}
      {renderCampaignDeleteModal()}
      {renderUnsavedChangesModal()}
      <DesignerGuideModal isOpen={showGuideModal} onClose={() => setShowGuideModal(false)} />
    </div>
  );
}
