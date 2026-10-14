// components/admin/orders/create-shipment-modal.tsx
"use client";

import React, { useState, useTransition } from "react";
import { AdminOrderLineItem } from "@/lib/admin/orders-types";
import { adminCreateShipmentWithPackagesAction } from "@/lib/admin/orders-actions";

interface CreateShipmentModalProps {
  orderId: string;
  orderNumber: string;
  items: AdminOrderLineItem[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface CartonBoxRow {
  boxNumber: number;
  carrier: string;
  trackingNumber: string;
  weightLbs?: string;
  dimensionsInch?: string;
}

export function CreateShipmentModal({
  orderId,
  orderNumber,
  items,
  isOpen,
  onClose,
  onSuccess,
}: CreateShipmentModalProps) {
  const [defaultCarrier, setDefaultCarrier] = useState("ups");
  const [boxes, setBoxes] = useState<CartonBoxRow[]>([
    {
      boxNumber: 1,
      carrier: "ups",
      trackingNumber: "",
    },
  ]);
  const [markAsShipped, setMarkAsShipped] = useState(true);
  const [notes, setNotes] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [isPending, startTransition] = useTransition();

  // Quantities to ship for each item
  const [shipQuantities, setShipQuantities] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    items.forEach((it) => {
      init[it.id] = it.quantityRemaining;
    });
    return init;
  });

  if (!isOpen) return null;

  const handleQtyChange = (itemId: string, max: number, val: string) => {
    const num = Math.min(max, Math.max(0, parseInt(val) || 0));
    setShipQuantities((prev) => ({ ...prev, [itemId]: num }));
  };

  const handleAddBox = () => {
    setBoxes((prev) => [
      ...prev,
      {
        boxNumber: prev.length + 1,
        carrier: prev[prev.length - 1]?.carrier || defaultCarrier,
        trackingNumber: "",
      },
    ]);
  };

  const handleRemoveBox = (index: number) => {
    if (boxes.length <= 1) return;
    setBoxes((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      return updated.map((b, i) => ({ ...b, boxNumber: i + 1 }));
    });
  };

