"use client";

import React, { useState, useEffect, useTransition } from "react";
import type { ContentProductItem } from "@/lib/product/content-actions";
import {
  FAQ_CATEGORIES,
  type FaqCategory,
  type FaqAudience,
  type FaqStatus,
  type ProductFaqItem,
  type FaqAiSuggestion,
} from "@/lib/product/faq-types";
import {
  getProductFaqs,
  createProductFaq,
  updateProductFaq,
  deleteProductFaq,
  updateFaqStatus,
  reorderProductFaqs,
  saveBulkDraftFaqs,
  generateFaqAiSuggestions,
} from "@/lib/product/faq-actions";

// Icons
function SparklesIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
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

function CheckIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function TrashIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
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

function ArrowUpIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
    </svg>
  );
}

function ArrowDownIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function SearchIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
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

function ArchiveIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
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

interface FaqWorkspaceProps {
  product: ContentProductItem;
}

export function FaqWorkspace({ product }: FaqWorkspaceProps) {
  const [faqs, setFaqs] = useState<ProductFaqItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [audienceFilter, setAudienceFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"admin" | "customer_preview" | "training_preview">("admin");

  // Add / Edit Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingFaq, setEditingFaq] = useState<ProductFaqItem | null>(null);
  const [formQuestion, setFormQuestion] = useState("");
  const [formAnswer, setFormAnswer] = useState("");
  const [formCategory, setFormCategory] = useState<FaqCategory>("Product Basics");
  const [formAudience, setFormAudience] = useState<FaqAudience>("both");
  const [formStatus, setFormStatus] = useState<FaqStatus>("draft");
  const [formRequiresConfirmation, setFormRequiresConfirmation] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // AI Suggestion Modal State
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<FaqAiSuggestion[]>([]);
  const [aiCount, setAiCount] = useState<number>(8);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Load FAQs on mount & after mutations
  const loadFaqs = async () => {
    setLoading(true);
    try {
      const items = await getProductFaqs(product.id);
      setFaqs(items);
    } catch (err) {
      console.error("Failed to load FAQs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFaqs();
  }, [product.id]);

  // Open Add Modal
  const handleOpenAddModal = () => {
    setEditingFaq(null);
    setFormQuestion("");
    setFormAnswer("");
    setFormCategory("Product Basics");
    setFormAudience("both");
    setFormStatus("draft");
    setFormRequiresConfirmation(false);
    setFormError(null);
    setIsAddModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (item: ProductFaqItem) => {
    setEditingFaq(item);
    setFormQuestion(item.question);
    setFormAnswer(item.answer);
    setFormCategory(item.category);
    setFormAudience(item.audience);
    setFormStatus(item.status);
    setFormRequiresConfirmation(item.requires_brand_confirmation);
    setFormError(null);
    setIsAddModalOpen(true);
  };

  // Save Add / Edit
  const handleSaveFaq = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formQuestion.trim() || !formAnswer.trim()) {
      setFormError("Question and Answer are required.");
      return;
    }

    startTransition(async () => {
      try {
        if (editingFaq) {
          const res = await updateProductFaq(editingFaq.id, {
            question: formQuestion,
            answer: formAnswer,
            category: formCategory,
            audience: formAudience,
            status: formStatus,
            requires_brand_confirmation: formRequiresConfirmation,
          });
          if (!res.success) {
            setFormError(res.error || "Failed to update FAQ");
            return;
          }
        } else {
          const res = await createProductFaq({
            productId: product.id,
            question: formQuestion,
            answer: formAnswer,
            category: formCategory,
            audience: formAudience,
            status: formStatus,
            requires_brand_confirmation: formRequiresConfirmation,
          });
          if (!res.success) {
            setFormError(res.error || "Failed to create FAQ");
            return;
          }
        }
        setIsAddModalOpen(false);
        await loadFaqs();
      } catch (err: any) {
        setFormError(err.message || "An unexpected error occurred");
      }
    });
  };

  // Delete FAQ
  const handleDeleteFaq = async (id: string) => {
    if (!confirm("Are you sure you want to delete this FAQ item?")) return;
    startTransition(async () => {
      const res = await deleteProductFaq(id, product.id);
      if (res.success) {
        await loadFaqs();
      } else {
        alert(res.error || "Failed to delete FAQ");
      }
    });
  };

  // Status Change (Approve, Archive, Set to Draft)
  const handleStatusChange = async (id: string, newStatus: FaqStatus) => {
    startTransition(async () => {
      const res = await updateFaqStatus(id, product.id, newStatus);
      if (res.success) {
        await loadFaqs();
      } else {
        alert(res.error || "Failed to update status");
      }
    });
  };

  // Move Order Up / Down
  const handleMoveOrder = async (index: number, direction: "up" | "down") => {
    const newFaqs = [...faqs];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newFaqs.length) return;

    const temp = newFaqs[index];
    newFaqs[index] = newFaqs[targetIndex];
    newFaqs[targetIndex] = temp;

    setFaqs(newFaqs);
    const orderedIds = newFaqs.map((f) => f.id);
    startTransition(async () => {
      await reorderProductFaqs(product.id, orderedIds);
    });
  };

  // Open AI Suggestion Modal
  const handleOpenAiModal = () => {
    setIsAiModalOpen(true);
    setAiSuggestions([]);
    setAiError(null);
  };

  // Trigger AI Suggestion Generation
  const handleGenerateAi = async () => {
    setIsGeneratingAi(true);
    setAiError(null);
    try {
      const res = await generateFaqAiSuggestions(product.id, { count: aiCount });
      if (res.success) {
        setAiSuggestions(res.suggestions);
      } else {
        setAiError(res.error || "Failed to generate suggestions");
      }
    } catch (err: any) {
      setAiError(err.message || "Failed to generate AI suggestions");
    } finally {
      setIsGeneratingAi(false);
    }
  };

  // Toggle selection of AI suggestion
  const handleToggleAiSelect = (tempId: string) => {
    setAiSuggestions((prev) =>
      prev.map((s) => (s.tempId === tempId ? { ...s, selected: !s.selected } : s))
    );
  };

  // Save selected AI suggestions as Drafts
  const handleSaveSelectedAiDrafts = async (targetStatus: FaqStatus = "draft") => {
    const selected = aiSuggestions.filter((s) => s.selected);
    if (selected.length === 0) {
      alert("Please select at least one suggestion to save.");
      return;
    }

    startTransition(async () => {
      const res = await saveBulkDraftFaqs(
        product.id,
        selected.map((s) => ({
          question: s.question,
          answer: s.answer,
          category: s.category,
          audience: s.audience,
          source_refs: s.source_refs,
          requires_brand_confirmation: s.requires_brand_confirmation,
          status: targetStatus,
        }))
      );

      if (res.success) {
        setIsAiModalOpen(false);
        await loadFaqs();
      } else {
        alert(res.error || "Failed to save suggestions");
      }
    });
  };

  // Filtered FAQs list based on View Mode and user filters
  const filteredFaqs = faqs.filter((f) => {
    // Mode specific filtering
    if (viewMode === "customer_preview") {
      if (f.status !== "approved") return false;
      if (f.audience !== "customer" && f.audience !== "both") return false;
    } else if (viewMode === "training_preview") {
      if (f.status !== "approved") return false;
      if (f.audience !== "retail_staff" && f.audience !== "both") return false;
    } else {
      // Admin filter
      if (statusFilter !== "all" && f.status !== statusFilter) return false;
    }

    if (categoryFilter !== "all" && f.category !== categoryFilter) return false;
    if (audienceFilter !== "all" && f.audience !== audienceFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchQ = f.question.toLowerCase().includes(q);
      const matchA = f.answer.toLowerCase().includes(q);
      const matchCat = f.category.toLowerCase().includes(q);
      if (!matchQ && !matchA && !matchCat) return false;
    }
    return true;
  });

  const totalCount = faqs.length;
  const approvedCount = faqs.filter((f) => f.status === "approved").length;
  const draftCount = faqs.filter((f) => f.status === "draft").length;
  const archivedCount = faqs.filter((f) => f.status === "archived").length;

  return (
    <div className="space-y-6">
      {/* 1. Header & Summary Stats */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-zinc-100 dark:border-zinc-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold">
                FAQ
              </span>
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                Product FAQ & Q&A Knowledge
              </h2>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Authoritative questions and answers reused across Customer QR Pages and Retail Staff Training.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={handleOpenAiModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-colors cursor-pointer"
            >
              <SparklesIcon className="w-4 h-4 text-indigo-200" />
              Suggest with AI
            </button>
            <button
              onClick={handleOpenAddModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 shadow-sm transition-colors cursor-pointer"
            >
              <PlusIcon className="w-4 h-4" />
              Add FAQ
            </button>
          </div>
        </div>

        {/* Metric Cards & View Switcher */}
        <div className="pt-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-1">
            <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-850 border border-zinc-200/70 dark:border-zinc-800">
              <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Total FAQs
              </div>
              <div className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mt-0.5">
                {totalCount}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/70 dark:border-emerald-800/50">
              <div className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                Approved
              </div>
              <div className="text-xl font-bold text-emerald-700 dark:text-emerald-400 mt-0.5">
                {approvedCount}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-800/50">
              <div className="text-[11px] font-medium text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                Drafts
              </div>
              <div className="text-xl font-bold text-amber-700 dark:text-amber-400 mt-0.5">
                {draftCount}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-850 border border-zinc-200/70 dark:border-zinc-800">
              <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Archived
              </div>
              <div className="text-xl font-bold text-zinc-600 dark:text-zinc-400 mt-0.5">
                {archivedCount}
              </div>
            </div>
          </div>

          {/* View Mode Toggle */}
          <div className="inline-flex rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-850 p-0.5 self-start md:self-center shrink-0">
            <button
              onClick={() => setViewMode("admin")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                viewMode === "admin"
                  ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900"
              }`}
            >
              Workspace View
            </button>
            <button
              onClick={() => setViewMode("customer_preview")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1 ${
                viewMode === "customer_preview"
                  ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900"
              }`}
            >
              <EyeIcon className="w-3.5 h-3.5 text-blue-500" />
              Customer QR Preview
            </button>
            <button
              onClick={() => setViewMode("training_preview")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1 ${
                viewMode === "training_preview"
                  ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900"
              }`}
            >
              <EyeIcon className="w-3.5 h-3.5 text-purple-500" />
              Staff Training Preview
            </button>
          </div>
        </div>
      </div>

      {/* 2. Filters & Search Bar */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <SearchIcon className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search questions, answers, or keywords..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-zinc-200 dark:border-zinc-750 bg-zinc-50 dark:bg-zinc-850 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-2.5 py-2 text-xs rounded-lg border border-zinc-200 dark:border-zinc-750 bg-zinc-50 dark:bg-zinc-850 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
          >
            <option value="all">All Categories (7)</option>
            {FAQ_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          {/* Audience Filter */}
          <select
            value={audienceFilter}
            onChange={(e) => setAudienceFilter(e.target.value)}
            className="px-2.5 py-2 text-xs rounded-lg border border-zinc-200 dark:border-zinc-750 bg-zinc-50 dark:bg-zinc-850 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
          >
            <option value="all">All Audiences</option>
            <option value="both">Both (Customer & Staff)</option>
            <option value="customer">Customer Only</option>
            <option value="retail_staff">Retail Staff Only</option>
          </select>

          {/* Status Filter (Workspace mode only) */}
          {viewMode === "admin" && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-2 text-xs rounded-lg border border-zinc-200 dark:border-zinc-750 bg-zinc-50 dark:bg-zinc-850 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            >
              <option value="all">All Statuses</option>
              <option value="approved">Approved</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </select>
          )}
        </div>
      </div>

      {/* 3. FAQ List Table / Cards */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-xs text-zinc-500">
            <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            Loading FAQs...
          </div>
        ) : filteredFaqs.length === 0 ? (
          <div className="py-16 text-center px-4">
            <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-400 flex items-center justify-center mx-auto mb-3">
              <SparklesIcon className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
              {viewMode === "customer_preview"
                ? "No Approved Customer FAQs Found"
                : viewMode === "training_preview"
                ? "No Approved Staff Training FAQs Found"
                : "No FAQs Found"}
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto mt-1">
              {viewMode !== "admin"
                ? "Switch back to Workspace View and approve draft FAQs to display them here."
                : "Add your first FAQ manually or generate suggestions using AI based on authoritative product facts."}
            </p>
            {viewMode === "admin" && (
              <div className="mt-4 flex items-center justify-center gap-2">
                <button
                  onClick={handleOpenAiModal}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors cursor-pointer"
                >
                  <SparklesIcon className="w-3.5 h-3.5" />
                  Suggest with AI
                </button>
                <button
                  onClick={handleOpenAddModal}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-200 transition-colors cursor-pointer"
                >
                  <PlusIcon className="w-3.5 h-3.5" />
                  Add Manually
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {filteredFaqs.map((faq, idx) => (
              <div
                key={faq.id}
                className="p-5 hover:bg-zinc-50/50 dark:hover:bg-zinc-850/30 transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
              >
                {/* Left side: Reorder & Q&A Content */}
                <div className="flex items-start gap-3.5 flex-1 min-w-0">
                  {/* Reorder Buttons (Only in Workspace View without active search/filter) */}
                  {viewMode === "admin" && searchQuery === "" && categoryFilter === "all" && (
                    <div className="flex flex-col gap-0.5 pt-0.5 shrink-0">
                      <button
                        onClick={() => handleMoveOrder(idx, "up")}
                        disabled={idx === 0 || isPending}
                        className="p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 disabled:opacity-20 transition-colors"
                        title="Move Up"
                      >
                        <ArrowUpIcon className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleMoveOrder(idx, "down")}
                        disabled={idx === filteredFaqs.length - 1 || isPending}
                        className="p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 disabled:opacity-20 transition-colors"
                        title="Move Down"
                      >
                        <ArrowDownIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  <div className="space-y-1.5 min-w-0 flex-1">
                    {/* Meta Badges */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Category Badge */}
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border border-zinc-200/80 dark:border-zinc-750">
                        {faq.category}
                      </span>

                      {/* Audience Badge */}
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                          faq.audience === "customer"
                            ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900"
                            : faq.audience === "retail_staff"
                            ? "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-900"
                            : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900"
                        }`}
                      >
                        {faq.audience === "customer"
                          ? "Customer Only"
                          : faq.audience === "retail_staff"
                          ? "Retail Staff Only"
                          : "Both (Customer & Staff)"}
                      </span>

                      {/* Source Type Badge */}
                      {faq.source_type === "ai_suggested" && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-900 flex items-center gap-1">
                          <SparklesIcon className="w-3 h-3" />
                          AI Suggested
                        </span>
                      )}

                      {/* Brand Confirmation Required Badge */}
                      {faq.requires_brand_confirmation && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800 flex items-center gap-1">
                          <AlertTriangleIcon className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                          Brand Confirmation Required
                        </span>
                      )}

                      {/* Status Badge */}
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                          faq.status === "approved"
                            ? "bg-emerald-100/70 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
                            : faq.status === "draft"
                            ? "bg-amber-100/70 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800"
                            : "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700"
                        }`}
                      >
                        {faq.status}
                      </span>
                    </div>

                    {/* Question */}
                    <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 leading-snug">
                      {faq.question}
                    </h4>

                    {/* Answer */}
                    <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed whitespace-pre-line">
                      {faq.answer}
                    </p>

                    {/* Source References */}
                    {faq.source_refs && faq.source_refs.length > 0 && (
                      <div className="text-[11px] text-zinc-400 dark:text-zinc-500 pt-0.5 flex items-center gap-1">
                        <span>Source:</span>
                        {faq.source_refs.map((ref, rIdx) => (
                          <span
                            key={rIdx}
                            className="px-1.5 py-0.2 bg-zinc-100 dark:bg-zinc-800 rounded text-[10px] text-zinc-600 dark:text-zinc-400"
                          >
                            {ref}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right side: Actions */}
                {viewMode === "admin" && (
                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                    {/* Approve / Unapprove Button */}
                    {faq.status === "draft" && (
                      <button
                        onClick={() => handleStatusChange(faq.id, "approved")}
                        disabled={isPending}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-md bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer shadow-xs"
                      >
                        <CheckIcon className="w-3.5 h-3.5" />
                        Approve
                      </button>
                    )}

                    {faq.status === "approved" && (
                      <button
                        onClick={() => handleStatusChange(faq.id, "draft")}
                        disabled={isPending}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md bg-zinc-100 hover:bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-750 dark:text-zinc-300 transition-colors cursor-pointer"
                        title="Revert to Draft"
                      >
                        Back to Draft
                      </button>
                    )}

                    {/* Archive / Restore Button */}
                    {faq.status !== "archived" ? (
                      <button
                        onClick={() => handleStatusChange(faq.id, "archived")}
                        disabled={isPending}
                        className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                        title="Archive FAQ"
                      >
                        <ArchiveIcon className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        onClick={() => handleStatusChange(faq.id, "draft")}
                        disabled={isPending}
                        className="px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
                      >
                        Restore
                      </button>
                    )}

                    {/* Edit Button */}
                    <button
                      onClick={() => handleOpenEditModal(faq)}
                      disabled={isPending}
                      className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                      title="Edit FAQ"
                    >
                      <EditIcon className="w-4 h-4" />
                    </button>

                    {/* Delete Button */}
                    <button
                      onClick={() => handleDeleteFaq(faq.id)}
                      disabled={isPending}
                      className="p-1.5 rounded-md text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                      title="Delete FAQ"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 4. Add / Edit FAQ Modal */}
      {/* ========================================================================= */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                {editingFaq ? "Edit FAQ Item" : "Add New FAQ Item"}
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveFaq} className="space-y-4">
              {/* Question Input */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Question (질문) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., How often should this product be applied?"
                  value={formQuestion}
                  onChange={(e) => setFormQuestion(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-850 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>

              {/* Answer Textarea */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Answer (답변) *
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Provide a factual, clear, and customer-friendly explanation..."
                  value={formAnswer}
                  onChange={(e) => setFormAnswer(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-850 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>

              {/* Category & Audience Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Category (7대 분류)
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as FaqCategory)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-850 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  >
                    {FAQ_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Target Audience (활용 대상)
                  </label>
                  <select
                    value={formAudience}
                    onChange={(e) => setFormAudience(e.target.value as FaqAudience)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-850 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  >
                    <option value="both">Both (Customer & Retail Staff)</option>
                    <option value="customer">Customer Only (QR Guide)</option>
                    <option value="retail_staff">Retail Staff Only (Training)</option>
                  </select>
                </div>
              </div>

              {/* Status & Confirmation Toggle */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Status (상태)
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as FaqStatus)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-850 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  >
                    <option value="draft">Draft (초안)</option>
                    <option value="approved">Approved (승인)</option>
                    <option value="archived">Archived (보관됨)</option>
                  </select>
                </div>

                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formRequiresConfirmation}
                      onChange={(e) => setFormRequiresConfirmation(e.target.checked)}
                      className="w-4 h-4 text-amber-600 rounded border-zinc-300 focus:ring-amber-500"
                    />
                    <span className="text-xs text-zinc-700 dark:text-zinc-300 font-medium">
                      Requires Brand Confirmation
                    </span>
                  </label>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-750 dark:text-zinc-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-amber-600 hover:bg-amber-700 text-white shadow-sm transition-colors"
                >
                  {isPending ? "Saving..." : editingFaq ? "Save Changes" : "Create FAQ"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. AI Suggestion Modal */}
      {/* ========================================================================= */}
      {isAiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                  <SparklesIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                    AI FAQ Generator (Catalog Facts Grounded)
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Generates 5–10 structured Q&As based on Description, How to Use, Bullet Points, and Ingredients.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAiModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            {/* Modal Controls */}
            <div className="p-5 bg-zinc-50/70 dark:bg-zinc-850/40 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Question Count:
                </label>
                <select
                  value={aiCount}
                  onChange={(e) => setAiCount(Number(e.target.value))}
                  className="px-2.5 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                >
                  <option value={5}>5 Questions</option>
                  <option value={6}>6 Questions</option>
                  <option value={7}>7 Questions</option>
                  <option value={8}>8 Questions (Recommended)</option>
                  <option value={9}>9 Questions</option>
                  <option value={10}>10 Questions</option>
                </select>
              </div>

              <button
                onClick={handleGenerateAi}
                disabled={isGeneratingAi}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-colors cursor-pointer disabled:opacity-50"
              >
                {isGeneratingAi ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <SparklesIcon className="w-4 h-4 text-indigo-200" />
                    {aiSuggestions.length > 0 ? "Regenerate Suggestions" : "Generate Suggestions"}
                  </>
                )}
              </button>
            </div>

            {/* Modal Body / Results */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {aiError && (
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
                  {aiError}
                </div>
              )}

              {aiSuggestions.length === 0 && !isGeneratingAi && (
                <div className="py-14 text-center">
                  <SparklesIcon className="w-8 h-8 text-zinc-300 dark:text-zinc-600 mx-auto mb-2" />
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Click <strong>Generate Suggestions</strong> above to analyze catalog facts and create tailored Q&As.
                  </p>
                </div>
              )}

              {aiSuggestions.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
                    <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                      Generated Suggestions ({aiSuggestions.filter((s) => s.selected).length}/{aiSuggestions.length} selected)
                    </span>
                    <button
                      onClick={() => {
                        const allSelected = aiSuggestions.every((s) => s.selected);
                        setAiSuggestions((prev) => prev.map((s) => ({ ...s, selected: !allSelected })));
                      }}
                      className="text-xs text-indigo-600 dark:text-indigo-400 font-medium hover:underline"
                    >
                      {aiSuggestions.every((s) => s.selected) ? "Deselect All" : "Select All"}
                    </button>
                  </div>

                  {aiSuggestions.map((sug) => (
                    <div
                      key={sug.tempId}
                      onClick={() => handleToggleAiSelect(sug.tempId)}
                      className={`p-4 rounded-xl border transition-all cursor-pointer ${
                        sug.selected
                          ? "bg-indigo-50/40 dark:bg-indigo-950/20 border-indigo-300 dark:border-indigo-800"
                          : "bg-white dark:bg-zinc-850 border-zinc-200 dark:border-zinc-750 opacity-60 hover:opacity-100"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={sug.selected}
                          onChange={() => handleToggleAiSelect(sug.tempId)}
                          className="mt-1 w-4 h-4 text-indigo-600 rounded border-zinc-300 focus:ring-indigo-500"
                        />
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                              {sug.category}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                              {sug.audience === "both" ? "Both" : sug.audience}
                            </span>
                            {sug.requires_brand_confirmation && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 flex items-center gap-1">
                                <AlertTriangleIcon className="w-3 h-3 text-amber-600" />
                                Brand Confirmation Required
                              </span>
                            )}
                          </div>
                          <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                            {sug.question}
                          </h4>
                          <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
                            {sug.answer}
                          </p>
                          <div className="text-[10px] text-zinc-400 pt-0.5">
                            Sources: {sug.source_refs.join(", ")}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            {aiSuggestions.length > 0 && (
              <div className="p-5 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-850/40 flex items-center justify-between gap-3 flex-wrap">
                <div className="text-xs text-zinc-500">
                  {aiSuggestions.filter((s) => s.selected).length} items selected to add
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsAiModalOpen(false)}
                    className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-750 dark:text-zinc-300 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleSaveSelectedAiDrafts("draft")}
                    disabled={isPending}
                    className="px-4 py-2 text-xs font-semibold rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 shadow-sm transition-colors cursor-pointer"
                  >
                    Save Selected as Drafts
                  </button>
                  <button
                    onClick={() => handleSaveSelectedAiDrafts("approved")}
                    disabled={isPending}
                    className="px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-colors cursor-pointer"
                  >
                    Save & Approve All
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
