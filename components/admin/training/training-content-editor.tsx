"use client";

import React from "react";
import type { TrainingModuleData, CustomerObjectionItem } from "@/lib/training/training-types";

interface TrainingContentEditorProps {
  module: TrainingModuleData;
  onChange: (updated: TrainingModuleData) => void;
  disabled?: boolean;
}

export function TrainingContentEditor({ module, onChange, disabled = false }: TrainingContentEditorProps) {
  // Calculate total word count and estimated reading time
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

  return (
    <div className="space-y-6">
      {/* Read Time & Brevity Indicator */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50">
        <div className="flex items-center gap-2.5">
          <span className="text-xl">⏱️</span>
          <div>
            <div className="text-xs font-black text-indigo-950 dark:text-indigo-200">
              Mobile Learning Brevity Tracker
            </div>
            <p className="text-[11px] text-indigo-700/80 dark:text-indigo-300/80">
              Target: 60–90 seconds essential reading for busy store employees.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold text-zinc-600 dark:text-zinc-400">
            {wordCount} words
          </span>
          <span
            className={`px-3 py-1 rounded-lg text-xs font-black uppercase ${
              estimatedSeconds <= 90
                ? "bg-emerald-500 text-white shadow-xs"
                : "bg-amber-500 text-white"
            }`}
          >
            ~{estimatedSeconds}s Read Time ({estimatedSeconds <= 90 ? "Optimal" : "Longer"})
          </span>
        </div>
      </div>

      {/* 1. PRODUCT OVERVIEW */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-3 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-zinc-900 text-white text-xs font-bold flex items-center justify-center">
              1
            </span>
            <label className="text-xs font-black uppercase tracking-wider text-zinc-900 dark:text-white">
              Product Overview (제품 핵심 요약)
            </label>
          </div>
          <span className="text-[11px] text-zinc-400">1–2 concise sentences</span>
        </div>
        <textarea
          rows={3}
          disabled={disabled}
          value={module.productOverview}
          onChange={handleOverviewChange}
          placeholder="Concise, factual product overview..."
          className="w-full text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 p-3 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* 2. TOP 3 BENEFITS */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-3 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-zinc-900 text-white text-xs font-bold flex items-center justify-center">
              2
            </span>
            <label className="text-xs font-black uppercase tracking-wider text-zinc-900 dark:text-white">
              Top 3 Benefits (3대 핵심 효능)
            </label>
          </div>
          <span className="text-[11px] text-zinc-400">Customer-relevant advantages</span>
        </div>
        <div className="space-y-2.5">
          {module.top3Benefits.map((benefit, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-md bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-bold text-xs flex items-center justify-center shrink-0">
                {idx + 1}
              </span>
              <input
                type="text"
                disabled={disabled}
                value={benefit}
                onChange={(e) => handleBenefitChange(idx, e.target.value)}
                placeholder={`Benefit #${idx + 1}...`}
                className="flex-1 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          ))}
        </div>
      </div>

      {/* 3. BEST FOR / TARGET CUSTOMER */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-3 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-zinc-900 text-white text-xs font-bold flex items-center justify-center">
              3
            </span>
            <label className="text-xs font-black uppercase tracking-wider text-zinc-900 dark:text-white">
              Best For / Target Customer (추천 대상 및 피부/헤어 타입)
            </label>
          </div>
          <span className="text-[11px] text-zinc-400">Who should buy this</span>
        </div>
        <textarea
          rows={2}
          disabled={disabled}
          value={module.bestFor}
          onChange={handleBestForChange}
          placeholder="Appropriate customer profiles, skin concerns, or usage occasions..."
          className="w-full text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 p-3 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* 4. HOW TO USE */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-3 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-zinc-900 text-white text-xs font-bold flex items-center justify-center">
              4
            </span>
            <label className="text-xs font-black uppercase tracking-wider text-zinc-900 dark:text-white">
              How to Use (사용법 및 순서)
            </label>
          </div>
          <span className="text-[11px] text-zinc-400">Step-by-step application</span>
        </div>
        <textarea
          rows={3}
          disabled={disabled}
          value={module.howToUse}
          onChange={handleHowToUseChange}
          placeholder="Step 1, Step 2, routine placement, daytime sunscreen note..."
          className="w-full text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 p-3 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* 5. SELLING POINTS & 15-SECOND PITCH */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-4 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-zinc-900 text-white text-xs font-bold flex items-center justify-center">
              5
            </span>
            <label className="text-xs font-black uppercase tracking-wider text-zinc-900 dark:text-white">
              Selling Points & 15-Second Counter Pitch (세일즈 훅 & 상담 스피치)
            </label>
          </div>
          <button
            type="button"
            disabled={disabled || module.sellingPoints.length >= 5}
            onClick={handleAddSellingPoint}
            className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50"
          >
            + Add Point
          </button>
        </div>

        {/* 15-Second Pitch Highlight Box */}
        <div className="rounded-xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/60 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
              <span>🗣️</span> 15-Second Counter Pitch (매장 즉석 추천 멘트)
            </span>
            <span className="text-[10px] text-amber-700 dark:text-amber-300 font-mono">
              Staff Spoken Script
            </span>
          </div>
          <textarea
            rows={2}
            disabled={disabled}
            value={module.pitch15s}
            onChange={handlePitchChange}
            placeholder="Conversational recommendation script staff can say out loud..."
            className="w-full text-xs rounded-lg border border-amber-200 dark:border-amber-800 bg-white dark:bg-zinc-900 p-2.5 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
          />
        </div>

        {/* Bullet selling points */}
        <div className="space-y-2">
          <span className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400 block">
            Counter Talk-Tracks & Quick Facts:
          </span>
          {module.sellingPoints.map((sp, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <span className="text-indigo-500 font-bold">•</span>
              <input
                type="text"
                disabled={disabled}
                value={sp}
                onChange={(e) => handleSellingPointChange(idx, e.target.value)}
                placeholder="Talk-track point..."
                className="flex-1 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {module.sellingPoints.length > 1 && (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => handleRemoveSellingPoint(idx)}
                  className="text-xs text-zinc-400 hover:text-rose-500 px-1.5"
                  title="Remove point"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 6. CUSTOMER OBJECTIONS & ANSWERS */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-4 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-zinc-900 text-white text-xs font-bold flex items-center justify-center">
              6
            </span>
            <label className="text-xs font-black uppercase tracking-wider text-zinc-900 dark:text-white">
              Customer Objections & Answers (고객 질문 및 의문 응대)
            </label>
          </div>
          <button
            type="button"
            disabled={disabled || module.customerObjections.length >= 4}
            onClick={handleAddObjection}
            className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50"
          >
            + Add Objection Q&A
          </button>
        </div>

        <div className="space-y-3">
          {module.customerObjections.map((item, idx) => (
            <div
              key={item.id || idx}
              className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/40 space-y-2 relative"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300">
                  Customer Question #{idx + 1}
                </span>
                {module.customerObjections.length > 1 && (
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => handleRemoveObjection(idx)}
                    className="text-xs text-zinc-400 hover:text-rose-500"
                    title="Remove objection"
                  >
                    ✕
                  </button>
                )}
              </div>
              <input
                type="text"
                disabled={disabled}
                value={item.objection}
                onChange={(e) => handleObjectionChange(idx, "objection", e.target.value)}
                placeholder="e.g. Will this feel greasy under my makeup?"
                className="w-full text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-zinc-900 dark:text-zinc-100 font-medium"
              />
              <textarea
                rows={2}
                disabled={disabled}
                value={item.answer}
                onChange={(e) => handleObjectionChange(idx, "answer", e.target.value)}
                placeholder="Factual staff response..."
                className="w-full text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-2.5 text-zinc-900 dark:text-zinc-100"
              />
            </div>
          ))}
        </div>
      </div>

      {/* 7. STORAGE & HANDLING SOP */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-3 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-zinc-900 text-white text-xs font-bold flex items-center justify-center">
              7
            </span>
            <label className="text-xs font-black uppercase tracking-wider text-zinc-900 dark:text-white">
              Storage & Handling SOP (보관 조건, 유통기한 및 취급 지침)
            </label>
          </div>
          <span className="text-[11px] text-zinc-400">Safety & shelf storage</span>
        </div>
        <textarea
          rows={2}
          disabled={disabled}
          value={module.storageHandlingSop}
          onChange={handleStorageChange}
          placeholder="Storage temperature, container handling, shelf life notes, general precautions..."
          className="w-full text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 p-3 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>
    </div>
  );
}
