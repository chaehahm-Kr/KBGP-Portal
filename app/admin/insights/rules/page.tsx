"use client";

import React, { useState, useEffect } from "react";

export default function EditorialRulesPage() {
  const [rules, setRules] = useState<any>({
    daily_run_time: "05:00 AM",
    timezone: "America/New_York",
    minimum_topic_score: 80,
    network_daily_draft_max: 3,
    hub_daily_draft_max: 3,
    topic_score_weights: {
      relevance: 25,
      actionability: 25,
      evidence_strength: 20,
      timeliness: 15,
      originality: 10,
      strategic_fit: 5
    },
    human_approval_required: true,
    auto_publish: false,
    auto_visual_preparation: true,
    auto_translation: true,
    source_validation_required: true,
    duplicate_check_required: true
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const fetchRules = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/admin/insights/rules");
      if (res.ok) {
        const data = await res.json();
        if (data.rules) {
          setRules(data.rules);
        }
      }
    } catch (e) {
      console.error("Failed to load rules:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      setSaveSuccess(false);

      const res = await fetch("/api/admin/insights/rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rules)
      });

      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        alert("Failed to update rules.");
      }
    } catch (e) {
      alert("Error saving rules.");
    } finally {
      setIsSaving(false);
    }
  };

  const weights = rules.topic_score_weights || {};
  const totalWeight = (Number(weights.relevance) || 0) + 
                      (Number(weights.actionability) || 0) + 
                      (Number(weights.evidence_strength) || 0) + 
                      (Number(weights.timeliness) || 0) + 
                      (Number(weights.originality) || 0) + 
                      (Number(weights.strategic_fit) || 0);

  return (
    <div className="w-full space-y-6">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-6">
        <div>
          <span className="text-xs font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-widest">
            Automation Governance
          </span>
          <h1 className="text-2xl md:text-3xl font-extrabold text-zinc-900 dark:text-white mt-1">
            Editorial Master Rules (V1)
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            Configure daily run schedules, topic score thresholds, draft quotas, and automation policy guards.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="rounded-lg bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow hover:bg-blue-700 disabled:opacity-50"
        >
          {isSaving ? "Saving..." : "Save Master Rules"}
        </button>
      </div>

      {saveSuccess && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 text-xs font-bold text-emerald-800 dark:bg-emerald-950 dark:border-emerald-900 dark:text-emerald-300">
          ✓ Editorial Master Rules saved successfully to database!
        </div>
      )}

      {isLoading ? (
        <div className="p-12 text-center text-sm text-zinc-500">Loading master settings...</div>
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          
          {/* Section 1: Daily Run Schedule & Quota Rules */}
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 space-y-4">
            <h3 className="text-base font-bold text-zinc-900 dark:text-white border-b border-zinc-100 dark:border-zinc-800 pb-3">
              1. Daily Automation Run Schedule & Quota Policy
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Daily Run Time
                </label>
                <input
                  type="text"
                  value={rules.daily_run_time || "05:00 AM"}
                  onChange={(e) => setRules({ ...rules, daily_run_time: e.target.value })}
                  className="w-full rounded-md border border-zinc-300 bg-white p-2 text-xs font-semibold dark:border-zinc-700 dark:bg-zinc-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Timezone
                </label>
                <input
                  type="text"
                  value={rules.timezone || "America/New_York"}
                  onChange={(e) => setRules({ ...rules, timezone: e.target.value })}
                  className="w-full rounded-md border border-zinc-300 bg-white p-2 text-xs font-semibold dark:border-zinc-700 dark:bg-zinc-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Minimum Topic Score Threshold
                </label>
                <input
                  type="number"
                  value={rules.minimum_topic_score || 80}
                  onChange={(e) => setRules({ ...rules, minimum_topic_score: Number(e.target.value) })}
                  className="w-full rounded-md border border-zinc-300 bg-white p-2 text-xs font-bold text-blue-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-blue-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  NETWORK Daily Draft Max Quota
                </label>
                <input
                  type="number"
                  value={rules.network_daily_draft_max || 3}
                  onChange={(e) => setRules({ ...rules, network_daily_draft_max: Number(e.target.value) })}
                  className="w-full rounded-md border border-zinc-300 bg-white p-2 text-xs font-bold dark:border-zinc-700 dark:bg-zinc-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  HUB Daily Draft Max Quota
                </label>
                <input
                  type="number"
                  value={rules.hub_daily_draft_max || 3}
                  onChange={(e) => setRules({ ...rules, hub_daily_draft_max: Number(e.target.value) })}
                  className="w-full rounded-md border border-zinc-300 bg-white p-2 text-xs font-bold dark:border-zinc-700 dark:bg-zinc-900"
                />
              </div>
            </div>

            <div className="rounded-lg bg-zinc-50 border border-zinc-200 p-4 dark:bg-zinc-900/50 dark:border-zinc-800 text-xs space-y-1 text-zinc-600 dark:text-zinc-400">
              <span className="font-bold text-zinc-900 dark:text-white">Counting Rule & Quality Guard:</span>
              <p>
                When a single Core Insight applies to both NETWORK and HUB, it consumes 1 NETWORK quota and 1 HUB quota simultaneously while maintaining only 1 unique Core Insight record in the database (0 to 6 unique core insights daily). Low-quality topics below {rules.minimum_topic_score} score will be automatically rejected.
              </p>
            </div>
          </div>

          {/* Section 2: Topic Score Criteria Weights */}
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                2. Topic Score Structure & Evaluation Weights
              </h3>
              <span className={`text-xs font-bold ${totalWeight === 100 ? "text-emerald-600" : "text-rose-600"}`}>
                Total Weight: {totalWeight} / 100
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Relevance (V1 Default: 25)
                </label>
                <input
                  type="number"
                  value={weights.relevance || 25}
                  onChange={(e) => setRules({
                    ...rules,
                    topic_score_weights: { ...weights, relevance: Number(e.target.value) }
                  })}
                  className="w-full rounded-md border border-zinc-300 bg-white p-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Actionability (V1 Default: 25)
                </label>
                <input
                  type="number"
                  value={weights.actionability || 25}
                  onChange={(e) => setRules({
                    ...rules,
                    topic_score_weights: { ...weights, actionability: Number(e.target.value) }
                  })}
                  className="w-full rounded-md border border-zinc-300 bg-white p-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Evidence Strength (V1 Default: 20)
                </label>
                <input
                  type="number"
                  value={weights.evidence_strength || 20}
                  onChange={(e) => setRules({
                    ...rules,
                    topic_score_weights: { ...weights, evidence_strength: Number(e.target.value) }
                  })}
                  className="w-full rounded-md border border-zinc-300 bg-white p-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Timeliness (V1 Default: 15)
                </label>
                <input
                  type="number"
                  value={weights.timeliness || 15}
                  onChange={(e) => setRules({
                    ...rules,
                    topic_score_weights: { ...weights, timeliness: Number(e.target.value) }
                  })}
                  className="w-full rounded-md border border-zinc-300 bg-white p-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Originality (V1 Default: 10)
                </label>
                <input
                  type="number"
                  value={weights.originality || 10}
                  onChange={(e) => setRules({
                    ...rules,
                    topic_score_weights: { ...weights, originality: Number(e.target.value) }
                  })}
                  className="w-full rounded-md border border-zinc-300 bg-white p-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Strategic Fit (V1 Default: 5)
                </label>
                <input
                  type="number"
                  value={weights.strategic_fit || 5}
                  onChange={(e) => setRules({
                    ...rules,
                    topic_score_weights: { ...weights, strategic_fit: Number(e.target.value) }
                  })}
                  className="w-full rounded-md border border-zinc-300 bg-white p-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Governance & Guard Toggles */}
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 space-y-4">
            <h3 className="text-base font-bold text-zinc-900 dark:text-white border-b border-zinc-100 dark:border-zinc-800 pb-3">
              3. Automation Pipeline Safety Guards & Feature Toggles
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <label className="flex items-center justify-between rounded-lg border border-zinc-200 p-3 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50">
                <div>
                  <span className="font-bold text-zinc-900 dark:text-white block">Human Approval Required</span>
                  <span className="text-[11px] text-zinc-500">AI cannot publish without human operator approval</span>
                </div>
                <input
                  type="checkbox"
                  checked={rules.human_approval_required !== false}
                  onChange={(e) => setRules({ ...rules, human_approval_required: e.target.checked })}
                  className="h-4 w-4 rounded"
                />
              </label>

              <label className="flex items-center justify-between rounded-lg border border-zinc-200 p-3 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50">
                <div>
                  <span className="font-bold text-zinc-900 dark:text-white block">Auto Publish</span>
                  <span className="text-[11px] text-zinc-500">Directly publish without queue review (Default: OFF)</span>
                </div>
                <input
                  type="checkbox"
                  checked={rules.auto_publish === true}
                  onChange={(e) => setRules({ ...rules, auto_publish: e.target.checked })}
                  className="h-4 w-4 rounded"
                />
              </label>

              <label className="flex items-center justify-between rounded-lg border border-zinc-200 p-3 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50">
                <div>
                  <span className="font-bold text-zinc-900 dark:text-white block">Auto Visual Preparation</span>
                  <span className="text-[11px] text-zinc-500">Prepare visual assets during draft generation</span>
                </div>
                <input
                  type="checkbox"
                  checked={rules.auto_visual_preparation !== false}
                  onChange={(e) => setRules({ ...rules, auto_visual_preparation: e.target.checked })}
                  className="h-4 w-4 rounded"
                />
              </label>

              <label className="flex items-center justify-between rounded-lg border border-zinc-200 p-3 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50">
                <div>
                  <span className="font-bold text-zinc-900 dark:text-white block">Auto Dual Translation</span>
                  <span className="text-[11px] text-zinc-500">Automatically generate KO / EN translation pairs</span>
                </div>
                <input
                  type="checkbox"
                  checked={rules.auto_translation !== false}
                  onChange={(e) => setRules({ ...rules, auto_translation: e.target.checked })}
                  className="h-4 w-4 rounded"
                />
              </label>

              <label className="flex items-center justify-between rounded-lg border border-zinc-200 p-3 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50">
                <div>
                  <span className="font-bold text-zinc-900 dark:text-white block">Source Validation Required</span>
                  <span className="text-[11px] text-zinc-500">Block draft generation if primary source is missing</span>
                </div>
                <input
                  type="checkbox"
                  checked={rules.source_validation_required !== false}
                  onChange={(e) => setRules({ ...rules, source_validation_required: e.target.checked })}
                  className="h-4 w-4 rounded"
                />
              </label>

              <label className="flex items-center justify-between rounded-lg border border-zinc-200 p-3 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50">
                <div>
                  <span className="font-bold text-zinc-900 dark:text-white block">Duplicate Check Required</span>
                  <span className="text-[11px] text-zinc-500">Reject topic if duplicate ratio exceeds threshold</span>
                </div>
                <input
                  type="checkbox"
                  checked={rules.duplicate_check_required !== false}
                  onChange={(e) => setRules({ ...rules, duplicate_check_required: e.target.checked })}
                  className="h-4 w-4 rounded"
                />
              </label>
            </div>
          </div>

        </form>
      )}

    </div>
  );
}
