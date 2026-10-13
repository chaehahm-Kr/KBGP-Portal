"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useCart } from "@/components/retailer/cart-context";
import { submitRetailerOrder } from "@/lib/retailer/orders";
import {
  RetailerPaymentEligibility,
  RetailerPaymentMethod,
} from "@/lib/retailer/payment-types";
import { calculateProcessingFee } from "@/lib/retailer/payment-policy";
import { evaluateCartPromotionsAction } from "@/lib/retailer/promotion-actions";
import { type EvaluatePromotionResult } from "@/lib/retailer/promotion-types";
import { validateRetailerCartItemsAction } from "@/lib/retailer/purchase-limit-actions";
import { CartItemImage } from "@/components/retailer/cart-item-image";
import type {
  RetailerShippingAddress,
  ShippingDestinationType,
} from "@/lib/retailer/shipping-address-types";

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
  savedAddresses?: RetailerShippingAddress[];
}

export function RetailerCheckoutView({
  companyName,
  userEmail,
  paymentEligibility,
  stores,
  savedAddresses = [],
}: CheckoutViewProps) {
  const { items, subtotal, totalUnits, totalSkus, couponCode, clearCart, isLoading, syncItemThumbnails } = useCart();

  // 1. Destination Delivery States (Store, Saved Shipping Address, One-Time Address)
  const [destinationType, setDestinationType] = useState<ShippingDestinationType>(() => {
    if (stores && stores.length > 0) return "store";
    if (savedAddresses && savedAddresses.length > 0) return "saved_address";
    return "custom_address";
  });

  const [selectedStoreId, setSelectedStoreId] = useState<string>(() => {
    return stores.length > 0 ? stores[0].id : "";
  });

  const [selectedSavedAddressId, setSelectedSavedAddressId] = useState<string>(() => {
    if (!savedAddresses || savedAddresses.length === 0) return "";
    const defaultAddr = savedAddresses.find((a) => a.isDefault);
    return defaultAddr ? defaultAddr.id : savedAddresses[0].id;
  });

  // Custom / One-Time Address form state
  const [customRecipient, setCustomRecipient] = useState(companyName || "");
  const [customAttention, setCustomAttention] = useState("");
  const [customAddress1, setCustomAddress1] = useState("");
  const [customAddress2, setCustomAddress2] = useState("");
  const [customCity, setCustomCity] = useState("");
  const [customState, setCustomState] = useState("");
  const [customZip, setCustomZip] = useState("");
  const [customPhone, setCustomPhone] = useState("");
  const [customNotes, setCustomNotes] = useState("");
  const [saveCustomAddress, setSaveCustomAddress] = useState(false);
  const [customLabel, setCustomLabel] = useState("");

  const [promoEvaluation, setPromoEvaluation] = useState<EvaluatePromotionResult | null>(null);
  const [productThumbnails, setProductThumbnails] = useState<Record<string, string | null>>({});
  const [productGalleries, setProductGalleries] = useState<Record<string, string[]>>({});

  // Track unique product IDs to prevent repetitive image validations
  const productIdsKey = useMemo(() => {
    return items.map((i) => i.productId).sort().join(",");
  }, [items]);

  // Sync fresh authoritative image URLs only when product set changes
  useEffect(() => {
    if (productIdsKey) {
      const ids = Array.from(new Set(items.map((i) => i.productId)));
      validateRetailerCartItemsAction(ids)
        .then((res) => {
          if (res.success) {
            if (res.thumbnails) {
              setProductThumbnails(res.thumbnails);
              syncItemThumbnails(res.thumbnails);
            }
            if (res.imageGalleries) {
              setProductGalleries(res.imageGalleries);
            }
          }
        })
        .catch((err) => console.error("Checkout image validation failed:", err));
    }
  }, [productIdsKey, syncItemThumbnails]);

  const checkoutPromoSignature = useMemo(() => {
    return items.map((i) => `${i.productId}:${i.quantity}:${i.wholesalePrice}:${i.discountPercent || 0}`).join("|");
  }, [items]);

  useEffect(() => {
    if (items.length > 0) {
      evaluateCartPromotionsAction(
        items.map((i) => ({
          productId: i.productId,
          wholesalePrice: i.wholesalePrice,
          quantity: i.quantity,
          lineTotal: i.lineTotal,
          discountPercent: i.discountPercent,
          appliedReason: i.appliedReason,
        })),
        couponCode
      )
        .then(setPromoEvaluation)
        .catch((err) => console.error("Checkout promo eval failed:", err));
    } else {
      setPromoEvaluation(null);
    }
  }, [checkoutPromoSignature, couponCode]);

  const discountAmount = promoEvaluation?.totalDiscount || 0;
  const effectiveTotal = Math.max(0, subtotal - discountAmount);

  // Default payment method: Prioritize Card, then ACH, then Terms (Never auto-default to Terms)
  const defaultMethod: RetailerPaymentMethod =
    paymentEligibility.availableMethods.find((m) => m.id === "card" && !m.disabled)?.id ||
    paymentEligibility.availableMethods.find((m) => m.id === "ach" && !m.disabled)?.id ||
    paymentEligibility.availableMethods.find((m) => !m.disabled)?.id ||
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
    totalAmount: number;
    feeAmount: number;
    destinationSummary?: string;
  } | null>(null);

  const selectedStore = stores.find((s) => s.id === selectedStoreId) || stores[0] || null;
  const selectedSavedAddress =
    savedAddresses.find((a) => a.id === selectedSavedAddressId) || savedAddresses[0] || null;

  // Selected Destination Summary Memo
  const destinationSummary = useMemo(() => {
    if (destinationType === "store") {
      if (!selectedStore) return { title: "Store Destination", addressText: "No store selected", type: "store" };
      const parts = [
        selectedStore.address,
        [selectedStore.city, selectedStore.state, selectedStore.zip].filter(Boolean).join(" "),
      ].filter(Boolean);
      return {
        title: `Store: ${selectedStore.name}`,
        addressText: parts.join(", ") || "Address on file",
        phone: selectedStore.phone,
        type: "store",
      };
    } else if (destinationType === "saved_address") {
      if (!selectedSavedAddress) {
        return { title: "Saved Shipping Address", addressText: "No saved address selected", type: "saved_address" };
      }
      const lines = [
        selectedSavedAddress.recipientName,
        selectedSavedAddress.attentionName ? `Attn: ${selectedSavedAddress.attentionName}` : null,
        selectedSavedAddress.addressLine1,
        selectedSavedAddress.addressLine2,
        `${selectedSavedAddress.city}, ${selectedSavedAddress.state} ${selectedSavedAddress.zip}`,
        selectedSavedAddress.country && selectedSavedAddress.country !== "US" ? selectedSavedAddress.country : null,
      ].filter(Boolean);
      return {
        title: `Saved: ${selectedSavedAddress.label}`,
        addressText: lines.join(", "),
        phone: selectedSavedAddress.phone,
        deliveryNotes: selectedSavedAddress.deliveryNotes,
        type: "saved_address",
      };
    } else {
      const parts = [
        customRecipient || "Recipient Pending",
        customAttention ? `Attn: ${customAttention}` : null,
        customAddress1,
        customAddress2,
        [customCity, customState, customZip].filter(Boolean).join(" "),
      ].filter(Boolean);
      return {
        title: customLabel ? `One-Time: ${customLabel}` : "One-Time Shipping Address",
        addressText: parts.join(", ") || "Address entry in progress",
        phone: customPhone,
        deliveryNotes: customNotes,
        type: "custom_address",
      };
    }
  }, [
    destinationType,
    selectedStore,
    selectedSavedAddress,
    customRecipient,
    customAttention,
    customAddress1,
    customAddress2,
    customCity,
    customState,
    customZip,
    customPhone,
    customNotes,
    customLabel,
  ]);

  const currentMethodObj = paymentEligibility.availableMethods.find(
    (m) => m.id === selectedPaymentMethod
  );

  const processingFeeResult = calculateProcessingFee({
    paymentMethod: selectedPaymentMethod,
    chargeBase: effectiveTotal,
    effectivePolicy: paymentEligibility.effectivePolicy,
  });

  const finalPayableTotal = Number(
    (effectiveTotal + processingFeeResult.feeAmount).toFixed(2)
  );

  // Authoritative Available Credit Check
  const openAr = paymentEligibility.effectivePolicy?.terms?.openArBalance ?? 0;
  const availableCredit =
    paymentEligibility.effectivePolicy?.terms?.availableCredit !== undefined &&
    paymentEligibility.effectivePolicy?.terms?.availableCredit !== null
      ? paymentEligibility.effectivePolicy.terms.availableCredit
      : paymentEligibility.creditLimit;

  const isExceedingCreditLimit =
    selectedPaymentMethod === "terms" &&
    paymentEligibility.creditLimit > 0 &&
    finalPayableTotal > availableCredit;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) return;

    // Validate Destination
    if (destinationType === "store" && !selectedStoreId && stores.length > 0) {
      setSubmitError("Please select a destination store location.");
      return;
    }
    if (destinationType === "saved_address" && !selectedSavedAddressId) {
      setSubmitError("Please select a saved shipping address, or switch to one-time address.");
      return;
    }
    if (destinationType === "custom_address") {
      if (
        !customRecipient.trim() ||
        !customAddress1.trim() ||
        !customCity.trim() ||
        !customState.trim() ||
        !customZip.trim()
      ) {
        setSubmitError("Please fill in recipient name, address line 1, city, state, and zip code for the shipping destination.");
        return;
      }
    }

    if (isExceedingCreditLimit) {
      setSubmitError(
        `Your available credit line ($${availableCredit.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}) is less than this order total ($${finalPayableTotal.toFixed(2)}). Please choose Card or ACH.`
      );
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const result = await submitRetailerOrder({
        destinationType,
        storeId: destinationType === "store" ? selectedStoreId || undefined : undefined,
        savedAddressId: destinationType === "saved_address" ? selectedSavedAddressId || undefined : undefined,
        customShippingAddress:
          destinationType === "custom_address"
            ? {
                recipientName: customRecipient.trim(),
                attentionName: customAttention.trim() || undefined,
                addressLine1: customAddress1.trim(),
                addressLine2: customAddress2.trim() || undefined,
                city: customCity.trim(),
                state: customState.trim().toUpperCase(),
                zip: customZip.trim(),
                country: "US",
                phone: customPhone.trim() || undefined,
                deliveryNotes: customNotes.trim() || undefined,
                label: customLabel.trim() || undefined,
                saveToAddressBook: saveCustomAddress,
              }
            : undefined,
        paymentMethod: selectedPaymentMethod,
        notes: notes.trim() || undefined,
        couponCode: couponCode || undefined,
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
          totalAmount: finalPayableTotal,
          feeAmount: processingFeeResult.feeAmount,
          destinationSummary: `${destinationSummary.title} — ${destinationSummary.addressText}`,
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
            {submittedOrder.destinationSummary && (
              <div className="flex justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2">
                <span className="text-zinc-500">Delivery Destination:</span>
                <span className="font-semibold text-zinc-900 dark:text-white max-w-xs text-right truncate">
                  {submittedOrder.destinationSummary}
                </span>
              </div>
            )}
            <div className="flex justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2">
              <span className="text-zinc-500">Payment Arrangement:</span>
              <span className="font-semibold text-zinc-900 dark:text-white">
                {isTerms
                  ? `${submittedOrder.termsLabel || "Net Terms"} (Commercial Invoice upon Dispatch)`
                  : submittedOrder.paymentMethod === "ach"
                  ? "ACH Bank Transfer (Invoice / Manual Settlement)"
                  : "Credit / Debit Card (Manual / Invoice Settlement)"}
              </span>
            </div>
            <div className="flex justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2">
              <span className="text-zinc-500">Payment Status:</span>
              <span className="font-bold text-amber-600 dark:text-amber-400">
                Unpaid (Order Recorded — Pending Dispatch & Fulfillment)
              </span>
            </div>
            {submittedOrder.feeAmount > 0 && (
              <div className="flex justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2">
                <span className="text-zinc-500">Processing Fee:</span>
                <span className="font-semibold text-zinc-900 dark:text-white">
                  +${submittedOrder.feeAmount.toFixed(2)}
                </span>
              </div>
            )}
            <div className="flex justify-between items-baseline pt-1">
              <span className="text-zinc-500 font-medium">Order Total:</span>
              <span className="text-lg font-black text-zinc-900 dark:text-white">
                ${submittedOrder.totalAmount.toFixed(2)}
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
          Review destination shipping location, select authorized payment method/terms, and snapshot wholesale pricing.
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
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-900 dark:text-white">
                  1. Delivery Destination
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Select a store, saved warehouse address, or enter a one-time destination.
                </p>
              </div>
              <span className="text-xs font-semibold text-zinc-500 hidden sm:inline">
                {companyName}
              </span>
            </div>

            {/* Destination Mode Tabs */}
            <div className="flex rounded-xl bg-zinc-100 dark:bg-zinc-800/70 p-1 gap-1 text-xs">
              <button
                type="button"
                onClick={() => setDestinationType("store")}
                className={`flex-1 py-2 px-3 rounded-lg font-semibold transition-all ${
                  destinationType === "store"
                    ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                }`}
              >
                🏬 Store ({stores.length})
              </button>
              <button
                type="button"
                onClick={() => setDestinationType("saved_address")}
                className={`flex-1 py-2 px-3 rounded-lg font-semibold transition-all ${
                  destinationType === "saved_address"
                    ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                }`}
              >
                🏢 Saved Address ({savedAddresses.length})
              </button>
              <button
                type="button"
                onClick={() => setDestinationType("custom_address")}
                className={`flex-1 py-2 px-3 rounded-lg font-semibold transition-all ${
                  destinationType === "custom_address"
                    ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                }`}
              >
                ➕ One-Time Address
              </button>
            </div>

            {/* Option A: Store Address */}
            {destinationType === "store" && (
              <div className="space-y-3 pt-1">
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
                ) : stores.length === 0 ? (
                  <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-700 dark:text-amber-300 space-y-2">
                    <p>No active store records found for your account.</p>
                    <button
                      type="button"
                      onClick={() => setDestinationType("custom_address")}
                      className="font-bold underline text-xs"
                    >
                      Enter One-Time Address →
                    </button>
                  </div>
                ) : null}

                {selectedStore && (
                  <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-800 text-xs space-y-1">
                    <div className="font-bold text-zinc-900 dark:text-white flex items-center justify-between">
                      <span>📍 {selectedStore.name}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-200/70 dark:bg-zinc-700 font-semibold text-zinc-700 dark:text-zinc-300">
                        Store Record
                      </span>
                    </div>
                    {selectedStore.address && (
                      <p className="text-zinc-600 dark:text-zinc-300">
                        {selectedStore.address}
                        {selectedStore.city || selectedStore.state || selectedStore.zip
                          ? `, ${[selectedStore.city, selectedStore.state, selectedStore.zip].filter(Boolean).join(" ")}`
                          : ""}
                      </p>
                    )}
                    {selectedStore.phone && (
                      <p className="text-zinc-400">Phone: {selectedStore.phone}</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Option B: Saved Shipping Address */}
            {destinationType === "saved_address" && (
              <div className="space-y-3 pt-1">
                {savedAddresses.length > 0 ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                        Choose Saved Shipping Address
                      </label>
                      <Link
                        href="/settings/shipping"
                        target="_blank"
                        className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
                      >
                        Manage Addresses ↗
                      </Link>
                    </div>
                    <select
                      value={selectedSavedAddressId}
                      onChange={(e) => setSelectedSavedAddressId(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    >
                      {savedAddresses.map((addr) => (
                        <option key={addr.id} value={addr.id}>
                          {addr.label} — {addr.recipientName} ({addr.city}, {addr.state}) {addr.isDefault ? "[Default]" : ""}
                        </option>
                      ))}
                    </select>

                    {selectedSavedAddress && (
                      <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-800 text-xs space-y-1.5">
                        <div className="flex items-center justify-between font-bold text-zinc-900 dark:text-white">
                          <span>🏢 {selectedSavedAddress.label}</span>
                          {selectedSavedAddress.isDefault && (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 font-bold">
                              Default
                            </span>
                          )}
                        </div>
                        <p className="text-zinc-700 dark:text-zinc-200 font-medium">
                          {selectedSavedAddress.recipientName}
                          {selectedSavedAddress.attentionName ? ` (Attn: ${selectedSavedAddress.attentionName})` : ""}
                        </p>
                        <p className="text-zinc-500 dark:text-zinc-400">
                          {selectedSavedAddress.addressLine1}
                          {selectedSavedAddress.addressLine2 ? `, ${selectedSavedAddress.addressLine2}` : ""}
                        </p>
                        <p className="text-zinc-500 dark:text-zinc-400">
                          {selectedSavedAddress.city}, {selectedSavedAddress.state} {selectedSavedAddress.zip}
                        </p>
                        {selectedSavedAddress.phone && (
                          <p className="text-zinc-400">Phone: {selectedSavedAddress.phone}</p>
                        )}
                        {selectedSavedAddress.deliveryNotes && (
                          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 italic bg-white dark:bg-zinc-900 p-2 rounded-lg border border-zinc-200/60 dark:border-zinc-800">
                            Notes: {selectedSavedAddress.deliveryNotes}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/80 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-400 space-y-2">
                    <p>You do not have any saved shipping addresses yet.</p>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setDestinationType("custom_address")}
                        className="px-3 py-1.5 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 font-bold text-xs"
                      >
                        Enter One-Time Address
                      </button>
                      <Link
                        href="/settings/shipping"
                        target="_blank"
                        className="text-indigo-600 dark:text-indigo-400 font-medium underline"
                      >
                        Add to Address Book ↗
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Option C: One-Time Custom Shipping Address */}
            {destinationType === "custom_address" && (
              <div className="space-y-3 pt-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Recipient / Company Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Acme Receiving Dept"
                      value={customRecipient}
                      onChange={(e) => setCustomRecipient(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Attention / Dept / C/O (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Bay 4 Receiving"
                      value={customAttention}
                      onChange={(e) => setCustomAttention(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Address Line 1 *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Street address, building, or dock"
                      value={customAddress1}
                      onChange={(e) => setCustomAddress1(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Address Line 2 (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="Suite, Unit, Dock, Floor"
                      value={customAddress2}
                      onChange={(e) => setCustomAddress2(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      City *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Fort Lee"
                      value={customCity}
                      onChange={(e) => setCustomCity(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      State *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. NJ"
                      maxLength={10}
                      value={customState}
                      onChange={(e) => setCustomState(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      ZIP Code *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 07024"
                      value={customZip}
                      onChange={(e) => setCustomZip(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Phone Number (Optional)
                    </label>
                    <input
                      type="tel"
                      placeholder="e.g. 201-555-0199"
                      value={customPhone}
                      onChange={(e) => setCustomPhone(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Receiving / Dock Notes (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Liftgate required"
                      value={customNotes}
                      onChange={(e) => setCustomNotes(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                </div>

                {/* Auto-save to address book checkbox */}
                <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-800 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-zinc-800 dark:text-zinc-200">
                    <input
                      type="checkbox"
                      checked={saveCustomAddress}
                      onChange={(e) => setSaveCustomAddress(e.target.checked)}
                      className="h-4 w-4 rounded text-indigo-600 border-zinc-300 focus:ring-indigo-500"
                    />
                    <span>Save this address to Address Book for future orders</span>
                  </label>
                  {saveCustomAddress && (
                    <input
                      type="text"
                      placeholder="Address Label (e.g. East Distribution Hub, Secaucus Warehouse)"
                      value={customLabel}
                      onChange={(e) => setCustomLabel(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  )}
                </div>
              </div>
            )}

            {/* Special Instructions / Notes */}
            <div className="space-y-1.5 pt-2 border-t border-zinc-100 dark:border-zinc-800">
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
                  const isDisabled = Boolean(method.disabled);
                  const estimatedMethodFee = calculateProcessingFee({
                    paymentMethod: method.id,
                    chargeBase: effectiveTotal,
                    effectivePolicy: paymentEligibility.effectivePolicy,
                  });

                  return (
                    <div
                      key={method.id}
                      onClick={() => {
                        if (!isDisabled) {
                          setSelectedPaymentMethod(method.id);
                        }
                      }}
                      className={`block p-4 rounded-2xl border transition-all ${
                        isDisabled
                          ? "border-zinc-200/60 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-800/30 opacity-70 cursor-not-allowed"
                          : isSelected
                          ? "border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 ring-2 ring-indigo-600/20 shadow-xs cursor-pointer"
                          : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900 cursor-pointer"
                      }`}
                    >
                      <div className="flex items-start gap-3.5">
                        <input
                          type="radio"
                          name="paymentMethod"
                          value={method.id}
                          checked={isSelected}
                          disabled={isDisabled}
                          onChange={() => {
                            if (!isDisabled) setSelectedPaymentMethod(method.id);
                          }}
                          className="mt-1 h-4 w-4 text-indigo-600 border-zinc-300 focus:ring-indigo-500 disabled:opacity-40"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span
                              className={`font-bold text-xs sm:text-sm ${
                                isDisabled ? "text-zinc-500 dark:text-zinc-400" : "text-zinc-900 dark:text-white"
                              }`}
                            >
                              {method.label}
                            </span>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {/* Fee Disclosure Badge */}
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                  estimatedMethodFee.feeAmount === 0
                                    ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                                    : "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                                }`}
                              >
                                {estimatedMethodFee.disclosureLabel}
                              </span>

                              {/* Estimated Fee Amount Tag */}
                              {estimatedMethodFee.feeAmount > 0 && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                                  {estimatedMethodFee.estimatedFeeText}
                                </span>
                              )}

                              {method.badge && (
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                    isDisabled
                                      ? "bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800"
                                      : method.isTerms
                                      ? "bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800"
                                      : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700"
                                  }`}
                                >
                                  {method.badge}
                                </span>
                              )}
                            </div>
                          </div>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                            {method.description}
                          </p>

                          {/* Disabled Reason Notice */}
                          {isDisabled && method.disabledReason && (
                            <div className="mt-2.5 p-2.5 rounded-xl bg-red-50/80 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-[11px] text-red-700 dark:text-red-300 leading-snug flex items-start gap-1.5">
                              <span className="font-bold">⚠️</span>
                              <span>{method.disabledReason}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Credit Limit & Terms Notice */}
            {selectedPaymentMethod === "terms" && (
              <div className="mt-3 p-4 rounded-xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200/80 dark:border-purple-800/60 text-xs space-y-3">
                <div className="flex items-center justify-between font-bold text-purple-900 dark:text-purple-200 border-b border-purple-200/60 dark:border-purple-800/60 pb-2">
                  <span>🏢 Approved Net Terms & Live Credit Status</span>
                  <span className="text-[11px] font-semibold text-purple-700 dark:text-purple-300">
                    {paymentEligibility.approvedTerms.toUpperCase()}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 py-1 text-center">
                  <div className="p-2 rounded-lg bg-white/80 dark:bg-zinc-900/80 border border-purple-100 dark:border-purple-900/50">
                    <div className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium">Credit Limit</div>
                    <div className="font-black text-xs sm:text-sm text-zinc-900 dark:text-white mt-0.5">
                      ${paymentEligibility.creditLimit.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-white/80 dark:bg-zinc-900/80 border border-purple-100 dark:border-purple-900/50">
                    <div className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium">Open A/R</div>
                    <div className="font-black text-xs sm:text-sm text-amber-600 dark:text-amber-400 mt-0.5">
                      ${openAr.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-white/80 dark:bg-zinc-900/80 border border-purple-100 dark:border-purple-900/50">
                    <div className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium">Available Credit</div>
                    <div className="font-black text-xs sm:text-sm text-emerald-600 dark:text-emerald-400 mt-0.5">
                      ${availableCredit.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>

                <div className="text-[11px] text-purple-800 dark:text-purple-300 space-y-1 leading-relaxed">
                  <p>
                    <strong>Authoritative Terms:</strong> Invoice issued after order release. Payment due {paymentEligibility.approvedTerms.replace("net", "")} days from invoice date.
                  </p>
                  <p className="text-purple-700/80 dark:text-purple-300/80">
                    $0.00 Processing Fee. No upfront card charge. Total credit exposure is tracked through the authoritative accounts receivable ledger.
                  </p>
                </div>
              </div>
            )}

            {/* Provider Notice for Card / ACH */}
            {selectedPaymentMethod !== "terms" && !currentMethodObj?.providerConfigured && (
              <div className="mt-3 p-3.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 text-xs space-y-1">
                <div className="font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                  <span>ℹ️</span>
                  <span>Online Payment Processing Setup Pending</span>
                </div>
                <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
                  Direct online payment gateway integration is currently in setup phase. Submitting this order will record your purchase order with <strong>Unpaid</strong> payment status, and our billing team will issue an invoice for settlement.
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
                <div key={item.productId} className="py-3 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-12 h-12 rounded-lg bg-zinc-100 dark:bg-zinc-800/60 p-1 shrink-0 flex items-center justify-center overflow-hidden border border-zinc-200/60 dark:border-zinc-800">
                      <CartItemImage
                        productId={item.productId}
                        productName={item.productName}
                        primaryUrl={productThumbnails[item.productId] ?? item.thumbnailUrl}
                        fallbackUrls={productGalleries[item.productId]}
                        size="sm"
                      />
                    </div>
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
                  </div>
                  <div className="text-right font-bold text-zinc-900 dark:text-white text-sm shrink-0">
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
                <span>Delivery To:</span>
                <span className="font-semibold text-zinc-900 dark:text-white max-w-[200px] text-right truncate">
                  {destinationSummary.title}
                </span>
              </div>
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

              {discountAmount > 0 && (
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-semibold">
                  <span>Promotion / Coupon Discount:</span>
                  <span className="font-bold">
                    -${discountAmount.toFixed(2)}
                  </span>
                </div>
              )}

              {/* Processing Fee */}
              <div className="flex justify-between text-zinc-600 dark:text-zinc-400 items-center">
                <div className="flex items-center gap-1.5">
                  <span>Processing Fee:</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-medium border border-zinc-200/60 dark:border-zinc-700">
                    {processingFeeResult.disclosureLabel}
                  </span>
                </div>
                <span className={`font-semibold text-xs ${
                  processingFeeResult.feeAmount > 0
                    ? "text-zinc-900 dark:text-white"
                    : "text-zinc-400 dark:text-zinc-500"
                }`}>
                  {processingFeeResult.feeAmount > 0
                    ? `+$${processingFeeResult.feeAmount.toFixed(2)}`
                    : "$0.00"}
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
                ${finalPayableTotal.toFixed(2)}
              </div>
            </div>

            {/* Credit Limit Alert */}
            {isExceedingCreditLimit && (
              <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-600 dark:text-red-400 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <span>⚠️</span>
                  <span>Available Credit Line Exceeded</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  Your available credit line (${availableCredit.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}) is less than this order total (${finalPayableTotal.toFixed(2)}). Please choose Card or ACH.
                </p>
              </div>
            )}

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
