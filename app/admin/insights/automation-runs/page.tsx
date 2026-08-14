"use client";

import React, { useState, useEffect } from "react";

export default function AutomationRunsPage() {
  const [runs, setRuns] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [lastExecutionResult, setLastExecutionResult] = useState<any>(null);

  const fetchRuns = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/admin/insights/automation-runs");
      if (res.ok) {
        const data = await res.json();
        setRuns(data.runs || []);
      }
    } catch (e) {
      console.error("Failed to load automation runs:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRuns();
  }, []);

  const handleExecuteEngine = async (mode: "MANUAL" | "DRY_RUN") => {
    try {
      setIsRunning(true);
      setLastExecutionResult(null);

      const res = await fetch("/api/admin/insights/automation-runs/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, triggeredBy: "Admin UI" }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setLastExecutionResult(data.data);
        fetchRuns();
      } else {
        alert(`Execution failed: ${data.error || "Unknown error"}`);
      }
    } catch (e: any) {
      alert(`Error launching engine: ${e.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="w-full space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-6">
        <div>
          <span className="text-xs font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-widest">
            Daily Automation Engine Controls
          </span>
          <h1 className="text-2xl md:text-3xl font-extrabold text-zinc-900 dark:text-white mt-1">
            Automation Runs Monitor
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            Monitor daily automated research runs (05:00 AM ET), candidate 100-point scoring, draft generation, and human gate status.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleExecuteEngine("DRY_RUN")}
            disabled={isRunning}
            className="rounded-lg border border-zinc-300 bg-white px-3.5 py-2 text-xs font-bold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 disabled:opacity-50"
          >
            {isRunning ? "Running..." : "Test Run (Dry Run)"}
          </button>
          <button
            onClick={() => handleExecuteEngine("MANUAL")}
            disabled={isRunning}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-xs font-bold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 disabled:opacity-50 shadow-sm"
          >
            {isRunning ? "Executing Engine..." : "⚡ Run Research Now"}
          </button>
        </div>
      </div>

      {/* Execution Results Alert Banner */}
      {lastExecutionResult && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-5 dark:border-emerald-900/50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              {lastExecutionResult.runMode === "DRY_RUN" ? "Dry Run Completed (No DB Records Created)" : "Manual Engine Execution Completed"}
            </span>
            <span className="text-[10px] font-mono bg-emerald-200/60 dark:bg-emerald-900 px-2 py-0.5 rounded font-bold">
              Run ID: {lastExecutionResult.runId}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3 pt-2 text-center text-xs">
            <div className="bg-white/70 dark:bg-zinc-900/70 p-2 rounded-lg border border-emerald-100 dark:border-emerald-900">
              <span className="block text-[10px] text-zinc-500">Scanned</span>
              <span className="font-extrabold text-sm text-zinc-900 dark:text-white">{lastExecutionResult.sourcesScanned}</span>
            </div>
            <div className="bg-white/70 dark:bg-zinc-900/70 p-2 rounded-lg border border-emerald-100 dark:border-emerald-900">
              <span className="block text-[10px] text-zinc-500">Candidates</span>
              <span className="font-extrabold text-sm text-blue-600 dark:text-blue-400">{lastExecutionResult.candidatesGenerated}</span>
            </div>
            <div className="bg-white/70 dark:bg-zinc-900/70 p-2 rounded-lg border border-emerald-100 dark:border-emerald-900">
              <span className="block text-[10px] text-zinc-500">Score ≥ 80</span>
              <span className="font-extrabold text-sm text-emerald-600 dark:text-emerald-400">{lastExecutionResult.candidatesGte80}</span>
            </div>
            <div className="bg-white/70 dark:bg-zinc-900/70 p-2 rounded-lg border border-emerald-100 dark:border-emerald-900">
              <span className="block text-[10px] text-zinc-500">Rejected</span>
              <span className="font-extrabold text-sm text-rose-600">{lastExecutionResult.criticalRejects + lastExecutionResult.duplicateRejects}</span>
            </div>
            <div className="bg-white/70 dark:bg-zinc-900/70 p-2 rounded-lg border border-emerald-100 dark:border-emerald-900">
              <span className="block text-[10px] text-zinc-500">NETWORK</span>
              <span className="font-extrabold text-sm text-amber-600">{lastExecutionResult.networkDrafts}</span>
            </div>
            <div className="bg-white/70 dark:bg-zinc-900/70 p-2 rounded-lg border border-emerald-100 dark:border-emerald-900">
              <span className="block text-[10px] text-zinc-500">HUB</span>
              <span className="font-extrabold text-sm text-emerald-600">{lastExecutionResult.hubDrafts}</span>
            </div>
            <div className="bg-white/70 dark:bg-zinc-900/70 p-2 rounded-lg border border-emerald-100 dark:border-emerald-900">
              <span className="block text-[10px] text-zinc-500">Unique Cores</span>
              <span className="font-extrabold text-sm text-indigo-600">{lastExecutionResult.uniqueCoreDrafts}</span>
            </div>
          </div>
          {lastExecutionResult.noDraftReason && (
            <p className="text-xs text-amber-700 dark:text-amber-300 pt-1 font-medium italic">
              Note: {lastExecutionResult.noDraftReason}
            </p>
          )}
        </div>
      )}

      {/* Runs Table */}
      <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-sm text-zinc-500">Loading automation run logs...</div>
        ) : runs.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <h3 className="text-base font-bold text-zinc-900 dark:text-white">No Automation Runs Recorded</h3>
            <p className="text-xs text-zinc-500 max-w-md mx-auto">
              The Daily Auto Insight Engine runs automatically every morning at 05:00 AM ET (`America/New_York`).
              Click "⚡ Run Research Now" or "Test Run (Dry Run)" above to trigger an immediate run.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-zinc-200 bg-zinc-50 font-semibold text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400">
                <tr>
                  <th className="px-4 py-3.5">Run Mode</th>
                  <th className="px-4 py-3.5">Date & Time (ET)</th>
                  <th className="px-3 py-3.5">Scanned</th>
                  <th className="px-3 py-3.5">Found</th>
                  <th className="px-3 py-3.5">≥80 Pts</th>
                  <th className="px-3 py-3.5">Rejected</th>
                  <th className="px-3 py-3.5">NETWORK</th>
                  <th className="px-3 py-3.5">HUB</th>
                  <th className="px-3 py-3.5">Unique Cores</th>
                  <th className="px-4 py-3.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-zinc-800 dark:text-zinc-200">
                {runs.map((r: any) => (
                  <tr key={r.id} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-900/40">
                    <td className="px-4 py-4">
                      <span className={`inline-flex rounded px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                        r.run_mode === "DRY_RUN" ? "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300" :
                        r.run_mode === "MANUAL" ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300" :
                        "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200"
                      }`}>
                        {r.run_mode || "SCHEDULED"}
                      </span>
                    </td>
                    <td className="px-4 py-4 font-medium text-zinc-900 dark:text-white whitespace-nowrap">
                      {r.run_date} <span className="text-zinc-400 text-[10px] ml-1">{new Date(r.started_at).toLocaleTimeString()}</span>
                    </td>
                    <td className="px-3 py-4 font-bold text-zinc-700 dark:text-zinc-300">
                      {r.sources_scanned || 0}
                    </td>
                    <td className="px-3 py-4 font-bold text-blue-600 dark:text-blue-400">
                      {r.candidates_found || 0}
                    </td>
                    <td className="px-3 py-4 font-bold text-emerald-600 dark:text-emerald-400">
                      {r.candidates_gte_80 || r.candidates_found || 0}
                    </td>
                    <td className="px-3 py-4 font-bold text-rose-600">
                      {r.candidates_rejected || 0}
                    </td>
                    <td className="px-3 py-4 font-bold text-amber-600">
                      {r.network_drafts_created || r.network_drafts || 0}
                    </td>
                    <td className="px-3 py-4 font-bold text-emerald-600">
                      {r.hub_drafts_created || r.hub_drafts || 0}
                    </td>
                    <td className="px-3 py-4 font-bold text-indigo-600">
                      {r.unique_core_drafts || r.shared_drafts_created || 0}
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-extrabold ${
                        r.status === "COMPLETED" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" :
                        r.status === "PARTIAL" ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" :
                        "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                      }`}>
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
