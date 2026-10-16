"use client";

import React, { useState, useMemo, useTransition } from "react";
import {
  AdminStoreActivitiesOverview,
  StoreTimelineItem,
  AdminStoreActivity,
  ACTIVITY_TYPE_CONFIGS,
  ActivityType,
} from "@/lib/retailer/admin-store-activities-types";
import { StoreActivityModal } from "./store-activity-modal";
import {
  completeStoreFollowUpAction,
  reopenStoreFollowUpAction,
} from "@/lib/retailer/admin-activity-actions";
import { useRouter } from "next/navigation";

interface StoreActivitiesTabProps {
  overview: AdminStoreActivitiesOverview;
  onSwitchTab: (tabKey: any) => void;
}

export function StoreActivitiesTab({
  overview,
  onSwitchTab,
}: StoreActivitiesTabProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activityToEdit, setActivityToEdit] = useState<AdminStoreActivity | null>(null);

  // Filter states
  const [sourceFilter, setSourceFilter] = useState<"all" | "manual" | "auto">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [followUpFilter, setFollowUpFilter] = useState<"all" | "pending" | "overdue" | "completed">("all");
  const [searchTerm, setSearchTerm] = useState("");

  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);

  // Filtered timeline items
  const filteredItems = useMemo(() => {
    return overview.timelineItems.filter((item) => {
      // Source filter
      if (sourceFilter === "manual" && item.sourceType !== "manual") return false;
      if (sourceFilter === "auto" && item.sourceType === "manual") return false;

      // Category filter
      if (categoryFilter !== "all") {
        if (item.sourceType === "manual") {
          if (item.manualActivity?.activityType !== categoryFilter) return false;
        } else {
          if (item.sourceType !== categoryFilter) return false;
        }
      }

      // Follow-up filter
      if (followUpFilter === "pending") {
        if (!item.hasFollowUp || item.followUpStatus !== "pending") return false;
      } else if (followUpFilter === "overdue") {
        if (
          !item.hasFollowUp ||
          item.followUpStatus !== "pending" ||
          !item.followUpDate ||
          item.followUpDate >= todayStr
        )
          return false;
      } else if (followUpFilter === "completed") {
        if (!item.hasFollowUp || item.followUpStatus !== "completed") return false;
      }

      // Search term
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const matchesTitle = item.title.toLowerCase().includes(q);
        const matchesSub = item.subtitle?.toLowerCase().includes(q);
        const matchesDesc = item.description?.toLowerCase().includes(q);
        const matchesActor = item.actorName.toLowerCase().includes(q);
        const matchesCategory = item.categoryLabel.toLowerCase().includes(q);
        if (!matchesTitle && !matchesSub && !matchesDesc && !matchesActor && !matchesCategory) {
          return false;
        }
      }

      return true;
    });
  }, [overview.timelineItems, sourceFilter, categoryFilter, followUpFilter, searchTerm, todayStr]);

  // Group filtered items by date
  const groupedByDate = useMemo(() => {
    const map = new Map<string, StoreTimelineItem[]>();
    filteredItems.forEach((item) => {
      const d = item.date || "Earlier";
      if (!map.has(d)) map.set(d, []);
      map.get(d)!.push(item);
    });
    return Array.from(map.entries());
  }, [filteredItems]);

  const handleOpenAddModal = () => {
    setActivityToEdit(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (activity: AdminStoreActivity) => {
    setActivityToEdit(activity);
    setIsModalOpen(true);
  };

  const handleCompleteFollowUp = (activityId: string) => {
    if (overview.isSchemaPending) {
      alert("Database migration pending: Live writes are currently disabled.");
      return;
    }
    startTransition(async () => {
      await completeStoreFollowUpAction(activityId);
      router.refresh();
    });
  };

  const handleReopenFollowUp = (activityId: string) => {
    if (overview.isSchemaPending) {
      alert("Database migration pending: Live writes are currently disabled.");
      return;
    }
    startTransition(async () => {
      await reopenStoreFollowUpAction(activityId);
      router.refresh();
    });
  };

  const formatDateLabel = (dateStr: string) => {
    if (!dateStr || dateStr === "Earlier") return "Earlier";
    if (dateStr === todayStr) return "Today";
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
    if (dateStr === yesterday) return "Yesterday";
    try {
      const parts = dateStr.split("-");
      const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    } catch {
      return dateStr;
    }
  };

  const getBadgeVariantClasses = (variant: string) => {
    switch (variant) {
      case "amber":
        return "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:border-amber-800/60 dark:text-amber-300";
      case "blue":
        return "bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:border-blue-800/60 dark:text-blue-300";
      case "purple":
        return "bg-purple-50 text-purple-800 border-purple-200 dark:bg-purple-950/40 dark:border-purple-800/60 dark:text-purple-300";
      case "emerald":
        return "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800/60 dark:text-emerald-300";
      case "teal":
        return "bg-teal-50 text-teal-800 border-teal-200 dark:bg-teal-950/40 dark:border-teal-800/60 dark:text-teal-300";
      case "orange":
        return "bg-orange-50 text-orange-800 border-orange-200 dark:bg-orange-950/40 dark:border-orange-800/60 dark:text-orange-300";
      case "rose":
        return "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:border-rose-800/60 dark:text-rose-300";
      case "zinc":
      default:
        return "bg-zinc-100 text-zinc-800 border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300";
    }
  };

  return (
    <div className="space-y-6" data-testid="store-activities-tab">
      {/* 1. KPI Summary Strip & Log Activity Action */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 flex-1">
          {/* Total Activities */}
          <div className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs">
            <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block">
              Total Timeline
            </span>
            <span className="text-2xl font-black text-zinc-950 dark:text-white mt-1 block" data-testid="kpi-total-activities">
              {overview.kpis.totalActivitiesCount}
            </span>
            <span className="text-[10px] text-zinc-400 mt-0.5 block">
              {overview.kpis.manualActivitiesCount} manual • {overview.kpis.automaticEventsCount} auto
            </span>
          </div>

          {/* Manual Activities */}
          <div className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs">
            <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block">
              Manual Logs
            </span>
            <span className="text-2xl font-black text-zinc-950 dark:text-white mt-1 block" data-testid="kpi-manual-activities">
              {overview.kpis.manualActivitiesCount}
            </span>
            <span className="text-[10px] text-zinc-400 mt-0.5 block">
              Field visits & notes
            </span>
          </div>

          {/* Automatic System Events */}
          <div className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs">
            <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block">
              System Events
            </span>
            <span className="text-2xl font-black text-zinc-950 dark:text-white mt-1 block" data-testid="kpi-auto-events">
              {overview.kpis.automaticEventsCount}
            </span>
            <span className="text-[10px] text-zinc-400 mt-0.5 block">
              Orders, checks & fixtures
            </span>
          </div>

          {/* Pending Follow-ups */}
          <div className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">
                Pending Tasks
              </span>
              {overview.kpis.overdueFollowUpsCount > 0 && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
                  {overview.kpis.overdueFollowUpsCount} Overdue
                </span>
              )}
            </div>
            <span className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1 block" data-testid="kpi-pending-followups">
              {overview.kpis.pendingFollowUpsCount}
            </span>
            <span className="text-[10px] text-zinc-400 mt-0.5 block">
              {overview.kpis.overdueFollowUpsCount > 0 ? "Requires attention" : "On schedule"}
            </span>
          </div>

          {/* Completed Tasks */}
          <div className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs">
            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
              Completed
            </span>
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 block" data-testid="kpi-completed-followups">
              {overview.kpis.completedFollowUpsCount}
            </span>
            <span className="text-[10px] text-zinc-400 mt-0.5 block">
              Resolved tasks
            </span>
          </div>
        </div>

        {/* Primary Action Button */}
        <div className="shrink-0 flex items-center justify-end">
          <button
            type="button"
            onClick={handleOpenAddModal}
            className="w-full lg:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-100 dark:text-zinc-900 text-xs font-bold transition-all shadow-sm active:scale-95"
            data-testid="btn-add-activity"
          >
            <span className="text-base">➕</span>
            <span>Log Store Activity</span>
          </button>
        </div>
      </div>

      {/* 2. Schema Pending Execution Banner */}
      {overview.isSchemaPending && (
        <div
          role="status"
          className="rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 p-4 space-y-1.5 shadow-xs"
          data-testid="banner-schema-pending"
        >
          <div className="flex items-center gap-2 text-xs font-bold text-amber-900 dark:text-amber-200">
            <span className="text-base">ℹ️</span>
            <span>Store Activities Schema Pending Owner Migration</span>
          </div>
          <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
            The unified operational timeline below is currently projecting authoritative store events (Orders, Deliveries, Weekly Checks, and Fixtures). Manual activity logging and follow-ups are safely gated in preview mode until the database migration is executed by the system administrator.
          </p>
        </div>
      )}

      {/* 3. Filter Controls Strip */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Source Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-zinc-100 dark:bg-zinc-800/80 rounded-xl border border-zinc-200 dark:border-zinc-700/60 overflow-x-auto">
            <button
              type="button"
              onClick={() => setSourceFilter("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                sourceFilter === "all"
                  ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
              }`}
            >
              All Sources ({overview.timelineItems.length})
            </button>
            <button
              type="button"
              onClick={() => setSourceFilter("manual")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                sourceFilter === "manual"
                  ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
              }`}
            >
              Manual Only ({overview.kpis.manualActivitiesCount})
            </button>
            <button
              type="button"
              onClick={() => setSourceFilter("auto")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                sourceFilter === "auto"
                  ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
              }`}
            >
              System Events ({overview.kpis.automaticEventsCount})
            </button>
          </div>

          {/* Quick Follow-up Filters */}
          <div className="flex items-center gap-2">
            <select
              value={followUpFilter}
              onChange={(e) => setFollowUpFilter(e.target.value as any)}
              className="text-xs font-bold rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/60 px-3 py-2 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white"
            >
              <option value="all">Follow-ups: All</option>
              <option value="pending">Follow-ups: Pending ({overview.kpis.pendingFollowUpsCount})</option>
              <option value="overdue">Follow-ups: Overdue ({overview.kpis.overdueFollowUpsCount})</option>
              <option value="completed">Follow-ups: Completed ({overview.kpis.completedFollowUpsCount})</option>
            </select>

            {/* Category Dropdown */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="text-xs font-bold rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/60 px-3 py-2 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white"
            >
              <option value="all">Category: All</option>
              <optgroup label="Manual Activities">
                {(Object.keys(ACTIVITY_TYPE_CONFIGS) as ActivityType[]).map((t) => (
                  <option key={t} value={t}>
                    {ACTIVITY_TYPE_CONFIGS[t].label}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Automatic Streams">
                <option value="order">Orders Placed</option>
                <option value="fulfillment">Deliveries / Shipments</option>
                <option value="inventory_check">Weekly Inventory Checks</option>
                <option value="fixture">Store Fixtures</option>
              </optgroup>
            </select>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-xs">
            🔍
          </span>
          <input
            type="text"
            placeholder="Search activities by title, notes, admin, or tracking number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/40 pl-8 pr-3 py-2 text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white"
          />
        </div>
      </div>

      {/* 4. Chronological Timeline */}
      {groupedByDate.length === 0 ? (
        <div
          className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-12 text-center space-y-3 shadow-xs"
          data-testid="empty-activities-state"
        >
          <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-500 flex items-center justify-center text-xl mx-auto">
            📋
          </div>
          <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
            No Activities Found
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto leading-relaxed">
            {searchTerm || categoryFilter !== "all" || sourceFilter !== "all" || followUpFilter !== "all"
              ? "No timeline events match the selected filters. Try clearing your filters or search term."
              : "No operational activities or events have been recorded for this store yet."}
          </p>
        </div>
      ) : (
        <div className="space-y-8" data-testid="timeline-container">
          {groupedByDate.map(([dateKey, items]) => (
            <div key={dateKey} className="space-y-4">
              {/* Date Group Heading */}
              <div className="flex items-center gap-3">
                <span className="text-xs font-black text-zinc-900 dark:text-white uppercase tracking-wider">
                  {formatDateLabel(dateKey)}
                </span>
                <span className="text-[11px] font-mono font-medium text-zinc-400">
                  {dateKey}
                </span>
                <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-800" />
              </div>

              {/* Items in this date */}
              <div className="relative pl-6 sm:pl-8 space-y-4 before:absolute before:left-2 sm:before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-zinc-200 dark:before:bg-zinc-800">
                {items.map((item) => {
                  const isOverdue =
                    item.hasFollowUp &&
                    item.followUpStatus === "pending" &&
                    item.followUpDate &&
                    item.followUpDate < todayStr;

                  return (
                    <div
                      key={item.id}
                      className="relative rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-5 shadow-xs space-y-3 transition-all hover:border-zinc-300 dark:hover:border-zinc-700"
                      data-testid={`timeline-item-${item.id}`}
                    >
                      {/* Timeline Dot Indicator */}
                      <div className="absolute -left-[27px] sm:-left-[35px] top-5 w-4 h-4 rounded-full border-2 border-white dark:border-zinc-900 bg-zinc-900 dark:bg-white shadow-xs" />

                      {/* Header Row */}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${getBadgeVariantClasses(
                              item.badgeVariant
                            )}`}
                          >
                            <span>{item.icon}</span>
                            <span>{item.categoryLabel}</span>
                          </span>

                          <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                            {item.actorName}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-[11px] font-medium text-zinc-400">
                          {item.timestamp && (
                            <span>
                              {new Date(item.timestamp).toLocaleTimeString("en-US", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Content */}
                      <div className="space-y-1">
                        <h4 className="text-xs sm:text-sm font-bold text-zinc-950 dark:text-white leading-snug">
                          {item.title}
                        </h4>
                        {item.subtitle && (
                          <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                            {item.subtitle}
                          </p>
                        )}
                        {item.description && item.description !== item.subtitle && (
                          <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed pt-1">
                            {item.description}
                          </p>
                        )}
                      </div>

                      {/* Follow-up Banner */}
                      {item.hasFollowUp && (
                        <div
                          className={`rounded-xl p-3 border text-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 ${
                            item.followUpStatus === "completed"
                              ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200"
                              : isOverdue
                              ? "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200"
                              : "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200"
                          }`}
                        >
                          <div className="space-y-0.5 min-w-0">
                            <div className="flex items-center gap-2 font-bold">
                              <span>
                                {item.followUpStatus === "completed"
                                  ? "✓ Follow-up Completed"
                                  : isOverdue
                                  ? "⚠️ Follow-up Overdue"
                                  : "⏰ Follow-up Scheduled"}
                              </span>
                              {item.followUpDate && (
                                <span className="font-mono text-[11px] opacity-80">
                                  Due: {item.followUpDate}
                                </span>
                              )}
                            </div>
                            {item.followUpNote && (
                              <p className="text-[11px] opacity-90 truncate">
                                {item.followUpNote}
                              </p>
                            )}
                          </div>

                          <div className="shrink-0 flex items-center gap-2">
                            {item.followUpStatus === "completed" ? (
                              <button
                                type="button"
                                disabled={isPending || overview.isSchemaPending}
                                onClick={() =>
                                  item.manualActivity &&
                                  handleReopenFollowUp(item.manualActivity.id)
                                }
                                className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors shadow-2xs"
                              >
                                ↺ Reopen
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={isPending || overview.isSchemaPending}
                                onClick={() =>
                                  item.manualActivity &&
                                  handleCompleteFollowUp(item.manualActivity.id)
                                }
                                className="px-3 py-1 rounded-lg text-[11px] font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-2xs"
                              >
                                ✓ Mark Complete
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Action Bar */}
                      <div className="flex items-center justify-between pt-1 border-t border-zinc-100 dark:border-zinc-800/60">
                        <div className="text-[10px] font-mono text-zinc-400">
                          ID: {item.id}
                        </div>

                        <div className="flex items-center gap-2">
                          {/* Deep Link to Tab */}
                          {item.targetTab && item.targetTab !== "activities" && (
                            <button
                              type="button"
                              onClick={() => onSwitchTab(item.targetTab)}
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white transition-colors"
                            >
                              <span>
                                View in{" "}
                                {item.targetTab.charAt(0).toUpperCase() +
                                  item.targetTab.slice(1)}
                              </span>
                              <span>↗</span>
                            </button>
                          )}

                          {/* Edit Manual Activity */}
                          {item.manualActivity && (
                            <button
                              type="button"
                              onClick={() =>
                                item.manualActivity &&
                                handleOpenEditModal(item.manualActivity)
                              }
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white transition-colors"
                            >
                              <span>✏️ Edit</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 5. Modal for Logging & Editing Activity */}
      <StoreActivityModal
        storeId={overview.storeId}
        storeName={overview.storeName}
        isSchemaPending={overview.isSchemaPending}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        activityToEdit={activityToEdit}
        onSuccess={() => router.refresh()}
      />
    </div>
  );
}
