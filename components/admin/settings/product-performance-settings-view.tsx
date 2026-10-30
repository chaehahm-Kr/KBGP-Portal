"use client";

/**
 * Product Performance Settings V1.0 — Admin Settings Client View
 * Task ID: ADM-SALES-PERF-005-R2
 * Location: components/admin/settings/product-performance-settings-view.tsx
 *
 * Implements 3-tab layout:
 * 1. Active Policy (Authoritative configuration & safety gates)
 * 2. Draft Workspace (Multi-draft, 7-pillar sliders, sum 100% check, structural simulation, Owner publish)
 * 3. Version History & Audit Log (Historical policies, immutable audit records, Owner rollback)
 *
 * Conforms strictly to AGENTS.md Rule 27:
 * - Fluid responsive layout, no competing outer max-w wrappers, left-aligned layout.
 */

import React, { useState, useTransition, useId } from "react";
import type {
  PerformancePolicy,
  PolicyDraftInput,
  PolicyAuditLog,
  PolicyStructuralPreviewResult,
} from "@/lib/product/performance/policy-types";
import { validatePolicyDraft } from "@/lib/product/performance/policy-types";
import {
  saveDraftPolicyAction,
  discardDraftAction,
  publishPolicyAction,
  rollbackPolicyAction,
  simulatePolicyStructuralPreviewAction,
} from "@/lib/product/performance/policy-service";
import type { PillarName } from "@/lib/product/performance/grade-policy";

interface ActorContext {
  isAuthenticated: boolean;
  isOwner: boolean;
  staffId: string | null;
  email: string | null;
  name: string | null;
}

interface ProductPerformanceSettingsViewProps {
  initialActivePolicy: PerformancePolicy;
  initialPolicies: PerformancePolicy[];
  initialAuditLogs: PolicyAuditLog[];
  isSchemaReady: boolean;
  actorContext: ActorContext;
}

const PILLAR_LABELS: Record<PillarName, { label: string; desc: string }> = {
  profitability: { label: "Profitability", desc: "Wholesale margin & gross profit contribution" },
  salesPerformance: { label: "Sales Performance", desc: "B2B net wholesale order revenue" },
  inventoryEfficiency: { label: "Inventory Efficiency", desc: "HQ turnover, DIO, & inventory carrying cost" },
  exchangeRisk: { label: "Exchange Risk", desc: "Exchange claim rate & unprotected exposure" },
  retailVelocity: { label: "Retail Velocity", desc: "Weekly sell-through & store replenishment rates" },
  growthPotential: { label: "Growth Potential", desc: "Revenue & store expansion momentum" },
  operationalReliability: { label: "Operational Reliability", desc: "Fulfillment SLA & defect-free delivery" },
};

