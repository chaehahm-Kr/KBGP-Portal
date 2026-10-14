// components/admin/orders/order-tracking-modal.tsx
// Phase B6 / ADM-ORDER-PROCESSING-001-R2: Unified Multi-Dispatch & Carton Tracking Management
"use client";

import React, { useState, useEffect } from "react";
import {
  AdminOrderDispatchSummary,
  AdminOrderPackage,
} from "@/lib/admin/orders-types";
import { formatCarrierName } from "@/lib/orders/carrier-resolver";

interface OrderTrackingModalProps {
  orderNumber: string;
  dispatches: AdminOrderDispatchSummary[];
  packages: AdminOrderPackage[];
  isOpen: boolean;
  onClose: () => void;
  onEditDispatch: (dispatch: AdminOrderDispatchSummary) => void;
  initialFocusDispatchId?: string | null;
}

export function OrderTrackingModal({
  orderNumber,
  dispatches = [],
  packages = [],
  isOpen,
  onClose,
  onEditDispatch,
  initialFocusDispatchId = null,
}: OrderTrackingModalProps) {
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const totalBoxesCount = packages.length;
  const untrackedDispatches = dispatches.filter(
    (d) => d.status !== "cancelled" && !d.isTrackingComplete
  );
  const isOrderTrackingComplete = untrackedDispatches.length === 0;

  const handleCopySingle = (track: string, key: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(track);
    setCopiedIndex(key);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleCopyAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    const allTracks: string[] = [];
    dispatches.forEach((d) => {
      d.boxes
        .filter((b) => b.status === "active" && b.trackingNumber)
        .forEach((b) => allTracks.push(b.trackingNumber!));
      if (d.boxes.length === 0 && d.trackingNumber) {
        allTracks.push(d.trackingNumber);
      }
    });
    if (allTracks.length === 0) {
      packages
        .filter((p) => p.trackingNumber)
        .forEach((p) => allTracks.push(p.trackingNumber));
    }
    navigator.clipboard.writeText(Array.from(new Set(allTracks)).join("\n"));
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const handleDownloadCsv = (e: React.MouseEvent) => {
    e.stopPropagation();
    const rows = [
      [
        "Dispatch Number",
        "Box Number",
        "Total Boxes",
        "Carrier",
        "Tracking Number",
        "Tracking URL",
        "Weight (lbs)",
        "Dimensions",
      ],
    ];

    dispatches.forEach((d) => {
      const activeBoxes = d.boxes.filter((b) => b.status === "active");
      if (activeBoxes.length > 0) {
        activeBoxes.forEach((b) => {
          rows.push([
            d.fulfillmentNumber,
            String(b.boxNumber),
            String(b.boxTotal || activeBoxes.length),
            b.carrier || d.carrier || "",
            b.trackingNumber || "",
            b.trackingUrl || "",
            b.weightLbs ? String(b.weightLbs) : "",
            b.dimensionsInch || "",
          ]);
        });
      } else if (d.trackingNumber) {
        rows.push([
          d.fulfillmentNumber,
          "1",
          "1",
          d.carrier || "",
          d.trackingNumber,
          d.trackingUrl || "",
          "",
          "",
        ]);
      }
    });

    const csvContent =
      "data:text/csv;charset=utf-8," + rows.map((e) => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Order_${orderNumber}_cartons_manifest.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative w-full max-w-2xl rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl p-6 sm:p-7 space-y-5 max-h-[90vh] overflow-y-auto z-10">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="text-xl">📦</span>
              <h2 className="text-lg font-black text-zinc-900 dark:text-white tracking-tight">
                Shipment Tracking & Carton Manifest
              </h2>
              {isOrderTrackingComplete ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                  ✓ All Tracked
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                  ⚠️ {untrackedDispatches.length}{" "}
                  {untrackedDispatches.length === 1 ? "Dispatch" : "Dispatches"} Incomplete
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-500 mt-1 font-mono">
              Order #{orderNumber} · {dispatches.length}{" "}
              {dispatches.length === 1 ? "Dispatch" : "Dispatches"} ·{" "}
              {totalBoxesCount} {totalBoxesCount === 1 ? "Carton" : "Cartons"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Dispatches List */}
        <div className="space-y-4">
          {dispatches.length === 0 ? (
            <div className="p-8 text-center rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 text-zinc-500 text-xs">
              No confirmed dispatches recorded for this order yet.
            </div>
          ) : (
            dispatches.map((disp, dispIdx) => {
              const activeBoxes = disp.boxes.filter((b) => b.status === "active");
              const isDispatchUntracked = !disp.isTrackingComplete;
              const isFocused =
                initialFocusDispatchId === disp.id ||
                (initialFocusDispatchId === "incomplete" && isDispatchUntracked);

              return (
                <div
                  key={disp.id}
                  className={`rounded-2xl border transition-all p-4 space-y-3 ${
                    isFocused
                      ? "border-amber-500/60 bg-amber-500/5 ring-2 ring-amber-500/20"
                      : isDispatchUntracked
                      ? "border-amber-400/40 bg-zinc-50/50 dark:bg-zinc-800/30"
                      : "border-zinc-200 dark:border-zinc-800 bg-zinc-50/40 dark:bg-zinc-800/20"
                  }`}
                >
                  {/* Dispatch Header */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200/60 dark:border-zinc-800/80 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-zinc-900 dark:text-white">
                        Dispatch #{dispIdx + 1}
                      </span>
                      <span className="font-mono text-[11px] px-2 py-0.5 rounded-md font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                        {disp.fulfillmentNumber}
                      </span>
                      <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300">
                        {disp.status}
                      </span>
                      {disp.carrier && (
                        <span className="text-[11px] text-zinc-500 font-medium">
                          via {formatCarrierName(disp.carrier)}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {isDispatchUntracked ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                          ⚠️ Tracking Required
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                          ✓ Complete
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => onEditDispatch(disp)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                          isDispatchUntracked
                            ? "bg-amber-600 hover:bg-amber-700 text-white shadow-2xs"
                            : "bg-white hover:bg-zinc-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700"
                        }`}
                      >
                        {isDispatchUntracked ? "+ Add Tracking" : "✏️ Edit Tracking"}
                      </button>
                    </div>
                  </div>

                  {/* Boxes under this Dispatch */}
                  {activeBoxes.length > 0 ? (
                    <div className="grid grid-cols-1 gap-2 pt-1">
                      {activeBoxes.map((box, bIdx) => {
                        const copyKey = `${disp.id}-${box.id || bIdx}`;
                        return (
                          <div
                            key={box.id || bIdx}
                            className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-zinc-800 dark:text-zinc-200 text-[11px]">
                                Box {box.boxNumber} of {box.boxTotal || activeBoxes.length}
                              </span>
                              <span className="text-[10px] font-semibold text-zinc-400 uppercase">
                                {formatCarrierName(box.carrier || disp.carrier || "ups")}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 font-mono text-[11px]">
                              {box.trackingNumber ? (
                                <>
                                  <span className="text-zinc-900 dark:text-zinc-100 font-semibold select-all">
                                    {box.trackingNumber}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) =>
                                      handleCopySingle(box.trackingNumber!, copyKey, e)
                                    }
                                    className="px-2 py-0.5 rounded text-[10px] font-semibold bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-700 dark:text-zinc-300 transition-colors"
                                  >
                                    {copiedIndex === copyKey ? "Copied!" : "Copy"}
                                  </button>
                                  {box.trackingUrl && (
                                    <a
                                      href={box.trackingUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white"
                                    >
                                      Track ↗
                                    </a>
                                  )}
                                </>
                              ) : (
                                <span className="text-amber-500 font-bold italic">
                                  No tracking entered
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : disp.trackingNumber ? (
                    // Legacy header tracking fallback
                    <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-zinc-800 dark:text-zinc-200 text-[11px]">
                          Carton 1 (Header Tracking)
                        </span>
                        <span className="text-[10px] font-semibold text-zinc-400 uppercase">
                          {formatCarrierName(disp.carrier || "ups")}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 font-mono text-[11px]">
                        <span className="text-zinc-900 dark:text-zinc-100 font-semibold select-all">
                          {disp.trackingNumber}
                        </span>
                        <button
                          type="button"
                          onClick={(e) =>
                            handleCopySingle(disp.trackingNumber!, disp.id, e)
                          }
                          className="px-2 py-0.5 rounded text-[10px] font-semibold bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-700 dark:text-zinc-300 transition-colors"
                        >
                          {copiedIndex === disp.id ? "Copied!" : "Copy"}
                        </button>
                        {disp.trackingUrl && (
                          <a
                            href={disp.trackingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white"
                          >
                            Track ↗
                          </a>
                        )}
                      </div>
                    </div>
                  ) : (
                    // Empty dispatch with no boxes registered
                    <div className="p-3 rounded-xl border border-dashed border-amber-300/80 dark:border-amber-700/50 bg-amber-50/50 dark:bg-amber-950/20 text-xs flex items-center justify-between">
                      <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
                        <span>⚠️</span>
                        <span>
                          No tracking number or boxes have been registered for this dispatch.
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onEditDispatch(disp)}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-2xs transition-colors"
                      >
                        + Add Boxes & Tracking
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-800 text-xs">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleCopyAll}
              disabled={packages.length === 0}
              className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50"
            >
              {copiedAll ? "✓ All Copied" : "Copy All Numbers"}
            </button>
            <span className="text-zinc-300 dark:text-zinc-700">•</span>
            <button
              type="button"
              onClick={handleDownloadCsv}
              disabled={packages.length === 0}
              className="font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white disabled:opacity-50"
            >
              Export Manifest CSV 📄
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
