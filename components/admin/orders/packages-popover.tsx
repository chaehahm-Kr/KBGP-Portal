// components/admin/orders/packages-popover.tsx
"use client";

import React, { useState } from "react";
import { AdminOrderPackage } from "@/lib/admin/orders-types";
import { formatCarrierName } from "@/lib/orders/carrier-resolver";

interface PackagesPopoverProps {
  packages: AdminOrderPackage[];
  orderNumber: string;
  className?: string;
}

export function PackagesPopover({ packages, orderNumber, className = "" }: PackagesPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  if (!packages || packages.length === 0) {
    return (
      <span className="inline-flex items-center text-xs text-zinc-400 font-medium">
        — Awaiting
      </span>
    );
  }

  const handleCopySingle = (track: string, idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(track);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleCopyAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    const allTracks = packages.map((p) => p.trackingNumber).filter(Boolean).join("\n");
    navigator.clipboard.writeText(allTracks);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const handleDownloadCsv = (e: React.MouseEvent) => {
    e.stopPropagation();
    const rows = [
      ["Box Number", "Total Boxes", "Carrier", "Tracking Number", "Weight (lbs)", "Dimensions", "Tracking URL"],
      ...packages.map((p) => [
        p.boxNumber,
        p.boxTotal,
        p.carrier,
        p.trackingNumber,
        p.weightLbs || "",
        p.dimensionsInch || "",
        p.trackingUrl || "",
      ]),
    ];
    const csvContent = "data:text/csv;charset=utf-8," + rows.map((e) => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Order_${orderNumber}_cartons.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-colors border shadow-xs ${
          isOpen
            ? "bg-indigo-600 text-white border-indigo-600"
            : "bg-indigo-50/80 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border-indigo-200/80 dark:border-indigo-800"
        } ${className}`}
      >
        <span>📦</span>
        <span>
          {packages.length} {packages.length === 1 ? "Box" : "Boxes"}
        </span>
        <span className="text-[10px]">{isOpen ? "▲" : "▼"}</span>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 sm:left-0 z-50 mt-2 w-80 sm:w-96 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-xl space-y-3">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2">
              <div>
                <h4 className="text-xs font-bold text-zinc-900 dark:text-white">
                  Carton Tracking Manifest ({packages.length} {packages.length === 1 ? "Box" : "Boxes"})
                </h4>
                <p className="text-[10px] text-zinc-400">Order #{orderNumber}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xs font-bold px-1.5"
              >
                ✕
              </button>
            </div>

            {/* Scrollable List for Dozens of Cartons */}
            <div className="max-h-64 overflow-y-auto space-y-2 pr-1 text-xs">
              {packages.map((pkg, idx) => (
                <div
                  key={pkg.id || idx}
                  className="p-2.5 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-800/40 space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-zinc-800 dark:text-zinc-200 text-[11px]">
                      Carton {pkg.boxNumber} of {pkg.boxTotal || packages.length}
                    </span>
                    <span className="text-[10px] font-semibold text-zinc-500 uppercase">
                      {formatCarrierName(pkg.carrier)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 font-mono text-[11px]">
                    <span className="truncate text-zinc-700 dark:text-zinc-300">
                      {pkg.trackingNumber}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => handleCopySingle(pkg.trackingNumber, idx, e)}
                        className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 text-zinc-700 dark:text-zinc-200"
                        title="Copy Tracking Number"
                      >
                        {copiedIndex === idx ? "Copied!" : "Copy"}
                      </button>
                      {pkg.trackingUrl && (
                        <a
                          href={pkg.trackingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white"
                        >
                          Track ↗
                        </a>
                      )}
                    </div>
                  </div>

                  {pkg.packageItems && pkg.packageItems.length > 0 && (
                    <div className="pt-1 text-[10px] text-zinc-500 border-t border-zinc-200/50 dark:border-zinc-800">
                      Contains:{" "}
                      {pkg.packageItems.map((pi) => `${pi.quantity}x ${pi.sku}`).join(", ")}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Quick Bulk Actions */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800 text-[11px]">
              <button
                type="button"
                onClick={handleCopyAll}
                className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                {copiedAll ? "✓ All Copied" : "Copy All Numbers"}
              </button>
              <button
                type="button"
                onClick={handleDownloadCsv}
                className="font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
              >
                Export CSV ⬇
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
