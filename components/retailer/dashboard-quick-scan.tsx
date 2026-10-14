"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { getWeeklyCheckPath } from "@/lib/retailer/weekly-check-types";

interface DashboardQuickScanProps {
  stores: Array<{ id: string; name: string }>;
  currentWeek: string;
  weeklyCheckDueCount: number;
}

export function DashboardQuickScan({
  stores,
  currentWeek,
  weeklyCheckDueCount,
}: DashboardQuickScanProps) {
  const router = useRouter();
  const [showPicker, setShowPicker] = useState(false);

  const handleLaunchScan = (storeId?: string) => {
    if (storeId) {
      router.push(getWeeklyCheckPath("start", { storeId, action: "scan" }));
      return;
    }

    if (stores.length === 1) {
      router.push(getWeeklyCheckPath("start", { storeId: stores[0].id, action: "scan" }));
    } else {
      setShowPicker(true);
    }
  };

  const primaryStoreName = stores.length === 1 ? stores[0].name : `${stores.length} Retail Stores`;

  return (
    <>
      <div className="rounded-2xl bg-gradient-to-r from-indigo-900 via-indigo-950 to-zinc-950 border border-indigo-500/40 p-4 sm:p-5 shadow-xl text-white relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3.5 min-w-0">
            {/* Camera Icon Badge */}
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-2xl shadow-lg shrink-0 border border-indigo-300/30">
              📷
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300 bg-indigo-500/20 px-2 py-0.5 rounded-full border border-indigo-400/20">
                  Weekly Stock Count • {currentWeek}
                </span>
                {weeklyCheckDueCount > 0 && (
                  <span className="text-[10px] font-bold text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-400/20">
                    Count Due
                  </span>
                )}
              </div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight mt-1 truncate">
                Scan Shelf Price Tags
              </h2>
              <p className="text-xs text-indigo-200/80 truncate">
                📍 {primaryStoreName} • Fast count using smartphone camera
              </p>
            </div>
          </div>

          {/* Action Button */}
          <div className="shrink-0 flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleLaunchScan()}
              className="w-full sm:w-auto px-5 py-3 rounded-xl text-xs sm:text-sm font-bold bg-emerald-500 hover:bg-emerald-400 text-zinc-950 shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>📷</span>
              <span>Scan Inventory</span>
            </button>
          </div>
        </div>
      </div>

      {/* Multi-Store Picker Modal */}
      {showPicker && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm rounded-3xl bg-zinc-900 border border-zinc-800 p-6 space-y-4 shadow-2xl animate-in slide-in-from-bottom-4 duration-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">Select Store to Count</h3>
                <p className="text-xs text-zinc-400 mt-0.5">Which location are you counting?</p>
              </div>
              <button
                type="button"
                onClick={() => setShowPicker(false)}
                className="w-8 h-8 rounded-full bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto pt-1">
              {stores.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setShowPicker(false);
                    handleLaunchScan(s.id);
                  }}
                  className="w-full p-3.5 rounded-2xl bg-zinc-800/80 hover:bg-indigo-600/30 border border-zinc-700/60 hover:border-indigo-500/50 text-left transition-all flex items-center justify-between group cursor-pointer"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white group-hover:text-indigo-300">
                      📍 {s.name}
                    </p>
                    <p className="text-[10px] text-zinc-400 mt-0.5">Start stock scan</p>
                  </div>
                  <span className="text-xs font-bold text-indigo-400 group-hover:translate-x-1 transition-transform">
                    →
                  </span>
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setShowPicker(false)}
              className="w-full py-2.5 rounded-xl text-xs font-semibold bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}
