"use client";

import React, { useState, useEffect, useTransition } from "react";
import type { ContentProductItem } from "@/lib/product/content-actions";
import type {
  TrainingModuleData,
  GroundedTrainingContext,
  TrainingSourceReadiness,
  TrainingVersionType,
  TrainingSectionKey,
  ClaimVerificationItem,
} from "@/lib/training/training-types";
import { verifyTrainingContentClaims } from "@/lib/training/source-readiness";
import {
  getAdminTrainingModule,
  generateAiTrainingAction,
  regenerateTrainingSectionAction,
  saveTrainingDraftAction,
  submitTrainingForReviewAction,
  publishTrainingModuleAction,
  archiveTrainingModuleAction,
} from "@/lib/training/training-actions";
import { TrainingSourceReadinessCard } from "./training-source-readiness-card";
import { TrainingContentEditor } from "./training-content-editor";
import { TrainingQuizEditor } from "./training-quiz-editor";
import { TrainingMobilePreview } from "./training-mobile-preview";
import { TrainingPublishModal } from "./training-publish-modal";

interface TrainingWorkspaceProps {
  product: ContentProductItem;
}

export function TrainingWorkspace({ product }: TrainingWorkspaceProps) {
  const [module, setModule] = useState<TrainingModuleData | null>(null);
  const [context, setContext] = useState<GroundedTrainingContext | null>(null);
  const [sourceReadiness, setSourceReadiness] = useState<TrainingSourceReadiness | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"content" | "quiz" | "readiness" | "preview" | "audit">("content");
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);
  const [saveStatus, setSaveStatus] = useState<"saved" | "unsaved" | "saving" | "error">("saved");
  const [regeneratingSection, setRegeneratingSection] = useState<TrainingSectionKey | null>(null);
  const [highlightedTarget, setHighlightedTarget] = useState<{
    fieldTarget: string;
    reason?: string;
    severity?: "blocking" | "warning";
  } | null>(null);

  const [isPending, startTransition] = useTransition();

  // In-Memory Revalidation on Content/Quiz changes
  const handleModuleChange = (updated: TrainingModuleData) => {
    if (context) {
      updated.contentVerification = verifyTrainingContentClaims(updated, context);
    }
    setModule(updated);
    setSaveStatus("unsaved");

    // Clear highlightedTarget if the target field was just modified and is now verified
    if (highlightedTarget && context) {
      const stillFlagged = updated.contentVerification?.claims.some(
        (c) => c.fieldTarget === highlightedTarget.fieldTarget && (c.status === "unsupported" || c.status === "needs_review")
      );
      if (!stillFlagged) {
        setHighlightedTarget(null);
      }
    }
  };

  // Deep Navigation from Publish Modal or Source Readiness card
  const handleNavigateToIssue = (issue: ClaimVerificationItem) => {
    setIsPublishModalOpen(false);

    const isQuiz = issue.sectionKey === "quizQuestions" || issue.fieldTarget?.startsWith("field-quiz");
    const targetTab = isQuiz ? "quiz" : "content";
    setActiveTab(targetTab);

    if (issue.fieldTarget) {
      setHighlightedTarget({
        fieldTarget: issue.fieldTarget,
        reason: issue.reason,
        severity: issue.severity,
      });

      setTimeout(() => {
        const el = document.getElementById(issue.fieldTarget!);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.focus();
        }
      }, 150);
    }
  };

  // Explicit claim re-check
  const handleRecheckClaims = () => {
    if (!module || !context) return;
    const rechecked = verifyTrainingContentClaims(module, context);
    setModule({ ...module, contentVerification: rechecked });
    setStatusMessage({
      text: `Claims re-evaluated against catalog: ${rechecked.verifiedCount} verified, ${rechecked.unsupportedCount} blocking issues.`,
      type: rechecked.unsupportedCount === 0 ? "success" : "info",
    });
  };

  // Load initial module state
  useEffect(() => {
    let isMounted = true;
    async function load() {
      setIsLoading(true);
      try {
        const res = await getAdminTrainingModule(product.id);
        if (isMounted) {
          setModule(res.module);
          setContext(res.context);
          setSourceReadiness(res.sourceReadiness);
        }
      } catch (err) {
        console.error("Failed to load training module:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, [product.id]);

  // Warn on page leave if unsaved changes exist
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (saveStatus === "unsaved") {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [saveStatus]);

  // AI Generation Handler
  const handleGenerateAi = () => {
    startTransition(async () => {
      setStatusMessage({ text: "Generating grounded training module with AI...", type: "info" });
      const res = await generateAiTrainingAction(product.id);
      if (res.success && res.module) {
        setModule(res.module);
        setSaveStatus("unsaved");
        setStatusMessage({
          text: `Training draft generated successfully using ${res.provider || "Grounded AI"} (${res.model || "v1"}). Review and edit below.`,
          type: "success",
        });
      } else {
        setStatusMessage({ text: res.error || "Failed to generate training content", type: "error" });
      }
    });
  };

  // Section-by-Section AI Regeneration Handler
  const handleRegenerateSection = async (sectionKey: TrainingSectionKey) => {
    if (!module) return;
    setRegeneratingSection(sectionKey);
    try {
      const res = await regenerateTrainingSectionAction(product.id, sectionKey, module);
      if (res.success && res.updatedModule) {
        setModule(res.updatedModule);
        setSaveStatus("unsaved");
        setStatusMessage({
          text: `Section "${sectionKey}" regenerated successfully with verified facts. Remember to save draft.`,
          type: "success",
        });
      } else {
        setStatusMessage({ text: res.error || "Failed to regenerate section", type: "error" });
      }
    } finally {
      setRegeneratingSection(null);
    }
  };

  // Save Draft Handler
  const handleSaveDraft = () => {
    if (!module) return;
    setSaveStatus("saving");
    startTransition(async () => {
      setStatusMessage({ text: "Saving draft...", type: "info" });
      const res = await saveTrainingDraftAction(product.id, module);
      if (res.success) {
        setSaveStatus("saved");
        setStatusMessage({ text: "Draft saved successfully.", type: "success" });
      } else {
        setSaveStatus("error");
        setStatusMessage({ text: res.error || "Failed to save draft", type: "error" });
      }
    });
  };

  // Submit for Review Handler
  const handleSubmitReview = () => {
    if (!module) return;
    startTransition(async () => {
      const res = await submitTrainingForReviewAction(product.id, module);
      if (res.success) {
        setModule({ ...module, status: "in_review" });
        setStatusMessage({ text: "Module submitted for review.", type: "success" });
      } else {
        setStatusMessage({ text: res.error || "Failed to submit for review", type: "error" });
      }
    });
  };

  // Publish Confirm Handler
  const handleConfirmPublish = async (versionType: TrainingVersionType) => {
    if (!module) return;
    startTransition(async () => {
      const res = await publishTrainingModuleAction(product.id, module, versionType);
      if (res.success) {
        setModule({
          ...module,
          status: "published",
          version: res.newVersion || module.version,
          isPublished: true,
          publishedAt: new Date().toISOString(),
        });
        setIsPublishModalOpen(false);
        setStatusMessage({
          text: `Training module v${res.newVersion || module.version} published successfully to Retailer Learning Center!`,
          type: "success",
        });
      } else {
        setStatusMessage({ text: res.error || "Failed to publish training module", type: "error" });
      }
    });
  };

  // Archive Handler
  const handleArchive = () => {
    if (!confirm("Are you sure you want to archive this training module? It will be removed from active staff training.")) {
      return;
    }
    startTransition(async () => {
      const res = await archiveTrainingModuleAction(product.id);
      if (res.success) {
        if (module) setModule({ ...module, status: "archived", isPublished: false });
        setStatusMessage({ text: "Training module archived.", type: "info" });
      } else {
        setStatusMessage({ text: res.error || "Failed to archive", type: "error" });
      }
    });
  };

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-12 text-center space-y-3">
        <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs text-zinc-500">Loading Product Training Studio...</p>
      </div>
    );
  }

  const currentStatus = module?.status || "draft";
  const currentVersion = module?.version || "1.0.0";

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "published":
        return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800";
      case "in_review":
        return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800";
      case "archived":
        return "bg-zinc-100 text-zinc-600 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-400";
      case "draft":
      default:
        return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800";
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 sm:p-8 shadow-xs space-y-6">
      {/* Studio Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-6 border-b border-zinc-100 dark:border-zinc-800 gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
              🎓
            </span>
            <h2 className="text-lg font-black text-zinc-900 dark:text-zinc-100">
              Product Training Studio (교육 및 평가 관리)
            </h2>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${getStatusBadge(
                currentStatus
              )}`}
            >
              {currentStatus}
            </span>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
              v{currentVersion}
            </span>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Authoritative source-grounded product training and 3-question assessments for Beauty Supply store staff.
          </p>
        </div>

        {/* Global Studio Actions */}
        <div className="flex flex-wrap items-center gap-2 self-start lg:self-center">
          <button
            type="button"
            disabled={isPending}
            onClick={handleGenerateAi}
            className="px-3.5 py-2 rounded-xl text-xs font-black bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-sm flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <span>✨</span>
            <span>{module ? "Regenerate with AI" : "Create Training with AI"}</span>
          </button>

          {module && (
            <>
              <button
                type="button"
                disabled={isPending}
                onClick={handleSaveDraft}
                className="px-3.5 py-2 rounded-xl text-xs font-bold border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors shadow-2xs disabled:opacity-50"
              >
                Save Draft
              </button>

              {currentStatus === "draft" && (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={handleSubmitReview}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 transition-colors disabled:opacity-50"
                >
                  Submit for Review
                </button>
              )}

              <button
                type="button"
                disabled={isPending}
                onClick={() => setIsPublishModalOpen(true)}
                className="px-4 py-2 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-600/20 transition-all active:scale-95 disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
              >
                <span>✓</span>
                <span>Publish to Network</span>
              </button>

              {currentStatus === "published" && (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={handleArchive}
                  className="px-3 py-2 rounded-xl text-xs font-bold text-zinc-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                >
                  Archive
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Status Feedback Toast/Alert */}
      {statusMessage && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between gap-3 ${
            statusMessage.type === "success"
              ? "bg-emerald-50 text-emerald-900 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-800"
              : statusMessage.type === "error"
              ? "bg-rose-50 text-rose-900 border-rose-200 dark:bg-rose-950/40 dark:text-rose-200 dark:border-rose-800"
              : "bg-blue-50 text-blue-900 border-blue-200 dark:bg-blue-950/40 dark:text-blue-200 dark:border-blue-800"
          }`}
        >
          <span>{statusMessage.text}</span>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-xs font-bold opacity-60 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      )}

      {/* Sub-Navigation Tabs */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-800 overflow-x-auto gap-4 text-xs font-bold">
        <button
          type="button"
          onClick={() => setActiveTab("content")}
          className={`pb-3 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === "content"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
              : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
          }`}
        >
          <span>📝 1. Training Content</span>
          {module && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("quiz")}
          className={`pb-3 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === "quiz"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
              : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
          }`}
        >
          <span>🎯 2. Assessment Quiz ({module?.quizQuestions.length || 0})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("readiness")}
          className={`pb-3 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === "readiness"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
              : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
          }`}
        >
          <span>📊 3. Source Readiness</span>
          {sourceReadiness && (
            <span
              className={`px-1.5 py-0.2 rounded text-[9px] font-black uppercase ${
                sourceReadiness.overallScore === "ready"
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              {sourceReadiness.overallScore}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("preview")}
          className={`pb-3 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === "preview"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
              : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
          }`}
        >
          <span>📱 4. Smartphone Preview</span>
        </button>

        {module?.versionHistory && module.versionHistory.length > 0 && (
          <button
            type="button"
            onClick={() => setActiveTab("audit")}
            className={`pb-3 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === "audit"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            }`}
          >
            <span>📜 5. Version History ({module.versionHistory.length})</span>
          </button>
        )}
      </div>

      {/* TAB BODY */}
      {!module ? (
        /* Empty / Generation Call-To-Action State */
        <div className="p-8 sm:p-12 rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-850/30 flex flex-col items-center justify-center text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 flex items-center justify-center text-2xl shadow-xs">
            ✨
          </div>
          <div className="max-w-md space-y-1">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
              No Training Module Generated Yet
            </h3>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Click &ldquo;Create Training with AI&rdquo; to automatically synthesize a factual 60–90 second staff guide and 3-question assessment using verified catalog specifications.
            </p>
          </div>
          <button
            type="button"
            disabled={isPending}
            onClick={handleGenerateAi}
            className="px-5 py-2.5 rounded-xl text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 transition-all active:scale-95 disabled:opacity-50"
          >
            {isPending ? "Generating..." : "✨ Create Training with AI"}
          </button>
        </div>
      ) : (
        <>
          {/* TAB 1: CONTENT EDITOR */}
          {activeTab === "content" && (
            <div className="space-y-6">
              {sourceReadiness && (
                <TrainingSourceReadinessCard
                  readiness={sourceReadiness}
                  verification={module.contentVerification}
                  onRefresh={handleRecheckClaims}
                  onNavigateToIssue={handleNavigateToIssue}
                />
              )}
              <TrainingContentEditor
                module={module}
                onChange={handleModuleChange}
                onRegenerateSection={handleRegenerateSection}
                isRegeneratingSection={regeneratingSection}
                saveStatus={saveStatus}
                disabled={isPending}
                highlightedTarget={highlightedTarget}
              />
            </div>
          )}

          {/* TAB 2: QUIZ EDITOR */}
          {activeTab === "quiz" && (
            <div className="space-y-6">
              <TrainingQuizEditor
                questions={module.quizQuestions}
                onChange={(qs) => {
                  const updated = { ...module, quizQuestions: qs };
                  handleModuleChange(updated);
                }}
                disabled={isPending}
                highlightedTarget={highlightedTarget}
              />
            </div>
          )}

          {/* TAB 3: SOURCE READINESS */}
          {activeTab === "readiness" && sourceReadiness && (
            <div className="space-y-4">
              <TrainingSourceReadinessCard
                readiness={sourceReadiness}
                verification={module.contentVerification}
                onRefresh={handleRecheckClaims}
                onNavigateToIssue={handleNavigateToIssue}
              />
            </div>
          )}

          {/* TAB 4: SMARTPHONE PREVIEW */}
          {activeTab === "preview" && context && (
            <div className="py-4">
              <TrainingMobilePreview module={module} context={context} />
            </div>
          )}

          {/* TAB 5: AUDIT & VERSION HISTORY */}
          {activeTab === "audit" && module.versionHistory && (
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-4 shadow-xs">
              <h3 className="text-xs font-black uppercase text-zinc-900 dark:text-white">
                Immutable Publication Audit Log
              </h3>
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800 text-xs">
                {module.versionHistory.map((item, idx) => (
                  <div key={idx} className="py-3 flex items-center justify-between gap-4">
                    <div>
                      <span className="font-mono font-bold text-zinc-900 dark:text-white">
                        Version {item.version}
                      </span>
                      <span className="ml-2 text-[10px] uppercase font-bold text-indigo-600">
                        ({item.versionType} update)
                      </span>
                      <p className="text-[11px] text-zinc-500 mt-0.5">{item.summary}</p>
                    </div>
                    <span className="text-[10px] text-zinc-400 font-mono shrink-0">
                      {new Date(item.publishedAt).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Publish Modal */}
      {module && (
        <TrainingPublishModal
          module={module}
          isOpen={isPublishModalOpen}
          onClose={() => setIsPublishModalOpen(false)}
          onConfirmPublish={handleConfirmPublish}
          isPending={isPending}
          onNavigateToIssue={handleNavigateToIssue}
        />
      )}
    </div>
  );
}
