"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  KnowledgeItem,
  KnowledgeVersion,
  KnowledgeRelation,
  ManualAsset,
  KnowledgeAuditLog
} from "@/lib/knowledge/types";
import KnowledgeNavTabs from "./knowledge-nav-tabs";

export default function DetailView({ id }: { id: string }) {
  const [data, setData] = useState<{
    item: KnowledgeItem;
    versions: KnowledgeVersion[];
    relations: KnowledgeRelation[];
    assets: ManualAsset[];
    auditLogs: KnowledgeAuditLog[];
  } | null>(null);

  const [activeTab, setActiveTab] = useState<"CONTENT" | "ACCESS" | "RELATIONS" | "VERSIONS" | "ACTIVITY">("CONTENT");
  const [language, setLanguage] = useState<"KO" | "EN">("KO");
  const [loading, setLoading] = useState(true);

  // Modals / Actions
  const [previewAsModal, setPreviewAsModal] = useState<"Admin" | "Brand" | "Retailer" | null>(null);
  const [newVersionModal, setNewVersionModal] = useState(false);
  const [compareModal, setCompareModal] = useState<KnowledgeVersion | null>(null);
  const [whatChanged, setWhatChanged] = useState("");
  const [whyChanged, setWhyChanged] = useState("");

  useEffect(() => {
    fetchDetail();
  }, [id]);

  const fetchDetail = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/knowledge/${id}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (e) {
      console.error("Failed to load detail:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNewVersion = async () => {
    if (!whatChanged || !whyChanged) {
      alert("Please describe what changed and why changed.");
      return;
    }
    try {
      const res = await fetch(`/api/admin/knowledge/${id}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CREATE_DRAFT",
          what_changed: whatChanged,
          why_changed: whyChanged
        })
      });
      if (res.ok) {
        alert("New Draft Version created successfully!");
        setNewVersionModal(false);
        setWhatChanged("");
        setWhyChanged("");
        fetchDetail();
      }
    } catch (e) {
      alert("Failed to create version.");
    }
  };

  const handlePublishVersion = async (versionStr: string) => {
    if (!confirm(`Are you sure you want to publish version ${versionStr}? Previous version will be marked SUPERSEDED.`)) return;
    try {
      const res = await fetch(`/api/admin/knowledge/${id}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "PUBLISH",
          version: versionStr
        })
      });
      if (res.ok) {
        alert("Version Published successfully!");
        fetchDetail();
      }
    } catch (e) {
      alert("Failed to publish version.");
    }
  };

  const handleApproveExternal = async () => {
    if (!confirm("Approve External Publication? Knowledge will become visible to authorized external audiences.")) return;
    try {
      const res = await fetch(`/api/admin/knowledge/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "APPROVE", comment: "External publication approved by Super Admin." })
      });
      if (res.ok) {
        alert("External Publication Approved & Published!");
        fetchDetail();
      }
    } catch (e) {
      alert("Failed to approve.");
    }
  };

  if (loading || !data) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
        <div className="h-64 bg-zinc-100 dark:bg-zinc-900 rounded-xl animate-pulse" />
      </div>
    );
  }

  const { item, versions, relations, assets, auditLogs } = data;

  const isKoComplete = Boolean(item.title_ko && item.content_ko);
  const isEnComplete = Boolean(item.title_en && item.content_en);

  return (
    <div className="space-y-6">
      <KnowledgeNavTabs />
      {/* Top Breadcrumb & Actions Header */}
      <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs text-zinc-500 mb-1">
            <Link href="/admin/knowledge/library" className="hover:underline">Library</Link>
            <span>/</span>
            <span className="font-semibold text-zinc-800 dark:text-zinc-200">{item.category}</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
              {item.title_ko || item.title}
            </h1>
            <span className="font-mono text-sm font-bold bg-zinc-100 dark:bg-zinc-800 px-2.5 py-0.5 rounded text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-700">
              {item.current_version}
            </span>
            <span className={`rounded-full px-3 py-0.5 text-xs font-semibold ${
              item.status === "PUBLISHED"
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
            }`}>
              {item.status}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {item.status === "PUBLISHED" && (
            <button
              onClick={() => setNewVersionModal(true)}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 transition-colors"
            >
              + Create New Version
            </button>
          )}

          {item.status === "DRAFT" && (
            <button
              onClick={() => handlePublishVersion(item.current_version)}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors"
            >
              Publish Version
            </button>
          )}

          {item.external_review_status === "REQUESTED" && (
            <button
              onClick={handleApproveExternal}
              className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition-colors"
            >
              Approve External Publication
            </button>
          )}
        </div>
      </div>

      {/* 5 Tabs Bar */}
      <div className="flex items-center border-b border-zinc-200 dark:border-zinc-800 space-x-6 text-sm font-semibold select-none">
        {(["CONTENT", "ACCESS", "RELATIONS", "VERSIONS", "ACTIVITY"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-3 transition-colors relative ${
              activeTab === tab
                ? "text-zinc-900 dark:text-white border-b-2 border-zinc-900 dark:border-white font-bold"
                : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* TAB 1: CONTENT */}
      {activeTab === "CONTENT" && (
        <div className="space-y-6">
          {/* Language Toggle & Status */}
          <div className="flex items-center justify-between bg-zinc-50 dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-zinc-500">Language View:</span>
              <div className="inline-flex rounded-lg bg-zinc-200 p-1 dark:bg-zinc-800">
                <button
                  onClick={() => setLanguage("KO")}
                  className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                    language === "KO"
                      ? "bg-white text-zinc-900 shadow dark:bg-zinc-950 dark:text-white"
                      : "text-zinc-600 dark:text-zinc-400"
                  }`}
                >
                  한국어 (KO)
                </button>
                <button
                  onClick={() => setLanguage("EN")}
                  className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                    language === "EN"
                      ? "bg-white text-zinc-900 shadow dark:bg-zinc-950 dark:text-white"
                      : "text-zinc-600 dark:text-zinc-400"
                  }`}
                >
                  English (EN)
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1 font-medium">
                KO Status: {isKoComplete ? <span className="text-emerald-600 font-bold">Complete</span> : <span className="text-amber-600 font-bold">Missing</span>}
              </span>
              <span className="flex items-center gap-1 font-medium">
                EN Status: {isEnComplete ? <span className="text-emerald-600 font-bold">Complete</span> : <span className="text-amber-600 font-bold">Missing</span>}
              </span>
            </div>
          </div>

          {/* Source Type / Live System Info */}
          {item.source_type !== "CONTENT" && (
            <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/60 dark:border-indigo-900/50 dark:bg-indigo-950/20 text-xs text-indigo-900 dark:text-indigo-200 space-y-1">
              <div className="font-bold uppercase tracking-wider flex items-center gap-2">
                <span>⚡ Source Type: {item.source_type}</span>
              </div>
              <p>
                Linked System Setting: <strong className="font-mono">{item.linked_system_setting_name || item.linked_system_setting_key}</strong>
              </p>
              <p>
                Current System Value: <span className="font-bold text-indigo-700 dark:text-indigo-300 font-mono text-sm">{item.linked_system_setting_value}</span>
              </p>
            </div>
          )}

          {/* Main Content Body Card */}
          <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950 space-y-4 shadow-sm">
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
              {language === "KO" ? item.title_ko || item.title : item.title_en || item.title}
            </h2>
            <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300 border-l-4 border-zinc-400 dark:border-zinc-600 pl-3 py-1">
              {language === "KO" ? item.summary_ko || "요약 정보가 없습니다." : item.summary_en || "No English summary available."}
            </p>
            <hr className="border-zinc-200 dark:border-zinc-800" />
            <div className="prose prose-sm dark:prose-invert max-w-none text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap font-mono leading-relaxed">
              {language === "KO" ? item.content_ko || "국문 본문 내용이 없습니다." : item.content_en || "No English content body provided."}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ACCESS */}
      {activeTab === "ACCESS" && (
        <div className="space-y-6">
          <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950 space-y-6 shadow-sm">
            <div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Audience & Access Governance</h3>
              <p className="text-xs text-zinc-500 mt-1">Default security is INTERNAL ONLY (Deny by Default).</p>
            </div>

            {/* Audience Badges */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase text-zinc-500">Configured Audiences</label>
              <div className="flex flex-wrap gap-2">
                {item.audience.map((aud) => (
                  <span
                    key={aud}
                    className={`rounded-lg px-3 py-1 text-xs font-bold ${
                      aud === "INTERNAL"
                        ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                        : "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800"
                    }`}
                  >
                    {aud}
                  </span>
                ))}
              </div>
            </div>

            {/* Sensitive Internal Flag */}
            <div className={`p-4 rounded-xl border ${
              item.is_sensitive_internal
                ? "border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30"
                : "border-zinc-200 dark:border-zinc-800"
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-amber-900 dark:text-amber-300 flex items-center gap-2">
                    ⚠️ SENSITIVE INTERNAL FLAG
                  </h4>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
                    Contains proprietary algorithms, supplier cost, or internal evaluation logic. External audience changes require strong warning modal & approver verification.
                  </p>
                </div>
                <span className="font-bold text-xs px-2.5 py-1 rounded bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-200">
                  {item.is_sensitive_internal ? "ENABLED" : "OFF"}
                </span>
              </div>
            </div>

            {/* Preview As Interactive Button */}
            <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-zinc-900 dark:text-white">Preview As Simulation</h4>
                <p className="text-xs text-zinc-500">Simulate how this knowledge item is retrieved under different audience contexts.</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPreviewAsModal("Admin")}
                  className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900"
                >
                  Preview As Admin
                </button>
                <button
                  onClick={() => setPreviewAsModal("Brand")}
                  className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900"
                >
                  Preview As Brand
                </button>
                <button
                  onClick={() => setPreviewAsModal("Retailer")}
                  className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900"
                >
                  Preview As Retailer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: RELATIONS */}
      {activeTab === "RELATIONS" && (
        <div className="space-y-6">
          <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950 space-y-4 shadow-sm">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Platform System Connections</h3>

            {relations.length === 0 ? (
              <p className="text-xs text-zinc-500">No explicit system relation maps defined yet.</p>
            ) : (
              <div className="space-y-3">
                {relations.map((rel) => (
                  <div key={rel.id} className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs space-y-1">
                    <div className="font-bold text-zinc-900 dark:text-white">Portal: {rel.related_portal || "Admin"}</div>
                    <div>Module: <span className="font-semibold">{rel.related_module}</span></div>
                    {rel.related_menu && <div>Menu: {rel.related_menu}</div>}
                    {rel.related_route && <div>Route: <code className="font-mono text-zinc-800 dark:text-zinc-200">{rel.related_route}</code></div>}
                    {rel.related_system_setting && <div>System Setting: <code className="font-mono text-indigo-600 dark:text-indigo-400">{rel.related_system_setting}</code></div>}
                  </div>
                ))}
              </div>
            )}

            {assets.length > 0 && (
              <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-3">
                <h4 className="text-sm font-bold text-zinc-900 dark:text-white">Attached Manual PDF Assets</h4>
                {assets.map((asset) => (
                  <div key={asset.id} className="flex items-center justify-between p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs">
                    <div>
                      <div className="font-bold text-zinc-900 dark:text-white">{asset.manual_title}</div>
                      <div className="text-zinc-500">Version: {asset.version} ({asset.language})</div>
                    </div>
                    <a
                      href={asset.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded border border-zinc-300 px-3 py-1 font-semibold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900"
                    >
                      Download PDF
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: VERSIONS */}
      {activeTab === "VERSIONS" && (
        <div className="space-y-6">
          <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Version Snapshot History</h3>
              {item.status === "PUBLISHED" && (
                <button
                  onClick={() => setNewVersionModal(true)}
                  className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900"
                >
                  + Create New Version
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-zinc-200 bg-zinc-50 text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
                  <tr>
                    <th className="py-3 px-3">Version</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Effective Date</th>
                    <th className="py-3 px-3">Changed By</th>
                    <th className="py-3 px-3">What Changed</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
                  {versions.map((ver) => (
                    <tr key={ver.id}>
                      <td className="py-3 px-3 font-mono font-bold">{ver.version}</td>
                      <td className="py-3 px-3">
                        <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                          ver.status === "PUBLISHED"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            : ver.status === "SUPERSEDED"
                            ? "bg-zinc-200 text-zinc-500 line-through dark:bg-zinc-800 dark:text-zinc-500"
                            : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                        }`}>
                          {ver.status}
                        </span>
                      </td>
                      <td className="py-3 px-3">{ver.effective_date}</td>
                      <td className="py-3 px-3 font-medium">{ver.created_by_name}</td>
                      <td className="py-3 px-3 text-zinc-600 dark:text-zinc-400">{ver.what_changed || "Initial version"}</td>
                      <td className="py-3 px-3 text-right space-x-2">
                        <button
                          onClick={() => setCompareModal(ver)}
                          className="text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
                        >
                          Compare
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: ACTIVITY */}
      {activeTab === "ACTIVITY" && (
        <div className="space-y-6">
          <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950 space-y-4 shadow-sm">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Governance Audit Log Timeline</h3>
            <div className="space-y-4 relative pl-6 border-l-2 border-zinc-200 dark:border-zinc-800">
              {auditLogs.map((log) => (
                <div key={log.id} className="relative space-y-1">
                  <div className="absolute -left-[31px] top-1 h-3 w-3 rounded-full bg-zinc-900 dark:bg-white" />
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-zinc-900 dark:text-white">{log.action}</span>
                    <span className="text-zinc-500">{new Date(log.created_at).toLocaleString()}</span>
                  </div>
                  <div className="text-xs text-zinc-600 dark:text-zinc-400">By: <strong className="text-zinc-800 dark:text-zinc-200">{log.user_name}</strong></div>
                  {log.reason && <p className="text-xs text-zinc-500 italic">"{log.reason}"</p>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* PREVIEW AS MODAL */}
      {previewAsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <span>👁️ Preview As: {previewAsModal}</span>
              </h3>
              <button onClick={() => setPreviewAsModal(null)} className="text-xs font-bold text-zinc-500 hover:text-zinc-800">✕ Close</button>
            </div>

            {/* Simulation Logic */}
            {(previewAsModal === "Brand" || previewAsModal === "Retailer") && item.audience.includes("INTERNAL") && !item.audience.includes("PUBLIC") && !item.audience.includes(previewAsModal.toUpperCase() as any) ? (
              <div className="p-8 text-center bg-rose-50 border border-rose-200 rounded-xl text-rose-800 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-200 space-y-2">
                <div className="text-xl font-bold">🚫 ACCESS DENIED</div>
                <p className="text-xs">
                  This knowledge record is configured as <strong>INTERNAL ONLY</strong>. It will be completely excluded from {previewAsModal} search & retrieval queries (0 Items returned).
                </p>
              </div>
            ) : (
              <div className="p-4 rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 space-y-3 text-xs">
                <div className="font-bold text-sm text-zinc-900 dark:text-white">{item.title_ko || item.title}</div>
                <p className="text-zinc-600 dark:text-zinc-400">{item.summary_ko || item.summary_en}</p>
                <div className="pt-2 text-[10px] text-emerald-600 font-bold">✅ Visible to {previewAsModal} audience</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CREATE NEW VERSION MODAL */}
      {newVersionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Create New Draft Version</h3>
            <p className="text-xs text-zinc-500">Published version {item.current_version} will remain live until the new draft version is published.</p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">What Changed?</label>
                <input
                  type="text"
                  value={whatChanged}
                  onChange={(e) => setWhatChanged(e.target.value)}
                  placeholder="e.g. Updated FOB margin threshold to 65%"
                  className="w-full rounded-lg border border-zinc-300 p-2 text-xs dark:border-zinc-800 dark:bg-zinc-900 text-zinc-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Why Changed?</label>
                <textarea
                  value={whyChanged}
                  onChange={(e) => setWhyChanged(e.target.value)}
                  placeholder="e.g. Compliance adaptation under MoCRA rules"
                  rows={3}
                  className="w-full rounded-lg border border-zinc-300 p-2 text-xs dark:border-zinc-800 dark:bg-zinc-900 text-zinc-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button onClick={() => setNewVersionModal(false)} className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-700">Cancel</button>
              <button onClick={handleCreateNewVersion} className="rounded-lg bg-zinc-900 px-4 py-1.5 text-xs font-semibold text-white dark:bg-white dark:text-zinc-900">Create Draft</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
