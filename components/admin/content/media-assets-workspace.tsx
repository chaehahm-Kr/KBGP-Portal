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
  getMediaAssets,
  getGenerationJobs,
  createAIMediaJob,
  updateDraftMediaAsset,
  approveMediaAsset,
  editApprovedAsNewDraft,
  archiveMediaAsset,
} from "@/lib/product/media-asset-actions";

// Icons
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

function PlusIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
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

function RefreshCwIcon({ className = "w-4 h-4" }: { className?: string }) {
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

function EyeIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
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

function InfoIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

interface MediaAssetsWorkspaceProps {
  product: ContentProductItem;
}

type MainTab = "sources" | "create" | "drafts" | "approved";

export function MediaAssetsWorkspace({ product }: MediaAssetsWorkspaceProps) {
  const [activeMainTab, setActiveMainTab] = useState<MainTab>("sources");
  const [sources, setSources] = useState<SourceMaterialItem[]>([]);
  const [assets, setAssets] = useState<MediaAssetItem[]>([]);
  const [jobs, setJobs] = useState<GenerationJob[]>([]);
  const [loading, setLoading] = useState(true);

  // Asset type filter
  const [typeFilter, setTypeFilter] = useState<AssetTypeFilter>("all");

  // Upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadGroup, setUploadGroup] = useState<SourceGroupType>("existing_content");
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Create with AI modal / step state
  const [selectedOutputType, setSelectedOutputType] = useState<AIOutputType>("benefit_graphic");
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
  const [creationSettings, setCreationSettings] = useState<CreationSettings>({
    purpose: "Retailer Portal Product Listing & Customer Overview",
    audience: "customer",
    style: "Clean & Professional Commercial Style",
    language: "English",
    optional_instruction: "",
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);

  // Quick Edit Modal
  const [editingAsset, setEditingAsset] = useState<MediaAssetItem | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editTextLayers, setEditTextLayers] = useState<Array<{ id: string; text: string; position: string; style: string }>>([]);
  const [editScenes, setEditScenes] = useState<Array<{ id: number; title: string; text: string; duration?: number }>>([]);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Approve Confirmation Modal
  const [approvingAsset, setApprovingAsset] = useState<MediaAssetItem | null>(null);
  const [checkInfoAccurate, setCheckInfoAccurate] = useState(false);
  const [checkCorrectVisual, setCheckCorrectVisual] = useState(false);
  const [checkReadyForUse, setCheckReadyForUse] = useState(false);
  const [targetUsage, setTargetUsage] = useState<UsageTarget[]>(["customer_page"]);
  const [isApproving, setIsApproving] = useState(false);

  // Preview / Lineage Modal
  const [previewAsset, setPreviewAsset] = useState<MediaAssetItem | null>(null);
  const [lineageAsset, setLineageAsset] = useState<MediaAssetItem | null>(null);

  // Initial Data Fetch
  const reloadData = async () => {
    setLoading(true);
    const [fetchedSources, fetchedAssets, fetchedJobs] = await Promise.all([
      getMediaSourceMaterials(product.id),
      getMediaAssets(product.id),
      getGenerationJobs(product.id),
    ]);
    setSources(fetchedSources);
    setAssets(fetchedAssets);
    setJobs(fetchedJobs);
    setLoading(false);
  };

  useEffect(() => {
    reloadData();
  }, [product.id]);

  // Default Source Rules auto-selection (Requirement 5)
  useEffect(() => {
    const autoSelectedIds: string[] = [];
    sources.forEach((src) => {
      if (selectedOutputType === "benefit_graphic") {
        if (src.group_type === "product_info" || src.group_type === "brand_materials") {
          autoSelectedIds.push(src.id);
        }
      } else if (selectedOutputType === "infographic") {
        if (src.group_type === "product_info" || src.group_type === "product_media") {
          autoSelectedIds.push(src.id);
        }
      } else if (selectedOutputType === "how_to_graphic" || selectedOutputType === "how_to_video") {
        if (src.group_type === "product_info") {
          autoSelectedIds.push(src.id);
        }
      } else if (selectedOutputType === "lifestyle_image") {
        if (src.group_type === "product_media" || src.group_type === "brand_materials") {
          autoSelectedIds.push(src.id);
        }
      } else if (selectedOutputType === "product_video") {
        if (src.group_type === "product_info" || src.group_type === "product_media" || src.group_type === "brand_materials") {
          autoSelectedIds.push(src.id);
        }
      }
    });

    // Fallback if no matching group
    if (autoSelectedIds.length === 0 && sources.length > 0) {
      autoSelectedIds.push(sources[0].id);
    }

    setSelectedSourceIds(autoSelectedIds);
  }, [selectedOutputType, sources]);

  // Handle Source Upload
  const handleUploadSource = async () => {
    if (!uploadFile) return;
    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", uploadFile);

    const res = await uploadMediaSourceMaterial(product.id, uploadGroup, uploadTitle, formData);
    setIsUploading(false);

    if (res.success && res.source) {
      setSources((prev) => [res.source!, ...prev]);
      setShowUploadModal(false);
      setUploadTitle("");
      setUploadFile(null);
    } else {
      alert(res.error || "Failed to upload file");
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
    } else {
      setActiveMainTab("drafts");
    }
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
    } else {
      alert(res.error || "Failed to approve asset");
    }
  };

  // Handle Edit as New Draft
  const handleEditAsNewDraft = async (approvedAsset: MediaAssetItem) => {
    const res = await editApprovedAsNewDraft(approvedAsset.id);
    if (res.success) {
      await reloadData();
      setActiveMainTab("drafts");
    } else {
      alert(res.error || "Failed to create new draft");
    }
  };

  // Handle Archive
  const handleArchive = async (assetId: string) => {
    if (!confirm("Are you sure you want to archive this asset?")) return;
    const res = await archiveMediaAsset(assetId);
    if (res.success) {
      setAssets((prev) => prev.filter((a) => a.id !== assetId));
    }
  };

  // Counts
  const draftAssets = assets.filter((a) => a.status === "draft" || a.status === "failed");
  const approvedAssets = assets.filter((a) => a.status === "approved");

  const filterAssets = (list: MediaAssetItem[]) => {
    if (typeFilter === "all") return list;
    return list.filter((a) => a.asset_type === typeFilter);
  };

  return (
    <div className="space-y-6">
      {/* HEADER & TOP SUMMARY CARDS */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-zinc-100 dark:border-zinc-800">
          <div>
            <div className="flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
                Media Assets (콘텐츠 제작실)
              </h2>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Source Materials → Create with AI → Draft → Edit / Regenerate → Approve → Approved Assets
            </p>
          </div>

          <button
            type="button"
            onClick={() => setActiveMainTab("create")}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
          >
            <SparklesIcon className="w-4 h-4" />
            <span>Create with AI</span>
          </button>
        </div>

        {/* SUMMARY TILES */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
          <div
            onClick={() => setActiveMainTab("sources")}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
              activeMainTab === "sources"
                ? "bg-indigo-50/60 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-800"
                : "bg-zinc-50 dark:bg-zinc-850 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            }`}
          >
            <div>
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
                Source Materials
              </span>
              <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                {sources.length} <span className="text-xs font-medium text-zinc-500">Items</span>
              </span>
            </div>
            <FileTextIcon className="w-6 h-6 text-zinc-400" />
          </div>

          <div
            onClick={() => setActiveMainTab("drafts")}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
              activeMainTab === "drafts"
                ? "bg-amber-50/60 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800"
                : "bg-zinc-50 dark:bg-zinc-850 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            }`}
          >
            <div>
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
                Draft Assets
              </span>
              <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                {draftAssets.length} <span className="text-xs font-medium text-zinc-500">Drafts</span>
              </span>
            </div>
            <EditIcon className="w-6 h-6 text-amber-500" />
          </div>

          <div
            onClick={() => setActiveMainTab("approved")}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
              activeMainTab === "approved"
                ? "bg-emerald-50/60 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800"
                : "bg-zinc-50 dark:bg-zinc-850 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            }`}
          >
            <div>
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
                Approved Assets
              </span>
              <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                {approvedAssets.length} <span className="text-xs font-medium text-zinc-500">Approved</span>
              </span>
            </div>
            <CheckCircleIcon className="w-6 h-6 text-emerald-500" />
          </div>
        </div>
      </div>

      {/* MAIN WORKSPACE TABS NAVIGATION */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-800 gap-1 overflow-x-auto">
        {[
          { id: "sources", label: "1. Source Materials", count: sources.length },
          { id: "create", label: "2. Create with AI" },
          { id: "drafts", label: "3. Drafts", count: draftAssets.length },
          { id: "approved", label: "4. Approved Assets", count: approvedAssets.length },
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

      {/* TAB 1: SOURCE MATERIALS */}
      {activeMainTab === "sources" && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-2xs space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                Product Source Materials (5 Core Groups)
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Authoritative catalog details, registered packshots, brand guide, and marketing references.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowUploadModal(true)}
              className="px-3 py-1.5 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-xs font-bold rounded-xl hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <PlusIcon className="w-3.5 h-3.5" />
              <span>Add Source Material</span>
            </button>
          </div>

          <div className="space-y-4">
            {[
              { id: "product_info", title: "A. Product Info (Catalog Authoritative Data)", desc: "Product name, description, bullet points, ingredients, attributes, how to use" },
              { id: "product_media", title: "B. Product Images & Videos", desc: "Main image, packshots, package images, product videos" },
              { id: "brand_materials", title: "C. Brand Materials", desc: "Logo, brand story, visual reference guidelines" },
              { id: "existing_content", title: "D. Existing Content", desc: "Amazon details, brochures, social media marketing assets" },
              { id: "reference_files", title: "E. Reference Files", desc: "PDF guides, lab tests, product reference documents" },
            ].map((group) => {
              const groupItems = sources.filter((s) => s.group_type === group.id);
              const isInfoGroup = group.id === "product_info";
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
                        <div className="p-2.5 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-900/40 rounded-lg flex items-center gap-2">
                          <CheckCircleIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <div>
                            <span className="text-[11px] font-bold text-zinc-900 dark:text-zinc-100 block">Product Name & Brand</span>
                            <span className="text-[10px] text-zinc-500">Synced ({product.brand_name})</span>
                          </div>
                        </div>
                        <div className="p-2.5 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-900/40 rounded-lg flex items-center gap-2">
                          <CheckCircleIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <div>
                            <span className="text-[11px] font-bold text-zinc-900 dark:text-zinc-100 block">Description & Summary</span>
                            <span className="text-[10px] text-zinc-500">Synced from Catalog</span>
                          </div>
                        </div>
                        <div className="p-2.5 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-900/40 rounded-lg flex items-center gap-2">
                          <CheckCircleIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <div>
                            <span className="text-[11px] font-bold text-zinc-900 dark:text-zinc-100 block">Bullet Points & Highlights</span>
                            <span className="text-[10px] text-zinc-500">Synced from Catalog</span>
                          </div>
                        </div>
                        <div className="p-2.5 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-900/40 rounded-lg flex items-center gap-2">
                          <CheckCircleIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <div>
                            <span className="text-[11px] font-bold text-zinc-900 dark:text-zinc-100 block">How to Use Directions</span>
                            <span className="text-[10px] text-zinc-500">Synced from Catalog</span>
                          </div>
                        </div>
                        <div className="p-2.5 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-900/40 rounded-lg flex items-center gap-2">
                          <CheckCircleIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <div>
                            <span className="text-[11px] font-bold text-zinc-900 dark:text-zinc-100 block">Ingredients & Formula</span>
                            <span className="text-[10px] text-zinc-500">Synced from Catalog</span>
                          </div>
                        </div>
                        <div className="p-2.5 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-900/40 rounded-lg flex items-center gap-2">
                          <CheckCircleIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <div>
                            <span className="text-[11px] font-bold text-zinc-900 dark:text-zinc-100 block">Product Attributes</span>
                            <span className="text-[10px] text-zinc-500">Synced from Catalog</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      {groupItems.length === 0 ? (
                        <div className="px-4 py-2.5 bg-zinc-50 dark:bg-zinc-850/50 flex items-center justify-between text-xs">
                          <span className="text-zinc-500 dark:text-zinc-400 font-medium">
                            No materials uploaded for this group yet.
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setUploadGroup(group.id as SourceGroupType);
                              setShowUploadModal(true);
                            }}
                            className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer flex items-center gap-1"
                          >
                            <PlusIcon className="w-3.5 h-3.5" />
                            <span>Add Material</span>
                          </button>
                        </div>
                      ) : (
                        groupItems.map((item) => (
                          <div key={item.id} className="p-3 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              {item.url && (item.source_type === "image" || item.group_type === "brand_materials") ? (
                                <img src={item.url} alt={item.title} className="w-9 h-9 rounded-lg object-cover border border-zinc-200 dark:border-zinc-700 shrink-0" />
                              ) : (
                                <div className="w-9 h-9 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                                  <FileTextIcon className="w-4 h-4 text-zinc-500" />
                                </div>
                              )}
                              <div className="min-w-0">
                                <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 block truncate">{item.title}</span>
                                <span className="text-[10.5px] text-zinc-500 truncate block">
                                  Type: {item.source_type} {item.file_name && `• ${item.file_name}`}
                                </span>
                              </div>
                            </div>
                            <span className="text-[10px] font-mono text-zinc-400 shrink-0">Catalog Synced</span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: CREATE WITH AI */}
      {activeMainTab === "create" && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-2xs space-y-6">
          <div>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              Create with AI — Select Output Type & Configure Settings
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              System auto-selects required catalog sources. Customize creation settings to generate a new draft.
            </p>
          </div>

          {/* STEP 1: CHOOSE CONTENT TYPE (6 OUTPUT TYPES) */}
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

          {/* STEP 2: REVIEW AUTO-SELECTED SOURCES */}
          <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
            <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider block">
              Step 2 — Review Auto-Selected Sources
            </span>
            <div className="bg-zinc-50 dark:bg-zinc-850 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-2 max-h-56 overflow-y-auto">
              {(() => {
                const displaySources = sources.length > 0 ? sources : [
                  {
                    id: `info-cat-${product.id}`,
                    product_id: product.id,
                    group_type: "product_info" as SourceGroupType,
                    title: `${product.name} (Official Catalog Data)`,
                    source_type: "catalog_sync",
                    created_at: new Date().toISOString(),
                  }
                ];
                return displaySources.map((src) => {
                  const isChecked = selectedSourceIds.includes(src.id) || src.group_type === "product_info";
                  return (
                    <label key={src.id} className="flex items-center gap-2.5 text-xs text-zinc-800 dark:text-zinc-200 cursor-pointer">
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
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="font-semibold">{src.title}</span>
                      <span className="text-[10px] font-mono text-zinc-400">[{src.group_type}]</span>
                    </label>
                  );
                });
              })()}
            </div>
          </div>

          {/* STEP 3: CREATION SETTINGS */}
          <div className="space-y-3 pt-2 border-t border-zinc-100 dark:border-zinc-800">
            <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider block">
              Step 3 — Simple Creation Settings
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-[10.5px] font-bold text-zinc-500 mb-1">Target Audience</label>
                <select
                  value={creationSettings.audience}
                  onChange={(e) => setCreationSettings({ ...creationSettings, audience: e.target.value as TargetAudience })}
                  className="w-full py-1.5 px-2.5 text-xs rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                >
                  <option value="customer">Customer</option>
                  <option value="retail_staff">Retail Staff</option>
                  <option value="both">Both (Customer & Staff)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10.5px] font-bold text-zinc-500 mb-1">Visual Style</label>
                <input
                  type="text"
                  value={creationSettings.style}
                  onChange={(e) => setCreationSettings({ ...creationSettings, style: e.target.value })}
                  className="w-full py-1.5 px-2.5 text-xs rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="block text-[10.5px] font-bold text-zinc-500 mb-1">Language</label>
                <input
                  type="text"
                  value={creationSettings.language}
                  onChange={(e) => setCreationSettings({ ...creationSettings, language: e.target.value })}
                  className="w-full py-1.5 px-2.5 text-xs rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="block text-[10.5px] font-bold text-zinc-500 mb-1">Optional Instruction</label>
                <input
                  type="text"
                  placeholder="Focus on hydration..."
                  value={creationSettings.optional_instruction || ""}
                  onChange={(e) => setCreationSettings({ ...creationSettings, optional_instruction: e.target.value })}
                  className="w-full py-1.5 px-2.5 text-xs rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                />
              </div>
            </div>
          </div>

          {/* GENERATION ERROR ALERT */}
          {generationError && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2.5">
              <AlertTriangleIcon className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">AI Generation Warning / Diagnostic</span>
                <span>{generationError}</span>
              </div>
            </div>
          )}

          {/* GENERATE CTA */}
          <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex justify-end">
            <button
              type="button"
              disabled={isGenerating}
              onClick={handleGenerateAI}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-all shadow-xs flex items-center gap-2 cursor-pointer"
            >
              {isGenerating ? (
                <>
                  <RefreshCwIcon className="w-4 h-4 animate-spin" />
                  <span>Generating Draft with AI...</span>
                </>
              ) : (
                <>
                  <SparklesIcon className="w-4 h-4" />
                  <span>Generate Draft Asset</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: DRAFTS */}
      {activeMainTab === "drafts" && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-2xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                Draft Media Assets ({filterAssets(draftAssets).length})
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Review, Edit, Regenerate, or directly Approve generated drafts.
              </p>
            </div>

            {/* Asset Type Filter Dropdown */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-zinc-500">Filter Type:</span>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as AssetTypeFilter)}
                className="py-1 px-2 text-xs font-semibold rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
              >
                <option value="all">All Types</option>
                <option value="benefit_graphic">Benefit Graphic</option>
                <option value="infographic">Infographic</option>
                <option value="how_to_graphic">How-to Graphic</option>
                <option value="lifestyle_image">Lifestyle Image</option>
                <option value="product_video">Product Video</option>
                <option value="how_to_video">How-to Video</option>
              </select>
            </div>
          </div>

          {filterAssets(draftAssets).length === 0 ? (
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
              {filterAssets(draftAssets).map((asset) => (
                <div key={asset.id} className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 bg-zinc-50 dark:bg-zinc-850 space-y-3 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 text-[9.5px] font-bold rounded uppercase bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                        {asset.status === "failed" ? "Failed / Action Needed" : `Draft v${asset.version}`}
                      </span>
                      <span className="text-[10px] text-zinc-400 font-mono">
                        {new Date(asset.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 line-clamp-2">{asset.title}</h4>
                    <p className="text-[10.5px] text-zinc-500">Type: {asset.asset_type}</p>

                    {/* Diagnostic Warning if failed */}
                    {asset.status === "failed" && (
                      <div className="p-2 rounded bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-[10px] text-rose-700 dark:text-rose-300">
                        {asset.content_data.error_message || "AI Provider key missing. Real AI API integration required."}
                      </div>
                    )}
                  </div>

                  {/* CARD ACTIONS */}
                  <div className="pt-3 border-t border-zinc-200/60 dark:border-zinc-800 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setPreviewAsset(asset)}
                      className="px-2.5 py-1 text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-750 rounded-lg cursor-pointer"
                    >
                      Preview
                    </button>

                    <button
                      type="button"
                      onClick={() => openEditModal(asset)}
                      className="px-2.5 py-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg cursor-pointer"
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      onClick={() => setApprovingAsset(asset)}
                      className="px-3 py-1 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors cursor-pointer"
                    >
                      Approve
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: APPROVED ASSETS */}
      {activeMainTab === "approved" && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-2xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                Approved Assets Library ({filterAssets(approvedAssets).length})
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Ready for Customer Page and Staff Training. Edit creates a new draft version.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-zinc-500">Filter Type:</span>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as AssetTypeFilter)}
                className="py-1 px-2 text-xs font-semibold rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
              >
                <option value="all">All Types</option>
                <option value="benefit_graphic">Benefit Graphic</option>
                <option value="infographic">Infographic</option>
                <option value="how_to_graphic">How-to Graphic</option>
                <option value="lifestyle_image">Lifestyle Image</option>
                <option value="product_video">Product Video</option>
                <option value="how_to_video">How-to Video</option>
              </select>
            </div>
          </div>

          {filterAssets(approvedAssets).length === 0 ? (
            <div className="py-12 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl text-center">
              <CheckCircleIcon className="w-8 h-8 text-zinc-300 dark:text-zinc-600 mx-auto mb-2" />
              <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">No Approved Assets Yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {filterAssets(approvedAssets).map((asset) => (
                <div key={asset.id} className="border border-emerald-200 dark:border-emerald-900/60 rounded-xl p-4 bg-emerald-50/20 dark:bg-emerald-950/10 space-y-3 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 text-[9.5px] font-bold rounded uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        Approved v{asset.version}
                      </span>
                      <span className="text-[10px] text-zinc-400 font-mono">
                        {asset.approved_at ? new Date(asset.approved_at).toLocaleDateString() : ""}
                      </span>
                    </div>

                    <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 line-clamp-2">{asset.title}</h4>

                    <div className="flex flex-wrap items-center gap-1">
                      <span className="text-[10px] text-zinc-500 mr-1">Used In:</span>
                      {asset.used_in.length === 0 ? (
                        <span className="text-[10px] text-zinc-400 italic">None assigned</span>
                      ) : (
                        asset.used_in.map((u) => (
                          <span key={u} className="px-1.5 py-0.2 rounded text-[9.5px] font-semibold bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300">
                            {u === "customer_page" ? "Customer Page" : "Training"}
                          </span>
                        ))
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

                    <button
                      type="button"
                      onClick={() => setLineageAsset(asset)}
                      aria-label="View Lineage Info"
                      title="View Lineage Info"
                      className="px-2 py-1 text-[10.5px] font-semibold text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg cursor-pointer"
                    >
                      <InfoIcon className="w-3.5 h-3.5 inline mr-1" />
                      Lineage
                    </button>

                    <button
                      type="button"
                      onClick={() => handleEditAsNewDraft(asset)}
                      className="px-2.5 py-1 text-[10.5px] font-bold bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 rounded-lg hover:bg-zinc-800 cursor-pointer"
                    >
                      Edit as New Draft
                    </button>

                    <button
                      type="button"
                      onClick={() => handleArchive(asset.id)}
                      aria-label="Archive Asset"
                      title="Archive Asset"
                      className="p-1 text-zinc-400 hover:text-rose-600 cursor-pointer"
                    >
                      <ArchiveIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: UPLOAD SOURCE MATERIAL */}
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
                <label className="block font-bold text-zinc-600 mb-1">Title</label>
                <input
                  type="text"
                  placeholder="Amazon Detail Image 1..."
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  className="w-full py-1.5 px-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
                />
              </div>

              <div>
                <label className="block font-bold text-zinc-600 mb-1">Select File</label>
                <input
                  type="file"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="w-full py-1.5 px-2 text-xs"
                />
              </div>
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
                disabled={isUploading || !uploadFile}
                onClick={handleUploadSource}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl"
              >
                {isUploading ? "Uploading..." : "Upload Source"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: QUICK EDIT */}
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

              {/* Text layers edit for graphics */}
              {editTextLayers.length > 0 && (
                <div className="space-y-2">
                  <span className="font-bold text-zinc-700 uppercase tracking-wider block text-[10px]">Text Layers / Copy Edits</span>
                  {editTextLayers.map((layer, index) => (
                    <div key={layer.id} className="p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                      <input
                        type="text"
                        value={layer.text}
                        onChange={(e) => {
                          const updated = [...editTextLayers];
                          updated[index].text = e.target.value;
                          setEditTextLayers(updated);
                        }}
                        className="w-full py-1 px-2 rounded border border-zinc-300 dark:border-zinc-700 text-xs"
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Video scenes edit */}
              {editScenes.length > 0 && (
                <div className="space-y-2">
                  <span className="font-bold text-zinc-700 uppercase tracking-wider block text-[10px]">Video Scene Script</span>
                  {editScenes.map((scene, index) => (
                    <div key={scene.id} className="p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 space-y-1">
                      <span className="font-semibold block text-[11px]">Scene {scene.id}: {scene.title}</span>
                      <input
                        type="text"
                        value={scene.text}
                        onChange={(e) => {
                          const updated = [...editScenes];
                          updated[index].text = e.target.value;
                          setEditScenes(updated);
                        }}
                        className="w-full py-1 px-2 rounded border border-zinc-300 dark:border-zinc-700 text-xs"
                      />
                    </div>
                  ))}
                </div>
              )}
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

      {/* MODAL 3: APPROVE CONFIRMATION */}
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

            <div className="space-y-1.5 text-xs">
              <span className="font-bold text-zinc-700">Usage Target:</span>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={targetUsage.includes("customer_page")}
                    onChange={(e) => {
                      if (e.target.checked) setTargetUsage([...targetUsage, "customer_page"]);
                      else setTargetUsage(targetUsage.filter((u) => u !== "customer_page"));
                    }}
                    className="rounded text-emerald-600"
                  />
                  <span>Customer Page</span>
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={targetUsage.includes("training")}
                    onChange={(e) => {
                      if (e.target.checked) setTargetUsage([...targetUsage, "training"]);
                      else setTargetUsage(targetUsage.filter((u) => u !== "training"));
                    }}
                    className="rounded text-emerald-600"
                  />
                  <span>Staff Training</span>
                </label>
              </div>
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

      {/* MODAL 4: LINEAGE & TRACEABILITY */}
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

      {/* MODAL 5: PREVIEW */}
      {previewAsset && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 max-w-xl w-full space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{previewAsset.title}</h3>
              <button onClick={() => setPreviewAsset(null)} className="text-zinc-400 hover:text-zinc-600">
                <XIcon className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 bg-zinc-100 dark:bg-zinc-850 rounded-xl flex items-center justify-center min-h-48 border border-zinc-200 dark:border-zinc-700">
              {previewAsset.url ? (
                <img src={previewAsset.url} alt={previewAsset.title} className="max-h-80 object-contain rounded" />
              ) : (
                <div className="text-center space-y-2">
                  <ImageIcon className="w-10 h-10 text-zinc-400 mx-auto" />
                  <span className="text-xs text-zinc-500 block font-semibold">
                    {previewAsset.asset_type.toUpperCase()} Preview
                  </span>
                  {previewAsset.content_data.benefits_list && (
                    <div className="text-left text-xs space-y-1 mt-2">
                      <span className="font-bold block">Synthesized Benefits:</span>
                      {previewAsset.content_data.benefits_list.map((b, i) => (
                        <div key={i} className="text-[11px] text-zinc-600 dark:text-zinc-400">
                          • <strong>{b.title}:</strong> {b.description}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setPreviewAsset(null)}
                className="px-4 py-1.5 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-bold text-xs rounded-xl"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
