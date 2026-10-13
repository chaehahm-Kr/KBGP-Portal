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

export function CreateShipmentModal({
  orderId,
  orderNumber,
  items,
  isOpen,
  onClose,
  onSuccess,
}: CreateShipmentModalProps) {
  const [carrier, setCarrier] = useState("ups");
  const [primaryTracking, setPrimaryTracking] = useState("");
  const [boxCount, setBoxCount] = useState(1);
  const [multiTrackingText, setMultiTrackingText] = useState("");
  const [isMultiBox, setIsMultiBox] = useState(false);
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

    if (!primaryTracking.trim() && !multiTrackingText.trim()) {
      setErrorMsg("Please provide a tracking number.");
      return;
    }

    // Build packages array if multi-box
    let packages: Array<{
      boxNumber: number;
      carrier: string;
      trackingNumber: string;
    }> = [];

    if (isMultiBox && multiTrackingText.trim()) {
      const lines = multiTrackingText
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      packages = lines.map((track, idx) => ({
        boxNumber: idx + 1,
        carrier,
        trackingNumber: track,
      }));
    } else {
      const count = Math.max(1, boxCount);
      packages = [
        {
          boxNumber: 1,
          carrier,
          trackingNumber: primaryTracking.trim(),
        },
      ];
      for (let i = 2; i <= count; i++) {
        packages.push({
          boxNumber: i,
          carrier,
          trackingNumber: `${primaryTracking.trim()}-${i}`,
        });
      }
    }

    startTransition(async () => {
      const res = await adminCreateShipmentWithPackagesAction({
        orderId,
        carrier,
        trackingNumber: primaryTracking.trim() || packages[0]?.trackingNumber || "PENDING",
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
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-sm font-bold p-1"
          >
            ✕
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-semibold">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* 1. Items to Ship Table */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase text-zinc-600 dark:text-zinc-300">
              1. Allocate Units to Dispatch
            </label>
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden divide-y divide-zinc-100 dark:divide-zinc-800 text-xs">
              <div className="p-2.5 bg-zinc-50 dark:bg-zinc-800/60 font-semibold grid grid-cols-12 text-zinc-500">
                <span className="col-span-6">Product / SKU</span>
                <span className="col-span-3 text-center">Remaining</span>
                <span className="col-span-3 text-right">Ship Qty</span>
              </div>
              {items.map((it) => (
                <div key={it.id} className="p-2.5 grid grid-cols-12 items-center gap-2">
                  <div className="col-span-6 min-w-0">
                    <p className="font-bold text-zinc-900 dark:text-white truncate">
                      {it.productName}
                    </p>
                    <p className="text-[10px] text-zinc-400 font-mono">{it.sku}</p>
                  </div>
                  <div className="col-span-3 text-center text-zinc-600 dark:text-zinc-400">
                    {it.quantityRemaining} units
                  </div>
                  <div className="col-span-3 flex justify-end">
                    <input
                      type="number"
                      min={0}
                      max={it.quantityRemaining}
                      value={shipQuantities[it.id] ?? 0}
                      onChange={(e) => handleQtyChange(it.id, it.quantityRemaining, e.target.value)}
                      className="w-20 px-2 py-1 text-right text-xs font-bold rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 2. Logistics & Carrier Information */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                Logistics Carrier
              </label>
              <select
                value={carrier}
                onChange={(e) => setCarrier(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
              >
                <option value="ups">UPS Ground / Freight</option>
                <option value="fedex">FedEx Express / Ground</option>
                <option value="usps">USPS Priority Mail</option>
                <option value="dhl">DHL Express</option>
                <option value="estes">Estes Express Lines (LTL)</option>
                <option value="odfl">Old Dominion Freight (LTL)</option>
                <option value="rl">R+L Carriers (LTL)</option>
                <option value="other">Other / Local Courier</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                Master Tracking #
              </label>
              <input
                type="text"
                placeholder="e.g. 1Z9999999999999999"
                value={primaryTracking}
                onChange={(e) => setPrimaryTracking(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
              />
            </div>
          </div>

          {/* Multi-Box Toggle */}
          <div className="p-3 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-800/40 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                Multi-Carton Dispatch (Multiple Tracking Numbers)
              </span>
              <button
                type="button"
                onClick={() => setIsMultiBox(!isMultiBox)}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-colors ${
                  isMultiBox
                    ? "bg-indigo-600 text-white"
                    : "bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300"
                }`}
              >
                {isMultiBox ? "Multi-Box Enabled" : "Single Box"}
              </button>
            </div>

            {isMultiBox ? (
              <div>
                <label className="block text-[11px] text-zinc-500 mb-1">
                  Paste Tracking Numbers (one per line for each carton):
                </label>
                <textarea
                  rows={4}
                  placeholder={`1Z9999999999999991\n1Z9999999999999992\n1Z9999999999999993`}
                  value={multiTrackingText}
                  onChange={(e) => setMultiTrackingText(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white"
                />
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-xs text-zinc-500">Total Box Count:</span>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={boxCount}
                  onChange={(e) => setBoxCount(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-20 px-2 py-1 text-center text-xs font-bold rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
                />
                <span className="text-[11px] text-zinc-400">Cartons / Master cases</span>
              </div>
            )}
          </div>

          {/* Mark as Shipped Checkbox */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="markShipped"
              checked={markAsShipped}
              onChange={(e) => setMarkAsShipped(e.target.checked)}
              className="w-4 h-4 rounded text-indigo-600"
            />
            <label htmlFor="markShipped" className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
              Immediately Mark as Dispatched / Shipped
            </label>
          </div>

          {/* Shipment Notes */}
          <div>
            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
              Internal Warehouse Notes (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Pallet #3 wrapped, dock pickup confirmed"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
            />
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-5 py-2 text-xs font-bold rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 hover:opacity-90 shadow-xs"
            >
              {isPending ? "Creating Shipment..." : "Confirm & Dispatch"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
