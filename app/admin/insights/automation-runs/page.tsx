"use client";

import React, { useState, useEffect } from "react";

export default function AutomationRunsPage() {
  const [runs, setRuns] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSimulating, setIsSimulating] = useState(false);

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

  const handleSimulateRun = async () => {
    try {
      setIsSimulating(true);
      const now = new Date();
      const res = await fetch("/api/admin/insights/automation-runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          run_date: now.toISOString().split("T")[0],
          started_at: new Date(now.getTime() - 120000).toISOString(),
          completed_at: now.toISOString(),
          sources_scanned: 14,
          candidates_found: 6,
          candidates_rejected: 2,
          network_drafts_created: 2,
          hub_drafts_created: 2,
          shared_drafts_created: 2,
          status: "COMPLETED"
        })
      });

      if (res.ok) {
        fetchRuns();
      }
    } catch (e) {
      alert("Failed to simulate run.");
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-6">
        <div>
          <span className="text-xs font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-widest">
            Automation Execution Log
          </span>
          <h1 className="text-2xl md:text-3xl font-extrabold text-zinc-900 dark:text-white mt-1">
            Automation Runs Monitor
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            Monitor daily automated research runs, candidate evaluation counts, draft generation metrics, and run status logs.
          </p>
        </div>

        <button
          onClick={handleSimulateRun}
          disabled={isSimulating}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-xs font-bold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 disabled:opacity-50"
        >
          {isSimulating ? "Running Diagnostics..." : "+ Test Engine Run Log"}
        </button>
      </div>

      {/* Runs Table */}
      <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-sm text-zinc-500">Loading automation run logs...</div>
        ) : runs.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <h3 className="text-base font-bold text-zinc-900 dark:text-white">No Automation Runs Recorded</h3>
            <p className="text-xs text-zinc-500">
              The daily research engine runs automatically at 05:00 AM ET. Click "+ Test Engine Run Log" to record a diagnostic run entry.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-zinc-200 bg-zinc-50 font-semibold text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400">
                <tr>
                  <th className="px-5 py-3.5">Run Date</th>
                  <th className="px-4 py-3.5">Started At</th>
                  <th className="px-4 py-3.5">Completed At</th>
                  <th className="px-3 py-3.5">Sources Scanned</th>
                  <th className="px-3 py-3.5">Candidates Found</th>
                  <th className="px-3 py-3.5">Rejected</th>
                  <th className="px-3 py-3.5">NETWORK Drafts</th>
                  <th className="px-3 py-3.5">HUB Drafts</th>
                  <th className="px-3 py-3.5">Shared</th>
                  <th className="px-4 py-3.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-zinc-800 dark:text-zinc-200">
                {runs.map((r: any) => (
                  <tr key={r.id} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-900/40">
                    <td className="px-5 py-4 font-bold text-zinc-900 dark:text-white">
                      {r.run_date}
                    </td>
                    <td className="px-4 py-4 text-zinc-500 whitespace-nowrap">
                      {new Date(r.started_at).toLocaleTimeString()}
                    </td>
                    <td className="px-4 py-4 text-zinc-500 whitespace-nowrap">
                      {r.completed_at ? new Date(r.completed_at).toLocaleTimeString() : "-"}
                    </td>
                    <td className="px-3 py-4 font-bold text-zinc-700 dark:text-zinc-300">
                      {r.sources_scanned || 0}
                    </td>
                    <td className="px-3 py-4 font-bold text-blue-600 dark:text-blue-400">
                      {r.candidates_found || 0}
                    </td>
                    <td className="px-3 py-4 font-bold text-rose-600">
                      {r.candidates_rejected || 0}
                    </td>
                    <td className="px-3 py-4 font-bold text-amber-600">
                      {r.network_drafts_created || 0}
                    </td>
                    <td className="px-3 py-4 font-bold text-emerald-600">
                      {r.hub_drafts_created || 0}
                    </td>
                    <td className="px-3 py-4 font-bold text-indigo-600">
                      {r.shared_drafts_created || 0}
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-extrabold ${
                        r.status === "COMPLETED" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" :
                        r.status === "RUNNING" ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300" :
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
