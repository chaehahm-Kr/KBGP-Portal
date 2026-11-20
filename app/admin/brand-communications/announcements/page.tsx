"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import CompanyMultiSelect, {
  type SelectableCompany,
} from "@/components/admin/brand-comms/company-multi-select";
import {
  ANNOUNCEMENT_CATEGORIES,
  ANNOUNCEMENT_PRIORITIES,
  formatBytes,
  getAnnouncementCategoryLabel,
  getAnnouncementPriorityLabel,
  type AnnouncementCategory,
  type AnnouncementPriority,
  type AudienceMode,
  type PublicationStatus,
} from "@/lib/brand-comms/types";
import { stageLargeFiles } from "@/lib/files/stage-form-files";

interface AdminAnnouncement {
  id: string;
  title_ko: string;
  title_en: string | null;
  body_ko: string;
  body_en: string | null;
  category: AnnouncementCategory;
  priority: AnnouncementPriority;
  audience_mode: AudienceMode;
  is_pinned: boolean;
  notification_enabled: boolean;
  notification_sent_at: string | null;
  status: PublicationStatus;
  published_at: string | null;
  related_insight_id: string | null;
  related_insight_slug: string | null;
  attachment_storage_path: string | null;
  attachment_file_name: string | null;
  attachment_file_size: number | null;
  author_name: string;
  created_at: string;
  updated_at: string;
  target_company_ids: string[];
  related_resource_ids: string[];
  read_count?: number;
}

interface SelectableInsight {
  id: string;
  slug: string;
  title_ko: string;
  title_en: string | null;
  status: string;
  has_pdf: boolean;
}

interface SelectableResource {
  id: string;
  title_ko: string;
  title_en: string | null;
  category: string;
  file_type: string;
  version: string;
  status: string;
}

const EMPTY_FORM = {
  title_ko: "",
  title_en: "",
  body_ko: "",
  body_en: "",
  category: "GENERAL" as AnnouncementCategory,
  priority: "NORMAL" as AnnouncementPriority,
  audience_mode: "ALL_COMPANIES" as AudienceMode,
  target_company_ids: [] as string[],
  related_resource_ids: [] as string[],
  related_insight_id: "",
  related_insight_slug: "",
  is_pinned: false,
  notification_enabled: true,
  author_name: "K SELECT Operations",
};

