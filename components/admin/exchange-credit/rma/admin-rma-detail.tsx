"use client";

import React, { useState } from "react";
import type { AdminRmaDetailProps } from "./admin-rma-types";
import { RMA_STATUS_UI_CONFIG } from "./admin-rma-types";
import { AdminRmaBoxes } from "./admin-rma-boxes";
import { AdminRmaExceptions } from "./admin-rma-exceptions";
import { AdminRmaInspectionModal } from "./admin-rma-inspection-modal";
import { calculateShippingDeadline } from "@/lib/retailer/rma";

export function AdminRmaDetail({
  rma,
  onBack,
  onOpenInspection,
  onApproveRma,
  onAddBox,
  onSaveInspectionDraft,
  onCompleteInspection,
  onResolveException,
}: AdminRmaDetailProps) {
  const [showInspectionModal, setShowInspectionModal] = useState(false);

  const statusConfig = RMA_STATUS_UI_CONFIG[rma.status] || {
    label: rma.status,
    badgeClass: "bg-zinc-800 text-zinc-300 border-zinc-700",
    dotColor: "bg-zinc-400",
  };

  // Shipping deadline calculation
  const deadline = rma.approvalDate
    ? calculateShippingDeadline(rma.approvalDate)
    : null;

  // Compute product summary totals
  const totalRequestedUnits = rma.lines.reduce((acc, l) => acc + l.quantityRequested, 0);
  const totalAuthorizedUnits = rma.lines.reduce((acc, l) => acc + l.quantityAuthorized, 0);
  const totalWholesaleValueCents = rma.lines.reduce(
    (acc, l) => acc + l.quantityAuthorized * l.frozenWholesalePriceCents,
    0
  );
  const totalWholesaleValueDollars = totalWholesaleValueCents / 100;

  // Compute settlement preview if inspected
  const acceptedUnits = rma.inspectionRecord?.totalAcceptedResaleable ?? 0;
  const settlementPreviewCents = rma.inspectionRecord
    ? rma.inspectionRecord.lines.reduce((acc, l) => {
        const originalLine = rma.lines.find((orig) => orig.id === l.lineId);
        return acc + l.quantityAcceptedResaleable * (originalLine?.frozenWholesalePriceCents ?? 0);
      }, 0)
    : 0;
  const settlementPreviewDollars = settlementPreviewCents / 100;

  return (
    <div className="space-y-6 w-full min-w-0">
      {/* 1. Header & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors flex items-center gap-1"
            >
              <span>←</span>
              <span>Back to Overview</span>
            </button>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <span>{rma.rmaNumber}</span>
              <span className="text-xs font-mono font-normal text-zinc-500">
                (Claim: {rma.claimNumber})
              </span>
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 text-xs text-zinc-400 pl-1">
            <span>Store: <strong className="text-zinc-200">{rma.storeId}</strong></span>
            <span>·</span>
            <span>Company: <strong className="text-zinc-200">{rma.companyId}</strong></span>
            <span>·</span>
            <span>Created: {new Date(rma.createdAt).toLocaleDateString()}</span>
          </div>
        </div>

        {/* Status Badge & Actions */}
        <div className="flex items-center gap-3">
          <div
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${statusConfig.badgeClass}`}
          >
            <span className={`w-2 h-2 rounded-full ${statusConfig.dotColor}`} />
            <span>{statusConfig.label}</span>
          </div>

          {rma.status === "awaiting_admin_approval" && (
            <button
              type="button"
              disabled
              title="Approval mutation disabled in Phase 3 (Components & Tests Only)"
              className="px-4 py-2 rounded-lg bg-cyan-600/50 text-white/60 text-xs font-semibold shadow-xs cursor-not-allowed"
            >
              Approve RMA (Preview)
            </button>
          )}
        </div>
      </div>

      {/* 2. Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/60 shadow-xs">
          <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
            Option B SKU Lines
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">{rma.lines.length}</span>
            <span className="text-xs text-zinc-500">lines</span>
          </div>
          <p className="mt-1 text-[11px] text-zinc-500">
            {totalRequestedUnits} units requested · {totalAuthorizedUnits} authorized
          </p>
        </div>

        <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/60 shadow-xs">
          <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
            Wholesale Value Baseline
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-cyan-400">
              ${totalWholesaleValueDollars.toFixed(2)}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-zinc-500">Frozen original wholesale price</p>
        </div>

        <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/60 shadow-xs">
          <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
            14-Day Return Deadline
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            {deadline ? (
              <span
                className={`text-2xl font-bold ${
                  deadline.isOverdue ? "text-rose-400" : "text-emerald-400"
                }`}
              >
                {deadline.deadlineDate}
              </span>
            ) : (
              <span className="text-sm font-semibold text-zinc-500">Pending Approval</span>
            )}
          </div>
          <p className="mt-1 text-[11px] text-zinc-500">
            {deadline
              ? deadline.isOverdue
                ? "Overdue (Requires Admin Exception Review)"
                : `${deadline.daysRemaining} calendar days remaining`
              : "Calculated upon RMA approval"}
          </p>
        </div>

        <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/60 shadow-xs">
          <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
            Settlement Credit Status
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            {rma.inspectionRecord ? (
              <span className="text-2xl font-bold text-teal-300">
                ${settlementPreviewDollars.toFixed(2)}
              </span>
            ) : (
              <span className="text-sm font-semibold text-zinc-500">Awaiting Inspection</span>
            )}
          </div>
          <p className="mt-1 text-[11px] text-zinc-500">
            {rma.inspectionRecord
              ? `${acceptedUnits} resaleable units accepted (100% rate)`
              : "0% credit prior to warehouse inspection"}
          </p>
        </div>
      </div>

      {/* 3. Section A: Claim & Product Summary */}
      <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/60 space-y-4 shadow-xs">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">
            Section A: Claim & Product Return Summary
          </h2>
          <span className="text-xs text-zinc-400">
            Store ID: <span className="font-mono text-zinc-200">{rma.storeId}</span>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-950/60 text-zinc-400 uppercase text-[10px] tracking-wider font-semibold">
                <th className="py-2.5 px-3">Product Name & SKU</th>
                <th className="py-2.5 px-3 text-center">Option</th>
                <th className="py-2.5 px-3 text-right">Requested Qty</th>
                <th className="py-2.5 px-3 text-right">Authorized Qty</th>
                <th className="py-2.5 px-3 text-right">Frozen Wholesale</th>
                <th className="py-2.5 px-3 text-right">Credit Rate</th>
                <th className="py-2.5 px-3 text-right">Estimated Credit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {rma.lines.map((line) => {
                const estCredit = (line.quantityAuthorized * line.frozenWholesalePriceCents) / 100;
                return (
                  <tr key={line.id} className="hover:bg-zinc-800/20">
                    <td className="py-3 px-3">
                      <div className="font-semibold text-zinc-100">{line.productName}</div>
                      <div className="font-mono text-[11px] text-cyan-400">{line.productSku}</div>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                        Option B
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-zinc-300">
                      {line.quantityRequested}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-white">
                      {line.quantityAuthorized}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-zinc-300">
                      ${line.frozenUnitWholesalePrice.toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-emerald-400 font-semibold">
                      100%
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-cyan-400">
                      ${estCredit.toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-zinc-800 bg-zinc-950/80 font-bold text-white">
                <td className="py-2.5 px-3">Total</td>
                <td className="py-2.5 px-3" />
                <td className="py-2.5 px-3 text-right font-mono">{totalRequestedUnits}</td>
                <td className="py-2.5 px-3 text-right font-mono">{totalAuthorizedUnits}</td>
                <td className="py-2.5 px-3" />
                <td className="py-2.5 px-3" />
                <td className="py-2.5 px-3 text-right font-mono text-cyan-400">
                  ${totalWholesaleValueDollars.toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* 4. Section B: Return Approval & 14-Day Timeline */}
      <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/60 space-y-4 shadow-xs">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">
            Section B: Return Approval & Timeline
          </h2>
          <span className="text-xs text-zinc-400">
            Timezone: <span className="font-mono text-zinc-200">America/New_York</span>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-3 rounded-lg bg-zinc-950/60 border border-zinc-800 space-y-1">
            <span className="text-[10px] text-zinc-500 uppercase font-semibold">Approval Date (Day 0)</span>
            <div className="font-mono font-bold text-white text-sm">
              {rma.approvalDate || "Pending Approval"}
            </div>
            <p className="text-[10px] text-zinc-500">Day 0 anchors the 14-calendar-day return window.</p>
          </div>

          <div className="p-3 rounded-lg bg-zinc-950/60 border border-zinc-800 space-y-1">
            <span className="text-[10px] text-zinc-500 uppercase font-semibold">
              Carrier Handoff Deadline (Day 14)
            </span>
            <div className="font-mono font-bold text-white text-sm">
              {rma.shippingDeadlineDate || "Pending Approval"}
            </div>
            <p className="text-[10px] text-zinc-500">
              Must be handed off to carrier on or before Day 14.
            </p>
          </div>

          <div className="p-3 rounded-lg bg-zinc-950/60 border border-zinc-800 space-y-1">
            <span className="text-[10px] text-zinc-500 uppercase font-semibold">Timeline Status</span>
            <div className="font-bold text-sm">
              {deadline ? (
                deadline.isOverdue ? (
                  <span className="text-rose-400">Overdue ({deadline.daysElapsed} days elapsed)</span>
                ) : (
                  <span className="text-emerald-400">On Track ({deadline.daysRemaining} days left)</span>
                )
              ) : (
                <span className="text-zinc-500">Awaiting Admin Approval</span>
              )}
            </div>
            <p className="text-[10px] text-zinc-500">
              Late scans are routed for Admin review; no automatic forfeiture.
            </p>
          </div>
        </div>
      </div>

      {/* 5. Section C: Return Boxes & Shipping Labels */}
      <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/60 space-y-4 shadow-xs">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider border-b border-zinc-800 pb-3">
          Section C: Shipping & Packing (One Prepaid Label per Box)
        </h2>
        <AdminRmaBoxes
          boxes={rma.boxes}
          lines={rma.lines}
          rmaNumber={rma.rmaNumber}
          isEditable={rma.status === "awaiting_admin_approval" || rma.status === "approved"}
          onAddBox={onAddBox}
        />
      </div>

      {/* 6. Section D: Warehouse Physical Inspection */}
      <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/60 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-3">
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Section D: Warehouse Physical Inspection
            </h2>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Inspect units upon receipt. Strict reconciliation of received, accepted resaleable, rejected, and missing units.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowInspectionModal(true)}
            className="px-3.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5 shrink-0"
          >
            <span>🔍</span>
            <span>
              {rma.inspectionRecord ? "View / Edit Inspection Form" : "Open Warehouse Inspection"}
            </span>
          </button>
        </div>

        {rma.inspectionRecord ? (
          <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800/80 pb-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-white">
                  Inspected By: {rma.inspectionRecord.inspectedBy.name} ({rma.inspectionRecord.inspectedBy.role})
                </span>
                <span className="text-zinc-500">·</span>
                <span className="text-zinc-400">
                  {new Date(rma.inspectionRecord.inspectedAt).toLocaleString()}
                </span>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-zinc-800 text-zinc-300">
                Box: {rma.inspectionRecord.boxCondition.toUpperCase()}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800/60">
                <div className="text-[10px] text-zinc-500 uppercase">Received</div>
                <div className="font-bold text-white text-sm">
                  {rma.inspectionRecord.totalReceived} units
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800/60">
                <div className="text-[10px] text-zinc-500 uppercase">Accepted Resaleable</div>
                <div className="font-bold text-emerald-400 text-sm">
                  {rma.inspectionRecord.totalAcceptedResaleable} units
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800/60">
                <div className="text-[10px] text-zinc-500 uppercase">Rejected Units</div>
                <div className="font-bold text-rose-400 text-sm">
                  {rma.inspectionRecord.totalRejected} units
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800/60">
                <div className="text-[10px] text-zinc-500 uppercase">Missing Units</div>
                <div className="font-bold text-amber-400 text-sm">
                  {rma.inspectionRecord.totalMissing} units
                </div>
              </div>
            </div>

            {rma.inspectionRecord.overallNotes && (
              <div className="text-xs text-zinc-400 italic bg-zinc-900/40 p-2.5 rounded-lg border border-zinc-800/40">
                &ldquo;{rma.inspectionRecord.overallNotes}&rdquo;
              </div>
            )}
          </div>
        ) : (
          <div className="p-6 rounded-xl bg-zinc-950/40 border border-zinc-800/80 text-center space-y-1.5">
            <span className="text-2xl">📋</span>
            <p className="text-xs font-semibold text-zinc-400">Warehouse inspection has not yet commenced.</p>
            <p className="text-[11px] text-zinc-500">
              When parcels arrive at the warehouse, staff will inspect resaleability and record physical counts.
            </p>
          </div>
        )}
      </div>

      {/* 7. Section E: Settlement Preview (Option B Credit) */}
      <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/60 space-y-4 shadow-xs">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider border-b border-zinc-800 pb-3">
          Section E: Option B Credit Settlement Contract
        </h2>

        <div className="p-4 rounded-xl bg-teal-950/20 border border-teal-500/30 text-teal-200 text-xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="font-bold text-teal-100 flex items-center gap-1.5">
              <span>💳</span>
              <span>Settlement-Ready Amount: ${settlementPreviewDollars.toFixed(2)}</span>
            </div>
            <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-teal-500/20 text-teal-300">
              100% Wholesale Rate
            </span>
          </div>

          <p className="text-[11px] text-teal-300/90 leading-relaxed">
            Option B Settlement Formula: Accepted Resaleable Units ({acceptedUnits}) × Original Frozen
            Wholesale Price × 100%. No credit is granted for rejected (damaged/unsealed/wrong SKU) or
            missing units.
          </p>

          <div className="p-2.5 rounded-lg bg-black/40 border border-white/5 text-[10px] text-zinc-400">
            ⚠️ <strong>Phase 3 Governance Notice:</strong> This view displays the proposed settlement
            instruction only. No credit ledger entry has been created and no credits have been redeemed
            or applied to Retailer Checkout. Actual credit issuance remains Phase 4.
          </div>
        </div>
      </div>

      {/* 8. Section F: Exceptions Panel (if any) */}
      {rma.exceptions && rma.exceptions.length > 0 && (
        <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/60 space-y-4 shadow-xs">
          <AdminRmaExceptions
            exceptions={rma.exceptions}
            onResolveException={onResolveException}
          />
        </div>
      )}

      {/* 9. Section G: Activity & Audit History */}
      <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/60 space-y-4 shadow-xs">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider border-b border-zinc-800 pb-3">
          Section G: Activity & Audit History ({rma.eventHistory.length})
        </h2>

        {rma.eventHistory.length === 0 ? (
          <p className="text-xs text-zinc-500">No activity events recorded yet.</p>
        ) : (
          <div className="divide-y divide-zinc-800/60 text-xs">
            {rma.eventHistory.map((evt) => (
              <div key={evt.id} className="py-2.5 flex items-start justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-zinc-200">{evt.eventType}</span>
                    <span className="text-[10px] text-zinc-500 font-mono">
                      ({evt.oldStatus || "none"} → {evt.newStatus})
                    </span>
                  </div>
                  {evt.reason && <p className="text-[11px] text-zinc-400">{evt.reason}</p>}
                </div>
                <div className="text-right text-[11px] text-zinc-500 shrink-0">
                  <div>{evt.actor.name || evt.actor.userId} ({evt.actor.role})</div>
                  <div>{new Date(evt.timestamp).toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Inspection Modal */}
      {showInspectionModal && (
        <AdminRmaInspectionModal
          isOpen={showInspectionModal}
          onClose={() => setShowInspectionModal(false)}
          rma={rma}
          existingRecord={rma.inspectionRecord}
          onSaveDraft={onSaveInspectionDraft}
          onCompleteInspection={onCompleteInspection}
        />
      )}
    </div>
  );
}
