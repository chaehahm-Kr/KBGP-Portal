"use client";

import React, { useState, useRef, useEffect } from "react";
import { formatCarrierName } from "@/lib/orders/carrier-resolver";

interface TrackingPackage {
  id: string;
  boxNumber: number;
  boxTotal: number;
  carrier: string;
  trackingNumber: string;
  trackingUrl: string | null;
}

interface TrackingFulfillment {
  id: string;
  fulfillmentNumber: string;
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  status: string;
  boxCount?: number;
}

interface TrackingPopoverProps {
  orderNumber: string;
  packages?: TrackingPackage[];
  fulfillments?: TrackingFulfillment[];
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

  // Check tracking availability
  const validPackages = (packages || []).filter((p) => Boolean(p.trackingNumber?.trim()));
  const validFulfillments = (fulfillments || []).filter((f) => Boolean(f.trackingNumber?.trim()));
  const hasTracking = validPackages.length > 0 || validFulfillments.length > 0;

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

  if (!hasTracking) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60 whitespace-nowrap">
        Not Available
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
    if (validPackages.length > 0) {
      validPackages.forEach((p) => tracks.push(p.trackingNumber));
    } else {
      validFulfillments.forEach((f) => f.trackingNumber && tracks.push(f.trackingNumber));
    }
    navigator.clipboard.writeText(tracks.join("\n"));
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  return (
    <div ref={containerRef} className={`relative inline-block text-left ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all border shadow-2xs cursor-pointer ${
          isOpen
            ? "bg-emerald-600 text-white border-emerald-600"
            : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/60 dark:text-emerald-300 dark:border-emerald-800/80"
        }`}
      >
        <span className="text-[10px]">📍</span>
        <span>Available</span>
        <span className="text-[9px] opacity-70">{isOpen ? "▲" : "▼"}</span>
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
                {validPackages.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                    {validPackages.length} {validPackages.length === 1 ? "Box" : "Boxes"}
                  </span>
                )}
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

          {/* List of packages (B2 Package Architecture) */}
          {validPackages.length > 0 ? (
            <div className="max-h-60 overflow-y-auto space-y-2 pr-0.5">
              {validPackages.map((pkg, idx) => (
                <div
                  key={pkg.id || `pkg-${idx}`}
                  className="flex items-center justify-between p-2.5 rounded-xl border border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-800/40 text-xs"
                >
                  <div className="space-y-0.5 min-w-0 pr-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-zinc-900 dark:text-white text-[11px]">
                        📦 Box {pkg.boxNumber} of {pkg.boxTotal || validPackages.length}
                      </span>
                      <span className="text-[10px] font-semibold text-zinc-500 uppercase">
                        · {formatCarrierName(pkg.carrier)}
                      </span>
                    </div>
                    <div className="font-mono text-[11px] text-zinc-700 dark:text-zinc-300 truncate">
                      {pkg.trackingNumber}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => handleCopySingle(pkg.trackingNumber, `pkg-${idx}`, e)}
                      className="px-2 py-1 text-[10px] font-semibold rounded bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 cursor-pointer transition-colors"
                    >
                      {copiedKey === `pkg-${idx}` ? "✓" : "Copy"}
                    </button>
                    {pkg.trackingUrl && (
                      <a
                        href={pkg.trackingUrl}
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
              ))}
            </div>
          ) : (
            /* Legacy Dispatch Tracking (No carton package records, 1 Dispatch != 1 Box) */
            <div className="space-y-2">
              <div className="px-2 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 text-[10px] text-amber-800 dark:text-amber-300">
                <span className="font-bold">Legacy Dispatch Tracking</span> · Carton manifest not recorded for this shipment.
              </div>

              <div className="max-h-60 overflow-y-auto space-y-2 pr-0.5">
                {validFulfillments.map((ful, idx) => (
                  <div
                    key={ful.id || `ful-${idx}`}
                    className="flex items-center justify-between p-2.5 rounded-xl border border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-800/40 text-xs"
                  >
                    <div className="space-y-0.5 min-w-0 pr-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-zinc-900 dark:text-white text-[11px]">
                          🚚 Dispatch: {ful.fulfillmentNumber}
                        </span>
                        {ful.carrier && (
                          <span className="text-[10px] font-semibold text-zinc-500 uppercase">
                            · {formatCarrierName(ful.carrier)}
                          </span>
                        )}
                      </div>
                      <div className="font-mono text-[11px] text-zinc-700 dark:text-zinc-300 truncate">
                        {ful.trackingNumber}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => handleCopySingle(ful.trackingNumber!, `ful-${idx}`, e)}
                        className="px-2 py-1 text-[10px] font-semibold rounded bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 cursor-pointer transition-colors"
                      >
                        {copiedKey === `ful-${idx}` ? "✓" : "Copy"}
                      </button>
                      {ful.trackingUrl && (
                        <a
                          href={ful.trackingUrl}
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
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
