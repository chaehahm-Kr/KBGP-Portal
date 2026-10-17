"use client";

import React from "react";
import Link from "next/link";
import type { StorePerformanceRecord } from "@/lib/retailer/sales-performance";

interface StoreDetailDrawerProps {
  store: StorePerformanceRecord | null;
  isOpen: boolean;
  onClose: () => void;
}

export function StoreDetailDrawer({ store, isOpen, onClose }: StoreDetailDrawerProps) {
  if (!isOpen || !store) return null;

  const { sales, compliance, followUp, recommendedPrograms } = store;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-xs flex justify-end animate-fadeIn">
      {/* Drawer Panel: Desktop ~520px, Mobile full-screen */}
      <div className="w-full sm:w-[520px] h-full bg-zinc-900 border-l border-zinc-800 shadow-2xl flex flex-col overflow-hidden animate-slideInRight">
        {/* 1. Drawer Header */}
        <div className="p-5 border-b border-zinc-800 flex items-start justify-between gap-4 bg-zinc-950/80">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white tracking-tight">{store.storeName}</h2>
              {store.evaluationStatus === "new" ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  New Store
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-800 text-zinc-400 border border-zinc-700">
                  Not Rated
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              {store.companyName} {store.companyCode ? `(${store.companyCode})` : ""} · {store.city || "Unknown City"}, {store.state || "State"}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            title="Close drawer"
          >
            ✕
          </button>
        </div>

        {/* 2. Drawer Body (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 text-xs text-zinc-300">
          {/* Section A: Store Summary */}
          <div className="space-y-2.5">
            <h3 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">A. Store Summary</h3>
            <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-zinc-950/50 border border-zinc-800">
              <div>
                <span className="text-zinc-500 text-[10px] block">First Actual Shipment</span>
                <span className="font-semibold text-white mt-0.5 block">
                  {sales.firstShipmentDate ? sales.firstShipmentDate.split("T")[0] : "No Shipments Yet"}
                </span>
              </div>
              <div>
                <span className="text-zinc-500 text-[10px] block">Store Age</span>
                <span className="font-semibold text-white mt-0.5 block">
                  {sales.storeAgeDays} days {sales.isNewStore ? "(Day 0-59 New Store)" : "(Mature Store)"}
                </span>
              </div>
              <div>
                <span className="text-zinc-500 text-[10px] block">Support Status</span>
                <span
                  className={`inline-block mt-0.5 px-2 py-0.5 rounded font-semibold text-[10px] ${
                    store.supportStatus === "action_required"
                      ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                      : store.supportStatus === "support_required"
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                      : store.supportStatus === "monitor"
                      ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                      : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  }`}
                >
                  {store.supportStatus.replace("_", " ").toUpperCase()}
                </span>
              </div>
              <div>
                <span className="text-zinc-500 text-[10px] block">Data Confidence</span>
                <span className="font-semibold text-zinc-200 mt-0.5 block capitalize">
                  {store.dataConfidence}
                </span>
              </div>
            </div>
          </div>

          {/* Section B: Sales & Reorders */}
          <div className="space-y-2.5">
            <h3 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">B. B2B Sales & Reorders (Current 60D)</h3>
            <div className="grid grid-cols-3 gap-2.5 p-3.5 rounded-xl bg-zinc-950/50 border border-zinc-800">
              <div>
                <span className="text-zinc-500 text-[10px] block">Net Product Sales</span>
                <span className="text-sm font-bold text-cyan-400 mt-0.5 block">
                  ${sales.currentNetSalesDollars.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-[10px] text-zinc-500">
                  prev: ${sales.previousNetSalesDollars.toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-zinc-500 text-[10px] block">Sales Growth</span>
                <span className="text-sm font-bold text-white mt-0.5 block">
                  {sales.salesGrowthLabel}
                </span>
                <span className="text-[10px] text-zinc-500">vs prev 60D</span>
              </div>
              <div>
                <span className="text-zinc-500 text-[10px] block">Confirmed Reorders</span>
                <span className="text-sm font-bold text-emerald-400 mt-0.5 block">
                  {sales.confirmedReordersCount}
                </span>
                <span className="text-[10px] text-zinc-500">total: {sales.currentValidOrdersCount} orders</span>
              </div>
            </div>
          </div>

          {/* Section C: Partnership Compliance */}
          <div className="space-y-2.5">
            <h3 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">C. Partnership Compliance Obligations</h3>
            <div className="space-y-2">
              {/* 1. Display Compliance */}
              <div className="p-3 rounded-xl bg-zinc-950/40 border border-zinc-800 flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-zinc-200">1. Display Fixture Compliance</div>
                  <div className="text-[11px] text-zinc-500 mt-0.5">
                    {compliance.display.fixturesCount} fixture(s) · {compliance.display.placementsCount} active shelf placement(s)
                  </div>
                  <div className="text-[10px] text-zinc-400 mt-1 italic">
                    Evidence: {compliance.display.evidenceNotes || "Awaiting physical inspection"}
                  </div>
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold shrink-0 ${
                    compliance.display.status === "compliant"
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      : compliance.display.status === "violation"
                      ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                      : "bg-zinc-800 text-zinc-400 border border-zinc-700"
                  }`}
                >
                  {compliance.display.status === "not_verified" ? "Not Verified" : compliance.display.status.toUpperCase()}
                </span>
              </div>

              {/* 2. Weekly Inventory */}
              <div className="p-3 rounded-xl bg-zinc-950/40 border border-zinc-800 flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-zinc-200">2. Weekly Inventory Reports</div>
                  <div className="text-[11px] text-zinc-500 mt-0.5">
                    Submitted: {compliance.weeklyInventory.submittedWeeksCount} of {compliance.weeklyInventory.eligibleWeeksCount} eligible weeks
                    ({compliance.weeklyInventory.reportingCoveragePercent ?? 0}%) · {compliance.weeklyInventory.missedWeeksCount} missed
                  </div>
                  <div className="text-[10px] text-zinc-400 mt-1">
                    Last submitted: {compliance.weeklyInventory.lastSubmittedDate || "Never"} {compliance.weeklyInventory.latestReportingWeek ? `(${compliance.weeklyInventory.latestReportingWeek})` : ""}
                  </div>
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold shrink-0 ${
                    compliance.weeklyInventory.status === "compliant"
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      : compliance.weeklyInventory.status === "partial"
                      ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                      : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                  }`}
                >
                  {compliance.weeklyInventory.status.toUpperCase()}
                </span>
              </div>

              {/* 3. Product Training */}
              <div className="p-3 rounded-xl bg-zinc-950/40 border border-zinc-800 flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-zinc-200">3. Product Training Compliance</div>
                  <div className="text-[11px] text-zinc-500 mt-0.5">
                    Covered: {compliance.productTraining.coveredProductsCount} / {compliance.productTraining.purchasedProductsCount} purchased SKUs
                    {compliance.productTraining.coveragePercent !== null ? ` (${compliance.productTraining.coveragePercent}%)` : ""} · {compliance.productTraining.trainingGapsCount} gap(s)
                  </div>
                  <div className="text-[10px] text-zinc-400 mt-1">
                    Store staff: {compliance.productTraining.assignedStaffCount} assigned · {compliance.productTraining.qualifiedStaffCount} trained
                  </div>
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold shrink-0 ${
                    compliance.productTraining.status === "compliant"
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      : compliance.productTraining.status === "partial"
                      ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                      : compliance.productTraining.status === "non_compliant"
                      ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                      : "bg-zinc-800 text-zinc-400 border border-zinc-700"
                  }`}
                >
                  {compliance.productTraining.status === "not_verified" ? "Not Verified" : compliance.productTraining.status.toUpperCase()}
                </span>
              </div>
            </div>
          </div>

          {/* Section D: HQ Engagement & Follow-up Status */}
          <div className="space-y-2.5">
            <h3 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
              D. HQ Engagement & Follow-up Status
            </h3>
            <div className="p-3.5 rounded-xl bg-zinc-950/50 border border-zinc-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">Follow-up Status:</span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    followUp.status === "action_required"
                      ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                      : followUp.status === "attention"
                      ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                      : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  }`}
                >
                  {followUp.status.replace("_", " ").toUpperCase()}
                </span>
              </div>

              <div className="text-[11px] text-zinc-400">
                Total activities logged: <strong>{followUp.totalActivitiesCount}</strong>
                {followUp.lastActivityDate && (
                  <span> · Last contact: {followUp.lastActivityDate} by {followUp.lastResponsibleAdmin || "HQ Staff"}</span>
                )}
              </div>

              {followUp.isFollowUpOverdue && (
                <div className="p-2 rounded-lg bg-rose-950/30 border border-rose-800/40 text-rose-300 text-[11px]">
                  ⚠️ <strong>Overdue Follow-up:</strong> Scheduled task for {followUp.nextFollowUpDate} is overdue by {followUp.overdueDays} days.
                </div>
              )}
            </div>
          </div>

          {/* Section E: Diagnosed Support Recommendations */}
          <div className="space-y-2.5">
            <h3 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
              E. Diagnosed Support Recommendations
            </h3>
            {recommendedPrograms.length === 0 ? (
              <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-800/30 text-emerald-300 text-xs">
                ✅ <strong>No Urgent Support Action Required:</strong> Store is meeting active performance and compliance targets.
              </div>
            ) : (
              <div className="space-y-2.5">
                {recommendedPrograms.map((prog, idx) => (
                  <div key={idx} className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1.5 shadow-xs">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-bold text-white text-xs">{prog.title}</div>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                          prog.priority === "high"
                            ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                            : prog.priority === "medium"
                            ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                            : "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                        }`}
                      >
                        {prog.priority} priority
                      </span>
                    </div>

                    <p className="text-zinc-400 text-[11px] leading-relaxed">
                      {prog.reason}
                    </p>

                    <div className="p-2 rounded bg-zinc-900 border border-zinc-800/60 text-[10px] text-zinc-300">
                      <strong>Action Recommendation:</strong> {prog.suggestedAction}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section F: Administrative Deep Dive Links */}
          <div className="space-y-2.5">
            <h3 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
              F. Administrative Deep Dive Links
            </h3>
            <div className="p-3.5 rounded-xl bg-zinc-950/50 border border-zinc-800 flex items-center justify-between gap-3">
              <div>
                <span className="font-semibold text-white block">Store Operations Integration</span>
                <span className="text-[11px] text-zinc-400">View tasks, orders, staff activities, and history for this store</span>
              </div>
              <Link
                href={`/admin/store-operations?storeId=${store.storeId}`}
                className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-cyan-400 border border-zinc-700 text-xs font-semibold flex items-center gap-1 shrink-0"
              >
                <span>Store Ops</span>
                <span>→</span>
              </Link>
            </div>
          </div>
        </div>

        {/* 3. Drawer Footer: Link to Store Operations */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-950 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
          >
            Close
          </button>

          <Link
            href={`/admin/store-operations?storeId=${store.storeId}`}
            className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-md transition-all active:scale-98 flex items-center gap-1.5"
          >
            <span>Open Store Operations</span>
            <span>→</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
