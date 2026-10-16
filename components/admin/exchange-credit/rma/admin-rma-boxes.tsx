"use client";

import React, { useState } from "react";
import type { AdminRmaBoxesProps } from "./admin-rma-types";
import type { RmaBoxInput, RmaShippingCarrier } from "@/lib/retailer/rma";

export function AdminRmaBoxes({
  boxes,
  lines,
  rmaNumber,
  isEditable = false,
  onAddBox,
}: AdminRmaBoxesProps) {
  const [showAddBoxModal, setShowAddBoxModal] = useState(false);
  const [showPackingListModal, setShowPackingListModal] = useState(false);

  // Form states for manual box allocation
  const [carrier, setCarrier] = useState<RmaShippingCarrier>("UPS");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [labelUrl, setLabelUrl] = useState("");
  const [lineAllocations, setLineAllocations] = useState<Record<string, number>>({});

  const linesMap = new Map(lines.map((l) => [l.id, l]));

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "delivered":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "in_transit":
        return "bg-cyan-500/10 text-cyan-400 border-cyan-500/20";
      case "lost":
      case "exception":
        return "bg-rose-500/15 text-rose-300 border-rose-500/30";
      case "label_created":
      default:
        return "bg-zinc-800 text-zinc-300 border-zinc-700";
    }
  };

  const handleOpenAddBox = () => {
    setCarrier("UPS");
    setTrackingNumber("");
    setLabelUrl("");
    const initial: Record<string, number> = {};
    lines.forEach((l) => {
      initial[l.id] = 0;
    });
    setLineAllocations(initial);
    setShowAddBoxModal(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-base">📦</span>
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
              Return Boxes & Shipping Labels ({boxes.length})
            </h3>
          </div>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            One prepaid shipping label per physical box. Multi-SKU products may be consolidated across boxes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowPackingListModal(true)}
            className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium border border-zinc-700 transition-colors flex items-center gap-1.5"
          >
            <span>📋</span>
            <span>View Consolidated Packing List</span>
          </button>

          {isEditable && (
            <button
              type="button"
              onClick={handleOpenAddBox}
              className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-xs transition-colors flex items-center gap-1"
            >
              <span>+</span>
              <span>Add Box / Label</span>
            </button>
          )}
        </div>
      </div>

      {boxes.length === 0 ? (
        <div className="p-8 rounded-xl border border-zinc-800 bg-zinc-900/40 text-center space-y-2">
          <span className="text-2xl">🏷️</span>
          <p className="text-xs font-medium text-zinc-400">
            No shipping labels or return boxes allocated yet.
          </p>
          <p className="text-[11px] text-zinc-500">
            Prepaid return labels will be generated and assigned upon Admin approval.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {boxes.map((box) => (
            <div
              key={box.id}
              className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/60 space-y-3 shadow-xs"
            >
              <div className="flex items-start justify-between gap-2 border-b border-zinc-800/80 pb-2.5">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-xs">Box #{box.boxNumber}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getStatusBadge(
                        box.status
                      )}`}
                    >
                      {box.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-cyan-400 mt-1">
                    {box.carrier}: {box.trackingNumber}
                  </div>
                </div>

                {box.labelUrl && (
                  <a
                    href={box.labelUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] font-medium transition-colors"
                  >
                    Print Label ↗
                  </a>
                )}
              </div>

              {/* Items Packed in this Box */}
              <div className="space-y-1.5">
                <div className="text-[10px] uppercase font-bold tracking-wider text-zinc-500">
                  Contents in Box #{box.boxNumber}:
                </div>
                <div className="divide-y divide-zinc-800/60 bg-zinc-950/40 rounded-lg p-2 border border-zinc-800/60 text-xs">
                  {box.assignedLines.map((asgn) => {
                    const line = linesMap.get(asgn.lineId);
                    return (
                      <div
                        key={asgn.lineId}
                        className="py-1 flex items-center justify-between text-[11px]"
                      >
                        <span className="text-zinc-200 truncate max-w-[200px]" title={line?.productName}>
                          {line?.productName || asgn.lineId} ({line?.productSku || "SKU"})
                        </span>
                        <span className="font-mono font-semibold text-cyan-400">
                          {asgn.quantity} units
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Shipping Dates */}
              <div className="flex items-center justify-between text-[10px] text-zinc-500 pt-1">
                <span>Shipped: {box.shippedAt ? new Date(box.shippedAt).toLocaleDateString() : "Pending"}</span>
                <span>Delivered: {box.deliveredAt ? new Date(box.deliveredAt).toLocaleDateString() : "Pending"}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Consolidated Packing List Modal */}
      {showPackingListModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-zinc-900 border border-zinc-800 p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <h4 className="text-sm font-bold text-white">Consolidated Return Packing List</h4>
                <p className="text-[11px] text-zinc-400">RMA Reference: {rmaNumber}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowPackingListModal(false)}
                className="text-zinc-400 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>

            <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 text-xs space-y-2">
              <div className="font-semibold text-cyan-300 uppercase text-[10px] tracking-wider">
                Retailer Packing Instructions:
              </div>
              <ul className="list-disc pl-4 space-y-1 text-zinc-400 text-[11px]">
                <li>Affix exactly one prepaid shipping label per physical box.</li>
                <li>Ensure all products have original barcodes, batch tags, or SKUs intact.</li>
                <li>Do not combine products from different stores or different RMA numbers.</li>
                <li>Hand off packages to the designated carrier within 14 calendar days of RMA approval.</li>
              </ul>
            </div>

            <div className="space-y-2">
              <h5 className="text-xs font-bold text-zinc-200">Authorized SKU Lines ({lines.length})</h5>
              <table className="w-full text-left text-xs border border-zinc-800 rounded-lg overflow-hidden">
                <thead className="bg-zinc-950 text-zinc-400 text-[10px] uppercase">
                  <tr>
                    <th className="py-2 px-3">SKU</th>
                    <th className="py-2 px-3">Product Name</th>
                    <th className="py-2 px-3 text-right">Authorized Qty</th>
                    <th className="py-2 px-3 text-right">Frozen Wholesale</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800 text-zinc-300">
                  {lines.map((l) => (
                    <tr key={l.id}>
                      <td className="py-2 px-3 font-mono text-[11px] text-cyan-400">{l.productSku}</td>
                      <td className="py-2 px-3">{l.productName}</td>
                      <td className="py-2 px-3 text-right font-bold">{l.quantityAuthorized}</td>
                      <td className="py-2 px-3 text-right font-mono">${l.frozenUnitWholesalePrice.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setShowPackingListModal(false)}
                className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Box Modal (Preview / Disabled in Phase 3) */}
      {showAddBoxModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-zinc-900 border border-zinc-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h4 className="text-sm font-bold text-white">Add Return Box & Tracking Label</h4>
              <button
                type="button"
                onClick={() => setShowAddBoxModal(false)}
                className="text-zinc-400 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 font-semibold mb-1">Carrier *</label>
                  <select
                    value={carrier}
                    onChange={(e) => setCarrier(e.target.value as RmaShippingCarrier)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="UPS">UPS</option>
                    <option value="USPS">USPS</option>
                    <option value="FEDEX">FedEx</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-zinc-400 font-semibold mb-1">Tracking Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 1Z9999999999999999"
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-white placeholder-zinc-600 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-zinc-400 font-semibold mb-1">Label URL (PDF)</label>
                <input
                  type="url"
                  placeholder="https://storage.letusto.com/labels/..."
                  value={labelUrl}
                  onChange={(e) => setLabelUrl(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-white placeholder-zinc-600 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300">
                Phase 3 Preview: Box allocation and label assignment are displayed in preview mode until backend mutations are connected.
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setShowAddBoxModal(false)}
                className="px-3.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled
                title="Mutation disabled in Phase 3"
                className="px-3.5 py-1.5 rounded-lg bg-cyan-600/50 text-white/50 text-xs font-semibold cursor-not-allowed"
              >
                Save Box (Disabled in Phase 3)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
