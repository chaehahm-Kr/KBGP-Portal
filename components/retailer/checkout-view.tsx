"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useCart } from "@/components/retailer/cart-context";
import { submitRetailerOrder } from "@/lib/retailer/orders";
import {
  RetailerPaymentEligibility,
  RetailerPaymentMethod,
} from "@/lib/retailer/payment-types";

interface StoreOption {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  phone: string | null;
}

interface CheckoutViewProps {
  companyName: string;
  userEmail: string;
  paymentEligibility: RetailerPaymentEligibility;
  stores: StoreOption[];
}

export function RetailerCheckoutView({
  companyName,
  userEmail,
  paymentEligibility,
  stores,
}: CheckoutViewProps) {
  const { items, subtotal, totalUnits, totalSkus, clearCart, isLoading } = useCart();
  const [selectedStoreId, setSelectedStoreId] = useState<string>(
    stores.length > 0 ? stores[0].id : ""
  );

  // Default to first available payment method or 'terms' if approved
  const defaultMethod =
    paymentEligibility.availableMethods.find((m) => m.id === "terms")?.id ||
    paymentEligibility.availableMethods[0]?.id ||
    "card";

  const [selectedPaymentMethod, setSelectedPaymentMethod] =
    useState<RetailerPaymentMethod>(defaultMethod);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedOrder, setSubmittedOrder] = useState<{
    orderId: string;
    orderNumber: string;
    paymentMethod: RetailerPaymentMethod;
    termsLabel?: string;
  } | null>(null);

  const selectedStore = stores.find((s) => s.id === selectedStoreId) || stores[0] || null;

  const currentMethodObj = paymentEligibility.availableMethods.find(
    (m) => m.id === selectedPaymentMethod
  );

  const isExceedingCreditLimit =
    selectedPaymentMethod === "terms" &&
    paymentEligibility.creditLimit > 0 &&
    subtotal > paymentEligibility.creditLimit;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) return;

    if (isExceedingCreditLimit) {
      setSubmitError(
        `Order total ($${subtotal.toFixed(2)}) exceeds your approved credit line ($${paymentEligibility.creditLimit.toLocaleString()}). Please adjust quantity or select Prepaid Card/ACH.`
      );
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const result = await submitRetailerOrder({
        storeId: selectedStoreId || undefined,
        paymentMethod: selectedPaymentMethod,
        notes: notes.trim() || undefined,
        items: items.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
        })),
      });

      if (result.success && result.orderId && result.orderNumber) {
        clearCart();
        setSubmittedOrder({
          orderId: result.orderId,
          orderNumber: result.orderNumber,
          paymentMethod: selectedPaymentMethod,
          termsLabel: currentMethodObj?.termsLabel,
        });
      } else {
        setSubmitError(result.error || "Failed to submit order. Please try again.");
      }
    } catch (err: any) {
      setSubmitError(err.message || "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // 1. Success Screen
  if (submittedOrder) {
    const isTerms = submittedOrder.paymentMethod === "terms";
    return (
      <div className="max-w-2xl mx-auto py-8 sm:py-12 space-y-6 text-center">
        <div className="rounded-3xl border border-emerald-500/20 bg-gradient-to-b from-emerald-500/5 to-transparent dark:from-emerald-500/10 p-8 sm:p-12 shadow-sm space-y-6">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center text-3xl font-black shadow-inner">
            ✓
          </div>

          <div className="space-y-2">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
              Order Successfully Submitted
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white tracking-tight">
              Order #{submittedOrder.orderNumber}
            </h1>
            <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
              Your store purchase order has been recorded in the K SELECT HUB system and forwarded to the operations team for dispatch preparation.
            </p>
          </div>

          {/* Quick Details Box */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 text-left text-xs space-y-3">
            <div className="flex justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2">
              <span className="text-zinc-500">Retailer Company:</span>
              <span className="font-bold text-zinc-900 dark:text-white">{companyName}</span>
            </div>
            {selectedStore && (
              <div className="flex justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2">
                <span className="text-zinc-500">Delivery Destination:</span>
                <span className="font-semibold text-zinc-900 dark:text-white">{selectedStore.name}</span>
              </div>
            )}
            <div className="flex justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2">
              <span className="text-zinc-500">Payment Arrangement:</span>
              <span className="font-semibold text-zinc-900 dark:text-white capitalize">
                {isTerms
                  ? `${submittedOrder.termsLabel || "Net Terms"} (Formal Invoice Arranged)`
                  : submittedOrder.paymentMethod === "ach"
                  ? "ACH Bank Transfer (Invoice Settlement)"
                  : "Credit / Debit Card (Prepaid Settlement)"}
              </span>
            </div>
            <div className="flex justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2">
              <span className="text-zinc-500">Payment Status:</span>
              <span className="font-bold text-amber-600 dark:text-amber-400">
                Unpaid (Pending Dispatch & Fulfillment)
              </span>
            </div>
            <div className="flex justify-between items-baseline pt-1">
              <span className="text-zinc-500 font-medium">Order Total:</span>
              <span className="text-lg font-black text-zinc-900 dark:text-white">
                ${subtotal.toFixed(2)}
              </span>
            </div>
          </div>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Link
              href={`/orders/${submittedOrder.orderNumber}`}
              className="py-3 px-6 rounded-xl font-bold text-xs sm:text-sm bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 hover:opacity-90 transition-opacity"
            >
              View Order Details →
            </Link>
            <Link
              href="/orders"
              className="py-3 px-6 rounded-xl font-semibold text-xs sm:text-sm bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            >
              All Store Orders
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 2. Empty Cart Check
  if (!isLoading && items.length === 0) {
    return (
      <div className="py-16 text-center space-y-4">
        <h2 className="text-lg font-bold text-zinc-900 dark:text-white">
          No items to checkout
        </h2>
        <p className="text-xs text-zinc-500">Your cart is currently empty.</p>
        <Link
          href="/products"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-zinc-900 dark:bg-white text-white dark:text-zinc-950"
        >
          Browse Products →
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Page Title */}
      <div className="border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <nav className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 mb-2">
          <Link href="/cart" className="hover:underline">
            ← Back to Cart
          </Link>
        </nav>
        <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white tracking-tight">
          Order Review & Payment Setup
        </h1>
        <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          Review destination store location, select approved payment method/terms, and snapshot wholesale pricing.
        </p>
      </div>

      {submitError && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-600 dark:text-red-400 flex items-start gap-2.5">
          <span className="font-bold">✕</span>
          <span>{submitError}</span>
        </div>
      )}

      {/* Two Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Delivery Destination, Payment Selection, Items Review (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* 1. Delivery Destination */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-900 dark:text-white">
                1. Delivery Destination Store
              </h2>
              <span className="text-xs font-medium text-zinc-500">
                {companyName}
              </span>
            </div>

            {stores.length > 1 ? (
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Select Destination Store
                </label>
                <select
                  value={selectedStoreId}
                  onChange={(e) => setSelectedStoreId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.city || "Main"}, {s.state || "US"})
                    </option>
                  ))}
                </select>
              </div>
            ) : selectedStore ? (
              <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-800 text-xs space-y-1">
                <div className="font-bold text-zinc-900 dark:text-white">
                  📍 {selectedStore.name}
                </div>
                {selectedStore.address && (
                  <p className="text-zinc-500 dark:text-zinc-400">
                    {selectedStore.address}, {selectedStore.city} {selectedStore.state} {selectedStore.zip}
                  </p>
                )}
                {selectedStore.phone && (
                  <p className="text-zinc-400">Phone: {selectedStore.phone}</p>
                )}
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 text-xs text-zinc-500">
                Main Company Delivery Destination ({companyName})
              </div>
            )}

            {/* Special Instructions / Notes */}
            <div className="space-y-1.5 pt-2">
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Delivery Instructions / Order Notes (Optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="e.g. Receiving dock instructions, preferred delivery schedule, store PO #..."
                className="w-full px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          </div>

          {/* 2. Payment Method & Terms Selection */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-900 dark:text-white">
                2. Authorized Payment Method
              </h2>
              <span className="text-[11px] text-zinc-500 font-medium">
                Approved terms & methods
              </span>
            </div>

            <div className="space-y-3">
              {paymentEligibility.availableMethods.length === 0 ? (
                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-700 dark:text-amber-300">
                  No payment methods are currently enabled for your account. Please contact K SELECT Admin support.
                </div>
              ) : (
                paymentEligibility.availableMethods.map((method) => {
                  const isSelected = selectedPaymentMethod === method.id;
                  return (
                    <label
                      key={method.id}
                      className={`block p-4 rounded-2xl border transition-all cursor-pointer ${
                        isSelected
                          ? "border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 ring-2 ring-indigo-600/20 shadow-xs"
                          : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900"
                      }`}
                    >
                      <div className="flex items-start gap-3.5">
                        <input
                          type="radio"
                          name="paymentMethod"
                          value={method.id}
                          checked={isSelected}
                          onChange={() => setSelectedPaymentMethod(method.id)}
                          className="mt-1 h-4 w-4 text-indigo-600 border-zinc-300 focus:ring-indigo-500"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-xs sm:text-sm text-zinc-900 dark:text-white">
                              {method.label}
                            </span>
                            {method.badge && (
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                  method.isTerms
                                    ? "bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800"
                                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700"
                                }`}
                              >
                                {method.badge}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 leading-relaxed">
                            {method.description}
                          </p>
                        </div>
                      </div>
                    </label>
                  );
                })
              )}
            </div>

            {/* Credit Limit & Terms Notice */}
            {selectedPaymentMethod === "terms" && (
              <div className="mt-3 p-3.5 rounded-xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200/80 dark:border-purple-800/60 text-xs space-y-1.5">
                <div className="flex items-center justify-between font-bold text-purple-900 dark:text-purple-200">
                  <span>🏢 Account Credit Line</span>
                  <span>
                    {paymentEligibility.creditLimit > 0
                      ? `$${paymentEligibility.creditLimit.toLocaleString()} USD`
                      : "Uncapped Authorized Credit"}
                  </span>
                </div>
                <p className="text-[11px] text-purple-700 dark:text-purple-300 leading-relaxed">
                  No upfront charge at checkout. A formal commercial invoice will be issued upon dispatch with payment due according to your {currentMethodObj?.termsLabel || "Net Terms"}.
                </p>
              </div>
            )}
          </div>

          {/* 3. Items Review Table */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 sm:p-6 shadow-xs space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-900 dark:text-white border-b border-zinc-100 dark:border-zinc-800 pb-3">
              3. Order Items ({totalSkus} SKUs • {totalUnits} Units)
            </h2>

            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {items.map((item) => (
                <div key={item.productId} className="py-3 flex items-center justify-between gap-4 text-xs">
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] uppercase font-bold text-indigo-600 dark:text-indigo-400">
                      {item.brandName}
                    </div>
                    <div className="font-semibold text-zinc-900 dark:text-white truncate">
                      {item.productName}
                    </div>
                    <div className="text-zinc-400 font-mono text-[11px]">
                      {item.quantity} units @ ${item.wholesalePrice.toFixed(2)}/ea
                    </div>
                  </div>
                  <div className="text-right font-bold text-zinc-900 dark:text-white text-sm">
                    ${item.lineTotal.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Order Confirmation Box (5 cols) */}
        <div className="lg:col-span-5 space-y-4 sticky top-20">
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-gradient-to-br from-zinc-50 to-white dark:from-zinc-900 dark:to-zinc-950 p-6 shadow-xs space-y-5">
            <h2 className="text-base font-bold text-zinc-900 dark:text-white border-b border-zinc-200 dark:border-zinc-800 pb-3">
              Final Order Summary
            </h2>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                <span>Selected Method:</span>
                <span className="font-semibold text-zinc-900 dark:text-white">
                  {currentMethodObj?.label || "Credit / Debit Card"}
                </span>
              </div>
              <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                <span>Total SKUs:</span>
                <span className="font-semibold text-zinc-900 dark:text-white">{totalSkus}</span>
              </div>
              <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                <span>Total Units:</span>
                <span className="font-semibold text-zinc-900 dark:text-white">{totalUnits} units</span>
              </div>
              <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                <span>Wholesale Subtotal:</span>
                <span className="font-bold text-sm text-zinc-900 dark:text-white">
                  ${subtotal.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-zinc-500">
                <span>Shipping & Freight:</span>
                <span className="italic text-zinc-400">Calculated at dispatch</span>
              </div>
              <div className="flex justify-between text-zinc-500">
                <span>Sales Tax:</span>
                <span className="italic text-zinc-400">Exempt (Resale / Wholesale)</span>
              </div>
            </div>

            <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 flex justify-between items-baseline">
              <div>
                <div className="text-xs font-bold text-zinc-900 dark:text-white">Total Amount</div>
                <div className="text-[10px] text-zinc-400">Authoritative B2B Total</div>
              </div>
              <div className="text-2xl font-black text-zinc-900 dark:text-white">
                ${subtotal.toFixed(2)}
              </div>
            </div>

            <div className="pt-2 space-y-3">
              <button
                type="submit"
                disabled={isSubmitting || items.length === 0 || isExceedingCreditLimit}
                className="w-full py-4 px-6 rounded-xl font-bold text-sm bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md cursor-pointer flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    <span>Submitting Order...</span>
                  </>
                ) : (
                  <>
                    <span>Submit Store Order</span>
                    <span>→</span>
                  </>
                )}
              </button>

              <p className="text-[11px] text-center text-zinc-400 dark:text-zinc-500 leading-tight">
                By submitting, you confirm authorization to place wholesale purchase orders on behalf of {companyName}.
              </p>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
