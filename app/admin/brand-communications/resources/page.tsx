"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import CompanyMultiSelect, {
  type SelectableCompany,
} from "@/components/admin/brand-comms/company-multi-select";
import {
  RESOURCE_CATEGORIES,
  RESOURCE_LANGUAGES,
  formatBytes,
  getResourceCategoryLabel,
  type AudienceMode,
  type PublicationStatus,
  type ResourceCategory,
  type ResourceFileType,
  type ResourceLanguage,
  type ResourceSourceType,
} from "@/lib/brand-comms/types";
import { stageLargeFiles } from "@/lib/files/stage-form-files";

interface AdminResource {
  id: string;
  title_ko: string;
  title_en: string | null;
  description_ko: string | null;
  description_en: string | null;
  category: ResourceCategory;
  source_type: ResourceSourceType;
  linked_insight_id: string | null;
  linked_insight_slug: string | null;
  file_type: ResourceFileType;
  file_name: string | null;
  file_size: number | null;
  file_sha256: string | null;
  page_count: number | null;
  version: string;
  language: ResourceLanguage;
  audience_mode: AudienceMode;
  notification_enabled: boolean;
  notification_sent_at: string | null;
  status: PublicationStatus;
  published_at: string | null;
  updated_at: string;
  target_company_ids: string[];
  resolved_file_available?: boolean;
}

interface SelectableInsight {
  id: string;
  slug: string;
  title_ko: string;
  title_en: string | null;
  status: string;
  has_pdf: boolean;
  pdf: { file_name: string; file_size: number; page_count: number } | null;
}

const EMPTY_FORM = {
  title_ko: "",
  title_en: "",
  description_ko: "",
  description_en: "",
  category: "FDA_COMPLIANCE" as ResourceCategory,
  source_type: "UPLOADED_FILE" as ResourceSourceType,
  linked_insight_id: "",
  file_type: "PDF" as ResourceFileType,
  version: "v1.0",
  language: "KO" as ResourceLanguage,
  audience_mode: "ALL_COMPANIES" as AudienceMode,
  target_company_ids: [] as string[],
  notification_enabled: false,
};