  const handleUpdateBox = (index: number, field: keyof CartonBoxRow, val: string) => {
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

    const itemsToShip = items
      .filter((it) => (shipQuantities[it.id] || 0) > 0)
      .map((it) => ({
        orderItemId: it.id,
        productId: it.productId,
        quantityShipped: shipQuantities[it.id] || 0,
      }));

    if (itemsToShip.length === 0) {
      setErrorMsg("Please specify at least 1 unit to dispatch.");
      return;
    }

    // Verify at least one tracking number is provided if marking as shipped
    const hasAnyTracking = boxes.some((b) => b.trackingNumber.trim().length > 0);
    if (markAsShipped && !hasAnyTracking) {
      setErrorMsg("Please provide at least one tracking number before dispatching.");
      return;
    }

    const primaryBox = boxes[0] || { carrier: defaultCarrier, trackingNumber: "" };
    const primaryCarrier = primaryBox.carrier || defaultCarrier;
    const primaryTracking = primaryBox.trackingNumber.trim() || (markAsShipped ? "PENDING" : "DRAFT");

    const packages = boxes.map((b, idx) => ({
      boxNumber: idx + 1,
      carrier: b.carrier || primaryCarrier,
      trackingNumber: b.trackingNumber.trim() || `${primaryTracking}-${idx + 1}`,
      weightLbs: b.weightLbs ? Number(b.weightLbs) : undefined,
      dimensionsInch: b.dimensionsInch?.trim() || undefined,
    }));

    startTransition(async () => {
      const res = await adminCreateShipmentWithPackagesAction({
        orderId,
        carrier: primaryCarrier,
        trackingNumber: primaryTracking,
        markAsShipped,
        notes,
        items: itemsToShip,
        packages,
      });

      if (!res.success) {
        setErrorMsg(res.error || "Failed to create shipment dispatch.");
      } else {
        onSuccess();
        onClose();
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="relative w-full max-w-2xl rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl p-6 sm:p-8 space-y-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-4">
          <div>
            <h2 className="text-lg font-black text-zinc-900 dark:text-white">
              Create Shipment Dispatch
            </h2>
            <p className="text-xs text-zinc-500">Order #{orderNumber}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 text-sm p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
          >
            ✕
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 text-xs rounded-xl bg-red-50 text-red-700 border border-red-200 font-semibold dark:bg-red-950/50 dark:text-red-400 dark:border-red-900">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 1. Item Quantities Selection */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
              1. Select Quantities to Ship
            </label>
            <div className="space-y-2 max-h-52 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 bg-zinc-50/50 dark:bg-zinc-800/20">
              {items.map((it) => (
                <div key={it.id} className="pt-2 first:pt-0 flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <p className="font-bold text-zinc-900 dark:text-white truncate">
                      {it.productName}
                    </p>
                    <p className="text-[11px] text-zinc-400 font-mono">
                      SKU: {it.sku} · Remaining: {it.quantityRemaining} units
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] text-zinc-500">Ship Qty:</span>
                    <input
                      type="number"
                      min={0}
                      max={it.quantityRemaining}
                      value={shipQuantities[it.id] ?? 0}
                      onChange={(e) => handleQtyChange(it.id, it.quantityRemaining, e.target.value)}
                      className="w-20 px-2 py-1 text-right text-xs font-bold rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 2. Dynamic Carton Packaging Rows */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                2. Carton Boxes & Tracking ({boxes.length} {boxes.length === 1 ? "Box" : "Boxes"})
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
              {boxes.map((box, idx) => (
                <div
                  key={`carton-box-${idx}`}
                  className="p-3.5 rounded-2xl border border-zinc-200/80 dark:border-zinc-700/80 bg-zinc-50/70 dark:bg-zinc-800/40 space-y-3 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-zinc-900 dark:text-white text-xs">
                      📦 Box #{idx + 1} of {boxes.length}
                    </span>
                    {boxes.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveBox(idx)}
                        className="text-rose-600 hover:text-rose-700 dark:text-rose-400 text-[11px] font-semibold hover:underline cursor-pointer"
                      >
                        Remove Box
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                    <div className="sm:col-span-4">
                      <label className="block text-[11px] font-medium text-zinc-500 mb-1">
                        Carrier
                      </label>
                      <select
                        value={box.carrier}
                        onChange={(e) => handleUpdateBox(idx, "carrier", e.target.value)}
                        className="w-full px-3 py-1.5 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white outline-none focus:border-indigo-500"
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
                        placeholder="e.g. 1Z9999999999999999"
                        value={box.trackingNumber}
                        onChange={(e) => handleUpdateBox(idx, "trackingNumber", e.target.value)}
                        className="w-full px-3 py-1.5 text-xs font-mono rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div className="sm:col-span-6">
                      <label className="block text-[11px] font-medium text-zinc-500 mb-1">
                        Weight (lbs, optional)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="e.g. 15.2"
                        value={box.weightLbs || ""}
                        onChange={(e) => handleUpdateBox(idx, "weightLbs", e.target.value)}
                        className="w-full px-3 py-1.5 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div className="sm:col-span-6">
                      <label className="block text-[11px] font-medium text-zinc-500 mb-1">
                        Dimensions (inch, optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 18x12x10"
                        value={box.dimensionsInch || ""}
                        onChange={(e) => handleUpdateBox(idx, "dimensionsInch", e.target.value)}
                        className="w-full px-3 py-1.5 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 3. Mark as Shipped Checkbox */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="markShipped"
              checked={markAsShipped}
              onChange={(e) => setMarkAsShipped(e.target.checked)}
              className="w-4 h-4 rounded text-indigo-600 cursor-pointer"
            />
            <label htmlFor="markShipped" className="text-xs font-bold text-zinc-800 dark:text-zinc-200 cursor-pointer">
              Immediately Mark as Dispatched / Shipped (Generates Dispatch Invoice)
            </label>
          </div>

          {/* 4. Shipment Notes */}
          <div>
            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
              Internal Warehouse Notes (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Pallet #3 wrapped, dock pickup confirmed"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white outline-none focus:border-indigo-500"
            />
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-5 py-2 text-xs font-bold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs cursor-pointer disabled:opacity-50"
            >
              {isPending ? "Creating Shipment..." : "Confirm & Dispatch"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
