"use client";

import React, { useState } from "react";
import type {
  TrainingSourceReadiness,
  SourceReadinessScore,
  ContentVerificationSummary,
  ClaimVerificationStatus,
  ClaimVerificationItem,
} from "@/lib/training/training-types";

interface SourceReadinessCardProps {
  readiness: TrainingSourceReadiness;
  verification?: ContentVerificationSummary;
  onRefresh?: () => void;
  onNavigateToIssue?: (issue: ClaimVerificationItem) => void;
}

export function TrainingSourceReadinessCard({
  readiness,
  verification,
  onRefresh,
  onNavigateToIssue,
}: SourceReadinessCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<"readiness" | "verification">("readiness");

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

  const getVerificationBadge = (status: ClaimVerificationStatus) => {
    switch (status) {
      case "verified":
        return {
          label: "VERIFIED",
          bg: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
          icon: "✓",
        };
      case "needs_review":
        return {
          label: "NEEDS REVIEW",
          bg: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
          icon: "⚠️",
        };
      case "unsupported":
      default:
        return {
          label: "UNSUPPORTED",
          bg: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800",
          icon: "✕",
        };
    }
  };

  const readinessBadge = getScoreBadge(readiness.overallScore);
  const verificationBadge = verification ? getVerificationBadge(verification.overallStatus) : null;

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
      {/* Top Summary Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-lg shrink-0">
            📊
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                Source Readiness & Content Verification
              </h3>

              {/* Source Readiness Indicator */}
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wide border uppercase ${readinessBadge.bg}`}
                title="Measures availability of product specifications, bullet points, and media assets."
              >
                <span>{readinessBadge.icon}</span>
                <span>Sources: {readinessBadge.label}</span>
              </span>

              {/* Content Verification Indicator */}
              {verificationBadge && (
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wide border uppercase ${verificationBadge.bg}`}
                  title="Factual verification of claims against catalog records and certified brand facts."
                >
                  <span>{verificationBadge.icon}</span>
                  <span>Claims: {verificationBadge.label}</span>
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Separates catalog data availability ({readiness.readyChecks}/{readiness.totalChecks} checks) from factual claim verification ({verification?.verifiedCount || 0}/{verification?.totalClaimsChecked || 0} claims verified).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end lg:self-center">
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow-2xs transition-colors flex items-center gap-1 cursor-pointer"
              title="Re-verify all generated claims against current product catalog specifications"
            >
              <span>🔄</span>
              <span>Recheck Claims</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline px-2.5 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/30 cursor-pointer"
          >
            {isExpanded ? "Collapse Details ▲" : "Review Breakdown & Sources ▼"}
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

      {/* Unsupported Claims Alert */}
      {verification && verification.unsupportedWarnings.length > 0 && (
        <div className="rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 p-3 text-xs text-amber-900 dark:text-amber-200 space-y-1">
          <div className="flex items-center gap-1.5 font-bold">
            <span>⚠️</span>
            <span>Claims Requiring Review or Qualification ({verification.unsupportedWarnings.length}):</span>
          </div>
          <ul className="list-disc list-inside text-[11px] space-y-0.5 text-amber-800 dark:text-amber-300">
            {verification.unsupportedWarnings.map((w, idx) => (
              <li key={idx}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Expandable Breakdown with Sub-Tabs */}
      {isExpanded && (
        <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 space-y-4">
          <div className="flex items-center gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-2">
            <button
              type="button"
              onClick={() => setActiveTab("readiness")}
              className={`text-xs font-bold px-3 py-1 rounded-lg transition-colors ${
                activeTab === "readiness"
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }`}
            >
              1. Source Data Completeness ({readiness.readyChecks}/{readiness.totalChecks})
            </button>
            {verification && (
              <button
                type="button"
                onClick={() => setActiveTab("verification")}
                className={`text-xs font-bold px-3 py-1 rounded-lg transition-colors ${
                  activeTab === "verification"
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                }`}
              >
                2. Claim Attribution & Factual Backing ({verification.verifiedCount}/{verification.totalClaimsChecked})
              </button>
            )}
          </div>

          {/* TAB 1: Source Data Completeness */}
          {activeTab === "readiness" && (
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
          )}

          {/* TAB 2: Claim Attribution & Verification */}
          {activeTab === "verification" && verification && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {verification.claims.map((claim) => {
                  const cBadge = getVerificationBadge(claim.status);
                  return (
                    <div
                      key={claim.id}
                      className={`rounded-xl border p-3 space-y-2 ${
                        claim.status === "unsupported"
                          ? "border-rose-200 bg-rose-50/40 dark:border-rose-900/60 dark:bg-rose-950/20"
                          : claim.status === "needs_review"
                          ? "border-amber-200 bg-amber-50/40 dark:border-amber-900/60 dark:bg-amber-950/20"
                          : "border-zinc-100 bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-800/30"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          {claim.location && (
                            <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold bg-zinc-200/80 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                              {claim.location}
                            </span>
                          )}
                          <div className="font-bold text-zinc-900 dark:text-zinc-100">{claim.claim}</div>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span
                            className={`inline-flex items-center gap-0.5 px-2 py-0.2 rounded text-[9px] font-bold uppercase border ${cBadge.bg}`}
                          >
                            {cBadge.icon} {cBadge.label}
                          </span>
                          {claim.severity === "blocking" && (
                            <span className="px-1.5 py-0.2 rounded text-[8px] font-black uppercase tracking-tight bg-rose-600 text-white">
                              BLOCKING
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-[10px] text-zinc-500 font-mono">
                        Authoritative Source: <span className="font-semibold text-zinc-700 dark:text-zinc-300">{claim.sourceCategory}</span>
                      </div>

                      {claim.evidenceSnippet && (
                        <p className="text-[11px] text-zinc-600 dark:text-zinc-400 italic">
                          &ldquo;{claim.evidenceSnippet}&rdquo;
                        </p>
                      )}

                      {claim.reason && (
                        <div className="text-[11px] text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 p-2 rounded-lg border border-rose-200/60 dark:border-rose-900/40">
                          <span className="font-bold">Issue: </span>
                          <span>{claim.reason}</span>
                        </div>
                      )}

                      {claim.qualificationNote && !claim.reason && (
                        <div className="text-[10px] text-amber-700 dark:text-amber-300 bg-amber-100/60 dark:bg-amber-950/50 p-2 rounded-lg">
                          <span className="font-bold">Reviewer Note: </span>
                          <span>{claim.qualificationNote}</span>
                        </div>
                      )}

                      {(claim.status === "unsupported" || claim.status === "needs_review") && onNavigateToIssue && (
                        <div className="pt-1 flex justify-end">
                          <button
                            type="button"
                            onClick={() => onNavigateToIssue(claim)}
                            className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <span>View &amp; Fix</span>
                            <span>→</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
