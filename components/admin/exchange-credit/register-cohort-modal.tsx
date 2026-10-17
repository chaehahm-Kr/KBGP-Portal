"use client";

import React, { useState, useEffect, useTransition } from "react";
import type { CompanyExchangeEnrollment } from "@/lib/retailer/exchange-credit-types";
import {
  getCompanyStoresForRegistrationAction,
  getStoreEligibleOrdersForRegistrationAction,
  getOrderEligibleItemsForRegistrationAction,
  registerProtectedSupplyCohortAction,
} from "@/lib/retailer/exchange-credit-actions";

interface StoreOption {
  id: string;
  name: string;
  storeCode: string | null;
  city: string | null;
  state: string | null;
  status: string | null;
}

interface OrderOption {
  id: string;
  orderNumber: string;
  orderStatus: string;
  totalAmount: number;
  totalItems: number;
  totalSkus: number;
  createdAt: string;
  firstShipmentDate: string | null;
  carrier: string | null;
  trackingNumber: string | null;
  fulfillmentStatus: string | null;
}

interface ItemOption {
  id: string;
  orderId: string;
  productId: string;
  sku: string;
  productName: string;
  brandName: string;
  unitWholesalePrice: number;
  quantity: number;
  isAlreadyProtected: boolean;
  existingCohortCode?: string;
  existingStatus?: string;
}

interface RegisterCohortModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  enrollments: CompanyExchangeEnrollment[];
  onSwitchToCompanyEnrollment?: () => void;
}

// Helper: Add days to ISO date
function addDays(dateStr: string, days: number): string {
  try {
    const d = new Date(dateStr);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().split("T")[0];
  } catch {
    return "N/A";
  }
}