export function ProductPerformanceSettingsView({
  initialActivePolicy,
  initialPolicies,
  initialAuditLogs,
  isSchemaReady,
  actorContext,
}: ProductPerformanceSettingsViewProps) {
  const [activeTab, setActiveTab] = useState<"active" | "draft" | "history">("active");
  const [isPending, startTransition] = useTransition();

  // Policies and Audit state
  const [activePolicy, setActivePolicy] = useState<PerformancePolicy>(initialActivePolicy);
  const [policies, setPolicies] = useState<PerformancePolicy[]>(initialPolicies);
  const [auditLogs, setAuditLogs] = useState<PolicyAuditLog[]>(initialAuditLogs);

  // Draft Workspace State
  const drafts = policies.filter((p) => p.status === "draft");
  const [selectedDraftId, setSelectedDraftId] = useState<string>("new");

  const [draftForm, setDraftForm] = useState<PolicyDraftInput>({
    draftTitle: "New Policy Draft",
    evaluationPeriodDays: activePolicy.evaluationPeriodDays,
    eligibilityCriteria: { ...activePolicy.eligibilityCriteria },
    dimensionWeights: { ...activePolicy.dimensionWeights },
    gradeBands: JSON.parse(JSON.stringify(activePolicy.gradeBands)),
    changeSummary: "",
  });

  // UI Feedback / Alerts
  const [feedback, setFeedback] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  // Simulation State
  const [isSimulating, setIsSimulating] = useState(false);
  const [previewResult, setPreviewResult] = useState<PolicyStructuralPreviewResult | null>(null);

  // Modals
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishReason, setPublishReason] = useState("");
  const [showRollbackModal, setShowRollbackModal] = useState(false);
  const [rollbackTarget, setRollbackTarget] = useState<PerformancePolicy | null>(null);
  const [rollbackReason, setRollbackReason] = useState("");

  // Live validation
  const validation = validatePolicyDraft(draftForm);

  // Pillar weight sum calculation
  const totalWeight = Object.values(draftForm.dimensionWeights).reduce((a, b) => a + (Number(b) || 0), 0);

  // Handlers
  const handleSelectDraft = (id: string) => {
    setSelectedDraftId(id);
    setPreviewResult(null);
    if (id === "new") {
      setDraftForm({
        draftTitle: `Draft from ${activePolicy.version}`,
        evaluationPeriodDays: activePolicy.evaluationPeriodDays,
        eligibilityCriteria: { ...activePolicy.eligibilityCriteria },
        dimensionWeights: { ...activePolicy.dimensionWeights },
        gradeBands: JSON.parse(JSON.stringify(activePolicy.gradeBands)),
        changeSummary: "",
      });
    } else {
      const target = drafts.find((d) => d.id === id);
      if (target) {
        setDraftForm({
          id: target.id,
          draftTitle: target.draftTitle,
          evaluationPeriodDays: target.evaluationPeriodDays,
          eligibilityCriteria: { ...target.eligibilityCriteria },
          dimensionWeights: { ...target.dimensionWeights },
          gradeBands: JSON.parse(JSON.stringify(target.gradeBands)),
          lockVersion: target.lockVersion,
          changeSummary: target.changeSummary || "",
        });
      }
    }
  };

  const handleWeightChange = (pillar: PillarName, val: number) => {
    setDraftForm((prev) => ({
      ...prev,
      dimensionWeights: {
        ...prev.dimensionWeights,
        [pillar]: Math.max(0, Math.min(100, val)),
      },
    }));
  };

  const handleResetWeights = () => {
    setDraftForm((prev) => ({
      ...prev,
      dimensionWeights: { ...activePolicy.dimensionWeights },
    }));
  };

  const handleSaveDraft = () => {
    if (!validation.isValid) {
      setFeedback({
        type: "error",
        message: "Please resolve all validation errors before saving the draft.",
      });
      return;
    }

    startTransition(async () => {
      const res = await saveDraftPolicyAction(draftForm);
      if (res.success && res.policy) {
        setFeedback({ type: "success", message: "Draft policy saved successfully." });
        setPolicies((prev) => {
          const idx = prev.findIndex((p) => p.id === res.policy!.id);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = res.policy!;
            return next;
          }
          return [res.policy!, ...prev];
        });
        setSelectedDraftId(res.policy.id);
      } else {
        setFeedback({ type: "error", message: res.error || "Failed to save draft." });
      }
    });
  };

  const handleDiscardDraft = () => {
    if (selectedDraftId === "new") {
      handleSelectDraft("new");
      return;
    }

    if (!confirm("Are you sure you want to discard this draft? This cannot be undone.")) return;

    startTransition(async () => {
      const res = await discardDraftAction(selectedDraftId);
      if (res.success) {
        setFeedback({ type: "success", message: "Draft discarded successfully." });
        setPolicies((prev) => prev.filter((p) => p.id !== selectedDraftId));
        handleSelectDraft("new");
      } else {
        setFeedback({ type: "error", message: res.error || "Failed to discard draft." });
      }
    });
  };

  const handleRunSimulation = () => {
    setIsSimulating(true);
    setFeedback(null);
    startTransition(async () => {
      const res = await simulatePolicyStructuralPreviewAction(draftForm);
      setIsSimulating(false);
      if (res.success && res.preview) {
        setPreviewResult(res.preview);
        setFeedback({
          type: "info",
          message: `Simulation completed across ${res.preview.totalCatalogSkus} catalog SKUs.`,
        });
      } else {
        setFeedback({ type: "error", message: res.error || "Failed to run simulation." });
      }
    });
  };

  const handleConfirmPublish = () => {
    if (!selectedDraftId || selectedDraftId === "new") {
      setFeedback({ type: "error", message: "Please save the draft before publishing." });
      return;
    }

    startTransition(async () => {
      const res = await publishPolicyAction(selectedDraftId, publishReason);
      setShowPublishModal(false);
      if (res.success) {
        setFeedback({
          type: "success",
          message: "Policy successfully published! It is now the active evaluation standard.",
        });
        window.location.reload();
      } else {
        setFeedback({ type: "error", message: res.error || "Failed to publish policy." });
      }
    });
  };

  const handleConfirmRollback = () => {
    if (!rollbackTarget) return;

    startTransition(async () => {
      const res = await rollbackPolicyAction(rollbackTarget.id, rollbackReason);
      setShowRollbackModal(false);
      if (res.success) {
        setFeedback({
          type: "success",
          message: `Successfully rolled back to policy version ${rollbackTarget.version}.`,
        });
        window.location.reload();
      } else {
        setFeedback({ type: "error", message: res.error || "Failed to execute rollback." });
      }
    });
  };

  return (
    <div className="w-full text-zinc-900 pb-16">
      {/* 1. Header & Badges */}
      <div className="border-b border-zinc-200 pb-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-zinc-100 text-zinc-700 uppercase tracking-wider">
                Product Performance Settings
              </span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                Active: {activePolicy.version}
              </span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-600 border border-zinc-200">
                Automatic Grading: OFF (Gated)
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
              Evaluation Policy Architecture & Configuration
            </h1>
            <p className="text-sm text-zinc-500 mt-1">
              Manage authoritative product performance grading rules, dimension weights, and eligibility thresholds.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-zinc-500">
              Actor: <strong className="text-zinc-800">{actorContext.email || "Admin"}</strong>
              {actorContext.isOwner && (
                <span className="ml-1.5 px-2 py-0.5 rounded text-[11px] font-semibold bg-purple-100 text-purple-800">
                  Owner
                </span>
              )}
            </span>
          </div>
        </div>

        {/* Pending Schema Banner */}
        {!isSchemaReady && (
          <div className="mt-4 p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-3">
            <div className="text-amber-600 mt-0.5">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="text-sm flex-1">
              <p className="font-semibold">Schema Pending Deployment (Migration 0182)</p>
              <p className="text-amber-800 mt-0.5">
                The database tables for dynamic policy persistence have not yet been deployed to the database. Running in <strong>Owner-Approved Baseline Mode (v1.0.0)</strong>. Saving drafts and publishing are disabled until migration 0182 is applied. Structural simulation is fully available in preview mode.
              </p>
            </div>
          </div>
        )}

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`mt-4 p-4 rounded-lg text-sm border flex items-center justify-between ${
              feedback.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : feedback.type === "error"
                ? "bg-rose-50 border-rose-200 text-rose-800"
                : "bg-blue-50 border-blue-200 text-blue-800"
            }`}
          >
            <div>{feedback.message}</div>
            <button
              onClick={() => setFeedback(null)}
              className="text-xs underline hover:no-underline ml-4"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>

      {/* 2. Tab Navigation */}
      <div className="flex border-b border-zinc-200 space-x-8 mb-6">
        <button
          onClick={() => setActiveTab("active")}
          className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "active"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300"
          }`}
        >
          Active Policy
        </button>
        <button
          onClick={() => setActiveTab("draft")}
          className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "draft"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300"
          }`}
        >
          <span>Draft Workspace</span>
          {drafts.length > 0 && (
            <span className="px-2 py-0.5 text-xs rounded-full bg-zinc-200 text-zinc-700">
              {drafts.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "history"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300"
          }`}
        >
          Version History & Audit Log
        </button>
      </div>

      {/* 3. Tab Contents */}

      {/* TAB 1: ACTIVE POLICY */}
      {activeTab === "active" && (
        <div className="space-y-6">
          {/* Metadata Card */}
          <div className="bg-white border border-zinc-200 rounded-lg p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-100">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-zinc-900">{activePolicy.draftTitle}</h2>
                  <span className="px-2 py-0.5 text-xs font-semibold rounded bg-emerald-100 text-emerald-800">
                    {activePolicy.version} (Active)
                  </span>
                </div>
                <p className="text-sm text-zinc-500 mt-1">
                  {activePolicy.changeSummary || "Owner codified initial evaluation standard."}
                </p>
              </div>
              <button
                onClick={() => {
                  handleSelectDraft("new");
                  setActiveTab("draft");
                }}
                className="inline-flex items-center justify-center px-4 py-2 border border-zinc-300 shadow-sm text-sm font-medium rounded-md text-zinc-700 bg-white hover:bg-zinc-50 focus:outline-none"
              >
                Create Draft from Active
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              <div className="p-3 bg-zinc-50 rounded border border-zinc-100">
                <span className="text-xs text-zinc-500 block">Evaluation Period</span>
                <span className="text-lg font-semibold text-zinc-900">
                  {activePolicy.evaluationPeriodDays} Days
                </span>
              </div>
              <div className="p-3 bg-zinc-50 rounded border border-zinc-100">
                <span className="text-xs text-zinc-500 block">Effective From</span>
                <span className="text-sm font-medium text-zinc-800">
                  {activePolicy.effectiveFrom
                    ? new Date(activePolicy.effectiveFrom).toLocaleDateString()
                    : "March 1, 2026"}
                </span>
              </div>
              <div className="p-3 bg-zinc-50 rounded border border-zinc-100">
                <span className="text-xs text-zinc-500 block">Published By</span>
                <span className="text-sm font-medium text-zinc-800">
                  {activePolicy.publishedBy || "Owner"}
                </span>
              </div>
              <div className="p-3 bg-zinc-50 rounded border border-zinc-100">
                <span className="text-xs text-zinc-500 block">Safety Gate Status</span>
                <span className="text-sm font-semibold text-rose-700">
                  Automatic Grading OFF
                </span>
              </div>
            </div>
          </div>

          {/* Eligibility Thresholds Grid */}
          <div className="bg-white border border-zinc-200 rounded-lg p-6 shadow-sm">
            <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider mb-4">
              Minimum Eligibility Criteria
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 border border-zinc-200 rounded-md bg-zinc-50">
                <span className="text-xs text-zinc-500 font-medium block">1. Operating History</span>
                <div className="text-2xl font-bold text-zinc-900 mt-1">
                  {activePolicy.eligibilityCriteria.minOperatingHistoryDays} Days
                </div>
                <p className="text-xs text-zinc-500 mt-1">
                  Products with fewer days are classified as <strong className="text-blue-600">NEW</strong>.
                </p>
              </div>

              <div className="p-4 border border-zinc-200 rounded-md bg-zinc-50">
                <span className="text-xs text-zinc-500 font-medium block">2. Completed B2B Orders</span>
                <div className="text-2xl font-bold text-zinc-900 mt-1">
                  {activePolicy.eligibilityCriteria.minCompletedOrders} Orders
                </div>
                <p className="text-xs text-zinc-500 mt-1">
                  Required completed orders in evaluation window.
                </p>
              </div>

              <div className="p-4 border border-zinc-200 rounded-md bg-zinc-50">
                <span className="text-xs text-zinc-500 font-medium block">3. Distinct Stores</span>
                <div className="text-2xl font-bold text-zinc-900 mt-1">
                  {activePolicy.eligibilityCriteria.minDistinctStores} Stores
                </div>
                <p className="text-xs text-zinc-500 mt-1">
                  Distinct purchasing retail store accounts.
                </p>
              </div>

              <div className="p-4 border border-zinc-200 rounded-md bg-zinc-50">
                <span className="text-xs text-zinc-500 font-medium block">4. Landed COGS Policy</span>
                <div className="text-2xl font-bold text-zinc-900 mt-1">
                  Strict N/A
                </div>
                <p className="text-xs text-zinc-500 mt-1">
                  Missing historical cost strictly yields NOT_RATED.
                </p>
              </div>
            </div>
          </div>

          {/* Dimension Weights & Grade Bands Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Dimension Weights */}
            <div className="bg-white border border-zinc-200 rounded-lg p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">
                  Dimension Weights (100% Total)
                </h3>
                <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800">
                  Sum: 100%
                </span>
              </div>
              <div className="space-y-4">
                {(Object.entries(activePolicy.dimensionWeights) as [PillarName, number][]).map(
                  ([pillar, weight]) => (
                    <div key={pillar}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-medium text-zinc-700">{PILLAR_LABELS[pillar]?.label || pillar}</span>
                        <span className="font-bold text-zinc-900">{weight}%</span>
                      </div>
                      <div className="w-full bg-zinc-100 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{ width: `${weight}%` }}
                        />
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-0.5">{PILLAR_LABELS[pillar]?.desc}</p>
                    </div>
                  )
                )}
              </div>
            </div>

            {/* Grade Bands */}
            <div className="bg-white border border-zinc-200 rounded-lg p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">
                  Grade Bands (Contiguous 0–100)
                </h3>
                <span className="text-xs text-zinc-500">4 Performance Bands</span>
              </div>
              <div className="space-y-3">
                <div className="p-3 rounded border border-emerald-200 bg-emerald-50">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-emerald-900">Grade A</span>
                    <span className="text-xs font-semibold text-emerald-800 px-2 py-0.5 bg-emerald-100 rounded">
                      {activePolicy.gradeBands.A.min} – {activePolicy.gradeBands.A.max} pts
                    </span>
                  </div>
                  <p className="text-xs text-emerald-700 mt-1">High Performer: Top priority for network expansion</p>
                </div>

                <div className="p-3 rounded border border-blue-200 bg-blue-50">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-blue-900">Grade B</span>
                    <span className="text-xs font-semibold text-blue-800 px-2 py-0.5 bg-blue-100 rounded">
                      {activePolicy.gradeBands.B.min} – &lt;{activePolicy.gradeBands.B.max} pts
                    </span>
                  </div>
                  <p className="text-xs text-blue-700 mt-1">Consistent Standard: Healthy stable inventory velocity</p>
                </div>

                <div className="p-3 rounded border border-amber-200 bg-amber-50">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-amber-900">Grade C</span>
                    <span className="text-xs font-semibold text-amber-800 px-2 py-0.5 bg-amber-100 rounded">
                      {activePolicy.gradeBands.C.min} – &lt;{activePolicy.gradeBands.C.max} pts
                    </span>
                  </div>
                  <p className="text-xs text-amber-700 mt-1">At Risk / Review Needed: Monitor return and turnover rates</p>
                </div>

                <div className="p-3 rounded border border-rose-200 bg-rose-50">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-rose-900">Grade D</span>
                    <span className="text-xs font-semibold text-rose-800 px-2 py-0.5 bg-rose-100 rounded">
                      {activePolicy.gradeBands.D.min} – &lt;{activePolicy.gradeBands.D.max} pts
                    </span>
                  </div>
                  <p className="text-xs text-rose-700 mt-1">Immediate Action: Excessive exchange risk or capital drag</p>
                </div>
              </div>

              <div className="mt-4 p-3 bg-zinc-50 border border-zinc-200 rounded text-xs text-zinc-500">
                <strong>Safety Policy Gate:</strong> Automatic grades (A/B/C/D) will NOT be produced until scoring normalization curves receive Owner sign-off. Products meeting criteria currently report status as eligible readiness.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DRAFT WORKSPACE */}
      {activeTab === "draft" && (
        <div className="space-y-6">
          {/* Draft Selector Bar */}
          <div className="bg-white border border-zinc-200 rounded-lg p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <label htmlFor="draft-select" className="text-xs font-bold text-zinc-600 uppercase">
                Active Draft:
              </label>
              <select
                id="draft-select"
                value={selectedDraftId}
                onChange={(e) => handleSelectDraft(e.target.value)}
                className="text-sm border border-zinc-300 rounded-md px-3 py-1.5 bg-white text-zinc-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="new">+ Create New Draft</option>
                {drafts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.draftTitle} (v{d.lockVersion})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRunSimulation}
                disabled={isSimulating || isPending}
                className="inline-flex items-center px-3.5 py-1.5 border border-zinc-300 shadow-sm text-xs font-medium rounded-md text-zinc-700 bg-white hover:bg-zinc-50 disabled:opacity-50"
              >
                {isSimulating ? "Simulating..." : "⚡ Simulate Impact Preview"}
              </button>

              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={!isSchemaReady || isPending || !validation.isValid}
                title={!isSchemaReady ? "Schema migration 0182 pending" : ""}
                className="inline-flex items-center px-3.5 py-1.5 border border-transparent shadow-sm text-xs font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
              >
                Save Draft
              </button>

              {selectedDraftId !== "new" && (
                <button
                  type="button"
                  onClick={handleDiscardDraft}
                  disabled={!isSchemaReady || isPending}
                  className="inline-flex items-center px-3 py-1.5 border border-rose-300 text-xs font-medium rounded-md text-rose-700 bg-white hover:bg-rose-50 disabled:opacity-50"
                >
                  Discard
                </button>
              )}

              {/* Owner-Gated Publish Button */}
              <button
                type="button"
                onClick={() => {
                  setPublishReason(`Published by Owner (${actorContext.email || "Admin"})`);
                  setShowPublishModal(true);
                }}
                disabled={
                  !actorContext.isOwner ||
                  !isSchemaReady ||
                  selectedDraftId === "new" ||
                  !validation.isValid ||
                  isPending
                }
                title={
                  !actorContext.isOwner
                    ? "Publishing is strictly restricted to Owner (Super Admin)."
                    : !isSchemaReady
                    ? "Schema migration 0182 pending"
                    : selectedDraftId === "new"
                    ? "Please save the draft first"
                    : ""
                }
                className="inline-flex items-center px-4 py-1.5 border border-transparent shadow-sm text-xs font-medium rounded-md text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                🚀 Publish Policy
              </button>
            </div>
          </div>

          {/* Validation Errors Alert if any */}
          {!validation.isValid && (
            <div className="p-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-900 text-xs space-y-1">
              <strong className="block font-semibold">Please fix the following validation issues:</strong>
              {validation.weightErrors.map((e, idx) => (
                <div key={idx}>• {e}</div>
              ))}
              {validation.bandErrors.map((e, idx) => (
                <div key={idx}>• {e}</div>
              ))}
              {validation.eligibilityErrors.map((e, idx) => (
                <div key={idx}>• {e}</div>
              ))}
              {validation.generalErrors.map((e, idx) => (
                <div key={idx}>• {e}</div>
              ))}
            </div>
          )}

          {/* Form Grid */}
          <div className="bg-white border border-zinc-200 rounded-lg p-6 shadow-sm space-y-6">
            {/* Draft Title & Period */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="text-xs font-semibold text-zinc-700 block mb-1">
                  Draft Title *
                </label>
                <input
                  type="text"
                  value={draftForm.draftTitle}
                  onChange={(e) => setDraftForm({ ...draftForm, draftTitle: e.target.value })}
                  className="w-full border border-zinc-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="e.g. Q2 Relaxed Velocity Policy"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-700 block mb-1">
                  Evaluation Window (Days) *
                </label>
                <input
                  type="number"
                  min="7"
                  max="365"
                  value={draftForm.evaluationPeriodDays}
                  onChange={(e) =>
                    setDraftForm({
                      ...draftForm,
                      evaluationPeriodDays: parseInt(e.target.value, 10) || 60,
                    })
                  }
                  className="w-full border border-zinc-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Eligibility Thresholds */}
            <div>
              <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider mb-3">
                Eligibility Thresholds
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="text-xs text-zinc-600 block mb-1">Min Operating History (Days)</label>
                  <input
                    type="number"
                    min="0"
                    value={draftForm.eligibilityCriteria.minOperatingHistoryDays}
                    onChange={(e) =>
                      setDraftForm({
                        ...draftForm,
                        eligibilityCriteria: {
                          ...draftForm.eligibilityCriteria,
                          minOperatingHistoryDays: Math.max(0, parseInt(e.target.value, 10) || 0),
                        },
                      })
                    }
                    className="w-full border border-zinc-300 rounded px-3 py-1.5 text-sm"
                  />
                  <span className="text-[11px] text-zinc-400 mt-0.5 block">&lt; threshold = NEW</span>
                </div>

                <div>
                  <label className="text-xs text-zinc-600 block mb-1">Min Completed Orders</label>
                  <input
                    type="number"
                    min="0"
                    value={draftForm.eligibilityCriteria.minCompletedOrders}
                    onChange={(e) =>
                      setDraftForm({
                        ...draftForm,
                        eligibilityCriteria: {
                          ...draftForm.eligibilityCriteria,
                          minCompletedOrders: Math.max(0, parseInt(e.target.value, 10) || 0),
                        },
                      })
                    }
                    className="w-full border border-zinc-300 rounded px-3 py-1.5 text-sm"
                  />
                  <span className="text-[11px] text-zinc-400 mt-0.5 block">B2B delivered orders</span>
                </div>

                <div>
                  <label className="text-xs text-zinc-600 block mb-1">Min Distinct Stores</label>
                  <input
                    type="number"
                    min="0"
                    value={draftForm.eligibilityCriteria.minDistinctStores}
                    onChange={(e) =>
                      setDraftForm({
                        ...draftForm,
                        eligibilityCriteria: {
                          ...draftForm.eligibilityCriteria,
                          minDistinctStores: Math.max(0, parseInt(e.target.value, 10) || 0),
                        },
                      })
                    }
                    className="w-full border border-zinc-300 rounded px-3 py-1.5 text-sm"
                  />
                  <span className="text-[11px] text-zinc-400 mt-0.5 block">Unique retailer stores</span>
                </div>

                <div>
                  <label className="text-xs text-zinc-600 block mb-1">Missing Cost Policy</label>
                  <div className="px-3 py-1.5 rounded border border-zinc-200 bg-zinc-50 text-xs font-semibold text-zinc-700">
                    Strict N/A (Locked)
                  </div>
                  <span className="text-[11px] text-zinc-400 mt-0.5 block">Never substitute current cost</span>
                </div>
              </div>
            </div>

            {/* Dimension Weights Sliders */}
            <div className="pt-4 border-t border-zinc-100">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
                    7-Pillar Dimension Weights
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Adjust the relative weight of each evaluation pillar. Must equal exactly 100%.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`px-3 py-1 rounded text-xs font-bold ${
                      totalWeight === 100
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-rose-100 text-rose-800"
                    }`}
                  >
                    Sum: {totalWeight}% {totalWeight === 100 ? "✓" : "(Must be 100%)"}
                  </span>
                  <button
                    type="button"
                    onClick={handleResetWeights}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Reset to Baseline
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                {(Object.entries(draftForm.dimensionWeights) as [PillarName, number][]).map(
                  ([pillar, weight]) => {
                    const sliderId = `slider-${pillar}`;
                    return (
                    <div key={pillar} className="p-3 bg-zinc-50 border border-zinc-200 rounded-md">
                      <div className="flex justify-between items-center mb-1">
                        <label htmlFor={sliderId} className="text-xs font-bold text-zinc-800">
                          {PILLAR_LABELS[pillar]?.label || pillar}
                        </label>
                        <div className="flex items-center gap-1">
                          <input
                            id={sliderId}
                            type="number"
                            min="0"
                            max="100"
                            value={weight}
                            onChange={(e) =>
                              handleWeightChange(pillar, parseInt(e.target.value, 10) || 0)
                            }
                            className="w-16 border border-zinc-300 rounded px-1.5 py-0.5 text-xs text-right font-bold text-zinc-900"
                          />
                          <span className="text-xs text-zinc-500">%</span>
                        </div>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="5"
                        aria-label={`${PILLAR_LABELS[pillar]?.label || pillar} weight slider`}
                        value={weight}
                        onChange={(e) =>
                          handleWeightChange(pillar, parseInt(e.target.value, 10) || 0)
                        }
                        className="w-full accent-blue-600 h-1.5 bg-zinc-200 rounded-lg cursor-pointer"
                      />
                      <span className="text-[11px] text-zinc-400 block mt-1">
                        {PILLAR_LABELS[pillar]?.desc}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Grade Bands Configuration */}
            <div className="pt-4 border-t border-zinc-100">
              <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider mb-2">
                Grade Band Thresholds
              </h3>
              <p className="text-xs text-zinc-500 mb-4">
                Boundaries must be contiguous (D.min=0, D.max=C.min, C.max=B.min, B.max=A.min, A.max=100).
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="p-3 border border-zinc-200 rounded bg-zinc-50">
                  <span className="text-xs font-bold text-emerald-800 block mb-1">Grade A</span>
                  <div className="flex items-center gap-2 text-xs">
                    <span>Min:</span>
                    <input
                      type="number"
                      value={draftForm.gradeBands.A.min}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10) || 0;
                        setDraftForm({
                          ...draftForm,
                          gradeBands: {
                            ...draftForm.gradeBands,
                            A: { ...draftForm.gradeBands.A, min: val },
                            B: { ...draftForm.gradeBands.B, max: val },
                          },
                        });
                      }}
                      className="w-16 border rounded px-1 py-0.5 text-center text-xs"
                    />
                    <span>Max: 100</span>
                  </div>
                </div>

                <div className="p-3 border border-zinc-200 rounded bg-zinc-50">
                  <span className="text-xs font-bold text-blue-800 block mb-1">Grade B</span>
                  <div className="flex items-center gap-2 text-xs">
                    <span>Min:</span>
                    <input
                      type="number"
                      value={draftForm.gradeBands.B.min}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10) || 0;
                        setDraftForm({
                          ...draftForm,
                          gradeBands: {
                            ...draftForm.gradeBands,
                            B: { ...draftForm.gradeBands.B, min: val },
                            C: { ...draftForm.gradeBands.C, max: val },
                          },
                        });
                      }}
                      className="w-16 border rounded px-1 py-0.5 text-center text-xs"
                    />
                    <span>Max: &lt;{draftForm.gradeBands.B.max}</span>
                  </div>
                </div>

                <div className="p-3 border border-zinc-200 rounded bg-zinc-50">
                  <span className="text-xs font-bold text-amber-800 block mb-1">Grade C</span>
                  <div className="flex items-center gap-2 text-xs">
                    <span>Min:</span>
                    <input
                      type="number"
                      value={draftForm.gradeBands.C.min}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10) || 0;
                        setDraftForm({
                          ...draftForm,
                          gradeBands: {
                            ...draftForm.gradeBands,
                            C: { ...draftForm.gradeBands.C, min: val },
                            D: { ...draftForm.gradeBands.D, max: val },
                          },
                        });
                      }}
                      className="w-16 border rounded px-1 py-0.5 text-center text-xs"
                    />
                    <span>Max: &lt;{draftForm.gradeBands.C.max}</span>
                  </div>
                </div>

                <div className="p-3 border border-zinc-200 rounded bg-zinc-50">
                  <span className="text-xs font-bold text-rose-800 block mb-1">Grade D</span>
                  <div className="flex items-center gap-2 text-xs">
                    <span>Min: 0</span>
                    <span>Max: &lt;{draftForm.gradeBands.D.max}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Structural Preview Section */}
          {previewResult && (
            <div className="bg-white border border-zinc-200 rounded-lg p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-200">
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">
                    Structural Impact Simulation Results
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Evaluated across {previewResult.totalCatalogSkus} catalog products. Simulates eligibility shifts only.
                  </p>
                </div>
                <span className="px-2.5 py-0.5 text-xs font-semibold rounded bg-blue-100 text-blue-800">
                  Catalog Simulation
                </span>
              </div>

              {/* Invariant Alert */}
              <div className="p-3 rounded bg-zinc-50 border border-zinc-200 text-xs text-zinc-600 flex items-center gap-2">
                <span className="text-blue-600 font-bold">ℹ️ Invariant Notice:</span>
                <span>
                  Structural preview projects catalog eligibility shifts only. Automatic A/B/C/D grade calculations remain strictly gated until scoring normalization curves receive Owner sign-off.
                </span>
              </div>

              {/* Simulation Stat Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 rounded border border-zinc-200 bg-zinc-50">
                  <span className="text-xs text-zinc-500 block">Eligible Products</span>
                  <div className="text-2xl font-bold text-zinc-900 mt-1">
                    {previewResult.eligibleSkusCount}
                  </div>
                  <span className="text-xs text-zinc-500">
                    Delta:{" "}
                    <strong
                      className={
                        previewResult.activePolicyComparison.eligibleSkusDelta > 0
                          ? "text-emerald-600"
                          : previewResult.activePolicyComparison.eligibleSkusDelta < 0
                          ? "text-rose-600"
                          : "text-zinc-600"
                      }
                    >
                      {previewResult.activePolicyComparison.eligibleSkusDelta >= 0 ? "+" : ""}
                      {previewResult.activePolicyComparison.eligibleSkusDelta}
                    </strong>
                  </span>
                </div>

                <div className="p-3 rounded border border-zinc-200 bg-zinc-50">
                  <span className="text-xs text-zinc-500 block">NEW Products (&lt; Min Days)</span>
                  <div className="text-2xl font-bold text-zinc-900 mt-1">
                    {previewResult.newSkusCount}
                  </div>
                  <span className="text-xs text-zinc-500">
                    Delta:{" "}
                    <strong>
                      {previewResult.activePolicyComparison.newSkusDelta >= 0 ? "+" : ""}
                      {previewResult.activePolicyComparison.newSkusDelta}
                    </strong>
                  </span>
                </div>

                <div className="p-3 rounded border border-zinc-200 bg-zinc-50">
                  <span className="text-xs text-zinc-500 block">NOT RATED Products</span>
                  <div className="text-2xl font-bold text-zinc-900 mt-1">
                    {previewResult.notRatedSkusCount}
                  </div>
                  <span className="text-xs text-zinc-500">
                    Delta:{" "}
                    <strong>
                      {previewResult.activePolicyComparison.notRatedSkusDelta >= 0 ? "+" : ""}
                      {previewResult.activePolicyComparison.notRatedSkusDelta}
                    </strong>
                  </span>
                </div>

                <div className="p-3 rounded border border-zinc-200 bg-zinc-50">
                  <span className="text-xs text-zinc-500 block">Missing Historical Cost</span>
                  <div className="text-2xl font-bold text-zinc-900 mt-1">
                    {previewResult.missingCostSkusCount}
                  </div>
                  <span className="text-xs text-zinc-400">Strict N/A applied</span>
                </div>
              </div>

              {/* Sample Impact Table */}
              <div className="mt-4">
                <h4 className="text-xs font-bold text-zinc-700 uppercase mb-2">
                  Sample Evaluated Products (Status Shift Comparison)
                </h4>
                <div className="overflow-x-auto border border-zinc-200 rounded-md">
                  <table className="min-w-full text-xs text-left divide-y divide-zinc-200">
                    <thead className="bg-zinc-100 text-zinc-600 font-semibold">
                      <tr>
                        <th className="px-3 py-2">SKU</th>
                        <th className="px-3 py-2">Product Name</th>
                        <th className="px-3 py-2">Brand</th>
                        <th className="px-3 py-2 text-right">Operating Days</th>
                        <th className="px-3 py-2 text-right">Orders</th>
                        <th className="px-3 py-2 text-right">Stores</th>
                        <th className="px-3 py-2 text-center">Cost Avail</th>
                        <th className="px-3 py-2">Current Status</th>
                        <th className="px-3 py-2">Projected Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 bg-white">
                      {previewResult.sampleItems.map((item) => (
                        <tr
                          key={item.productId}
                          className={item.isStatusChanged ? "bg-amber-50/50" : ""}
                        >
                          <td className="px-3 py-2 font-mono font-medium text-zinc-900">{item.sku}</td>
                          <td className="px-3 py-2 font-medium text-zinc-800">{item.name}</td>
                          <td className="px-3 py-2 text-zinc-500">{item.brandName}</td>
                          <td className="px-3 py-2 text-right text-zinc-700">{item.operatingHistoryDays} d</td>
                          <td className="px-3 py-2 text-right text-zinc-700">{item.completedOrdersCount}</td>
                          <td className="px-3 py-2 text-right text-zinc-700">{item.distinctStoresCount}</td>
                          <td className="px-3 py-2 text-center">
                            {item.hasHistoricalCost ? (
                              <span className="text-emerald-600 font-bold">✓</span>
                            ) : (
                              <span className="text-rose-500 font-bold">✕</span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                                item.currentStatus === "GRADED"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : item.currentStatus === "NEW"
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-zinc-100 text-zinc-700"
                              }`}
                            >
                              {item.currentStatus}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                                item.projectedStatus === "GRADED"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : item.projectedStatus === "NEW"
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-zinc-100 text-zinc-700"
                              }`}
                            >
                              {item.projectedStatus}
                            </span>
                            {item.isStatusChanged && (
                              <span className="ml-1 text-[10px] text-amber-700 font-bold">
                                (Shift)
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: VERSION HISTORY & AUDIT LOG */}
      {activeTab === "history" && (
        <div className="space-y-6">
          {/* Policy Versions Table */}
          <div className="bg-white border border-zinc-200 rounded-lg p-6 shadow-sm">
            <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider mb-4">
              All Policy Versions
            </h3>
            <div className="overflow-x-auto border border-zinc-200 rounded-md">
              <table className="min-w-full text-xs text-left divide-y divide-zinc-200">
                <thead className="bg-zinc-100 text-zinc-600 font-semibold">
                  <tr>
                    <th className="px-4 py-2.5">Version</th>
                    <th className="px-4 py-2.5">Title</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5">Effective Dates</th>
                    <th className="px-4 py-2.5">Published By</th>
                    <th className="px-4 py-2.5">Change Summary</th>
                    <th className="px-4 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 bg-white">
                  {policies.map((p) => (
                    <tr key={p.id}>
                      <td className="px-4 py-3 font-mono font-bold text-zinc-900">{p.version}</td>
                      <td className="px-4 py-3 font-medium text-zinc-800">{p.draftTitle}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                            p.status === "published" && p.isActive
                              ? "bg-emerald-100 text-emerald-800"
                              : p.status === "superseded"
                              ? "bg-zinc-100 text-zinc-600"
                              : p.status === "draft"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-zinc-100 text-zinc-500"
                          }`}
                        >
                          {p.status === "published" && p.isActive ? "Active" : p.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-zinc-600">
                        {p.effectiveFrom
                          ? new Date(p.effectiveFrom).toLocaleDateString()
                          : "2026-03-01"}
                        {p.effectiveTo && ` ~ ${new Date(p.effectiveTo).toLocaleDateString()}`}
                      </td>
                      <td className="px-4 py-3 text-zinc-600">{p.publishedBy || "Owner"}</td>
                      <td className="px-4 py-3 text-zinc-500 max-w-xs truncate">
                        {p.changeSummary || "-"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {p.status === "superseded" && (
                          <button
                            type="button"
                            onClick={() => {
                              setRollbackTarget(p);
                              setRollbackReason(`Rollback requested by Owner (${actorContext.email})`);
                              setShowRollbackModal(true);
                            }}
                            disabled={!actorContext.isOwner || !isSchemaReady || isPending}
                            title={
                              !actorContext.isOwner
                                ? "Rollback is restricted to Owner (Super Admin)."
                                : !isSchemaReady
                                ? "Schema migration 0182 pending"
                                : ""
                            }
                            className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded text-blue-700 bg-blue-50 hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Rollback
                          </button>
                        )}
                        {p.status === "draft" && (
                          <button
                            type="button"
                            onClick={() => {
                              handleSelectDraft(p.id);
                              setActiveTab("draft");
                            }}
                            className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded text-zinc-700 bg-zinc-100 hover:bg-zinc-200"
                          >
                            Edit Draft
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Audit Log Table */}
          <div className="bg-white border border-zinc-200 rounded-lg p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">
                  Immutable Policy Audit Log
                </h3>
                <p className="text-xs text-zinc-500">
                  Tracks all administrative draft revisions, publishing actions, and rollbacks.
                </p>
              </div>
              <span className="text-xs text-zinc-500">{auditLogs.length} Records</span>
            </div>

            {auditLogs.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-500 border border-zinc-200 rounded-md">
                No policy audit records logged yet.
              </div>
            ) : (
              <div className="overflow-x-auto border border-zinc-200 rounded-md">
                <table className="min-w-full text-xs text-left divide-y divide-zinc-200">
                  <thead className="bg-zinc-100 text-zinc-600 font-semibold">
                    <tr>
                      <th className="px-4 py-2">Timestamp</th>
                      <th className="px-4 py-2">Action</th>
                      <th className="px-4 py-2">Actor</th>
                      <th className="px-4 py-2">Change Reason / Summary</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 bg-white">
                    {auditLogs.map((log) => (
                      <tr key={log.id}>
                        <td className="px-4 py-2.5 text-zinc-500 font-mono">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                        <td className="px-4 py-2.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                              log.action === "publish"
                                ? "bg-emerald-100 text-emerald-800"
                                : log.action === "rollback"
                                ? "bg-purple-100 text-purple-800"
                                : log.action === "discard_draft"
                                ? "bg-rose-100 text-rose-800"
                                : "bg-blue-100 text-blue-800"
                            }`}
                          >
                            {log.action}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 font-medium text-zinc-800">
                          {log.actorEmail || log.actorId || "System"}
                        </td>
                        <td className="px-4 py-2.5 text-zinc-600">{log.changeReason || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. Publish Confirmation Modal */}
      {showPublishModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-zinc-900">
              Publish Product Performance Policy
            </h3>
            <p className="text-xs text-zinc-600">
              You are about to activate this policy as the canonical evaluation standard across all products in K SELECT Network. The currently active policy will be superseded.
            </p>

            <div>
              <label className="text-xs font-semibold text-zinc-700 block mb-1">
                Change Summary / Reason (Required) *
              </label>
              <textarea
                value={publishReason}
                onChange={(e) => setPublishReason(e.target.value)}
                rows={3}
                className="w-full border border-zinc-300 rounded p-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Describe what changed and why (e.g. Adjusted exchange risk threshold for Q2)..."
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowPublishModal(false)}
                className="px-3 py-1.5 border border-zinc-300 rounded text-xs text-zinc-700 hover:bg-zinc-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmPublish}
                disabled={!publishReason.trim() || isPending}
                className="px-4 py-1.5 rounded text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
              >
                {isPending ? "Publishing..." : "Confirm & Activate"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Rollback Confirmation Modal */}
      {showRollbackModal && rollbackTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-zinc-900">
              Rollback to Policy {rollbackTarget.version}
            </h3>
            <p className="text-xs text-zinc-600">
              Rollback creates a <strong>new published version</strong> referencing the configuration of{" "}
              <strong>{rollbackTarget.version}</strong>. Historical evaluations and audit entries are preserved intact.
            </p>

            <div>
              <label className="text-xs font-semibold text-zinc-700 block mb-1">
                Rollback Reason *
              </label>
              <textarea
                value={rollbackReason}
                onChange={(e) => setRollbackReason(e.target.value)}
                rows={3}
                className="w-full border border-zinc-300 rounded p-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowRollbackModal(false)}
                className="px-3 py-1.5 border border-zinc-300 rounded text-xs text-zinc-700 hover:bg-zinc-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRollback}
                disabled={!rollbackReason.trim() || isPending}
                className="px-4 py-1.5 rounded text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
              >
                {isPending ? "Rolling back..." : "Confirm Rollback"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