export default function AdminBrandResourcesPage() {
  const [resources, setResources] = useState<AdminResource[]>([]);
  const [companies, setCompanies] = useState<SelectableCompany[]>([]);
  const [insights, setInsights] = useState<SelectableInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  // Filters
  const [searchQ, setSearchQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [audienceFilter, setAudienceFilter] = useState("ALL");

  // Modal state
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AdminResource | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (categoryFilter !== "ALL") params.set("category", categoryFilter);
      if (audienceFilter !== "ALL") params.set("audience", audienceFilter);
      if (searchQ.trim()) params.set("q", searchQ.trim());

      const [resList, metaRes] = await Promise.all([
        fetch(`/api/admin/brand-comms/resources?${params.toString()}`),
        fetch("/api/admin/brand-comms/companies"),
      ]);
      const resData = await resList.json();
      const metaData = await metaRes.json();
      if (!resList.ok) throw new Error(resData.error || "Failed to load resources");

      setResources(resData.resources || []);
      if (metaRes.ok) {
        setCompanies(metaData.companies || []);
        setInsights(metaData.insights || []);
      }
    } catch (e: any) {
      setError(e?.message || "Failed to load resources.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, categoryFilter, audienceFilter, searchQ]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const pdfInsights = insights.filter((i) => i.has_pdf);

  const openCreate = () => {
    setEditingItem(null);
    setForm(EMPTY_FORM);
    setFeedback(null);
    setEditorOpen(true);
  };

  const openEdit = (item: AdminResource) => {
    setEditingItem(item);
    setForm({
      title_ko: item.title_ko || "",
      title_en: item.title_en || "",
      description_ko: item.description_ko || "",
      description_en: item.description_en || "",
      category: item.category,
      source_type: item.source_type,
      linked_insight_id: item.linked_insight_id || "",
      file_type: item.file_type,
      version: item.version || "v1.0",
      language: item.language || "KO",
      audience_mode: item.audience_mode,
      target_company_ids: item.target_company_ids || [],
      notification_enabled: Boolean(item.notification_enabled),
    });
    setFeedback(null);
    setEditorOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      const selectedInsight = insights.find((i) => i.id === form.linked_insight_id);
      const payload = {
        ...form,
        linked_insight_id: form.linked_insight_id || null,
        linked_insight_slug: selectedInsight?.slug || null,
      };
      const url = editingItem
        ? `/api/admin/brand-comms/resources/${editingItem.id}`
        : "/api/admin/brand-comms/resources";
      const method = editingItem ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");

      setEditingItem(data.resource);
      setFeedback({
        type: "ok",
        msg: editingItem
          ? "Resource metadata saved."
          : form.source_type === "LINKED_INSIGHT_PDF"
          ? "Resource linked to existing Insights PDF (zero file duplication)."
          : "Resource draft created. Upload a file (PDF/XLSX/DOCX) below, then Publish.",
      });
      await loadAll();
    } catch (err: any) {
      setFeedback({ type: "err", msg: err?.message || "Save failed" });
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!editingItem) return;
    setUploadingFile(true);
    setFeedback(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("version", form.version || "v1.0");
      const stagedFd = await stageLargeFiles(fd);
      const res = await fetch(`/api/admin/brand-comms/resources/${editingItem.id}/file`, {
        method: "POST",
        body: stagedFd,
      });
      const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setEditingItem((prev) =>
        prev ? { ...prev, ...data.resource, resolved_file_available: true } : prev
      );
      setFeedback({
        type: "ok",
        msg: `File saved (${data.resource.file_name}, ${data.resource.version}, SHA-256 verified).`,
      });
      await loadAll();
    } catch (err: any) {
      setFeedback({ type: "err", msg: err?.message || "File upload failed" });
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleStatusAction = async (
    item: AdminResource,
    action: "PUBLISH" | "UNPUBLISH" | "ARCHIVE"
  ) => {
    setFeedback(null);
    try {
      const res = await fetch(`/api/admin/brand-comms/resources/${item.id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          send_notification: item.notification_enabled,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `${action} failed`);
      setFeedback({
        type: "ok",
        msg: `Resource ${action} completed.${
          action === "PUBLISH"
            ? ` (Notifications sent: ${data.notifications?.dispatchedCount ?? 0})`
            : ""
        }`,
      });
      if (editingItem && editingItem.id === item.id) {
        setEditingItem((prev) => (prev ? { ...prev, ...data.resource } : prev));
      }
      await loadAll();
    } catch (err: any) {
      setFeedback({ type: "err", msg: err?.message || "Action failed" });
    }
  };

  const statusBadge = (s: PublicationStatus) => {
    if (s === "PUBLISHED")
      return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30";
    if (s === "ARCHIVED")
      return "bg-zinc-500/15 text-zinc-500 dark:text-zinc-400 border-zinc-500/30";
    return "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-500">
            <Link
              href="/admin/brand-communications/announcements"
              className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white underline-offset-4 hover:underline"
            >
              Announcements
            </Link>
            <span>/</span>
            <span>Resource Center</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
            Brand Portal Resource Center
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Manage downloadable PDF, XLSX, and DOCX guides or link existing Insights PDF guides without duplicating storage files.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors cursor-pointer"
        >
          + Add Resource
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-3">
        <input
          type="text"
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
          placeholder="Search resource title, description, or filename..."
          className="flex-1 min-w-[200px] rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-3 py-1.5 text-sm text-zinc-900 dark:text-white"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-800 dark:text-zinc-200"
        >
          <option value="ALL">All Statuses</option>
          <option value="DRAFT">DRAFT</option>
          <option value="PUBLISHED">PUBLISHED</option>
          <option value="ARCHIVED">ARCHIVED</option>
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-800 dark:text-zinc-200"
        >
          <option value="ALL">All Categories</option>
          {RESOURCE_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.labelEn}
            </option>
          ))}
        </select>
        <select
          value={audienceFilter}
          onChange={(e) => setAudienceFilter(e.target.value)}
          className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-800 dark:text-zinc-200"
        >
          <option value="ALL">All Audiences</option>
          <option value="ALL_COMPANIES">All Active Brands</option>
          <option value="SELECTED_COMPANIES">Selected Companies</option>
        </select>
      </div>

      {feedback && (
        <div
          className={`rounded-lg border px-4 py-2.5 text-sm font-medium ${
            feedback.type === "ok"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300"
          }`}
        >
          {feedback.msg}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-600 dark:text-rose-400">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              <th className="py-3 px-4">Resource</th>
              <th className="py-3 px-3">Category</th>
              <th className="py-3 px-3">Source / File</th>
              <th className="py-3 px-3">Audience</th>
              <th className="py-3 px-3">Status</th>
              <th className="py-3 px-3">Updated</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200/70 dark:divide-zinc-800/70 text-sm">
            {loading ? (
              <tr>
                <td colSpan={7} className="py-10 text-center text-zinc-500">
                  Loading resources...
                </td>
              </tr>
            ) : resources.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-10 text-center text-zinc-500">
                  No resources yet. Click &ldquo;+ Add Resource&rdquo; to upload or link an Insights PDF.
                </td>
              </tr>
            ) : (
              resources.map((item) => (
                <tr
                  key={item.id}
                  className="hover:bg-zinc-50/70 dark:hover:bg-zinc-900/50 transition-colors"
                >
                  <td className="py-3 px-4 max-w-md">
                    <div className="font-semibold text-zinc-900 dark:text-white truncate">
                      {item.title_ko}
                    </div>
                    {item.title_en && (
                      <div className="text-xs text-zinc-500 truncate mt-0.5">{item.title_en}</div>
                    )}
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-zinc-400">
                      <span>{item.version}</span>
                      <span>• {item.language}</span>
                      {item.linked_insight_slug && <span>• Insight: /{item.linked_insight_slug}</span>}
                    </div>
                  </td>
                  <td className="py-3 px-3 text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    {getResourceCategoryLabel(item.category, "en")}
                  </td>
                  <td className="py-3 px-3 text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="rounded bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] font-bold">
                        {item.file_type}
                      </span>
                      {item.source_type === "LINKED_INSIGHT_PDF" && (
                        <span className="rounded bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                          Linked Insight PDF
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-[11px] text-zinc-500 truncate max-w-[220px]">
                      {item.file_name || "No file uploaded"}
                      {item.file_size ? ` (${formatBytes(item.file_size)})` : ""}
                    </div>
                  </td>
                  <td className="py-3 px-3 text-xs">
                    {item.audience_mode === "ALL_COMPANIES" ? (
                      <span className="inline-flex rounded-md bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 font-medium text-zinc-700 dark:text-zinc-300">
                        All Active Brands
                      </span>
                    ) : (
                      <span className="inline-flex rounded-md bg-indigo-500/15 px-2 py-0.5 font-medium text-indigo-600 dark:text-indigo-300">
                        Selected ({item.target_company_ids.length})
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3">
                    <span
                      className={`inline-block rounded border px-2 py-0.5 text-[11px] font-bold ${statusBadge(
                        item.status
                      )}`}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-xs text-zinc-500 whitespace-nowrap">
                    {new Date(item.updated_at).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap space-x-1.5">
                    {item.resolved_file_available && (
                      <a
                        href={`/api/admin/brand-comms/resources/${item.id}/download`}
                        className="inline-block rounded-md border border-zinc-200 dark:border-zinc-700 px-2.5 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      >
                        Verify PDF/File
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => openEdit(item)}
                      className="rounded-md border border-zinc-200 dark:border-zinc-700 px-2.5 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                    >
                      Edit
                    </button>
                    {item.status !== "PUBLISHED" ? (
                      <button
                        type="button"
                        onClick={() => handleStatusAction(item, "PUBLISH")}
                        className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700 cursor-pointer"
                      >
                        Publish
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleStatusAction(item, "ARCHIVE")}
                        className="rounded-md border border-zinc-200 dark:border-zinc-700 px-2.5 py-1 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
                      >
                        Archive
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create / Edit Modal */}
      {editorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
          <div className="w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <div>
                <h2 className="text-lg font-bold text-zinc-900 dark:text-white">
                  {editingItem ? "Edit Resource" : "Add New Resource (Draft)"}
                </h2>
                <p className="text-xs text-zinc-500">
                  Upload PDF / XLSX / DOCX or link an existing Insights PDF without duplicating files.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                className="rounded-lg px-2.5 py-1 text-sm text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              {/* Source Mode */}
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3.5 space-y-2.5">
                <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                  File Source
                </div>
                <div className="flex flex-wrap gap-4 text-xs font-medium">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="res_source"
                      checked={form.source_type === "UPLOADED_FILE"}
                      onChange={() => setForm({ ...form, source_type: "UPLOADED_FILE" })}
                    />
                    <span>Upload Managed File (PDF / XLSX / DOCX)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="res_source"
                      checked={form.source_type === "LINKED_INSIGHT_PDF"}
                      onChange={() =>
                        setForm({ ...form, source_type: "LINKED_INSIGHT_PDF", file_type: "PDF" })
                      }
                    />
                    <span>Link Existing Insights PDF (Zero Duplication)</span>
                  </label>
                </div>

                {form.source_type === "LINKED_INSIGHT_PDF" && (
                  <select
                    required
                    value={form.linked_insight_id}
                    onChange={(e) => setForm({ ...form, linked_insight_id: e.target.value })}
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs text-zinc-900 dark:text-white"
                  >
                    <option value="">Select an Insights article with an attached PDF...</option>
                    {pdfInsights.map((ins) => (
                      <option key={ins.id} value={ins.id}>
                        {ins.title_ko} — {ins.pdf?.file_name} ({ins.pdf?.page_count}p)
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Title (KO) *
                  </label>
                  <input
                    required
                    value={form.title_ko}
                    onChange={(e) => setForm({ ...form, title_ko: e.target.value })}
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Title (EN)
                  </label>
                  <input
                    value={form.title_en}
                    onChange={(e) => setForm({ ...form, title_en: e.target.value })}
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Description (KO)
                  </label>
                  <textarea
                    rows={3}
                    value={form.description_ko}
                    onChange={(e) => setForm({ ...form, description_ko: e.target.value })}
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Description (EN)
                  </label>
                  <textarea
                    rows={3}
                    value={form.description_en}
                    onChange={(e) => setForm({ ...form, description_en: e.target.value })}
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Category
                  </label>
                  <select
                    value={form.category}
                    onChange={(e) =>
                      setForm({ ...form, category: e.target.value as ResourceCategory })
                    }
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-white"
                  >
                    {RESOURCE_CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.labelEn}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Version
                  </label>
                  <input
                    value={form.version}
                    onChange={(e) => setForm({ ...form, version: e.target.value })}
                    placeholder="v1.0"
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Language
                  </label>
                  <select
                    value={form.language}
                    onChange={(e) =>
                      setForm({ ...form, language: e.target.value as ResourceLanguage })
                    }
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-white"
                  >
                    {RESOURCE_LANGUAGES.map((l) => (
                      <option key={l.value} value={l.value}>
                        {l.labelEn}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Audience */}
              <div className="space-y-2 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                    Target Audience
                  </span>
                  <div className="flex items-center gap-4 text-xs font-medium">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="res_audience"
                        checked={form.audience_mode === "ALL_COMPANIES"}
                        onChange={() =>
                          setForm({ ...form, audience_mode: "ALL_COMPANIES", target_company_ids: [] })
                        }
                      />
                      <span>All Active Brand Companies</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="res_audience"
                        checked={form.audience_mode === "SELECTED_COMPANIES"}
                        onChange={() => setForm({ ...form, audience_mode: "SELECTED_COMPANIES" })}
                      />
                      <span>Selected Brand Companies</span>
                    </label>
                  </div>
                </div>
                {form.audience_mode === "SELECTED_COMPANIES" && (
                  <CompanyMultiSelect
                    companies={companies}
                    selectedIds={form.target_company_ids}
                    onChange={(ids) => setForm({ ...form, target_company_ids: ids })}
                  />
                )}
              </div>

              <label className="flex items-center gap-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.notification_enabled}
                  onChange={(e) => setForm({ ...form, notification_enabled: e.target.checked })}
                />
                <span>Optional: Send Brand Portal notification upon Publish</span>
              </label>

              {/* File Upload / Replace section for UPLOADED_FILE */}
              {editingItem && form.source_type === "UPLOADED_FILE" && (
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                      Managed File (PDF / XLSX / DOCX — Max 25MB)
                    </span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.xlsx,.docx,application/pdf"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleFileUpload(f);
                      }}
                    />
                    <button
                      type="button"
                      disabled={uploadingFile}
                      onClick={() => fileInputRef.current?.click()}
                      className="rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-1 text-xs font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                    >
                      {uploadingFile
                        ? "Uploading..."
                        : editingItem.file_name
                        ? "Replace File / New Version"
                        : "Upload File"}
                    </button>
                  </div>
                  {editingItem.file_name ? (
                    <div className="flex items-center justify-between rounded-lg bg-zinc-50 dark:bg-zinc-900 px-3 py-2 text-xs">
                      <div className="min-w-0">
                        <div className="font-semibold text-zinc-900 dark:text-white truncate">
                          {editingItem.file_name} ({formatBytes(editingItem.file_size)})
                        </div>
                        {editingItem.file_sha256 && (
                          <div className="text-[10px] font-mono text-zinc-400 truncate">
                            SHA-256: {editingItem.file_sha256}
                          </div>
                        )}
                      </div>
                      <a
                        href={`/api/admin/brand-comms/resources/${editingItem.id}/download`}
                        className="shrink-0 ml-3 text-blue-600 dark:text-blue-400 hover:underline font-medium"
                      >
                        Verify Download
                      </a>
                    </div>
                  ) : (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      Upload a PDF, XLSX, or DOCX file before publishing this resource.
                    </p>
                  )}
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 border-t border-zinc-200 dark:border-zinc-800 pt-4">
                <button
                  type="button"
                  onClick={() => setEditorOpen(false)}
                  className="rounded-lg border border-zinc-200 dark:border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                >
                  {saving ? "Saving..." : editingItem ? "Save Metadata" : "Create Draft"}
                </button>
                {editingItem && editingItem.status !== "PUBLISHED" && (
                  <button
                    type="button"
                    onClick={() => handleStatusAction(editingItem, "PUBLISH")}
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 cursor-pointer"
                  >
                    Publish
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
