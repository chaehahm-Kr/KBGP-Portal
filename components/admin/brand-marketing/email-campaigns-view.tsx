"use client";

import React, { useState, useEffect, useMemo, useTransition, useRef } from "react";
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
import { stageLargeFiles } from "@/lib/files/stage-form-files";

interface EmailCampaignsViewProps {
  candidates?: any[];
}

export function EmailCampaignsView({ candidates = [] }: EmailCampaignsViewProps) {
  // Top-level Navigation Tabs
  const [mainTab, setMainTab] = useState<"campaigns" | "library" | "footer">("campaigns");

  // Campaign View Mode & Step
  const [viewMode, setViewMode] = useState<"list" | "editor">("list");
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [, startTransition] = useTransition();

  // Campaign List State
  const [campaigns, setCampaigns] = useState<MarketingCampaign[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [isLoadingList, setIsLoadingList] = useState(false);

  // Active Campaign in Editor
  const [editingCampaign, setEditingCampaign] = useState<MarketingCampaign | null>(null);

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

  // Recipient Selection State
  const [selectedGrades, setSelectedGrades] = useState<string[]>([]);
  const [selectedCompanyTypes, setSelectedCompanyTypes] = useState<string[]>([]);
  const [requireConsentedOnly, setRequireConsentedOnly] = useState(false);
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([]);
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [expandedContactCompanyIds, setExpandedContactCompanyIds] = useState<string[]>([]);

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
    });
  }, [activeTemplate, currentEffectiveSubject, editingCampaign, footerSettings]);

  // Filtered Candidates for Recipient Selection
  const filteredCandidates = useMemo(() => {
    return candidates.filter((c) => {
      if (selectedGrades.length > 0 && !selectedGrades.includes(c.grade || "UNRATED")) {
        return false;
      }
      if (selectedCompanyTypes.length > 0) {
        const types: string[] = c.business_types || [];
        const match = selectedCompanyTypes.some((t) => types.includes(t));
        if (!match) return false;
      }
      if (requireConsentedOnly && c.marketing_consent_status !== "CONSENTED") {
        return false;
      }
      return true;
    });
  }, [candidates, selectedGrades, selectedCompanyTypes, requireConsentedOnly]);

  useEffect(() => {
    if (viewMode === "editor" && currentStep === 3) {
      if (selectedCompanyIds.length === 0) {
        setSelectedCompanyIds(filteredCandidates.map((c) => c.id));
      }
      if (selectedContactIds.length === 0) {
        const allContacts: string[] = [];
        filteredCandidates.forEach((c) => {
          c.sourcing_contacts?.forEach((ct: any) => {
            if (ct.id) allContacts.push(ct.id);
          });
        });
        setSelectedContactIds(allContacts);
      }
    }
  }, [filteredCandidates.length, viewMode, currentStep]);

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
    setSelectedCompanyIds(candidates.map((c) => c.id));
    const allContacts: string[] = [];
    candidates.forEach((c) => {
      c.sourcing_contacts?.forEach((ct: any) => {
        if (ct.id) allContacts.push(ct.id);
      });
    });
    setSelectedContactIds(allContacts);
    setCurrentStep(1);
    setDryRunReport(null);
    setTestSendResult(null);
    setViewMode("editor");
  };

  const handleEditCampaign = async (c: MarketingCampaign) => {
    setEditingCampaign(c);
    if (c.templateId) setSelectedTemplateId(c.templateId);
    if (c.filterCriteria?.grades) setSelectedGrades(c.filterCriteria.grades);
    if (c.filterCriteria?.companyTypes) setSelectedCompanyTypes(c.filterCriteria.companyTypes);
    setRequireConsentedOnly(Boolean(c.filterCriteria?.requireConsentedOnly));
    if (c.filterCriteria?.companyIds) setSelectedCompanyIds(c.filterCriteria.companyIds);
    if (c.filterCriteria?.contactIds) setSelectedContactIds(c.filterCriteria.contactIds);

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
        filterCriteria: {
          grades: selectedGrades as any,
          companyTypes: selectedCompanyTypes,
          requireConsentedOnly,
          companyIds: selectedCompanyIds,
          contactIds: selectedContactIds,
        },
      };

      const res = await saveMarketingCampaignAction(payload);
      if (res.success && res.campaign) {
        setEditingCampaign(res.campaign);
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
        grades: selectedGrades as any,
        companyTypes: selectedCompanyTypes,
        requireConsentedOnly,
        companyIds: selectedCompanyIds,
        contactIds: selectedContactIds,
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
  // RENDER: TOP-LEVEL SUB-TAB BAR
  // --------------------------------------------------------------------------
  const renderSubTabBar = () => {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800 pb-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
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
          </button>
          <button
            type="button"
            onClick={() => setMainTab("library")}
            className={`px-3 py-1.5 text-xs font-bold rounded-md transition cursor-pointer ${
              mainTab === "library"
                ? "bg-zinc-950 text-white dark:bg-zinc-100 dark:text-zinc-950"
                : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            }`}
          >
            Template Library (템플릿 관리)
          </button>
          <button
            type="button"
            onClick={() => setMainTab("footer")}
            className={`px-3 py-1.5 text-xs font-bold rounded-md transition cursor-pointer flex items-center gap-1.5 ${
              mainTab === "footer"
                ? "bg-zinc-950 text-white dark:bg-zinc-100 dark:text-zinc-950"
                : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            }`}
          >
            <span>⚖️</span>
            Marketing Footer Settings (중앙 푸터 설정)
          </button>
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
  // RENDER: CAMPAIGN LIST VIEW
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
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500">Status:</span>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-2 py-1.5 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100"
            >
              <option value="ALL">All Statuses</option>
              <option value="DRAFT">DRAFT</option>
              <option value="TESTING">TESTING</option>
              <option value="READY_FOR_APPROVAL">READY_FOR_APPROVAL</option>
              <option value="APPROVED">APPROVED</option>
            </select>
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
                <th className="p-3">Created</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {campaigns.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-zinc-500">
                    No marketing campaigns found. Click &quot;+ Create Campaign&quot; to begin.
                  </td>
                </tr>
              ) : (
                campaigns
                  .filter((c) => {
                    if (filterStatus !== "ALL" && c.status !== filterStatus) return false;
                    if (searchQuery.trim() && !c.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
                    return true;
                  })
                  .map((c) => (
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
                      <td className="p-3 text-zinc-400 text-[11px]">
                        {new Date(c.createdAt).toLocaleDateString()}
                      </td>
                      <td className="p-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleEditCampaign(c)}
                          className="px-2.5 py-1 text-xs font-semibold rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-800 dark:text-zinc-200 cursor-pointer"
                        >
                          Edit / Open →
                        </button>
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // --------------------------------------------------------------------------
  // RENDER: TEMPLATE LIBRARY STANDALONE VIEW (Section 3)
  // --------------------------------------------------------------------------
  const renderTemplateLibraryStandaloneView = () => {
    return (
      <div className="space-y-6">
        {/* Filter & Search Bar */}
        <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 shadow-xs space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 text-xs">
            <div className="md:col-span-2">
              <input
                type="text"
                placeholder="Search templates by name or subject..."
                value={templateSearch}
                onChange={(e) => setTemplateSearch(e.target.value)}
                className="w-full px-3 py-1.5 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100"
              />
            </div>
            <div>
              <select
                value={templateFormatFilter}
                onChange={(e) => setTemplateFormatFilter(e.target.value as any)}
                className="w-full px-2 py-1.5 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100"
              >
                <option value="ALL">All Formats</option>
                <option value="HTML">📄 HTML Packages</option>
                <option value="IMAGE">🖼️ IMAGE Slices</option>
              </select>
            </div>
            <div>
              <select
                value={templateLangFilter}
                onChange={(e) => setTemplateLangFilter(e.target.value as any)}
                className="w-full px-2 py-1.5 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100"
              >
                <option value="ALL">All Languages</option>
                <option value="ko">한국어 (KO)</option>
                <option value="en">English (EN)</option>
              </select>
            </div>
            <div>
              <select
                value={templateStatusFilter}
                onChange={(e) => setTemplateStatusFilter(e.target.value as any)}
                className="w-full px-2 py-1.5 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active Only</option>
                <option value="ARCHIVED">Archived Only</option>
              </select>
            </div>
          </div>
        </div>

        {/* Templates Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.length === 0 ? (
            <div className="col-span-full p-12 text-center text-xs text-zinc-500 bg-zinc-50 dark:bg-zinc-900/40 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-800">
              No matching template packages found. Click &quot;+ Upload HTML / ZIP Package&quot; to add one.
            </div>
          ) : (
            filteredTemplates.map((tpl) => {
              const isImage = tpl.templateType === "IMAGE";
              const isArchived = tpl.status === "ARCHIVED";

              return (
                <div
                  key={tpl.id}
                  className={`rounded-lg border p-4 shadow-xs flex flex-col justify-between transition-all ${
                    isArchived
                      ? "border-zinc-300 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/50 opacity-75"
                      : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-400"
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                          isImage
                            ? "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300"
                            : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                        }`}
                      >
                        {isImage ? "🖼️ IMAGE" : "📄 HTML"}
                      </span>

                      <div className="flex items-center gap-1">
                        {tpl.isDefault && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                            Default
                          </span>
                        )}
                        {isArchived && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                            Archived
                          </span>
                        )}
                      </div>
                    </div>

                    <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 line-clamp-1">
                      {tpl.name}
                    </h4>

                    <p className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2 leading-relaxed">
                      {tpl.subject || "No default subject specified"}
                    </p>

                    <div className="text-[11px] text-zinc-400 flex items-center gap-3 pt-1">
                      <span>언어: <strong>{tpl.language === "ko" ? "한국어" : "English"}</strong></span>
                      <span>변수: <strong>{tpl.variables?.length || 4}개</strong></span>
                      {tpl.importedAssets && tpl.importedAssets.length > 0 && (
                        <span>호스팅 이미지: <strong>{tpl.importedAssets.length}개</strong></span>
                      )}
                    </div>
                  </div>

                  {/* Card Actions */}
                  <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 mt-4 flex items-center justify-between gap-1 text-xs">
                    <button
                      type="button"
                      onClick={() => setPreviewModalTemplate(tpl)}
                      className="px-2.5 py-1 text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 font-medium cursor-pointer"
                    >
                      🔍 Preview
                    </button>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => handleOpenDuplicateModal(tpl, e)}
                        className="px-2 py-1 text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 cursor-pointer"
                        title="Duplicate Template"
                      >
                        📋 복제
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleToggleArchiveTemplate(tpl, e)}
                        className="px-2 py-1 text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 cursor-pointer"
                        title={isArchived ? "Restore Template" : "Archive Template"}
                      >
                        {isArchived ? "↺ 복원" : "📦 보관"}
                      </button>
                      {!tpl.isDefault && (
                        <button
                          type="button"
                          onClick={(e) => handleDeleteTemplate(tpl, e)}
                          className="px-2 py-1 text-red-500 hover:text-red-700 cursor-pointer"
                          title="Delete Template"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
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
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 cursor-pointer"
              >
                ← Back to List
              </button>
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
            <button
              type="button"
              onClick={() => {
                setViewMode("list");
                refreshCampaignsAndTemplates();
              }}
              className="px-3 py-1.5 text-xs font-semibold rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>

        {/* 6-Step Stepper Navigation */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
          {steps.map((s) => (
            <button
              key={s.num}
              type="button"
              onClick={() => setCurrentStep(s.num)}
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
                onClick={() => setCurrentStep(2)}
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
            <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-5 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    2. Select Template Package
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    디자이너가 작성한 외부 완성형 이메일 패키지를 선택하거나 신규 업로드합니다.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowGuideModal(true)}
                    className="px-3 py-1.5 rounded text-xs font-semibold border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 cursor-pointer"
                  >
                    📖 Designer Guide &amp; AI Prompt
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenUploadModal}
                    className="px-3 py-1.5 rounded text-xs font-bold bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 hover:bg-zinc-800 cursor-pointer"
                  >
                    + Upload HTML / ZIP Package
                  </button>
                </div>
              </div>

              {/* Template Radio Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {templates.map((tpl) => {
                  const isSelected = tpl.id === selectedTemplateId;
                  const isImage = tpl.templateType === "IMAGE";
                  const isArchived = tpl.status === "ARCHIVED";

                  return (
                    <div
                      key={tpl.id}
                      onClick={() => setSelectedTemplateId(tpl.id)}
                      className={`p-3.5 rounded-lg border text-xs cursor-pointer transition-all flex flex-col justify-between ${
                        isSelected
                          ? "border-zinc-950 dark:border-white bg-zinc-50 dark:bg-zinc-800/80 shadow-xs ring-1 ring-zinc-950 dark:ring-white"
                          : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 hover:bg-zinc-50"
                      } ${isArchived ? "opacity-60" : ""}`}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                              isImage
                                ? "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300"
                                : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            }`}
                          >
                            {isImage ? "🖼️ IMAGE" : "📄 HTML"}
                          </span>
                          {tpl.isDefault && (
                            <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                              Default
                            </span>
                          )}
                        </div>
                        <div className="font-bold text-zinc-900 dark:text-zinc-100 line-clamp-1">{tpl.name}</div>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-2">
                          {tpl.subject}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/60 mt-3 flex items-center justify-between text-[10px] text-zinc-400">
                        <span>v{tpl.version} · {tpl.language.toUpperCase()}</span>
                        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => setPreviewModalTemplate(tpl)}
                            className="hover:text-zinc-800 underline"
                          >
                            Preview
                          </button>
                          <span>·</span>
                          <button
                            type="button"
                            onClick={(e) => handleOpenDuplicateModal(tpl, e)}
                            className="hover:text-zinc-800"
                          >
                            복제
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

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
                      Desktop (600px)
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
                      width: previewViewport === "desktop" ? "600px" : "375px",
                      maxWidth: "100%",
                      transition: "width 0.2s ease-in-out",
                    }}
                    className="bg-white rounded shadow-sm border border-zinc-200 overflow-hidden"
                  >
                    <iframe
                      title="Send-Ready Email Preview"
                      srcDoc={assembledPreviewHtml}
                      className="w-full h-[540px] border-0"
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
                    onClick={() => setCurrentStep(3)}
                    className="px-4 py-2 text-xs font-bold text-white bg-zinc-950 dark:bg-zinc-100 dark:text-zinc-950 rounded hover:bg-zinc-800 cursor-pointer"
                  >
                    Next: Recipient Selection →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 3: RECIPIENT SELECTION */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    3. Recipient Selection &amp; Commercial Consent Filter
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    타겟 등급, 사업자 유형 및 마케팅 동의 상태를 바탕으로 발송 대상 후보 기업을 필터링합니다.
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-zinc-500">선택된 수신 대상: </span>
                  <strong className="text-sm font-mono text-zinc-900 dark:text-zinc-100">
                    {selectedContactIds.length > 0 ? selectedContactIds.length : selectedCompanyIds.length} recipients ({selectedCompanyIds.length} / {filteredCandidates.length} companies)
                  </strong>
                </div>
              </div>

              {/* Candidates Table */}
              <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-x-auto max-h-[360px]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-50 dark:bg-zinc-800/60 sticky top-0">
                    <tr>
                      <th className="p-2.5 w-10">
                        <input
                          type="checkbox"
                          checked={selectedCompanyIds.length === filteredCandidates.length && filteredCandidates.length > 0}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedCompanyIds(filteredCandidates.map((c) => c.id));
                              const allContacts: string[] = [];
                              filteredCandidates.forEach((c) => {
                                c.sourcing_contacts?.forEach((ct: any) => {
                                  if (ct.id) allContacts.push(ct.id);
                                });
                              });
                              setSelectedContactIds(allContacts);
                            } else {
                              setSelectedCompanyIds([]);
                              setSelectedContactIds([]);
                            }
                          }}
                        />
                      </th>
                      <th className="p-2.5">Company Name</th>
                      <th className="p-2.5">Primary Brand</th>
                      <th className="p-2.5">Grade</th>
                      <th className="p-2.5">Contact Email</th>
                      <th className="p-2.5">Consent Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {filteredCandidates.map((c) => {
                      const isCompanyChecked = selectedCompanyIds.includes(c.id);
                      const brand = c.sourcing_brands?.[0]?.brand_name_kr || c.company_name_kr;
                      const contacts = c.sourcing_contacts || [];
                      const primaryContact = contacts.find((ct: any) => ct.is_primary) || contacts[0];
                      const totalContacts = contacts.length;
                      const isExpanded = expandedContactCompanyIds.includes(c.id);
                      const selectedContactsForComp = contacts.filter((ct: any) => selectedContactIds.includes(ct.id));

                      const toggleCompany = () => {
                        if (isCompanyChecked) {
                          setSelectedCompanyIds((prev) => prev.filter((id) => id !== c.id));
                          setSelectedContactIds((prev) =>
                            prev.filter((id) => !contacts.some((ct: any) => ct.id === id))
                          );
                        } else {
                          setSelectedCompanyIds((prev) => [...prev, c.id]);
                          const contactIdsToAdd = contacts.map((ct: any) => ct.id).filter(Boolean);
                          setSelectedContactIds((prev) => Array.from(new Set([...prev, ...contactIdsToAdd])));
                        }
                      };

                      const toggleContact = (contactId: string) => {
                        const isSelected = selectedContactIds.includes(contactId);
                        const updated = isSelected
                          ? selectedContactIds.filter((id) => id !== contactId)
                          : [...selectedContactIds, contactId];
                        setSelectedContactIds(updated);

                        const hasAny = contacts.some((ct: any) => updated.includes(ct.id));
                        if (hasAny && !selectedCompanyIds.includes(c.id)) {
                          setSelectedCompanyIds((prev) => [...prev, c.id]);
                        } else if (!hasAny && selectedCompanyIds.includes(c.id)) {
                          setSelectedCompanyIds((prev) => prev.filter((id) => id !== c.id));
                        }
                      };

                      return (
                        <React.Fragment key={c.id}>
                          <tr className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                            <td className="p-2.5">
                              <input
                                type="checkbox"
                                checked={isCompanyChecked}
                                onChange={toggleCompany}
                              />
                            </td>
                            <td className="p-2.5 font-bold text-zinc-900 dark:text-zinc-100">{c.company_name_kr}</td>
                            <td className="p-2.5 text-zinc-700 dark:text-zinc-300">{brand}</td>
                            <td className="p-2.5 font-mono">{c.grade}</td>
                            <td className="p-2.5 text-zinc-600 dark:text-zinc-400">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-mono text-xs">
                                  {primaryContact?.email || <span className="text-red-400">No email</span>}
                                </span>
                                {totalContacts > 1 && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setExpandedContactCompanyIds((prev) =>
                                        isExpanded ? prev.filter((id) => id !== c.id) : [...prev, c.id]
                                      )
                                    }
                                    className="text-[10px] font-semibold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 hover:bg-indigo-100 cursor-pointer flex items-center gap-1 border border-indigo-200 dark:border-indigo-800"
                                  >
                                    <span>{isExpanded ? "▲ 접기" : `▼ +${totalContacts - 1} 연락처 개별 선택`}</span>
                                    <span className="font-mono text-[9px] bg-indigo-200 dark:bg-indigo-900 px-1 rounded">
                                      {selectedContactsForComp.length}/{totalContacts}
                                    </span>
                                  </button>
                                )}
                              </div>
                            </td>
                            <td className="p-2.5">
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                                {c.marketing_consent_status || "UNCONFIRMED"}
                              </span>
                            </td>
                          </tr>
                          {isExpanded && totalContacts > 1 && (
                            <tr className="bg-indigo-50/30 dark:bg-indigo-950/20 border-b border-indigo-100 dark:border-indigo-900">
                              <td colSpan={6} className="p-2.5 pl-8">
                                <div className="space-y-2 border-l-2 border-indigo-500 pl-3">
                                  <div className="flex items-center justify-between text-[11px] text-zinc-600 dark:text-zinc-400">
                                    <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                                      개별 수신 대상 연락처 선택 ({selectedContactsForComp.length}/{totalContacts} 선택됨):
                                    </span>
                                    <span className="text-[10px] text-zinc-500">체크된 연락처로만 발송 시뮬레이션 및 캠페인이 진행됩니다.</span>
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                    {contacts.map((ct: any) => {
                                      const isCtChecked = selectedContactIds.includes(ct.id);
                                      return (
                                        <label
                                          key={ct.id}
                                          className={`flex items-center gap-2 p-2 rounded border text-xs cursor-pointer transition-colors ${
                                            isCtChecked
                                              ? "bg-white dark:bg-zinc-800 border-indigo-300 dark:border-indigo-700 shadow-xs"
                                              : "bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 opacity-60"
                                          }`}
                                        >
                                          <input
                                            type="checkbox"
                                            checked={isCtChecked}
                                            onChange={() => toggleContact(ct.id)}
                                            className="rounded border-zinc-300"
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
                                            <span className="font-mono text-[10px] text-zinc-500 dark:text-zinc-400 truncate">
                                              {ct.email || "이메일 없음"}
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
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="px-4 py-2 text-xs font-semibold text-zinc-600 hover:text-zinc-900 cursor-pointer"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep(4)}
                  className="px-4 py-2 text-xs font-bold text-white bg-zinc-950 dark:bg-zinc-100 dark:text-zinc-950 rounded hover:bg-zinc-800 cursor-pointer"
                >
                  Next: Sample Personalization Review →
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

            <div className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 flex justify-center">
              <div className="w-full max-w-[600px] bg-white rounded shadow-sm border border-zinc-200 overflow-hidden">
                <iframe
                  title="Sample Personalized Preview"
                  srcDoc={assembledPreviewHtml}
                  className="w-full h-[520px] border-0"
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
                onClick={() => setCurrentStep(5)}
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
                  onClick={() => setCurrentStep(6)}
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
            <button
              type="button"
              onClick={() => setPreviewModalTemplate(null)}
              className="text-zinc-400 hover:text-zinc-600 text-sm font-bold cursor-pointer"
            >
              ✕
            </button>
          </div>

          <div className="bg-zinc-100 dark:bg-zinc-950 p-4 rounded-lg flex justify-center overflow-x-auto flex-1 min-h-[420px]">
            <div className="w-[600px] max-w-full bg-white rounded shadow-sm border border-zinc-200 overflow-hidden">
              <iframe
                title="Template Preview"
                srcDoc={modalAssembledHtml}
                className="w-full h-[500px] border-0"
                sandbox="allow-same-origin"
              />
            </div>
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
      {mainTab === "footer" ? (
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
      {renderDeleteConfirmModal()}
      <DesignerGuideModal isOpen={showGuideModal} onClose={() => setShowGuideModal(false)} />
    </div>
  );
}
