"use client";

import React, { useState } from "react";
import type { AdminRmaExceptionsProps } from "./admin-rma-types";
import type { RmaException } from "@/lib/retailer/rma";

export function AdminRmaExceptions({ exceptions, onResolveException }: AdminRmaExceptionsProps) {
  const [selectedException, setSelectedException] = useState<RmaException | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState("");

  if (!exceptions || exceptions.length === 0) {
    return null;
  }

  const getSeverityStyle = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-rose-950/40 border-rose-500/50 text-rose-300";
      case "high":
        return "bg-rose-900/30 border-rose-500/30 text-rose-200";
      case "medium":
        return "bg-amber-950/40 border-amber-500/40 text-amber-200";
      case "low":
      default:
        return "bg-blue-950/40 border-blue-500/30 text-blue-200";
    }
  };

  const getPolicyCallout = (code: string) => {
    switch (code) {
      case "LATE_CARRIER_SCAN":
        return "Letusto Program Policy: Carrier scans occurring after Day 14 are held for Admin review. The retailer does not automatically forfeit Option B credit solely due to carrier scan latency.";
      case "CARRIER_LOST_PARCEL":
        return "Letusto Program Policy: For parcels lost in transit on Letusto prepaid return labels, Letusto files the carrier insurance claim. Retailer credit is NOT automatically denied.";
      case "WRONG_SKU_RETURNED":
        return "Warehouse Policy: Wrong SKU items returned are rejected (0% credit) and held for retailer return or disposal review.";
      case "DAMAGED_UNITS":
        return "Inspection Policy: Units rejected as non-resaleable/damaged receive $0.00 credit.";
      case "MULTIPLE_BOXES_SPLIT_DELIVERY":
        return "Logistics Notice: Some boxes have arrived at the warehouse while others remain in transit with the carrier.";
      default:
        return null;
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-base">⚠️</span>
        <h3 className="text-xs font-bold uppercase tracking-wider text-rose-300">
          RMA Exceptions & Review Alerts ({exceptions.length})
        </h3>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {exceptions.map((ex) => {
          const callout = getPolicyCallout(ex.code);
          return (
            <div
              key={ex.id}
              className={`p-4 rounded-xl border ${getSeverityStyle(ex.severity)} space-y-2.5 shadow-xs`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-black/40 border border-white/10">
                    {ex.code}
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300">
                    {ex.severity} severity
                  </span>
                  {ex.flagCarrierClaim && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                      Carrier Claim Eligible
                    </span>
                  )}
                </div>

                <div className="text-[11px] text-zinc-400">
                  Flagged: {new Date(ex.flaggedAt).toLocaleString()}
                </div>
              </div>

              <p className="text-xs text-zinc-100 font-medium leading-relaxed">
                {ex.description}
              </p>

              {callout && (
                <div className="p-2.5 rounded-lg bg-black/40 border border-white/5 text-[11px] text-zinc-300 flex items-start gap-2">
                  <span className="text-cyan-400 font-bold shrink-0">ℹ️</span>
                  <span>{callout}</span>
                </div>
              )}

              <div className="flex items-center justify-between pt-1 border-t border-white/10 text-xs">
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="text-zinc-400">Status:</span>
                  {ex.resolved ? (
                    <span className="text-emerald-400 font-semibold">Resolved</span>
                  ) : (
                    <span className="text-amber-400 font-semibold">Action Required (Admin Review)</span>
                  )}
                  {ex.resolutionNotes && (
                    <span className="text-zinc-400 italic">· {ex.resolutionNotes}</span>
                  )}
                </div>

                {!ex.resolved && (
                  <button
                    type="button"
                    onClick={() => setSelectedException(ex)}
                    className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold transition-colors"
                  >
                    Review & Resolve
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Exception Resolution Modal (Preview / Safe Phase 3) */}
      {selectedException && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-zinc-900 border border-zinc-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h4 className="text-sm font-bold text-white">
                Resolve RMA Exception: {selectedException.code}
              </h4>
              <button
                type="button"
                onClick={() => setSelectedException(null)}
                className="text-zinc-400 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>

            <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-300 space-y-1">
              <div className="font-semibold text-white">Exception Description:</div>
              <div>{selectedException.description}</div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-zinc-300">
                Admin Resolution Notes *
              </label>
              <textarea
                rows={3}
                placeholder="Document approval reason, carrier claim reference, or waiver justification..."
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300">
              Note: Database write actions are disabled until Phase 3 backend integration is connected.
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedException(null)}
                className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled
                title="Backend mutation disabled in Phase 3"
                className="px-3.5 py-1.5 rounded-lg bg-cyan-600/50 text-white/50 text-xs font-semibold cursor-not-allowed"
              >
                Save Resolution (Phase 3 Preview)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
