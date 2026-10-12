"use client";

import React, { useState, useEffect } from "react";
import type { ContentProductItem } from "@/lib/product/content-actions";
import type {
  AIOutputType,
  AssetStatus,
  AssetTypeFilter,
  CreationSettings,
  GenerationJob,
  MediaAssetItem,
  SourceGroupType,
  SourceMaterialItem,
  TargetAudience,
  UsageTarget,
} from "@/lib/product/media-asset-types";
import {
  getMediaSourceMaterials,
  uploadMediaSourceMaterial,
  uploadMultipleMediaSourceMaterials,
  deleteMediaSourceMaterial,
  getMediaAssets,
  getGenerationJobs,
  createAIMediaJob,
  updateDraftMediaAsset,
  approveMediaAsset,
  editApprovedAsNewDraft,
  deleteDraftMediaAsset,
  archiveMediaAsset,
  restoreMediaAsset,
  deleteMultipleMediaAssets,
  archiveMultipleMediaAssets,
} from "@/lib/product/media-asset-actions";

// Icons
function TrashIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}

function SparklesIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  );
}

function ImageIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function VideoIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  );
}

function FileTextIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function CheckCircleIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function AlertTriangleIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
}

function PlusIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  );
}

function DownloadIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  );
}

function RotateCcwIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}

function EditIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  );
}

function InfoIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function ArchiveIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v1a2 2 0 01-2 2M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
    </svg>
  );
}

function XIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

interface MediaAssetsWorkspaceProps {
  product: ContentProductItem;
  initialSources?: SourceMaterialItem[];
  initialAssets?: MediaAssetItem[];
  initialJobs?: GenerationJob[];
}

type MainTab = "sources" | "create" | "drafts" | "approved";
type DraftSubFilter = "all" | "valid" | "failed" | "legacy";
type ApprovedSubTab = "active" | "archived";

