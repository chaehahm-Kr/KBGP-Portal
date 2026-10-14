// components/admin/orders/edit-tracking-modal.tsx
"use client";

import React, { useState, useTransition } from "react";
import { AdminOrderBox } from "@/lib/admin/orders-types";
import { adminUpdateFulfillmentBoxesAction } from "@/lib/retailer/fulfillment-actions";
import { formatCarrierName } from "@/lib/orders/carrier-resolver";

interface EditBoxRow {
  id?: string;
  boxNumber: number;
  carrier: string;
  trackingNumber: string;
  weightLbs?: number | string;
  dimensionsInch?: string;
  notes?: string;
  status: "active" | "void";
}

interface EditTrackingModalProps {
  fulfillmentId: string;
  fulfillmentNumber: string;
  orderNumber: string;
  currentBoxes: AdminOrderBox[];
  currentNotes?: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function EditTrackingModal({
  fulfillmentId,
  fulfillmentNumber,
  orderNumber,
  currentBoxes,
  currentNotes,
  isOpen,
  onClose,
  onSuccess,
}: EditTrackingModalProps) {
  const [boxes, setBoxes] = useState<EditBoxRow[]>(() => {
    if (currentBoxes && currentBoxes.length > 0) {
      return currentBoxes.map((b) => ({
        id: b.id,
        boxNumber: b.boxNumber,
        carrier: b.carrier || "ups",
        trackingNumber: b.trackingNumber || "",
        weightLbs: b.weightLbs ?? "",
        dimensionsInch: b.dimensionsInch || "",
        notes: b.notes || "",
        status: (b.status === "void" ? "void" : "active") as "active" | "void",
      }));
    }
    return [
      {
        boxNumber: 1,
        carrier: "ups",
        trackingNumber: "",
        status: "active",
      },
    ];
  });

  const [notes, setNotes] = useState(currentNotes || "");
  const [errorMsg, setErrorMsg] = useState("");
  const [isPending, startTransition] = useTransition();

  if (!isOpen) return null;

  const handleAddBox = () => {
    setBoxes((prev) => {
      const activeCount = prev.filter((b) => b.status === "active").length;
      return [
        ...prev,
        {
          boxNumber: activeCount + 1,
          carrier: prev[prev.length - 1]?.carrier || "ups",
          trackingNumber: "",
          status: "active",
        },
      ];
    });
  };

  const handleToggleVoid = (index: number) => {
    setBoxes((prev) =>
      prev.map((b, i) => {
        if (i !== index) return b;
        return {
          ...b,
          status: b.status === "active" ? "void" : "active",
        };
      })
    );
  };

  const handleUpdateBox = (index: number, field: keyof EditBoxRow, val: any) => {
    setBoxes((prev) =>
      prev.map((b, i) => {
        if (i !== index) return b;
        return { ...b, [field]: val };
      })
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    const activeBoxes = boxes.filter((b) => b.status === "active");
    if (activeBoxes.length === 0) {
      setErrorMsg("A dispatch must contain at least 1 active box. If this entire shipment is void, please cancel the dispatch.");
      return;
    }

    startTransition(async () => {
      const payloadBoxes = boxes.map((b, idx) => ({
        id: b.id,
        boxNumber: idx + 1,
        carrier: b.carrier.trim(),
        trackingNumber: b.trackingNumber.trim() || null,
        weightLbs: b.weightLbs !== "" && b.weightLbs !== undefined ? Number(b.weightLbs) : null,
        dimensionsInch: b.dimensionsInch?.trim() || null,
        notes: b.notes?.trim() || null,
        status: b.status,
      }));

      const res = await adminUpdateFulfillmentBoxesAction({
        fulfillmentId,
        boxes: payloadBoxes,
        notes: notes.trim() || null,
      });

      if (!res.success) {
        setErrorMsg(res.error || "Failed to update tracking boxes.");
      } else {
        onSuccess();
        onClose();
      }
    });
  };

  const activeCount = boxes.filter((b) => b.status === "active").length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="relative w-full max-w-2xl rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl p-6 sm:p-8 space-y-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-zinc-900 dark:text-white">
                Edit Shipment Tracking & Packages
              </h2>
              <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                {fulfillmentNumber}
              </span>
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">Order #{orderNumber}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Safety Invariant Notice */}
        <div className="p-3 rounded-xl border border-blue-200 bg-blue-50/70 text-xs text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300 flex items-start gap-2.5">
          <span className="text-base leading-none">ℹ️</span>
          <div>
            <span className="font-bold">Logistics Tracking Only:</span>
            <p className="mt-0.5 text-[11px] text-blue-800 dark:text-blue-300/90">
              Modifying carton boxes, carriers, or tracking numbers updates shipping tracking synchronization only. It does <strong>NOT</strong> modify line-item quantities shipped or alter financial invoices.
            </p>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl border border-rose-200 bg-rose-50 text-xs font-semibold text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Box List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                Carton Boxes ({activeCount} Active)
              </label>
              <button
                type="button"
                onClick={handleAddBox}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:hover:bg-indigo-900 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 transition-colors cursor-pointer"
              >
                <span>+</span>
                <span>Add Box</span>
              </button>
            </div>

            <div className="space-y-3">
              {boxes.map((box, idx) => {
                const isVoid = box.status === "void";
                return (
                  <div
                    key={box.id || `box-row-${idx}`}
                    className={`p-3.5 rounded-2xl border transition-all ${
                      isVoid
                        ? "bg-zinc-100/70 dark:bg-zinc-800/30 border-zinc-200 dark:border-zinc-800 opacity-60"
                        : "bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200/80 dark:border-zinc-700/80"
                    } space-y-3`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-zinc-900 dark:text-white">
                          📦 Box #{idx + 1}
                        </span>
                        {isVoid ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400 border border-rose-200 dark:border-rose-900">
                            VOID
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900">
                            Active
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggleVoid(idx)}
                          className={`text-[11px] font-semibold px-2 py-0.5 rounded cursor-pointer transition-colors ${
                            isVoid
                              ? "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950"
                              : "text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950"
                          }`}
                        >
                          {isVoid ? "Restore Box" : "Void Box"}
                        </button>
                      </div>
                    </div>

                    {!isVoid && (
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 text-xs">
                        <div className="sm:col-span-4">
                          <label className="block text-[11px] font-medium text-zinc-500 mb-1">
                            Carrier
                          </label>
                          <select
                            value={box.carrier}
                            onChange={(e) => handleUpdateBox(idx, "carrier", e.target.value)}
                            className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs text-zinc-900 dark:text-white outline-none focus:border-indigo-500"
                          >
                            <option value="ups">UPS</option>
                            <option value="fedex">FedEx</option>
                            <option value="usps">USPS</option>
                            <option value="dhl">DHL</option>
                            <option value="freight">Freight / LTL</option>
                            <option value="other">Other / Local</option>
                          </select>
                        </div>

                        <div className="sm:col-span-8">
                          <label className="block text-[11px] font-medium text-zinc-500 mb-1">
                            Tracking Number
                          </label>
                          <input
                            type="text"
                            value={box.trackingNumber}
                            onChange={(e) => handleUpdateBox(idx, "trackingNumber", e.target.value)}
                            placeholder="e.g. 1Z9999999999999999"
                            className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs font-mono text-zinc-900 dark:text-white outline-none focus:border-indigo-500"
                          />
                        </div>

                        <div className="sm:col-span-6">
                          <label className="block text-[11px] font-medium text-zinc-500 mb-1">
                            Weight (lbs, optional)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            value={box.weightLbs ?? ""}
                            onChange={(e) => handleUpdateBox(idx, "weightLbs", e.target.value)}
                            placeholder="e.g. 12.5"
                            className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs text-zinc-900 dark:text-white outline-none focus:border-indigo-500"
                          />
                        </div>

                        <div className="sm:col-span-6">
                          <label className="block text-[11px] font-medium text-zinc-500 mb-1">
                            Dimensions (inch, optional)
                          </label>
                          <input
                            type="text"
                            value={box.dimensionsInch || ""}
                            onChange={(e) => handleUpdateBox(idx, "dimensionsInch", e.target.value)}
                            placeholder="e.g. 16x12x10"
                            className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs text-zinc-900 dark:text-white outline-none focus:border-indigo-500"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Shipment Notes */}
          <div>
            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
              Dispatch Notes (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Added replacement tracking for damaged box 2"
              className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs text-zinc-900 dark:text-white outline-none focus:border-indigo-500"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="px-4 py-2 text-xs font-semibold rounded-xl text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-5 py-2 text-xs font-bold rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
            >
              {isPending ? "Saving..." : "Save Tracking"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
