"use client";

import React, { useState } from "react";
import type { TrainingModuleData, TrainingVersionType } from "@/lib/training/training-types";

interface TrainingPublishModalProps {
  module: TrainingModuleData;
  isOpen: boolean;
  onClose: () => void;
  onConfirmPublish: (versionType: TrainingVersionType) => Promise<void>;
  isPending: boolean;
}

export function TrainingPublishModal({
  module,
  isOpen,
  onClose,
  onConfirmPublish,
  isPending,
}: TrainingPublishModalProps) {
  const [versionType, setVersionType] = useState<TrainingVersionType>("minor");

  if (!isOpen) return null;

  // Validation checks
  const unsupportedCount = module.contentVerification?.unsupportedCount || 0;
  const checks = [
    { label: "1. Product Overview", passed: Boolean(module.productOverview?.trim()) },
    { label: "2. Top 3 Benefits", passed: module.top3Benefits.length === 3 && module.top3Benefits.every((b) => Boolean(b?.trim())) },
    { label: "3. Best For (Target Customer)", passed: Boolean(module.bestFor?.trim()) },
    { label: "4. How to Use Instructions", passed: Boolean(module.howToUse?.trim()) },
    { label: "5. Selling Points & 15s Pitch", passed: Boolean(module.pitch15s?.trim()) && module.sellingPoints.length > 0 },
    { label: "6. Customer Objections & Answers", passed: module.customerObjections.length > 0 && module.customerObjections.every(o => o.objection.trim() && o.answer.trim()) },
    { label: "7. Storage & Handling SOP", passed: Boolean(module.storageHandlingSop?.trim()) },
    {
      label: `Assessment: ${module.quizQuestions.length} Questions (3–5 required, 3 options each with explanation)`,
      passed:
        module.quizQuestions.length >= 3 &&
        module.quizQuestions.length <= 5 &&
        module.quizQuestions.every(
          (q) =>
            q.question?.trim() &&
            q.options.length === 3 &&
            q.options.every((opt) => opt?.trim()) &&
            typeof q.correctIndex === "number" &&
            q.correctIndex >= 0 &&
            q.correctIndex <= 2 &&
            Boolean(q.explanation?.trim())
        ),
    },
    {
      label: "Factual Claim Verification",
      passed: unsupportedCount === 0,
      note: unsupportedCount > 0 ? `${unsupportedCount} ungrounded claim(s) must be reviewed or removed before publishing` : undefined,
    },
  ];

  const allPassed = checks.every((c) => c.passed);

  // Compute next version
  const currentVer = module.version || "1.0.0";
  const parts = currentVer.split(".").map((n) => parseInt(n, 10) || 0);
  let nextVer = "";
  if (versionType === "major") {
    nextVer = `${(parts[0] || 1) + 1}.0.0`;
  } else {
    nextVer = `${parts[0] || 1}.${(parts[1] || 0) + 1}.0`;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 max-w-lg w-full p-6 sm:p-7 space-y-6 shadow-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-base">
              🚀
            </span>
            <div>
              <h3 className="text-base font-black text-zinc-900 dark:text-white">
                Approve & Publish Training Module
              </h3>
              <p className="text-[11px] text-zinc-500">
                Official publication to K SELECT Retailer Learning Center
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={isPending}
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 text-sm p-1 font-bold"
          >
            ✕
          </button>
        </div>

        {/* Validation Checklist */}
        <div className="space-y-2">
          <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block uppercase">
            Required Content Verification Checklist:
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs bg-zinc-50 dark:bg-zinc-850 p-3 rounded-2xl border border-zinc-200 dark:border-zinc-800">
            {checks.map((c, i) => (
              <div key={i} className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className={c.passed ? "text-emerald-600 font-bold" : "text-rose-600 font-bold"}>
                    {c.passed ? "✓" : "✕"}
                  </span>
                  <span className={`text-[11px] ${c.passed ? "text-zinc-700 dark:text-zinc-300" : "text-rose-600 font-bold"}`}>
                    {c.label}
                  </span>
                </div>
                {c.note && !c.passed && (
                  <span className="text-[10px] text-rose-500 font-medium pl-4 leading-tight">{c.note}</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Version Selection */}
        <div className="space-y-2.5">
          <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block uppercase">
            Publication Versioning:
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label
              className={`p-3 rounded-2xl border cursor-pointer transition-all ${
                versionType === "minor"
                  ? "border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-950 dark:text-emerald-200 ring-2 ring-emerald-500/20"
                  : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <input
                  type="radio"
                  name="versionType"
                  value="minor"
                  checked={versionType === "minor"}
                  onChange={() => setVersionType("minor")}
                  className="accent-emerald-600"
                />
                <span className="text-xs font-black">Minor Update</span>
              </div>
              <p className="text-[10px] text-zinc-500 leading-tight">
                Spelling, minor wording, or formatting. Existing completions stay valid.
              </p>
            </label>

            <label
              className={`p-3 rounded-2xl border cursor-pointer transition-all ${
                versionType === "major"
                  ? "border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-950 dark:text-indigo-200 ring-2 ring-indigo-500/20"
                  : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <input
                  type="radio"
                  name="versionType"
                  value="major"
                  checked={versionType === "major"}
                  onChange={() => setVersionType("major")}
                  className="accent-indigo-600"
                />
                <span className="text-xs font-black">Major Update</span>
              </div>
              <p className="text-[10px] text-zinc-500 leading-tight">
                Important formula, benefits or safety updates. May recommend staff retraining.
              </p>
            </label>
          </div>

          <div className="p-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-[11px] text-zinc-600 dark:text-zinc-400 flex items-center justify-between font-mono">
            <span>Current: v{currentVer}</span>
            <span className="text-zinc-400">→</span>
            <span className="font-bold text-zinc-900 dark:text-white">Publishing Version: v{nextVer}</span>
          </div>
        </div>

        {/* Boundary Notice */}
        <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 text-[11px] text-blue-900 dark:text-blue-200 leading-relaxed">
          <span className="font-bold">Publishing Boundary: </span>
          Publishing makes this training module active in the Retailer Learning Center. It does NOT modify public customer pages or change product trading catalog visibility.
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            disabled={isPending}
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!allPassed || isPending}
            onClick={() => onConfirmPublish(versionType)}
            className="px-5 py-2.5 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white shadow-md shadow-emerald-600/20 transition-all active:scale-95 flex items-center gap-1.5"
          >
            <span>{isPending ? "Publishing..." : "✓ Approve & Publish to Network"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