export function MediaAssetsWorkspace({
  product,
  initialSources = [],
  initialAssets = [],
  initialJobs = [],
}: MediaAssetsWorkspaceProps) {
  const [activeMainTab, setActiveMainTab] = useState<MainTab>("sources");

  // Sub-filters & Views
  const [draftSubFilter, setDraftSubFilter] = useState<DraftSubFilter>("all");
  const [approvedSubTab, setApprovedSubTab] = useState<ApprovedSubTab>("active");

  // Data states
  const [sources, setSources] = useState<SourceMaterialItem[]>(initialSources);
  const [assets, setAssets] = useState<MediaAssetItem[]>(initialAssets);
  const [jobs, setJobs] = useState<GenerationJob[]>(initialJobs);

  // Default Source Selection Persistence (Requirements 2 & 3)
  const [useForAiSourceIds, setUseForAiSourceIds] = useState<string[]>([]);

  // Bulk Selection States (Requirements 7 & 10)
  const [selectedDraftIds, setSelectedDraftIds] = useState<string[]>([]);
  const [selectedApprovedIds, setSelectedApprovedIds] = useState<string[]>([]);

  // Toast message
  const [toast, setToast] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);

  const showToast = (text: string, type: "success" | "error" | "info" = "success") => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Helper date formatter (Requirement 6 & 13)
  const formatDateTime = (isoString?: string) => {
    if (!isoString) return "";
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  // Fetch live data on mount
  useEffect(() => {
    async function loadData() {
      const [srcData, astData, jobData] = await Promise.all([
        getMediaSourceMaterials(product.id),
        getMediaAssets(product.id),
        getGenerationJobs(product.id),
      ]);
      setSources(srcData);
      setAssets(astData);
      setJobs(jobData);
    }
    loadData();
  }, [product.id]);

  // Load / Sync Use for AI source selection persistence
  useEffect(() => {
    if (sources.length > 0) {
      const storageKey = `kselect_ai_sources_${product.id}`;
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setUseForAiSourceIds(parsed);
        } catch (e) {
          setUseForAiSourceIds(sources.map((s) => s.id));
        }
      } else {
        setUseForAiSourceIds(sources.map((s) => s.id));
      }
    }
  }, [sources, product.id]);

  const toggleUseForAi = (sourceId: string) => {
    setUseForAiSourceIds((prev) => {
      const updated = prev.includes(sourceId)
        ? prev.filter((id) => id !== sourceId)
        : [...prev, sourceId];
      localStorage.setItem(`kselect_ai_sources_${product.id}`, JSON.stringify(updated));
      return updated;
    });
  };

  // AI Creation states (Step 1 & 2)
  const [selectedOutputType, setSelectedOutputType] = useState<AIOutputType>("benefit_graphic");
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
  const [creationSettings, setCreationSettings] = useState<CreationSettings>({
    purpose: "Customer Product Page & Marketing Banner",
    audience: "both",
    style: "Clean Professional Studio Photography",
    language: "English",
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);

  // Sync Step 2 with Use for AI selection when outputType or useForAiSourceIds changes
  useEffect(() => {
    if (useForAiSourceIds.length > 0) {
      setSelectedSourceIds([...useForAiSourceIds]);
    } else if (sources.length > 0) {
      setSelectedSourceIds(sources.map((s) => s.id));
    }
  }, [selectedOutputType, useForAiSourceIds, sources]);

  // Upload modal states
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadGroup, setUploadGroup] = useState<SourceGroupType>("product_media");
  const [uploadTitle, setUploadTitle] = useState("");
  const [selectedUploadFiles, setSelectedUploadFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // Modals & Highlight states
  const [editingAsset, setEditingAsset] = useState<MediaAssetItem | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editTextLayers, setEditTextLayers] = useState<any[]>([]);
  const [editScenes, setEditScenes] = useState<any[]>([]);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const [approvingAsset, setApprovingAsset] = useState<MediaAssetItem | null>(null);
  const [checkInfoAccurate, setCheckInfoAccurate] = useState(false);
  const [checkCorrectVisual, setCheckCorrectVisual] = useState(false);
  const [checkReadyForUse, setCheckReadyForUse] = useState(false);
  const [targetUsage, setTargetUsage] = useState<UsageTarget[]>(["customer_page"]);
  const [isApproving, setIsApproving] = useState(false);

  const [editAsNewDraftModalAsset, setEditAsNewDraftModalAsset] = useState<MediaAssetItem | null>(null);
  const [editAsNewDraftTitle, setEditAsNewDraftTitle] = useState("");
  const [isCreatingNewDraftVersion, setIsCreatingNewDraftVersion] = useState(false);

  const [lineageAsset, setLineageAsset] = useState<MediaAssetItem | null>(null);
  const [previewAsset, setPreviewAsset] = useState<MediaAssetItem | null>(null);
  const [viewDetailsAsset, setViewDetailsAsset] = useState<MediaAssetItem | null>(null);
  const [highlightedDraftId, setHighlightedDraftId] = useState<string | null>(null);

  // Filters
  const [typeFilter, setTypeFilter] = useState<AssetTypeFilter>("all");

  const filterAssets = (items: MediaAssetItem[]) => {
    if (typeFilter === "all") return items;
    return items.filter((item) => item.asset_type === typeFilter);
  };

  const draftAssets = assets.filter((a) => a.status === "draft" || a.status === "failed");
  const activeApprovedAssets = assets.filter((a) => a.status === "approved");
  const archivedAssets = assets.filter((a) => a.status === "archived");

  // Handler: Batch Upload Sources (Requirement 4)
  const handleBatchUploadSources = async () => {
    if (selectedUploadFiles.length === 0) return;
    setIsUploading(true);

    const fileItems = selectedUploadFiles.map((f, idx) => ({
      file: f,
      title: uploadTitle ? (selectedUploadFiles.length > 1 ? `${uploadTitle} (${idx + 1})` : uploadTitle) : f.name,
    }));

    const res = await uploadMultipleMediaSourceMaterials(product.id, uploadGroup, fileItems);
    setIsUploading(false);

    if (res.success && res.sources) {
      setSources((prev) => [...res.sources!, ...prev]);
      setUseForAiSourceIds((prev) => [...prev, ...res.sources!.map((s) => s.id)]);
      setShowUploadModal(false);
      setUploadTitle("");
      setSelectedUploadFiles([]);
      showToast(`${res.sources.length} source material(s) uploaded`);
    } else {
      alert(res.errors?.join("\n") || "Failed to upload files");
    }
  };

  // Handler: Delete Manual Source (Requirement 3)
  const handleDeleteSource = async (sourceId: string) => {
    if (!confirm("Are you sure you want to delete this manual source material?")) return;
    const res = await deleteMediaSourceMaterial(sourceId);
    if (res.success) {
      setSources((prev) => prev.filter((s) => s.id !== sourceId));
      setUseForAiSourceIds((prev) => prev.filter((id) => id !== sourceId));
      showToast("Manual source material deleted");
      if (res.warning) alert(res.warning);
    } else {
      alert(res.error || "Failed to delete source material");
    }
  };

  // Handler: Single Delete Draft Asset
  const handleDeleteDraft = async (assetId: string) => {
    if (!confirm("Are you sure you want to delete this draft asset?")) return;
    const res = await deleteDraftMediaAsset(assetId);
    if (res.success) {
      setAssets((prev) => prev.filter((a) => a.id !== assetId));
      setSelectedDraftIds((prev) => prev.filter((id) => id !== assetId));
      showToast("Draft asset deleted");
    } else {
      alert(res.error || "Failed to delete draft asset");
    }
  };

  // Handler: Bulk Delete Draft Assets (Requirement 7)
  const handleBulkDeleteDrafts = async () => {
    if (selectedDraftIds.length === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedDraftIds.length} selected draft asset(s)?`)) return;

    const res = await deleteMultipleMediaAssets(selectedDraftIds);
    if (res.success) {
      setAssets((prev) => prev.filter((a) => !selectedDraftIds.includes(a.id)));
      showToast(`${res.deletedCount} draft asset(s) deleted permanently`);
      setSelectedDraftIds([]);
    } else {
      alert(res.error || "Failed to delete selected draft assets");
    }
  };

  // Handler: Bulk Archive Approved Assets (Requirement 10)
  const handleBulkArchiveApproved = async () => {
    if (selectedApprovedIds.length === 0) return;
    if (!confirm(`Are you sure you want to archive ${selectedApprovedIds.length} selected approved asset(s)?`)) return;

    const res = await archiveMultipleMediaAssets(selectedApprovedIds);
    if (res.success) {
      setAssets((prev) =>
        prev.map((a) => (selectedApprovedIds.includes(a.id) ? { ...a, status: "archived" as AssetStatus } : a))
      );
      showToast(`${res.archivedCount} approved asset(s) archived`);
      setSelectedApprovedIds([]);
    } else {
      alert(res.error || "Failed to archive selected assets");
    }
  };

  // Handler: Bulk Delete Approved Assets Permanently (Requirement 10 & 12)
  const handleBulkDeleteApprovedPermanently = async () => {
    if (selectedApprovedIds.length === 0) return;
    if (!confirm(`CRITICAL WARNING: Are you sure you want to PERMANENTLY DELETE ${selectedApprovedIds.length} approved asset(s)? This action cannot be undone.`)) return;

    const res = await deleteMultipleMediaAssets(selectedApprovedIds);
    if (res.success) {
      setAssets((prev) => prev.filter((a) => !selectedApprovedIds.includes(a.id)));
      showToast(`${res.deletedCount} asset(s) permanently deleted`);
      setSelectedApprovedIds([]);
    } else {
      alert(res.error || "Failed to delete selected approved assets");
    }
  };

  // Handler: Restore Archived Asset (Requirement 11)
  const handleRestoreAsset = async (assetId: string) => {
    const res = await restoreMediaAsset(assetId);
    if (res.success) {
      setAssets((prev) =>
        prev.map((a) => (a.id === assetId ? { ...a, status: "approved" as AssetStatus } : a))
      );
      showToast("Asset restored to Active Approved Library");
    } else {
      alert(res.error || "Failed to restore asset");
    }
  };

  // Handle Create with AI Job Submission
  const handleGenerateAI = async () => {
    setIsGenerating(true);
    setGenerationError(null);

    const res = await createAIMediaJob(product.id, selectedOutputType, creationSettings, selectedSourceIds);
    setIsGenerating(false);

    if (res.asset) {
      setAssets((prev) => [res.asset!, ...prev]);
    }
    if (res.job) {
      setJobs((prev) => [res.job!, ...prev]);
    }

    if (!res.success) {
      setGenerationError(res.error || "AI generation failed or unsupported");
    }
    setActiveMainTab("drafts");
    showToast("New AI generation job submitted");
  };

  // Retry Failed Generation (Requirement 8)
  const handleRetryGeneration = async (outputType: string) => {
    const validAIOutputTypes: AIOutputType[] = [
      "benefit_graphic",
      "infographic",
      "how_to_graphic",
      "lifestyle_image",
      "product_video",
      "how_to_video",
    ];
    if (validAIOutputTypes.includes(outputType as AIOutputType)) {
      setSelectedOutputType(outputType as AIOutputType);
    } else {
      setSelectedOutputType("benefit_graphic");
    }
    setActiveMainTab("create");
  };

  // Open Edit Modal
  const openEditModal = (asset: MediaAssetItem) => {
    setEditingAsset(asset);
    setEditTitle(asset.title);
    setEditTextLayers(asset.content_data.text_layers || []);
    setEditScenes(asset.content_data.scenes || []);
  };

  const handleSaveEdit = async () => {
    if (!editingAsset) return;
    setIsSavingEdit(true);

    const updatedData = {
      ...editingAsset.content_data,
      text_layers: editTextLayers,
      scenes: editScenes,
    };

    const res = await updateDraftMediaAsset(editingAsset.id, editTitle, updatedData);
    setIsSavingEdit(false);

    if (res.success) {
      setAssets((prev) =>
        prev.map((a) => (a.id === editingAsset.id ? { ...a, title: editTitle, content_data: updatedData } : a))
      );
      setEditingAsset(null);
      showToast("Draft edits saved");
    } else {
      alert(res.error || "Failed to save edits");
    }
  };

  // Handle Approve
  const handleApprove = async () => {
    if (!approvingAsset) return;
    if (!checkInfoAccurate || !checkCorrectVisual || !checkReadyForUse) {
      alert("Please confirm all 3 verification checklist items before approving.");
      return;
    }

    setIsApproving(true);
    const res = await approveMediaAsset(approvingAsset.id, targetUsage);
    setIsApproving(false);

    if (res.success) {
      setAssets((prev) =>
        prev.map((a) =>
          a.id === approvingAsset.id
            ? { ...a, status: "approved" as AssetStatus, approved_at: new Date().toISOString(), used_in: targetUsage }
            : a
        )
      );
      setApprovingAsset(null);
      setActiveMainTab("approved");
      showToast("Draft asset approved and published to Approved Library");
    } else {
      alert(res.error || "Failed to approve asset");
    }
  };

  // Open Edit as New Draft Version Naming Modal
  const openEditAsNewDraftModal = (approvedAsset: MediaAssetItem) => {
    const nextVersion = (approvedAsset.version || 1) + 1;
    setEditAsNewDraftModalAsset(approvedAsset);
    setEditAsNewDraftTitle(`${approvedAsset.title} — v${nextVersion} Draft`);
  };

  // Confirm Edit as New Draft Version
  const handleConfirmCreateNewDraftVersion = async () => {
    if (!editAsNewDraftModalAsset) return;
    setIsCreatingNewDraftVersion(true);

    const res = await editApprovedAsNewDraft(editAsNewDraftModalAsset.id, editAsNewDraftTitle);
    setIsCreatingNewDraftVersion(false);

    if (res.success && res.newAsset) {
      setAssets((prev) => [res.newAsset!, ...prev]);
      setEditAsNewDraftModalAsset(null);
      setHighlightedDraftId(res.newAsset.id);
      setActiveMainTab("drafts");
      showToast(`Draft v${res.newAsset.version} created successfully!`);

      setTimeout(() => {
        setHighlightedDraftId(null);
      }, 4000);
    } else {
      alert(res.error || "Failed to create new draft version");
    }
  };

  // Handle Single Archive
  const handleArchive = async (assetId: string) => {
    if (!confirm("Are you sure you want to archive this asset?")) return;
    const res = await archiveMediaAsset(assetId);
    if (res.success) {
      setAssets((prev) =>
        prev.map((a) => (a.id === assetId ? { ...a, status: "archived" as AssetStatus } : a))
      );
      showToast("Asset archived");
    }
  };

  // Helper: Download Stored Media File (Requirements 8, 9, 14, 15)
  const handleDownloadAsset = (url?: string, filename?: string) => {
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || "media_asset";
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast("Starting download...");
  };

  // Filtered Drafts computation (Requirement 5)
  const filteredDrafts = filterAssets(draftAssets).filter((asset) => {
    const isFailed = asset.status === "failed" || !!asset.content_data?.error_message || asset.content_data?.provider_info?.generation_status === "failed";
    const isLegacy = !asset.storage_path || asset.storage_path.endsWith(".svg") || asset.content_data?.is_mock;
    const isValid = !isFailed && !isLegacy;

    if (draftSubFilter === "valid") return isValid;
    if (draftSubFilter === "failed") return isFailed;
    if (draftSubFilter === "legacy") return isLegacy;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-2xl text-xs font-bold flex items-center gap-2 border transition-all ${
            toast.type === "error"
              ? "bg-rose-900 text-rose-100 border-rose-700"
              : toast.type === "info"
              ? "bg-indigo-900 text-indigo-100 border-indigo-700"
              : "bg-zinc-900 text-zinc-100 border-zinc-700 dark:bg-zinc-100 dark:text-zinc-900"
          }`}
        >
          <SparklesIcon className="w-4 h-4 text-indigo-400 shrink-0" />
          <span>{toast.text}</span>
        </div>
      )}

      {/* WORKSPACE SUMMARY HEADER TILES (Requirement 19) */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <span>{product.name} — Media Assets Workspace</span>
              <span className="text-[10.5px] font-mono font-semibold px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                {product.brand_name}
              </span>
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Source selection, AI asset generation, quality review, and production-ready library management.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setActiveMainTab("create")}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <SparklesIcon className="w-4 h-4" />
            <span>Create with AI</span>
          </button>
        </div>

        {/* 3 SUMMARY TILES */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <button
            type="button"
            data-testid="summary-sources-card"
            onClick={() => setActiveMainTab("sources")}
            className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
              activeMainTab === "sources"
                ? "bg-indigo-50/60 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-800"
                : "bg-zinc-50 dark:bg-zinc-850 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            }`}
          >
            <div>
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
                Source Materials
              </span>
              <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100 block">
                {sources.length} <span className="text-xs font-medium text-zinc-500">Items</span>
              </span>
              <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold block">
                {useForAiSourceIds.length} Selected for AI
              </span>
            </div>
            <FileTextIcon className="w-6 h-6 text-zinc-400" />
          </button>

          <button
            type="button"
            data-testid="summary-drafts-card"
            onClick={() => setActiveMainTab("drafts")}
            className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
              activeMainTab === "drafts"
                ? "bg-amber-50/60 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800"
                : "bg-zinc-50 dark:bg-zinc-850 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            }`}
          >
            <div>
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
                Draft Assets
              </span>
              <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100 block">
                {draftAssets.length} <span className="text-xs font-medium text-zinc-500">Drafts</span>
              </span>
              <span className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold block">
                {draftAssets.filter((a) => a.status === "failed" || a.content_data?.error_message).length} Failed Action Needed
              </span>
            </div>
            <EditIcon className="w-6 h-6 text-amber-500" />
          </button>

          <button
            type="button"
            data-testid="summary-approved-card"
            onClick={() => setActiveMainTab("approved")}
            className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
              activeMainTab === "approved"
                ? "bg-emerald-50/60 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800"
                : "bg-zinc-50 dark:bg-zinc-850 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            }`}
          >
            <div>
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
                Approved Assets
              </span>
              <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100 block">
                {activeApprovedAssets.length} <span className="text-xs font-medium text-zinc-500">Active</span>
              </span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold block">
                {activeApprovedAssets.filter((a) => !!a.storage_path && !a.storage_path.endsWith(".svg") && !a.content_data?.is_mock).length} Valid Production Media
              </span>
            </div>
            <CheckCircleIcon className="w-6 h-6 text-emerald-500" />
          </button>
        </div>
      </div>

      {/* MAIN WORKSPACE TABS NAVIGATION */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-800 gap-1 overflow-x-auto">
        {[
          { id: "sources", label: "1. Source Materials", count: sources.length },
          { id: "create", label: "2. Create with AI" },
          { id: "drafts", label: "3. Drafts", count: draftAssets.length },
          { id: "approved", label: "4. Approved Assets", count: activeApprovedAssets.length },
        ].map((tab) => {
          const isActive = activeMainTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveMainTab(tab.id as MainTab)}
              className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
                isActive
                  ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400"
                  : "border-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
              }`}
            >
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    isActive
                      ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                      : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB 1: SOURCE MATERIALS (GRID VIEW & DEFAULT AI SELECTION - Requirements 1 & 2) */}
      {activeMainTab === "sources" && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-2xs space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                Product Source Materials ({sources.length} Total Sources)
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Authoritative catalog details, registered packshots, brand guide, and marketing references. Use checkboxes to set default AI generation sources.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedUploadFiles([]);
                setShowUploadModal(true);
              }}
              className="px-3 py-1.5 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-xs font-bold rounded-xl hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <PlusIcon className="w-3.5 h-3.5" />
              <span>Add Source Material</span>
            </button>
          </div>

          <div className="space-y-6">
            {[
              { id: "product_info", title: "A. Product Info (Catalog Authoritative Data)", desc: "Product name, description, bullet points, how to use" },
              { id: "product_media", title: "B. Product Images & Videos", desc: "Main image, packshots, gallery images, product videos" },
              { id: "brand_materials", title: "C. Brand Materials", desc: "Logo, brand story, visual reference guidelines" },
              { id: "existing_content", title: "D. Existing Content", desc: "Amazon details, brochures, social media marketing assets" },
              { id: "reference_files", title: "E. Reference Files", desc: "PDF guides, lab tests, product reference documents" },
            ].map((group) => {
              const groupItems = sources.filter((s) => s.group_type === group.id);
              const isInfoGroup = group.id === "product_info";
              const isVisualGridGroup = group.id === "product_media" || group.id === "brand_materials";

              return (
                <div key={group.id} className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                  <div className="bg-zinc-50 dark:bg-zinc-850 px-4 py-2.5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">{group.title}</span>
                      <span className="text-[11px] text-zinc-500 dark:text-zinc-400 block">{group.desc}</span>
                    </div>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300">
                      {isInfoGroup ? "Authoritative Catalog Data" : `${groupItems.length} items`}
                    </span>
                  </div>

                  {isInfoGroup ? (
                    <div className="p-3 bg-white dark:bg-zinc-900">
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {[
                          { title: "Product Name & Brand", desc: `Synced (${product.brand_name})` },
                          { title: "Description & Summary", desc: "Synced from Catalog" },
                          { title: "Bullet Points & Highlights", desc: "Synced from Catalog" },
                          { title: "How to Use Directions", desc: "Synced from Catalog" },
                          { title: "Ingredients & Formula", desc: "Synced from Catalog" },
                          { title: "Product Attributes", desc: "Synced from Catalog" },
                        ].map((item, i) => (
                          <div key={i} className="p-2.5 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-900/40 rounded-lg flex items-center gap-2">
                            <CheckCircleIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            <div>
                              <span className="text-[11px] font-bold text-zinc-900 dark:text-zinc-100 block">{item.title}</span>
                              <span className="text-[10px] text-zinc-500">{item.desc}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : isVisualGridGroup ? (
                    /* THUMBNAIL GRID VIEW FOR VISUAL SOURCES (Requirement 1) */
                    <div className="p-3 bg-white dark:bg-zinc-900">
                      {groupItems.length === 0 ? (
                        <div className="py-4 text-center text-xs text-zinc-400 font-medium">
                          No visual materials in this group yet.
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                          {groupItems.map((item) => {
                            const isBrandSynced = item.id.startsWith("brand-mat-") || item.group_type === "brand_materials";
                            const isCatalogSynced =
                              item.id.startsWith("info-cat-") ||
                              item.id.startsWith("img-cat-") ||
                              item.id.startsWith("vid-cat-") ||
                              item.source_type === "catalog_sync";
                            const isUseForAi = useForAiSourceIds.includes(item.id);

                            return (
                              <div
                                key={item.id}
                                className={`border rounded-xl p-2.5 flex flex-col justify-between space-y-2 relative transition-all ${
                                  isUseForAi
                                    ? "border-indigo-300 dark:border-indigo-800 bg-indigo-50/20 dark:bg-indigo-950/10"
                                    : "border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-850 opacity-75"
                                }`}
                              >
                                <div className="aspect-square rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/60 dark:border-zinc-700/60 overflow-hidden relative flex items-center justify-center">
                                  {item.url && (item.source_type === "image" || item.group_type === "brand_materials") ? (
                                    <img src={item.url} alt={item.title} className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="text-center p-2">
                                      <VideoIcon className="w-6 h-6 text-indigo-500 mx-auto mb-1" />
                                      <span className="text-[9px] font-mono text-zinc-500 block truncate">Video Reference</span>
                                    </div>
                                  )}

                                  {/* Delete trash icon on manual items */}
                                  {!isBrandSynced && !isCatalogSynced && (
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteSource(item.id)}
                                      title="Delete Manual Source"
                                      className="absolute top-1 right-1 p-1 bg-black/60 text-white rounded hover:bg-rose-600 transition-colors"
                                    >
                                      <TrashIcon className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>

                                <div className="space-y-1">
                                  <span className="text-[11px] font-bold text-zinc-900 dark:text-zinc-100 block truncate" title={item.title}>
                                    {item.title}
                                  </span>

                                  <div className="flex items-center justify-between">
                                    {isBrandSynced ? (
                                      <span className="text-[9px] font-mono text-purple-600 bg-purple-50 dark:bg-purple-950/60 px-1.5 py-0.2 rounded font-semibold">
                                        Brand Synced
                                      </span>
                                    ) : isCatalogSynced ? (
                                      <span className="text-[9px] font-mono text-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.2 rounded font-semibold truncate max-w-[110px]" title={item.metadata?.is_external ? "Catalog Synced — External Video" : "Catalog Synced"}>
                                        {item.metadata?.is_external ? "External Video" : "Catalog Synced"}
                                      </span>
                                    ) : (
                                      <span className="text-[9px] font-mono text-zinc-500 bg-zinc-100 px-1.5 py-0.2 rounded">
                                        Manual Upload
                                      </span>
                                    )}
                                  </div>

                                  {/* USE FOR AI TOGGLE CHECKBOX (Requirement 2) */}
                                  <label className="flex items-center gap-1.5 pt-1 text-[10.5px] font-semibold text-zinc-700 dark:text-zinc-300 cursor-pointer border-t border-zinc-100 dark:border-zinc-800">
                                    <input
                                      type="checkbox"
                                      checked={isUseForAi}
                                      onChange={() => toggleUseForAi(item.id)}
                                      className="rounded text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <span>Use for AI</span>
                                  </label>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ) : (
                    /* COMPACT CARD VIEW FOR DOCUMENTS/PDFs */
                    <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      {groupItems.length === 0 ? (
                        <div className="px-4 py-3 text-xs text-zinc-400 font-medium">
                          No materials uploaded for this group yet.
                        </div>
                      ) : (
                        groupItems.map((item) => {
                          const isUseForAi = useForAiSourceIds.includes(item.id);
                          return (
                            <div key={item.id} className="p-3 flex items-center justify-between gap-3 hover:bg-zinc-50/50 dark:hover:bg-zinc-850/50">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-9 h-9 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                                  <FileTextIcon className="w-4 h-4 text-zinc-500" />
                                </div>
                                <div className="min-w-0">
                                  <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 block truncate">{item.title}</span>
                                  <span className="text-[10.5px] text-zinc-500 truncate block">
                                    Type: {item.source_type} {item.file_name && `• ${item.file_name}`}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-3 shrink-0">
                                <label className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={isUseForAi}
                                    onChange={() => toggleUseForAi(item.id)}
                                    className="rounded text-indigo-600 focus:ring-indigo-500"
                                  />
                                  <span>Use for AI</span>
                                </label>

                                <button
                                  type="button"
                                  onClick={() => handleDeleteSource(item.id)}
                                  title="Delete Manual Source"
                                  className="p-1 text-zinc-400 hover:text-rose-600"
                                >
                                  <TrashIcon className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: CREATE WITH AI (COMPACT MULTI-COLUMN LAYOUT - Requirements 3 & 4) */}
      {activeMainTab === "create" && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-2xs space-y-6">
          <div>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              Create with AI — Select Output Type & Configure Settings
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Source selection defaults to your Source Materials configuration. Customize creation settings to generate a new draft.
            </p>
          </div>

          {/* STEP 1: CHOOSE CONTENT TYPE */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider block">
              Step 1 — Choose Output Type (6 Types)
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
              {[
                { id: "benefit_graphic", label: "Benefit Graphic", type: "Image (~6 Benefits)" },
                { id: "infographic", label: "Infographic", type: "Specs & Ingredients" },
                { id: "how_to_graphic", label: "How-to Graphic", type: "Step-by-Step Guide" },
                { id: "lifestyle_image", label: "Lifestyle Image", type: "Studio Photography" },
                { id: "product_video", label: "Product Video", type: "15–30s Video Intro" },
                { id: "how_to_video", label: "How-to Video", type: "Usage Video Guide" },
              ].map((item) => {
                const isSelected = selectedOutputType === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedOutputType(item.id as AIOutputType)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? "border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/50 text-indigo-900 dark:text-indigo-200 ring-2 ring-indigo-500/20"
                        : "border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-850 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    }`}
                  >
                    <div>
                      <span className="text-xs font-bold block">{item.label}</span>
                      <span className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1 block">{item.type}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* STEP 2: REVIEW AUTO-SELECTED SOURCES (Requirement 3 & 4) */}
          <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider block">
                Step 2 — Review Sources for this Generation ({selectedSourceIds.length} Selected)
              </span>
              <button
                type="button"
                onClick={() => setSelectedSourceIds(sources.map((s) => s.id))}
                className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
              >
                Select All Sources
              </button>
            </div>

            <div className="bg-zinc-50 dark:bg-zinc-850 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 max-h-64 overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {sources.map((src) => {
                  const isChecked = selectedSourceIds.includes(src.id) || src.group_type === "product_info";
                  const groupLabel =
                    src.group_type === "product_info"
                      ? "Catalog Details"
                      : src.group_type === "brand_materials"
                      ? "Brand Package"
                      : src.group_type === "product_media"
                      ? "Catalog Media"
                      : "Reference File";

                  return (
                    <label
                      key={src.id}
                      className={`p-2 rounded-lg border text-xs flex items-center gap-2 cursor-pointer transition-colors ${
                        isChecked
                          ? "bg-white dark:bg-zinc-900 border-indigo-300 dark:border-indigo-800 shadow-2xs"
                          : "bg-zinc-100/60 dark:bg-zinc-800/60 border-transparent opacity-60"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedSourceIds((prev) => [...prev, src.id]);
                          } else {
                            setSelectedSourceIds((prev) => prev.filter((id) => id !== src.id));
                          }
                        }}
                        className="rounded text-indigo-600 focus:ring-indigo-500 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <span className="font-bold text-zinc-900 dark:text-zinc-100 block truncate" title={src.title}>
                          {src.title}
                        </span>
                        <span className="text-[9.5px] text-zinc-500 block truncate">
                          {groupLabel}
                        </span>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          {/* STEP 3: CREATION SETTINGS */}
          <div className="space-y-4 pt-2 border-t border-zinc-100 dark:border-zinc-800">
            <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider block">
              Step 3 — Generation Parameters
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block font-bold text-zinc-600 dark:text-zinc-400 mb-1">Target Audience</label>
                <select
                  value={creationSettings.audience}
                  onChange={(e) => setCreationSettings({ ...creationSettings, audience: e.target.value as TargetAudience })}
                  className="w-full py-1.5 px-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 font-semibold"
                >
                  <option value="both">Both (Customer & Retail Staff)</option>
                  <option value="customer">End Consumer</option>
                  <option value="retail_staff">Retail Sales Staff</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-zinc-600 dark:text-zinc-400 mb-1">Visual Style Preset</label>
                <select
                  value={creationSettings.style}
                  onChange={(e) => setCreationSettings({ ...creationSettings, style: e.target.value })}
                  className="w-full py-1.5 px-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 font-semibold"
                >
                  <option value="Clean Professional Studio Photography">Clean Professional Studio</option>
                  <option value="K-Beauty Aesthetic Minimalist">K-Beauty Aesthetic Minimalist</option>
                  <option value="Clinical Derm-Approved Technical">Clinical Derm-Approved</option>
                  <option value="Vibrant Social Media Marketing">Vibrant Social Media</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-zinc-600 dark:text-zinc-400 mb-1">Language</label>
                <select
                  value={creationSettings.language}
                  onChange={(e) => setCreationSettings({ ...creationSettings, language: e.target.value })}
                  className="w-full py-1.5 px-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 font-semibold"
                >
                  <option value="English">English (Global)</option>
                  <option value="Korean">Korean (Primary)</option>
                  <option value="Bilingual">Bilingual (English / Korean)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-zinc-600 dark:text-zinc-400 mb-1">Creation Purpose</label>
                <input
                  type="text"
                  value={creationSettings.purpose}
                  onChange={(e) => setCreationSettings({ ...creationSettings, purpose: e.target.value })}
                  className="w-full py-1.5 px-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 font-semibold"
                />
              </div>
            </div>

            {generationError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                <AlertTriangleIcon className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{generationError}</span>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                disabled={isGenerating}
                onClick={handleGenerateAI}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
              >
                <SparklesIcon className="w-4 h-4" />
                <span>{isGenerating ? "Generating AI Media Asset..." : "Generate AI Media Asset"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: DRAFTS (FILTERS, DATE/TIME, BULK ACTIONS & DOWNLOAD - Requirements 5, 6, 7, 8) */}
      {activeMainTab === "drafts" && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-2xs space-y-6">
          {/* Header & Sub-Filters (Requirement 5) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-zinc-100 dark:border-zinc-800">
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                Draft Media Assets ({filteredDrafts.length})
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Review, edit, download, retry, or directly approve generated drafts.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Draft Status Sub-Filter Buttons */}
              <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl gap-1 text-[11px] font-bold">
                {[
                  { id: "all", label: "All" },
                  { id: "valid", label: "Valid Drafts" },
                  { id: "failed", label: "Failed" },
                  { id: "legacy", label: "Legacy/Test" },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setDraftSubFilter(f.id as DraftSubFilter)}
                    className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                      draftSubFilter === f.id
                        ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-2xs"
                        : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Type Filter Dropdown */}
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as AssetTypeFilter)}
                className="py-1 px-2 text-xs font-semibold rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
              >
                <option value="all">All Output Types</option>
                <option value="benefit_graphic">Benefit Graphic</option>
                <option value="infographic">Infographic</option>
                <option value="how_to_graphic">How-to Graphic</option>
                <option value="lifestyle_image">Lifestyle Image</option>
                <option value="product_video">Product Video</option>
                <option value="how_to_video">How-to Video</option>
              </select>
            </div>
          </div>

          {/* DRAFT BULK ACTION BAR (Requirement 7) */}
          {selectedDraftIds.length > 0 && (
            <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-xl flex items-center justify-between gap-3 text-xs">
              <span className="font-bold text-indigo-900 dark:text-indigo-200">
                {selectedDraftIds.length} Draft Asset(s) Selected
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleBulkDeleteDrafts}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <TrashIcon className="w-3.5 h-3.5" />
                  <span>Delete Selected ({selectedDraftIds.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedDraftIds([])}
                  className="px-2.5 py-1.5 text-zinc-600 hover:bg-zinc-200 dark:hover:bg-zinc-700 font-semibold rounded-lg cursor-pointer"
                >
                  Deselect All
                </button>
              </div>
            </div>
          )}

          {/* DRAFTS GRID */}
          {filteredDrafts.length === 0 ? (
            <div className="py-12 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl text-center">
              <EditIcon className="w-8 h-8 text-zinc-300 dark:text-zinc-600 mx-auto mb-2" />
              <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">No Draft Assets Found</p>
              <button
                type="button"
                onClick={() => setActiveMainTab("create")}
                className="mt-3 px-3 py-1.5 text-xs font-bold text-indigo-600 hover:underline cursor-pointer"
              >
                + Create with AI
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {filteredDrafts.map((asset) => {
                const isFailed = asset.status === "failed" || !!asset.content_data?.error_message || asset.content_data?.provider_info?.generation_status === "failed";
                const isLegacyDraft = !asset.storage_path || asset.storage_path.endsWith(".svg") || asset.content_data?.is_mock;
                const isValidDraft = !isFailed && !isLegacyDraft;
                const isSelected = selectedDraftIds.includes(asset.id);
                const isHighlighted = highlightedDraftId === asset.id;

                return (
                  <div
                    key={asset.id}
                    className={`border rounded-xl p-4 space-y-3 flex flex-col justify-between transition-all relative ${
                      isHighlighted
                        ? "ring-2 ring-indigo-500 border-indigo-400 bg-indigo-50/30 dark:bg-indigo-950/20 shadow-md"
                        : isSelected
                        ? "ring-2 ring-indigo-400 border-indigo-300 bg-indigo-50/20 dark:bg-indigo-950/10"
                        : isFailed
                        ? "border-rose-200 dark:border-rose-900/60 bg-rose-50/20 dark:bg-rose-950/10"
                        : isLegacyDraft
                        ? "border-amber-200 dark:border-amber-900/60 bg-amber-50/20 dark:bg-amber-950/10"
                        : "border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-850"
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {/* Selection Checkbox (Requirement 7) */}
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedDraftIds((prev) => [...prev, asset.id]);
                              else setSelectedDraftIds((prev) => prev.filter((id) => id !== asset.id));
                            }}
                            className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          />

                          <span
                            className={`px-2 py-0.5 text-[9.5px] font-bold rounded uppercase ${
                              isFailed
                                ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                                : isLegacyDraft
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                                : "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300"
                            }`}
                          >
                            {isFailed ? "FAILED / ACTION NEEDED" : isLegacyDraft ? `LEGACY DRAFT v${asset.version}` : `Draft v${asset.version}`}
                          </span>
                        </div>

                        {/* DATE / TIME DISPLAY (Requirement 6) */}
                        <span className="text-[10px] text-zinc-400 font-mono" title={`Created: ${formatDateTime(asset.created_at)}`}>
                          {formatDateTime(asset.created_at)}
                        </span>
                      </div>

                      <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 line-clamp-2">{asset.title}</h4>
                      <p className="text-[10.5px] text-zinc-500">Type: {asset.asset_type}</p>

                      {/* Clean Error Display for Failed Assets */}
                      {isFailed && (
                        <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-[11px] text-rose-700 dark:text-rose-300 space-y-1">
                          <span className="font-semibold block">Generation Failed</span>
                          <span className="text-[10.5px] text-rose-600 dark:text-rose-400 block line-clamp-2">
                            Google AI API request failed (Rate Limit / Quota Exceeded). Click View Details to inspect.
                          </span>
                        </div>
                      )}

                      {/* Warning Notice for Legacy Drafts */}
                      {!isFailed && isLegacyDraft && (
                        <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-[10.5px] text-amber-800 dark:text-amber-300">
                          <span className="font-semibold block">Legacy Mock Placeholder</span>
                          <span className="text-[10px] block">Cannot be approved until replaced with actual AI media.</span>
                        </div>
                      )}
                    </div>

                    {/* CARD ACTIONS */}
                    <div className="pt-3 border-t border-zinc-200/60 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-1.5">
                      {isFailed ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleRetryGeneration(asset.asset_type)}
                            className="px-2.5 py-1 text-[11px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors cursor-pointer"
                          >
                            Retry
                          </button>

                          <button
                            type="button"
                            onClick={() => setViewDetailsAsset(asset)}
                            className="px-2.5 py-1 text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-750 rounded-lg cursor-pointer"
                          >
                            View Details
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteDraft(asset.id)}
                            title="Delete Failed Asset"
                            className="p-1 text-zinc-400 hover:text-rose-600 cursor-pointer"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => setPreviewAsset(asset)}
                            className="px-2 py-1 text-[10.5px] font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-750 rounded-lg cursor-pointer"
                          >
                            Preview
                          </button>

                          {/* DOWNLOAD BUTTON (Requirement 8) */}
                          {isValidDraft && asset.url && (
                            <button
                              type="button"
                              onClick={() => handleDownloadAsset(asset.url, `${asset.title}.png`)}
                              title="Download Media File"
                              className="px-2 py-1 text-[10.5px] font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg cursor-pointer flex items-center gap-1"
                            >
                              <DownloadIcon className="w-3 h-3" />
                              <span>Download</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => openEditModal(asset)}
                            className="px-2 py-1 text-[10.5px] font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg cursor-pointer"
                          >
                            Edit
                          </button>

                          {isLegacyDraft ? (
                            <button
                              type="button"
                              disabled
                              title="Legacy mock placeholder cannot be approved until replaced with real AI media"
                              className="px-2.5 py-1 text-[10.5px] font-bold bg-zinc-300 dark:bg-zinc-700 text-zinc-500 cursor-not-allowed rounded-lg opacity-60"
                            >
                              Approve
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setApprovingAsset(asset)}
                              className="px-2.5 py-1 text-[10.5px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors cursor-pointer"
                            >
                              Approve
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleDeleteDraft(asset.id)}
                            title="Delete Draft Asset"
                            className="p-1 text-zinc-400 hover:text-rose-600 cursor-pointer"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: APPROVED ASSETS (ACTIVE/ARCHIVED VIEWS, BULK ACTIONS, DATE/TIME, DOWNLOAD - Requirements 10, 11, 13, 14, 15) */}
      {activeMainTab === "approved" && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-2xs space-y-6">
          {/* Header & View Switcher */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-zinc-100 dark:border-zinc-800">
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                Approved Assets Library ({approvedSubTab === "active" ? activeApprovedAssets.length : archivedAssets.length})
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Approved production assets eligible for Customer Product Pages and Retail Staff Training.
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Active vs Archived Sub-Tab Switcher (Requirement 11) */}
              <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl gap-1 text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => {
                    setApprovedSubTab("active");
                    setSelectedApprovedIds([]);
                  }}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                    approvedSubTab === "active"
                      ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-2xs"
                      : "text-zinc-500 hover:text-zinc-800"
                  }`}
                >
                  Active ({activeApprovedAssets.length})
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setApprovedSubTab("archived");
                    setSelectedApprovedIds([]);
                  }}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                    approvedSubTab === "archived"
                      ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-2xs"
                      : "text-zinc-500 hover:text-zinc-800"
                  }`}
                >
                  Archived ({archivedAssets.length})
                </button>
              </div>

              {/* Type Filter */}
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as AssetTypeFilter)}
                className="py-1 px-2 text-xs font-semibold rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
              >
                <option value="all">All Output Types</option>
                <option value="benefit_graphic">Benefit Graphic</option>
                <option value="infographic">Infographic</option>
                <option value="how_to_graphic">How-to Graphic</option>
                <option value="lifestyle_image">Lifestyle Image</option>
                <option value="product_video">Product Video</option>
                <option value="how_to_video">How-to Video</option>
              </select>
            </div>
          </div>

          {/* APPROVED BULK ACTION BAR (Requirement 10) */}
          {selectedApprovedIds.length > 0 && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center justify-between gap-3 text-xs">
              <span className="font-bold text-emerald-900 dark:text-emerald-200">
                {selectedApprovedIds.length} Asset(s) Selected
              </span>

              <div className="flex items-center gap-2">
                {approvedSubTab === "active" ? (
                  <>
                    <button
                      type="button"
                      onClick={handleBulkArchiveApproved}
                      className="px-3 py-1.5 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <ArchiveIcon className="w-3.5 h-3.5" />
                      <span>Archive Selected ({selectedApprovedIds.length})</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleBulkDeleteApprovedPermanently}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <TrashIcon className="w-3.5 h-3.5" />
                      <span>Delete Permanently</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={async () => {
                        for (const id of selectedApprovedIds) {
                          await restoreMediaAsset(id);
                        }
                        setAssets((prev) =>
                          prev.map((a) => (selectedApprovedIds.includes(a.id) ? { ...a, status: "approved" as AssetStatus } : a))
                        );
                        showToast(`${selectedApprovedIds.length} asset(s) restored`);
                        setSelectedApprovedIds([]);
                      }}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcwIcon className="w-3.5 h-3.5" />
                      <span>Restore Selected ({selectedApprovedIds.length})</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleBulkDeleteApprovedPermanently}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <TrashIcon className="w-3.5 h-3.5" />
                      <span>Delete Permanently</span>
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => setSelectedApprovedIds([])}
                  className="px-2.5 py-1.5 text-zinc-600 hover:bg-zinc-200 dark:hover:bg-zinc-700 font-semibold rounded-lg cursor-pointer"
                >
                  Deselect All
                </button>
              </div>
            </div>
          )}

          {/* APPROVED ASSETS GRID */}
          {filterAssets(approvedSubTab === "active" ? activeApprovedAssets : archivedAssets).length === 0 ? (
            <div className="py-12 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl text-center">
              <CheckCircleIcon className="w-8 h-8 text-zinc-300 dark:text-zinc-600 mx-auto mb-2" />
              <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                {approvedSubTab === "active" ? "No Active Approved Assets Yet" : "No Archived Assets"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {filterAssets(approvedSubTab === "active" ? activeApprovedAssets : archivedAssets).map((asset) => {
                const isValidApproved =
                  !!asset.storage_path &&
                  !asset.storage_path.endsWith(".svg") &&
                  !asset.content_data?.is_mock &&
                  asset.content_data?.provider_info?.generation_status !== "failed";
                const isSelected = selectedApprovedIds.includes(asset.id);
                const isArchived = asset.status === "archived";

                return (
                  <div
                    key={asset.id}
                    className={`border rounded-xl p-4 space-y-3 flex flex-col justify-between transition-all ${
                      isArchived
                        ? "border-zinc-300 dark:border-zinc-700 bg-zinc-100/60 dark:bg-zinc-800/60 opacity-80"
                        : isSelected
                        ? "ring-2 ring-emerald-400 border-emerald-300 bg-emerald-50/20 dark:bg-emerald-950/10"
                        : isValidApproved
                        ? "border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/20 dark:bg-emerald-950/10"
                        : "border-amber-200 dark:border-amber-900/60 bg-amber-50/20 dark:bg-amber-950/10"
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedApprovedIds((prev) => [...prev, asset.id]);
                              else setSelectedApprovedIds((prev) => prev.filter((id) => id !== asset.id));
                            }}
                            className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          />

                          <span
                            className={`px-2 py-0.5 text-[9.5px] font-bold rounded uppercase ${
                              isArchived
                                ? "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300"
                                : isValidApproved
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                            }`}
                          >
                            {isArchived ? "Archived Asset" : isValidApproved ? `Approved v${asset.version}` : "LEGACY / REVIEW NEEDED"}
                          </span>
                        </div>

                        {/* DATE / TIME DISPLAY (Requirement 13) */}
                        <span className="text-[10px] text-zinc-400 font-mono" title={`Approved: ${formatDateTime(asset.approved_at || asset.updated_at)}`}>
                          {formatDateTime(asset.approved_at || asset.updated_at)}
                        </span>
                      </div>

                      <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 line-clamp-2">{asset.title}</h4>

                      <div className="flex flex-wrap items-center gap-1">
                        <span className="text-[10px] text-zinc-500 mr-1">Usability:</span>
                        {isValidApproved ? (
                          <span className="px-1.5 py-0.2 rounded text-[9.5px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                            Eligible for Customer Page & Staff Training
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.2 rounded text-[9.5px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 italic">
                            Excluded from Reuse (Legacy Mock Placeholder)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* ACTIONS */}
                    <div className="pt-3 border-t border-zinc-200/60 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-1.5">
                      <button
                        type="button"
                        onClick={() => setPreviewAsset(asset)}
                        className="px-2 py-1 text-[10.5px] font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-750 rounded-lg cursor-pointer"
                      >
                        Preview
                      </button>

                      {/* DOWNLOAD BUTTON FOR APPROVED ASSETS (Requirement 15) */}
                      {isValidApproved && asset.url && (
                        <button
                          type="button"
                          onClick={() => handleDownloadAsset(asset.url, `${asset.title}.png`)}
                          title="Download Approved Media File"
                          className="px-2 py-1 text-[10.5px] font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg cursor-pointer flex items-center gap-1"
                        >
                          <DownloadIcon className="w-3 h-3" />
                          <span>Download</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setLineageAsset(asset)}
                        title="View Lineage Info"
                        className="px-2 py-1 text-[10.5px] font-semibold text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg cursor-pointer"
                      >
                        <InfoIcon className="w-3 h-3 inline mr-1" />
                        Lineage
                      </button>

                      {isArchived ? (
                        <button
                          type="button"
                          onClick={() => handleRestoreAsset(asset.id)}
                          className="px-2.5 py-1 text-[10.5px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg cursor-pointer flex items-center gap-1"
                        >
                          <RotateCcwIcon className="w-3 h-3" />
                          <span>Restore</span>
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => openEditAsNewDraftModal(asset)}
                            className="px-2.5 py-1 text-[10.5px] font-bold bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 rounded-lg hover:bg-zinc-800 cursor-pointer"
                          >
                            Edit as New Draft
                          </button>

                          <button
                            type="button"
                            onClick={() => handleArchive(asset.id)}
                            title="Archive Asset"
                            className="p-1 text-zinc-400 hover:text-rose-600 cursor-pointer"
                          >
                            <ArchiveIcon className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: UPLOAD SOURCE MATERIAL (MULTI-FILE & CUSTOM UI) */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 max-w-md w-full space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Add Source Material</h3>
              <button onClick={() => setShowUploadModal(false)} className="text-zinc-400 hover:text-zinc-600">
                <XIcon className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-zinc-600 mb-1">Source Group</label>
                <select
                  value={uploadGroup}
                  onChange={(e) => setUploadGroup(e.target.value as SourceGroupType)}
                  className="w-full py-1.5 px-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
                >
                  <option value="product_media">B. Product Images & Videos</option>
                  <option value="brand_materials">C. Brand Materials</option>
                  <option value="existing_content">D. Existing Content (Amazon, Brochure)</option>
                  <option value="reference_files">E. Reference Files (PDF, Docs)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-zinc-600 mb-1">Title / Label Prefix</label>
                <input
                  type="text"
                  placeholder="Amazon Detail Image..."
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  className="w-full py-1.5 px-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
                />
              </div>

              <div>
                <label className="block font-bold text-zinc-600 mb-1">Select Files (Multi-File Supported)</label>
                <label className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 hover:border-indigo-500 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer bg-zinc-50 dark:bg-zinc-850 transition-colors">
                  <FileTextIcon className="w-6 h-6 text-zinc-400 mb-1" />
                  <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">Click to Select Files</span>
                  <span className="text-[10px] text-zinc-400 mt-0.5">Images, Videos, PDFs, Documents</span>
                  <input
                    type="file"
                    multiple
                    onChange={(e) => {
                      if (e.target.files) {
                        setSelectedUploadFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
                      }
                    }}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Selected File List */}
              {selectedUploadFiles.length > 0 && (
                <div className="space-y-1.5 max-h-36 overflow-y-auto border border-zinc-200 dark:border-zinc-800 rounded-lg p-2 bg-white dark:bg-zinc-900">
                  <span className="text-[10.5px] font-bold text-zinc-500 block">
                    Selected Files ({selectedUploadFiles.length}):
                  </span>
                  {selectedUploadFiles.map((file, idx) => (
                    <div key={idx} className="flex items-center justify-between text-[11px] bg-zinc-50 dark:bg-zinc-800 p-1.5 rounded">
                      <span className="truncate font-mono font-medium max-w-[200px]">{file.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-zinc-400 font-mono">
                          ({(file.size / 1024).toFixed(0)} KB)
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedUploadFiles((prev) => prev.filter((_, i) => i !== idx))}
                          className="text-zinc-400 hover:text-rose-600"
                        >
                          <XIcon className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isUploading || selectedUploadFiles.length === 0}
                onClick={handleBatchUploadSources}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl"
              >
                {isUploading ? "Uploading..." : `Upload ${selectedUploadFiles.length} File(s)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: FAILED TECHNICAL DETAILS */}
      {viewDetailsAsset && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 max-w-lg w-full space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                Failed Generation Technical Details
              </h3>
              <button onClick={() => setViewDetailsAsset(null)} className="text-zinc-400 hover:text-zinc-600">
                <XIcon className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-zinc-50 dark:bg-zinc-850 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-2 text-xs font-mono">
              <div><strong className="text-zinc-500">Asset Title:</strong> {viewDetailsAsset.title}</div>
              <div><strong className="text-zinc-500">Asset Type:</strong> {viewDetailsAsset.asset_type}</div>
              <div><strong className="text-zinc-500">AI Provider:</strong> {viewDetailsAsset.content_data.provider_info?.provider || "N/A"}</div>
              <div><strong className="text-zinc-500">AI Model:</strong> {viewDetailsAsset.content_data.provider_info?.model || "N/A"}</div>
              <div>
                <strong className="text-zinc-500 block mb-1">Raw Provider Error Message:</strong>
                <pre className="p-2 rounded bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-[10px] whitespace-pre-wrap font-mono border border-rose-200 max-h-48 overflow-y-auto">
                  {viewDetailsAsset.content_data.error_message || "No error trace recorded."}
                </pre>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setViewDetailsAsset(null)}
                className="px-4 py-1.5 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-bold text-xs rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: EDIT AS NEW DRAFT TITLE MODAL */}
      {editAsNewDraftModalAsset && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 max-w-md w-full space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                Create New Draft Version
              </h3>
              <button onClick={() => setEditAsNewDraftModalAsset(null)} className="text-zinc-400 hover:text-zinc-600">
                <XIcon className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-zinc-500">
              Creates a new Draft version linked to the original parent asset. Original Approved asset will be preserved.
            </p>

            {(!editAsNewDraftModalAsset.storage_path || editAsNewDraftModalAsset.storage_path.endsWith(".svg") || editAsNewDraftModalAsset.content_data?.is_mock) && (
              <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200">
                <strong>⚠️ Warning:</strong> This original asset is a legacy mock placeholder. The new draft version will also remain un-approvable until replaced with actual AI-generated media.
              </div>
            )}

            <div className="space-y-2 text-xs">
              <label className="block font-bold text-zinc-700">New Draft Title</label>
              <input
                type="text"
                value={editAsNewDraftTitle}
                onChange={(e) => setEditAsNewDraftTitle(e.target.value)}
                className="w-full py-1.5 px-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 font-bold text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setEditAsNewDraftModalAsset(null)}
                className="px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isCreatingNewDraftVersion || !editAsNewDraftTitle.trim()}
                onClick={handleConfirmCreateNewDraftVersion}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl"
              >
                {isCreatingNewDraftVersion ? "Creating..." : "Create Draft"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: QUICK EDIT */}
      {editingAsset && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 max-w-lg w-full space-y-4 shadow-xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                Quick Edit Draft — {editingAsset.title}
              </h3>
              <button onClick={() => setEditingAsset(null)} className="text-zinc-400 hover:text-zinc-600">
                <XIcon className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-zinc-600 mb-1">Asset Title</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full py-1.5 px-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 font-bold"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setEditingAsset(null)}
                className="px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSavingEdit}
                onClick={handleSaveEdit}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl"
              >
                {isSavingEdit ? "Saving..." : "Save Edits"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: APPROVE CONFIRMATION */}
      {approvingAsset && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 max-w-md w-full space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                Approve Media Asset — Confirmation
              </h3>
              <button onClick={() => setApprovingAsset(null)} className="text-zinc-400 hover:text-zinc-600">
                <XIcon className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-zinc-500">
              Approving moves this asset into the Approved Assets Library for Customer Page and Staff Training.
            </p>

            <div className="p-3 bg-amber-50/60 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800 space-y-2 text-xs">
              <span className="font-bold text-amber-900 dark:text-amber-200 block text-[11px] uppercase tracking-wider">
                Verification Checklist (All Required)
              </span>

              <label className="flex items-center gap-2 cursor-pointer text-amber-900 dark:text-amber-100">
                <input
                  type="checkbox"
                  checked={checkInfoAccurate}
                  onChange={(e) => setCheckInfoAccurate(e.target.checked)}
                  className="rounded text-amber-600 focus:ring-amber-500"
                />
                <span>Product information is accurate</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-amber-900 dark:text-amber-100">
                <input
                  type="checkbox"
                  checked={checkCorrectVisual}
                  onChange={(e) => setCheckCorrectVisual(e.target.checked)}
                  className="rounded text-amber-600 focus:ring-amber-500"
                />
                <span>Correct product / visual is used</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-amber-900 dark:text-amber-100">
                <input
                  type="checkbox"
                  checked={checkReadyForUse}
                  onChange={(e) => setCheckReadyForUse(e.target.checked)}
                  className="rounded text-amber-600 focus:ring-amber-500"
                />
                <span>Content is ready for customer / staff use</span>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setApprovingAsset(null)}
                className="px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isApproving || !checkInfoAccurate || !checkCorrectVisual || !checkReadyForUse}
                onClick={handleApprove}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl"
              >
                {isApproving ? "Approving..." : "Confirm & Approve"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: LINEAGE & TRACEABILITY */}
      {lineageAsset && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 max-w-md w-full space-y-4 shadow-xl text-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                Asset Lineage & Traceability
              </h3>
              <button onClick={() => setLineageAsset(null)} className="text-zinc-400 hover:text-zinc-600">
                <XIcon className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-850 space-y-2 border border-zinc-200 dark:border-zinc-800 font-mono text-[11px]">
              <div><strong className="text-zinc-500">Asset Title:</strong> {lineageAsset.title}</div>
              <div><strong className="text-zinc-500">Version:</strong> v{lineageAsset.version}</div>
              <div><strong className="text-zinc-500">Status:</strong> {lineageAsset.status}</div>
              <div><strong className="text-zinc-500">Parent Asset:</strong> {lineageAsset.parent_asset_id || "None (Original)"}</div>
              <div><strong className="text-zinc-500">AI Provider:</strong> {lineageAsset.content_data.provider_info?.provider || "N/A"}</div>
              <div><strong className="text-zinc-500">AI Model:</strong> {lineageAsset.content_data.provider_info?.model || "N/A"}</div>
              <div><strong className="text-zinc-500">Sources Count:</strong> {lineageAsset.source_material_ids.length} materials used</div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setLineageAsset(null)}
                className="px-4 py-1.5 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-bold text-xs rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 7: LARGE PREVIEW MODAL (WITH DOWNLOAD & VALIDITY GUARD - Requirements 9 & 14) */}
      {previewAsset && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 sm:p-8">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 max-w-4xl w-full max-h-[90vh] flex flex-col justify-between space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">{previewAsset.title}</h3>
                <span className="text-xs text-zinc-500">
                  Type: {previewAsset.asset_type} • Version: v{previewAsset.version} • Status: {previewAsset.status}
                </span>
              </div>
              <button onClick={() => setPreviewAsset(null)} className="p-1 text-zinc-400 hover:text-zinc-600 rounded-lg">
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Warning banner for legacy/test assets */}
            {(!previewAsset.storage_path || previewAsset.storage_path.endsWith(".svg") || previewAsset.content_data?.is_mock) && (
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200 flex items-center gap-2">
                <AlertTriangleIcon className="w-5 h-5 text-amber-500 shrink-0" />
                <span>
                  {previewAsset.media_type === "video"
                    ? "Storyboard / Reference Preview — Not a playable MP4 video file."
                    : "Legacy / Test Preview — Not a production-ready generated asset."}
                </span>
              </div>
            )}

            {/* Large Preview Viewer */}
            <div className="p-4 bg-zinc-950 rounded-xl flex-1 min-h-[300px] flex items-center justify-center border border-zinc-800 overflow-hidden relative">
              {previewAsset.url && !previewAsset.url.endsWith(".svg") && previewAsset.status !== "failed" ? (
                previewAsset.url.includes(".mp4") ? (
                  <video src={previewAsset.url} controls className="max-h-[60vh] w-full object-contain rounded" />
                ) : (
                  <img src={previewAsset.url} alt={previewAsset.title} className="max-h-[60vh] max-w-full object-contain rounded" />
                )
              ) : (
                <div className="text-center space-y-2 py-12">
                  <AlertTriangleIcon className="w-12 h-12 text-amber-500 mx-auto mb-2" />
                  <span className="text-sm text-zinc-200 block font-bold">
                    No Valid Media File Available for Preview
                  </span>
                  <span className="text-xs text-zinc-400 block max-w-md mx-auto">
                    {previewAsset.status === "failed"
                      ? "This asset generation failed. Please click Retry to generate a new draft."
                      : "This is a legacy diagnostic placeholder asset."}
                  </span>
                </div>
              )}
            </div>

            {/* Footer with Download Action */}
            <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <span className="text-xs text-zinc-500 font-mono">
                {previewAsset.created_at ? `Created: ${formatDateTime(previewAsset.created_at)}` : ""}
              </span>

              <div className="flex items-center gap-2">
                {previewAsset.url && !previewAsset.url.endsWith(".svg") && previewAsset.status !== "failed" && (
                  <button
                    type="button"
                    onClick={() => handleDownloadAsset(previewAsset.url, `${previewAsset.title}.png`)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <DownloadIcon className="w-4 h-4" />
                    <span>Download File</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setPreviewAsset(null)}
                  className="px-4 py-2 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-bold text-xs rounded-xl"
                >
                  Close Preview
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
