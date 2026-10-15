"use client";

import React, { useState, useEffect } from "react";
import type {
  TrainingModuleData,
  CustomerObjectionItem,
  TrainingSectionKey,
} from "@/lib/training/training-types";

interface TrainingContentEditorProps {
  module: TrainingModuleData;
  onChange: (updated: TrainingModuleData) => void;
  onRegenerateSection?: (sectionKey: TrainingSectionKey) => Promise<void>;
  isRegeneratingSection?: TrainingSectionKey | null;
  saveStatus?: "saved" | "unsaved" | "saving" | "error";
  disabled?: boolean;
  highlightedTarget?: {
    fieldTarget: string;
    reason?: string;
    severity?: "blocking" | "warning";
  } | null;
}

export function TrainingContentEditor({
  module,
  onChange,
  onRegenerateSection,
  isRegeneratingSection = null,
  saveStatus = "saved",
  disabled = false,
  highlightedTarget = null,
}: TrainingContentEditorProps) {
  // Collapsible group states (all open by default for comprehensive editing)
  const [openGroups, setOpenGroups] = useState({
    basics: true,
    selling: true,
    safety: true,
  });

  // Auto-expand group containing the highlighted issue target
  useEffect(() => {
    if (!highlightedTarget?.fieldTarget) return;
    const target = highlightedTarget.fieldTarget;
    if (
      target === "field-productOverview" ||
      target.startsWith("field-top3Benefits") ||
      target === "field-bestFor"
    ) {
      setOpenGroups((prev) => ({ ...prev, basics: true }));
    } else if (
      target === "field-howToUse" ||
      target === "field-pitch15s" ||
      target.startsWith("field-sellingPoints") ||
      target.startsWith("field-customerObjections")
    ) {
      setOpenGroups((prev) => ({ ...prev, selling: true }));
    } else if (target === "field-storageHandlingSop") {
      setOpenGroups((prev) => ({ ...prev, safety: true }));
    }
  }, [highlightedTarget]);

  const isTarget = (id: string) => highlightedTarget?.fieldTarget === id;
  const getHighlightClass = (id: string) =>
    isTarget(id)
      ? "ring-2 ring-rose-500 border-rose-500 dark:border-rose-500 shadow-md animate-pulse"
      : "";

  const renderNotice = (id: string) => {
    if (!isTarget(id) || !highlightedTarget?.reason) return null;
    return (
      <div className="flex items-center gap-1.5 p-2 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-medium animate-in fade-in mt-1">
        <span className="font-bold">⚠️ Claim Issue:</span>
        <span>{highlightedTarget.reason}</span>
      </div>
    );
  };

  const toggleGroup = (group: "basics" | "selling" | "safety") => {
    setOpenGroups((prev) => ({ ...prev, [group]: !prev[group] }));
  };

  // Word count & brevity tracker
  const allText = [
    module.productOverview,
    ...module.top3Benefits,
    module.bestFor,
    module.howToUse,
    ...module.sellingPoints,
    module.pitch15s,
    ...module.customerObjections.map((o) => `${o.objection} ${o.answer}`),
    module.storageHandlingSop,
  ].join(" ");

  const wordCount = allText.trim().split(/\s+/).filter(Boolean).length;
  const estimatedSeconds = Math.round((wordCount / 160) * 60);

  // Field change handlers
  const handleOverviewChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange({ ...module, productOverview: e.target.value });
  };

  const handleBenefitChange = (index: number, val: string) => {
    const updated = [...module.top3Benefits] as [string, string, string];
    updated[index] = val;
    onChange({ ...module, top3Benefits: updated });
  };

  const handleBestForChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange({ ...module, bestFor: e.target.value });
  };

  const handleHowToUseChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange({ ...module, howToUse: e.target.value });
  };

  const handleSellingPointChange = (index: number, val: string) => {
    const updated = [...module.sellingPoints];
    updated[index] = val;
    onChange({ ...module, sellingPoints: updated });
  };

  const handleAddSellingPoint = () => {
    if (module.sellingPoints.length < 5) {
      onChange({ ...module, sellingPoints: [...module.sellingPoints, ""] });
    }
  };

  const handleRemoveSellingPoint = (index: number) => {
    if (module.sellingPoints.length > 1) {
      const updated = module.sellingPoints.filter((_, idx) => idx !== index);
      onChange({ ...module, sellingPoints: updated });
    }
  };

  const handlePitchChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange({ ...module, pitch15s: e.target.value });
  };

  const handleObjectionChange = (index: number, field: "objection" | "answer", val: string) => {
    const updated = [...module.customerObjections];
    updated[index] = { ...updated[index], [field]: val };
    onChange({ ...module, customerObjections: updated });
  };

  const handleAddObjection = () => {
    const newObj: CustomerObjectionItem = {
      id: `obj_${Date.now()}`,
      objection: "",
      answer: "",
    };
    onChange({ ...module, customerObjections: [...module.customerObjections, newObj] });
  };

  const handleRemoveObjection = (index: number) => {
    const updated = module.customerObjections.filter((_, idx) => idx !== index);
    onChange({ ...module, customerObjections: updated });
  };

  const handleStorageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange({ ...module, storageHandlingSop: e.target.value });
  };

  // Safe Section Regeneration with explicit prompt
  const requestSectionRegenerate = async (sectionKey: TrainingSectionKey, sectionLabel: string) => {
    if (!onRegenerateSection) return;
    const confirmed = window.confirm(
      `Regenerate "${sectionLabel}" with AI?\n\nThis will replace the current text of this section only, preserving your manual edits on all other sections.`
    );
    if (confirmed) {
      await onRegenerateSection(sectionKey);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Brevity Tracker + Save Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50">
        <div className="flex items-center gap-2.5">
          <span className="text-xl">⏱️</span>
          <div>
            <div className="text-xs font-black text-indigo-950 dark:text-indigo-200 flex items-center gap-2">
              <span>Mobile Learning Brevity Tracker</span>
              <span className="text-[10px] font-mono text-zinc-500">
                ({wordCount} words · ~{estimatedSeconds}s read)
              </span>
            </div>
            <p className="text-[11px] text-indigo-700/80 dark:text-indigo-300/80">
              Target: 60–90 seconds essential reading for Beauty Supply store staff.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Save Status Pill */}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold border bg-white dark:bg-zinc-800 shadow-2xs">
            {saveStatus === "saving" && (
              <>
                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
                <span className="text-indigo-600 dark:text-indigo-400">Saving Draft...</span>
              </>
            )}
            {saveStatus === "saved" && (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-emerald-700 dark:text-emerald-400">Saved</span>
              </>
            )}
            {saveStatus === "unsaved" && (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="text-amber-700 dark:text-amber-400">Unsaved Changes</span>
              </>
            )}
            {saveStatus === "error" && (
              <>
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                <span className="text-rose-700 dark:text-rose-400">Save Failed</span>
              </>
            )}
          </div>

          <span
            className={`px-3 py-1 rounded-xl text-xs font-black uppercase ${
              estimatedSeconds <= 90
                ? "bg-emerald-500 text-white shadow-xs"
                : "bg-amber-500 text-white"
            }`}
          >
            {estimatedSeconds <= 90 ? "Optimal Length" : "Longer Read"}
          </span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* GROUP 1: PRODUCT BASICS (Overview, Top 3 Benefits, Best For)              */}
      {/* ========================================================================= */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
        <button
          type="button"
          onClick={() => toggleGroup("basics")}
          className="w-full flex items-center justify-between p-4 sm:p-5 bg-zinc-50/70 dark:bg-zinc-850/50 border-b border-zinc-200 dark:border-zinc-800 text-left hover:bg-zinc-100/60 dark:hover:bg-zinc-800/60 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-sm">
              🏷️
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-wide">
                  Group 1: Product Basics (기본 정보)
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300">
                  Sections 1–3
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                Product Overview, Top 3 Verified Benefits, and Target Customer Suitability.
              </p>
            </div>
          </div>
          <span className="text-xs font-bold text-zinc-400 px-2 py-1">
            {openGroups.basics ? "Collapse ▲" : "Expand ▼"}
          </span>
        </button>

        {openGroups.basics && (
          <div className="p-5 sm:p-6 space-y-6">
            {/* 1. PRODUCT OVERVIEW */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-zinc-900 text-white text-xs font-bold flex items-center justify-center">
                    1
                  </span>
                  <label className="text-xs font-black uppercase tracking-wider text-zinc-900 dark:text-white">
                    Product Overview (제품 핵심 요약)
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-zinc-400">1–2 concise sentences</span>
                  {onRegenerateSection && (
                    <button
                      type="button"
                      disabled={disabled || isRegeneratingSection === "productOverview"}
                      onClick={() => requestSectionRegenerate("productOverview", "Product Overview")}
                      className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 disabled:opacity-50"
                    >
                      {isRegeneratingSection === "productOverview" ? "Regenerating..." : "✨ Regenerate"}
                    </button>
                  )}
                </div>
              </div>
              <textarea
                id="field-productOverview"
                rows={3}
                disabled={disabled}
                value={module.productOverview}
                onChange={handleOverviewChange}
                placeholder="Concise, factual product overview..."
                className={`w-full text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50/70 dark:bg-zinc-800 p-3.5 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed transition-all ${getHighlightClass(
                  "field-productOverview"
                )}`}
              />
              {renderNotice("field-productOverview")}
            </div>

            {/* 2. TOP 3 BENEFITS */}
            <div className="space-y-2.5 pt-4 border-t border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-zinc-900 text-white text-xs font-bold flex items-center justify-center">
                    2
                  </span>
                  <label className="text-xs font-black uppercase tracking-wider text-zinc-900 dark:text-white">
                    Top 3 Benefits (3대 핵심 효능)
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-zinc-400">Customer-facing advantages</span>
                  {onRegenerateSection && (
                    <button
                      type="button"
                      disabled={disabled || isRegeneratingSection === "top3Benefits"}
                      onClick={() => requestSectionRegenerate("top3Benefits", "Top 3 Benefits")}
                      className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 disabled:opacity-50"
                    >
                      {isRegeneratingSection === "top3Benefits" ? "Regenerating..." : "✨ Regenerate"}
                    </button>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                {module.top3Benefits.map((benefit, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-md bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-bold text-xs flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <input
                        id={`field-top3Benefits-${idx}`}
                        type="text"
                        disabled={disabled}
                        value={benefit}
                        onChange={(e) => handleBenefitChange(idx, e.target.value)}
                        placeholder={`Benefit #${idx + 1}...`}
                        className={`flex-1 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50/70 dark:bg-zinc-800 px-3 py-2.5 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all ${getHighlightClass(
                          `field-top3Benefits-${idx}`
                        )}`}
                      />
                    </div>
                    {renderNotice(`field-top3Benefits-${idx}`)}
                  </div>
                ))}
              </div>
            </div>

            {/* 3. BEST FOR / TARGET CUSTOMER */}
            <div className="space-y-2 pt-4 border-t border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-zinc-900 text-white text-xs font-bold flex items-center justify-center">
                    3
                  </span>
                  <label className="text-xs font-black uppercase tracking-wider text-zinc-900 dark:text-white">
                    Best For / Target Customer (추천 대상 및 피부/헤어 타입)
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-zinc-400">Who should buy this</span>
                  {onRegenerateSection && (
                    <button
                      type="button"
                      disabled={disabled || isRegeneratingSection === "bestFor"}
                      onClick={() => requestSectionRegenerate("bestFor", "Target Customer (Best For)")}
                      className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 disabled:opacity-50"
                    >
                      {isRegeneratingSection === "bestFor" ? "Regenerating..." : "✨ Regenerate"}
                    </button>
                  )}
                </div>
              </div>
              <textarea
                id="field-bestFor"
                rows={2}
                disabled={disabled}
                value={module.bestFor}
                onChange={handleBestForChange}
                placeholder="Appropriate customer profiles, skin concerns, or usage occasions..."
                className={`w-full text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50/70 dark:bg-zinc-800 p-3.5 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed transition-all ${getHighlightClass(
                  "field-bestFor"
                )}`}
              />
              {renderNotice("field-bestFor")}
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* GROUP 2: SELLING GUIDE (How to Use, Selling Points, Pitch, Objections)    */}
      {/* ========================================================================= */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
        <button
          type="button"
          onClick={() => toggleGroup("selling")}
          className="w-full flex items-center justify-between p-4 sm:p-5 bg-zinc-50/70 dark:bg-zinc-850/50 border-b border-zinc-200 dark:border-zinc-800 text-left hover:bg-zinc-100/60 dark:hover:bg-zinc-800/60 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold text-sm">
              💬
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-wide">
                  Group 2: Selling Guide (매장 응대 가이드)
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300">
                  Sections 4–6
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                How to Use Instructions, 15-Second Pitch, Talk-Tracks & Practical Customer Q&A.
              </p>
            </div>
          </div>
          <span className="text-xs font-bold text-zinc-400 px-2 py-1">
            {openGroups.selling ? "Collapse ▲" : "Expand ▼"}
          </span>
        </button>

        {openGroups.selling && (
          <div className="p-5 sm:p-6 space-y-6">
            {/* 4. HOW TO USE */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-zinc-900 text-white text-xs font-bold flex items-center justify-center">
                    4
                  </span>
                  <label className="text-xs font-black uppercase tracking-wider text-zinc-900 dark:text-white">
                    How to Use (사용법 및 루틴 순서)
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-zinc-400">Step-by-step instructions</span>
                  {onRegenerateSection && (
                    <button
                      type="button"
                      disabled={disabled || isRegeneratingSection === "howToUse"}
                      onClick={() => requestSectionRegenerate("howToUse", "How to Use")}
                      className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 disabled:opacity-50"
                    >
                      {isRegeneratingSection === "howToUse" ? "Regenerating..." : "✨ Regenerate"}
                    </button>
                  )}
                </div>
              </div>
              <textarea
                id="field-howToUse"
                rows={3}
                disabled={disabled}
                value={module.howToUse}
                onChange={handleHowToUseChange}
                placeholder="Step 1, Step 2, routine placement, daytime sunscreen note..."
                className={`w-full text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50/70 dark:bg-zinc-800 p-3.5 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed font-mono transition-all ${getHighlightClass(
                  "field-howToUse"
                )}`}
              />
              {renderNotice("field-howToUse")}
            </div>

            {/* 5. SELLING POINTS & 15S PITCH */}
            <div className="space-y-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-zinc-900 text-white text-xs font-bold flex items-center justify-center">
                    5
                  </span>
                  <label className="text-xs font-black uppercase tracking-wider text-zinc-900 dark:text-white">
                    Selling Points & 15-Second Counter Pitch (카운터 세일즈 토크)
                  </label>
                </div>
                {onRegenerateSection && (
                  <button
                    type="button"
                    disabled={disabled || isRegeneratingSection === "pitch15s"}
                    onClick={() => requestSectionRegenerate("pitch15s", "15-Second Pitch")}
                    className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 disabled:opacity-50"
                  >
                    {isRegeneratingSection === "pitch15s" ? "Regenerating..." : "✨ Regenerate Pitch"}
                  </button>
                )}
              </div>

              {/* 15s Pitch Callout Box */}
              <div className="p-3.5 rounded-xl bg-purple-50/40 dark:bg-purple-950/20 border border-purple-200/60 dark:border-purple-900/40 space-y-1.5">
                <label className="text-[11px] font-bold text-purple-900 dark:text-purple-300 flex items-center gap-1.5">
                  <span>⚡</span>
                  <span>15-Second Spoken Pitch (점원이 고객에게 바로 말할 수 있는 한 문장)</span>
                </label>
                <textarea
                  id="field-pitch15s"
                  rows={2}
                  disabled={disabled}
                  value={module.pitch15s}
                  onChange={handlePitchChange}
                  placeholder="This is [Product] from [Brand] — customers love it because..."
                  className={`w-full text-xs rounded-xl border border-purple-200 dark:border-purple-800 bg-white dark:bg-zinc-800 p-2.5 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500 leading-relaxed font-medium transition-all ${getHighlightClass(
                    "field-pitch15s"
                  )}`}
                />
                {renderNotice("field-pitch15s")}
              </div>

              {/* Bullet Points Talk Tracks */}
              <div className="space-y-2 pt-1">
                <label className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 block">
                  Key Counter Talk-Tracks (3개 핵심 권유 포인트):
                </label>
                {module.sellingPoints.map((sp, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-400 text-xs font-bold">•</span>
                      <input
                        id={`field-sellingPoints-${idx}`}
                        type="text"
                        disabled={disabled}
                        value={sp}
                        onChange={(e) => handleSellingPointChange(idx, e.target.value)}
                        placeholder={`Selling Point #${idx + 1}...`}
                        className={`flex-1 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50/70 dark:bg-zinc-800 px-3 py-2 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all ${getHighlightClass(
                          `field-sellingPoints-${idx}`
                        )}`}
                      />
                      {module.sellingPoints.length > 1 && (
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => handleRemoveSellingPoint(idx)}
                          className="text-zinc-400 hover:text-rose-500 text-xs px-2 py-1"
                          title="Remove point"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    {renderNotice(`field-sellingPoints-${idx}`)}
                  </div>
                ))}
                {module.sellingPoints.length < 5 && (
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={handleAddSellingPoint}
                    className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline pt-1 block"
                  >
                    + Add Selling Point
                  </button>
                )}
              </div>
            </div>

            {/* 6. CUSTOMER OBJECTIONS & ANSWERS */}
            <div className="space-y-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-zinc-900 text-white text-xs font-bold flex items-center justify-center">
                    6
                  </span>
                  <label className="text-xs font-black uppercase tracking-wider text-zinc-900 dark:text-white">
                    Customer Objections & Answers (고객 자주 묻는 질문 및 반론 응대)
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  {onRegenerateSection && (
                    <button
                      type="button"
                      disabled={disabled || isRegeneratingSection === "customerObjections"}
                      onClick={() => requestSectionRegenerate("customerObjections", "Customer Objections")}
                      className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 disabled:opacity-50"
                    >
                      {isRegeneratingSection === "customerObjections" ? "Regenerating..." : "✨ Regenerate Q&A"}
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={handleAddObjection}
                    className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    + Add Q&A
                  </button>
                </div>
              </div>

              {module.customerObjections.length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 text-center text-xs text-zinc-400">
                  No objections added yet. Click &ldquo;+ Add Q&A&rdquo; or &ldquo;✨ Regenerate Q&A&rdquo; to suggest customer questions.
                </div>
              ) : (
                <div className="space-y-3">
                  {module.customerObjections.map((obj, idx) => (
                    <div
                      key={obj.id || idx}
                      className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 space-y-2.5 bg-zinc-50/50 dark:bg-zinc-850/40"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                          Q&A #{idx + 1}
                        </span>
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => handleRemoveObjection(idx)}
                          className="text-xs text-rose-500 hover:text-rose-700 font-bold"
                        >
                          Remove
                        </button>
                      </div>
                      <div>
                        <label className="text-[10px] uppercase font-bold text-zinc-400 block mb-1">
                          Customer Question / Concern:
                        </label>
                        <input
                          id={`field-customerObjections-${idx}-objection`}
                          type="text"
                          disabled={disabled}
                          value={obj.objection}
                          onChange={(e) => handleObjectionChange(idx, "objection", e.target.value)}
                          placeholder="e.g. Will this clog my pores or make my skin look oily?"
                          className={`w-full text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all ${getHighlightClass(
                            `field-customerObjections-${idx}-objection`
                          )}`}
                        />
                        {renderNotice(`field-customerObjections-${idx}-objection`)}
                      </div>
                      <div>
                        <label className="text-[10px] uppercase font-bold text-zinc-400 block mb-1">
                          Staff Factual Answer:
                        </label>
                        <textarea
                          id={`field-customerObjections-${idx}-answer`}
                          rows={2}
                          disabled={disabled}
                          value={obj.answer}
                          onChange={(e) => handleObjectionChange(idx, "answer", e.target.value)}
                          placeholder="Factual answer grounded in product specifications..."
                          className={`w-full text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed transition-all ${getHighlightClass(
                            `field-customerObjections-${idx}-answer`
                          )}`}
                        />
                        {renderNotice(`field-customerObjections-${idx}-answer`)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* GROUP 3: HANDLING & SAFETY (Storage SOP, Precautions)                     */}
      {/* ========================================================================= */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
        <button
          type="button"
          onClick={() => toggleGroup("safety")}
          className="w-full flex items-center justify-between p-4 sm:p-5 bg-zinc-50/70 dark:bg-zinc-850/50 border-b border-zinc-200 dark:border-zinc-800 text-left hover:bg-zinc-100/60 dark:hover:bg-zinc-800/60 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-sm">
              🛡️
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-wide">
                  Group 3: Handling & Safety (보관 및 주의사항)
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                  Section 7
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                Storage Conditions, Temperature Requirements, Container Care & Employee Handling SOP.
              </p>
            </div>
          </div>
          <span className="text-xs font-bold text-zinc-400 px-2 py-1">
            {openGroups.safety ? "Collapse ▲" : "Expand ▼"}
          </span>
        </button>

        {openGroups.safety && (
          <div className="p-5 sm:p-6 space-y-4">
            {/* 7. STORAGE & HANDLING SOP */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-zinc-900 text-white text-xs font-bold flex items-center justify-center">
                    7
                  </span>
                  <label className="text-xs font-black uppercase tracking-wider text-zinc-900 dark:text-white">
                    Storage & Handling SOP (보관 및 취급 표준)
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-zinc-400">Temperature & shelf life</span>
                  {onRegenerateSection && (
                    <button
                      type="button"
                      disabled={disabled || isRegeneratingSection === "storageHandlingSop"}
                      onClick={() => requestSectionRegenerate("storageHandlingSop", "Storage SOP")}
                      className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 disabled:opacity-50"
                    >
                      {isRegeneratingSection === "storageHandlingSop" ? "Regenerating..." : "✨ Regenerate"}
                    </button>
                  )}
                </div>
              </div>
              <textarea
                id="field-storageHandlingSop"
                rows={3}
                disabled={disabled}
                value={module.storageHandlingSop}
                onChange={handleStorageChange}
                placeholder="Store at room temperature (15°C–25°C) away from direct sunlight..."
                className={`w-full text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50/70 dark:bg-zinc-800 p-3.5 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed font-mono transition-all ${getHighlightClass(
                  "field-storageHandlingSop"
                )}`}
              />
              {renderNotice("field-storageHandlingSop")}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
