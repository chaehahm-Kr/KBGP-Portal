"use client";

import React, { useState, useTransition } from "react";
import {
  ActivityType,
  ACTIVITY_TYPE_CONFIGS,
  AdminStoreActivity,
} from "@/lib/retailer/admin-store-activities-types";
import {
  createStoreActivityAction,
  updateStoreActivityAction,
} from "@/lib/retailer/admin-activity-actions";

interface StoreActivityModalProps {
  storeId: string;
  storeName: string;
  isSchemaPending: boolean;
  isOpen: boolean;
  onClose: () => void;
  activityToEdit?: AdminStoreActivity | null;
  onSuccess?: () => void;
}

export function StoreActivityModal({
  storeId,
  storeName,
  isSchemaPending,
  isOpen,
  onClose,
  activityToEdit,
  onSuccess,
}: StoreActivityModalProps) {
  const [isPending, startTransition] = useTransition();

  const isEditing = Boolean(activityToEdit);

  // Form states
  const [activityType, setActivityType] = useState<ActivityType>(
    activityToEdit?.activityType || "store_visit"
  );
  const [title, setTitle] = useState<string>(activityToEdit?.title || "");
  const [description, setDescription] = useState<string>(activityToEdit?.description || "");
  const [activityDate, setActivityDate] = useState<string>(
    activityToEdit?.activityDate || new Date().toISOString().split("T")[0]
  );
  const [responsibleAdminName, setResponsibleAdminName] = useState<string>(
    activityToEdit?.responsibleAdminName || ""
  );

  const [hasFollowUp, setHasFollowUp] = useState<boolean>(
    Boolean(activityToEdit?.hasFollowUp)
  );
  const [followUpDate, setFollowUpDate] = useState<string>(
    activityToEdit?.followUpDate ||
      new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0]
  );
  const [followUpNote, setFollowUpNote] = useState<string>(
    activityToEdit?.followUpNote || ""
  );

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (isSchemaPending) {
      setErrorMsg("Database migration pending: Live writes are currently disabled until the store_activities table is executed by the Owner.");
      return;
    }

    const trimmedTitle = title.trim();
    if (trimmedTitle.length < 3) {
      setErrorMsg("Title must be at least 3 characters.");
      return;
    }
    if (trimmedTitle.length > 200) {
      setErrorMsg("Title cannot exceed 200 characters.");
      return;
    }

    if (hasFollowUp) {
      if (!followUpDate) {
        setErrorMsg("Follow-up due date is required.");
        return;
      }
      if (!followUpNote.trim()) {
        setErrorMsg("Follow-up note is required.");
        return;
      }
    }

    startTransition(async () => {
      try {
        if (isEditing && activityToEdit) {
          const res = await updateStoreActivityAction({
            activityId: activityToEdit.id,
            activityType,
            title: trimmedTitle,
            description: description.trim() || null,
            activityDate,
            hasFollowUp,
            followUpDate: hasFollowUp ? followUpDate : null,
            followUpNote: hasFollowUp ? followUpNote.trim() : null,
          });

          if (!res.success) {
            setErrorMsg(res.error || "Failed to update activity.");
          } else {
            onSuccess?.();
            onClose();
          }
        } else {
          const res = await createStoreActivityAction({
            storeId,
            activityType,
            title: trimmedTitle,
            description: description.trim() || null,
            activityDate,
            responsibleAdminId: "", // resolved on server
            responsibleAdminName: responsibleAdminName.trim() || "Admin",
            hasFollowUp,
            followUpDate: hasFollowUp ? followUpDate : null,
            followUpNote: hasFollowUp ? followUpNote.trim() : null,
          });

          if (!res.success) {
            setErrorMsg(res.error || "Failed to log store activity.");
          } else {
            onSuccess?.();
            onClose();
          }
        }
      } catch (err: any) {
        setErrorMsg(err.message || "An unexpected error occurred.");
      }
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-xs overflow-y-auto"
      data-testid="store-activity-modal"
    >
      <div className="relative w-full max-w-xl bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-2xl p-6 sm:p-7 space-y-5 my-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-zinc-100 dark:border-zinc-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">
                {ACTIVITY_TYPE_CONFIGS[activityType]?.icon || "📝"}
              </span>
              <h2 className="text-base sm:text-lg font-black text-zinc-950 dark:text-white">
                {isEditing ? "Edit Store Activity" : "Log Store Activity"}
              </h2>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Store: <strong className="text-zinc-800 dark:text-zinc-200">{storeName}</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Schema Pending Banner */}
        {isSchemaPending && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/40 p-4 text-xs text-amber-900 dark:text-amber-200 space-y-1">
            <div className="font-bold flex items-center gap-1.5">
              <span>⚠️</span>
              <span>Database Migration Pending Execution</span>
            </div>
            <p className="leading-relaxed opacity-90">
              The <code className="font-mono bg-amber-100 dark:bg-amber-900/60 px-1 py-0.5 rounded">store_activities</code> table has not been applied to Production Supabase yet. This form is displayed in preview mode; live writes are safely gated.
            </p>
          </div>
        )}

        {/* Error Message */}
        {errorMsg && (
          <div
            role="alert"
            className="rounded-2xl border border-red-200 bg-red-50 dark:border-red-900/60 dark:bg-red-950/40 p-3.5 text-xs text-red-700 dark:text-red-300 font-medium"
          >
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Category Selector */}
          <div>
            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
              Activity Category *
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(Object.keys(ACTIVITY_TYPE_CONFIGS) as ActivityType[]).map((type) => {
                const cfg = ACTIVITY_TYPE_CONFIGS[type];
                const isSelected = activityType === type;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setActivityType(type)}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-left transition-all ${
                      isSelected
                        ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900 font-bold shadow-xs"
                        : "border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/40 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-700 text-xs font-medium"
                    }`}
                  >
                    <span className="text-sm shrink-0">{cfg.icon}</span>
                    <span className="truncate text-[11px]">{cfg.shortLabel}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date & Responsible Admin */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                Activity Date *
              </label>
              <input
                type="date"
                required
                value={activityDate}
                onChange={(e) => setActivityDate(e.target.value)}
                className="w-full text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                Responsible Admin Name
              </label>
              <input
                type="text"
                placeholder="Current Admin"
                value={responsibleAdminName}
                onChange={(e) => setResponsibleAdminName(e.target.value)}
                className="w-full text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2 text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white"
              />
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
              Title / Short Summary * (3 - 200 chars)
            </label>
            <input
              type="text"
              required
              minLength={3}
              maxLength={200}
              placeholder="e.g. Regular merchandising walkthrough and POP replacement"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2 text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white"
            />
          </div>

          {/* Detailed Notes */}
          <div>
            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
              Detailed Notes / Operational Context
            </label>
            <textarea
              rows={3}
              placeholder="Record specific feedback from store manager, shelf conditions, display notes, or discussion points..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2 text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white"
            />
          </div>

          {/* Follow-up Section */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 bg-zinc-50/50 dark:bg-zinc-800/30 space-y-3">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={hasFollowUp}
                onChange={(e) => setHasFollowUp(e.target.checked)}
                className="w-4 h-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-900"
              />
              <span className="text-xs font-bold text-zinc-900 dark:text-white">
                Schedule a Follow-up Action for this Store?
              </span>
            </label>

            {hasFollowUp && (
              <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1">
                    Follow-up Due Date *
                  </label>
                  <input
                    type="date"
                    required={hasFollowUp}
                    value={followUpDate}
                    onChange={(e) => setFollowUpDate(e.target.value)}
                    className="w-full text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1">
                    Follow-up Action Note *
                  </label>
                  <input
                    type="text"
                    required={hasFollowUp}
                    placeholder="e.g. Bring 2 replacement acrylic POP holders"
                    value={followUpNote}
                    onChange={(e) => setFollowUpNote(e.target.value)}
                    className="w-full text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2 text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || isSchemaPending}
              className={`px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-xs ${
                isSchemaPending
                  ? "bg-zinc-300 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500 cursor-not-allowed"
                  : "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 active:scale-95"
              }`}
            >
              {isPending
                ? "Saving..."
                : isSchemaPending
                ? "Save Activity (Migration Pending)"
                : isEditing
                ? "Save Changes"
                : "Save Activity"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
