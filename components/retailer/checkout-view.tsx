"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/retailer/cart-context";
import { submitRetailerOrder } from "@/lib/retailer/orders";

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
  paymentTerms: string;
  termsApproved: boolean;
  stores: StoreOption[];
}

export function RetailerCheckoutView({
  companyName,
  userEmail,
  paymentTerms,
  termsApproved,
  stores,
}: CheckoutViewProps) {
  const router = useRouter();
  const { items, subtotal, totalUnits, totalSkus, clearCart, isLoading } = useCart();
  const [selectedStoreId, setSelectedStoreId] = useState<string>(
    stores.length > 0 ? stores[0].id : ""
  );
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedOrder, setSubmittedOrder] = useState<{
    orderId: string;
    orderNumber: string;
  } | null>(null);

  const selectedStore = stores.find((s) => s.id === selectedStoreId) || stores[0] || null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const result = await submitRetailerOrder({
        storeId: selectedStoreId || undefined,
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
              <span className="text-zinc-500">Payment Status:</span>
              <span className="font-semibold text-amber-600 dark:text-amber-400">
                Unpaid (Terms Invoice Arranged by K SELECT)
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
          Order Review & Confirmation
        </h1>
        <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          Review destination store, approved terms, and snapshot pricing before placing your order.
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
        {/* Left Column: Delivery Destination & Terms Review (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* 1. Delivery Destination */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-900 dark:text-white">
                1. Delivery Destination
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
                placeholder="e.g. Receiving dock instructions, preferred delivery days, store PO #..."
                className="w-full px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          </div>

          {/* 2. Commercial Terms Notice */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 sm:p-6 shadow-xs space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-900 dark:text-white border-b border-zinc-100 dark:border-zinc-800 pb-3">
              2. Commercial Terms & Payment Status
            </h2>

            <div className="flex items-start gap-3 p-4 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 text-xs">
              <span className="text-lg">💳</span>
              <div className="space-y-1">
                <div className="font-bold text-zinc-900 dark:text-white">
                  Payment Arrangement: {paymentTerms.replace(/_/g, " ")}
                </div>
                <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  No payment method will be charged at this moment. Upon order submission, K SELECT Operations will confirm inventory allocation and provide the formal B2B invoice according to your approved credit terms.
                </p>
              </div>
            </div>
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
                <div className="text-[10px] text-zinc-400">Wholesale B2B Total</div>
              </div>
              <div className="text-2xl font-black text-zinc-900 dark:text-white">
                ${subtotal.toFixed(2)}
              </div>
            </div>

            <div className="pt-2 space-y-3">
              <button
                type="submit"
                disabled={isSubmitting || items.length === 0}
                className="w-full py-4 px-6 rounded-xl font-bold text-sm bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md cursor-pointer flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    <span>Placing Your Order...</span>
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
