"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { KnowledgeItem, SystemImpactTrigger } from "@/lib/knowledge/types";
import KnowledgeNavTabs from "./knowledge-nav-tabs";

export default function ReviewView() {
  const [data, setData] = useState<{
    awaitingApproval: KnowledgeItem[];
    needsReview: KnowledgeItem[];
    systemChangeImpact: KnowledgeItem[];
    triggers: SystemImpactTrigger[];
  } | null>(null);

  const [activeQueue, setActiveQueue] = useState<"APPROVAL" | "NEEDS_REVIEW" | "SYSTEM_IMPACT">("SYSTEM_IMPACT");
  const [loading, setLoading] = useState(true);

  // Modal for No Update Required
  const [noUpdateModalItem, setNoUpdateModalItem] = useState<KnowledgeItem | null>(null);
  const [noUpdateReason, setNoUpdateReason] = useState("");

  useEffect(() => {
    fetchReviewQueues();
  }, []);

  const fetchReviewQueues = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/knowledge/review");
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (e) {
      console.error("Failed to load review queues:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleResolveNoUpdate = async () => {
    if (!noUpdateModalItem || !noUpdateReason.trim()) {
      alert("Please enter the reason why no content update is required.");
      return;
    }

    try {
      const res = await fetch("/api/admin/knowledge/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          knowledgeId: noUpdateModalItem.id,
          action: "NO_UPDATE_REQUIRED",
          reason: noUpdateReason,
          user_name: "Knowledge Operator"
        })
      });

      if (res.ok) {
        alert("Marked as 'No Update Required'. Status restored to Normal.");
        setNoUpdateModalItem(null);
        setNoUpdateReason("");
        fetchReviewQueues();
      }
    } catch (e) {
      alert("Failed to resolve system impact.");
    }
  };

  if (loading) {
    return (
      <div className="p-8 max-w-7xl mx-auto space-y-4">
        <div className="h-8 w-64 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
        <div className="h-48 bg-zinc-100 dark:bg-zinc-900 rounded-xl animate-pulse" />
      </div>
    );
  }

  const awaitingApproval = data?.awaitingApproval || [];
  const needsReview = data?.needsReview || [];
  const systemChangeImpact = data?.systemChangeImpact || [];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <KnowledgeNavTabs />
      {/* Top Header */}
      <div className="border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
          Review & Updates Center
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Governance queues for external publication approvals, review cycles, and system change impact tracking.
        </p>
      </div>

      {/* Queue Tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 select-none">
        <button
          onClick={() => setActiveQueue("SYSTEM_IMPACT")}
          className={`p-5 rounded-xl border text-left transition-all shadow-sm ${
            activeQueue === "SYSTEM_IMPACT"
              ? "border-rose-500 bg-rose-50/70 dark:bg-rose-950/30 dark:border-rose-800 ring-1 ring-rose-500"
              : "border-zinc-200 bg-white hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
              System Change Impact
            </span>
            <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-800 dark:bg-rose-950 dark:text-rose-300">
              {systemChangeImpact.length}
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-2">
            Knowledge items marked POTENTIALLY_OUTDATED due to platform system setting modifications.
          </p>
        </button>

        <button
          onClick={() => setActiveQueue("APPROVAL")}
          className={`p-5 rounded-xl border text-left transition-all shadow-sm ${
            activeQueue === "APPROVAL"
              ? "border-blue-500 bg-blue-50/70 dark:bg-blue-950/30 dark:border-blue-800 ring-1 ring-blue-500"
              : "border-zinc-200 bg-white hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              Awaiting Approval
            </span>
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-800 dark:bg-blue-950 dark:text-blue-300">
              {awaitingApproval.length}
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-2">
            External Publication Guard queue awaiting authorized Approver validation.
          </p>
        </button>

        <button
          onClick={() => setActiveQueue("NEEDS_REVIEW")}
          className={`p-5 rounded-xl border text-left transition-all shadow-sm ${
            activeQueue === "NEEDS_REVIEW"
              ? "border-amber-500 bg-amber-50/70 dark:bg-amber-950/30 dark:border-amber-800 ring-1 ring-amber-500"
              : "border-zinc-200 bg-white hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Needs Governance Review
            </span>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
              {needsReview.length}
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-2">
            Internal drafts, sensitive policy items & scheduled periodic review queues.
          </p>
        </button>
      </div>

      {/* QUEUE 1: SYSTEM CHANGE IMPACT */}
      {activeQueue === "SYSTEM_IMPACT" && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500 animate-pulse"></span>
            System Change Impact Queue ({systemChangeImpact.length})
          </h2>

          <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 divide-y divide-zinc-100 dark:divide-zinc-900 shadow-sm overflow-hidden">
            {systemChangeImpact.length === 0 ? (
              <div className="p-12 text-center text-sm text-zinc-500">
                ✨ No knowledge items are currently impacted by system setting changes!
              </div>
            ) : (
              systemChangeImpact.map((item) => (
                <div key={item.id} className="p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 px-2 py-0.5 text-[10px] font-bold">
                        POTENTIALLY OUTDATED
                      </span>
                      <span className="text-xs font-bold font-mono text-zinc-600 dark:text-zinc-400">{item.current_version}</span>
                    </div>
                    <span className="text-xs text-zinc-400">{new Date(item.updated_at).toLocaleDateString()}</span>
                  </div>

                  <div>
                    <Link href={`/admin/knowledge/${item.id}`} className="text-base font-bold text-zinc-900 dark:text-white hover:underline">
                      {item.title_ko || item.title}
                    </Link>
                    <p className="text-xs font-semibold text-rose-700 dark:text-rose-400 mt-1">
                      ⚠️ Reason: {item.system_impact_reason}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-900">
                    <Link
                      href={`/admin/knowledge/${item.id}`}
                      className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900"
                    >
                      Review Detail
                    </Link>
                    <Link
                      href={`/admin/knowledge/${item.id}`}
                      className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900"
                    >
                      Create Updated Version
                    </Link>
                    <button
                      onClick={() => setNoUpdateModalItem(item)}
                      className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-900"
                    >
                      No Update Required
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* QUEUE 2: AWAITING APPROVAL */}
      {activeQueue === "APPROVAL" && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white">External Publication Guard Queue ({awaitingApproval.length})</h2>

          <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 divide-y divide-zinc-100 dark:divide-zinc-900 shadow-sm overflow-hidden">
            {awaitingApproval.length === 0 ? (
              <div className="p-12 text-center text-sm text-zinc-500">
                No items are currently awaiting external publication approval.
              </div>
            ) : (
              awaitingApproval.map((item) => (
                <div key={item.id} className="p-5 flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 px-2 py-0.5 text-[10px] font-bold">
                        EXTERNAL REVIEW REQUESTED
                      </span>
                      <span className="text-xs font-semibold text-zinc-500">Audiences: {item.audience.join(", ")}</span>
                    </div>
                    <Link href={`/admin/knowledge/${item.id}`} className="text-base font-bold text-zinc-900 dark:text-white hover:underline block">
                      {item.title_ko || item.title}
                    </Link>
                    <p className="text-xs text-zinc-500 line-clamp-1">{item.summary_ko || item.summary_en}</p>
                  </div>
                  <Link
                    href={`/admin/knowledge/${item.id}`}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition-colors"
                  >
                    Validate & Approve
                  </Link>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* QUEUE 3: NEEDS GOVERNANCE REVIEW */}
      {activeQueue === "NEEDS_REVIEW" && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Needs Governance Review Queue ({needsReview.length})</h2>

          <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 divide-y divide-zinc-100 dark:divide-zinc-900 shadow-sm overflow-hidden">
            {needsReview.length === 0 ? (
              <div className="p-12 text-center text-sm text-zinc-500">
                No governance review items found.
              </div>
            ) : (
              needsReview.map((item) => (
                <div key={item.id} className="p-5 flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200 px-2 py-0.5 text-[10px] font-bold">
                        {item.type}
                      </span>
                      <span className="text-xs font-semibold text-zinc-500">Owner: {item.owner_name}</span>
                    </div>
                    <Link href={`/admin/knowledge/${item.id}`} className="text-base font-bold text-zinc-900 dark:text-white hover:underline block">
                      {item.title_ko || item.title}
                    </Link>
                    <p className="text-xs text-zinc-500">{item.summary_ko || item.summary_en}</p>
                  </div>
                  <Link
                    href={`/admin/knowledge/${item.id}`}
                    className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900"
                  >
                    Open Detail
                  </Link>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* NO UPDATE REQUIRED MODAL */}
      {noUpdateModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Confirm No Update Required</h3>
            <p className="text-xs text-zinc-500">
              Record operator justification for keeping <strong>{noUpdateModalItem.title_ko || noUpdateModalItem.title}</strong> unchanged after system setting change.
            </p>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Reason / Justification</label>
              <textarea
                value={noUpdateReason}
                onChange={(e) => setNoUpdateReason(e.target.value)}
                placeholder="e.g. Setting value change does not impact explanatory text logic."
                rows={3}
                className="w-full rounded-lg border border-zinc-300 p-2.5 text-xs dark:border-zinc-800 dark:bg-zinc-900 text-zinc-900 dark:text-white"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button onClick={() => setNoUpdateModalItem(null)} className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-700">Cancel</button>
              <button onClick={handleResolveNoUpdate} className="rounded-lg bg-zinc-900 px-4 py-1.5 text-xs font-semibold text-white dark:bg-white dark:text-zinc-900">Confirm & Record</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
