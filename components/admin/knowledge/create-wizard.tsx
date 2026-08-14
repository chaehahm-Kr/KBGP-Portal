"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import KnowledgeNavTabs from "./knowledge-nav-tabs";

export default function CreateWizard() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    type: "MANUAL",
    title: "",
    title_ko: "",
    title_en: "",
    summary_ko: "",
    summary_en: "",
    content_ko: "",
    content_en: "",
    category: "GENERAL",
    source_type: "CONTENT",
    linked_system_setting_key: "",
    linked_system_setting_name: "",
    linked_system_setting_value: "",
    audience: ["INTERNAL"], // Default INTERNAL ONLY
    is_sensitive_internal: false,
    related_module: "",
    related_menu: "",
    related_route: "",
    tagsInput: ""
  });

  const handleAudienceToggle = (aud: string) => {
    setFormData((prev) => {
      const current = prev.audience;
      if (current.includes(aud)) {
        // Prevent removing INTERNAL if empty
        const next = current.filter((a) => a !== aud);
        return { ...prev, audience: next.length > 0 ? next : ["INTERNAL"] };
      } else {
        return { ...prev, audience: [...current, aud] };
      }
    });
  };

  const handleSubmit = async () => {
    if (!formData.title && !formData.title_ko) {
      alert("Please enter a title.");
      return;
    }
    setSubmitting(true);
    try {
      const tags = formData.tagsInput
        ? formData.tagsInput.split(",").map((t) => t.trim()).filter(Boolean)
        : ["Knowledge"];

      const res = await fetch("/api/admin/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          title: formData.title || formData.title_ko,
          tags
        })
      });

      if (res.ok) {
        const json = await res.json();
        alert("Knowledge item created successfully!");
        router.push(`/admin/knowledge/${json.item.id}`);
      } else {
        const err = await res.json();
        alert(`Error: ${err.error}`);
      }
    } catch (e) {
      alert("Failed to submit knowledge item.");
    } finally {
      setSubmitting(false);
    }
  };

  const hasExternalAudience = formData.audience.some((a) =>
    ["BRAND", "RETAILER", "PUBLIC"].includes(a)
  );

  return (
    <div className="space-y-8 max-w-5xl">
      <KnowledgeNavTabs />
      {/* Wizard Header */}
      <div className="border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
          + Create New Knowledge Record
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          5-Step Guided Workflow for Knowledge Governance.
        </p>

        {/* Step Indicator */}
        <div className="mt-6 flex items-center justify-between">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-2">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                  step === i
                    ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                    : step > i
                    ? "bg-emerald-500 text-white"
                    : "bg-zinc-100 text-zinc-400 dark:bg-zinc-800"
                }`}
              >
                {step > i ? "✓" : i}
              </div>
              <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 hidden sm:inline">
                {i === 1 && "What is this?"}
                {i === 2 && "Who is it for?"}
                {i === 3 && "Content"}
                {i === 4 && "Connections"}
                {i === 5 && "Review & Publish"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* STEP 1: What is this? */}
      {step === 1 && (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950 space-y-6 shadow-sm">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white">STEP 1: What is this Knowledge Record?</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Knowledge Type</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full rounded-lg border border-zinc-300 p-2.5 text-xs dark:border-zinc-800 dark:bg-zinc-900 text-zinc-900 dark:text-white font-semibold"
              >
                <option value="MANUAL">MANUAL</option>
                <option value="POLICY">POLICY</option>
                <option value="SOP">SOP</option>
                <option value="FAQ">FAQ</option>
                <option value="SYSTEM_RULE">SYSTEM_RULE</option>
                <option value="DEFINITION">DEFINITION</option>
                <option value="GUIDE">GUIDE</option>
                <option value="DECISION_RECORD">DECISION_RECORD</option>
                <option value="INTERNAL_RULE">INTERNAL_RULE</option>
                <option value="TRAINING">TRAINING</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Category / Module</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full rounded-lg border border-zinc-300 p-2.5 text-xs dark:border-zinc-800 dark:bg-zinc-900 text-zinc-900 dark:text-white font-semibold"
              >
                <option value="GENERAL">GENERAL</option>
                <option value="OPERATIONS">OPERATIONS</option>
                <option value="ONBOARDING">ONBOARDING</option>
                <option value="INSIGHTS">INSIGHTS</option>
                <option value="GROWTH_SIMULATOR">GROWTH SIMULATOR</option>
                <option value="PRODUCTS">PRODUCTS</option>
                <option value="RETAIL_NETWORK">RETAIL NETWORK</option>
                <option value="APPLICATIONS">APPLICATIONS</option>
                <option value="AMAZON">AMAZON</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Primary Title (Korean or Main Title)</label>
            <input
              type="text"
              value={formData.title_ko}
              onChange={(e) => setFormData({ ...formData, title_ko: e.target.value, title: e.target.value })}
              placeholder="e.g. 신규 브랜드 온보딩 및 소싱 검증 가이드"
              className="w-full rounded-lg border border-zinc-300 p-2.5 text-sm dark:border-zinc-800 dark:bg-zinc-900 text-zinc-900 dark:text-white font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Source Type</label>
            <div className="grid grid-cols-3 gap-3">
              {(["CONTENT", "LIVE_SYSTEM", "HYBRID"] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setFormData({ ...formData, source_type: st })}
                  className={`p-3 rounded-lg border text-xs font-bold text-center transition-colors ${
                    formData.source_type === st
                      ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900"
                      : "border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {formData.source_type !== "CONTENT" && (
            <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/50 dark:border-indigo-950 dark:bg-indigo-950/20 space-y-3">
              <h4 className="text-xs font-bold text-indigo-900 dark:text-indigo-300 uppercase">Linked Live System Setting Parameter</h4>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <input
                  type="text"
                  value={formData.linked_system_setting_name}
                  onChange={(e) => setFormData({ ...formData, linked_system_setting_name: e.target.value })}
                  placeholder="Setting Name (e.g. Minimum Topic Score)"
                  className="rounded border border-zinc-300 p-2 dark:border-zinc-800 dark:bg-zinc-900 text-zinc-900 dark:text-white"
                />
                <input
                  type="text"
                  value={formData.linked_system_setting_value}
                  onChange={(e) => setFormData({ ...formData, linked_system_setting_value: e.target.value })}
                  placeholder="Current Value (e.g. 80)"
                  className="rounded border border-zinc-300 p-2 dark:border-zinc-800 dark:bg-zinc-900 text-zinc-900 dark:text-white font-mono"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* STEP 2: Who is it for? */}
      {step === 2 && (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950 space-y-6 shadow-sm">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white">STEP 2: Access & Audience (Default: INTERNAL ONLY)</h2>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2">Target Audiences</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {(["INTERNAL", "ADMIN / MANAGEMENT", "BRAND", "RETAILER", "PUBLIC"] as const).map((aud) => {
                const checked = formData.audience.includes(aud);
                return (
                  <button
                    key={aud}
                    type="button"
                    onClick={() => handleAudienceToggle(aud)}
                    className={`p-3 rounded-lg border text-xs font-bold text-left transition-colors flex items-center justify-between ${
                      checked
                        ? "border-emerald-600 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200"
                        : "border-zinc-200 bg-white text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400"
                    }`}
                  >
                    <span>{aud}</span>
                    <span>{checked ? "✓" : "+"}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-950/20 space-y-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_sensitive_internal}
                onChange={(e) => setFormData({ ...formData, is_sensitive_internal: e.target.checked })}
                className="h-4 w-4 rounded border-zinc-300 text-amber-600 focus:ring-amber-500"
              />
              <span className="text-xs font-bold text-amber-900 dark:text-amber-300">
                Mark as SENSITIVE INTERNAL (Evaluation weights, Margin Logic, Proprietary Algorithm)
              </span>
            </label>
            <p className="text-[11px] text-amber-800/80 dark:text-amber-400 pl-7">
              Sensitive items require explicit warning prompts & approver confirmation if audience is changed externally.
            </p>
          </div>
        </div>
      )}

      {/* STEP 3: Content */}
      {step === 3 && (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950 space-y-6 shadow-sm">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white">STEP 3: Content (KO / EN)</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Korean Summary (요약)</label>
              <textarea
                value={formData.summary_ko}
                onChange={(e) => setFormData({ ...formData, summary_ko: e.target.value })}
                rows={2}
                placeholder="한국어 요약 설명..."
                className="w-full rounded-lg border border-zinc-300 p-2.5 text-xs dark:border-zinc-800 dark:bg-zinc-900 text-zinc-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Korean Main Content (국문 본문)</label>
              <textarea
                value={formData.content_ko}
                onChange={(e) => setFormData({ ...formData, content_ko: e.target.value })}
                rows={8}
                placeholder="Markdown 형식의 세부 운영 본문..."
                className="w-full rounded-lg border border-zinc-300 p-2.5 text-xs font-mono dark:border-zinc-800 dark:bg-zinc-900 text-zinc-900 dark:text-white"
              />
            </div>

            <hr className="border-zinc-200 dark:border-zinc-800" />

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">English Title (Optional)</label>
              <input
                type="text"
                value={formData.title_en}
                onChange={(e) => setFormData({ ...formData, title_en: e.target.value })}
                placeholder="English Title..."
                className="w-full rounded-lg border border-zinc-300 p-2.5 text-xs dark:border-zinc-800 dark:bg-zinc-900 text-zinc-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">English Main Content (Optional)</label>
              <textarea
                value={formData.content_en}
                onChange={(e) => setFormData({ ...formData, content_en: e.target.value })}
                rows={4}
                placeholder="English markdown body content..."
                className="w-full rounded-lg border border-zinc-300 p-2.5 text-xs font-mono dark:border-zinc-800 dark:bg-zinc-900 text-zinc-900 dark:text-white"
              />
            </div>
          </div>
        </div>
      )}

      {/* STEP 4: Connections */}
      {step === 4 && (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950 space-y-6 shadow-sm">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white">STEP 4: Platform System Connections</h2>

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Related Menu</label>
              <input
                type="text"
                value={formData.related_menu}
                onChange={(e) => setFormData({ ...formData, related_menu: e.target.value })}
                placeholder="e.g. Editorial Rules"
                className="w-full rounded-lg border border-zinc-300 p-2 dark:border-zinc-800 dark:bg-zinc-900 text-zinc-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Related Route</label>
              <input
                type="text"
                value={formData.related_route}
                onChange={(e) => setFormData({ ...formData, related_route: e.target.value })}
                placeholder="e.g. /admin/insights/rules"
                className="w-full rounded-lg border border-zinc-300 p-2 font-mono dark:border-zinc-800 dark:bg-zinc-900 text-zinc-900 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Tags (Comma separated)</label>
            <input
              type="text"
              value={formData.tagsInput}
              onChange={(e) => setFormData({ ...formData, tagsInput: e.target.value })}
              placeholder="e.g. SOP, Internal, Verification, Sourcing"
              className="w-full rounded-lg border border-zinc-300 p-2 text-xs dark:border-zinc-800 dark:bg-zinc-900 text-zinc-900 dark:text-white"
            />
          </div>
        </div>
      )}

      {/* STEP 5: Review & Publish */}
      {step === 5 && (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950 space-y-6 shadow-sm">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white">STEP 5: Review & Governance Summary</h2>

          <div className="p-4 rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 text-xs space-y-2">
            <div>Title: <strong className="text-zinc-900 dark:text-white">{formData.title_ko || formData.title}</strong></div>
            <div>Type: <span className="font-semibold">{formData.type}</span></div>
            <div>Audiences: <span className="font-bold">{formData.audience.join(", ")}</span></div>
            <div>Sensitive Internal: <strong>{formData.is_sensitive_internal ? "YES" : "NO"}</strong></div>
          </div>

          {hasExternalAudience && (
            <div className="p-4 rounded-xl border border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200 text-xs space-y-1">
              <div className="font-bold flex items-center gap-2">
                🛡️ External Publication Review Required
              </div>
              <p>
                Audience includes external partners ({formData.audience.filter((a) => a !== "INTERNAL").join(", ")}). Direct publication is locked. Will be saved in <strong>IN_REVIEW</strong> state requiring Approver validation.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between border-t border-zinc-200 dark:border-zinc-800 pt-5">
        <button
          type="button"
          disabled={step === 1}
          onClick={() => setStep(step - 1)}
          className="rounded-lg border border-zinc-300 px-4 py-2 text-xs font-semibold text-zinc-700 disabled:opacity-40 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          ← Back
        </button>

        {step < 5 ? (
          <button
            type="button"
            onClick={() => setStep(step + 1)}
            className="rounded-lg bg-zinc-900 px-5 py-2 text-xs font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
          >
            Next →
          </button>
        ) : (
          <button
            type="button"
            disabled={submitting}
            onClick={handleSubmit}
            className="rounded-lg bg-emerald-600 px-6 py-2 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors shadow-sm disabled:opacity-50"
          >
            {submitting ? "Creating..." : "Save Knowledge Record"}
          </button>
        )}
      </div>
    </div>
  );
}
