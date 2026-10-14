// components/retailer/tracking-popover.tsx
"use client";

import React, { useState, useRef, useEffect } from "react";
import { formatCarrierName } from "@/lib/orders/carrier-resolver";

export interface TrackingBoxItem {
  id?: string;
  boxNumber: number;
  boxTotal: number;
  carrier: string;
  trackingNumber: string | null;
  trackingUrl: string | null;
  weightLbs?: number | null;
  dimensionsInch?: string | null;
}

export interface TrackingFulfillmentItem {
  id: string;
  fulfillmentNumber: string;
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  status: string;
  boxCount?: number;
  boxes?: TrackingBoxItem[];
}

export interface TrackingPackageItem {
  id: string;
  boxNumber: number;
  boxTotal: number;
  carrier: string;
  trackingNumber: string;
  trackingUrl: string | null;
}

interface TrackingPopoverProps {
  orderNumber: string;
  packages?: TrackingPackageItem[];
  fulfillments?: TrackingFulfillmentItem[];
  className?: string;
}

export function TrackingPopover({
  orderNumber,
  packages = [],
  fulfillments = [],
  className = "",
}: TrackingPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Group boxes by dispatch/fulfillment
  const dispatches: Array<{
    id: string;
    fulfillmentNumber: string;
    status: string;
    boxes: Array<{
      id: string;
      boxNumber: number;
      boxTotal: number;
      carrier: string;
      trackingNumber: string;
      trackingUrl: string | null;
      weightLbs?: number | null;
      dimensionsInch?: string | null;
    }>;
  }> = [];

  if (fulfillments && fulfillments.length > 0) {
    fulfillments.forEach((f) => {
      const fBoxes = (f.boxes || [])
        .filter((b) => Boolean(b.trackingNumber?.trim()))
        .map((b) => ({
          id: b.id || `box-${b.boxNumber}`,
          boxNumber: b.boxNumber,
          boxTotal: b.boxTotal || f.boxes?.length || 1,
          carrier: b.carrier || f.carrier || "Standard Freight",
          trackingNumber: b.trackingNumber!.trim(),
          trackingUrl: b.trackingUrl,
          weightLbs: b.weightLbs,
          dimensionsInch: b.dimensionsInch,
        }));

      if (fBoxes.length > 0) {
        dispatches.push({
          id: f.id,
          fulfillmentNumber: f.fulfillmentNumber,
          status: f.status,
          boxes: fBoxes,
        });
      } else if (f.trackingNumber?.trim()) {
        // Fallback for single legacy tracking
        dispatches.push({
          id: f.id,
          fulfillmentNumber: f.fulfillmentNumber,
          status: f.status,
          boxes: [
            {
              id: `legacy-${f.id}`,
              boxNumber: 1,
              boxTotal: 1,
              carrier: f.carrier || "Standard Freight",
              trackingNumber: f.trackingNumber.trim(),
              trackingUrl: f.trackingUrl,
            },
          ],
        });
      }
    });
  } else if (packages && packages.length > 0) {
    const validPkgs = packages
      .filter((p) => Boolean(p.trackingNumber?.trim()))
      .map((p) => ({
        id: p.id,
        boxNumber: p.boxNumber,
        boxTotal: p.boxTotal || packages.length,
        carrier: p.carrier,
        trackingNumber: p.trackingNumber.trim(),
        trackingUrl: p.trackingUrl,
      }));

    if (validPkgs.length > 0) {
      dispatches.push({
        id: "packages-dispatch",
        fulfillmentNumber: "Shipment",
        status: "shipped",
        boxes: validPkgs,
      });
    }
  }

  const totalBoxCount = dispatches.reduce((sum, d) => sum + d.boxes.length, 0);

  // Click outside to dismiss
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Escape key to dismiss
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  if (totalBoxCount === 0) {
    return (
      <span
        className="inline-flex items-center text-zinc-400 dark:text-zinc-500 text-xs font-semibold select-none"
        title="No Tracking Available"
      >
        —
      </span>
    );
  }

  const handleCopySingle = (track: string, key: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(track);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleCopyAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    const tracks: string[] = [];
    dispatches.forEach((d) => d.boxes.forEach((b) => tracks.push(b.trackingNumber)));
    navigator.clipboard.writeText(tracks.join("\n"));
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  return (
    <div ref={containerRef} className={`relative inline-block text-left ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold transition-all border shadow-2xs cursor-pointer whitespace-nowrap ${
          isOpen
            ? "bg-emerald-600 text-white border-emerald-600"
            : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/60 dark:text-emerald-300 dark:border-emerald-800/80"
        }`}
      >
        <span className="text-[10px]">📍</span>
        <span>Track ({totalBoxCount})</span>
        <span className="text-[8px] opacity-70">{isOpen ? "▲" : "▼"}</span>
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label="Tracking Information"
          className="absolute left-0 sm:right-0 sm:left-auto z-50 mt-1.5 w-84 sm:w-96 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-xl space-y-3 animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-zinc-900 dark:text-white">
                  Tracking Manifest
                </span>
                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  {totalBoxCount} {totalBoxCount === 1 ? "Box" : "Boxes"}
                </span>
              </div>
              <p className="text-[10px] text-zinc-400 mt-0.5">Order #{orderNumber}</p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleCopyAll}
                className="text-[10px] font-semibold text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded cursor-pointer transition-colors"
              >
                {copiedAll ? "✓ Copied All" : "Copy All"}
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Grouped by Dispatch */}
          <div className="max-h-72 overflow-y-auto space-y-3 pr-0.5">
            {dispatches.map((d, dIdx) => (
              <div key={d.id || `dispatch-${dIdx}`} className="space-y-1.5">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-black text-zinc-800 dark:text-zinc-200">
                      🚚 Dispatch #{d.fulfillmentNumber}
                    </span>
                    <span className="px-1.5 py-0.2 text-[9px] uppercase font-bold rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                      {d.status}
                    </span>
                  </div>
                  <span className="text-[10px] text-zinc-400">
                    {d.boxes.length} {d.boxes.length === 1 ? "Carton" : "Cartons"}
                  </span>
                </div>

                <div className="space-y-1.5">
                  {d.boxes.map((box, bIdx) => {
                    const boxKey = `${d.id}-b-${bIdx}`;
                    return (
                      <div
                        key={box.id || boxKey}
                        className="flex items-center justify-between p-2 rounded-xl border border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/60 dark:bg-zinc-800/40 text-xs"
                      >
                        <div className="space-y-0.5 min-w-0 pr-2">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-zinc-900 dark:text-white text-[11px]">
                              📦 Box {box.boxNumber} of {box.boxTotal || d.boxes.length}
                            </span>
                            <span className="text-[10px] font-semibold text-zinc-500 uppercase">
                              · {formatCarrierName(box.carrier)}
                            </span>
                          </div>
                          <div className="font-mono text-[11px] text-zinc-700 dark:text-zinc-300 truncate">
                            {box.trackingNumber}
                          </div>
                          {(box.weightLbs || box.dimensionsInch) && (
                            <div className="text-[10px] text-zinc-400">
                              {box.weightLbs ? `${box.weightLbs} lbs` : ""}
                              {box.weightLbs && box.dimensionsInch ? " · " : ""}
                              {box.dimensionsInch ? box.dimensionsInch : ""}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => handleCopySingle(box.trackingNumber, boxKey, e)}
                            className="px-2 py-1 text-[10px] font-semibold rounded bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 cursor-pointer transition-colors"
                          >
                            {copiedKey === boxKey ? "✓" : "Copy"}
                          </button>
                          {box.trackingUrl && (
                            <a
                              href={box.trackingUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="px-2 py-1 text-[10px] font-bold rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900 border border-indigo-200 dark:border-indigo-800 inline-flex items-center gap-0.5 transition-colors"
                            >
                              <span>Track</span>
                              <span className="text-[9px]">↗</span>
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
