"use client";

import React, { useState } from "react";
import type { ProtectedSupplyCohort, ProtectedCohortStatus } from "@/lib/retailer/exchange-credit-types";
import { COHORT_STATUS_CONFIG } from "@/lib/retailer/exchange-credit-types";
import { associateSplitShipmentAction } from "@/lib/retailer/exchange-credit-actions";

interface CohortDetailViewProps {
  cohort: ProtectedSupplyCohort;
  onBack: () => void;
  isSchemaAvailable: boolean;
}

export function CohortDetailView({
  cohort,
  onBack,
  isSchemaAvailable,
}: CohortDetailViewProps) {
  const [showShipmentModal, setShowShipmentModal] = useState(false);
  const [fulfillmentIdInput, setFulfillmentIdInput] = useState("");
  const [qtyShippedInput, setQtyShippedInput] = useState("");
  const [carrierInput, setCarrierInput] = useState("FedEx");
  const [trackingInput, setTrackingInput] = useState("");
  const [notesInput, setNotesInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const statusConf = COHORT_STATUS_CONFIG[cohort.status as ProtectedCohortStatus] || {
    label: cohort.status,
    bg: "bg-zinc-800",
    text: "text-zinc-400",
    border: "border-zinc-700",
  };

  const handleOpenShipmentModal = () => {
    setFulfillmentIdInput("");
    setQtyShippedInput("");
    setTrackingInput("");
    setNotesInput("");
    setErrorMsg("");
    setShowShipmentModal(true);
  };

  const handleShipmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg("");

    try {
      const res = await associateSplitShipmentAction({
        cohortId: cohort.id,
        fulfillmentId: fulfillmentIdInput.trim(),
        quantityShipped: parseInt(qtyShippedInput, 10),
        carrier: carrierInput.trim(),
        trackingNumber: trackingInput.trim(),
        notes: notesInput.trim(),
      });

      if (!res.success) {
        setErrorMsg(res.error || "Failed to link split shipment.");
      } else {
        setShowShipmentModal(false);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setErrorMsg(message || "An unexpected error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Back Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold flex items-center gap-1 transition-colors"
          >
            <span>←</span>
            <span>Back</span>
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white font-mono">{cohort.cohortCode}</h2>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${statusConf.bg} ${statusConf.text} ${statusConf.border}`}
              >
                {statusConf.label}
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              {cohort.storeName} ({cohort.companyName}) · SKU: {cohort.productSku}
            </p>
          </div>
        </div>

        {isSchemaAvailable && (
          <button
            type="button"
            onClick={handleOpenShipmentModal}
            className="px-3.5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors shrink-0"
          >
            <span>+</span>
            <span>Link Split Shipment</span>
          </button>
        )}
      </div>

      {/* Disqualification Banner if Reordered */}
      {cohort.disqualificationReason && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-3">
          <span className="text-xl">⚠️</span>
          <div>
            <h4 className="font-bold text-rose-200">Disqualification Recorded</h4>
            <p className="mt-0.5 text-rose-300 leading-relaxed">{cohort.disqualificationReason}</p>
            {cohort.disqualifiedAt && (
              <p className="text-[11px] text-rose-400 mt-1">
                Disqualified on: {new Date(cohort.disqualifiedAt).toLocaleString()}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Grid: 2-Column Baseline & Split Shipments */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column: Frozen Baseline & Key Dates */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <span>🔒</span>
            <span>Frozen Policy & Supply Baseline</span>
          </h3>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-zinc-950/80 border border-zinc-800/80">
              <span className="text-zinc-500 text-[10px] uppercase font-semibold">Total Protected Qty</span>
              <div className="text-lg font-bold text-white mt-1">
                {cohort.fulfilledProtectedQuantity} / {cohort.totalProtectedQuantity}
                <span className="text-xs font-normal text-zinc-400 ml-1">units</span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-zinc-950/80 border border-zinc-800/80">
              <span className="text-zinc-500 text-[10px] uppercase font-semibold">Frozen Unit Wholesale</span>
              <div className="text-lg font-bold text-zinc-100 mt-1">
                ${cohort.frozenUnitWholesalePrice.toFixed(2)}
              </div>
            </div>

            <div className="p-3 rounded-lg bg-zinc-950/80 border border-zinc-800/80">
              <span className="text-zinc-500 text-[10px] uppercase font-semibold">Frozen Option A Rate</span>
              <div className="text-lg font-bold text-emerald-400 mt-1">
                {(cohort.frozenOptionARate * 100).toFixed(0)}%
              </div>
            </div>

            <div className="p-3 rounded-lg bg-zinc-950/80 border border-zinc-800/80">
              <span className="text-zinc-500 text-[10px] uppercase font-semibold">Source B2B Order</span>
              <div className="text-sm font-bold text-cyan-400 mt-1 truncate">
                {cohort.sourceOrderNumber}
              </div>
            </div>
          </div>

          <div className="border-t border-zinc-800 pt-3 space-y-2 text-xs">
            <div className="flex justify-between py-1">
              <span className="text-zinc-400">Protection Anchor Date:</span>
              <span className="font-semibold text-zinc-200">{cohort.protectionStartDate || "Awaiting Delivery"}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-zinc-400">Day 90 Trial End Date:</span>
              <span className="font-semibold text-zinc-200">{cohort.trialEndDate || "N/A"}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-zinc-400">Day 100 Eligibility Evaluation:</span>
              <span className="font-semibold text-indigo-400">{cohort.evaluationDate || "N/A"}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-zinc-400">Day 150 Claim Deadline:</span>
              <span className="font-semibold text-zinc-200">{cohort.claimDeadlineDate || "N/A"}</span>
            </div>
          </div>
        </div>

        {/* Right Column: Split Shipments Tracking */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span>🚚</span>
              <span>Authorized Split Shipments</span>
            </h3>
            <span className="text-xs text-zinc-400">
              {cohort.shipments?.length || 0} shipment(s)
            </span>
          </div>

          {!cohort.shipments || cohort.shipments.length === 0 ? (
            <div className="py-10 text-center text-zinc-500 text-xs">
              <p className="font-semibold text-zinc-400">No shipments associated yet.</p>
              <p className="mt-1">Link fulfillment numbers when warehouse dispatches orders.</p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
              {cohort.shipments.map((ship) => (
                <div
                  key={ship.id}
                  className="p-3 rounded-lg bg-zinc-950/80 border border-zinc-800 text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-cyan-400">
                      #{ship.shipmentSequence} · {ship.fulfillmentNumber}
                    </span>
                    <span className="font-semibold text-zinc-100">
                      {ship.quantityShipped} units shipped
                    </span>
                  </div>
                  <div className="text-[11px] text-zinc-400 flex items-center justify-between">
                    <span>Carrier: {ship.carrier || "N/A"}</span>
                    <span>Tracking: {ship.trackingNumber || "N/A"}</span>
                  </div>
                  <div className="text-[10px] text-zinc-500 flex items-center justify-between pt-1 border-t border-zinc-800/60">
                    <span>Shipped: {ship.shippedAt ? new Date(ship.shippedAt).toLocaleDateString() : "N/A"}</span>
                    <span>Delivered: {ship.deliveredAt ? new Date(ship.deliveredAt).toLocaleDateString() : "Pending"}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Link Split Shipment Modal */}
      {showShipmentModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-zinc-900 border border-zinc-800 p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white">Link Authorized Split Shipment</h3>
            <p className="text-[11px] text-zinc-400">
              Associate an order fulfillment to this cohort. The first shipment establishes Day 0.
            </p>
            {errorMsg && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                {errorMsg}
              </div>
            )}
            <form onSubmit={handleShipmentSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-zinc-400 font-semibold mb-1">Fulfillment UUID *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
                  value={fulfillmentIdInput}
                  onChange={(e) => setFulfillmentIdInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-white placeholder-zinc-600 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 font-semibold mb-1">Quantity Shipped *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    placeholder="e.g. 20"
                    value={qtyShippedInput}
                    onChange={(e) => setQtyShippedInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 font-semibold mb-1">Carrier</label>
                  <input
                    type="text"
                    value={carrierInput}
                    onChange={(e) => setCarrierInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-zinc-400 font-semibold mb-1">Tracking Number</label>
                <input
                  type="text"
                  placeholder="e.g. 982341234012"
                  value={trackingInput}
                  onChange={(e) => setTrackingInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-white placeholder-zinc-600 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-zinc-400 font-semibold mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={notesInput}
                  onChange={(e) => setNotesInput(e.target.value)}
                  placeholder="Split shipment details..."
                  className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-white placeholder-zinc-600 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowShipmentModal(false)}
                  className="px-3.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold transition-colors disabled:opacity-50"
                >
                  {submitting ? "Linking..." : "Link Shipment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