export function RegisterCohortModal({
  isOpen,
  onClose,
  onSuccess,
  enrollments,
  onSwitchToCompanyEnrollment,
}: RegisterCohortModalProps) {
  const [isPending, startTransition] = useTransition();

  // Selection states
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [selectedStoreId, setSelectedStoreId] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [selectedItemId, setSelectedItemId] = useState("");
  const [customProtectedQty, setCustomProtectedQty] = useState<number | "">("");

  // Async data states
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [loadingStores, setLoadingStores] = useState(false);

  const [orders, setOrders] = useState<OrderOption[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  const [items, setItems] = useState<ItemOption[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  const [errorMsg, setErrorMsg] = useState("");

  const activeEnrollments = enrollments.filter((e) => e.status === "active");
  const selectedEnrollment = enrollments.find((e) => e.companyId === selectedCompanyId);
  const selectedStore = stores.find((s) => s.id === selectedStoreId);
  const selectedOrder = orders.find((o) => o.id === selectedOrderId);
  const selectedItem = items.find((i) => i.id === selectedItemId);

  // Reset when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedCompanyId("");
      setSelectedStoreId("");
      setSelectedOrderId("");
      setSelectedItemId("");
      setCustomProtectedQty("");
      setStores([]);
      setOrders([]);
      setItems([]);
      setErrorMsg("");
    }
  }, [isOpen]);

  // When Company changes -> Fetch Stores
  useEffect(() => {
    if (!selectedCompanyId) {
      setStores([]);
      setSelectedStoreId("");
      return;
    }
    setSelectedStoreId("");
    setSelectedOrderId("");
    setSelectedItemId("");
    setOrders([]);
    setItems([]);
    setLoadingStores(true);

    getCompanyStoresForRegistrationAction(selectedCompanyId).then((res) => {
      setLoadingStores(false);
      if (res.success && res.stores) {
        setStores(res.stores);
      } else {
        setErrorMsg(res.error || "Failed to load stores for selected company.");
      }
    });
  }, [selectedCompanyId]);

  // When Store changes -> Fetch Orders
  useEffect(() => {
    if (!selectedCompanyId || !selectedStoreId) {
      setOrders([]);
      setSelectedOrderId("");
      return;
    }
    setSelectedOrderId("");
    setSelectedItemId("");
    setItems([]);
    setLoadingOrders(true);

    getStoreEligibleOrdersForRegistrationAction(selectedCompanyId, selectedStoreId).then((res) => {
      setLoadingOrders(false);
      if (res.success && res.orders) {
        setOrders(res.orders);
      } else {
        setErrorMsg(res.error || "Failed to load orders for selected store.");
      }
    });
  }, [selectedCompanyId, selectedStoreId]);

  // When Order changes -> Fetch Order Items
  useEffect(() => {
    if (!selectedOrderId || !selectedStoreId) {
      setItems([]);
      setSelectedItemId("");
      return;
    }
    setSelectedItemId("");
    setLoadingItems(true);

    getOrderEligibleItemsForRegistrationAction(selectedOrderId, selectedStoreId).then((res) => {
      setLoadingItems(false);
      if (res.success && res.items) {
        setItems(res.items);
      } else {
        setErrorMsg(res.error || "Failed to load items for selected order.");
      }
    });
  }, [selectedOrderId, selectedStoreId]);

  // When Item selected -> Set initial protected quantity
  useEffect(() => {
    if (selectedItem) {
      setCustomProtectedQty(selectedItem.quantity);
    } else {
      setCustomProtectedQty("");
    }
  }, [selectedItem]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!selectedCompanyId || !selectedStoreId || !selectedOrderId || !selectedItem) {
      setErrorMsg("Please complete all guided selection steps.");
      return;
    }

    const qty = typeof customProtectedQty === "number" ? customProtectedQty : parseInt(String(customProtectedQty), 10);
    if (isNaN(qty) || qty <= 0) {
      setErrorMsg("Protected quantity must be a positive integer.");
      return;
    }
    if (qty > selectedItem.quantity) {
      setErrorMsg(`Protected quantity cannot exceed ordered quantity (${selectedItem.quantity}).`);
      return;
    }

    startTransition(async () => {
      try {
        const res = await registerProtectedSupplyCohortAction({
          companyId: selectedCompanyId,
          storeId: selectedStoreId,
          productId: selectedItem.productId,
          sourceOrderId: selectedOrderId,
          sourceOrderItemId: selectedItem.id,
          protectedQuantity: qty,
          unitWholesalePrice: selectedItem.unitWholesalePrice,
          firstShipmentDate: selectedOrder?.firstShipmentDate || undefined,
        });

        if (res.success) {
          onSuccess();
          onClose();
        } else {
          setErrorMsg(res.error || "Failed to register protected cohort.");
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        setErrorMsg(message || "An unexpected error occurred.");
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-2xl bg-zinc-900 border border-zinc-800 p-6 shadow-2xl space-y-5 my-8 max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-zinc-800 pb-4 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">🛡️</span>
              <h3 className="text-base font-bold text-white tracking-tight">
                Register Initial Protected Supply Cohort
              </h3>
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              Establish a lifetime protected inventory baseline for a Store + SKU using verified B2B orders.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-500 hover:text-white p-1 rounded-lg transition-colors text-sm"
          >
            ✕
          </button>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2 shrink-0">
            <span>⚠️</span>
            <div className="flex-1 font-medium">{errorMsg}</div>
          </div>
        )}

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-5 text-xs">
          {/* STEP A: Select Enrolled Company */}
          <div className="space-y-2 p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-800">
            <div className="flex items-center justify-between">
              <label className="font-bold text-zinc-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-[10px]">
                  1
                </span>
                <span>Select Enrolled Retailer Company *</span>
              </label>
              {selectedEnrollment && (
                <span className="text-[10px] font-mono text-emerald-400 font-semibold bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/40">
                  Active Enrollment · Option A: {(selectedEnrollment.optionACreditRate * 100).toFixed(0)}%
                </span>
              )}
            </div>

            {activeEnrollments.length === 0 ? (
              <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs space-y-2">
                <p>
                  No actively enrolled retailer companies found. Protected supply cohorts can only be registered for companies with an active 90-Day Exchange Credit policy.
                </p>
                {onSwitchToCompanyEnrollment && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onSwitchToCompanyEnrollment();
                    }}
                    className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs transition-colors"
                  >
                    Go to Company Enrollments & Policies →
                  </button>
                )}
              </div>
            ) : (
              <select
                value={selectedCompanyId}
                onChange={(e) => setSelectedCompanyId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-white focus:outline-none focus:border-cyan-500 text-xs"
              >
                <option value="">-- Choose Enrolled Retailer --</option>
                {activeEnrollments.map((enr) => (
                  <option key={enr.companyId} value={enr.companyId}>
                    {enr.companyName} {enr.companyCode ? `(${enr.companyCode})` : ""} — Option A: {(enr.optionACreditRate * 100).toFixed(0)}%
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* STEP B: Select Store */}
          {selectedCompanyId && (
            <div className="space-y-2 p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-800">
              <label className="font-bold text-zinc-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-[10px]">
                  2
                </span>
                <span>Select Target Store *</span>
              </label>

              {loadingStores ? (
                <div className="py-3 text-zinc-500 text-center font-medium">Loading company stores...</div>
              ) : stores.length === 0 ? (
                <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 text-xs">
                  No stores found for this company. Stores must first be configured in Store Operations.
                </div>
              ) : (
                <select
                  value={selectedStoreId}
                  onChange={(e) => setSelectedStoreId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-white focus:outline-none focus:border-cyan-500 text-xs"
                >
                  <option value="">-- Choose Store Location --</option>
                  {stores.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name} {st.storeCode ? `[${st.storeCode}]` : ""} {st.city ? `· ${st.city}, ${st.state || ""}` : ""}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* STEP C: Select Source B2B Order */}
          {selectedStoreId && (
            <div className="space-y-2 p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-800">
              <label className="font-bold text-zinc-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-[10px]">
                  3
                </span>
                <span>Select Initial Supply Order *</span>
              </label>

              {loadingOrders ? (
                <div className="py-3 text-zinc-500 text-center font-medium">Loading eligible store orders...</div>
              ) : orders.length === 0 ? (
                <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 text-xs">
                  No confirmed B2B supply orders found for this store. Only valid, confirmed orders qualify for cohort registration.
                </div>
              ) : (
                <div className="space-y-2">
                  <select
                    value={selectedOrderId}
                    onChange={(e) => setSelectedOrderId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-white focus:outline-none focus:border-cyan-500 text-xs"
                  >
                    <option value="">-- Choose B2B Source Order --</option>
                    {orders.map((ord) => (
                      <option key={ord.id} value={ord.id}>
                        {ord.orderNumber} ({ord.orderStatus.toUpperCase()}) · {new Date(ord.createdAt).toLocaleDateString()} · {ord.totalItems} units (${ord.totalAmount.toFixed(2)})
                      </option>
                    ))}
                  </select>

                  {selectedOrder && (
                    <div className="p-2.5 rounded-lg bg-zinc-900/90 border border-zinc-800 flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-zinc-300">Shipment Status:</span>
                        <span
                          className={`font-bold ${
                            selectedOrder.firstShipmentDate
                              ? "text-emerald-400"
                              : "text-amber-400"
                          }`}
                        >
                          {selectedOrder.firstShipmentDate
                            ? `✓ Shipped on ${selectedOrder.firstShipmentDate}`
                            : "Awaiting Letusto Shipment"}
                        </span>
                      </div>
                      {selectedOrder.carrier && (
                        <span className="text-zinc-500">
                          {selectedOrder.carrier} {selectedOrder.trackingNumber ? `(${selectedOrder.trackingNumber})` : ""}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* STEP D: Select Order Item & SKU */}
          {selectedOrderId && (
            <div className="space-y-2 p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-800">
              <label className="font-bold text-zinc-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-[10px]">
                  4
                </span>
                <span>Select Protected SKU & Product *</span>
              </label>

              {loadingItems ? (
                <div className="py-3 text-zinc-500 text-center font-medium">Checking order items & lifetime cohort rules...</div>
              ) : items.length === 0 ? (
                <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 text-xs">
                  No items found in this order.
                </div>
              ) : (
                <div className="space-y-2">
                  {items.map((item) => {
                    const isSelected = selectedItemId === item.id;
                    return (
                      <div
                        key={item.id}
                        onClick={() => {
                          if (!item.isAlreadyProtected) {
                            setSelectedItemId(item.id);
                          }
                        }}
                        className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                          item.isAlreadyProtected
                            ? "bg-zinc-950/40 border-zinc-800/60 opacity-60 cursor-not-allowed"
                            : isSelected
                            ? "bg-cyan-500/10 border-cyan-500 text-white cursor-pointer shadow-xs"
                            : "bg-zinc-900 hover:bg-zinc-850 border-zinc-800 text-zinc-300 cursor-pointer"
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-xs">{item.productName}</span>
                            <span className="font-mono text-[10px] text-zinc-400 px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700">
                              SKU: {item.sku}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-zinc-400 mt-1">
                            <span>Brand: <strong className="text-zinc-200">{item.brandName}</strong></span>
                            <span>•</span>
                            <span>Order Qty: <strong className="text-zinc-200">{item.quantity} units</strong></span>
                            <span>•</span>
                            <span>Wholesale Price: <strong className="text-cyan-400 font-mono">${item.unitWholesalePrice.toFixed(2)}</strong></span>
                          </div>
                        </div>

                        {item.isAlreadyProtected ? (
                          <div className="shrink-0 text-right">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800">
                              Already Protected ({item.existingCohortCode})
                            </span>
                            <div className="text-[9px] text-zinc-500 mt-0.5">Lifetime 1-time policy</div>
                          </div>
                        ) : (
                          <div className="shrink-0">
                            <input
                              type="radio"
                              name="selected_item"
                              checked={isSelected}
                              onChange={() => setSelectedItemId(item.id)}
                              className="text-cyan-600 focus:ring-cyan-500"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* STEP E: Review & Confirm Protected Baseline */}
          {selectedItem && (
            <div className="space-y-3 p-4 rounded-xl bg-cyan-950/20 border border-cyan-800/40 text-xs">
              <div className="flex items-center justify-between border-b border-cyan-800/30 pb-2">
                <span className="font-bold text-cyan-300 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-cyan-500 text-zinc-950 flex items-center justify-center text-[10px] font-black">
                    5
                  </span>
                  <span>Review Protected Cohort Baseline</span>
                </span>
                <span className="text-[10px] text-cyan-400 font-mono">Immutable Baseline</span>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <span className="text-[10px] font-semibold text-zinc-400 block uppercase">Retailer & Store:</span>
                  <span className="font-bold text-white block mt-0.5">
                    {selectedEnrollment?.companyName} · {selectedStore?.name}
                  </span>
                  <span className="text-[10px] text-zinc-500 font-mono">
                    Store Code: {selectedStore?.storeCode || "N/A"}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] font-semibold text-zinc-400 block uppercase">Product / SKU:</span>
                  <span className="font-bold text-white block mt-0.5">{selectedItem.productName}</span>
                  <span className="text-[10px] font-mono text-cyan-400 font-bold">SKU: {selectedItem.sku}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 border-t border-cyan-900/40">
                <div>
                  <label className="text-[10px] font-semibold text-zinc-300 block uppercase mb-1">
                    Protected Quantity (Units) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={selectedItem.quantity}
                    value={customProtectedQty}
                    onChange={(e) => {
                      const val = e.target.value === "" ? "" : parseInt(e.target.value, 10);
                      setCustomProtectedQty(val);
                    }}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-white font-bold text-xs focus:outline-none focus:border-cyan-500"
                  />
                  <span className="text-[9px] text-zinc-400 block mt-0.5">Max: {selectedItem.quantity} units</span>
                </div>

                <div>
                  <span className="text-[10px] font-semibold text-zinc-400 block uppercase">
                    Frozen Wholesale Cost:
                  </span>
                  <span className="text-sm font-black font-mono text-cyan-400 block mt-1">
                    ${selectedItem.unitWholesalePrice.toFixed(2)} / unit
                  </span>
                  <span className="text-[9px] text-zinc-500 block">From confirmed order</span>
                </div>

                <div>
                  <span className="text-[10px] font-semibold text-zinc-400 block uppercase">
                    Protected Baseline Value:
                  </span>
                  <span className="text-sm font-black font-mono text-emerald-400 block mt-1">
                    ${(
                      (typeof customProtectedQty === "number" ? customProtectedQty : 0) *
                      selectedItem.unitWholesalePrice
                    ).toFixed(2)}
                  </span>
                  <span className="text-[9px] text-zinc-500 block">Option A Rate: {(Number(selectedEnrollment?.optionACreditRate || 0.4) * 100).toFixed(0)}%</span>
                </div>
              </div>

              {/* Day 0 Timeline Info */}
              <div className="p-3 rounded-lg bg-zinc-950/80 border border-zinc-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-zinc-300">
                    Day 0 Anchor: {selectedOrder?.firstShipmentDate ? `Verified (${selectedOrder.firstShipmentDate})` : "Awaiting First Shipment"}
                  </span>
                  <span className="text-[10px] font-mono text-zinc-500">Fixed Pilot Rules</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-[10px] text-zinc-400 pt-1">
                  <div>
                    <span className="block text-zinc-500">Trial End (Day 90):</span>
                    <strong className="text-zinc-200">
                      {selectedOrder?.firstShipmentDate ? addDays(selectedOrder.firstShipmentDate, 90) : "Day 0 + 90d"}
                    </strong>
                  </div>
                  <div>
                    <span className="block text-zinc-500">Evaluation (Day 100):</span>
                    <strong className="text-indigo-300">
                      {selectedOrder?.firstShipmentDate ? addDays(selectedOrder.firstShipmentDate, 100) : "Day 0 + 100d"}
                    </strong>
                  </div>
                  <div>
                    <span className="block text-zinc-500">Claim Deadline (Day 150):</span>
                    <strong className="text-zinc-200">
                      {selectedOrder?.firstShipmentDate ? addDays(selectedOrder.firstShipmentDate, 150) : "Day 0 + 150d"}
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold text-xs transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!selectedItem || isPending}
            onClick={handleSubmit}
            className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            <span>{isPending ? "Registering Cohort..." : "Confirm & Register Protected Cohort"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