export default function AdminBrandAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<AdminAnnouncement[]>([]);
  const [companies, setCompanies] = useState<SelectableCompany[]>([]);
  const [insights, setInsights] = useState<SelectableInsight[]>([]);
  const [resources, setResources] = useState<SelectableResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  // Filters
  const [searchQ, setSearchQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [audienceFilter, setAudienceFilter] = useState("ALL");

  // Editor drawer/modal state
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AdminAnnouncement | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Preview modal
  const [previewItem, setPreviewItem] = useState<AdminAnnouncement | null>(null);
  const [previewLocale, setPreviewLocale] = useState<"ko" | "en">("ko");

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (categoryFilter !== "ALL") params.set("category", categoryFilter);
      if (priorityFilter !== "ALL") params.set("priority", priorityFilter);
      if (audienceFilter !== "ALL") params.set("audience", audienceFilter);
      if (searchQ.trim()) params.set("q", searchQ.trim());

      const [annRes, metaRes] = await Promise.all([
        fetch(`/api/admin/brand-comms/announcements?${params.toString()}`),
        fetch("/api/admin/brand-comms/companies"),
      ]);

      const annData = await annRes.json();
      const metaData = await metaRes.json();
      if (!annRes.ok) throw new Error(annData.error || "Failed to load announcements");

      setAnnouncements(annData.announcements || []);
      if (metaRes.ok) {
        setCompanies(metaData.companies || []);
        setInsights(metaData.insights || []);
        setResources(metaData.resources || []);
      }
    } catch (e: any) {
      setError(e?.message || "Failed to load data.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, categoryFilter, priorityFilter, audienceFilter, searchQ]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const openCreate = () => {
    setEditingItem(null);
    setForm(EMPTY_FORM);
    setFeedback(null);
    setEditorOpen(true);
  };

  const openEdit = (item: AdminAnnouncement) => {
    setEditingItem(item);
    setForm({
      title_ko: item.title_ko || "",
      title_en: item.title_en || "",
      body_ko: item.body_ko || "",
      body_en: item.body_en || "",
      category: item.category,
      priority: item.priority,
      audience_mode: item.audience_mode,
      target_company_ids: item.target_company_ids || [],
      related_resource_ids: item.related_resource_ids || [],
      related_insight_id: item.related_insight_id || "",
      related_insight_slug: item.related_insight_slug || "",
      is_pinned: Boolean(item.is_pinned),
      notification_enabled: Boolean(item.notification_enabled),
      author_name: item.author_name || "K SELECT Operations",
    });
    setFeedback(null);
    setEditorOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      const selectedInsight = insights.find((i) => i.id === form.related_insight_id);
      const payload = {
        ...form,
        related_insight_id: form.related_insight_id || null,
        related_insight_slug: selectedInsight?.slug || form.related_insight_slug || null,
      };

      const url = editingItem
        ? `/api/admin/brand-comms/announcements/${editingItem.id}`
        : "/api/admin/brand-comms/announcements";
      const method = editingItem ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");

      setEditingItem(data.announcement);
      setFeedback({
        type: "ok",
        msg: editingItem
          ? "Announcement updated (no duplicate notifications sent)."
          : "Draft announcement created. Use Publish when ready to distribute.",
      });
      await loadAll();
    } catch (err: any) {
      setFeedback({ type: "err", msg: err?.message || "Save failed" });
    } finally {
      setSaving(false);
    }
  };

  const handleStatusAction = async (
    item: AdminAnnouncement,
    action: "PUBLISH" | "UNPUBLISH" | "ARCHIVE"
  ) => {
    setFeedback(null);
    try {
      const res = await fetch(`/api/admin/brand-comms/announcements/${item.id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `${action} failed`);

      const notifMsg =
        action === "PUBLISH"
          ? ` (Notifications sent: ${data.notifications?.dispatchedCount ?? 0})`
          : "";
      setFeedback({ type: "ok", msg: `Announcement ${action} completed.${notifMsg}` });
      if (editingItem && editingItem.id === item.id) {
        setEditingItem(data.announcement);
      }
      await loadAll();
    } catch (err: any) {
      setFeedback({ type: "err", msg: err?.message || "Action failed" });
    }
  };

  const handleAttachmentUpload = async (file: File) => {
    if (!editingItem) return;
    setUploadingFile(true);
    setFeedback(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const stagedFd = await stageLargeFiles(fd);
      const res = await fetch(`/api/admin/brand-comms/announcements/${editingItem.id}/attachment`, {
        method: "POST",
        body: stagedFd,
      });
      const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setEditingItem((prev) => (prev ? { ...prev, ...data.announcement } : prev));
      setFeedback({ type: "ok", msg: `Attachment uploaded: ${data.announcement.attachment_file_name}` });
      await loadAll();
    } catch (err: any) {
      setFeedback({ type: "err", msg: err?.message || "Attachment upload failed" });
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleAttachmentRemove = async () => {
    if (!editingItem) return;
    setUploadingFile(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/admin/brand-comms/announcements/${editingItem.id}/attachment`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Remove failed");
      setEditingItem((prev) => (prev ? { ...prev, ...data.announcement } : prev));
      setFeedback({ type: "ok", msg: "Attachment removed." });
      await loadAll();
    } catch (err: any) {
      setFeedback({ type: "err", msg: err?.message || "Failed to remove attachment" });
    } finally {
      setUploadingFile(false);
    }
  };

  const toggleResourceLink = (resId: string) => {
    setForm((prev) => {
      const exists = prev.related_resource_ids.includes(resId);
      return {
        ...prev,
        related_resource_ids: exists
          ? prev.related_resource_ids.filter((id) => id !== resId)
          : [...prev.related_resource_ids, resId],
      };
    });
  };

  const stats = {
    total: announcements.length,
    published: announcements.filter((a) => a.status === "PUBLISHED").length,
    draft: announcements.filter((a) => a.status === "DRAFT").length,
    targeted: announcements.filter((a) => a.audience_mode === "SELECTED_COMPANIES").length,
  };

  const statusBadge = (s: PublicationStatus) => {
    if (s === "PUBLISHED")
      return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30";
    if (s === "ARCHIVED")
      return "bg-zinc-500/15 text-zinc-500 dark:text-zinc-400 border-zinc-500/30";
    return "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30";
  };

  const priorityBadge = (p: AnnouncementPriority) => {
    if (p === "ACTION_REQUIRED")
      return "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30";
    if (p === "IMPORTANT")
      return "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30";
    return "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-500">
            <span>Brand Communications</span>
            <span>/</span>
            <Link
              href="/admin/brand-communications/resources"
              className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white underline-offset-4 hover:underline"
            >
              Resources
            </Link>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
            Brand Portal Announcements
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Create, target, preview, and publish announcements to all active brand companies or selected partners.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors cursor-pointer"
        >
          + New Announcement
        </button>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Announcements", value: stats.total },
          { label: "Published", value: stats.published },
          { label: "Drafts", value: stats.draft },
          { label: "Company-Targeted", value: stats.targeted },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4"
          >
            <div className="text-xs font-medium text-zinc-500">{kpi.label}</div>
            <div className="mt-1 text-2xl font-bold text-zinc-900 dark:text-white">
              {kpi.value}
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-3">
        <input
          type="text"
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
          placeholder="Search KO/EN title or body..."
          className="flex-1 min-w-[200px] rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-3 py-1.5 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
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
          {ANNOUNCEMENT_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.labelEn}
            </option>
          ))}
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-800 dark:text-zinc-200"
        >
          <option value="ALL">All Priorities</option>
          {ANNOUNCEMENT_PRIORITIES.map((p) => (
            <option key={p.value} value={p.value}>
              {p.labelEn}
            </option>
          ))}
        </select>
        <select
          value={audienceFilter}
          onChange={(e) => setAudienceFilter(e.target.value)}
          className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-800 dark:text-zinc-200"
        >
          <option value="ALL">All Audiences</option>
          <option value="ALL_COMPANIES">All Active Companies</option>
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
              <th className="py-3 px-4">Announcement</th>
              <th className="py-3 px-3">Category / Priority</th>
              <th className="py-3 px-3">Audience</th>
              <th className="py-3 px-3">Status</th>
              <th className="py-3 px-3">Reads</th>
              <th className="py-3 px-3">Updated</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200/70 dark:divide-zinc-800/70 text-sm">
            {loading ? (
              <tr>
                <td colSpan={7} className="py-10 text-center text-zinc-500">
                  Loading announcements...
                </td>
              </tr>
            ) : announcements.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-10 text-center text-zinc-500">
                  No announcements found. Click &ldquo;+ New Announcement&rdquo; to create a draft.
                </td>
              </tr>
            ) : (
              announcements.map((item) => (
                <tr
                  key={item.id}
                  className="hover:bg-zinc-50/70 dark:hover:bg-zinc-900/50 transition-colors"
                >
                  <td className="py-3 px-4 max-w-md">
                    <div className="flex items-center gap-1.5">
                      {item.is_pinned && (
                        <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                          PIN
                        </span>
                      )}
                      <span className="font-semibold text-zinc-900 dark:text-white truncate">
                        {item.title_ko}
                      </span>
                    </div>
                    {item.title_en && (
                      <div className="text-xs text-zinc-500 truncate mt-0.5">{item.title_en}</div>
                    )}
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-zinc-400">
                      <span>{item.author_name}</span>
                      {item.attachment_file_name && <span>• 📎 {item.attachment_file_name}</span>}
                      {item.related_resource_ids.length > 0 && (
                        <span>• 📁 {item.related_resource_ids.length} linked resource(s)</span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <div className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                      {getAnnouncementCategoryLabel(item.category, "en")}
                    </div>
                    <span
                      className={`mt-1 inline-block rounded border px-1.5 py-0.5 text-[10px] font-bold ${priorityBadge(
                        item.priority
                      )}`}
                    >
                      {item.priority}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-xs">
                    {item.audience_mode === "ALL_COMPANIES" ? (
                      <span className="inline-flex items-center rounded-md bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 font-medium text-zinc-700 dark:text-zinc-300">
                        All Active Brands
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-md bg-indigo-500/15 px-2 py-0.5 font-medium text-indigo-600 dark:text-indigo-300">
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
                    {item.notification_sent_at && (
                      <div className="text-[10px] text-emerald-500 mt-0.5">Notified</div>
                    )}
                  </td>
                  <td className="py-3 px-3 text-xs font-mono text-zinc-600 dark:text-zinc-400">
                    {item.read_count ?? 0}
                  </td>
                  <td className="py-3 px-3 text-xs text-zinc-500 whitespace-nowrap">
                    {new Date(item.updated_at).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap space-x-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setPreviewItem(item);
                        setPreviewLocale("ko");
                      }}
                      className="rounded-md border border-zinc-200 dark:border-zinc-700 px-2.5 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                    >
                      Preview
                    </button>
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
                        onClick={() => handleStatusAction(item, "UNPUBLISH")}
                        className="rounded-md bg-amber-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-amber-700 cursor-pointer"
                      >
                        Unpublish
                      </button>
                    )}
                    {item.status !== "ARCHIVED" && (
                      <button
                        type="button"
                        onClick={() => handleStatusAction(item, "ARCHIVE")}
                        className="rounded-md border border-zinc-200 dark:border-zinc-700 px-2 py-1 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
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
          <div className="w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <div>
                <h2 className="text-lg font-bold text-zinc-900 dark:text-white">
                  {editingItem ? "Edit Announcement" : "Create New Announcement (Draft)"}
                </h2>
                <p className="text-xs text-zinc-500">
                  {editingItem
                    ? `ID: ${editingItem.id.slice(0, 8)} • Status: ${editingItem.status}`
                    : "Saved as DRAFT first. Explicit Publish action distributes to authorized companies."}
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Title (KO) *
                  </label>
                  <input
                    required
                    value={form.title_ko}
                    onChange={(e) => setForm({ ...form, title_ko: e.target.value })}
                    placeholder="한국어 공지 제목을 입력하세요"
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
                    placeholder="English announcement title (optional)"
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Body (KO) *
                  </label>
                  <textarea
                    required
                    rows={6}
                    value={form.body_ko}
                    onChange={(e) => setForm({ ...form, body_ko: e.target.value })}
                    placeholder="한국어 공지 본문을 입력하세요..."
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Body (EN)
                  </label>
                  <textarea
                    rows={6}
                    value={form.body_en}
                    onChange={(e) => setForm({ ...form, body_en: e.target.value })}
                    placeholder="English announcement body (optional)..."
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
                      setForm({ ...form, category: e.target.value as AnnouncementCategory })
                    }
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-white"
                  >
                    {ANNOUNCEMENT_CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.labelEn} ({c.labelKo})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Priority
                  </label>
                  <select
                    value={form.priority}
                    onChange={(e) =>
                      setForm({ ...form, priority: e.target.value as AnnouncementPriority })
                    }
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-white"
                  >
                    {ANNOUNCEMENT_PRIORITIES.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.labelEn} ({p.labelKo})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Author Display Name
                  </label>
                  <input
                    value={form.author_name}
                    onChange={(e) => setForm({ ...form, author_name: e.target.value })}
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Audience Selection */}
              <div className="space-y-2 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                    Target Audience
                  </span>
                  <div className="flex items-center gap-4 text-xs font-medium">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="ann_audience"
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
                        name="ann_audience"
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

              {/* Related Resources & Insights */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Link Resource Center Items (No File Duplication)
                  </label>
                  <div className="max-h-36 overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-200/60 dark:divide-zinc-800 bg-zinc-50/40 dark:bg-zinc-900/40">
                    {resources.length === 0 ? (
                      <div className="p-2.5 text-xs text-zinc-500">No resources available yet.</div>
                    ) : (
                      resources.map((r) => (
                        <label
                          key={r.id}
                          className="flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer hover:bg-zinc-100/70 dark:hover:bg-zinc-800/50"
                        >
                          <input
                            type="checkbox"
                            checked={form.related_resource_ids.includes(r.id)}
                            onChange={() => toggleResourceLink(r.id)}
                          />
                          <span className="truncate flex-1">{r.title_ko}</span>
                          <span className="text-[10px] font-mono text-zinc-400">
                            {r.file_type} · {r.status}
                          </span>
                        </label>
                      ))
                    )}
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Related Public Insights Article (Optional)
                    </label>
                    <select
                      value={form.related_insight_id}
                      onChange={(e) => setForm({ ...form, related_insight_id: e.target.value })}
                      className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs text-zinc-900 dark:text-white"
                    >
                      <option value="">None</option>
                      {insights.map((ins) => (
                        <option key={ins.id} value={ins.id}>
                          [{ins.status}] {ins.title_ko} ({ins.slug})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-6 pt-1 text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.is_pinned}
                        onChange={(e) => setForm({ ...form, is_pinned: e.target.checked })}
                      />
                      <span>Pin to Top</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.notification_enabled}
                        onChange={(e) =>
                          setForm({ ...form, notification_enabled: e.target.checked })
                        }
                      />
                      <span>Send Portal Notification on Publish</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Optional Attachment (available once saved) */}
              {editingItem && (
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                      Optional Direct Attachment (PDF / XLSX / DOCX)
                    </span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.xlsx,.docx,application/pdf"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleAttachmentUpload(f);
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
                        : editingItem.attachment_file_name
                        ? "Replace File"
                        : "Upload File"}
                    </button>
                  </div>
                  {editingItem.attachment_file_name ? (
                    <div className="flex items-center justify-between rounded-lg bg-zinc-50 dark:bg-zinc-900 px-3 py-2 text-xs">
                      <div>
                        <span className="font-semibold text-zinc-900 dark:text-white">
                          {editingItem.attachment_file_name}
                        </span>
                        <span className="ml-2 text-zinc-500">
                          ({formatBytes(editingItem.attachment_file_size)})
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <a
                          href={`/api/admin/brand-comms/announcements/${editingItem.id}/attachment`}
                          className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                        >
                          Verify Download
                        </a>
                        <button
                          type="button"
                          onClick={handleAttachmentRemove}
                          className="text-rose-500 hover:underline font-medium"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-500">
                      No direct attachment. Prefer linking a Resource Center item when reusing shared documents.
                    </p>
                  )}
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 border-t border-zinc-200 dark:border-zinc-800 pt-4">
                <button
                  type="button"
                  onClick={() => setEditorOpen(false)}
                  className="rounded-lg border border-zinc-200 dark:border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                >
                  {saving ? "Saving..." : editingItem ? "Save Changes" : "Save Draft"}
                </button>
                {editingItem && editingItem.status !== "PUBLISHED" && (
                  <button
                    type="button"
                    onClick={() => handleStatusAction(editingItem, "PUBLISH")}
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 cursor-pointer"
                  >
                    Publish Now
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* KO/EN Preview Modal */}
      {previewItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-2xl max-h-[88vh] overflow-y-auto rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                  Brand Portal Preview
                </span>
                <div className="inline-flex rounded-md border border-zinc-200 dark:border-zinc-700 p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setPreviewLocale("ko")}
                    className={`px-2 py-0.5 rounded ${
                      previewLocale === "ko"
                        ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 font-semibold"
                        : "text-zinc-500"
                    }`}
                  >
                    KO
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewLocale("en")}
                    className={`px-2 py-0.5 rounded ${
                      previewLocale === "en"
                        ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 font-semibold"
                        : "text-zinc-500"
                    }`}
                  >
                    EN
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewItem(null)}
                className="rounded-lg px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className={`rounded border px-2 py-0.5 font-bold ${priorityBadge(previewItem.priority)}`}>
                  {getAnnouncementPriorityLabel(previewItem.priority, previewLocale)}
                </span>
                <span className="rounded bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 font-medium text-zinc-700 dark:text-zinc-300">
                  {getAnnouncementCategoryLabel(previewItem.category, previewLocale)}
                </span>
                <span className="text-zinc-400">• {previewItem.author_name}</span>
              </div>
              <h3 className="text-xl font-bold text-zinc-900 dark:text-white">
                {previewLocale === "en" && previewItem.title_en
                  ? previewItem.title_en
                  : previewItem.title_ko}
              </h3>
              <div className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-700 dark:text-zinc-300 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 p-4 border border-zinc-200/70 dark:border-zinc-800">
                {previewLocale === "en" && previewItem.body_en
                  ? previewItem.body_en
                  : previewItem.body_ko}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
