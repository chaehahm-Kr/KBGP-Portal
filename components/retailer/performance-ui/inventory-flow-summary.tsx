"use client";

import React from "react";
import { InventoryFlowSummaryProps } from "./types";

export function InventoryFlowSummary({
  orderedQty,
  confirmedShippedQty,
  pendingQty,
  inTransitQty,
  estimatedReceivedQty,
  incomingQty,
  nextEstimatedReceiptDate,
  postReportEstimatedReceipts,
  lastReportDate,
}: InventoryFlowSummaryProps) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-zinc-800">
        <div>
          <h3 className="text-base font-bold text-white">Inventory Flow & Order Pipeline</h3>
          <p className="text-xs text-zinc-400">
            End-to-end reconciliation from purchase order to in-transit pipeline and store receipts.
          </p>
        </div>
        {nextEstimatedReceiptDate && (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-xs font-medium text-amber-300">
            <svg className="w-3.5 h-3.5 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="1" y="3" width="15" height="13" />
              <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
              <circle cx="5.5" cy="18.5" r="2.5" />
              <circle cx="18.5" cy="18.5" r="2.5" />
            </svg>
            <span>Next Est. Arrival: {nextEstimatedReceiptDate}</span>
          </div>
        )}
      </div>

      {/* 5-Step Pipeline Flow Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {/* 1. Total Ordered */}
        <div className="p-3.5 bg-zinc-800/40 rounded-xl border border-zinc-800 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Ordered</span>
            <span className="text-[10px] text-zinc-500">PO Total</span>
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            {orderedQty.toLocaleString()}
          </div>
          <p className="text-[10px] text-zinc-500">Gross purchase orders</p>
        </div>

        {/* 2. Shipped */}
        <div className="p-3.5 bg-zinc-800/40 rounded-xl border border-zinc-800 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Shipped</span>
            <span className="text-[10px] text-indigo-400">Dispatched</span>
          </div>
          <div className="text-2xl font-bold text-indigo-300 tracking-tight">
            {confirmedShippedQty.toLocaleString()}
          </div>
          <p className="text-[10px] text-zinc-500">Warehouse dispatches</p>
        </div>

        {/* 3. Pending Dispatch */}
        <div className="p-3.5 bg-zinc-800/40 rounded-xl border border-zinc-800 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Pending</span>
            <span className="text-[10px] text-amber-400">Processing</span>
          </div>
          <div className="text-2xl font-bold text-amber-300 tracking-tight">
            {pendingQty.toLocaleString()}
          </div>
          <p className="text-[10px] text-zinc-500">Unfulfilled order units</p>
        </div>

        {/* 4. In Transit */}
        <div className="p-3.5 bg-zinc-800/40 rounded-xl border border-zinc-800 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">In Transit</span>
            <span className="text-[10px] text-sky-400">On the Way</span>
          </div>
          <div className="text-2xl font-bold text-sky-300 tracking-tight">
            {inTransitQty.toLocaleString()}
          </div>
          <p className="text-[10px] text-zinc-500">Active carrier shipments</p>
        </div>

        {/* 5. Estimated Received */}
        <div className="p-3.5 bg-zinc-800/40 rounded-xl border border-zinc-800 space-y-1 col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Received</span>
            <span className="text-[10px] text-emerald-400">At Store</span>
          </div>
          <div className="text-2xl font-bold text-emerald-300 tracking-tight">
            {estimatedReceivedQty.toLocaleString()}
          </div>
          <p className="text-[10px] text-zinc-500">Delivered / arrived units</p>
        </div>
      </div>

      {/* Post-Report Adjustment Callout if applicable */}
      {typeof postReportEstimatedReceipts === "number" && postReportEstimatedReceipts > 0 && (
        <div className="p-3 bg-indigo-950/30 border border-indigo-800/40 rounded-lg text-xs text-indigo-300 flex items-start gap-2.5">
          <svg className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <div className="space-y-0.5">
            <span className="font-semibold text-indigo-200">
              +{postReportEstimatedReceipts} units received after last inventory check
            </span>
            <p className="text-[11px] text-indigo-300/80">
              {lastReportDate ? `Physical inventory was recorded on ${lastReportDate}. ` : ""}
              These shipments arrived subsequent to that count and are automatically credited to projected available stock.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
