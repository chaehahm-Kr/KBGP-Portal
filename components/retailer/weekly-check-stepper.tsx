"use client";

import React, { useState, useTransition, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { WeeklyCheckSession } from "@/lib/retailer/weekly-check";
import { updateWeeklyCheckItemsAction } from "@/lib/retailer/weekly-check-actions";
import { WeeklyCheckScannerModal } from "@/components/retailer/weekly-check-scanner-modal";

interface WeeklyCheckStepperProps {
  session: WeeklyCheckSession;
}

export function RetailerWeeklyCheckStepper({ session }: WeeklyCheckStepperProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Local state for counts: map of productId -> { remainingQty, isCounted, notes }
  const [counts, setCounts] = useState<Record<string, { remainingQty: number; isCounted: boolean; notes: string }>>(() => {
    const init: Record<string, { remainingQty: number; isCounted: boolean; notes: string }> = {};
    session.items.forEach((it) => {
      init[it.productId] = {
        remainingQty: it.reportedRemainingQty || 0,
        isCounted: it.isCounted || false,
        notes: it.notes || "",
      };
    });
    return init;
  });

  const [currentIndex, setCurrentIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [isReviewMode, setIsReviewMode] = useState(false);
  const [checkNotes, setCheckNotes] = useState(session.notes || "");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return session.items;
    const q = searchQuery.toLowerCase().trim();
    return session.items.filter(
      (it) =>
        it.productName.toLowerCase().includes(q) ||
        (it.productNameEn && it.productNameEn.toLowerCase().includes(q)) ||
        it.sku.toLowerCase().includes(q) ||
        it.brandName.toLowerCase().includes(q)
    );
  }, [session.items, searchQuery]);

  const activeItem = filteredItems[currentIndex] || filteredItems[0];
  const totalItemsCount = session.items.length;

  const countedItemsCount = Object.values(counts).filter((c) => c.isCounted).length;
  const progressPercent = totalItemsCount > 0 ? Math.round((countedItemsCount / totalItemsCount) * 100) : 0;

  const currentCountState = activeItem
    ? counts[activeItem.productId] || { remainingQty: 0, isCounted: false, notes: "" }
    : { remainingQty: 0, isCounted: false, notes: "" };

  const handleUpdateQty = (productId: string, newQty: number) => {
    const validQty = Math.max(0, isNaN(newQty) ? 0 : newQty);
    setCounts((prev) => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        remainingQty: validQty,
        isCounted: true,
      },
    }));
  };

  const handleUpdateNotes = (productId: string, notes: string) => {
    setCounts((prev) => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        notes,
      },
    }));
  };

  const handleScannerSaveCount = (
    productId: string,
    remainingQty: number,
    notes: string,
    andSaveDraft: boolean = true
  ) => {
    const validQty = Math.max(0, isNaN(remainingQty) ? 0 : remainingQty);
    const updatedCounts = {
      ...counts,
      [productId]: {
        remainingQty: validQty,
        isCounted: true,
        notes: notes || counts[productId]?.notes || "",
      },
    };
    setCounts(updatedCounts);

    // Sync index to this item
    const foundIdx = filteredItems.findIndex((it) => it.productId === productId);
    if (foundIdx !== -1) {
      setCurrentIndex(foundIdx);
    }

    if (andSaveDraft) {
      const payload = Object.entries(updatedCounts).map(([pId, state]) => ({
        productId: pId,
        remainingQty: state.remainingQty,
        isCounted: state.isCounted,
        notes: state.notes,
      }));

      startTransition(async () => {
        const res = await updateWeeklyCheckItemsAction(session.id, payload, "draft", checkNotes);
        if (res.success) {
          setSaveMessage("Draft saved ✓");
          setTimeout(() => setSaveMessage(null), 2500);
        }
      });
    }
  };

  const handleSaveDraft = async () => {
    setErrorMessage(null);
    setSaveMessage("Saving draft...");

    const payload = Object.entries(counts).map(([productId, state]) => ({
      productId,
      remainingQty: state.remainingQty,
      isCounted: state.isCounted,
      notes: state.notes,
    }));

    startTransition(async () => {
      const res = await updateWeeklyCheckItemsAction(session.id, payload, "draft", checkNotes);
      if (res.success) {
        setSaveMessage("Draft saved ✓");
        setTimeout(() => setSaveMessage(null), 2500);
      } else {
        setErrorMessage(res.error || "Failed to save draft.");
      }
    });
  };

  const handleSaveAndNext = () => {
    // Mark current item as counted
    if (activeItem) {
      setCounts((prev) => ({
        ...prev,
        [activeItem.productId]: {
          ...prev[activeItem.productId],
          isCounted: true,
        },
      }));
    }

    if (currentIndex < filteredItems.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setIsReviewMode(true);
    }
  };

  const handleSubmitWeeklyCheck = async () => {
    setErrorMessage(null);

    const payload = Object.entries(counts).map(([productId, state]) => ({
      productId,
      remainingQty: state.remainingQty,
      isCounted: state.isCounted,
      notes: state.notes,
    }));

    startTransition(async () => {
      const res = await updateWeeklyCheckItemsAction(session.id, payload, "submit", checkNotes);
      if (res.success) {
        router.push(`/check/${session.id}`);
      } else {
        setErrorMessage(res.error || "Failed to submit weekly check.");
      }
    });
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/check"
              className="text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
            >
              ← Back
            </Link>
            <span className="text-zinc-300 dark:text-zinc-700">•</span>
            <span className="text-xs font-bold text-zinc-900 dark:text-white">{session.storeName}</span>
          </div>
          <h1 className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-white tracking-tight mt-0.5">
            Weekly Product Check ({session.reportingWeek})
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {saveMessage && <span className="text-xs font-semibold text-emerald-600">{saveMessage}</span>}
          <button
            type="button"
            onClick={() => setIsScannerOpen(true)}
            className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <span>📷</span>
            <span>Scan Product</span>
          </button>
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={isPending}
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {isPending ? "Saving..." : "Save Draft"}
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs font-medium text-rose-700 dark:text-rose-300 flex items-center justify-between">
          <span>{errorMessage}</span>
          <button type="button" onClick={() => setErrorMessage(null)} className="font-bold">
            ✕
          </button>
        </div>
      )}

      {/* Progress Bar & Mode Toggle */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-3 shadow-xs">
        <div className="flex items-center justify-between text-xs font-semibold">
          <span className="text-zinc-600 dark:text-zinc-300">
            Progress: {countedItemsCount} of {totalItemsCount} products counted
          </span>
          <div className="flex items-center gap-3">
            <span className="text-indigo-600 dark:text-indigo-400 font-bold">{progressPercent}%</span>
            <button
              type="button"
              onClick={() => setIsReviewMode((prev) => !prev)}
              className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-white underline cursor-pointer"
            >
              {isReviewMode ? "Return to Stepper" : "View Review List"}
            </button>
          </div>
        </div>
        <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-2 overflow-hidden">
          <div
            className="bg-indigo-600 h-2 rounded-full transition-all duration-200"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* MAIN BODY: EITHER STEPPER OR REVIEW MODE */}
      {!isReviewMode ? (
        <div className="space-y-4">
          {/* Active Product Count Card */}
          {activeItem ? (
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-xs">
              {/* Product Info Strip */}
              <div className="p-6 sm:p-8 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center gap-6">
                  {/* Thumbnail */}
                  <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-xl bg-zinc-100 dark:bg-zinc-800/60 p-2 shrink-0 flex items-center justify-center border border-zinc-200 dark:border-zinc-800">
                    {activeItem.thumbnailUrl ? (
                      <img
                        src={activeItem.thumbnailUrl}
                        alt={activeItem.productName}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <span className="text-xs text-zinc-400 font-medium">No Image</span>
                    )}
                  </div>

                  {/* Title & Brand */}
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                        {activeItem.brandName}
                      </span>
                      <span className="text-zinc-300 dark:text-zinc-700">•</span>
                      <span className="text-xs font-mono text-zinc-400">{activeItem.sku}</span>
                    </div>

                    <h2 className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-white leading-snug">
                      {activeItem.productName}
                    </h2>

                    {activeItem.productNameEn && activeItem.productNameEn !== activeItem.productName && (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 font-normal">
                        {activeItem.productNameEn}
                      </p>
                    )}

                    {/* Historical Context & Movement Semantics */}
                    <div className="pt-2 flex flex-wrap items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
                      <div>
                        Previous Reported:{" "}
                        <strong className="text-zinc-700 dark:text-zinc-300">
                          {activeItem.previousReportedQty !== null ? `${activeItem.previousReportedQty} units` : "Baseline (Initial count)"}
                        </strong>
                      </div>

                      {Boolean(activeItem.deliveredSincePrevious && activeItem.deliveredSincePrevious > 0) && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          <span>📦</span> +{activeItem.deliveredSincePrevious} Delivered
                        </span>
                      )}

                      {activeItem.previousReportedQty !== null && currentCountState.isCounted && (
                        <div className="text-indigo-600 dark:text-indigo-400 font-semibold">
                          Estimated Movement:{" "}
                          <span>
                            {Math.max(
                              0,
                              activeItem.previousReportedQty +
                                (activeItem.deliveredSincePrevious || 0) -
                                currentCountState.remainingQty
                            )}{" "}
                            units
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Big Numeric Count Input Section */}
                <div className="p-5 sm:p-6 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 space-y-4">
                  <div className="text-center sm:text-left">
                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                      Remaining Quantity on Shelf / Backroom
                    </label>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      Enter the approximate total units currently in store.
                    </p>
                  </div>

                  <div className="flex items-center justify-center sm:justify-start gap-4">
                    {/* Stepper Buttons */}
                    <button
                      type="button"
                      onClick={() => handleUpdateQty(activeItem.productId, currentCountState.remainingQty - 1)}
                      className="w-12 h-12 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-lg font-bold text-zinc-800 dark:text-zinc-200 flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-700 active:scale-95 transition-all shadow-xs"
                      aria-label="Decrease quantity"
                    >
                      −
                    </button>

                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      value={currentCountState.remainingQty}
                      onChange={(e) => handleUpdateQty(activeItem.productId, parseInt(e.target.value, 10))}
                      className="w-24 sm:w-32 h-12 text-center text-2xl font-bold bg-white dark:bg-zinc-900 border-2 border-indigo-500 dark:border-indigo-400 rounded-xl text-zinc-900 dark:text-white focus:outline-none focus:ring-4 focus:ring-indigo-500/20 shadow-xs"
                    />

                    <button
                      type="button"
                      onClick={() => handleUpdateQty(activeItem.productId, currentCountState.remainingQty + 1)}
                      className="w-12 h-12 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-lg font-bold text-zinc-800 dark:text-zinc-200 flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-700 active:scale-95 transition-all shadow-xs"
                      aria-label="Increase quantity"
                    >
                      +
                    </button>

                    <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">units</span>
                  </div>

                  {/* Optional Notes Input */}
                  <div className="pt-2">
                    <input
                      type="text"
                      placeholder="Optional adjustment note (e.g. 1 damaged, tester bottle, etc.)"
                      value={currentCountState.notes}
                      onChange={(e) => handleUpdateNotes(activeItem.productId, e.target.value)}
                      className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                {/* Footer Navigation Buttons */}
                <div className="flex items-center justify-between gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                    disabled={currentIndex === 0}
                    className="px-5 py-3 rounded-xl text-xs font-bold border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    ← Previous
                  </button>

                  <span className="text-xs font-medium text-zinc-400">
                    {currentIndex + 1} of {filteredItems.length}
                  </span>

                  <button
                    type="button"
                    onClick={handleSaveAndNext}
                    className="px-6 py-3 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all cursor-pointer"
                  >
                    {currentIndex < filteredItems.length - 1 ? "Save & Next →" : "Review & Submit →"}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-zinc-500">No products found.</div>
          )}

          {/* Quick Jump Carousel / Grid */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Quick Jump to Product:</span>
                <button
                  type="button"
                  onClick={() => setIsScannerOpen(true)}
                  className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span>📷</span>
                  <span>Scan QR</span>
                </button>
              </div>
              <input
                type="text"
                placeholder="Search SKU or name..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentIndex(0);
                }}
                className="text-xs px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              {filteredItems.map((item, idx) => {
                const isSelected = idx === currentIndex;
                const isCounted = counts[item.productId]?.isCounted;
                return (
                  <button
                    key={item.productId}
                    type="button"
                    onClick={() => setCurrentIndex(idx)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold shrink-0 flex items-center gap-1.5 transition-all cursor-pointer ${
                      isSelected
                        ? "bg-indigo-600 text-white shadow-xs"
                        : isCounted
                        ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                    }`}
                  >
                    <span>{idx + 1}</span>
                    <span className="truncate max-w-[80px] font-normal">{item.productName}</span>
                    {isCounted && <span>✓</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* REVIEW & SUBMIT MODE */
        <div className="space-y-6">
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 sm:p-8 space-y-6 shadow-xs">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-white">
                Review Weekly Product Check
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                Confirm reported quantities before submitting. Once submitted, records become read-only.
              </p>
            </div>

            {/* Metrics Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800">
                <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Total Catalog</div>
                <div className="text-xl font-bold text-zinc-900 dark:text-white mt-0.5">{totalItemsCount} SKUs</div>
              </div>

              <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Counted</div>
                <div className="text-xl font-bold text-emerald-700 dark:text-emerald-300 mt-0.5">{countedItemsCount} SKUs</div>
              </div>

              <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800">
                <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Total Units</div>
                <div className="text-xl font-bold text-zinc-900 dark:text-white mt-0.5">
                  {Object.values(counts).reduce((acc, c) => acc + (c.isCounted ? c.remainingQty : 0), 0)} units
                </div>
              </div>

              <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800">
                <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Store</div>
                <div className="text-sm font-bold text-zinc-900 dark:text-white mt-1 truncate">{session.storeName}</div>
              </div>
            </div>

            {/* Items List Table */}
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 font-semibold">
                    <tr>
                      <th className="py-2.5 px-4">Product</th>
                      <th className="py-2.5 px-4">SKU</th>
                      <th className="py-2.5 px-4 text-right">Reported Remaining</th>
                      <th className="py-2.5 px-4">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {session.items.map((it) => {
                      const state = counts[it.productId] || { remainingQty: 0, isCounted: false, notes: "" };
                      return (
                        <tr key={it.productId} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                          <td className="py-3 px-4 font-semibold text-zinc-900 dark:text-white">
                            {it.productName}
                          </td>
                          <td className="py-3 px-4 font-mono text-zinc-400">{it.sku}</td>
                          <td className="py-3 px-4 text-right font-bold text-zinc-900 dark:text-white">
                            {state.remainingQty} units
                          </td>
                          <td className="py-3 px-4 text-zinc-500">{state.notes || "-"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* General Check Notes */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                General Store Weekly Notes (Optional)
              </label>
              <textarea
                rows={2}
                placeholder="Any overall notes for this store audit..."
                value={checkNotes}
                onChange={(e) => setCheckNotes(e.target.value)}
                className="w-full text-xs p-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setIsReviewMode(false)}
                className="py-3.5 px-6 rounded-xl text-xs font-bold border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                ← Back to Stepper
              </button>

              <button
                type="button"
                onClick={handleSubmitWeeklyCheck}
                disabled={isPending}
                className="flex-1 py-3.5 px-6 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
              >
                {isPending ? "Submitting Check..." : "Submit Weekly Product Check ✓"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Floating Scan Button */}
      <div className="fixed bottom-6 right-6 z-30 sm:hidden">
        <button
          type="button"
          onClick={() => setIsScannerOpen(true)}
          className="px-5 py-3.5 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-2xl flex items-center gap-2 active:scale-95 transition-all border border-indigo-400/30 cursor-pointer"
          aria-label="Scan Product QR"
        >
          <span className="text-base">📷</span>
          <span>Scan Product</span>
        </button>
      </div>

      {/* Camera Fast-Count Scanner Modal */}
      <WeeklyCheckScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        items={session.items}
        currentCounts={counts}
        onSaveItemCount={handleScannerSaveCount}
        storeName={session.storeName}
      />
    </div>
  );
}
