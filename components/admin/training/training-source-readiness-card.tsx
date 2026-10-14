"use client";

import React, { useState } from "react";
import type { TrainingSourceReadiness, SourceReadinessScore } from "@/lib/training/training-types";

interface SourceReadinessCardProps {
  readiness: TrainingSourceReadiness;
  onRefresh?: () => void;
}

export function TrainingSourceReadinessCard({ readiness, onRefresh }: SourceReadinessCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const getScoreBadge = (score: SourceReadinessScore) => {
    switch (score) {
      case "ready":
        return {
          label: "READY",
          bg: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
          icon: "✓",
        };
      case "needs_review":
        return {
          label: "NEEDS REVIEW",
          bg: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
          icon: "⚠️",
        };
      case "insufficient":
      default:
        return {
          label: "INSUFFICIENT SOURCE",
          bg: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800",
          icon: "✕",
        };
    }
  };

  const badge = getScoreBadge(readiness.overallScore);

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-base shrink-0">
            📊
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                Authoritative Source Readiness Check
              </h3>
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wide border uppercase ${badge.bg}`}
              >
                <span>{badge.icon}</span>
                <span>{badge.label}</span>
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Evaluates catalog specifications, verified category attributes, and media assets before AI generation.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          <span className="text-xs font-mono font-semibold text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 rounded-lg">
            {readiness.readyChecks} / {readiness.totalChecks} Checks Passed
          </span>
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline px-2 py-1"
          >
            {isExpanded ? "Collapse ▲" : "View Breakdown ▼"}
          </button>
        </div>
      </div>

      {/* Critical Missing Facts Warning */}
      {readiness.missingCriticalFacts.length > 0 && (
        <div className="rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 p-3 text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2">
          <span className="text-base shrink-0">⚠️</span>
          <div>
            <span className="font-bold">Missing Critical Source Facts: </span>
            <span>{readiness.missingCriticalFacts.join(", ")}. Please review catalog inputs before publishing.</span>
          </div>
        </div>
      )}

      {/* Expandable Breakdown Grid */}
      {isExpanded && (
        <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            {readiness.items.map((item) => {
              const itemBadge = getScoreBadge(item.status);
              return (
                <div
                  key={item.id}
                  className="rounded-xl border border-zinc-100 dark:border-zinc-800 p-3 bg-zinc-50/50 dark:bg-zinc-800/30 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-zinc-800 dark:text-zinc-200">{item.name}</span>
                    <span
                      className={`inline-flex items-center gap-0.5 px-2 py-0.2 rounded text-[9px] font-bold uppercase border ${itemBadge.bg}`}
                    >
                      {itemBadge.icon} {itemBadge.label}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">{item.evidence}</p>
                  <div className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">
                    Source: {item.sourceField}
                  </div>

                  {/* Category attributes chips if present */}
                  {item.categoryAttributes && Object.keys(item.categoryAttributes).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1.5">
                      {Object.entries(item.categoryAttributes).map(([k, v]) => (
                        <span
                          key={k}
                          className="px-2 py-0.5 rounded-md bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-[10px] text-zinc-700 dark:text-zinc-300 font-medium"
                        >
                          <span className="text-zinc-400 font-bold">{k}:</span> {v}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
