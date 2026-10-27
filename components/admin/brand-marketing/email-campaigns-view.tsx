"use client";

import React, { useState, useEffect, useMemo, useTransition } from "react";
import {
  MarketingCampaign,
  MarketingTemplatePackage,
  CampaignStatus,
  DryRunReport,
  SampleRecipientPreview,
} from "@/lib/brand-marketing/campaign-types";
import {
  listMarketingTemplatesAction,
  uploadMarketingTemplateAction,
  listMarketingCampaignsAction,
  getMarketingCampaignByIdAction,
  saveMarketingCampaignAction,
  duplicateMarketingCampaignAction,
  archiveMarketingCampaignAction,
  runCampaignDryRunAction,
  sendTestCampaignEmailAction,
  approveMarketingCampaignAction,
} from "@/lib/brand-marketing/campaign-actions";
import { personalizeEmail } from "@/lib/brand-marketing/personalization-engine";

interface EmailCampaignsViewProps {
  candidates?: any[];
}

export function EmailCampaignsView({ candidates = [] }: EmailCampaignsViewProps) {
  // Navigation State
  const [viewMode, setViewMode] = useState<"list" | "editor">("list");
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isPending, startTransition] = useTransition();

  // Campaign List State
  const [campaigns, setCampaigns] = useState<MarketingCampaign[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [isLoadingList, setIsLoadingList] = useState(false);

  // Active Campaign in Editor
  const [editingCampaign, setEditingCampaign] = useState<MarketingCampaign | null>(null);

  // Template Library State
  const [templates, setTemplates] = useState<MarketingTemplatePackage[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [previewViewport, setPreviewViewport] = useState<"desktop" | "mobile">("desktop");

  // New Template Upload Form
  const [uploadName, setUploadName] = useState("");
  const [uploadSubject, setUploadSubject] = useState("");
  const [uploadPreviewText, setUploadPreviewText] = useState("");
  const [uploadHtml, setUploadHtml] = useState("");
  const [uploadLandingUrl, setUploadLandingUrl] = useState("https://www.kselectnetwork.com");
  const [uploadLanguage, setUploadLanguage] = useState<"ko" | "en">("ko");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadWarnings, setUploadWarnings] = useState<string[]>([]);

  // Recipient Selection State
  const [selectedGrades, setSelectedGrades] = useState<string[]>([]);
  const [selectedCompanyTypes, setSelectedCompanyTypes] = useState<string[]>([]);
  const [requireConsentedOnly, setRequireConsentedOnly] = useState(false);
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([]);

  // Dry Run & Test Send State
  const [dryRunReport, setDryRunReport] = useState<DryRunReport | null>(null);
  const [isRunningDryRun, setIsRunningDryRun] = useState(false);
  const [testEmailAddress, setTestEmailAddress] = useState("test@letusto.com");
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testSendResult, setTestSendResult] = useState<{ success?: boolean; message?: string } | null>(null);

  // Audit Logs State
  const [campaignLogs, setCampaignLogs] = useState<any[]>([]);

  // Feedback notifications
  const [notification, setNotification] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // --------------------------------------------------------------------------
  // INITIAL DATA LOADING
  // --------------------------------------------------------------------------
  const refreshCampaignsAndTemplates = async () => {
    setIsLoadingList(true);
    try {
      const [cRes, tRes] = await Promise.all([
        listMarketingCampaignsAction(),
        listMarketingTemplatesAction(),
      ]);
      if (cRes.success && cRes.campaigns) {
        setCampaigns(cRes.campaigns);
      }
      if (tRes.success && tRes.templates) {
        setTemplates(tRes.templates);
        if (tRes.templates.length > 0 && !selectedTemplateId) {
          setSelectedTemplateId(tRes.templates[0].id);
        }
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

  const showNotification = (type: "success" | "error", text: string) => {
    setNotification({ type, text });
    setTimeout(() => setNotification(null), 4000);
  };

  // Currently selected template object
  const activeTemplate = useMemo(() => {
    return templates.find((t) => t.id === selectedTemplateId) || templates[0] || null;
  }, [templates, selectedTemplateId]);

  // --------------------------------------------------------------------------
  // FILTERED CANDIDATES FOR RECIPIENT SELECTION
  // --------------------------------------------------------------------------
  const filteredCandidates = useMemo(() => {
    return candidates.filter((c) => {
      // Grade filter
      if (selectedGrades.length > 0 && !selectedGrades.includes(c.grade || "UNRATED")) {
        return false;
      }
      // Company type filter
      if (selectedCompanyTypes.length > 0) {
        const types: string[] = c.business_types || [];
        const match = selectedCompanyTypes.some((t) => types.includes(t));
        if (!match) return false;
      }
      // Consent filter
      if (requireConsentedOnly && c.marketing_consent_status !== "CONSENTED") {
        return false;
      }
      return true;
    });
  }, [candidates, selectedGrades, selectedCompanyTypes, requireConsentedOnly]);

  // Auto-select filtered candidate IDs when filter changes
  useEffect(() => {
    if (viewMode === "editor" && currentStep === 3) {
      setSelectedCompanyIds(filteredCandidates.map((c) => c.id));
    }
  }, [filteredCandidates.length, viewMode, currentStep]);

  // --------------------------------------------------------------------------
  // ACTIONS: CREATE / EDIT / SAVE CAMPAIGN
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
      status: "DRAFT",
      approvalStatus: "PENDING",
      isLiveModeEnabled: false, // STRICTLY FALSE
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

    try {
      const detailRes = await getMarketingCampaignByIdAction(c.id);
      if (detailRes.logs) setCampaignLogs(detailRes.logs);
    } catch {}

    setCurrentStep(1);
    setDryRunReport(null);
    setTestSendResult(null);
    setViewMode("editor");
  };

  const handleSaveDraft = async () => {
    if (!editingCampaign) return;
    try {
      const res = await saveMarketingCampaignAction({
        ...editingCampaign,
        templateId: selectedTemplateId,
        filterCriteria: {
          grades: selectedGrades as any,
          companyTypes: selectedCompanyTypes,
          requireConsentedOnly,
          companyIds: selectedCompanyIds,
        },
      });

      if (res.success && res.campaign) {
        setEditingCampaign(res.campaign);
        showNotification("success", "Campaign draft saved successfully.");
        refreshCampaignsAndTemplates();
      } else {
        showNotification("error", res.error || "Failed to save campaign");
      }
    } catch (err: any) {
      showNotification("error", err.message);
    }
  };

  const handleDuplicateCampaign = async (campaignId: string) => {
    try {
      const res = await duplicateMarketingCampaignAction(campaignId);
      if (res.success) {
        showNotification("success", "Campaign duplicated as new draft.");
        refreshCampaignsAndTemplates();
      } else {
        showNotification("error", res.error || "Duplicate failed");
      }
    } catch (err: any) {
      showNotification("error", err.message);
    }
  };

  const handleArchiveCampaign = async (campaignId: string) => {
    if (!confirm("Are you sure you want to archive this campaign?")) return;
    try {
      const res = await archiveMarketingCampaignAction(campaignId);
      if (res.success) {
        showNotification("success", "Campaign archived.");
        refreshCampaignsAndTemplates();
      } else {
        showNotification("error", res.error || "Archive failed");
      }
    } catch (err: any) {
      showNotification("error", err.message);
    }
  };

  // --------------------------------------------------------------------------
  // ACTIONS: TEMPLATE UPLOAD
  // --------------------------------------------------------------------------
  const handleUploadTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError(null);
    setUploadWarnings([]);

    if (!uploadName.trim() || !uploadSubject.trim() || !uploadHtml.trim()) {
      setUploadError("Template Name, Subject, and HTML content are required.");
      return;
    }

    try {
      const res = await uploadMarketingTemplateAction({
        name: uploadName,
        subject: uploadSubject,
        previewText: uploadPreviewText,
        htmlContent: uploadHtml,
        landingPageUrl: uploadLandingUrl,
        language: uploadLanguage,
      });

      if (res.success && res.template) {
        setTemplates((prev) => [res.template!, ...prev]);
        setSelectedTemplateId(res.template.id);
        setShowUploadModal(false);
        showNotification("success", "Template uploaded and sanitized successfully!");
        if (res.warnings && res.warnings.length > 0) {
          setUploadWarnings(res.warnings);
        }
        // Reset form
        setUploadName("");
        setUploadSubject("");
        setUploadPreviewText("");
        setUploadHtml("");
      } else {
        setUploadError(res.error || "Failed to upload template");
      }
    } catch (err: any) {
      setUploadError(err.message);
    }
  };

  // --------------------------------------------------------------------------
  // ACTIONS: TEST EMAIL & DRY RUN
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
      });

      if (res.success && res.report) {
        setDryRunReport(res.report);
        showNotification("success", "Dry run evaluation completed! 0 external emails sent.");
      } else {
        showNotification("error", res.error || "Dry run failed");
      }
    } catch (err: any) {
      showNotification("error", err.message);
    } finally {
      setIsRunningDryRun(false);
    }
  };

  const handleSendTestEmail = async () => {
    if (!editingCampaign || !activeTemplate) return;
    if (!testEmailAddress.trim()) {
      alert("Please enter a valid allowlisted test email address.");
      return;
    }

    setIsSendingTest(true);
    setTestSendResult(null);

    try {
      const res = await sendTestCampaignEmailAction(
        editingCampaign.id,
        testEmailAddress.trim(),
        activeTemplate.subject,
        activeTemplate.htmlContent,
        activeTemplate.plainText
      );

      if (res.success) {
        setTestSendResult({
          success: true,
          message: `Test email successfully accepted by provider! Message ID: ${res.messageId || "simulated-ok"}`,
        });
        showNotification("success", "Test email sent to allowlisted address.");
      } else {
        setTestSendResult({
          success: false,
          message: res.error || "Test dispatch rejected.",
        });
        showNotification("error", res.error || "Test email failed");
      }
    } catch (err: any) {
      setTestSendResult({ success: false, message: err.message });
      showNotification("error", err.message);
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleApproveCampaign = async () => {
    if (!editingCampaign) return;
    if (!dryRunReport) {
      alert("A completed Dry Run is required before approval.");
      return;
    }

    try {
      // Ensure campaign is persisted to server before approving
      const saveRes = await saveMarketingCampaignAction({
        ...editingCampaign,
        templateId: selectedTemplateId,
        filterCriteria: {
          grades: selectedGrades as any,
          companyTypes: selectedCompanyTypes,
          requireConsentedOnly,
          companyIds: selectedCompanyIds,
        },
      });

      if (!saveRes.success || !saveRes.campaign) {
        showNotification("error", saveRes.error || "Failed to persist campaign before approval");
        return;
      }

      const res = await approveMarketingCampaignAction(editingCampaign.id);
      if (res.success && res.campaign) {
        setEditingCampaign(res.campaign);
        showNotification("success", "Campaign approved and release snapshot locked!");
        refreshCampaignsAndTemplates();
      } else {
        showNotification("error", res.error || "Approval failed");
      }
    } catch (err: any) {
      showNotification("error", err.message);
    }
  };

  // --------------------------------------------------------------------------
  // RENDER: NOTIFICATION BANNER
  // --------------------------------------------------------------------------
  const renderNotification = () => {
    if (!notification) return null;
    return (
      <div
        className={`p-3 rounded-lg text-xs font-medium flex items-center justify-between shadow-sm animate-fade-in ${
          notification.type === "success"
            ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800"
            : "bg-red-50 dark:bg-red-950/60 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800"
        }`}
      >
        <span>{notification.text}</span>
        <button
          type="button"
          onClick={() => setNotification(null)}
          className="ml-2 font-bold cursor-pointer"
        >
          ✕
        </button>
      </div>
    );
  };

  // --------------------------------------------------------------------------
  // RENDER: CAMPAIGN LIST VIEW (STATE 1)
  // --------------------------------------------------------------------------
  const renderCampaignList = () => {
    const filtered = campaigns.filter((c) => {
      if (filterStatus !== "ALL" && c.status !== filterStatus) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          c.name.toLowerCase().includes(q) ||
          c.purpose.toLowerCase().includes(q) ||
          (c.description || "").toLowerCase().includes(q)
        );
      }
      return true;
    });

    return (
      <div className="space-y-6">
        {/* Global Safety Header */}
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-900 dark:text-amber-200">
          <div className="flex items-center gap-2.5">
            <span className="text-base font-bold">🔒</span>
            <div>
              <span className="font-bold block">
                PHASE 2 SAFETY GUARD: LIVE_MODE LOCKED (DISABLED)
              </span>
              <p className="text-[11px] text-amber-800 dark:text-amber-300/90 mt-0.5">
                V1 authorizes campaign design, template packages, dry runs, and allowlisted test sends. External commercial sending is disabled.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowUploadModal(true)}
              className="px-3 py-1.5 rounded bg-white dark:bg-zinc-900 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 hover:bg-amber-100 font-semibold cursor-pointer"
            >
              Template Library ({templates.length})
            </button>
            <button
              type="button"
              onClick={handleCreateNewCampaign}
              className="px-3.5 py-1.5 rounded bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 font-bold hover:bg-zinc-800 dark:hover:bg-zinc-200 cursor-pointer shadow-xs"
            >
              + Create Campaign
            </button>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-white dark:bg-zinc-900 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-xs">
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder="Search campaigns by name, purpose, or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-3 pr-8 py-1.5 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-1 focus:ring-zinc-950"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-2 text-xs text-zinc-400 hover:text-zinc-600"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-1.5 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100"
            >
              <option value="ALL">All Statuses ({campaigns.length})</option>
              <option value="DRAFT">DRAFT</option>
              <option value="TESTING">TESTING</option>
              <option value="READY_FOR_APPROVAL">READY_FOR_APPROVAL</option>
              <option value="APPROVED">APPROVED</option>
              <option value="SCHEDULED">SCHEDULED</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>
          </div>
        </div>

        {/* Campaign Cards List */}
        {isLoadingList ? (
          <div className="p-12 text-center text-zinc-400 text-xs">
            Loading campaigns...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center bg-white dark:bg-zinc-900 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-800 space-y-3">
            <div className="text-2xl text-zinc-400">✉️</div>
            <p className="text-xs text-zinc-500 font-medium">
              No email campaigns found. Start by creating a new outreach campaign.
            </p>
            <button
              type="button"
              onClick={handleCreateNewCampaign}
              className="px-4 py-2 rounded text-xs font-bold text-white bg-zinc-950 dark:bg-zinc-100 dark:text-zinc-950 hover:bg-zinc-800 cursor-pointer"
            >
              + Create First Campaign
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((c) => {
              const tpl = templates.find((t) => t.id === c.templateId);
              return (
                <div
                  key={c.id}
                  className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-5 shadow-xs flex flex-col justify-between hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="inline-block px-2 py-0.5 text-[10px] font-semibold rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 mb-1">
                          {c.purpose}
                        </span>
                        <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 line-clamp-1">
                          {c.name}
                        </h3>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          c.status === "APPROVED"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300"
                            : c.status === "READY_FOR_APPROVAL"
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                            : c.status === "TESTING"
                            ? "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300"
                            : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                        }`}
                      >
                        {c.status}
                      </span>
                    </div>

                    {c.description && (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-relaxed">
                        {c.description}
                      </p>
                    )}

                    <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80 text-[11px] text-zinc-500 space-y-1">
                      <div className="flex justify-between">
                        <span>Template:</span>
                        <strong className="text-zinc-700 dark:text-zinc-300 truncate max-w-[180px]">
                          {tpl?.name || "Default Template"}
                        </strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Language:</span>
                        <span className="font-mono text-zinc-700 dark:text-zinc-300 uppercase">
                          {c.language}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Approval:</span>
                        <span
                          className={`font-semibold ${
                            c.approvalStatus === "APPROVED"
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-zinc-400"
                          }`}
                        >
                          {c.approvalStatus === "APPROVED" ? "✓ Approved" : "Pending"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-4 border-t border-zinc-100 dark:border-zinc-800 mt-4">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleEditCampaign(c)}
                        className="px-3 py-1.5 text-xs font-bold rounded bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-200 cursor-pointer"
                      >
                        Open Editor
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDuplicateCampaign(c.id)}
                        className="px-2.5 py-1.5 text-xs font-semibold rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 cursor-pointer"
                        title="Duplicate campaign"
                      >
                        Duplicate
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleArchiveCampaign(c.id)}
                      className="text-xs text-red-500 hover:text-red-700 p-1 cursor-pointer"
                      title="Archive campaign"
                    >
                      Archive
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // --------------------------------------------------------------------------
  // RENDER: CAMPAIGN EDITOR (STEP-BY-STEP FLOW)
  // --------------------------------------------------------------------------
  const renderCampaignEditor = () => {
    if (!editingCampaign) return null;

    const steps = [
      { num: 1, label: "1. Info & Settings" },
      { num: 2, label: "2. Template Package" },
      { num: 3, label: "3. Recipient Selection" },
      { num: 4, label: "4. Personalization & Samples" },
      { num: 5, label: "5. Test Send & Dry Run" },
      { num: 6, label: "6. Approval & Activity" },
    ];

    return (
      <div className="space-y-6">
        {/* Editor Top Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white dark:bg-zinc-900 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-xs">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setViewMode("list");
                refreshCampaignsAndTemplates();
              }}
              className="text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer"
            >
              ← Back to Campaigns
            </button>
            <span className="text-zinc-300 dark:text-zinc-700">|</span>
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                {editingCampaign.name}
              </h2>
              <span className="text-[11px] text-zinc-400">
                Status: <strong>{editingCampaign.status}</strong> · Approval:{" "}
                <strong>{editingCampaign.approvalStatus}</strong>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSaveDraft}
              className="px-3.5 py-1.5 text-xs font-semibold rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-200 cursor-pointer"
            >
              Save Draft
            </button>
            <button
              type="button"
              onClick={() => {
                setViewMode("list");
                refreshCampaignsAndTemplates();
              }}
              className="px-3.5 py-1.5 text-xs font-bold rounded bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 hover:bg-zinc-800 cursor-pointer"
            >
              Done & Exit
            </button>
          </div>
        </div>

        {/* Step Stepper Tabs */}
        <div className="flex items-center overflow-x-auto border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-lg p-2 gap-1 shadow-xs">
          {steps.map((st) => (
            <button
              key={st.num}
              type="button"
              onClick={() => setCurrentStep(st.num)}
              className={`px-3 py-2 text-xs font-semibold rounded-md whitespace-nowrap transition-colors cursor-pointer ${
                currentStep === st.num
                  ? "bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 shadow-xs"
                  : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>

        {/* STEP 1: BASIC INFO & SETTINGS */}
        {currentStep === 1 && (
          <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6 space-y-4 max-w-4xl shadow-xs">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 border-b border-zinc-100 dark:border-zinc-800 pb-3">
              1. Campaign Information & Global Personalization
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Campaign Name *
                </label>
                <input
                  type="text"
                  value={editingCampaign.name}
                  onChange={(e) =>
                    setEditingCampaign({ ...editingCampaign, name: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Campaign Purpose
                </label>
                <select
                  value={editingCampaign.purpose}
                  onChange={(e) =>
                    setEditingCampaign({ ...editingCampaign, purpose: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100"
                >
                  <option value="Brand Outreach">Brand Outreach (바이어 큐레이션 입점 제안)</option>
                  <option value="Partnership Inquiry">Partnership Inquiry (유통/무역 파트너십)</option>
                  <option value="OEM/ODM Sourcing">OEM/ODM Sourcing (제조 협력사 발굴)</option>
                  <option value="Custom Campaign">Custom Campaign (맞춤형 커뮤니케이션)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Language (언어 설정)
                </label>
                <select
                  value={editingCampaign.language}
                  onChange={(e) =>
                    setEditingCampaign({ ...editingCampaign, language: e.target.value as any })
                  }
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
                  value={editingCampaign.scheduledAt ? editingCampaign.scheduledAt.slice(0, 16) : ""}
                  onChange={(e) =>
                    setEditingCampaign({
                      ...editingCampaign,
                      scheduledAt: e.target.value ? new Date(e.target.value).toISOString() : null,
                    })
                  }
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
                  onChange={(e) =>
                    setEditingCampaign({ ...editingCampaign, description: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Global Custom Message (&#123;&#123;custom_message&#125;&#125; 변수에 삽입될 공통 본문)
                </label>
                <textarea
                  rows={4}
                  placeholder="예: 귀사의 대표 라인업인 클렌징 및 스킨케어 제품군의 뛰어난 성분 처방과 시장 반응을 확인하였으며, 당사의 150+ 북미 리테일러 입점 큐레이션 프로그램에 모시고자 합니다."
                  value={editingCampaign.customMessage || ""}
                  onChange={(e) =>
                    setEditingCampaign({ ...editingCampaign, customMessage: e.target.value })
                  }
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

        {/* STEP 2: TEMPLATE PACKAGE & RESPONSIVE PREVIEW */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-5 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    2. External Designer Template Package Library
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    디자이너가 작성한 외부 완성형 이메일 패키지를 선택하거나 신규 업로드합니다.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowUploadModal(true)}
                  className="px-3 py-1.5 rounded text-xs font-bold bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 hover:bg-zinc-800 cursor-pointer"
                >
                  + Upload Designer Package
                </button>
              </div>

              {/* Template Radio Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {templates.map((tpl) => {
                  const isSelected = tpl.id === selectedTemplateId;
                  return (
                    <div
                      key={tpl.id}
                      onClick={() => setSelectedTemplateId(tpl.id)}
                      className={`p-3.5 rounded-lg border text-xs cursor-pointer transition-all ${
                        isSelected
                          ? "border-zinc-950 dark:border-white bg-zinc-50 dark:bg-zinc-800/80 shadow-xs ring-1 ring-zinc-950 dark:ring-white"
                          : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 hover:bg-zinc-50 dark:hover:bg-zinc-850"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-bold text-zinc-900 dark:text-zinc-100 truncate">
                          {tpl.name}
                        </span>
                        {tpl.isDefault && (
                          <span className="text-[9px] px-1.5 py-0.2 bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 rounded font-bold">
                            Default
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-500 line-clamp-1 mb-2">
                        제목: {tpl.subject}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-zinc-400">
                        <span>v{tpl.version}</span>
                        <span>·</span>
                        <span className="uppercase">{tpl.language}</span>
                        <span>·</span>
                        <span>{tpl.variables?.length || 4} variables</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Live Visual Preview Card (Desktop vs Mobile Toggle) */}
            {activeTemplate && (
              <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
                  <div>
                    <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                      Live Visual Template Preview: {activeTemplate.name}
                    </h4>
                    <span className="text-[11px] text-zinc-500">
                      Subject: <strong>{activeTemplate.subject}</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-md text-xs">
                    <button
                      type="button"
                      onClick={() => setPreviewViewport("desktop")}
                      className={`px-2.5 py-1 rounded text-xs font-semibold cursor-pointer ${
                        previewViewport === "desktop"
                          ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs"
                          : "text-zinc-500 hover:text-zinc-900"
                      }`}
                    >
                      🖥️ Desktop (600px)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewViewport("mobile")}
                      className={`px-2.5 py-1 rounded text-xs font-semibold cursor-pointer ${
                        previewViewport === "mobile"
                          ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs"
                          : "text-zinc-500 hover:text-zinc-900"
                      }`}
                    >
                      📱 Mobile (375px)
                    </button>
                  </div>
                </div>

                {/* Sandboxed Iframe Preview */}
                <div className="p-4 bg-zinc-100 dark:bg-zinc-950 rounded-lg flex justify-center overflow-x-auto min-h-[500px]">
                  <div
                    style={{
                      width: previewViewport === "desktop" ? "620px" : "375px",
                      transition: "width 0.2s ease-in-out",
                    }}
                    className="bg-white rounded-lg shadow-md border border-zinc-200 overflow-hidden"
                  >
                    <iframe
                      srcDoc={activeTemplate.htmlContent}
                      title="Email Preview"
                      sandbox="allow-same-origin"
                      className="w-full h-[650px] border-none"
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

        {/* STEP 3: RECIPIENT SELECTION & FILTERING */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-5 shadow-xs space-y-4">
              <div className="border-b border-zinc-100 dark:border-zinc-800 pb-3">
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  3. Candidate Sourcing Recipient Selection
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Brand Marketing 후보 기업 중 타겟팅 기준에 맞는 수신 대상 기업 및 담당자를 필터링합니다.
                </p>
              </div>

              {/* Filter Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-zinc-50 dark:bg-zinc-850/60 rounded-lg text-xs">
                {/* Grade Filter */}
                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Grade Filter (후보 등급)
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {["A", "B", "C", "UNRATED"].map((g) => {
                      const checked = selectedGrades.includes(g);
                      return (
                        <button
                          key={g}
                          type="button"
                          onClick={() => {
                            setSelectedGrades((prev) =>
                              checked ? prev.filter((x) => x !== g) : [...prev, g]
                            );
                          }}
                          className={`px-2.5 py-1 text-xs font-bold rounded border cursor-pointer ${
                            checked
                              ? "bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 border-zinc-950"
                              : "bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200"
                          }`}
                        >
                          {g}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Company Type Filter */}
                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Company Type (회사 유형)
                  </label>
                  <div className="flex flex-wrap gap-1">
                    {[
                      { val: "BRAND_OWNER", label: "브랜드" },
                      { val: "MANUFACTURER", label: "제조사" },
                      { val: "OEM_ODM", label: "OEM/ODM" },
                      { val: "DISTRIBUTOR", label: "유통사" },
                    ].map((bt) => {
                      const checked = selectedCompanyTypes.includes(bt.val);
                      return (
                        <button
                          key={bt.val}
                          type="button"
                          onClick={() => {
                            setSelectedCompanyTypes((prev) =>
                              checked ? prev.filter((x) => x !== bt.val) : [...prev, bt.val]
                            );
                          }}
                          className={`px-2 py-0.5 text-[11px] font-semibold rounded border cursor-pointer ${
                            checked
                              ? "bg-blue-600 text-white border-blue-600"
                              : "bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200"
                          }`}
                        >
                          {bt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Consent Guard Policy */}
                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Commercial Email Consent Guard
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer mt-1">
                    <input
                      type="checkbox"
                      checked={requireConsentedOnly}
                      onChange={(e) => setRequireConsentedOnly(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-zinc-700 dark:text-zinc-300 text-[11px]">
                      엄격 동의 확인 대상만 발송 (Exclude unconfirmed consent)
                    </span>
                  </label>
                </div>
              </div>

              {/* Selection Summary Pill */}
              <div className="flex items-center justify-between text-xs text-zinc-500 px-1">
                <span>
                  Matching Candidates: <strong>{filteredCandidates.length}</strong> (Selected:{" "}
                  <strong>{selectedCompanyIds.length}</strong>)
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (selectedCompanyIds.length === filteredCandidates.length) {
                      setSelectedCompanyIds([]);
                    } else {
                      setSelectedCompanyIds(filteredCandidates.map((c) => c.id));
                    }
                  }}
                  className="text-xs text-blue-600 dark:text-blue-400 font-bold underline cursor-pointer"
                >
                  {selectedCompanyIds.length === filteredCandidates.length
                    ? "Deselect All"
                    : "Select All Matching"}
                </button>
              </div>

              {/* Table of Candidates */}
              <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-x-auto max-h-[380px]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 sticky top-0">
                    <tr>
                      <th className="p-2.5 w-10">Select</th>
                      <th className="p-2.5">Company</th>
                      <th className="p-2.5">Brand</th>
                      <th className="p-2.5">Grade</th>
                      <th className="p-2.5">Contact Email</th>
                      <th className="p-2.5">Consent Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {filteredCandidates.map((c) => {
                      const isChecked = selectedCompanyIds.includes(c.id);
                      const contact = c.sourcing_contacts?.[0];
                      const brand = c.sourcing_brands?.[0]?.brand_name_kr || c.company_name_kr;
                      return (
                        <tr
                          key={c.id}
                          onClick={() => {
                            setSelectedCompanyIds((prev) =>
                              isChecked ? prev.filter((id) => id !== c.id) : [...prev, c.id]
                            );
                          }}
                          className={`cursor-pointer transition-colors ${
                            isChecked
                              ? "bg-blue-50/50 dark:bg-blue-950/30"
                              : "hover:bg-zinc-50 dark:hover:bg-zinc-850"
                          }`}
                        >
                          <td className="p-2.5" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                setSelectedCompanyIds((prev) =>
                                  isChecked ? prev.filter((id) => id !== c.id) : [...prev, c.id]
                                );
                              }}
                              className="rounded text-blue-600"
                            />
                          </td>
                          <td className="p-2.5 font-bold text-zinc-900 dark:text-zinc-100">
                            {c.company_name_kr}
                          </td>
                          <td className="p-2.5 text-zinc-700 dark:text-zinc-300">{brand}</td>
                          <td className="p-2.5">
                            <span className="font-mono font-bold text-[11px]">{c.grade}</span>
                          </td>
                          <td className="p-2.5 font-mono text-[11px] text-zinc-600 dark:text-zinc-400">
                            {contact?.email || <span className="text-red-400">No email</span>}
                          </td>
                          <td className="p-2.5">
                            <span
                              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                                c.marketing_consent_status === "CONSENTED"
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                  : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                              }`}
                            >
                              {c.marketing_consent_status || "UNCONFIRMED"}
                            </span>
                          </td>
                        </tr>
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

        {/* STEP 4: PERSONALIZATION & SAMPLE RECIPIENT REVIEWS (MANDATORY REQUIREMENT 6.C) */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-5 shadow-xs space-y-4">
              <div className="border-b border-zinc-100 dark:border-zinc-800 pb-3">
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  4. Sample Recipient Review (Mandatory Pre-send Verification)
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  선택된 후보 기업 중 3-5개의 실제 데이터를 바탕으로 치환된 개인화 변수 및 렌더링 결과를 사전 검증합니다. 외부 발송은 발생하지 않습니다.
                </p>
              </div>

              {/* Sample Previews Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {candidates
                  .filter((c) => selectedCompanyIds.includes(c.id))
                  .slice(0, 4)
                  .map((c, sIdx) => {
                    const primaryBrand =
                      c.sourcing_brands?.[0]?.brand_name_kr || c.company_name_kr;
                    const contact = c.sourcing_contacts?.[0];
                    const rendered = activeTemplate
                      ? personalizeEmail(
                          activeTemplate.subject,
                          activeTemplate.htmlContent,
                          activeTemplate.plainText,
                          {
                            companyName: c.company_name_kr,
                            contactName: contact?.name,
                            brandName: primaryBrand,
                            customMessage: editingCampaign.customMessage,
                            language: editingCampaign.language,
                          }
                        )
                      : null;

                    return (
                      <div
                        key={c.id || sIdx}
                        className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/60 space-y-3 text-xs"
                      >
                        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2">
                          <span className="font-bold text-zinc-900 dark:text-zinc-100">
                            Sample #{sIdx + 1}: {c.company_name_kr}
                          </span>
                          <span className="font-mono text-[10px] text-zinc-500">
                            {contact?.email || "No email"}
                          </span>
                        </div>

                        <div className="space-y-1 text-[11px] text-zinc-600 dark:text-zinc-400">
                          <div>
                            Resolved Subject:{" "}
                            <strong className="text-zinc-800 dark:text-zinc-200">
                              {rendered?.subject}
                            </strong>
                          </div>
                          <div>
                            Variable Values:{" "}
                            <span className="bg-white dark:bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-700 font-mono text-[10px]">
                              company={c.company_name_kr} | contact={contact?.name || "담당자님"} | brand={primaryBrand}
                            </span>
                          </div>
                        </div>

                        {/* Mini Iframe for Sample */}
                        {rendered && (
                          <div className="border border-zinc-200 dark:border-zinc-700 rounded bg-white overflow-hidden h-[240px]">
                            <iframe
                              srcDoc={rendered.html}
                              title={`Sample ${sIdx}`}
                              sandbox="allow-same-origin"
                              className="w-full h-full border-none"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
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
                  Next: Test Send & Dry Run →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 5: TEST EMAIL & DRY RUN (MANDATORY REQUIREMENT 6.B & 6.D) */}
        {currentStep === 5 && (
          <div className="space-y-6">
            {/* Action 1: Test Email to Allowlisted Internal Address */}
            <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-5 shadow-xs space-y-4">
              <div className="border-b border-zinc-100 dark:border-zinc-800 pb-3">
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  5.A Test Email Dispatch (Controlled Allowlist Only)
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  안전한 검증을 위해 오직 인가된 내부 테스트 도메인(@letusto.com, @kselectnetwork.com)으로만 실제 전송이 허용됩니다. 외부 후보사 주소로는 발송되지 않습니다.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <input
                  type="email"
                  value={testEmailAddress}
                  onChange={(e) => setTestEmailAddress(e.target.value)}
                  placeholder="allowlisted-admin@letusto.com"
                  className="flex-1 px-3 py-2 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100"
                />
                <button
                  type="button"
                  disabled={isSendingTest}
                  onClick={handleSendTestEmail}
                  className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {isSendingTest ? "Sending..." : "Send Test Email ✉️"}
                </button>
              </div>

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
            </div>

            {/* Action 2: Campaign Dry Run (Zero External Sends) */}
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

              {/* Dry Run Report Results Card */}
              {dryRunReport && (
                <div className="space-y-4 p-4 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-zinc-900 dark:text-zinc-100">
                      Dry Run Validation Summary
                    </span>
                    <span className="text-[11px] text-zinc-400">
                      Generated at: {new Date(dryRunReport.timestamp).toLocaleTimeString()}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="p-3 rounded bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700">
                      <span className="text-zinc-400 block text-[10px]">Total Candidates</span>
                      <strong className="text-base text-zinc-900 dark:text-zinc-100">
                        {dryRunReport.totalCandidatesEvaluated}
                      </strong>
                    </div>

                    <div className="p-3 rounded bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200">
                      <span className="block text-[10px]">Sendable Recipients</span>
                      <strong className="text-base font-bold">
                        {dryRunReport.sendableCount}
                      </strong>
                    </div>

                    <div className="p-3 rounded bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200">
                      <span className="block text-[10px]">Excluded / Filtered</span>
                      <strong className="text-base font-bold">
                        {dryRunReport.excludedCount}
                      </strong>
                    </div>

                    <div className="p-3 rounded bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700">
                      <span className="text-zinc-400 block text-[10px]">Duplicates Deduplicated</span>
                      <strong className="text-base text-zinc-900 dark:text-zinc-100">
                        {dryRunReport.duplicateEmailsFiltered}
                      </strong>
                    </div>
                  </div>

                  <div className="p-3 rounded bg-zinc-100 dark:bg-zinc-900 text-[11px] text-zinc-600 dark:text-zinc-400 space-y-1">
                    <div>Sender Identity: <strong>{dryRunReport.senderIdentity}</strong></div>
                    <div>Compliance Check: <strong className="text-emerald-600">PASS (Zero external dispatch)</strong></div>
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
                  Next: Final Approval & Activity →
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
                  6. Final Approval Workflow & Release Snapshot
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  캠페인을 승인 상태로 고정(Lock)합니다. 승인 후 템플릿, 수신자 또는 본문 수정 시 무결성을 위해 승인이 자동 무효화(INVALIDATED)됩니다.
                </p>
              </div>

              {/* Approval Status Card */}
              <div className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                    Approval State:
                  </span>
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
                      className="w-full py-2.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer shadow-xs"
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

              {/* Sending Engine Simulator (LIVE_MODE DISABLED) */}
              <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs space-y-2">
                <span className="font-bold text-amber-900 dark:text-amber-200">
                  Sending Engine Status: TEST_MODE ONLY
                </span>
                <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
                  본 개발 단계(ADM-BSRC-006)에서는 실제 외부 대량 발송(LIVE_MODE)이 비활성화되어 있습니다. 승인된 캠페인은 시뮬레이션 및 내부 모니터링 로그로 안전하게 관리됩니다.
                </p>
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
                            <td className="p-2 font-bold text-zinc-800 dark:text-zinc-200">
                              {l.eventType}
                            </td>
                            <td className="p-2 font-mono text-[10px]">
                              {l.isTestMode ? "TEST_MODE" : "LIVE_MODE"}
                            </td>
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
                  Save & Return to Campaign List
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // --------------------------------------------------------------------------
  // RENDER: TEMPLATE UPLOAD MODAL
  // --------------------------------------------------------------------------
  const renderUploadModal = () => {
    if (!showUploadModal) return null;
    return (
      <div className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
            <div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                Upload External Designer Template Package
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                외부 디자이너가 작성한 완성형 HTML 이메일 마크업을 업로드합니다.
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

          <form onSubmit={handleUploadTemplate} className="space-y-3 text-xs">
            {uploadError && (
              <div className="p-3 rounded bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-200 border border-red-200">
                {uploadError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Template Name *
                </label>
                <input
                  type="text"
                  placeholder="예: 2026 Fall Buyer Outreach - Korean"
                  value={uploadName}
                  onChange={(e) => setUploadName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Language *
                </label>
                <select
                  value={uploadLanguage}
                  onChange={(e) => setUploadLanguage(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100"
                >
                  <option value="ko">한국어 (Korean)</option>
                  <option value="en">English (글로벌)</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Email Subject * (Supports &#123;&#123;company_name&#125;&#125;, &#123;&#123;brand_name&#125;&#125;)
                </label>
                <input
                  type="text"
                  placeholder="예: [K SELECT] {{company_name}}의 북미 리테일 입점 제안서"
                  value={uploadSubject}
                  onChange={(e) => setUploadSubject(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Preview Text (사전보기 텍스트)
                </label>
                <input
                  type="text"
                  placeholder="메일 목록에서 제목 옆에 노출되는 한 줄 요약 문구"
                  value={uploadPreviewText}
                  onChange={(e) => setUploadPreviewText(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Landing Page URL
                </label>
                <input
                  type="url"
                  placeholder="https://www.kselectnetwork.com"
                  value={uploadLandingUrl}
                  onChange={(e) => setUploadLandingUrl(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div className="sm:col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-zinc-700 dark:text-zinc-300">
                    Designer Email HTML *
                  </label>
                  <span className="text-[10px] text-zinc-400">
                    Supports &#123;&#123;company_name&#125;&#125;, &#123;&#123;contact_name&#125;&#125;, &#123;&#123;brand_name&#125;&#125;, &#123;&#123;custom_message&#125;&#125;
                  </span>
                </div>
                <textarea
                  rows={8}
                  placeholder="<!DOCTYPE html><html><body>...</body></html>"
                  value={uploadHtml}
                  onChange={(e) => setUploadHtml(e.target.value)}
                  className="w-full px-3 py-2 font-mono text-[11px] rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 leading-relaxed"
                />
              </div>
            </div>

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
                className="px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded cursor-pointer"
              >
                Sanitize & Save Package
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {renderNotification()}
      {viewMode === "list" ? renderCampaignList() : renderCampaignEditor()}
      {renderUploadModal()}
    </div>
  );
}
